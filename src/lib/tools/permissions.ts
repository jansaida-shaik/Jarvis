import { prisma } from '@/lib/db';

/**
 * PERMISSION LAYER
 * Every tool that operates on an existing resource must verify
 * the resource belongs to the calling user before execution.
 * 
 * Design rule: userId is NEVER trusted from LLM arguments.
 * It is always injected from the validated session.
 */

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * Verifies tool execution is permitted for the given userId.
 * Throws PermissionError if the user does not own the target resource.
 */
export async function permissionGuard(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<void> {
  switch (toolName) {
    // ── Goal mutations ──────────────────────────────────────────────
    case 'goal.update':
    case 'goal.delete': {
      const goalId = args.goalId as string;
      if (!goalId) throw new PermissionError('goalId is required');
      const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { userId: true } });
      if (!goal) throw new PermissionError(`Goal not found: ${goalId}`);
      if (goal.userId !== userId) throw new PermissionError('You do not have permission to modify this goal');
      break;
    }

    // ── Milestone mutations ─────────────────────────────────────────
    case 'milestone.complete': {
      const milestoneId = args.milestoneId as string;
      if (!milestoneId) throw new PermissionError('milestoneId is required');
      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { goal: { select: { userId: true } } },
      });
      if (!milestone) throw new PermissionError(`Milestone not found: ${milestoneId}`);
      if (milestone.goal.userId !== userId) throw new PermissionError('You do not have permission to modify this milestone');
      break;
    }

    case 'milestone.create': {
      const goalId = args.goalId as string;
      if (!goalId) throw new PermissionError('goalId is required');
      const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { userId: true } });
      if (!goal) throw new PermissionError(`Goal not found: ${goalId}`);
      if (goal.userId !== userId) throw new PermissionError('You do not have permission to add milestones to this goal');
      break;
    }

    // ── Task mutations ──────────────────────────────────────────────
    case 'task.update':
    case 'task.complete': {
      const taskId = args.taskId as string;
      if (!taskId) throw new PermissionError('taskId is required');
      const task = await prisma.task.findUnique({ where: { id: taskId }, select: { userId: true } });
      if (!task) throw new PermissionError(`Task not found: ${taskId}`);
      if (task.userId !== userId) throw new PermissionError('You do not have permission to modify this task');
      break;
    }

    // ── Project mutations ───────────────────────────────────────────
    case 'project.delete': {
      const projectId = args.projectId as string;
      if (!projectId) throw new PermissionError('projectId is required');
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true } });
      if (!project) throw new PermissionError(`Project not found: ${projectId}`);
      if (project.userId !== userId) throw new PermissionError('You do not have permission to modify this project');
      break;
    }

    case 'project.delete_note': {
      const noteId = args.noteId as string;
      if (!noteId) throw new PermissionError('noteId is required');
      const note = await prisma.note.findUnique({ where: { id: noteId }, select: { userId: true } });
      if (!note) throw new PermissionError(`Note not found: ${noteId}`);
      if (note.userId !== userId) throw new PermissionError('You do not have permission to delete this note');
      break;
    }

    // ── Memory mutations ────────────────────────────────────────────
    case 'memory.delete': {
      const memoryId = args.memoryId as string;
      if (!memoryId) throw new PermissionError('memoryId is required');
      const memory = await prisma.memory.findUnique({ where: { id: memoryId }, select: { userId: true } });
      if (!memory) throw new PermissionError(`Memory not found: ${memoryId}`);
      if (memory.userId !== userId) throw new PermissionError('You do not have permission to delete this memory');
      break;
    }

    default:
      // Creation or search tools require no prior resource check
      break;
  }
}
