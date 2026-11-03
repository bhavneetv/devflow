import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WordItem {
  text: string;
  isHighlight: boolean;
}

interface Sentence {
  words: WordItem[];
}

// Predefined pools of paired lengthy sentences
const INTRO_POOLS: Sentence[][] = [
  // Pair A
  [
    {
      words: [
        { text: 'Hi,', isHighlight: false },
        { text: 'welcome', isHighlight: false },
        { text: 'to', isHighlight: false },
        { text: 'DevFlow,', isHighlight: true },
        { text: 'the', isHighlight: false },
        { text: 'software', isHighlight: false },
        { text: 'delivery', isHighlight: false },
        { text: 'platform', isHighlight: false },
        { text: 'engineered', isHighlight: false },
        { text: 'for', isHighlight: false },
        { text: 'modern', isHighlight: false },
        { text: 'teams.', isHighlight: true },
      ],
    },
    {
      words: [
        { text: 'Preparing', isHighlight: false },
        { text: 'your', isHighlight: false },
        { text: 'personalized', isHighlight: true },
        { text: 'workspace,', isHighlight: true },
        { text: 'sprint', isHighlight: false },
        { text: 'telemetry,', isHighlight: false },
        { text: 'and', isHighlight: false },
        { text: 'pipeline', isHighlight: false },
        { text: 'integrations.', isHighlight: true },
      ],
    },
  ],

  // Pair B
  [
    {
      words: [
        { text: 'Step', isHighlight: false },
        { text: 'into', isHighlight: false },
        { text: 'DevFlow,', isHighlight: true },
        { text: 'where', isHighlight: false },
        { text: 'high-velocity', isHighlight: false },
        { text: 'engineering', isHighlight: false },
        { text: 'meets', isHighlight: false },
        { text: 'seamless', isHighlight: true },
        { text: 'collaboration.', isHighlight: true },
      ],
    },
    {
      words: [
        { text: 'Crafting', isHighlight: false },
        { text: 'your', isHighlight: false },
        { text: 'developer', isHighlight: true },
        { text: 'identity,', isHighlight: true },
        { text: 'issue', isHighlight: false },
        { text: 'cadence,', isHighlight: false },
        { text: 'and', isHighlight: false },
        { text: 'modular', isHighlight: false },
        { text: 'architecture.', isHighlight: true },
      ],
    },
  ],

  // Pair C
  [
    {
      words: [
        { text: 'Welcome', isHighlight: false },
        { text: 'to', isHighlight: false },
        { text: 'DevFlow,', isHighlight: true },
        { text: 'built', isHighlight: false },
        { text: 'to', isHighlight: false },
        { text: 'streamline', isHighlight: false },
        { text: 'every', isHighlight: false },
        { text: 'commit', isHighlight: true },
        { text: 'and', isHighlight: false },
        { text: 'release', isHighlight: true },
        { text: 'cycle.', isHighlight: true },
      ],
    },
    {
      words: [
        { text: 'Initializing', isHighlight: false },
        { text: 'intelligent', isHighlight: false },
        { text: 'sprint', isHighlight: true },
        { text: 'boards', isHighlight: true },
        { text: 'and', isHighlight: false },
        { text: 'collaboration', isHighlight: false },
        { text: 'pipelines.', isHighlight: true },
      ],
    },
  ],

  // Pair D
  [
    {
      words: [
        { text: 'Elevate', isHighlight: false },
        { text: 'your', isHighlight: false },
        { text: 'craft', isHighlight: false },
        { text: 'with', isHighlight: false },
        { text: 'DevFlow,', isHighlight: true },
        { text: 'the', isHighlight: false },
        { text: 'command', isHighlight: false },
        { text: 'center', isHighlight: false },
        { text: 'for', isHighlight: false },
        { text: 'ambitious', isHighlight: true },
        { text: 'builders.', isHighlight: true },
      ],
    },
    {
      words: [
        { text: 'Configuring', isHighlight: false },
        { text: 'your', isHighlight: false },
        { text: 'developer', isHighlight: true },
        { text: 'passport', isHighlight: true },
        { text: 'and', isHighlight: false },
        { text: 'team', isHighlight: false },
        { text: 'ecosystem.', isHighlight: true },
      ],
    },
  ],
];

const OUTRO_POOLS: Sentence[][] = [
  // Pair A
  [
    {
      words: [
        { text: 'Synchronizing', isHighlight: false },
        { text: 'your', isHighlight: false },
        { text: 'team', isHighlight: true },
        { text: 'preferences,', isHighlight: true },
        { text: 'milestones,', isHighlight: false },
        { text: 'and', isHighlight: false },
        { text: 'workspace', isHighlight: true },
        { text: 'infrastructure.', isHighlight: true },
      ],
    },
    {
      words: [
        { text: 'Your', isHighlight: false },
        { text: 'environment', isHighlight: false },
        { text: 'is', isHighlight: false },
        { text: 'calibrated.', isHighlight: true },
        { text: 'Welcome', isHighlight: false },
        { text: 'to', isHighlight: false },
        { text: 'DevFlow.', isHighlight: true },
      ],
    },
  ],

  // Pair B
  [
    {
      words: [
        { text: 'Deploying', isHighlight: false },
        { text: 'project', isHighlight: false },
        { text: 'configurations', isHighlight: true },
        { text: 'and', isHighlight: false },
        { text: 'connecting', isHighlight: false },
        { text: 'your', isHighlight: false },
        { text: 'developer', isHighlight: true },
        { text: 'flow', isHighlight: true },
        { text: 'state.', isHighlight: true },
      ],
    },
    {
      words: [
        { text: 'All', isHighlight: false },
        { text: 'workspace', isHighlight: false },
        { text: 'systems', isHighlight: false },
        { text: 'ready.', isHighlight: true },
        { text: 'Launching', isHighlight: false },
        { text: 'into', isHighlight: false },
        { text: 'DevFlow.', isHighlight: true },
      ],
    },
  ],
];

