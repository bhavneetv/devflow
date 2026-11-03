import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: {
    success: (title: string, message?: string, duration?: number) => void;
    error: (title: string, message?: string, duration?: number) => void;
    info: (title: string, message?: string, duration?: number) => void;
    warning: (title: string, message?: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, title: string, message?: string, duration = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { id, type, title, message, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (title: string, message?: string, duration?: number) => addToast('success', title, message, duration),
    error: (title: string, message?: string, duration?: number) => addToast('error', title, message, duration),
    info: (title: string, message?: string, duration?: number) => addToast('info', title, message, duration),
    warning: (title: string, message?: string, duration?: number) => addToast('warning', title, message, duration),
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={16} className="text-[#4ADE80] shrink-0" />;
      case 'error':
        return <AlertCircle size={16} className="text-[#F87171] shrink-0" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-[#FBBF24] shrink-0" />;
      case 'info':
      default:
        return <Info size={16} className="text-[#38BDF8] shrink-0" />;
    }
  };

  const getBorderColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'border-[#4ADE80]/30 shadow-[#4ADE80]/5';
      case 'error':
        return 'border-[#F87171]/40 shadow-[#F87171]/10';
      case 'warning':
        return 'border-[#FBBF24]/30 shadow-[#FBBF24]/5';
      case 'info':
      default:
        return 'border-[#38BDF8]/30 shadow-[#38BDF8]/5';
    }
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Floating Toast Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.92, transition: { duration: 0.18 } }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`pointer-events-auto p-3.5 rounded-xl bg-[#17181D]/95 backdrop-blur-md border ${getBorderColor(
                item.type
              )} shadow-xl flex items-start gap-3 text-left`}
            >
              <div className="mt-0.5">{getIcon(item.type)}</div>
              <div className="flex-1 min-w-0 pr-1">
                <p className="text-[13px] font-medium text-white leading-snug">
                  {item.title}
                </p>
                {item.message && (
                  <p className="text-[11.5px] text-zinc-400 mt-0.5 leading-relaxed">
                    {item.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeToast(item.id)}
                className="text-zinc-500 hover:text-white p-1 rounded-md transition-colors"
                title="Dismiss"
              >
                <X size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
