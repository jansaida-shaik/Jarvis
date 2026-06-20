import { prisma } from './db';

/**
 * Core Orchestrator for Mentor Intelligence.
 */
export async function getMentorContext(userId: string): Promise<string> {
  try {
    // 1. Get or create LearningProfile
    let profile = await prisma.learningProfile.findUnique({
      where: { userId },
      include: {
        progress: {
          include: { masteries: true }
        }
      }
    });

    if (!profile) {
      profile = await prisma.learningProfile.create({
        data: { userId },
        include: {
          progress: {
            include: { masteries: true }
          }
        }
      });
    }

    // 2. Trigger active coaching scanners in background
    // We will wait for it to make sure the context is fresh
    await scanAndGenerateInsights(userId);

    // 3. Fetch active Insights and Decisions
    const insights = await prisma.coachingInsight.findMany({
      where: { userId, status: 'ACTIVE' },
    });

    const decisions = await prisma.decisionHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    // 4. Format the context for prompt injection
    let context = '\n\n=========================================\nMENTOR INTELLIGENCE CONTEXT (Proactive coaching guidance based on long-term user history):\n';
    
    context += `User Learning Retention Score: ${(profile.retentionScore * 100).toFixed(0)}%\n`;
    context += `Last Learning Session: ${profile.lastSessionAt.toLocaleDateString()}\n`;

    // Format Learning State
    if (profile.progress.length > 0) {
      context += '\nActive Learning Topics & Concepts:\n';
      for (const p of profile.progress) {
        context += `- Topic: "${p.topic}" (Understanding: ${(p.understandingScore * 100).toFixed(0)}%, Confidence: ${(p.confidenceScore * 100).toFixed(0)}%, Review Count: ${p.reviewCount})\n`;
        const masteries = p.masteries;
        if (masteries.length > 0) {
          context += '  Concept States:\n';
          for (const m of masteries) {
            context += `    * ${m.concept}: status = ${m.status} (Repeated misunderstandings count: ${m.misunderstandCount})\n`;
          }
        }
      }
    }

    // Format Proactive Insights
    if (insights.length > 0) {
      context += '\nProactive Mentoring Advisories (Bring these up naturally to coach or prompt the user):\n';
      for (const ins of insights) {
        context += `* [ADVISORY - ${ins.type}] trigger: "${ins.trigger}". Advice: "${ins.advice}"\n`;
      }
    }

    // Format Decision tradeoffs
    if (decisions.length > 0) {
      context += '\nPast Decisions and Tradeoffs (Use these to verify current choices or warn of repeat assumptions):\n';
      for (const dec of decisions) {
        let options: string[] = [];
        try { options = JSON.parse(dec.optionsJson); } catch (e) {}
        context += `* Decision title: "${dec.title}"\n  Options analyzed: ${options.join(', ')}\n  Recommendation given: "${dec.recommendation}" (Status: ${dec.status})\n`;
      }
    }

    context += '=========================================\n';
    return context;

  } catch (err) {
    console.error('getMentorContext error:', err);
    return '';
  }
}

/**
 * Scan database records for stalled goals, missing skills, etc.
 */
