import type { Transporter } from 'nodemailer';
import type { Briefing, EmailConfig, ExtractedSignals } from '../types/index.js';
declare function formatBriefingAsMarkdown(briefing: Briefing): string;
declare function formatBriefingAsHtml(briefing: Briefing): Promise<string>;
export declare function createTransporter(config: EmailConfig): Promise<Transporter>;
export declare function sendBriefingEmail(config: EmailConfig, briefing: Briefing, signals?: ExtractedSignals): Promise<void>;
/**
 * Format briefing with enhanced narratives.
 * Used for preview command.
 */
export declare function formatBriefingWithNarratives(briefing: Briefing, signals: ExtractedSignals): string;
export { formatBriefingAsMarkdown, formatBriefingAsHtml };
//# sourceMappingURL=email.d.ts.map