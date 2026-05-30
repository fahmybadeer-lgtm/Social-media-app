'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlatformVariant = 'facebook' | 'instagram' | 'tiktok' | 'linkedin';
export type StatusVariant = 'success' | 'warning' | 'error' | 'default';
export type BadgeVariant = PlatformVariant | StatusVariant;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

/**
 * Platform badges:
 *   facebook  – blue (matches Meta brand blue)
 *   instagram – pink-to-purple gradient text on a faint gradient bg
 *   tiktok    – white text on near-black with a subtle border
 *   linkedin  – LinkedIn blue
 *
 * Status badges:
 *   success – green
 *   warning – amber
 *   error   – red
 *   default – gray
 */
const variantClasses: Record<BadgeVariant, string> = {
  // ── Platform ──────────────────────────────────────────────────────────────
  facebook:
    'bg-blue-600/15 text-blue-400 border border-blue-600/30',
  instagram:
    'bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-orange-400/10 border border-pink-500/30 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-orange-400',
  tiktok:
    'bg-[#111111] text-white border border-[#1A1A1A]',
  linkedin:
    'bg-blue-700/15 text-blue-300 border border-blue-700/30',
  // ── Status ────────────────────────────────────────────────────────────────
  success:
    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  warning:
    'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  error:
    'bg-red-500/15 text-red-400 border border-red-500/30',
  default:
    'bg-[rgba(201,168,76,0.15)] text-[#C9A84C] border border-[#C9A84C]/30',
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5 rounded-md',
  md: 'text-sm px-2.5 py-1 rounded-lg',
};

// Human-readable labels for platform variants
const platformLabels: Record<PlatformVariant, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};

// ---------------------------------------------------------------------------
// Helper – Instagram needs special treatment because bg-clip-text requires
// the gradient to be set on the element that also has text-transparent.
// We split this into a wrapper + inner span so the border/bg container does
// not clip its own background accidentally.
// ---------------------------------------------------------------------------

function InstagramBadge({
  size = 'md',
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium',
        sizeClasses[size],
        // Container: faint gradient background + border
        'bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-orange-400/10',
        'border border-pink-500/30',
        className
      )}
      {...rest}
    >
      {/* Inner span handles gradient text */}
      <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-orange-400 bg-clip-text text-transparent">
        {children ?? platformLabels.instagram}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Badge({
  variant = 'default',
  size = 'sm',
  className,
  children,
  ...rest
}: BadgeProps) {
  // Instagram gets its own render path due to bg-clip-text complexity
  if (variant === 'instagram') {
    return (
      <InstagramBadge size={size} className={className} {...rest}>
        {children}
      </InstagramBadge>
    );
  }

  // Resolve display label for platform variants when no children provided
  const isPlatform = (v: BadgeVariant): v is PlatformVariant =>
    v in platformLabels;

  const label =
    children ?? (isPlatform(variant) ? platformLabels[variant] : undefined);

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...rest}
    >
      {label}
    </span>
  );
}

export default Badge;
