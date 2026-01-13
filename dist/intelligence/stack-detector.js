import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Detect the tech stack from project files.
 * Scans for common dependency/config files and extracts technology information.
 */
export function detectTechStack(projectPaths) {
    const stack = {
        languages: new Set(),
        frameworks: new Set(),
        databases: new Set(),
        cloudProvider: undefined,
        cloudServices: new Set(),
        dependencies: [],
        detectedFrom: [],
    };

    // Get unique project roots
    const projectRoots = new Set();
    for (const path of projectPaths) {
        // Try to find project root (where package.json etc. would be)
        let current = path;
        for (let i = 0; i < 5; i++) {
            if (existsSync(join(current, 'package.json')) ||
                existsSync(join(current, 'requirements.txt')) ||
                existsSync(join(current, 'go.mod'))) {
                projectRoots.add(current);
                break;
            }
            const parent = dirname(current);
            if (parent === current) break;
            current = parent;
        }
    }

    for (const root of projectRoots) {
        // Node.js / JavaScript / TypeScript
        detectNodeStack(root, stack);

        // Python
        detectPythonStack(root, stack);

        // Go
        detectGoStack(root, stack);

        // Ruby
        detectRubyStack(root, stack);

        // Rust
        detectRustStack(root, stack);

        // Cloud providers
        detectCloudProvider(root, stack);
    }

    // Convert sets to arrays for the final result
    return {
        languages: Array.from(stack.languages),
        frameworks: Array.from(stack.frameworks),
        databases: Array.from(stack.databases),
        cloudProvider: stack.cloudProvider,
        cloudServices: Array.from(stack.cloudServices),
        dependencies: stack.dependencies,
        detectedFrom: stack.detectedFrom,
    };
}

function detectNodeStack(root, stack) {
    const packageJsonPath = join(root, 'package.json');
    if (!existsSync(packageJsonPath)) return;

    try {
        const content = readFileSync(packageJsonPath, 'utf8');
        const pkg = JSON.parse(content);
        stack.detectedFrom.push(packageJsonPath);

        // Detect language
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (allDeps['typescript'] || existsSync(join(root, 'tsconfig.json'))) {
            stack.languages.add('TypeScript');
        } else {
            stack.languages.add('JavaScript');
        }

        // Detect frameworks
        const frameworkMap = {
            'react': 'React',
            'next': 'Next.js',
            'vue': 'Vue',
            'nuxt': 'Nuxt',
            'angular': 'Angular',
            'express': 'Express',
            'fastify': 'Fastify',
            'koa': 'Koa',
            'hono': 'Hono',
            'svelte': 'Svelte',
            '@sveltejs/kit': 'SvelteKit',
            'solid-js': 'Solid',
            'astro': 'Astro',
            'remix': 'Remix',
        };

        for (const [dep, framework] of Object.entries(frameworkMap)) {
            if (allDeps[dep]) {
                stack.frameworks.add(framework);
            }
        }

        // Detect databases
        const dbMap = {
            'firebase-admin': 'Firestore',
            '@google-cloud/firestore': 'Firestore',
            'mongodb': 'MongoDB',
            'mongoose': 'MongoDB',
            'pg': 'PostgreSQL',
            'mysql2': 'MySQL',
            'redis': 'Redis',
            'ioredis': 'Redis',
            '@prisma/client': 'Prisma',
            'sequelize': 'SQL (Sequelize)',
            'typeorm': 'SQL (TypeORM)',
            'drizzle-orm': 'SQL (Drizzle)',
            '@supabase/supabase-js': 'Supabase',
            '@planetscale/database': 'PlanetScale',
        };

        for (const [dep, db] of Object.entries(dbMap)) {
            if (allDeps[dep]) {
                stack.databases.add(db);
            }
        }

        // Detect cloud services
        const cloudMap = {
            '@google-cloud/storage': 'Cloud Storage',
            '@google-cloud/pubsub': 'Cloud Pub/Sub',
            '@google-cloud/functions-framework': 'Cloud Functions',
            '@google-cloud/run': 'Cloud Run',
            'firebase-functions': 'Firebase Functions',
            '@aws-sdk/client-s3': 'S3',
            '@aws-sdk/client-lambda': 'Lambda',
            '@aws-sdk/client-dynamodb': 'DynamoDB',
            '@azure/storage-blob': 'Azure Blob Storage',
        };

        for (const [dep, service] of Object.entries(cloudMap)) {
            if (allDeps[dep]) {
                stack.cloudServices.add(service);
            }
        }

        // Extract key dependencies for context
        const keyDeps = [
            '@anthropic-ai/sdk',
            'openai',
            'langchain',
            '@langchain/core',
            'octokit',
            '@octokit/rest',
            'zod',
            'joi',
            'yup',
            'nodemailer',
            'resend',
            '@sendgrid/mail',
        ];

        for (const dep of keyDeps) {
            if (allDeps[dep]) {
                stack.dependencies.push({
                    name: dep,
                    version: allDeps[dep],
                });
            }
        }
    } catch (e) {
        // Ignore parse errors
    }
}

