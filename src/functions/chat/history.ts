import { GSContext, GSStatus } from '@godspeedsystems/core';
import { SessionManager } from '../../services/sessionManager';

const sessionManager = new SessionManager();

export default async function handler(ctx: GSContext) {
  try {
    await sessionManager.initialize();
    
    const { sessionId } = ctx.inputs.data.params;
    
    if (!sessionId) {
      return new GSStatus(false, 400, 'Session ID is required', {});
    }

    const history = await sessionManager.getConversationHistory(sessionId);
    const sessionData = await sessionManager.getSession(sessionId);

    if (!sessionData) {
      return new GSStatus(false, 404, 'Session not found', {});
    }

    return new GSStatus(true, 200, 'History retrieved successfully', {
      history,
      sessionData: {
        sessionId: sessionData.sessionId,
        userId: sessionData.userId,
        createdAt: sessionData.createdAt,
        lastActivity: sessionData.lastActivity
      }
    });
  } catch (error) {
    console.error('Error retrieving history:', error);
    return new GSStatus(false, 500, 'Failed to retrieve history', {});
  }
}
