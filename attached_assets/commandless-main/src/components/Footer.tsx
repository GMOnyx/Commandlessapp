import React from 'react';
import { MessageSquareMore, Twitter, Github, Linkedin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-white pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center space-x-2 text-white mb-4">
              <MessageSquareMore className="w-7 h-7" />
              <span className="text-xl font-bold">Commandless</span>
            </div>
            <p className="text-slate-400 mb-4">
              Transform bot interactions with natural, conversational AI. 
              No more clunky commands, just seamless conversations.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-lg mb-4">Product</h3>
            <ul className="space-y-2">
              <li><a href="#features" className="text-slate-400 hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" className="text-slate-400 hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">API Reference</a></li>
            </ul>
          </div>
          
          <div>
            
          </div>
          
          <div>
           
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-slate-500 text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Commandless. All rights reserved.
          </p>
          <div className="flex space-x-6">
            
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;