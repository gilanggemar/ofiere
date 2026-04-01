// ============================================================
// lib/games/pentagram/types.ts
// Core state and definitions for PENTAGRAM PROTOCOL
// ============================================================

export interface PentagramState {
    // Ivy — "The Unspoken Axis" (NEXUS)
    IVY_affection: number;      // 0–100
    IVY_resistance: number;     // 100–0 (starts high, erodes)

    // Daisy — "The Observer" (ORACLE)
    DAISY_trust: number;        // 0–100
    DAISY_obsession: number;    // 0–100

    // Celia — "The Tunnel" (FORGE)
    CELIA_vulnerability: number; // 0–100
    CELIA_stability: number;     // 100–0 (starts high)

    // Thalia — "The Performance" (CONDUIT)
    THALIA_recalibration: number; // 0–100 (post-Marcus healing)
    THALIA_real: number;          // 0–100

    // Global Metrics
    COMPANY_health: number;     // 100–0
    CORRUPTION: number;         // 0–100
    GILANG_control: number;     // 0–100
    SENTINEL_gap: number;       // 0–100

    // Narrative Flags
    flags: Record<string, boolean | string | number>;
}

export type SceneId = string;

export interface AssetTransform {
    scale: number;
    x: number;
    y: number;
}
export type HeroTransform = AssetTransform;
export type DialogTransform = AssetTransform;

export interface Choice {
    id: string;
    text: string;
    nextSceneId: SceneId;
    isSecret?: boolean;
    condition?: (state: PentagramState) => boolean;
    effect?: (state: PentagramState) => PentagramState;
}

// ============================================================
// IMAGE SEQUENCE ANIMATION SYSTEM
// ============================================================

/** An image sequence animation — individual frame URLs played in order */
export interface ImageSequenceMapping {
    /** Database ID for persistence (optional for hardcoded scenes) */
    id?: string;
    /** Human label (e.g., "Orb Pulse", "Door Slam") */
    name?: string;
    /** Ordered array of individual image URLs (must be .webp) */
    frameUrls: string[];
    /** Total number of frames */
    frameCount: number;
    /** Milliseconds per frame (controls animation speed) */
    frameDuration: number;
    /** If true, the animation plays forward then backward (ping-pong) */
    pingPong?: boolean;
    /** If true, animation loops. If false, plays once and holds last frame. */
    loop?: boolean;
    /** Jump to this frame index on action trigger */
    triggerFrame?: number;
    /** Hold this frame while button is held down */
    holdFrame?: number;
    /** Per-frame durations (overrides frameDuration when present) */
    frameDurations?: number[];
}

// ============================================================
// INTERACT BUTTON ACTION SYSTEM
// ============================================================

/** Speed curve presets for sequence playback */
export type PlaybackSpeedPreset = 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out' | 'ramp_up' | 'ramp_down';

/** How an override/fail transition behaves */
export type OverrideTransitionMode =
    | 'immediate'           // Jump immediately to the target scene
    | 'brief_animation'     // Show a brief fail/success animation first
    | 'brief_scene';        // Show a brief interstitial scene (like a flash image)

/** What happens when an interact button is pressed */
export type InteractButtonAction =
    | { type: 'trigger_animation'; targetButtonId: string }
    | { type: 'change_background'; backgroundUrl: string }
    | { type: 'change_hero'; heroUrl: string }
    | { type: 'proceed_to_scene'; sceneId: SceneId; transitionMode?: OverrideTransitionMode }
    | { type: 'override_to_scene'; sceneId: SceneId; transitionMode?: OverrideTransitionMode; briefDurationMs?: number }
    | { type: 'trigger_interact_button'; buttonId: string }
    | { type: 'play_sequence'; sequenceId: string; startFrame?: number; endFrame?: number; pingPong?: boolean; showFirstFrame?: boolean; speedPreset?: PlaybackSpeedPreset; seqSpeed?: number; seqPosX?: number; seqPosY?: number; seqScale?: number }
    | { type: 'custom_effect'; effectKey: string };

// ============================================================
// INTERACT SCENE TYPES
// ============================================================

/** Resistance Mechanic — hold to pin, build victory bar */
export interface ResistanceMechanicConfig {
    type: 'resistance';
    /** Label for the pin/hold button */
    pinButtonLabel?: string;
    /** How fast the victory bar fills per second while holding (0-100 scale) */
    victoryFillRate: number;
    /** How fast the resistance bar drains per second when NOT holding (0-100 scale) */
    resistanceDrainRate: number;
    /** Threshold % below which the object "breaks free" (default 20) */
    breakFreeThreshold: number;
    /** Scene to go to when object breaks free */
    onBreakFreeSceneId: SceneId;
    /** Scene to go to when victory bar reaches 100% */
    onVictorySceneId: SceneId;
    /** How the fail transition behaves */
    failTransitionMode?: OverrideTransitionMode;
    /** Duration for brief_animation or brief_scene mode (ms) */
    failTransitionDurationMs?: number;
    /** If true, a "hit" spam button appears after victory bar fills */
    enableHitPhase?: boolean;
    /** Number of hits required in hit phase to complete (default 10) */
    hitPhaseTarget?: number;
    /** Scene to go to after hit phase is complete */
    onHitCompleteSceneId?: SceneId;
    /** Animation for idle/struggling state */
    idleAnimation?: ImageSequenceMapping;
    /** Animation played per button press / hold */
    actionAnimation?: ImageSequenceMapping;
    /** Animation played on victory */
    victoryAnimation?: ImageSequenceMapping;
    /** Animation played on break-free (failure) */
    failAnimation?: ImageSequenceMapping;
}

