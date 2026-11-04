import React from 'react';

interface AccountSettingsLayoutProps {
  children: React.ReactNode;
}

export const AccountSettingsLayout: React.FC<AccountSettingsLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-full w-full bg-[#0D0F14] text-[#F4F4F5]">
      <div className="w-full max-w-5xl pl-4 sm:pl-8 lg:pl-10 pr-4 sm:pr-8 pt-4 pb-12 mr-auto">
        {children}
      </div>
    </div>
  );
};
