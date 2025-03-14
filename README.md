# Vibed Web UI

A simple, elegant frontend for the Ollama API, built with React and TypeScript.

## Features

- Chat with any Ollama model
- Multi-tabbed interface for multiple conversations
- Real-time streaming responses
- Dark mode support
- Responsive design for desktop and mobile
- Keyboard shortcuts for easy use
- CORS-friendly proxy server for deployment

## Setup

1. Clone this repository
2. Create a `.env` file in the root directory with the following variables:
   ```
   VITE_OLLAMA_API_URL=http://localhost:11434
   VITE_UI_PORT=5173
   VITE_PROD=FALSE
   ```
   Adjust the values as needed for your environment.

3. Install dependencies:
   ```
   npm install
   ```

4. Start the development server:
   ```
   npm run dev
   ```

## Usage

1. Make sure your Ollama server is running
2. Open the web UI at http://localhost:5173 (or whatever port you specified)
3. Select a model from the dropdown
4. Start chatting!

### Keyboard Shortcuts

- Press `Enter` to send a message
- Press `Shift+Enter` to add a new line in the input area

## Building for Production

To build the application for production:

```
npm run build
```

The built files will be in the `dist` directory.

### Deploying with CORS-friendly Proxy

For web deployments (like GitHub Pages), we've added a proxy server to handle CORS issues:

1. Build the application:
   ```
   npm run build
   ```

2. Start the proxy server:
   ```
   npm start
   ```

This will:
- Serve the built files from the `dist` directory
- Proxy API requests to the Ollama API server specified in your `.env` file
- Handle CORS issues that would otherwise occur with direct API requests

If deploying to platforms like Heroku, Railway, or similar, the application will automatically use the proxy server.

## Static Deployment without Proxy (Advanced)

If you need to deploy to a static hosting service without the proxy:

1. Make sure your Ollama API server has CORS headers configured to allow requests from your domain
2. Set `VITE_PROD=TRUE` in your .env file before building
3. Deploy the contents of the `dist` directory to your static hosting service

## Configuration

You can customize the following environment variables:

- `VITE_OLLAMA_API_URL`: The URL of your Ollama API server
- `VITE_UI_PORT`: The port to run the development server on
- `VITE_PROD`: Set to TRUE to hide the server connection URL in the footer

## License

MIT
