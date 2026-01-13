/**
 * HTML templates for cpulse web dashboard.
 * Server-rendered pages with responsive design.
 *
 * Created: 2026-01-12
 */
import { markdownToEmailHtml } from '../presentation/html-template.js';
const CARD_TYPE_LABELS = {
    project_continuity: { color: '#2563eb', label: 'Project' },
    code_review: { color: '#059669', label: 'Code Review' },
    open_questions: { color: '#d97706', label: 'Questions' },
    patterns: { color: '#7c3aed', label: 'Patterns' },
    learning: { color: '#0891b2', label: 'Learning' },
    suggestions: { color: '#be185d', label: 'Suggestions' },
    weekly_summary: { color: '#4f46e5', label: 'Weekly' },
    post_merge_feedback: { color: '#dc2626', label: 'Post-Merge' },
};
function baseTemplate(title, content, activeNav = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - cpulse</title>
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #1e293b;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --card-bg: #1e293b;
        --text: #f1f5f9;
        --text-muted: #94a3b8;
        --border: #334155;
        --primary: #3b82f6;
        --primary-hover: #60a5fa;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 16px 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    header .container {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
      text-decoration: none;
    }
    nav {
      display: flex;
      gap: 24px;
    }
    nav a {
      color: var(--text-muted);
      text-decoration: none;
      padding: 8px 0;
      border-bottom: 2px solid transparent;
    }
    nav a:hover, nav a.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    main {
      padding: 32px 0;
    }
    h1 { font-size: 28px; margin: 0 0 24px; }
    h2 { font-size: 22px; margin: 0 0 16px; }
    h3 { font-size: 18px; margin: 0 0 12px; }
    .card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 16px;
      border: 1px solid var(--border);
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      font-size: 14px;
    }
    .btn:hover { background: var(--primary-hover); }
    .btn-secondary {
      background: var(--card-bg);
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { background: var(--border); }
    .grid {
      display: grid;
      gap: 16px;
    }
    .grid-2 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
    .grid-3 { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
    .stat {
      text-align: center;
      padding: 20px;
    }
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: var(--primary);
    }
    .stat-label {
      color: var(--text-muted);
      font-size: 14px;
    }
    .muted { color: var(--text-muted); }
    .pagination {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-top: 32px;
    }
    .pagination a {
      padding: 8px 16px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      text-decoration: none;
    }
    .pagination a:hover { background: var(--border); }
    .pagination .current {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
    }
    .search-box {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card-bg);
      color: var(--text);
      font-size: 16px;
      margin-bottom: 24px;
    }
    .briefing-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 8px;
      text-decoration: none;
      color: var(--text);
      transition: border-color 0.2s;
    }
    .briefing-item:hover {
      border-color: var(--primary);
    }
    .briefing-date {
      font-weight: 600;
    }
    .briefing-cards {
      display: flex;
      gap: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      font-weight: 600;
      color: var(--text-muted);
    }
    .chart-bar {
      height: 20px;
      background: var(--primary);
      border-radius: 4px;
      min-width: 4px;
    }
    pre {
      background: var(--bg);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 14px;
    }
    code {
      font-family: 'SF Mono', Monaco, monospace;
    }
    @media (max-width: 768px) {
      nav { gap: 16px; }
      .grid-2, .grid-3 { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <a href="/" class="logo">Commit Pulse</a>
      <nav>
        <a href="/"${activeNav === 'briefings' ? ' class="active"' : ''}>Briefings</a>
        <a href="/analytics"${activeNav === 'analytics' ? ' class="active"' : ''}>Analytics</a>
        <a href="/config"${activeNav === 'config' ? ' class="active"' : ''}>Config</a>
      </nav>
    </div>
  </header>
  <main>
    <div class="container">
      ${content}
    </div>
  </main>
</body>
</html>`;
}
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
export function renderDashboardPage(briefings, page, totalPages) {
    const briefingItems = briefings
        .map((b) => {
        const date = new Date(b.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
        const cardBadges = b.cards
            .slice(0, 4)
            .map((card) => {
            const style = CARD_TYPE_LABELS[card.type] || CARD_TYPE_LABELS.project_continuity;
            return `<span class="badge" style="background:${style.color}22;color:${style.color}">${style.label}</span>`;
        })
            .join('');
        return `
        <a href="/briefing/${b.id}" class="briefing-item">
          <span class="briefing-date">${date}</span>
          <div class="briefing-cards">${cardBadges}</div>
        </a>
      `;
    })
        .join('');
    const pagination = totalPages > 1
        ? `
    <div class="pagination">
      ${page > 1 ? `<a href="/?page=${page - 1}">Previous</a>` : ''}
      ${Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
            .map((p) => `<a href="/?page=${p}"${p === page ? ' class="current"' : ''}>${p}</a>`)
            .join('')}
      ${page < totalPages ? `<a href="/?page=${page + 1}">Next</a>` : ''}
    </div>
  `
        : '';
    const content = `
    <h1>Briefing History</h1>
    <input type="search" class="search-box" placeholder="Search briefings..."
           onkeyup="if(event.key==='Enter')location.href='/search?q='+encodeURIComponent(this.value)">
    ${briefings.length === 0 ? '<p class="muted">No briefings yet. Run <code>cpulse generate</code> to create your first briefing.</p>' : briefingItems}
    ${pagination}
  `;
    return baseTemplate('Briefings', content, 'briefings');
}
export function renderBriefingPage(briefing) {
    const date = new Date(briefing.date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
    const cards = briefing.cards
        .map((card) => {
        const style = CARD_TYPE_LABELS[card.type] || CARD_TYPE_LABELS.project_continuity;
        const contentHtml = markdownToEmailHtml(card.content);
        return `
        <div class="card">
          <div class="card-header">
            <span class="badge" style="background:${style.color}22;color:${style.color}">${style.label}</span>
          </div>
          <h3>${escapeHtml(card.title)}</h3>
          <div>${contentHtml}</div>
        </div>
      `;
    })
        .join('');
    const content = `
    <p class="muted"><a href="/">&larr; Back to briefings</a></p>
    <h1>${date}</h1>
    <p class="muted">Generated at ${new Date(briefing.generatedAt).toLocaleTimeString()}</p>
    ${cards}
  `;
    return baseTemplate(`Briefing - ${date}`, content, 'briefings');
}
export function renderAnalyticsPage(analytics) {
    const monthlyChart = analytics.briefingsByMonth
        .map((m) => {
        const maxCount = Math.max(...analytics.briefingsByMonth.map((x) => x.count));
        const width = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
        return `
        <tr>
          <td>${m.month}</td>
          <td><div class="chart-bar" style="width:${width}%"></div></td>
          <td>${m.count}</td>
        </tr>
      `;
    })
        .join('');
    const cardTypeRows = analytics.cardTypeDistribution
        .map((ct) => {
        const style = CARD_TYPE_LABELS[ct.type] || { color: '#666', label: ct.type };
        return `
        <tr>
          <td><span class="badge" style="background:${style.color}22;color:${style.color}">${style.label}</span></td>
          <td>${ct.count}</td>
        </tr>
      `;
    })
        .join('');
    const projectRows = analytics.topProjects
        .map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${p.mentions}</td></tr>`)
        .join('');
    const feedbackRate = analytics.feedbackStats.totalRated > 0
        ? Math.round((analytics.feedbackStats.helpful / analytics.feedbackStats.totalRated) * 100)
        : 0;
    const content = `
    <h1>Analytics</h1>

    <div class="grid grid-3">
      <div class="card stat">
        <div class="stat-value">${analytics.totalBriefings}</div>
        <div class="stat-label">Total Briefings</div>
      </div>
      <div class="card stat">
        <div class="stat-value">${analytics.averageCardsPerBriefing}</div>
        <div class="stat-label">Avg Cards/Briefing</div>
      </div>
      <div class="card stat">
        <div class="stat-value">${analytics.streak.current}</div>
        <div class="stat-label">Current Streak</div>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h2>Briefings by Month</h2>
        <table>
          <thead><tr><th>Month</th><th></th><th>Count</th></tr></thead>
          <tbody>${monthlyChart || '<tr><td colspan="3" class="muted">No data yet</td></tr>'}</tbody>
        </table>
      </div>

      <div class="card">
        <h2>Card Types</h2>
        <table>
          <thead><tr><th>Type</th><th>Count</th></tr></thead>
          <tbody>${cardTypeRows || '<tr><td colspan="2" class="muted">No data yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h2>Top Projects</h2>
        <table>
          <thead><tr><th>Project</th><th>Mentions</th></tr></thead>
          <tbody>${projectRows || '<tr><td colspan="2" class="muted">No projects tracked yet</td></tr>'}</tbody>
        </table>
      </div>

      <div class="card">
        <h2>Feedback</h2>
        <div class="stat">
          <div class="stat-value">${feedbackRate}%</div>
          <div class="stat-label">Helpful Rating</div>
        </div>
        <p class="muted">
          ${analytics.feedbackStats.helpful} helpful /
          ${analytics.feedbackStats.notHelpful} not helpful /
          ${analytics.feedbackStats.snoozed} snoozed
        </p>
        <p class="muted">Longest streak: ${analytics.streak.longest} days</p>
      </div>
    </div>
  `;
    return baseTemplate('Analytics', content, 'analytics');
}
export function renderSearchResultsPage(query, results) {
    const briefingItems = results
        .map((b) => {
        const date = new Date(b.date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
        const matchingCards = b.cards.filter((card) => card.title.toLowerCase().includes(query.toLowerCase()) ||
            card.content.toLowerCase().includes(query.toLowerCase()));
        const cardBadges = matchingCards
            .slice(0, 4)
            .map((card) => {
            const style = CARD_TYPE_LABELS[card.type] || CARD_TYPE_LABELS.project_continuity;
            return `<span class="badge" style="background:${style.color}22;color:${style.color}">${style.label}</span>`;
        })
            .join('');
        return `
        <a href="/briefing/${b.id}" class="briefing-item">
          <span class="briefing-date">${date}</span>
          <div class="briefing-cards">${cardBadges}</div>
        </a>
      `;
    })
        .join('');
    const content = `
    <p class="muted"><a href="/">&larr; Back to briefings</a></p>
    <h1>Search Results</h1>
    <input type="search" class="search-box" placeholder="Search briefings..."
           value="${escapeHtml(query)}"
           onkeyup="if(event.key==='Enter')location.href='/search?q='+encodeURIComponent(this.value)">
    ${results.length === 0 ? `<p class="muted">No briefings found matching "${escapeHtml(query)}"</p>` : `<p class="muted">${results.length} result${results.length === 1 ? '' : 's'} found</p>${briefingItems}`}
  `;
    return baseTemplate(`Search: ${query}`, content, 'briefings');
}
export function renderConfigPage(config) {
    const configYaml = JSON.stringify(config, null, 2);
    const content = `
    <h1>Configuration</h1>
    <div class="card">
      <h2>Current Config</h2>
      <p class="muted">Edit ~/.cpulse/config.yaml to change settings</p>
      <pre><code>${escapeHtml(configYaml)}</code></pre>
    </div>

    <div class="card">
      <h2>Data Sources</h2>
      <table>
        <tr>
          <td>Claude Code</td>
          <td>${config.sources.claude_code.enabled ? '<span style="color:#059669">Enabled</span>' : '<span class="muted">Disabled</span>'}</td>
        </tr>
        <tr>
          <td>GitHub</td>
          <td>${config.sources.github.enabled ? '<span style="color:#059669">Enabled</span>' : '<span class="muted">Disabled</span>'}</td>
        </tr>
      </table>
    </div>

    <div class="card">
      <h2>Preferences</h2>
      <table>
        <tr><td>Article Style</td><td>${config.preferences.article_style}</td></tr>
        <tr><td>Max Cards</td><td>${config.preferences.max_cards}</td></tr>
        <tr><td>Focus Topics</td><td>${config.preferences.focus_topics.join(', ') || 'None'}</td></tr>
        <tr><td>Ignored Topics</td><td>${config.preferences.ignored_topics.join(', ') || 'None'}</td></tr>
      </table>
    </div>

    <div class="card">
      <h2>Email Settings</h2>
      <table>
        <tr><td>Recipient</td><td>${escapeHtml(config.email.to || 'Not configured')}</td></tr>
        <tr><td>Send Time</td><td>${config.email.send_time} (${config.email.timezone})</td></tr>
        <tr><td>SMTP Host</td><td>${escapeHtml(config.email.smtp.host)}</td></tr>
      </table>
    </div>
  `;
    return baseTemplate('Configuration', content, 'config');
}
//# sourceMappingURL=templates.js.map