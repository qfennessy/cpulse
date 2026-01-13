#!/usr/bin/env node

import { Command } from 'commander';
import {
  loadConfig,
  createDefaultConfig,
  configExists,
  getConfigPath,
  generateAndSendBriefing,
  formatBriefingAsMarkdown,
  formatBriefingWithNarratives,
  getLatestBriefing,
  getBriefingStats,
  collectSignals,
  analyzePatterns,
  formatPatternSummary,
  extractAllQuestions,
  formatQuestionsForBriefing,
  loadFeedback,
  computeFeedbackStats,
  recordBriefingFeedback,
  loadTopicPriorities,
  updateTopicPriority,
  groupByParentProject,
  createWebServer,
} from './index.js';
import type { BriefingFeedback } from './types/index.js';

const program = new Command();

function parseHours(value: string): number {
  const hours = parseInt(value, 10);
  if (isNaN(hours) || hours <= 0) {
    console.error(`Error: --hours must be a positive number, got "${value}"`);
    process.exit(1);
  }
  return hours;
}

program
  .name('cpulse')
  .description('Personal daily briefings from Claude Code sessions and GitHub activity')
  .version('0.1.0');

program
  .command('init')
  .description('Create a default configuration file')
  .action(() => {
    if (configExists()) {
      console.log(`Config already exists at ${getConfigPath()}`);
      console.log('Edit it to customize your settings.');
      return;
    }

    createDefaultConfig();
    console.log(`Created config at ${getConfigPath()}`);
    console.log('Edit this file to add your email and API credentials.');
  });

program
  .command('generate')
  .description('Generate and send a daily briefing')
  .option('--no-send', 'Generate but do not send email')
  .option('--no-save', 'Generate but do not save to history')
  .option('--hours <hours>', 'Hours of history to analyze', '168')
  .option('--preview', 'Print briefing to stdout instead of sending')
  .option('--simple', 'Use simple formatting without narratives')
  .action(async (options) => {
    try {
      // Validate hours before loading config to fail fast
      const hoursBack = parseHours(options.hours);
      const config = loadConfig();

      if (options.preview) {
        options.send = false;
      }

      const { briefing, signals } = await generateAndSendBriefing(config, {
        send: options.send,
        save: options.save,
        hoursBack,
      });

      if (options.preview || !options.send) {
        if (options.simple) {
          console.log(formatBriefingAsMarkdown(briefing));
        } else {
          console.log(formatBriefingWithNarratives(briefing, signals));
        }
      } else {
        console.log(`Briefing sent to ${config.email.to}`);
      }

      console.log(`Generated ${briefing.cards.length} cards`);
    } catch (error) {
      console.error('Error generating briefing:', error);
      process.exit(1);
    }
  });

