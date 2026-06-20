import { prisma } from '@/lib/db';

type AgentType = 'LEARNING' | 'PROJECT' | 'RESEARCH';

/**
 * Maps a tool name to the appropriate AgentActivity agentType.
 */
function mapToolToAgentType(toolName: string): AgentType {
  const projectTools = new Set([
    'create_task', 'update_task', 'complete_task',
    'create_project', 'create_note',
  ]);
  const researchTools = new Set([
    'save_memory', 'search_memory', 'search_knowledge',
    'generate_weekly_briefing',
  ]);

  if (projectTools.has(toolName)) return 'PROJECT';
  if (researchTools.has(toolName)) return 'RESEARCH';
  return 'LEARNING'; // goals, milestones, learning plans, sessions
}

/**
 * AUDIT LOGGER
 * Creates an AgentActivity record after every tool execution.
 * Failed tool calls are logged with status FAILED.
 * Never throws — audit failures must never break the main flow.
 */
export async function auditToolExecution(
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  durationMs: number
): Promise<void> {
  try {
    const hasError = result !== null && typeof result === 'object' && 'error' in (result as Record<string, unknown>);

    // Build a compact details string for the dashboard feed
    const safeArgs = { ...args };
    // Truncate long string fields for readability in the feed
    for (const key of Object.keys(safeArgs)) {
      if (typeof safeArgs[key] === 'string' && (safeArgs[key] as string).length > 80) {
        safeArgs[key] = (safeArgs[key] as string).slice(0, 80) + '…';
      }
    }

    const details = JSON.stringify({
      tool: toolName,
      args: safeArgs,
      result,
      durationMs,
    });

    await prisma.agentActivity.create({
      data: {
        userId,
        agentType:    mapToolToAgentType(toolName),
        activityType: toolName.toUpperCase(),
        status:       hasError ? 'FAILED' : 'SUCCESS',
        details,
      },
    });
  } catch (err) {
    // Audit failure must never propagate — log silently
    console.error('[audit] Failed to write AgentActivity:', err);
  }
}
