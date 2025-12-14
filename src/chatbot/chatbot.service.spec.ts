import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from './chatbot.service';
import { OpenAIService } from '../common/openai.service';
import { ContextService } from '../common/context.service';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked response' } }],
        }),
      },
    },
  }));
});

describe('ChatbotService', () => {
  let service: ChatbotService;
  let openAIService: OpenAIService;
  let contextService: ContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        {
          provide: OpenAIService,
          useValue: { chat: jest.fn() },
        },
        {
          provide: ContextService,
          useValue: {
            getRecentMessages: jest.fn().mockResolvedValue([]),
            saveMessage: jest.fn(),
          },
        },
      ],
    }).compile();
    service = module.get<ChatbotService>(ChatbotService);
    openAIService = module.get<OpenAIService>(OpenAIService);
    contextService = module.get<ContextService>(ContextService);
  });

  it('should construct messages and call OpenAI', async () => {
    (contextService.getRecentMessages as jest.Mock).mockResolvedValue([
      { role: 'user', content: 'Hi' } as OpenAI.Chat.Completions.ChatCompletionMessageParam,
      { role: 'assistant', content: 'Hello.' } as OpenAI.Chat.Completions.ChatCompletionMessageParam,
    ]);
    (openAIService.chat as jest.Mock).mockResolvedValue('How can I help you?');
    const res = await service.getResponse('user1', 'What time is it?');
    expect(openAIService.chat).toHaveBeenCalledWith([
      { role: 'system', content: expect.stringContaining('Alfred Pennyworth') },
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello.' },
      { role: 'user', content: 'What time is it?' },
    ]);
    expect(contextService.saveMessage).toHaveBeenCalledWith('user1', 'user', 'What time is it?');
    expect(contextService.saveMessage).toHaveBeenCalledWith('user1', 'assistant', 'How can I help you?');
    expect(res).toBe('How can I help you?');
  });

  it('should return fallback on OpenAI error', async () => {
    (contextService.getRecentMessages as jest.Mock).mockResolvedValue([]);
    (openAIService.chat as jest.Mock).mockRejectedValue(new Error('fail'));
    const res = await service.getResponse('user2', 'Hello?');
    expect(res).toMatch(/I'm sorry|I'm sorry/);
    expect(contextService.saveMessage).toHaveBeenCalledWith('user2', 'user', 'Hello?');
    expect(contextService.saveMessage).toHaveBeenCalledWith('user2', 'assistant', expect.stringMatching(/I'm sorry|I'm sorry/));
  });

  describe('getResponse', () => {
    it('should include system prompt, few-shots, and user message in the correct order', async () => {
      const mockContext: ChatCompletionMessageParam[] = [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' },
      ];

      jest.spyOn(contextService, 'getRecentMessages').mockResolvedValue(mockContext);

      const openai = new OpenAI();
      const createSpy = jest.spyOn(openai.chat.completions, 'create');

      await service.getResponse('user123', 'Hello Alfred');

      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'system', content: expect.any(String) },
          ...mockContext,
          { role: 'user', content: 'Hello Alfred' },
        ]),
      }));
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(contextService, 'getRecentMessages').mockRejectedValue(new Error('Test error'));

      await expect(service.getResponse('user123', 'Hello')).rejects.toThrow('Failed to get response from chatbot');
    });
  });
}); 