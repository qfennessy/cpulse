#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, createDefaultConfig, configExists, getConfigPath, generateAndSendBriefing, formatBriefingAsMarkdown, formatBriefingWithNarratives, getLatestBriefing, getBriefingStats, collectSignals, analyzePatterns, formatPatternSummary, extractAllQuestions, formatQuestionsForBriefing, loadFeedback, computeFeedbackStats, recordBriefingFeedback, loadTopicPriorities, updateTopicPriority, createWebServer, loadGlobalMemory, loadProjectMemory, } from './index.js';
const program = new Command();
function parseHours(value) {
    const hours = parseInt(value, 10);
    if (isNaN(hours) || hours <= 0) {
        console.error(`Error: --hours must be a positive number, got "${value}"`);
        process.exit(1);
    }
    return hours;
}
program
    .name('cpulse')
    .description('Commit Pulse - Personal daily briefings from Claude Code sessions and GitHub activity')
    .version('0.7.0');
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
    .option('--all-cards', 'Generate all card types regardless of weekly rotation')
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
            allCards: options.allCards,
        });
        if (options.preview || !options.send) {
            if (options.simple) {
                console.log(formatBriefingAsMarkdown(briefing));
            }
            else {
                console.log(formatBriefingWithNarratives(briefing, signals));
            }
        }
        else {
            console.log(`Briefing sent to ${config.email.to}`);
        }
        console.log(`Generated ${briefing.cards.length} cards`);
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
        const validRatings = ['helpful', 'not_helpful', 'snoozed'];
        if (!validRatings.includes(rating)) {
            console.error('Invalid rating. Must be: helpful, not_helpful, or snoozed');
            process.exit(1);
        }
        const feedback = {
            cardFeedback: { [idx]: rating },
            submittedAt: new Date(),
        };
        recordBriefingFeedback(config.data_dir, latest.id, latest.cards, feedback);
        console.log(`Recorded "${rating}" feedback for card ${idx}: "${latest.cards[idx].title}"`);
    }
    catch (error) {
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
    }
    catch (error) {
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
        const validLevels = ['high', 'normal', 'low', 'ignored'];
        if (!validLevels.includes(level)) {
            console.error('Invalid level. Must be: high, normal, low, or ignored');
            process.exit(1);
        }
        updateTopicPriority(config.data_dir, topic, level);
        console.log(`Set priority for "${topic}" to ${level}`);
    }
    catch (error) {
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
        const byLevel = {
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
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
});
program
    .command('serve')
    .description('Start the web dashboard')
    .option('-p, --port <port>', 'Port to run on', '3000')
    .option('-H, --host <host>', 'Host to bind to', 'localhost')
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
    }
    catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
});
program
    .command('memory')
    .description('Show memory context status and loaded project memories')
    .option('--project <path>', 'Show memory for a specific project path')
    .action(async (options) => {
    try {
        console.log('\n=== Memory Context ===\n');
        // Show global memory
        const globalMemory = loadGlobalMemory();
        if (globalMemory) {
            console.log('Global memory: ~/.cpulse/memory.md');
            console.log(`  Sections: ${globalMemory.sections.length}`);
            console.log(`  Last modified: ${globalMemory.lastModified.toLocaleString()}`);
            if (globalMemory.sections.length > 0) {
                console.log('  Section titles:');
                for (const section of globalMemory.sections.slice(0, 5)) {
                    console.log(`    - ${section.title}`);
                }
                if (globalMemory.sections.length > 5) {
                    console.log(`    ... and ${globalMemory.sections.length - 5} more`);
                }
            }
        }
        else {
            console.log('Global memory: not found');
            console.log('  Create ~/.cpulse/memory.md to add global context');
        }
        console.log('');
        // Show project memory if path provided
        if (options.project) {
            const projectMemory = loadProjectMemory(options.project);
            if (projectMemory) {
                console.log(`Project memory: ${projectMemory.projectName}`);
                console.log(`  Path: ${projectMemory.projectPath}`);
                console.log(`  Sections: ${projectMemory.sections.length}`);
                console.log(`  Last modified: ${projectMemory.lastModified.toLocaleString()}`);
                if (projectMemory.sections.length > 0) {
                    console.log('  Section titles:');
                    for (const section of projectMemory.sections) {
                        console.log(`    - ${section.title}`);
                    }
                }
            }
            else {
                console.log(`Project memory: not found for ${options.project}`);
                console.log('  Create docs/memory.md or memory.md in your project root');
            }
        }
        else {
            // Show memory from current directory
            const cwd = process.cwd();
            const projectMemory = loadProjectMemory(cwd);
            if (projectMemory) {
                console.log(`Current project memory: ${projectMemory.projectName}`);
                console.log(`  Path: ${projectMemory.projectPath}`);
                console.log(`  Sections: ${projectMemory.sections.length}`);
                if (projectMemory.sections.length > 0) {
                    console.log('  Section titles:');
                    for (const section of projectMemory.sections) {
                        console.log(`    - ${section.title}`);
                    }
                }
            }
            else {
                console.log('Current project memory: not found');
                console.log('  Create docs/memory.md or memory.md in your project root');
            }
        }
        console.log('\n--- Memory Integration ---');
        console.log('Memory files are automatically loaded when generating briefings.');
        console.log('They provide project-specific context to make insights more relevant.');
        console.log('\nSupported locations:');
        console.log('  - ~/.cpulse/memory.md (global context)');
        console.log('  - <project>/docs/memory.md (preferred)');
        console.log('  - <project>/memory.md (fallback)');
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
});

// Card types configuration
const CARD_TYPES = {
    project_continuity: { name: 'Project Continuity', schedule: 'Daily', description: 'Continue where you left off' },
    code_review: { name: 'Code Review', schedule: 'Daily', description: 'GitHub commits and PRs summary' },
    open_questions: { name: 'Open Questions', schedule: 'Daily', description: 'Unresolved questions from sessions' },
    patterns: { name: 'Patterns', schedule: 'Daily', description: 'Development patterns and habits' },
    post_merge_feedback: { name: 'Post-Merge Feedback', schedule: 'Daily', description: 'Comments on merged PRs' },
    tech_advisory: { name: 'Tech Advisory', schedule: 'Wed/Thu', description: 'Stack-aware architectural advice' },
    challenge_insights: { name: 'Challenge Insights', schedule: 'Mon/Tue', description: 'PR review patterns analysis' },
    cost_optimization: { name: 'Cost Optimization', schedule: 'Friday', description: 'GCP cost saving tips' },
};

program
    .command('cards')
    .description('List and configure briefing card types')
    .argument('[action]', 'Action: enable, disable, or list (default)')
    .argument('[card-type]', 'Card type to enable/disable')
    .action((action, cardType) => {
    try {
        const config = loadConfig();
        const enabledCards = config.preferences?.enabled_cards || {};

        if (!action || action === 'list') {
            console.log('\n=== Briefing Card Types ===\n');
            const today = new Date();
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const todayName = dayNames[today.getDay()];

            for (const [type, info] of Object.entries(CARD_TYPES)) {
                const enabled = enabledCards[type] !== false;
                const status = enabled ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
                const scheduleMatch = info.schedule.includes(todayName) || info.schedule === 'Daily';
                const scheduleIndicator = scheduleMatch ? '(today)' : '';

                console.log(`${status} ${type}`);
                console.log(`     ${info.name} - ${info.description}`);
                console.log(`     Schedule: ${info.schedule} ${scheduleIndicator}`);
                console.log('');
            }

            console.log('Use "cpulse cards enable <type>" or "cpulse cards disable <type>" to configure.');
            console.log('Or edit ~/.cpulse/config.yaml directly under preferences.enabled_cards');
            return;
        }

        if (action === 'enable' || action === 'disable') {
            if (!cardType) {
                console.error('Please specify a card type. Use "cpulse cards list" to see available types.');
                process.exit(1);
            }

            if (!CARD_TYPES[cardType]) {
                console.error(`Unknown card type: ${cardType}`);
                console.error('Available types: ' + Object.keys(CARD_TYPES).join(', '));
                process.exit(1);
            }

            const newValue = action === 'enable';
            console.log(`\nTo ${action} ${cardType}, add this to ~/.cpulse/config.yaml:`);
            console.log(`\npreferences:`);
            console.log(`  enabled_cards:`);
            console.log(`    ${cardType}: ${newValue}`);
            console.log(`\nNote: Edit the config file directly to persist changes.`);
            return;
        }

        console.error(`Unknown action: ${action}. Use 'list', 'enable', or 'disable'.`);
        process.exit(1);
    }
    catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
});

// Helper function to check if file needs updating (by mtime and size)
function needsUpdate(srcPath, destPath) {
    if (!fs.existsSync(destPath)) {
        return true;
    }
    const srcStat = fs.statSync(srcPath);
    const destStat = fs.statSync(destPath);
    // Update if source is newer or sizes differ
    return srcStat.mtimeMs > destStat.mtimeMs || srcStat.size !== destStat.size;
}

// Helper function to recursively sync directory, only updating changed files
function syncDirSync(src, dest, stats = { updated: 0, skipped: 0, added: 0 }) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            syncDirSync(srcPath, destPath, stats);
        } else {
            if (!fs.existsSync(destPath)) {
                fs.copyFileSync(srcPath, destPath);
                stats.added++;
            } else if (needsUpdate(srcPath, destPath)) {
                fs.copyFileSync(srcPath, destPath);
                stats.updated++;
            } else {
                stats.skipped++;
            }
        }
    }
    return stats;
}

