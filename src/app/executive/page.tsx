'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Target,
  GraduationCap,
  Briefcase,
  Compass,
  Zap,
  Clock,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import GlowingCard from '@/components/glowing-card';

interface ExecutiveInsight {
  id: string;
  type: string;
  title: string;
  insight: string;
  confidence: number;
  evidenceJson: string;
  recommendation: string;
  status: string;
  followUpStatus: string;
  createdAt: string;
}

interface Briefing {
  id: string;
  timeframe: string;
  summary: string;
  insightsJson: string;
  recommendationsJson: string;
  createdAt: string;
}

export default function ExecutiveBriefsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // States
  const [dailyBrief, setDailyBrief] = useState<Briefing | null>(null);
  const [weeklyBrief, setWeeklyBrief] = useState<Briefing | null>(null);
  const [monthlyBrief, setMonthlyBrief] = useState<Briefing | null>(null);
  const [insights, setInsights] = useState<ExecutiveInsight[]>([]);

  // Briefing tab selection: 'daily' | 'weekly' | 'monthly'
  const [briefTab, setBriefTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const fetchBriefingsData = async () => {
    try {
      const res = await fetch('/api/executive/briefings');
      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to load executive briefs');
      const data = await res.json();
      setDailyBrief(data.dailyBrief);
      setWeeklyBrief(data.weeklyBrief);
      setMonthlyBrief(data.monthlyBrief);
      setInsights(data.insights || []);
    } catch (err) {
      console.error('Error fetching briefs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBriefingsData();
  }, []);

  const handleSyncBriefings = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/executive/briefings', { method: 'POST' });
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      setDailyBrief(data.dailyBrief);
      setWeeklyBrief(data.weeklyBrief);
      setMonthlyBrief(data.monthlyBrief);
      setInsights(data.insights || []);
    } catch (err) {
      console.error('Sync briefings error:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleActionInsight = async (insightId: string, action: 'dismiss' | 'resolve' | 'update-followup', value?: string) => {
    try {
      const res = await fetch('/api/executive/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId, action, value }),
      });
      if (!res.ok) throw new Error('Failed to perform action');

      // Update state locally
      if (action === 'dismiss' || action === 'resolve') {
        setInsights(prev => prev.filter(ins => ins.id !== insightId));
      } else if (action === 'update-followup' && value) {
        setInsights(prev => prev.map(ins => ins.id === insightId ? { ...ins, followUpStatus: value } : ins));
      }
    } catch (err) {
      console.error('Insight action error:', err);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'GOAL_DRIFT': return <Target size={18} className="text-amber-400" />;
      case 'LEARNING_GAP': return <GraduationCap size={18} className="text-purple-400" />;
      case 'PROJECT_RISK': return <Briefcase size={18} className="text-red-400" />;
      case 'DECISION_PATTERN': return <Compass size={18} className="text-yellow-400" />;
      case 'OPPORTUNITY': return <Zap size={18} className="text-emerald-400" />;
      default: return <ShieldAlert size={18} className="text-indigo-400" />;
    }
  };

  const getConfidenceBadgeColor = (score: number) => {
    if (score >= 0.85) return 'text-emerald-400 bg-emerald-500/5 border-emerald-500/25';
    if (score >= 0.70) return 'text-amber-400 bg-amber-500/5 border-amber-500/25';
    return 'text-red-400 bg-red-500/5 border-red-500/25';
  };

  // Convert markdown/narrative briefings text to HTML paragraph structure
  const formatBriefingText = (text: string) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('###')) {
        return <h4 key={idx} className="text-sm font-bold text-white tracking-wide mt-4 mb-2 first:mt-0 font-mono uppercase">{trimmed.replace('###', '').trim()}</h4>;
      }
      if (trimmed.startsWith('##')) {
        return <h3 key={idx} className="text-md font-extrabold text-white tracking-tight mt-5 mb-2 first:mt-0 uppercase">{trimmed.replace('##', '').trim()}</h3>;
      }
      if (trimmed.startsWith('#')) {
        return <h2 key={idx} className="text-lg font-black text-indigo-400 tracking-tight mt-6 mb-3 first:mt-0 uppercase">{trimmed.replace('#', '').trim()}</h2>;
      }
      if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        // Simple bullet
        const content = trimmed.substring(1).trim();
        // check for bold inside bullet
        if (content.startsWith('**') && content.includes('**:')) {
          const parts = content.split('**:');
          const boldPart = parts[0].replace('**', '').trim();
          const regularPart = parts.slice(1).join('**:').trim();
          return (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 font-medium leading-relaxed pl-3 py-1 font-sans">
              <span className="text-indigo-400 mt-1">&bull;</span>
              <span><strong>{boldPart}</strong>: {regularPart}</span>
            </div>
          );
        }
        return (
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 font-medium leading-relaxed pl-3 py-1 font-sans">
            <span className="text-indigo-400 mt-1">&bull;</span>
            <span>{content}</span>
          </div>
        );
      }
      if (trimmed === '') return <div key={idx} className="h-2" />;
      return <p key={idx} className="text-xs text-slate-300 leading-relaxed py-1 font-medium font-sans">{trimmed}</p>;
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 animate-spin" />
          <span className="text-xs text-slate-500 font-mono tracking-wider">LOADING EXECUTIVE SUITE...</span>
        </div>
      </div>
    );
  }

  const activeBrief = briefTab === 'daily' ? dailyBrief : briefTab === 'weekly' ? weeklyBrief : monthlyBrief;

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Top Banner Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[rgba(255,255,255,0.04)] pb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              Executive Suite
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Diagnostic v1.0 &bull; Active Analysis
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Autonomous Executive Intel <span className="text-indigo-400 glow-text font-light">Briefs</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Proactive trend audits, priority drift tracking, project risk scans, and opportunity triggers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncBriefings}
            disabled={syncing}
            className="flex items-center gap-2 text-xs font-semibold px-4.5 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)] text-slate-300 hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin text-indigo-400' : ''} />
            Re-run Analysis Scans
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Briefings Room */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <GlowingCard
            title="Strategic Review Briefings"
            subtitle="Calculated summaries of personal drift metrics and timeline projections"
            headerActions={
              <div className="flex items-center bg-slate-950 border border-slate-900 rounded-lg p-0.5">
                <button
                  onClick={() => setBriefTab('daily')}
                  className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                    briefTab === 'daily' ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  DAILY
                </button>
                <button
                  onClick={() => setBriefTab('weekly')}
                  className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                    briefTab === 'weekly' ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  WEEKLY
                </button>
                <button
                  onClick={() => setBriefTab('monthly')}
                  className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                    briefTab === 'monthly' ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  MONTHLY
                </button>
              </div>
            }
          >
            <div className="p-4 mt-3 rounded-2xl bg-slate-950/40 border border-slate-900/60 shadow-inner">
              {!activeBrief ? (
                <div className="text-xs text-slate-500 py-12 text-center font-mono">
                  No briefings compiled for the selected timeframe. Click &ldquo;Re-run Analysis Scans&rdquo; to analyze your workspace.
                </div>
              ) : (
                <div className="flex flex-col gap-2 font-mono">
                  <div className="flex justify-between items-center border-b border-slate-900 pb-3 mb-3">
                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Timeframe: {activeBrief.timeframe} STRATEGIC BRIEFING
                    </span>
                    <span className="text-[9px] text-slate-500">
                      Compiled: {new Date(activeBrief.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="pr-1 max-h-[60vh] overflow-y-auto">
                    {formatBriefingText(activeBrief.summary)}
                  </div>
                </div>
              )}
            </div>
          </GlowingCard>

          {/* Quick Metrics KPI Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass border border-slate-900 rounded-2xl p-4.5 flex flex-col gap-1.5">
              <span className="text-[9px] uppercase font-mono font-bold text-slate-500 tracking-wider">Goal Alignment</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">
                  {dailyBrief ? '75%' : '100%'}
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 font-mono">&uarr; Optimal</span>
              </div>
              <div className="w-full h-1 bg-slate-900 rounded-full mt-1 overflow-hidden border border-slate-800/40">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: dailyBrief ? '75%' : '100%' }} />
              </div>
            </div>

            <div className="glass border border-slate-900 rounded-2xl p-4.5 flex flex-col gap-1.5">
              <span className="text-[9px] uppercase font-mono font-bold text-slate-500 tracking-wider">Unresolved Risks</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">
                  {insights.filter(i => i.type !== 'OPPORTUNITY').length}
                </span>
                <span className="text-[10px] font-semibold text-amber-400 font-mono">Warnings Active</span>
              </div>
              <div className="w-full h-1 bg-slate-900 rounded-full mt-1 overflow-hidden border border-slate-800/40">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '60%' }} />
              </div>
            </div>

            <div className="glass border border-slate-900 rounded-2xl p-4.5 flex flex-col gap-1.5">
              <span className="text-[9px] uppercase font-mono font-bold text-slate-500 tracking-wider">Growth Speed</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">
                  {insights.filter(i => i.type === 'OPPORTUNITY').length > 0 ? '+3' : 'Flat'}
                </span>
                <span className="text-[10px] font-semibold text-emerald-400 font-mono">Leverages Detected</span>
              </div>
              <div className="w-full h-1 bg-slate-900 rounded-full mt-1 overflow-hidden border border-slate-800/40">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '80%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Proactive Insights / Risk Feed */}
        <div className="flex flex-col gap-6">
          <GlowingCard
            title="Proactive Risk Feed"
            subtitle="Risk metrics sorted by calculated confidence prioritization"
          >
            <div className="flex flex-col gap-4 mt-3 max-h-[80vh] overflow-y-auto pr-1">
              {insights.length === 0 ? (
                <div className="text-xs text-slate-500 py-12 text-center font-mono border border-dashed border-slate-900 rounded-2xl">
                  All systems nominal. No risks detected in your workflow today.
                </div>
              ) : (
                insights.map((ins) => {
                  let evidence: string[] = [];
                  try { evidence = JSON.parse(ins.evidenceJson); } catch (e) {}

                  return (
                    <div
                      key={ins.id}
                      className="p-4.5 rounded-2xl bg-slate-950/40 border border-slate-900 hover:border-slate-800 transition-all flex flex-col gap-3.5 relative"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                            {getInsightIcon(ins.type)}
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-white tracking-wide uppercase font-mono">
                              {ins.type.replace('_', ' ')}
                            </h4>
                            <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                              Detected: {new Date(ins.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <span className={`text-[9px] font-bold px-1.5 py-0.5 border rounded uppercase font-mono ${getConfidenceBadgeColor(ins.confidence)}`}>
                          Confidence: {Math.round(ins.confidence * 100)}%
                        </span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <h5 className="text-xs font-bold text-indigo-300 leading-normal">
                          {ins.title}
                        </h5>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-medium mt-0.5">
                          {ins.insight}
                        </p>
                      </div>

                      {/* Evidence checklist */}
                      {evidence.length > 0 && (
                        <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-black/20 border border-slate-900/60">
                          <span className="text-[8px] uppercase font-mono font-bold text-slate-500 tracking-widest">Evidence Data Points</span>
                          <ul className="flex flex-col gap-1 list-none pl-0 mt-1">
                            {evidence.map((ev, idx) => (
                              <li key={idx} className="text-[10px] text-slate-400 font-mono flex items-start gap-1.5 leading-normal">
                                <span className="text-indigo-400 font-bold">&bull;</span>
                                <span>{ev}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recommendation */}
                      <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-1">
                        <span className="text-[8px] uppercase font-mono font-bold text-indigo-400 tracking-widest">Recommended Actions</span>
                        <p className="text-[11px] text-indigo-200 font-medium leading-relaxed mt-0.5">
                          {ins.recommendation}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between border-t border-slate-900/60 pt-3 mt-1.5 gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleActionInsight(ins.id, 'dismiss')}
                            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 cursor-pointer transition-colors"
                            title="Dismiss notification"
                          >
                            Dismiss
                          </button>
                          <button
                            onClick={() => handleActionInsight(ins.id, 'resolve')}
                            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer transition-colors"
                            title="Mark resolved"
                          >
                            Resolve
                          </button>
                        </div>

                        {/* Follow up status toggle */}
                        <button
                          onClick={() => handleActionInsight(
                            ins.id, 
                            'update-followup', 
                            ins.followUpStatus === 'PENDING' ? 'IN_PROGRESS' : 'PENDING'
                          )}
                          className={`text-[9px] font-mono font-bold px-2 py-1 rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
                            ins.followUpStatus === 'IN_PROGRESS'
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
                          }`}
                        >
                          <Clock size={9} />
                          {ins.followUpStatus === 'IN_PROGRESS' ? 'IN PROGRESS' : 'SET IN PROGRESS'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlowingCard>
        </div>

      </div>
    </div>
  );
}
