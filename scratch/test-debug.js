const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  const user = await prisma.user.findFirst({
    where: { email: 'jansaida1234@gmail.com' }
  });
  console.log('User:', user.id);
  
  let profile = await prisma.cognitiveProfile.findUnique({
    where: { userId: user.id },
    include: {
      entries: {
        orderBy: { layer: 'asc' },
      },
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });
  console.log('Profile fetched');

  // Let's run each query one by one to see which one fails!
  try {
    const history = await prisma.cognitiveProfileHistory.findMany({
      where: {
        entry: {
          profileId: profile.id,
        },
      },
      orderBy: { timestamp: 'desc' },
      include: {
        entry: {
          select: { layer: true, key: true },
        },
      },
      take: 30,
    });
    console.log('History query succeeded, count:', history.length);
  } catch (err) {
    console.error('History query failed:', err);
  }

  try {
    const auditLogs = await prisma.cognitiveProfileAuditLog.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' },
      take: 30,
    });
    console.log('Audit logs query succeeded, count:', auditLogs.length);
  } catch (err) {
    console.error('Audit logs query failed:', err);
  }

  try {
    const decisions = await prisma.decisionHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    console.log('Decisions query succeeded, count:', decisions.length);
  } catch (err) {
    console.error('Decisions query failed:', err);
  }

  try {
    const insights = await prisma.coachingInsight.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    console.log('Insights query succeeded, count:', insights.length);
  } catch (err) {
    console.error('Insights query failed:', err);
  }

  try {
    let learningProfile = await prisma.learningProfile.findUnique({
      where: { userId: user.id },
      include: {
        progress: {
          include: { masteries: true }
        }
      }
    });
    console.log('learningProfile query succeeded:', !!learningProfile);
    if (!learningProfile) {
      console.log('Attempting to create learningProfile...');
      learningProfile = await prisma.learningProfile.create({
        data: { userId: user.id },
        include: {
          progress: {
            include: { masteries: true }
          }
        }
      });
      console.log('learningProfile created successfully:', learningProfile);
    }
  } catch (err) {
    console.error('learningProfile query/create failed:', err);
  }
}

debug();
