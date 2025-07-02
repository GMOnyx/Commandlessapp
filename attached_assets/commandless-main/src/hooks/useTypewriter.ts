import { useState, useEffect, useCallback } from 'react';

interface UseTypewriterProps {
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  delayBetweenPhrases?: number;
}

const useTypewriter = ({
  phrases,
  typingSpeed = 100,
  deletingSpeed = 50,
  delayBetweenPhrases = 2000,
}: UseTypewriterProps) => {
  const [text, setText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);

  const type = useCallback(() => {
    const currentPhrase = phrases[phraseIndex];
    
    if (isDeleting) {
      setText(currentPhrase.substring(0, text.length - 1));
      
      if (text.length === 0) {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      }
    } else {
      setText(currentPhrase.substring(0, text.length + 1));
      
      if (text.length === currentPhrase.length) {
        setIsWaiting(true);
        setTimeout(() => {
          setIsWaiting(false);
          setIsDeleting(true);
        }, delayBetweenPhrases);
      }
    }
  }, [text, phraseIndex, isDeleting, phrases, delayBetweenPhrases]);

  useEffect(() => {
    if (isWaiting) return;
    
    const timeout = setTimeout(
      type,
      isDeleting ? deletingSpeed : typingSpeed
    );
    
    return () => clearTimeout(timeout);
  }, [type, isDeleting, deletingSpeed, typingSpeed, isWaiting]);

  return { text, isTyping: !isWaiting };
};

export default useTypewriter;