import { prisma } from '@/lib/db';
import type { ToolResult } from './goals';

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: task.create
// ─────────────────────────────────────────────────────────────────────────────
export async function create_task(
  args: {
    title:       string;
    description?: string;
    projectId?:  string;
    priority?:   string;
    dueDate?:    string;
  },
  userId: string
): Promise<ToolResult> {
  if (!args.title?.trim()) return { error: 'title is required to create a task' };

  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const priority = validPriorities.includes(args.priority || '') ? args.priority! : 'MEDIUM';

  const task = await prisma.task.create({
    data: {
      userId,
      title:       args.title.trim(),
      description: args.description || null,
      projectId:   args.projectId   || null,
      status:      'TODO',
      priority,
      dueDate:     args.dueDate ? new Date(args.dueDate) : null,
    },
  });

  return {
    taskId:   task.id,
    title:    task.title,
    status:   task.status,
    priority: task.priority,
    message:  `Task "${task.title}" created with ${priority} priority.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: task.update
// ─────────────────────────────────────────────────────────────────────────────
export async function update_task(
  args: {
    taskId:   string;
    status:   string;
    priority?: string;
  },
  userId: string
): Promise<ToolResult> {
  const validStatuses   = ['TODO', 'IN_PROGRESS', 'COMPLETED'];
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  if (!validStatuses.includes(args.status)) {
    return { error: `Invalid status "${args.status}". Must be one of: ${validStatuses.join(', ')}` };
  }

  const updateData: Record<string, string> = { status: args.status };
  if (args.priority && validPriorities.includes(args.priority)) {
    updateData.priority = args.priority;
  }

  const task = await prisma.task.update({
    where: { id: args.taskId },
    data:  updateData,
  });

  // Log completion activity (Note: completion via update_task update does not require confirmation card in Kanban UI, but let's keep it safe)
  if (args.status === 'COMPLETED') {
    await prisma.agentActivity.create({
      data: {
        userId,
        agentType:    'PROJECT',
        activityType: 'TASK_COMPLETION',
        status:       'SUCCESS',
        details:      `Task completed via update: "${task.title}"`,
      },
    });

    // Save Memory
    const dateStr = new Date().toISOString().split('T')[0];
    await prisma.memory.create({
      data: {
        userId,
        content: `User completed task "${task.title}" on ${dateStr}.`,
        category: 'PROJECT',
        sentiment: 'NEUTRAL',
      },
    });
  }

  return {
    taskId:  task.id,
    title:   task.title,
    status:  task.status,
    priority: task.priority,
    message: `Task "${task.title}" moved to ${task.status}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: task.complete
// Destructive Confirmation Safeguard (Marks task completed and logs activity)
// ─────────────────────────────────────────────────────────────────────────────
export async function complete_task(
  args: { taskId: string; confirmed?: boolean },
  userId: string
): Promise<ToolResult> {
  const task = await prisma.task.findUnique({ where: { id: args.taskId } });
  if (!task) return { error: `Task not found: ${args.taskId}` };

  if (task.status === 'COMPLETED') {
    return {
      taskId:         task.id,
      title:          task.title,
      alreadyComplete: true,
      message:        `Task "${task.title}" was already marked as completed.`,
    };
  }

  if (!args.confirmed) {
    return {
      confirmationRequired: true,
      toolName: 'task.complete',
      args: { taskId: args.taskId },
      title: task.title,
      message: `I found the task "${task.title}". This action will mark it as COMPLETED. Confirm?`,
    };
  }

  await prisma.task.update({
    where: { id: args.taskId },
    data:  { status: 'COMPLETED' },
  });

  await prisma.agentActivity.create({
    data: {
      userId,
      agentType:    'PROJECT',
      activityType: 'TASK_COMPLETION',
      status:       'SUCCESS',
      details:      `Task completed: "${task.title}"`,
    },
  });

  // Save Memory context
  const dateStr = new Date().toISOString().split('T')[0];
  await prisma.memory.create({
    data: {
      userId,
      content: `User completed task "${task.title}" on ${dateStr}.`,
      category: 'PROJECT',
      sentiment: 'NEUTRAL',
    },
  });

  return {
    taskId:      task.id,
    title:       task.title,
    completedAt: new Date().toISOString(),
    message:     `Task "${task.title}" marked as completed. Well done!`,
  };
}
