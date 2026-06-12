import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface TypewriterTextProps {
  text: string;
  delay?: number;
  speed?: number;
}

const TypewriterText = ({ text, delay = 0, speed = 50 }: TypewriterTextProps) => {
  const prefersReducedMotion = useReducedMotion();
  const [displayText, setDisplayText] = useState(prefersReducedMotion ? text : "");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    // Reduced motion: snap to the final string immediately, no per-char timers.
    if (prefersReducedMotion) {
      setDisplayText(text);
      setShowCursor(false);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    setDisplayText("");
    setShowCursor(true);

    const delayTimer = setTimeout(() => {
      let i = 0;
      const typeWriter = () => {
        if (cancelled) return;
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1));
          i++;
          timers.push(setTimeout(typeWriter, speed));
        } else {
          timers.push(setTimeout(() => {
            if (!cancelled) setShowCursor(false);
          }, 500));
        }
      };
      typeWriter();
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(delayTimer);
      timers.forEach(clearTimeout);
    };
  }, [text, delay, speed, prefersReducedMotion]);

  return (
    <span className="relative" aria-label={text}>
      {displayText}
      {showCursor && !prefersReducedMotion && (
        <motion.span
          aria-hidden="true"
          className="inline-block w-0.5 h-5 bg-blue-400 ml-1"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </span>
  );
};

export default TypewriterText;
