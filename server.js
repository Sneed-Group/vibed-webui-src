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
console.log('API base path:', apiBasePath);

// Proxy middleware for Ollama API requests
app.use('/api', createProxyMiddleware({
  target: `${parsedUrl.protocol}//${parsedUrl.host}`,
  changeOrigin: true,
  pathRewrite: (path) => {
    // Log the incoming path before any modification
    console.log(`Original path: ${path}`);
    
    // Try these path rewriting strategies in order:
    
    // 1. If the path is /api/api/tags, we want to rewrite to /api/tags
    if (path.startsWith('/api/api/')) {
      const newPath = path.replace('/api/api/', '/api/');
      console.log(`Rule 1: Rewriting ${path} to ${newPath}`);
      return newPath;
    }
    
    // 2. If the API base path already contains /api, avoid duplication
    if (apiBasePath.includes('/api')) {
      const newPath = path.replace('/api', '');
      console.log(`Rule 2: Rewriting ${path} to ${newPath}`);
      return newPath;
    }
    
    // 3. Try appending /ollama to the path
    if (!path.includes('/ollama')) {
      const newPath = `/ollama${path}`;
      console.log(`Rule 3: Rewriting ${path} to ${newPath}`);
      return newPath;
    }
    
    // 4. Keep original path as fallback
    console.log(`Rule 4: Keeping original path ${path}`);
    return path;
  },
  onProxyReq: (proxyReq, req, res) => {
    // Log proxy requests for debugging
    console.log(`Proxying request from ${req.path} to: ${parsedUrl.protocol}//${parsedUrl.host}${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log response status and headers for debugging
    console.log(`Proxy response status: ${proxyRes.statusCode}`);
    console.log(`Proxy response headers:`, JSON.stringify(proxyRes.headers, null, 2));
    
    // Check if it's returning HTML when we expected JSON
    const contentType = proxyRes.headers['content-type'] || '';
    if (contentType.includes('text/html') && req.path.includes('/api/tags')) {
      console.log('Warning: HTML response received for API request, client will handle fallback');
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    
    // Return a structured error response for API requests
    res.status(500).json({
      error: 'Proxy error',
      message: err.message,
      fallback: true
    });
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