import { Module } from '@nestjs/common';
import { ChatbotService } from '../chatbot/chatbot.service';
import { CommonModule } from '../common/common.module'; // ✅ this line
import { GmailAutomationModule } from '../gmail-automation/gmail-automation.module';
import { OpenAIModule } from '../openai/openai.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    CommonModule,
    GmailAutomationModule,
    OpenAIModule,
    SupabaseModule,
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService, ChatbotService],
})
export class WhatsappModule {}
