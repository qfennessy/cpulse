import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
const CONFIG_DIR = join(homedir(), '.cpulse');
const CONFIG_FILE = join(CONFIG_DIR, 'config.yaml');
const DATA_DIR = join(CONFIG_DIR, 'data');
const DEFAULT_CONFIG = {
    email: {
        to: '',
        from: '',
        send_time: '06:00',
        timezone: 'America/Los_Angeles',
        smtp: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: '',
                pass: '',
            },
        },
    },
    sources: {
        claude_code: {
            enabled: true,
            log_path: join(homedir(), '.claude'),
        },
        github: {
            enabled: true,
            repos: [],
            include_private: true,
        },
    },
    preferences: {
        article_style: 'concise',
        max_cards: 5,
        focus_topics: [],
        ignored_topics: [],
    },
};
export function ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (!existsSync(DATA_DIR)) {
        mkdirSync(DATA_DIR, { recursive: true });
    }
}
export function configExists() {
    return existsSync(CONFIG_FILE);
}
export function loadConfig() {
    ensureConfigDir();
    if (!existsSync(CONFIG_FILE)) {
        throw new Error(`Config file not found at ${CONFIG_FILE}. Run 'cpulse init' to create one.`);
    }
    const fileContents = readFileSync(CONFIG_FILE, 'utf8');
    // yaml.load returns undefined for empty files or files with only comments
    const userConfig = yaml.load(fileContents) || {};
    // Deep merge with defaults
    const config = {
        ...DEFAULT_CONFIG,
        ...userConfig,
        email: {
            ...DEFAULT_CONFIG.email,
            ...userConfig?.email,
            smtp: {
                ...DEFAULT_CONFIG.email.smtp,
                ...userConfig?.email?.smtp,
                auth: {
                    ...DEFAULT_CONFIG.email.smtp.auth,
                    ...userConfig?.email?.smtp?.auth,
                },
            },
        },
        sources: {
            ...DEFAULT_CONFIG.sources,
            ...userConfig?.sources,
            claude_code: {
                ...DEFAULT_CONFIG.sources.claude_code,
                ...userConfig?.sources?.claude_code,
            },
            github: {
                ...DEFAULT_CONFIG.sources.github,
                ...userConfig?.sources?.github,
            },
        },
        preferences: {
            ...DEFAULT_CONFIG.preferences,
            ...userConfig?.preferences,
        },
    };
    // Override with environment variables if set
    if (process.env.ANTHROPIC_API_KEY) {
        config.anthropic_api_key = process.env.ANTHROPIC_API_KEY;
    }
    // Support both GITHUB_PERSONAL_ACCESS_TOKEN (preferred) and GITHUB_TOKEN
    const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
    if (githubToken) {
        config.sources.github.token = githubToken;
    }
    config.data_dir = DATA_DIR;
    return config;
}
export function createDefaultConfig() {
    ensureConfigDir();
    const configContent = `# cpulse configuration
# See docs/cpulse-design.md for details

email:
  to: your-email@example.com
  from: your-email@example.com
  send_time: "06:00"
  timezone: "America/Los_Angeles"
  smtp:
    host: smtp.gmail.com
    port: 587
    secure: false
    auth:
      user: your-email@example.com
      pass: your-app-password  # Use an app password, not your account password

sources:
  claude_code:
    enabled: true
    log_path: ~/.claude/
  github:
    enabled: true
    repos: []  # Leave empty to include all repos you have access to
    include_private: true
    # token: ghp_xxx  # Or set GITHUB_TOKEN env var

preferences:
  article_style: concise  # or "detailed"
  max_cards: 5
  focus_topics: []
  ignored_topics: []

# anthropic_api_key: sk-xxx  # Or set ANTHROPIC_API_KEY env var
`;
    writeFileSync(CONFIG_FILE, configContent);
}
export function getConfigPath() {
    return CONFIG_FILE;
}
export function getDataDir() {
    return DATA_DIR;
}
//# sourceMappingURL=config.js.map