function detectPythonStack(root, stack) {
    const requirementsPath = join(root, 'requirements.txt');
    const pyprojectPath = join(root, 'pyproject.toml');

    if (existsSync(requirementsPath)) {
        try {
            const content = readFileSync(requirementsPath, 'utf8');
            stack.detectedFrom.push(requirementsPath);
            stack.languages.add('Python');

            // Simple pattern matching for common packages
            if (content.includes('django')) stack.frameworks.add('Django');
            if (content.includes('flask')) stack.frameworks.add('Flask');
            if (content.includes('fastapi')) stack.frameworks.add('FastAPI');
            if (content.includes('firebase-admin')) stack.databases.add('Firestore');
            if (content.includes('psycopg')) stack.databases.add('PostgreSQL');
            if (content.includes('pymongo')) stack.databases.add('MongoDB');
            if (content.includes('redis')) stack.databases.add('Redis');
            if (content.includes('anthropic')) {
                stack.dependencies.push({ name: 'anthropic', version: 'unknown' });
            }
        } catch (e) {
            // Ignore
        }
    }

    if (existsSync(pyprojectPath)) {
        stack.detectedFrom.push(pyprojectPath);
        stack.languages.add('Python');
    }
}

function detectGoStack(root, stack) {
    const goModPath = join(root, 'go.mod');
    if (!existsSync(goModPath)) return;

    try {
        const content = readFileSync(goModPath, 'utf8');
        stack.detectedFrom.push(goModPath);
        stack.languages.add('Go');

        if (content.includes('gin-gonic/gin')) stack.frameworks.add('Gin');
        if (content.includes('labstack/echo')) stack.frameworks.add('Echo');
        if (content.includes('gofiber/fiber')) stack.frameworks.add('Fiber');
        if (content.includes('cloud.google.com/go')) {
            stack.cloudServices.add('GCP SDK');
        }
    } catch (e) {
        // Ignore
    }
}

function detectRubyStack(root, stack) {
    const gemfilePath = join(root, 'Gemfile');
    if (!existsSync(gemfilePath)) return;

    try {
        const content = readFileSync(gemfilePath, 'utf8');
        stack.detectedFrom.push(gemfilePath);
        stack.languages.add('Ruby');

        if (content.includes('rails')) stack.frameworks.add('Rails');
        if (content.includes('sinatra')) stack.frameworks.add('Sinatra');
        if (content.includes('pg')) stack.databases.add('PostgreSQL');
        if (content.includes('redis')) stack.databases.add('Redis');
    } catch (e) {
        // Ignore
    }
}

function detectRustStack(root, stack) {
    const cargoPath = join(root, 'Cargo.toml');
    if (!existsSync(cargoPath)) return;

    try {
        const content = readFileSync(cargoPath, 'utf8');
        stack.detectedFrom.push(cargoPath);
        stack.languages.add('Rust');

        if (content.includes('actix-web')) stack.frameworks.add('Actix');
        if (content.includes('axum')) stack.frameworks.add('Axum');
        if (content.includes('tokio-postgres')) stack.databases.add('PostgreSQL');
    } catch (e) {
        // Ignore
    }
}

function detectCloudProvider(root, stack) {
    // Check for GCP
    const gcpFiles = [
        'app.yaml',
        'cloudbuild.yaml',
        '.gcloudignore',
        'firebase.json',
    ];
    for (const file of gcpFiles) {
        if (existsSync(join(root, file))) {
            stack.cloudProvider = 'gcp';
            stack.detectedFrom.push(join(root, file));
            break;
        }
    }

    // Check for AWS
    const awsFiles = [
        'serverless.yml',
        'serverless.yaml',
        'samconfig.toml',
        '.aws',
        'cdk.json',
    ];
    if (!stack.cloudProvider) {
        for (const file of awsFiles) {
            if (existsSync(join(root, file))) {
                stack.cloudProvider = 'aws';
                stack.detectedFrom.push(join(root, file));
                break;
            }
        }
    }

    // Check for Azure
    const azureFiles = [
        'azure-pipelines.yml',
        '.azure',
        'host.json', // Azure Functions
    ];
    if (!stack.cloudProvider) {
        for (const file of azureFiles) {
            if (existsSync(join(root, file))) {
                stack.cloudProvider = 'azure';
                stack.detectedFrom.push(join(root, file));
                break;
            }
        }
    }

    // Infer from detected services
    if (!stack.cloudProvider) {
        const services = Array.from(stack.cloudServices);
        if (services.some(s => s.includes('Cloud') || s.includes('Firebase') || s.includes('Firestore'))) {
            stack.cloudProvider = 'gcp';
        } else if (services.some(s => ['S3', 'Lambda', 'DynamoDB'].includes(s))) {
            stack.cloudProvider = 'aws';
        } else if (services.some(s => s.includes('Azure'))) {
            stack.cloudProvider = 'azure';
        }
    }
}

/**
 * Format tech stack for display or prompts.
 */
export function formatTechStack(stack) {
    const lines = [];

    if (stack.languages.length > 0) {
        lines.push(`Languages: ${stack.languages.join(', ')}`);
    }
    if (stack.frameworks.length > 0) {
        lines.push(`Frameworks: ${stack.frameworks.join(', ')}`);
    }
    if (stack.databases.length > 0) {
        lines.push(`Databases: ${stack.databases.join(', ')}`);
    }
    if (stack.cloudProvider) {
        lines.push(`Cloud: ${stack.cloudProvider.toUpperCase()}`);
    }
    if (stack.cloudServices.length > 0) {
        lines.push(`Cloud Services: ${stack.cloudServices.join(', ')}`);
    }
    if (stack.dependencies.length > 0) {
        const depNames = stack.dependencies.map(d => d.name).join(', ');
        lines.push(`Key Dependencies: ${depNames}`);
    }

    return lines.join('\n');
}

/**
 * Generate a hash of the stack for caching purposes.
 */
export function hashTechStack(stack) {
    const key = [
        ...stack.languages,
        ...stack.frameworks,
        ...stack.databases,
        stack.cloudProvider || '',
        ...stack.cloudServices,
    ].sort().join('|');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}
//# sourceMappingURL=stack-detector.js.map
