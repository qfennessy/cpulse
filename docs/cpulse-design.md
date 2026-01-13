# cpulse Design Document

**Created:** 2026-01-12
**Last Updated:** 2026-01-12

**Status:** Design approved

---

## Overview

cpulse is a personal briefing system that generates thoughtful, actionable articles based on your interactions with Claude, Claude Code sessions, and GitHub activity. Like ChatGPT Pulse, it synthesizes your activity overnight and delivers personalized insights via email each morning.

The briefings are presented in Claude Code's communication style: concise, direct, technically accurate, and formatted in clean markdown.

---

## Goals

1. Surface patterns and insights from your AI-assisted development work
2. Remind you of unfinished tasks, open questions, and pending decisions
3. Highlight code changes that may need follow-up (tests, docs, refactoring)
4. Suggest next steps based on recent context
5. Keep you oriented on multi-day or multi-session projects

---

## Data Sources

### 1. Claude Code Sessions

- **Source:** Claude Code conversation logs (`~/.claude/` directory)
- **Signals extracted:**
  - Files modified and why
  - Commands run
  - Errors encountered and how they were resolved
  - Todo items created/completed
  - Patterns in tool usage
  - Projects actively worked on

### 2. GitHub Activity

- **Source:** GitHub API (commits, PRs, issues, comments)
- **Signals extracted:**
  - Recent commits and their messages
  - PR status (open, merged, needs review)
  - Review comments received
  - Issues assigned or created
  - Branches with stale work

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Data Collection                          │
├─────────────────────────────────┬───────────────────────────────┤
│        Claude Code Logs         │          GitHub API           │
│          (~/.claude/)           │        (commits, PRs)         │
└────────────────┬────────────────┴───────────────┬───────────────┘
                 │                                │
                 ▼                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Signal Extraction                          │
│  - Topic identification                                         │
│  - Activity summarization                                       │
│  - Open item detection                                          │
│  - Pattern recognition                                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Context Store                               │
│  - User profile & preferences                                   │
│  - Historical briefings                                         │
│  - Feedback signals (thumbs up/down)                            │
│  - Curated topic priorities                                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Article Generation                            │
│  - Claude API for synthesis                                     │
│  - Internal research prompts                                    │
│  - Card/section formatting                                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Email Delivery                             │
│  - Daily digest (configurable time)                             │
│  - HTML email with markdown rendering                           │
│  - Inline feedback buttons                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Article Types

Each daily briefing consists of multiple "cards" or sections. The system generates whichever are relevant:

### 1. Project Continuity

**Purpose:** Help you pick up where you left off.

- What you were working on yesterday
- Files you modified but may not have finished
- Claude Code sessions that ended mid-task
- Open todo items from previous sessions

### 2. Code Review Digest

**Purpose:** Surface commits and changes that need attention.

- Recent commits summarized by intent (not just commit messages)
- Potential issues: missing tests, large diffs, TODO comments added
- PRs awaiting review or needing your response
- Review comments you haven't addressed

### 3. Learning & Concepts

**Purpose:** Reinforce things you've been exploring.

- Topics you asked Claude about recently
- Concepts that came up multiple times (spaced repetition opportunity)
- Links to documentation you might want to revisit
- Patterns in your questions (e.g., "You've asked about TypeScript generics 4 times this week")

### 4. Open Questions

**Purpose:** Track decisions and questions that weren't resolved.

- Questions you asked but conversation ended before resolution
- Architectural decisions marked as "TBD" or "decide later"
- Error messages you encountered but may not have fully debugged

### 5. Suggestions

**Purpose:** Proactive recommendations based on patterns.

- "You've been working on X for 3 days—consider writing documentation"
- "Your test coverage in module Y decreased this week"
- "You have 5 stale branches older than 2 weeks"
- "Based on your recent commits, you might want to look into Z"

---

## Generation Process

### Nightly Pipeline (runs at configurable time, default 4am)

1. **Collect:** Pull latest data from all sources
2. **Extract:** Identify signals and patterns from raw data
3. **Prioritize:** Rank topics by relevance (recency, frequency, user feedback)
4. **Generate:** Use Claude API to synthesize articles for each relevant card type
5. **Format:** Render as email-friendly HTML with markdown styling
6. **Deliver:** Send via configured email provider

### Internal Prompting

The system generates internal prompts based on extracted signals. Conceptual examples:

```
Given the user's Claude Code session from yesterday where they worked on
authentication middleware but the session ended with failing tests,
generate a "Project Continuity" card that:
- Summarizes what they were trying to accomplish
- Notes the specific test failures
- Suggests concrete next steps
```

```
Given the user's last 10 GitHub commits to the cpulse repository,
generate a "Code Review Digest" that:
- Groups commits by feature/intent
- Flags any commits without corresponding tests
- Notes any TODO comments introduced
```

---

## User Controls

### Feedback Mechanisms

- **Thumbs up/down:** On each card, indicating usefulness
- **"More like this":** Request more coverage of a topic
- **"Less of this":** Deprioritize a topic type
- **Snooze:** Hide a topic for N days

### Curation

- **Focus topics:** Explicitly request coverage of specific topics
- **Ignore patterns:** Exclude certain repos, file types, or topics
- **Priority projects:** Weight certain repositories higher

### Configuration

```yaml
# ~/.cpulse/config.yaml
email:
  to: quentin@example.com
  from: quentin@example.com
  send_time: "06:00"
  timezone: "America/Los_Angeles"
  smtp:
    host: smtp.gmail.com
    port: 587
    secure: false  # true for 465, false for other ports
    auth:
      user: quentin@example.com
      pass: app-password-here  # Use app password, not account password

sources:
  claude_code:
    enabled: true
    log_path: ~/.claude/
  github:
    enabled: true
    repos:
      - owner/repo1
      - owner/repo2
    include_private: true

preferences:
  article_style: "concise"  # or "detailed"
  max_cards: 5
  focus_topics: []
  ignored_topics: []
```