interface CinematicTextIntroProps {
  mode?: 'intro' | 'outro';
  onComplete: () => void;
}

export const CinematicTextIntro: React.FC<CinematicTextIntroProps> = ({
  mode = 'intro',
  onComplete,
}) => {
  // Randomly select one predefined pair of 2 sentences so each reload is unique
  const sentences = useMemo(() => {
    const pools = mode === 'intro' ? INTRO_POOLS : OUTRO_POOLS;
    const randomIndex = Math.floor(Math.random() * pools.length);
    return pools[randomIndex];
  }, [mode]);

  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const [isSentenceExiting, setIsSentenceExiting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const currentSentence = sentences[sentenceIndex];

  // Typewriter step: reveal words one-by-one with blur effect (~130ms between words)
  useEffect(() => {
    setVisibleWordCount(0);
    const interval = setInterval(() => {
      setVisibleWordCount((prev) => {
        if (prev < currentSentence.words.length) {
          return prev + 1;
        }
        clearInterval(interval);
        return prev;
      });
    }, 220);

    return () => clearInterval(interval);
  }, [sentenceIndex, currentSentence.words.length]);

  // Continuous sentence lifecycle: 3.6s per sentence
  // Continuous zoom-in operates non-stop throughout the 3.6s duration
  useEffect(() => {
    setIsSentenceExiting(false);

    // At 3.0s: initiate blur removal while continuously zooming in
    const exitTimer = setTimeout(() => {
      setIsSentenceExiting(true);
    }, 3000);

    // At 3.6s: advance to next sentence or complete sequence
    const nextTimer = setTimeout(() => {
      if (sentenceIndex < 1) {
        setSentenceIndex(1);
      } else {
        // Last sentence complete: dissolve entire overlay so question card can zoom out
        setIsFinishing(true);
        setTimeout(onComplete, 500);
      }
    }, 3600);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(nextTimer);
    };
  }, [sentenceIndex, onComplete]);

  // Allow clicking anywhere or pressing Escape / Space / Enter to skip instantly
  const handleQuickSkip = () => {
    setIsFinishing(true);
    setTimeout(onComplete, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        handleQuickSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{
        opacity: isFinishing ? 0 : 1,
        filter: isFinishing ? 'blur(22px)' : 'blur(0px)',
      }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      onClick={handleQuickSkip}
      className="fixed inset-0 z-[9999] bg-[#08090B] flex flex-col items-center justify-center p-6 sm:p-12 cursor-pointer select-none"
    >
      {/* Ambient subtle backdrop glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-violet-600/[0.07] blur-3xl pointer-events-none" />

      {/* Main Centered Cinematic Container with CONTINUOUS ZOOM IN until next sentence starts */}
      <div className="relative z-10 w-full max-w-4xl flex items-center justify-center px-4 min-h-[160px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={sentenceIndex}
            initial={{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
            animate={{
              opacity: isSentenceExiting ? 0 : 1,
              scale: isSentenceExiting ? 1.10 : 1.05,
              filter: isSentenceExiting ? 'blur(20px)' : 'blur(0px)',
            }}
            transition={{
              scale: { duration: 3.6, ease: 'linear' },
              opacity: { duration: 0.48, ease: [0.16, 1, 0.3, 1] },
              filter: { duration: 0.48, ease: [0.16, 1, 0.3, 1] },
            }}
            className="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2.5 text-center font-sans tracking-tight text-2xl sm:text-4xl md:text-5xl font-medium leading-snug"
          >
            {/* All words are rendered in place so earlier words never shift or jump */}
            {currentSentence.words.map((word, wIdx) => {
              const isVisible = wIdx < visibleWordCount;
              return (
                <motion.span
                  key={`${sentenceIndex}-${wIdx}`}
                  initial={false}
                  animate={{
                    opacity: isVisible ? 1 : 0,
                    filter: isVisible ? 'blur(0px)' : 'blur(16px)',
                    y: isVisible ? 0 : 4,
                  }}
                  transition={{
                    duration: 0.62,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={`inline-block ${
                    word.isHighlight
                      ? 'text-white font-bold drop-shadow-[0_0_24px_rgba(255,255,255,0.28)]'
                      : 'text-zinc-500 font-medium'
                  }`}
                >
                  {word.text}
                </motion.span>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Subtle indicator dots (2 sentences) */}
      <div className="absolute bottom-8 flex items-center gap-2 pointer-events-none">
        {sentences.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === sentenceIndex
                ? 'w-6 bg-white'
                : i < sentenceIndex
                ? 'w-2 bg-zinc-600'
                : 'w-2 bg-zinc-800'
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
};
