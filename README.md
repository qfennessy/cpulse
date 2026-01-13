# Commit Pulse

Personal daily briefings from your Claude Code sessions and GitHub activity.

Commit Pulse analyzes your development activity over the past week and generates concise, actionable briefings delivered to your email each morning.

## Inspiration

This was inspired by ChatGPT Pulse. As of 13 Jan 2026, Pulse is only available to ChatGPT Pro subscribers ($200/month)

## Features

- **Claude Code Integration**: Parses your Claude Code session logs to identify projects worked on, open todos, and unresolved errors
- **GitHub Integration**: Summarizes commits, open PRs, review requests, and stale branches
- **AI-Powered Summaries**: Uses Claude to synthesize activity into actionable insights
- **Advisory Cards**: Stack-aware technical advice, challenge insights, and cost optimization tips
- **Email Delivery**: Sends styled HTML briefings via SMTP (works with Gmail, Fastmail, etc.)
- **Indefinite History**: Stores all briefings locally for future reference

## Requirements

- Node.js 18.x or later
- Anthropic API key
- GitHub personal access token
- SMTP credentials (e.g., Gmail app password)

## Installation

### Option 1: Clone and Install Globally

```bash
git clone https://github.com/qfennessy/cpulse.git
cd cpulse
npm install

# Install to ~/.cpulse/bin/ for global use
node dist/cli.js install
```

After installation, add to your shell config (~/.zshrc or ~/.bashrc):

```bash
# Alias for cpulse command
alias cpulse='node ~/.cpulse/bin/cli.js'

# Man page access
export MANPATH="$HOME/.cpulse/man:$MANPATH"
```

Then you can use `man cpulse` for documentation.

### Option 2: Run from Source

```bash
git clone https://github.com/qfennessy/cpulse.git
cd cpulse
npm install
npm run cpulse -- --help
```

## Configuration

1. Create the config file:

```bash
cpulse init
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
  enabled_cards:
    project_continuity: true
    code_review: true
    open_questions: true
    patterns: true
    post_merge_feedback: true
    tech_advisory: true
    challenge_insights: true
    cost_optimization: true
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

### Generate Briefings

```bash
# Preview what signals would be collected (no API calls to Claude)
cpulse preview

# Generate a briefing and print to stdout
cpulse generate --preview

# Generate and send briefing via email
cpulse generate

# Generate all card types regardless of weekly rotation
cpulse generate --all-cards --preview

# View briefing history and stats
cpulse history

# Show current configuration
cpulse config
```

### Generate Options

| Option | Description |
|--------|-------------|
| `--hours <n>` | Hours of history to analyze (default: 168 = 7 days) |
| `--preview` | Print to stdout instead of sending email |
| `--all-cards` | Generate all card types, bypassing weekly rotation |
| `--simple` | Use simple formatting without narrative transitions |
| `--no-send` | Generate but don't send email |
| `--no-save` | Generate but don't save to history |

### Manage Card Types

```bash
# List all card types and their schedules
cpulse cards

# See help for enabling/disabling cards
cpulse cards enable <card-type>
cpulse cards disable <card-type>
```

### Other Commands

```bash
# Show development patterns from sessions
cpulse patterns

# Show open questions from sessions
cpulse questions

# Submit feedback for the latest briefing
cpulse feedback <card-index> <helpful|not_helpful|snoozed>

# Show feedback statistics
cpulse feedback-stats

# Set topic priority
cpulse priority <topic> <high|normal|low|ignored>

# Show current topic priorities
cpulse priorities

# Show memory context status
cpulse memory

# Start the web dashboard
cpulse serve --port 3000
```

## Installation Command

Install cpulse to `~/.cpulse/bin/` for use outside the source directory:

```bash
# Install or update (only copies changed files)
cpulse install

# Force reinstall of npm dependencies
cpulse install --force

# Also symlink to /usr/local/bin and /usr/local/share/man (requires sudo)
sudo cpulse install --link
```

The install command uses incremental updates - only changed files are copied, and npm dependencies are only reinstalled when package.json changes or `--force` is used.

## Scheduling

To receive daily briefings, add a cron job:

```bash
crontab -e
```

Add:

```
0 6 * * * node ~/.cpulse/bin/cli.js generate >> ~/.cpulse/cron.log 2>&1
```

## Card Types

Commit Pulse generates several types of briefing cards:

### Daily Cards

| Card | Description |
|------|-------------|
| **Project Continuity** | What you worked on, files modified, open todos, suggested next steps |
| **Code Review** | Recent commits, open PRs, review requests, stale branches |
| **Open Questions** | Unresolved questions from Claude Code sessions |
| **Patterns** | Development patterns and habits from your sessions |
| **Post-Merge Feedback** | Comments added to PRs after they were merged |

### Weekly Advisory Cards

| Card | Schedule | Description |
|------|----------|-------------|
| **Challenge Insights** | Mon/Tue | PR review patterns analysis with preventive guidance |
| **Tech Advisory** | Wed/Thu | Stack-aware architectural advice with code examples |
| **Cost Optimization** | Friday | GCP-focused cost saving recommendations |

Use `--all-cards` to generate all card types regardless of the day.

## Privacy

- All data stays local (in `~/.cpulse/`)
- Only extracted signals are sent to Claude API, not full conversation logs
- GitHub token is stored locally or in environment variables
- You can audit what's sent by running `cpulse preview`

## License

MIT
