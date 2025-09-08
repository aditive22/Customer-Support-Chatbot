import { GSContext, GSStatus } from '@godspeedsystems/core';
import { SessionManager } from '../../services/sessionManager';

const sessionManager = new SessionManager();

export default async function handler(ctx: GSContext) {
  try {
    await sessionManager.initialize();
    
    const { userId, metadata = {} } = ctx.inputs.data.body;
    
    if (!userId) {
      return new GSStatus(false, 400, 'User ID is required', {});
    }

    const sessionId = await sessionManager.generateSessionId(userId);
    await sessionManager.createSession(sessionId, userId, metadata);

    return new GSStatus(true, 200, 'Session created successfully', {
      sessionId,
      userId,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return new GSStatus(false, 500, 'Failed to create session', {});
  }
}
