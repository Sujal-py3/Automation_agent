// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActionOrchestratorModule } from './action-orchestrator/action-orchestrator.module';
import { AuthModule } from './auth/auth.module';
import { CalendarAutomationModule } from './calendar-automation/calendar-automation.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { GmailAutomationModule } from './gmail-automation/gmail-automation.module';
import { IntentEngineModule } from './intent-engine/intent-engine.module';
import { OpenAIModule } from './openai/openai.module';
import { WhatsappModule } from './WhatsApp/whatsapp.module'; // ✅ added

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    OpenAIModule,
    ChatbotModule,
    IntentEngineModule,
    ActionOrchestratorModule,
    GmailAutomationModule,
    CalendarAutomationModule,
    AuthModule,
    WhatsappModule, // ✅ added here too
  ],
})
export class AppModule {}