program
    .command('install')
    .description('Install cpulse to ~/.cpulse/bin for global use')
    .option('--link', 'Create symlinks in /usr/local/bin and /usr/local/share/man')
    .option('--force', 'Force reinstall of npm dependencies')
    .action(async (options) => {
    try {
        const homeDir = process.env.HOME;
        if (!homeDir) {
            console.error('Error: HOME environment variable not set');
            process.exit(1);
        }

        const installDir = path.join(homeDir, '.cpulse', 'bin');
        const cliPath = path.join(installDir, 'cli.js');

        // Find the source directory (dist/)
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const srcDir = __dirname;

        // Find root package.json (one level up from dist/)
        const rootDir = path.dirname(srcDir);
        const packageJsonPath = path.join(rootDir, 'package.json');
        const destPackageJsonPath = path.join(installDir, 'package.json');

        const isNewInstall = !fs.existsSync(installDir);
        console.log(`${isNewInstall ? 'Installing' : 'Updating'} cpulse at ${installDir}...`);

        // Sync dist/ files (only copy changed files)
        const stats = syncDirSync(srcDir, installDir);

        // Sync package.json
        let packageJsonChanged = false;
        if (fs.existsSync(packageJsonPath)) {
            if (needsUpdate(packageJsonPath, destPackageJsonPath)) {
                fs.copyFileSync(packageJsonPath, destPackageJsonPath);
                packageJsonChanged = true;
                stats.updated++;
            } else {
                stats.skipped++;
            }
        }

        // Make CLI executable
        fs.chmodSync(cliPath, '755');

        // Report sync stats
        if (stats.added > 0 || stats.updated > 0) {
            console.log(`✓ Files synced (${stats.added} added, ${stats.updated} updated, ${stats.skipped} unchanged)`);
        } else {
            console.log(`✓ Already up to date (${stats.skipped} files unchanged)`);
        }

        // Run npm install only if package.json changed, node_modules missing, or --force
        const nodeModulesPath = path.join(installDir, 'node_modules');
        const needsDeps = packageJsonChanged || !fs.existsSync(nodeModulesPath) || options.force;

        if (needsDeps) {
            console.log('Installing dependencies...');
            const { execSync } = await import('child_process');
            try {
                execSync('npm install --omit=dev --silent', {
                    cwd: installDir,
                    stdio: 'pipe',
                });
                console.log('✓ Dependencies installed');
            } catch (npmError) {
                console.warn('Warning: Could not install dependencies automatically.');
                console.log(`Run manually: cd ${installDir} && npm install --omit=dev`);
            }
        }

        // Install man page (only if changed)
        const manDir = path.join(homeDir, '.cpulse', 'man', 'man1');
        const manPageSrc = path.join(srcDir, 'cpulse.1');
        const manPageDest = path.join(manDir, 'cpulse.1');

        if (fs.existsSync(manPageSrc)) {
            fs.mkdirSync(manDir, { recursive: true });
            if (needsUpdate(manPageSrc, manPageDest)) {
                fs.copyFileSync(manPageSrc, manPageDest);
                console.log('✓ Man page updated');
            }
        }

        console.log('\n✓ Installation complete!');
        console.log(`\nInstalled to: ${installDir}`);

        console.log('\nTo use cpulse globally, add to your shell config (~/.zshrc or ~/.bashrc):');
        console.log(`\n  # Alias for cpulse command`);
        console.log(`  alias cpulse='node ${cliPath}'`);
        console.log(`\n  # Man page access`);
        console.log(`  export MANPATH="${path.join(homeDir, '.cpulse', 'man')}:$MANPATH"`);

        if (options.link) {
            const binLinkPath = '/usr/local/bin/cpulse';
            const manLinkDir = '/usr/local/share/man/man1';
            const manLinkPath = path.join(manLinkDir, 'cpulse.1');

            console.log(`\nCreating symlinks (may require sudo)...`);

            // Symlink the CLI
            try {
                if (fs.existsSync(binLinkPath)) {
                    fs.unlinkSync(binLinkPath);
                }
                fs.symlinkSync(cliPath, binLinkPath);
                console.log(`✓ ${binLinkPath} -> ${cliPath}`);
            } catch (linkError) {
                console.error(`✗ Failed to create ${binLinkPath}: ${linkError.message}`);
                console.log(`  Run: sudo ln -sf ${cliPath} ${binLinkPath}`);
            }

            // Symlink the man page
            if (fs.existsSync(manPageDest)) {
                try {
                    // Ensure man directory exists
                    if (!fs.existsSync(manLinkDir)) {
                        fs.mkdirSync(manLinkDir, { recursive: true });
                    }
                    if (fs.existsSync(manLinkPath)) {
                        fs.unlinkSync(manLinkPath);
                    }
                    fs.symlinkSync(manPageDest, manLinkPath);
                    console.log(`✓ ${manLinkPath} -> ${manPageDest}`);
                } catch (linkError) {
                    console.error(`✗ Failed to create ${manLinkPath}: ${linkError.message}`);
                    console.log(`  Run: sudo ln -sf ${manPageDest} ${manLinkPath}`);
                }
            }
        }
    }
    catch (error) {
        console.error('Error during installation:', error.message);
        process.exit(1);
    }
});

program.parse();
//# sourceMappingURL=cli.js.map