export async function scanAndGenerateInsights(userId: string) {
  try {
    // A. STALLED GOALS SCAN
    // Fetch goals that are ACTIVE, have progress < 100%, and haven't been updated in 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stalledGoals = await prisma.goal.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        progress: { lt: 100 },
        updatedAt: { lt: sevenDaysAgo }
      }
    });

    for (const goal of stalledGoals) {
      // Check if insight already exists to prevent duplication
      const existing = await prisma.coachingInsight.findFirst({
        where: {
          userId,
          type: 'STALLED_GOAL',
          trigger: `Goal stalled: "${goal.title}"`,
          status: 'ACTIVE'
        }
      });

      if (!existing) {
        await prisma.coachingInsight.create({
          data: {
            userId,
            type: 'STALLED_GOAL',
            trigger: `Goal stalled: "${goal.title}"`,
            advice: `You haven't updated your goal "${goal.title}" in over a week. Let's discuss what's blocking your progress and split it into smaller tasks.`
          }
        });
      }
    }

    // B. MISSING SKILLS SCAN
    // Find target roles in user's profile and check for expected skills
    const profile = await prisma.cognitiveProfile.findUnique({
      where: { userId },
      include: { entries: true }
    });

    if (profile) {
      const targetRolesEntry = profile.entries.find(e => e.key === 'target_roles');
      const targetRoles: string[] = targetRolesEntry ? JSON.parse(targetRolesEntry.value) : [];

      if (targetRoles.includes('Software Architect') || targetRoles.includes('Principal AI Engineer')) {
        // Must have Vector databases, neural architectures, or scaling skills
        const skills = await prisma.skill.findMany({
          where: { userId }
        });
        const skillNames = skills.map(s => s.name.toLowerCase());

        const expectedSkills = ['vector embeddings', 'advanced neural architectures', 'neural networks', 'system design'];
        const missing = expectedSkills.filter(es => !skillNames.some(sn => sn.includes(es) || es.includes(sn)));

        for (const ms of missing) {
          const existing = await prisma.coachingInsight.findFirst({
            where: {
              userId,
              type: 'MISSING_SKILL',
              trigger: `Missing critical skill for Architect role: "${ms}"`,
              status: 'ACTIVE'
            }
          });

          if (!existing) {
            await prisma.coachingInsight.create({
              data: {
                userId,
                type: 'MISSING_SKILL',
                trigger: `Missing critical skill for Architect role: "${ms}"`,
                advice: `To successfully transition to a Software Architect, you need to study and master "${ms}". Let's create a learning plan for it.`
              }
            });
          }
        }
      }
    }

    // C. WEAK LEARNING AREAS & REPEATED MISTAKES SCAN
    const lp = await prisma.learningProfile.findUnique({
      where: { userId },
      include: {
        progress: {
          include: { masteries: true }
        }
      }
    });

    if (lp) {
      for (const p of lp.progress) {
        if (p.understandingScore < 0.4) {
          const existing = await prisma.coachingInsight.findFirst({
            where: {
              userId,
              type: 'WEAK_LEARNING_AREA',
              trigger: `Struggling with topic: "${p.topic}"`,
              status: 'ACTIVE'
            }
          });

          if (!existing) {
            await prisma.coachingInsight.create({
              data: {
                userId,
                type: 'WEAK_LEARNING_AREA',
                trigger: `Struggling with topic: "${p.topic}"`,
                advice: `Your understanding of "${p.topic}" is currently rated low at ${(p.understandingScore * 100).toFixed(0)}%. Let's review the core concepts today using simpler analogies.`
              }
            });
          }
        }

        for (const m of p.masteries) {
          if (m.status === 'REPEATEDLY_MISUNDERSTOOD' || m.misunderstandCount >= 2) {
            const existing = await prisma.coachingInsight.findFirst({
              where: {
                userId,
                type: 'REPEATED_MISTAKE',
                trigger: `Struggling concept: "${m.concept}" under "${p.topic}"`,
                status: 'ACTIVE'
              }
            });

            if (!existing) {
              await prisma.coachingInsight.create({
                data: {
                  userId,
                  type: 'REPEATED_MISTAKE',
                  trigger: `Struggling concept: "${m.concept}" under "${p.topic}"`,
                  advice: `You have repeatedly encountered confusion with "${m.concept}". Let's zoom in, break it down from first principles, and test your understanding before moving forward.`
                }
              });
            }
          }
        }
      }
    }

  } catch (err) {
    console.error('scanAndGenerateInsights error:', err);
  }
}

/**
 * Sync dialog metrics to SQLite tables after conversation completion.
 */
