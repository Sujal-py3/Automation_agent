import { Controller, Post, Body } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  async handleWebhook(@Body() body: any): Promise<string> {
    const from = body.From;
    const message = body.Body?.trim();

    if (!from || !message) return 'Invalid request';
    await this.whatsappService.handleIncomingMessage(from, message);
    return 'OK';
  }
}
