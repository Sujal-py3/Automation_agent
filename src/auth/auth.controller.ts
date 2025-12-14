import { BadRequestException, Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TwilioService } from '../common/twilio.service';
import { SupabaseService } from '../supabase/supabase.service';
import { GoogleAuthService } from './google-auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly googleAuthService: GoogleAuthService,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly twilioService: TwilioService
  ) {}

  @Get()
  async start(@Query('whatsapp') whatsappNumber: string, @Res() res: Response): Promise<void> {
    try {
      this.logger.debug('[AUTH] Starting login process:', { whatsappNumber });

      whatsappNumber = whatsappNumber?.trim();

      if (whatsappNumber && !/^[+][1-9]\d{1,14}$/.test(whatsappNumber)) {
        throw new BadRequestException('Invalid WhatsApp number format. Use E.164 format like +1234567890');
      }

      const sessionId = uuidv4();
      await this.supabaseService.getClient()
        .from('auth_sessions')
        .insert({
          id: sessionId,
          whatsapp_number: whatsappNumber,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        });

      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');
      const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.compose openid email profile');
      const state = encodeURIComponent(sessionId);
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&state=${state}&prompt=consent`;

      res.redirect(authUrl);
    } catch (error) {
      this.logger.error('[AUTH] Login error:', error);
      res.redirect('/auth/error?message=' + encodeURIComponent('Login failed'));
    }
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') sessionId: string,
    @Res() res: Response
  ): Promise<void> {
    try {
      this.logger.debug('[AUTH] Received callback with code and state:', { sessionId });

      const { data: session, error: sessionError } = await this.supabaseService
        .getClient()
        .from('auth_sessions')
        .select('whatsapp_number')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        this.logger.error('[AUTH] Invalid or expired session:', { sessionError });
        throw new BadRequestException('Invalid or expired session');
      }

      const tokens = await this.googleAuthService.exchangeCode(code);
      const profile = await this.googleAuthService.getUserProfile(tokens.access_token);

      let userId: string;

      const { data: existingUser } = await this.supabaseService
        .getClient()
        .from('users')
        .select('id')
        .eq('whatsapp_number', session.whatsapp_number)
        .maybeSingle();

      if (existingUser) {
        await this.supabaseService
          .getClient()
          .from('users')
          .update({
            email: profile.email,
            name: profile.name,
            google_access_token: tokens.access_token,
            google_refresh_token: tokens.refresh_token ?? null,
            google_token_expiry: tokens.expiry_date
              ? new Date(tokens.expiry_date).toISOString()
              : null,
          })
          .eq('id', existingUser.id);

        userId = existingUser.id;
      } else {
        const { id: newUserId } = await this.supabaseService.createOrUpdateUserByEmail(
          profile.email,
          profile.name,
          tokens,
          session.whatsapp_number
        );
        userId = newUserId;
      }

      if (session.whatsapp_number) {
        const { error: updateError } = await this.supabaseService
          .getClient()
          .from('users')
          .update({ whatsapp_number: session.whatsapp_number })
          .eq('id', userId);

        if (updateError) {
          this.logger.error('[AUTH] Failed to update WhatsApp number:', updateError);
        } else {
          this.logger.debug('[AUTH] Updated WhatsApp number for user:', {
            userId,
            whatsappNumber: session.whatsapp_number,
          });

          await this.twilioService.sendMessage(
            session.whatsapp_number,
            `✅ You're now authenticated and ready to use ALF.RED!\n\nTry typing:\n• "Send mail"\n• "Set reminder"\n• "Reply to email"\n\nWelcome aboard! 🎩`
          );
        }
      }

      await this.supabaseService.getClient().from('auth_sessions').delete().eq('id', sessionId);

      res.status(200).send(`
        <html>
          <head><title>Authentication Complete</title></head>
          <body style="font-family: Arial; text-align: center; padding: 2rem; background-color: #f5f5f5;">
            <h1>✅ Auth Complete</h1>
            <p>You can now return to WhatsApp and continue using Alfred.</p>
            <p style="color: grey; font-size: 0.9rem;">This tab can be closed.</p>
          </body>
        </html>
      `);
    } catch (error) {
      this.logger.error('[AUTH] Callback error:', error);
      res.redirect('/auth/error?message=' + encodeURIComponent('Authentication failed'));
    }
  }

  @Get('success')
  success(@Query('userId') userId: string): string {
    return `...`;
  }

  @Get('error')
  error(@Query('message') message: string): string {
    return `...`;
  }
}
