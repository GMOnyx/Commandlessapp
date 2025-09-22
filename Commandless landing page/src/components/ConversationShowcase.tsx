import { Bot, ChevronRight, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type ScriptLine = {
  role: Role;
  text: string;
};

const Avatar = ({ role }: { role: Role }) => (
  <div
    className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full border ${
      role === "user" ? "bg-primary text-white border-primary" : "bg-muted text-foreground"
    }`}
  >
    {role === "user" ? "U" : <Bot className="w-4 h-4" />}
  </div>
);

const TypingDots = () => (
  <div className="flex items-center gap-1">
    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" />
    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0.15s" }} />
    <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0.3s" }} />
  </div>
);

const Row = ({ role, children }: { role: Role; children: React.ReactNode }) => (
  <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} items-start gap-3`}>
    {role === "assistant" && <Avatar role={role} />}
    <div
      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm md:text-base shadow-sm border animate-in fade-in slide-in-from-bottom-2 ${
        role === "user" ? "bg-primary text-white border-primary" : "bg-background text-foreground"
      }`}
    >
      {children}
    </div>
    {role === "user" && <Avatar role={role} />}
  </div>
);

const ConversationShowcase = () => {
  const script: ScriptLine[] = [
    { role: "user", text: "Can you timeout @alex for 10 minutes? He keeps spamming." },
    { role: "assistant", text: "I can do that. Do you want me to explain the reason publicly?" },
    { role: "user", text: "Yes, say it's for spam and link the rules." },
    { role: "assistant", text: "Done. Timeout applied, message posted in #general with the rules link." },
  ];

  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  // Start the animation sequence only when the section enters the viewport
  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    if (visibleCount >= script.length) {
      setShowTyping(false);
      return;
    }

    // show typing before assistant messages
    const current = script[visibleCount];
    if (current.role === "assistant") {
      setShowTyping(true);
      const typingTimer = setTimeout(() => {
        setShowTyping(false);
        setVisibleCount((c) => c + 1);
      }, 900);
      return () => clearTimeout(typingTimer);
    }

    const timer = setTimeout(() => setVisibleCount((c) => c + 1), 700);
    return () => clearTimeout(timer);
  }, [visibleCount, hasStarted]);

  return (
    <section ref={sectionRef} className="py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">See It Converse</h2>
          <p className="text-muted-foreground mt-3">A quick, realistic interaction—no commands required.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto items-start">
          <div className="rounded-xl border border-border bg-background/60 p-5 md:p-6 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-4">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs">Live conversation preview</span>
            </div>
            <div className="space-y-3">
              {script.slice(0, visibleCount).map((m, i) => (
                <Row key={i} role={m.role}>{m.text}</Row>
              ))}
              {showTyping && (
                <div className="flex items-center gap-3">
                  <Avatar role="assistant" />
                  <div className="rounded-2xl border bg-background px-4 py-3">
                    <TypingDots />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground pt-2">
                <ChevronRight className="w-3 h-3" />
                <span>Natural language → mapped to your bot commands automatically</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border p-6 bg-background/60 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <Bot className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">What happened behind the scenes</span>
            </div>
            <ul className="text-sm md:text-base space-y-3 text-muted-foreground">
              <li>• Parsed user intent: timeout member</li>
              <li>• Resolved entity: @alex</li>
              <li>• Parameters: duration=10m, reason=spam</li>
              <li>• Executed bot command: <span className="text-foreground">/timeout alex 10m --reason spam</span></li>
              <li>• Posted contextual explanation in channel</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ConversationShowcase;


