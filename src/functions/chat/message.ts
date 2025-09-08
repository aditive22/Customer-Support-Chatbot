import { GSContext, GSStatus } from '@godspeedsystems/core';
import { ChatService } from '../../services/chatService';
import { SessionManager } from '../../services/sessionManager';

const sessionManager = new SessionManager();
const chatService = new ChatService(sessionManager);

export default async function handler(ctx: GSContext) {
  try {
    await sessionManager.initialize();
    
    const { sessionId, message, userId } = ctx.inputs.data.body;
    
    if (!sessionId || !message || !userId) {
      return new GSStatus(false, 400, 'Session ID, message, and user ID are required', {});
    }

    const response = await chatService.processMessage(sessionId, message, userId);

    return new GSStatus(true, 200, 'Message processed successfully', {
      response: response.message,
      needsEscalation: response.needsEscalation,
      timestamp: response.timestamp,
      confidence: response.confidence
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return new GSStatus(false, 500, 'Failed to process message', {});
  }
}
