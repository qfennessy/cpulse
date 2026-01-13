import type { Briefing, BriefingFeedback, ArticleCard } from '../types/index.js';
/**
 * StoredBriefing includes all Briefing fields with proper types for storage.
 */
export interface StoredBriefing {
    id: string;
    date: Date;
    cards: ArticleCard[];
    generatedAt: Date;
    feedback?: BriefingFeedback;
}
export declare function saveBriefing(dataDir: string, briefing: Briefing): void;
export declare function loadBriefings(dataDir: string): Briefing[];
export declare function getLatestBriefing(dataDir: string): Briefing | null;
export declare function getBriefingsByDateRange(dataDir: string, startDate: Date, endDate: Date): Briefing[];
export declare function updateBriefingFeedback(dataDir: string, briefingId: string, feedback: BriefingFeedback): boolean;
export declare function getBriefingStats(dataDir: string): {
    totalBriefings: number;
    totalCards: number;
    feedbackCount: number;
    helpfulCount: number;
};
/**
 * Get all briefings sorted by date (most recent first).
 */
export declare function getAllBriefings(dataDir: string): StoredBriefing[];
/**
 * Get a single briefing by ID.
 */
export declare function getBriefing(dataDir: string, id: string): StoredBriefing | null;
//# sourceMappingURL=briefings.d.ts.map