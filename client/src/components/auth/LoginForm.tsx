import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, Sparkles, Check, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthInput } from './AuthInput';
import { LoadingButton } from './LoadingButton';
import { SocialLoginButtons } from './SocialLoginButtons';
import { useAuth } from '../../context/AuthContext';

interface LoginFormProps {
  onSuccess?: (isNewUser?: boolean) => void;
  onNavigateToRegister?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onNavigateToRegister,
}) => {
  const { login, socialLogin, demoNewUserSession } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [socialLoadingProvider, setSocialLoadingProvider] = useState<'github' | 'google' | null>(null);
  const [resetSent, setResetSent] = useState(false);

  // Validate form inputs
  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!email.includes('@')) {
      newErrors.email = "Please include an '@' in the email address";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address (e.g. name@domain.com)';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Quick fill demo credentials
  const handleQuickDemo = () => {
    setEmail('alice@devflow.io');
    setPassword('password123');
    setErrors({});
  };

  // Act as new user and navigate directly to onboarding
  const handleActAsNew = async () => {
    setIsSubmitting(true);
    localStorage.removeItem('devflow_onboarding_draft');
    try {
      await demoNewUserSession();
    } catch (e) {
      console.warn('Demo new user api failed, proceeding to onboarding anyway:', e);
    } finally {
      setIsSubmitting(false);
      navigate('/onboarding');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await login(email.trim(), password);

      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => {
          if (result.isNewUser) {
            navigate('/onboarding');
          } else if (onSuccess) {
            onSuccess(false);
          } else {
            navigate('/');
          }
        }, 850);
      } else {
        setErrors({ general: result.error || 'Invalid email or password' });
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrors({ general: err.message || 'An unexpected error occurred. Please try again.' });
      setIsSubmitting(false);
    }
  };

  const handleSocialAuth = async (provider: 'github' | 'google') => {
    setSocialLoadingProvider(provider);
    setErrors({});
    try {
      const result = await socialLogin(provider);
      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => {
          if (result.isNewUser) {
            navigate('/onboarding');
          } else if (onSuccess) {
            onSuccess(false);
          } else {
            navigate('/');
          }
        }, 850);
      } else {
        setErrors({ general: result.error || `Could not sign in with ${provider}` });
      }
    } catch (err: any) {
      setErrors({ general: err.message || `Failed to authenticate with ${provider}` });
    } finally {
      setSocialLoadingProvider(null);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrors({ email: 'Enter your email above first to receive reset instructions' });
      return;
    }
    setResetSent(true);
    setTimeout(() => setResetSent(false), 4500);
  };

  return (
    <div className="w-full max-w-[360px] mx-auto flex flex-col justify-center select-none text-left">
      {/* Heading & Subtitle */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-3"
      >
        <h1 className="text-[23px] font-semibold text-white tracking-tight leading-tight">
          Welcome back
        </h1>
        <p className="mt-0.5 text-[12.5px] text-zinc-400">
          Sign in to continue building great software.
        </p>

        {/* Quick Demo & Act As New Buttons */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleQuickDemo}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 text-[10.5px] font-mono transition-colors group cursor-pointer"
            title="Auto-fill with seeded development user"
          >
            <Sparkles size={11} className="text-[#A78BFA] group-hover:rotate-12 transition-transform" />
            <span>Demo (alice@devflow.io)</span>
          </button>

          <button
            type="button"
            id="act-as-new-btn"
            onClick={handleActAsNew}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 border border-[#A78BFA]/30 text-[#A78BFA] hover:text-[#B7A1FF] text-[10.5px] font-mono transition-colors group cursor-pointer"
            title="Experience the new user onboarding flow"
          >
            <UserPlus size={11} className="group-hover:scale-110 transition-transform" />
            <span>Act as new (Onboard)</span>
            <span className="text-[9px]">→</span>
          </button>
        </div>
      </motion.div>

      {/* General Error Banner */}
      <AnimatePresence>
        {errors.general && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-2"
          >
            <div className="py-1.5 px-2.5 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-between text-red-400 text-[11.5px]">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={13} className="flex-shrink-0" />
                <span className="leading-tight">{errors.general}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrors((prev) => ({ ...prev, general: undefined }))}
                className="text-red-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Social Logins */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.04 }}
      >
        <SocialLoginButtons
          onGitHubClick={() => handleSocialAuth('github')}
          onGoogleClick={() => handleSocialAuth('google')}
          isLoading={isSubmitting || socialLoadingProvider !== null}
          activeProvider={socialLoadingProvider}
        />
      </motion.div>

      {/* Form Fields */}
      <form noValidate onSubmit={handleSubmit} className="mt-1 space-y-2.5">
        {/* Email Field */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <AuthInput
            label="Email address"
            icon={Mail}
            type="email"
            id="login-email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            error={errors.email}
            autoComplete="email"
            disabled={isSubmitting || isSuccess}
          />
        </motion.div>

        {/* Password Field */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12 }}
        >
          <AuthInput
            label="Password"
            icon={Lock}
            isPassword
            id="login-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
            autoComplete="current-password"
            disabled={isSubmitting || isSuccess}
            labelRightSlot={
              resetSent ? (
                <span className="text-[11px] font-medium text-[#4ADE80] flex items-center gap-1 animate-in fade-in duration-150">
                  <Check size={12} strokeWidth={2.5} />
                  <span>Reset instructions sent!</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  tabIndex={0}
                  className="text-[11.5px] font-medium text-[#A78BFA] hover:text-[#B7A1FF] hover:underline transition-colors focus:outline-none"
                >
                  Forgot password?
                </button>
              )
            }
          />
        </motion.div>

        {/* Primary Login Button */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.16 }}
          className="pt-1"
        >
          <LoadingButton
            type="submit"
            isLoading={isSubmitting}
            isSuccess={isSuccess}
            disabled={socialLoadingProvider !== null}
            id="sign-in-button"
          >
            Sign in to DevFlow
          </LoadingButton>
        </motion.div>
      </form>

      {/* Footer Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="mt-3 text-center space-y-1.5"
      >
        <p className="text-[12px] text-zinc-400">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onNavigateToRegister}
            className="font-medium text-white hover:text-[#A78BFA] underline underline-offset-4 decoration-white/20 hover:decoration-[#A78BFA] transition-colors focus:outline-none"
          >
            Sign up
          </button>
        </p>

        {/* Subtle security note */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-500">
          <span>End-to-end encrypted · Enterprise SSO ready</span>
        </div>
      </motion.div>
    </div>
  );
};
