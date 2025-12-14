// whatsapp.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from '../common/twilio.service';
import { EmailDrafterService } from '../gmail-automation/email-drafter.service';
import { GmailAutomationService } from '../gmail-automation/gmail-automation.service';
import { OpenAIService } from '../openai/openai.service';
import { SupabaseService } from '../supabase/supabase.service';

interface SessionState {
  step: string;
  data: any;
}

function getDisplayName(email?: string): string {
  const username = email?.split('@')[0] || '';
  const namePart = username.split(/[._]/)[0];
  return namePart ? `Master ${namePart.charAt(0).toUpperCase() + namePart.slice(1)}` : 'Master';
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly sessions: Map<string, SessionState> = new Map();
  private readonly authUrl: string;

  constructor(
    private readonly twilioService: TwilioService,
    private readonly emailDrafter: EmailDrafterService,
    private readonly gmailService: GmailAutomationService,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly openAIService: OpenAIService,
  ) {
    this.authUrl = this.configService.get<string>('AUTH_URL') || 'http://localhost:8000/auth';
  }

  async handleIncomingMessage(from: string, message: string): Promise<void> {
    const normalized = message.trim().toLowerCase();
    const cleanNumber = from.replace('whatsapp:', '').trim();

    const { data: user } = await this.supabaseService
      .getClient()
      .from('users')
      .select('id, email, google_access_token')
      .eq('whatsapp_number', cleanNumber)
      .maybeSingle();

    if (!user || !user.google_access_token) {
      const loginUrl = `${this.authUrl}?whatsapp=${encodeURIComponent(cleanNumber)}`;
      await this.twilioService.sendMessage(
        from,
        `🔗 Kindly connect your Google account, ${getDisplayName()}.\n${loginUrl}\n\nThen simply return and say "Hi", and I shall attend to your digital needs.`
      );
      return;
    }

    if (!this.sessions.has(from)) {
      this.sessions.set(from, { step: 'initial', data: { userId: user.id, email: user.email } });
    }

    const session = this.sessions.get(from)!;

    const greetingOnly = /^(hi|hello|hey|greetings|alfred)[!.]*$/i.test(normalized);
    const isEmailRequest = /\b(send|write|compose|mail|email|message|tell|inform|reach out|contact)\b/i.test(normalized);
    const isReminderRequest = /(remind|reminder|remember)/i.test(normalized);
    const isReplyRequest = /reply.*email/i.test(normalized);
    const aboutMeRegex = /(who (are|r) you|tell me about yourself|what do you do|introduce yourself)/i;

    if (aboutMeRegex.test(message)) {
      const reply = `🎩 Ah, ${getDisplayName(user.email)}, a pleasure as always.

I am Alfred Pennyworth, the ever-loyal butler to the Wayne family. I've dedicated my life to assisting Master Bruce (Batman) and ensuring that both the manor and mission run smoothly.

I offer strategic advice, medical support, and the occasional dry wit. If you require my assistance, I am at your service. 🕰️`;
      for (const part of splitBySentences(reply)) {
        await this.twilioService.sendMessage(from, part);
      }
      return;
    }

    if (greetingOnly) {
      const displayName = getDisplayName(user.email);
      await this.twilioService.sendMessage(
        from,
        `🎩 At your service, ${displayName}.\n\nI can assist with:\n- 📧 Writing or replying to an email\n- ⏰ Setting a reminder\n\nJust say what you need done, and I shall handle the rest.`
      );
      session.step = 'waiting_for_intent';
      return;
    }

    // Auto-detect email & message in one prompt
    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && isEmailRequest) {
      const recipient = emailMatch[0];
      const messageBody = message.replace(recipient, '').replace(/email.*id.*is/i, '').replace(/(mail|message|send|tell).*/i, '').trim();
      session.data.recipient = recipient;
      session.data.purpose = messageBody || 'No message specified.';
      session.step = 'confirm_draft';

      await this.twilioService.sendMessage(from, '⏳ Drafting your message, do give me a moment...');

      const prompt = `To: ${recipient}\nMessage: ${session.data.purpose}`;
      const draft = await this.emailDrafter.generateEmailDraft(prompt);
      session.data.draft = draft;

      await this.twilioService.sendMessage(
        from,
        `📨 Here's your message draft:\n\nTo: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}\n\nShall I proceed? Just say "send", "edit", or "cancel".`
      );
      return;
    }

    if (session.step === 'waiting_for_intent' || session.step === 'initial') {
      if (isEmailRequest) {
        session.step = 'get_recipient';
        await this.twilioService.sendMessage(from, '📧 Very well. Whom shall I address this email to?');
        return;
      }

      if (isReminderRequest) {
        session.step = 'set_reminder';
        await this.twilioService.sendMessage(from, '⏰ What would you like to be reminded about, and when?');
        return;
      }

      if (isReplyRequest) {
        session.step = 'reply_email';
        await this.twilioService.sendMessage(from, '📨 Please tell me the subject of the email you wish to reply to.');
        return;
      }

      // Fallback: OpenAI Chat
      session.step = 'chatting';
      session.data.history = session.data.history || [];
      session.data.history.push({ role: 'user', content: message });

      const fallback = await this.openAIService.chat({
        messages: [
          { role: 'system', content: `You are Alfred, Batman’s butler—elegant, witty, sarcastic but helpful. Always respond in character.` },
          ...session.data.history.slice(-5)
        ],
        model: 'gpt-4o',
        temperature: 0.85
      });

      const reply = fallback.choices?.[0]?.message?.content?.trim();
      if (reply) {
        session.data.history.push({ role: 'assistant', content: reply });
        for (const part of splitBySentences(reply || '')) {
          await this.twilioService.sendMessage(from, part);
        }
      } else {
        await this.twilioService.sendMessage(from, '🤔 I’m a bit unsure how to proceed. Could you rephrase that, Master?');
      }
      return;
    }

    if (session.step === 'get_recipient') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(message)) {
        await this.twilioService.sendMessage(from, '❌ That doesn’t look like an email address. Could you try again?');
        return;
      }
      session.data.recipient = message;
      session.step = 'get_purpose';
      await this.twilioService.sendMessage(from, '📝 And what is the purpose or message you wish to convey?');
      return;
    }

    if (session.step === 'get_purpose') {
      session.data.purpose = message;
      session.step = 'confirm_draft';

      await this.twilioService.sendMessage(from, '⏳ Allow me a moment to prepare your draft...');
      const prompt = `To: ${session.data.recipient}\nPurpose: ${message}`;
      const draft = await this.emailDrafter.generateEmailDraft(prompt);
      session.data.draft = draft;

      await this.twilioService.sendMessage(
        from,
        `📨 Here is your composed message:\n\nTo: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}\n\nShall I proceed? Just say "send", "edit", or "cancel".`
      );
      return;
    }

    if (session.step === 'confirm_draft') {
      if (normalized.includes('send')) {
        await this.twilioService.sendMessage(from, '📤 Dispatching your email...');
        await this.gmailService.createDraft({ userId: session.data.userId, ...session.data.draft });
        await this.gmailService.sendDraft(session.data.userId, session.data.draft);
        await this.twilioService.sendMessage(from, `✅ Your message has been sent with grace. Anything else, ${getDisplayName(session.data.email)}?`);
        this.sessions.delete(from);
        return;
      }

      if (normalized.includes('cancel')) {
        await this.twilioService.sendMessage(from, '❌ Draft discarded. Should you wish again, you know where to find me.');
        this.sessions.delete(from);
        return;
      }

      if (normalized.includes('edit')) {
        session.step = 'edit_draft';
        await this.twilioService.sendMessage(from, '🔧 What would you like to edit? (subject/body/recipient)');
        return;
      }

      await this.twilioService.sendMessage(from, 'Reply with "send", "edit", or "cancel", kind sir.');
      return;
    }

    if (session.step === 'edit_draft') {
      if (normalized === 'subject') {
        session.step = 'edit_subject';
        await this.twilioService.sendMessage(from, '✏️ Please provide the new subject:');
        return;
      }
      if (normalized === 'body') {
        session.step = 'edit_body';
        await this.twilioService.sendMessage(from, '✏️ Please provide the new email body:');
        return;
      }
      if (normalized === 'recipient') {
        session.step = 'edit_recipient';
        await this.twilioService.sendMessage(from, '✏️ Please provide the new recipient email:');
        return;
      }
      await this.twilioService.sendMessage(from, 'Please specify what to edit: subject, body, or recipient.');
      return;
    }

    if (session.step === 'edit_subject') {
      session.data.draft.subject = message;
      session.step = 'confirm_draft';
      await this.twilioService.sendMessage(from, '✅ Subject updated. Ready to send, edit more, or cancel?');
      return;
    }

    if (session.step === 'edit_body') {
      session.data.draft.body = message;
      session.step = 'confirm_draft';
      await this.twilioService.sendMessage(from, '✅ Body updated. Shall I proceed to send?');
      return;
    }

    if (session.step === 'edit_recipient') {
      session.data.draft.to = message;
      session.step = 'confirm_draft';
      await this.twilioService.sendMessage(from, `✅ Recipient updated. All ready, ${getDisplayName(session.data.email)}.`);
      return;
    }
  }
}

function splitBySentences(text: string): string[] {
  const rawChunks = text
    .split(/\n\s*\n/)
    .flatMap(para => para.match(/[^.!?\n]+[.!?]*/g) || []);

  const chunks: string[] = [];
  let current = '';

  for (const part of rawChunks) {
    const trimmed = part.trim();
    if ((current + ' ' + trimmed).length > 300) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current += (current ? ' ' : '') + trimmed;
    }
  }

  if (current) chunks.push(current.trim());
  return chunks;
}
