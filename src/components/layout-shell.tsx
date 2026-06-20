'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './sidebar';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const isAuthPage = pathname?.startsWith('/auth');

  useEffect(() => {
    // Read the auth_token cookie
    const hasToken = typeof document !== 'undefined' && document.cookie.split(';').some((item) => item.trim().startsWith('auth_token='));
    
    const timer = setTimeout(() => {
      if (!hasToken && !isAuthPage) {
        setIsAuthenticated(false);
        router.push('/auth/login');
      } else {
        setIsAuthenticated(true);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [pathname, isAuthPage, router]);

  // Prevent flash of content on protected routes
  if (isAuthenticated === null && !isAuthPage) {
    return (
      <div className="min-h-screen bg-[#05050a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 animate-spin" />
          <span className="text-[10px] text-indigo-400 font-mono tracking-widest uppercase">BOOTING JARVIS...</span>
        </div>
      </div>
    );
  }

  if (isAuthPage) {
    return <main className="flex-1 flex flex-col min-h-screen bg-background">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-y-auto p-6 md:p-10 relative">
        {/* Floating gradient orb in backdrop */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
          {children}
        </div>
      </main>
    </div>
  );
}
