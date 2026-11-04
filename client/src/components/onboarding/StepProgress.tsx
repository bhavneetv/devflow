import React from 'react';
import { motion } from 'framer-motion';

interface StepProgressProps {
  currentStep: number;
  totalSteps?: number;
  accentColor: string;
}

export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  totalSteps = 5,
  accentColor,
}) => {
  return (
    <div className="w-full flex flex-col gap-1.5 select-none" aria-label={`Step progress: Step ${currentStep} of ${totalSteps}`}>
      {/* Visual step segments */}
      <div className="flex items-center gap-1.5 w-full">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;

          return (
            <div
              key={stepNumber}
              className="relative h-1 flex-1 rounded-full overflow-hidden bg-white/[0.08]"
            >
              {isCompleted && (
                <div
                  className="absolute inset-0 rounded-full transition-colors duration-300"
                  style={{ backgroundColor: accentColor }}
                />
              )}
              {isActive && (
                <motion.div
                  layoutId="active-progress-segment"
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: accentColor }}
                  initial={{ scaleX: 0, originX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Accessible step label */}
      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-0.5">
        <span>
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          {currentStep === 1 && 'Profile'}
          {currentStep === 2 && 'Role'}
          {currentStep === 3 && 'Goals'}
          {currentStep === 4 && 'Workspace'}
          {currentStep === 5 && 'Create Team'}
        </span>
      </div>
    </div>
  );
};
