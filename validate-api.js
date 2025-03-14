import axios from 'axios';

// Test all the endpoints through the proxy
async function validateProxyEndpoints() {
  // Set up base URL for local proxy
  const proxyBaseUrl = 'http://localhost:8765/api';
  
  // Endpoints to test
  const endpoints = [
    '/api/tags',      // Ollama endpoint
    '/v1/models'      // OpenAI-compatible endpoint
  ];
  
  console.log('Testing proxy endpoints...\n');
  
  for (const endpoint of endpoints) {
    const url = `${proxyBaseUrl}${endpoint}`;
    console.log(`Testing: ${url}`);
    
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ SUCCESS - Status:', response.status);
      console.log('Content-Type:', response.headers['content-type']);
      
      if (endpoint === '/api/tags') {
        // For Ollama endpoint
        console.log('Models found:', response.data.models.length);
        console.log('Sample models:', response.data.models.slice(0, 3).map(m => m.name).join(', '));
      } else if (endpoint === '/v1/models') {
        // For OpenAI endpoint
        console.log('Models found:', response.data.data.length);
        console.log('Sample models:', response.data.data.slice(0, 3).map(m => m.id).join(', '));
      }
    } catch (error) {
      console.log('❌ FAILED:', error.message);
      
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Content-Type:', error.response.headers['content-type']);
        
        if (error.response.data) {
          console.log('Response:', JSON.stringify(error.response.data).substring(0, 200));
        }
      }
    }
    console.log('-'.repeat(80));
  }
}

// Run test
console.log('Starting API validation...');
console.log('Make sure the server is running on port 8765 before running this test!');
validateProxyEndpoints().catch(console.error); 