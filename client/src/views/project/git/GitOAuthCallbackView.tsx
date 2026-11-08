import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Github, Loader2 } from 'lucide-react';

export const GitOAuthCallbackView: React.FC = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const error = searchParams.get('error_description') || searchParams.get('error');

  useEffect(() => {
    if (code) {
      if (window.opener) {
        window.opener.postMessage({ type: 'GITHUB_OAUTH_CODE', code }, '*');
        setTimeout(() => window.close(), 500);
      } else {
        // If not in popup, store in sessionStorage and redirect back
        sessionStorage.setItem('devflow_pending_github_code', code);
        window.location.href = '/settings/account/connections';
      }
    }
  }, [code]);

  return (
    <div className="min-h-screen bg-[#090A0C] flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
        <Github size={28} />
      </div>
      {error ? (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-rose-400">GitHub Authorization Error</h2>
          <p className="text-xs text-zinc-400 max-w-sm">{error}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-zinc-400" />
            <h2 className="text-base font-semibold text-white">Authenticating with GitHub...</h2>
          </div>
          <p className="text-xs text-zinc-400">Transferring authorization back to DevFlow. You may close this window.</p>
        </div>
      )}
    </div>
  );
};

