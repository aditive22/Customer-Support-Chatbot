import { GSContext, GSStatus } from '@godspeedsystems/core';
import { SessionManager } from '../services/sessionManager';

export default async function handler(ctx: GSContext) {
  try {
    const sessionManager = new SessionManager();
    let redisStatus = 'disconnected';
    let activeSessionsCount = 0;

    try {
      await sessionManager.initialize();
      redisStatus = 'connected';
      activeSessionsCount = await sessionManager.getActiveSessionsCount();
    } catch (error) {
      console.warn('Redis connection failed:', error);
    }

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisStatus,
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured',
        activeSessions: activeSessionsCount
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    return new GSStatus(true, 200, 'Service is healthy', healthData);
  } catch (error) {
    console.error('Health check failed:', error);
    return new GSStatus(false, 500, 'Service is unhealthy', {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
