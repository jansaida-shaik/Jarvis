'use client';

import React, { useEffect, useState } from 'react';
import { GraduationCap, BookOpen, Clock, Plus, BarChart2, Star, CheckCircle, Loader2 } from 'lucide-react';
import GlowingCard from '@/components/glowing-card';

interface Skill {
  id: string;
  name: string;
  category: string;
  proficiencyLevel: string;
}

interface LearningPlan {
  id: string;
  title: string;
  description: string | null;
  status: string;
  recommendations: string | null;
}

interface LearningSession {
  id: string;
  durationMinutes: number;
  notes: string | null;
  createdAt: string;
  skill?: {
    name: string;
  } | null;
}

export default function LearningPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [sessions, setSessions] = useState<LearningSession[]>([]);
  const [loading, setLoading] = useState(true);

  // New skill state
  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState('TECHNICAL');
  const [skillProficiency, setSkillProficiency] = useState('BEGINNER');
  const [skillLoading, setSkillLoading] = useState(false);

  // Log session state
  const [sessionSkillId, setSessionSkillId] = useState('');
  const [sessionPlanId, setSessionPlanId] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState('30');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);

  // New roadmap state
  const [planTitle, setPlanTitle] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planRecs, setPlanRecs] = useState('');
  const [planLoading, setPlanLoading] = useState(false);

  const fetchLearningData = async () => {
    try {
      const res = await fetch('/api/learning');
      if (!res.ok) throw new Error('Failed to load learning data');
      const data = await res.json();
      setSkills(data.skills);
      setPlans(data.learningPlans);
      setSessions(data.sessions);
      
      if (data.skills.length > 0 && !sessionSkillId) {
        setSessionSkillId(data.skills[0].id);
      }
      if (data.learningPlans.length > 0 && !sessionPlanId) {
        setSessionPlanId(data.learningPlans[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearningData();
  }, []);

  const handleCreateSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillName.trim()) return;

    setSkillLoading(true);
    try {
      const res = await fetch('/api/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-skill',
          name: skillName,
          category: skillCategory,
          proficiencyLevel: skillProficiency,
        }),
      });

      if (!res.ok) throw new Error('Failed to create skill');
      setSkillName('');
      fetchLearningData();
    } catch (err) {
      console.error(err);
    } finally {
      setSkillLoading(false);
    }
  };

  const handleLogSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionMinutes) return;

    setSessionLoading(true);
    try {
      const res = await fetch('/api/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log-session',
          skillId: sessionSkillId || undefined,
          planId: sessionPlanId || undefined,
          durationMinutes: Number(sessionMinutes),
          notes: sessionNotes,
        }),
      });

      if (!res.ok) throw new Error('Failed to log session');
      setSessionNotes('');
      fetchLearningData();
    } catch (err) {
      console.error(err);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planTitle.trim()) return;

    setPlanLoading(true);
    try {
      // Split comma separated list into recommendations array
      const recommendations = planRecs
        ? planRecs.split('\n').filter((r) => r.trim().length > 0)
        : [];

      const res = await fetch('/api/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-plan',
          title: planTitle,
          description: planDescription,
          recommendations,
        }),
      });

      if (!res.ok) throw new Error('Failed to create learning plan');
      
      setPlanTitle('');
      setPlanDescription('');
      setPlanRecs('');
      fetchLearningData();
    } catch (err) {
      console.error(err);
    } finally {
      setPlanLoading(false);
    }
  };

  const getProficiencyBadgeColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'EXPERT':
        return 'text-red-400 bg-red-400/10 border-red-500/20';
      case 'ADVANCED':
        return 'text-amber-400 bg-amber-400/10 border-amber-500/20';
      case 'INTERMEDIATE':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const parseRecommendations = (recJson: string | null): string[] => {
    if (!recJson) return [];
    try {
      return JSON.parse(recJson);
    } catch {
      return [];
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[rgba(255,255,255,0.04)] pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Lifelong Learning <span className="text-indigo-400 glow-text font-light">Hub</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Monitor skills logs, build education roadmaps, and register study sessions.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Side: Skills & Plans (span 2) */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Skills Inventory Grid */}
            <GlowingCard title="Skills Inventory" subtitle="Current proficiency targets">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">
                {skills.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center font-mono col-span-full">No skills logged yet.</p>
                ) : (
                  skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="p-4 rounded-2xl bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] hover:border-slate-800 transition-colors flex flex-col justify-between gap-3"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-white text-xs truncate">{skill.name}</span>
                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{skill.category}</span>
                      </div>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 border rounded-md uppercase self-start ${getProficiencyBadgeColor(skill.proficiencyLevel)}`}>
                        {skill.proficiencyLevel}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </GlowingCard>

            {/* Learning Roadmaps */}
            <GlowingCard title="Active Learning Roadmaps" subtitle="AI generated study curricula">
              <div className="flex flex-col gap-6 mt-2">
                {plans.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center font-mono">No active plans generated.</p>
                ) : (
                  plans.map((plan) => {
                    const recs = parseRecommendations(plan.recommendations);
                    return (
                      <div key={plan.id} className="p-5 rounded-2xl bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] hover:border-slate-800 transition-colors flex flex-col gap-4">
                        <div className="flex flex-col gap-1 border-b border-[rgba(255,255,255,0.03)] pb-3">
                          <span className="font-bold text-white text-sm">{plan.title}</span>
                          {plan.description && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{plan.description}</p>}
                        </div>
                        <div className="flex flex-col gap-2.5">
                          <span className="text-[10px] uppercase font-mono font-bold text-slate-500 tracking-wider">Curriculum Tasks</span>
                          {recs.map((rec, i) => (
                            <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300 pl-1">
                              <CheckCircle size={13} className="text-indigo-400 shrink-0 mt-0.5" />
                              <span className="leading-relaxed font-semibold">{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </GlowingCard>

            {/* Log Study Session Form */}
            <GlowingCard title="Log Study Session" subtitle="Register duration and research notes">
              <form onSubmit={handleLogSession} className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Select Skill
                  </label>
                  <select
                    value={sessionSkillId}
                    onChange={(e) => setSessionSkillId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#0c0c1e] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    <option value="">No specific skill</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Select Roadmap
                  </label>
                  <select
                    value={sessionPlanId}
                    onChange={(e) => setSessionPlanId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#0c0c1e] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                    <option value="">No specific roadmap</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Time Spent (Minutes)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Research Notes
                  </label>
                  <input
                    type="text"
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="Explored Cosine Similarity models..."
                    className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sessionLoading}
                  className="md:col-span-3 py-3 bg-indigo-500 text-white font-semibold rounded-xl text-xs cursor-pointer shadow hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1"
                >
                  {sessionLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <Clock size={13} />
                      Log Session
                    </>
                  )}
                </button>
              </form>
            </GlowingCard>

          </div>

          {/* Right Side Column (span 1) */}
          <div className="flex flex-col gap-6">
            
            {/* Add Skill Form */}
            <GlowingCard title="Register Skill Target" subtitle="Add a new skill target to inventory">
              <form onSubmit={handleCreateSkill} className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Skill Name
                  </label>
                  <input
                    type="text"
                    required
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="e.g. Vector Databases"
                    className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Skill Type
                  </label>
                  <select
                    value={skillCategory}
                    onChange={(e) => setSkillCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0c0c1e] border border-slate-800 rounded-xl text-[11px] text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TECHNICAL">Technical Coding</option>
                    <option value="DESIGN">Product/UI Design</option>
                    <option value="COGNITIVE">Cognitive/Life</option>
                    <option value="LANGUAGE">Language</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Current Level
                  </label>
                  <select
                    value={skillProficiency}
                    onChange={(e) => setSkillProficiency(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0c0c1e] border border-slate-800 rounded-xl text-[11px] text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                    <option value="EXPERT">Expert</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={skillLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl text-xs cursor-pointer shadow hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 mt-2"
                >
                  {skillLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={14} />
                      Log Skill
                    </>
                  )}
                </button>
              </form>
            </GlowingCard>

            {/* Create Learning Plan Form */}
            <GlowingCard title="Establish Roadmap" subtitle="Draft a new study roadmap">
              <form onSubmit={handleCreatePlan} className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Roadmap Title
                  </label>
                  <input
                    type="text"
                    required
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    placeholder="e.g. AI Deep Learning Mastery"
                    className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Description
                  </label>
                  <textarea
                    value={planDescription}
                    onChange={(e) => setPlanDescription(e.target.value)}
                    placeholder="Provide overview of scope..."
                    rows={2}
                    className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                    Study Tasks (One per line)
                  </label>
                  <textarea
                    value={planRecs}
                    onChange={(e) => setPlanRecs(e.target.value)}
                    placeholder="Task 1: Math foundations&#10;Task 2: Build simple node"
                    rows={3}
                    className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-xl text-[10px] font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={planLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl text-xs cursor-pointer shadow hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 mt-2"
                >
                  {planLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <>
                      <BookOpen size={14} />
                      Establish Roadmap
                    </>
                  )}
                </button>
              </form>
            </GlowingCard>

            {/* Recent Session History stream */}
            <GlowingCard title="Recent Study Logs" subtitle="Chronicle log of research blocks">
              <div className="flex flex-col gap-3 mt-2">
                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center font-mono">No study sessions recorded yet.</p>
                ) : (
                  sessions.map((sess) => (
                    <div key={sess.id} className="p-3.5 rounded-xl bg-slate-950/40 border border-[rgba(255,255,255,0.03)] hover:border-slate-800 transition-all flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-indigo-400">
                        <span>{sess.skill?.name || 'General Study'}</span>
                        <span className="text-slate-500 flex items-center gap-0.5">
                          <Clock size={10} /> {sess.durationMinutes} min
                        </span>
                      </div>
                      {sess.notes && <p className="text-xs text-slate-400 leading-normal font-medium mt-1">{sess.notes}</p>}
                      <span className="text-[8px] font-mono text-slate-600 self-end mt-1">
                        {new Date(sess.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </GlowingCard>

          </div>

        </div>
      )}
    </div>
  );
}
