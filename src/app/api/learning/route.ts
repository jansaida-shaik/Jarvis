import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const [skills, learningPlans, sessions] = await Promise.all([
      prisma.skill.findMany({
        where: { userId: user.id },
        orderBy: { name: 'asc' },
      }),
      prisma.learningPlan.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          sessions: true,
        },
      }),
      prisma.learningSession.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          skill: true,
        },
      }),
    ]);

    return NextResponse.json({
      skills,
      learningPlans,
      sessions,
    });
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
    const { action, name, category, proficiencyLevel, skillId, planId, durationMinutes, notes, title, description, recommendations } = body;

    // Action 1: Create a new Skill record
    if (action === 'create-skill') {
      if (!name || !category) {
        return NextResponse.json({ message: 'Skill name and category are required' }, { status: 400 });
      }

      const skill = await prisma.skill.create({
        data: {
          userId: user.id,
          name,
          category,
          proficiencyLevel: proficiencyLevel || 'BEGINNER',
        },
      });

      return NextResponse.json(skill);
    }

    // Action 2: Log a study session (LearningSession)
    if (action === 'log-session') {
      if (!durationMinutes) {
        return NextResponse.json({ message: 'Duration is required' }, { status: 400 });
      }

      const session = await prisma.learningSession.create({
        data: {
          userId: user.id,
          skillId: skillId || null,
          planId: planId || null,
          durationMinutes: Number(durationMinutes),
          notes,
        },
      });

      return NextResponse.json(session);
    }

    // Action 3: Create a learning roadmap (LearningPlan)
    if (action === 'create-plan') {
      if (!title) {
        return NextResponse.json({ message: 'Title is required' }, { status: 400 });
      }

      const plan = await prisma.learningPlan.create({
        data: {
          userId: user.id,
          title,
          description,
          status: 'ACTIVE',
          recommendations: recommendations ? JSON.stringify(recommendations) : null,
        },
      });

      // Log agent action
      await prisma.agentActivity.create({
        data: {
          userId: user.id,
          agentType: 'LEARNING',
          activityType: 'ROADMAP_GENERATION',
          status: 'SUCCESS',
          details: `Generated study roadmap: "${title}"`,
        },
      });

      return NextResponse.json(plan);
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Learning POST route error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
