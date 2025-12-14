import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { DraftEmailDto } from '../gmail-automation/dto/draft-email.dto';
import { GmailAutomationService } from '../gmail-automation/gmail-automation.service';
import { IntentEngineService } from '../intent-engine/intent-engine.service';
import { OpenAIService } from '../openai/openai.service';

@Injectable()
export class ActionOrchestratorService {
  private readonly logger = new Logger(ActionOrchestratorService.name);

  constructor(
    private readonly intentEngine: IntentEngineService,
    private readonly gmailService: GmailAutomationService,
    private readonly openAIService: OpenAIService,
  ) {}

  private async generateEmailDraft(prompt: string): Promise<DraftEmailDto> {
    try {
      this.logger.debug('[ORCHESTRATOR] Generating email draft from prompt:', { prompt });

      const systemPrompt = `You are an expert email writing assistant. Given a prompt, your job is to write a professional email as JSON.

Respond in *exactly* this format (no additional text):

{
  "to": "recipient@example.com",
  "subject": "Short, clear subject",
  "body": "Well-written, professional body content"
}

Ensure:
- Do NOT include 'intent' or 'entities'
- All three fields must be present
- Output must be VALID JSON ONLY
- Keep the subject line clear and specific
- Write in a professional but friendly tone
- Be concise and to the point
- Start with a proper greeting (use recipient's name if available, otherwise use 'Hi there')
- End with a polite closing line (e.g., 'Best regards,' or 'Thank you,')
- Do NOT include the sender's name or any footer/signature (e.g., 'John', '[Your Name]', '[Sent by ALF.RED]')
- A signature will be added by the system later`;

      const response = await this.openAIService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        model: 'gpt-4.1-nano',
        temperature: 0.7
      });

      this.logger.debug('[ORCHESTRATOR] Raw OpenAI response:', {
        response,
        content: response.choices?.[0]?.message?.content,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error('[ORCHESTRATOR] No content in OpenAI response:', { response });
        throw new InternalServerErrorException('No content in OpenAI response');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        this.logger.error('[ORCHESTRATOR] Failed to parse OpenAI response as JSON:', { error, content });
        throw new InternalServerErrorException('Failed to parse generated email (invalid JSON)');
      }

      // Validate required fields
      if (!parsed?.to || !parsed?.subject || !parsed?.body) {
        this.logger.error('[ORCHESTRATOR] Invalid draft format (missing fields):', { parsed });
        throw new InternalServerErrorException('Generated email format is invalid');
      }

      const draft: DraftEmailDto = {
        to: parsed.to,
        subject: parsed.subject,
        body: parsed.body,
      };

      this.logger.debug('[ORCHESTRATOR] Successfully generated email draft:', {
        to: draft.to,
        subjectLength: draft.subject.length,
        bodyLength: draft.body.length,
        subject: draft.subject.substring(0, 50) + (draft.subject.length > 50 ? '...' : ''),
        bodyPreview: draft.body.substring(0, 100) + (draft.body.length > 100 ? '...' : '')
      });

      return draft;
    } catch (error) {
      this.logger.error('[ORCHESTRATOR] Failed to generate email draft:', {
        error,
        prompt,
      });
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to generate email draft');
    }
  }

  async orchestrateIntent(userId: string, message: string): Promise<string> {
    try {
      this.logger.debug('[ORCHESTRATOR] Processing message:', { userId, message });

      // Parse intent
      const intentResult = await this.intentEngine.parseIntent(message);
      this.logger.debug('[ORCHESTRATOR] Intent parsed:', intentResult);

      // Handle email actions
      if (intentResult.intent === 'email.send' || intentResult.intent === 'email.reply') {
        try {
          // Generate draft
          const draft = await this.generateEmailDraft(message);
          this.logger.debug('[ORCHESTRATOR] Draft generated:', {
            to: draft.to,
            subjectLength: draft.subject.length,
            bodyLength: draft.body.length,
            subject: draft.subject.substring(0, 50) + (draft.subject.length > 50 ? '...' : ''),
            bodyPreview: draft.body.substring(0, 100) + (draft.body.length > 100 ? '...' : '')
          });

          // Create draft in Gmail
          await this.gmailService.createDraft({
            userId,
            ...draft
          });
          this.logger.debug('[ORCHESTRATOR] Draft created in Gmail');

          // Send the draft
          await this.gmailService.sendDraft(userId, draft);
          this.logger.debug('[ORCHESTRATOR] Draft sent successfully');

          return `I've sent your email to ${draft.to}, Master.`;
        } catch (error) {
          this.logger.error('[ORCHESTRATOR] Failed to handle email action:', {
            error,
            intent: intentResult.intent,
          });
          throw new InternalServerErrorException('Failed to process email action');
        }
      } else {
        this.logger.warn('[ORCHESTRATOR] Unsupported intent:', { intent: intentResult.intent });
        throw new InternalServerErrorException('Unsupported action');
      }
    } catch (error) {
      this.logger.error('[ORCHESTRATOR] Failed to orchestrate intent:', {
        error,
        userId,
        message,
      });
      throw error;
    }
  }
} 