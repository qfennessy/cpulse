/**
 * HTML email template for briefings.
 * Clean, light theme inspired by NYT newsletters.
 *
 * Updated: 2026-01-13 - Light theme with dark text on white background
 */
import type { ArticleCard } from '../types/index.js';
/**
 * Convert markdown to simple HTML for email.
 * Email clients don't support full markdown, so we do basic conversions.
 */
export declare function markdownToEmailHtml(markdown: string): string;
/**
 * Generate HTML for a single card.
 */
export declare function renderCardHtml(card: ArticleCard, index: number, briefingId: string): string;
/**
 * Render transition text between cards.
 */
export declare function renderTransitionHtml(text: string): string;
/**
 * Generate complete HTML email for a briefing.
 */
export declare function renderBriefingHtml(briefingId: string, cards: ArticleCard[], opening: string, closing: string, cardTransitions: Map<number, string>): string;
/**
 * Generate plain text version of briefing for email fallback.
 */
export declare function renderBriefingPlainText(cards: ArticleCard[], opening: string, closing: string, cardTransitions: Map<number, string>): string;
//# sourceMappingURL=html-template.d.ts.map