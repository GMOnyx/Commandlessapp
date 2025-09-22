import { CheckCircle2, XCircle, Play, Zap, Globe, GamepadIcon, Bot, Users, Headphones } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Item = { title: string; body: string };

const problems: Item[] = [
  {
    title: "The Command Problem",
    body:
      "Users memorize /commands and syntax. Every friction breaks flow, increases drop-off, and creates support load.",
  },
  {
    title: "Lost in Menus",
    body:
      "Nested menus and modal dialogs slow users. What should be a quick action turns into a scavenger hunt.",
  },
  {
    title: "One‑off Integrations",
    body:
      "Each new feature needs custom wiring to your bot. Duplicated effort, inconsistent UX, and brittle logic.",
  },
];

const solutions: Item[] = [
  {
    title: "Natural Language Mappings",
    body:
      "Map everyday language to your existing commands. No retraining users, no command sheets.",
  },
  {
    title: "Guided Conversations",
    body:
      "Micro‑prompts gather the right context automatically. Users finish tasks faster with fewer mistakes.",
  },
  {
    title: "Drop‑in Layer",
    body:
      "Keep your bot logic. We orchestrate intent, parameters, and execution—so you ship features, not plumbing.",
  },
];

const Card = ({ icon, title, body, good = false }: { icon: React.ReactNode; title: string; body: string; good?: boolean }) => (
  <div className={`rounded-2xl border ${good ? "border-emerald-300/40 bg-emerald-50/40" : "border-rose-300/40 bg-rose-50/40"} p-5 backdrop-blur-sm`}> 
    <div className="flex items-start gap-3">
      <div className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full ${good ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>{icon}</div>
      <div>
        <h4 className="font-semibold mb-1">{title}</h4>
        <p className="text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  </div>
);

const WhyCommandless = () => {
  const [active, setActive] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    timer.current && window.clearInterval(timer.current);
    timer.current = window.setInterval(() => setActive((i) => (i + 1) % problems.length), 3000);
    return () => timer.current && window.clearInterval(timer.current);
  }, []);

  return (
    <section className="relative py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">Why Commandless</h2>
          <p className="text-muted-foreground">The friction of commands vs the flow of conversation—side by side.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <div className="space-y-4">
            {problems.map((p, i) => (
              <button key={i} onClick={() => setActive(i)} className={`text-left w-full transition-transform ${active === i ? "scale-[1.01]" : "opacity-80 hover:opacity-100"}`}>
                <Card icon={<XCircle className="w-4 h-4" />} title={p.title} body={p.body} />
              </button>
            ))}
          </div>
          <div className="space-y-4">
            {solutions.map((s, i) => (
              <div key={i} className={`transition-transform ${active === i ? "scale-[1.01]" : "opacity-80"}`}>
                <Card icon={<CheckCircle2 className="w-4 h-4" />} title={s.title} body={s.body} good />
              </div>
            ))}
          </div>
        </div>

        {/* Inline micro demo */}
        <div className="mt-12 max-w-3xl mx-auto rounded-2xl border border-border/60 bg-background/60 backdrop-blur p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Play className="w-3 h-3"/>Quick peek</div>
          <div className="flex items-center gap-2 text-sm">
            <div className="flex-1 rounded-xl border p-2 bg-muted/40">/timeout alex 10m --reason spam</div>
            <div className="text-muted-foreground">→</div>
            <div className="flex-1 rounded-xl border p-2">Could you time out Alex for spam for 10 minutes?</div>
          </div>
        </div>

        {/* Capabilities rail: creative, tactile replacement for a grid */}
        <FeatureRail />
      </div>
    </section>
  );
};

// Interactive feature rail component
const featuresData = [
  { icon: <Zap className="w-5 h-5"/>, title: "Full AI Takeover", desc: "Natural conversations instead of memorizing commands." },
  { icon: <GamepadIcon className="w-5 h-5"/>, title: "AI Game Tutorials", desc: "Guided, interactive flows for complex mechanics." },
  { icon: <Globe className="w-5 h-5"/>, title: "Universal Language", desc: "Multi‑language by default—no manual translations." },
  { icon: <Bot className="w-5 h-5"/>, title: "Character Roleplay", desc: "Consistent persona behavior for immersive servers." },
  { icon: <Users className="w-5 h-5"/>, title: "Smart Context Training", desc: "Ground responses in your rules and data." },
  { icon: <Headphones className="w-5 h-5"/>, title: "Automated Support", desc: "Resolve common questions with human‑like clarity." },
];

const FeatureRail = () => {
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement | null>(null);

  // Auto-highlight if idle
  useEffect(() => {
    const id = window.setInterval(() => setActive((i) => (i + 1) % featuresData.length), 3500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const chip = el.children[active] as HTMLElement | undefined;
    if (chip) {
      el.scrollTo({ left: chip.offsetLeft - 24, behavior: "smooth" });
    }
  }, [active]);

  return (
    <div className="mt-16">
      <div className="text-center mb-6">
        <h3 className="text-2xl md:text-3xl font-semibold">What You Get</h3>
        <p className="text-muted-foreground">Practical capabilities your team can use on day one.</p>
      </div>

      {/* Chips rail */}
      <div ref={railRef} className="relative flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory px-6 py-2 no-scrollbar">
        {featuresData.map((f, i) => (
          <button
            key={f.title}
            className="snap-start shrink-0 rounded-full border border-border/60 bg-card/60 backdrop-blur px-4 py-2 inline-flex items-center gap-2 transition-all hover:-translate-y-0.5"
            style={{
              boxShadow: active === i ? "0 12px 40px hsla(245,83%,65%,0.18)" : undefined,
              color: active === i ? "hsl(var(--primary))" : undefined,
              borderColor: active === i ? "hsl(var(--primary))" : undefined,
            }}
            onClick={() => setActive(i)}
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              {f.icon}
            </span>
            <span className="text-sm font-medium">{f.title}</span>
          </button>
        ))}
      </div>

      {/* Detail card */}
      <div className="mt-6 max-w-4xl mx-auto">
        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-6 transition-all">
          <div className="flex items-center gap-3 mb-2 text-primary">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">{featuresData[active].icon}</span>
            <h4 className="text-lg font-semibold">{featuresData[active].title}</h4>
          </div>
          <p className="text-muted-foreground">{featuresData[active].desc}</p>
        </div>
      </div>
    </div>
  );
};

export default WhyCommandless;


