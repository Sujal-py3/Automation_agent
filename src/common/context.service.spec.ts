import { Test, TestingModule } from '@nestjs/testing';
import { ContextService } from './context.service';
import OpenAI from 'openai';

// Mock the Supabase client
jest.mock('../config/supabase.client', () => ({
  getSupabase: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
  }),
}));

describe('ContextService', () => {
  let service: ContextService;
  const mockSupabase = require('../config/supabase.client').getSupabase();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContextService],
    }).compile();

    service = module.get<ContextService>(ContextService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRecentMessages', () => {
    it('should fetch messages from Supabase', async () => {
      const mockMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      mockSupabase.limit.mockResolvedValueOnce({ data: mockMessages, error: null });

      const result = await service.getRecentMessages('user123', 2);

      expect(mockSupabase.from).toHaveBeenCalledWith('messages');
      expect(mockSupabase.select).toHaveBeenCalledWith('role, content');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user123');
      expect(mockSupabase.order).toHaveBeenCalledWith('timestamp', { ascending: false });
      expect(mockSupabase.limit).toHaveBeenCalledWith(2);
      expect(result).toEqual(mockMessages.map(msg => ({ role: msg.role, content: msg.content })));
    });

    it('should handle Supabase errors', async () => {
      mockSupabase.limit.mockResolvedValueOnce({ data: null, error: new Error('Database error') });

      const result = await service.getRecentMessages('user123', 2);

      expect(result).toEqual([]);
    });
  });

  describe('saveMessage', () => {
    it('should save message to Supabase', async () => {
      mockSupabase.insert.mockResolvedValueOnce({ error: null });

      await service.saveMessage('user123', 'user', 'Hello');

      expect(mockSupabase.from).toHaveBeenCalledWith('messages');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: 'user123',
        role: 'user',
        content: 'Hello',
      });
    });

    it('should handle Supabase errors', async () => {
      mockSupabase.insert.mockResolvedValueOnce({ error: new Error('Database error') });

      await service.saveMessage('user123', 'user', 'Hello');

      expect(mockSupabase.from).toHaveBeenCalledWith('messages');
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        user_id: 'user123',
        role: 'user',
        content: 'Hello',
      });
    });
  });
}); 