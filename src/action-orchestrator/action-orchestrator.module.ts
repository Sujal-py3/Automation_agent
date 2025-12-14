import { Module } from '@nestjs/common';
import { ActionOrchestratorService } from './action-orchestrator.service';
import { GmailAutomationModule } from '../gmail-automation/gmail-automation.module';
import { IntentEngineModule } from '../intent-engine/intent-engine.module';
import { OpenAIModule } from '../openai/openai.module';
import { ActionOrchestratorController } from './action-orchestrator.controller';

@Module({
  imports: [
    GmailAutomationModule,
    IntentEngineModule,
    OpenAIModule,
  ],
  controllers: [ActionOrchestratorController],
  providers: [ActionOrchestratorService],
  exports: [ActionOrchestratorService],
})
export class ActionOrchestratorModule {} 