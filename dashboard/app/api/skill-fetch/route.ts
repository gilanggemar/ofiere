import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/skill-fetch
 * Server-side proxy to fetch skill content from external URLs (avoids CORS).
 * 
 * Handles:
 * - GitHub repo URLs (https://github.com/owner/repo or https://github.com/owner/repo.git)
 *   → Uses GitHub API to discover files, fetch SKILL.md + all .md files
 * - GitHub raw file URLs (raw.githubusercontent.com)
 * - skill.sh links
 * - Any direct file URL
 */

const GITHUB_API = 'https://api.github.com';

interface RepoInfo {
    owner: string;
    repo: string;
    branch?: string;
    path?: string;
}

/** Parse a GitHub URL into owner/repo/branch/path */
function parseGitHubUrl(url: string): RepoInfo | null {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();

        // github.com URLs
        if (host === 'github.com') {
            // Remove .git suffix if present
            const cleanPath = u.pathname.replace(/\.git$/, '');
            const parts = cleanPath.split('/').filter(Boolean);

            if (parts.length < 2) return null;

            const owner = parts[0];
            const repo = parts[1];

            // https://github.com/owner/repo
            if (parts.length === 2) {
                return { owner, repo };
            }

            // https://github.com/owner/repo/tree/branch/path...
            if (parts[2] === 'tree' && parts.length >= 4) {
                return {
                    owner,
                    repo,
                    branch: parts[3],
                    path: parts.slice(4).join('/') || undefined,
                };
            }

            // https://github.com/owner/repo/blob/branch/path...
            if (parts[2] === 'blob' && parts.length >= 4) {
                return {
                    owner,
                    repo,
                    branch: parts[3],
                    path: parts.slice(4).join('/') || undefined,
                };
            }

            return { owner, repo };
        }

        // raw.githubusercontent.com/owner/repo/branch/path
        if (host === 'raw.githubusercontent.com') {
            const parts = u.pathname.split('/').filter(Boolean);
            if (parts.length < 3) return null;
            return {
                owner: parts[0],
                repo: parts[1],
                branch: parts[2],
                path: parts.slice(3).join('/') || undefined,
            };
        }

        return null;
    } catch {
        return null;
    }
}

/** Fetch with timeout and GitHub-friendly headers */
async function ghFetch(url: string, token?: string): Promise<Response> {
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ofiere-OS-Dashboard/1.0',
    };
    if (token) {
        headers['Authorization'] = `token ${token}`;
    }

    return fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000),
    });
}

