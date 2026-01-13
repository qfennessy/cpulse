# Commit Pulse (cpulse) Design Document

**Created:** 2026-01-12
**Last Updated:** 2026-01-13

**Status:** Phase 6 implementation complete

---

## Overview

Commit Pulse (cpulse) is a personal briefing system that generates thoughtful, actionable articles based on your interactions with Claude, Claude Code sessions, and GitHub activity. Like ChatGPT Pulse, it synthesizes your activity overnight and delivers personalized insights via email each morning.

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
Given the user's last 10 GitHub commits to the Commit Pulse repository,
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
## Project Continuity: Commit Pulse Authentication

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

**Post-Merge PR Comments:**
- Detect comments added to PRs after they are merged
- Highlight these in briefings as "post-merge feedback" requiring attention
- Particularly useful for cocos-story where reviews may come after merge
- Link directly to the comment thread
- Track which post-merge comments have been acknowledged

**Web Interface:**
- Configuration editor with live preview
- Briefing history browser with search
- Mobile-friendly responsive design
- Calendar integration for scheduling follow-ups

**Analytics:**
- Briefing engagement metrics
- Topic trend analysis over time
- Feedback pattern visualization

### Phase 5: Project Memory & Proactive Intelligence

**Inspired by ChatGPT Pulse**, this phase goes beyond memory to provide proactive technical research, architecture suggestions, and actionable guidance tailored to your projects.

#### 5.1 Memory System

**Memory Files:**
- `~/.cpulse/memory.md` - global context across all projects
- Per-project `docs/memory.md` - auto-discovered from git repos
- Memory contents:
  - Tech stack and architecture decisions
  - Team workflows and conventions (PRs to develop, AI code review)
  - Domain terminology (genealogy, family storytelling)
  - Known pain points and active priorities
  - Related projects and dependencies

**Memory Management:**
- CLI: `cpulse memory [show|edit|suggest]`
- Web interface with preview
- Auto-suggest additions from repeated session patterns
- Version tracking (when context was added/updated)

#### 5.2 Proactive Technical Research

**The key insight from ChatGPT Pulse:** Don't just summarize what happened—research and suggest what should happen next.

**Tech Stack Awareness:**
- Monitor for new versions/features in your stack (Next.js, Firebase, Gemini, etc.)
- Surface relevant updates: "Gemini 2.5 Flash now supports streaming function call args—this could improve your interviewer service latency"
- Alert when dependencies have security updates or breaking changes

**Pattern Library:**
- Build a library of patterns relevant to your stack
- Suggest patterns when session activity indicates a need:
  - Working on pagination? → Suggest cursor-safe Firestore patterns
  - Adding scheduled jobs? → Surface Cloud Scheduler best practices
  - Building extraction pipelines? → Recommend structured output approaches

**Production Readiness:**
- Generate checklists based on what you're building:
  - New Firestore queries → Index requirements checklist
  - New Cloud Functions → Retry/idempotency checklist
  - New API endpoints → Security rules alignment check

#### 5.3 Architecture Suggestions

**Proactive Design Guidance (like ChatGPT Pulse Example 1):**
- When you add new queries, suggest composite indexes needed
- When you modify data models, flag potential migration needs
- When you add new collections, remind about tenantId-first indexing rule

**Example Card - Production Checklist:**
```
## Production Readiness: stories pagination

You added a new query in `apps/web/lib/stories.ts`:
`where("tenantId", "==", tid), where("personIds", "array-contains", pid), orderBy("createdAt", "desc")`

**Index required:** This query needs a composite index. Add to `firestore.indexes.json`:
{
  "collectionGroup": "stories",
  "fields": [
    { "fieldPath": "tenantId", "order": "ASCENDING" },
    { "fieldPath": "personIds", "arrayConfig": "CONTAINS" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}

**Pagination check:** Your cursor uses `createdAt` alone. If collisions are possible,
add `orderBy("__name__", "desc")` for stability.
```

#### 5.4 Implementation Patterns

**Delta Caching Pattern (from ChatGPT Pulse Example 2):**
- When building slow queries, suggest caching strategies
- Provide skeleton/placeholder patterns for perceived performance
- Include code examples tailored to your stack (Redis + FastAPI or Firestore)

**Example Card - Performance Pattern:**
```
## Suggestion: Delta Caching for Person Timeline

Your Person Timeline queries are averaging 2.3s. Consider delta caching:

1. **Cache skeleton:** Store outline (decades, section headers) with placeholders
2. **Instant render:** Show skeleton immediately on repeat queries
3. **Parallel fetch:** Load fresh events/facts in background
4. **Patch in:** Stream updates to replace placeholders

Cache key: `sha256(personId + dateRange + viewType + locale)`
TTL: 7 days or until GEDCOM import version changes

This pattern fits your existing Firestore + FastAPI stack. Want a code snippet?
```

