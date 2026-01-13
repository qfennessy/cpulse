/**
 * Analytics module for cpulse dashboard.
 * Computes metrics and trends from briefing history.
 *
 * Created: 2026-01-12
 */

import { getAllBriefings, type StoredBriefing } from '../storage/briefings.js';
import type { ArticleCard } from '../types/index.js';

export interface Analytics {
  totalBriefings: number;
  briefingsByMonth: { month: string; count: number }[];
  cardTypeDistribution: { type: string; count: number }[];
  feedbackStats: {
    totalRated: number;
    helpful: number;
    notHelpful: number;
    snoozed: number;
  };
  topProjects: { name: string; mentions: number }[];
  averageCardsPerBriefing: number;
  streak: {
    current: number;
    longest: number;
  };
  recentActivity: {
    date: string;
    cardCount: number;
    hadFeedback: boolean;
  }[];
}

export async function getAnalytics(dataDir: string): Promise<Analytics> {
  const briefings = getAllBriefings(dataDir);

  // Calculate briefings by month
  const monthCounts = new Map<string, number>();
  for (const briefing of briefings) {
    const date = new Date(briefing.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
  }

  const briefingsByMonth = Array.from(monthCounts.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12); // Last 12 months

  // Card type distribution
  const cardTypeCounts = new Map<string, number>();
  for (const briefing of briefings) {
    for (const card of briefing.cards) {
      cardTypeCounts.set(card.type, (cardTypeCounts.get(card.type) || 0) + 1);
    }
  }

  const cardTypeDistribution = Array.from(cardTypeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Feedback stats
  let totalRated = 0;
  let helpful = 0;
  let notHelpful = 0;
  let snoozed = 0;

  for (const briefing of briefings) {
    if (briefing.feedback?.cardFeedback) {
      for (const rating of Object.values(briefing.feedback.cardFeedback)) {
        totalRated++;
        if (rating === 'helpful') helpful++;
        else if (rating === 'not_helpful') notHelpful++;
        else if (rating === 'snoozed') snoozed++;
      }
    }
  }

  // Extract project mentions from card metadata
  const projectMentions = new Map<string, number>();
  for (const briefing of briefings) {
    for (const card of briefing.cards) {
      const projects = card.metadata?.projects as string[] | undefined;
      if (projects) {
        for (const project of projects) {
          projectMentions.set(project, (projectMentions.get(project) || 0) + 1);
        }
      }
    }
  }

  const topProjects = Array.from(projectMentions.entries())
    .map(([name, mentions]) => ({ name, mentions }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);

  // Average cards per briefing
  const totalCards = briefings.reduce((sum, b) => sum + b.cards.length, 0);
  const averageCardsPerBriefing =
    briefings.length > 0 ? totalCards / briefings.length : 0;

  // Calculate streak
  const streak = calculateStreak(briefings);

  // Recent activity (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentActivity = briefings
    .filter((b) => new Date(b.date) >= thirtyDaysAgo)
    .map((b) => ({
      date: new Date(b.date).toISOString().split('T')[0],
      cardCount: b.cards.length,
      hadFeedback: !!b.feedback,
    }))
    .slice(0, 30);

  return {
    totalBriefings: briefings.length,
    briefingsByMonth,
    cardTypeDistribution,
    feedbackStats: {
      totalRated,
      helpful,
      notHelpful,
      snoozed,
    },
    topProjects,
    averageCardsPerBriefing: Math.round(averageCardsPerBriefing * 10) / 10,
    streak,
    recentActivity,
  };
}

function calculateStreak(
  briefings: StoredBriefing[]
): { current: number; longest: number } {
  if (briefings.length === 0) {
    return { current: 0, longest: 0 };
  }

  // Sort by date descending
  const sorted = [...briefings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Get unique dates
  const dates = new Set<string>();
  for (const b of sorted) {
    dates.add(new Date(b.date).toISOString().split('T')[0]);
  }

  const sortedDates = Array.from(dates).sort().reverse();

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  if (sortedDates[0] === today || sortedDates[0] === yesterday) {
    currentStreak = 1;
    let lastDate = new Date(sortedDates[0]);

    for (let i = 1; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i]);
      const dayDiff =
        (lastDate.getTime() - currentDate.getTime()) / (24 * 60 * 60 * 1000);

      if (dayDiff <= 1.5) {
        currentStreak++;
        lastDate = currentDate;
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;
  const allDates = Array.from(dates).sort();

  for (let i = 1; i < allDates.length; i++) {
    const prev = new Date(allDates[i - 1]);
    const curr = new Date(allDates[i]);
    const dayDiff =
      (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);

    if (dayDiff <= 1.5) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return { current: currentStreak, longest: longestStreak };
}
