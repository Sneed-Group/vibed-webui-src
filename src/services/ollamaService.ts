import axios from 'axios';

// Get the API URL for different environments
const getApiBaseUrl = () => {
  // In development, use the environment variable directly
  if (import.meta.env.DEV) {
    const apiUrl = import.meta.env.VITE_OLLAMA_API_URL;
    console.log('Using development API URL:', apiUrl);
    return apiUrl;
  }
  
  // In production, use the current origin with /api path
  // This will route through our proxy server
  const prodUrl = `${window.location.origin}/api`;
  console.log('Using production API URL:', prodUrl);
  return prodUrl;
};

// Fallback API URLs to try if the main one fails
const FALLBACK_API_URLS = [
  'https://ollama.ai/api',
  'https://api.ollama.ai',
  'https://api.ollama.com',
  'https://ollama-api.vercel.app/api'
];

// Generate mock model data when the API is unavailable
const getMockModels = (): ModelInfo[] => {
  console.log('Generating mock model data...');
  return [
    {
      name: 'llama2',
      modified_at: new Date().toISOString(),
      size: 3800000000
    },
    {
      name: 'mistral',
      modified_at: new Date().toISOString(),
      size: 4200000000
    },
    {
      name: 'gemma',
      modified_at: new Date().toISOString(), 
      size: 3500000000
    },
    {
      name: 'codellama',
      modified_at: new Date().toISOString(),
      size: 3900000000
    }
  ];
};

// Use the function to determine the API base URL
const API_BASE_URL = getApiBaseUrl();

interface ModelInfo {
  name: string;
  modified_at: string;
  size: number;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

interface ChatResponse {
  message: ChatMessage;
  done: boolean;
}

// Interface for the OpenAI API model format
interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

// Generate a mock completion response
const generateMockCompletion = (messages: ChatMessage[]): string => {
  console.log('Generating mock completion response...');
  
  // Find the last user message
  let lastUserMessage: ChatMessage | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserMessage = messages[i];
      break;
    }
  }
  
  if (!lastUserMessage) return "I didn't receive a question. How can I help you?";

  const userQuery = lastUserMessage.content.toLowerCase();
  
  // Generate a helpful response based on common queries
  if (userQuery.includes('hello') || userQuery.includes('hi ')) {
    return "Hello! I'm a mock AI assistant. The API connection isn't working right now, but I can provide some basic responses.";
  } else if (userQuery.includes('help') || userQuery.includes('documentation')) {
    return "This is a mock response since the API connection isn't working. Normally, I would provide help or documentation based on your request.";
  } else if (userQuery.includes('model') || userQuery.includes('llama')) {
    return "This is a mock response. Currently, we support models like Llama, Mistral, Gemma, and CodeLlama. However, the actual API connection isn't working right now.";
  } else {
    return `This is a mock response since the API connection isn't working right now. You asked: "${lastUserMessage.content}". In a real scenario, I would provide a helpful answer to your question.`;
  }
};

