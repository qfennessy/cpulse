/**
 * Narrative transitions for briefings.
 * Generates contextual intro text and transitions between cards.
 */

import type { ArticleCard, ExtractedSignals, ActionItem } from '../types/index.js';

export interface NarrativeContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  dayOfWeek: string;
  primaryProject?: string;
  hasOpenPRs: boolean;
  hasUnfinishedWork: boolean;
  sessionCount: number;
  commitCount: number;
}

/**
 * Build narrative context from signals.
 */
export function buildNarrativeContext(signals: ExtractedSignals): NarrativeContext {
  const now = new Date();
  const hour = now.getHours();

  let timeOfDay: 'morning' | 'afternoon' | 'evening';
  if (hour < 12) {
    timeOfDay = 'morning';
  } else if (hour < 17) {
    timeOfDay = 'afternoon';
  } else {
    timeOfDay = 'evening';
  }

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = days[now.getDay()];

  // Find primary project (most recent or most active)
  const primaryProject =
    signals.claudeCode.activeProjects.length > 0
      ? signals.claudeCode.activeProjects[0]
      : undefined;

  // Count sessions for the primary project only
  let sessionCount = signals.claudeCode.recentSessions.length;
  if (primaryProject) {
    sessionCount = signals.claudeCode.recentSessions.filter(
      (s) => s.project === primaryProject || s.project.startsWith(primaryProject + '-')
    ).length;
  }

  return {
    timeOfDay,
    dayOfWeek,
    primaryProject,
    hasOpenPRs: signals.github.pullRequests.length > 0,
    hasUnfinishedWork: signals.claudeCode.openTodos.length > 0,
    sessionCount,
    commitCount: signals.github.commits.length,
  };
}

/**
 * Generate opening narrative for the briefing.
 */
export function generateOpeningNarrative(context: NarrativeContext): string {
  const greetings: Record<string, string[]> = {
    morning: [
      "Good morning. Here's what needs your attention today.",
      "Morning briefing ready. Let's get you oriented.",
      "Rise and code. Here's your development snapshot.",
    ],
    afternoon: [
      "Afternoon check-in. Here's where things stand.",
      "Mid-day briefing. Quick status update for you.",
      "Here's your afternoon development summary.",
    ],
    evening: [
      "Evening wrap-up. Here's what happened today.",
      "End of day briefing. Quick review before you sign off.",
      "Here's your evening development summary.",
    ],
  };

  const greeting = greetings[context.timeOfDay][
    Math.floor(Math.random() * greetings[context.timeOfDay].length)
  ];

  const details: string[] = [];

  if (context.primaryProject) {
    details.push(`Primary focus: **${context.primaryProject}**`);
  }

  if (context.sessionCount > 0) {
    details.push(`${context.sessionCount} coding sessions this week`);
  }

  if (context.commitCount > 0) {
    details.push(`${context.commitCount} commits pushed`);
  }

  if (details.length > 0) {
    return `${greeting}\n\n${details.join(' · ')}`;
  }

  return greeting;
}

/**
 * Generate transition text between cards.
 */
export function generateTransition(
  previousCard: ArticleCard | null,
  nextCard: ArticleCard,
  context: NarrativeContext
): string | null {
  // No transition for first card
  if (!previousCard) {
    return null;
  }

  // Transition based on card type combinations
  const key = `${previousCard.type}->${nextCard.type}`;

  const transitions: Record<string, string[]> = {
    'project_continuity->code_review': [
      "Now let's look at your code changes...",
      "Speaking of that work, here's the commit activity...",
      "Related commits and PRs to review...",
    ],
    'project_continuity->open_questions': [
      "A few open questions from your sessions...",
      "Some unresolved items to consider...",
      "Questions that came up during development...",
    ],
    'code_review->open_questions': [
      "Beyond the commits, some open questions...",
      "A few things still need decisions...",
      "Some items that need your attention...",
    ],
    'code_review->patterns': [
      "Looking at the bigger picture...",
      "Here's what the patterns show...",
      "Zooming out on your development habits...",
    ],
    'open_questions->patterns': [
      "And here's the broader context...",
      "Looking at overall patterns...",
      "Some insights from your recent work...",
    ],
    'project_continuity->patterns': [
      "Here's the broader view of your work...",
      "Looking at patterns across projects...",
      "Some insights from your sessions...",
    ],
  };

  const options = transitions[key];
  if (options && options.length > 0) {
    return options[Math.floor(Math.random() * options.length)];
  }

  // Generic transitions
  const genericTransitions = [
    'Also worth noting...',
    'Additionally...',
    'On a related note...',
    'Moving on...',
  ];

  return genericTransitions[Math.floor(Math.random() * genericTransitions.length)];
}

