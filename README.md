# Vibed Web UI

A simple, elegant frontend for the Ollama API, built with React and TypeScript.

## Features

- Chat with any Ollama model
- Multi-tabbed interface for multiple conversations
- Real-time streaming responses
- Dark mode support
- Responsive design for desktop and mobile
- Keyboard shortcuts for easy use

## Setup

1. Clone this repository
2. Create a `.env` file in the root directory with the following variables:
   ```
   VITE_OLLAMA_API_URL=http://localhost:11434
   VITE_UI_PORT=5173
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

The built files will be in the `dist` directory. You can serve these files with any static file server.

## Configuration

You can customize the following environment variables:

- `VITE_OLLAMA_API_URL`: The URL of your Ollama API server
- `VITE_UI_PORT`: The port to run the development server on

## License

MIT
