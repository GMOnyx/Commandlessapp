import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-24 bg-gradient-hero relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-glow/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl"></div>
      
      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium text-muted-foreground bg-background/50 px-3 py-1 rounded-full">
              Ready to Transform Your Bot?
            </span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
            Start Your AI Revolution
            <span className="block text-primary">Today</span>
          </h2>
          
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Join thousands of developers who've already transformed their bots from command-based to conversational AI. 
            Setup takes less than 5 minutes.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button variant="hero" size="lg" className="group">
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button variant="outline" size="lg">
              Schedule Demo
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>✨ Free trial • No credit card required • Setup in minutes</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;