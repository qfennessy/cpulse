/**
 * Enhanced HTML email template for briefings.
 * Responsive design that works in email clients with dark mode support.
 *
 * Updated: 2026-01-12 - Enhanced visual design with colored accents
 */

import type { ArticleCard } from '../types/index.js';

// Card type styling with distinct colors
const CARD_TYPE_STYLES: Record<string, { color: string; bgLight: string; bgDark: string; icon: string; label: string }> = {
  project_continuity: { color: '#2563eb', bgLight: '#eff6ff', bgDark: '#1e3a5f', icon: '&#9654;', label: 'Project' },
  code_review: { color: '#059669', bgLight: '#ecfdf5', bgDark: '#134e4a', icon: '&#10003;', label: 'Code Review' },
  open_questions: { color: '#d97706', bgLight: '#fffbeb', bgDark: '#451a03', icon: '?', label: 'Questions' },
  patterns: { color: '#7c3aed', bgLight: '#f5f3ff', bgDark: '#2e1065', icon: '&#9679;', label: 'Patterns' },
  learning: { color: '#0891b2', bgLight: '#ecfeff', bgDark: '#164e63', icon: '&#9733;', label: 'Learning' },
  suggestions: { color: '#be185d', bgLight: '#fdf2f8', bgDark: '#500724', icon: '&#10148;', label: 'Suggestions' },
  weekly_summary: { color: '#4f46e5', bgLight: '#eef2ff', bgDark: '#1e1b4b', icon: '&#9632;', label: 'Weekly' },
  post_merge_feedback: { color: '#dc2626', bgLight: '#fef2f2', bgDark: '#450a0a', icon: '!', label: 'Post-Merge' },
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
    '<code class="inline-code" style="background:#1e293b;color:#e2e8f0;padding:2px 8px;border-radius:4px;font-family:\'SF Mono\',Monaco,monospace;font-size:13px;">$1</code>'
  );

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#60a5fa;text-decoration:underline;">$1</a>'
  );

  // Headers - styled distinctively
  html = html.replace(/^### (.+)$/gm, '<h3 style="margin:20px 0 10px;font-size:15px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="margin:24px 0 12px;font-size:18px;font-weight:600;color:#f1f5f9;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="margin:28px 0 16px;font-size:22px;font-weight:700;color:#f8fafc;">$1</h1>');

  // Bullet lists with custom styling
  html = html.replace(/^- (.+)$/gm, '<li style="margin:6px 0;padding-left:4px;">$1</li>');
  html = html.replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin:16px 0;padding-left:20px;list-style:none;">$&</ul>');
  // Add bullet markers
  html = html.replace(/<li style="/g, '<li style="position:relative;padding-left:16px;');
  html = html.replace(/<li /g, '<li ');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin:6px 0;">$1</li>');

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p style="margin:14px 0;line-height:1.7;">');

  // Single newlines to <br>
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph
  html = `<p style="margin:14px 0;line-height:1.7;">${html}</p>`;

  // Clean up empty paragraphs
  html = html.replace(/<p[^>]*><\/p>/g, '');
  html = html.replace(/<p[^>]*><br><\/p>/g, '');

  return html;
}

/**
 * Generate HTML for a single card with colored left border accent.
 */
export function renderCardHtml(card: ArticleCard, index: number, briefingId: string): string {
  const style = CARD_TYPE_STYLES[card.type] || CARD_TYPE_STYLES.project_continuity;
  const contentHtml = markdownToEmailHtml(card.content);

  return `
    <div class="card-container" style="background:#1e293b;border-radius:12px;margin:20px 0;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.3);">
      <!-- Colored top accent bar -->
      <div style="height:4px;background:${style.color};"></div>

      <div style="padding:24px;">
        <!-- Card header with icon and label -->
        <div style="display:flex;align-items:center;margin-bottom:20px;">
          <div style="width:36px;height:36px;background:${style.color};border-radius:8px;display:flex;align-items:center;justify-content:center;margin-right:14px;">
            <span style="color:white;font-size:16px;font-weight:bold;">${style.icon}</span>
          </div>
          <span class="card-label" style="background:${style.color}25;color:${style.color};padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
            ${style.label}
          </span>
        </div>

        <!-- Card title -->
        <h2 class="title" style="margin:0 0 18px;font-size:22px;font-weight:700;color:#f8fafc;line-height:1.3;">
          ${escapeHtml(card.title)}
        </h2>

        <!-- Card content -->
        <div class="content" style="color:#cbd5e1;font-size:15px;line-height:1.7;">
          ${contentHtml}
        </div>

        <!-- Feedback buttons -->
        <div class="card-divider" style="margin-top:24px;padding-top:20px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
          <span class="muted" style="color:#64748b;font-size:13px;">Was this helpful?</span>
          <a class="feedback-btn" href="mailto:?subject=cpulse feedback&body=Briefing: ${briefingId}%0ACard: ${index}%0ARating: helpful" style="display:inline-flex;align-items:center;padding:8px 16px;background:#334155;border-radius:8px;color:#e2e8f0;text-decoration:none;font-size:13px;font-weight:500;transition:background 0.2s;">
            <span style="margin-right:6px;">&#10003;</span> Yes
          </a>
          <a class="feedback-btn" href="mailto:?subject=cpulse feedback&body=Briefing: ${briefingId}%0ACard: ${index}%0ARating: not_helpful" style="display:inline-flex;align-items:center;padding:8px 16px;background:#334155;border-radius:8px;color:#e2e8f0;text-decoration:none;font-size:13px;font-weight:500;transition:background 0.2s;">
            <span style="margin-right:6px;">&#10005;</span> No
          </a>
        </div>
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
    <div style="padding:16px 24px;color:#94a3b8;font-style:italic;font-size:15px;border-left:3px solid #475569;margin:24px 0;background:#0f172a40;border-radius:0 8px 8px 0;">
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
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>cpulse Daily Briefing - ${date}</title>
  <style>
    body {
      background-color: #0f172a;
      color: #e2e8f0;
    }
    a:hover {
      opacity: 0.8;
    }
    .feedback-btn:hover {
      background-color: #475569 !important;
    }
    .inline-code {
      background: #334155 !important;
    }
    /* Light mode adjustments */
    @media (prefers-color-scheme: light) {
      body, .body-bg {
        background-color: #f1f5f9 !important;
      }
      .container {
        background-color: #f1f5f9 !important;
      }
      .card-container {
        background-color: #ffffff !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
      }
      h1, h2, h3, .title {
        color: #0f172a !important;
      }
      p, li, span, div, .content, .text {
        color: #334155 !important;
      }
      .muted {
        color: #64748b !important;
      }
      a {
        color: #2563eb !important;
      }
      .inline-code, code {
        background-color: #e2e8f0 !important;
        color: #334155 !important;
      }
      .feedback-btn {
        background-color: #e2e8f0 !important;
        color: #334155 !important;
      }
      .card-divider {
        border-color: #e2e8f0 !important;
      }
      .header-box {
        background: linear-gradient(135deg, #1e40af, #7c3aed) !important;
      }
    }
  </style>
</head>
<body class="body-bg" style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#e2e8f0;">
  <div class="container" style="max-width:680px;margin:0 auto;padding:24px;">

    <!-- Header with gradient -->
    <div class="header-box" style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);border-radius:16px;padding:32px;margin-bottom:24px;text-align:center;border:1px solid #334155;">
      <h1 class="title" style="margin:0 0 8px;font-size:32px;font-weight:800;color:#f8fafc;letter-spacing:-0.5px;">
        cpulse
      </h1>
      <p class="date muted" style="margin:0;color:#94a3b8;font-size:15px;">
        ${date}
      </p>
    </div>

    <!-- Opening narrative with accent -->
    <div style="background:#1e293b;border-radius:12px;padding:24px;margin-bottom:16px;border-left:4px solid #3b82f6;">
      <div class="content" style="color:#cbd5e1;font-size:16px;line-height:1.7;">
        ${markdownToEmailHtml(opening)}
      </div>
    </div>

    <!-- Cards -->
    ${cardsHtml}

    <!-- Closing narrative with accent -->
    <div style="background:#1e293b;border-radius:12px;padding:24px;margin-top:24px;border-left:4px solid #10b981;">
      <div class="content" style="color:#cbd5e1;font-size:15px;line-height:1.7;">
        ${markdownToEmailHtml(closing)}
      </div>
    </div>

    <!-- Footer -->
    <div class="footer" style="text-align:center;padding:32px 0;color:#64748b;font-size:13px;">
      <div style="width:60px;height:2px;background:linear-gradient(90deg, transparent, #475569, transparent);margin:0 auto 20px;"></div>
      <p style="margin:0;">
        Generated by <a href="https://github.com/qfennessy/cpulse" style="color:#94a3b8;text-decoration:none;">cpulse</a>
      </p>
      <p style="margin:12px 0 0;">
        <a href="mailto:?subject=Unsubscribe from cpulse" style="color:#64748b;text-decoration:none;">Unsubscribe</a>
        <span style="margin:0 8px;color:#475569;">|</span>
        <a href="mailto:?subject=cpulse settings" style="color:#64748b;text-decoration:none;">Settings</a>
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
