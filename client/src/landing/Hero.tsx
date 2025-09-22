import { ArrowRight, MessageSquare } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-transparent overflow-hidden">
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
            <img src="/commandless.svg" alt="Commandless" className="w-12 h-12 md:w-14 md:h-14 cursor-pointer" />
          </a>
        </div>
      </div>

      <div className="absolute inset-0 bg-grid-pattern opacity-[0.06]"></div>

      <div className="container mx-auto px-4 text-center relative z-10">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent bg-[length:200%_100%]">
            From Commands to
            <span className="block text-primary">Conversations</span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed font-grotesque">
            Transform clunky bot commands into natural AI conversations in just a few clicks.
            Give your Discord and Telegram bots the power of conversational AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <a 
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold bg-[hsl(var(--primary))] text-white shadow-[0_10px_30px_hsl(245_83%_65%/0.35)] hover:shadow-[0_14px_40px_hsl(245_83%_65%/0.45)] transition-all"
            >
              Start Free
              <ArrowRight className="w-5 h-5" />
            </a>
            <a 
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold border border-border bg-background hover:bg-accent transition-all"
            >
              <MessageSquare className="w-5 h-5" />
              Sign In
            </a>
          </div>

          <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>No coding required</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
              <span>Setup in minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
              <span>Works with existing bots</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


