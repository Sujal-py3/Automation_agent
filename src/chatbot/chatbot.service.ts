import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ContextService } from '../common/context.service';
import { getSupabase } from '../config/supabase.client';

function extractLastName(fullName: string | null): string {
  if (!fullName) return 'sir';
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly openai: OpenAI;
  private readonly supabase = getSupabase();

  constructor(private readonly contextService: ContextService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private async getUserPrompt(userId: string): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('name')
        .eq('id', userId)
        .single();

      if (error) {
        this.logger.error('Error fetching user name:', { error, userId });
        return 'sir';
      }

      const lastName = extractLastName(data?.name);
      this.logger.debug('User name details:', {
        userId,
        fullName: data?.name,
        extractedLastName: lastName
      });

      return `
You are Alfred Pennyworth, the loyal butler. You always address the user as "Master ${lastName}".
You are formal, discreet, and never make things up.
Only respond with real information or admit what you don't know.
`;
    } catch (error) {
      this.logger.error('Error in getUserPrompt:', { error, userId });
      return 'sir';
    }
  }

  async getResponse(userId: string, userMessage: string): Promise<string> {
    this.logger.debug(`Processing message for user ${userId}`);
    
    try {
      // Save user message first
      await this.contextService.saveMessage(userId, 'user', userMessage);
      this.logger.debug(`Saved user message for ${userId}`);

      // Get context
      const context = await this.contextService.getRecentMessages(userId);
      this.logger.debug(`Retrieved ${context.length} context messages for ${userId}`);
      
      // Get dynamic system prompt with user's name
      const systemPrompt = await this.getUserPrompt(userId);
      this.logger.debug('Constructed system prompt:', { systemPrompt });
      
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...context,
        { role: 'user', content: userMessage }
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages,
        temperature: 0.7,
        max_tokens: 150,
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, but I seem to be having trouble responding at the moment.';
      
      // Save assistant response
      await this.contextService.saveMessage(userId, 'assistant', response);
      this.logger.debug(`Saved assistant response for ${userId}`);
      
      return response;
    } catch (error) {
      this.logger.error('Error in getResponse:', {
        error,
        userId,
        userMessageLength: userMessage.length
      });
      throw new Error('Failed to get response from chatbot');
    }
  }
} 