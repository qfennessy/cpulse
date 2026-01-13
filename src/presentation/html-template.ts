/**
 * Enhanced HTML email template for briefings.
 * Responsive design that works in email clients with dark mode support.
 */

import type { ArticleCard } from '../types/index.js';

// Card type styling
const CARD_TYPE_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  project_continuity: { color: '#2563eb', icon: '&#128736;', label: 'Project' },
  code_review: { color: '#059669', icon: '&#128221;', label: 'Code Review' },
  open_questions: { color: '#d97706', icon: '&#10067;', label: 'Questions' },
  patterns: { color: '#7c3aed', icon: '&#128200;', label: 'Patterns' },
  learning: { color: '#0891b2', icon: '&#128218;', label: 'Learning' },
  suggestions: { color: '#be185d', icon: '&#128161;', label: 'Suggestions' },
  weekly_summary: { color: '#4f46e5', icon: '&#128197;', label: 'Weekly' },
  post_merge_feedback: { color: '#dc2626', icon: '&#128680;', label: 'Post-Merge' },
};

/**
 * Convert markdown to simple HTML for email.
 * Email clients don't support full markdown, so we do basic conversions.
 */
export function markdownToEmailHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML first
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');

  // Inline code: `code`
  html = html.replace(
    /`([^`]+?)`/g,
    '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:14px;">$1</code>'
  );

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#2563eb;text-decoration:none;">$1</a>'
  );

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="margin:16px 0 8px;font-size:16px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="margin:20px 0 12px;font-size:18px;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="margin:24px 0 16px;font-size:22px;">$1</h1>');

  // Bullet lists
  html = html.replace(/^- (.+)$/gm, '<li style="margin:4px 0;">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin:12px 0;padding-left:24px;">$&</ul>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;">$1</li>');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p style="margin:12px 0;">');

  // Single newlines to <br>
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph
  html = `<p style="margin:12px 0;">${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p[^>]*><\/p>/g, '');
  html = html.replace(/<p[^>]*><br><\/p>/g, '');

  return html;
}

/**
 * Generate HTML for a single card.
 */
