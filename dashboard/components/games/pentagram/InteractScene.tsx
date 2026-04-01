"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    InteractSceneConfig,
    ResistanceMechanicConfig,
    ObstacleMechanicConfig,
    PainThresholdMechanicConfig,
    ImageSequenceMapping,
    SceneId,
} from "@/lib/games/pentagram/types";
import { ImageSequenceAnimator } from "./ImageSequenceAnimator";

// ============================================================
// INTERACT SCENE — Full interactive gameplay scene
// ============================================================

interface InteractSceneProps {
    config: InteractSceneConfig;
    backgroundUrl?: string;
    sceneTitle?: string;
    narrativeOverride?: string;
    onSceneTransition: (nextSceneId: SceneId) => void;
}

// Shared bar component
function GameBar({
    label,
    value,
    max = 100,
    color,
    pulseOnLow = false,
    pulseOnHigh = false,
    lowThreshold = 25,
    highThreshold = 80,
}: {
    label: string;
    value: number;
    max?: number;
    color: string;
    pulseOnLow?: boolean;
    pulseOnHigh?: boolean;
    lowThreshold?: number;
    highThreshold?: number;
}) {
    const pct = Math.min(100, Math.max(0, (value / max) * 100));
    const shouldPulse =
        (pulseOnLow && pct <= lowThreshold) || (pulseOnHigh && pct >= highThreshold);

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] uppercase tracking-[0.15em] text-white/60 font-mono">
                    {label}
                </span>
                <span className="text-[10px] font-mono text-white/40">
                    {Math.round(value)}/{max}
                </span>
            </div>
            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 relative">
                <motion.div
                    className={cn(
                        "h-full rounded-full transition-all duration-150",
                        shouldPulse && "animate-pulse"
                    )}
                    style={{
                        width: `${pct}%`,
                        background: color,
                    }}
                    layout
                />
                {/* Glow effect */}
                <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                        boxShadow: `inset 0 0 8px ${color}33`,
                    }}
                />
            </div>
        </div>
    );
}

// Interaction button
function ActionButton({
    label,
    onPress,
    onRelease,
    holdMode = false,
    color = "#10b981",
    scale = 1,
    disabled = false,
    pulsing = false,
    className: extraClass = "",
}: {
    label: string;
    onPress: () => void;
    onRelease?: () => void;
    holdMode?: boolean;
    color?: string;
    scale?: number;
    disabled?: boolean;
    pulsing?: boolean;
    className?: string;
}) {
    const intervalRef = useRef<number>(0);

    const handlePointerDown = useCallback(() => {
        if (disabled) return;
        onPress();
        if (holdMode) {
            // Continuous press at ~60fps
            intervalRef.current = window.setInterval(onPress, 16);
        }
    }, [disabled, holdMode, onPress]);

    const handlePointerUp = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = 0;
        }
        onRelease?.();
    }, [onRelease]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    return (
        <motion.button
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            disabled={disabled}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
                scale: disabled ? 0.9 * scale : scale,
                opacity: disabled ? 0.3 : 1,
            }}
            whileTap={{ scale: scale * 0.92 }}
            className={cn(
                "relative select-none touch-none cursor-pointer rounded-xl border-2 px-8 py-4 font-black uppercase tracking-widest text-sm shadow-2xl transition-colors",
                pulsing && !disabled && "animate-pulse",
                disabled && "cursor-not-allowed",
                extraClass
            )}
            style={{
                borderColor: color,
                background: `linear-gradient(135deg, ${color}22, ${color}44)`,
                color: color,
                textShadow: `0 0 12px ${color}88`,
                boxShadow: `0 0 20px ${color}33, inset 0 1px 0 ${color}22`,
            }}
        >
            {/* Ripple glow */}
            <div
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{
                    background: `radial-gradient(circle at center, ${color}11 0%, transparent 70%)`,
                }}
            />
            {label}
        </motion.button>
    );
}

// ============================================================
// RESISTANCE MECHANIC
// ============================================================

