import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  HelpCircle,
  Loader2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';

export type SweetAlertVariant = 'danger' | 'warning' | 'success' | 'info' | 'question';

export interface CustomSweetAlertProps {
  isOpen: boolean;
  variant?: SweetAlertVariant;
  title: string;
  text?: string;
  message?: string;
  highlightLabel?: string;
  warningNote?: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  accentColor?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

const VARIANT_CONFIG: Record<
  SweetAlertVariant,
  { icon: LucideIcon; badge: string }
> = {
  danger: { icon: Trash2, badge: 'Destructive Action' },
  warning: { icon: AlertTriangle, badge: 'Attention Required' },
  success: { icon: CheckCircle2, badge: 'Completed' },
  info: { icon: Info, badge: 'Information' },
  question: { icon: HelpCircle, badge: 'Confirm Action' },
};

function getReadableContrastText(hexColor: string): string {
  const clean = hexColor.replace('#', '');
  if (clean.length !== 6 && clean.length !== 3) return '#FFFFFF';
  const normalized =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#FFFFFF';
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance >= 168 ? '#090A0E' : '#FFFFFF';
}

export const CustomSweetAlert: React.FC<CustomSweetAlertProps> = ({
  isOpen,
  variant = 'warning',
  title,
  text,
  message,
  highlightLabel,
  warningNote,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showCancel = true,
  accentColor: propAccentColor,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const { accentColor: themeAccentColor } = useAccentTheme();
  const accent = propAccentColor || themeAccentColor || '#8B5CF6';
  const contrastText = getReadableContrastText(accent);
  const bodyCopy = text ?? message;
  const meta = VARIANT_CONFIG[variant] || VARIANT_CONFIG.warning;
  const Icon = meta.icon;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[99990] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-swal-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => !isLoading && onCancel?.()}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Alert Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: 'spring', stiffness: 440, damping: 32 }}
            className="relative w-full max-w-[430px] rounded-2xl bg-[#0C0D12] border overflow-hidden shadow-2xl"
            style={{
              borderColor: `${accent}42`,
              boxShadow: `0 30px 80px -15px rgba(0, 0, 0, 0.9), 0 0 48px -14px ${accent}38`,
            }}
          >
            {/* Top Radial Accent Glow & Shimmer Hairline */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-28"
              style={{
                background: `radial-gradient(ellipse at 50% 0%, ${accent}22 0%, transparent 72%)`,
              }}
            />
            <div
              className="relative h-[2px] w-full"
              style={{
                background: `linear-gradient(90deg, transparent 5%, ${accent} 50%, transparent 95%)`,
              }}
            />

            {/* Optional Top-Right Close Button */}
            {showCancel && onCancel && (
              <button
                type="button"
                disabled={isLoading}
                onClick={onCancel}
                className="absolute top-3.5 right-3.5 z-10 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-colors cursor-pointer disabled:opacity-40"
                aria-label="Close alert"
              >
                <X size={14} />
              </button>
            )}

            {/* Main Content */}
            <div className="relative px-6 pt-7 pb-6 flex flex-col items-center text-center">
              {/* Animated Icon Halo */}
              <div className="relative flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0.85, opacity: 0.45 }}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0.12, 0.35] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    backgroundColor: accent,
                    filter: 'blur(12px)',
                  }}
                />
                <motion.div
                  initial={{ scale: 0.65, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                  className="relative w-14 h-14 rounded-2xl border flex items-center justify-center shadow-inner"
                  style={{
                    background: `linear-gradient(145deg, ${accent}24, ${accent}0D)`,
                    borderColor: `${accent}55`,
                    color: accent,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.12)`,
                  }}
                >
                  <Icon size={24} strokeWidth={2} />
                </motion.div>
              </div>

              {/* Variant Pill */}
              <span
                className="mt-4 text-[10px] font-mono uppercase tracking-[0.14em] px-2.5 py-0.5 rounded-full border font-semibold"
                style={{
                  backgroundColor: `${accent}14`,
                  borderColor: `${accent}36`,
                  color: accent,
                }}
              >
                {meta.badge}
              </span>

              {/* Title & Description */}
              <h3
                id="custom-swal-title"
                className="mt-3 text-[17px] font-bold text-white tracking-tight leading-snug"
              >
                {title}
              </h3>

              {bodyCopy && (
                <p className="mt-1.5 text-[13px] text-zinc-400 leading-relaxed max-w-[350px]">
                  {bodyCopy}
                </p>
              )}

              {/* Highlighted Target Pill */}
              {highlightLabel && (
                <div className="mt-4 w-full px-3.5 py-2.5 rounded-xl bg-[#13141B] border border-[#242632] flex items-center justify-center gap-2 text-xs font-mono text-zinc-200 shadow-inner">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{
                      backgroundColor: accent,
                      boxShadow: `0 0 8px ${accent}`,
                    }}
                  />
                  <span className="truncate">{highlightLabel}</span>
                </div>
              )}

              {/* Optional Warning Callout Box */}
              {warningNote && (
                <div className="mt-3 w-full px-3.5 py-2.5 rounded-xl bg-amber-500/[0.07] border border-amber-500/25 text-left flex items-start gap-2.5 text-[11.5px] leading-relaxed text-amber-200/90">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>{warningNote}</span>
                </div>
              )}
            </div>

            {/* Distinct Action Footer Strip */}
            <div className="px-5 py-3.5 bg-[#08090D] border-t border-[#1C1D26] flex items-center gap-2.5">
              {showCancel && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onCancel?.()}
                  className="flex-1 h-9.5 py-2 px-4 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-[#13141B] hover:bg-[#1B1D26] border border-[#27272A] hover:border-zinc-600 transition-all cursor-pointer disabled:opacity-50"
                >
                  {cancelText}
                </button>
              )}

              <motion.button
                type="button"
                disabled={isLoading}
                onClick={onConfirm}
                autoFocus
                whileTap={{ scale: 0.98 }}
                className="flex-1 h-9.5 py-2 px-4 rounded-xl text-xs font-semibold transition-all hover:brightness-110 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 border border-white/10"
                style={{
                  backgroundColor: accent,
                  color: contrastText,
                  boxShadow: `0 8px 22px -6px ${accent}70`,
                }}
              >
                {isLoading && <Loader2 size={14} className="animate-spin" />}
                <span>{confirmText}</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
