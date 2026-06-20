'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, FileText, CheckCircle, Trash2, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import GlowingCard from '@/components/glowing-card';

interface Project {
  id: string;
  name: string;
  description: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string | null;
  project?: {
    name: string;
  } | null;
}

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  project?: {
    name: string;
  } | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // New project state
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectLoading, setProjectLoading] = useState(false);

  // New task state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskProjId, setTaskProjId] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskLoading, setTaskLoading] = useState(false);

  // New note state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteProjId, setNoteProjId] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  const fetchProjectData = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load project details');
      const data = await res.json();
      setProjects(data.projects);
      setTasks(data.tasks);
      setNotes(data.notes);
      
      if (data.projects.length > 0) {
        setTaskProjId(prev => prev || data.projects[0].id);
        setNoteProjId(prev => prev || data.projects[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjectData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProjectData]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setProjectLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-project',
          name: projectName,
          description: projectDesc,
        }),
      });

      if (!res.ok) throw new Error('Failed to create project');
      
      setProjectName('');
      setProjectDesc('');
      fetchProjectData();
    } catch (err) {
      console.error(err);
    } finally {
      setProjectLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setTaskLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-task',
          title: taskTitle,
          description: taskDesc,
          projectId: taskProjId || undefined,
          priority: taskPriority,
          dueDate: taskDueDate || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create task');
      
      setTaskTitle('');
      setTaskDesc('');
      setTaskDueDate('');
      fetchProjectData();
    } catch (err) {
      console.error(err);
    } finally {
      setTaskLoading(false);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;

    setNoteLoading(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-note',
          title: noteTitle,
          content: noteContent,
          projectId: noteProjId || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to create note');
      
      setNoteTitle('');
      setNoteContent('');
      fetchProjectData();
    } catch (err) {
      console.error(err);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleShiftTaskStatus = async (taskId: string, currentStatus: string, direction: 'forward' | 'backward') => {
    let nextStatus = currentStatus;

    if (direction === 'forward') {
      if (currentStatus === 'TODO') nextStatus = 'IN_PROGRESS';
      else if (currentStatus === 'IN_PROGRESS') nextStatus = 'COMPLETED';
    } else {
      if (currentStatus === 'COMPLETED') nextStatus = 'IN_PROGRESS';
      else if (currentStatus === 'IN_PROGRESS') nextStatus = 'TODO';
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-task-status',
          taskId,
          status: nextStatus,
        }),
      });

      if (!res.ok) throw new Error('Failed to update task status');
      fetchProjectData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`/api/projects?action=delete-task&id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project note?')) return;
    try {
      const res = await fetch(`/api/projects?action=delete-note&id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete note');
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toUpperCase()) {
      case 'URGENT':
        return 'text-red-400 bg-red-400/5 border-red-500/20';
      case 'HIGH':
        return 'text-amber-400 bg-amber-400/5 border-amber-500/20';
      case 'MEDIUM':
        return 'text-indigo-400 bg-indigo-500/5 border-indigo-500/20';
      default:
        return 'text-slate-400 bg-slate-500/5 border-slate-500/10';
    }
  };

  // Filter tasks into columns
  const todoTasks = tasks.filter(t => t.status === 'TODO');
  const progressTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[rgba(255,255,255,0.04)] pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Project Command & <span className="text-indigo-400 glow-text font-light">Kanban</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium">
            Manage your developer projects, organize Kanban boards, and save notes.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* Top Section: Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Column 1: TODO */}
            <GlowingCard title="To Do" subtitle={`${todoTasks.length} items backlog`}>
              <div className="flex flex-col gap-3.5 mt-2 min-h-[300px]">
                {todoTasks.length === 0 ? (
                  <p className="text-xs text-slate-500 py-10 text-center font-mono my-auto">No pending tasks.</p>
                ) : (
                  todoTasks.map(task => (
                    <div key={task.id} className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex flex-col gap-3 hover:border-slate-700 transition-colors">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-200">{task.title}</span>
                        {task.description && <p className="text-[11px] text-slate-400 leading-normal">{task.description}</p>}
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-slate-800/60 pt-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border rounded uppercase ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          {task.project && (
                            <span className="text-[9px] font-mono text-slate-500">
                              {task.project.name.slice(0, 12)}...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-600 hover:text-red-400 p-1 cursor-pointer transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                          <button
                            onClick={() => handleShiftTaskStatus(task.id, 'TODO', 'forward')}
                            className="text-indigo-400 hover:text-indigo-300 p-1 cursor-pointer hover:scale-105 transition-transform"
                            title="Move to In Progress"
                          >
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlowingCard>

            {/* Column 2: IN PROGRESS */}
            <GlowingCard title="In Progress" subtitle={`${progressTasks.length} active tasks`}>
              <div className="flex flex-col gap-3.5 mt-2 min-h-[300px]">
                {progressTasks.length === 0 ? (
                  <p className="text-xs text-slate-500 py-10 text-center font-mono my-auto">No tasks in progress.</p>
                ) : (
                  progressTasks.map(task => (
                    <div key={task.id} className="p-4 rounded-xl bg-indigo-950/10 border border-indigo-500/15 flex flex-col gap-3 hover:border-indigo-500/30 transition-all">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-200">{task.title}</span>
                        {task.description && <p className="text-[11px] text-slate-400 leading-normal">{task.description}</p>}
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-indigo-500/10 pt-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border rounded uppercase ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          {task.project && (
                            <span className="text-[9px] font-mono text-slate-500">
                              {task.project.name.slice(0, 12)}...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleShiftTaskStatus(task.id, 'IN_PROGRESS', 'backward')}
                            className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer hover:scale-105 transition-transform"
                            title="Move to To Do"
                          >
                            <ArrowLeft size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-600 hover:text-red-400 p-1 cursor-pointer transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                          <button
                            onClick={() => handleShiftTaskStatus(task.id, 'IN_PROGRESS', 'forward')}
                            className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer hover:scale-105 transition-transform"
                            title="Complete Task"
                          >
                            <CheckCircle size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlowingCard>

            {/* Column 3: COMPLETED */}
            <GlowingCard title="Completed" subtitle={`${completedTasks.length} completed tasks`}>
              <div className="flex flex-col gap-3.5 mt-2 min-h-[300px]">
                {completedTasks.length === 0 ? (
                  <p className="text-xs text-slate-500 py-10 text-center font-mono my-auto">No completed items.</p>
                ) : (
                  completedTasks.map(task => (
                    <div key={task.id} className="p-4 rounded-xl bg-slate-950/40 border border-slate-900/60 flex flex-col gap-3 hover:border-slate-800 transition-colors opacity-70">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-400 line-through truncate">{task.title}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-slate-900/60 pt-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 border border-emerald-500/10 text-emerald-500 bg-emerald-500/5 rounded uppercase">
                            Done
                          </span>
                          {task.project && (
                            <span className="text-[9px] font-mono text-slate-600">
                              {task.project.name.slice(0, 12)}...
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleShiftTaskStatus(task.id, 'COMPLETED', 'backward')}
                            className="text-slate-500 hover:text-slate-300 p-1 cursor-pointer hover:scale-105 transition-transform"
                            title="Move back to In Progress"
                          >
                            <ArrowLeft size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-slate-600 hover:text-red-400 p-1 cursor-pointer transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlowingCard>

          </div>

          {/* Bottom Grid: Create cards and Notes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Create Actions (span 2) */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* Form 1: Create Kanban Task */}
              <GlowingCard title="Record Kanban Action" subtitle="Log an immediate task target">
                <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                      Task Title
                    </label>
                    <input
                      type="text"
                      required
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="e.g. Set up vector indexing"
                      className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                      Link to Project
                    </label>
                    <select
                      value={taskProjId}
                      onChange={(e) => setTaskProjId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#0c0c1e] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      <option value="">No Project Attachment</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                      Detailed Purpose
                    </label>
                    <input
                      type="text"
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      placeholder="Specify task guidelines..."
                      className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                      Priority Label
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0c0c1e] border border-slate-800 rounded-xl text-[11px] text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="LOW">Low Priority</option>
                      <option value="MEDIUM">Medium Priority</option>
                      <option value="HIGH">High Priority</option>
                      <option value="URGENT">Urgent Priority</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0c0c1e] border border-slate-800 rounded-xl text-[11px] text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={taskLoading}
                    className="md:col-span-2 py-3.5 bg-indigo-500 text-white font-semibold rounded-xl text-xs cursor-pointer shadow hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 mt-2"
                  >
                    {taskLoading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <>
                        <Plus size={14} />
                        Record Task
                      </>
                    )}
                  </button>
                </form>
              </GlowingCard>

              {/* Form 2: Create Project Note */}
              <GlowingCard title="File Technical Note" subtitle="Archive note details inside project context">
                <form onSubmit={handleCreateNote} className="flex flex-col gap-4 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                        Note Title
                      </label>
                      <input
                        type="text"
                        required
                        value={noteTitle}
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="e.g. Architecture decisions"
                        className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                        Project Attachment
                      </label>
                      <select
                        value={noteProjId}
                        onChange={(e) => setNoteProjId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#0c0c1e] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                        <option value="">No Project Attachment</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                      Note Body
                    </label>
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Write structural decisions, task lists, or reference data..."
                      rows={4}
                      required
                      className="w-full px-3.5 py-2.5 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={noteLoading}
                    className="py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl text-xs cursor-pointer shadow hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    {noteLoading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <>
                        <FileText size={13} />
                        File Note
                      </>
                    )}
                  </button>
                </form>
              </GlowingCard>

            </div>

            {/* Right Column: Projects list & Notes Stream */}
            <div className="flex flex-col gap-6">
              
              {/* Projects List Card */}
              <GlowingCard title="Active Core Projects" subtitle="Establish new developer spaces">
                {/* Create Project Form inline */}
                <form onSubmit={handleCreateProject} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="New space name..."
                    className="flex-1 px-3 py-2 bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={projectLoading}
                    className="px-3.5 bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/20 font-bold rounded-xl text-xs cursor-pointer active:scale-95 transition-all"
                  >
                    +
                  </button>
                </form>

                <div className="flex flex-col gap-3 max-h-[160px] overflow-y-auto">
                  {projects.length === 0 ? (
                    <p className="text-[11px] text-slate-500 font-mono italic">No spaces initialized.</p>
                  ) : (
                    projects.map(p => (
                      <div key={p.id} className="p-3 rounded-xl bg-slate-950/40 border border-slate-900 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">{p.name}</span>
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 uppercase">
                          ACTIVE
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </GlowingCard>

              {/* Notes Stream */}
              <GlowingCard title="Filed Notes Shelf" subtitle="Decisions and notes indexed">
                <div className="flex flex-col gap-3.5 max-h-[380px] overflow-y-auto pr-1">
                  {notes.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center font-mono">No filed notes.</p>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="p-4 rounded-xl bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] hover:border-slate-800 transition-all flex flex-col gap-2 relative group">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-bold text-slate-300 truncate">{note.title}</span>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1 cursor-pointer transition-all shrink-0"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-semibold italic whitespace-pre-wrap">
                          {note.content}
                        </p>
                        <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-900/60">
                          {note.project && (
                            <span className="text-[8px] font-mono text-indigo-400 font-bold uppercase bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">
                              {note.project.name}
                            </span>
                          )}
                          <span className="text-[8px] font-mono text-slate-600">
                            {new Date(note.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </GlowingCard>

            </div>

          </div>

        </div>
      )}
    </div>
  );
}
