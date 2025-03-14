import axios from 'axios';

const OLLAMA_API_URL = import.meta.env.VITE_OLLAMA_API_URL;

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
    const response = await axios.get(`${OLLAMA_API_URL}/api/tags`);
    return response.data.models;
  },

  // Generate chat completion
  async generateCompletion(
    model: string,
    messages: ChatMessage[],
    onProgress?: (response: ChatResponse) => void
  ): Promise<string> {
    if (onProgress) {
      // Handle streaming response
      const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
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
      const response = await axios.post(`${OLLAMA_API_URL}/api/chat`, {
        model,
        messages,
        stream: false,
      });
      return response.data.message.content;
    }
  }
}; 