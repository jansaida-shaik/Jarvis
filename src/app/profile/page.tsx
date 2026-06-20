'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Brain,
  Target,
  GraduationCap,
  Briefcase,
  Compass,
  AlertTriangle,
  History,
  Trash2,
  Edit2,
  Plus,
  RefreshCw,
  Clock,
  Sparkles,
  Activity,
  Award,
  Zap,
  Eye
} from 'lucide-react';
import GlowingCard from '@/components/glowing-card';

interface ProfileEntry {
  id: string;
  layer: string;
  key: string;
  value: string;
  confidenceScore: number;
  source: string;
  updatedAt: string;
}

interface ProfileVersion {
  id: string;
  version: number;
  description: string;
  createdAt: string;
}

interface HistoryLog {
  id: string;
  entryId: string;
  oldValue: string | null;
  newValue: string;
  oldConfidence: number | null;
  newConfidence: number;
  changeType: string;
  reason: string | null;
  source: string;
  timestamp: string;
  entry: {
    layer: string;
    key: string;
  };
}

interface AuditLog {
  id: string;
  action: string;
  details: string;
  metadata: string | null;
  timestamp: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  
  // Data lists
  const [entries, setEntries] = useState<ProfileEntry[]>([]);
  const [versions, setVersions] = useState<ProfileVersion[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [learningProfile, setLearningProfile] = useState<any>(null);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  
  // UI Tabs: 'profile' | 'history' | 'versions'
  const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'versions'>('profile');
  
  // Editing modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [targetEntryId, setTargetEntryId] = useState<string | null>(null);
  const [editLayer, setEditLayer] = useState('IDENTITY');
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProfileData = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to load profile data');
      const data = await res.json();
      setProfileId(data.profileId);
      setEntries(data.entries);
      setVersions(data.versions);
      setHistoryLogs(data.history);
      setAuditLogs(data.auditLogs);
      setLearningProfile(data.learningProfile);
      setDecisions(data.decisions || []);
      setInsights(data.insights || []);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await fetchProfileData();
    setSyncing(false);
  };

