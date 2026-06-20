import { prisma } from './db';

export interface GamificationResult {
  xpEarned: number;
  newXp: number;
  oldLevel: number;
  newLevel: number;
  levelUp: boolean;
  badgeUnlocked?: string;
}

/**
 * Awards XP to a user, checks for level ups, and evaluates badges.
 */
export async function awardXp(
  userId: string,
  amount: number,
  actionDescription: string
): Promise<GamificationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, level: true, badgesJson: true },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const oldXp = user.xp;
  const oldLevel = user.level;
  const newXp = oldXp + amount;
  const newLevel = Math.floor(newXp / 1000) + 1;
  const levelUp = newLevel > oldLevel;

  let currentBadges: string[] = [];
  try {
    currentBadges = JSON.parse(user.badgesJson || '[]');
  } catch {
    currentBadges = [];
  }

  const newlyUnlockedBadges: string[] = [];

  // Evaluate badge: "First Step Taken" (first completed milestone)
  if (!currentBadges.includes('First Step Taken')) {
    const completedMilestoneCount = await prisma.milestone.count({
      where: {
        status: 'COMPLETED',
        goal: { userId },
      },
    });
    if (completedMilestoneCount >= 1) {
      newlyUnlockedBadges.push('First Step Taken');
    }
  }

  // Evaluate badge: "Epic Scholar" (5 learning sessions)
  if (!currentBadges.includes('Epic Scholar')) {
    const sessionCount = await prisma.learningSession.count({
      where: { userId },
    });
    if (sessionCount >= 5) {
      newlyUnlockedBadges.push('Epic Scholar');
    }
  }

  // Evaluate badge: "Strategic Architect" (3 completed goals)
  if (!currentBadges.includes('Strategic Architect')) {
    const completedGoalsCount = await prisma.goal.count({
      where: { userId, status: 'COMPLETED' },
    });
    if (completedGoalsCount >= 3) {
      newlyUnlockedBadges.push('Strategic Architect');
    }
  }

  const updatedBadges = [...currentBadges, ...newlyUnlockedBadges];

  // Update user in DB
  await prisma.user.update({
    where: { id: userId },
    data: {
      xp: newXp,
      level: newLevel,
      badgesJson: JSON.stringify(updatedBadges),
    },
  });

  // Log level up activity if occurred
  if (levelUp) {
    await prisma.agentActivity.create({
      data: {
        userId,
        agentType: 'LEARNING',
        activityType: 'LEVEL_UP',
        status: 'SUCCESS',
        details: `User leveled up to Level ${newLevel}!`,
      },
    });
  }

  // Log badge activity if unlocked
  for (const badge of newlyUnlockedBadges) {
    await prisma.agentActivity.create({
      data: {
        userId,
        agentType: 'LEARNING',
        activityType: 'BADGE_UNLOCKED',
        status: 'SUCCESS',
        details: `Unlocked "${badge}" badge!`,
      },
    });
  }

  return {
    xpEarned: amount,
    newXp,
    oldLevel,
    newLevel,
    levelUp,
    badgeUnlocked: newlyUnlockedBadges.length > 0 ? newlyUnlockedBadges[0] : undefined,
  };
}
