'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Icon rendered to the left of the label */
  leftIcon?: React.ReactNode;
  /** Icon rendered to the right of the label */
  rightIcon?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:ring-indigo-500 disabled:bg-indigo-800 disabled:text-indigo-300',
  secondary:
    'bg-gray-800 text-white hover:bg-gray-700 focus-visible:ring-gray-600 border border-gray-700 disabled:bg-gray-800 disabled:text-gray-500',
  danger:
    'bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-500 disabled:bg-red-900 disabled:text-red-400',
  ghost:
    'bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white focus-visible:ring-gray-600 disabled:text-gray-600',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center font-medium',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950',
          'select-none',
          // Disabled
          'disabled:cursor-not-allowed disabled:pointer-events-none',
          // Variant
          variantClasses[variant],
          // Size
          sizeClasses[size],
          className
        )}
        {...rest}
      >
        {/* Loading spinner or left icon */}
        {loading ? (
          <Loader2
            className={cn('animate-spin shrink-0', iconSizeClasses[size])}
            aria-hidden="true"
          />
        ) : (
          leftIcon && (
            <span className={cn('shrink-0', iconSizeClasses[size])} aria-hidden="true">
              {leftIcon}
            </span>
          )
        )}

        {/* Label */}
        {children && <span className="truncate">{children}</span>}

        {/* Right icon (hidden when loading) */}
        {!loading && rightIcon && (
          <span className={cn('shrink-0', iconSizeClasses[size])} aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
