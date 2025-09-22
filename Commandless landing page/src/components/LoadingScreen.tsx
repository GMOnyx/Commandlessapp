import { useState, useEffect } from "react";
import commandlessLogo from "@/assets/commandless-2.svg";

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

const LoadingScreen = ({ onLoadingComplete }: LoadingScreenProps) => {
  const [slashProgress, setSlashProgress] = useState(0);

  useEffect(() => {
    const duration = 2500; // 2.5 seconds
    const startTime = Date.now();

    const animateSlash = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      setSlashProgress(progress);

      if (progress < 1) {
        requestAnimationFrame(animateSlash);
      } else {
        // Wait a bit after animation completes, then fade out
        setTimeout(() => {
          onLoadingComplete();
        }, 300);
      }
    };

    requestAnimationFrame(animateSlash);
  }, [onLoadingComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="relative">
        {/* Logo */}
        <img 
          src={commandlessLogo} 
          alt="Commandless" 
          className="w-32 h-32 md:w-40 md:h-40"
        />
        
        {/* Animated slash overlay */}
        <div 
          className="absolute inset-0 bg-background"
          style={{
            clipPath: `polygon(0 0, ${slashProgress * 100}% 0, ${(slashProgress * 100) + 20}% 100%, 0% 100%)`,
            transition: slashProgress === 0 ? 'none' : 'clip-path 0.1s ease-out'
          }}
        />
        
        {/* Slash line effect */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: `linear-gradient(135deg, transparent ${slashProgress * 100 - 2}%, hsl(var(--primary)) ${slashProgress * 100}%, hsl(var(--primary)) ${slashProgress * 100 + 2}%, transparent ${slashProgress * 100 + 4}%)`,
          }}
        />
      </div>
    </div>
  );
};

export default LoadingScreen;