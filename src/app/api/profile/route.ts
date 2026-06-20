import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/**
 * GET: Retrieves the user's cognitive profile entries, snapshots, edit history, and system audits.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch Profile
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

    if (!profile) {
      profile = await prisma.cognitiveProfile.create({
        data: { userId: user.id },
        include: {
          entries: true,
          versions: true,
        },
      });
    }

    // 2. Fetch history logs, audit logs, decisions, and insights
    const [history, auditLogs, decisions, insights] = await Promise.all([
      prisma.cognitiveProfileHistory.findMany({
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
      }),
      prisma.cognitiveProfileAuditLog.findMany({
        where: { userId: user.id },
        orderBy: { timestamp: 'desc' },
        take: 30,
      }),
      prisma.decisionHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.coachingInsight.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // 3. Fetch or create learning profile
    let learningProfile = await prisma.learningProfile.findUnique({
      where: { userId: user.id },
      include: {
        progress: {
          include: { masteries: true }
        }
      }
    });

    if (!learningProfile) {
      learningProfile = await prisma.learningProfile.create({
        data: { userId: user.id },
        include: {
          progress: {
            include: { masteries: true }
          }
        }
      });
    }

    return NextResponse.json({
      profileId: profile.id,
      entries: profile.entries,
      versions: profile.versions,
      history,
      auditLogs,
      learningProfile,
      decisions,
      insights,
    });
  } catch (error: any) {
    console.error('Profile GET error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * POST: Handles manual profile overrides, entry creation, deletion, and manual snapshots.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, layer, key, value, reason, entryId } = body;

    // Fetch the profile id
    let profile = await prisma.cognitiveProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      profile = await prisma.cognitiveProfile.create({
        data: { userId: user.id },
      });
    }

    // --- Action 1: Manual Edit or Create ---
    if (action === 'manual-edit') {
      if (!layer || !key || value === undefined) {
        return NextResponse.json({ message: 'Layer, Key, and Value are required' }, { status: 400 });
      }

      const serializedValue = JSON.stringify(value);
      const changeReason = reason || 'Manual user modification.';

      const existingEntry = await prisma.cognitiveProfileEntry.findUnique({
        where: {
          profileId_layer_key: {
            profileId: profile.id,
            layer,
            key,
          },
        },
      });

      let updatedEntry;

      if (!existingEntry) {
        // Create new item
        updatedEntry = await prisma.cognitiveProfileEntry.create({
          data: {
            profileId: profile.id,
            layer,
            key,
            value: serializedValue,
            confidenceScore: 1.0, // Manual entries have full confidence
            source: 'USER_MANUAL',
          },
        });

        // Add history
        await prisma.cognitiveProfileHistory.create({
          data: {
            entryId: updatedEntry.id,
            newValue: serializedValue,
            newConfidence: 1.0,
            changeType: 'CREATE',
            reason: changeReason,
            source: 'USER_MANUAL',
          },
        });

        // Audit Log
        await prisma.cognitiveProfileAuditLog.create({
          data: {
            userId: user.id,
            action: 'MANUAL_EDIT',
            details: `Created entry: [${layer}] ${key} = "${serializedValue}"`,
          },
        });
      } else {
        // Update item
        const oldValue = existingEntry.value;
        const oldConfidence = existingEntry.confidenceScore;

        updatedEntry = await prisma.cognitiveProfileEntry.update({
          where: { id: existingEntry.id },
          data: {
            value: serializedValue,
            confidenceScore: 1.0,
            source: 'USER_MANUAL',
          },
        });

        // Add history
        await prisma.cognitiveProfileHistory.create({
          data: {
            entryId: existingEntry.id,
            oldValue,
            newValue: serializedValue,
            oldConfidence,
            newConfidence: 1.0,
            changeType: 'UPDATE',
            reason: changeReason,
            source: 'USER_MANUAL',
          },
        });

        // Audit Log
        await prisma.cognitiveProfileAuditLog.create({
          data: {
            userId: user.id,
            action: 'MANUAL_EDIT',
            details: `Modified entry: [${layer}] ${key} from "${oldValue}" to "${serializedValue}"`,
          },
        });
      }

      // Create new Version Snapshot
      await createProfileSnapshot(profile.id);

      return NextResponse.json(updatedEntry);
    }

    // --- Action 2: Delete Entry ---
    if (action === 'delete-entry') {
      if (!entryId) {
        return NextResponse.json({ message: 'Entry ID is required' }, { status: 400 });
      }

      const entry = await prisma.cognitiveProfileEntry.findUnique({
        where: { id: entryId },
      });

      if (!entry || entry.profileId !== profile.id) {
        return NextResponse.json({ message: 'Entry not found' }, { status: 404 });
      }

      // Write deletion history
      await prisma.cognitiveProfileHistory.create({
        data: {
          entryId: entry.id,
          oldValue: entry.value,
          newValue: '',
          oldConfidence: entry.confidenceScore,
          newConfidence: 0.0,
          changeType: 'DELETE',
          reason: reason || 'Manual deletion by user.',
          source: 'USER_MANUAL',
        },
      });

      // Remove actual entry
      await prisma.cognitiveProfileEntry.delete({
        where: { id: entryId },
      });

      // Audit log
      await prisma.cognitiveProfileAuditLog.create({
        data: {
          userId: user.id,
          action: 'MANUAL_DELETE',
          details: `Deleted entry: [${entry.layer}] ${entry.key}`,
        },
      });

      // Create new Version Snapshot
      await createProfileSnapshot(profile.id);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Profile POST error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * Helper: serializes all active entries and pushes a new snapshot version
 */
async function createProfileSnapshot(profileId: string) {
  const freshEntries = await prisma.cognitiveProfileEntry.findMany({
    where: { profileId },
  });

  const latestVersion = await prisma.cognitiveProfileVersion.findFirst({
    where: { profileId },
    orderBy: { version: 'desc' },
  });

  const nextVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

  await prisma.cognitiveProfileVersion.create({
    data: {
      profileId,
      version: nextVersionNumber,
      stateSnapshot: JSON.stringify(freshEntries),
      description: `Manual modifications by user.`,
    },
  });
}
