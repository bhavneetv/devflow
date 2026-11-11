import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Maximize2,
  Minimize2,
  PanelLeft,
  ExternalLink,
  FileText,
  RectangleHorizontal,
  BookOpen,
} from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';
import { cn } from '../../lib/utils';

interface PdfDocumentViewerProps {
  url: string;
  title: string;
  inlineHeightClassName?: string;
  extraToolbarActions?: React.ReactNode;
}

type PdfFitMode = 'Fit' | 'FitH';

function buildPdfSrc(baseUrl: string, fitMode: PdfFitMode, showNavPanes: boolean): string {
  const clean = baseUrl.split('#')[0];
  return `${clean}#toolbar=1&navpanes=${showNavPanes ? 1 : 0}&pagemode=${showNavPanes ? 'thumbs' : 'none'}&view=${fitMode}`;
}

export const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
  url,
  title,
  inlineHeightClassName = 'h-[min(82vh,880px)] min-h-[540px]',
  extraToolbarActions,
}) => {
  const { accentColor } = useAccentTheme();
  const [fitMode, setFitMode] = useState<PdfFitMode>('Fit');
  const [showNavPanes, setShowNavPanes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const iframeSrc = useMemo(
    () => buildPdfSrc(url, fitMode, showNavPanes),
    [url, fitMode, showNavPanes]
  );

  const openTabUrl = useMemo(() => buildPdfSrc(url, 'FitH', false), [url]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const viewerContent = (fullscreen: boolean) => (
    <div
      className={cn(
        'flex flex-col bg-[#0E0F14] overflow-hidden',
        fullscreen
          ? 'fixed inset-0 z-[9995] w-screen h-screen'
          : cn('w-full rounded-xl border border-[#27272A]', inlineHeightClassName)
      )}
    >
      {/* PDF Control Header */}
      <div className="px-3 py-2 border-b border-[#27272A] bg-[#14151B] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: `${accentColor}18`,
              borderColor: `${accentColor}40`,
              color: accentColor,
            }}
          >
            <FileText size={13} />
          </div>
          <span className="text-xs font-medium text-zinc-200 truncate max-w-[180px] sm:max-w-xs">
            {title}
          </span>
          <span className="hidden md:inline-block text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/70">
            {fitMode === 'Fit' ? 'Full Page Fit' : 'Fit Width'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Fit Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#0A0B0F] border border-[#27272A]">
            <button
              type="button"
              onClick={() => setFitMode('Fit')}
              title="Fit entire PDF page inside viewport"
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer',
                fitMode === 'Fit' ? 'text-[#0A0B10] font-semibold' : 'text-zinc-400 hover:text-white'
              )}
              style={fitMode === 'Fit' ? { backgroundColor: accentColor } : undefined}
            >
              <BookOpen size={11} />
              <span>Full Page</span>
            </button>
            <button
              type="button"
              onClick={() => setFitMode('FitH')}
              title="Fit PDF width across viewer"
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer',
                fitMode === 'FitH' ? 'text-[#0A0B10] font-semibold' : 'text-zinc-400 hover:text-white'
              )}
              style={fitMode === 'FitH' ? { backgroundColor: accentColor } : undefined}
            >
              <RectangleHorizontal size={11} />
              <span>Fit Width</span>
            </button>
          </div>

          {/* Toggle Left Page Thumbnails */}
          <button
            type="button"
            onClick={() => setShowNavPanes((v) => !v)}
            title={showNavPanes ? 'Hide page thumbnails' : 'Show page thumbnails'}
            className={cn(
              'px-2 py-1 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer',
              showNavPanes
                ? 'text-white bg-zinc-800 border-zinc-600'
                : 'text-zinc-400 bg-[#0A0B0F] border-[#27272A] hover:text-white hover:border-zinc-700'
            )}
          >
            <PanelLeft size={12} />
            <span className="hidden sm:inline">Pages</span>
          </button>

          {/* Open in New Browser Tab */}
          <a
            href={openTabUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open PDF in new full browser tab"
            className="px-2 py-1 rounded-lg border border-[#27272A] bg-[#0A0B0F] text-zinc-300 hover:text-white hover:border-zinc-700 text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
          >
            <ExternalLink size={12} />
            <span className="hidden sm:inline">New Tab</span>
          </a>

          {fullscreen && extraToolbarActions}

          {/* Expand / Exit Fullscreen */}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            title={fullscreen ? 'Exit full page view (Esc)' : 'Expand to full screen page view'}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#0A0B10] inline-flex items-center gap-1 transition-all hover:brightness-110 cursor-pointer"
            style={{ backgroundColor: accentColor }}
          >
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            <span>{fullscreen ? 'Exit Full' : 'Full Screen'}</span>
          </button>
        </div>
      </div>

      {/* Live PDF Frame */}
      <div className="flex-1 w-full bg-[#18191F] relative min-h-0">
        <iframe
          key={`${url}::${fitMode}::${showNavPanes}::${fullscreen}`}
          src={iframeSrc}
          title={title}
          className="w-full h-full border-0 block"
        />
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(viewerContent(true), document.body);
  }

  return viewerContent(false);
};

