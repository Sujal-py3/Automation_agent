import { Test, TestingModule } from '@nestjs/testing';
import { IntentEngineService } from './intent-engine.service';
import { OpenAIService } from '../openai/openai.service';
import { ConfigService } from '@nestjs/config';

describe('IntentEngineService', () => {
  let service: IntentEngineService;
  let openAIService: OpenAIService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentEngineService,
        {
          provide: OpenAIService,
          useValue: {
            chat: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('gpt-4.1-nano'),
          },
        },
      ],
    }).compile();

    service = module.get<IntentEngineService>(IntentEngineService);
    openAIService = module.get<OpenAIService>(OpenAIService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseIntent', () => {
    it('should return unknown intent for empty message', async () => {
      const result = await service.parseIntent('');
      expect(result).toEqual({ intent: 'unknown', entities: {} });
    });

    it('should parse email.send intent', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null,
            function_call: {
              name: 'parse_intent',
              arguments: JSON.stringify({
                intent: 'email.send',
                entities: {
                  recipient: 'john@example.com',
                  subject: 'Project Update',
                },
              }),
            },
          },
        }],
      };

      jest.spyOn(openAIService, 'chat').mockResolvedValue(mockResponse);

      const result = await service.parseIntent('Send an email to john@example.com about the project update');
      expect(result).toEqual({
        intent: 'email.send',
        entities: {
          recipient: 'john@example.com',
          subject: 'Project Update',
        },
      });
    });

    it('should handle invalid response format', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null,
            function_call: {
              name: 'parse_intent',
              arguments: 'invalid json',
            },
          },
        }],
      };

      jest.spyOn(openAIService, 'chat').mockResolvedValue(mockResponse);

      const result = await service.parseIntent('Send an email');
      expect(result).toEqual({ intent: 'unknown', entities: {} });
    });

    it('should handle missing function call', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null,
          },
        }],
      };

      jest.spyOn(openAIService, 'chat').mockResolvedValue(mockResponse);

      const result = await service.parseIntent('Send an email');
      expect(result).toEqual({ intent: 'unknown', entities: {} });
    });

    it('should handle OpenAI API error', async () => {
      jest.spyOn(openAIService, 'chat').mockRejectedValue(new Error('API Error'));

      const result = await service.parseIntent('Send an email');
      expect(result).toEqual({ intent: 'unknown', entities: {} });
    });
  });
}); 