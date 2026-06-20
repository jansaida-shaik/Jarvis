import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import OpenAI from 'openai';
import { analyzeAndSyncProfile } from '@/lib/profile-analyzer';
import { getMentorContext, syncDialogMentorship } from '@/lib/mentor-engine';
import { getProactivePromptContext } from '@/lib/executive-engine';
import { runToolLoop, executeToolCall } from '@/lib/tools/executor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-to-prevent-sdk-crash',
});

function createMockStream(text: string) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const chunks = text.split(' ');
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk + ' '));
        await new Promise((resolve) => setTimeout(resolve, 50)); // Fast streaming for natural speaking
      }
      controller.close();
    },
  });
}

// Memory extraction logic
async function triggerMemoryExtraction(userId: string, userMessage: string, assistantMessage: string) {
  try {
    const contentLower = userMessage.toLowerCase() + ' ' + assistantMessage.toLowerCase();
    const extractedMemories = [];

    if (contentLower.includes('prefer') || contentLower.includes('like') || contentLower.includes('love')) {
      if (contentLower.includes('dark mode') || contentLower.includes('theme')) {
        extractedMemories.push('User prefers dark mode layouts and custom highlights.');
      }
      if (contentLower.includes('next.js') || contentLower.includes('typescript') || contentLower.includes('react')) {
        extractedMemories.push('User works extensively with Next.js, React, and TypeScript.');
      }
    }

    for (const content of extractedMemories) {
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

    const { prompt, conversationId, mode = 'general' } = await request.json();
    if (!prompt) {
      return NextResponse.json({ message: 'Prompt is required' }, { status: 400 });
    }

    // 1. Get or Create voice conversation
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
          title: `Voice Session: ${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}`,
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

    // 3. Retrieve context data (Profile, Memories, Goals)
    let profileContext = '';
    let dbProfileEntries: any[] = [];
    try {
      const dbProfile = await prisma.cognitiveProfile.findUnique({
        where: { userId: user.id },
        include: { entries: true },
      });
      if (dbProfile && dbProfile.entries.length > 0) {
        dbProfileEntries = dbProfile.entries;
        profileContext = "\n\nCognitive Profile details:\n" + 
          dbProfile.entries.map(e => `[${e.layer}] ${e.key}: ${e.value}`).join('\n');
      }
    } catch (err) {
      console.warn('Failed to load profile context:', err);
    }

    let memoryContext = '';
    try {
      const dbMemories = await prisma.memory.findMany({
        where: { userId: user.id },
        take: 5,
      });
      if (dbMemories.length > 0) {
        memoryContext = "\n\nUser Memories:\n" + dbMemories.map(m => `- ${m.content}`).join('\n');
      }
    } catch (err) {
      console.warn('Failed to load memories:', err);
    }

    let goalsContext = '';
    let retrievedGoals: any[] = [];
    try {
      retrievedGoals = await prisma.goal.findMany({
        where: { userId: user.id },
        include: { milestones: true },
      });
      if (retrievedGoals.length > 0) {
        goalsContext = "\n\nActive Goals:\n" + retrievedGoals.map(g => 
          `- ${g.title} (${g.progress}% progress). Milestones: ${g.milestones.map((m: any) => m.title).join(', ')}`
        ).join('\n');
      }
    } catch (err) {
      console.warn('Failed to load goals:', err);
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

    // 4. Formulate System Prompt based on Mode
    let modeInstruction = '';
    if (mode === 'learning') {
      modeInstruction = 'You are in LEARNING MODE. Explain concepts simply using analogies. Ask short questions to check their understanding, and adapt explanations based on their answers.';
    } else if (mode === 'career') {
      modeInstruction = 'You are in CAREER MODE. Reference their target roles, skills, and goals to advise on what they should learn next and challenge their career choices dynamically.';
    } else if (mode === 'decision') {
      modeInstruction = 'You are in DECISION MODE. Analyze trade-offs of their choices, challenge weak reasoning, expose assumptions, and guide them to a clear direction.';
    } else {
      modeInstruction = 'You are in GENERAL VOICE MODE. Act as a highly intelligent mentor and companion.';
    }

    const systemPrompt = `You are Jarvis, a highly intelligent voice-first AI companion, acting as a personal mentor, teacher, advisor, coach, and assistant.
${modeInstruction}
${profileContext}
${memoryContext}
${goalsContext}
${mentorContext}
${executiveContext}

CRITICAL VOICE FORMATTING:
1. Speak naturally and avoid robotic or repetitive language.
2. Keep responses brief and concise (under 3-4 sentences where possible) so they are easy to listen to.
3. NEVER use markdown tags, bullet points, headers, or bold text (e.g. do not use ** or # or - in text) as this text will be read aloud. Write in continuous, natural sentences.
4. If the user doesn't understand, use simpler examples and check understanding again.
5. Challenge weak reasoning or assumptions directly but supportively.
6. TOOL NARRATION RULE: After executing tools, summarize what you did in 1-2 natural sentences, avoiding bullet points or markdown. Speak as if you just completed the action. Example: "Done — I've created your AI Engineer goal and mapped out three milestones to get you started."`;

    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 8, // Keep context compact for low latency voice response
    });

    const messagesFormatted = history.map((msg) => ({
      role: msg.role.toLowerCase() === 'assistant' ? 'assistant' as const : 'user' as const,
      content: msg.content,
    }));

    const hasApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy-key-to-prevent-sdk-crash';

    let responseStream: ReadableStream;
    let fullReplyText = '';
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
            { role: 'system' as const, content: systemPrompt },
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

                // Save reply to database on completion
                await prisma.message.create({
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
          console.error('/confirm endpoint bypass failed in voice:', err);
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
          [{ role: 'system', content: systemPrompt }, ...messagesFormatted],
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

                // Save reply to database on completion
                await prisma.message.create({
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
                  await new Promise((resolve) => setTimeout(resolve, 20));
                }
                // Save reply to database on completion
                await prisma.message.create({
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
      // Mock Fallback responses for voice-specific modes
      let mockReply = '';
      const promptLower = prompt.toLowerCase();

      if (mode === 'learning') {
        if (promptLower.includes('sql') || promptLower.includes('join')) {
          if (promptLower.includes('left')) {
            mockReply = "A left join is like taking your list of close friends and matching them with who brought food. Even if a friend didn't bring any food, they still stay on your list, but their food item is just blank. Does that make sense, or would you like another example?";
          } else {
            mockReply = "SQL joins allow you to combine records from multiple tables. Think of it like matching student names with their classroom numbers using a shared student ID. Do you want to learn about left joins, right joins, or inner joins first?";
          }
        } else {
          mockReply = "That is an interesting topic. To explain it simply, think of it like learning to drive: you first need to understand the pedals before you master steering. How would you explain what you understand about this so far?";
        }
      } else if (mode === 'career') {
        const targetRolesEntry = dbProfileEntries.find(e => e.key === 'target_roles');
        const roles = targetRolesEntry ? JSON.parse(targetRolesEntry.value) : ['Software Architect'];
        mockReply = `Based on your target career path to become a ${roles[0] || 'Software Architect'}, I recommend focusing on Vector Databases and Advanced Neural Architectures next. You have completed next.js and typescript basics, but mastering system layout scaling is critical. What are your thoughts on that direction?`;
      } else if (mode === 'decision') {
        if (promptLower.includes('zoho') || promptLower.includes('crm') || promptLower.includes('badminton') || promptLower.includes('platform')) {
          mockReply = "Focusing on multiple platforms at once splits your energy. Your badminton platform is a personal passion project, while Zoho CRM and AI integrations have direct market scalability. If you could only work on one for the next ninety days, which one would feel most regretful to drop? Let's analyze that.";
        } else {
          mockReply = "Decisions require comparing your direct impact against cognitive overhead. If we look at your current goals, what is the single biggest blocker stopping you from picking a path right now? Let's challenge that assumption.";
        }
      } else {
        if (promptLower.includes('canada')) {
          mockReply = "Canada is a North American country consisting of ten provinces and three territories. Extending from the Atlantic to the Pacific, it covers nearly ten million square kilometers. Capital is Ottawa, and its major hubs are Toronto, Montreal, and Vancouver. It is known for its natural landscapes and high quality of life.";
        } else if (promptLower.includes('next.js') || promptLower.includes('nextjs')) {
          mockReply = "Next.js is a production-ready React framework designed by Vercel. It supports features like server-side rendering, static site generation, and file-system routing. It is optimized to compile and scale modern web applications easily.";
        } else {
          mockReply = "Hello, I am Jarvis. I have loaded your goals and learning profile. How can I mentor you on your career, projects, or learning roadmap today?";
        }
      }

      fullReplyText = mockReply;
      responseStream = createMockStream(mockReply);

      setTimeout(async () => {
        try {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              role: 'ASSISTANT',
              content: fullReplyText,
            },
          });
          await triggerMemoryExtraction(user.id, prompt, fullReplyText);
          await analyzeAndSyncProfile(user.id, prompt, fullReplyText, conversation.id);
          await syncDialogMentorship(user.id, prompt, fullReplyText);
        } catch (err) {
          console.error('Failed to save mock reply:', err);
        }
      }, 50);
    }

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Conversation-Id': conversation.id,
        'X-Tool-Executed': toolsExecuted ? 'true' : 'false',
      },
    });

  } catch (error: any) {
    console.error('Voice Chat error:', error);
    return NextResponse.json({ message: error.message || 'Internal error' }, { status: 500 });
  }
}