function ResistanceMechanic({
    config,
    onTransition,
    heroAnimation,
}: {
    config: ResistanceMechanicConfig;
    onTransition: (id: SceneId) => void;
    heroAnimation?: ImageSequenceMapping;
}) {
    const [victoryBar, setVictoryBar] = useState(0);
    const [resistanceBar, setResistanceBar] = useState(100);
    const [isHolding, setIsHolding] = useState(false);
    const [phase, setPhase] = useState<"pin" | "hit" | "victory" | "fail">("pin");
    const [hitCount, setHitCount] = useState(0);
    const [triggerKey, setTriggerKey] = useState(0);
    const rafRef = useRef<number>(0);
    const lastTickRef = useRef(performance.now());

    // Game loop
    useEffect(() => {
        if (phase !== "pin") return;

        const tick = (now: number) => {
            const dt = (now - lastTickRef.current) / 1000;
            lastTickRef.current = now;

            if (isHolding) {
                setVictoryBar((v) => {
                    const next = v + config.victoryFillRate * dt;
                    if (next >= 100) {
                        if (config.enableHitPhase) {
                            setPhase("hit");
                        } else {
                            setPhase("victory");
                            setTimeout(() => onTransition(config.onVictorySceneId), 1200);
                        }
                        return 100;
                    }
                    return next;
                });
            } else {
                setResistanceBar((r) => {
                    const next = r - config.resistanceDrainRate * dt;
                    if (next <= config.breakFreeThreshold) {
                        setPhase("fail");
                        setTimeout(() => onTransition(config.onBreakFreeSceneId), 1200);
                        return config.breakFreeThreshold;
                    }
                    return next;
                });
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        lastTickRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [isHolding, phase, config, onTransition]);

    const handleHit = () => {
        if (phase !== "hit") return;
        setTriggerKey((k) => k + 1);
        setHitCount((c) => {
            const next = c + 1;
            const target = config.hitPhaseTarget || 10;
            if (next >= target) {
                setPhase("victory");
                setTimeout(
                    () =>
                        onTransition(
                            config.onHitCompleteSceneId || config.onVictorySceneId
                        ),
                    1200
                );
            }
            return next;
        });
    };

    const activeAnim =
        phase === "victory"
            ? config.victoryAnimation
            : phase === "fail"
            ? config.failAnimation
            : isHolding
            ? config.actionAnimation
            : config.idleAnimation;

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
            {/* Animated hero area */}
            {(activeAnim || heroAnimation) && (
                <div className="w-64 h-64 relative flex items-center justify-center">
                    <ImageSequenceAnimator
                        animation={activeAnim || heroAnimation!}
                        triggerKey={triggerKey}
                        className="w-full h-full object-contain"
                    />
                </div>
            )}

            {/* Bars */}
            <div className="w-full space-y-3 px-4">
                <GameBar
                    label="VICTORY"
                    value={victoryBar}
                    color="#10b981"
                    pulseOnHigh
                    highThreshold={80}
                />
                <GameBar
                    label="RESISTANCE"
                    value={resistanceBar}
                    color="#f43f5e"
                    pulseOnLow
                    lowThreshold={config.breakFreeThreshold + 10}
                />
            </div>

            {/* Phase UI */}
            {phase === "pin" && (
                <ActionButton
                    label={config.pinButtonLabel || "⚡ HOLD TO PIN"}
                    onPress={() => setIsHolding(true)}
                    onRelease={() => setIsHolding(false)}
                    holdMode={false}
                    color="#f59e0b"
                    scale={1.1}
                />
            )}

            {phase === "hit" && (
                <div className="flex flex-col items-center gap-3">
                    <span className="text-xs text-emerald-400 uppercase tracking-widest animate-pulse">
                        IT&apos;S WEAKENED — SPAM NOW!
                    </span>
                    <ActionButton
                        label={`💥 HIT (${hitCount}/${config.hitPhaseTarget || 10})`}
                        onPress={handleHit}
                        color="#ef4444"
                        scale={1.3}
                        pulsing
                    />
                </div>
            )}

            {phase === "victory" && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-2xl font-black text-emerald-400 uppercase tracking-widest"
                >
                    ✦ VICTORY ✦
                </motion.div>
            )}

            {phase === "fail" && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-2xl font-black text-rose-500 uppercase tracking-widest"
                >
                    ✗ BREAK FREE ✗
                </motion.div>
            )}
        </div>
    );
}

// ============================================================
// OBSTACLE MECHANIC
// ============================================================

