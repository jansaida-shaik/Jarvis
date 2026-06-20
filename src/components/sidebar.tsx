'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  Mic,
  Target,
  GraduationCap,
  Briefcase,
  Database,
  Brain,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  TrendingUp
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'AI Chat', href: '/chat', icon: MessageSquare },
  { name: 'Voice Companion', href: '/voice', icon: Mic },
  { name: 'Executive Intel', href: '/executive', icon: TrendingUp },
  { name: 'Cognitive Profile', href: '/profile', icon: User },
  { name: 'Memory OS', href: '/memories', icon: Brain },
  { name: 'Goals', href: '/goals', icon: Target },
  { name: 'Learning Hub', href: '/learning', icon: GraduationCap },
  { name: 'Projects', href: '/projects', icon: Briefcase },
  { name: 'Knowledge', href: '/knowledge', icon: Database },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    // Clear cookie by calling authentication route or simple document.cookie update
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/auth/login');
  };

  return (
    <aside
      className={`h-screen border-r border-[rgba(99,102,241,0.12)] glass flex flex-col justify-between transition-all duration-300 relative z-30 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Collapse Trigger Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-8 -right-3 w-6 h-6 rounded-full border border-[rgba(99,102,241,0.2)] bg-[#0c0c1e] flex items-center justify-center cursor-pointer text-indigo-400 hover:text-indigo-300 hover:scale-105 transition-transform"
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Brand Logo / Section */}
      <div>
        <div className="p-6 flex items-center gap-3 border-b border-[rgba(255,255,255,0.04)]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold text-lg">J</span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-white text-md tracking-wider">JARVIS</span>
              <span className="text-[10px] text-indigo-400 font-mono">JARVIS OS v1.0</span>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="p-4 flex flex-col gap-1.5 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-[rgba(99,102,241,0.15)] to-[rgba(139,92,246,0.05)] text-indigo-300 border-l-2 border-indigo-500 shadow-md shadow-indigo-500/5'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[rgba(255,255,255,0.02)]'
                }`}
              >
                <Icon
                  size={19}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'
                  }`}
                />
                {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}

                {/* Collapsed Tooltip */}
                {isCollapsed && (
                  <div className="absolute left-16 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 bg-[#0c0c1e] text-indigo-300 border border-[rgba(99,102,241,0.2)] text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl z-50">
                    {item.name}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Information & Log out */}
      <div className="p-4 border-t border-[rgba(255,255,255,0.04)] flex flex-col gap-2">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : 'px-2 py-1'}`}>
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 border border-[rgba(99,102,241,0.2)] flex items-center justify-center">
            {/* Mock User Avatar */}
            <User size={18} className="text-slate-300" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <span className="font-semibold text-white text-xs truncate">Jan</span>
              <span className="text-[10px] text-slate-500 truncate">jansaida1234@gmail.com</span>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-slate-400 hover:text-red-400 hover:bg-[rgba(239,68,68,0.05)] cursor-pointer group relative ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut size={18} className="text-slate-400 group-hover:text-red-400" />
          {!isCollapsed && <span className="text-xs font-semibold">Sign Out</span>}
          {isCollapsed && (
            <div className="absolute left-16 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 bg-[#0c0c1e] text-red-400 border border-red-500/20 text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl z-50">
              Sign Out
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
