import { createClient, RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from './chatService';

export interface SessionData {
  userId: string;
  sessionId: string;
  createdAt: string;
  lastActivity: string;
  metadata: Record<string, any>;
}

export class SessionManager {
  private redis: RedisClientType;
  private maxHistoryLength: number;

  constructor() {
    this.redis = createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
    });
    this.maxHistoryLength = parseInt(process.env.MAX_CONVERSATION_HISTORY || '10');
  }

  async initialize(): Promise<void> {
    try {
      await this.redis.connect();
      console.log('Connected to Redis');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      // For development, we can continue without Redis
      console.warn('Continuing without Redis - session data will not persist');
    }
  }

  async createSession(sessionId: string, userId: string, metadata: Record<string, any> = {}): Promise<void> {
    const sessionData: SessionData = {
      userId,
      sessionId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      metadata
    };

    try {
      if (this.redis.isOpen) {
        await this.redis.setEx(
          `session:${sessionId}`,
          parseInt(process.env.SESSION_TIMEOUT || '1800'), // 30 minutes default
          JSON.stringify(sessionData)
        );
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      if (!this.redis.isOpen) return null;
      
      const sessionDataStr = await this.redis.get(`session:${sessionId}`);
      if (sessionDataStr) {
        return JSON.parse(sessionDataStr);
      }
    } catch (error) {
      console.error('Error getting session:', error);
    }
    return null;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      if (!this.redis.isOpen) return;
      
      const sessionData = await this.getSession(sessionId);
      if (sessionData) {
        sessionData.lastActivity = new Date().toISOString();
        await this.redis.setEx(
          `session:${sessionId}`,
          parseInt(process.env.SESSION_TIMEOUT || '1800'),
          JSON.stringify(sessionData)
        );
      }
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }

  async addMessageToHistory(sessionId: string, message: ChatMessage): Promise<void> {
    try {
      if (!this.redis.isOpen) return;
      
      const historyKey = `history:${sessionId}`;
      const messageStr = JSON.stringify(message);
      
      // Add message to list
      await this.redis.lPush(historyKey, messageStr);
      
      // Trim list to max length
      await this.redis.lTrim(historyKey, 0, this.maxHistoryLength - 1);
      
      // Set expiration
      await this.redis.expire(historyKey, parseInt(process.env.SESSION_TIMEOUT || '1800'));
      
      // Update session activity
      await this.updateSessionActivity(sessionId);
    } catch (error) {
      console.error('Error adding message to history:', error);
    }
  }

  async getConversationHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      if (!this.redis.isOpen) return [];
      
      const historyKey = `history:${sessionId}`;
      const messages = await this.redis.lRange(historyKey, 0, -1);
      
      // Reverse to get chronological order (oldest first)
      return messages.reverse().map(msgStr => JSON.parse(msgStr));
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  async clearSession(sessionId: string): Promise<void> {
    try {
      if (!this.redis.isOpen) return;
      
      await this.redis.del(`session:${sessionId}`);
      await this.redis.del(`history:${sessionId}`);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  async getActiveSessionsCount(): Promise<number> {
    try {
      if (!this.redis.isOpen) return 0;
      
      const keys = await this.redis.keys('session:*');
      return keys.length;
    } catch (error) {
      console.error('Error getting active sessions count:', error);
      return 0;
    }
  }

  async generateSessionId(userId: string): Promise<string> {
    return `${userId}_${uuidv4()}`;
  }

  async close(): Promise<void> {
    try {
      if (this.redis.isOpen) {
        await this.redis.quit();
      }
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
}
