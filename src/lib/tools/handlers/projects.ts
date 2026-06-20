import { prisma } from '@/lib/db';
import type { ToolResult } from './goals';

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: project.create
// ─────────────────────────────────────────────────────────────────────────────
export async function create_project(
  args: {
    name:         string;
    description?: string;
  },
  userId: string
): Promise<ToolResult> {
  if (!args.name?.trim()) return { error: 'name is required to create a project' };

  const project = await prisma.project.create({
    data: {
      userId,
      name:        args.name.trim(),
      description: args.description || null,
      status:      'IN_PROGRESS',
    },
  });

  // Save Memory context
  const dateStr = new Date().toISOString().split('T')[0];
  await prisma.memory.create({
    data: {
      userId,
      content: `User created project workspace "${project.name}" on ${dateStr}.`,
      category: 'PROJECT',
      sentiment: 'NEUTRAL',
    },
  });

  return {
    projectId:   project.id,
    name:        project.name,
    status:      project.status,
    message:     `Project "${project.name}" created and ready for tasks.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: project.delete
// Destructive Action: Requires Confirmation
// ─────────────────────────────────────────────────────────────────────────────
export async function delete_project(
  args: { projectId: string; confirmed?: boolean },
  userId: string
): Promise<ToolResult> {
  const project = await prisma.project.findUnique({
    where: { id: args.projectId },
    include: { tasks: true, notes: true },
  });

  if (!project) return { error: `Project not found: ${args.projectId}` };

  if (!args.confirmed) {
    const tasksCount = project.tasks.length;
    const notesCount = project.notes.length;
    return {
      confirmationRequired: true,
      toolName: 'project.delete',
      args: { projectId: args.projectId },
      title: project.name,
      message: `I found the project "${project.name}". This action will remove the project workspace. Note: ${tasksCount} tasks and ${notesCount} notes will be unlinked but preserved. Confirm?`,
    };
  }

  await prisma.project.delete({ where: { id: args.projectId } });

  return {
    deleted: true,
    projectId:  args.projectId,
    name:       project.name,
    message:    `Project "${project.name}" has been permanently deleted.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: project.create_note
// ─────────────────────────────────────────────────────────────────────────────
export async function create_note(
  args: {
    title:      string;
    content:    string;
    projectId?: string;
  },
  userId: string
): Promise<ToolResult> {
  if (!args.title?.trim()) return { error: 'title is required to create a note' };
  if (!args.content?.trim()) return { error: 'content is required to create a note' };

  const note = await prisma.note.create({
    data: {
      userId,
      title:     args.title.trim(),
      content:   args.content,
      projectId: args.projectId || null,
    },
  });

  return {
    noteId:  note.id,
    title:   note.title,
    message: `Note "${note.title}" saved successfully.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: project.delete_note
// Destructive Action: Requires Confirmation
// ─────────────────────────────────────────────────────────────────────────────
export async function delete_note(
  args: { noteId: string; confirmed?: boolean },
  userId: string
): Promise<ToolResult> {
  const note = await prisma.note.findUnique({
    where: { id: args.noteId },
  });

  if (!note) return { error: `Note not found: ${args.noteId}` };

  if (!args.confirmed) {
    return {
      confirmationRequired: true,
      toolName: 'project.delete_note',
      args: { noteId: args.noteId },
      title: note.title,
      message: `I found the note "${note.title}". This action will permanently remove it. Confirm?`,
    };
  }

  await prisma.note.delete({ where: { id: args.noteId } });

  return {
    deleted: true,
    noteId:  args.noteId,
    title:   note.title,
    message: `Note "${note.title}" has been permanently deleted.`,
  };
}
