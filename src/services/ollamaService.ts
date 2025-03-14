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

// Define the OpenAI API request interface
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
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

  // Generate chat completion using OpenAI-compatible API
  async generateCompletion(
    model: string,
    messages: ChatMessage[],
    onProgress?: (response: ChatResponse) => void
  ): Promise<string> {
    // Use OpenAI-compatible API endpoint for chat completions
    const endpoint = '/v1/chat/completions';
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('Generating completion from OpenAI-compatible endpoint:', url);
    
    // Format messages for OpenAI API
    const formattedMessages: OpenAIMessage[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Create request body according to OpenAI API specification
    const requestBody: OpenAIChatRequest = {
      model,
      messages: formattedMessages,
      stream: !!onProgress,
      temperature: 0.7,
      max_tokens: 1024
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
          
          // Process chunks by looking for "data: " prefix (SSE format)
          let startIndex = 0;
          while (true) {
            const dataIndex = buffer.indexOf('data: ', startIndex);
            if (dataIndex === -1) break;
            
            startIndex = dataIndex + 6; // Move past "data: "
            
            // Find the end of this SSE message
            const endIndex = buffer.indexOf('\n', startIndex);
            if (endIndex === -1) break; // Incomplete line, wait for more data
            
            // Extract the SSE message
            const sseMessage = buffer.substring(startIndex, endIndex).trim();
            startIndex = endIndex + 1;
            
            // Skip heartbeat messages
            if (sseMessage === '[DONE]') continue;
            
            try {
              if (sseMessage) {
                const parsed = JSON.parse(sseMessage);
                
                // Extract the content from the OpenAI-style response
                if (parsed.choices && parsed.choices[0]) {
                  const delta = parsed.choices[0].delta;
                  const content = delta.content || '';
                  
                  if (content) {
                    fullResponse += content;
                    
                    // Adapt to our expected format
                    const adaptedResponse: ChatResponse = {
                      message: {
                        role: 'assistant',
                        content
                      },
                      done: false
                    };
                    
                    onProgress(adaptedResponse);
                  }
                }
              }
            } catch (e) {
              console.warn('Could not parse SSE message:', sseMessage, e);
            }
          }
          
          // Keep any remaining incomplete data in the buffer
          if (startIndex < buffer.length) {
            buffer = buffer.substring(startIndex);
          } else {
            buffer = '';
          }
        }
        
        // Signal completion
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
        
        // Extract the content from the OpenAI-style response
        if (response.data.choices && response.data.choices[0]) {
          return response.data.choices[0].message.content || '';
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