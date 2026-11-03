import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { DevFlowLogo } from '../auth/DevFlowLogo';
import { StepProgress } from './StepProgress';
import { ProfilePreview } from './ProfilePreview';
import { OnboardingData } from '../../types/onboarding';

interface OnboardingLayoutProps {
  currentStep: number;
  totalSteps?: number;
  data: OnboardingData;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  isNextLoading?: boolean;
  canSkip?: boolean;
  isExiting?: boolean;
  children: React.ReactNode;
}

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  currentStep,
  totalSteps = 4,
  data,
  onNext,
  onBack,
  onSkip,
  isNextLoading = false,
  canSkip = false,
  isExiting = false,
  children,
}) => {
  const accent = data.accentColor || '#8B5CF6';
  const isFirstStep = currentStep === 1;
  const isStep4 = currentStep === 4;

  // Track viewport width responsively so mobile viewports (< 768px) never get collapsed to 50%
  const [isDesktop, setIsDesktop] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });

  React.useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(e.matches);
    };
    setIsDesktop(mql.matches);
    try {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    } catch {
      mql.addListener(onChange);
      return () => mql.removeListener(onChange);
    }
  }, []);

  // Magical color wave transition originating directly from the clicked accent circle
  const windowRef = React.useRef<HTMLDivElement>(null);
  const [colorWave, setColorWave] = React.useState<{
    id: number;
    color: string;
    originX: number;
    originY: number;
  } | null>(null);

  React.useEffect(() => {
    const handleWave = (e: Event) => {
      const customEvent = e as CustomEvent<{ color: string; x: number; y: number }>;
      if (windowRef.current && customEvent.detail) {
        const rect = windowRef.current.getBoundingClientRect();
        const originX = customEvent.detail.x - rect.left;
        const originY = customEvent.detail.y - rect.top;
        setColorWave({
          id: Date.now(),
          color: customEvent.detail.color,
          originX,
          originY,
        });
        setTimeout(() => {
          setColorWave(null);
        }, 1100);
      }
    };
    window.addEventListener('accent-color-wave', handleWave);
    return () => window.removeEventListener('accent-color-wave', handleWave);
  }, []);

  return (
    <>
      {/* Permanent deep background canvas to prevent any backdrop flicker */}
      <div className="fixed inset-0 bg-[#08090B] -z-10 pointer-events-none" />

      {/* Cinematic Page Entrance & Exit Fade Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: isExiting ? 0 : 1, scale: isExiting ? 0.985 : 1 }}
        transition={{ duration: isExiting ? 0.45 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-screen w-full bg-[#08090B] flex items-center justify-center p-2.5 sm:p-6 text-zinc-100 font-sans relative overflow-hidden"
      >
        {/* Main Centered Window:
            At start: Slow cinematic zoom-out from scale 1.09 -> 1.0 with blur dissolve (1.25s duration)
            At end: Zoom-in to scale 1.09 with blur fade-out
        */}
        <motion.div
          ref={windowRef}
          initial={{ scale: 1.09, opacity: 0, filter: 'blur(16px)' }}
          animate={{
            scale: isExiting ? 1.09 : 1,
            opacity: isExiting ? 0 : 1,
            filter: isExiting ? 'blur(16px)' : 'blur(0px)',
          }}
          transition={{ duration: isExiting ? 0.65 : 1.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[1160px] min-h-[620px] h-full md:h-[720px] max-h-[96vh] md:max-h-[92vh] rounded-2xl sm:rounded-3xl border border-[#27272A] bg-[#0C0D10] shadow-2xl flex flex-row overflow-hidden relative"
        >
          {/* Magical Accent Color Wave Transition:
              Originates directly at the center of the selected circle and sweeps across to the right side of the window
          */}
          <AnimatePresence>
            {colorWave && (
              <motion.div
                key={colorWave.id}
                initial={{
                  scale: 0.05,
                  opacity: 0.85,
                  x: '-50%',
                  y: '-50%',
                  left: colorWave.originX,
                  top: colorWave.originY,
                }}
                animate={{
                  scale: [0.05, 2.4, 4.8],
                  opacity: [0.85, 0.45, 0],
                  left: [colorWave.originX, colorWave.originX + 280, colorWave.originX + 580],
                  top: [colorWave.originY, colorWave.originY - 60, colorWave.originY - 140],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
                className="absolute w-[340px] h-[340px] rounded-full pointer-events-none blur-3xl z-20"
                style={{
                  background: `radial-gradient(circle, ${colorWave.color} 0%, ${colorWave.color}66 35%, transparent 70%)`,
                }}
              />
            )}
          </AnimatePresence>
          
          {/* MAIN FORM PANEL:
              On desktop: Smoothly expands width from 50% to 100%
              On mobile (< 768px): Always 100% full width so inputs and tabs are never squished
          */}
          <motion.div
            animate={{
              width: isFirstStep && isDesktop ? '50%' : '100%',
            }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="h-full w-full flex flex-col justify-between p-4 sm:p-8 relative z-10 overflow-y-auto md:overflow-visible bg-[#0C0D10] shrink-0"
          >
            {/* Top Header: Logo & Onboarding Badge */}
            <motion.div
              animate={{ maxWidth: isDesktop ? (isFirstStep ? 460 : 960) : '100%' }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="w-full mx-auto flex flex-col gap-4 shrink-0"
            >
              <div className="flex items-center justify-between">
                <DevFlowLogo />
                <div className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
                  Onboarding
                </div>
              </div>

              {/* Step Progress Segments */}
              <StepProgress
                currentStep={currentStep}
                totalSteps={totalSteps}
                accentColor={accent}
              />
            </motion.div>

            {/* Center Form Container (overflow-visible with horizontal clearance so selection rings are never clipped) */}
            <motion.div
              animate={{ maxWidth: isDesktop ? (isFirstStep ? 460 : 960) : '100%' }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="w-full mx-auto my-auto py-2 px-2.5 sm:px-3 flex-1 min-h-0 flex flex-col justify-center overflow-visible"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.99 }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full overflow-visible"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* Bottom Navigation Buttons */}
            <motion.div
              animate={{ maxWidth: isDesktop ? (isFirstStep ? 460 : 960) : '100%' }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              className="w-full mx-auto pt-3 border-t border-white/[0.06] flex items-center justify-between shrink-0"
            >
              {/* Back Button (Hidden on Step 1) */}
              <div>
                {!isFirstStep && (
                  <motion.button
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.04] text-[12px] font-medium transition-colors focus:outline-none"
                  >
                    <ArrowLeft size={13} />
                    <span>Back</span>
                  </motion.button>
                )}
              </div>

              {/* Action Buttons: Skip for now & Compact Sleek Continue Button */}
              <div className="flex items-center gap-2.5">
                {canSkip && onSkip && (
                  <button
                    type="button"
                    onClick={onSkip}
                    className="px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 text-[12px] font-medium transition-colors hover:underline focus:outline-none"
                  >
                    Skip for now
                  </button>
                )}

                {/* Compact, sleek Continue Button */}
                <button
                  type="button"
                  id="onboarding-continue-btn"
                  onClick={onNext}
                  disabled={isNextLoading}
                  className="group relative h-9 px-4 rounded-lg font-medium text-[12.5px] text-[#0A0B10] flex items-center justify-center gap-1.5 transition-all duration-200 hover:brightness-110 active:scale-[0.98] shadow-md focus:outline-none disabled:opacity-75 min-w-[104px]"
                  style={{
                    backgroundColor: accent,
                    boxShadow: `0 3px 14px ${accent}30`,
                  }}
                >
                  {isNextLoading ? (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#0A0B10]">
                      <Loader2 size={13} className="animate-spin text-[#0A0B10]" />
                      <span>{isStep4 ? 'Finalizing...' : 'Checking...'}</span>
                    </div>
                  ) : isStep4 ? (
                    <>
                      <span>Finish setup</span>
                      <Sparkles size={13} className="group-hover:rotate-12 transition-transform duration-200" />
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight
                        size={13.5}
                        strokeWidth={2.5}
                        className="group-hover:translate-x-0.5 transition-transform duration-200"
                      />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>

          {/* RIGHT PANEL:
              Positioned absolute in the right half on Step 1.
              When transitioning to Step 2, fades out cleanly with blur and slide into the dark background.
          */}
          <AnimatePresence>
            {isFirstStep && (
              <motion.div
                key="profile-preview-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 35, filter: 'blur(5px)' }}
                transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                className="hidden md:block absolute right-0 top-0 bottom-0 w-1/2 h-full overflow-hidden border-l border-white/[0.06] bg-[#101116] z-0 pointer-events-auto"
              >
                <ProfilePreview data={data} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
};
