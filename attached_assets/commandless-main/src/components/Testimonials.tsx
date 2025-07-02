import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import useIntersectionObserver from '../hooks/useIntersectionObserver';

interface Testimonial {
  id: number;
  quote: string;
  author: string;
  role: string;
  image: string;
  stars: number;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    quote: "Implementing Commandless in our Discord server was a game-changer. Our community engagement increased by 70% as users found the bot more intuitive and helpful.",
    author: "Alex Chen",
    role: "Gaming Community Manager",
    image: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=120",
    stars: 5
  },
  {
    id: 2,
    quote: "We switched from slash commands to Commandless and our user satisfaction scores went through the roof. The natural conversation flow feels like talking to a real person.",
    author: "Samantha Rodriguez",
    role: "Product Manager at TechBot",
    image: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=120",
    stars: 5
  },
  {
    id: 3,
    quote: "As a non-technical community admin, I was worried about implementing AI. Commandless made it incredibly simple - I had it up and running in under an hour.",
    author: "Mark Johnson",
    role: "Education Discord Admin",
    image: "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=120",
    stars: 4
  }
];

const Testimonials: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const isVisible = useIntersectionObserver(sectionRef, { threshold: 0.1 });
  
  const nextTestimonial = () => {
    setActiveIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };
  
  const prevTestimonial = () => {
    setActiveIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };
  
  return (
    <section id="testimonials" ref={sectionRef} className="py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className={`text-3xl md:text-4xl font-bold mb-4 text-slate-900 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            What Bot Developers Say
          </h2>
          <p className={`text-lg text-slate-600 transition-all duration-700 delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            Hear from developers who have transformed their bot experiences with Commandless AI.
          </p>
        </div>
        
        <div className={`max-w-4xl mx-auto transition-all duration-700 delay-200 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}>
          <div className="relative">
            <button 
              onClick={prevTestimonial}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-12 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:shadow-lg transition-all z-10"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <div className="overflow-hidden relative">
              <div 
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${activeIndex * 100}%)` }}
              >
                {testimonials.map((testimonial) => (
                  <div key={testimonial.id} className="w-full flex-shrink-0">
                    <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 border border-slate-100">
                      <div className="flex items-center gap-1 mb-6">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i}
                            className={`w-5 h-5 ${i < testimonial.stars ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`}
                          />
                        ))}
                      </div>
                      
                      <blockquote className="text-xl md:text-2xl text-slate-700 font-medium mb-8 italic">
                        "{testimonial.quote}"
                      </blockquote>
                      
                      <div className="flex items-center gap-4">
                        <img 
                          src={testimonial.image} 
                          alt={testimonial.author}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">{testimonial.author}</div>
                          <div className="text-slate-600 text-sm">{testimonial.role}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <button 
              onClick={nextTestimonial}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-12 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:shadow-lg transition-all z-10"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex justify-center mt-8 gap-2">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  activeIndex === index ? 'bg-indigo-600 w-6' : 'bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;