program
  .command('preview')
  .description('Preview signals that would be used for briefing')
  .option('--hours <hours>', 'Hours of history to analyze', '168')
  .action(async (options) => {
    try {
      // Validate hours before loading config to fail fast
      const hoursBack = parseHours(options.hours);
      const config = loadConfig();
      const signals = await collectSignals(config, hoursBack);

      console.log('\n=== Claude Code Sessions ===');
      console.log(`Sessions: ${signals.claudeCode.recentSessions.length}`);
      console.log(`Active projects: ${signals.claudeCode.activeProjects.join(', ') || 'none'}`);
      console.log(`Open todos: ${signals.claudeCode.openTodos.length}`);
      for (const todo of signals.claudeCode.openTodos.slice(0, 5)) {
        console.log(`  - [${todo.status}] ${todo.content}`);
      }

      console.log('\n=== GitHub Activity ===');
      console.log(`Commits: ${signals.github.commits.length}`);
      for (const commit of signals.github.commits.slice(0, 5)) {
        console.log(`  - ${commit.repo}: ${commit.sha} ${commit.message}`);
      }
      console.log(`Open PRs: ${signals.github.pullRequests.length}`);
      for (const pr of signals.github.pullRequests.slice(0, 5)) {
        console.log(`  - ${pr.repo}#${pr.number}: ${pr.title}`);
      }
      console.log(`Stale branches: ${signals.github.staleBranches.length}`);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('history')
  .description('Show briefing history and stats')
  .action(() => {
    try {
      const config = loadConfig();
      if (!config.data_dir) {
        console.log('No data directory configured');
        return;
      }

      const stats = getBriefingStats(config.data_dir);
      console.log('\n=== Briefing Statistics ===');
      console.log(`Total briefings: ${stats.totalBriefings}`);
      console.log(`Total cards generated: ${stats.totalCards}`);
      console.log(`Feedback received: ${stats.feedbackCount}`);
      console.log(`Helpful ratings: ${stats.helpfulCount}`);

      const latest = getLatestBriefing(config.data_dir);
      if (latest) {
        console.log('\n=== Latest Briefing ===');
        console.log(`Date: ${latest.date}`);
        console.log(`Cards: ${latest.cards.length}`);
        for (const card of latest.cards) {
          console.log(`  - ${card.title} (${card.type})`);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    try {
      if (!configExists()) {
        console.log(`No config found. Run 'cpulse init' to create one.`);
        console.log(`Config path: ${getConfigPath()}`);
        return;
      }

      const config = loadConfig();
      console.log('\n=== Current Configuration ===');
      console.log(`Config file: ${getConfigPath()}`);
      console.log(`\nEmail:`);
      console.log(`  To: ${config.email.to}`);
      console.log(`  From: ${config.email.from}`);
      console.log(`  Send time: ${config.email.send_time} ${config.email.timezone}`);
      console.log(`  SMTP host: ${config.email.smtp.host}:${config.email.smtp.port}`);

      console.log(`\nSources:`);
      console.log(`  Claude Code: ${config.sources.claude_code.enabled ? 'enabled' : 'disabled'}`);
      if (config.sources.claude_code.enabled) {
        console.log(`    Log path: ${config.sources.claude_code.log_path}`);
      }
      console.log(`  GitHub: ${config.sources.github.enabled ? 'enabled' : 'disabled'}`);
      if (config.sources.github.enabled) {
        console.log(`    Repos: ${config.sources.github.repos.length > 0 ? config.sources.github.repos.join(', ') : 'all accessible'}`);
        console.log(`    Include private: ${config.sources.github.include_private}`);
      }

      console.log(`\nPreferences:`);
      console.log(`  Article style: ${config.preferences.article_style}`);
      console.log(`  Max cards: ${config.preferences.max_cards}`);

      console.log(`\nAPI Keys:`);
      console.log(`  Anthropic: ${config.anthropic_api_key ? 'configured' : 'not set (check ANTHROPIC_API_KEY env var)'}`);
      console.log(`  GitHub: ${config.sources.github.token ? 'configured' : 'not set (check GITHUB_PERSONAL_ACCESS_TOKEN env var)'}`);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('patterns')
  .description('Show development patterns from recent sessions')
  .option('--hours <hours>', 'Hours of history to analyze', '168')
  .action(async (options) => {
    try {
      const hoursBack = parseHours(options.hours);
      const config = loadConfig();
      const signals = await collectSignals(config, hoursBack);

      if (signals.claudeCode.recentSessions.length === 0) {
        console.log('No recent Claude Code sessions found.');
        return;
      }

      const patterns = analyzePatterns(signals.claudeCode.recentSessions);
      console.log('\n=== Development Patterns ===\n');
      console.log(formatPatternSummary(patterns));

      // Show working hours distribution
      const peakHours = patterns.workingHours
        .filter((h) => h.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      if (peakHours.length > 0) {
        console.log('\nPeak working hours:');
        for (const h of peakHours) {
          console.log(`  ${h.hour}:00 - ${h.count} sessions`);
        }
      }

      // Show tool usage
      if (patterns.toolUsage.length > 0) {
        console.log('\nTop tools used:');
        for (const t of patterns.toolUsage.slice(0, 5)) {
          console.log(`  ${t.tool}: ${t.count} calls`);
        }
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('questions')
  .description('Show open questions from recent sessions')
  .option('--hours <hours>', 'Hours of history to analyze', '168')
  .action(async (options) => {
    try {
      const hoursBack = parseHours(options.hours);
      const config = loadConfig();
      const signals = await collectSignals(config, hoursBack);

      if (signals.claudeCode.recentSessions.length === 0) {
        console.log('No recent Claude Code sessions found.');
        return;
      }

      const questions = extractAllQuestions(signals.claudeCode.recentSessions);

      console.log('\n=== Open Questions ===\n');

      if (questions.length === 0) {
        console.log('No open questions found in recent sessions.');
        return;
      }

      console.log(formatQuestionsForBriefing(questions));
      console.log(`\nTotal: ${questions.length} open questions`);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('feedback')
  .description('Submit feedback for the latest briefing')
  .argument('<card-index>', 'Card index (0-based) to provide feedback for')
  .argument('<rating>', 'Rating: helpful, not_helpful, or snoozed')
  .action((cardIndex, rating) => {
    try {
      const config = loadConfig();
      if (!config.data_dir) {
        console.error('No data directory configured');
        process.exit(1);
      }

      const latest = getLatestBriefing(config.data_dir);
      if (!latest) {
        console.error('No briefings found. Generate one first with "cpulse generate"');
        process.exit(1);
      }

      const idx = parseInt(cardIndex, 10);
      if (isNaN(idx) || idx < 0 || idx >= latest.cards.length) {
        console.error(`Invalid card index. Must be 0-${latest.cards.length - 1}`);
        process.exit(1);
      }

      const validRatings = ['helpful', 'not_helpful', 'snoozed'] as const;
      if (!validRatings.includes(rating as typeof validRatings[number])) {
        console.error('Invalid rating. Must be: helpful, not_helpful, or snoozed');
        process.exit(1);
      }

      const feedback: BriefingFeedback = {
        cardFeedback: { [idx]: rating as 'helpful' | 'not_helpful' | 'snoozed' },
        submittedAt: new Date(),
      };

      recordBriefingFeedback(config.data_dir, latest.id, latest.cards, feedback);
      console.log(`Recorded "${rating}" feedback for card ${idx}: "${latest.cards[idx].title}"`);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('feedback-stats')
  .description('Show feedback statistics')
  .action(() => {
    try {
      const config = loadConfig();
      if (!config.data_dir) {
        console.error('No data directory configured');
        process.exit(1);
      }

      const entries = loadFeedback(config.data_dir);
      if (entries.length === 0) {
        console.log('No feedback recorded yet.');
        return;
      }

      const stats = computeFeedbackStats(entries);

      console.log('\n=== Feedback Statistics ===');
      console.log(`Total feedback entries: ${stats.totalFeedback}`);
      console.log(`Recent trend: ${stats.recentTrend}`);

      console.log('\nBy card type:');
      for (const [type, counts] of Object.entries(stats.byCardType)) {
        const total = counts.helpful + counts.notHelpful + counts.snoozed;
        const helpfulPct = total > 0 ? Math.round((counts.helpful / total) * 100) : 0;
        console.log(`  ${type}: ${counts.helpful} helpful, ${counts.notHelpful} not helpful (${helpfulPct}% helpful)`);
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('priority')
  .description('Set topic priority')
  .argument('<topic>', 'Topic name to set priority for')
  .argument('<level>', 'Priority level: high, normal, low, or ignored')
  .action((topic, level) => {
    try {
      const config = loadConfig();
      if (!config.data_dir) {
        console.error('No data directory configured');
        process.exit(1);
      }

      const validLevels = ['high', 'normal', 'low', 'ignored'] as const;
      if (!validLevels.includes(level as typeof validLevels[number])) {
        console.error('Invalid level. Must be: high, normal, low, or ignored');
        process.exit(1);
      }

      updateTopicPriority(config.data_dir, topic, level as 'high' | 'normal' | 'low' | 'ignored');
      console.log(`Set priority for "${topic}" to ${level}`);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('priorities')
  .description('Show current topic priorities')
  .action(() => {
    try {
      const config = loadConfig();
      if (!config.data_dir) {
        console.error('No data directory configured');
        process.exit(1);
      }

      const priorities = loadTopicPriorities(config.data_dir);

      if (priorities.length === 0) {
        console.log('No topic priorities set. Use "cpulse priority <topic> <level>" to set one.');
        return;
      }

      console.log('\n=== Topic Priorities ===\n');

      const byLevel: Record<string, string[]> = {
        high: [],
        normal: [],
        low: [],
        ignored: [],
      };

      for (const p of priorities) {
        byLevel[p.priority].push(`${p.topic} (${p.reason})`);
      }

      for (const level of ['high', 'normal', 'low', 'ignored']) {
        if (byLevel[level].length > 0) {
          console.log(`${level.toUpperCase()}:`);
          for (const topic of byLevel[level]) {
            console.log(`  - ${topic}`);
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('serve')
  .description('Start the web dashboard')
  .option('-p, --port <port>', 'Port to run on', '3000')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .action(async (options) => {
    try {
      const port = parseInt(options.port, 10);
      if (isNaN(port) || port <= 0 || port > 65535) {
        console.error('Invalid port number');
        process.exit(1);
      }

      const server = createWebServer({
        port,
        host: options.host,
      });

      await server.start();
      console.log(`\nAvailable routes:`);
      console.log(`  /           - Briefing history`);
      console.log(`  /analytics  - Analytics dashboard`);
      console.log(`  /config     - Configuration viewer`);
      console.log(`\nPress Ctrl+C to stop the server`);
    } catch (error) {
      console.error('Error starting server:', error);
      process.exit(1);
    }
  });

program.parse();
