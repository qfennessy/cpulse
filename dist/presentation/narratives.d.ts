/**
 * Narrative transitions for briefings.
 * Generates contextual intro text and transitions between cards.
 */
import type { ArticleCard, ExtractedSignals } from '../types/index.js';
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
export declare function buildNarrativeContext(signals: ExtractedSignals): NarrativeContext;
/**
 * Generate opening narrative for the briefing.
 */
export declare function generateOpeningNarrative(context: NarrativeContext): string;
/**
 * Generate transition text between cards.
 */
export declare function generateTransition(previousCard: ArticleCard | null, nextCard: ArticleCard, context: NarrativeContext): string | null;
/**
 * Generate closing narrative for the briefing.
 */
export declare function generateClosingNarrative(cards: ArticleCard[], context: NarrativeContext): string;
/**
 * Wrap a briefing with narrative elements.
 */
export declare function wrapWithNarratives(cards: ArticleCard[], signals: ExtractedSignals): {
    opening: string;
    cardTransitions: Map<number, string>;
    closing: string;
};
/**
 * Format a complete briefing with narratives as markdown.
 */
export declare function formatBriefingWithNarratives(cards: ArticleCard[], signals: ExtractedSignals): string;
//# sourceMappingURL=narratives.d.ts.map