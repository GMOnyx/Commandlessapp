import Index from "@landing/pages/Index";
import BackgroundPools from "@landing/components/BackgroundPools";
import Footer from "@landing/components/Footer";
import "../../../Commandless landing page 2/src/index.css";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <BackgroundPools />
      <main className="flex-1">
        <Index />
      </main>
      <Footer />
    </div>
  );
}


