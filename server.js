import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8765;

// CORS middleware
app.use(cors());

// Get the Ollama API URL from environment or use the default
const ollamaApiUrl = process.env.VITE_OLLAMA_API_URL || 'https://ollama-api.nodemixaholic.com';

// Proxy middleware for Ollama API requests
app.use('/api', createProxyMiddleware({
  target: ollamaApiUrl,
  changeOrigin: true,
  pathRewrite: (path) => {
    // Remove /api prefix and make sure we have the right URL format
    // This ensures our requests go to the correct endpoint on the Ollama server
    const newPath = path.replace(/^\/api/, '/api');
    console.log(`Rewriting path from ${path} to ${newPath}`);
    return newPath;
  },
  onProxyReq: (proxyReq, req, res) => {
    // Log proxy requests for debugging
    console.log(`Proxying request from ${req.path} to: ${ollamaApiUrl}${proxyReq.path}`);
  }
}));

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// For any request that doesn't match an asset, serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Proxying API requests to ${ollamaApiUrl}`);
}); 