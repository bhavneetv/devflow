import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AccountSettingsSidebar, ACCOUNT_NAV_ITEMS } from './AccountSettingsSidebar';
import { Menu, X } from 'lucide-react';

interface AccountSettingsLayoutProps {
  children: React.ReactNode;
}

export const AccountSettingsLayout: React.FC<AccountSettingsLayoutProps> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const currentItem = ACCOUNT_NAV_ITEMS.find((item) =>
    location.pathname.startsWith(item.path)
  ) || ACCOUNT_NAV_ITEMS[0];

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0D0F14] text-[#F4F4F5]">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Left Sidebar (Desktop Fixed, Mobile Slide Drawer) */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform md:transform-none transition-transform duration-300 ease-in-out md:static md:flex ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <AccountSettingsSidebar onNavigate={() => setMobileMenuOpen(false)} />
      </div>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#0F1012]">
        {/* Mobile Header Bar with Hamburger Button */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0B0B0C] border-b border-[#27272A] z-30">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-md text-[#A1A1AA] hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Toggle settings menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="text-xs font-semibold text-[#F4F4F5] truncate">
            {currentItem?.label || 'Account Settings'}
          </div>

          <div className="w-8" /> {/* spacer for balance */}
        </div>

        {/* Scrollable Main Content Surface */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
