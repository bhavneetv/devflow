import React from 'react';

interface AccountSettingsLayoutProps {
  children: React.ReactNode;
}

export const AccountSettingsLayout: React.FC<AccountSettingsLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-full w-full bg-[#0D0F14] text-[#F4F4F5]">
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {children}
      </div>
    </div>
  );
};
