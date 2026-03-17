import { pgTable, text, integer, real, boolean, bigint, jsonb, timestamp } from 'drizzle-orm/pg-core';

// ─── 1. Agent System ─────────────────────────────────────────────────────────

export const agents = pgTable('agents', {
    id: text('id').primaryKey(),
    name: text('name'),
    codename: text('codename'),
    role: text('role'),
    avatar: text('avatar'),
    heroImage: text('hero_image'),
    backgroundImage: text('background_image'),
    specialty: jsonb('specialty').default([]),
    temperature: real('temperature').default(0.7),
    status: text('status').default('OFFLINE'),
    activeHeroIndex: integer('active_hero_index').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const heroImages = pgTable('hero_images', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    imageData: text('image_data').notNull(),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const agentProviderConfig = pgTable('agent_provider_config', {
    agentId: text('agent_id').primaryKey().references(() => agents.id, { onDelete: 'cascade' }),
    primaryProviderId: text('primary_provider_id'),
    backupProviderId: text('backup_provider_id'),
    modelId: text('model_id'),
    configJson: jsonb('config_json').default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const agentXP = pgTable('agent_xp', {
    agentId: text('agent_id').primaryKey().references(() => agents.id, { onDelete: 'cascade' }),
    totalXp: integer('total_xp').notNull().default(0),
    level: integer('level').notNull().default(1),
    xpToNextLevel: integer('xp_to_next_level').notNull().default(100),
    rank: text('rank').notNull().default('INITIATE'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── 2. Task & Summit System ─────────────────────────────────────────────────

export const tasks = pgTable('tasks', {
    id: text('id').primaryKey(),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('PENDING'),
    priority: integer('priority').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const taskLogs = pgTable('task_logs', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
});

export const summits = pgTable('summits', {
    id: text('id').primaryKey(),
    topic: text('topic').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    consensusPlan: text('consensus_plan'),
    participatingAgents: jsonb('participating_agents').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const summitMessages = pgTable('summit_messages', {
    id: text('id').primaryKey(),
    summitId: text('summit_id').notNull().references(() => summits.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    roundNumber: integer('round_number').default(1),
    sentiment: text('sentiment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── 3. Provider System ──────────────────────────────────────────────────────

export const providers = pgTable('providers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    encryptedApiKey: text('encrypted_api_key'),
    baseUrl: text('base_url'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const providerModels = pgTable('provider_models', {
    id: text('id').primaryKey(),
    providerId: text('provider_id').notNull().references(() => providers.id, { onDelete: 'cascade' }),
    modelId: text('model_id').notNull(),
    displayName: text('display_name'),
    contextWindow: integer('context_window'),
    pricingInput: real('pricing_input'),
    pricingOutput: real('pricing_output'),
    supportsVision: boolean('supports_vision').default(false),
    supportsTools: boolean('supports_tools').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── 4. Telemetry & Audit ────────────────────────────────────────────────────

export const telemetryLogs = pgTable('telemetry_logs', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    provider: text('provider'),
    model: text('model'),
    inputTokens: integer('input_tokens').default(0),
    outputTokens: integer('output_tokens').default(0),
    costUsd: real('cost_usd').default(0),
    latencyMs: integer('latency_ms').default(0),
    status: text('status').default('success'),
    sessionId: text('session_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    agentId: text('agent_id'),
    action: text('action').notNull(),
    details: text('details'),
    diffPayload: text('diff_payload'),
    sessionId: text('session_id'),
    summitId: text('summit_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── 5. Memory System ────────────────────────────────────────────────────────

export const conversations = pgTable('conversations', {
    id: text('id').primaryKey(),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    title: text('title'),
    messageCount: integer('message_count').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const conversationMessages = pgTable('conversation_messages', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const knowledgeFragments = pgTable('knowledge_fragments', {
    id: text('id').primaryKey(),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    source: text('source').notNull().default('manual'),
    tags: jsonb('tags').default([]),
    importance: integer('importance').default(5),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const knowledgeDocuments = pgTable('knowledge_documents', {
    id: text('id').primaryKey(),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    fileType: text('file_type'),
    content: text('content'),
    sizeBytes: integer('size_bytes').default(0),
    indexed: boolean('indexed').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── 6. Workflow System ──────────────────────────────────────────────────────

export const workflows = pgTable('workflows', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    steps: jsonb('steps').notNull().default([]),
    schedule: jsonb('schedule'),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const workflowRuns = pgTable('workflow_runs', {
    id: text('id').primaryKey(),
    workflowId: text('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('running'),
    stepResults: jsonb('step_results').notNull().default([]),
    triggeredBy: text('triggered_by'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    error: text('error'),
});

export const workflowTemplates = pgTable('workflow_templates', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),
    steps: jsonb('steps').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── 7. Notifications & Alerts ───────────────────────────────────────────────

export const notifications = pgTable('notifications', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message'),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    isRead: boolean('is_read').default(false),
    actionUrl: text('action_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const alertRules = pgTable('alert_rules', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    condition: text('condition').notNull(),
    threshold: real('threshold'),
    severity: text('severity').notNull().default('info'),
    channels: jsonb('channels').notNull().default([]),
    cooldownMs: integer('cooldown_ms').notNull().default(60000),
    isActive: boolean('is_active').default(true),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── 8. Scheduler & Webhook ──────────────────────────────────────────────────

export const scheduledTasks = pgTable('scheduled_tasks', {
    id: text('id').primaryKey(),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    cronExpression: text('cron_expression').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const schedulerEvents = pgTable('scheduler_events', {
    id: text('id').primaryKey(),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    scheduledDate: text('scheduled_date').notNull(),
    scheduledTime: text('scheduled_time'),
    durationMinutes: integer('duration_minutes').default(30),
    recurrenceType: text('recurrence_type').default('none'),
    recurrenceEndDate: text('recurrence_end_date'),
    status: text('status').default('scheduled'),
    priority: integer('priority').default(0),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const webhookConfigs = pgTable('webhook_configs', {
    id: text('id').primaryKey(),
    name: text('name'),
    source: text('source').notNull(),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    eventFilter: text('event_filter'),
    secret: text('secret'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── 9. Platform Integrations ────────────────────────────────────────────────

export const mcpServers = pgTable('mcp_servers', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    url: text('url').notNull(),
    transport: text('transport').default('sse'),
    tools: jsonb('tools').default([]),
    assignedAgents: jsonb('assigned_agents').default([]),
    status: text('status').default('disconnected'),
    lastConnectedAt: timestamp('last_connected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const platformBridges = pgTable('platform_bridges', {
    id: text('id').primaryKey(),
    platform: text('platform').notNull(),
    name: text('name').notNull(),
    status: text('status').default('disconnected'),
    apiKey: text('api_key'),
    webhookUrl: text('webhook_url'),
    settings: jsonb('settings').default({}),
    assignedAgents: jsonb('assigned_agents').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    prefix: text('prefix'),
    permissions: jsonb('permissions').default([]),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── 10. War Room ────────────────────────────────────────────────────────────

export const warRoomSessions = pgTable('war_room_sessions', {
    id: text('id').primaryKey(),
    topic: text('topic').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    decision: text('decision'),
    actionItems: jsonb('action_items').default([]),
    linkedTasks: jsonb('linked_tasks').default([]),
    participatingAgents: jsonb('participating_agents').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const warRoomEvents = pgTable('war_room_events', {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull().references(() => warRoomSessions.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    content: text('content'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── 11. Prompt Chunks ──────────────────────────────────────────────────────

export const promptChunks = pgTable('prompt_chunks', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    content: text('content').notNull(),
    color: text('color').notNull().default('#a3e635'),
    category: text('category').notNull().default('general'),
    order: integer('order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── 12. Connection & Security ───────────────────────────────────────────────

export const connectionSecrets = pgTable('connection_secrets', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    service: text('service').notNull(),
    key: text('key').notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const connectionProfiles = pgTable('connection_profiles', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(false),
    openclawEnabled: boolean('openclaw_enabled').default(true),
    openclawWsUrl: text('openclaw_ws_url'),
    openclawHttpUrl: text('openclaw_http_url'),
    openclawAuthMode: text('openclaw_auth_mode').default('token'),
    openclawAuthToken: text('openclaw_auth_token'),
    agentZeroEnabled: boolean('agent_zero_enabled').default(false),
    agentZeroUrl: text('agent_zero_url'),
    agentZeroBaseUrl: text('agent_zero_base_url'),
    agentZeroAuthMode: text('agent_zero_auth_mode').default('api_key'),
    agentZeroApiKey: text('agent_zero_api_key'),
    agentZeroTransport: text('agent_zero_transport').default('rest'),
    lastHealthStatus: text('last_health_status'),
    lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
    lastConnectedAt: timestamp('last_connected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── 13. Gamification ────────────────────────────────────────────────────────

export const xpEvents = pgTable('xp_events', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    reason: text('reason'),
    sourceId: text('source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const dailyMissions = pgTable('daily_missions', {
    id: text('id').primaryKey(),
    date: text('date').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type').notNull(),
    target: integer('target').notNull().default(1),
    current: integer('current').notNull().default(0),
    xpReward: integer('xp_reward').notNull().default(50),
    difficulty: text('difficulty').notNull().default('normal'),
    isCompleted: boolean('is_completed').notNull().default(false),
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const achievements = pgTable('achievements', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    icon: text('icon'),
    category: text('category'),
    condition: text('condition').notNull(),
    xpReward: integer('xp_reward').notNull().default(100),
    rarity: text('rarity').notNull().default('common'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const unlockedAchievements = pgTable('unlocked_achievements', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    achievementId: text('achievement_id').notNull().references(() => achievements.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).defaultNow(),
});

export const operationsStreak = pgTable('operations_streak', {
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
    currentStreak: integer('current_streak').notNull().default(0),
    longestStreak: integer('longest_streak').notNull().default(0),
    lastActiveDate: text('last_active_date'),
    streakHistory: jsonb('streak_history').default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── 14. Capabilities System ─────────────────────────────────────────────────

export const capabilityMcps = pgTable('capability_mcps', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    serverUrl: text('server_url').notNull(),
    transport: text('transport').notNull().default('sse'),
    status: text('status').notNull().default('active'),
    authType: text('auth_type').default('none'),
    encryptedCredentials: text('encrypted_credentials'),
    tools: jsonb('tools').default([]),
    icon: text('icon'),
    category: text('category').default('general'),
    configJson: jsonb('config_json').default({}),
    lastHealthCheck: timestamp('last_health_check', { withTimezone: true }),
    lastHealthStatus: text('last_health_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const capabilitySkills = pgTable('capability_skills', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    content: text('content').notNull(),
    version: text('version').default('1.0.0'),
    status: text('status').notNull().default('active'),
    category: text('category').default('general'),
    icon: text('icon'),
    tags: jsonb('tags').default([]),
    configJson: jsonb('config_json').default({}),
    author: text('author').default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agentCapabilityAssignments = pgTable('agent_capability_assignments', {
    id: text('id').primaryKey(),
    agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    capabilityType: text('capability_type').notNull(),
    capabilityId: text('capability_id').notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    configOverrides: jsonb('config_overrides').default({}),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
});
