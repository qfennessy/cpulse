import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
const BRIEFINGS_FILE = 'briefings.jsonl';
function getBriefingsPath(dataDir) {
    return join(dataDir, BRIEFINGS_FILE);
}
export function saveBriefing(dataDir, briefing) {
    const filePath = getBriefingsPath(dataDir);
    const line = JSON.stringify(briefing) + '\n';
    if (existsSync(filePath)) {
        const existing = readFileSync(filePath, 'utf-8');
        writeFileSync(filePath, existing + line);
    }
    else {
        writeFileSync(filePath, line);
    }
}
export function loadBriefings(dataDir) {
    const filePath = getBriefingsPath(dataDir);
    if (!existsSync(filePath)) {
        return [];
    }
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const briefings = [];
    for (const line of lines) {
        try {
            const briefing = JSON.parse(line);
            // Convert date strings back to Date objects
            briefing.date = new Date(briefing.date);
            briefing.generatedAt = new Date(briefing.generatedAt);
            briefings.push(briefing);
        }
        catch {
            // Skip malformed lines
        }
    }
    return briefings;
}
export function getLatestBriefing(dataDir) {
    const briefings = loadBriefings(dataDir);
    if (briefings.length === 0)
        return null;
    // Sort by date, most recent first
    briefings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return briefings[0];
}
export function getBriefingsByDateRange(dataDir, startDate, endDate) {
    const briefings = loadBriefings(dataDir);
    return briefings.filter((b) => {
        const date = new Date(b.date);
        return date >= startDate && date <= endDate;
    });
}
export function updateBriefingFeedback(dataDir, briefingId, feedback) {
    const briefings = loadBriefings(dataDir);
    const index = briefings.findIndex((b) => b.id === briefingId);
    if (index === -1)
        return false;
    briefings[index].feedback = feedback;
    // Rewrite the file
    const filePath = getBriefingsPath(dataDir);
    const content = briefings.map((b) => JSON.stringify(b)).join('\n') + '\n';
    writeFileSync(filePath, content);
    return true;
}
export function getBriefingStats(dataDir) {
    const briefings = loadBriefings(dataDir);
    let totalCards = 0;
    let feedbackCount = 0;
    let helpfulCount = 0;
    for (const briefing of briefings) {
        totalCards += briefing.cards.length;
        if (briefing.feedback) {
            for (const [, value] of Object.entries(briefing.feedback.cardFeedback)) {
                feedbackCount++;
                if (value === 'helpful')
                    helpfulCount++;
            }
        }
    }
    return {
        totalBriefings: briefings.length,
        totalCards,
        feedbackCount,
        helpfulCount,
    };
}
/**
 * Get all briefings sorted by date (most recent first).
 */
export function getAllBriefings(dataDir) {
    const briefings = loadBriefings(dataDir);
    // Sort by date, most recent first
    briefings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return briefings;
}
/**
 * Get a single briefing by ID.
 */
export function getBriefing(dataDir, id) {
    const briefings = loadBriefings(dataDir);
    const briefing = briefings.find((b) => b.id === id);
    return briefing ? briefing : null;
}
//# sourceMappingURL=briefings.js.map