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

// Interface for the OpenAI API model format
interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export const ollamaService = {
  // Get list of available models
  async getModels(): Promise<ModelInfo[]> {
    try {
      // The correct API endpoint is /api/tags (which becomes /api/api/tags through our proxy)
      const endpoint = '/api/tags';
      const url = `${API_BASE_URL}${endpoint}`;
      console.log('Fetching models from:', url);
      const response = await axios.get(url);
      return response.data.models;
    } catch (error) {
      console.error('Error fetching models:', error);
      
      // Fallback to the alternate API endpoint if the first one fails
      try {
        console.log('Trying alternate endpoint...');
        const alternateEndpoint = '/v1/models';
        const alternateUrl = `${API_BASE_URL}${alternateEndpoint}`;
        console.log('Fetching models from alternate endpoint:', alternateUrl);
        
        const response = await axios.get(alternateUrl);
        
        // Convert from OpenAI format to Ollama format
        const models = response.data.data.map((model: OpenAIModel) => ({
          name: model.id,
          modified_at: new Date(model.created * 1000).toISOString(),
          size: 0 // Size information not available in the OpenAI format
        }));
        
        return models;
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        throw error; // Throw the original error
      }
    }
  },

  // Generate chat completion
  async generateCompletion(
    model: string,
    messages: ChatMessage[],
    onProgress?: (response: ChatResponse) => void
  ): Promise<string> {
    // The correct API endpoint is /api/chat (which becomes /api/api/chat through our proxy)
    const endpoint = '/api/chat';
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
        
        // Try the OpenAI-compatible endpoint if the Ollama endpoint fails
        try {
          console.log('Trying OpenAI-compatible endpoint...');
          const alternateEndpoint = '/v1/chat/completions';
          const alternateUrl = `${API_BASE_URL}${alternateEndpoint}`;
          
          const response = await axios.post(alternateUrl, {
            model,
            messages,
            stream: false
          });
          
          // Extract content from OpenAI format
          return response.data.choices[0].message.content;
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          throw error; // Throw the original error
        }
      }
    }
  }
}; 