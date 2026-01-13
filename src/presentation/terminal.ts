/**
 * Terminal ANSI formatting for CLI preview output.
 *
 * Created: 2026-01-13
 */

import type { ArticleCard } from '../types/index.js';

// ANSI escape codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Bright foreground colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// Card type colors
const CARD_COLORS: Record<string, string> = {
  project_continuity: ANSI.red,
  code_review: ANSI.green,
  open_questions: ANSI.yellow,
  patterns: ANSI.magenta,
  learning: ANSI.cyan,
  suggestions: ANSI.brightMagenta,
  weekly_summary: ANSI.blue,
  post_merge_feedback: ANSI.brightRed,
};

const CARD_LABELS: Record<string, string> = {
  project_continuity: 'PROJECT',
  code_review: 'CODE REVIEW',
  open_questions: 'QUESTIONS',
  patterns: 'PATTERNS',
  learning: 'LEARNING',
  suggestions: 'SUGGESTIONS',
  weekly_summary: 'WEEKLY',
  post_merge_feedback: 'POST-MERGE',
};

/**
 * Convert markdown text to ANSI-formatted terminal output.
 */
export function markdownToAnsi(text: string): string {
  let result = text;

  // Links first: [text](url) - show text in blue underlined, url in dim
  // Process before bold/italic to avoid conflicts with [] brackets
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `${ANSI.blue}${ANSI.underline}$1${ANSI.reset} ${ANSI.dim}($2)${ANSI.reset}`
  );

  // Bold: **text** or __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, `${ANSI.bold}$1${ANSI.reset}`);
  result = result.replace(/__([^_]+)__/g, `${ANSI.bold}$1${ANSI.reset}`);

  // Italic: *text* or _text_ (not inside other markers)
  result = result.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, `${ANSI.italic}$1${ANSI.reset}`);
  result = result.replace(/(?<!_)_([^_\n]+)_(?!_)/g, `${ANSI.italic}$1${ANSI.reset}`);

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, `${ANSI.cyan}$1${ANSI.reset}`);

  // Headers
  result = result.replace(/^### (.+)$/gm, `${ANSI.brightBlack}$1${ANSI.reset}`);
  result = result.replace(/^## (.+)$/gm, `\n${ANSI.bold}${ANSI.white}$1${ANSI.reset}`);
  result = result.replace(/^# (.+)$/gm, `\n${ANSI.bold}${ANSI.brightWhite}$1${ANSI.reset}\n`);

  // List items - add colored bullets/numbers
  result = result.replace(/^- (.+)$/gm, `  ${ANSI.dim}•${ANSI.reset} $1`);
  result = result.replace(/^(\d+)\. (.+)$/gm, `  ${ANSI.dim}$1.${ANSI.reset} $2`);

  return result;
}

/**
 * Render a horizontal rule.
 */
function renderRule(): string {
  return `${ANSI.dim}${'─'.repeat(60)}${ANSI.reset}`;
}

/**
 * Render a card label badge.
 */
function renderCardLabel(type: string): string {
  const color = CARD_COLORS[type] || ANSI.white;
  const label = CARD_LABELS[type] || type.toUpperCase();
  return `${color}${ANSI.bold}${label}${ANSI.reset}`;
}

/**
 * Render a single card for terminal output.
 */
export function renderCardTerminal(card: ArticleCard): string {
  const lines: string[] = [];

  // Card label
  lines.push(renderCardLabel(card.type));

  // Card title
  lines.push(`${ANSI.bold}${card.title}${ANSI.reset}`);
  lines.push('');

  // Card content with markdown conversion
  lines.push(markdownToAnsi(card.content));

  return lines.join('\n');
}

/**
 * Render opening narrative.
 */
function renderOpening(text: string): string {
  return `${ANSI.italic}${ANSI.brightBlack}${text}${ANSI.reset}`;
}

/**
 * Render closing narrative.
 */
function renderClosing(text: string): string {
  // Convert markdown in closing (which may have action items)
  return markdownToAnsi(text);
}

/**
 * Render transition text between cards.
 */
function renderTransition(text: string): string {
  return `${ANSI.dim}${ANSI.italic}${text}${ANSI.reset}`;
}

/**
 * Render complete briefing for terminal output.
 */
export function renderBriefingTerminal(
  cards: ArticleCard[],
  opening: string,
  closing: string,
  cardTransitions: Map<number, string>
): string {
  const lines: string[] = [];

  // Header
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  lines.push('');
  lines.push(`${ANSI.bold}${ANSI.red}Commit Pulse${ANSI.reset}  ${ANSI.dim}Developer Briefing${ANSI.reset}`);
  lines.push(`${ANSI.dim}${date}${ANSI.reset}`);
  lines.push('');
  lines.push(renderRule());
  lines.push('');

  // Opening narrative
  if (opening) {
    lines.push(renderOpening(opening));
    lines.push('');
    lines.push(renderRule());
    lines.push('');
  }

  // Cards
  for (let i = 0; i < cards.length; i++) {
    const transition = cardTransitions.get(i);
    if (transition) {
      lines.push(renderTransition(transition));
      lines.push('');
    }

    lines.push(renderCardTerminal(cards[i]));
    lines.push('');

    if (i < cards.length - 1) {
      lines.push(renderRule());
      lines.push('');
    }
  }

  // Closing narrative
  if (closing) {
    lines.push(renderRule());
    lines.push('');
    lines.push(renderClosing(closing));
  }

  // Footer
  lines.push('');
  lines.push(renderRule());
  lines.push(`${ANSI.dim}Generated by cpulse - https://github.com/qfennessy/cpulse${ANSI.reset}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Simple markdown-to-ANSI formatter for basic preview.
 */
export function formatMarkdownForTerminal(markdown: string): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`${ANSI.bold}${ANSI.red}Commit Pulse${ANSI.reset}  ${ANSI.dim}Developer Briefing${ANSI.reset}`);
  lines.push('');
  lines.push(renderRule());
  lines.push('');

  lines.push(markdownToAnsi(markdown));

  lines.push('');
  lines.push(renderRule());
  lines.push(`${ANSI.dim}Generated by cpulse - https://github.com/qfennessy/cpulse${ANSI.reset}`);
  lines.push('');

  return lines.join('\n');
}
