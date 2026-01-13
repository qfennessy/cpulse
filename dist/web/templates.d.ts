/**
 * HTML templates for cpulse web dashboard.
 * Server-rendered pages with responsive design.
 *
 * Created: 2026-01-12
 */
import type { StoredBriefing } from '../storage/briefings.js';
import type { Config } from '../types/index.js';
import type { Analytics } from './analytics.js';
export declare function renderDashboardPage(briefings: StoredBriefing[], page: number, totalPages: number): string;
export declare function renderBriefingPage(briefing: StoredBriefing): string;
export declare function renderAnalyticsPage(analytics: Analytics): string;
export declare function renderSearchResultsPage(query: string, results: StoredBriefing[]): string;
export declare function renderConfigPage(config: Config): string;
//# sourceMappingURL=templates.d.ts.map