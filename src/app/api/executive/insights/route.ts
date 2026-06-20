import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { insightId, action, value } = await request.json();
    if (!insightId || !action) {
      return NextResponse.json({ message: 'Insight ID and action are required' }, { status: 400 });
    }

    const insight = await prisma.executiveInsight.findUnique({
      where: { id: insightId },
    });

    if (!insight || insight.userId !== user.id) {
      return NextResponse.json({ message: 'Insight not found' }, { status: 404 });
    }

    let updatedInsight;

    if (action === 'dismiss') {
      updatedInsight = await prisma.executiveInsight.update({
        where: { id: insightId },
        data: { status: 'DISMISSED' },
      });
    } else if (action === 'resolve') {
      updatedInsight = await prisma.executiveInsight.update({
        where: { id: insightId },
        data: { status: 'RESOLVED', followUpStatus: 'COMPLETED' },
      });
    } else if (action === 'update-followup') {
      if (!value) {
        return NextResponse.json({ message: 'Value is required for follow-up update' }, { status: 400 });
      }
      updatedInsight = await prisma.executiveInsight.update({
        where: { id: insightId },
        data: { followUpStatus: value },
      });
    } else {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(updatedInsight);
  } catch (error: any) {
    console.error('Insights POST error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
