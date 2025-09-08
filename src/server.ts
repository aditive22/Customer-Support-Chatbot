import { GSContext, GSStatus, PlainObject } from '@godspeedsystems/core';
import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { ChatService } from './services/chatService';
import { SessionManager } from './services/sessionManager';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Global services
let chatService: ChatService;
let sessionManager: SessionManager;

// Initialize services
async function initializeServices() {
  sessionManager = new SessionManager();
  chatService = new ChatService(sessionManager);
  await sessionManager.initialize();
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-chat', async (data) => {
    const { userId, sessionId } = data;
    const fullSessionId = sessionId || `session_${userId}_${Date.now()}`;
    
    // Join room for this session
    socket.join(fullSessionId);
    
    // Initialize session
    await sessionManager.createSession(fullSessionId, userId, {
      socketId: socket.id,
      connectedAt: new Date().toISOString()
    });

    socket.emit('chat-joined', { sessionId: fullSessionId });
    console.log(`User ${userId} joined chat session: ${fullSessionId}`);
  });

  socket.on('send-message', async (data) => {
    const { sessionId, message, userId } = data;
    
    try {
      // Process message through AI service
      const response = await chatService.processMessage(sessionId, message, userId);
      
      // Send response back to user
      socket.to(sessionId).emit('message-received', {
        message: response.message,
        timestamp: response.timestamp,
        isBot: true,
        needsEscalation: response.needsEscalation
      });

      // If escalation needed, notify support team
      if (response.needsEscalation) {
        io.emit('escalation-needed', {
          sessionId,
          userId,
          message,
          timestamp: response.timestamp
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Export for Godspeed integration
export default class GSServer {
  static async initialize() {
    await initializeServices();
    return { app, server, io, chatService, sessionManager };
  }
}

// Export services for use in functions
export { chatService, sessionManager };
