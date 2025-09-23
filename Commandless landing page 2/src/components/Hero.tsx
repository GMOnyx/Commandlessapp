import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, MessageSquare } from "lucide-react";
import commandlessCropped from "@/assets/commandless-cropped.svg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-transparent overflow-hidden">
      {/* Centered logo */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40">
        <div className="relative">
          <a
            href="#"
            className="relative block"
            onClick={(e) => {
              const container = (e.currentTarget.parentElement?.parentElement as HTMLElement) || document.body;
              const burst = document.createElement('span');
              burst.className = 'burst';
              burst.style.left = `${e.clientX}px`;
              burst.style.top = `${e.clientY}px`;
              container.appendChild(burst);
              setTimeout(() => burst.remove(), 900);
            }}
          >
            <img src={commandlessCropped} alt="Commandless" className="w-12 h-12 md:w-14 md:h-14 cursor-pointer" />
          </a>
        </div>
      </div>

      {/* Keep only subtle grid; global background pools handle the color */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.06]"></div>
      
      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Subtitle removed per request */}
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent animate-[fade-in_1s_ease-out_0.2s_both] bg-[length:200%_100%] animate-[gradient-flow_3s_ease-in-out_infinite]">
            From Commands to
            <span className="block text-primary animate-[fade-in_1s_ease-out_0.4s_both]">Conversations</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed animate-[fade-in_1s_ease-out_0.6s_both] font-grotesque">
            Transform clunky bot commands into natural AI conversations in just a few clicks. 
            Give your Discord and Telegram bots the power of conversational AI.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-[fade-in_1s_ease-out_0.8s_both]">
            <Button 
              variant="hero" 
              size="lg" 
              className="group hover:scale-105 transition-all duration-300 hover:shadow-glow"
              onClick={() => { window.location.href = '/sign-up'; }}
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="group hover:scale-105 transition-all duration-300"
              onClick={() => { window.location.href = '/sign-in'; }}
            >
              <MessageSquare className="w-5 h-5" />
              Sign in
            </Button>
          </div>
          
          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground animate-[fade-in_1s_ease-out_1s_both]">
            <div className="flex items-center gap-2 hover:scale-110 transition-transform duration-200">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>No coding required</span>
            </div>
            <div className="flex items-center gap-2 hover:scale-110 transition-transform duration-200">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
              <span>Setup in minutes</span>
            </div>
            <div className="flex items-center gap-2 hover:scale-110 transition-transform duration-200">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
              <span>Works with existing bots</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;