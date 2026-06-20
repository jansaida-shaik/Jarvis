import { prisma } from '@/lib/db';
import { awardXp } from '@/lib/gamification';

export interface ToolResult {
  error?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Auto-generate starter milestones based on category + goal title
// ─────────────────────────────────────────────────────────────────────────────
function generateMilestoneTitles(goalTitle: string, category: string): string[] {
  const title = goalTitle.toLowerCase();

  // Category-specific heuristics
  if (category === 'CAREER') {
    if (title.includes('engineer') || title.includes('developer') || title.includes('programmer')) {
      return [
        'Build 2 portfolio projects showcasing this skill',
        'Complete one relevant certification or course',
        'Apply to 5 target companies or roles',
      ];
    }
    if (title.includes('manager') || title.includes('lead') || title.includes('director')) {
      return [
        'Develop leadership skills through a dedicated program',
        'Take on a cross-functional project to demonstrate leadership',
        'Complete a management or product strategy course',
      ];
    }
    return [
      'Research and define the skills required for this career path',
      'Build a portfolio or evidence of expertise',
      'Network with 5 people already in this role',
    ];
  }

  if (category === 'CODING' || category === 'LEARNING') {
    return [
      'Complete a foundational course or resource on this topic',
      'Build a practice project applying what you learned',
      'Review and document key concepts to solidify understanding',
    ];
  }

  if (category === 'HEALTH') {
    return [
      'Define the specific health habit or metric to track',
      'Establish a weekly routine for the first 4 weeks',
      'Review progress and adjust the plan after 30 days',
    ];
  }

  if (category === 'FINANCE') {
    return [
      'Audit current financial state and set a baseline',
      'Create a monthly budget or savings plan',
      'Review progress at the end of month 1',
    ];
  }

  // Default milestones
  return [
    'Define a clear action plan for this goal',
    'Take the first concrete step',
    'Review and measure progress at the midpoint',
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: goal.create
// Compound action — creates goal + milestones + learning plan + memory context
// ─────────────────────────────────────────────────────────────────────────────
export async function create_goal(
  args: {
    title: string;
    category: string;
    description?: string;
    targetDate?: string;
  },
  userId: string
): Promise<ToolResult> {
  if (!args.title?.trim()) return { error: 'title is required to create a goal' };
  if (!args.category) return { error: 'category is required to create a goal' };

  // 1. Create the goal
  const goal = await prisma.goal.create({
    data: {
      userId,
      title:       args.title.trim(),
      description: args.description || null,
      category:    args.category,
      status:      'ACTIVE',
      progress:    0,
      targetDate:  args.targetDate ? new Date(args.targetDate) : null,
    },
  });

  // 2. Auto-generate 3 starter milestones
  const milestoneTitles = generateMilestoneTitles(args.title, args.category);
  const milestones = await Promise.all(
    milestoneTitles.map((title) =>
      prisma.milestone.create({
        data: {
          goalId: goal.id,
          title,
          status: 'TODO',
        },
      })
    )
  );

  // 3. Auto-create a companion learning plan for LEARNING/CODING/CAREER goals
  let learningPlan = null;
  if (['LEARNING', 'CODING', 'CAREER'].includes(args.category)) {
    learningPlan = await prisma.learningPlan.create({
      data: {
        userId,
        title:  `${args.title} — Roadmap`,
        status: 'ACTIVE',
        description: `Learning roadmap automatically created alongside goal: "${args.title}"`,
        recommendations: JSON.stringify(milestoneTitles),
      },
    });
  }

  // 4. Create memory context
  const dateStr = new Date().toISOString().split('T')[0];
  await prisma.memory.create({
    data: {
      userId,
      content: `User created ${args.title} ${args.category.toLowerCase()} goal on ${dateStr}.`,
      category: 'LEARNING',
      sentiment: 'NEUTRAL',
    },
  });

  // 5. Log agent activity
  await prisma.agentActivity.create({
    data: {
      userId,
      agentType:    'LEARNING',
      activityType: 'GOAL_CREATION',
      status:       'SUCCESS',
      details:      `Created goal: "${args.title}" with ${milestones.length} milestones.`,
    },
  });

  return {
    goalId:          goal.id,
    title:           goal.title,
    category:        goal.category,
    status:          goal.status,
    milestones:      milestones.map((m) => ({ id: m.id, title: m.title })),
    learningPlanId:  learningPlan?.id || null,
    learningPlanTitle: learningPlan?.title || null,
    message:         `Goal "${goal.title}" created with ${milestones.length} milestones.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: goal.update
// Award +500 XP when goal is completed
// ─────────────────────────────────────────────────────────────────────────────
export async function update_goal(
  args: {
    goalId: string;
    title?: string;
    description?: string;
    status?: string;
    progress?: number;
  },
  userId: string
): Promise<ToolResult> {
  const existingGoal = await prisma.goal.findUnique({
    where: { id: args.goalId },
  });

  if (!existingGoal) return { error: `Goal not found: ${args.goalId}` };

  const updateData: Record<string, unknown> = {};
  if (args.title !== undefined) updateData.title = args.title;
  if (args.description !== undefined) updateData.description = args.description;
  if (args.status !== undefined) updateData.status = args.status;
  if (args.progress !== undefined) updateData.progress = Math.min(100, Math.max(0, Number(args.progress)));

  if (Object.keys(updateData).length === 0) {
    return { error: 'At least one field to update is required (title, description, status, or progress)' };
  }

  const goal = await prisma.goal.update({
    where: { id: args.goalId },
    data:  updateData,
  });

  // Check if completed and award XP
  let gamification = null;
  if (args.status === 'COMPLETED' && existingGoal.status !== 'COMPLETED') {
    gamification = await awardXp(userId, 500, `Completed goal: ${goal.title}`);
    
    // Log Memory context
    const dateStr = new Date().toISOString().split('T')[0];
    await prisma.memory.create({
      data: {
        userId,
        content: `User completed goal "${goal.title}" on ${dateStr}.`,
        category: 'CAREER',
        sentiment: 'POSITIVE',
      },
    });
  }

  return {
    goalId:  goal.id,
    title:   goal.title,
    status:  goal.status,
    progress: goal.progress,
    gamification,
    message: `Goal "${goal.title}" updated successfully.${gamification ? ' +500 XP awarded!' : ''}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: goal.delete
// Destructive Action: Requires Confirmation
// ─────────────────────────────────────────────────────────────────────────────
export async function delete_goal(
  args: { goalId: string; confirmed?: boolean },
  userId: string
): Promise<ToolResult> {
  const goal = await prisma.goal.findUnique({
    where: { id: args.goalId },
    include: { milestones: true },
  });

  if (!goal) return { error: `Goal not found: ${args.goalId}` };

  if (!args.confirmed) {
    const milestonesCount = goal.milestones.length;
    return {
      confirmationRequired: true,
      toolName: 'goal.delete',
      args: { goalId: args.goalId },
      title: goal.title,
      message: `I found the goal "${goal.title}". This action will remove:\n* Goal\n* ${milestonesCount} Milestones\n* Related Progress\n\nConfirm?`,
    };
  }

  await prisma.goal.delete({ where: { id: args.goalId } });

  return {
    deleted: true,
    goalId:  args.goalId,
    title:   goal.title,
    message: `Goal "${goal.title}" and all its milestones have been permanently deleted.`,
  };
}
