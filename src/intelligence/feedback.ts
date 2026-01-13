import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ArticleCard, BriefingFeedback } from '../types/index.js';

export interface FeedbackEntry {
  briefingId: string;
  cardType: ArticleCard['type'];
  cardTitle: string;
  rating: 'helpful' | 'not_helpful' | 'snoozed';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface FeedbackStats {
  totalFeedback: number;
  byCardType: Record<string, { helpful: number; notHelpful: number; snoozed: number }>;
  byTopic: Record<string, { helpful: number; notHelpful: number }>;
  recentTrend: 'improving' | 'declining' | 'stable';
}

export interface TopicPriority {
  topic: string;
  priority: 'high' | 'normal' | 'low' | 'ignored';
  reason: 'user_set' | 'feedback_derived';
  lastUpdated: Date;
}

const FEEDBACK_FILE = 'feedback.jsonl';
const PRIORITIES_FILE = 'priorities.json';

function getFeedbackPath(dataDir: string): string {
  return join(dataDir, FEEDBACK_FILE);
}

function getPrioritiesPath(dataDir: string): string {
  return join(dataDir, PRIORITIES_FILE);
}

export function saveFeedback(dataDir: string, entry: FeedbackEntry): void {
  const filePath = getFeedbackPath(dataDir);
  const line = JSON.stringify(entry) + '\n';

  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8');
    writeFileSync(filePath, existing + line);
  } else {
    writeFileSync(filePath, line);
  }
}

export function loadFeedback(dataDir: string): FeedbackEntry[] {
  const filePath = getFeedbackPath(dataDir);

  if (!existsSync(filePath)) {
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  const entries: FeedbackEntry[] = [];
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as FeedbackEntry;
      entry.timestamp = new Date(entry.timestamp);
      entries.push(entry);
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

export function computeFeedbackStats(entries: FeedbackEntry[]): FeedbackStats {
  const byCardType: FeedbackStats['byCardType'] = {};
  const byTopic: FeedbackStats['byTopic'] = {};

  for (const entry of entries) {
    // By card type
    if (!byCardType[entry.cardType]) {
      byCardType[entry.cardType] = { helpful: 0, notHelpful: 0, snoozed: 0 };
    }
    if (entry.rating === 'helpful') {
      byCardType[entry.cardType].helpful++;
    } else if (entry.rating === 'not_helpful') {
      byCardType[entry.cardType].notHelpful++;
    } else {
      byCardType[entry.cardType].snoozed++;
    }

    // By topic (from card title)
    const topic = entry.cardTitle.toLowerCase();
    if (!byTopic[topic]) {
      byTopic[topic] = { helpful: 0, notHelpful: 0 };
    }
    if (entry.rating === 'helpful') {
      byTopic[topic].helpful++;
    } else if (entry.rating === 'not_helpful') {
      byTopic[topic].notHelpful++;
    }
  }

  // Calculate recent trend (last 7 days vs previous 7 days)
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

  const recentEntries = entries.filter((e) => e.timestamp.getTime() > weekAgo);
  const previousEntries = entries.filter(
    (e) => e.timestamp.getTime() > twoWeeksAgo && e.timestamp.getTime() <= weekAgo
  );

  const recentHelpfulRate =
    recentEntries.length > 0
      ? recentEntries.filter((e) => e.rating === 'helpful').length / recentEntries.length
      : 0;
  const previousHelpfulRate =
    previousEntries.length > 0
      ? previousEntries.filter((e) => e.rating === 'helpful').length / previousEntries.length
      : 0;

  let recentTrend: FeedbackStats['recentTrend'] = 'stable';
  if (recentHelpfulRate > previousHelpfulRate + 0.1) {
    recentTrend = 'improving';
  } else if (recentHelpfulRate < previousHelpfulRate - 0.1) {
    recentTrend = 'declining';
  }

  return {
    totalFeedback: entries.length,
    byCardType,
    byTopic,
    recentTrend,
  };
}

export function saveTopicPriorities(dataDir: string, priorities: TopicPriority[]): void {
  const filePath = getPrioritiesPath(dataDir);
  writeFileSync(filePath, JSON.stringify(priorities, null, 2));
}

export function loadTopicPriorities(dataDir: string): TopicPriority[] {
  const filePath = getPrioritiesPath(dataDir);

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const priorities = JSON.parse(content) as TopicPriority[];
    return priorities.map((p) => ({
      ...p,
      lastUpdated: new Date(p.lastUpdated),
    }));
  } catch {
    return [];
  }
}

export function updateTopicPriority(
  dataDir: string,
  topic: string,
  priority: TopicPriority['priority'],
  reason: TopicPriority['reason'] = 'user_set'
): void {
  const priorities = loadTopicPriorities(dataDir);

  const existing = priorities.find((p) => p.topic.toLowerCase() === topic.toLowerCase());
  if (existing) {
    existing.priority = priority;
    existing.reason = reason;
    existing.lastUpdated = new Date();
  } else {
    priorities.push({
      topic,
      priority,
      reason,
      lastUpdated: new Date(),
    });
  }

  saveTopicPriorities(dataDir, priorities);
}

export function getTopicPriority(dataDir: string, topic: string): TopicPriority['priority'] {
  const priorities = loadTopicPriorities(dataDir);
  const match = priorities.find((p) => p.topic.toLowerCase() === topic.toLowerCase());
  return match?.priority || 'normal';
}

export function derivePrioritiesFromFeedback(dataDir: string): void {
  const feedback = loadFeedback(dataDir);
  const stats = computeFeedbackStats(feedback);

  // Topics with consistently negative feedback should be deprioritized
  for (const [topic, counts] of Object.entries(stats.byTopic)) {
    const total = counts.helpful + counts.notHelpful;
    if (total < 3) continue; // Need enough data

    const helpfulRate = counts.helpful / total;

    if (helpfulRate < 0.3) {
      updateTopicPriority(dataDir, topic, 'low', 'feedback_derived');
    } else if (helpfulRate > 0.8) {
      updateTopicPriority(dataDir, topic, 'high', 'feedback_derived');
    }
  }
}

export function shouldIncludeCardType(
  dataDir: string,
  cardType: ArticleCard['type']
): boolean {
  const feedback = loadFeedback(dataDir);
  const stats = computeFeedbackStats(feedback);

  const typeStats = stats.byCardType[cardType];
  if (!typeStats) return true;

  const total = typeStats.helpful + typeStats.notHelpful;
  if (total < 5) return true; // Not enough data

  // If less than 20% helpful, consider excluding
  const helpfulRate = typeStats.helpful / total;
  return helpfulRate > 0.2;
}

export function recordBriefingFeedback(
  dataDir: string,
  briefingId: string,
  cards: ArticleCard[],
  feedback: BriefingFeedback
): void {
  for (const [cardIndex, rating] of Object.entries(feedback.cardFeedback)) {
    const idx = parseInt(cardIndex, 10);
    const card = cards[idx];
    if (!card) continue;

    saveFeedback(dataDir, {
      briefingId,
      cardType: card.type,
      cardTitle: card.title,
      rating,
      timestamp: feedback.submittedAt,
      metadata: card.metadata,
    });
  }

  // Update derived priorities based on new feedback
  derivePrioritiesFromFeedback(dataDir);
}
