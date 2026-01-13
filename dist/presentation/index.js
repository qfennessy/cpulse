// Presentation module exports
export { prLink, prLinkWithTitle, commitLink, commitLinkWithMessage, fileLink, fileLinkWithLine, fileLinkWithRange, branchCompareLink, branchLink, issueLink, repoLink, linkifyGitHubReferences, formatPRList, formatCommitList, formatStaleBranchList, parseRepoString, } from './links.js';
export { buildNarrativeContext, generateOpeningNarrative, generateTransition, generateClosingNarrative, wrapWithNarratives, formatBriefingWithNarratives, } from './narratives.js';
export { markdownToEmailHtml, renderCardHtml, renderTransitionHtml, renderBriefingHtml, renderBriefingPlainText, } from './html-template.js';
export { markdownToAnsi, renderCardTerminal, renderBriefingTerminal, formatMarkdownForTerminal, } from './terminal.js';
//# sourceMappingURL=index.js.map