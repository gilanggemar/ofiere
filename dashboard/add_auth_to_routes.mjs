import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, 'app', 'api');

// Recursively find all route.ts files
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

// Skip patterns - routes that already have auth or shouldn't be modified
const SKIP_PATTERNS = [
    'onboarding',  // Already has auth
];

function transformFile(filePath) {
    const relPath = path.relative(apiDir, filePath);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Skip if already has getAuthUserId
    if (content.includes('getAuthUserId')) {
        console.log(`SKIP (already has auth): ${relPath}`);
        return;
    }

    // Skip certain routes
    for (const pattern of SKIP_PATTERNS) {
        if (relPath.includes(pattern)) {
            console.log(`SKIP (excluded): ${relPath}`);
            return;
        }
    }

    // Calculate the relative import depth
    const depth = relPath.split(path.sep).length - 1;

    // Add the auth import at the top of the file
    const authImport = `import { getAuthUserId } from '@/lib/auth';\n`;

    // If file already has imports, add after the last import
    if (!content.includes("import { getAuthUserId }")) {
        const lastImportIdx = content.lastIndexOf("import ");
        if (lastImportIdx >= 0) {
            // Find end of the last import line
            const endOfImport = content.indexOf('\n', lastImportIdx);
            // Check if it's a multi-line import
            let insertIdx = endOfImport;
            // Handle multi-line imports by looking for the closing '}'
            const importLine = content.substring(lastImportIdx);
            if (importLine.includes('{') && !importLine.substring(0, importLine.indexOf('\n')).includes('}')) {
                // Multi-line import, find closing
                const closeIdx = content.indexOf('}', lastImportIdx);
                if (closeIdx >= 0) {
                    insertIdx = content.indexOf('\n', closeIdx);
                }
            }
            content = content.substring(0, insertIdx + 1) + authImport + content.substring(insertIdx + 1);
        } else {
            content = authImport + content;
        }
    }

    // Auth guard code to add at the beginning of each handler function
    const authGuard = `    const userId = await getAuthUserId();\n    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });\n\n`;

    // Find and update each export async function
    const handlerRegex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{/g;
    let match;
    let offset = 0;
    const newContent = [];
    let lastEnd = 0;

    const tempContent = content;
    while ((match = handlerRegex.exec(tempContent)) !== null) {
        const insertPoint = match.index + match[0].length;

        // Check if auth guard already exists after this function declaration
        const afterFunc = tempContent.substring(insertPoint, insertPoint + 200);
        if (afterFunc.includes('getAuthUserId')) {
            continue;
        }

        newContent.push(tempContent.substring(lastEnd, insertPoint));
        newContent.push('\n' + authGuard);
        lastEnd = insertPoint;
    }

    if (newContent.length > 0) {
        newContent.push(tempContent.substring(lastEnd));
        content = newContent.join('');
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`UPDATED: ${relPath}`);
}

// Main
const files = findRouteFiles(apiDir);
console.log(`Found ${files.length} route files\n`);

for (const file of files) {
    try {
        transformFile(file);
    } catch (err) {
        console.error(`ERROR ${path.relative(apiDir, file)}: ${err.message}`);
    }
}

console.log('\nDone!');
