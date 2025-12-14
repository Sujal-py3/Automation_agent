import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  function_call?: { name: string };
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
      function_call?: {
        name: string;
        arguments: string;
      } | null;
    };
  }>;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    this.openai = new OpenAI({ apiKey });
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      this.logger.debug('[OPENAI] Sending chat request:', {
        model: request.model,
        messageCount: request.messages.length,
        hasFunctionCall: !!request.function_call,
      });

      const response = await this.openai.chat.completions.create({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        function_call: request.function_call,
      });

      this.logger.debug('[OPENAI] Received response:', {
        hasChoices: !!response.choices?.length,
        firstChoice: response.choices?.[0] ? {
          hasContent: !!response.choices[0].message?.content,
          hasFunctionCall: !!response.choices[0].message?.function_call,
        } : null,
      });

      if (!response.choices?.[0]?.message) {
        this.logger.error('[OPENAI] Invalid response structure:', { response });
        throw new InternalServerErrorException('Invalid response from OpenAI');
      }

      return {
        choices: [{
          message: {
            content: response.choices[0].message.content,
            function_call: response.choices[0].message.function_call ? {
              name: response.choices[0].message.function_call.name,
              arguments: response.choices[0].message.function_call.arguments,
            } : null,
          },
        }],
      };
    } catch (error) {
      this.logger.error('[OPENAI] API call failed:', {
        error,
        model: request.model,
      });
      throw new InternalServerErrorException('Failed to get response from OpenAI');
    }
  }
} 