  // Submit manual edit/create override
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editKey.trim() || !editValue.trim() || !editReason.trim()) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    try {
      // Determine if value is a JSON list or plain string
      let parsedValue: any = editValue;
      if (editValue.startsWith('[') && editValue.endsWith(']')) {
        try { parsedValue = JSON.parse(editValue); } catch (e) {}
      } else if (editValue.includes(',')) {
        parsedValue = editValue.split(',').map(s => s.trim()).filter(Boolean);
      }

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual-edit',
          layer: editLayer,
          key: editKey.trim().toLowerCase(),
          value: parsedValue,
          reason: editReason.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to save entry');
      }

      setIsEditModalOpen(false);
      resetModalFields();
      fetchProfileData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving entry');
    }
  };

  // Delete an entry manually
  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this profile entry?')) return;
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete-entry',
          entryId,
          reason: 'Manually deleted by user.',
        }),
      });
      if (!res.ok) throw new Error('Failed to delete entry');
      fetchProfileData();
    } catch (err) {
      console.error('Delete entry error:', err);
    }
  };

  // Restore snapshot version
  const handleRestoreVersion = async (versionId: string, versionNumber: number) => {
    if (!confirm(`Are you sure you want to roll back all profile details to Version ${versionNumber}?`)) return;
    try {
      const res = await fetch('/api/profile/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      if (!res.ok) throw new Error('Revert failed');
      fetchProfileData();
      alert(`Profile successfully rolled back to Version ${versionNumber}.`);
    } catch (err) {
      console.error('Revert error:', err);
      alert('Failed to roll back to snapshot version.');
    }
  };

  const openCreateModal = (layer: string) => {
    setModalMode('create');
    setEditLayer(layer);
    setEditKey('');
    setEditValue('');
    setEditReason('');
    setErrorMsg(null);
    setIsEditModalOpen(true);
  };

  const openEditModal = (entry: ProfileEntry) => {
    setModalMode('edit');
    setTargetEntryId(entry.id);
    setEditLayer(entry.layer);
    setEditKey(entry.key);
    
    // Formatting JSON display cleanly in input
    let parsedVal = entry.value;
    try {
      parsedVal = JSON.parse(entry.value);
      if (Array.isArray(parsedVal)) {
        parsedVal = parsedVal.join(', ');
      }
    } catch(e) {}
    
    setEditValue(typeof parsedVal === 'object' ? JSON.stringify(parsedVal) : String(parsedVal));
    setEditReason('');
    setErrorMsg(null);
    setIsEditModalOpen(true);
  };

  const resetModalFields = () => {
    setTargetEntryId(null);
    setEditLayer('IDENTITY');
    setEditKey('');
    setEditValue('');
    setEditReason('');
    setErrorMsg(null);
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20';
    if (score >= 0.5) return 'text-amber-400 bg-amber-500/5 border-amber-500/20';
    return 'text-red-400 bg-red-500/5 border-red-500/20';
  };

  // Group entries by layer for easy UI grids
  const getEntriesForLayer = (layerName: string) => {
    return entries.filter(e => e.layer === layerName);
  };

  // Humanize keys (e.g. current_role -> Current Role)
  const formatKeyName = (key: string) => {
    return key
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 animate-spin" />
          <span className="text-xs text-slate-500 font-mono tracking-wider">LOADING COGNITIVE PROFILE...</span>
        </div>
      </div>
    );
  }

  const layersList = [
    { name: 'IDENTITY', icon: User, desc: 'Personal bio and background markers' },
    { name: 'SKILLS', icon: Award, desc: 'Technical & soft skill inventories' },
    { name: 'LEARNING', icon: GraduationCap, desc: 'Preferences, study speed & knowledge gaps' },
    { name: 'CAREER', icon: Briefcase, desc: 'Target roles, salaries & roadmaps' },
    { name: 'DECISION', icon: Compass, desc: 'Logic, repeated errors & outcomes' },
    { name: 'PRODUCTIVITY', icon: Clock, desc: 'Habits, focal periods & daily routines' },
    { name: 'STRENGTHS', icon: Zap, desc: 'AI-observed & validated user strengths' },
    { name: 'WEAKNESS', icon: AlertTriangle, desc: 'Friction areas & study block factors' },
  ];

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Top Banner Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[rgba(255,255,255,0.04)] pb-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              Cognitive Engine
            </span>
            {versions.length > 0 && (
              <span className="text-[10px] font-mono text-slate-500">
                Active Profile Version: v{versions[0].version}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Personal Cognitive Profile <span className="text-indigo-400 glow-text font-light">Jarvis</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Building a persistent context layer of your habits, skills, targets, and strengths.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 text-xs font-semibold px-4.5 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)] text-slate-300 hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin text-indigo-400' : ''} />
            Refresh Engine
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[rgba(255,255,255,0.04)] pb-0.5 gap-6">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 text-sm font-semibold relative transition-colors cursor-pointer ${
            activeTab === 'profile' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Active Profile
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-semibold relative transition-colors cursor-pointer ${
            activeTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Change History Logs
        </button>
        <button
          onClick={() => setActiveTab('versions')}
          className={`pb-3 text-sm font-semibold relative transition-colors cursor-pointer ${
            activeTab === 'versions' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Version Snapshots ({versions.length})
        </button>
      </div>

      {/* Layout grids depending on tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Active Profile Layers Matrix */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Concept Mastery Matrix */}
            <GlowingCard 
              title="Concept Mastery Matrix" 
              subtitle="Long-term tracking of subject retention, confidence, and mastery status"
            >
              <div className="flex flex-col gap-4 mt-3">
                {(!learningProfile || !learningProfile.progress || learningProfile.progress.length === 0) ? (
                  <div className="text-xs text-slate-500 py-8 text-center font-mono">
                    No active concepts tracked yet. Speak with Jarvis about technical topics to begin indexing your understanding.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {learningProfile.progress.map((prog: any) => (
                      <div 
                        key={prog.id} 
                        className="p-4 rounded-xl bg-slate-950/40 border border-slate-900 hover:border-slate-800 transition-colors flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-sm font-bold text-white tracking-wide">{prog.topic}</h4>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Last session: {new Date(prog.lastReviewedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-md">
                            Reviews: {prog.reviewCount}
                          </span>
                        </div>

                        {/* Progress bars */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex justify-between text-[10px] font-mono text-slate-400">
                            <span>Understanding</span>
                            <span>{Math.round(prog.understandingScore * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                            <div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                              style={{ width: `${prog.understandingScore * 100}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-0.5">
                            <span>Confidence</span>
                            <span>{Math.round(prog.confidenceScore * 100)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                              style={{ width: `${prog.confidenceScore * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Masteries badges */}
                        {prog.masteries && prog.masteries.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-900/60">
                            {prog.masteries.map((m: any) => {
                              let badgeStyle = 'text-indigo-400 bg-indigo-500/5 border-indigo-500/15';
                              if (m.status === 'MASTERED') {
                                badgeStyle = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/15';
                              } else if (m.status === 'PARTIALLY_UNDERSTOOD') {
                                badgeStyle = 'text-amber-400 bg-amber-500/5 border-amber-500/15';
                              } else if (m.status === 'REPEATEDLY_MISUNDERSTOOD') {
                                badgeStyle = 'text-red-400 bg-red-500/5 border-red-500/15';
                              }
                              return (
                                <span 
                                  key={m.id} 
                                  className={`text-[10px] font-semibold border rounded-lg px-2.5 py-1 flex items-center gap-1.5 ${badgeStyle}`}
                                  title={`Misunderstood ${m.misunderstandCount} times`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    m.status === 'MASTERED' ? 'bg-emerald-400' :
                                    m.status === 'PARTIALLY_UNDERSTOOD' ? 'bg-amber-400' :
                                    m.status === 'REPEATEDLY_MISUNDERSTOOD' ? 'bg-red-400' :
                                    'bg-indigo-400'
                                  }`} />
                                  {m.concept} ({m.status.toLowerCase().replace('_', ' ')})
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlowingCard>

            {/* Decision Log Timeline */}
            <GlowingCard 
              title="Decision Tradeoffs Timeline" 
              subtitle="Historical record of alternatives, key tradeoffs, and core assumptions"
            >
              <div className="flex flex-col gap-4 mt-3">
                {decisions.length === 0 ? (
                  <div className="text-xs text-slate-500 py-8 text-center font-mono">
                    No decisions registered yet. Speak with Jarvis to analyze tradeoffs and log decisions.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {decisions.map((dec: any) => {
                      let options: string[] = [];
                      let tradeoffs: any = {};
                      let assumptions: string[] = [];
                      try { options = JSON.parse(dec.optionsJson); } catch (e) {}
                      try { tradeoffs = JSON.parse(dec.tradeoffsJson); } catch (e) {}
                      try { assumptions = JSON.parse(dec.assumptionsJson); } catch (e) {}

                      return (
                        <div 
                          key={dec.id} 
                          className="p-5 rounded-2xl bg-slate-950/40 border border-slate-900 flex flex-col gap-4 hover:border-slate-800 transition-colors"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h4 className="text-sm font-bold text-white tracking-wide">{dec.title}</h4>
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Logged: {new Date(dec.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <span className="text-[9px] font-mono font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-md">
                              {dec.status}
                            </span>
                          </div>

                          {/* Options list */}
                          {options.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 items-center">
                              <span className="text-[10px] uppercase font-mono font-semibold text-slate-500 mr-1.5">Options:</span>
                              {options.map((opt, idx) => (
                                <span key={idx} className="bg-slate-900 text-slate-300 border border-slate-800 px-2.5 py-0.5 rounded-md text-xs font-semibold">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Tradeoffs pros/cons tree */}
                          {((tradeoffs.pros && tradeoffs.pros.length > 0) || (tradeoffs.cons && tradeoffs.cons.length > 0)) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2.5 border-t border-slate-900/60">
                              {tradeoffs.pros && tradeoffs.pros.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 tracking-wider">Pros</span>
                                  <ul className="flex flex-col gap-1 list-none pl-0">
                                    {tradeoffs.pros.map((pro: string, idx: number) => (
                                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5 leading-relaxed font-medium">
                                        <span className="text-emerald-400 font-bold mt-0.5">+</span>
                                        <span>{pro}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {tradeoffs.cons && tradeoffs.cons.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-[10px] uppercase font-mono font-bold text-red-400 tracking-wider">Cons</span>
                                  <ul className="flex flex-col gap-1 list-none pl-0">
                                    {tradeoffs.cons.map((con: string, idx: number) => (
                                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5 leading-relaxed font-medium">
                                        <span className="text-red-400 font-bold mt-0.5">&minus;</span>
                                        <span>{con}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Assumptions */}
                          {assumptions.length > 0 && (
                            <div className="pt-2 border-t border-slate-900/60 flex flex-col gap-1.5">
                              <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">Underlying Assumptions</span>
                              <ul className="flex flex-col gap-1 list-disc pl-4 text-xs text-slate-300 leading-relaxed font-medium">
                                {assumptions.map((ass, idx) => (
                                  <li key={idx}>{ass}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Recommendation direction */}
                          <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-1">
                            <span className="text-[9px] uppercase font-mono font-bold text-indigo-400 tracking-widest">Recommended Strategy</span>
                            <p className="text-xs text-indigo-200 font-medium leading-relaxed">
                              {dec.recommendation}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </GlowingCard>

            {layersList.map((layer) => {
              const Icon = layer.icon;
              const layerEntries = getEntriesForLayer(layer.name);
              
              return (
                <GlowingCard
                  key={layer.name}
                  title={`${layer.name} LAYER`}
                  subtitle={layer.desc}
                  headerActions={
                    <button
                      onClick={() => openCreateModal(layer.name)}
                      className="text-xs bg-[rgba(99,102,241,0.06)] hover:bg-[rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.15)] text-indigo-400 font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus size={12} /> Add Override
                    </button>
                  }
                >
                  <div className="flex flex-col gap-3.5 mt-3">
                    {layerEntries.length === 0 ? (
                      <div className="text-xs text-slate-500 py-6 text-center font-mono">
                        No parameters detected in this layer yet. Speak to Jarvis or add manual parameters.
                      </div>
                    ) : (
                      layerEntries.map((entry) => {
                        let parsedVal = entry.value;
                        try { parsedVal = JSON.parse(entry.value); } catch(e) {}
                        
                        return (
                          <div
                            key={entry.id}
                            className="p-3.5 rounded-xl bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] hover:bg-[#080816]/60 hover:border-slate-800 transition-all flex flex-col gap-2 relative group"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                                {formatKeyName(entry.key)}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border rounded uppercase ${getConfidenceBadge(entry.confidenceScore)}`}>
                                  Confidence: {Math.round(entry.confidenceScore * 100)}%
                                </span>
                                <span className="text-[9px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                                  {entry.source}
                                </span>
                              </div>
                            </div>
                            
                            {/* Render content depending on value type */}
                            <div className="text-sm text-slate-200 pr-16 font-medium leading-relaxed">
                              {Array.isArray(parsedVal) ? (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {parsedVal.map((v, idx) => (
                                    <span key={idx} className="bg-indigo-500/5 text-indigo-300 border border-indigo-500/10 px-2 py-0.5 rounded-md text-xs font-semibold">
                                      {v}
                                    </span>
                                  ))}
                                </div>
                              ) : typeof parsedVal === 'boolean' ? (
                                <span className="font-mono text-indigo-400">{parsedVal ? 'ENABLED' : 'DISABLED'}</span>
                              ) : (
                                parsedVal
                              )}
                            </div>

                            {/* Hover Edit / Delete actions */}
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditModal(entry)}
                                className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/20 flex items-center justify-center text-slate-400 hover:text-indigo-400 cursor-pointer transition-colors"
                                title="Edit parameter override"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-red-950/40 border border-slate-800 hover:border-red-500/20 flex items-center justify-center text-slate-400 hover:text-red-400 cursor-pointer transition-colors"
                                title="Delete parameter"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </GlowingCard>
              );
            })}
          </div>

          {/* Audit Logging Column */}
          <div className="flex flex-col gap-6">
            
            {/* Contradiction / Attention Alerts */}
            {auditLogs.some(log => log.action === 'CONTRADICTION_DETECTED') && (
              <div className="glass rounded-2xl p-5 border border-red-500/20 bg-red-950/10 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertTriangle size={18} className="animate-bounce" />
                  <span className="font-bold text-sm tracking-wide">Contradictions Detected</span>
                </div>
                <p className="text-xs text-red-300 leading-relaxed font-medium">
                  The AI cognitive profile analyzer detected conflicting claims from your logs. Review details in the timeline feed below.
                </p>
              </div>
            )}

            {/* Proactive Coaching Feed */}
            {insights.length > 0 && (
              <GlowingCard title="Proactive Coaching Feed" subtitle="Jarvis's active mentorship guidance">
                <div className="flex flex-col gap-3.5 mt-3 max-h-[50vh] overflow-y-auto pr-1">
                  {insights.map((insight: any) => {
                    let alertColor = 'border-indigo-500/20 bg-indigo-950/10 text-indigo-400';
                    let badgeColor = 'text-indigo-400 bg-indigo-500/5 border-indigo-500/10';
                    if (insight.type === 'STALLED_GOAL') {
                      alertColor = 'border-amber-500/20 bg-amber-950/10 text-amber-400';
                      badgeColor = 'text-amber-400 bg-amber-500/5 border-amber-500/10';
                    } else if (insight.type === 'WEAK_LEARNING_AREA') {
                      alertColor = 'border-purple-500/20 bg-purple-950/10 text-purple-400';
                      badgeColor = 'text-purple-400 bg-purple-500/5 border-purple-500/10';
                    } else if (insight.type === 'REPEATED_MISTAKE') {
                      alertColor = 'border-red-500/20 bg-red-950/10 text-red-400';
                      badgeColor = 'text-red-400 bg-red-500/5 border-red-500/10';
                    } else if (insight.type === 'MISSING_SKILL') {
                      alertColor = 'border-sky-500/20 bg-sky-950/10 text-sky-400';
                      badgeColor = 'text-sky-400 bg-sky-500/5 border-sky-500/10';
                    }
                    
                    return (
                      <div
                        key={insight.id}
                        className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${
                          insight.status === 'RESOLVED' ? 'opacity-50 grayscale bg-slate-900/10 border-slate-900' : alertColor
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono border ${badgeColor}`}>
                            {insight.type.replace('_', ' ')}
                          </span>
                          <span className="text-[8px] font-mono text-slate-500">
                            {insight.status}
                          </span>
                        </div>
                        <p className="text-xs font-bold leading-relaxed">
                          {insight.trigger}
                        </p>
                        <p className="text-xs text-slate-300 font-medium leading-relaxed mt-1">
                          {insight.advice}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </GlowingCard>
            )}

            {/* Profile Audit Log Stream */}
            <GlowingCard title="Profile Activity Stream" subtitle="AI extractions and audit traces">
              <div className="flex flex-col gap-3.5 mt-3 max-h-[70vh] overflow-y-auto pr-1">
                {auditLogs.length === 0 ? (
                  <div className="text-xs text-slate-500 py-6 text-center font-mono">
                    No sync events registered yet.
                  </div>
                ) : (
                  auditLogs.map((log) => {
                    const isAlert = log.action === 'CONTRADICTION_DETECTED';
                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-lg border flex flex-col gap-1.5 transition-colors ${
                          isAlert
                            ? 'bg-red-500/5 border-red-500/10'
                            : 'bg-black/30 border-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                            isAlert
                              ? 'text-red-400 bg-red-500/5 border border-red-500/10'
                              : 'text-indigo-400 bg-indigo-500/5 border border-indigo-500/10'
                          }`}>
                            {log.action}
                          </span>
                          <span className="text-[8px] font-mono text-slate-600">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className={`text-[11px] leading-relaxed font-mono ${
                          isAlert ? 'text-red-300' : 'text-slate-400'
                        }`}>
                          {log.details}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </GlowingCard>
          </div>

        </div>
      )}

      {/* Change History Log List */}
      {activeTab === 'history' && (
        <GlowingCard title="Profile History Audit Trail" subtitle="Deep change history logs for audit tracking">
          <div className="flex flex-col gap-4 mt-3">
            {historyLogs.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center font-mono">No historical updates registered.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono text-slate-400">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Parameter</th>
                      <th className="py-3 px-4">Change Type</th>
                      <th className="py-3 px-4">Old &rarr; New Value</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4">Reason / Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLogs.map((log) => {
                      let oldParsed = log.oldValue;
                      let newParsed = log.newValue;
                      try { oldParsed = JSON.parse(log.oldValue || 'null'); } catch(e) {}
                      try { newParsed = JSON.parse(log.newValue); } catch(e) {}
                      
                      return (
                        <tr key={log.id} className="border-b border-slate-900/60 hover:bg-slate-900/10 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="text-indigo-400 font-semibold">
                              [{log.entry.layer}] {formatKeyName(log.entry.key)}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              log.changeType === 'CREATE' ? 'text-emerald-400 bg-emerald-500/5' :
                              log.changeType === 'UPDATE' ? 'text-indigo-400 bg-indigo-500/5' :
                              log.changeType === 'DELETE' ? 'text-red-400 bg-red-500/5' :
                              'text-amber-400 bg-amber-500/5'
                            }`}>
                              {log.changeType}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-[240px] truncate">
                            {log.changeType === 'CREATE' ? (
                              <span className="text-slate-300">{typeof newParsed === 'object' ? JSON.stringify(newParsed) : newParsed}</span>
                            ) : log.changeType === 'DELETE' ? (
                              <span className="line-through text-red-500/80">{typeof oldParsed === 'object' ? JSON.stringify(oldParsed) : oldParsed}</span>
                            ) : (
                              <div className="flex items-center gap-1 text-slate-300">
                                <span className="text-slate-600 line-through truncate max-w-[100px]">{typeof oldParsed === 'object' ? JSON.stringify(oldParsed) : oldParsed}</span>
                                <span>&rarr;</span>
                                <span className="truncate max-w-[100px]">{typeof newParsed === 'object' ? JSON.stringify(newParsed) : newParsed}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="text-slate-400">
                              {log.oldConfidence ? `${Math.round(log.oldConfidence * 100)}% -> ` : ''}
                              <strong>{Math.round(log.newConfidence * 100)}%</strong>
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-slate-300">{log.reason || 'No details provided.'}</span>
                              <span className="text-[9px] text-slate-600">Source: {log.source}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </GlowingCard>
      )}

      {/* Snapshot Rollbacks List */}
      {activeTab === 'versions' && (
        <GlowingCard title="Profile Snapshots" subtitle="Revert to previous versions of your cognitive profile state">
          <div className="flex flex-col gap-4 mt-3">
            {versions.length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center font-mono">No snapshots generated yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-4 rounded-2xl bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] hover:border-slate-800 transition-colors flex items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center font-mono font-bold text-indigo-400 shadow-inner">
                        v{ver.version}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-slate-200">{ver.description || 'Auto-generated snapshot.'}</span>
                        <span className="text-xs text-slate-500 font-mono">
                          Saved on: {new Date(ver.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestoreVersion(ver.id, ver.version)}
                      className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-4 py-2.5 rounded-xl cursor-pointer shadow-lg shadow-indigo-500/15 transition-all active:scale-[0.98]"
                    >
                      Restore Version
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlowingCard>
      )}

      {/* Edit parameter override modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="w-full max-w-lg glass border border-slate-800 rounded-3xl p-6.5 relative flex flex-col gap-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                {modalMode === 'create' ? `Add ${editLayer} Override` : `Modify Parameter`}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Manual inputs instantly override AI extractions and establish full (100%) confidence scores.
              </p>
            </div>

            {errorMsg && (
              <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveEntry} className="flex flex-col gap-4">
              {modalMode === 'create' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-mono font-semibold text-slate-400 tracking-wider">
                    Parameter Name (Key)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. technical_skills, current_role, salary_goals"
                    value={editKey}
                    onChange={(e) => setEditKey(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-mono font-semibold text-slate-400 tracking-wider">
                  Parameter Value
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Lead Software Architect (For lists, comma separate them: Next.js, React, Rust)"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors leading-relaxed"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-mono font-semibold text-slate-400 tracking-wider">
                  Reason for Change
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Completed Next.js certification / Swapped career target"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950/40 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4.5 py-2.5 rounded-xl border border-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.01] hover:brightness-110 cursor-pointer transition-all active:scale-[0.98]"
                >
                  Save Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
