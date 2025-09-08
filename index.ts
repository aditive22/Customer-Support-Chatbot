import express, { Request, Response } from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import path from 'path';
import { ChatService } from './src/services/chatService';
import { SessionManager } from './src/services/sessionManager';

// Load environment variables
require('dotenv').config();

async function startServer() {
  try {
    // Initialize Express app
    const app = express();
    
    // Middleware
    app.use(express.json());
    app.use(express.static(path.join(__dirname, 'public')));
    
    // Initialize services
    const sessionManager = new SessionManager();
    const chatService = new ChatService(sessionManager);
    await sessionManager.initialize();
    
    // API Routes
    app.get('/api/v1/health', async (req, res) => {
      try {
        let redisStatus = 'disconnected';
        let activeSessionsCount = 0;

        try {
          activeSessionsCount = await sessionManager.getActiveSessionsCount();
          redisStatus = 'connected';
        } catch (error) {
          console.warn('Redis connection failed:', error);
        }

        const healthData = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            redis: redisStatus,
            openai: process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' ? 'configured' : 'not configured',
            gemini: process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here' ? 'configured' : 'not configured',
            activeSessions: activeSessionsCount
          },
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        };

        res.json(healthData);
      } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    app.post('/api/v1/chat/session', (req, res) => {
      (async () => {
        try {
          const { userId, metadata = {} } = req.body;
          
          if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
          }

          const sessionId = await sessionManager.generateSessionId(userId);
          await sessionManager.createSession(sessionId, userId, metadata);

          res.json({
            success: true,
            sessionId,
            userId,
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error creating session:', error);
          res.status(500).json({ error: 'Failed to create session' });
        }
      })();
    });

    app.post('/api/v1/chat/message', (req, res) => {
      (async () => {
        try {
          const { sessionId, message, userId } = req.body;
          
          if (!sessionId || !message || !userId) {
            return res.status(400).json({ error: 'Session ID, message, and user ID are required' });
          }

          const response = await chatService.processMessage(sessionId, message, userId);

          res.json({
            success: true,
            response: response.message,
            needsEscalation: response.needsEscalation,
            timestamp: response.timestamp,
            confidence: response.confidence
          });
        } catch (error) {
          console.error('Error processing message:', error);
          res.status(500).json({ error: 'Failed to process message' });
        }
      })();
    });

    app.get('/api/v1/chat/history/:sessionId', (req, res) => {
      (async () => {
        try {
          const { sessionId } = req.params;
          
          if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
          }

          const history = await sessionManager.getConversationHistory(sessionId);
          const sessionData = await sessionManager.getSession(sessionId);

          if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' });
          }

          res.json({
            success: true,
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
          res.status(500).json({ error: 'Failed to retrieve history' });
        }
      })();
    });
    
    // Create HTTP server
    const server = createServer(app);
    
    // Initialize Socket.IO
    const io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    // Socket.IO connection handling
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('join-chat', async (data) => {
        const { userId, sessionId } = data;
        const fullSessionId = sessionId || await sessionManager.generateSessionId(userId);
        
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
          socket.emit('message-received', {
            message: response.message,
            timestamp: response.timestamp,
            isBot: true,
            needsEscalation: response.needsEscalation,
            confidence: response.confidence
          });

          // If escalation needed, notify support team (broadcast to all connected clients)
          if (response.needsEscalation) {
            io.emit('escalation-needed', {
              sessionId,
              userId,
              message,
              timestamp: response.timestamp,
              originalMessage: message
            });
            
            console.log(`Escalation needed for session ${sessionId}: ${message}`);
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
    
    const PORT = process.env.PORT || 3000;
    
    server.listen(PORT, () => {
      console.log(`🚀 AI Customer Support Chatbot POC running on port ${PORT}`);
      console.log(`📱 WebSocket server ready for connections`);
      console.log(`🌐 Test the chat interface at: http://localhost:${PORT}`);
      console.log(`🏥 Health check available at: http://localhost:${PORT}/api/v1/health`);
      console.log(`📊 API endpoints:`);
      console.log(`   POST /api/v1/chat/session - Create chat session`);
      console.log(`   POST /api/v1/chat/message - Send message`);
      console.log(`   GET  /api/v1/chat/history/{sessionId} - Get chat history`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();
