import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateBriefingsAndInsights } from '@/lib/executive-engine';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the latest daily, weekly, and monthly briefings
    const dailyBrief = await prisma.executiveBriefing.findFirst({
      where: { userId: user.id, timeframe: 'DAILY' },
      orderBy: { createdAt: 'desc' },
    });

    const weeklyBrief = await prisma.executiveBriefing.findFirst({
      where: { userId: user.id, timeframe: 'WEEKLY' },
      orderBy: { createdAt: 'desc' },
    });

    const monthlyBrief = await prisma.executiveBriefing.findFirst({
      where: { userId: user.id, timeframe: 'MONTHLY' },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch active insights
    const insights = await prisma.executiveInsight.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { confidence: 'desc' },
    });

    return NextResponse.json({
      dailyBrief,
      weeklyBrief,
      monthlyBrief,
      insights,
    });
  } catch (error: any) {
    console.error('Briefings GET error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Run scans
    const scanResults = await generateBriefingsAndInsights(user.id);

    // Re-fetch updated briefing data
    const dailyBrief = await prisma.executiveBriefing.findFirst({
      where: { userId: user.id, timeframe: 'DAILY' },
      orderBy: { createdAt: 'desc' },
    });

    const weeklyBrief = await prisma.executiveBriefing.findFirst({
      where: { userId: user.id, timeframe: 'WEEKLY' },
      orderBy: { createdAt: 'desc' },
    });

    const monthlyBrief = await prisma.executiveBriefing.findFirst({
      where: { userId: user.id, timeframe: 'MONTHLY' },
      orderBy: { createdAt: 'desc' },
    });

    const insights = await prisma.executiveInsight.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      orderBy: { confidence: 'desc' },
    });

    return NextResponse.json({
      scanResults,
      dailyBrief,
      weeklyBrief,
      monthlyBrief,
      insights,
    });
  } catch (error: any) {
    console.error('Briefings POST error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
