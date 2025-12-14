import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';
import { ConfigService } from '@nestjs/config';

interface IntentResult {
  intent: string;
  entities: Record<string, string>;
}

@Injectable()
export class IntentEngineService {
  private readonly logger = new Logger(IntentEngineService.name);
  private readonly validIntents = new Set([
    'email.send',
    'email.reply',
    'email.forward',
    'email.delete',
    'email.archive',
    'email.label',
    'unknown'
  ]);

  constructor(
    private readonly openAIService: OpenAIService,
    private readonly configService: ConfigService,
  ) {}

  private validateIntentResult(result: any): IntentResult {
    // Ensure result is an object
    if (!result || typeof result !== 'object') {
      this.logger.warn('[INTENT] Invalid result type:', { result });
      return { intent: 'unknown', entities: {} };
    }

    // Validate intent
    if (!result.intent || typeof result.intent !== 'string' || !this.validIntents.has(result.intent)) {
      this.logger.warn('[INTENT] Invalid intent:', { intent: result.intent });
      return { intent: 'unknown', entities: {} };
    }

    // Validate entities
    if (!result.entities || typeof result.entities !== 'object') {
      this.logger.warn('[INTENT] Invalid entities:', { entities: result.entities });
      return { intent: result.intent, entities: {} };
    }

    // Clean entities to ensure all values are strings
    const cleanEntities: Record<string, string> = {};
    for (const [key, value] of Object.entries(result.entities)) {
      if (typeof value === 'string') {
        cleanEntities[key] = value;
      }
    }

    return {
      intent: result.intent,
      entities: cleanEntities
    };
  }

  async parseIntent(message: string): Promise<IntentResult> {
    try {
      if (!message?.trim()) {
        this.logger.debug('[INTENT] Empty message received');
        return { intent: 'unknown', entities: {} };
      }

      this.logger.debug('[INTENT] Parsing message:', { message });

      const systemPrompt = `You are an intent detection system. Your job is to analyze user messages and extract the intent and relevant entities.

Respond ONLY with a JSON object in this exact format:
{
  "intent": "string",  // One of: email.send, email.reply, email.forward, email.delete, email.archive, email.label, unknown
  "entities": {
    "key": "value"     // All values must be strings
  }
}

Rules:
- Output must be valid JSON ONLY
- No explanations or natural language
- Intent must be one of the valid options
- All entity values must be strings
- If unsure, use "unknown" intent
- If no entities found, use empty object {}`;

      const response = await this.openAIService.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        model: this.configService.get<string>('OPENAI_MODEL') || 'gpt-4.1-nano',
        temperature: 0.1,
      });

      this.logger.debug('[INTENT] Raw OpenAI response:', {
        response,
        content: response.choices?.[0]?.message?.content,
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.warn('[INTENT] No content in response');
        return { intent: 'unknown', entities: {} };
      }

      try {
        const parsed = JSON.parse(content);
        const validated = this.validateIntentResult(parsed);
        
        this.logger.debug('[INTENT] Successfully parsed intent:', {
          intent: validated.intent,
          entityCount: Object.keys(validated.entities).length,
        });

        return validated;
      } catch (error) {
        this.logger.error('[INTENT] Failed to parse intent response:', {
          error,
          content,
        });
        return { intent: 'unknown', entities: {} };
      }
    } catch (error) {
      this.logger.error('[INTENT] Failed to detect intent:', {
        error,
        message,
      });
      return { intent: 'unknown', entities: {} };
    }
  }
} 