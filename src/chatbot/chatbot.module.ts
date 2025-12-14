import { Module } from '@nestjs/common';
import { ContextService } from '../common/context.service';
import { OpenAIModule } from '../common/openai.service';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';

@Module({
  imports: [OpenAIModule],
  controllers: [ChatbotController],
  providers: [ChatbotService, ContextService],
})
export class ChatbotModule {} 