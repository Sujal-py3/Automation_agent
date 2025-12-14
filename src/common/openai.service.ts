import { Injectable, Module } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async chat(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages,
    });

    return response.choices[0]?.message?.content || '';
  }
}

@Module({
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {} 