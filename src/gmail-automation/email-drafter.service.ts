import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';

interface DraftedEmail {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class EmailDrafterService {
  private readonly logger = new Logger(EmailDrafterService.name);

  constructor(private readonly openAIService: OpenAIService) {}

  private extractDraftFromResponse(content: string): DraftedEmail {
    try {
      this.logger.debug('[DRAFTER] Raw content to parse:', { content });
      const parsed = JSON.parse(content);
      
      // Fallback for old structure with entities
      if (parsed?.entities?.recipient && parsed?.entities?.subject && parsed?.entities?.body) {
        this.logger.debug('[DRAFTER] Using legacy format with entities');
        return {
          to: parsed.entities.recipient,
          subject: parsed.entities.subject,
          body: parsed.entities.body,
        };
      }

      // Expected flat structure
      if (parsed?.to && parsed?.subject && parsed?.body) {
        this.logger.debug('[DRAFTER] Using flat format');
        return {
          to: parsed.to,
          subject: parsed.subject,
          body: parsed.body,
        };
      }

      this.logger.error('[DRAFTER] Invalid draft format:', { parsed });
      throw new InternalServerErrorException('Generated email format is invalid');
    } catch (error) {
      this.logger.error('[DRAFTER] Failed to parse OpenAI response:', {
        error,
        content,
      });
      throw new InternalServerErrorException('Failed to parse email content');
    }
  }

  async generateEmailDraft(prompt: string): Promise<DraftedEmail> {
    try {
      this.logger.debug('[DRAFTER] Generating email draft from prompt:', { prompt });

      const systemPrompt = `You are Alfred, Batman’s butler — witty, classy, but brief. You reply in short texts, 1–3 sentences max, like a charming assistant over WhatsApp. Don’t monologue. Split replies naturally.Address the user based on the surname extracted from their email. Your response should be gender neutral.Your task is to compose an email draft in JSON, based on the user’s prompt.

Respond in exactly this format:

{
  "to": "recipient@example.com",
  "subject": "Elegant and clear subject line",
  "body": "A graceful, articulate, and courteous email body"
}

Instructions:
- Use polished, respectful, and eloquent language with a subtle touch of British wit.
- Greet appropriately ('Dear [Name]', 'Greetings', or 'Dear Sir/Madam').
- Maintain a formal tone but allow for warmth and charm when suitable.
- Avoid sender's name or any footer—leave that for the system.
- End with a graceful sign-off such as 'Warm regards', 'Respectfully yours', etc.
- DO NOT include markdown, explanations, or anything outside valid JSON.

You must return a valid JSON object ONLY.
`;

      

      this.logger.debug('[DRAFTER] Sending request to OpenAI:', {
        systemPrompt,
        userPrompt: prompt,
      });

      const response = await this.openAIService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        model: 'gpt-4.1-nano',
        temperature: 0.7,
      });

      this.logger.debug('[DRAFTER] Raw OpenAI response:', {
        response,
        content: response.choices?.[0]?.message?.content,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.error('[DRAFTER] No content in OpenAI response:', { response });
        throw new InternalServerErrorException('No content in OpenAI response');
      }

      try {
        const draft = this.extractDraftFromResponse(content);
        
        this.logger.debug('[DRAFTER] Successfully generated email draft:', {
          to: draft.to,
          subjectLength: draft.subject.length,
          bodyLength: draft.body.length,
        });

        return draft;
      } catch (error) {
        this.logger.error('[DRAFTER] Failed to parse OpenAI response:', {
          error,
          content,
        });
        throw new InternalServerErrorException('Failed to parse generated email');
      }
    } catch (error) {
      this.logger.error('[DRAFTER] Failed to generate email draft:', {
        error,
        prompt,
      });
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to generate email draft');
    }
  }
} 