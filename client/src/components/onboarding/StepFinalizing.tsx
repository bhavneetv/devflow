import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { OnboardingData } from '../../types/onboarding';

interface StepFinalizingProps {
  data: OnboardingData;
  onComplete: () => void;
  onSubmit: () => Promise<{ success: boolean; error?: string }>;
}

export const StepFinalizing: React.FC<StepFinalizingProps> = ({
  data,
  onComplete,
  onSubmit,
}) => {
  const [status, setStatus] = useState<'saving' | 'animating' | 'done' | 'error'>('saving');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const firstName = data.displayName?.trim().split(' ')[0] || 'Developer';
  const accent = data.accentColor || '#A78BFA';

  useEffect(() => {
    let isMounted = true;

    const executeWorkflow = async () => {
      setStatus('saving');
      try {
        const result = await onSubmit();
        if (!isMounted) return;

        if (result.success) {
          setStatus('animating');
          // Allow animation sequence to play cleanly (~2 seconds)
          setTimeout(() => {
            if (isMounted) {
              setStatus('done');
              setTimeout(() => {
                if (isMounted) onComplete();
              }, 600);
            }
          }, 2100);
        } else {
          setStatus('error');
          setErrorMessage(result.error || 'Failed to initialize workspace.');
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'Network connection interrupted.');
        }
      }
    };

    executeWorkflow();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRetry = async () => {
    setStatus('saving');
    setErrorMessage(null);
    try {
      const result = await onSubmit();
      if (result.success) {
        setStatus('animating');
        setTimeout(() => {
          setStatus('done');
          setTimeout(() => {
            onComplete();
          }, 600);
        }, 2000);
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Failed to initialize workspace.');
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Network error.');
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center text-center py-4 select-none relative">
      {/* Step Heading */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-[22px] sm:text-[25px] font-semibold text-white tracking-tight leading-snug">
          You're all set, {firstName}.
        </h1>
        <p className="mt-1 text-[13px] text-zinc-400">
          {status === 'error'
            ? 'Something interrupted workspace creation.'
            : status === 'done'
            ? 'Workspace ready! Launching DevFlow...'
            : 'Preparing your development environment...'}
        </p>
      </motion.div>

      {/* Development Flow Animation Canvas */}
      <div className="relative w-full max-w-[340px] h-[210px] my-3 flex items-center justify-center">
        {status !== 'error' ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* SVG Flow Pipeline */}
            <svg
              className="absolute inset-0 w-full h-full overflow-visible"
              viewBox="0 0 340 210"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Branch Path 1: Central to Top-Right (Task Node) */}
              <motion.path
                d="M 170 105 C 170 70, 240 50, 270 50"
                stroke={accent}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="4 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.7 }}
                transition={{ duration: 0.9, delay: 0.2, ease: 'easeInOut' }}
              />

              {/* Branch Path 2: Central to Bottom-Left (Repo / Commit Node) */}
              <motion.path
                d="M 170 105 C 170 140, 100 160, 70 160"
                stroke={accent}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="4 4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.7 }}
                transition={{ duration: 0.9, delay: 0.4, ease: 'easeInOut' }}
              />

              {/* Branch Path 3: Central to Bottom-Right (Deploy Node) */}
              <motion.path
                d="M 170 105 C 200 130, 240 145, 275 145"
                stroke={accent}
                strokeWidth="2"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.9 }}
                transition={{ duration: 0.9, delay: 0.6, ease: 'easeInOut' }}
              />

              {/* Central Origin Node */}
              <circle cx="170" cy="105" r="16" fill="#17181D" stroke={accent} strokeWidth="2.5" />
              <circle cx="170" cy="105" r="6" fill={accent} />

              {/* Illuminated Node 1: Top-Right (Task) */}
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.4 }}
              >
                <circle cx="270" cy="50" r="12" fill="#17181D" stroke={accent} strokeWidth="2" />
                <circle cx="270" cy="50" r="4" fill="#4ADE80" />
              </motion.g>

              {/* Illuminated Node 2: Bottom-Left (Commit) */}
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.4 }}
              >
                <circle cx="70" cy="160" r="12" fill="#17181D" stroke={accent} strokeWidth="2" />
                <circle cx="70" cy="160" r="4" fill="#38BDF8" />
              </motion.g>

              {/* Illuminated Node 3: Bottom-Right (Deploy) */}
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.4 }}
              >
                <circle cx="275" cy="145" r="12" fill="#17181D" stroke={accent} strokeWidth="2" />
                <circle cx="275" cy="145" r="4" fill={accent} />
              </motion.g>

              {/* Pulse Wave Traveling through Central Node */}
              <motion.circle
                cx="170"
                cy="105"
                r="16"
                stroke={accent}
                strokeWidth="2"
                fill="none"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2.8, opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut' }}
              />
            </svg>

            {/* Micro Floating Developer Cards */}
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="absolute top-2 right-1 px-2.5 py-1 rounded-md bg-[#17181D] border border-white/[0.08] text-[10px] font-mono text-zinc-300 shadow-xl"
            >
              <span>task.dispatch()</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 1.0, duration: 0.4 }}
              className="absolute bottom-2 left-1 px-2.5 py-1 rounded-md bg-[#17181D] border border-white/[0.08] text-[10px] font-mono text-zinc-300 shadow-xl"
            >
              <span>commit: 8f4e2a</span>
            </motion.div>
          </div>
        ) : (
          /* Error State */
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-red-500/10 border border-red-500/20 max-w-[280px]">
            <AlertCircle size={24} className="text-red-400 mb-1" />
            <p className="text-[12px] text-red-300 mb-2">{errorMessage}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/[0.08] hover:bg-white/[0.12] text-white text-[11.5px] font-medium transition-colors"
            >
              <RefreshCw size={12} />
              <span>Retry setup</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Status / Checkmark Indicator */}
      {status !== 'error' && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-[12px] font-mono text-zinc-400"
        >
          {status === 'done' ? (
            <div className="flex items-center gap-1.5 text-[#4ADE80] animate-in fade-in">
              <CheckCircle2 size={14} />
              <span>Workspace configured successfully</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full animate-ping"
                style={{ backgroundColor: accent }}
              />
              <span>Connecting repositories & sprint pipelines...</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
