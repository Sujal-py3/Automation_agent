import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios'; // ✅ Import HttpModule
import { TwilioService } from './twilio.service';
import { ContextService } from './context.service';

@Module({
  imports: [HttpModule], // ✅ Add HttpModule here
  providers: [TwilioService, ContextService],
  exports: [TwilioService, ContextService],
})
export class CommonModule {}
