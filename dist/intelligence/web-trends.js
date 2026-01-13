import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { hashTechStack } from './stack-detector.js';

const CACHE_DIR = join(homedir(), '.cpulse', 'data');
const CACHE_FILE = join(CACHE_DIR, 'trends-cache.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Build search queries based on the tech stack.
 */
export function buildTrendQueries(stack) {
    const queries = [];
    const year = new Date().getFullYear();

    // Language-specific queries
    for (const lang of stack.languages.slice(0, 2)) {
        queries.push(`${lang} best practices ${year}`);
    }

    // Framework-specific queries
    for (const framework of stack.frameworks.slice(0, 2)) {
        queries.push(`${framework} optimization tips ${year}`);
    }

    // Database-specific queries
    for (const db of stack.databases.slice(0, 1)) {
        queries.push(`${db} performance best practices ${year}`);
    }

    // Cloud-specific queries
    if (stack.cloudProvider === 'gcp') {
        queries.push(`Google Cloud ${year} new features developers`);
    } else if (stack.cloudProvider === 'aws') {
        queries.push(`AWS ${year} new features developers`);
    }

    // Key dependency queries
    const importantDeps = ['@anthropic-ai/sdk', 'openai', 'langchain'];
    for (const dep of stack.dependencies) {
        if (importantDeps.includes(dep.name)) {
            const cleanName = dep.name.replace('@', '').replace('/', ' ');
            queries.push(`${cleanName} new features ${year}`);
        }
    }

    return queries.slice(0, 5); // Limit to 5 queries
}

/**
 * Load cached trends if still valid.
 */
export function loadCachedTrends(stack) {
    if (!existsSync(CACHE_FILE)) return null;

    try {
        const content = readFileSync(CACHE_FILE, 'utf8');
        const cache = JSON.parse(content);

        // Check if cache is for the same stack
        const currentHash = hashTechStack(stack);
        if (cache.stackHash !== currentHash) {
            return null;
        }

        // Check if cache has expired
        const expiresAt = new Date(cache.expiresAt);
        if (expiresAt < new Date()) {
            return null;
        }

        // Restore Date objects
        cache.fetchedAt = new Date(cache.fetchedAt);
        cache.expiresAt = expiresAt;
        for (const trend of cache.trends) {
            trend.cachedAt = new Date(trend.cachedAt);
        }

        return cache;
    } catch (e) {
        return null;
    }
}

/**
 * Save trends to cache.
 */
export function saveTrendsCache(trends, stack) {
    const cache = {
        trends,
        stackHash: hashTechStack(stack),
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    };

    try {
        writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    } catch (e) {
        console.error('Failed to save trends cache:', e.message);
    }

    return cache;
}

/**
 * Format trends for use in prompts.
 * This function formats whatever trends are available (cached or fallback).
 */
export function formatTrendsForPrompt(trends, stack) {
    const lines = [];

    lines.push('Recent Tech Trends Relevant to Your Stack:');
    lines.push('');

    if (trends.length > 0) {
        for (const trend of trends.slice(0, 5)) {
            lines.push(`**${trend.topic}**`);
            lines.push(trend.summary);
            if (trend.relevance) {
                lines.push(`Relevance: ${trend.relevance}`);
            }
            lines.push('');
        }
    } else {
        lines.push('No specific trends fetched. Using general best practices for:');
        lines.push(`- ${stack.languages.join(', ')}`);
        if (stack.frameworks.length > 0) {
            lines.push(`- ${stack.frameworks.join(', ')}`);
        }
    }

    return lines.join('\n');
}

/**
 * Generate fallback trends based on the stack when web search is unavailable.
 * These are general best practices that are likely still relevant.
 */
export function generateFallbackTrends(stack) {
    const trends = [];
    const now = new Date();

    // TypeScript trends
    if (stack.languages.includes('TypeScript')) {
        trends.push({
            topic: 'TypeScript Strict Mode',
            summary: 'Enable strict: true in tsconfig for better type safety. Use satisfies operator for inline type assertions.',
            relevance: 'Reduces runtime errors and improves code quality.',
            cachedAt: now,
        });
    }

    // React trends
    if (stack.frameworks.includes('React')) {
        trends.push({
            topic: 'React Server Components',
            summary: 'Use Server Components for data fetching to reduce client bundle size. Reserve "use client" for interactive components.',
            relevance: 'Improves initial page load and SEO.',
            cachedAt: now,
        });
    }

    // Firestore trends
    if (stack.databases.includes('Firestore')) {
        trends.push({
            topic: 'Firestore Vector Search',
            summary: 'Firestore now supports vector embeddings for semantic search. Consider for AI-powered features.',
            relevance: 'Enables similarity search without external vector DB.',
            cachedAt: now,
        });
        trends.push({
            topic: 'Firestore Aggregation Queries',
            summary: 'Use count(), sum(), and average() aggregation queries instead of reading all documents.',
            relevance: 'Reduces read costs and latency for aggregations.',
            cachedAt: now,
        });
    }

    // AI SDK trends
    if (stack.dependencies.some(d => d.name.includes('anthropic'))) {
        trends.push({
            topic: 'Claude Tool Use & Structured Outputs',
            summary: 'Use tool_use with JSON schemas for predictable, parseable responses. Combine with Zod for runtime validation.',
            relevance: 'Eliminates brittle regex parsing of AI responses.',
            cachedAt: now,
        });
    }

    // GCP trends
    if (stack.cloudProvider === 'gcp') {
        trends.push({
            topic: 'Cloud Run Gen2',
            summary: 'Cloud Run Gen2 offers faster cold starts and direct VPC egress. Migrate for improved performance.',
            relevance: 'Reduces latency and simplifies networking.',
            cachedAt: now,
        });
    }

    // Express/Node trends
    if (stack.frameworks.includes('Express')) {
        trends.push({
            topic: 'Node.js Native Fetch',
            summary: 'Node 18+ includes native fetch(). Remove node-fetch dependency for smaller bundles.',
            relevance: 'Reduces dependencies and bundle size.',
            cachedAt: now,
        });
    }

    return trends;
}

/**
 * Get trends for the tech stack.
 * Uses cache if available and valid, otherwise returns fallback trends.
 * Web search integration would be called from article generation with Claude.
 */
export function getTrends(stack) {
    // Try to load from cache first
    const cached = loadCachedTrends(stack);
    if (cached && cached.trends.length > 0) {
        return {
            trends: cached.trends,
            source: 'cache',
            fetchedAt: cached.fetchedAt,
        };
    }

    // Return fallback trends (web search will be done via Claude in article generation)
    const fallback = generateFallbackTrends(stack);
    return {
        trends: fallback,
        source: 'fallback',
        fetchedAt: new Date(),
    };
}

/**
 * Save trends fetched from web search (called after Claude generates them).
 */
export function cacheTrendsFromSearch(searchResults, stack) {
    const trends = searchResults.map(result => ({
        topic: result.topic,
        summary: result.summary,
        relevance: result.relevance,
        sourceUrl: result.url,
        cachedAt: new Date(),
    }));

    saveTrendsCache(trends, stack);
    return trends;
}
//# sourceMappingURL=web-trends.js.map
