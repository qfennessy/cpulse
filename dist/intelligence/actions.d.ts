/**
 * Action item extraction from signals.
 * Transforms enriched data into prioritized, actionable items.
 */
import type { ExtractedSignals, ActionItem } from '../types/index.js';
/**
 * Extract prioritized action items from all signal sources.
 * Priority order:
 * 1. Critical post-merge comments (code already in production)
 * 2. Blockers (preventing progress)
 * 3. Review requests (blocking others, sorted by age)
 * 4. Recurring todos (appeared in 2+ sessions)
 * 5. Open questions requiring follow-up
 */
export declare function extractActionItems(signals: ExtractedSignals): ActionItem[];
/**
 * Extract quick wins - small tasks that can be done in < 15 minutes.
 */
export declare function extractQuickWins(signals: ExtractedSignals): ActionItem[];
/**
 * Format action items for display in the closing narrative.
 */
export declare function formatActionItemsForClosing(actionItems: ActionItem[], quickWins: ActionItem[]): string;
//# sourceMappingURL=actions.d.ts.map