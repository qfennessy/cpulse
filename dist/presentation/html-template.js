/**
 * HTML email template for briefings.
 * Clean, light theme inspired by NYT newsletters.
 *
 * Updated: 2026-01-13 - Light theme with dark text on white background
 */
// Card type styling - muted colors for labels
const CARD_TYPE_STYLES = {
    project_continuity: { color: '#c4402f', label: 'Project' },
    code_review: { color: '#2e7d32', label: 'Code Review' },
    open_questions: { color: '#ed6c02', label: 'Questions' },
    patterns: { color: '#7b1fa2', label: 'Patterns' },
    learning: { color: '#0288d1', label: 'Learning' },
    suggestions: { color: '#c2185b', label: 'Suggestions' },
    weekly_summary: { color: '#5e35b1', label: 'Weekly' },
    post_merge_feedback: { color: '#d32f2f', label: 'Post-Merge' },
};
// Accent color (warm red like NYT Cooking)
const ACCENT_COLOR = '#c4402f';
/**
 * Convert markdown to simple HTML for email.
 * Email clients don't support full markdown, so we do basic conversions.
 */
export function markdownToEmailHtml(markdown) {
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
    html = html.replace(/`([^`]+?)`/g, '<code style="background:#f5f5f5;color:#333;padding:2px 6px;border-radius:3px;font-family:\'SF Mono\',Monaco,monospace;font-size:14px;">$1</code>');
    // Links: [text](url) - accent color, with URL escaping to prevent attribute injection
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
        const safeUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return `<a href="${safeUrl}" style="color:${ACCENT_COLOR};text-decoration:underline;">${text}</a>`;
    });
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3 style="margin:20px 0 10px;font-size:14px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 style="margin:24px 0 12px;font-size:18px;font-weight:600;color:#1a1a1a;">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 style="margin:28px 0 16px;font-size:22px;font-weight:700;color:#1a1a1a;">$1</h1>');
    // Convert list items with distinct markers
    html = html.replace(/^\d+\. (.+)$/gm, '<li data-ol style="margin:8px 0;color:#333;">$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li data-ul style="margin:8px 0;color:#333;">$1</li>');
    // Wrap each list type separately
    html = html.replace(/(<li data-ol[^>]*>.*<\/li>\n?)+/g, '<ol style="margin:16px 0;padding-left:24px;">$&</ol>');
    html = html.replace(/(<li data-ul[^>]*>.*<\/li>\n?)+/g, '<ul style="margin:16px 0;padding-left:24px;">$&</ul>');
    // Clean up data attributes
    html = html.replace(/ data-ol| data-ul/g, '');
    // Paragraphs (double newlines)
    html = html.replace(/\n\n/g, '</p><p style="margin:16px 0;line-height:1.7;color:#333;">');
    // Single newlines to <br>
    html = html.replace(/\n/g, '<br>');
    // Wrap in paragraph
    html = `<p style="margin:16px 0;line-height:1.7;color:#333;">${html}</p>`;
    // Clean up empty paragraphs
    html = html.replace(/<p[^>]*><\/p>/g, '');
    html = html.replace(/<p[^>]*><br><\/p>/g, '');
    return html;
}
/**
 * Generate HTML for a single card.
 */
export function renderCardHtml(card, index, briefingId) {
    const style = CARD_TYPE_STYLES[card.type] || CARD_TYPE_STYLES.project_continuity;
    const contentHtml = markdownToEmailHtml(card.content);
    return `
    <div style="margin:32px 0;padding-bottom:32px;border-bottom:1px solid #e5e5e5;">
      <!-- Card label -->
      <div style="margin-bottom:12px;">
        <span style="color:${style.color};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
          ${style.label}
        </span>
      </div>

      <!-- Card title -->
      <h2 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.3;font-family:Georgia,'Times New Roman',serif;">
        ${escapeHtml(card.title)}
      </h2>

      <!-- Card content -->
      <div style="color:#333;font-size:16px;line-height:1.7;">
        ${contentHtml}
      </div>

      <!-- Feedback buttons -->
      <div style="margin-top:24px;display:flex;align-items:center;gap:12px;">
        <span style="color:#999;font-size:13px;">Was this helpful?</span>
        <a href="mailto:?subject=cpulse feedback&body=Briefing: ${briefingId}%0ACard: ${index}%0ARating: helpful" style="display:inline-flex;align-items:center;padding:8px 16px;background:#f5f5f5;border-radius:6px;color:#333;text-decoration:none;font-size:13px;font-weight:500;">
          &#10003; Yes
        </a>
        <a href="mailto:?subject=cpulse feedback&body=Briefing: ${briefingId}%0ACard: ${index}%0ARating: not_helpful" style="display:inline-flex;align-items:center;padding:8px 16px;background:#f5f5f5;border-radius:6px;color:#333;text-decoration:none;font-size:13px;font-weight:500;">
          &#10005; No
        </a>
      </div>
    </div>
  `;
}
/**
 * Escape HTML special characters.
 */
function escapeHtml(text) {
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
export function renderTransitionHtml(text) {
    return `
    <div style="padding:16px 0;color:#666;font-style:italic;font-size:15px;">
      ${escapeHtml(text)}
    </div>
  `;
}
/**
 * Generate complete HTML email for a briefing.
 */
export function renderBriefingHtml(briefingId, cards, opening, closing, cardTransitions) {
    const date = new Date().toLocaleDateString('en-US', {
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
  <meta name="color-scheme" content="light">
  <title>cpulse - ${date}</title>
  <style>
    body {
      background-color: #ffffff;
      color: #1a1a1a;
    }
    a:hover {
      opacity: 0.8;
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">

    <!-- Header -->
    <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid ${ACCENT_COLOR};">
      <h1 style="margin:0 0 4px;font-size:14px;font-weight:400;color:#666;letter-spacing:1px;text-transform:uppercase;">
        Developer Briefing
      </h1>
      <div style="font-size:28px;font-weight:700;color:${ACCENT_COLOR};font-family:Georgia,'Times New Roman',serif;margin:8px 0;">
        Commit Pulse
      </div>
      <p style="margin:8px 0 0;color:#666;font-size:14px;">
        ${date}
      </p>
    </div>

    <!-- Accent line -->
    <div style="height:3px;background:${ACCENT_COLOR};margin-bottom:32px;"></div>

    <!-- Opening narrative -->
    <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #e5e5e5;font-style:italic;">
      ${markdownToEmailHtml(opening)}
    </div>

    <!-- Cards -->
    ${cardsHtml}

    <!-- Closing narrative -->
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e5e5;">
      ${markdownToEmailHtml(closing)}
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:40px;margin-top:40px;border-top:1px solid #e5e5e5;">
      <p style="margin:0;color:#999;font-size:12px;">
        Generated by <a href="https://github.com/qfennessy/cpulse" style="color:#666;text-decoration:none;">cpulse</a>
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
export function renderBriefingPlainText(cards, opening, closing, cardTransitions) {
    const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const lines = [
        'Commit Pulse Daily Briefing',
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
        lines.push('-'.repeat(40), `[${CARD_TYPE_STYLES[card.type]?.label || card.type}] ${card.title}`, '-'.repeat(40), '', card.content, '');
    }
    lines.push('='.repeat(40), '', closing, '', '---', 'Generated by Commit Pulse');
    return lines.join('\n');
}
//# sourceMappingURL=html-template.js.map