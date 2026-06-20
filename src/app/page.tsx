'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Target,
  GraduationCap,
  Briefcase,
  Clock,
  Sparkles,
  Calendar,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import GlowingCard from '@/components/glowing-card';

interface Stats {
  totalGoals: number;
  completedMilestones: number;
  skillsCount: number;
  studyHours: number;
  activeProjects: number;
}

interface Goal {
  id: string;
  title: string;
  category: string;
  progress: number;
  targetDate: string;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string;
  project?: {
    name: string;
  };
}

interface Memory {
  id: string;
  content: string;
  category: string;
  createdAt: string;
}

interface Activity {
  id: string;
  agentType: string;
  activityType: string;
  status: string;
  details: string;
  createdAt: string;
}

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [syncing, setSyncing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const data = await res.json();
      setStats(data.stats);
      setGoals(data.activeGoals);
      setTasks(data.upcomingTasks);
      setMemories(data.recentMemories);
      setActivities(data.agentActivities);
      setChats(data.recentChats);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Visual feedback
    await fetchDashboardData();
    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 animate-spin" />
          <span className="text-xs text-slate-500 font-mono tracking-wider">AGGREGATING METRICS...</span>
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority.toUpperCase()) {
      case 'URGENT':
        return 'text-red-400 bg-red-400/10 border-red-500/20';
      case 'HIGH':
        return 'text-amber-400 bg-amber-400/10 border-amber-500/20';
      case 'MEDIUM':
        return 'text-indigo-400 bg-indigo-400/10 border-indigo-500/20';
      default:
        return 'text-slate-400 bg-slate-400/10 border-slate-500/10';
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Top Banner Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[rgba(255,255,255,0.04)] pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Console Terminal <span className="text-indigo-400 glow-text font-light">Jan AI</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Status: online. Memory synched. 2 agent actions recorded.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 text-xs font-semibold px-4.5 py-2.5 rounded-xl border border-[rgba(255,255,255,0.08)] text-slate-300 hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin text-indigo-400' : ''} />
            {syncing ? 'Syncing...' : 'Sync OS'}
          </button>
          <Link
            href="/chat"
            className="flex items-center gap-2 text-xs font-semibold px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/15 hover:scale-[1.01] hover:brightness-110 transition-all cursor-pointer"
          >
            <Sparkles size={13} />
            Query AI
          </Link>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { name: 'Active Goals', val: stats?.totalGoals || 0, icon: Target, color: 'text-indigo-400' },
          { name: 'Milestones Done', val: stats?.completedMilestones || 0, icon: CheckCircle2, color: 'text-cyan-400' },
          { name: 'Skills Logged', val: stats?.skillsCount || 0, icon: GraduationCap, color: 'text-purple-400' },
          { name: 'Study Time', val: `${stats?.studyHours || 0} hrs`, icon: Clock, color: 'text-amber-400' },
          { name: 'Active Projects', val: stats?.activeProjects || 0, icon: Briefcase, color: 'text-emerald-400' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="glass rounded-2xl p-4.5 border border-[rgba(255,255,255,0.04)] flex flex-col gap-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-bl-full translate-x-4 -translate-y-4 opacity-5 group-hover:scale-105 transition-transform" />
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono tracking-wider text-slate-500 uppercase font-semibold">
                  {stat.name}
                </span>
                <Icon size={16} className={`${stat.color}`} />
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">{stat.val}</span>
            </div>
          );
        })}
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Column (span 2) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* AI Daily Overview */}
          <GlowingCard className="relative overflow-hidden bg-gradient-to-br from-[#0c0c20]/90 to-[#05050a]/90">
            <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Brain className="text-indigo-400" size={20} />
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">Operating Insight</span>
                  <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-wide">Daily AI Overview</h3>
                <p className="text-sm text-slate-400 leading-relaxed font-medium">
                  Welcome back, Jan. You are on track for <strong className="text-white">Build a Personal AI Operating System</strong> with 40% progress completed. Your learning logs show 1.2 study hours completed this week, focusing on vector databases. There are <strong className="text-white">3 urgent tasks</strong> pending for today in the Kanban board.
                </p>
              </div>
            </div>
          </GlowingCard>

          {/* Active Goals Tracker */}
          <GlowingCard title="Active Growth Goals" subtitle="Top focus metrics and milestones">
            <div className="flex flex-col gap-4.5 mt-2">
              {goals.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center font-mono">No active goals found.</div>
              ) : (
                goals.map((goal) => (
                  <div key={goal.id} className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] hover:border-slate-800 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-white text-sm truncate">{goal.title}</span>
                      <span className="text-xs text-indigo-400 font-mono font-bold bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                        {goal.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-400 font-semibold w-8 text-right">
                        {goal.progress}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlowingCard>

          {/* Upcoming Kanban Tasks */}
          <GlowingCard
            title="Immediate Action Items"
            subtitle="Prioritized upcoming checklist items"
            headerActions={
              <Link href="/projects" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                Kanban View <ArrowRight size={12} />
              </Link>
            }
          >
            <div className="flex flex-col gap-3 mt-2">
              {tasks.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center font-mono">No pending tasks. Well done!</div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.02)] transition-all"
                  >
                    <div className="flex flex-col gap-1 truncate">
                      <span className="text-sm font-semibold text-slate-200 truncate">{task.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-medium">
                          {task.project?.name || 'No Project'}
                        </span>
                        {task.dueDate && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Calendar size={10} /> {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border rounded-md uppercase shrink-0 ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlowingCard>
        </div>

        {/* Right Column (span 1) */}
        <div className="flex flex-col gap-6">

          {/* Memory Stream */}
          <GlowingCard title="Memory Node Sync" subtitle="Facts extracted automatically from logs">
            <div className="flex flex-col gap-3 mt-2">
              {memories.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center font-mono">No memories indexed yet.</div>
              ) : (
                memories.map((mem) => (
                  <div key={mem.id} className="p-3.5 rounded-xl bg-slate-950/40 border border-[rgba(99,102,241,0.06)] hover:border-[rgba(99,102,241,0.15)] transition-colors flex flex-col gap-2">
                    <p className="text-xs text-indigo-200 leading-relaxed font-medium">
                      &quot;{mem.content}&quot;
                    </p>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] font-mono text-slate-500 font-semibold uppercase bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {mem.category}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">
                        {new Date(mem.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlowingCard>

          {/* Recent AI Conversations */}
          <GlowingCard title="Recent Chats" subtitle="Persistent context nodes">
            <div className="flex flex-col gap-3 mt-2">
              {chats.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center font-mono">No previous chat logs.</div>
              ) : (
                chats.map((chat) => (
                  <Link
                    key={chat.id}
                    href={`/chat?id=${chat.id}`}
                    className="p-3.5 rounded-xl bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] hover:bg-[rgba(99,102,241,0.03)] hover:border-[rgba(99,102,241,0.15)] transition-all flex flex-col gap-1"
                  >
                    <div className="flex items-center gap-2 justify-between">
                      <span className="text-xs font-semibold text-slate-200 truncate flex items-center gap-1.5">
                        <MessageSquare size={12} className="text-indigo-400" />
                        {chat.title}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate font-medium">
                      {chat.lastMessage}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </GlowingCard>

          {/* Agent Activity Logs */}
          <GlowingCard title="Background Agent Feed" subtitle="Audit activity for study and research agents">
            <div className="flex flex-col gap-3 mt-2 font-mono">
              {activities.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center font-mono">No running agent records.</div>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="p-3 rounded-lg bg-black/30 border border-slate-900 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[9px] font-bold">
                      <span className="text-indigo-400 uppercase">{act.agentType} AGENT</span>
                      <span className="text-emerald-500 bg-emerald-500/5 px-1 rounded uppercase">
                        {act.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-normal">
                      {act.details}
                    </span>
                    <span className="text-[8px] text-slate-600 self-end">
                      {new Date(act.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </GlowingCard>
        </div>
      </div>
    </div>
  );
}
