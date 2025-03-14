import axios from 'axios';

// Define base URLs to try
const baseUrls = [
  'https://ai.nodemixaholic.com',
  'https://ai.nodemixaholic.com/api',
  'https://ai.nodemixaholic.com/ollama'
];

// Endpoints to try
const endpoints = [
  '/tags',
  '/models',
  '/api/tags',
  '/api/models',
  '/v1/tags',
  '/v1/models'
];

// Test combinations of base URLs and endpoints
async function testEndpoints() {
  console.log('Testing API endpoints...\n');

  for (const baseUrl of baseUrls) {
    console.log(`Testing with base URL: ${baseUrl}`);
    console.log('='.repeat(80));

    for (const endpoint of endpoints) {
      const url = `${baseUrl}${endpoint}`;
      console.log(`Testing: ${url}`);

      try {
        const response = await axios.get(url, {
          timeout: 5000,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        console.log('✅ Status:', response.status);
        
        // Check if the response is actual JSON data or HTML
        const contentType = response.headers['content-type'] || '';
        console.log('Content-Type:', contentType);
        
        if (contentType.includes('application/json')) {
          console.log('✅ JSON RESPONSE:', JSON.stringify(response.data).substring(0, 150) + '...');
          console.log('This appears to be the correct endpoint!');
        } else if (contentType.includes('text/html')) {
          console.log('❌ HTML RESPONSE (not an API endpoint)');
        } else {
          console.log('⚠️ Unknown content type:', contentType);
          console.log('Preview:', JSON.stringify(response.data).substring(0, 150) + '...');
        }
      } catch (error) {
        console.log('❌ FAILED:', error.message);
        
        if (error.response) {
          console.log('Status:', error.response.status);
          const contentType = error.response.headers['content-type'];
          console.log('Content-Type:', contentType);
        }
      }
      console.log('-'.repeat(80));
    }
    console.log('\n');
  }
}

// Run the tests
testEndpoints().catch(err => {
  console.error('Unexpected error:', err);
}); 