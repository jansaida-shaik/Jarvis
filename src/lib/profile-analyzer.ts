import { prisma } from './db';
import OpenAI from 'openai';
import { CognitiveProfileEntry } from '../../generated/prisma/client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-to-prevent-sdk-crash',
});

interface ProfileUpdateOperation {
  layer: string;
  key: string;
  value: unknown;
  confidence: number;
  reason: string;
  contradiction: boolean;
  contradictedKey?: string;
}

/**
 * Core orchestrator to analyze chat history and sync to the user's Cognitive Profile.
 */
export async function analyzeAndSyncProfile(
  userId: string,
  userMessage: string,
  assistantMessage: string,
  conversationId?: string
) {
  try {
    // 1. Get or create the user's Cognitive Profile anchor
    let profile = await prisma.cognitiveProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await prisma.cognitiveProfile.create({
        data: { userId },
      });
    }

    // 2. Fetch existing profile entries for context
    const currentEntries = await prisma.cognitiveProfileEntry.findMany({
      where: { profileId: profile.id },
    });

    const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy-key-to-prevent-sdk-crash';
    let operations: ProfileUpdateOperation[] = [];

    if (hasApiKey) {
      // LLM-based structured extraction
      operations = await runLLMAnalysis(userMessage, assistantMessage, currentEntries);
    } else {
      // Heuristic fallback rules (offline mode)
      operations = runHeuristicAnalysis(userMessage, assistantMessage, currentEntries);
    }

    if (operations.length === 0) return;

    let profileChanged = false;

    // 3. Process each operation
    for (const op of operations) {
      const existingEntry = currentEntries.find(
        (e) => e.layer === op.layer && e.key === op.key
      );

      const serializedValue = JSON.stringify(op.value);

      if (op.contradiction) {
        // Log contradiction warning in audits
        await prisma.cognitiveProfileAuditLog.create({
          data: {
            userId,
            action: 'CONTRADICTION_DETECTED',
            details: `Conflict detected in ${op.layer}.${op.key}: ${op.reason}`,
            metadata: JSON.stringify({
              layer: op.layer,
              key: op.key,
              proposedValue: op.value,
              existingValue: existingEntry ? JSON.parse(existingEntry.value) : null,
              conversationId,
            }),
          },
        });
      }

      if (!existingEntry) {
        // Create new profile item
        const newEntry = await prisma.cognitiveProfileEntry.create({
          data: {
            profileId: profile.id,
            layer: op.layer,
            key: op.key,
            value: serializedValue,
            confidenceScore: op.confidence,
            source: hasApiKey ? 'AI_CHAT_LLM' : 'AI_CHAT_HEURISTIC',
            sourceReference: conversationId || null,
          },
        });

        // Add history entry
        await prisma.cognitiveProfileHistory.create({
          data: {
            entryId: newEntry.id,
            newValue: serializedValue,
            newConfidence: op.confidence,
            changeType: 'CREATE',
            reason: op.reason,
            source: hasApiKey ? 'AI_CHAT_LLM' : 'AI_CHAT_HEURISTIC',
            sourceReference: conversationId || null,
          },
        });

        // Audit Log
        await prisma.cognitiveProfileAuditLog.create({
          data: {
            userId,
            action: 'AUTO_EXTRACTED',
            details: `Identified new profile item: [${op.layer}] ${op.key} = "${typeof op.value === 'object' ? JSON.stringify(op.value) : op.value}"`,
          },
        });

        profileChanged = true;
      } else {
        const currentValParsed = JSON.parse(existingEntry.value);
        const isSameValue = JSON.stringify(currentValParsed) === JSON.stringify(op.value);

        if (isSameValue) {
          // Affirmation: bump confidence score slightly
          const oldConfidence = existingEntry.confidenceScore;
          const newConfidence = Math.min(1.0, oldConfidence + 0.05);

          if (newConfidence !== oldConfidence) {
            await prisma.cognitiveProfileEntry.update({
              where: { id: existingEntry.id },
              data: { confidenceScore: newConfidence },
            });

            await prisma.cognitiveProfileHistory.create({
              data: {
                entryId: existingEntry.id,
                oldValue: existingEntry.value,
                newValue: existingEntry.value,
                oldConfidence,
                newConfidence,
                changeType: 'CONFIDENCE_ADJUSTMENT',
                reason: `Confidence increased via reinforcement: "${op.reason}"`,
                source: hasApiKey ? 'AI_CHAT_LLM' : 'AI_CHAT_HEURISTIC',
                sourceReference: conversationId || null,
              },
            });

            profileChanged = true;
          }
        } else {
          // Value changed: overwrite if incoming confidence is high, or if we decide to override
          // For safety, we will perform the update and log the change details
          const oldConfidence = existingEntry.confidenceScore;
          const oldValue = existingEntry.value;

          await prisma.cognitiveProfileEntry.update({
            where: { id: existingEntry.id },
            data: {
              value: serializedValue,
              confidenceScore: op.confidence,
              source: hasApiKey ? 'AI_CHAT_LLM' : 'AI_CHAT_HEURISTIC',
              sourceReference: conversationId || null,
            },
          });

          await prisma.cognitiveProfileHistory.create({
            data: {
              entryId: existingEntry.id,
              oldValue,
              newValue: serializedValue,
              oldConfidence,
              newConfidence: op.confidence,
              changeType: 'UPDATE',
              reason: op.reason,
              source: hasApiKey ? 'AI_CHAT_LLM' : 'AI_CHAT_HEURISTIC',
              sourceReference: conversationId || null,
            },
          });

          await prisma.cognitiveProfileAuditLog.create({
            data: {
              userId,
              action: 'PROFILE_UPDATED',
              details: `Updated [${op.layer}] ${op.key} (confidence: ${op.confidence}) - ${op.reason}`,
            },
          });

          profileChanged = true;
        }
      }
    }

    // 4. Save a new version snapshot if changes occurred
    if (profileChanged) {
      const freshEntries = await prisma.cognitiveProfileEntry.findMany({
        where: { profileId: profile.id },
      });

      const latestVersion = await prisma.cognitiveProfileVersion.findFirst({
        where: { profileId: profile.id },
        orderBy: { version: 'desc' },
      });

      const nextVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

      await prisma.cognitiveProfileVersion.create({
        data: {
          profileId: profile.id,
          version: nextVersionNumber,
          stateSnapshot: JSON.stringify(freshEntries),
          description: `Auto-sync from conversation updates.`,
        },
      });

      // Update background agent feed details
      await prisma.agentActivity.create({
        data: {
          userId,
          agentType: 'LEARNING',
          activityType: 'PROFILE_SYNC',
          status: 'SUCCESS',
          details: `Synchronized Personal Cognitive Profile to Version ${nextVersionNumber}.`,
        },
      });
    }

  } catch (error) {
    console.error('analyzeAndSyncProfile error:', error);
  }
}

