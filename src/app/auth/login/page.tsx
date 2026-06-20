'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Login success: cookies set by server. Force redirect to dashboard.
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const autofillDemo = () => {
    setEmail('jansaida1234@gmail.com');
    setPassword('password123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#05050a]">
      {/* Background glowing decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md glass rounded-3xl p-8 border border-[rgba(99,102,241,0.15)] shadow-2xl relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center gap-2.5 text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-white font-extrabold text-2xl">J</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide mt-2">Welcome to Jarvis</h1>
          <p className="text-xs text-slate-400">Initialize your personal AI operating system</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 flex items-center gap-3 text-red-300 text-xs mb-6 animate-pulse">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold font-mono">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full pl-10 pr-4 py-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold font-mono">
              Access Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl text-sm cursor-pointer shadow-lg shadow-indigo-500/20 hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              'Connect Console'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[rgba(255,255,255,0.04)] flex flex-col gap-3 items-center">
          <p className="text-[11px] text-slate-500">Evaluating client sandbox?</p>
          <button
            type="button"
            onClick={autofillDemo}
            className="text-xs bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.2)] text-indigo-300 font-mono px-4 py-2.5 rounded-xl hover:bg-[rgba(99,102,241,0.15)] active:scale-95 cursor-pointer transition-all"
          >
            Autofill seeded credentials
          </button>
        </div>
      </div>
    </div>
  );
}
