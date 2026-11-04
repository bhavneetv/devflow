import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';
import { OnboardingLayout } from '../components/onboarding/OnboardingLayout';
import { StepProfile } from '../components/onboarding/StepProfile';
import { StepRole } from '../components/onboarding/StepRole';
import { StepGoals } from '../components/onboarding/StepGoals';
import { StepProjectSetup } from '../components/onboarding/StepProjectSetup';
import { CinematicTextIntro } from '../components/onboarding/CinematicTextIntro';
import { OnboardingData } from '../types/onboarding';
import { saveAccentColor } from '../services/accentTheme.service';
import { useToast } from '../context/ToastContext';
import { accountSettingsService } from '../services/accountSettings.service';

const STORAGE_KEY = 'devflow_onboarding_draft';

export const OnboardingPage: React.FC = () => {
  const { user, setIsOnboardingCompleted, updateCurrentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Cinematic typewriter blur text sequence states
  const [showIntro, setShowIntro] = useState(true);
  const [showOutro, setShowOutro] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Initial onboarding state
  const defaultState: OnboardingData = {
    displayName: user?.name || 'Alex Rivers',
    username: user?.username || (user?.email ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '') : 'alexrivers'),
    avatarType: (user?.avatarType as any) || 'initials',
    avatarId: user?.avatarId || 'initials',
    avatarUrl: user?.avatarUrl || null,
    avatarColor: user?.avatarColor || '#7C3AED',
    accentColor: user?.accentColor || '#8B5CF6',
    role: null,
    workspaceType: 'startup',
    goals: ['tasks', 'github'],
    teamSizePreference: 'small',
    startingPreference: 'new_project',
    projectName: 'Core Infrastructure v2',
    projectDescription: 'Next-generation software delivery orchestration & sprint tracking.',
  };

  const [step, setStep] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.step && parsed.step >= 1 && parsed.step <= 4) {
          return parsed.step;
        }
      }
    } catch {}
    return 1;
  });

  const [formData, setFormData] = useState<OnboardingData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data) {
          return { ...defaultState, ...parsed.data };
        }
      }
    } catch {}
    return defaultState;
  });

  const [errors, setErrors] = useState<{ displayName?: string; username?: string }>({});
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // Persist draft on step or data changes (1-4)
  useEffect(() => {
    if (step <= 4) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step, data: formData })
      );
    }
  }, [step, formData]);

  const handleChange = (updates: Partial<OnboardingData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    if (updates.displayName?.trim()) {
      setErrors((prev) => ({ ...prev, displayName: undefined }));
    }
    if (updates.username?.trim()) {
      setErrors((prev) => ({ ...prev, username: undefined }));
    }
  };

  const handleSubmitOnboarding = async () => {
    const res = await authService.submitOnboarding(formData);
    if (res.success) {
      setIsOnboardingCompleted(true);
      updateCurrentUser({
        name: formData.displayName,
        username: formData.username,
        avatarType: formData.avatarType,
        avatarId: formData.avatarId,
        avatarUrl: formData.avatarUrl || user?.avatarUrl,
        avatarColor: formData.avatarColor,
        accentColor: formData.accentColor,
        onboardingCompleted: true,
      });
      saveAccentColor(formData.accentColor);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem('devflow_show_welcome_checklist', 'true');
      return { success: true };
    }
    return { success: false, error: res.error || 'Failed to finalize onboarding' };
  };

  const handleNext = async () => {
    if (step === 1) {
      const newErrors: { displayName?: string; username?: string } = {};
      if (!formData.displayName.trim()) {
        newErrors.displayName = 'Please enter your name to personalize your workspace';
      }
      const rawUsername = formData.username?.trim().toLowerCase().replace(/^@+/, '');
      if (!rawUsername) {
        newErrors.username = 'Please choose a username to continue';
      } else if (rawUsername.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-z0-9_.-]+$/i.test(rawUsername)) {
        newErrors.username = 'Username can only contain letters, numbers, and . _ -';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      // Check username validity & uniqueness against backend database
      setIsCheckingUsername(true);

      const reservedHandles = ['admin', 'root', 'devflow', 'system', 'api', 'support', 'owner', 'bot'];
      if (reservedHandles.includes(rawUsername)) {
        setIsCheckingUsername(false);
        setErrors({ username: `@${rawUsername} is a reserved system handle. Please pick another.` });
        return;
      }

      try {
        const checkResult = await accountSettingsService.checkUsernameAvailability(rawUsername);
        setIsCheckingUsername(false);
        if (!checkResult.available) {
          setErrors({ username: checkResult.message || `@${rawUsername} is already taken. Please choose another.` });
          return;
        }
      } catch {
        setIsCheckingUsername(false);
      }

      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      // Step 4 is the final step ("Finish setup"): submit onboarding and play outro sequence
      setIsCheckingUsername(true);
      const res = await handleSubmitOnboarding();
      setIsCheckingUsername(false);

      if (!res.success) {
        toast.error(res.error || 'Failed to complete onboarding');
        if (res.error?.toLowerCase().includes('username') || res.error?.toLowerCase().includes('taken')) {
          setErrors({ username: res.error });
          setStep(1); // Return to step 1 so user can easily change the username
        }
        return;
      }

      setIsExiting(true);
      setTimeout(() => {
        setShowOutro(true);
      }, 550);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const handleSkip = async () => {
    if (step === 2) {
      handleChange({ role: null });
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      setIsCheckingUsername(true);
      const res = await handleSubmitOnboarding();
      setIsCheckingUsername(false);

      if (!res.success) {
        toast.error(res.error || 'Failed to complete onboarding');
        if (res.error?.toLowerCase().includes('username') || res.error?.toLowerCase().includes('taken')) {
          setErrors({ username: res.error });
          setStep(1);
        }
        return;
      }

      setIsExiting(true);
      setTimeout(() => {
        setShowOutro(true);
      }, 550);
    }
  };

  return (
    <>
      {/* Intro cinematic typewriter sequence on page load */}
      {showIntro && (
        <CinematicTextIntro
          mode="intro"
          onComplete={() => setShowIntro(false)}
        />
      )}

      {/* Outro cinematic typewriter sequence when onboarding finishes */}
      {showOutro && (
        <CinematicTextIntro
          mode="outro"
          onComplete={() => navigate('/', { replace: true })}
        />
      )}

      {/* Main 4-step onboarding experience */}
      {!showIntro && !showOutro && (
        <OnboardingLayout
          currentStep={step}
          totalSteps={4}
          data={formData}
          onNext={handleNext}
          onBack={handleBack}
          onSkip={handleSkip}
          isNextLoading={isCheckingUsername}
          canSkip={step >= 2 && step <= 4}
          isExiting={isExiting}
        >
          {step === 1 && (
            <StepProfile
              data={formData}
              onChange={handleChange}
              error={errors.displayName}
              usernameError={errors.username}
              isCheckingUsername={isCheckingUsername}
            />
          )}

          {step === 2 && (
            <StepRole data={formData} onChange={handleChange} />
          )}

          {step === 3 && (
            <StepGoals data={formData} onChange={handleChange} />
          )}

          {step === 4 && (
            <StepProjectSetup data={formData} onChange={handleChange} />
          )}
        </OnboardingLayout>
      )}
    </>
  );
};
