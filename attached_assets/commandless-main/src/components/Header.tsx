import React, { useState, useEffect } from 'react';
import { MessageSquareMore, Menu, X } from 'lucide-react';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <a href="#" className="flex items-center space-x-2 text-indigo-600">
          <MessageSquareMore className="w-8 h-8" />
          <span className="text-xl font-bold">Commandless</span>
        </a>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-slate-700 hover:text-indigo-600 transition-colors">Features</a>
          <a href="#how-it-works" className="text-slate-700 hover:text-indigo-600 transition-colors">How It Works</a>
          <a 
            href="#signup" 
            className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg"
          >
            Get Started
          </a>
        </nav>

        {/* Mobile menu button */}
        <button 
          className="md:hidden text-slate-700"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isMenuOpen && (
        <div className="md:hidden bg-white shadow-lg absolute top-full left-0 right-0">
          <div className="container mx-auto px-4 py-3 flex flex-col space-y-4">
            <a 
              href="#features" 
              className="text-slate-700 hover:text-indigo-600 transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Features
            </a>
            <a 
              href="#how-it-works" 
              className="text-slate-700 hover:text-indigo-600 transition-colors py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              How It Works
            </a>
            <a 
              href="#signup" 
              className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-md w-full text-center"
              onClick={() => setIsMenuOpen(false)}
            >
              Get Started
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;