---

## Email Format

The email is rendered as clean HTML that degrades gracefully to plain text. Each card is visually distinct with:

- Clear heading
- Concise body (2-5 sentences typical)
- Bullet points for actionable items
- Code snippets where relevant (syntax highlighted)
- Inline feedback buttons

Example card (Phase 1-2, plain):

```
## Project Continuity: cpulse Authentication

Yesterday you worked on JWT token validation in `src/auth/validate.ts`.
The session ended with two failing tests in `auth.test.ts`:

- `should reject expired tokens` - assertion on line 42
- `should handle malformed tokens` - timeout after 5000ms

Next steps:
- Check if the token expiry logic handles edge cases around midnight UTC
- The timeout suggests an unresolved promise—look for missing `await`

[Helpful] [Not helpful] [Snooze this project]
```

Example card (Phase 3, with links and narrative):

```
Let's pick up where you left off with authentication...

## Project Continuity: cpulse Authentication

Yesterday you worked on JWT token validation in [src/auth/validate.ts:15](https://github.com/owner/cpulse/blob/main/src/auth/validate.ts#L15).
The session ended with two failing tests in [auth.test.ts](https://github.com/owner/cpulse/blob/main/tests/auth.test.ts):

- `should reject expired tokens` - [line 42](https://github.com/owner/cpulse/blob/main/tests/auth.test.ts#L42)
- `should handle malformed tokens` - timeout after 5000ms

Related: Your PR [#47](https://github.com/owner/cpulse/pull/47) is still open and has 2 new comments.

Next steps:
- Check if the token expiry logic handles edge cases around midnight UTC
- The timeout suggests an unresolved promise—look for missing `await`
- Address review comments on PR #47

[👍 Helpful] [👎 Not helpful] [💤 Snooze]
```

---

## Technical Stack (Proposed)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js / TypeScript | Matches Claude Code ecosystem |
| Scheduler | node-cron or system cron | Simple, reliable |
| Claude API | @anthropic-ai/sdk | Article generation |
| GitHub API | Octokit | Commit/PR data |
| Email | SMTP (nodemailer) | Uses existing email account, no third-party signup |
| Storage | SQLite or JSON files | Simple, local-first |
| Config | YAML | Human-readable |

---

## Privacy Considerations

- All data stays local by default (no cloud sync)
- Claude API calls send only extracted signals, not full conversation history
- GitHub tokens are stored securely (keychain or encrypted config)
- User can audit exactly what data is sent in each API call
- Option to run entirely offline with cached context

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Claude.ai conversations | Deferred | No official API available yet; will add as data source when API exists |
| Briefing frequency | Daily batch only | Keeps complexity low; morning email is the primary use case |
| Multi-machine support | Single machine | Simplifies initial implementation; can revisit if needed |
| Briefing retention | Indefinite | Historical briefings provide value for pattern analysis and reference |
| Email delivery | SMTP via nodemailer | Uses existing email account; no third-party service signup required |

---

## Implementation Phases

### Phase 1: Core Pipeline

- GitHub integration (commits, PRs)
- Claude Code log parsing
- Basic article generation (Project Continuity, Code Review Digest)
- Email delivery

### Phase 2: Intelligence

- Pattern recognition across sessions
- Open question tracking
- Feedback loop integration
- Curated topic priorities

### Phase 3: Enhanced Presentation

**Worktree Recognition:**
- Detect git worktrees and associate with parent project
- Example: `cocos-story-gemini-live` → parent `cocos-story`
- Detection methods:
  - Parse `.git` file (worktrees have a file, not a directory, pointing to main repo)
  - Check `git worktree list` output
  - Fall back to naming convention heuristics (prefix matching)
- Aggregate patterns across all worktrees of a project
- Show worktree activity grouped under main project in briefings
- Link to correct branch/worktree in GitHub URLs

**Clickable Links & Deep Links:**
- GitHub PR links: `repo#123` → `https://github.com/owner/repo/pull/123`
- Commit links: `abc1234` → `https://github.com/owner/repo/commit/abc1234`
- File links: `src/auth.ts:42` → GitHub blob view at specific line
- Branch links: direct to compare view for stale branches
- Session references: link to local session transcript if available

**Narrative Transitions (inspired by ChatGPT Pulse):**
- Contextual intro text connecting card groups thematically
- Example: "After yesterday's auth work, here's what needs attention today..."
- Smooth transitions between related cards
- Summary closings with prioritized action items

**Card Grouping & Theming:**
- Group related cards by project or theme
- Visual distinction between card types
- Priority indicators (urgent, normal, FYI)

**HTML Email Template:**
- Clean, responsive design for email clients
- Syntax-highlighted code blocks
- Collapsible sections for detailed content
- Inline feedback buttons (thumbs up/down)
- Dark mode support

**New Card Types:**
- Learning & Concepts with spaced repetition
- Proactive suggestions based on patterns
- Weekly summary roll-up

### Phase 4: Advanced Features

- Web interface for configuration and history
- Briefing search and analytics
- Mobile-friendly web view for briefings
- Calendar integration for scheduling follow-ups

---

## Future Considerations

Items explicitly deferred for potential future implementation:

- **Claude.ai conversation integration** - Add as data source when official API becomes available
- **Multi-machine sync** - Aggregate Claude Code logs across machines if workflow requires it
- **On-demand briefings** - Trigger briefings outside the daily schedule

---

## Success Metrics

- User opens email > 80% of mornings
- Average rating across cards > 3.5/5
- At least one card marked "Helpful" per briefing
- User takes action on suggested items > 30% of the time
