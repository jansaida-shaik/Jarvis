'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  GraduationCap,
  Briefcase,
  GitBranch,
  Target,
  Brain,
  ChevronRight,
  Activity,
  Award,
  BookOpen
} from 'lucide-react';
import GlowingCard from '@/components/glowing-card';
import { VoiceManager, VoiceState } from '@/lib/voice-manager';

interface Goal {
  id: string;
  title: string;
  category: string;
  progress: number;
}

interface Memory {
  id: string;
  content: string;
  category: string;
}

export default function VoicePage() {
  const router = useRouter();
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [transcript, setTranscript] = useState('');
  const [responseChunks, setResponseChunks] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'general' | 'learning' | 'career' | 'decision'>('general');
  const [premiumVoice, setPremiumVoice] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  
  // Waveform animation helpers
  const [waveBars, setWaveBars] = useState<number[]>(new Array(16).fill(10));
  const animationRef = useRef<number | null>(null);

  const voiceManagerRef = useRef<VoiceManager | null>(null);

  // Fetch background details for context list
  const fetchContextData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setGoals(data.activeGoals || []);
        setMemories(data.recentMemories || []);
      }
    } catch (e) {
      console.warn('Failed to load dashboard context data:', e);
    }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContextData();
    }, 0);
    
    // Initialize VoiceManager
    voiceManagerRef.current = new VoiceManager({
      onStateChange: (state) => {
        setVoiceState(state);
      },
      onTranscriptChange: (text, isFinal) => {
        setTranscript(text);
      },
      onResponseChunk: (text) => {
        setResponseChunks(text);
      },
      onFinishedResponse: () => {
        setTranscript('');
      },
      onError: (err) => {
        setErrorMsg(err);
        setTimeout(() => setErrorMsg(null), 5000);
      },
      mode: activeMode,
      premiumVoice: premiumVoice
    });

    return () => {
      clearTimeout(timer);
      if (voiceManagerRef.current) {
        voiceManagerRef.current.stopSession();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync mode changes with voice manager instance
  useEffect(() => {
    if (voiceManagerRef.current) {
      voiceManagerRef.current.setMode(activeMode);
    }
  }, [activeMode]);

  // Waveform animator
  useEffect(() => {
    if (voiceState === 'LISTENING') {
      const interval = setInterval(() => {
        setWaveBars(new Array(16).fill(0).map(() => Math.floor(Math.random() * 45) + 15));
      }, 90);
      return () => clearInterval(interval);
    } else if (voiceState === 'SPEAKING') {
      const interval = setInterval(() => {
        setWaveBars(new Array(16).fill(0).map(() => Math.floor(Math.random() * 60) + 20));
      }, 70);
      return () => clearInterval(interval);
    } else if (voiceState === 'THINKING') {
      // Flowing ripple wave
      let step = 0;
      const interval = setInterval(() => {
        step = (step + 1) % 16;
        setWaveBars(new Array(16).fill(0).map((_, i) => {
          const distance = Math.abs(i - step);
          return Math.max(10, 40 - distance * 4);
        }));
      }, 80);
      return () => clearInterval(interval);
    } else {
      const timer = setTimeout(() => {
        setWaveBars(new Array(16).fill(8));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [voiceState]);

  const handleStartStop = () => {
    if (!voiceManagerRef.current) return;
    voiceManagerRef.current.toggleSession();
  };

  const handleInterruptClick = () => {
    if (voiceManagerRef.current && voiceState === 'SPEAKING') {
      voiceManagerRef.current.interrupt();
    }
  };

  const triggerMockPrompt = (text: string) => {
    setTranscript(text);
    if (voiceManagerRef.current) {
      // Ensure session is active
      voiceManagerRef.current.startSession();
      // Directly submit prompt
      voiceManagerRef.current.submitPrompt(text);
    }
  };

  const getStateDetails = () => {
    switch (voiceState) {
      case 'LISTENING':
        return { label: 'Listening...', color: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5' };
      case 'THINKING':
        return { label: 'Thinking...', color: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5 animate-pulse' };
      case 'SPEAKING':
        return { label: 'Jarvis is speaking...', color: 'text-purple-400 border-purple-500/20 bg-purple-500/5' };
      default:
        return { label: 'Ready (Click to Start)', color: 'text-slate-500 border-slate-500/10 bg-slate-500/5' };
    }
  };

  const stateInfo = getStateDetails();

  return (
    <div className="flex flex-col gap-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[rgba(255,255,255,0.04)] pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Voice Companion <span className="text-purple-400 glow-text font-light">Jarvis OS</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Natural voice dialogue with your intelligent learning mentor and career advisor.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs p-3.5 rounded-xl font-mono">
          {errorMsg}
        </div>
      )}

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Panels: Interactive Voice Orb and Transcript monitor */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Pulsating Orb Card */}
          <div className="glass rounded-3xl border border-[rgba(255,255,255,0.05)] p-8 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-b from-slate-950/20 to-black/40 min-h-[450px]">
            
            {/* Background glowing gradients */}
            <div className={`absolute w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-1000 -translate-y-10 ${
              voiceState === 'LISTENING' ? 'bg-cyan-500/10' :
              voiceState === 'THINKING' ? 'bg-indigo-500/10 animate-pulse' :
              voiceState === 'SPEAKING' ? 'bg-purple-500/10' : 'bg-slate-500/5'
            }`} />

            {/* Mode Indicator Overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">ACTIVE STREAM:</span>
              <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded">
                {activeMode} coach
              </span>
            </div>

            {/* Status tag */}
            <div className={`absolute top-4 right-4 text-[10px] font-mono font-bold px-2.5 py-1 border rounded-lg uppercase tracking-wide transition-all duration-300 ${stateInfo.color}`}>
              {stateInfo.label}
            </div>

            {/* Interactive Pulse Orb */}
            <div className="flex flex-col items-center gap-8 z-10">
              
              {/* Outer pulsing ring */}
              <div 
                onClick={handleStartStop}
                className={`w-36 h-36 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 border relative ${
                  voiceState === 'LISTENING' 
                    ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20 scale-105' 
                    : voiceState === 'THINKING'
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20 rotate-180 duration-1000'
                    : voiceState === 'SPEAKING'
                    ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20 scale-110'
                    : 'border-slate-800 bg-slate-900/60 hover:border-indigo-500 hover:bg-slate-900 shadow-xl'
                }`}
              >
                {/* Floating Ripple rings for listening mode */}
                {voiceState === 'LISTENING' && (
                  <>
                    <div className="absolute inset-0 rounded-full border border-cyan-500/60 animate-ping opacity-60" style={{ animationDuration: '1.5s' }} />
                    <div className="absolute inset-2 rounded-full border border-cyan-400/40 animate-ping opacity-45" style={{ animationDuration: '2s' }} />
                  </>
                )}

                {/* Floating Ripple rings for speaking mode */}
                {voiceState === 'SPEAKING' && (
                  <>
                    <div className="absolute inset-0 rounded-full border border-purple-500/60 animate-ping opacity-60" style={{ animationDuration: '1.2s' }} />
                    <div className="absolute inset-2 rounded-full border border-purple-400/40 animate-ping opacity-45" style={{ animationDuration: '1.8s' }} />
                  </>
                )}

                {/* Center Core Button */}
                <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 bg-slate-950/80 border ${
                  voiceState === 'LISTENING' ? 'border-cyan-400 text-cyan-400' :
                  voiceState === 'THINKING' ? 'border-indigo-400 text-indigo-400' :
                  voiceState === 'SPEAKING' ? 'border-purple-400 text-purple-400 animate-pulse' :
                  'border-slate-800 text-slate-400 group-hover:text-slate-200'
                }`}>
                  {voiceState === 'LISTENING' ? <Mic size={36} /> :
                   voiceState === 'SPEAKING' ? <Volume2 size={36} /> :
                   voiceState === 'THINKING' ? <Sparkles size={36} className="animate-spin" style={{ animationDuration: '3s' }} /> :
                   <MicOff size={36} />}
                </div>
              </div>

              {/* Pulsing Graphic Waveform Bars */}
              <div className="flex items-center justify-center gap-1.5 h-16 min-w-[240px]">
                {waveBars.map((height, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-100 ${
                      voiceState === 'LISTENING' ? 'bg-cyan-400/80 shadow-[0_0_8px_rgba(34,211,238,0.4)]' :
                      voiceState === 'THINKING' ? 'bg-indigo-400/80 shadow-[0_0_8px_rgba(99,102,241,0.4)]' :
                      voiceState === 'SPEAKING' ? 'bg-purple-400/80 shadow-[0_0_8px_rgba(168,85,247,0.4)]' :
                      'bg-slate-800'
                    }`}
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handleStartStop}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-xs border transition-all cursor-pointer ${
                    voiceState !== 'IDLE'
                      ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15'
                      : 'bg-indigo-500 text-white hover:brightness-110 shadow-lg shadow-indigo-500/15'
                  }`}
                >
                  {voiceState !== 'IDLE' ? 'Disconnect OS' : 'Initialize Voice'}
                </button>

                {voiceState === 'SPEAKING' && (
                  <button
                    onClick={handleInterruptClick}
                    className="px-5 py-2.5 rounded-xl font-semibold text-xs border border-purple-500/20 bg-purple-500/10 text-purple-400 hover:bg-purple-500/15 cursor-pointer flex items-center gap-1.5"
                  >
                    <VolumeX size={12} /> Interrupt AI
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Mode Selector and Scrolling Text Streams */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Mode selectors */}
            <div className="md:col-span-1 flex flex-col gap-2">
              <span className="text-[10px] font-mono tracking-wider font-bold text-slate-500">DIAGNOSTIC MODE</span>
              {([
                { id: 'general', name: 'General', icon: Sparkles },
                { id: 'learning', name: 'Learning', icon: GraduationCap },
                { id: 'career', name: 'Career Coach', icon: Briefcase },
                { id: 'decision', name: 'Decision Advisor', icon: GitBranch },
              ] as const).map((m) => {
                const Icon = m.icon;
                const isActive = activeMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActiveMode(m.id)}
                    className={`flex items-center gap-2.5 text-xs font-semibold px-4 py-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[rgba(99,102,241,0.08)] border-[rgba(99,102,241,0.25)] text-indigo-300 shadow-sm shadow-indigo-500/5'
                        : 'border-[rgba(255,255,255,0.04)] bg-black/10 text-slate-400 hover:text-slate-200 hover:bg-[rgba(255,255,255,0.02)]'
                    }`}
                  >
                    <Icon size={14} className={isActive ? 'text-indigo-400' : 'text-slate-500'} />
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrolling logs monitor */}
            <div className="md:col-span-3 flex flex-col gap-2">
              <span className="text-[10px] font-mono tracking-wider font-bold text-slate-500">SPEECH ACTIVITY STREAM</span>
              <div className="glass rounded-2xl border border-[rgba(255,255,255,0.04)] bg-black/20 p-4 h-[210px] overflow-y-auto flex flex-col gap-3 font-mono text-xs leading-relaxed text-slate-400">
                {transcript ? (
                  <div className="flex flex-col gap-0.5 self-end text-right max-w-[90%]">
                    <span className="text-[8px] font-bold text-cyan-500 tracking-wider">YOU (Speaking)</span>
                    <span className="text-cyan-200 bg-cyan-950/20 border border-cyan-500/10 px-3 py-2 rounded-xl rounded-tr-none block text-sm">
                      {transcript}
                    </span>
                  </div>
                ) : null}

                {responseChunks ? (
                  <div className="flex flex-col gap-0.5 self-start text-left max-w-[90%] animate-fade-in">
                    <span className="text-[8px] font-bold text-purple-500 tracking-wider">JARVIS OS</span>
                    <span className="text-slate-100 bg-purple-950/10 border border-purple-500/10 px-3 py-2 rounded-xl rounded-tl-none block text-sm">
                      {responseChunks}
                    </span>
                  </div>
                ) : null}

                {!transcript && !responseChunks && (
                  <div className="text-[10px] text-slate-600 text-center my-auto flex flex-col items-center justify-center gap-2">
                    <Activity size={16} className="text-slate-700 animate-pulse" />
                    <span>Silent index. Say something to activate transmission.</span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Right Panel: Insights and overrides */}
        <div className="flex flex-col gap-6">

          {/* Quick Voice simulation buttons */}
          <GlowingCard title="Quick Topic Overrides" subtitle="Trigger voice flows with single click tests">
            <div className="flex flex-col gap-2.5 mt-2">
              {([
                { title: 'Explain Left Join', mode: 'learning', text: 'Explain left join' },
                { title: 'Recommend Next Study Topic', mode: 'career', text: 'What should I learn next?' },
                { title: 'Zoho CRM vs Badminton Platform', mode: 'decision', text: 'I am confused between Zoho CRM, AI and my badminton platform' },
                { title: 'Tell me about Canada', mode: 'general', text: 'Tell me about Canada' },
                { title: 'What is Next.js?', mode: 'general', text: 'What is Next.js?' }
              ] as const).map((over, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveMode(over.mode);
                    triggerMockPrompt(over.text);
                  }}
                  className="flex items-center justify-between text-left p-3.5 rounded-xl bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] hover:bg-[rgba(99,102,241,0.04)] hover:border-[rgba(99,102,241,0.2)] cursor-pointer group transition-all"
                >
                  <div className="flex flex-col gap-0.5 truncate">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">{over.title}</span>
                    <span className="text-[9px] font-mono text-slate-500 uppercase">{over.mode} mode</span>
                  </div>
                  <ChevronRight size={13} className="text-slate-600 group-hover:text-indigo-400 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </GlowingCard>

          {/* User profile focus context */}
          <GlowingCard title="Persistent Context Node" subtitle="Active cognitive profile values loaded in system prompt">
            <div className="flex flex-col gap-3.5 mt-2 font-mono text-[10px] text-slate-400 leading-normal">
              
              <div className="p-3 bg-black/30 border border-slate-900 rounded-lg flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
                  <Brain size={12} /> MEMORY MARKERS (Cosmic)
                </div>
                {memories.length === 0 ? (
                  <span className="text-slate-600">No indexed logs.</span>
                ) : (
                  memories.slice(0, 3).map(m => (
                    <div key={m.id} className="border-l border-slate-800 pl-2">
                      &quot;{m.content.slice(0, 60)}...&quot;
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-black/30 border border-slate-900 rounded-lg flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <Target size={12} /> PERSISTENT GOALS
                </div>
                {goals.length === 0 ? (
                  <span className="text-slate-600">No active goals.</span>
                ) : (
                  goals.slice(0, 2).map(g => (
                    <div key={g.id} className="flex flex-col gap-0.5">
                      <span className="font-semibold text-slate-300">{g.title}</span>
                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${g.progress}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          </GlowingCard>

          {/* Diagnostic indicators */}
          <GlowingCard title="Companion Hardware Status">
            <div className="flex flex-col gap-2.5 mt-2 font-mono text-[10px]">
              {[
                { name: 'Browser Web Speech API', val: 'ONLINE', valColor: 'text-emerald-400 bg-emerald-500/5' },
                { name: 'Hardware Microphone', val: 'READY', valColor: 'text-emerald-400 bg-emerald-500/5' },
                { name: 'Echo Cancellation VAD', val: 'ACTIVE', valColor: 'text-emerald-400 bg-emerald-500/5' },
                { name: 'Zero-Key Offline fallback', val: 'ACTIVE', valColor: 'text-cyan-400 bg-cyan-500/5' }
              ].map((diag, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 border-b border-[rgba(255,255,255,0.02)]">
                  <span className="text-slate-500">{diag.name}</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${diag.valColor}`}>{diag.val}</span>
                </div>
              ))}
            </div>
          </GlowingCard>

        </div>

      </div>
    </div>
  );
}