export async function syncDialogMentorship(
  userId: string,
  userMessage: string,
  assistantMessage: string
) {
  try {
    const textLower = userMessage.toLowerCase() + ' ' + assistantMessage.toLowerCase();
    
    // Get profile
    let profile = await prisma.learningProfile.findUnique({
      where: { userId },
      include: { progress: true }
    });

    if (!profile) {
      profile = await prisma.learningProfile.create({
        data: { userId },
        include: { progress: true }
      });
    }

    // 1. Topic/Concept extraction
    let topicFound = '';
    let conceptFound = '';
    
    if (textLower.includes('sql') || textLower.includes('join')) {
      topicFound = 'SQL Database';
      if (textLower.includes('left join') || textLower.includes('left')) {
        conceptFound = 'Left Join';
      } else {
        conceptFound = 'SQL Joins';
      }
    } else if (textLower.includes('next.js') || textLower.includes('nextjs')) {
      topicFound = 'Next.js Framework';
      conceptFound = 'SSR & SSG rendering';
    } else if (textLower.includes('neural') || textLower.includes('network') || textLower.includes('transformer')) {
      topicFound = 'Neural Architectures';
      conceptFound = 'Attention Mechanics';
    }

    if (topicFound && conceptFound) {
      // Find or create LearningProgress
      let progress = profile.progress.find(p => p.topic === topicFound);
      if (!progress) {
        progress = await prisma.learningProgress.create({
          data: {
            profileId: profile.id,
            topic: topicFound,
            understandingScore: 0.3,
            confidenceScore: 0.2,
            reviewCount: 1
          }
        });
      } else {
        progress = await prisma.learningProgress.update({
          where: { id: progress.id },
          data: {
            reviewCount: { increment: 1 },
            lastReviewedAt: new Date()
          }
        });
      }

      // Find or create ConceptMastery
      const existingMastery = await prisma.conceptMastery.findFirst({
        where: { progressId: progress.id, concept: conceptFound }
      });

      // Simple heuristics to evaluate understanding
      const isUnderstood = textLower.includes('now i understand') || 
                           textLower.includes('i understand') || 
                           textLower.includes('makes sense') ||
                           textLower.includes('got it');
      const isConfused = textLower.includes("don't understand") || 
                         textLower.includes("still confused") || 
                         textLower.includes("hard to grasp") ||
                         textLower.includes("not clear");

      let nextStatus = 'LEARNED';
      let incrementMisunderstand = 0;

      if (isConfused) {
        nextStatus = existingMastery && existingMastery.misunderstandCount >= 1 
          ? 'REPEATEDLY_MISUNDERSTOOD' 
          : 'PARTIALLY_UNDERSTOOD';
        incrementMisunderstand = 1;
      } else if (isUnderstood) {
        nextStatus = 'MASTERED';
      } else {
        nextStatus = existingMastery ? existingMastery.status : 'LEARNED';
      }

      if (!existingMastery) {
        await prisma.conceptMastery.create({
          data: {
            progressId: progress.id,
            concept: conceptFound,
            status: nextStatus,
            misunderstandCount: incrementMisunderstand
          }
        });
      } else {
        await prisma.conceptMastery.update({
          where: { id: existingMastery.id },
          data: {
            status: nextStatus,
            misunderstandCount: { increment: incrementMisunderstand }
          }
        });
      }

      // Update progress metrics scores
      let newUnderstandScore = progress.understandingScore;
      let newConfidenceScore = progress.confidenceScore;

      if (nextStatus === 'MASTERED') {
        newUnderstandScore = Math.min(1.0, newUnderstandScore + 0.25);
        newConfidenceScore = Math.min(1.0, newConfidenceScore + 0.3);
      } else if (nextStatus === 'REPEATEDLY_MISUNDERSTOOD') {
        newUnderstandScore = Math.max(0.1, newUnderstandScore - 0.15);
        newConfidenceScore = Math.max(0.1, newConfidenceScore - 0.2);
      }

      await prisma.learningProgress.update({
        where: { id: progress.id },
        data: {
          understandingScore: newUnderstandScore,
          confidenceScore: newConfidenceScore
        }
      });

      // If mastery achieved, check and resolve associated coaching insight
      if (nextStatus === 'MASTERED') {
        await prisma.coachingInsight.updateMany({
          where: {
            userId,
            trigger: { contains: conceptFound },
            status: 'ACTIVE'
          },
          data: { status: 'RESOLVED' }
        });
      }
    }

    // 2. Decision History Log Scan
    // If user states they decided to proceed on tradeoffs between options
    if (textLower.includes('decide') || textLower.includes('decision') || textLower.includes('focus on')) {
      let title = '';
      let options: string[] = [];
      let recommendation = '';
      let tradeoffs = {};
      let assumptions: string[] = [];

      if (textLower.includes('zoho') || textLower.includes('crm') || textLower.includes('badminton')) {
        title = 'Swapping Focus: Zoho CRM vs AI vs Badminton Platform';
        options = ['Zoho CRM Integrations', 'AI Feature Sets', 'Badminton Tournaments Platform'];
        recommendation = 'Focus on Zoho CRM & AI for market scaling, maintain Badminton as a weekend hobby.';
        tradeoffs = {
          pros: ['High scalable revenue', 'Leverages Next.js stack'],
          cons: ['Less passion alignment', 'Time splits']
        };
        assumptions = ['AI markets maintain growth speed', 'Personal time allocation limits are stable'];
      }

      if (title) {
        // Log to DecisionHistory if not already logged
        const existing = await prisma.decisionHistory.findFirst({
          where: { userId, title }
        });

        if (!existing) {
          await prisma.decisionHistory.create({
            data: {
              userId,
              title,
              optionsJson: JSON.stringify(options),
              tradeoffsJson: JSON.stringify(tradeoffs),
              assumptionsJson: JSON.stringify(assumptions),
              recommendation,
              status: 'LOGGED'
            }
          });
        }
      }
    }

    // Update profile session time and retention
    await prisma.learningProfile.update({
      where: { id: profile.id },
      data: {
        lastSessionAt: new Date(),
        retentionScore: Math.min(1.0, profile.retentionScore + 0.01) // increment slightly
      }
    });

  } catch (err) {
    console.error('syncDialogMentorship error:', err);
  }
}
