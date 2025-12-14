import { Module } from '@nestjs/common';
import { CalendarAutomationService } from './calendar-automation.service';

@Module({
  providers: [CalendarAutomationService],
  exports: [CalendarAutomationService],
})
export class CalendarAutomationModule {} 