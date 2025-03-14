import { useState, useEffect, useRef } from 'react';
import { ollamaService } from '../services/ollamaService';
import '../styles/chat.css';

// Get environment variables
const OLLAMA_API_URL = import.meta.env.VITE_OLLAMA_API_URL;
const IS_PRODUCTION = import.meta.env.VITE_PROD === 'TRUE';

// Storage keys
const STORAGE_KEY_TABS = 'vibed_tabs';
const STORAGE_KEY_ACTIVE_TAB = 'vibed_active_tab';
const STORAGE_KEY_SELECTED_MODEL = 'vibed_selected_model';

// Default tab to use when no saved tabs exist
const getDefaultTab = () => ({
  id: `tab-${Date.now()}`,
  name: 'Chat 1',
  messages: []
});

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

interface Tab {
  id: string;
  name: string;
  messages: Message[];
}

// Helper for safely saving to localStorage
const saveToLocalStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed to save to localStorage (${key}):`, error);
    return false;
  }
};

// Helper for safely loading from localStorage
const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const savedValue = localStorage.getItem(key);
    if (savedValue) {
      return JSON.parse(savedValue) as T;
    }
  } catch (error) {
    console.error(`Failed to load from localStorage (${key}):`, error);
  }
  return defaultValue;
};

export function Chat() {
  // Initialize state directly from localStorage during initialization
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    loadFromLocalStorage(STORAGE_KEY_SELECTED_MODEL, '')
  );
  const [tabs, setTabs] = useState<Tab[]>(
    loadFromLocalStorage(STORAGE_KEY_TABS, [getDefaultTab()])
  );
  const [activeTabId, setActiveTabId] = useState<string>(
    loadFromLocalStorage(STORAGE_KEY_ACTIVE_TAB, tabs[0]?.id || '')
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Get active tab and messages
  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];
  const messages = activeTab?.messages || [];

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    console.log('Saving tabs to localStorage:', tabs);
    saveToLocalStorage(STORAGE_KEY_TABS, tabs);
  }, [tabs]);

  // Save active tab ID to localStorage whenever it changes
  useEffect(() => {
    console.log('Saving active tab ID to localStorage:', activeTabId);
    saveToLocalStorage(STORAGE_KEY_ACTIVE_TAB, activeTabId);
  }, [activeTabId]);

  // Save selected model to localStorage whenever it changes
  useEffect(() => {
    if (selectedModel) {
      console.log('Saving selected model to localStorage:', selectedModel);
      saveToLocalStorage(STORAGE_KEY_SELECTED_MODEL, selectedModel);
    }
  }, [selectedModel]);

  useEffect(() => {
    // Log loaded state for debugging
    console.log('Initial state loaded:', {
      tabs,
      activeTabId,
      selectedModel
    });
    
    loadModels();
    
    // Ensure we have at least one tab
    if (tabs.length === 0) {
      const defaultTab = getDefaultTab();
      setTabs([defaultTab]);
      setActiveTabId(defaultTab.id);
    }
    
    // Ensure activeTabId points to an existing tab
    const tabExists = tabs.some(tab => tab.id === activeTabId);
    if (!tabExists && tabs.length > 0) {
      setActiveTabId(tabs[0].id);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadModels = async () => {
    try {
      const modelList = await ollamaService.getModels();
      setModels(modelList.map(m => m.name));
      
      // Only set the first model if there's no saved model
      if (modelList.length > 0 && !selectedModel) {
        setSelectedModel(modelList[0].name);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedModel || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    updateMessages([...messages, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let assistantMessage = '';
      await ollamaService.generateCompletion(
        selectedModel,
        [...messages, userMessage],
        (response) => {
          if (response.message?.content) {
            assistantMessage += response.message.content;
            updateActiveTabMessages(prev => {
              const newMessages = [...prev];
              const lastMessage = newMessages[newMessages.length - 1];
              if (lastMessage?.role === 'assistant') {
                lastMessage.content = assistantMessage;
                return [...newMessages];
              }
              return [...newMessages, { role: 'assistant', content: assistantMessage }];
            });
          }
        }
      );
    } catch (error) {
      console.error('Failed to generate response:', error);
    } finally {
      setIsLoading(false);
      // Focus input after response is complete
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  };

  const updateMessages = (newMessages: Message[]) => {
    const updatedTabs = tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, messages: newMessages }
        : tab
    );
    setTabs(updatedTabs);
    
    // Force save to localStorage for immediate persistence
    saveToLocalStorage(STORAGE_KEY_TABS, updatedTabs);
  };

  const updateActiveTabMessages = (updater: (messages: Message[]) => Message[]) => {
    const updatedTabs = tabs.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, messages: updater(tab.messages || []) }
        : tab
    );
    setTabs(updatedTabs);
    
    // Force save to localStorage for immediate persistence
    saveToLocalStorage(STORAGE_KEY_TABS, updatedTabs);
  };

  const addNewTab = () => {
    const newTabId = `tab-${Date.now()}`; // Use timestamp for unique IDs
    const newTab = {
      id: newTabId,
      name: `Chat ${tabs.length + 1}`,
      messages: []
    };
    const updatedTabs = [...tabs, newTab];
    setTabs(updatedTabs);
    setActiveTabId(newTabId);
    
    // Force save to localStorage for immediate persistence
    saveToLocalStorage(STORAGE_KEY_TABS, updatedTabs);
    saveToLocalStorage(STORAGE_KEY_ACTIVE_TAB, newTabId);
  };

  const deleteTab = (tabId: string) => {
    if (tabs.length <= 1) return; // Don't delete the last tab
    
    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    
    setTabs(newTabs);
    
    // If the active tab was deleted, activate another tab
    if (activeTabId === tabId) {
      // Try to activate the tab to the left, or the first tab if there is none
      const newActiveIndex = Math.max(0, tabIndex - 1);
      const newActiveTabId = newTabs[newActiveIndex].id;
      setActiveTabId(newActiveTabId);
      
      // Force save to localStorage for immediate persistence
      saveToLocalStorage(STORAGE_KEY_ACTIVE_TAB, newActiveTabId);
    }
    
    // Force save to localStorage for immediate persistence
    saveToLocalStorage(STORAGE_KEY_TABS, newTabs);
  };

  const clearAllTabs = () => {
    if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
      const defaultTab = getDefaultTab();
      const emptyTabs = [defaultTab];
      setTabs(emptyTabs);
      setActiveTabId(defaultTab.id);
      
      // Force save to localStorage for immediate persistence
      saveToLocalStorage(STORAGE_KEY_TABS, emptyTabs);
      saveToLocalStorage(STORAGE_KEY_ACTIVE_TAB, defaultTab.id);
      
      // Also clear localStorage directly to ensure it's emptied
      localStorage.removeItem(STORAGE_KEY_TABS);
      localStorage.removeItem(STORAGE_KEY_ACTIVE_TAB);
      
      console.log('All chat history cleared and localStorage reset');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getFormattedDate = () => {
    return new Date().toLocaleString();
  };

  return (
    <div className="chat-container">
      <header className="header">
        <div className="header-content">
          <h1 className="app-title">Vibed Web UI</h1>
          <div className="header-controls">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="model-select"
            >
              {models.length > 0 ? (
                models.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))
              ) : (
                <option value="">Loading models...</option>
              )}
            </select>
            <span className="date-display">{getFormattedDate()}</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs-list">
          {tabs.map(tab => (
            <div key={tab.id} className="tab">
              <button
                onClick={() => setActiveTabId(tab.id)}
                className={`tab-button ${activeTabId === tab.id ? 'active' : ''}`}
              >
                {tab.name}
              </button>
              {tabs.length > 1 && (
                <button 
                  onClick={() => deleteTab(tab.id)}
                  className="tab-close"
                  aria-label="Close tab"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addNewTab}
            className="new-tab-button"
            aria-label="New chat"
          >
            +
          </button>
          <button
            onClick={clearAllTabs}
            className="clear-tabs-button"
            aria-label="Clear all chats"
            title="Clear all chat history"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <main className="main-content">
        <div className="chat-box">
          {/* Chat log */}
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <p className="empty-chat-text">Start a new conversation</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`message ${message.role === 'user' ? 'user-message' : 'ai-message'}`}
                >
                  <p className="message-role">
                    {message.role === 'user' ? 'User:' : 'AI:'}
                  </p>
                  <p className="message-content">{message.content}</p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="input-container">
            <form onSubmit={handleSubmit} className="input-form">
              <div className="textarea-wrapper">
                <textarea
                  ref={chatInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  className="input-textarea"
                  rows={3}
                  disabled={isLoading}
                ></textarea>
                <div className="textarea-hint">
                  Press Enter to send, Shift+Enter for new line
                </div>
              </div>
              <div className="input-controls">
                <span className="status-text">
                  {isLoading ? 'AI is thinking...' : 'Ready'}
                </span>
                <button
                  type="submit"
                  disabled={isLoading || !input.trim() || !selectedModel}
                  className="send-button"
                >
                  {isLoading ? 'Generating...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        {IS_PRODUCTION ? (
          <p>Vibed Web UI</p>
        ) : (
          <p>Vibed Web UI - Connected to {OLLAMA_API_URL}</p>
        )}
      </footer>
    </div>
  );
} 