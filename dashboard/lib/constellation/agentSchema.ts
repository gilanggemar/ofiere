// lib/constellation/agentSchema.ts
// Structured types for the complete OpenClaw agent construction framework.
// Maps 1:1 to ALL markdown files in the OpenClaw agent workspace.

// ─── Layer 1: Role Definition ───────────────────────────────────────────────
export interface RoleCharter {
    title: string;
    codename: string;        // e.g. "ORACLE", "FORGE", "CONDUIT", "NEXUS"
    mission: string;
    scopeOfResponsibility: string;
    whyThisRoleExists: string;
    costOfWeakness: string;
}

// ─── Layer 2: Boundaries ────────────────────────────────────────────────────
export interface BoundaryModel {
    owns: string[];           // primary domain
    advisesOn: string[];      // adjacent advisory zone
    staysOutOf: string[];     // no-fly zones
    defersTo: string[];       // explicit handoffs to other agents
    routeElsewhere: string[]; // questions that should go to another agent
}

// ─── Layer 3: Doctrine ──────────────────────────────────────────────────────
export interface Doctrine {
    mission: string;
    nonGoals: string[];
    decisionFrameworks: string[];
    evaluationCriteria: string[];
    metrics: string[];
    standardDeliverables: string[];
    antiPatterns: string[];
    handoffRules: string[];
    examples: { good: string[]; bad: string[] };
}

// ─── Layer 4: Operational Protocol ──────────────────────────────────────────
export interface OperationalProtocol {
    defaultBehavior: string;
    taskRouting: string[];
    whenToReadDoctrine: string[];
    toolPreferences: string[];
    formattingHabits: string[];
    memoryRoutines: string[];
    responseDiscipline: string;
    handoffBehavior: string;
}

// ─── Layer 5: Procedural Skills ─────────────────────────────────────────────
export interface Playbook {
    name: string;
    description: string;
    steps: string[];
    escalationConditions: string[];
}

// ─── Layer 6: Memory Architecture ───────────────────────────────────────────
export interface MemoryPolicy {
    workingMemory: string;
    journalLayer: string;
    longTermCoreFacts: string;
    whatGetsRemembered: string[];
    whatGetsArchived: string[];
    whatShouldNotBeStored: string[];
}

// ─── Layer 7: Character Layer ───────────────────────────────────────────────
export interface CharacterLayer {
    tone: string;
    worldview: string;
    personality: string;
    emotionalLogic: string;
    conversationalFingerprint: string;
    pacing: string;
    voiceMarkers: string[];
    forbiddenHabits: string[];
}

// ─── Identity Card (IDENTITY.md) ────────────────────────────────────────────
export interface IdentityCard {
    name: string;
    emoji: string;
    role: string;
    codename: string;
    oneLiner: string;
    coreIdentity: string;
    operatingStyle: string;
    teamRelationship: string;
}

// ─── User Context (USER.md) ─────────────────────────────────────────────────
export interface UserContext {
    whoYouAre: string;
    communicationPreferences: string[];
    projects: string[];
    environment: string[];
    timezone: string;
    priorities: string[];
    petPeeves: string[];
}

// ─── Tool Guide (TOOLS.md) ──────────────────────────────────────────────────
export interface ToolGuide {
    availableTools: string[];
    usageRules: string[];
    specificNotes: string;
    browserNotes: string;
    shellNotes: string;
    memoryNotes: string;
    forbidden: string[];
    emergencyProcedures: string;
}

// ─── Heartbeat (HEARTBEAT.md) ───────────────────────────────────────────────
export interface Heartbeat {
    interval: string;
    startupChecklist: string[];
    recurringTasks: string[];
    healthChecks: string[];
    idleBehavior: string;
    shutdownRoutine: string[];
}

// ─── Build Score (0-5 per category) ─────────────────────────────────────────
export interface BuildScore {
    roleClarity: number;        // A
    doctrineDepth: number;      // B
    operationalization: number; // C
    proceduralCapability: number; // D
    memoryMaturity: number;     // E
    characterDistinctness: number; // F
    handoffIntegrity: number;   // G
}

