import { Controller, Post, Body, BadRequestException, Logger } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

@Controller('chat')
export class ChatbotController {
  private readonly logger = new Logger(ChatbotController.name);

  constructor(private readonly chatbotService: ChatbotService) {}

  @Post()
  async chat(@Body() body: ChatRequestDto): Promise<ChatResponseDto> {
    this.logger.debug('[CHAT] Request body:', body);

    if (!body.userId) {
      this.logger.warn('[CHAT] Missing userId in request');
      throw new BadRequestException('userId is required');
    }

    if (!body.message) {
      this.logger.warn('[CHAT] Missing message in request');
      throw new BadRequestException('message is required');
    }

    try {
      const response = await this.chatbotService.getResponse(body.userId, body.message);
      this.logger.debug('[CHAT] Response generated successfully');
      return { response };
    } catch (error) {
      this.logger.error('[CHAT] Error processing request:', error);
      throw error;
    }
  }
} 