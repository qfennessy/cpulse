# Commit Pulse Features

*Last updated: 2026-01-13*

This document provides detailed documentation of Commit Pulse's features and how they help you stay oriented on your development work.

---

## Table of Contents

- [Actionable Daily Briefings](#actionable-daily-briefings)
- [Smart Signal Collection](#smart-signal-collection)
- [Briefing Cards](#briefing-cards)
- [Terminal Preview](#terminal-preview)
- [Web Dashboard](#web-dashboard)
- [Memory System](#memory-system)
- [Email Presentation](#email-presentation)
- [Installation](#installation)

---

## Actionable Daily Briefings

Every briefing ends with a structured closing section designed to get you coding immediately.

### Start Here

The single most important action is highlighted at the top of the closing section:

```
**Start Here:**
→ Address critical feedback on repo#42: Security fix needed
  [Open in browser](https://github.com/...)
  _Contains security indicator_
```

The "Start Here" item is selected based on priority:
1. **Critical post-merge comments** - Code is already in production
2. **Blockers** - Something is preventing progress
3. **Review requests** - You're blocking someone else
4. **Recurring todos** - Items that keep appearing across sessions

### Priority Actions

Up to 4 additional actions ranked by importance:

```
**Priority Actions:**
1. Review repo#123: Add auth middleware ([link])
2. Unblock: waiting on API team review
3. Complete: implement rate limiting
4. Reply to question on repo#45
```

Each item includes a direct link when available.

### Quick Wins

Small tasks that can be completed in under 15 minutes:

```
**Quick Wins (< 15 min):**
- Fix typo in README
- Address suggestion: consider using const here
- Address 2 comments on your PR #78
```

Quick wins are identified by:
- Short todo descriptions (< 100 characters)
- Keywords like "typo", "rename", "fix lint", "add import"
- Post-merge suggestions (non-critical feedback)
- PRs with few comments to address

---

## Smart Signal Collection

### Todo Tracking with Context

Todos extracted from Claude Code sessions now include rich context:

| Field | Description |
|-------|-------------|
| `content` | The todo text |
| `status` | pending, in_progress, or completed |
| `project` | Which project the todo belongs to |
| `relatedFiles` | Files that were being modified when the todo was created |
| `occurrenceCount` | How many sessions this todo has appeared in |
| `firstSeen` / `lastSeen` | When the todo first appeared and was last seen |

**Recurring todos** (appearing in 2+ sessions) are highlighted as they indicate important unfinished work.

### Blocker Detection

The system scans your session messages for blocking patterns:

- "blocked by X"
- "waiting on X"
- "depends on X"
- "can't proceed until X"
- "stuck on X"

Detected blockers are surfaced as high-priority action items.

### PR Urgency Tracking

Every open PR is analyzed for urgency:

| Age | Urgency Level |
|-----|---------------|
| 0-3 days | Low |
| 4-7 days | Medium |
| 8-14 days | High |
| 14+ days | Critical |

PRs with many comments (> 5) are also flagged as critical.

**Review Request Aging**: When you're requested to review a PR, the system tracks how long you've been blocking the author.

### Post-Merge Comment Severity

Comments added to PRs *after* they're merged are classified:

| Severity | Indicators | Action |
|----------|------------|--------|
| **Critical** | security, bug, crash, urgent, breaking | Create hotfix immediately |
| **Question** | Contains `?`, starts with why/how/what | Reply to comment |
| **Suggestion** | nit, minor, consider, future | Add to backlog |
| **Info** | General feedback | No action required |

Critical post-merge comments are always surfaced first since the code is already in production.

---

## Briefing Cards

### Daily Cards

#### Project Continuity
Summarizes your Claude Code sessions:
- Projects and worktrees you worked on
- Files modified across sessions
- Open todos with file context
- Suggested next steps

#### Code Review
GitHub activity summary:
- Recent commits grouped by intent
- Open PRs with urgency indicators
- Review requests waiting on you
- Stale branches (> 14 days)

#### Open Questions
Unresolved questions from your sessions:
- Grouped by project
- Prioritized by importance
- Filtered to exclude resolved items

#### Patterns (Prescriptive)
Development insights with **specific recommendations**:

Instead of: *"You edited config.ts 12 times"*

Now generates: *"config.ts has high edit frequency. Consider extracting configuration into smaller, focused modules to reduce churn."*

The patterns card always ends with a concrete "try this today" action.

#### Post-Merge Feedback
Comments on merged PRs that need attention:
- Grouped by PR
- Shows time since merge
- Severity classification
- Direct links to comments

---

## Terminal Preview

Preview briefings directly in your terminal with ANSI color formatting:

```bash
cpulse generate --preview
```

The terminal output includes:
- **Color-coded card labels** (Project=red, Code Review=green, etc.)
- **Bold text** for headers and emphasis
- **Cyan highlighting** for inline code
- **Blue underlined links** with dim URLs
- **Styled bullets** and numbered lists
- **Box-drawing separators** between sections

Use `--simple` for plain text without narratives.

---

## Web Dashboard

Start a local web dashboard to browse briefing history:

```bash
cpulse serve              # Default: localhost:3000
cpulse serve -p 8080      # Custom port
```

Routes:
- `/` - Briefing history
- `/analytics` - Analytics dashboard
- `/config` - Configuration viewer

---

## Memory System

Provide persistent context to make briefings more relevant.

### Global Memory
Create `~/.cpulse/memory.md` for context that applies to all projects:
- Your role and team
- Common tools and workflows
- Preferences for briefing style

### Project Memory
Create `docs/memory.md` (preferred) or `memory.md` in project roots:
- Project-specific conventions
- Architecture decisions
- Team members and responsibilities

Memory files are automatically loaded during briefing generation.

```bash
cpulse memory              # Show memory status
cpulse memory --project .  # Show memory for current directory
```

---

## Email Presentation

### HTML Email Format

Briefings are delivered as styled HTML emails with:
- Clean, light theme inspired by NYT newsletters
- Color-coded card type labels
- Clickable links to PRs, commits, and files
- Feedback buttons (helpful / not helpful)
- Mobile-responsive layout (max-width 600px)

### Narrative Flow

Each briefing includes:
1. **Opening** - Time-appropriate greeting with session/commit stats
2. **Transitions** - Contextual text between cards
3. **Closing** - Actionable items (Start Here, Priority Actions, Quick Wins)

### Plain Text Fallback

A plain text version is included for email clients that don't support HTML.

---

## Configuration

### Enabling Features

All features are enabled by default. The actionable closing section appears automatically when signals are available.

### Preview Mode

Test the new features without sending email:

```bash
cpulse generate --preview
```

This prints the full briefing to stdout, including the new actionable closing section.

---

## Architecture

The feature implementation follows this data flow:

```
Signal Collection (src/sources/)
    ↓
├── Claude Code sessions → todos with context, blockers
├── GitHub API → PRs with urgency, comments with severity
    ↓
Intelligence Extraction (src/intelligence/)
    ↓
├── extractBlockers() → blocked/waiting items
├── extractActionItems() → prioritized actions
├── extractQuickWins() → small tasks
    ↓
Memory Context (src/memory/)
    ↓
├── loadGlobalMemory() → ~/.cpulse/memory.md
├── loadProjectMemory() → project-specific context
    ↓
Presentation (src/presentation/)
    ↓
├── generateClosingNarrative() → Start Here, Priority, Quick Wins
├── renderBriefingHtml() → styled email
├── renderBriefingTerminal() → ANSI-formatted terminal output
    ↓
Delivery (src/delivery/)
    ↓
├── sendBriefingEmail() → SMTP delivery
└── formatBriefingForTerminal() → --preview output
```

Key files:
- `src/types/index.ts` - Type definitions for all features
- `src/intelligence/actions.ts` - Action item extraction
- `src/intelligence/blockers.ts` - Blocker detection
- `src/presentation/narratives.ts` - Closing narrative generation
- `src/presentation/terminal.ts` - ANSI terminal formatting
- `src/memory/` - Memory system for project context

---

## Installation

### Development Install

From the cpulse source directory:

```bash
npm run link      # Build, link globally, install man page
npm run unlink    # Remove global link and man page
```

This creates a symlink so you can use `cpulse` from anywhere while developing.

### Man Page

After installation, view documentation with:

```bash
man cpulse
```

### Cron Setup

For daily morning briefings:

```bash
# Edit crontab
crontab -e

# Add line for 6 AM daily
0 6 * * * cpulse generate >> ~/.cpulse/cron.log 2>&1
```

---

## Links

- Repository: https://github.com/qfennessy/cpulse
- Issues: https://github.com/qfennessy/cpulse/issues
