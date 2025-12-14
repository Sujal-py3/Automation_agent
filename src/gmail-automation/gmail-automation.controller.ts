import { Controller, Post, Body, Get, Query, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { GmailAutomationService } from './gmail-automation.service';
import { SendEmailDto } from './dto/send-email.dto';
import { CreateDraftDto } from './dto/create-draft.dto';

@Controller('gmail')
export class GmailAutomationController {
  private readonly logger = new Logger(GmailAutomationController.name);

  constructor(private readonly gmailAutomationService: GmailAutomationService) {}

  @Post('send')
  async sendEmail(@Body() dto: SendEmailDto) {
    try {
      this.logger.debug('[CONTROLLER] Sending email:', {
        userId: dto.userId,
        to: dto.to,
        subjectLength: dto.subject.length,
      });

      await this.gmailAutomationService.sendEmail(dto);
      return { message: 'Email sent successfully' };
    } catch (error) {
      this.logger.error('[CONTROLLER] Failed to send email:', error);
      throw new HttpException(
        'Failed to send email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('draft')
  async createDraft(@Body() dto: CreateDraftDto) {
    try {
      this.logger.debug('[CONTROLLER] Creating draft:', {
        userId: dto.userId,
        to: dto.to,
        subjectLength: dto.subject.length,
      });

      await this.gmailAutomationService.createDraft(dto);
      return { message: 'Draft created successfully' };
    } catch (error) {
      this.logger.error('[CONTROLLER] Failed to create draft:', error);
      throw new HttpException(
        'Failed to create draft',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('inbox/summary')
  async getInboxSummary(@Query('userId') userId: string) {
    try {
      this.logger.debug('[CONTROLLER] Getting inbox summary:', { userId });

      const summary = await this.gmailAutomationService.getInboxSummary(userId);
      return summary;
    } catch (error) {
      this.logger.error('[CONTROLLER] Failed to get inbox summary:', error);
      throw new HttpException(
        'Failed to get inbox summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 