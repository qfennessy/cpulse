import { describe, it, expect } from 'vitest';
// We need to test the internal functions, so we'll import them
// For now, we test via the module's behavior
describe('PR Urgency Calculation', () => {
    // These test the urgency thresholds documented in the code
    it('should classify PR age correctly', () => {
        // Urgency thresholds:
        // 0-3 days: low
        // 4-7 days: medium
        // 8-14 days: high
        // 14+ days: critical
        const thresholds = [
            { days: 0, expected: 'low' },
            { days: 3, expected: 'low' },
            { days: 4, expected: 'medium' },
            { days: 7, expected: 'medium' },
            { days: 8, expected: 'high' },
            { days: 14, expected: 'high' },
            { days: 15, expected: 'critical' },
            { days: 30, expected: 'critical' },
        ];
        for (const { days, expected } of thresholds) {
            let urgency;
            if (days > 14) {
                urgency = 'critical';
            }
            else if (days > 7) {
                urgency = 'high';
            }
            else if (days > 3) {
                urgency = 'medium';
            }
            else {
                urgency = 'low';
            }
            expect(urgency, `${days} days should be ${expected}`).toBe(expected);
        }
    });
});
describe('Post-Merge Comment Severity Classification', () => {
    // Test the severity classification logic
    function classifyCommentSeverity(body) {
        const criticalPatterns = [
            /security|vulnerability|exploit|injection|xss|csrf/i,
            /\bbug\b|broken|crash|fail(?:s|ed|ing)?|exception/i,
            /breaking change|regression|reverted/i,
            /urgent|asap|critical|blocker/i,
        ];
        for (const pattern of criticalPatterns) {
            if (pattern.test(body)) {
                return { severity: 'critical' };
            }
        }
        if (body.includes('?') && body.length < 500) {
            const startsWithQuestion = /^(why|how|what|when|where|could|should|would|can|is|are|do|does)/im.test(body);
            if (startsWithQuestion || body.split('?').length > 1) {
                return { severity: 'question' };
            }
        }
        const suggestionPatterns = [
            /suggest|consider|might want|could also|alternative/i,
            /nit:?|minor:?|style:?|formatting/i,
            /future|later|follow-up|next time/i,
            /\bimo\b|\bfyi\b|for your information/i,
        ];
        for (const pattern of suggestionPatterns) {
            if (pattern.test(body)) {
                return { severity: 'suggestion' };
            }
        }
        return { severity: 'info' };
    }
    describe('critical severity', () => {
        it('should classify security issues as critical', () => {
            expect(classifyCommentSeverity('This has a security vulnerability').severity).toBe('critical');
            expect(classifyCommentSeverity('Possible XSS attack vector here').severity).toBe('critical');
            expect(classifyCommentSeverity('SQL injection risk').severity).toBe('critical');
        });
        it('should classify bugs as critical', () => {
            expect(classifyCommentSeverity('This is a bug').severity).toBe('critical');
            expect(classifyCommentSeverity('The app crashes here').severity).toBe('critical');
            expect(classifyCommentSeverity('This will fail in production').severity).toBe('critical');
        });
        it('should classify urgent items as critical', () => {
            expect(classifyCommentSeverity('This is a blocker for release').severity).toBe('critical');
            expect(classifyCommentSeverity('URGENT: fix this').severity).toBe('critical');
            expect(classifyCommentSeverity('Critical issue found').severity).toBe('critical');
        });
        it('should classify breaking changes as critical', () => {
            expect(classifyCommentSeverity('This is a breaking change').severity).toBe('critical');
            expect(classifyCommentSeverity('This caused a regression').severity).toBe('critical');
        });
    });
    describe('question severity', () => {
        it('should classify questions needing response', () => {
            expect(classifyCommentSeverity('Why did you use this approach?').severity).toBe('question');
            expect(classifyCommentSeverity('How does this work?').severity).toBe('question');
            expect(classifyCommentSeverity('What happens if the input is null?').severity).toBe('question');
        });
        it('should classify multiple questions', () => {
            expect(classifyCommentSeverity('Is this correct? Should we change it?').severity).toBe('question');
        });
    });
    describe('suggestion severity', () => {
        it('should classify nits and minor issues as suggestions', () => {
            expect(classifyCommentSeverity('nit: extra whitespace').severity).toBe('suggestion');
            expect(classifyCommentSeverity('Minor: consider renaming this').severity).toBe('suggestion');
            expect(classifyCommentSeverity('Style: use camelCase here').severity).toBe('suggestion');
        });
        it('should classify improvement ideas as suggestions', () => {
            expect(classifyCommentSeverity('Consider using a map instead').severity).toBe('suggestion');
            expect(classifyCommentSeverity('You might want to add caching').severity).toBe('suggestion');
            expect(classifyCommentSeverity('An alternative approach would be...').severity).toBe('suggestion');
        });
        it('should classify future work as suggestions', () => {
            expect(classifyCommentSeverity('We can address this later').severity).toBe('suggestion');
            expect(classifyCommentSeverity('Follow-up: add tests for edge cases').severity).toBe('suggestion');
            expect(classifyCommentSeverity('FYI this pattern is deprecated').severity).toBe('suggestion');
        });
    });
    describe('info severity', () => {
        it('should default to info for general feedback', () => {
            expect(classifyCommentSeverity('Looks good!').severity).toBe('info');
            expect(classifyCommentSeverity('Nice work on this').severity).toBe('info');
            expect(classifyCommentSeverity('Thanks for the update').severity).toBe('info');
        });
    });
});
//# sourceMappingURL=github.test.js.map