/** Fetch raw file content from GitHub */
async function fetchRawContent(owner: string, repo: string, branch: string, path: string): Promise<string> {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    const res = await fetch(rawUrl, {
        headers: { 'User-Agent': 'ofiere-OS-Dashboard/1.0' },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    return res.text();
}

/** Extract name/description from SKILL.md content */
function extractSkillMeta(content: string, fallbackName: string) {
    let name = '';
    let description = '';

    const nameMatch = content.match(/^---[\s\S]*?name:\s*(.+?)$/m);
    if (nameMatch) {
        name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    } else {
        const headingMatch = content.match(/^#\s+(.+)$/m);
        if (headingMatch) name = headingMatch[1].trim();
    }

    const descMatch = content.match(/^---[\s\S]*?description:\s*(.+?)$/m);
    if (descMatch) {
        description = descMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    if (!name) name = fallbackName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (!description) {
        const lines = content.split('\n');
        const descLine = lines.find(l =>
            l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('```')
        );
        description = descLine?.trim().slice(0, 200) || 'No description';
    }

    return { name, description };
}

/** Fetch the full skill from a GitHub repo */
async function fetchGitHubRepo(info: RepoInfo) {
    const { owner, repo } = info;

    // 1. Get default branch if not specified
    let branch: string = info.branch || '';
    if (!branch) {
        const repoRes = await ghFetch(`${GITHUB_API}/repos/${owner}/${repo}`);
        if (!repoRes.ok) {
            throw new Error(`Repository not found: ${owner}/${repo} (${repoRes.status})`);
        }
        const repoData = await repoRes.json();
        branch = repoData.default_branch || 'main';
    }

    // 2. Get the file tree
    const treePath = info.path ? `${info.path}` : '';
    const treeRes = await ghFetch(
        `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
    );

    if (!treeRes.ok) {
        throw new Error(`Failed to fetch repository tree: ${treeRes.status}`);
    }

    const treeData = await treeRes.json();
    const allFiles: Array<{ path: string; size: number }> = (treeData.tree || [])
        .filter((item: any) => item.type === 'blob')
        .map((item: any) => ({ path: item.path, size: item.size || 0 }));

    // If a subpath was specified, filter to only files within that path
    const files = treePath
        ? allFiles.filter(f => f.path.startsWith(treePath + '/') || f.path === treePath)
        : allFiles;

    // 3. Detect multi-skill repos: look for skills/*/SKILL.md or */SKILL.md pattern
    const skillMdFiles = files.filter(f => {
        const parts = f.path.split('/');
        const fileName = parts[parts.length - 1]?.toLowerCase();
        return fileName === 'skill.md' && parts.length >= 2; // must be in a subdirectory
    });

    // If we found multiple SKILL.md files in subdirectories, this is a multi-skill repo
    if (skillMdFiles.length > 1) {
        // Fetch all skills in parallel (limit to 50 for safety)
        const skillPromises = skillMdFiles.slice(0, 50).map(async (f) => {
            try {
                const content = await fetchRawContent(owner, repo, branch, f.path);
                // Derive key from the parent directory name (e.g., skills/cold-email/SKILL.md → cold-email)
                const parts = f.path.split('/');
                const dirName = parts[parts.length - 2] || repo;
                const key = dirName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                const meta = extractSkillMeta(content, dirName);

                return {
                    key,
                    name: meta.name,
                    description: meta.description,
                    content,
                };
            } catch {
                return null;
            }
        });

        const results = (await Promise.all(skillPromises)).filter(Boolean);

        return {
            multiSkill: true,
            repoName: repo,
            repoUrl: `https://github.com/${owner}/${repo}`,
            source: 'github' as const,
            skills: results,
            totalSkills: results.length,
        };
    }

    // 4. Single skill repo — find the one SKILL.md or README.md
    let skillContent = '';
    let skillName = '';
    let description = '';

    const singleSkillMd = skillMdFiles[0] || files.find(f => {
        const name = f.path.split('/').pop()?.toLowerCase();
        return name === 'skill.md';
    });

    if (singleSkillMd) {
        skillContent = await fetchRawContent(owner, repo, branch, singleSkillMd.path);
        const meta = extractSkillMeta(skillContent, repo);
        skillName = meta.name;
        description = meta.description;
    }

    // If no SKILL.md, try README.md
    if (!skillContent) {
        const readmeFile = files.find(f => {
            const name = f.path.split('/').pop()?.toLowerCase();
            return name === 'readme.md';
        });

        if (readmeFile) {
            skillContent = await fetchRawContent(owner, repo, branch, readmeFile.path);
            const meta = extractSkillMeta(skillContent, repo);
            skillName = meta.name;
            description = meta.description;
        }
    }

    // If still nothing, concatenate all .md files
    const mdFiles = files.filter(f => /\.(md|txt)$/i.test(f.path));
    if (!skillContent && mdFiles.length > 0) {
        const contents = await Promise.all(
            mdFiles.slice(0, 10).map(f => 
                fetchRawContent(owner, repo, branch, f.path).catch(() => '')
            )
        );
        skillContent = contents.filter(Boolean).join('\n\n---\n\n');
    }

    if (!skillName) skillName = repo.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (!description) description = `Skill from ${owner}/${repo}`;

    return {
        multiSkill: false,
        content: skillContent,
        description,
        name: skillName,
        source: 'github' as const,
        url: `https://github.com/${owner}/${repo}`,
        key: repo.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid URL' }, { status: 400 });
        }

        // Validate URL
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch {
            return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
        }

        // Route 1: GitHub repository URL
        const ghInfo = parseGitHubUrl(url);
        if (ghInfo) {
            // Check if this is a direct file link (has a file extension in path)
            const isDirectFile = ghInfo.path && /\.\w+$/.test(ghInfo.path);

            if (isDirectFile && ghInfo.branch && ghInfo.path) {
                // Direct file — fetch raw content
                const content = await fetchRawContent(ghInfo.owner, ghInfo.repo, ghInfo.branch, ghInfo.path);
                const fileName = ghInfo.path.split('/').pop() || 'skill';
                const key = fileName.replace(/\.\w+$/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-');

                const lines = content.split('\n');
                const descLine = lines.find(l =>
                    l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('```')
                );

                return NextResponse.json({
                    content,
                    description: descLine?.trim().slice(0, 200) || 'No description available',
                    source: 'github',
                    url,
                    name: key.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    key,
                });
            }

            // Full repo — discover and aggregate skill files
            try {
                const result = await fetchGitHubRepo(ghInfo);
                return NextResponse.json(result);
            } catch (err: any) {
                console.error('[skill-fetch] GitHub repo fetch error:', err);
                return NextResponse.json(
                    { error: err.message || 'Failed to fetch GitHub repository' },
                    { status: 502 }
                );
            }
        }

        // Route 2: Direct URL fetch (skill.sh, raw files, etc.)
        const response = await fetch(url, {
            headers: {
                'Accept': 'text/plain, text/markdown, application/octet-stream, */*',
                'User-Agent': 'ofiere-OS-Dashboard/1.0',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch: ${response.status} ${response.statusText}` },
                { status: response.status }
            );
        }

        const content = await response.text();

        // Extract description from first paragraph or YAML frontmatter
        const lines = content.split('\n');
        const descLine = lines.find(l =>
            l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('```')
        );
        const description = descLine?.trim().slice(0, 200) || 'No description available';

        // Detect source type
        let source: 'github' | 'skill.sh' | 'manual' = 'manual';
        if (parsedUrl.hostname.includes('github') || parsedUrl.hostname.includes('githubusercontent')) {
            source = 'github';
        } else if (parsedUrl.hostname.includes('skill.sh')) {
            source = 'skill.sh';
        }

        return NextResponse.json({
            content,
            description,
            source,
            url,
        });
    } catch (err: any) {
        console.error('[skill-fetch] Error:', err);
        return NextResponse.json(
            { error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
