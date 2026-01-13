import Anthropic from '@anthropic-ai/sdk';
import type { ArticleCard, Briefing, ExtractedSignals, Config, PostMergeComment } from '../types/index.js';
import { type PatternAnalysis, type OpenQuestion } from '../intelligence/index.js';
export type { PatternAnalysis, OpenQuestion };
export declare function generateProjectContinuityCard(client: Anthropic, signals: ExtractedSignals, config: Config, systemPrompt?: string): Promise<ArticleCard | null>;
export declare function generateCodeReviewCard(client: Anthropic, signals: ExtractedSignals, config: Config, systemPrompt?: string): Promise<ArticleCard | null>;
export declare function generateOpenQuestionsCard(client: Anthropic, questions: OpenQuestion[], config: Config, systemPrompt?: string): Promise<ArticleCard | null>;
export declare function generatePatternsCard(client: Anthropic, patterns: PatternAnalysis, config: Config, systemPrompt?: string): Promise<ArticleCard | null>;
export declare function generatePostMergeFeedbackCard(client: Anthropic, comments: PostMergeComment[], config: Config, systemPrompt?: string): Promise<ArticleCard | null>;
export declare function generateBriefing(config: Config, signals: ExtractedSignals): Promise<Briefing>;
//# sourceMappingURL=articles.d.ts.map