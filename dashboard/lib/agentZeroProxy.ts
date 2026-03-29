/**
 * Agent Zero Proxy Utilities
 * 
 * Shared helper for all Agent Zero proxy routes.
 * Handles URL normalization and proper error messaging.
 * 
 * Agent Zero registers API routes under /api/<handler_filename>.
 * The handler files live in the `api/` directory of the Agent Zero codebase.
 * Example: api/api_message.py → /api/api_message
 * 
 * External API endpoints (require X-API-KEY header):
 *   POST /api/api_message        — Send messages
 *   GET/POST /api/api_log_get    — Retrieve logs
 *   POST /api/api_reset_chat     — Reset a chat context
 *   POST /api/api_terminate_chat — Terminate a chat
 *   POST /api/api_files_get      — Retrieve files
 *   POST /api/poll               — Poll for updates
 *   GET  /api/health             — Health check
 */

// ── Endpoint paths (matching Agent Zero's /api/<handler> routing) ────────

export const ENDPOINTS = {
    message:   '/api/api_message',
    logs:      '/api/api_log_get',
    reset:     '/api/api_reset_chat',
    terminate: '/api/api_terminate_chat',
    files:     '/api/api_files_get',
    poll:      '/api/poll',
    health:    '/api/health',
} as const;

export type EndpointName = keyof typeof ENDPOINTS;

/**
 * Normalize a base URL: remove trailing slashes and whitespace.
 */
export function normalizeBaseUrl(url: string): string {
    return url.trim().replace(/\/+$/, '');
}

/**
 * Clear any cached state. Called when connection settings change.
 */
export function clearPathCache(_baseUrl?: string) {
    // No-op for now — kept for API compatibility with callers
}

// ── Core fetch helper ───────────────────────────────────────────────────

export interface AgentZeroFetchOptions {
    baseUrl: string;
    apiKey: string;
    endpoint: EndpointName;
    method: 'GET' | 'POST';
    body?: Record<string, any>;
    queryParams?: URLSearchParams;
    timeoutMs?: number;
}

export interface AgentZeroFetchResult {
    ok: boolean;
    status: number;
    data?: any;
    errorText?: string;
    discoveredPath?: string;
}

/**
 * Fetch from Agent Zero with proper error handling and actionable messages.
 */
export async function fetchAgentZero(opts: AgentZeroFetchOptions): Promise<AgentZeroFetchResult> {
    const { baseUrl: rawUrl, apiKey, endpoint, method, body, queryParams, timeoutMs = 30000 } = opts;
    const baseUrl = normalizeBaseUrl(rawUrl);
    const path = ENDPOINTS[endpoint];
    const qs = queryParams ? `?${queryParams.toString()}` : '';
    const url = `${baseUrl}${path}${qs}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const headers: Record<string, string> = {
            'X-API-KEY': apiKey,
        };
        if (method === 'POST') {
            headers['Content-Type'] = 'application/json';
        }

        const fetchOpts: RequestInit = {
            method,
            headers,
            signal: controller.signal,
        };
        if (body && method === 'POST') {
            fetchOpts.body = JSON.stringify(body);
        }

        console.log(`[AgentZeroProxy] ${method} ${url}`);
        const response = await fetch(url, fetchOpts);
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return { ok: true, status: response.status, data, discoveredPath: path };
        }

        // Non-OK response — get error details
        const errorText = await response.text().catch(() => 'Unknown error');

        // Provide specific actionable error messages based on status
        let actionableError = errorText;
        switch (response.status) {
            case 401:
            case 403:
                actionableError = `Authentication failed (HTTP ${response.status}). Your API key may be invalid or expired. ` +
                    `Get a new API key from Agent Zero → Settings → External Services, then update it in Settings → Connection Profiles.`;
                break;
            case 405:
                actionableError = `Method Not Allowed (HTTP 405) on ${path}. This usually means your Agent Zero instance ` +
                    `has been updated and the API format changed. Check that Agent Zero is fully started and your ` +
                    `base URL (${baseUrl}) is correct. If Agent Zero is behind a reverse proxy, make sure POST requests are forwarded. ` +
                    `Server response: ${errorText}`;
                break;
            case 502:
            case 503:
            case 504:
                actionableError = `Agent Zero server error (HTTP ${response.status}). The server might be starting up, overloaded, or ` +
                    `behind a reverse proxy that's failing. Try again in a moment. Details: ${errorText}`;
                break;
        }

        console.error(`[AgentZeroProxy] ${method} ${url} → ${response.status}: ${errorText}`);
        return { ok: false, status: response.status, errorText: actionableError, discoveredPath: path };

    } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            return {
                ok: false,
                status: 0,
                errorText: `Request timed out after ${timeoutMs / 1000}s. Agent Zero may be processing a complex task or not responding.`,
            };
        }

        console.error(`[AgentZeroProxy] Network error for ${method} ${url}:`, err.message);
        return {
            ok: false,
            status: 0,
            errorText: `Cannot connect to Agent Zero at ${baseUrl}. Error: ${err.message}. ` +
                `Check that the Base URL is correct and Agent Zero is running.`,
        };
    }
}

