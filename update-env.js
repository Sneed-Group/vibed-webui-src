import fs from 'fs';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Check if .env file exists
const envExists = fs.existsSync('.env');

if (envExists) {
  // Read current .env file
  const envContent = fs.readFileSync('.env', 'utf8');
  
  // Extract current API URL
  const apiUrlMatch = envContent.match(/VITE_OLLAMA_API_URL=(.+)/);
  const currentApiUrl = apiUrlMatch ? apiUrlMatch[1].trim() : 'not set';
  
  console.log(`Current API URL: ${currentApiUrl}`);
  console.log('Recommended API URL: https://ai.nodemixaholic.com/api');
  
  rl.question('Do you want to update to the recommended API URL? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      // Update the API URL
      const updatedContent = envContent.replace(
        /VITE_OLLAMA_API_URL=.+/,
        'VITE_OLLAMA_API_URL=https://ai.nodemixaholic.com/api'
      );
      
      fs.writeFileSync('.env', updatedContent);
      console.log('✅ .env file updated successfully!');
    } else {
      console.log('No changes made to .env file.');
    }
    rl.close();
  });
} else {
  console.log('No .env file found. Creating one with recommended settings...');
  
  const defaultEnv = `# Ollama Server Configuration
# Use the correct domain for your API server
VITE_OLLAMA_API_URL=https://ai.nodemixaholic.com/api

# UI Configuration
VITE_UI_PORT=8765

# Production Mode
# Set to TRUE to hide the server connection URL in the footer
VITE_PROD=TRUE`;
  
  fs.writeFileSync('.env', defaultEnv);
  console.log('✅ .env file created successfully!');
  rl.close();
} 