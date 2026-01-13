// Presentation module exports

export {
  prLink,
  prLinkWithTitle,
  commitLink,
  commitLinkWithMessage,
  fileLink,
  fileLinkWithLine,
  fileLinkWithRange,
  branchCompareLink,
  branchLink,
  issueLink,
  repoLink,
  linkifyGitHubReferences,
  formatPRList,
  formatCommitList,
  formatStaleBranchList,
  parseRepoString,
  type GitHubRepo,
} from './links.js';

export {
  buildNarrativeContext,
  generateOpeningNarrative,
  generateTransition,
  generateClosingNarrative,
  wrapWithNarratives,
  formatBriefingWithNarratives,
  type NarrativeContext,
} from './narratives.js';

export {
  markdownToEmailHtml,
  renderCardHtml,
  renderTransitionHtml,
  renderBriefingHtml,
  renderBriefingPlainText,
} from './html-template.js';
