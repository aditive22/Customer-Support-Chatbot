import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SessionManager } from './sessionManager';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  message: string;
  timestamp: string;
  needsEscalation: boolean;
  confidence: number;
  provider: 'openai' | 'gemini';
}

export class ChatService {
  private openai: OpenAI | null = null;
  private gemini: GoogleGenerativeAI | null = null;
  private sessionManager: SessionManager;
  private escalationKeywords: string[];
  private preferredProvider: 'openai' | 'gemini' | 'auto' = 'auto';

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
    this.escalationKeywords = (process.env.ESCALATION_KEYWORDS || '').split(',').map(k => k.trim().toLowerCase());
    
    // Initialize available AI providers
    this.initializeProviders();
  }

  private initializeProviders() {
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('✅ OpenAI initialized successfully');
      } catch (error) {
        console.warn('⚠️ Failed to initialize OpenAI:', error);
      }
    }

    // Initialize Gemini if API key is available
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      try {
        this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('✅ Gemini initialized successfully');
      } catch (error) {
        console.warn('⚠️ Failed to initialize Gemini:', error);
      }
    }

    // Determine preferred provider
    if (this.openai && this.gemini) {
      this.preferredProvider = 'auto'; // Use OpenAI first, fallback to Gemini
      console.log('🤖 Both AI providers available - using auto-fallback mode');
    } else if (this.openai) {
      this.preferredProvider = 'openai';
      console.log('🤖 Using OpenAI as AI provider');
    } else if (this.gemini) {
      this.preferredProvider = 'gemini';
      console.log('🤖 Using Gemini as AI provider');
    } else {
      console.error('❌ No AI providers available! Please configure OPENAI_API_KEY or GEMINI_API_KEY');
    }
  }

  async processMessage(sessionId: string, userMessage: string, userId: string): Promise<ChatResponse> {
    const timestamp = new Date().toISOString();
    
    try {
      // Get conversation history
      const conversationHistory = await this.sessionManager.getConversationHistory(sessionId);
      
      // Check for escalation keywords
      const needsEscalation = this.checkForEscalation(userMessage);
      
      if (needsEscalation) {
        const escalationMessage = "I understand you need additional assistance. I'm connecting you with a human support agent who will be able to help you better. Please hold on for a moment.";
        
        // Save escalation message to history
        await this.sessionManager.addMessageToHistory(sessionId, {
          role: 'assistant',
          content: escalationMessage,
          timestamp
        });
        
        return {
          message: escalationMessage,
          timestamp,
          needsEscalation: true,
          confidence: 1.0,
          provider: this.getAvailableProvider()
        };
      }

      // Try to get AI response
      let aiResponse: string;
      let usedProvider: 'openai' | 'gemini';

      if (this.preferredProvider === 'auto' || this.preferredProvider === 'openai') {
        try {
          const response = await this.getOpenAIResponse(conversationHistory, userMessage, timestamp);
          aiResponse = response.message;
          usedProvider = 'openai';
        } catch (error) {
          console.warn('OpenAI failed, trying Gemini fallback:', error);
          if (this.gemini) {
            const response = await this.getGeminiResponse(conversationHistory, userMessage, timestamp);
            aiResponse = response.message;
            usedProvider = 'gemini';
          } else {
            throw error;
          }
        }
      } else {
        const response = await this.getGeminiResponse(conversationHistory, userMessage, timestamp);
        aiResponse = response.message;
        usedProvider = 'gemini';
      }
      
      // Calculate confidence based on response
      const confidence = this.calculateConfidence(aiResponse, userMessage);
      
      // Save messages to history
      await this.sessionManager.addMessageToHistory(sessionId, {
        role: 'user',
        content: userMessage,
        timestamp
      });
      
      await this.sessionManager.addMessageToHistory(sessionId, {
        role: 'assistant',
        content: aiResponse,
        timestamp
      });

      return {
        message: aiResponse,
        timestamp,
        needsEscalation: confidence < 0.5, // Escalate if confidence is low
        confidence,
        provider: usedProvider
      };

    } catch (error) {
      console.error('Error in ChatService.processMessage:', error);
      
      // Fallback response
      const fallbackMessage = "I'm experiencing some technical difficulties. Please try again, or I can connect you with a human agent.";
      
      return {
        message: fallbackMessage,
        timestamp,
        needsEscalation: true,
        confidence: 0.0,
        provider: this.getAvailableProvider()
      };
    }
  }

  private async getOpenAIResponse(conversationHistory: ChatMessage[], userMessage: string, timestamp: string): Promise<{message: string}> {
    if (!this.openai) {
      throw new Error('OpenAI not initialized');
    }

    // Prepare messages for OpenAI
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
        timestamp
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
        timestamp
      }
    ];

    // Call OpenAI API
    const completion = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content || "I'm sorry, I couldn't process your request. Please try again.";
    return { message: aiResponse };
  }

  private async getGeminiResponse(conversationHistory: ChatMessage[], userMessage: string, timestamp: string): Promise<{message: string}> {
    if (!this.gemini) {
      throw new Error('Gemini not initialized');
    }

    const model = this.gemini.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      }
    });

    // Build conversation context for Gemini
    let prompt = this.getSystemPrompt() + '\n\n';
    
    // Add conversation history
    conversationHistory.forEach(msg => {
      if (msg.role === 'user') {
        prompt += `Human: ${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${msg.content}\n`;
      }
    });
    
    // Add current user message
    prompt += `Human: ${userMessage}\nAssistant:`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const aiResponse = response.text() || "I'm sorry, I couldn't process your request. Please try again.";
      return { message: aiResponse };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  private getAvailableProvider(): 'openai' | 'gemini' {
    if (this.openai) return 'openai';
    if (this.gemini) return 'gemini';
    return 'openai'; // Default fallback
  }

  private getSystemPrompt(): string {
    return `You are a helpful customer support chatbot. Your role is to:
1. Assist customers with common questions and issues
2. Provide accurate and helpful information
3. Be polite, professional, and empathetic
4. If you cannot resolve an issue or if the customer seems frustrated, acknowledge their concern and offer to escalate to a human agent
5. Keep responses concise but comprehensive
6. Always maintain a friendly and helpful tone

Common topics you can help with:
- Product information and features
- Account questions
- Order status and tracking
- Returns and exchanges
- Technical support basics
- Billing inquiries

If a customer's issue is complex, involves sensitive information, or requires human judgment, politely offer to connect them with a human agent.`;
  }

  private checkForEscalation(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return this.escalationKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private calculateConfidence(aiResponse: string, userMessage: string): number {
    // Simple confidence calculation based on response characteristics
    const lowConfidenceIndicators = [
      "i don't know",
      "i'm not sure",
      "i can't help",
      "contact support",
      "try again",
      "technical difficulties"
    ];
    
    const lowerResponse = aiResponse.toLowerCase();
    const hasLowConfidenceIndicators = lowConfidenceIndicators.some(indicator => 
      lowerResponse.includes(indicator)
    );
    
    if (hasLowConfidenceIndicators) {
      return 0.3;
    }
    
    // Higher confidence for longer, more detailed responses
    if (aiResponse.length > 100) {
      return 0.8;
    }
    
    return 0.6;
  }

  getProviderStatus(): { openai: boolean; gemini: boolean; preferred: string } {
    return {
      openai: this.openai !== null,
      gemini: this.gemini !== null,
      preferred: this.preferredProvider
    };
  }
}
