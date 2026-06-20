import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions';

import { TOOL_DEFINITIONS, TOOL_NAMES } from './registry';
import { permissionGuard, PermissionError } from './permissions';
import { auditToolExecution } from './audit';
import { generateBriefingsAndInsights } from '@/lib/executive-engine';

// Handlers
import { create_goal, update_goal, delete_goal } from './handlers/goals';
import { create_milestone, complete_milestone } from './handlers/milestones';
import { create_task, update_task, complete_task } from './handlers/tasks';
import { create_project, create_note, delete_project, delete_note } from './handlers/projects';
import { save_memory, search_memory, delete_memory } from './handlers/memory';
import { search_knowledge } from './handlers/knowledge';
import {
  create_learning_plan,
  log_learning_session,
  generate_weekly_briefing,
} from './handlers/learning';

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER MAP
// Maps tool name → handler function
// ─────────────────────────────────────────────────────────────────────────────
type HandlerFn = (args: Record<string, unknown>, userId: string) => Promise<Record<string, unknown>>;

const HANDLER_MAP: Record<string, HandlerFn> = {
  'goal.create':              create_goal       as HandlerFn,
  'goal.update':              update_goal       as HandlerFn,
  'goal.delete':              delete_goal       as HandlerFn,
  'milestone.create':         create_milestone  as HandlerFn,
  'milestone.complete':       complete_milestone as HandlerFn,
  'task.create':              create_task       as HandlerFn,
  'task.update':              update_task       as HandlerFn,
  'task.complete':            complete_task     as HandlerFn,
  'project.create':           create_project    as HandlerFn,
  'project.delete':           delete_project    as HandlerFn,
  'project.create_note':      create_note       as HandlerFn,
  'project.delete_note':      delete_note       as HandlerFn,
  'memory.save':              save_memory       as HandlerFn,
  'memory.search':            search_memory     as HandlerFn,
  'memory.delete':            delete_memory     as HandlerFn,
  'knowledge.search':         search_knowledge  as HandlerFn,
  'learning.create_plan':     create_learning_plan     as HandlerFn,
  'learning.log_session':     log_learning_session     as HandlerFn,
  'executive.generate_weekly_briefing': generate_weekly_briefing as HandlerFn,
};

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE TOOL EXECUTOR
// Handles parse → permission → execute → audit for one tool call.
// Errors are returned as structured results, never thrown.
// ─────────────────────────────────────────────────────────────────────────────
export async function executeToolCall(
  toolCall: OpenAI.Chat.ChatCompletionMessageToolCall,
  userId:   string
): Promise<{ toolCallId: string; result: Record<string, unknown> }> {
  const toolCallId = toolCall.id;
  const startTime  = Date.now();

  if (toolCall.type !== 'function') {
    const result = { error: `Unsupported tool call type: ${toolCall.type}` };
    return { toolCallId, result };
  }

  const { name, arguments: rawArgs } = toolCall.function;

  // 1. Validate tool name
  if (!TOOL_NAMES.has(name)) {
    const result = { error: `Unknown tool: "${name}"` };
    await auditToolExecution(userId, name, {}, result, Date.now() - startTime);
    return { toolCallId, result };
  }

  // 2. Parse arguments
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArgs);
  } catch {
    const result = { error: `Failed to parse arguments for tool "${name}". The arguments were malformed JSON.` };
    await auditToolExecution(userId, name, {}, result, Date.now() - startTime);
    return { toolCallId, result };
  }

  // 3. Permission guard — verifies resource ownership
  try {
    await permissionGuard(name, args, userId);
  } catch (err) {
    if (err instanceof PermissionError) {
      const result = { error: err.message };
      await auditToolExecution(userId, name, args, result, Date.now() - startTime);
      return { toolCallId, result };
    }
    throw err; // Unexpected error — re-throw
  }

  // 4. Execute the handler
  let result: Record<string, unknown>;
  try {
    const handler = HANDLER_MAP[name];
    result = await handler(args, userId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    result = { error: `Tool "${name}" failed: ${message}` };
  }

  // 5. Audit log (never throws)
  await auditToolExecution(userId, name, args, result, Date.now() - startTime);

  return { toolCallId, result };
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL LOOP RESULT
// ─────────────────────────────────────────────────────────────────────────────
export interface ToolExecutionRecord {
  toolName: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface ToolLoopResult {
  /** Final message history with tool results appended — ready for Pass-2 streaming call */
  messages:       ChatCompletionMessageParam[];
  /** True if at least one tool was called during the loop */
  toolsExecuted:  boolean;
  /** Number of tool calls made across all loop iterations */
  toolCallCount:  number;
  /** Names of all tools that were called */
  toolsUsed:      string[];
  /** Array of all tool executions with arguments and results */
  executions:     ToolExecutionRecord[];
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL LOOP
// The multi-turn tool calling loop.
// Calls the LLM, executes any returned tool_calls, appends results,
// and loops until the LLM returns finish_reason: "stop".
// ─────────────────────────────────────────────────────────────────────────────
export async function runToolLoop(
  initialMessages: ChatCompletionMessageParam[],
  userId:          string,
  openai:          OpenAI
): Promise<ToolLoopResult> {
  const messages:     ChatCompletionMessageParam[] = [...initialMessages];
  let   toolsExecuted = false;
  let   toolCallCount = 0;
  const toolsUsed:    string[] = [];
  const executions:   ToolExecutionRecord[] = [];
  const MAX_ITERATIONS = 5;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // ── Non-streaming detection call ──────────────────────────────────────
    const response = await openai.chat.completions.create({
      model:       'gpt-4o-mini',
      messages,
      tools:       TOOL_DEFINITIONS,
      tool_choice: 'auto',
      stream:      false,
    });

    const choice = response.choices[0];
    if (!choice) break;

    const { finish_reason, message } = choice;

    // ── No tool calls → LLM wants to reply directly ───────────────────────
    if (finish_reason === 'stop') {
      if (message.content) {
        messages.push({ role: 'assistant', content: message.content });
      }
      break;
    }

    // ── Tool calls detected ────────────────────────────────────────────────
    if (finish_reason === 'tool_calls' && message.tool_calls && message.tool_calls.length > 0) {
      toolsExecuted = true;

      // Append assistant message with tool_calls (required by OpenAI spec)
      messages.push(message as ChatCompletionMessageParam);

      // Execute each tool call sequentially
      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== 'function') continue;
        toolsUsed.push(toolCall.function.name);
        toolCallCount++;

        console.log(`[executor] Running tool: ${toolCall.function.name}`, {
          args: toolCall.function.arguments,
        });

        const { toolCallId, result } = await executeToolCall(toolCall, userId);

        let parsedArgs = {};
        try { parsedArgs = JSON.parse(toolCall.function.arguments); } catch {}
        executions.push({
          toolName: toolCall.function.name,
          args: parsedArgs,
          result,
        });

        // Append tool result message
        messages.push({
          role:         'tool',
          tool_call_id: toolCallId,
          content:      JSON.stringify(result),
        });

        console.log(`[executor] Tool ${toolCall.function.name} result:`, result);
      }

      // Continue loop — give LLM a chance to call more tools or stop
      continue;
    }

    // Unknown finish_reason — exit loop safely
    break;
  }

  // Trigger Executive Re-Evaluation if any tools executed
  if (toolsExecuted) {
    try {
      console.log(`[executor] Triggering Executive Re-Evaluation for user ${userId}...`);
      await generateBriefingsAndInsights(userId);
    } catch (err) {
      console.error('[executor] Executive Re-Evaluation failed:', err);
    }
  }

  return { messages, toolsExecuted, toolCallCount, toolsUsed, executions };
}
