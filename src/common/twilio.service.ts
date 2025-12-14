import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly whatsappNumber: string;

  constructor(private readonly configService: ConfigService) {
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID')!;
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN')!;
    this.whatsappNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER')!; // e.g., 'whatsapp:+14155238886'
  }

  async sendMessage(to: string, body: string): Promise<void> {
    const payload = new URLSearchParams({
      From: this.whatsappNumber,
      To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      Body: body,
    });

    try {
      const response = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        payload,
        {
          auth: {
            username: this.accountSid,
            password: this.authToken,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.logger.debug(`✅ WhatsApp message sent to ${to}`);
    } catch (error: any) {
      this.logger.error('❌ Failed to send WhatsApp message:', error?.response?.data || error.message);
    }
  }
}
