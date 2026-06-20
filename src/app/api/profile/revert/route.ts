import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/**
 * POST: Restores the active user profile states to a previously recorded snapshot version.
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json({ message: 'Version ID is required' }, { status: 400 });
    }

    // 1. Fetch Profile
    const profile = await prisma.cognitiveProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ message: 'Profile not found' }, { status: 404 });
    }

    // 2. Fetch the target version
    const targetVersion = await prisma.cognitiveProfileVersion.findUnique({
      where: { id: versionId },
    });

    if (!targetVersion || targetVersion.profileId !== profile.id) {
      return NextResponse.json({ message: 'Version not found' }, { status: 404 });
    }

    const snapshotEntries = JSON.parse(targetVersion.stateSnapshot);

    // 3. Clear existing profile entries and recreate them using target version data
    await prisma.$transaction(async (tx) => {
      // Delete all active entries
      await tx.cognitiveProfileEntry.deleteMany({
        where: { profileId: profile.id },
      });

      // Insert target entries
      for (const entry of snapshotEntries) {
        const restoredEntry = await tx.cognitiveProfileEntry.create({
          data: {
            profileId: profile.id,
            layer: entry.layer,
            key: entry.key,
            value: entry.value,
            confidenceScore: entry.confidenceScore,
            source: 'USER_REVERT_RESTORE',
          },
        });

        // Add history
        await tx.cognitiveProfileHistory.create({
          data: {
            entryId: restoredEntry.id,
            newValue: entry.value,
            newConfidence: entry.confidenceScore,
            changeType: 'UPDATE',
            reason: `Restored from Profile Version ${targetVersion.version}.`,
            source: 'USER_REVERT_RESTORE',
          },
        });
      }

      // Add audit log
      await tx.cognitiveProfileAuditLog.create({
        data: {
          userId: user.id,
          action: 'VERSION_RESTORED',
          details: `Rolled back profile facts to Version ${targetVersion.version} (snapshot id: ${targetVersion.id}).`,
        },
      });
    });

    // 4. Create a new Version representing the current state (incremented sequential number)
    const latestVersion = await prisma.cognitiveProfileVersion.findFirst({
      where: { profileId: profile.id },
      orderBy: { version: 'desc' },
    });

    const nextVersionNumber = latestVersion ? latestVersion.version + 1 : 1;
    const currentEntries = await prisma.cognitiveProfileEntry.findMany({
      where: { profileId: profile.id },
    });

    await prisma.cognitiveProfileVersion.create({
      data: {
        profileId: profile.id,
        version: nextVersionNumber,
        stateSnapshot: JSON.stringify(currentEntries),
        description: `Restored state of Version ${targetVersion.version}.`,
      },
    });

    return NextResponse.json({ success: true, restoredVersion: targetVersion.version });
  } catch (error: any) {
    console.error('Revert API error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
