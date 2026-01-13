# cpulse

Personal daily briefings from your Claude Code sessions and GitHub activity.

cpulse analyzes your development activity over the past week and generates concise, actionable briefings delivered to your email each morning.

## Features

- **Claude Code Integration**: Parses your Claude Code session logs to identify projects worked on, open todos, and unresolved errors
- **GitHub Integration**: Summarizes commits, open PRs, review requests, and stale branches
- **AI-Powered Summaries**: Uses Claude to synthesize activity into actionable insights
- **Email Delivery**: Sends styled HTML briefings via SMTP (works with Gmail, Fastmail, etc.)
- **Indefinite History**: Stores all briefings locally for future reference

## Requirements

- Node.js 20.x
- Anthropic API key
- GitHub personal access token
- SMTP credentials (e.g., Gmail app password)

## Installation

```bash
git clone https://github.com/qfennessy/cpulse.git
cd cpulse
npm install
npm run build
```

## Configuration

1. Create the config file:

```bash
npm run cpulse -- init
```

2. Edit `~/.cpulse/config.yaml`:

```yaml
email:
  to: you@example.com
  from: you@example.com
  send_time: "06:00"
  timezone: "America/Los_Angeles"
  smtp:
    host: smtp.gmail.com
    port: 587
    secure: false
    auth:
      user: you@example.com
      pass: your-app-password

sources:
  claude_code:
    enabled: true
    log_path: ~/.claude/
  github:
    enabled: true
    repos: []  # Empty = all accessible repos
    include_private: true

preferences:
  article_style: concise
  max_cards: 5
```

3. Set permissions:

```bash
chmod 700 ~/.cpulse
chmod 600 ~/.cpulse/config.yaml
```

4. Set environment variables (alternative to config file):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...
```

## Usage

```bash
# Preview what signals would be collected (no API calls to Claude)
npm run preview

# Generate a briefing and print to stdout
npm run cpulse -- generate --preview

# Generate and send briefing via email
npm run cpulse -- generate

# View briefing history and stats
npm run cpulse -- history

# Show current configuration
npm run cpulse -- config
```

### Options

- `--hours <n>`: Hours of history to analyze (default: 168 = 7 days)
- `--no-send`: Generate but don't send email
- `--no-save`: Generate but don't save to history
- `--preview`: Print to stdout instead of sending

## Scheduling

To receive daily briefings, add a cron job:

```bash
crontab -e
```

Add:

```
0 6 * * * cd /path/to/cpulse && node dist/cli.js generate >> ~/.cpulse/cron.log 2>&1
```

## Article Types

cpulse generates two types of briefing cards:

### Project Continuity

- What you worked on recently
- Files modified
- Open todos from Claude Code sessions
- Suggested next steps

### Code Review

- Recent commits grouped by intent
- Open PRs needing attention
- Review requests waiting on you
- Stale branches (>14 days)

## Privacy

- All data stays local (in `~/.cpulse/`)
- Only extracted signals are sent to Claude API, not full conversation logs
- GitHub token is stored locally or in environment variables
- You can audit what's sent by running `npm run preview`

## License

MIT
