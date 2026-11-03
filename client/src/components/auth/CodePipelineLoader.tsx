import React from 'react';

export const CodePipelineLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center gap-2.5 text-white select-none">
      {/* Sleek dual-track orbital spinner */}
      <div className="relative flex items-center justify-center w-[16px] h-[16px]">
        {/* Base faint ring */}
        <div className="w-full h-full rounded-full border-[2px] border-white/25" />
        {/* Spinning glowing active arc */}
        <div className="absolute inset-0 w-full h-full rounded-full border-[2px] border-transparent border-t-white animate-spin" />
      </div>

      {/* Clean text */}
      <span className="font-medium text-[13.5px] text-white tracking-tight">
        Authenticating…
      </span>
    </div>
  );
};