/**
 * Generate closing narrative for the briefing.
 * When action items are provided, generates specific, actionable closing.
 * Falls back to generic closing when no action items available.
 */
export function generateClosingNarrative(
  cards: ArticleCard[],
  context: NarrativeContext,
  actionItems?: ActionItem[],
  quickWins?: ActionItem[]
): string {
  // If we have extracted action items, use them for specific closing
  if (actionItems && actionItems.length > 0) {
    const sections: string[] = [];

    // Start Here - single most important action
    const startHere = actionItems.find(a => a.isStartHere);
    if (startHere) {
      sections.push('**Start Here:**');
      sections.push(`→ ${startHere.content}`);
      if (startHere.deepLink) {
        // Format as clickable if it's a URL, otherwise as code
        if (startHere.deepLink.startsWith('http')) {
          sections.push(`  [Open in browser](${startHere.deepLink})`);
        } else {
          sections.push(`  \`${startHere.deepLink}\``);
        }
      }
      if (startHere.context) {
        sections.push(`  _${startHere.context}_`);
      }
      sections.push('');
    }

    // Priority actions (excluding the start here item)
    const priorities = actionItems.filter(a => !a.isStartHere).slice(0, 4);
    if (priorities.length > 0) {
      sections.push('**Priority Actions:**');
      for (let i = 0; i < priorities.length; i++) {
        const item = priorities[i];
        let line = `${i + 1}. ${item.content}`;
        if (item.deepLink?.startsWith('http')) {
          line += ` ([link](${item.deepLink}))`;
        }
        sections.push(line);
      }
      sections.push('');
    }

    // Quick wins
    if (quickWins && quickWins.length > 0) {
      const topQuickWins = quickWins.slice(0, 3);
      sections.push('**Quick Wins (< 15 min):**');
      for (const item of topQuickWins) {
        sections.push(`- ${item.content}`);
      }
      sections.push('');
    }

    if (sections.length > 0) {
      sections.push("---\nThat's your briefing. Let's build something great.");
      return sections.join('\n');
    }
  }

  // Fallback to original generic behavior
  const genericItems: string[] = [];

  for (const card of cards) {
    if (card.type === 'code_review' && context.hasOpenPRs) {
      genericItems.push('Review open PRs');
    }
    if (card.type === 'open_questions') {
      genericItems.push('Address open questions');
    }
    if (card.type === 'project_continuity' && context.hasUnfinishedWork) {
      genericItems.push('Complete pending todos');
    }
  }

  if (genericItems.length === 0) {
    return "That's the overview. Have a productive session.";
  }

  const priorityList = genericItems.slice(0, 3).map((item, i) => `${i + 1}. ${item}`).join('\n');

  return `**Priority actions:**\n${priorityList}\n\nThat's your briefing. Let's build something great.`;
}

/**
 * Wrap a briefing with narrative elements.
 */
export function wrapWithNarratives(
  cards: ArticleCard[],
  signals: ExtractedSignals,
  actionItems?: ActionItem[],
  quickWins?: ActionItem[]
): { opening: string; cardTransitions: Map<number, string>; closing: string } {
  const context = buildNarrativeContext(signals);
  const opening = generateOpeningNarrative(context);
  const closing = generateClosingNarrative(cards, context, actionItems, quickWins);

  const cardTransitions = new Map<number, string>();
  let previousCard: ArticleCard | null = null;

  for (let i = 0; i < cards.length; i++) {
    const transition = generateTransition(previousCard, cards[i], context);
    if (transition) {
      cardTransitions.set(i, transition);
    }
    previousCard = cards[i];
  }

  return { opening, cardTransitions, closing };
}

/**
 * Format a complete briefing with narratives as markdown.
 */
export function formatBriefingWithNarratives(
  cards: ArticleCard[],
  signals: ExtractedSignals,
  actionItems?: ActionItem[],
  quickWins?: ActionItem[]
): string {
  const { opening, cardTransitions, closing } = wrapWithNarratives(cards, signals, actionItems, quickWins);

  const sections: string[] = [opening, ''];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const transition = cardTransitions.get(i);

    if (transition) {
      sections.push(`*${transition}*`, '');
    }

    sections.push(`## ${card.title}`, '', card.content, '');
  }

  sections.push('---', '', closing);

  return sections.join('\n');
}
