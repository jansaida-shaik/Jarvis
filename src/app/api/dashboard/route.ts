import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Run dashboard aggregate queries in parallel
    const [
      goalsCount,
      completedMilestonesCount,
      skillsCount,
      totalStudyMinutes,
      activeProjectsCount,
      recentChats,
      activeGoals,
      upcomingTasks,
      recentMemories,
      agentActivities,
    ] = await Promise.all([
      prisma.goal.count({ where: { userId: user.id } }),
      prisma.milestone.count({ where: { goal: { userId: user.id }, status: 'COMPLETED' } }),
      prisma.skill.count({ where: { userId: user.id } }),
      prisma.learningSession.aggregate({
        where: { userId: user.id },
        _sum: { durationMinutes: true },
      }),
      prisma.project.count({ where: { userId: user.id, status: 'IN_PROGRESS' } }),
      prisma.conversation.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.goal.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        orderBy: { progress: 'desc' },
        take: 3,
        include: {
          milestones: true,
        },
      }),
      prisma.task.findMany({
        where: { userId: user.id, status: { in: ['TODO', 'IN_PROGRESS'] } },
        orderBy: { dueDate: 'asc' },
        take: 4,
        include: {
          project: true,
        },
      }),
      prisma.memory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
      prisma.agentActivity.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 4,
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalGoals: goalsCount,
        completedMilestones: completedMilestonesCount,
        skillsCount: skillsCount,
        studyHours: Math.round((totalStudyMinutes._sum.durationMinutes || 0) / 60 * 10) / 10,
        activeProjects: activeProjectsCount,
      },
      recentChats: recentChats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        lastMessage: chat.messages[0]?.content || 'No messages yet',
        updatedAt: chat.updatedAt,
      })),
      activeGoals,
      upcomingTasks,
      recentMemories,
      agentActivities,
    });
  } catch (error: any) {
    console.error('Dashboard route error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
