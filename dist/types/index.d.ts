export interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
}
export interface EmailConfig {
    to: string;
    from: string;
    send_time: string;
    timezone: string;
    smtp: SmtpConfig;
}
export interface ClaudeCodeSourceConfig {
    enabled: boolean;
    log_path: string;
}
export interface GitHubSourceConfig {
    enabled: boolean;
    repos: string[];
    include_private: boolean;
    token?: string;
}
export interface SourcesConfig {
    claude_code: ClaudeCodeSourceConfig;
    github: GitHubSourceConfig;
}
export interface EnabledCardsConfig {
    project_continuity?: boolean;
    code_review?: boolean;
    open_questions?: boolean;
    patterns?: boolean;
    post_merge_feedback?: boolean;
    tech_advisory?: boolean;
    challenge_insights?: boolean;
    cost_optimization?: boolean;
}
export interface PreferencesConfig {
    article_style: 'concise' | 'detailed';
    max_cards: number;
    focus_topics: string[];
    ignored_topics: string[];
    enabled_cards?: EnabledCardsConfig;
}
export interface Config {
    email: EmailConfig;
    sources: SourcesConfig;
    preferences: PreferencesConfig;
    anthropic_api_key?: string;
    data_dir?: string;
}
export interface ClaudeCodeSession {
    id: string;
    project: string;
    projectPath: string;
    startTime: Date;
    endTime?: Date;
    messages: ClaudeCodeMessage[];
    todoItems: TodoItem[];
    filesModified: string[];
    commandsRun: string[];
    errors: string[];
}
export interface ClaudeCodeMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    toolCalls?: ToolCall[];
}
export interface ToolCall {
    tool: string;
    input: Record<string, unknown>;
    output?: string;
}
export interface TodoItem {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
}
export interface GitHubCommit {
    sha: string;
    message: string;
    author: string;
    date: Date;
    repo: string;
    filesChanged: number;
    additions: number;
    deletions: number;
}
export interface GitHubPR {
    number: number;
    title: string;
    state: 'open' | 'closed' | 'merged';
    repo: string;
    createdAt: Date;
    updatedAt: Date;
    mergedAt?: Date;
    reviewComments: number;
    isDraft: boolean;
}
export interface PostMergeComment {
    id: number;
    prNumber: number;
    prTitle: string;
    repo: string;
    author: string;
    body: string;
    createdAt: Date;
    mergedAt: Date;
    url: string;
    isReviewComment: boolean;
    path?: string;
    line?: number;
}
export interface GitHubActivity {
    commits: GitHubCommit[];
    pullRequests: GitHubPR[];
    staleBranches: string[];
    postMergeComments: PostMergeComment[];
}
export interface ArticleCard {
    type: 'project_continuity' | 'code_review' | 'learning' | 'open_questions' | 'suggestions' | 'patterns' | 'weekly_summary' | 'post_merge_feedback' | 'tech_advisory' | 'challenge_insights' | 'cost_optimization';
    title: string;
    content: string;
    priority: number;
    metadata?: Record<string, unknown>;
}
export interface Briefing {
    id: string;
    date: Date;
    cards: ArticleCard[];
    generatedAt: Date;
    feedback?: BriefingFeedback;
}
export interface BriefingFeedback {
    cardFeedback: Record<string, 'helpful' | 'not_helpful' | 'snoozed'>;
    submittedAt: Date;
}
export interface ExtractedSignals {
    claudeCode: {
        recentSessions: ClaudeCodeSession[];
        openTodos: TodoItem[];
        unresolvedErrors: string[];
        activeProjects: string[];
    };
    github: GitHubActivity;
}
export interface TechStack {
    languages: string[];
    frameworks: string[];
    databases: string[];
    cloudProvider?: 'gcp' | 'aws' | 'azure' | 'other';
    cloudServices: string[];
    dependencies: {
        name: string;
        version: string;
    }[];
    detectedFrom: string[];
}
export interface ChallengePattern {
    category: 'bug' | 'style' | 'security' | 'performance' | 'architecture';
    description: string;
    occurrences: number;
    examples: string[];
    suggestedFix?: string;
}
export interface ChallengeAnalysis {
    patterns: ChallengePattern[];
    errorPatterns: {
        type: string;
        count: number;
        examples: string[];
    }[];
    analyzedPRs: number;
    analyzedSessions: number;
}
export interface CostInsight {
    category: 'api' | 'storage' | 'compute' | 'network';
    pattern: string;
    impact: 'minor' | 'moderate' | 'significant';
    suggestion: string;
    codeLocations?: string[];
}
export interface TrendInsight {
    topic: string;
    summary: string;
    relevance: string;
    sourceUrl?: string;
    cachedAt: Date;
}
export interface TrendsCache {
    trends: TrendInsight[];
    stackHash: string;
    fetchedAt: Date;
    expiresAt: Date;
}
//# sourceMappingURL=index.d.ts.map