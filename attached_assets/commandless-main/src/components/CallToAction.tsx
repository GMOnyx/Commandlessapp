import React, { useRef, useState } from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import useIntersectionObserver from '../hooks/useIntersectionObserver';
import { supabase } from '../lib/supabase'; // Updated path to your supabase.ts

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
      const { data, error } = await supabase
        .from('beta_signups') // Your table name
        .insert([{
          email: formData.email,
          name: formData.name,
          platform: formData.platform,
          created_at: new Date().toISOString()
        }]);
      
      if (error) throw error;
      
      setSuccess(true);
      setFormData({ email: '', name: '', platform: '' });
    } catch (err) {
      setError(err.message || 'Failed to submit form');
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
              <h3 className="text-xl font-semibold text-slate-900 mb-4">Register for Beta</h3>
              
              {success ? (
                <div className="text-center p-6">
                  <div className="text-5xl mb-4">🎉</div>
                  <h4 className="text-xl font-bold text-slate-800 mb-2">
                    You're on the list! 💪🏿
                  </h4>
                  <p className="text-slate-600">
                    We'll be in touch soon with your access.
                  </p>
                  <button
                    onClick={() => setSuccess(false)}
                    className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Submit another response
                  </button>
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

export default CallToAction;