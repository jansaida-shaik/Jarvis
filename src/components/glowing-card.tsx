import React from 'react';

interface GlowingCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  headerActions?: React.ReactNode;
}

export default function GlowingCard({
  children,
  title,
  subtitle,
  className = '',
  headerActions,
}: GlowingCardProps) {
  return (
    <div
      className={`glass glow-border rounded-2xl p-5 border border-[rgba(255,255,255,0.05)] transition-all duration-300 flex flex-col gap-4 relative overflow-hidden ${className}`}
    >
      {/* Background radial accent glow */}
      <div className="absolute -right-12 -top-12 w-24 h-24 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none" />

      {/* Card Header */}
      {(title || subtitle || headerActions) && (
        <div className="flex items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.04)] pb-3">
          <div className="flex flex-col gap-0.5">
            {title && (
              <h3 className="font-semibold text-white tracking-wide text-md">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-400 font-medium">
                {subtitle}
              </p>
            )}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      )}

      {/* Card Body */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10">
        {children}
      </div>
    </div>
  );
}