function ObstacleMechanic({
    config,
    onTransition,
    heroAnimation,
}: {
    config: ObstacleMechanicConfig;
    onTransition: (id: SceneId) => void;
    heroAnimation?: ImageSequenceMapping;
}) {
    const startVal = config.obstacleStartValue ?? 100;
    const [obstacleBar, setObstacleBar] = useState(startVal);
    const [forceBar, setForceBar] = useState(0);
    const [phase, setPhase] = useState<"force" | "hit" | "victory" | "broken">("force");
    const [hitCount, setHitCount] = useState(0);
    const [buttonVisible, setButtonVisible] = useState(true);
    const [triggerKey, setTriggerKey] = useState(0);
    const pressTimestamps = useRef<number[]>([]);

    // Button flicker
    useEffect(() => {
        if (
            phase !== "force" ||
            !config.forceButtonFlickerInterval ||
            config.forceButtonFlickerInterval <= 0
        )
            return;

        const interval = setInterval(() => {
            setButtonVisible(true);
            setTimeout(() => {
                setButtonVisible(false);
            }, config.forceButtonFlickerDuration || 1500);
        }, config.forceButtonFlickerInterval);

        return () => clearInterval(interval);
    }, [phase, config.forceButtonFlickerInterval, config.forceButtonFlickerDuration]);

    const handleForce = () => {
        if (phase !== "force" || !buttonVisible) return;

        // Spam rate check
        const now = Date.now();
        pressTimestamps.current.push(now);
        pressTimestamps.current = pressTimestamps.current.filter(
            (t) => now - t < 1000
        );

        if (
            config.maxSpamRate &&
            config.maxSpamRate > 0 &&
            pressTimestamps.current.length > config.maxSpamRate
        ) {
            setPhase("broken");
            if (config.onBreakSceneId) {
                setTimeout(() => onTransition(config.onBreakSceneId!), 1200);
            }
            return;
        }

        setTriggerKey((k) => k + 1);
        setForceBar((f) => Math.min(100, f + config.forcePerPress));
        setObstacleBar((o) => {
            const next = o - config.forcePerPress;
            if (next <= 0) {
                if (config.enableHitPhase) {
                    setPhase("hit");
                } else {
                    setPhase("victory");
                    const target =
                        config.onObstacleClearedSceneId || config.onHitCompleteSceneId;
                    if (target) setTimeout(() => onTransition(target), 1200);
                }
                return 0;
            }
            return next;
        });
    };

    const handleHit = () => {
        if (phase !== "hit") return;
        setTriggerKey((k) => k + 1);
        setHitCount((c) => {
            const next = c + 1;
            const target = config.hitPhaseTarget || 10;
            if (next >= target) {
                setPhase("victory");
                setTimeout(
                    () =>
                        onTransition(
                            config.onHitCompleteSceneId ||
                                config.onObstacleClearedSceneId ||
                                ""
                        ),
                    1200
                );
            }
            return next;
        });
    };

    const activeAnim =
        phase === "victory"
            ? config.victoryAnimation
            : phase === "broken"
            ? config.failAnimation
            : config.actionAnimation || config.idleAnimation;

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
            {(activeAnim || heroAnimation) && (
                <div className="w-64 h-64 relative flex items-center justify-center">
                    <ImageSequenceAnimator
                        animation={activeAnim || heroAnimation!}
                        triggerKey={triggerKey}
                        className="w-full h-full object-contain"
                    />
                </div>
            )}

            <div className="w-full space-y-3 px-4">
                <GameBar
                    label="FORCE APPLIED"
                    value={forceBar}
                    color="#3b82f6"
                    pulseOnHigh
                />
                <GameBar
                    label="OBSTACLE"
                    value={obstacleBar}
                    max={startVal}
                    color="#f59e0b"
                    pulseOnLow
                    lowThreshold={20}
                />
            </div>

            {phase === "force" && (
                <AnimatePresence>
                    {buttonVisible && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                        >
                            <ActionButton
                                label={config.forceButtonLabel || "⚡ FORCE"}
                                onPress={handleForce}
                                color="#3b82f6"
                                scale={1.1}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {phase === "hit" && (
                <div className="flex flex-col items-center gap-3">
                    <span className="text-xs text-blue-400 uppercase tracking-widest animate-pulse">
                        OBSTACLE CLEARED — STRIKE NOW!
                    </span>
                    <ActionButton
                        label={`💥 HIT (${hitCount}/${config.hitPhaseTarget || 10})`}
                        onPress={handleHit}
                        color="#ef4444"
                        scale={1.3}
                        pulsing
                    />
                </div>
            )}

            {phase === "victory" && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-2xl font-black text-emerald-400 uppercase tracking-widest"
                >
                    ✦ CLEARED ✦
                </motion.div>
            )}

            {phase === "broken" && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-2xl font-black text-rose-500 uppercase tracking-widest"
                >
                    ✗ BROKEN ✗
                </motion.div>
            )}
        </div>
    );
}

