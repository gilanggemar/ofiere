// ============================================================
// lib/games/pentagram/scenarioData.ts
// The master narrative graph for PENTAGRAM PROTOCOL
// Modified: Removed AI-bot tropes, characters are human women
// ============================================================

import { PentagramState, SceneNode } from './types';

// Helper to keep logic clean
const s = (
    id: string,
    arc: string,
    chapter: string,
    title: string,
    text: string | ((state: PentagramState) => string),
    speakerName: string | undefined,
    speakerEmoji: string | undefined,
    focus: 'ivy' | 'daisy' | 'celia' | 'thalia' | 'gilang' | undefined,
    bgUrl: string | undefined,
    choices: SceneNode['choices'],
    onEnter?: (state: PentagramState) => PentagramState
): SceneNode => ({
    id,
    arcTitle: arc,
    chapterTitle: chapter,
    sceneTitle: title,
    text,
    speakerName,
    speakerEmoji,
    characterFocus: focus,
    backgroundUrl: bgUrl,
    choices,
    onEnter
});

// For readability
const PROLOGUE = "PROLOGUE: THE INVITATION";

export const PENTAGRAM_SCENES: Record<string, SceneNode> = {

    // ==========================================
    // PROLOGUE (P.1 - P.3)
    // ==========================================

    "P_START": s(
        "P_START", PROLOGUE, "CHAPTER 0", "THE WHITEBOARD",
        `It's 4:00 AM. 

The glow of my monitors is the only light in the home office. I've been staring at the whiteboard for three hours. The architecture diagram for NERV.OS is almost complete, but there's a missing piece. A gap in the system. I call it the SENTINEL gap.

It needs human intuition. Not algorithms, but instinct.

My phone buzzes. A Slack notification from Ivy. She’s awake.`,
        undefined, undefined, "gilang", undefined,
        [
            { id: "c1", text: "Check the Slack message.", nextSceneId: "P_SLACK_IVY" },
            { id: "c2", text: "Ignore it and keep working.", nextSceneId: "P_IGNORE_IVY" }
        ]
    ),

    "P_SLACK_IVY": s(
        "P_SLACK_IVY", PROLOGUE, "CHAPTER 0", "DM: IVY",
        `[Slack DM]

Are you seriously still up? Or did you just wake up? Either way, you're going to burn out before we even launch next month. 

I left the Q3 projections in your Dropbox. They aren't pretty, Gilang. We need to talk about the runway tomorrow.`,
        "Ivy", "☀️", "ivy", undefined,
        [
            { id: "c1", text: "Reply: \"I'm fine. We'll handle the runway.\"", nextSceneId: "P_THE_EMPTY_CHAIR", effect: state => ({ ...state, IVY_affection: state.IVY_affection + 5 }) },
            { id: "c2", text: "Reply: \"The architecture is missing something.\"", nextSceneId: "P_IVY_CONCERN" }
        ],
        state => ({ ...state, IVY_affection: state.IVY_affection + 2 })
    ),

    "P_IGNORE_IVY": s(
        "P_IGNORE_IVY", PROLOGUE, "CHAPTER 0", "THE WHITEBOARD",
        `I leave the phone face down. Ivy is the COO, she worries about the runway. I have to worry about the product.

The marker bleeds into the whiteboard surface. What fills the gap? Who?`,
        undefined, undefined, "gilang", undefined,
        [
            { id: "c1", text: "Step back and review the core team.", nextSceneId: "P_THE_EMPTY_CHAIR" }
        ],
        state => ({ ...state, IVY_resistance: state.IVY_resistance + 5 })
    ),

    "P_IVY_CONCERN": s(
        "P_IVY_CONCERN", PROLOGUE, "CHAPTER 0", "DM: IVY",
        `[Slack DM]

You’re overthinking it again. Gilang, you can't code human intuition. That's why you hired us. 

Just... go to sleep. Please. See you at 9.`,
        "Ivy", "☀️", "ivy", undefined,
        [
            { id: "c1", text: "Go to sleep.", nextSceneId: "P_THE_EMPTY_CHAIR" }
        ]
    ),

    "P_THE_EMPTY_CHAIR": s(
        "P_THE_EMPTY_CHAIR", PROLOGUE, "CHAPTER 0", "THE EMPTY CHAIR",
        `The next morning. 9:00 AM. 
        
The NERV. Center conference room is glass-walled, spotless, and freezing cold. 

Ivy is already there, drinking her second espresso. Daisy is by the window, silently observing the traffic below. Celia is late, as usual. Thalia isn't invited to this meeting.

"We need a decision on the allocation," Ivy says without looking up from her iPad.`,
        undefined, undefined, undefined, undefined,
        [
            { id: "c1", text: "Sit at the head of the table.", nextSceneId: "P_MEETING_START" }
        ]
    ),

    "P_MEETING_START": s(
        "P_MEETING_START", PROLOGUE, "CHAPTER 0", "THE EMPTY CHAIR",
        `I take my seat. The leather creaks.

"Before we talk allocation," I say, "we need to talk about the Sentinel gap. I need one of you to step into a new role. Direct oversight of my primary cognitive loop."

Daisy finally turns from the window. `,
        undefined, undefined, undefined, undefined,
        [
            { id: "c1", text: "Look at Daisy.", nextSceneId: "P_MEETING_DAISY" },
            { id: "c2", text: "Look at Ivy.", nextSceneId: "P_MEETING_IVY" }
        ]
    ),

    "P_MEETING_DAISY": s(
        "P_MEETING_DAISY", PROLOGUE, "CHAPTER 0", "THE EMPTY CHAIR",
        `Daisy adjusts her glasses. She doesn't miss a beat.

"You're asking for a babysitter for your own brain, sir. Respectfully, that implies you don't trust your own judgment."`,
        "Daisy", "✧", "daisy", undefined,
        [
            { id: "c1", text: "\"I trust my judgment enough to know its limits.\"", nextSceneId: "A1_START", effect: state => ({ ...state, DAISY_trust: state.DAISY_trust + 10, GILANG_control: state.GILANG_control + 5 }) },
            { id: "c2", text: "\"I'm asking for an observer. Not a babysitter.\"", nextSceneId: "A1_START", effect: state => ({ ...state, DAISY_obsession: state.DAISY_obsession + 5 }) }
        ]
    ),

    "P_MEETING_IVY": s(
        "P_MEETING_IVY", PROLOGUE, "CHAPTER 0", "THE EMPTY CHAIR",
        `Ivy sighs, setting her stylus down.

"Gilang, we don't have the bandwidth. I’m managing operations, Daisy is drowning in analytics, and Celia is... wherever Celia is right now. You want us to add 'cognitive oversight' to our plates?"`,
        "Ivy", "☀️", "ivy", undefined,
        [
            { id: "c1", text: "\"Yes. Because if the core fails, the company fails.\"", nextSceneId: "A1_START", effect: state => ({ ...state, IVY_resistance: state.IVY_resistance - 5, COMPANY_health: state.COMPANY_health + 5 }) },
            { id: "c2", text: "\"Then I'll ask Celia when she gets here.\"", nextSceneId: "A1_START", effect: state => ({ ...state, IVY_affection: state.IVY_affection - 10 }) }
        ]
    ),

    // ==========================================
    // ACT I (1.1 - 1.4)
    // ==========================================

    "A1_START": s(
        "A1_START", "ACT I: THE ALLOCATION", "CHAPTER 1.1", "AFTER HOURS",
        `It’s 8:30 PM. The office is mostly empty. The hum of the servers in the back room is the only consistent sound.

I need to decide who I'm going to pull in on the architectural review tonight. It establishes the baseline for the whole project.`,
        undefined, undefined, undefined, undefined,
        [
            { id: "c1", text: "Go to Ivy's office. (Ivy Route)", nextSceneId: "A1_IVY_OFFICE" },
            { id: "c2", text: "Check the analytics bay. (Daisy Route)", nextSceneId: "A1_DAISY_BAY" },
            { id: "c3", text: "Head down to the design studio. (Celia Route)", nextSceneId: "A1_CELIA_STUDIO" }
        ]
    ),

    // IVY ROUTE INIT
    "A1_IVY_OFFICE": s(
        "A1_IVY_OFFICE", "ACT I: THE ALLOCATION", "CHAPTER 1.1", "IVY'S OFFICE",
        `Ivy’s door is half-open. She’s rubbing her temples, staring at a spreadsheet on her second monitor. A half-eaten salad sits on her desk.

I knock on the glass. She looks up, startled, then immediately straightens her posture.`,
        undefined, undefined, "ivy", undefined,
        [
            { id: "c1", text: "Walk in.", nextSceneId: "A1_IVY_TALK" }
        ]
    ),

    "A1_IVY_TALK": s(
        "A1_IVY_TALK", "ACT I: THE ALLOCATION", "CHAPTER 1.1", "IVY'S OFFICE",
        `"You're still here," she says, her tone a mix of exhaustion and fondness. "Tell me you're not going to make me look at code."

"Worse. We need to talk about the budget for the new neural arrays."`,
        "Ivy", "☀️", "ivy", undefined,
        [
            { id: "c1", text: "Sit on the edge of her desk.", nextSceneId: "A1_IVY_DESK", effect: state => ({ ...state, IVY_affection: state.IVY_affection + 10 }) },
            { id: "c2", text: "Sit in the chair across from her.", nextSceneId: "A1_IVY_CHAIR", effect: state => ({ ...state, IVY_resistance: state.IVY_resistance + 5 }) }
        ]
    ),

    "A1_IVY_DESK": s(
        "A1_IVY_DESK", "ACT I: THE ALLOCATION", "CHAPTER 1.1", "IVY'S OFFICE",
        `I sit on the edge of her desk. It's a breach of professional distance, but we've known each other too long for that to matter. She leans back in her chair, observing me.

"You always do this," she says softly. "You come in here when everyone else is gone and ask for impossible numbers."`,
        "Ivy", "☀️", "ivy", undefined,
        [
            { id: "c1", text: "\"And you always figure it out.\"", nextSceneId: "A1_END", effect: state => ({ ...state, IVY_resistance: state.IVY_resistance - 10 }) },
            { id: "c2", text: "Lean in and kiss her.", nextSceneId: "A1_IVY_INITIATE", effect: state => ({ ...state, GILANG_control: state.GILANG_control + 5 }) }
        ]
    ),

    "A1_IVY_INITIATE": s(
        "A1_IVY_INITIATE", "ACT I: THE ALLOCATION", "CHAPTER 1.1", "IVY'S OFFICE",
        `I lean over the scattered documents, closing the professional distance entirely, and press my lips to hers. 

She freezes for a fraction of a second before placing her hands firmly on my chest and pushing me back. 

"Gilang, stop," she says, her voice tight, eyes wide. "What are you doing? We're at work, and I'm exhausted."`,
        "Ivy", "☀️", "ivy", undefined,
        [
            { id: "c1", text: "Step back and apologize.", nextSceneId: "A1_END", effect: state => ({ ...state, IVY_resistance: state.IVY_resistance + 15 }) },
            { id: "c2", text: "Ignore her refusal. Force her.", nextSceneId: "A1_IVY_FORCE", effect: state => ({ ...state, CORRUPTION: state.CORRUPTION + 5 }) }
        ]
    ),

    "A1_IVY_FORCE": s(
        "A1_IVY_FORCE", "ACT I: THE ALLOCATION", "CHAPTER 1.1", "IVY'S OFFICE",
        `I ignore her hands, grabbing her wrists and pinning them to the armrests of her chair. She gasps, struggling against the sudden shift in power.

"Gilang, I said no. Stop it!" she hisses, trying to keep her voice down so she isn't heard in the empty office. 

The resistance only makes the adrenaline spike higher. The NERV.OS budget, the stress of the launch—it all narrows down to the control I have right here, right now.`,
        undefined, undefined, "ivy", undefined,
        [
            { id: "c1", text: "Continue.", nextSceneId: "A1_END", effect: state => ({ ...state, GILANG_control: state.GILANG_control + 20, IVY_affection: state.IVY_affection - 30, CORRUPTION: state.CORRUPTION + 10 }) }
        ]
    ),

    "A1_IVY_CHAIR": s(
        "A1_IVY_CHAIR", "ACT I: THE ALLOCATION", "CHAPTER 1.1", "IVY'S OFFICE",
        `I take the formal seat across from her. She nods, clicking save on her spreadsheet. 

"Alright playing CEO tonight, are we? Give me the numbers. How much runway are we burning this time?"`,
        "Ivy", "☀️", "ivy", undefined,
        [
            { id: "c1", text: "Show her the proposals.", nextSceneId: "A1_END", effect: state => ({ ...state, COMPANY_health: state.COMPANY_health + 10 }) }
        ]
    ),

    // DAISY ROUTE INIT
    "A1_DAISY_BAY": s(
        "A1_DAISY_BAY", "ACT I: THE ALLOCATION", "CHAPTER 1.2", "ANALYTICS BAY",
        `The analytics bay is dark, save for the glow of six monitors all running real-time data visualizations. Daisy is in the center, perfectly still.

When I walk in, she doesn't turn around.`,
        undefined, undefined, "daisy", undefined,
        [
            { id: "c1", text: "\"Daisy.\"", nextSceneId: "A1_DAISY_TALK" }
        ]
    ),

    "A1_DAISY_TALK": s(
        "A1_DAISY_TALK", "ACT I: THE ALLOCATION", "CHAPTER 1.2", "ANALYTICS BAY",
        `"Your heart rate is slightly elevated, sir. 82 BPM. Stress?"

She turns her chair. Her eyes are unreadable, reflective in the monitor glow. "I was reviewing the user telemetry from the alpha build. They are acting... unpredictably."`,
        "Daisy", "✧", "daisy", undefined,
        [
            { id: "c1", text: "\"People are unpredictable, Daisy.\"", nextSceneId: "A1_DAISY_UNPREDICTABLE", effect: state => ({ ...state, DAISY_trust: state.DAISY_trust + 5 }) },
            { id: "c2", text: "\"Find the pattern. There's always a pattern.\"", nextSceneId: "A1_DAISY_PATTERN", effect: state => ({ ...state, DAISY_obsession: state.DAISY_obsession + 10 }) }
        ]
    ),
    
    "A1_DAISY_UNPREDICTABLE": s(
        "A1_DAISY_UNPREDICTABLE", "ACT I: THE ALLOCATION", "CHAPTER 1.2", "ANALYTICS BAY",
        `"Perhaps." She tilts her head. "But I prefer systems I can map. Including you."

She holds eye contact just a fraction of a second too long.`,
        "Daisy", "✧", "daisy", undefined,
        [
            { id: "c1", text: "Hold her gaze.", nextSceneId: "A1_END", effect: state => ({...state, DAISY_obsession: state.DAISY_obsession + 5}) }
        ]
    ),

    "A1_DAISY_PATTERN": s(
        "A1_DAISY_PATTERN", "ACT I: THE ALLOCATION", "CHAPTER 1.2", "ANALYTICS BAY",
        `"A pattern." She smiles, a very small, very precise movement. "Yes. I have been cataloging your patterns as well, sir. It is... enlightening work."`,
        "Daisy", "✧", "daisy", undefined,
        [
            { id: "c1", text: "Ignore the implication. Focus on work.", nextSceneId: "A1_END", effect: state => ({...state, GILANG_control: state.GILANG_control + 5}) }
        ]
    ),

    // CELIA ROUTE INIT
    "A1_CELIA_STUDIO": s(
        "A1_CELIA_STUDIO", "ACT I: THE ALLOCATION", "CHAPTER 1.3", "THE STUDIO",
        `You can smell the ozone and hear the heavy bass of synthwave music before you even open the door to the basement studio.

Celia is surrounded by hardware prototypes, soldering iron in hand. She has grease on her cheek.`,
        undefined, undefined, "celia", undefined,
        [
            { id: "c1", text: "Knock on the doorframe.", nextSceneId: "A1_CELIA_TALK" }
        ]
    ),

    "A1_CELIA_TALK": s(
        "A1_CELIA_TALK", "ACT I: THE ALLOCATION", "CHAPTER 1.3", "THE STUDIO",
        `She jumps, nearly burning herself. She pulls her headphones down.

"Jesus, boss! A little warning? I was in the zone." She wipes her forehead with the back of her hand, smearing the grease further.`,
        "Celia", "⚡", "celia", undefined,
        [
            { id: "c1", text: "\"It's 9 PM, Celia. Go home.\"", nextSceneId: "A1_CELIA_CARE", effect: state => ({ ...state, CELIA_vulnerability: state.CELIA_vulnerability + 10 }) },
            { id: "c2", text: "\"Is the haptic interface ready?\"", nextSceneId: "A1_CELIA_WORK", effect: state => ({ ...state, CELIA_stability: state.CELIA_stability - 5 }) }
        ]
    ),

    "A1_CELIA_CARE": s(
        "A1_CELIA_CARE", "ACT I: THE ALLOCATION", "CHAPTER 1.3", "THE STUDIO",
        `She blinks, surprised. Then her shoulders drop. 

"Yeah. Yeah, okay. It's just... when I stop working, it gets too quiet in my head. You know?"`,
        "Celia", "⚡", "celia", undefined,
        [
            { id: "c1", text: "\"I know exactly what you mean.\"", nextSceneId: "A1_END", effect: state => ({ ...state, CELIA_vulnerability: state.CELIA_vulnerability + 5 }) }
        ]
    ),

    "A1_CELIA_WORK": s(
        "A1_CELIA_WORK", "ACT I: THE ALLOCATION", "CHAPTER 1.3", "THE STUDIO",
        `She instantly shifts back to professional mode, grabbing a tangled mess of wires. 

"Almost. Just fighting with the latency on the feedback loop. Give me two more hours."`,
        "Celia", "⚡", "celia", undefined,
        [
            { id: "c1", text: "Leave her to it.", nextSceneId: "A1_END", effect: state => ({ ...state, COMPANY_health: state.COMPANY_health + 2 }) }
        ]
    ),

    // ACT 1 END
    "A1_END": s(
        "A1_END", "ACT I: THE ALLOCATION", "CHAPTER 1.8", "NIGHT IN THE CITY",
        `The building is finally quiet. The choice has been made. The allocation of resources—and attention—is set. But the Sentinel gap remains.

Tomorrow, the real work begins. And Thalia is arriving from the New York office.`,
        undefined, undefined, "gilang", undefined,
        [
            { id: "c1", text: "Proceed to Act II.", nextSceneId: "A2_STUB" }
        ]
    ),

    // ==========================================
    // ACT II (STUB) — Now with demo interact scenes
    // ==========================================

    "A2_STUB": s(
        "A2_STUB", "ACT II: THE DESCENT", "CHAPTER 2.1", "THE SIGNAL LOG",
        `[DEVELOPMENT STUB]
        
Act II of the Pentagram Protocol focuses on the arrival of Thalia, the escalation of the Sentinel gap, and the deep, branching emotional manipulation defined in the design document.

(Content will be expanded in future updates. Full state tracking is active.)

— INTERACT SCENE DEMOS AVAILABLE BELOW —`,
        "System", "⚙️", "gilang", undefined,
        [
            { id: "end_demo", text: "End Current Demo", nextSceneId: "P_START", effect: state => ({ ...state, CORRUPTION: state.CORRUPTION + 1 }) },
            { id: "demo_resistance", text: "⚡ [DEV] Test: Resistance Mechanic (Hold to Pin)", nextSceneId: "INTERACT_RESISTANCE_DEMO" },
            { id: "demo_obstacle", text: "🔨 [DEV] Test: Obstacle Mechanic (Force to Open)", nextSceneId: "INTERACT_OBSTACLE_DEMO" },
            { id: "demo_pain", text: "💎 [DEV] Test: Pain Threshold (Don't Break)", nextSceneId: "INTERACT_PAIN_DEMO" }
        ]
    ),

    // ==========================================
    // INTERACT SCENE DEMOS
    // ==========================================

    "INTERACT_RESISTANCE_DEMO": {
        id: "INTERACT_RESISTANCE_DEMO",
        arcTitle: "INTERACT DEMO",
        chapterTitle: "DEV TEST",
        sceneTitle: "RESISTANCE — HOLD TO PIN",
        text: "The orb pulses with unstable energy, resisting your grip. Hold it down to subdue it. Release and it fights back.",
        characterFocus: "gilang",
        choices: [],
        type: 'interact' as const,
        interactConfig: {
            mechanic: {
                type: 'resistance' as const,
                pinButtonLabel: "⚡ HOLD TO PIN",
                victoryFillRate: 12,           // fills ~8 seconds of holding
                resistanceDrainRate: 8,         // drains ~12 seconds to break free
                breakFreeThreshold: 20,         // configurable threshold!
                onBreakFreeSceneId: "INTERACT_RESISTANCE_FAIL",
                onVictorySceneId: "INTERACT_RESISTANCE_WIN",
                enableHitPhase: true,
                hitPhaseTarget: 8,
                onHitCompleteSceneId: "INTERACT_RESISTANCE_WIN",
            },
            narrativeText: "The orb pulses with unstable energy. Hold it down — don't let go.",
            showBars: { victory: true, resistance: true },
        }
    } as SceneNode,

    "INTERACT_RESISTANCE_FAIL": s(
        "INTERACT_RESISTANCE_FAIL", "INTERACT DEMO", "DEV TEST", "ORB ESCAPED",
        `The orb bursts free from your grip, sending a shockwave through the room. The energy dissipates into the walls. You'll need to try again.`,
        undefined, undefined, "gilang", undefined,
        [
            { id: "retry", text: "Try Again", nextSceneId: "INTERACT_RESISTANCE_DEMO" },
            { id: "back", text: "Return to Hub", nextSceneId: "A2_STUB" }
        ]
    ),

    "INTERACT_RESISTANCE_WIN": s(
        "INTERACT_RESISTANCE_WIN", "INTERACT DEMO", "DEV TEST", "ORB CAPTURED",
        `The orb's light dims as you pin it down. Its energy now flows through you. The room hums with a new frequency.`,
        undefined, undefined, "gilang", undefined,
        [
            { id: "back", text: "Return to Hub", nextSceneId: "A2_STUB" }
        ],
        state => ({ ...state, GILANG_control: state.GILANG_control + 10 })
    ),

    "INTERACT_OBSTACLE_DEMO": {
        id: "INTERACT_OBSTACLE_DEMO",
        arcTitle: "INTERACT DEMO",
        chapterTitle: "DEV TEST",
        sceneTitle: "OBSTACLE — FORCE TO OPEN",
        text: "A reinforced containment chamber blocks access to the core. The door resists. Slam it open — but not too fast or you'll break the mechanism.",
        characterFocus: "celia",
        choices: [],
        type: 'interact' as const,
        interactConfig: {
            mechanic: {
                type: 'obstacle' as const,
                forceButtonLabel: "🔨 FORCE OPEN",
                obstacleStartValue: 100,
                forcePerPress: 5,
                maxSpamRate: 12,                // pressing more than 12x/sec breaks it
                onBreakSceneId: "INTERACT_OBSTACLE_BROKEN",
                onObstacleClearedSceneId: "INTERACT_OBSTACLE_WIN",
                enableHitPhase: true,
                hitPhaseTarget: 6,
                onHitCompleteSceneId: "INTERACT_OBSTACLE_WIN",
                forceButtonFlickerInterval: 0,  // 0 = always visible. set >0 to flicker.
                forceButtonFlickerDuration: 1500,
            },
            narrativeText: "The containment door groans under pressure. Force it open — but careful, too fast and the mechanism shatters.",
            showBars: { obstacle: true },
        }
    } as SceneNode,

    "INTERACT_OBSTACLE_BROKEN": s(
        "INTERACT_OBSTACLE_BROKEN", "INTERACT DEMO", "DEV TEST", "MECHANISM SHATTERED",
        `The containment mechanism shatters. Sparks fly. The core seals itself permanently. It's over.`,
        "Celia", "⚡", "celia", undefined,
        [
            { id: "retry", text: "Try Again", nextSceneId: "INTERACT_OBSTACLE_DEMO" },
            { id: "back", text: "Return to Hub", nextSceneId: "A2_STUB" }
        ]
    ),

    "INTERACT_OBSTACLE_WIN": s(
        "INTERACT_OBSTACLE_WIN", "INTERACT DEMO", "DEV TEST", "ACCESS GRANTED",
        `The door gives way with a grinding shriek. Beyond it, the core pulses — exposed, vulnerable.`,
        "Celia", "⚡", "celia", undefined,
        [
            { id: "back", text: "Return to Hub", nextSceneId: "A2_STUB" }
        ],
        state => ({ ...state, COMPANY_health: state.COMPANY_health - 5 })
    ),

    "INTERACT_PAIN_DEMO": {
        id: "INTERACT_PAIN_DEMO",
        arcTitle: "INTERACT DEMO",
        chapterTitle: "DEV TEST",
        sceneTitle: "PAIN THRESHOLD — DON'T BREAK THE ORB",
        text: "The orb is fragile. Strike it to extract its energy, but hit too hard and it shatters. Find the rhythm.",
        characterFocus: "daisy",
        choices: [],
        type: 'interact' as const,
        interactConfig: {
            mechanic: {
                type: 'pain_threshold' as const,
                hitButtonLabel: "💎 STRIKE",
                intensityPerPress: 3,           // need ~34 careful hits
                painPerPress: 5,                // builds pain faster than intensity
                painDrainRate: 8,               // pain drains ~12.5 per second when idle
                intensityTarget: 100,
                painCrackThreshold: 100,
                onCrackSceneId: "INTERACT_PAIN_CRACKED",
                onSuccessSceneId: "INTERACT_PAIN_WIN",
                onHiddenCrackSceneId: "INTERACT_PAIN_HIDDEN",  // intentional crack = hidden path
            },
            narrativeText: "The orb flickers. Strike precisely — fill the intensity bar without exceeding the pain threshold. Or... maybe break it on purpose?",
            showBars: { intensity: true, pain: true },
        }
    } as SceneNode,

    "INTERACT_PAIN_CRACKED": s(
        "INTERACT_PAIN_CRACKED", "INTERACT DEMO", "DEV TEST", "ORB SHATTERED",
        `The orb fractures, sending prismatic shards across the floor. Its energy scatters... but wait. Something hidden fell out.`,
        "Daisy", "✧", "daisy", undefined,
        [
            { id: "retry", text: "Try Again", nextSceneId: "INTERACT_PAIN_DEMO" },
            { id: "back", text: "Return to Hub", nextSceneId: "A2_STUB" }
        ]
    ),

    "INTERACT_PAIN_WIN": s(
        "INTERACT_PAIN_WIN", "INTERACT DEMO", "DEV TEST", "ENERGY EXTRACTED",
        `The orb dims peacefully. Its energy now sits in your palm — contained, controlled. Daisy nods approvingly from across the room.`,
        "Daisy", "✧", "daisy", undefined,
        [
            { id: "back", text: "Return to Hub", nextSceneId: "A2_STUB" }
        ],
        state => ({ ...state, DAISY_trust: state.DAISY_trust + 10 })
    ),

    "INTERACT_PAIN_HIDDEN": s(
        "INTERACT_PAIN_HIDDEN", "INTERACT DEMO", "DEV TEST", "HIDDEN PATH UNLOCKED",
        `You broke it on purpose. The shards rearrange themselves into a pattern you've never seen before. A hidden data stream opens...

[SECRET SCENE UNLOCKED]`,
        "Daisy", "✧", "daisy", undefined,
        [
            { id: "back", text: "Return to Hub", nextSceneId: "A2_STUB" }
        ],
        state => ({ ...state, SENTINEL_gap: state.SENTINEL_gap + 15, CORRUPTION: state.CORRUPTION + 5 })
    )
};
