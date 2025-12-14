import { Module } from '@nestjs/common';
import { GmailAutomationService } from './gmail-automation.service';
import { GmailAutomationController } from './gmail-automation.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { ConfigModule } from '@nestjs/config';
import { EmailDrafterService } from './email-drafter.service';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [SupabaseModule, ConfigModule, OpenAIModule],
  controllers: [GmailAutomationController],
  providers: [GmailAutomationService, EmailDrafterService],
  exports: [GmailAutomationService, EmailDrafterService],
})
export class GmailAutomationModule {} 