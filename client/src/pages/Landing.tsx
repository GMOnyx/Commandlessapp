import Hero from "@/landing/Hero";
import WhyCommandless from "@/landing/WhyCommandless";
import ConversationShowcase from "@/landing/ConversationShowcase";
import BackgroundPools from "@/landing/BackgroundPools";
import Footer from "@/landing/Footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <BackgroundPools />
      <Hero />
      <WhyCommandless />
      <ConversationShowcase />
      <Footer />
    </div>
  );
}