// ============================================================
// PAIN THRESHOLD MECHANIC
// ============================================================

function PainThresholdMechanic({
    config,
    onTransition,
    heroAnimation,
}: {
    config: PainThresholdMechanicConfig;
    onTransition: (id: SceneId) => void;
    heroAnimation?: ImageSequenceMapping;
}) {
    const [intensity, setIntensity] = useState(0);
    const [pain, setPain] = useState(0);
    const [phase, setPhase] = useState<"active" | "cracked" | "success">("active");
    const [triggerKey, setTriggerKey] = useState(0);
    const [lastPressTime, setLastPressTime] = useState(0);
    const rafRef = useRef<number>(0);
    const lastTickRef = useRef(performance.now());
    const intensityTarget = config.intensityTarget ?? 100;
    const painThreshold = config.painCrackThreshold ?? 100;

    // Pain drain loop
    useEffect(() => {
        if (phase !== "active") return;

        const tick = (now: number) => {
            const dt = (now - lastTickRef.current) / 1000;
            lastTickRef.current = now;

            // Pain drains when not pressing
            const timeSincePress = now - lastPressTime;
            if (timeSincePress > 300) {
                setPain((p) => Math.max(0, p - config.painDrainRate * dt));
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        lastTickRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [phase, lastPressTime, config.painDrainRate]);

    const handlePress = () => {
        if (phase !== "active") return;
        setLastPressTime(performance.now());
        setTriggerKey((k) => k + 1);

        setIntensity((i) => {
            const next = i + config.intensityPerPress;
            if (next >= intensityTarget) {
                setPhase("success");
                setTimeout(() => onTransition(config.onSuccessSceneId), 1200);
                return intensityTarget;
            }
            return next;
        });

        setPain((p) => {
            const next = p + config.painPerPress;
            if (next >= painThreshold) {
                setPhase("cracked");
                const target = config.onHiddenCrackSceneId || config.onCrackSceneId;
                setTimeout(() => onTransition(target), 1200);
                return painThreshold;
            }
            return next;
        });
    };

    const activeAnim =
        phase === "success"
            ? config.victoryAnimation
            : phase === "cracked"
            ? config.failAnimation
            : config.actionAnimation || config.idleAnimation;

    const painPct = (pain / painThreshold) * 100;

    return (
        <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
            {(activeAnim || heroAnimation) && (
                <div className="w-64 h-64 relative flex items-center justify-center">
                    <ImageSequenceAnimator
                        animation={activeAnim || heroAnimation!}
                        triggerKey={triggerKey}
                        className="w-full h-full object-contain"
                    />
                    {/* Crack overlay when pain is high */}
                    {painPct > 60 && (
                        <div
                            className="absolute inset-0 pointer-events-none rounded-lg"
                            style={{
                                background: `radial-gradient(circle, transparent 40%, rgba(239,68,68,${(painPct - 60) / 200}) 100%)`,
                                mixBlendMode: "multiply",
                            }}
                        />
                    )}
                </div>
            )}

            <div className="w-full space-y-3 px-4">
                <GameBar
                    label="INTENSITY"
                    value={intensity}
                    max={intensityTarget}
                    color="#10b981"
                    pulseOnHigh
                />
                <GameBar
                    label="⚠ PAIN"
                    value={pain}
                    max={painThreshold}
                    color="#ef4444"
                    pulseOnHigh
                    highThreshold={70}
                />
            </div>

            {phase === "active" && (
                <div className="flex flex-col items-center gap-2">
                    {painPct > 70 && (
                        <span className="text-[10px] text-rose-400 uppercase tracking-widest animate-pulse">
                            ⚠ CAREFUL — ABOUT TO CRACK ⚠
                        </span>
                    )}
                    <ActionButton
                        label={config.hitButtonLabel || "💥 STRIKE"}
                        onPress={handlePress}
                        color={painPct > 70 ? "#ef4444" : "#10b981"}
                        scale={1.1 + (intensity / intensityTarget) * 0.3}
                    />
                </div>
            )}

            {phase === "success" && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-2xl font-black text-emerald-400 uppercase tracking-widest"
                >
                    ✦ CAPTURED ✦
                </motion.div>
            )}

            {phase === "cracked" && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-2xl font-black text-rose-500 uppercase tracking-widest flex flex-col items-center"
                >
                    <span>✗ CRACKED ✗</span>
                    {config.onHiddenCrackSceneId && (
                        <span className="text-xs text-rose-300 mt-1 opacity-60">
                            something hidden unlocked...
                        </span>
                    )}
                </motion.div>
            )}
        </div>
    );
}

// ============================================================
// MAIN INTERACT SCENE COMPONENT
// ============================================================

export function InteractScene({
    config,
    backgroundUrl,
    sceneTitle,
    narrativeOverride,
    onSceneTransition,
}: InteractSceneProps) {
    const narrative = narrativeOverride || config.narrativeText;
    const [customTriggers, setCustomTriggers] = useState<Record<string, number>>({});

    const handleCustomButtonPress = useCallback((buttonId: string) => {
        setCustomTriggers((prev) => ({
            ...prev,
            [buttonId]: (prev[buttonId] || 0) + 1,
        }));
    }, []);

    return (
        <div className="w-full h-full relative bg-black overflow-hidden flex flex-col font-mono text-sm selection:bg-emerald-500/30">
            {/* Background */}
            <AnimatePresence mode="wait">
                {backgroundUrl && (
                    <motion.div
                        key={backgroundUrl}
                        initial={{ opacity: 0, scale: 1.05 }}
                        animate={{ opacity: 0.6, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${backgroundUrl})` }}
                    />
                )}
            </AnimatePresence>

            {/* Background Animation (if provided) */}
            {config.backgroundAnimation && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                    <ImageSequenceAnimator
                        animation={{ ...config.backgroundAnimation, loop: true }}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Darkening overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

            {/* Scene Title */}
            {sceneTitle && (
                <div className="absolute top-6 left-6 z-20">
                    <div className="text-[10px] text-white/40 tracking-[0.2em] uppercase">
                        INTERACT MODE
                    </div>
                    <div className="text-xs tracking-widest uppercase font-semibold mt-1 text-orange-400">
                        {sceneTitle}
                    </div>
                </div>
            )}

            {/* Narrative Text */}
            {narrative && (
                <div className="absolute top-6 left-0 right-0 z-10 px-8 pt-16">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/70 backdrop-blur-md rounded border border-white/10 p-4 max-w-2xl mx-auto"
                    >
                        <p className="text-white/80 font-sans text-sm leading-relaxed">
                            {narrative}
                        </p>
                    </motion.div>
                </div>
            )}

            {/* Main Mechanic Area */}
            <div className="flex-1 relative z-10 flex flex-col items-center justify-center">
                {/* Hero Animation (if sprite sheet provided) */}
                {config.heroAnimation && !config.mechanic.idleAnimation && (
                    <div className="mb-8">
                        <ImageSequenceAnimator
                            animation={{ ...config.heroAnimation, loop: true }}
                            className="w-48 h-48"
                        />
                    </div>
                )}

                {/* Mechanic renderer */}
                {config.mechanic.type === "resistance" && (
                    <ResistanceMechanic
                        config={config.mechanic}
                        onTransition={onSceneTransition}
                        heroAnimation={config.heroAnimation}
                    />
                )}
                {config.mechanic.type === "obstacle" && (
                    <ObstacleMechanic
                        config={config.mechanic}
                        onTransition={onSceneTransition}
                        heroAnimation={config.heroAnimation}
                    />
                )}
                {config.mechanic.type === "pain_threshold" && (
                    <PainThresholdMechanic
                        config={config.mechanic}
                        onTransition={onSceneTransition}
                        heroAnimation={config.heroAnimation}
                    />
                )}
            </div>

            {/* Custom Buttons (positioned at bottom) */}
            {config.customButtons && config.customButtons.length > 0 && (
                <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center gap-4 px-8">
                    {config.customButtons
                        .filter((b) => b.visible !== false)
                        .map((btn) => {
                            const posClass =
                                btn.position === "bottom-left"
                                    ? "mr-auto"
                                    : btn.position === "bottom-right"
                                    ? "ml-auto"
                                    : "";

                            return (
                                <div key={btn.id} className={cn("flex flex-col items-center gap-2", posClass)}>
                                    {/* Button-mapped animation */}
                                    {btn.animation && (
                                        <div className="w-20 h-20">
                                            <ImageSequenceAnimator
                                                animation={btn.animation}
                                                triggerKey={customTriggers[btn.id] || 0}
                                                className="w-full h-full"
                                            />
                                        </div>
                                    )}
                                    <ActionButton
                                        label={btn.label}
                                        onPress={() => handleCustomButtonPress(btn.id)}
                                        color={btn.color || "#8b5cf6"}
                                        scale={btn.scale || 0.9}
                                    />
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}
