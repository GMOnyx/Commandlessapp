import React, { useRef } from 'react';
import { Check } from 'lucide-react';
import useIntersectionObserver from '../hooks/useIntersectionObserver';

const HowItWorks: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const isVisible = useIntersectionObserver(sectionRef, { threshold: 0.1 });
  
  return (
    <section id="how-it-works" ref={sectionRef} className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className={`text-3xl md:text-4xl font-bold mb-4 text-slate-900 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            How Commandless Works
          </h2>
          <p className={`text-lg text-slate-600 transition-all duration-700 delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            Implementing conversational AI in your bot is simple and straightforward. 
            Just follow these steps to transform your bot interactions.
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto">
          <div className={`space-y-8 transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
          }`}>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900">Connect Your Bot</h3>
                <p className="text-slate-600 mb-4">
                  Link your Discord or Telegram bot to Commandless with our simple API. 
                  No changes to your existing bot structure required.
                </p>
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <Check className="w-4 h-4" />
                  <span>Works with any bot framework</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900">Configure Natural Language Processing</h3>
                <p className="text-slate-600 mb-4">
                  Map your existing commands to natural language patterns. 
                  Our system will automatically recognize user intents.
                </p>
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <Check className="w-4 h-4" />
                  <span>No machine learning expertise required</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900">Test & Deploy</h3>
                <p className="text-slate-600 mb-4">
                  Test the conversational interface in our sandbox environment, 
                  then deploy to your live bot with a single click.
                </p>
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <Check className="w-4 h-4" />
                  <span>Instant updates, no downtime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;