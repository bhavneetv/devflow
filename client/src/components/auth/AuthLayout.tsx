import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { DevFlowLogo } from './DevFlowLogo';

interface AuthLayoutProps {
  children: React.ReactNode;
  rightVisual: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, rightVisual }) => {
  // Lock body scroll while on authentication screen
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#08090C] flex items-center justify-center p-3 sm:p-5 overflow-hidden select-none font-sans">
      {/* Centered Large Rounded Rectangular Container (630px height, zero scroll) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.99, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[1080px] h-[630px] max-h-[94vh] rounded-3xl bg-[#0C0D12] border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col lg:flex-row"
      >
        {/* Left Panel: 48% width on desktop, form centered, zero scroll */}
        <div className="w-full lg:w-[48%] bg-[#0C0D12] flex flex-col justify-between p-7 lg:p-9 relative z-20 overflow-hidden">
          {/* Top Bar: DevFlow Logo */}
          <div className="flex items-center justify-start w-full">
            <DevFlowLogo size="md" />
          </div>

          {/* Form Area Centered */}
          <div className="my-auto py-1 flex items-center justify-center w-full">
            {children}
          </div>

          {/* Spacer */}
          <div className="h-1" />
        </div>

        {/* Right Panel: 52% width on desktop, 1px faint divider line, hidden below 1024px */}
        <div className="hidden lg:flex w-full lg:w-[52%] bg-[#0C0D12] border-l border-white/[0.06] relative overflow-hidden">
          {rightVisual}
        </div>
      </motion.div>
    </div>
  );
};
