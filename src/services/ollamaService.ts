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

export const ollamaService = {
  // Get list of available models
  async getModels(): Promise<ModelInfo[]> {
    try {
      // In the API, the endpoint is /api/tags
      const endpoint = '/api/tags';
      const url = `${API_BASE_URL}${endpoint}`;
      console.log('Fetching models from:', url);
      const response = await axios.get(url);
      return response.data.models;
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  },

  // Generate chat completion
  async generateCompletion(
    model: string,
    messages: ChatMessage[],
    onProgress?: (response: ChatResponse) => void
  ): Promise<string> {
    // In the API, the endpoint is /v1/chat
    const endpoint = '/v1/chat';
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('Generating completion from:', url);
    
    if (onProgress) {
      // Handle streaming response
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
      });

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
            const parsed = JSON.parse(buffer.trim());
            onProgress(parsed);
            if (parsed.message?.content) {
              fullResponse += parsed.message.content;
            }
          } catch (e) {
            console.warn('Could not parse final buffer chunk:', buffer);
          }
        }
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
        const response = await axios.post(url, {
          model,
          messages,
          stream: false,
        });
        return response.data.message.content;
      } catch (error) {
        console.error('Error generating completion:', error);
        throw error;
      }
    }
  }
}; 