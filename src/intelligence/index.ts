export {
  analyzePatterns,
  analyzeFilePatterns,
  analyzeProjectPatterns,
  analyzeTopicPatterns,
  analyzeToolUsage,
  analyzeWorkingHours,
  formatPatternSummary,
  type PatternAnalysis,
  type FilePattern,
  type ProjectPattern,
  type TopicPattern,
  type ToolUsagePattern,
} from './patterns.js';

export {
  extractQuestions,
  extractAllQuestions,
  groupQuestionsByProject,
  formatQuestionsForBriefing,
  type OpenQuestion,
} from './questions.js';

export {
  saveFeedback,
  loadFeedback,
  computeFeedbackStats,
  saveTopicPriorities,
  loadTopicPriorities,
  updateTopicPriority,
  getTopicPriority,
  derivePrioritiesFromFeedback,
  shouldIncludeCardType,
  recordBriefingFeedback,
  type FeedbackEntry,
  type FeedbackStats,
  type TopicPriority,
} from './feedback.js';
