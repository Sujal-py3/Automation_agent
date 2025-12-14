import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatRequestDto } from './dto/chat.dto';
import OpenAI from 'openai';

describe('ChatbotController', () => {
  let controller: ChatbotController;
  let chatbotService: ChatbotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatbotController],
      providers: [
        {
          provide: ChatbotService,
          useValue: { getResponse: jest.fn() },
        },
      ],
    }).compile();
    controller = module.get<ChatbotController>(ChatbotController);
    chatbotService = module.get<ChatbotService>(ChatbotService);
  });

  it('should return response from service', async () => {
    (chatbotService.getResponse as jest.Mock).mockResolvedValue('Hello!');
    const dto: ChatRequestDto = { userId: 'u1', message: 'Hi' };
    const res = await controller.chat(dto);
    expect(res).toEqual({ response: 'Hello!' });
    expect(chatbotService.getResponse).toHaveBeenCalledWith('u1', 'Hi');
  });
}); 