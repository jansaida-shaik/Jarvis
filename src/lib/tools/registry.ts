import type { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * TOOL REGISTRY
 * All 19 OpenAI function calling schemas for Jarvis, organized by modular dot-namespaces.
 * These are the exact definitions sent in the `tools` parameter of the chat completions API.
 */
export const TOOL_DEFINITIONS: ChatCompletionTool[] = [
  // ─────────────────────────────────────────────────
  // GOALS (goal.*)
  // ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'goal.create',
      description:
        'Create a new personal goal for the user. Also auto-generates 3 starting milestones and a learning plan when appropriate. Use when the user says things like "create a goal", "I want to achieve", "set a target", "help me work toward".',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The goal title. Be specific and action-oriented, e.g. "Become an AI Engineer" not just "AI".',
          },
          category: {
            type: 'string',
            enum: ['CAREER', 'HEALTH', 'CODING', 'FINANCE', 'LEARNING', 'PERSONAL'],
            description: 'Category that best describes this goal.',
          },
          description: {
            type: 'string',
            description: 'Optional longer description of what the goal entails.',
          },
          targetDate: {
            type: 'string',
            description: 'Optional ISO 8601 date string for when the user wants to achieve this goal, e.g. "2026-12-31".',
          },
        },
        required: ['title', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'goal.update',
      description:
        'Update an existing goal\'s title, description, status, or progress. Use when the user wants to rename, pause, complete, or adjust progress on a goal. Requires the goalId which you can find by listing or referencing previous context.',
      parameters: {
        type: 'object',
        properties: {
          goalId: {
            type: 'string',
            description: 'The ID of the goal to update.',
          },
          title: {
            type: 'string',
            description: 'New title for the goal.',
          },
          description: {
            type: 'string',
            description: 'New description for the goal.',
          },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'COMPLETED', 'ON_HOLD'],
            description: 'New status for the goal.',
          },
          progress: {
            type: 'number',
            description: 'Progress percentage from 0 to 100.',
            minimum: 0,
            maximum: 100,
          },
        },
        required: ['goalId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'goal.delete',
      description:
        'Permanently delete a goal and all its milestones. This is a destructive action and requires confirmation. Set confirmed=true only if the user has explicitly confirmed the action.',
      parameters: {
        type: 'object',
        properties: {
          goalId: {
            type: 'string',
            description: 'The ID of the goal to delete.',
          },
          confirmed: {
            type: 'boolean',
            description: 'Set to true only if the user has explicitly confirmed this deletion. Default is false.',
          },
        },
        required: ['goalId'],
      },
    },
  },

  // ─────────────────────────────────────────────────
  // MILESTONES (milestone.*)
  // ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'milestone.create',
      description:
        'Add a new milestone checkpoint to an existing goal. Use when the user says "add a step", "add a milestone", or "break down" a goal into steps.',
      parameters: {
        type: 'object',
        properties: {
          goalId: {
            type: 'string',
            description: 'The ID of the parent goal.',
          },
          title: {
            type: 'string',
            description: 'Short action-oriented milestone title, e.g. "Complete neural networks course".',
          },
          description: {
            type: 'string',
            description: 'Optional description of what this milestone involves.',
          },
          dueDate: {
            type: 'string',
            description: 'Optional ISO 8601 date for when this milestone should be completed.',
          },
        },
        required: ['goalId', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'milestone.complete',
      description:
        'Mark a milestone as completed. Also automatically recalculates the parent goal\'s progress percentage. Use when the user says they finished or completed a specific milestone.',
      parameters: {
        type: 'object',
        properties: {
          milestoneId: {
            type: 'string',
            description: 'The ID of the milestone to mark as completed.',
          },
        },
        required: ['milestoneId'],
      },
    },
  },

  // ─────────────────────────────────────────────────
  // TASKS (task.*)
  // ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'task.create',
      description:
        'Create a new task in the Kanban board. Use when the user wants to add a to-do item, task, or action item. Tasks can optionally be linked to a project.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The task title — what needs to be done.',
          },
          description: {
            type: 'string',
            description: 'Optional additional detail about the task.',
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID to associate this task with.',
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            description: 'Priority level. Default to MEDIUM if not specified.',
          },
          dueDate: {
            type: 'string',
            description: 'Optional ISO 8601 due date for the task.',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task.update',
      description:
        'Update a task\'s status or priority. Use to move tasks between columns (TODO, IN_PROGRESS, COMPLETED) or change urgency.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The ID of the task to update.',
          },
          status: {
            type: 'string',
            enum: ['TODO', 'IN_PROGRESS', 'COMPLETED'],
            description: 'New status for the task.',
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
            description: 'New priority level.',
          },
        },
        required: ['taskId', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task.complete',
      description:
        'Mark a specific task as COMPLETED and log the completion. This requires confirmation. Set confirmed=true only if the user has explicitly confirmed the action.',
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'The ID of the task to mark as completed.',
          },
          confirmed: {
            type: 'boolean',
            description: 'Set to true only if the user has explicitly confirmed this completion. Default is false.',
          },
        },
        required: ['taskId'],
      },
    },
  },

  // ─────────────────────────────────────────────────
  // PROJECTS & NOTES (project.*)
  // ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'project.create',
      description:
        'Create a new project workspace. Use when the user wants to start a new project, initiative, or work area.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The project name.',
          },
          description: {
            type: 'string',
            description: 'Optional description of the project\'s purpose and scope.',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project.delete',
      description:
        'Permanently delete an existing project workspace. This is a destructive action and requires confirmation. Set confirmed=true only if the user has explicitly confirmed the action.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The ID of the project to delete.',
          },
          confirmed: {
            type: 'boolean',
            description: 'Set to true only if the user has explicitly confirmed this deletion. Default is false.',
          },
        },
        required: ['projectId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project.create_note',
      description:
        'Save a note, summary, or piece of content. Use when the user wants to capture information, take notes, or document something.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Note title.',
          },
          content: {
            type: 'string',
            description: 'The full content of the note.',
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID to associate this note with.',
          },
        },
        required: ['title', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'project.delete_note',
      description:
        'Permanently delete a note. This is a destructive action and requires confirmation. Set confirmed=true only if the user has explicitly confirmed the action.',
      parameters: {
        type: 'object',
        properties: {
          noteId: {
            type: 'string',
            description: 'The ID of the note to delete.',
          },
          confirmed: {
            type: 'boolean',
            description: 'Set to true only if the user has explicitly confirmed this deletion. Default is false.',
          },
        },
        required: ['noteId'],
      },
    },
  },

  // ─────────────────────────────────────────────────
  // MEMORY (memory.*)
  // ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'memory.save',
      description:
        'Permanently save a fact, preference, or important piece of information to the user\'s memory graph. Use when the user says "remember that", "save this", "note that I prefer", or shares something important about themselves.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The memory content to store. Write it as a clear, self-contained sentence.',
          },
          category: {
            type: 'string',
            enum: ['LEARNING', 'CAREER', 'PERSONAL', 'PROJECT', 'GENERAL'],
            description: 'Category that best describes this memory.',
          },
          sentiment: {
            type: 'string',
            enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
            description: 'Emotional tone of this memory. Default to NEUTRAL.',
          },
        },
        required: ['content', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory.search',
      description:
        'Search the user\'s memory graph for relevant past information. Use when the user asks "do you remember", "what do I know about", or you need to recall context about the user\'s past.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant memories.',
          },
          category: {
            type: 'string',
            enum: ['LEARNING', 'CAREER', 'PERSONAL', 'PROJECT', 'GENERAL'],
            description: 'Optional category filter to narrow the search.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'memory.delete',
      description:
        'Permanently delete a specific memory node from the user\'s memory graph. This is a destructive action and requires confirmation. Set confirmed=true only if the user has explicitly confirmed the action.',
      parameters: {
        type: 'object',
        properties: {
          memoryId: {
            type: 'string',
            description: 'The ID of the memory to delete.',
          },
          confirmed: {
            type: 'boolean',
            description: 'Set to true only if the user has explicitly confirmed this deletion. Default is false.',
          },
        },
        required: ['memoryId'],
      },
    },
  },

  // ─────────────────────────────────────────────────
  // KNOWLEDGE BASE (knowledge.*)
  // ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'knowledge.search',
      description:
        'Search the user\'s personal knowledge base (uploaded documents) for relevant information. Use when the user asks about something they may have documented, or when referencing study materials, notes, or resources they\'ve stored.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to find relevant documents.',
          },
        },
        required: ['query'],
      },
    },
  },

  // ─────────────────────────────────────────────────
  // LEARNING (learning.*)
  // ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'learning.create_plan',
      description:
        'Create a structured learning roadmap. Use when the user wants to build a study plan, learning curriculum, or skill development roadmap for a topic.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Learning plan title, e.g. "AI Engineer Roadmap" or "React Mastery Plan".',
          },
          description: {
            type: 'string',
            description: 'What this learning plan covers and aims to achieve.',
          },
          recommendations: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of recommended resources, courses, or milestones for this plan.',
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'learning.log_session',
      description:
        'Log a completed study or learning session. Use when the user says they studied, practiced, read, or completed a learning session.',
      parameters: {
        type: 'object',
        properties: {
          durationMinutes: {
            type: 'number',
            description: 'How long the session lasted in minutes.',
            minimum: 1,
          },
          notes: {
            type: 'string',
            description: 'Optional notes about what was covered in this session.',
          },
          skillId: {
            type: 'string',
            description: 'Optional skill ID this session was focused on.',
          },
          planId: {
            type: 'string',
            description: 'Optional learning plan ID this session is part of.',
          },
        },
        required: ['durationMinutes'],
      },
    },
  },

  // ─────────────────────────────────────────────────
  // EXECUTIVE INTELLIGENCE (executive.*)
  // ─────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'executive.generate_weekly_briefing',
      description:
        'Run the Executive Intelligence engine to scan all goals, projects, and learning data, then generate a fresh briefing with risks, opportunities, and strategic recommendations. Use when the user asks for a weekly review, status report, or executive briefing.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

/**
 * Names of all registered tools for quick lookup.
 */
export const TOOL_NAMES = new Set(
  TOOL_DEFINITIONS.map((t) => {
    if (t.type === 'function') {
      return t.function.name;
    }
    return '';
  }).filter(Boolean)
);
