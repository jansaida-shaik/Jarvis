import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const goals = await prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { targetDate: 'asc' },
      include: {
        milestones: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(goals);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, title, description, category, targetDate, goalId, status } = body;

    // Action 1: Create a milestone under an existing goal
    if (action === 'create-milestone') {
      if (!goalId || !title) {
        return NextResponse.json({ message: 'Goal ID and title are required' }, { status: 400 });
      }

      const milestone = await prisma.milestone.create({
        data: {
          goalId,
          title,
          description,
          status: 'TODO',
          dueDate: targetDate ? new Date(targetDate) : null,
        },
      });

      // Recalculate goal progress
      await updateGoalProgress(goalId);

      return NextResponse.json(milestone);
    }

    // Action 2: Create a new growth goal
    if (!title || !category) {
      return NextResponse.json({ message: 'Title and category are required' }, { status: 400 });
    }

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title,
        description,
        category,
        status: status || 'ACTIVE',
        progress: 0,
        targetDate: targetDate ? new Date(targetDate) : null,
      },
    });

    // Log activity
    await prisma.agentActivity.create({
      data: {
        userId: user.id,
        agentType: 'LEARNING',
        activityType: 'GOAL_CREATION',
        status: 'SUCCESS',
        details: `Established new personal goal: "${title}"`,
      },
    });

    return NextResponse.json(goal);
  } catch (error: any) {
    console.error('Goals POST route error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, goalId, milestoneId, status, progress, title, description } = body;

    // Action 1: Toggle milestone status (TODO <-> COMPLETED)
    if (action === 'toggle-milestone') {
      if (!milestoneId) {
        return NextResponse.json({ message: 'Milestone ID is required' }, { status: 400 });
      }

      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
      });

      if (!milestone) {
        return NextResponse.json({ message: 'Milestone not found' }, { status: 404 });
      }

      const nextStatus = milestone.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      const updatedMilestone = await prisma.milestone.update({
        where: { id: milestoneId },
        data: { status: nextStatus },
      });

      // Recalculate parent goal progress
      await updateGoalProgress(milestone.goalId);

      return NextResponse.json(updatedMilestone);
    }

    // Action 2: Update Goal Details or Progress Directly
    if (!goalId) {
      return NextResponse.json({ message: 'Goal ID is required' }, { status: 400 });
    }

    const updatedGoal = await prisma.goal.update({
      where: { id: goalId },
      data: {
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(status ? { status } : {}),
        ...(progress !== undefined ? { progress: Number(progress) } : {}),
      },
    });

    return NextResponse.json(updatedGoal);
  } catch (error: any) {
    console.error('Goals PATCH route error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get('id');

    if (!goalId) {
      return NextResponse.json({ message: 'Goal ID is required' }, { status: 400 });
    }

    await prisma.goal.delete({
      where: { id: goalId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

// Internal Helper: recalculate and update goal progress percentage based on completed milestones
async function updateGoalProgress(goalId: string) {
  const milestones = await prisma.milestone.findMany({
    where: { goalId },
  });

  if (milestones.length === 0) return;

  const completed = milestones.filter((m) => m.status === 'COMPLETED').length;
  const progressPercent = Math.round((completed / milestones.length) * 100);

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      progress: progressPercent,
      status: progressPercent === 100 ? 'COMPLETED' : 'ACTIVE',
    },
  });
}