export function renderCardHtml(card: ArticleCard, index: number, briefingId: string): string {
  const style = CARD_TYPE_STYLES[card.type] || CARD_TYPE_STYLES.project_continuity;
  const contentHtml = markdownToEmailHtml(card.content);

  return `
    <div class="card-container" style="background:#ffffff;border-radius:12px;padding:24px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <!-- Card header -->
      <div style="display:flex;align-items:center;margin-bottom:16px;">
        <span class="card-label" style="display:inline-block;background:${style.color}22;color:${style.color};padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;text-transform:uppercase;">
          ${style.label}
        </span>
      </div>

      <!-- Card title -->
      <h2 class="title" style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">
        ${escapeHtml(card.title)}
      </h2>

      <!-- Card content -->
      <div class="content" style="color:#374151;font-size:15px;line-height:1.6;">
        ${contentHtml}
      </div>

      <!-- Feedback buttons -->
      <div class="card-divider" style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <span class="muted" style="color:#6b7280;font-size:13px;margin-right:12px;">Was this helpful?</span>
        <a class="feedback-btn" href="mailto:?subject=cpulse feedback&body=Briefing: ${briefingId}%0ACard: ${index}%0ARating: helpful" style="display:inline-block;padding:6px 12px;margin-right:8px;background:#f3f4f6;border-radius:6px;color:#374151;text-decoration:none;font-size:13px;">
          Yes
        </a>
        <a class="feedback-btn" href="mailto:?subject=cpulse feedback&body=Briefing: ${briefingId}%0ACard: ${index}%0ARating: not_helpful" style="display:inline-block;padding:6px 12px;background:#f3f4f6;border-radius:6px;color:#374151;text-decoration:none;font-size:13px;">
          No
        </a>
      </div>
    </div>
  `;
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render transition text between cards.
 */
export function renderTransitionHtml(text: string): string {
  return `
    <div class="muted" style="padding:12px 24px;color:#6b7280;font-style:italic;font-size:15px;">
      ${escapeHtml(text)}
    </div>
  `;
}

/**
 * Generate complete HTML email for a briefing.
 */
export function renderBriefingHtml(
  briefingId: string,
  cards: ArticleCard[],
  opening: string,
  closing: string,
  cardTransitions: Map<number, string>
): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const cardsHtml = cards
    .map((card, index) => {
      const transition = cardTransitions.get(index);
      const transitionHtml = transition ? renderTransitionHtml(transition) : '';
      return transitionHtml + renderCardHtml(card, index, briefingId);
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>cpulse Daily Briefing - ${date}</title>
  <style>
    /* Dark mode support - must use !important to override inline styles */
    @media (prefers-color-scheme: dark) {
      body, .body-bg {
        background-color: #0f172a !important;
      }
      .container, .card-container, div[style*="background:#ffffff"], div[style*="background: #ffffff"] {
        background-color: #1e293b !important;
      }
      h1, h2, h3, .title {
        color: #f8fafc !important;
      }
      p, li, span, div, .content, .text {
        color: #e2e8f0 !important;
      }
      .muted, .date, .footer {
        color: #94a3b8 !important;
      }
      a {
        color: #60a5fa !important;
      }
      code {
        background-color: #334155 !important;
        color: #e2e8f0 !important;
      }
      .feedback-btn {
        background-color: #334155 !important;
        color: #e2e8f0 !important;
      }
      .card-divider {
        border-color: #334155 !important;
      }
    }
  </style>
</head>
<body class="body-bg" style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div class="container" style="max-width:640px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="text-align:center;padding:24px 0;">
      <h1 class="title" style="margin:0 0 8px;font-size:28px;font-weight:700;color:#111827;">
        cpulse
      </h1>
      <p class="date muted" style="margin:0;color:#6b7280;font-size:14px;">
        ${date}
      </p>
    </div>

    <!-- Opening narrative -->
    <div class="card-container" style="background:#ffffff;border-radius:12px;padding:24px;margin-bottom:8px;">
      <div class="content" style="color:#374151;font-size:16px;line-height:1.6;">
        ${markdownToEmailHtml(opening)}
      </div>
    </div>

    <!-- Cards -->
    ${cardsHtml}

    <!-- Closing narrative -->
    <div class="card-container" style="background:#ffffff;border-radius:12px;padding:24px;margin-top:8px;">
      <div class="content" style="color:#374151;font-size:15px;line-height:1.6;">
        ${markdownToEmailHtml(closing)}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer" style="text-align:center;padding:24px 0;color:#9ca3af;font-size:12px;">
      <p style="margin:0;">
        Generated by <a href="https://github.com/qfennessy/cpulse" style="color:#6b7280;">cpulse</a>
      </p>
      <p style="margin:8px 0 0;">
        <a href="mailto:?subject=Unsubscribe from cpulse" style="color:#6b7280;">Unsubscribe</a>
        &nbsp;·&nbsp;
        <a href="mailto:?subject=cpulse settings" style="color:#6b7280;">Settings</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of briefing for email fallback.
 */
export function renderBriefingPlainText(
  cards: ArticleCard[],
  opening: string,
  closing: string,
  cardTransitions: Map<number, string>
): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lines: string[] = [
    'cpulse Daily Briefing',
    date,
    '='.repeat(40),
    '',
    opening,
    '',
  ];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const transition = cardTransitions.get(i);

    if (transition) {
      lines.push(transition, '');
    }

    lines.push(
      '-'.repeat(40),
      `[${CARD_TYPE_STYLES[card.type]?.label || card.type}] ${card.title}`,
      '-'.repeat(40),
      '',
      card.content,
      ''
    );
  }

  lines.push('='.repeat(40), '', closing, '', '---', 'Generated by cpulse');

  return lines.join('\n');
}
