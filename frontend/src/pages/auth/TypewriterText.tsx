import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface TypewriterTextProps {
  text: string;
  delay?: number;
  speed?: number;
}

const TypewriterText = ({ text, delay = 0, speed = 50 }: TypewriterTextProps) => {
  const [displayText, setDisplayText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
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
  }, [text, delay, speed]);

  return (
    <span className="relative">
      {displayText}
      {showCursor && (
        <motion.span
          className="inline-block w-0.5 h-5 bg-blue-400 ml-1"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
    </span>
  );
};

export default TypewriterText;
