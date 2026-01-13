/**
 * Web server for cpulse dashboard.
 * Provides briefing history browser, analytics, and configuration editor.
 *
 * Created: 2026-01-12
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig } from '../config.js';
import { getAllBriefings, getBriefing, } from '../storage/briefings.js';
import { getAnalytics } from './analytics.js';
import { renderDashboardPage, renderBriefingPage, renderAnalyticsPage, renderConfigPage, renderSearchResultsPage, } from './templates.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export function createWebServer(options = {}) {
    const app = express();
    const port = options.port || 3000;
    const host = options.host || 'localhost';
    // Load config
    let config;
    try {
        config = loadConfig();
    }
    catch {
        console.error('Failed to load config, using defaults');
        config = getDefaultConfig();
    }
    const dataDir = config.data_dir || `${process.env.HOME}/.cpulse`;
    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    // Dashboard home - briefing list
    app.get('/', (req, res) => {
        const briefings = getAllBriefings(dataDir);
        const page = parseInt(req.query.page) || 1;
        const perPage = 10;
        const start = (page - 1) * perPage;
        const paginatedBriefings = briefings.slice(start, start + perPage);
        const totalPages = Math.ceil(briefings.length / perPage);
        const html = renderDashboardPage(paginatedBriefings, page, totalPages);
        res.send(html);
    });
    // Single briefing view
    app.get('/briefing/:id', (req, res) => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const briefing = getBriefing(dataDir, id);
        if (!briefing) {
            res.status(404).send('Briefing not found');
            return;
        }
        const html = renderBriefingPage(briefing);
        res.send(html);
    });
    // Analytics page
    app.get('/analytics', async (req, res) => {
        const analytics = await getAnalytics(dataDir);
        const html = renderAnalyticsPage(analytics);
        res.send(html);
    });
    // Config page
    app.get('/config', (req, res) => {
        const html = renderConfigPage(config);
        res.send(html);
    });
    // Search results page (HTML)
    app.get('/search', (req, res) => {
        const query = (req.query.q || '').trim();
        if (!query) {
            res.redirect('/');
            return;
        }
        const briefings = getAllBriefings(dataDir);
        const results = briefings.filter((b) => {
            return b.cards.some((card) => card.title.toLowerCase().includes(query.toLowerCase()) ||
                card.content.toLowerCase().includes(query.toLowerCase()));
        });
        const html = renderSearchResultsPage(query, results.slice(0, 50));
        res.send(html);
    });
    // API endpoints
    app.get('/api/briefings', (req, res) => {
        const briefings = getAllBriefings(dataDir);
        res.json(briefings);
    });
    app.get('/api/briefing/:id', (req, res) => {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const briefing = getBriefing(dataDir, id);
        if (!briefing) {
            res.status(404).json({ error: 'Briefing not found' });
            return;
        }
        res.json(briefing);
    });
    app.get('/api/analytics', async (req, res) => {
        const analytics = await getAnalytics(dataDir);
        res.json(analytics);
    });
    // Search briefings
    app.get('/api/search', (req, res) => {
        const query = (req.query.q || '').toLowerCase();
        if (!query) {
            res.json([]);
            return;
        }
        const briefings = getAllBriefings(dataDir);
        const results = briefings.filter((b) => {
            // Search in card titles and content
            return b.cards.some((card) => card.title.toLowerCase().includes(query) ||
                card.content.toLowerCase().includes(query));
        });
        res.json(results.slice(0, 20));
    });
    return {
        app,
        start: () => {
            return new Promise((resolve, reject) => {
                const server = app.listen(port, host, () => {
                    console.log(`cpulse dashboard running at http://${host}:${port}`);
                    resolve();
                });
                server.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        reject(new Error(`Port ${port} is already in use`));
                    }
                    else if (err.code === 'EACCES') {
                        reject(new Error(`Permission denied to bind to port ${port}`));
                    }
                    else {
                        reject(err);
                    }
                });
            });
        },
        port,
        host,
    };
}
function getDefaultConfig() {
    return {
        email: {
            to: '',
            from: '',
            send_time: '06:00',
            timezone: 'America/Los_Angeles',
            smtp: {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: { user: '', pass: '' },
            },
        },
        sources: {
            claude_code: { enabled: true, log_path: '~/.claude/' },
            github: { enabled: false, repos: [], include_private: true },
        },
        preferences: {
            article_style: 'concise',
            max_cards: 5,
            focus_topics: [],
            ignored_topics: [],
        },
    };
}
//# sourceMappingURL=server.js.map