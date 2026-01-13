/**
 * Detect cost optimization opportunities in code patterns.
 * Focused on GCP services (Firestore, Cloud Run, Cloud Scheduler).
 */

// Code patterns that indicate potential cost inefficiencies
const COST_PATTERNS = [
    // Firestore patterns
    {
        category: 'storage',
        pattern: /\.doc\([^)]+\)\.get\(\)/g,
        inLoop: /for\s*\(|\.forEach|\.map\s*\(/,
        description: 'Individual Firestore reads in a loop',
        suggestion: 'Use getAll() for batch reads to reduce read operations',
        impact: 'moderate',
        service: 'Firestore',
    },
    {
        category: 'storage',
        pattern: /\.collection\([^)]+\)\.get\(\)/g,
        noLimit: true,
        description: 'Firestore collection query without limit',
        suggestion: 'Add .limit() to prevent reading entire collections',
        impact: 'significant',
        service: 'Firestore',
    },
    {
        category: 'storage',
        pattern: /\.set\(|\.update\(/g,
        inLoop: /for\s*\(|\.forEach|\.map\s*\(/,
        description: 'Individual Firestore writes in a loop',
        suggestion: 'Use batch writes or transactions for multiple writes',
        impact: 'moderate',
        service: 'Firestore',
    },
    {
        category: 'storage',
        pattern: /onSnapshot|\.onSnapshot\(/g,
        description: 'Firestore real-time listener',
        suggestion: 'Real-time listeners incur read costs on every change. Consider polling for less frequent updates.',
        impact: 'minor',
        service: 'Firestore',
    },

    // Cloud Run patterns
    {
        category: 'compute',
        pattern: /memory:\s*['"]?(1|2|4|8)G/gi,
        description: 'High memory allocation in Cloud Run',
        suggestion: 'Review if high memory is necessary. Lower memory = lower cost per request.',
        impact: 'moderate',
        service: 'Cloud Run',
    },
    {
        category: 'compute',
        pattern: /minInstances:\s*[1-9]\d*/g,
        description: 'Cloud Run minimum instances > 0',
        suggestion: 'Minimum instances incur cost even without traffic. Use 0 for scale-to-zero unless latency is critical.',
        impact: 'significant',
        service: 'Cloud Run',
    },
    {
        category: 'compute',
        pattern: /concurrency:\s*[1-9](?![0-9])/g,
        description: 'Low concurrency setting in Cloud Run',
        suggestion: 'Higher concurrency (up to 80-250) means fewer instances needed per request volume.',
        impact: 'moderate',
        service: 'Cloud Run',
    },

    // API usage patterns
    {
        category: 'api',
        pattern: /anthropic|openai|claude/gi,
        inLoop: /for\s*\(|\.forEach|\.map\s*\(/,
        description: 'AI API calls in a loop',
        suggestion: 'Batch prompts or use streaming to reduce API calls. Consider caching responses.',
        impact: 'significant',
        service: 'AI API',
    },
    {
        category: 'api',
        pattern: /max_tokens:\s*\d{4,}/g,
        description: 'High max_tokens for AI API calls',
        suggestion: 'Lower max_tokens when possible. You pay for generated tokens.',
        impact: 'minor',
        service: 'AI API',
    },

    // General patterns
    {
        category: 'network',
        pattern: /fetch\(|axios\.|http\./gi,
        inLoop: /for\s*\(|\.forEach|\.map\s*\(/,
        description: 'HTTP requests in a loop',
        suggestion: 'Batch requests or use Promise.all() to reduce network overhead.',
        impact: 'minor',
        service: 'Network',
    },
    {
        category: 'storage',
        pattern: /JSON\.parse|JSON\.stringify/g,
        inLoop: /for\s*\(|\.forEach|\.map\s*\(/,
        description: 'JSON serialization in a loop',
        suggestion: 'Parse/stringify once outside the loop if possible.',
        impact: 'minor',
        service: 'Compute',
    },
];

// GCP-specific cost tips
const GCP_TIPS = [
    {
        category: 'storage',
        service: 'Firestore',
        tip: 'Use composite indexes for complex queries to reduce scanned documents.',
        impact: 'moderate',
    },
    {
        category: 'storage',
        service: 'Firestore',
        tip: 'Structure data to minimize document reads. Denormalize when read-heavy.',
        impact: 'moderate',
    },
    {
        category: 'compute',
        service: 'Cloud Run',
        tip: 'Use Cloud Run jobs instead of always-on services for batch processing.',
        impact: 'significant',
    },
    {
        category: 'compute',
        service: 'Cloud Scheduler',
        tip: 'Consolidate scheduled jobs that run at similar times into a single trigger.',
        impact: 'minor',
    },
    {
        category: 'storage',
        service: 'Cloud Storage',
        tip: 'Use Nearline/Coldline storage classes for infrequently accessed data.',
        impact: 'moderate',
    },
];

/**
 * Detect cost patterns from code in session messages.
 */
export function detectCostPatterns(stack, sessions) {
    const insights = [];
    const detectedPatterns = new Set();

    // Analyze code from sessions
    for (const session of sessions) {
        for (const message of session.messages) {
            if (message.role !== 'assistant') continue;

            // Check tool calls for code
            for (const toolCall of message.toolCalls || []) {
                const code = toolCall.input?.content || toolCall.input?.new_string || '';
                if (!code) continue;

                // Check each cost pattern
                for (const pattern of COST_PATTERNS) {
                    if (detectedPatterns.has(pattern.description)) continue;

                    const matches = code.match(pattern.pattern);
                    if (!matches) continue;

                    // Check if pattern requires being in a loop
                    if (pattern.inLoop) {
                        const hasLoop = pattern.inLoop.test(code);
                        if (!hasLoop) continue;
                    }

                    // Check for missing limit
                    if (pattern.noLimit) {
                        if (code.includes('.limit(')) continue;
                    }

                    detectedPatterns.add(pattern.description);
                    insights.push({
                        category: pattern.category,
                        pattern: pattern.description,
                        impact: pattern.impact,
                        suggestion: pattern.suggestion,
                        codeLocations: [session.project],
                    });
                }
            }
        }
    }

    // Add relevant GCP tips based on detected stack
    if (stack.cloudProvider === 'gcp' || stack.databases.includes('Firestore')) {
        const relevantTips = GCP_TIPS.filter(tip => {
            if (tip.service === 'Firestore' && stack.databases.includes('Firestore')) return true;
            if (tip.service === 'Cloud Run' && stack.cloudServices.some(s => s.includes('Run'))) return true;
            if (tip.service === 'Cloud Scheduler' && stack.cloudServices.some(s => s.includes('Scheduler'))) return true;
            if (tip.service === 'Cloud Storage' && stack.cloudServices.some(s => s.includes('Storage'))) return true;
            return false;
        });

        // Add one random tip if we don't have enough detected patterns
        if (insights.length < 2 && relevantTips.length > 0) {
            const tip = relevantTips[Math.floor(Math.random() * relevantTips.length)];
            if (!insights.some(i => i.suggestion === tip.tip)) {
                insights.push({
                    category: tip.category,
                    pattern: `${tip.service} optimization opportunity`,
                    impact: tip.impact,
                    suggestion: tip.tip,
                });
            }
        }
    }

    // Sort by impact
    const impactOrder = { significant: 0, moderate: 1, minor: 2 };
    insights.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

    return insights.slice(0, 5);
}

/**
 * Format cost insights for use in prompts.
 */
export function formatCostInsights(insights, stack) {
    const lines = [];

    lines.push(`Detected Cloud Stack: ${stack.cloudProvider?.toUpperCase() || 'Unknown'}`);
    if (stack.cloudServices.length > 0) {
        lines.push(`Services: ${stack.cloudServices.join(', ')}`);
    }
    if (stack.databases.length > 0) {
        lines.push(`Databases: ${stack.databases.join(', ')}`);
    }

    if (insights.length > 0) {
        lines.push('\nDetected Cost Patterns:');
        for (const insight of insights) {
            lines.push(`- [${insight.impact.toUpperCase()}] ${insight.pattern}`);
            lines.push(`  Suggestion: ${insight.suggestion}`);
            if (insight.codeLocations?.length > 0) {
                lines.push(`  Found in: ${insight.codeLocations.join(', ')}`);
            }
        }
    } else {
        lines.push('\nNo obvious cost inefficiencies detected in recent code.');
        lines.push('Consider reviewing: Firestore query patterns, Cloud Run scaling settings, API call batching.');
    }

    return lines.join('\n');
}

/**
 * Check if there's enough data to generate a cost optimization card.
 */
export function hasCostData(insights, stack) {
    // Generate if we have GCP stack or detected patterns
    return insights.length >= 1 ||
        stack.cloudProvider === 'gcp' ||
        stack.databases.includes('Firestore');
}
//# sourceMappingURL=cost-patterns.js.map