#### 5.5 Extraction Pipeline Intelligence (from ChatGPT Pulse Example 3)

**For interviewer service specifically:**
- Track Gemini/Vertex AI updates relevant to entity extraction
- Suggest structured output improvements over prompt parsing
- Recommend validation patterns (Zod/Pydantic) for schema enforcement
- Alert when new function calling features could improve accuracy

**Example Card - Tech Update:**
```
## Tech Alert: Gemini 2.5 Flash Improvements

Relevant to your interviewer service extraction pipeline:

**Streaming function args:** Now supported—could reduce time-to-first-token
for entity extraction responses.

**Structured outputs:** JSON Schema enforcement is now first-class. Your current
prompt-based parsing in `extract_entities()` could be replaced with schema-driven
extraction for higher reliability.

**Recommendation:** Consider migrating from free-form extraction to:
- Define Person/Relationship/Event schemas in Pydantic
- Use `response_schema` parameter instead of parsing
- Add Zod validation at the TypeScript boundary

This aligns with your existing contract test pattern between Python and TypeScript.
```

#### 5.6 Cross-Project Intelligence

**Pattern Transfer:**
- "You implemented cursor pagination well in cocos-story—cpulse briefing history could use the same pattern"
- "The retry logic in interviewer service would improve cpulse's GitHub API calls"

**Dependency Awareness:**
- "@repo/types changed → Python contract tests may need updates"
- "Firebase SDK updated in apps/web → check services/functions compatibility"

#### 5.7 New Card Types

| Card Type | Purpose | Trigger |
|-----------|---------|---------|
| **Production Checklist** | Index, security, idempotency checks | New queries/functions detected |
| **Tech Update** | Relevant new features in your stack | Version monitoring |
| **Pattern Suggestion** | Design patterns for current work | Session activity analysis |
| **Architecture Reminder** | Surface relevant past decisions | Patterns suggest drift |
| **Convention Check** | Flag potential violations | Code changes conflict with docs |
| **Cross-Project Insight** | Apply learnings across repos | Similar patterns detected |

#### 5.8 Implementation Approach

**Data Flow:**
```
Memory Files + Session Activity + GitHub Activity
           ↓
    Context Analysis
           ↓
   Pattern Matching (what are you building?)
           ↓
   Research Generation (what should you know?)
           ↓
   Card Generation (actionable guidance)
```

**Research Sources:**
- Project memory files (architecture, conventions)
- Tech stack documentation (cached/indexed)
- Recent session patterns (what problems are you solving?)
- GitHub activity (what's changing in the codebase?)

**Prompt Strategy:**
- Include relevant memory context
- Describe current work patterns detected
- Ask for specific, actionable suggestions
- Request code examples in the user's stack

### Phase 4: Feedback & Analytics

- Post-merge feedback tracking
- Web dashboard for briefing history
- Feedback-derived priority adjustment
- User preference persistence
- Analytics on briefing engagement

### Phase 5: Memory System

- Project-aware briefings with memory files
- Memory file discovery (docs/memory.md, memory.md, ~/.cpulse/memory.md)
- Proactive intelligence based on project context
- Pattern recognition across sessions
- Memory context injection into article generation
- Collision-safe project memory lookup

### Phase 6: Intelligent Advisory

- **Card configurability** - Enable/disable card types in config.yaml
- **Tech Advisory card** (Wed/Thu) - Stack-aware architectural advice with web search trends
- **Challenge Insights card** (Mon/Tue) - PR review pattern analysis with preventive guidance
- **Cost Optimization card** (Friday) - GCP-focused cost saving recommendations
- Weekly rotation for advisory cards to avoid repetition
- Tech stack detection from package.json, requirements.txt, go.mod, etc.
- Web search integration for current best practices (7-day cache)
- `cpulse cards` CLI command for managing card types

---

## Future Considerations

Items explicitly deferred for potential future implementation:

- **Claude.ai conversation integration** - Add as data source when official API becomes available
- **Multi-machine sync** - Aggregate Claude Code logs across machines if workflow requires it
- **On-demand briefings** - Trigger briefings outside the daily schedule
- **Memory learning** - Auto-extract and suggest memory entries from session patterns

---

## Success Metrics

- User opens email > 80% of mornings
- Average rating across cards > 3.5/5
- At least one card marked "Helpful" per briefing
- User takes action on suggested items > 30% of the time
