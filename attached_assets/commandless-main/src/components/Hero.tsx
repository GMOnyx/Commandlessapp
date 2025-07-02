import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import useTypewriter from '../hooks/useTypewriter';

const Hero: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  
  const { text, isTyping } = useTypewriter({
    phrases: [
      'Clunky Commands',
      '/start /help /ban...',
    ],
    typingSpeed: 100,
    deletingSpeed: 50,
    delayBetweenPhrases: 2000,
  });

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="pt-32 pb-20 md:pt-40 md:pb-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 opacity-50" />

      {/* Decorative Blobs */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-200 rounded-full opacity-20 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-purple-200 rounded-full opacity-20 blur-3xl" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className={`max-w-4xl mx-auto text-center space-y-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          
          {/* Subheading */}
          <div className="inline-block px-4 py-1 bg-indigo-100 rounded-full text-indigo-700 font-medium text-sm">
            Revolutionizing Bot Interactions
          </div>
          
          {/* Hero Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-slate-900 break-words">
            <span className="block">
              AI-Powered Conversations,
            </span>
            <span className="block text-indigo-600 mt-2">
              Not{' '}
              <span className="relative inline-block max-w-full break-words">
                {text}
                <span
                  className={`absolute right-0 w-0.5 h-full bg-indigo-600 ${
                    isTyping ? 'animate-blink' : ''
                  }`}
                />
              </span>
            </span>
          </h1>

          {/* Subtext */}
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl mx-auto">
            Transform your Discord and Telegram bots with natural language understanding. 
            Replace clunky slash commands with smooth, conversational AI interactions.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 justify-center">
            <a 
              href="#signup" 
              className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center gap-2 text-lg"
            >
              Start Building
              <ArrowRight className="w-5 h-5" />
            </a>
            <a 
              href="#features" 
              className="px-6 py-3 bg-white text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors shadow-sm hover:shadow-md flex items-center gap-2 text-lg"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;


