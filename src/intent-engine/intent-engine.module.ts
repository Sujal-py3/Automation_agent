import { Module } from '@nestjs/common';
import { IntentEngineService } from './intent-engine.service';
import { OpenAIModule } from '../openai/openai.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    OpenAIModule,
    ConfigModule,
  ],
  providers: [IntentEngineService],
  exports: [IntentEngineService],
})
export class IntentEngineModule {} 