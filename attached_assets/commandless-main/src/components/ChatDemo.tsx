import React, { useState, useEffect } from 'react';
import { User, Bot } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  type: 'command' | 'natural';
}

const ChatDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'command' | 'natural'>('natural');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const commandMessages: Message[] = [
    { id: 1, text: "/help", sender: 'user', type: 'command' },
    { id: 2, text: "Available commands:\n/weather [location]\n/remind [time] [message]\n/stats\n/settings", sender: 'bot', type: 'command' },
    { id: 3, text: "/weather New York", sender: 'user', type: 'command' },
    { id: 4, text: "The weather in New York is 72°F and partly cloudy.", sender: 'bot', type: 'command' },
    { id: 5, text: "/remind tomorrow buy groceries", sender: 'user', type: 'command' },
    { id: 6, text: "Reminder set for tomorrow: buy groceries", sender: 'bot', type: 'command' },
  ];
  
  const naturalMessages: Message[] = [
    { id: 1, text: "Hi! Can you help me with something?", sender: 'user', type: 'natural' },
    { id: 2, text: "Of course! I'm here to help. What can I do for you today?", sender: 'bot', type: 'natural' },
    { id: 3, text: "What's the weather like in New York?", sender: 'user', type: 'natural' },
    { id: 4, text: "The weather in New York is 72°F and partly cloudy. Would you like to know the forecast for later today?", sender: 'bot', type: 'natural' },
    { id: 5, text: "No thanks, but can you remind me to buy groceries tomorrow?", sender: 'user', type: 'natural' },
    { id: 6, text: "Sure thing! I've set a reminder for you to buy groceries tomorrow. Is there a specific time you'd like to be reminded?", sender: 'bot', type: 'natural' },
  ];
  
  useEffect(() => {
    setMessages([]);
    setCurrentIndex(0);
    
    const messageSet = activeTab === 'command' ? commandMessages : naturalMessages;
    
    const interval = setInterval(() => {
      if (currentIndex < messageSet.length) {
        setMessages(prev => [...prev, messageSet[currentIndex]]);
        setCurrentIndex(prev => prev + 1);
      } else {
        clearInterval(interval);
        
        // Reset after a delay
        setTimeout(() => {
          setMessages([]);
          setCurrentIndex(0);
        }, 5000);
      }
    }, 1500);
    
    return () => clearInterval(interval);
  }, [activeTab, currentIndex]);
  
  return (
    <div className="h-96 flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button 
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'command' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => setActiveTab('command')}
        >
          Command Based
        </button>
        <button 
          className={`flex-1 py-3 text-sm font-medium ${activeTab === 'natural' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => setActiveTab('natural')}
        >
          Commandless AI
        </button>
      </div>
      
      {/* Chat messages */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col space-y-4">
        {messages.map((message, index) => (
          <div 
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div 
              className={`
                max-w-[80%] p-3 rounded-lg 
                ${message.sender === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-slate-200 text-slate-800 rounded-bl-none'}
              `}
            >
              <div className="flex items-start gap-2">
                {message.sender === 'bot' && (
                  <Bot className="w-5 h-5 mt-1 text-slate-600" />
                )}
                <div className="flex-1">
                  <p className="text-sm">{message.text}</p>
                </div>
                {message.sender === 'user' && (
                  <User className="w-5 h-5 mt-1 text-indigo-200" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatDemo;