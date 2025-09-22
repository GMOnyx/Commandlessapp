import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Globe, GamepadIcon, Bot, Users, Headphones } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const Features = () => {
  const features = [
    {
      icon: <Zap className="w-8 h-8 text-primary" />,
      title: "Full AI Takeover",
      description: "Transform your bot's UX completely. Users get natural conversations instead of remembering complex commands.",
      highlight: "Massive UX improvement"
    },
    {
      icon: <GamepadIcon className="w-8 h-8 text-primary" />,
      title: "AI Game Tutorials",
      description: "Perfect for game bots. Create interactive AI tutorials that guide players through complex game mechanics naturally.",
      highlight: "Interactive learning"
    },
    {
      icon: <Globe className="w-8 h-8 text-primary" />,
      title: "Universal Language",
      description: "Your bot automatically supports every language in the world. No more manual translations or language barriers.",
      highlight: "Global accessibility"
    },
    {
      icon: <Bot className="w-8 h-8 text-primary" />,
      title: "Character Roleplay",
      description: "Train your bot to roleplay as any character with perfect consistency. Great for RPG servers and immersive experiences.",
      highlight: "Immersive experiences"
    },
    {
      icon: <Users className="w-8 h-8 text-primary" />,
      title: "Smart Context Training",
      description: "Use our context feature to train AI on your specific use cases, making responses more accurate and relevant.",
      highlight: "Tailored responses"
    },
    {
      icon: <Headphones className="w-8 h-8 text-primary" />,
      title: "Automated Support",
      description: "AI handles common support questions automatically, dramatically reducing your support workload and response time.",
      highlight: "Reduced workload"
    }
  ];

  // Spotlight that follows cursor to create tactile feel
  const sectionRef = useRef<HTMLElement | null>(null);
  const [spot, setSpot] = useState({ x: 0, y: 0, opacity: 0 });

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      setSpot({ x: e.clientX - rect.left, y: e.clientY - rect.top, opacity: 1 });
    };
    const onLeave = () => setSpot((s) => ({ ...s, opacity: 0 }));
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <section id="features" ref={sectionRef as any} className="relative py-24">
      {/* Cursor spotlight */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300"
        style={{
          opacity: spot.opacity,
          background: `radial-gradient(600px circle at ${spot.x}px ${spot.y}px, hsl(var(--primary)/0.12), transparent 40%)`,
        }}
      />
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 font-grotesque tracking-tight">
            Powerful Features for Every Use Case
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Thoughtful building blocks that feel native to your server
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="group relative border-border/40 bg-card/40 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_hsl(245_83%_65%/0.15)]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {feature.icon}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
                    {feature.highlight}
                  </span>
                </div>
                <CardTitle className="text-xl">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;