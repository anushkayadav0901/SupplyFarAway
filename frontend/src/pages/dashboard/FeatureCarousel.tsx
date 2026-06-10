// FeatureCarousel.tsx - Fixed version without overlapping
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TargetAndTransition } from "framer-motion";

interface Feature {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  bgAccent: string;
  borderColor: string;
}

interface FeatureCarouselProps {
  features: Feature[];
}

type CardPosition = "left" | "center" | "right" | "mobile";

interface VisibleCard {
  index: number;
  position: "left" | "center" | "right";
}

const FeatureCarousel: React.FC<FeatureCarouselProps> = ({ features }) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [direction, setDirection] = useState<number>(1); // 1 for forward, -1 for backward
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check for mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (!isPaused && features.length > 1) {
      intervalRef.current = setInterval(() => {
        setDirection(1);
        setCurrentIndex((prev) => (prev + 1) % features.length);
      }, 4000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, features.length]);

  // Handle manual navigation
  const goToSlide = (index: number): void => {
    if (index === currentIndex) return;

    const diff = index - currentIndex;
    const totalFeatures = features.length;

    // Determine shortest path (circular)
    let shortestDiff = diff;
    if (Math.abs(diff) > totalFeatures / 2) {
      shortestDiff = diff > 0 ? diff - totalFeatures : diff + totalFeatures;
    }

    setDirection(shortestDiff > 0 ? 1 : -1);
    setCurrentIndex(index);
  };

  // Get the visible cards with proper circular indexing
  const getVisibleCards = (): VisibleCard[] => {
    if (isMobile) {
      return [{ index: currentIndex, position: "center" }];
    }

    const total = features.length;
    const prevIndex = (currentIndex - 1 + total) % total;
    const nextIndex = (currentIndex + 1) % total;

    return [
      { index: prevIndex, position: "left" },
      { index: currentIndex, position: "center" },
      { index: nextIndex, position: "right" },
    ];
  };

  const visibleCards = getVisibleCards();

  // Animation variants for smooth transitions
  const cardVariants: Record<CardPosition, TargetAndTransition> = {
    left: {
      x: -160,
      scale: 0.85,
      opacity: 0.6,
      filter: "blur(2px)",
      zIndex: 10,
    },
    center: {
      x: 0,
      scale: 1,
      opacity: 1,
      filter: "blur(0px)",
      zIndex: 30,
    },
    right: {
      x: 160,
      scale: 0.85,
      opacity: 0.6,
      filter: "blur(2px)",
      zIndex: 10,
    },
    mobile: {
      x: 0,
      scale: 1,
      opacity: 1,
      filter: "blur(0px)",
      zIndex: 30,
    },
  };

  const transition = {
    duration: 0.7,
    ease: [0.25, 0.46, 0.45, 0.94],
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto px-4">
      {/* Carousel Window */}
      <div
        className="relative bg-white border border-gray-200 rounded-2xl p-8 md:p-12 shadow-sm overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >

        {/* Cards Container */}
        <div className="relative h-72 md:h-80 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <AnimatePresence mode="sync">
              {visibleCards.map((card) => {
                const isCenter = card.position === "center";
                const feature = features[card.index];

                return (
                  <motion.div
                    key={`${card.index}-${card.position}-${currentIndex}`}
                    className={`absolute ${
                      isMobile ? "w-full max-w-sm" : "w-80"
                    }`}
                    initial={false}
                    animate={
                      isMobile
                        ? cardVariants.mobile
                        : cardVariants[card.position]
                    }
                    transition={transition}
                    whileHover={
                      isCenter
                        ? {
                            scale: 1.02,
                            y: -4,
                            transition: {
                              duration: 0.2,
                              ease: [0.25, 0.46, 0.45, 0.94],
                            },
                          }
                        : undefined
                    }
                    style={{
                      pointerEvents: isCenter ? "auto" : "none",
                    }}
                  >
                    <div
                      className={`
                        h-64 md:h-72 rounded-xl p-6 md:p-8
                        bg-white border border-gray-100
                        shadow-sm transition-shadow duration-200
                        ${
                          isCenter
                            ? "cursor-pointer hover:shadow-md"
                            : ""
                        }
                      `}
                      onClick={() => isCenter && goToSlide(card.index)}
                    >
                      {/* Card Content */}
                      <div className="flex items-start gap-4 mb-6">
                        <div
                          className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100"
                        >
                          {feature.icon}
                        </div>
                        <div className="flex-1">
                          <h3
                            className={`font-bold text-gray-900 mb-2 ${
                              isMobile
                                ? "text-xl"
                                : isCenter
                                ? "text-2xl"
                                : "text-lg"
                            }`}
                          >
                            {feature.title}
                          </h3>
                        </div>
                      </div>

                      <p
                        className={`text-gray-700 leading-relaxed ${
                          isMobile
                            ? "text-base"
                            : isCenter
                            ? "text-base"
                            : "text-sm"
                        }`}
                      >
                        {feature.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Progress Indicators */}
        <div className="flex justify-center gap-2 mt-10">
          {features.map((_, index) => (
            <motion.button
              key={index}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === currentIndex ? "true" : undefined}
              className={`h-2 rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                index === currentIndex
                  ? "w-8 bg-blue-600"
                  : "w-2 bg-gray-300 hover:bg-gray-400"
              }`}
              whileTap={{ scale: 0.9 }}
            />
          ))}
        </div>

        {/* Navigation Arrows (Desktop Only) */}
        {!isMobile && features.length > 1 && (
          <>
            <motion.button
              onClick={() =>
                goToSlide(
                  (currentIndex - 1 + features.length) % features.length
                )
              }
              aria-label="Previous slide"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-200 hover:bg-gray-50 z-40 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              whileHover={{ scale: 1.02, x: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                className="w-5 h-5 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </motion.button>

            <motion.button
              onClick={() => goToSlide((currentIndex + 1) % features.length)}
              aria-label="Next slide"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:shadow-md transition-shadow duration-200 hover:bg-gray-50 z-40 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              whileHover={{ scale: 1.02, x: 2 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                className="w-5 h-5 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
};

export default FeatureCarousel;
