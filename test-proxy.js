import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Try to read the actual .env file to get the correct URL
let ollamaApiUrl;
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/VITE_OLLAMA_API_URL=(.+)/);
  if (match && match[1]) {
    ollamaApiUrl = match[1].trim();
  } else {
    ollamaApiUrl = process.env.VITE_OLLAMA_API_URL || 'https://ai.nodemixaholic.com/api';
  }
} catch (error) {
  ollamaApiUrl = process.env.VITE_OLLAMA_API_URL || 'https://ai.nodemixaholic.com/api';
}

console.log('Testing connection to Ollama API URL:', ollamaApiUrl);

// Test direct connection to the API
async function testDirectConnection() {
  try {
    console.log('Testing direct connection to:', `${ollamaApiUrl}/tags`);
    const response = await axios.get(`${ollamaApiUrl}/tags`, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:8765'
      }
    });
    console.log('Direct connection successful!');
    console.log('Available models:', response.data.models.map(m => m.name).join(', '));
    return true;
  } catch (error) {
    console.error('Direct connection failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    return false;
  }
}

// Run the test
testDirectConnection().then(success => {
  if (success) {
    console.log('✅ API connection test passed');
  } else {
    console.log('❌ API connection test failed');
    
    // Try alternative URL
    const alternativeUrl = 'https://ai.nodemixaholic.com/api';
    if (ollamaApiUrl !== alternativeUrl) {
      console.log('\nTrying alternative URL:', alternativeUrl);
      ollamaApiUrl = alternativeUrl;
      return testDirectConnection();
    }
  }
}); 