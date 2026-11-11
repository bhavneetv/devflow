import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface FloatingTooltipProps {
  content: string;
  enabled?: boolean;
  children: React.ReactElement;
  side?: 'right' | 'top' | 'bottom';
}

export const FloatingTooltip: React.FC<FloatingTooltipProps> = ({
  content,
  enabled = true,
  children,
  side = 'right',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (side === 'right') {
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 8,
      });
    } else if (side === 'top') {
      setCoords({
        top: rect.top - 6,
        left: rect.left + rect.width / 2,
      });
    } else if (side === 'bottom') {
      setCoords({
        top: rect.bottom + 6,
        left: rect.left + rect.width / 2,
      });
    }
  };

  const handleMouseEnter = () => {
    if (!enabled || !content) return;
    updatePosition();
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  // Close on window scroll
  useEffect(() => {
    if (!isVisible) return;
    const handleScroll = () => setIsVisible(false);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isVisible]);

  return (
    <>
      {React.cloneElement(children, {
        title: undefined,
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node;
          const { ref } = children as any;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        },
        onMouseEnter: (e: React.MouseEvent) => {
          handleMouseEnter();
          children.props.onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          handleMouseLeave();
          children.props.onMouseLeave?.(e);
        },
      })}

      {isVisible &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: side === 'right' ? 'translateY(-50%)' : 'translateX(-50%)',
              zIndex: 99999,
              pointerEvents: 'none',
            }}
            className="px-2.5 py-1 bg-[#18181C] text-white border border-[#2B2C33] rounded-md text-xs font-medium shadow-2xl whitespace-nowrap animate-in fade-in zoom-in-95 duration-75 select-none"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};

