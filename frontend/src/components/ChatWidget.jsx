import React, { useState, useRef, useEffect } from 'react';

const ChatWidget = ({ onParamsUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      sender: 'agent', 
      text: 'Hello! I am your AI construction assistant. I can help you clarify the building requirements or adjust the 3D generation parameters. How can I help?' 
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = { sender: 'user', text: inputText };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // TODO: Replace with actual backend endpoint
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.text })
      });

      const data = await response.json();
      
      const agentMessage = { sender: 'agent', text: data.reply };
      setMessages(prev => [...prev, agentMessage]);

      if (data.updated_params && onParamsUpdate) {
        onParamsUpdate(data.updated_params);
      }

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { sender: 'agent', text: 'Sorry, I encountered an error communicating with the server.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSendMessage();
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end'
    }}>
      {/* Chat Window */}
      {isOpen && (
        <div style={{
          width: '350px',
          height: '500px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 5px 20px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          marginBottom: '10px',
          border: '1px solid #e0e0e0',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '15px',
            backgroundColor: '#2c3e50',
            color: 'white',
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>🏗️ Construction Assistant</span>
            <button 
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            padding: '15px',
            overflowY: 'auto',
            backgroundColor: '#f8f9fa'
          }}>
            {messages.map((msg, index) => (
              <div key={index} style={{
                marginBottom: '10px',
                textAlign: msg.sender === 'user' ? 'right' : 'left'
              }}>
                <div style={{
                  display: 'inline-block',
                  padding: '10px 15px',
                  borderRadius: '15px',
                  maxWidth: '80%',
                  backgroundColor: msg.sender === 'user' ? '#007bff' : '#e9ecef',
                  color: msg.sender === 'user' ? 'white' : '#333',
                  borderBottomRightRadius: msg.sender === 'user' ? '4px' : '15px',
                  borderBottomLeftRadius: msg.sender === 'agent' ? '4px' : '15px'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ textAlign: 'left', marginBottom: '10px' }}>
                <div style={{
                  display: 'inline-block',
                  padding: '10px 15px',
                  borderRadius: '15px',
                  backgroundColor: '#e9ecef',
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '15px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            gap: '10px'
          }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your instruction..."
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '20px',
                border: '1px solid #ccc',
                outline: 'none'
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                cursor: isLoading ? 'default' : 'pointer',
                opacity: isLoading ? 0.7 : 1
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px'
        }}
      >
        {isOpen ? '↓' : '💬'}
      </button>
    </div>
  );
};

export default ChatWidget;
