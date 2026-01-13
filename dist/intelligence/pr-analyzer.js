/**
 * Analyze PR review comments and session errors to identify recurring challenge patterns.
 * Helps users prevent common issues by surfacing patterns in feedback.
 */

// Keywords that indicate different categories of feedback
const CATEGORY_PATTERNS = {
    bug: [
        'bug', 'broken', 'crash', 'error', 'fail', 'wrong', 'incorrect',
        'undefined', 'null', 'exception', 'race condition', 'memory leak',
    ],
    security: [
        'security', 'vulnerability', 'injection', 'xss', 'csrf', 'auth',
        'permission', 'escape', 'sanitize', 'secret', 'credential', 'token',
    ],
    performance: [
        'performance', 'slow', 'optimize', 'cache', 'memory', 'n+1',
        'inefficient', 'bottleneck', 'latency', 'timeout', 'blocking',
    ],
    style: [
        'style', 'naming', 'convention', 'format', 'lint', 'typo',
        'spelling', 'readability', 'clarity', 'comment', 'documentation',
    ],
    architecture: [
        'architecture', 'design', 'pattern', 'coupling', 'abstraction',
        'refactor', 'structure', 'separation', 'responsibility', 'solid',
    ],
};

// Common patterns in PR feedback that indicate issues
const ISSUE_PATTERNS = [
    { pattern: /null|undefined|optional chaining|\?\./i, description: 'Null/undefined handling' },
    { pattern: /error handling|try.?catch|exception/i, description: 'Error handling' },
    { pattern: /test|coverage|spec|unit test/i, description: 'Test coverage' },
    { pattern: /edge case|corner case|boundary/i, description: 'Edge case handling' },
    { pattern: /validation|validate|check|verify/i, description: 'Input validation' },
    { pattern: /type|typing|typescript|any type/i, description: 'Type safety' },
    { pattern: /async|await|promise|callback/i, description: 'Async handling' },
    { pattern: /log|logging|debug|trace/i, description: 'Logging' },
    { pattern: /doc|comment|jsdoc|readme/i, description: 'Documentation' },
    { pattern: /magic number|hardcod|constant/i, description: 'Magic values' },
];

/**
 * Analyze PR comments and errors to extract challenge patterns.
 */
export function analyzePRChallenges(comments, sessions) {
    const analysis = {
        patterns: [],
        errorPatterns: [],
        analyzedPRs: 0,
        analyzedSessions: 0,
    };

    // Analyze PR comments
    const prSet = new Set();
    const patternCounts = new Map();
    const patternExamples = new Map();

    for (const comment of comments) {
        prSet.add(`${comment.repo}#${comment.prNumber}`);
        const body = comment.body.toLowerCase();

        // Detect category
        let category = detectCategory(body);

        // Detect specific issue patterns
        for (const { pattern, description } of ISSUE_PATTERNS) {
            if (pattern.test(comment.body)) {
                const count = patternCounts.get(description) || 0;
                patternCounts.set(description, count + 1);

                if (!patternExamples.has(description)) {
                    patternExamples.set(description, []);
                }
                const examples = patternExamples.get(description);
                if (examples.length < 3) {
                    // Truncate example
                    const example = comment.body.length > 150
                        ? comment.body.substring(0, 150) + '...'
                        : comment.body;
                    examples.push({
                        text: example,
                        pr: `${comment.repo}#${comment.prNumber}`,
                        path: comment.path,
                        category,
                    });
                }
            }
        }
    }

    analysis.analyzedPRs = prSet.size;

    // Convert to ChallengePattern objects, sorted by occurrence
    const sortedPatterns = Array.from(patternCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    for (const [description, count] of sortedPatterns) {
        if (count >= 2) { // Only include patterns that occurred at least twice
            const examples = patternExamples.get(description) || [];
            const category = examples[0]?.category || 'style';

            analysis.patterns.push({
                category,
                description,
                occurrences: count,
                examples: examples.map(e => `${e.pr}: "${e.text}"`),
            });
        }
    }

    // Analyze session errors
    const errorCounts = new Map();
    const errorExamples = new Map();

    for (const session of sessions) {
        analysis.analyzedSessions++;

        for (const error of session.errors) {
            const errorType = categorizeError(error);
            const count = errorCounts.get(errorType) || 0;
            errorCounts.set(errorType, count + 1);

            if (!errorExamples.has(errorType)) {
                errorExamples.set(errorType, []);
            }
            const examples = errorExamples.get(errorType);
            if (examples.length < 3) {
                examples.push(error.length > 200 ? error.substring(0, 200) + '...' : error);
            }
        }
    }

    // Convert to error patterns
    const sortedErrors = Array.from(errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    for (const [type, count] of sortedErrors) {
        if (count >= 2) {
            analysis.errorPatterns.push({
                type,
                count,
                examples: errorExamples.get(type) || [],
            });
        }
    }

    return analysis;
}

/**
 * Detect the category of a comment based on keywords.
 */
function detectCategory(text) {
    const lower = text.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_PATTERNS)) {
        for (const keyword of keywords) {
            if (lower.includes(keyword)) {
                return category;
            }
        }
    }

    return 'style'; // Default category
}

/**
 * Categorize an error message into a type.
 */
function categorizeError(error) {
    const lower = error.toLowerCase();

    if (lower.includes('typeerror') || lower.includes('cannot read prop')) {
        return 'TypeError (null/undefined access)';
    }
    if (lower.includes('syntaxerror')) {
        return 'SyntaxError';
    }
    if (lower.includes('referenceerror')) {
        return 'ReferenceError (undefined variable)';
    }
    if (lower.includes('timeout') || lower.includes('timed out')) {
        return 'Timeout (async operations)';
    }
    if (lower.includes('enoent') || lower.includes('no such file')) {
        return 'File not found';
    }
    if (lower.includes('econnrefused') || lower.includes('network')) {
        return 'Network/connection error';
    }
    if (lower.includes('permission') || lower.includes('eacces')) {
        return 'Permission error';
    }
    if (lower.includes('assertion') || lower.includes('expect')) {
        return 'Test assertion failure';
    }
    if (lower.includes('ts') && lower.includes('error')) {
        return 'TypeScript type error';
    }
    if (lower.includes('eslint') || lower.includes('lint')) {
        return 'Lint error';
    }

    return 'Other error';
}

/**
 * Format challenge analysis for use in prompts.
 */
export function formatChallengeAnalysis(analysis) {
    const lines = [];

    if (analysis.patterns.length > 0) {
        lines.push('Recurring PR Feedback Themes:');
        for (const pattern of analysis.patterns.slice(0, 5)) {
            lines.push(`- "${pattern.description}" (${pattern.occurrences} occurrences, category: ${pattern.category})`);
            if (pattern.examples.length > 0) {
                lines.push(`  Example: ${pattern.examples[0]}`);
            }
        }
    }

    if (analysis.errorPatterns.length > 0) {
        lines.push('\nRecurring Errors from Sessions:');
        for (const error of analysis.errorPatterns.slice(0, 5)) {
            lines.push(`- ${error.type} (${error.count} occurrences)`);
            if (error.examples.length > 0) {
                lines.push(`  Example: ${error.examples[0]}`);
            }
        }
    }

    lines.push(`\nAnalyzed: ${analysis.analyzedPRs} PRs, ${analysis.analyzedSessions} sessions`);

    return lines.join('\n');
}

/**
 * Check if there's enough data to generate a challenge insights card.
 */
export function hasChallengeData(analysis) {
    return analysis.patterns.length >= 1 || analysis.errorPatterns.length >= 2;
}
//# sourceMappingURL=pr-analyzer.js.map
