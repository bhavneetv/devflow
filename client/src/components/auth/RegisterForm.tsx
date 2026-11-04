import React, { useState } from 'react';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthInput } from './AuthInput';
import { LoadingButton } from './LoadingButton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface RegisterFormProps {
  onSuccess?: (isNewUser?: boolean) => void;
  onNavigateToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onNavigateToLogin,
}) => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const newErrors: { name?: string; email?: string; password?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Full name is required';
    }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await register(name.trim(), email.trim(), password);

      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => {
          if (onSuccess) {
            onSuccess(true);
          } else {
            navigate('/onboarding');
          }
        }, 800);
      } else {
        setErrors({ general: result.error || 'Registration failed' });
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrors({ general: err.message || 'An error occurred during registration.' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[370px] mx-auto flex flex-col justify-center select-none">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-left mb-2.5"
      >
        <h1 className="text-[21px] font-bold text-[#E5E7EB] tracking-tight leading-tight">
          Create an account
        </h1>
        <p className="mt-0.5 text-[12.5px] text-[#9CA3AF] font-normal">
          Start collaborating on software with your team today.
        </p>
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
            <div className="py-1.5 px-2.5 rounded-lg bg-[#F87171]/10 border border-[#F87171]/30 flex items-center justify-between text-[#F87171] text-[11.5px]">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={13} className="flex-shrink-0" />
                <span className="leading-tight">{errors.general}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrors((prev) => ({ ...prev, general: undefined }))}
                className="text-[#F87171] hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form noValidate onSubmit={handleSubmit} className="space-y-2.5">
        {/* Name Field */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.04 }}
        >
          <AuthInput
            label="Full Name"
            icon={User}
            id="register-name"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
            autoComplete="name"
            disabled={isSubmitting || isSuccess}
          />
        </motion.div>

        {/* Email Field */}
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          <AuthInput
            label="Work Email"
            icon={Mail}
            type="email"
            id="register-email"
            placeholder="ada@company.com"
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
            id="register-password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={errors.password}
            autoComplete="new-password"
            disabled={isSubmitting || isSuccess}
          />
        </motion.div>

        {/* Primary Submit Button */}
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
            id="sign-up-button"
          >
            Create account
          </LoadingButton>
        </motion.div>
      </form>

      {/* Footer Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="mt-3 text-center space-y-2"
      >
        <p className="text-[12px] text-[#9CA3AF]">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="font-medium text-[#E5E7EB] hover:text-[#22D3EE] underline underline-offset-4 decoration-[#1F2937] hover:decoration-[#22D3EE] transition-colors focus:outline-none"
          >
            Sign in
          </button>
        </p>

        <p className="text-[10px] text-[#6B7280] max-w-xs mx-auto">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
};
