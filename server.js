import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import url from 'url';
import fs from 'fs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8765;

// CORS middleware with specific settings
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Get the Ollama API URL from environment or use the default
// Try to read from .env file first for the most accurate value
let ollamaApiUrl;
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/VITE_OLLAMA_API_URL=(.+)/);
  if (match && match[1]) {
    ollamaApiUrl = match[1].trim();
  } else {
    ollamaApiUrl = process.env.VITE_OLLAMA_API_URL || 'https://ai.nodemixaholic.com/api';
  }
} catch (error) {
  ollamaApiUrl = process.env.VITE_OLLAMA_API_URL || 'https://ai.nodemixaholic.com/api';
}

// Make sure URL doesn't end with a slash
if (ollamaApiUrl.endsWith('/')) {
  ollamaApiUrl = ollamaApiUrl.slice(0, -1);
}

console.log('Using Ollama API URL:', ollamaApiUrl);

// Parse the API URL to determine path structure
const parsedUrl = new URL(ollamaApiUrl);
const apiBasePath = parsedUrl.pathname;

// Proxy middleware for Ollama API requests
app.use('/api', createProxyMiddleware({
  target: `${parsedUrl.protocol}//${parsedUrl.host}`,
  changeOrigin: true,
  pathRewrite: (path) => {
    // Remove /api from the path and prepend the API base path
    // This ensures our requests go to the correct endpoint on the Ollama server
    const strippedPath = path.replace(/^\/api/, '');
    
    // If the API URL already has a path structure (like /api), use it as a prefix
    // Otherwise, just use the stripped path
    const newPath = apiBasePath !== '/' 
      ? `${apiBasePath}${strippedPath}` 
      : strippedPath;
      
    console.log(`Rewriting path from ${path} to ${newPath}`);
    return newPath;
  },
  onProxyReq: (proxyReq, req, res) => {
    // Log proxy requests for debugging
    console.log(`Proxying request from ${req.path} to: ${parsedUrl.protocol}//${parsedUrl.host}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error: ' + err.message);
  }
}));

// Proxy middleware for Ollama API requests
app.use('/v1', createProxyMiddleware({
  target: `${parsedUrl.protocol}//${parsedUrl.host}`,
  changeOrigin: true,
  pathRewrite: (path) => {
    // Remove /api from the path and prepend the API base path
    // This ensures our requests go to the correct endpoint on the Ollama server
    const strippedPath = path.replace(/^\/v1/, '');
    
    // If the API URL already has a path structure (like /v1/ use it as a prefix
    // Otherwise, just use the stripped path
    const newPath = apiBasePath !== '/' 
      ? `${apiBasePath}${strippedPath}` 
      : strippedPath;
      
    console.log(`Rewriting path from ${path} to ${newPath}`);
    return newPath;
  },
  onProxyReq: (proxyReq, req, res) => {
    // Log proxy requests for debugging
    console.log(`Proxying request from ${req.path} to: ${parsedUrl.protocol}//${parsedUrl.host}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error: ' + err.message);
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