export const ollamaService = {
  // Get list of available models
  async getModels(): Promise<ModelInfo[]> {
    try {
      // The correct API endpoint is /api/tags (which becomes /api/api/tags through our proxy)
      const endpoint = '/api/tags';
      const url = `${API_BASE_URL}${endpoint}`;
      console.log('Fetching models from:', url);
      const response = await axios.get(url);
      
      // Log the response data for debugging
      console.log('API Response data:', response.data);
      
      // Check if the response has the expected structure
      if (response.data && response.data.models && Array.isArray(response.data.models)) {
        return response.data.models;
      } else {
        console.warn('Unexpected response format from /api/tags:', response.data);
        
        // Try to parse HTML response for tags (some servers return HTML with embedded model data)
        if (typeof response.data === 'string' && response.data.includes('<html>')) {
          console.log('Received HTML response, falling back to mock models');
          return getMockModels();
        }
        
        // If the data is an array directly, try to use it
        if (Array.isArray(response.data)) {
          return response.data.map(name => ({
            name: typeof name === 'string' ? name : 'unknown',
            modified_at: new Date().toISOString(),
            size: 0
          }));
        }
        
        // Fall back to mock models
        return getMockModels();
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      
      // Fallback to the alternate API endpoint if the first one fails
      try {
        console.log('Trying alternate endpoint...');
        const alternateEndpoint = '/v1/models';
        const alternateUrl = `${API_BASE_URL}${alternateEndpoint}`;
        console.log('Fetching models from alternate endpoint:', alternateUrl);
        
        const response = await axios.get(alternateUrl);
        console.log('Alternate API Response data:', response.data);
        
        // Check if the response has the expected OpenAI format
        if (response.data && response.data.data && Array.isArray(response.data.data)) {
          // Convert from OpenAI format to Ollama format
          return response.data.data.map((model: OpenAIModel) => ({
            name: model.id,
            modified_at: new Date(model.created * 1000).toISOString(),
            size: 0 // Size information not available in the OpenAI format
          }));
        } else {
          console.warn('Unexpected response format from /v1/models:', response.data);
          
          // Return mock models as a last resort
          return getMockModels();
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        
        // Return mock models as a last resort to prevent UI errors
        return getMockModels();
      }
    }
  },

  // Generate chat completion
  async generateCompletion(
    model: string,
    messages: ChatMessage[],
    onProgress?: (response: ChatResponse) => void
  ): Promise<string> {
    // Define all possible endpoints to try
    const endpointsToTry = [
      '/api/chat',            // Standard Ollama endpoint
      '/v1/chat/completions', // OpenAI-compatible endpoint
      '/ollama/api/chat',     // Alternative with /ollama prefix
      '/chat'                 // Simple endpoint
    ];
    
    let lastError: any = null;
    
    // Try each endpoint for non-streaming requests
    if (!onProgress) {
      for (const endpoint of endpointsToTry) {
        try {
          const url = `${API_BASE_URL}${endpoint}`;
          console.log(`Attempting to generate completion from: ${url}`);
          
          // Prepare the appropriate payload based on the endpoint
          const isOpenAICompatible = endpoint.includes('/v1/');
          const payload = isOpenAICompatible 
            ? { model, messages, stream: false }
            : { model, messages, stream: false };
            
          const response = await axios.post(url, payload);
          
          // Handle different response formats
          if (response.data.message?.content) {
            // Standard Ollama format
            console.log(`Successfully generated completion using endpoint: ${endpoint}`);
            return response.data.message.content;
          } else if (response.data.choices && response.data.choices[0]?.message?.content) {
            // OpenAI format
            console.log(`Successfully generated completion using OpenAI-compatible endpoint: ${endpoint}`);
            return response.data.choices[0].message.content;
          } else if (typeof response.data === 'string') {
            // Simple string response
            return response.data;
          }
          
          console.log('Response format not recognized:', response.data);
        } catch (error) {
          console.error(`Error generating completion from ${endpoint}:`, error);
          lastError = error;
        }
      }
      
      // If we get here, all endpoints failed
      console.error('All API endpoints failed');
      
      // Return a mock completion response
      return generateMockCompletion(messages);
    }
    
    // For streaming responses with progress callback
    for (const endpoint of endpointsToTry) {
      try {
        const url = `${API_BASE_URL}${endpoint}`;
        console.log(`Attempting to generate streaming completion from: ${url}`);
        
        // Prepare the appropriate payload based on the endpoint
        const isOpenAICompatible = endpoint.includes('/v1/');
        const payload = { 
          model, 
          messages, 
          stream: true
        };
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let buffer = ''; // Buffer to collect partial JSON chunks

        try {
          console.log(`Successfully connected to streaming endpoint: ${endpoint}`);
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode the chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process complete JSON objects from the buffer
            let startIndex = 0;
            let endIndex = -1;
            
            // Handle OpenAI vs. Ollama format
            if (isOpenAICompatible) {
              // OpenAI uses "data: " prefix for each line
              const processOpenAIChunk = (jsonStr: string) => {
                if (jsonStr.startsWith('data: ')) {
                  jsonStr = jsonStr.slice(5).trim();
                }
                if (jsonStr === '[DONE]') return null;
                
                try {
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.choices && parsed.choices[0]?.delta?.content) {
                    const content = parsed.choices[0].delta.content;
                    fullResponse += content;
                    onProgress({
                      message: { role: 'assistant', content },
                      done: false
                    });
                  }
                  return parsed;
                } catch (e) {
                  return null;
                }
              };
              
              // Find each newline-delimited chunk
              while ((endIndex = buffer.indexOf('\n', startIndex)) !== -1) {
                const line = buffer.substring(startIndex, endIndex).trim();
                if (line) processOpenAIChunk(line);
                startIndex = endIndex + 1;
              }
            } else {
              // Ollama format - newline-delimited JSON
              while ((endIndex = buffer.indexOf('\n', startIndex)) !== -1) {
                const jsonLine = buffer.substring(startIndex, endIndex).trim();
                if (jsonLine) { // Skip empty lines
                  try {
                    const parsed = JSON.parse(jsonLine);
                    onProgress(parsed);
                    if (parsed.message?.content) {
                      fullResponse += parsed.message.content;
                    }
                  } catch (e) {
                    // If we can't parse the current line, it might be incomplete
                    // We'll leave it in the buffer for the next iteration
                    buffer = buffer.substring(startIndex);
                    break;
                  }
                }
                startIndex = endIndex + 1;
              }
            }
            
            // Keep any remaining incomplete data in the buffer
            if (startIndex < buffer.length) {
              buffer = buffer.substring(startIndex);
            } else {
              buffer = '';
            }
          }
          
          // Process any remaining data in the buffer
          if (buffer.trim()) {
            try {
              if (isOpenAICompatible) {
                if (buffer.startsWith('data: ')) {
                  buffer = buffer.slice(5).trim();
                }
                if (buffer !== '[DONE]') {
                  const parsed = JSON.parse(buffer.trim());
                  if (parsed.choices && parsed.choices[0]?.delta?.content) {
                    fullResponse += parsed.choices[0].delta.content;
                  }
                }
              } else {
                const parsed = JSON.parse(buffer.trim());
                onProgress(parsed);
                if (parsed.message?.content) {
                  fullResponse += parsed.message.content;
                }
              }
            } catch (e) {
              console.warn('Could not parse final buffer chunk:', buffer);
            }
          }
          
          return fullResponse;
        } catch (error) {
          console.error(`Error reading stream from ${endpoint}:`, error);
          lastError = error;
          // Continue to try the next endpoint
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        console.error(`Error setting up streaming from ${endpoint}:`, error);
        lastError = error;
      }
    }
    
    // If all streaming attempts failed, provide a mock response
    console.error('All streaming API endpoints failed');
    
    // For streaming response, we need to emit chunks
    const mockResponse = generateMockCompletion(messages);
    
    // Split the mock response into chunks to simulate streaming
    const chunkSize = 10;
    for (let i = 0; i < mockResponse.length; i += chunkSize) {
      const chunk = mockResponse.substring(i, i + chunkSize);
      
      // Emit each chunk with a slight delay
      if (onProgress) {
        onProgress({
          message: { role: 'assistant', content: chunk },
          done: i + chunkSize >= mockResponse.length
        });
        
        // Add a small delay between chunks to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    return mockResponse;
  }
}; 