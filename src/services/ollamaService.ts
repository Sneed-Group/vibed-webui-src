import axios from 'axios';

// Get the API URL for different environments
const getApiBaseUrl = () => {
  // In development, use the environment variable directly
  if (import.meta.env.DEV) {
    const apiUrl = import.meta.env.VITE_OLLAMA_API_URL;
    console.log('Using development API URL:', apiUrl);
    return apiUrl;
  }
  
  // In production, use the current origin
  // This will route through our proxy server
  const prodUrl = `${window.location.origin}`;
  console.log('Using production API URL:', prodUrl);
  return prodUrl;
};

// Use the function to determine the API base URL
const API_BASE_URL = getApiBaseUrl();

interface ModelInfo {
  name: string;
  modified_at: string;
  size: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  message?: {
    role: string;
    content: string;
  };
  done?: boolean;
}

// Define Ollama chat API request interface
interface OllamaChatRequest {
  model: string;
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }[];
  stream: boolean;
  options?: {
    temperature: number;
    num_predict?: number;
  };
}

export const ollamaService = {
  // Get list of available models
  async getModels(): Promise<ModelInfo[]> {
    try {
      // For tags, use /api/tags endpoint in both dev and prod
      const endpoint = '/api/tags';
      const url = `${API_BASE_URL}${endpoint}`;
      
      console.log('Fetching models from:', url);
      const response = await axios.get(url);
      console.log('Models response:', response.data);
      return response.data.models;
    } catch (error) {
      console.error('Error fetching models:', error);
      // Log more detailed error information
      if (axios.isAxiosError(error)) {
        console.error('Status:', error.response?.status);
        console.error('Response data:', error.response?.data);
      }
      throw error;
    }
  },

  // Generate chat completion using Ollama's native chat API
  async generateCompletion(
    model: string,
    messages: ChatMessage[],
    onProgress?: (response: ChatResponse) => void
  ): Promise<string> {
    // Use Ollama's native chat API endpoint
    const endpoint = '/api/chat';
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('Generating completion using Ollama chat API:', url);
    
    // Create request body according to Ollama's chat API specification
    const requestBody: OllamaChatRequest = {
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      stream: !!onProgress,
      options: {
        temperature: 0.7
      }
    };
    
    console.log('Request payload:', JSON.stringify(requestBody, null, 2));
    
    if (onProgress) {
      // Handle streaming response
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Log response status for debugging
      console.log('Generation response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = ''; // Buffer to collect partial JSON chunks

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Process complete JSON objects from the buffer
          let startIndex = 0;
          let endIndex = -1;
          
          // Find each newline-delimited JSON object in the buffer
          while ((endIndex = buffer.indexOf('\n', startIndex)) !== -1) {
            const jsonLine = buffer.substring(startIndex, endIndex).trim();
            if (jsonLine) { // Skip empty lines
              try {
                const parsed = JSON.parse(jsonLine);
                
                // Extract content from Ollama's chat API response
                if (parsed.message) {
                  const content = parsed.message.content || '';
                  
                  if (content) {
                    fullResponse += content;
                    
                    // Adapt to our expected format
                    const adaptedResponse: ChatResponse = {
                      message: {
                        role: 'assistant',
                        content
                      },
                      done: parsed.done || false
                    };
                    
                    onProgress(adaptedResponse);
                  }
                }
              } catch (e) {
                // If we can't parse the current line, it might be incomplete
                buffer = buffer.substring(startIndex);
                break;
              }
            }
            startIndex = endIndex + 1;
          }
          
          // Keep any remaining incomplete data in the buffer
          if (startIndex < buffer.length) {
            buffer = buffer.substring(startIndex);
          } else {
            buffer = '';
          }
        }
        
        // Signal completion if not already done
        onProgress({
          message: { role: 'assistant', content: '' },
          done: true
        });
        
      } catch (error) {
        console.error('Error reading stream:', error);
        throw error;
      } finally {
        reader.releaseLock();
      }

      return fullResponse;
    } else {
      // Handle non-streaming response
      try {
        const response = await axios.post(url, requestBody);
        console.log('Non-streaming response:', response.status);
        
        // Extract content from Ollama's chat API response
        if (response.data && response.data.message) {
          return response.data.message.content || '';
        }
        
        return '';
      } catch (error) {
        console.error('Error generating completion:', error);
        // Log more detailed error information
        if (axios.isAxiosError(error)) {
          console.error('Status:', error.response?.status);
          console.error('Response data:', error.response?.data);
          console.error('Request URL:', url);
          console.error('Request body:', JSON.stringify(requestBody, null, 2));
        }
        throw error;
      }
    }
  }
}; 