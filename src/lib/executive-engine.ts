import { prisma } from './db';

export interface ScanResults {
  insightsCreated: number;
  dailyBriefId?: string;
  weeklyBriefId?: string;
  monthlyBriefId?: string;
}

/**
 * Core Executive Intelligence Engine Service
 */
export async function generateBriefingsAndInsights(userId: string): Promise<ScanResults> {
  const now = new Date();
  let insightsCreatedCount = 0;

  try {
    // ----------------------------------------------------
    // 1. RUN DETECTIONS & CREATE INDIVIDUAL INSIGHTS
    // ----------------------------------------------------

    // A. GOAL DRIFT DETECTION
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const activeGoals = await prisma.goal.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { milestones: true }
    });

    for (const goal of activeGoals) {
      const isAbandoned = goal.updatedAt < fourteenDaysAgo;
      const isStalled = goal.updatedAt < sevenDaysAgo && goal.progress < 100;

      if (isAbandoned) {
        const title = `Abandoned Goal: "${goal.title}"`;
        const existing = await prisma.executiveInsight.findFirst({
          where: { userId, title, status: 'ACTIVE' }
        });

        if (!existing) {
          await prisma.executiveInsight.create({
            data: {
              userId,
              type: 'GOAL_DRIFT',
              title,
              insight: `Goal "${goal.title}" shows no progress or log updates for over 14 days. It is at risk of being completely abandoned.`,
              confidence: 0.90,
              evidenceJson: JSON.stringify([
                `Goal progress: ${goal.progress}%`,
                `Last updated: ${goal.updatedAt.toLocaleDateString()}`,
                `Days inactive: ${Math.round((now.getTime() - goal.updatedAt.getTime()) / (1000 * 60 * 60 * 24))}`
              ]),
              recommendation: `Schedule a 15-minute review session to re-evaluate this goal. If it is still a priority, break down its next steps into daily tasks. Otherwise, mark it ON_HOLD.`,
              status: 'ACTIVE',
              followUpStatus: 'PENDING'
            }
          });
          insightsCreatedCount++;
        }
      } else if (isStalled) {
        const title = `Stalled Goal: "${goal.title}"`;
        const existing = await prisma.executiveInsight.findFirst({
          where: { userId, title, status: 'ACTIVE' }
        });

        if (!existing) {
          await prisma.executiveInsight.create({
            data: {
              userId,
              type: 'GOAL_DRIFT',
              title,
              insight: `Goal "${goal.title}" (progress: ${goal.progress}%) has not advanced in over a week. Daily activity has stagnated.`,
              confidence: 0.75,
              evidenceJson: JSON.stringify([
                `Current progress: ${goal.progress}%`,
                `Inactive duration: ${Math.round((now.getTime() - goal.updatedAt.getTime()) / (1000 * 60 * 60 * 24))} days`
              ]),
              recommendation: `Look at the next milestone for this goal. Complete the smallest action item today to restore momentum.`,
              status: 'ACTIVE',
              followUpStatus: 'PENDING'
            }
          });
          insightsCreatedCount++;
        }
      }
    }

    // B. LEARNING GAP DETECTION
    // Target roles comparison
    const cognitiveProfile = await prisma.cognitiveProfile.findUnique({
      where: { userId },
      include: { entries: true }
    });

    if (cognitiveProfile) {
      const targetRolesEntry = cognitiveProfile.entries.find(e => e.key === 'target_roles');
      const targetRoles: string[] = targetRolesEntry ? JSON.parse(targetRolesEntry.value) : [];

      if (targetRoles.includes('Software Architect') || targetRoles.includes('Principal AI Engineer')) {
        const skills = await prisma.skill.findMany({ where: { userId } });
        const skillNames = skills.map(s => s.name.toLowerCase());

        const requiredArchitectSkills = ['system design', 'neural networks', 'vector embeddings'];
        const missingSkills = requiredArchitectSkills.filter(req => !skillNames.some(sName => sName.includes(req) || req.includes(sName)));

        for (const missingSkill of missingSkills) {
          const title = `Prerequisite Gap: "${missingSkill}"`;
          const existing = await prisma.executiveInsight.findFirst({
            where: { userId, title, status: 'ACTIVE' }
          });

          if (!existing) {
            await prisma.executiveInsight.create({
              data: {
                userId,
                type: 'LEARNING_GAP',
                title,
                insight: `To successfully grow into a ${targetRoles[0] || 'Software Architect'}, you possess a critical missing skill gap in "${missingSkill}".`,
                confidence: 0.85,
                evidenceJson: JSON.stringify([
                  `Target role matches: ${targetRoles.join(', ')}`,
                  `Skill catalog search: "${missingSkill}" not found`
                ]),
                recommendation: `Add "${missingSkill}" to your skill inventory and set up a dynamic learning roadmap targeting this topic today.`,
                status: 'ACTIVE',
                followUpStatus: 'PENDING'
              }
            });
            insightsCreatedCount++;
          }
        }
      }
    }

    // Weak concepts detection
    const progressRecords = await prisma.learningProgress.findMany({
      where: { profile: { userId } },
      include: { masteries: true }
    });

    for (const prog of progressRecords) {
      for (const mastery of prog.masteries) {
        if (mastery.status === 'REPEATEDLY_MISUNDERSTOOD' || mastery.misunderstandCount >= 2) {
          const title = `Weak Core Concept: "${mastery.concept}"`;
          const existing = await prisma.executiveInsight.findFirst({
            where: { userId, title, status: 'ACTIVE' }
          });

          if (!existing) {
            await prisma.executiveInsight.create({
              data: {
                userId,
                type: 'LEARNING_GAP',
                title,
                insight: `You have repeatedly experienced confusion (misunderstood ${mastery.misunderstandCount} times) regarding "${mastery.concept}" in topic "${prog.topic}".`,
                confidence: 0.95,
                evidenceJson: JSON.stringify([
                  `Concept: "${mastery.concept}"`,
                  `Topic: "${prog.topic}"`,
                  `Misunderstand count: ${mastery.misunderstandCount}`
                ]),
                recommendation: `Stop moving forward in "${prog.topic}" studies and review "${mastery.concept}" from first principles. Ask Jarvis to teach you using visual analogies.`,
                status: 'ACTIVE',
                followUpStatus: 'PENDING'
              }
            });
            insightsCreatedCount++;
          }
        }
      }

      // Forgotten Topics detection
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (prog.understandingScore >= 0.75 && prog.lastReviewedAt < thirtyDaysAgo) {
        const title = `Forgotten Study Area: "${prog.topic}"`;
        const existing = await prisma.executiveInsight.findFirst({
          where: { userId, title, status: 'ACTIVE' }
        });

        if (!existing) {
          await prisma.executiveInsight.create({
            data: {
              userId,
              type: 'LEARNING_GAP',
              title,
              insight: `Your knowledge of "${prog.topic}" has not been reviewed or reinforced in over 30 days. Retention levels are at risk of decaying.`,
              confidence: 0.70,
              evidenceJson: JSON.stringify([
                `Last review timestamp: ${prog.lastReviewedAt.toLocaleDateString()}`,
                `Previous understanding: ${(prog.understandingScore * 100).toFixed(0)}%`
              ]),
              recommendation: `Spend 10 minutes performing a rapid spacing recall test on "${prog.topic}" to maintain retention levels.`,
              status: 'ACTIVE',
              followUpStatus: 'PENDING'
            }
          });
          insightsCreatedCount++;
        }
      }
    }

    // C. PROJECT RISK DETECTION
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const activeProjects = await prisma.project.findMany({
      where: { userId, status: 'IN_PROGRESS' },
      include: { tasks: true }
    });

    for (const proj of activeProjects) {
      const isInactive = proj.updatedAt < tenDaysAgo;
      if (isInactive) {
        const title = `Inactive Project: "${proj.name}"`;
        const existing = await prisma.executiveInsight.findFirst({
          where: { userId, title, status: 'ACTIVE' }
        });

        if (!existing) {
          await prisma.executiveInsight.create({
            data: {
              userId,
              type: 'PROJECT_RISK',
              title,
              insight: `Project "${proj.name}" is marked IN_PROGRESS but shows no file index, task, or log changes in over 10 days.`,
              confidence: 0.85,
              evidenceJson: JSON.stringify([
                `Current status: ${proj.status}`,
                `Days inactive: ${Math.round((now.getTime() - proj.updatedAt.getTime()) / (1000 * 60 * 60 * 24))}`
              ]),
              recommendation: `Mark project ON_HOLD if scope priorities have shifted. If active, log next deliverables or add tasks.`,
              status: 'ACTIVE',
              followUpStatus: 'PENDING'
            }
          });
          insightsCreatedCount++;
        }
      }

      // Check tasks overdue or milestones due in next 3 days
      const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const pendingTasks = proj.tasks.filter(t => t.status !== 'COMPLETED');
      const overdueTasks = pendingTasks.filter(t => t.dueDate && t.dueDate < now);
      const urgentTasks = pendingTasks.filter(t => t.dueDate && t.dueDate < threeDaysAhead && t.dueDate >= now);

      if (overdueTasks.length > 0) {
        const title = `Overdue Deliverables: "${proj.name}"`;
        const existing = await prisma.executiveInsight.findFirst({
          where: { userId, title, status: 'ACTIVE' }
        });

        if (!existing) {
          await prisma.executiveInsight.create({
            data: {
              userId,
              type: 'PROJECT_RISK',
              title,
              insight: `Project "${proj.name}" has ${overdueTasks.length} task(s) past their scheduled delivery date. Timeline is slipping.`,
              confidence: 0.88,
              evidenceJson: JSON.stringify(overdueTasks.map(t => `Task: "${t.title}" was due ${t.dueDate?.toLocaleDateString()}`)),
              recommendation: `Reschedule the overdue deliverables or adjust timelines. Complete the most urgent task: "${overdueTasks[0].title}".`,
              status: 'ACTIVE',
              followUpStatus: 'PENDING'
            }
          });
          insightsCreatedCount++;
        }
      }
    }

    // D. DECISION PATTERN ANALYSIS
    const loggedDecisions = await prisma.decisionHistory.findMany({
      where: { userId, status: 'LOGGED' }
    });

    const fourteenDaysAgoDec = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    for (const dec of loggedDecisions) {
      if (dec.createdAt < fourteenDaysAgoDec) {
        const title = `Decision Deferral: "${dec.title}"`;
        const existing = await prisma.executiveInsight.findFirst({
          where: { userId, title, status: 'ACTIVE' }
        });

        if (!existing) {
          await prisma.executiveInsight.create({
            data: {
              userId,
              type: 'DECISION_PATTERN',
              title,
              insight: `You logged the decision tradeoffs for "${dec.title}" over 2 weeks ago, but have not moved to EXECUTION or marked it resolved.`,
              confidence: 0.78,
              evidenceJson: JSON.stringify([
                `Logged date: ${dec.createdAt.toLocaleDateString()}`,
                `Tradeoffs analyzed: Options include JSON string lists`
              ]),
              recommendation: `Make a definitive choice. Let's discuss what uncertainty is causing the block.`,
              status: 'ACTIVE',
              followUpStatus: 'PENDING'
            }
          });
          insightsCreatedCount++;
        }
      }
    }

    // E. OPPORTUNITY DETECTION
    const activeInsights = await prisma.executiveInsight.findMany({
      where: { userId, status: 'ACTIVE' }
    });

    // Detect high leverage opportunities
    const missingSkillAlerts = activeInsights.filter(ins => ins.type === 'LEARNING_GAP' && ins.title.includes('Prerequisite'));
    if (missingSkillAlerts.length > 0) {
      const title = `Opportunity: High-Leverage Skills Acceleration`;
      const existing = await prisma.executiveInsight.findFirst({
        where: { userId, title, status: 'ACTIVE' }
      });

      if (!existing) {
        const skillsString = missingSkillAlerts.map(a => a.title.replace('Prerequisite Gap: ', '')).join(', ');
        await prisma.executiveInsight.create({
          data: {
            userId,
            type: 'OPPORTUNITY',
            title,
            insight: `Acquiring ${skillsString} unlocks career eligibility targets. Focusing study blocks here yield 3x faster career transition.`,
            confidence: 0.82,
            evidenceJson: JSON.stringify(missingSkillAlerts.map(a => `Prerequisite: ${a.title}`)),
            recommendation: `Commit to a 10-day learning program targeting these specific skills. Ask Jarvis to build a curriculum.`,
            status: 'ACTIVE',
            followUpStatus: 'PENDING'
          }
        });
        insightsCreatedCount++;
      }
    }

    // ----------------------------------------------------
    // 2. COMPILE EXECUTIVE BRIEFINGS (DAILY, WEEKLY, MONTHLY)
    // ----------------------------------------------------
    
    // Fetch all current active insights to compile briefs
    const currentActiveInsights = await prisma.executiveInsight.findMany({
      where: { userId, status: 'ACTIVE' }
    });

    const activeDrifts = currentActiveInsights.filter(i => i.type === 'GOAL_DRIFT');
    const activeGaps = currentActiveInsights.filter(i => i.type === 'LEARNING_GAP');
    const activeRisks = currentActiveInsights.filter(i => i.type === 'PROJECT_RISK');
    const activePatterns = currentActiveInsights.filter(i => i.type === 'DECISION_PATTERN');
    const activeOpps = currentActiveInsights.filter(i => i.type === 'OPPORTUNITY');

    const totalRisksCount = activeDrifts.length + activeGaps.length + activeRisks.length + activePatterns.length;

    // A. Daily Briefing Narrative Builder
    let dailySummary = `### Executive Summary\n`;
    if (totalRisksCount === 0) {
      dailySummary += `All active parameters are running efficiently. No drift warnings or overdue timeline risks detected today. Maintain current workflow patterns.`;
    } else {
      dailySummary += `You have ${totalRisksCount} active risk warnings and ${activeOpps.length} leverage opportunities. Stated primary targets are showing signs of structural friction.`;
    }

    dailySummary += `\n\n### Critical Advisories\n`;
    if (activeDrifts.length > 0) {
      dailySummary += `* **Goal Progress Drift**: ${activeDrifts.map(d => d.insight).join(' ')}\n`;
    }
    if (activeGaps.length > 0) {
      dailySummary += `* **Learning Gaps Detected**: ${activeGaps.map(g => g.insight).join(' ')}\n`;
    }
    if (activeRisks.length > 0) {
      dailySummary += `* **Project Delivery Risks**: ${activeRisks.map(r => r.insight).join(' ')}\n`;
    }
    if (activePatterns.length > 0) {
      dailySummary += `* **Unresolved Decision Logs**: ${activePatterns.map(p => p.insight).join(' ')}\n`;
    }

    dailySummary += `\n### Recommendations & Daily Directives\n`;
    const recs: string[] = [];
    if (activeGaps.length > 0) {
      recs.push(`Prioritize addressing learning prerequisites: ${activeGaps[0].recommendation}`);
    }
    if (activeDrifts.length > 0) {
      recs.push(`Re-evaluate stalled objectives: ${activeDrifts[0].recommendation}`);
    }
    if (activeRisks.length > 0) {
      recs.push(`Resolve project timeline blocks: ${activeRisks[0].recommendation}`);
    }
    if (recs.length === 0) {
      recs.push("Review next items on your primary active goals calendar and continue logged learning sessions.");
    }
    dailySummary += recs.map(r => `- ${r}`).join('\n');

    // Create or update Daily Briefing
    const dailyBrief = await prisma.executiveBriefing.create({
      data: {
        userId,
        timeframe: 'DAILY',
        summary: dailySummary,
        insightsJson: JSON.stringify(currentActiveInsights.map(i => i.id)),
        recommendationsJson: JSON.stringify(recs)
      }
    });

    // B. Weekly Briefing compiler
    let weeklySummary = `## Weekly Strategic Review\n`;
    weeklySummary += `**Alert Count**: ${totalRisksCount} warnings active this week.\n`;
    weeklySummary += `**Review Rate**: Spacing review completions are currently tracking behind target.\n\n`;
    weeklySummary += `### Tactical Overview:\n`;
    weeklySummary += `- Goal alignment: ${(100 - Math.min(100, activeDrifts.length * 25))}% alignment to stated targets.\n`;
    weeklySummary += `- Project healthy state: ${activeRisks.length === 0 ? 'Optimal' : 'Slipping'}.\n\n`;
    weeklySummary += `### Career Leverage Opportunities:\n`;
    if (activeOpps.length > 0) {
      weeklySummary += activeOpps.map(o => `- **${o.title}**: ${o.insight} Recommendation: ${o.recommendation}`).join('\n');
    } else {
      weeklySummary += `- No leverage opportunities calculated. Continue mastering base technical requirements.`;
    }

    const weeklyBrief = await prisma.executiveBriefing.create({
      data: {
        userId,
        timeframe: 'WEEKLY',
        summary: weeklySummary,
        insightsJson: JSON.stringify(currentActiveInsights.map(i => i.id)),
        recommendationsJson: JSON.stringify(activeOpps.map(o => o.recommendation))
      }
    });

    // C. Monthly Review Compiler
    let monthlySummary = `# Monthly Strategic Executive Review\n`;
    monthlySummary += `### Long-Term Analysis:\n`;
    monthlySummary += `- Goal Progress: Active review rate calculated over 30 days.\n`;
    monthlySummary += `- Avoidance logs: ${activePatterns.length} deferred tradeoffs logged.\n\n`;
    monthlySummary += `### Structural Recommendations:\n`;
    monthlySummary += `1. Audit the following learning gaps immediately: ${activeGaps.map(g => g.title).join(', ') || 'None'}.\n`;
    monthlySummary += `2. Re-align weekly hours to ensure high-priority projects do not stagnate.`;

    const monthlyBrief = await prisma.executiveBriefing.create({
      data: {
        userId,
        timeframe: 'MONTHLY',
        summary: monthlySummary,
        insightsJson: JSON.stringify(currentActiveInsights.map(i => i.id)),
        recommendationsJson: JSON.stringify([
          "Conduct direct skills audit vs target architect roles.",
          "Close out stale decisions logged in database."
        ])
      }
    });

    return {
      insightsCreated: insightsCreatedCount,
      dailyBriefId: dailyBrief.id,
      weeklyBriefId: weeklyBrief.id,
      monthlyBriefId: monthlyBrief.id
    };

  } catch (err) {
    console.error('generateBriefingsAndInsights error:', err);
    return { insightsCreated: 0 };
  }
}

/**
 * Returns proactive dialog prompt inject contents
 */
export async function getProactivePromptContext(userId: string): Promise<string> {
  try {
    const pendingInsights = await prisma.executiveInsight.findMany({
      where: { userId, status: 'ACTIVE', followUpStatus: 'PENDING' },
      take: 2
    });

    if (pendingInsights.length === 0) return '';

    let promptContext = '\n\n=========================================\n';
    promptContext += 'CRITICAL PROACTIVE BRIEFINGS & PROGRESS WARNINGS (Bring these up naturally at the start of dialogue to challenge/query the user):\n';
    for (const ins of pendingInsights) {
      promptContext += `* [ALERT - ${ins.type}] Insight: "${ins.insight}". Recommendation: "${ins.recommendation}". (Confidence: ${(ins.confidence * 100).toFixed(0)}%)\n`;
    }
    promptContext += '=========================================\n';
    return promptContext;

  } catch (err) {
    console.error('getProactivePromptContext error:', err);
    return '';
  }
}
