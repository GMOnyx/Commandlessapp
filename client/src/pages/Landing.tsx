import React, { useState, useEffect, useRef } from 'react';
import { Link } from "wouter";
import { 
  MessageSquareText, 
  Menu, 
  X, 
  ArrowRight, 
  Code, 
  Zap, 
  Brain, 
  RefreshCw, 
  Lock,
  Check,
  Twitter,
  Github,
  Linkedin
} from 'lucide-react';
import useTypewriter from '@/hooks/useTypewriter';
import useIntersectionObserver from '@/hooks/useIntersectionObserver';

// Header Component
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
          <MessageSquareText className="w-8 h-8" />
          <span className="text-xl font-bold">Commandless</span>
        </a>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-slate-700 hover:text-indigo-600 transition-colors">Features</a>
          <a href="#how-it-works" className="text-slate-700 hover:text-indigo-600 transition-colors">How It Works</a>
          <Link href="/sign-up">
            <a className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg">
              Get Started
            </a>
          </Link>
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
            <Link href="/sign-up">
              <a 
                className="px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-md w-full text-center"
                onClick={() => setIsMenuOpen(false)}
              >
                Get Started
              </a>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

// Hero Component
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
                    isTyping ? 'animate-pulse' : ''
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

// Features Component
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

// How It Works Component
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

// Call to Action Component
const CallToAction: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const isVisible = useIntersectionObserver(sectionRef, { threshold: 0.1 });
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    platform: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // For now, just simulate success - you can integrate with your backend later
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess(true);
      setFormData({ email: '', name: '', platform: '' });
    } catch (err) {
      setError('Failed to submit form');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="signup" ref={sectionRef} className="py-20 bg-indigo-600 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full opacity-20 -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full opacity-20 translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
      
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className={`bg-white rounded-2xl shadow-xl p-8 md:p-12 max-w-5xl mx-auto transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-1 bg-indigo-100 rounded-full text-indigo-700 font-medium text-sm mb-4">
                <Zap className="w-4 h-4" />
                <span>Start Building Today</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
                Ready to Transform Your Bot Experience?
              </h2>
              
              <p className="text-lg text-slate-600 mb-6">
                Join hundreds of bot developers who have upgraded to conversational AI. 
                Get started with Commandless in minutes and delight your users with natural interactions.
              </p>
            </div>
            
            <div className="w-full lg:w-80 bg-slate-50 rounded-xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Get Started</h3>
              
              {success ? (
                <div className="text-center p-6">
                  <div className="text-5xl mb-4">🎉</div>
                  <h4 className="text-xl font-bold text-slate-800 mb-2">
                    Welcome to Commandless!
                  </h4>
                  <p className="text-slate-600">
                    You're all set to start building conversational bots.
                  </p>
                  <Link href="/sign-up">
                    <button className="mt-4 w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                      Continue to Dashboard
                    </button>
                  </Link>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input 
                      type="email" 
                      id="email" 
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input 
                      type="text" 
                      id="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Name"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="platform" className="block text-sm font-medium text-slate-700 mb-1">Bot Platform</label>
                    <select 
                      id="platform"
                      value={formData.platform}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select platform</option>
                      <option value="discord">Discord</option>
                      <option value="telegram">Telegram</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  
                  {error && (
                    <div className="text-red-500 text-sm">{error}</div>
                  )}
                  
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? 'Submitting...' : 'Get Started'}
                    {!loading && <ArrowRight className="w-5 h-5" />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Footer Component
const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-white pt-16 pb-8">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center space-x-2 text-white mb-4">
              <MessageSquareText className="w-7 h-7" />
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
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-lg mb-4">Product</h3>
            <ul className="space-y-2">
              <li><a href="#features" className="text-slate-400 hover:text-white transition-colors">Features</a></li>
              <li><Link href="/sign-up"><a className="text-slate-400 hover:text-white transition-colors">Get Started</a></Link></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">API Reference</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-lg mb-4">Company</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">About</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Blog</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-lg mb-4">Support</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Status</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-slate-500 text-sm mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} Commandless. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <Link href="/sign-in">
              <a className="text-slate-400 hover:text-white transition-colors text-sm">Sign In</a>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main Landing Page Component
export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
} 