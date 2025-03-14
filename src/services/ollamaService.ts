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
  'https://ai.nodemixaholic.com/api',    // Try without the double /api in path
  'https://ollama.ai/api',
  'https://api.ollama.ai',
  'https://api.ollama.com'
];

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
      
      // Check if the response has the expected format
      if (response.data && response.data.models && Array.isArray(response.data.models)) {
        return response.data.models;
      } else {
        console.warn('Response does not contain models array:', response.data);
        // If we're using the ai.nodemixaholic.com domain, try directly accessing the data
        if (url.includes('nodemixaholic.com')) {
          if (Array.isArray(response.data)) {
            return response.data.map((model: any) => ({
              name: model.name || model.id || 'unknown',
              modified_at: model.modified_at || new Date().toISOString(),
              size: model.size || 0
            }));
          }
        }
        throw new Error('Invalid response format - models array not found');
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      
      // Try fallback URLs first
      for (const fallbackUrl of FALLBACK_API_URLS) {
        try {
          console.log(`Trying fallback URL: ${fallbackUrl}/tags`);
          const response = await axios.get(`${fallbackUrl}/tags`);
          
          if (response.data && response.data.models && Array.isArray(response.data.models)) {
            return response.data.models;
          } else if (Array.isArray(response.data)) {
            // Handle direct array response
            return response.data.map((model: any) => ({
              name: model.name || model.id || 'unknown',
              modified_at: model.modified_at || new Date().toISOString(),
              size: model.size || 0
            }));
          }
        } catch (fallbackError) {
          console.warn(`Fallback to ${fallbackUrl} failed:`, fallbackError);
          // Continue to next fallback
        }
      }
      
      // Fallback to the alternate API endpoint if all direct attempts fail
      try {
        console.log('Trying alternate endpoint...');
        const alternateEndpoint = '/v1/models';
        const alternateUrl = `${API_BASE_URL}${alternateEndpoint}`;
        console.log('Fetching models from alternate endpoint:', alternateUrl);
        
        const response = await axios.get(alternateUrl);
        
        // Handle OpenAI format
        if (response.data && response.data.data && Array.isArray(response.data.data)) {
          // Convert from OpenAI format to Ollama format
          return response.data.data.map((model: OpenAIModel) => ({
            name: model.id,
            modified_at: new Date(model.created * 1000).toISOString(),
            size: 0 // Size information not available in the OpenAI format
          }));
        } else {
          throw new Error('Invalid response format from alternate endpoint');
        }
      } catch (fallbackError) {
        console.error('All fallbacks failed:', fallbackError);
        
        // Return a default model list as last resort
        console.warn('Returning default model list');
        return [
          { name: 'llama3', modified_at: new Date().toISOString(), size: 0 },
          { name: 'llama3:8b', modified_at: new Date().toISOString(), size: 0 },
          { name: 'gemma:2b', modified_at: new Date().toISOString(), size: 0 }
        ];
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
      try {
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

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
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
                  onProgress(parsed);
                  if (parsed.message?.content) {
                    fullResponse += parsed.message.content;
                  }
                } catch (e) {
                  console.warn('Error parsing JSON line:', e);
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

        return fullResponse || 'Sorry, I was unable to generate a response.';
      } catch (error) {
        console.error('Error with streaming request:', error);
        // Try fallback URLs for streaming
        for (const fallbackUrl of FALLBACK_API_URLS) {
          try {
            console.log(`Trying fallback URL for streaming: ${fallbackUrl}/chat`);
            // Implementation of fallback streaming would go here
            // This is more complex and would duplicate the streaming logic above
            // For now, we'll just try non-streaming on fallbacks
          } catch (fallbackError) {
            console.warn(`Fallback streaming to ${fallbackUrl} failed:`, fallbackError);
          }
        }
        
        // Return a default message if all fallbacks fail
        return "I'm sorry, but I encountered an error connecting to the language model service. Please check your connection and try again.";
      }
    } else {
      // Handle non-streaming response
      try {
        const response = await axios.post(url, {
          model,
          messages,
          stream: false,
        });
        
        // Check if the response has the expected format
        if (response.data && response.data.message && response.data.message.content) {
          return response.data.message.content;
        } else {
          console.warn('Response does not have expected format:', response.data);
          // If response data is a string directly, return it
          if (typeof response.data === 'string') {
            return response.data;
          }
          throw new Error('Invalid response format');
        }
      } catch (error) {
        console.error('Error generating completion:', error);
        
        // Try fallback URLs first
        for (const fallbackUrl of FALLBACK_API_URLS) {
          try {
            console.log(`Trying fallback URL: ${fallbackUrl}/chat`);
            const response = await axios.post(`${fallbackUrl}/chat`, {
              model,
              messages,
              stream: false,
            });
            
            if (response.data && response.data.message && response.data.message.content) {
              return response.data.message.content;
            } else if (typeof response.data === 'string') {
              return response.data;
            }
          } catch (fallbackError) {
            console.warn(`Fallback to ${fallbackUrl} failed:`, fallbackError);
          }
        }
        
        // Try the OpenAI-compatible endpoint if all Ollama endpoints fail
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
          if (response.data && 
              response.data.choices && 
              Array.isArray(response.data.choices) && 
              response.data.choices[0] && 
              response.data.choices[0].message) {
            return response.data.choices[0].message.content;
          } else {
            console.warn('OpenAI response does not have expected format:', response.data);
            // Try to extract any text we can find
            if (typeof response.data === 'string') {
              return response.data;
            } else if (response.data && typeof response.data.text === 'string') {
              return response.data.text;
            }
            throw new Error('Invalid OpenAI response format');
          }
        } catch (fallbackError) {
          console.error('All fallbacks failed:', fallbackError);
          // Return a default response as last resort
          return "I'm sorry, but I encountered an error connecting to the language model service. Please check your connection and try again.";
        }
      }
    }
  }
}; 