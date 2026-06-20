import { prisma } from '@/lib/db';
import { awardXp } from '@/lib/gamification';
import type { ToolResult } from './goals';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Recalculate goal progress after milestone state change
// ─────────────────────────────────────────────────────────────────────────────
async function recalculateGoalProgress(goalId: string): Promise<number> {
  const milestones = await prisma.milestone.findMany({ where: { goalId } });
  if (milestones.length === 0) return 0;

  const completed = milestones.filter((m) => m.status === 'COMPLETED').length;
  const progress  = Math.round((completed / milestones.length) * 100);

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      progress,
      status: progress === 100 ? 'COMPLETED' : 'ACTIVE',
    },
  });

  return progress;
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: milestone.create
// ─────────────────────────────────────────────────────────────────────────────
export async function create_milestone(
  args: {
    goalId:      string;
    title:       string;
    description?: string;
    dueDate?:    string;
  },
  userId: string
): Promise<ToolResult> {
  if (!args.title?.trim()) return { error: 'title is required to create a milestone' };

  const milestone = await prisma.milestone.create({
    data: {
      goalId:      args.goalId,
      title:       args.title.trim(),
      description: args.description || null,
      status:      'TODO',
      dueDate:     args.dueDate ? new Date(args.dueDate) : null,
    },
  });

  const newProgress = await recalculateGoalProgress(args.goalId);

  return {
    milestoneId: milestone.id,
    title:       milestone.title,
    goalId:      args.goalId,
    goalProgress: newProgress,
    message:     `Milestone "${milestone.title}" added to goal. Goal is now ${newProgress}% complete.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: milestone.complete
// ─────────────────────────────────────────────────────────────────────────────
export async function complete_milestone(
  args: { milestoneId: string },
  userId: string
): Promise<ToolResult> {
  const milestone = await prisma.milestone.findUnique({
    where: { id: args.milestoneId },
    include: { goal: true },
  });

  if (!milestone) return { error: `Milestone not found: ${args.milestoneId}` };
  if (milestone.status === 'COMPLETED') {
    return {
      milestoneId: milestone.id,
      title:       milestone.title,
      alreadyCompleted: true,
      message:     `Milestone "${milestone.title}" was already completed.`,
    };
  }

  await prisma.milestone.update({
    where: { id: args.milestoneId },
    data:  { status: 'COMPLETED' },
  });

  const newProgress = await recalculateGoalProgress(milestone.goalId);
  const goalComplete = newProgress === 100;
  const goalWasComplete = milestone.goal.status === 'COMPLETED';

  // Award XP: +100 for milestone. If goal completes, +500.
  let xpToAward = 100;
  let reason = `Completed milestone: "${milestone.title}"`;
  if (goalComplete && !goalWasComplete) {
    xpToAward += 500;
    reason += ` and achieved goal: "${milestone.goal.title}"`;
  }

  const gamification = await awardXp(userId, xpToAward, reason);

  // Create memory context for completing milestone
  const dateStr = new Date().toISOString().split('T')[0];
  await prisma.memory.create({
    data: {
      userId,
      content: `User completed milestone "${milestone.title}" on ${dateStr}.`,
      category: 'LEARNING',
      sentiment: 'POSITIVE',
    },
  });

  if (goalComplete && !goalWasComplete) {
    await prisma.agentActivity.create({
      data: {
        userId,
        agentType:    'LEARNING',
        activityType: 'GOAL_COMPLETED',
        status:       'SUCCESS',
        details:      `Goal completed: "${milestone.goal.title}"`,
      },
    });
  }

  return {
    milestoneId:   milestone.id,
    title:         milestone.title,
    goalId:        milestone.goalId,
    goalProgress:  newProgress,
    goalCompleted: goalComplete,
    gamification,
    message: goalComplete && !goalWasComplete
      ? `Milestone "${milestone.title}" completed — your goal is now 100% achieved! 🎉 +600 XP awarded!`
      : `Milestone "${milestone.title}" marked as complete. Goal is now ${newProgress}% complete. +100 XP awarded!`,
  };
}
