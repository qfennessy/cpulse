#!/usr/bin/env node

import { Command } from 'commander';
import {
  loadConfig,
  createDefaultConfig,
  configExists,
  getConfigPath,
  generateAndSendBriefing,
  formatBriefingAsMarkdown,
  getLatestBriefing,
  getBriefingStats,
  collectSignals,
} from './index.js';

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
  .action(async (options) => {
    try {
      // Validate hours before loading config to fail fast
      const hoursBack = parseHours(options.hours);
      const config = loadConfig();

      if (options.preview) {
        options.send = false;
      }

      const briefing = await generateAndSendBriefing(config, {
        send: options.send,
        save: options.save,
        hoursBack,
      });

      if (options.preview || !options.send) {
        console.log(formatBriefingAsMarkdown(briefing));
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

program.parse();
