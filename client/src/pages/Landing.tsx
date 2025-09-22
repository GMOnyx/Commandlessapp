import Hero from "@/landing/Hero";
import WhyCommandless from "@/landing/WhyCommandless";
import ConversationShowcase from "@/landing/ConversationShowcase";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <WhyCommandless />
      <ConversationShowcase />
    </div>
  );
}


