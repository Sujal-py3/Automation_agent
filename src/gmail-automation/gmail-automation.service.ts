import { Injectable, Logger, HttpException, HttpStatus, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { google } from 'googleapis';
import { SupabaseService } from '../supabase/supabase.service';
import { SendEmailDto } from './dto/send-email.dto';
import { ConfigService } from '@nestjs/config';
import { GoogleTokens } from '../common/interfaces/google-tokens.interface';
import { CreateDraftDto } from './dto/create-draft.dto';
import { DraftEmailDto } from './dto/draft-email.dto';

interface InboxSummary {
  unreadCount: number;
  emails: Array<{
    subject: string;
    from: string;
    date: string;
    snippet: string;
  }>;
  summary: string;
}

interface GmailDraftResponse {
  id: string;
  message: {
    id: string;
    threadId: string;
  };
}

interface GmailError extends Error {
  code?: number;
  status?: number;
  errors?: Array<{
    message: string;
    domain: string;
    reason: string;
  }>;
}

@Injectable()
export class GmailAutomationService {
  private readonly logger = new Logger(GmailAutomationService.name);
  private readonly SIGNATURE_REGEX = /Best,\n.{2,}\n\[Sent by ALF\.RED\]/;
  private readonly PLACEHOLDER_REGEX = /\[(?:Your|Sender|User) Name\]/gi;
  private readonly CLOSING_REGEX = /(?:Best|Regards|Sincerely|Warm regards|Cheers|Thanks|Thank you|Yours|Cordially|Respectfully|Kind regards|Best wishes|Looking forward|Take care)(?:,|\.|\n|$)/i;
  private readonly ALF_RED_MARKER = /\[Sent by ALF\.RED\]/;
  private readonly GREETING_REGEX = /^(?:Dear|Hi|Hello|Hey|Greetings)(?:\s+[^,\n]+)?(?:,|\n|$)/i;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    // Validate Supabase configuration
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      this.logger.error('[GMAIL] Missing Supabase configuration:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      });
      throw new Error('Missing required Supabase configuration');
    }
  }

  private isExpired(expiryDate: number | undefined): boolean {
    if (!expiryDate) return true;
    return Date.now() >= expiryDate;
  }

  private async refreshTokens(userId: string, refreshToken: string | undefined): Promise<GoogleTokens> {
    try {
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      this.logger.debug('[GMAIL] Refreshing access token for user:', { userId });

      const oauth2Client = new google.auth.OAuth2(
        this.configService.get<string>('GOOGLE_CLIENT_ID'),
        this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
        this.configService.get<string>('GOOGLE_REDIRECT_URI'),
      );

      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update tokens in Supabase
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase
        .from('users')
        .update({
          google_access_token: credentials.access_token ?? '',
          google_token_expiry: new Date(credentials.expiry_date ?? Date.now()).toISOString(),
        })
        .eq('id', userId);

      if (error) {
        this.logger.error('[GMAIL] Failed to update tokens in Supabase:', error);
        throw new Error('Failed to update tokens');
      }

      return {
        access_token: credentials.access_token ?? '',
        refresh_token: credentials.refresh_token ?? undefined,
        scope: credentials.scope ?? undefined,
        token_type: credentials.token_type ?? undefined,
        expiry_date: credentials.expiry_date ?? undefined,
      };
    } catch (error) {
      this.logger.error('[GMAIL] Failed to refresh tokens:', error);
      throw new HttpException('Failed to refresh tokens', HttpStatus.UNAUTHORIZED);
    }
  }

  private async getValidTokens(userId: string): Promise<GoogleTokens> {
    try {
      this.logger.debug('[GMAIL] Fetching tokens for user:', { userId });

      const supabase = this.supabaseService.getClient();
      const { data: user, error } = await supabase
        .from('users')
        .select('google_access_token, google_refresh_token, google_token_expiry')
        .eq('id', userId)
        .single();

      if (error) {
        this.logger.error('[GMAIL] Error fetching user tokens:', {
          error,
          userId,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
          errorCode: error.code
        });
        throw new HttpException('Failed to fetch user tokens', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      if (!user?.google_access_token) {
        this.logger.error('[GMAIL] No access token found for user:', { userId });
        throw new HttpException('No access token found', HttpStatus.UNAUTHORIZED);
      }

      this.logger.debug('[GMAIL] Retrieved tokens from Supabase:', {
        hasAccessToken: !!user.google_access_token,
        hasRefreshToken: !!user.google_refresh_token,
        expiryDate: user.google_token_expiry,
      });

      // Check if token is expired
      if (this.isExpired(new Date(user.google_token_expiry).getTime())) {
        if (!user.google_refresh_token) {
          this.logger.error('[GMAIL] Token expired and no refresh token available:', { userId });
          throw new HttpException('Token expired and no refresh token available', HttpStatus.UNAUTHORIZED);
        }

        return this.refreshTokens(userId, user.google_refresh_token);
      }

      return {
        access_token: user.google_access_token,
        refresh_token: user.google_refresh_token ?? undefined,
        scope: 'https://www.googleapis.com/auth/gmail.send',
        token_type: 'Bearer',
        expiry_date: new Date(user.google_token_expiry).getTime(),
      };
    } catch (error) {
      this.logger.error('[GMAIL] Failed to get valid tokens:', {
        error,
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error instanceof HttpException ? error : new HttpException('Failed to get valid tokens', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async getGmailClient(input: string | GoogleTokens) {
    try {
      this.logger.debug('[GMAIL] Initializing Gmail client:', {
        inputType: typeof input === 'string' ? 'userId' : 'tokens',
        hasTokens: typeof input !== 'string'
      });

      let tokens: GoogleTokens;
      
      if (typeof input === 'string') {
        tokens = await this.getValidTokens(input);
      } else {
        tokens = input;
      }

      this.logger.debug('[GMAIL] Creating OAuth2 client with tokens:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date
      });

      const oauth2Client = new google.auth.OAuth2(
        this.configService.get<string>('GOOGLE_CLIENT_ID'),
        this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
        this.configService.get<string>('GOOGLE_REDIRECT_URI'),
      );

      oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      this.logger.debug('[GMAIL] Successfully created Gmail client');
      return gmail;
    } catch (error) {
      this.logger.error('[GMAIL] Failed to create Gmail client:', {
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        inputType: typeof input === 'string' ? 'userId' : 'tokens'
      });
      throw new InternalServerErrorException('Failed to create Gmail client');
    }
  }

  private async getUserName(userId: string): Promise<string> {
    try {
      this.logger.debug('[GMAIL] Fetching user name:', { userId });

      const { data: user, error } = await this.supabaseService
        .getClient()
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      if (error) {
        this.logger.error('[GMAIL] Failed to fetch user name:', {
          error,
          userId,
          errorMessage: error.message
        });
        return 'User';
      }

      if (!user?.name) {
        this.logger.warn('[GMAIL] No name found for user:', { userId });
        return 'User';
      }

      this.logger.debug('[GMAIL] Successfully fetched user name:', {
        userId,
        name: user.name
      });

      return user.name;
    } catch (error) {
      this.logger.error('[GMAIL] Error fetching user name:', {
        error,
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      return 'User';
    }
  }

  private async appendSignature(body: string, userId: string): Promise<string> {
    try {
      this.logger.debug('[GMAIL] Starting signature append:', {
        userId,
        bodyLength: body.length,
        bodyPreview: body.substring(0, 100) + (body.length > 100 ? '...' : '')
      });

      // Remove any existing signature
      let cleanBody = body.replace(this.SIGNATURE_REGEX, '').trim();
      
      // Remove any placeholder names
      cleanBody = cleanBody.replace(this.PLACEHOLDER_REGEX, '').trim();

      // Remove any ALF.RED markers
      cleanBody = cleanBody.replace(this.ALF_RED_MARKER, '').trim();

      // Remove trailing closings and empty lines
      let wasTrimmed = false;
      let trimmedLines = 0;
      const lines = cleanBody.split('\n');
      
      // Process from the end, removing closings and empty lines
      while (lines.length > 0) {
        const lastLine = lines[lines.length - 1].trim();
        
        // Check if the line is a closing phrase or empty
        if (this.CLOSING_REGEX.test(lastLine) || lastLine === '') {
          lines.pop();
          wasTrimmed = true;
          trimmedLines++;
          
          // If we found a closing, also remove any empty lines after it
          while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
            lines.pop();
            trimmedLines++;
          }
        } else {
          break;
        }
      }
      
      cleanBody = lines.join('\n').trim();

      // Get user's name
      const userName = await this.getUserName(userId);

      // Append signature
      const signature = `\n\nBest,\n${userName}\n[Sent by ALF.RED]`;
      
      this.logger.debug('[GMAIL] Appending signature:', {
        userId,
        userName,
        bodyLength: cleanBody.length,
        signatureLength: signature.length,
        wasTrimmed,
        trimmedLines,
        finalLength: cleanBody.length + signature.length,
        originalLength: body.length,
        removedContent: body.length - cleanBody.length
      });

      return cleanBody + signature;
    } catch (error) {
      this.logger.error('[GMAIL] Failed to append signature:', {
        error,
        userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      // Fallback to original body with default signature
      return body + '\n\nBest,\nUser\n[Sent by ALF.RED]';
    }
  }

  private async encodeEmail(draft: DraftEmailDto & { userId: string }): Promise<string> {
    try {
      // Append signature to body
      const bodyWithSignature = await this.appendSignature(draft.body, draft.userId);

      const message = [
        'Content-Type: text/plain; charset="UTF-8"\n',
        'MIME-Version: 1.0\n',
        `To: ${draft.to}\n`,
        `Subject: ${draft.subject}\n\n`,
        bodyWithSignature
      ].join('');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      return encodedMessage;
    } catch (error) {
      this.logger.error('[GMAIL] Failed to encode email:', {
        error,
        userId: draft.userId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new InternalServerErrorException('Failed to encode email');
    }
  }

  async sendEmail(dto: SendEmailDto): Promise<void> {
    try {
      this.logger.debug('[GMAIL] Preparing to send email:', { userId: dto.userId, to: dto.to, subject: dto.subject });

      const tokens = await this.getValidTokens(dto.userId);
      const gmail = await this.getGmailClient(tokens);

      // Create email message
      const emailLines = [
        `To: ${dto.to}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${dto.subject}`,
        '',
        dto.body,
      ];

      const email = emailLines.join('\r\n').trim();
      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Send email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      // Store in Supabase
      const { error: dbError } = await this.supabaseService
        .getClient()
        .from('gmail_emails')
        .insert({
          user_id: dto.userId,
          to: dto.to,
          subject: dto.subject,
          body: dto.body,
          status: 'sent',
          message_id: response.data.id ?? '',
          thread_id: response.data.threadId ?? '',
        });

      if (dbError) {
        this.logger.error('[GMAIL] Failed to store email in database:', dbError);
        throw new InternalServerErrorException('Failed to store email record');
      }

      this.logger.debug('[GMAIL] Email sent successfully:', {
        messageId: response.data.id ?? '',
        threadId: response.data.threadId ?? '',
      });
    } catch (error) {
      this.logger.error('[GMAIL] Failed to send email:', {
        error,
        userId: dto.userId,
      });
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async createDraft(draft: DraftEmailDto & { userId: string }): Promise<GmailDraftResponse> {
    try {
      this.logger.debug('[GMAIL] Attempting to create draft:', {
        userId: draft.userId,
        to: draft.to,
        subject: draft.subject.substring(0, 50) + (draft.subject.length > 50 ? '...' : ''),
        bodyPreview: draft.body.substring(0, 50) + (draft.body.length > 50 ? '...' : ''),
        subjectLength: draft.subject.length,
        bodyLength: draft.body.length
      });

      const gmail = await this.getGmailClient(draft.userId);
      const encodedMessage = await this.encodeEmail(draft);

      this.logger.debug('[GMAIL] Encoded message preview:', {
        preview: encodedMessage.substring(0, 100) + (encodedMessage.length > 100 ? '...' : ''),
        length: encodedMessage.length
      });

      try {
        const response = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw: encodedMessage
            }
          }
        });

        this.logger.debug('[GMAIL] Draft created successfully:', {
          draftId: response.data.id ?? '',
          messageId: response.data.message?.id ?? '',
          threadId: response.data.message?.threadId ?? ''
        });

        return {
          id: response.data.id ?? '',
          message: {
            id: response.data.message?.id ?? '',
            threadId: response.data.message?.threadId ?? ''
          }
        };
      } catch (gmailError) {
        const err = gmailError as GmailError;
        this.logger.error('[GMAIL] Full error creating draft:', {
          error: err,
          errorMessage: err.message ?? 'Unknown error',
          errorCode: err.code ?? 'Unknown code',
          errorStatus: err.status ?? 'Unknown status',
          errorDetails: err.errors ?? [],
          userId: draft.userId,
          to: draft.to,
          subjectLength: draft.subject.length,
          bodyLength: draft.body.length
        });
        throw new InternalServerErrorException(
          `Failed to create email draft: ${err.message ?? 'Unknown error'}`
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('[GMAIL] Failed to create draft:', {
        error: err,
        errorMessage: err.message ?? 'Unknown error',
        userId: draft.userId,
        to: draft.to,
        subjectLength: draft.subject.length,
        bodyLength: draft.body.length
      });
      throw new InternalServerErrorException(
        `Failed to create email draft: ${err.message ?? 'Unknown error'}`
      );
    }
  }

  async sendDraft(userId: string, draft: DraftEmailDto): Promise<void> {
    try {
      this.logger.debug('[GMAIL] Sending draft:', {
        userId,
        to: draft.to,
        subjectLength: draft.subject.length,
        bodyLength: draft.body.length,
        subject: draft.subject.substring(0, 50) + (draft.subject.length > 50 ? '...' : ''),
        bodyPreview: draft.body.substring(0, 100) + (draft.body.length > 100 ? '...' : '')
      });

      if (!draft.to || !draft.subject || !draft.body) {
        this.logger.warn('[GMAIL] Missing required draft fields:', {
          userId,
          hasTo: !!draft.to,
          hasSubject: !!draft.subject,
          hasBody: !!draft.body
        });
        throw new BadRequestException('Missing required draft fields');
      }

      const gmail = await this.getGmailClient(userId);
      const encodedMessage = await this.encodeEmail({ ...draft, userId });

      this.logger.debug('[GMAIL] Encoded message preview:', {
        preview: encodedMessage.substring(0, 100) + (encodedMessage.length > 100 ? '...' : ''),
        length: encodedMessage.length
      });

      try {
        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: {
            raw: encodedMessage
          }
        });

        this.logger.debug('[GMAIL] Draft sent successfully:', {
          messageId: response.data.id ?? '',
          threadId: response.data.threadId ?? ''
        });
      } catch (gmailError) {
        const err = gmailError as GmailError;
        this.logger.error('[GMAIL] Full error sending draft:', {
          error: err,
          errorMessage: err.message ?? 'Unknown error',
          errorCode: err.code ?? 'Unknown code',
          errorStatus: err.status ?? 'Unknown status',
          errorDetails: err.errors ?? [],
          userId,
          to: draft.to,
          subjectLength: draft.subject.length,
          bodyLength: draft.body.length
        });
        throw new InternalServerErrorException(
          `Failed to send email draft: ${err.message ?? 'Unknown error'}`
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('[GMAIL] Failed to send draft:', {
        error: err,
        errorMessage: err.message ?? 'Unknown error',
        userId,
        to: draft.to,
        subjectLength: draft.subject.length,
        bodyLength: draft.body.length
      });
      throw new InternalServerErrorException(
        `Failed to send email draft: ${err.message ?? 'Unknown error'}`
      );
    }
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  private formatEmailSummary(email: { subject: string; from: string; date: string; snippet: string }, index: number): string {
    const from = email.from.split('<')[0].trim();
    const date = this.formatDate(email.date);
    return `${index + 1}. [${date}] ${from} - "${email.subject}"\n   Snippet: ${email.snippet}`;
  }

  async getInboxSummary(userId: string): Promise<{ unreadCount: number; summary: string }> {
    try {
      this.logger.debug('[GMAIL] Getting inbox summary for user:', { userId });

      const { data, error } = await this.supabaseService
        .getClient()
        .from('gmail_emails')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'unread')
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('[GMAIL] Failed to get inbox summary:', error);
        throw new InternalServerErrorException('Failed to get inbox summary');
      }

      const unreadCount = data?.length || 0;
      const summary = data
        ?.map(email => `${email.subject} (${email.to})`)
        .join('\n') || 'No unread emails';

      this.logger.debug('[GMAIL] Inbox summary retrieved:', {
        unreadCount,
        summaryLength: summary.length,
      });

      return { unreadCount, summary };
    } catch (error) {
      this.logger.error('[GMAIL] Failed to get inbox summary:', {
        error,
        userId,
      });
      throw new InternalServerErrorException('Failed to get inbox summary');
    }
  }

  async handleIntent(userId: string, intent: string, entities: Record<string, string>): Promise<string> {
    try {
      this.logger.debug('[GMAIL] Handling intent:', { userId, intent, entities });

      switch (intent) {
        case 'email.send':
          return this.composeEmail(userId, entities);
        case 'email.reply':
          return this.replyToEmail(userId, entities);
        case 'email.create_draft':
          const draftResult = await this.createDraft({
            userId,
            to: entities.to ?? '',
            subject: entities.subject ?? 'Draft',
            body: entities.body ?? '',
          });
          return `I've saved your message as a draft with ID ${draftResult.id}, Master.`;
        case 'email.summarize':
          return this.summarizeEmails(userId, entities);
        case 'email.get_inbox_summary':
          const summary = await this.getInboxSummary(userId);
          return `You have ${summary.unreadCount} unread messages, Master. Would you like me to summarize them?`;
        default:
          throw new Error(`Unsupported intent: ${intent}`);
      }
    } catch (error) {
      this.logger.error('[GMAIL] Failed to handle intent:', error);
      throw error;
    }
  }

  async composeEmail(userId: string, entities: Record<string, string>): Promise<string> {
    try {
      this.logger.debug('[GMAIL] Composing email:', { userId, entities });

      const draftResult = await this.createDraft({
        userId,
        to: entities.to ?? '',
        subject: entities.subject ?? 'Draft',
        body: entities.body ?? '',
      });

      return `I've drafted your message, Master. Would you like me to send it now? (Draft ID: ${draftResult.id})`;
    } catch (error) {
      this.logger.error('[GMAIL] Failed to compose email:', error);
      throw error;
    }
  }

  async replyToEmail(userId: string, entities: Record<string, string>): Promise<string> {
    try {
      this.logger.debug('[GMAIL] Preparing reply:', { userId, entities });

      const draftResult = await this.createDraft({
        userId,
        to: entities.to ?? '',
        subject: entities.subject ?? 'Re: ' + (entities.original_subject ?? ''),
        body: entities.body ?? '',
      });

      return `I've prepared your reply, Master. Shall I send it? (Draft ID: ${draftResult.id})`;
    } catch (error) {
      this.logger.error('[GMAIL] Failed to prepare reply:', error);
      throw error;
    }
  }

  async summarizeEmails(userId: string, entities: Record<string, string>): Promise<string> {
    this.logger.debug('[GMAIL] Would summarize emails:', { userId, entities });
    return "Here's a summary of your recent emails, Master.";
  }
} 