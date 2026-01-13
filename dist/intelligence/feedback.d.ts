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
    byCardType: Record<string, {
        helpful: number;
        notHelpful: number;
        snoozed: number;
    }>;
    byTopic: Record<string, {
        helpful: number;
        notHelpful: number;
    }>;
    recentTrend: 'improving' | 'declining' | 'stable';
}
export interface TopicPriority {
    topic: string;
    priority: 'high' | 'normal' | 'low' | 'ignored';
    reason: 'user_set' | 'feedback_derived';
    lastUpdated: Date;
}
export declare function saveFeedback(dataDir: string, entry: FeedbackEntry): void;
export declare function loadFeedback(dataDir: string): FeedbackEntry[];
export declare function computeFeedbackStats(entries: FeedbackEntry[]): FeedbackStats;
export declare function saveTopicPriorities(dataDir: string, priorities: TopicPriority[]): void;
export declare function loadTopicPriorities(dataDir: string): TopicPriority[];
export declare function updateTopicPriority(dataDir: string, topic: string, priority: TopicPriority['priority'], reason?: TopicPriority['reason']): void;
export declare function getTopicPriority(dataDir: string, topic: string): TopicPriority['priority'];
export declare function derivePrioritiesFromFeedback(dataDir: string): void;
export declare function shouldIncludeCardType(dataDir: string, cardType: ArticleCard['type']): boolean;
export declare function recordBriefingFeedback(dataDir: string, briefingId: string, cards: ArticleCard[], feedback: BriefingFeedback): void;
//# sourceMappingURL=feedback.d.ts.map