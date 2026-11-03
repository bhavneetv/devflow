import React from 'react';
import { CheckCircle2, GitBranch, GitCommit, ShieldCheck, Zap } from 'lucide-react';

export const DeveloperVisualization: React.FC = () => {
  return (
    <div className="relative w-full h-full flex flex-col justify-between p-7 lg:p-10 select-none overflow-hidden bg-[#0C0D12] text-left">
      {/* Background Subtle Radial Lighting (under 4%) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] bg-[#7C3AED]/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* Top Headline Section: What DevFlow Offers (v2.4 button removed) */}
      <div className="relative z-10 max-w-[460px]">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500 block mb-1.5">
          Software Development Lifecycle
        </span>

        <h2 className="text-[26px] lg:text-[30px] font-semibold text-white tracking-tight leading-[1.25]">
          Plan, collaborate, and release.
          <br />
          <span className="text-zinc-400 font-normal">All in one connected workspace.</span>
        </h2>

        <p className="mt-2 text-[12.5px] text-zinc-400 leading-relaxed">
          DevFlow unites real-time sprint tracking, Git branch workflows, and automated CI/CD deployments—helping engineering teams ship production-ready software faster.
        </p>

        {/* 3 Core Capability Highlights */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-zinc-300">
            <GitBranch size={11} className="text-[#A78BFA]" />
            <span>Git & Branch Sync</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-zinc-300">
            <Zap size={11} className="text-[#4ADE80]" />
            <span>Automated CI/CD</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-zinc-300">
            <ShieldCheck size={11} className="text-[#A78BFA]" />
            <span>Sprint Tracking</span>
          </span>
        </div>
      </div>

      {/* Centerpiece: Dark 3D Monolith & Orbital Pipeline */}
      <div className="relative z-10 my-auto py-2 flex items-center justify-center">
        <div className="relative w-full max-w-[400px] h-[250px] flex items-center justify-center">
          {/* Large embossed watermark in background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[90px] lg:text-[110px] font-black text-white/[0.025] tracking-tighter select-none font-mono">
              FLOW
            </span>
          </div>

          {/* SVG 3D Isometric Monolith & Orbital Ellipse */}
          <svg
            className="w-full h-full"
            viewBox="0 0 420 280"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Monolith Gradient */}
              <linearGradient id="columnFront" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1C1D26" />
                <stop offset="60%" stopColor="#14151E" />
                <stop offset="100%" stopColor="#0E0F15" />
              </linearGradient>

              <linearGradient id="columnTop" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2A2B38" />
                <stop offset="100%" stopColor="#1F202B" />
              </linearGradient>

              {/* Orbital Ring Gradient */}
              <linearGradient id="orbitGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.1" />
                <stop offset="50%" stopColor="#A78BFA" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.2" />
              </linearGradient>
            </defs>

            {/* Back half of the orbital ellipse (behind monolith) */}
            <path
              d="M 50 160 C 50 115, 370 115, 370 160"
              stroke="#2E303E"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Central 3D Dark Monolith Column */}
            <g id="monolith-column">
              {/* Left Face of column */}
              <path
                d="M 160 115 L 210 140 L 210 245 L 160 220 Z"
                fill="url(#columnFront)"
                stroke="#2B2D3B"
                strokeWidth="1"
              />
              {/* Right Face of column */}
              <path
                d="M 210 140 L 260 115 L 260 220 L 210 245 Z"
                fill="#12131B"
                stroke="#2B2D3B"
                strokeWidth="1"
              />
              {/* Top Isometric Face */}
              <path
                d="M 210 90 L 260 115 L 210 140 L 160 115 Z"
                fill="url(#columnTop)"
                stroke="#3F4154"
                strokeWidth="1.2"
              />

              {/* Top Face Wireframe Accent Vertices */}
              <circle cx="210" cy="90" r="2.5" fill="#A78BFA" />
              <circle cx="260" cy="115" r="2.5" fill="#A78BFA" />
              <circle cx="210" cy="140" r="2.5" fill="#A78BFA" />
              <circle cx="160" cy="115" r="2.5" fill="#A78BFA" />

              {/* Center Monolith Node Light */}
              <circle cx="210" cy="115" r="3.5" fill="#4ADE80" className="animate-pulse" />

              {/* Isometric grid lines on top face */}
              <line x1="210" y1="90" x2="210" y2="140" stroke="#3F4154" strokeWidth="0.8" strokeDasharray="2 2" />
              <line x1="160" y1="115" x2="260" y2="115" stroke="#3F4154" strokeWidth="0.8" strokeDasharray="2 2" />
            </g>

            {/* Front half of the orbital ellipse (in front of monolith) */}
            <path
              d="M 370 160 C 370 205, 50 205, 50 160"
              stroke="url(#orbitGradient)"
              strokeWidth="2"
            />

            {/* Traveling Arrow on the orbital path */}
            <g transform="translate(230, 204)">
              <polygon points="0,0 -8,-5 -8,5" fill="#A78BFA" />
            </g>

            {/* Orbital commit nodes */}
            <g transform="translate(100, 185)">
              <circle cx="0" cy="0" r="4" fill="#A78BFA" />
              <circle cx="0" cy="0" r="7" stroke="#A78BFA" strokeWidth="1" opacity="0.4" />
            </g>

            <g transform="translate(320, 185)">
              <circle cx="0" cy="0" r="4" fill="#4ADE80" />
            </g>
          </svg>

          {/* Floating Live Pipeline Badges around the Monolith */}
          <div className="absolute top-8 left-2 bg-[#14151E]/90 border border-white/[0.08] backdrop-blur-md px-2.5 py-1 rounded-lg text-[10.5px] font-mono text-zinc-300 flex items-center gap-1.5 shadow-md">
            <GitCommit size={11} className="text-[#A78BFA]" />
            <span>commit 8fa21c</span>
          </div>

          <div className="absolute bottom-4 right-4 bg-[#14151E]/90 border border-white/[0.08] backdrop-blur-md px-2.5 py-1 rounded-lg text-[10.5px] font-mono text-[#4ADE80] flex items-center gap-1.5 shadow-md">
            <CheckCircle2 size={11} />
            <span>CI passed · 100%</span>
          </div>
        </div>
      </div>

      {/* Bottom Technical Status Bar */}
      <div className="relative z-10 pt-3 border-t border-white/[0.06] flex items-center justify-between text-zinc-500 text-[11px]">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-[#A78BFA]" />
          <span>SOC2 Type II Certified · Enterprise Ready</span>
        </div>
        <span className="font-mono text-zinc-600">v2.4</span>
      </div>
    </div>
  );
};
