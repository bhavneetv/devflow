import React, { useState } from 'react';
import { X, Upload, Check, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { useAccentTheme } from '../../services/accentTheme.service';

interface ProfileAvatarEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar: string;
  onSaveAvatar: (newAvatarUrl: string) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300', // Emily reference
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300', // Alice
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300', // Bob
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=300', // Charlie
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300',
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?w=300',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300',
];

export const ProfileAvatarEditor: React.FC<ProfileAvatarEditorProps> = ({
  isOpen,
  onClose,
  currentAvatar,
  onSaveAvatar,
}) => {
  const { accentColor } = useAccentTheme();
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 3MB)
    if (file.size > 3 * 1024 * 1024) {
      setUploadError('Image size exceeds 3MB limit.');
      return;
    }

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setUploadError('Please select a JPG, PNG, or WebP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setSelectedAvatar(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    onSaveAvatar(selectedAvatar);
    onClose();
  };

  const handleReset = () => {
    setSelectedAvatar(PRESET_AVATARS[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#161619] border border-[#27272A] rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#27272A]">
          <h3 className="text-base font-semibold text-[#F4F4F5] flex items-center gap-2">
            <ImageIcon size={18} className="text-[#A78BFA]" />
            <span>Update Profile Picture</span>
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Preview */}
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#A78BFA] shadow-lg ring-4 ring-[#A78BFA]/20 bg-zinc-900">
            <img
              src={selectedAvatar}
              alt="Avatar preview"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-[11px] text-[#A1A1AA]">Current selection preview</span>
        </div>

        {/* Upload Custom Image */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#A1A1AA]">
            Upload custom photo
          </label>
          <label className="flex items-center justify-center gap-2 w-full py-2.5 px-4 border border-dashed border-[#27272A] hover:border-[#A78BFA] rounded-xl cursor-pointer bg-[#111216] hover:bg-[#1A1D24] text-xs font-medium text-[#F4F4F5] transition-all">
            <Upload size={14} className="text-[#A78BFA]" />
            <span>Choose local image file (PNG, JPG up to 3MB)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          {uploadError && (
            <p className="text-[11px] text-red-400">{uploadError}</p>
          )}
        </div>

        {/* Preset Avatars */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[#A1A1AA]">
              Or choose from curated presets
            </label>
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] flex items-center gap-1 hover:underline"
              style={{ color: accentColor }}
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2.5 pt-1">
            {PRESET_AVATARS.map((url, idx) => {
              const isSelected = selectedAvatar === url;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedAvatar(url)}
                  className={`relative aspect-square rounded-full overflow-hidden border-2 transition-all p-0.5 ${
                    isSelected
                      ? 'scale-105'
                      : 'border-[#27272A] hover:border-zinc-500 opacity-80 hover:opacity-100'
                  }`}
                  style={
                    isSelected
                      ? {
                          borderColor: accentColor,
                          boxShadow: `0 0 0 2px ${accentColor}60`,
                        }
                      : undefined
                  }
                >
                  <img
                    src={url}
                    alt={`Preset ${idx + 1}`}
                    className="w-full h-full object-cover rounded-full"
                  />
                  {isSelected && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ backgroundColor: `${accentColor}40` }}
                    >
                      <Check size={14} className="text-white drop-shadow" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#27272A]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#27272A] hover:border-zinc-500 text-xs font-medium text-[#A1A1AA] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 rounded-lg text-black font-semibold text-xs shadow-md transition-all"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 2px 10px ${accentColor}40`,
            }}
          >
            Save Avatar
          </button>
        </div>
      </div>
    </div>
  );
};