/**
 * Structured LLM Cognitive Extractor
 */
async function runLLMAnalysis(
  userMsg: string,
  assistantMsg: string,
  currentEntries: CognitiveProfileEntry[]
): Promise<ProfileUpdateOperation[]> {
  try {
    const formattedContext = currentEntries
      .map((e) => `[${e.layer}] ${e.key}: ${e.value} (confidence: ${e.confidenceScore})`)
      .join('\n');

    const promptText = `
Analyze the following conversation dialogue between the User and the AI Assistant.
Extract updates to the User's Personal Cognitive Profile.

EXISTING PROFILE FACTS:
${formattedContext || 'None registered yet.'}

NEW DIALOGUE:
User: "${userMsg}"
Assistant: "${assistantMsg}"

Your response must be a valid JSON object matching this schema:
{
  "updates": [
    {
      "layer": "IDENTITY" | "SKILLS" | "LEARNING" | "CAREER" | "PROJECTS" | "DECISION" | "PRODUCTIVITY" | "STRENGTHS" | "WEAKNESS" | "INTEREST" | "VISION" | "RELATIONSHIP" | "MEMORY",
      "key": "specific snake_case property key, e.g. current_role, salary_goals, target_roles, technical_skills, work_patterns, proven_strengths",
      "value": "string value OR array of values OR boolean",
      "confidence": 0.0 to 1.0 (confidence score of the extraction),
      "reason": "short explanation of the extraction, why it changed, or why it matches",
      "contradiction": true/false (set to true if this new message directly conflicts with an existing value above),
      "contradictedKey": "the key name that was contradicted (if contradiction is true)"
    }
  ]
}

Ensure values like skills or interests are parsed as Arrays of strings if they contain multiple list elements.
Only output values you are confident in (confidence > 0.4). If nothing in this exchange updates who the user is or what they want, return an empty array for "updates".
Do NOT output any markdown tags (like \`\`\`json) in your raw response. Provide ONLY the raw stringified JSON object.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: promptText }],
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);
    return parsed.updates || [];
  } catch (err) {
    console.warn('LLM Profile analysis failed, falling back to heuristics:', err);
    return runHeuristicAnalysis(userMsg, assistantMsg, currentEntries);
  }
}

/**
 * Offline rule-based parser (Heuristics fallback)
 */
function runHeuristicAnalysis(
  userMsg: string,
  assistantMsg: string,
  currentEntries: CognitiveProfileEntry[]
): ProfileUpdateOperation[] {
  const operations: ProfileUpdateOperation[] = [];
  const textLower = userMsg.toLowerCase();

  // Helper to check for conflicts
  const checkConflict = (layer: string, key: string, newValue: unknown) => {
    const existing = currentEntries.find((e) => e.layer === layer && e.key === key);
    if (existing) {
      const parsedVal = JSON.parse(existing.value);
      if (JSON.stringify(parsedVal) !== JSON.stringify(newValue)) {
        return { contradiction: true, msg: `User previously defined ${key} as "${existing.value}", now says "${newValue}"` };
      }
    }
    return { contradiction: false, msg: '' };
  };

  // Rule 1: Technical skills extraction
  if (textLower.includes('learning') || textLower.includes('mastering') || textLower.includes('studying')) {
    let skillFound = '';
    if (textLower.includes('pytorch')) skillFound = 'PyTorch';
    if (textLower.includes('tensorflow')) skillFound = 'TensorFlow';
    if (textLower.includes('next.js') || textLower.includes('nextjs')) skillFound = 'Next.js';
    if (textLower.includes('rust')) skillFound = 'Rust';
    if (textLower.includes('docker')) skillFound = 'Docker';
    if (textLower.includes('jax')) skillFound = 'JAX';

    if (skillFound) {
      // Get existing skills
      const existing = currentEntries.find((e) => e.layer === 'SKILLS' && e.key === 'technical_skills');
      let currentList: string[] = [];
      if (existing) {
        currentList = JSON.parse(existing.value);
      }

      if (!currentList.includes(skillFound)) {
        const newList = [...currentList, skillFound];
        const conflict = checkConflict('SKILLS', 'technical_skills', newList);
        operations.push({
          layer: 'SKILLS',
          key: 'technical_skills',
          value: newList,
          confidence: 0.9,
          reason: `Observed mention of studying/learning: "${skillFound}"`,
          contradiction: conflict.contradiction,
          contradictedKey: conflict.contradiction ? 'technical_skills' : undefined,
        });
      }
    }
  }

  // Rule 2: Target role extraction
  if (textLower.includes('target role') || textLower.includes('want to become') || textLower.includes('career goal')) {
    let role = '';
    if (textLower.includes('architect')) role = 'Software Architect';
    if (textLower.includes('manager')) role = 'Engineering Manager';
    if (textLower.includes('director')) role = 'Director of Engineering';
    if (textLower.includes('designer')) role = 'Product Designer';
    if (textLower.includes('scientist')) role = 'Data Scientist';

    if (role) {
      const conflict = checkConflict('CAREER', 'target_roles', [role]);
      operations.push({
        layer: 'CAREER',
        key: 'target_roles',
        value: [role],
        confidence: 0.95,
        reason: `User declared career role target: "${role}"`,
        contradiction: conflict.contradiction,
        contradictedKey: conflict.contradiction ? 'target_roles' : undefined,
      });
    }
  }

  // Rule 3: Decisions extraction
  if (textLower.includes('decided to') || textLower.includes('made a decision')) {
    const startIdx = Math.max(0, textLower.indexOf('decided to') + 10);
    const decisionText = userMsg.slice(startIdx, startIdx + 80).trim();
    if (decisionText.length > 5) {
      operations.push({
        layer: 'DECISION',
        key: 'recent_decision',
        value: decisionText,
        confidence: 0.8,
        reason: `User registered a key decision: "${decisionText}..."`,
        contradiction: false,
      });
    }
  }

  // Rule 4: Weakness/Blockers extraction
  if (textLower.includes('struggle with') || textLower.includes('blocker') || textLower.includes('hard to focus')) {
    let blocker = '';
    if (textLower.includes('procrastinat')) blocker = 'Procrastination';
    if (textLower.includes('meeting')) blocker = 'Too many meetings';
    if (textLower.includes('setup') || textLower.includes('config')) blocker = 'Environment config friction';
    if (textLower.includes('sleep') || textLower.includes('tired')) blocker = 'Lack of rest / fatigue';

    if (blocker) {
      const existing = currentEntries.find((e) => e.layer === 'WEAKNESS' && e.key === 'productivity_blockers');
      let currentList: string[] = [];
      if (existing) {
        currentList = JSON.parse(existing.value);
      }

      if (!currentList.includes(blocker)) {
        operations.push({
          layer: 'WEAKNESS',
          key: 'productivity_blockers',
          value: [...currentList, blocker],
          confidence: 0.85,
          reason: `Auto-identified workspace blocker: "${blocker}"`,
          contradiction: false,
        });
      }
    }
  }

  return operations;
}
