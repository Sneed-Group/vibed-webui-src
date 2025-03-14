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

// Body parsing middleware to access request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware with specific settings
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Add OPTIONS pre-flight support for all routes
app.options('*', cors());

// Add middleware to log all incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Log headers for debugging
  if (req.method === 'POST' || req.method === 'OPTIONS') {
    console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
  }
  
  next();
});

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

// Proxy middleware for Ollama API requests - Native API
app.use('/api', createProxyMiddleware({
  target: `${parsedUrl.protocol}//${parsedUrl.host}`,
  changeOrigin: true,
  logLevel: 'debug', // Add debug logging for more information
  // Forward authorization headers if present
  onProxyReq: (proxyReq, req, res) => {
    // Forward all headers from the client
    Object.keys(req.headers).forEach(key => {
      if (key !== 'host') {  // Don't forward the host header
        const value = req.headers[key];
        proxyReq.setHeader(key, value);
      }
    });
    
    // Clear any existing content-length to prevent issues
    proxyReq.removeHeader('Content-Length');
    
    // Re-encode the body if it exists to ensure content-length is correct
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      
      // Log the detailed request info
      console.log('=========== PROXY REQUEST DETAILS ===========');
      console.log(`METHOD: ${req.method}`);
      console.log(`PATH: ${req.path}`);
      console.log(`TARGET: ${parsedUrl.protocol}//${parsedUrl.host}${proxyReq.path}`);
      console.log(`HEADERS:`, JSON.stringify(proxyReq.getHeaders(), null, 2));
      console.log(`BODY:`, bodyData);
      console.log('============================================');
      
      // Write body to request
      proxyReq.write(bodyData);
    }
    
    // Log the full proxy request details for debugging
    console.log(`Proxying Ollama API request: ${req.method} ${req.path}`);
    console.log(`Target: ${parsedUrl.protocol}//${parsedUrl.host}${proxyReq.path}`);
  },
  pathRewrite: (path) => {
    // For the tags endpoint, we need special handling
    if (path === '/api/tags') {
      // Ollama API expects /api/tags endpoint
      console.log(`Proxying tags request to: /api/tags`);
      return '/api/tags';
    }
    
    // For the generate endpoint, we need special handling
    if (path === '/api/generate') {
      // Ollama native API for chat generation
      console.log(`Proxying generate request to: /api/generate`);
      return '/api/generate';
    }
    
    // For the chat endpoint, we need special handling
    if (path === '/api/chat') {
      // Ollama native API for chat
      console.log(`Proxying chat request to: /api/chat`);
      return '/api/chat';
    }
    
    // For other API endpoints, handle normally
    const strippedPath = path.replace(/^\/api/, '');
    
    // If the API URL already has a path structure (like /api), use it as a prefix
    // Otherwise, just use the stripped path
    const newPath = apiBasePath !== '/' 
      ? `${apiBasePath}${strippedPath}` 
      : strippedPath;
      
    console.log(`Rewriting path from ${path} to ${newPath}`);
    return newPath;
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log the response status and headers for debugging
    console.log(`Proxy Response Status: ${proxyRes.statusCode}`);
    console.log(`Proxy Response Headers:`, JSON.stringify(proxyRes.headers, null, 2));
    
    // If it's an error status, log more information
    if (proxyRes.statusCode >= 400) {
      let responseBody = '';
      proxyRes.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      proxyRes.on('end', () => {
        console.error('Error Response Body:', responseBody);
      });
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error: ' + err.message);
  }
}));

// Proxy middleware for Ollama API requests - OpenAI compatible endpoints
app.use('/v1', createProxyMiddleware({
  target: `${parsedUrl.protocol}//${parsedUrl.host}`,
  changeOrigin: true,
  logLevel: 'debug', // Add debug logging for more information
  // Forward authorization headers if present
  onProxyReq: (proxyReq, req, res) => {
    // Forward all headers from the client
    Object.keys(req.headers).forEach(key => {
      if (key !== 'host') {  // Don't forward the host header
        const value = req.headers[key];
        proxyReq.setHeader(key, value);
      }
    });
    
    // Clear any existing content-length to prevent issues
    proxyReq.removeHeader('Content-Length');
    
    // Re-encode the body if it exists to ensure content-length is correct
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      
      // Log the detailed request info
      console.log('=========== OPENAI PROXY REQUEST DETAILS ===========');
      console.log(`METHOD: ${req.method}`);
      console.log(`PATH: ${req.path}`);
      console.log(`TARGET: ${parsedUrl.protocol}//${parsedUrl.host}${proxyReq.path}`);
      console.log(`HEADERS:`, JSON.stringify(proxyReq.getHeaders(), null, 2));
      console.log(`BODY:`, bodyData);
      console.log('===================================================');
      
      // Write body to request
      proxyReq.write(bodyData);
    }
    
    // Log the full proxy request details for debugging
    console.log(`Proxying OpenAI API request: ${req.method} ${req.path}`);
    console.log(`Target: ${parsedUrl.protocol}//${parsedUrl.host}${proxyReq.path}`);
  },
  pathRewrite: (path) => {
    // For the chat completions endpoint specifically
    if (path === '/v1/chat/completions') {
      // Most Ollama deployments will implement the OpenAI compatible API at /v1/chat/completions
      console.log(`Proxying OpenAI-compatible request to: /v1/chat/completions`);
      return '/v1/chat/completions';
    }
    
    // For other v1 endpoints
    const strippedPath = path.replace(/^\/v1/, '');
    const newPath = apiBasePath !== '/' 
      ? `${apiBasePath}${strippedPath}` 
      : strippedPath;
      
    console.log(`Rewriting path from ${path} to ${newPath}`);
    return newPath;
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log the response status and headers for debugging
    console.log(`OpenAI Proxy Response Status: ${proxyRes.statusCode}`);
    console.log(`OpenAI Proxy Response Headers:`, JSON.stringify(proxyRes.headers, null, 2));
    
    // If it's an error status, log more information
    if (proxyRes.statusCode >= 400) {
      let responseBody = '';
      proxyRes.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      proxyRes.on('end', () => {
        console.error('OpenAI Error Response Body:', responseBody);
      });
    }
  },
  onError: (err, req, res) => {
    console.error('OpenAI Proxy error:', err);
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
  console.log(`API base path: ${apiBasePath}`);
  console.log(`Example tag request will be proxied to: ${parsedUrl.protocol}//${parsedUrl.host}/api/tags`);
  console.log(`Example generate request will be proxied to: ${parsedUrl.protocol}//${parsedUrl.host}/api/generate`);
}); 