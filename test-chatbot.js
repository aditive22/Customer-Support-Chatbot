#!/usr/bin/env node

// Test script to demonstrate dual AI provider functionality
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

async function testChatbot() {
  try {
    console.log('🧪 Testing AI Customer Support Chatbot with dual providers...\n');
    
    // Test health check
    console.log('1. Testing health check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('   Health status:', health.data.status);
    console.log('   OpenAI status:', health.data.services.openai);
    console.log('   Gemini status:', health.data.services.gemini);
    console.log('   Redis status:', health.data.services.redis);
    console.log('');
    
    // Create session
    console.log('2. Creating chat session...');
    const sessionResponse = await axios.post(`${BASE_URL}/chat/session`, {
      userId: 'test-user-' + Date.now(),
      metadata: { testType: 'dual-provider-test' }
    });
    const sessionId = sessionResponse.data.sessionId;
    console.log('   Session created:', sessionId);
    console.log('');
    
    // Test messages
    const testMessages = [
      'Hello, I need help with my account',
      'How do I reset my password?',
      'This is urgent! I need immediate assistance!', // Should trigger escalation
      'What are your business hours?'
    ];
    
    console.log('3. Testing messages...');
    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      console.log(`   Sending: "${message}"`);
      
      try {
        const response = await axios.post(`${BASE_URL}/chat/message`, {
          sessionId,
          message,
          userId: 'test-user'
        });
        
        console.log(`   Response: "${response.data.response}"`);
        console.log(`   Provider: ${response.data.provider || 'unknown'}`);
        console.log(`   Confidence: ${response.data.confidence}`);
        console.log(`   Escalation: ${response.data.needsEscalation ? 'YES' : 'NO'}`);
        console.log('');
      } catch (error) {
        console.error(`   Error: ${error.response?.data?.error || error.message}`);
        console.log('');
      }
    }
    
    // Get conversation history
    console.log('4. Getting conversation history...');
    const historyResponse = await axios.get(`${BASE_URL}/chat/history/${sessionId}`);
    console.log(`   Messages in history: ${historyResponse.data.history.length}`);
    console.log('');
    
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test if called directly
if (require.main === module) {
  testChatbot();
}

module.exports = { testChatbot };
