import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import OpenAI from 'openai';
import { analyzeAndSyncProfile } from '@/lib/profile-analyzer';
import { getMentorContext, syncDialogMentorship } from '@/lib/mentor-engine';
import { getProactivePromptContext } from '@/lib/executive-engine';
import { runToolLoop, executeToolCall } from '@/lib/tools/executor';

// Initialize OpenAI client (gracefully handles empty key)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-to-prevent-sdk-crash',
});

// A helper to simulate streaming for mock responses when no OpenAI API Key is set
function createMockStream(text: string) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      // Split text by word/token to simulate a realistic streaming flow
      const chunks = text.split(' ');
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk + ' '));
        await new Promise((resolve) => setTimeout(resolve, 60)); // typing speed simulation
      }
      controller.close();
    },
  });
}

// Memory extraction logic from chat prompt
async function triggerMemoryExtraction(userId: string, userMessage: string, assistantMessage: string) {
  try {
    // Simple heuristic-based memory extraction when OpenAI API key is missing or for backup
    const contentLower = userMessage.toLowerCase() + ' ' + assistantMessage.toLowerCase();
    const extractedMemories = [];

    if (contentLower.includes('prefer') || contentLower.includes('like') || contentLower.includes('love')) {
      // Find what they like
      if (contentLower.includes('dark mode') || contentLower.includes('theme')) {
        extractedMemories.push('User has a strong preference for sleek dark mode layouts and neon highlights.');
      }
      if (contentLower.includes('react') || contentLower.includes('next.js') || contentLower.includes('typescript')) {
        extractedMemories.push('User likes developing with modern web tech like Next.js, React, and TypeScript.');
      }
    }

    if (contentLower.includes('learn') || contentLower.includes('study') || contentLower.includes('master')) {
      extractedMemories.push(`User is currently focused on learning: ${userMessage.replace(/i want to learn|learn|i need to learn/i, '').trim().slice(0, 100)}`);
    }

    if (contentLower.includes('goal') || contentLower.includes('achieve') || contentLower.includes('target')) {
      extractedMemories.push(`User defined a personal objective relating to: ${userMessage.slice(0, 100)}`);
    }

    // Insert any extracted memories
    for (const content of extractedMemories) {
      // Check if memory already exists to prevent duplication
      const existing = await prisma.memory.findFirst({
        where: { userId, content },
      });

      if (!existing) {
        await prisma.memory.create({
          data: {
            userId,
            content,
            category: 'PERSONAL',
            sentiment: 'NEUTRAL',
          },
        });
        
        // Log Agent Activity
        await prisma.agentActivity.create({
          data: {
            userId,
            agentType: 'LEARNING',
            activityType: 'MEMORY_EXTRACTION',
            status: 'SUCCESS',
            details: `Auto-extracted memory node: "${content}"`,
          },
        });
      }
    }
  } catch (error) {
    console.error('Memory extraction error:', error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, conversationId } = await request.json();
    if (!prompt) {
      return NextResponse.json({ message: 'Prompt is required' }, { status: 400 });
    }

    // 1. Get or Create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: prompt.slice(0, 40) + (prompt.length > 40 ? '...' : ''),
        },
      });
    }

    // 2. Save user message to database
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: prompt,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // 3. Retrieve conversation history for context
    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 12,
    });

    // 4. Generate Answer (streaming)
    const apiKey = process.env.OPENAI_API_KEY;
    const hasApiKey = apiKey && apiKey !== 'dummy-key-to-prevent-sdk-crash';

    let responseStream: ReadableStream;
    let fullReplyText = '';

    // Fetch Cognitive Profile context to personalize AI responses
    let profileContext = '';
    let dbProfileEntries: any[] = [];
    try {
      const dbProfile = await prisma.cognitiveProfile.findUnique({
        where: { userId: user.id },
        include: { entries: true },
      });
      if (dbProfile && dbProfile.entries.length > 0) {
        dbProfileEntries = dbProfile.entries;
        profileContext = "\n\nPERSONAL USER PROFILE CONTEXT (This is who the user is and what they focus on. Use this context to personalize your response and follow their preferences):\n" + 
          dbProfile.entries.map(e => {
            let val = e.value;
            try { val = JSON.parse(e.value); } catch(ex) {}
            return `[${e.layer}] ${e.key}: ${typeof val === 'object' ? JSON.stringify(val) : val} (confidence: ${e.confidenceScore})`;
          }).join('\n');
      }
    } catch (err) {
      console.warn('Failed to load profile context for system prompt:', err);
    }

    // Retrieve memories for debug logging
    let retrievedMemories: any[] = [];
    try {
      retrievedMemories = await prisma.memory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } catch (err) {
      console.warn('Failed to load memories for debugging:', err);
    }

    // Retrieve active goals for personalized mock responses
    let retrievedGoals: any[] = [];
    try {
      retrievedGoals = await prisma.goal.findMany({
        where: { userId: user.id },
        include: { milestones: true },
      });
    } catch (err) {
      console.warn('Failed to load goals for personalized mock response:', err);
    }

    // Fetch Mentor context (Long-term coaching triggers)
    let mentorContext = '';
    try {
      mentorContext = await getMentorContext(user.id);
    } catch (err) {
      console.warn('Failed to load mentor context:', err);
    }

    // Fetch Executive context (Proactive warnings & briefings)
    let executiveContext = '';
    try {
      executiveContext = await getProactivePromptContext(user.id);
    } catch (err) {
      console.warn('Failed to load executive context:', err);
    }

    // Format OpenAI payload message history
    const messagesFormatted = history.map((msg) => ({
      role: msg.role.toLowerCase() === 'assistant' ? 'assistant' as const : 'user' as const,
      content: msg.content,
    }));

    const sysMessage = {
      role: 'system' as const,
      content: `You are the Jarvis Personal Operating System, acting as a lifelong learning coach, career advisor, memory indexer, and productivity assistant. You write structured, helpful, futuristic replies. Keep tone premium and supportive.${profileContext}${mentorContext}${executiveContext}`,
    };

    const llmPayload = {
      model: 'gpt-4o-mini',
      messages: [sysMessage, ...messagesFormatted],
      stream: true as const,
    };

    // PIPELINE DEBUG LOGGING: STAGES 1 TO 6
    console.log('=========================================');
    console.log('[AI RESPONSE PIPELINE AUDIT LOG]');
    console.log('=========================================');
    console.log(`1. STAGE: FRONTEND SUBMISSION & REQUEST PAYLOAD\n- INPUT: Request POST /api/chat\n- PROCESSING: Parsing request parameters\n- OUTPUT: prompt = "${prompt}", conversationId = "${conversationId || 'new conversation'}"`);
    console.log(`\n2. STAGE: CONVERSATION LOADING\n- INPUT: conversationId = "${conversationId || 'new conversation'}"\n- PROCESSING: Retrieving / Creating conversation row\n- OUTPUT: conversationId = "${conversation.id}", title = "${conversation.title}"`);
    console.log(`\n3. STAGE: MESSAGE HISTORY CONSTRUCTION\n- INPUT: conversationId = "${conversation.id}"\n- PROCESSING: Retrieving previous messages (limit: 12)\n- OUTPUT: Loaded ${history.length} messages in context`);
    console.log(`\n4. STAGE: COGNITIVE PROFILE & MEMORIES RETRIEVAL\n- INPUT: userId = "${user.id}"\n- PROCESSING: Fetching Memory and CognitiveProfileEntry records\n- RETRIEVED MEMORIES:\n${JSON.stringify(retrievedMemories.map(m => `[${m.category}] ${m.content}`), null, 2)}\n- RETRIEVED PROFILE DATA:\n${JSON.stringify(dbProfileEntries.map(e => `[${e.layer}] ${e.key} = ${e.value}`), null, 2)}`);
    console.log(`\n5. STAGE: SYSTEM PROMPT GENERATION\n- INPUT: Standard OS personality template + profileContext\n- PROCESSING: Constructing system instruction role\n- OUTPUT:\n"""\n${sysMessage.content}\n"""`);
    console.log(`\n6. STAGE: LLM PAYLOAD PREPARATION\n- INPUT: Compiled message history array + system instructions\n- PROCESSING: Formulating OpenAI SDK payload\n- OUTPUT: Final LLM Payload:\n${JSON.stringify(llmPayload, null, 2)}`);

    let toolsExecuted = false;
    let toolNamesUsed: string[] = [];
    let executions: any[] = [];

    if (hasApiKey) {
      if (prompt.startsWith('/confirm ')) {
        try {
          const parts = prompt.trim().split(/\s+/);
          const toolName = parts[1];
          const rawArgs = prompt.substring(prompt.indexOf(parts[2]));
          const args = JSON.parse(rawArgs);
          args.confirmed = true;

          const fakeToolCall = {
            id: 'confirm_' + Date.now(),
            type: 'function' as const,
            function: {
              name: toolName,
              arguments: JSON.stringify(args),
            },
          };

          const { result } = await executeToolCall(fakeToolCall, user.id);

          toolsExecuted = true;
          toolNamesUsed = [toolName];
          executions = [{
            toolName,
            args,
            result,
          }];

          const toolCallMessage = {
            role: 'assistant' as const,
            tool_calls: [fakeToolCall],
          };
          const toolResponseMessage = {
            role: 'tool' as const,
            tool_call_id: fakeToolCall.id,
            content: JSON.stringify(result),
          };

          const messagesWithToolResults = [
            sysMessage,
            ...messagesFormatted.slice(0, -1),
            { role: 'user' as const, content: `I confirm execution of ${toolName}.` },
            toolCallMessage,
            toolResponseMessage,
          ];

          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messagesWithToolResults,
            stream: true,
          });

          const encoder = new TextEncoder();
          responseStream = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of response) {
                  const text = chunk.choices[0]?.delta?.content || '';
                  if (text) {
                    fullReplyText += text;
                    controller.enqueue(encoder.encode(text));
                  }
                }

                // Append card tags at the end of the stream
                let cardTags = '';
                for (const exec of executions) {
                  if (exec.result.confirmationRequired) {
                    cardTags += `\n\n[ConfirmationCard: ${exec.toolName} ${JSON.stringify(exec.args)} ${JSON.stringify({ title: exec.result.title, message: exec.result.message })}]`;
                  } else {
                    cardTags += `\n\n[ToolCard: ${exec.toolName} ${JSON.stringify(exec.result)}]`;
                    if (exec.result.gamification) {
                      cardTags += `\n\n[GamificationCard: ${JSON.stringify(exec.result.gamification)}]`;
                    }
                  }
                }

                if (cardTags) {
                  fullReplyText += cardTags;
                  controller.enqueue(encoder.encode(cardTags));
                }

                console.log(`\n7. STAGE: RESPONSE GENERATION (hasApiKey: true, confirmed: true)\n- RAW LLM RESPONSE: "${fullReplyText}"`);

                const savedMsg = await prisma.message.create({
                  data: {
                    conversationId: conversation.id,
                    role: 'ASSISTANT',
                    content: fullReplyText,
                  },
                });

                await triggerMemoryExtraction(user.id, prompt, fullReplyText);
                await analyzeAndSyncProfile(user.id, prompt, fullReplyText, conversation.id);
                await syncDialogMentorship(user.id, prompt, fullReplyText);

                controller.close();
              } catch (err) {
                controller.error(err);
              }
            },
          });
        } catch (err) {
          console.error('/confirm endpoint bypass failed:', err);
          return NextResponse.json({ message: 'Confirmation execution failed' }, { status: 400 });
        }
      } else {
        // Standard loop
        const {
          messages: messagesWithToolResults,
          toolsExecuted: loopToolsExecuted,
          toolsUsed,
          executions: loopExecutions,
        } = await runToolLoop(
          [sysMessage, ...messagesFormatted],
          user.id,
          openai
        );

        toolsExecuted = loopToolsExecuted;
        toolNamesUsed = toolsUsed;
        executions = loopExecutions;

        const encoder = new TextEncoder();

        if (toolsExecuted) {
          // Pass 2: Streaming narration
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: messagesWithToolResults,
            stream: true,
          });

          responseStream = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of response) {
                  const text = chunk.choices[0]?.delta?.content || '';
                  if (text) {
                    fullReplyText += text;
                    controller.enqueue(encoder.encode(text));
                  }
                }

                // Append card tags at the end of the stream
                let cardTags = '';
                for (const exec of executions) {
                  if (exec.result.confirmationRequired) {
                    cardTags += `\n\n[ConfirmationCard: ${exec.toolName} ${JSON.stringify(exec.args)} ${JSON.stringify({ title: exec.result.title, message: exec.result.message })}]`;
                  } else {
                    cardTags += `\n\n[ToolCard: ${exec.toolName} ${JSON.stringify(exec.result)}]`;
                    if (exec.result.gamification) {
                      cardTags += `\n\n[GamificationCard: ${JSON.stringify(exec.result.gamification)}]`;
                    }
                  }
                }

                if (cardTags) {
                  fullReplyText += cardTags;
                  controller.enqueue(encoder.encode(cardTags));
                }

                console.log(`\n7. STAGE: RESPONSE GENERATION (hasApiKey: true, toolsExecuted: true)\n- RAW LLM RESPONSE: "${fullReplyText}"`);

                const savedMsg = await prisma.message.create({
                  data: {
                    conversationId: conversation.id,
                    role: 'ASSISTANT',
                    content: fullReplyText,
                  },
                });

                await triggerMemoryExtraction(user.id, prompt, fullReplyText);
                await analyzeAndSyncProfile(user.id, prompt, fullReplyText, conversation.id);
                await syncDialogMentorship(user.id, prompt, fullReplyText);

                controller.close();
              } catch (err) {
                controller.error(err);
              }
            },
          });
        } else {
          // No tools executed: stream the content we already retrieved in Pass-1
          const lastMsg = messagesWithToolResults[messagesWithToolResults.length - 1];
          const contentToStream = (lastMsg && typeof lastMsg.content === 'string') ? lastMsg.content : '';

          responseStream = new ReadableStream({
            async start(controller) {
              try {
                const words = contentToStream.split(' ');
                for (const word of words) {
                  fullReplyText += word + ' ';
                  controller.enqueue(encoder.encode(word + ' '));
                  await new Promise((resolve) => setTimeout(resolve, 30));
                }

                console.log(`\n7. STAGE: RESPONSE GENERATION (hasApiKey: true, toolsExecuted: false)\n- RAW LLM RESPONSE: "${fullReplyText}"`);

                const savedMsg = await prisma.message.create({
                  data: {
                    conversationId: conversation.id,
                    role: 'ASSISTANT',
                    content: fullReplyText.trim(),
                  },
                });

                await triggerMemoryExtraction(user.id, prompt, fullReplyText.trim());
                await analyzeAndSyncProfile(user.id, prompt, fullReplyText.trim(), conversation.id);
                await syncDialogMentorship(user.id, prompt, fullReplyText.trim());

                controller.close();
              } catch (err) {
                controller.error(err);
              }
            },
          });
        }
      }
    } else {
      // Mock Interactive Response
      let mockReply = '';
      const promptLower = prompt.toLowerCase();

      if (promptLower.includes('canada')) {
        mockReply = `Canada is a North American country consisting of ten provinces and three territories. Extending from the Atlantic to the Pacific and northward into the Arctic Ocean, it covers 9.98 million square kilometers, making it the world's second-largest country by total area. Its capital is Ottawa, and major cities include Toronto, Montreal, and Vancouver. Canada is renowned for its high quality of life, beautiful wilderness, and diverse cultural landscape.`;
      } else if (promptLower.includes('next.js') || promptLower.includes('nextjs')) {
        mockReply = `Next.js is a production-ready React framework designed and maintained by Vercel. It enables features like Server-Side Rendering (SSR), Static Site Generation (SSG), Incremental Static Regeneration (ISR), file-system routing, and built-in optimizations for images and fonts. It provides a robust, optimized toolchain to compile, build, and deploy high-performance applications easily.`;
      } else if (promptLower.includes('goal') || promptLower.includes('milestone')) {
        const nameEntry = dbProfileEntries.find(e => e.key === 'name');
        const roleEntry = dbProfileEntries.find(e => e.key === 'current_role');
        const userName = nameEntry ? JSON.parse(nameEntry.value) : 'Jan';
        const userRole = roleEntry ? JSON.parse(roleEntry.value) : 'Full Stack Engineer';
        
        let goalsSummary = '';
        if (retrievedGoals.length > 0) {
          goalsSummary = retrievedGoals.map(g => {
            const progressVal = g.progress;
            const categoryVal = g.category;
            const titleVal = g.title;
            const milestonesList = g.milestones.map((m: any) => `\n    * ${m.title} [${m.status}]`).join('');
            return `- **${titleVal}** (${progressVal}% complete, Category: ${categoryVal})${milestonesList}`;
          }).join('\n');
        } else {
          goalsSummary = '- No active goals saved.';
        }
        
        mockReply = `As your Operating System, I've loaded the details for ${userName} (${userRole}). Here are your current active goals and milestones:\n\n${goalsSummary}\n\nI recommend completing the next upcoming milestones on schedule to maintain momentum. Let me know if you need to adjust any target timelines.`;
      } else if (promptLower.includes('learn') || promptLower.includes('skill') || promptLower.includes('roadmap')) {
        mockReply = `According to your Learning Hub, you are working on "AI Engineering and Vector Math". You've spent 45 minutes studying vector embeddings. I recommend scheduling a 30-minute block tonight to review HNSW vs Flat indexing.`;
      } else if (promptLower.includes('memory') || promptLower.includes('remember')) {
        mockReply = `I've synched your Memory Node. I currently have index markers tracking your preferences for dark mode layouts, Next.js engineering, and career acceleration. Is there anything specific you'd like me to log today?`;
      } else {
        mockReply = `Hello Jan, I am your personal OS. I have loaded your conversation history, active goals, and learning plans. How shall we accelerate your progress today? You can ask me about active goals, learning roadmaps, projects, or knowledge documents.`;
      }

      fullReplyText = mockReply;
      responseStream = createMockStream(mockReply);

      // Async save mock response to database
      setTimeout(async () => {
        try {
          console.log(`\n7. STAGE: RESPONSE GENERATION (hasApiKey: false)\n- RAW LLM RESPONSE: "${fullReplyText}"`);

          const savedMsg = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: 'ASSISTANT',
              content: fullReplyText,
            },
          });
          console.log(`\n8. STAGE: DATABASE PERSISTENCE\n- INPUT: Saved assistant reply to Message ID ${savedMsg.id}\n- OUTPUT: Persisted successfully`);

          await triggerMemoryExtraction(user.id, prompt, fullReplyText);
          await analyzeAndSyncProfile(user.id, prompt, fullReplyText, conversation.id);
          await syncDialogMentorship(user.id, prompt, fullReplyText);

          console.log(`\n9. STAGE: UI RENDERED RESPONSE\n- OUTPUT: Mock stream closed. Response rendered on UI.`);
          console.log('=========================================');
        } catch (err) {
          console.error('Failed to save mock reply:', err);
        }
      }, 50);
    }

    // Return Stream and expose Conversation ID in header
    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Conversation-Id': conversation.id,
        'X-Tool-Executed': toolsExecuted ? 'true' : 'false',
      },
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Return user conversations sidebar list
    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(conversations);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
