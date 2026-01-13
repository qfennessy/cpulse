/**
 * Analytics module for cpulse dashboard.
 * Computes metrics and trends from briefing history.
 *
 * Created: 2026-01-12
 */
export interface Analytics {
    totalBriefings: number;
    briefingsByMonth: {
        month: string;
        count: number;
    }[];
    cardTypeDistribution: {
        type: string;
        count: number;
    }[];
    feedbackStats: {
        totalRated: number;
        helpful: number;
        notHelpful: number;
        snoozed: number;
    };
    topProjects: {
        name: string;
        mentions: number;
    }[];
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
export declare function getAnalytics(dataDir: string): Promise<Analytics>;
//# sourceMappingURL=analytics.d.ts.map