// ── Health Probe ────────────────────────────────────────────────────────

export interface HealthProbeResult {
    reachable: boolean;
    authenticated: boolean;
    serverVersion?: string;
    error?: string;
    latencyMs: number;
    workingMessagePath?: string;
    httpStatus?: number;
}

/**
 * Comprehensive health check:
 * 1. GET / — is the server reachable?
 * 2. POST /api/api_message with a ping — is the API key valid?
 */
export async function probeAgentZeroHealth(
    baseUrl: string,
    apiKey: string,
): Promise<HealthProbeResult> {
    const normalizedUrl = normalizeBaseUrl(baseUrl);
    const start = Date.now();

    // Step 1: Basic reachability (GET /)
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(`${normalizedUrl}/`, { signal: controller.signal });
        clearTimeout(timeout);

        // Any response (even 404/405) means the server is reachable
        // Only treat actual connection failures as "unreachable"
    } catch (err: any) {
        return {
            reachable: false,
            authenticated: false,
            error: err.name === 'AbortError'
                ? 'Connection timed out — is the URL and port correct?'
                : `Cannot reach server: ${err.message}. Check that the Base URL is correct and Agent Zero is running.`,
            latencyMs: Date.now() - start,
        };
    }

    // Step 2: Auth validation — try POST /api_message
    if (!apiKey) {
        return {
            reachable: true,
            authenticated: false,
            error: 'No API key configured. Enter your Agent Zero API key from Settings → External Services.',
            latencyMs: Date.now() - start,
        };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const resp = await fetch(`${normalizedUrl}/api/api_message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey,
            },
            body: JSON.stringify({
                message: 'ping',
                context_id: `nerv-health-${Date.now()}`,
                lifetime_hours: 0,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        // 401/403 means the path works but auth failed
        if (resp.status === 401 || resp.status === 403) {
            return {
                reachable: true,
                authenticated: false,
                error: 'API key is invalid or expired. Get a new key from Agent Zero → Settings → External Services.',
                latencyMs: Date.now() - start,
                workingMessagePath: '/api/api_message',
                httpStatus: resp.status,
            };
        }

        // 405 means the server is there but something is wrong with requests
        if (resp.status === 405) {
            return {
                reachable: true,
                authenticated: false,
                error: `Server returned 405 Method Not Allowed on /api/api_message. ` +
                    `This usually means Agent Zero is still starting up, or a reverse proxy is blocking POST requests. ` +
                    `Try restarting Agent Zero and ensure POST requests reach the application.`,
                latencyMs: Date.now() - start,
                workingMessagePath: '/api/api_message',
                httpStatus: 405,
            };
        }

        // Any 2xx or 4xx (other than 401/403/405) means auth is OK
        return {
            reachable: true,
            authenticated: resp.ok || resp.status === 400, // 400 might mean bad ping format but auth passed
            latencyMs: Date.now() - start,
            workingMessagePath: '/api/api_message',
            httpStatus: resp.status,
        };

    } catch (err: any) {
        if (err.name === 'AbortError') {
            return {
                reachable: true,
                authenticated: false,
                error: 'Auth check timed out — Agent Zero may be overloaded or starting up.',
                latencyMs: Date.now() - start,
            };
        }
        return {
            reachable: true,
            authenticated: false,
            error: `Server reachable but API test failed: ${err.message}`,
            latencyMs: Date.now() - start,
        };
    }
}