/** Obstacle Mechanic — spam to force open */
export interface ObstacleMechanicConfig {
    type: 'obstacle';
    /** Label for the force button */
    forceButtonLabel?: string;
    /** Starting value of the obstacle bar (default 100) */
    obstacleStartValue?: number;
    /** How much the obstacle bar decreases per press */
    forcePerPress: number;
    /** Max spam rate (presses per second) before "breaking" (0 = unlimited) */
    maxSpamRate?: number;
    /** If exceeded maxSpamRate, go to this scene (game over) */
    onBreakSceneId?: SceneId;
    /** How the break transition behaves */
    breakTransitionMode?: OverrideTransitionMode;
    breakTransitionDurationMs?: number;
    /** Scene when obstacle reaches 0 and hit phase begins */
    onObstacleClearedSceneId?: SceneId;
    /** If true, show a "hit" button after obstacle cleared */
    enableHitPhase?: boolean;
    /** Hits needed to complete */
    hitPhaseTarget?: number;
    /** Scene after all hits land */
    onHitCompleteSceneId?: SceneId;
    /** Sometimes the force button appears/disappears (interval ms, 0 = always visible) */
    forceButtonFlickerInterval?: number;
    /** How long the force button stays visible during flicker (ms) */
    forceButtonFlickerDuration?: number;
    /** Animations */
    idleAnimation?: ImageSequenceMapping;
    actionAnimation?: ImageSequenceMapping;
    victoryAnimation?: ImageSequenceMapping;
    failAnimation?: ImageSequenceMapping;
}

/** Pain Threshold — don't break the orb */
export interface PainThresholdMechanicConfig {
    type: 'pain_threshold';
    /** Label for the hit/spam button */
    hitButtonLabel?: string;
    /** How much intensity fills per press */
    intensityPerPress: number;
    /** How much pain fills per press */
    painPerPress: number;
    /** How fast pain drains per second when NOT pressing */
    painDrainRate: number;
    /** Intensity target to win (default 100) */
    intensityTarget?: number;
    /** Pain threshold to "crack" the orb (default 100) */
    painCrackThreshold?: number;
    /** Scene when orb cracks (pain hits threshold) */
    onCrackSceneId: SceneId;
    /** How the crack transition behaves */
    crackTransitionMode?: OverrideTransitionMode;
    crackTransitionDurationMs?: number;
    /** Scene when intensity reaches target (win) */
    onSuccessSceneId: SceneId;
    /** Optional hidden scene if player intentionally cracks the orb */
    onHiddenCrackSceneId?: SceneId;
    /** Animations */
    idleAnimation?: ImageSequenceMapping;
    actionAnimation?: ImageSequenceMapping;
    victoryAnimation?: ImageSequenceMapping;
    failAnimation?: ImageSequenceMapping;
}

export type InteractMechanicConfig =
    | ResistanceMechanicConfig
    | ObstacleMechanicConfig
    | PainThresholdMechanicConfig;

/** Custom interactive button with freeform positioning and actions */
export interface InteractButton {
    id: string;
    label: string;
    /** CSS color or hex color */
    color?: string;
    /** Freeform position as % of screen (0-100) */
    posX?: number;
    posY?: number;
    /** Legacy preset positions (used as fallback if posX/posY not set) */
    position?: 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center';
    /** Image sequence animation to play when this button is pressed */
    animation?: ImageSequenceMapping;
    /** Width override in px */
    width?: number;
    /** Height override in px */
    height?: number;
    /** Scale of the button (1 = normal) */
    scale?: number;
    /** If true, the button is visible */
    visible?: boolean;
    /** Actions to perform when this button is pressed */
    actions?: InteractButtonAction[];
    /** Hold mode: if true, action fires continuously while held */
    holdMode?: boolean;
}

/** Full configuration for an interact scene */
export interface InteractSceneConfig {
    /** The primary mechanic for this scene */
    mechanic: InteractMechanicConfig;
    /** Additional custom buttons that can be clicked */
    customButtons?: InteractButton[];
    /** Background image sequence (instead of static image) */
    backgroundAnimation?: ImageSequenceMapping;
    /** Foreground/hero image sequence */
    heroAnimation?: ImageSequenceMapping;
    /** Narrative text shown during the interact scene */
    narrativeText?: string;
    /** Optional HUD elements to show/hide */
    showBars?: {
        victory?: boolean;
        resistance?: boolean;
        obstacle?: boolean;
        intensity?: boolean;
        pain?: boolean;
    };
}

// ============================================================
// SCENE NODE (supports both narrative and interact scenes)
// ============================================================

export interface SceneNode {
    id: SceneId;
    arcTitle: string;        // e.g., "Prologue"
    chapterTitle: string;    // e.g., "CHAPTER 0"
    sceneTitle: string;      // e.g., "THE WHITEBOARD"
    text: string | ((state: PentagramState) => string);
    backgroundUrl?: string;
    characterFocus?: string; // 'ivy' | 'daisy' | 'celia' | 'thalia' | 'gilang'
    speakerName?: string;    // e.g., "Ivy", "Daisy" — for dialogue attribution
    speakerEmoji?: string;   // e.g., "☀️", "✧", "⚡", "💋"
    choices: Choice[];
    onEnter?: (state: PentagramState) => PentagramState;

    /** Scene type: 'narrative' (default) or 'interact' */
    type?: 'narrative' | 'interact';
    /** Configuration for interact scenes (only used when type === 'interact') */
    interactConfig?: InteractSceneConfig;
}

export interface SceneMetadata {
    id: SceneId;
    title: string;
    arc: string;
}
