import type { ClaudeCodeSession } from '../types/index.js';

export interface OpenQuestion {
  id: string;
  question: string;
  context: string;
  project: string;
  sessionId: string;
  timestamp: Date;
  status: 'open' | 'resolved' | 'deferred';
  resolvedAt?: Date;
  resolution?: string;
}

// Patterns that indicate a question was asked
const QUESTION_PATTERNS = [
  /\?$/m, // Ends with question mark
  /^(how|what|why|when|where|can|should|would|could|is|are|do|does)\s/im,
  /^(explain|describe|help me understand)/im,
  /not sure (how|why|what|if)/i,
  /wondering (if|how|why|what)/i,
  /any (ideas|suggestions|thoughts)/i,
];

// Patterns that suggest an unresolved state
const UNRESOLVED_PATTERNS = [
  /TODO/i,
  /FIXME/i,
  /later/i,
  /come back to/i,
  /revisit/i,
  /need to figure out/i,
  /not sure yet/i,
  /decide later/i,
  /TBD/i,
  /blocked/i,
];

// Patterns that suggest resolution
const RESOLVED_PATTERNS = [
  /that (works|worked|fixed|solved)/i,
  /perfect/i,
  /thanks/i,
  /got it/i,
  /makes sense/i,
  /understood/i,
  /all set/i,
  /done/i,
];

function generateQuestionId(session: ClaudeCodeSession, index: number): string {
  return `q-${session.id}-${index}`;
}

function extractContext(messages: ClaudeCodeSession['messages'], index: number): string {
  // Get surrounding context (previous message if exists)
  const contextParts: string[] = [];

  if (index > 0) {
    const prev = messages[index - 1];
    if (prev.content.length < 200) {
      contextParts.push(prev.content);
    }
  }

  return contextParts.join('\n').substring(0, 300);
}

function isQuestionResolved(
  messages: ClaudeCodeSession['messages'],
  questionIndex: number
): boolean {
  // Check subsequent messages for resolution patterns
  for (let i = questionIndex + 1; i < Math.min(questionIndex + 5, messages.length); i++) {
    const msg = messages[i];
    if (msg.role === 'user') {
      for (const pattern of RESOLVED_PATTERNS) {
        if (pattern.test(msg.content)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function extractQuestions(session: ClaudeCodeSession): OpenQuestion[] {
  const questions: OpenQuestion[] = [];

  for (let i = 0; i < session.messages.length; i++) {
    const message = session.messages[i];
    if (message.role !== 'user') continue;

    // Check if message contains a question
    const isQuestion = QUESTION_PATTERNS.some((p) => p.test(message.content));
    if (!isQuestion) continue;

    // Check if it looks unresolved
    const hasUnresolvedMarker = UNRESOLVED_PATTERNS.some((p) =>
      p.test(message.content)
    );

    // Check if there was a resolution
    const wasResolved = isQuestionResolved(session.messages, i);

    // Only track if it wasn't clearly resolved
    if (!wasResolved || hasUnresolvedMarker) {
      // Extract the actual question text (first sentence ending with ?)
      let questionText = message.content;
      const questionMatch = message.content.match(/[^.!?]*\?/);
      if (questionMatch) {
        questionText = questionMatch[0].trim();
      }

      // Skip very short or generic questions
      if (questionText.length < 15) continue;
      if (/^(ok|okay|yes|no|sure|right)\?$/i.test(questionText)) continue;

      questions.push({
        id: generateQuestionId(session, i),
        question: questionText.substring(0, 500),
        context: extractContext(session.messages, i),
        project: session.project,
        sessionId: session.id,
        timestamp: message.timestamp,
        status: hasUnresolvedMarker ? 'deferred' : 'open',
      });
    }
  }

  return questions;
}

export function extractAllQuestions(sessions: ClaudeCodeSession[]): OpenQuestion[] {
  const allQuestions: OpenQuestion[] = [];

  for (const session of sessions) {
    const sessionQuestions = extractQuestions(session);
    allQuestions.push(...sessionQuestions);
  }

  // Sort by timestamp, most recent first
  allQuestions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Deduplicate similar questions
  const seen = new Set<string>();
  return allQuestions.filter((q) => {
    const normalized = q.question.toLowerCase().substring(0, 50);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function groupQuestionsByProject(
  questions: OpenQuestion[]
): Map<string, OpenQuestion[]> {
  const grouped = new Map<string, OpenQuestion[]>();

  for (const q of questions) {
    const existing = grouped.get(q.project);
    if (existing) {
      existing.push(q);
    } else {
      grouped.set(q.project, [q]);
    }
  }

  return grouped;
}

export function formatQuestionsForBriefing(questions: OpenQuestion[]): string {
  if (questions.length === 0) {
    return 'No open questions tracked.';
  }

  const lines: string[] = [];
  const grouped = groupQuestionsByProject(questions);

  for (const [project, projectQuestions] of grouped) {
    lines.push(`**${project}:**`);
    for (const q of projectQuestions.slice(0, 3)) {
      const status = q.status === 'deferred' ? ' [deferred]' : '';
      lines.push(`- ${q.question}${status}`);
    }
    if (projectQuestions.length > 3) {
      lines.push(`  _...and ${projectQuestions.length - 3} more_`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