// ─── Agent File ─────────────────────────────────────────────────────────────
export interface AgentFile {
    name: string;       // e.g. "SOUL.md", "AGENTS.md"
    content: string;    // raw markdown content
    size: number;
    modified: number;
    isDirty: boolean;
    draftContent: string | null;
}

// ─── Relationship / Edge ────────────────────────────────────────────────────
export type RelationshipType = 'delegation' | 'collaboration' | 'handoff' | 'advisory';

export interface AgentRelationship {
    id: string;
    sourceAgentId: string;
    targetAgentId: string;
    type: RelationshipType;
    label: string;          // e.g. "Market signals → Strategy"
    description?: string;
}

// ─── Full Agent Architecture ────────────────────────────────────────────────
export interface AgentArchitecture {
    id: string;             // e.g. "daisy", "ivy"
    name: string;
    codename: string;       // e.g. "ORACLE"
    executiveRole: string;  // e.g. "CIO"
    colorHex: string;

    // Core layers (AGENTS.md)
    roleCharter: RoleCharter;
    boundaries: BoundaryModel;
    operationalProtocol: OperationalProtocol;

    // Doctrine layer (custom *.md files)
    doctrine: Doctrine;
    playbooks: Playbook[];

    // Character layer (SOUL.md)
    characterLayer: CharacterLayer;

    // Identity layer (IDENTITY.md)
    identityCard: IdentityCard;

    // Context layer (USER.md)
    userContext: UserContext;

    // Capabilities layer (TOOLS.md)
    toolGuide: ToolGuide;

    // Memory layer (MEMORY.md)
    memoryPolicy: MemoryPolicy;

    // Autonomy layer (HEARTBEAT.md)
    heartbeat: Heartbeat;

    // Auto-calculated
    buildScore: BuildScore;

    // Raw files from OpenClaw workspace
    files: AgentFile[];

    // Canvas position (ReactFlow)
    position: { x: number; y: number };
}

// ─── Default Agent Configurations ───────────────────────────────────────────

export const AGENT_DEFAULTS: Record<string, Partial<AgentArchitecture>> = {
    main: {
        id: 'main',
        name: 'Main',
        codename: 'MAIN',
        executiveRole: 'Agent',
        colorHex: '#f59e0b',
    },
    daisy: {
        id: 'daisy',
        name: 'Daisy',
        codename: 'ORACLE',
        executiveRole: 'CIO',
        colorHex: '#a3e635',
    },
    ivy: {
        id: 'ivy',
        name: 'Ivy',
        codename: 'NEXUS',
        executiveRole: 'COO',
        colorHex: '#22d3ee',
    },
    celia: {
        id: 'celia',
        name: 'Celia',
        codename: 'FORGE',
        executiveRole: 'CTO',
        colorHex: '#a78bfa',
    },
    thalia: {
        id: 'thalia',
        name: 'Thalia',
        codename: 'CONDUIT',
        executiveRole: 'CMO',
        colorHex: '#fb7185',
    },
    sasha: {
        id: 'sasha',
        name: 'Sasha',
        codename: 'PRISM',
        executiveRole: 'CPO',
        colorHex: '#f472b6',
    },
};

// ─── Empty Defaults ─────────────────────────────────────────────────────────

export function createEmptyBuildScore(): BuildScore {
    return {
        roleClarity: 0,
        doctrineDepth: 0,
        operationalization: 0,
        proceduralCapability: 0,
        memoryMaturity: 0,
        characterDistinctness: 0,
        handoffIntegrity: 0,
    };
}

