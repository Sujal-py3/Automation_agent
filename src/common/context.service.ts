import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { getSupabase } from '../config/supabase.client';

@Injectable()
export class ContextService {
  private readonly logger = new Logger(ContextService.name);
  private readonly supabase = getSupabase();

  async getRecentMessages(userId: string, limit = 10): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    this.logger.debug(`Fetching recent messages for user ${userId} with limit ${limit}`);
    
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .select('role, content')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error('Supabase error fetching messages:', {
          error,
          userId,
          limit
        });
        return [];
      }

      this.logger.debug(`Retrieved ${data?.length || 0} messages for user ${userId}`);
      return data.map(msg => ({ role: msg.role, content: msg.content } as OpenAI.Chat.Completions.ChatCompletionMessageParam));
    } catch (error) {
      this.logger.error('Error fetching messages:', {
        error,
        userId,
        limit
      });
      return [];
    }
  }

  async saveMessage(userId: string, role: 'user' | 'assistant', content: string): Promise<void> {
    this.logger.debug(`Saving message for user ${userId}:`, {
      role,
      contentLength: content.length
    });

    try {
      const { error } = await this.supabase
        .from('messages')
        .insert({
          user_id: userId,
          role,
          content,
          timestamp: new Date().toISOString()
        });

      if (error) {
        this.logger.error('Supabase error saving message:', {
          error,
          userId,
          role
        });
        throw error;
      }

      this.logger.debug(`Successfully saved ${role} message for user ${userId}`);
    } catch (error) {
      this.logger.error('Error saving message:', {
        error,
        userId,
        role
      });
      throw error;
    }
  }
} 