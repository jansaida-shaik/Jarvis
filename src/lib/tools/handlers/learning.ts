import { prisma } from '@/lib/db';
import { generateBriefingsAndInsights } from '@/lib/executive-engine';
import { awardXp } from '@/lib/gamification';
import type { ToolResult } from './goals';

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: learning.create_plan
// Automatically updates Active Topics in LearningProgress
// ─────────────────────────────────────────────────────────────────────────────
export async function create_learning_plan(
  args: {
    title:           string;
    description?:    string;
    recommendations?: string[];
  },
  userId: string
): Promise<ToolResult> {
  if (!args.title?.trim()) return { error: 'title is required to create a learning plan' };

  const plan = await prisma.learningPlan.create({
    data: {
      userId,
      title:           args.title.trim(),
      description:     args.description || null,
      status:          'ACTIVE',
      recommendations: args.recommendations
        ? JSON.stringify(args.recommendations)
        : null,
    },
  });

  // Automatically update/create User LearningProfile and LearningProgress
  let learningProfile = await prisma.learningProfile.findUnique({
    where: { userId },
  });

  if (!learningProfile) {
    learningProfile = await prisma.learningProfile.create({
      data: { userId },
    });
  }

  // Create learning progress for this active topic
  const topic = plan.title.replace(/— Roadmap/gi, '').replace(/Roadmap/gi, '').trim();
  await prisma.learningProgress.upsert({
    where: {
      profileId_topic: {
        profileId: learningProfile.id,
        topic,
      },
    },
    create: {
      profileId: learningProfile.id,
      topic,
      understandingScore: 0.1,
      confidenceScore: 0.1,
    },
    update: {
      updatedAt: new Date(),
    },
  });

  // Save Memory context
  const dateStr = new Date().toISOString().split('T')[0];
  await prisma.memory.create({
    data: {
      userId,
      content: `User created learning roadmap "${plan.title}" on ${dateStr}.`,
      category: 'LEARNING',
      sentiment: 'NEUTRAL',
    },
  });

  await prisma.agentActivity.create({
    data: {
      userId,
      agentType:    'LEARNING',
      activityType: 'ROADMAP_GENERATION',
      status:       'SUCCESS',
      details:      `Created learning roadmap: "${plan.title}"`,
    },
  });

  return {
    planId:  plan.id,
    title:   plan.title,
    status:  plan.status,
    message: `Learning plan "${plan.title}" created successfully. Added "${topic}" to active study topics.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: learning.log_session
// Updates Retention, Mastery, Confidence, and awards +25 XP
// ─────────────────────────────────────────────────────────────────────────────
export async function log_learning_session(
  args: {
    durationMinutes: number;
    notes?:          string;
    skillId?:        string;
    planId?:         string;
  },
  userId: string
): Promise<ToolResult> {
  if (!args.durationMinutes || args.durationMinutes < 1) {
    return { error: 'durationMinutes must be at least 1' };
  }

  const session = await prisma.learningSession.create({
    data: {
      userId,
      durationMinutes: Math.round(Number(args.durationMinutes)),
      notes:           args.notes   || null,
      skillId:         args.skillId || null,
      planId:          args.planId  || null,
    },
  });

  // Automatically update LearningProfile and LearningProgress
  let learningProfile = await prisma.learningProfile.findUnique({
    where: { userId },
  });

  if (!learningProfile) {
    learningProfile = await prisma.learningProfile.create({
      data: { userId },
    });
  }

  // Update retention score slightly
  const newRetention = Math.min(1.0, learningProfile.retentionScore + 0.05);
  await prisma.learningProfile.update({
    where: { id: learningProfile.id },
    data: {
      retentionScore: newRetention,
      lastSessionAt: new Date(),
    },
  });

  // If planId is provided, advance topic progress and concepts mastery
  let topicName = 'General Study';
  let progressRecord = null;
  if (args.planId) {
    const plan = await prisma.learningPlan.findUnique({ where: { id: args.planId } });
    if (plan) {
      topicName = plan.title.replace(/— Roadmap/gi, '').replace(/Roadmap/gi, '').trim();
      
      // Upsert LearningProgress
      progressRecord = await prisma.learningProgress.upsert({
        where: {
          profileId_topic: {
            profileId: learningProfile.id,
            topic: topicName,
          },
        },
        create: {
          profileId: learningProfile.id,
          topic: topicName,
          understandingScore: 0.2,
          confidenceScore: 0.2,
          reviewCount: 1,
        },
        update: {
          confidenceScore: { increment: 0.1 },
          understandingScore: { increment: 0.1 },
          reviewCount: { increment: 1 },
          lastReviewedAt: new Date(),
        },
      });

      // Clamp understanding and confidence scores to 1.0 max
      const updatedProgress = await prisma.learningProgress.findUnique({
        where: { id: progressRecord.id },
      });
      if (updatedProgress) {
        await prisma.learningProgress.update({
          where: { id: progressRecord.id },
          data: {
            confidenceScore: Math.min(1.0, updatedProgress.confidenceScore),
            understandingScore: Math.min(1.0, updatedProgress.understandingScore),
          },
        });
      }

      // Add ConceptMastery if notes exist
      if (args.notes && args.notes.trim()) {
        // Extract a clean concept name (e.g. first 30 chars or first words)
        const concept = args.notes.trim().slice(0, 35).replace(/[.#$]/g, '') + (args.notes.length > 35 ? '...' : '');
        await prisma.conceptMastery.upsert({
          where: {
            progressId_concept: {
              progressId: progressRecord.id,
              concept,
            },
          },
          create: {
            progressId: progressRecord.id,
            concept,
            status: 'LEARNED',
          },
          update: {
            status: 'MASTERED', // Upgraded if studied repeatedly
            updatedAt: new Date(),
          },
        });
      }
    }
  }

  // Award XP (+25 XP)
  const gamification = await awardXp(
    userId,
    25,
    `Logged ${session.durationMinutes} mins of learning in topic: "${topicName}"`
  );

  // Save Memory context
  const dateStr = new Date().toISOString().split('T')[0];
  await prisma.memory.create({
    data: {
      userId,
      content: `User completed a ${session.durationMinutes}-minute learning session on topic "${topicName}" on ${dateStr}.`,
      category: 'LEARNING',
      sentiment: 'POSITIVE',
    },
  });

  return {
    sessionId:       session.id,
    durationMinutes: session.durationMinutes,
    gamification,
    message:         `Logged a ${session.durationMinutes}-minute learning session. Added +25 XP!`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER: executive.generate_weekly_briefing
// Runs the Executive Intelligence engine and returns the briefing summary.
// ─────────────────────────────────────────────────────────────────────────────
export async function generate_weekly_briefing(
  args: Record<string, never>,
  userId: string
): Promise<ToolResult> {
  // Run the full executive scan
  await generateBriefingsAndInsights(userId);

  // Retrieve the freshly generated weekly briefing
  const weeklyBrief = await prisma.executiveBriefing.findFirst({
    where:   { userId, timeframe: 'WEEKLY' },
    orderBy: { createdAt: 'desc' },
  });

  const insights = await prisma.executiveInsight.findMany({
    where:   { userId, status: 'ACTIVE' },
    orderBy: { confidence: 'desc' },
    take:    5,
  });

  return {
    weeklyBriefingSummary: weeklyBrief?.summary || 'No briefing generated — insufficient data yet.',
    topInsights: insights.map((i) => ({
      type:           i.type,
      title:          i.title,
      recommendation: i.recommendation,
      confidence:     i.confidence,
    })),
    message: weeklyBrief
      ? 'Executive briefing generated. Here is your strategic summary.'
      : 'Briefing generation ran but no weekly summary was produced — you may need more data.',
  };
}
