import React, { useRef, useEffect } from 'react';
import { MessageSquareText, Code, Zap, Brain, RefreshCw, Lock } from 'lucide-react';
import useIntersectionObserver from '../hooks/useIntersectionObserver';

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}

const Feature: React.FC<FeatureProps> = ({ icon, title, description, delay }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, { threshold: 0.1 });
  
  return (
    <div 
      ref={ref}
      className={`bg-white rounded-xl p-6 shadow-md border border-slate-100 transition-all duration-700 ease-out ${
        isVisible 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${delay * 100}ms` }}
    >
      <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
};

const Features: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const isVisible = useIntersectionObserver(sectionRef, { threshold: 0.1 });
  
  return (
    <section id="features" ref={sectionRef} className="py-20 bg-slate-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className={`text-3xl md:text-4xl font-bold mb-4 text-slate-900 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            Transform Bot Interactions with Conversational AI
          </h2>
          <p className={`text-lg text-slate-600 transition-all duration-700 delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            Commandless provides plug-and-play infrastructure to upgrade your Discord 
            and Telegram bots with natural language understanding.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Feature 
            icon={<MessageSquareText className="w-6 h-6" />}
            title="Natural Conversations"
            description="Let users chat naturally with your bot without remembering specific command syntax or prefixes."
            delay={0}
          />
          
          <Feature 
            icon={<Brain className="w-6 h-6" />}
            title="Memory-Aware AI"
            description="Bots remember context from previous interactions, creating more human-like and helpful conversations."
            delay={1}
          />
          
          <Feature 
            icon={<Code className="w-6 h-6" />}
            title="Simple Integration"
            description="Just a few lines of code to transform your existing bot from command-based to conversational AI."
            delay={2}
          />
          
          <Feature 
            icon={<Zap className="w-6 h-6" />}
            title="No Technical Expertise Required"
            description="Non-technical bot developers can easily implement without deep AI knowledge or complex programming."
            delay={3}
          />
          
          <Feature 
            icon={<RefreshCw className="w-6 h-6" />}
            title="Seamless Upgrading"
            description="Keep your existing bot functionality while enhancing the user experience with natural language."
            delay={4}
          />
          
          <Feature 
            icon={<Lock className="w-6 h-6" />}
            title="Secure & Scalable"
            description="Enterprise-grade infrastructure that scales with your bot's user base while maintaining data privacy."
            delay={5}
          />
        </div>
      </div>
    </section>
  );
};

export default Features;