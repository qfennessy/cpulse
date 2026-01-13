// Configuration types
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

export interface PreferencesConfig {
  article_style: 'concise' | 'detailed';
  max_cards: number;
  focus_topics: string[];
  ignored_topics: string[];
}

export interface Config {
  email: EmailConfig;
  sources: SourcesConfig;
  preferences: PreferencesConfig;
  anthropic_api_key?: string;
  data_dir?: string;
}

// Data source types
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
  reviewComments: number;
  isDraft: boolean;
}

export interface GitHubActivity {
  commits: GitHubCommit[];
  pullRequests: GitHubPR[];
  staleBranches: string[];
}

// Article types
export interface ArticleCard {
  type: 'project_continuity' | 'code_review' | 'learning' | 'open_questions' | 'suggestions';
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

// Signal extraction types
export interface ExtractedSignals {
  claudeCode: {
    recentSessions: ClaudeCodeSession[];
    openTodos: TodoItem[];
    unresolvedErrors: string[];
    activeProjects: string[];
  };
  github: GitHubActivity;
}
