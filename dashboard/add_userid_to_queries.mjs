import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, 'app', 'api');

function findRouteFiles(dir) {
    let results = [];
    for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
            results = results.concat(findRouteFiles(full));
        } else if (item === 'route.ts') {
            results.push(full);
        }
    }
    return results;
}

// Routes that shouldn't have user_id scoping (e.g., proxy routes that don't touch DB)
const SKIP_PATTERNS = [
    'onboarding',      // Already scoped
    'agent-zero',      // Proxy to Agent Zero, no DB queries
    'openclaw-proxy',  // Proxy to OpenClaw, no DB queries
    'v1',              // External API with API key auth (needs separate handling)
];

function addUserIdScoping(filePath) {
    const relPath = path.relative(apiDir, filePath);
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    // Skip certain routes
    for (const pattern of SKIP_PATTERNS) {
        if (relPath.startsWith(pattern + '\\') || relPath.startsWith(pattern + '/') || relPath === pattern + '\\route.ts') {
            console.log(`SKIP: ${relPath}`);
            return;
        }
    }

    // Only process files that use db.from() (Supabase client)
    if (!content.includes('db.from(') && !content.includes("db.from('")) {
        console.log(`SKIP (no db.from): ${relPath}`);
        return;
    }

    // Pattern 1: Add .eq('user_id', userId) to SELECT queries
    // Match: db.from('table').select(...)  but NOT already having .eq('user_id'
    // We need to add .eq('user_id', userId) before the final method call (.single(), .order(), etc.)

    // Pattern 2: Add user_id: userId to INSERT objects
    // Match: .insert({ ... }) → add user_id: userId

    // Pattern 3: Add .eq('user_id', userId) to UPDATE queries
    // Pattern 4: Add .eq('user_id', userId) to DELETE queries

    // Simple approach: Add .eq('user_id', userId) after db.from('xxx').select/update/delete chains
    // and add user_id to insert objects

    // For SELECT chains: add .eq('user_id', userId) right after .select(...)
    // For UPDATE chains: add .eq('user_id', userId) at the end
    // For DELETE chains: add .eq('user_id', userId) at the end
    // For INSERT: add user_id: userId to the insert object

    // Let's do targeted replacements

    // Add .eq('user_id', userId) to select chains that don't already have it
    // Pattern: db.from('xxx').select('yyy')  -> db.from('xxx').select('yyy').eq('user_id', userId)
    const selectPattern = /(db\.from\('[^']+'\)\.select\([^)]*\))(?![\s\S]{0,50}\.eq\('user_id')/g;
    const newContent1 = content.replace(selectPattern, (match) => {
        changed = true;
        return match + `.eq('user_id', userId)`;
    });
    content = newContent1;

    // Add .eq('user_id', userId) to delete chains that don't already have it
    // Pattern: db.from('xxx').delete()  -> db.from('xxx').delete().eq('user_id', userId)
    const deletePattern = /(db\.from\('[^']+'\)\.delete\(\))(?![\s\S]{0,30}\.eq\('user_id')/g;
    content = content.replace(deletePattern, (match) => {
        changed = true;
        return match + `.eq('user_id', userId)`;
    });

    // Add user_id: userId to insert objects
    // Pattern: .insert({ ... })  -> .insert({ user_id: userId, ... })
    // This is tricky with regex. Let's do a simple approach:
    // Find .insert({ and add user_id: userId right after the {
    const insertPattern = /\.insert\(\{(?!\s*user_id)/g;
    content = content.replace(insertPattern, (match) => {
        changed = true;
        return '.insert({ user_id: userId,';
    });

    // Also handle .insert([{ pattern for array inserts
    const insertArrayPattern = /\.insert\(\[\{(?!\s*user_id)/g;
    content = content.replace(insertArrayPattern, (match) => {
        changed = true;
        return '.insert([{ user_id: userId,';
    });

    // Add .eq('user_id', userId) to update().eq() chains - add before the first .eq()
    // Pattern: db.from('xxx').update({...}).eq(  -> db.from('xxx').update({...}).eq('user_id', userId).eq(
    // But we should add it at the END of the chain, not in the middle.
    // Actually, for updates we need user_id in the filter, so let's add it to the chain
    const updatePattern = /(db\.from\('[^']+'\)\.update\(\{[^}]*\}\))(?![\s\S]{0,50}\.eq\('user_id')/g;
    content = content.replace(updatePattern, (match) => {
        changed = true;
        return match + `.eq('user_id', userId)`;
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`SCOPED: ${relPath}`);
    } else {
        console.log(`NO CHANGES: ${relPath}`);
    }
}

const files = findRouteFiles(apiDir);
console.log(`Found ${files.length} route files\n`);

for (const file of files) {
    try {
        addUserIdScoping(file);
    } catch (err) {
        console.error(`ERROR ${path.relative(apiDir, file)}: ${err.message}`);
    }
}

console.log('\nDone!');
