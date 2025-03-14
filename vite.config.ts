import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }: { mode: string }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    base: './', // Use relative paths
    server: {
      port: parseInt(env.VITE_UI_PORT || '5173'),
      strictPort: true, // Fail if port is in use
      host: true, // Listen on all addresses
      proxy: {
        // Proxy all API requests to the Ollama API server
        '/api': {
          target: env.VITE_OLLAMA_API_URL,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, '')
        }
      },
      // Allow requests to ai.nodemixaholic.com
      allowedHosts: ['ai.nodemixaholic.com', 'localhost'] // Add hostnames here
    }
  }
})