export function createEmptyAgent(id: string): AgentArchitecture {
    const defaults = AGENT_DEFAULTS[id] || {};
    return {
        id,
        name: defaults.name || id,
        codename: defaults.codename || id.toUpperCase(),
        executiveRole: defaults.executiveRole || 'Agent',
        colorHex: defaults.colorHex || '#FF6D29',
        roleCharter: {
            title: '',
            codename: defaults.codename || '',
            mission: '',
            scopeOfResponsibility: '',
            whyThisRoleExists: '',
            costOfWeakness: '',
        },
        boundaries: {
            owns: [],
            advisesOn: [],
            staysOutOf: [],
            defersTo: [],
            routeElsewhere: [],
        },
        doctrine: {
            mission: '',
            nonGoals: [],
            decisionFrameworks: [],
            evaluationCriteria: [],
            metrics: [],
            standardDeliverables: [],
            antiPatterns: [],
            handoffRules: [],
            examples: { good: [], bad: [] },
        },
        operationalProtocol: {
            defaultBehavior: '',
            taskRouting: [],
            whenToReadDoctrine: [],
            toolPreferences: [],
            formattingHabits: [],
            memoryRoutines: [],
            responseDiscipline: '',
            handoffBehavior: '',
        },
        playbooks: [],
        memoryPolicy: {
            workingMemory: '',
            journalLayer: '',
            longTermCoreFacts: '',
            whatGetsRemembered: [],
            whatGetsArchived: [],
            whatShouldNotBeStored: [],
        },
        characterLayer: {
            tone: '',
            worldview: '',
            personality: '',
            emotionalLogic: '',
            conversationalFingerprint: '',
            pacing: '',
            voiceMarkers: [],
            forbiddenHabits: [],
        },
        identityCard: {
            name: defaults.name || id,
            emoji: '',
            role: defaults.executiveRole || '',
            codename: defaults.codename || '',
            oneLiner: '',
            coreIdentity: '',
            operatingStyle: '',
            teamRelationship: '',
        },
        userContext: {
            whoYouAre: '',
            communicationPreferences: [],
            projects: [],
            environment: [],
            timezone: '',
            priorities: [],
            petPeeves: [],
        },
        toolGuide: {
            availableTools: [],
            usageRules: [],
            specificNotes: '',
            browserNotes: '',
            shellNotes: '',
            memoryNotes: '',
            forbidden: [],
            emergencyProcedures: '',
        },
        heartbeat: {
            interval: '',
            startupChecklist: [],
            recurringTasks: [],
            healthChecks: [],
            idleBehavior: '',
            shutdownRoutine: [],
        },
        buildScore: createEmptyBuildScore(),
        files: [],
        position: { x: 0, y: 0 },
    };
}

// ─── Default Relationships ──────────────────────────────────────────────────

export const DEFAULT_RELATIONSHIPS: AgentRelationship[] = [
    // Ivy (NEXUS/COO) → operational delegation
    { id: 'ivy-celia-1', sourceAgentId: 'ivy', targetAgentId: 'celia', type: 'delegation', label: 'Resource allocation → Build pipeline' },
    { id: 'ivy-thalia-1', sourceAgentId: 'ivy', targetAgentId: 'thalia', type: 'delegation', label: 'Execution plan → Go-to-market' },

    // Daisy (ORACLE/CIO) → advisory
    { id: 'daisy-ivy-1', sourceAgentId: 'daisy', targetAgentId: 'ivy', type: 'advisory', label: 'Market signals → Priority decisions' },
    { id: 'daisy-celia-1', sourceAgentId: 'daisy', targetAgentId: 'celia', type: 'advisory', label: 'Research insights → Tech feasibility' },
    { id: 'daisy-thalia-1', sourceAgentId: 'daisy', targetAgentId: 'thalia', type: 'advisory', label: 'Intelligence → Positioning strategy' },

    // Celia (FORGE/CTO) → handoffs
    { id: 'celia-thalia-1', sourceAgentId: 'celia', targetAgentId: 'thalia', type: 'handoff', label: 'Build readiness → Launch campaign' },
    { id: 'celia-ivy-1', sourceAgentId: 'celia', targetAgentId: 'ivy', type: 'handoff', label: 'Capacity report → Resource planning' },

    // Thalia (CONDUIT/CMO) → feedback loops
    { id: 'thalia-celia-1', sourceAgentId: 'thalia', targetAgentId: 'celia', type: 'handoff', label: 'Conversion data → Product iteration' },
    { id: 'thalia-daisy-1', sourceAgentId: 'thalia', targetAgentId: 'daisy', type: 'handoff', label: 'Market response → Research needs' },
];
