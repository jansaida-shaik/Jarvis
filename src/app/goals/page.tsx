'use client';

import React, { useEffect, useState } from 'react';
import { Target, Calendar, Plus, CheckSquare, Square, Trash2, Loader2, Sparkles } from 'lucide-react';
import GlowingCard from '@/components/glowing-card';

interface Milestone {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
}

interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  progress: number;
  targetDate: string | null;
  milestones: Milestone[];
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  // New goal state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CODING');
  const [targetDate, setTargetDate] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // New milestone state mapped by goalId
  const [newMilestoneText, setNewMilestoneText] = useState<{ [key: string]: string }>({});

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/goals');
      if (!res.ok) throw new Error('Failed to fetch goals');
      const data = await res.json();
      setGoals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setCreateLoading(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          targetDate: targetDate || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create goal');
      
      setTitle('');
      setDescription('');
      setTargetDate('');
      fetchGoals();
    } catch (err) {
      console.error(err);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleMilestone = async (milestoneId: string) => {
    try {
      const res = await fetch('/api/goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle-milestone',
          milestoneId,
        }),
      });

      if (!res.ok) throw new Error('Failed to toggle milestone');
      
      // Refresh current states
      const refreshedRes = await fetch('/api/goals');
      const data = await refreshedRes.json();
      setGoals(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMilestone = async (goalId: string) => {
    const text = newMilestoneText[goalId];
    if (!text || !text.trim()) return;

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-milestone',
          goalId,
          title: text,
        }),
      });

      if (!res.ok) throw new Error('Failed to add milestone');

      setNewMilestoneText(prev => ({ ...prev, [goalId]: '' }));
      
      // Refresh
      const refreshedRes = await fetch('/api/goals');
      const data = await refreshedRes.json();
      setGoals(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this goal and all associated milestones?')) return;

    try {
      const res = await fetch(`/api/goals?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete goal');
      
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toUpperCase()) {
      case 'CODING':
        return 'text-indigo-400 bg-indigo-500/5 border-indigo-500/10';
      case 'LEARNING':
        return 'text-purple-400 bg-purple-500/5 border-purple-500/10';
      case 'CAREER':
        return 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10';
      default:
        return 'text-slate-400 bg-slate-500/5 border-slate-500/10';
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[rgba(255,255,255,0.04)] pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Personal Goals & <span className="text-indigo-400 glow-text font-light">Milestones</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Define focus targets, coordinate sub-tasks, and track completion progress.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Goals Card List (span 2) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
            </div>
          ) : goals.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center border border-dashed border-slate-800">
              <Target size={36} className="text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-semibold mb-1">No goals active</p>
              <p className="text-xs text-slate-500">Create a growth objective on the sidebar to begin.</p>
            </div>
          ) : (
            goals.map((goal) => (
              <GlowingCard
                key={goal.id}
                title={goal.title}
                subtitle={goal.description || undefined}
                headerActions={
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 border rounded-md uppercase ${getCategoryColor(goal.category)}`}>
                      {goal.category}
                    </span>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer p-1"
                      title="Remove Goal"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                }
              >
                <div className="flex flex-col gap-5">
                  {/* Progress Meter */}
                  <div className="flex items-center gap-4 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] p-4 rounded-2xl">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                        <span>Completion Progress</span>
                        <span className="font-mono text-indigo-400">{goal.progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                    </div>
                    {goal.targetDate && (
                      <div className="border-l border-slate-800 pl-4 shrink-0 flex flex-col gap-0.5">
                        <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500 font-bold">Target Date</span>
                        <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                          <Calendar size={11} className="text-indigo-400" />
                          {new Date(goal.targetDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Milestones list */}
                  <div className="flex flex-col gap-2.5">
                    <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 font-bold">Milestones Checklist</span>
                    
                    {goal.milestones.length === 0 ? (
                      <p className="text-[11px] text-slate-500 font-mono italic pl-1">No milestones added yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {goal.milestones.map((milestone) => {
                          const isCompleted = milestone.status === 'COMPLETED';
                          return (
                            <button
                              key={milestone.id}
                              onClick={() => handleToggleMilestone(milestone.id)}
                              className="w-full text-left p-3.5 rounded-xl bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.02)] hover:border-slate-800 transition-all flex items-center gap-3 group cursor-pointer"
                            >
                              {isCompleted ? (
                                <CheckSquare size={16} className="text-indigo-400 shrink-0" />
                              ) : (
                                <Square size={16} className="text-slate-600 group-hover:text-indigo-500 shrink-0" />
                              )}
                              <span className={`text-xs font-semibold ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                {milestone.title}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick Add Milestone under Goal */}
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newMilestoneText[goal.id] || ''}
                        onChange={(e) =>
                          setNewMilestoneText((prev) => ({ ...prev, [goal.id]: e.target.value }))
                        }
                        placeholder="Define next milestone task..."
                        className="flex-1 px-3.5 py-2.5 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <button
                        onClick={() => handleAddMilestone(goal.id)}
                        className="px-3.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/20 rounded-xl text-xs cursor-pointer active:scale-95 transition-all"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </GlowingCard>
            ))
          )}
        </div>

        {/* Right Column: Create Goal Card */}
        <GlowingCard title="Initiate Growth Target" subtitle="Define a core growth metric objective">
          <form onSubmit={handleCreateGoal} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                Goal Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Master Neural Nets"
                className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                Detailed Purpose
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly state the scope..."
                rows={3}
                className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0c0c1e] border border-slate-800 rounded-xl text-[11px] text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="CODING">Coding</option>
                  <option value="LEARNING">Learning</option>
                  <option value="CAREER">Career</option>
                  <option value="HEALTH">Health</option>
                  <option value="FINANCE">Finance</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                  Target Date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#0c0c1e] border border-slate-800 rounded-xl text-[11px] text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createLoading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl text-xs cursor-pointer shadow hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 mt-2"
            >
              {createLoading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus size={14} />
                  Record Goal
                </>
              )}
            </button>
          </form>
        </GlowingCard>
      </div>
    </div>
  );
}
