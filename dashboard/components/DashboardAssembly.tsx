'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Settings } from 'lucide-react'

interface DashboardAssemblyProps {
    /** When true, the dashboard data is loaded and the animation should complete */
    isReady?: boolean;
    /** Called after the exit animation finishes */
    onComplete?: () => void;
}

/**
 * DashboardAssembly — Animated loading screen shown after sign-in.
 * 
 * Mimics the dashboard layout being "assembled" piece by piece:
 * 1. Frame border traces itself
 * 2. Top rail slides down
 * 3. Content panels pop up with stagger
 * 4. Bottom dock rises into place
 * 5. Connection sparks flash at joints
 * 6. Status text cycles through phases
 */

const ASSEMBLY_PHASES = [
    'Authenticating session...',
    'Assembling command center...',
    'Wiring agent channels...',
    'Loading dashboard...',
]

const CYCLING_MESSAGES = [
    'Summoning agents...',
    'Conjuring dashboard...',
    'Debugging reality...',
    'Untangling thoughts...',
    'Calibrating sarcasm...',
]

// Spark effect at connection points
function Spark({ x, y, delay }: { x: string; y: string; delay: number }) {
    return (
        <motion.div
            className="absolute rounded-full"
            style={{
                left: x,
                top: y,
                width: 6,
                height: 6,
                background: '#FF6D29',
                boxShadow: '0 0 12px 4px rgba(255, 109, 41, 0.6), 0 0 24px 8px rgba(255, 109, 41, 0.2)',
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{
                scale: [0, 1.8, 0],
                opacity: [0, 1, 0],
            }}
            transition={{
                delay,
                duration: 0.6,
                ease: 'easeOut',
            }}
        />
    )
}

// Animated worker cursor that loops through positions continuously
function WorkerCursor() {
    const [posIndex, setPosIndex] = useState(0)

    const positions = [
        { x: '50%', y: '8%' },   // top rail
        { x: '22%', y: '45%' },  // left panel
        { x: '62%', y: '45%' },  // right panel
        { x: '50%', y: '92%' },  // bottom dock
    ]

    useEffect(() => {
        const interval = setInterval(() => {
            setPosIndex((prev) => (prev + 1) % positions.length)
        }, 800)
        return () => clearInterval(interval)
    }, [positions.length])

    const pos = positions[posIndex]

    return (
        <motion.div
            className="absolute z-30 pointer-events-none"
            animate={{
                left: pos.x,
                top: pos.y,
            }}
            transition={{
                type: 'spring',
                stiffness: 100,
                damping: 18,
                mass: 0.8,
            }}
            style={{ marginLeft: -8, marginTop: -8 }}
        >
            {/* Cursor glow */}
            <motion.div
                className="rounded-full"
                style={{
                    width: 16,
                    height: 16,
                    background: 'radial-gradient(circle, rgba(255,109,41,0.9) 0%, rgba(255,109,41,0) 70%)',
                }}
                animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.8, 0.4, 0.8],
                }}
                transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />
            {/* Cursor trail */}
            <motion.div
                className="absolute rounded-full"
                style={{
                    top: 4, left: 4,
                    width: 8,
                    height: 8,
                    background: '#FF6D29',
                    boxShadow: '0 0 8px 2px rgba(255,109,41,0.5)',
                }}
                animate={{
                    scale: [1, 0.8, 1],
                }}
                transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
            />
        </motion.div>
    )
}

export function DashboardAssembly({ isReady, onComplete }: DashboardAssemblyProps = {}) {
    const [phase, setPhase] = useState(0)
    const [showSparks, setShowSparks] = useState(false)
    const [cyclingIndex, setCyclingIndex] = useState(0)
    const [dismissed, setDismissed] = useState(false)
    const mountTime = useRef(Date.now())
    const MIN_DISPLAY_MS = 2800 // minimum time to show the assembly animation

    useEffect(() => {
        const timers = [
            setTimeout(() => setPhase(1), 600),
            setTimeout(() => setPhase(2), 1400),
            setTimeout(() => setPhase(3), 2200),
            setTimeout(() => setShowSparks(true), 2600),
        ]
        return () => timers.forEach(clearTimeout)
    }, [])

    // When isReady, wait for minimum display time then dismiss
    useEffect(() => {
        if (!isReady) return
        const elapsed = Date.now() - mountTime.current
        const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)
        const timer = setTimeout(() => {
            setDismissed(true)
            // Give exit animation time to play
            setTimeout(() => onComplete?.(), 800)
        }, remaining + 400) // +400ms for the progress bar to fill
        return () => clearTimeout(timer)
    }, [isReady, onComplete])

    // Cycling messages that fade in/out continuously
    useEffect(() => {
        if (dismissed) return
        const interval = setInterval(() => {
            setCyclingIndex((prev) => (prev + 1) % CYCLING_MESSAGES.length)
        }, 2200)
        return () => clearInterval(interval)
    }, [dismissed])

    // Skeleton piece shared styles
    const skeletonBorder = '1px solid rgba(255,255,255,0.08)'
    const skeletonBg = 'rgba(255,255,255,0.03)'
    const skeletonBgLit = 'rgba(255,109,41,0.06)'

    return (
        <motion.div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
            style={{ background: '#080706' }}
            initial={{ opacity: 1 }}
            animate={{ opacity: dismissed ? 0 : 1 }}
            transition={{ duration: dismissed ? 0.7 : 0.3, ease: 'easeInOut' }}
        >
            {/* Ambient radial glow */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse 60% 40% at 50% 45%, rgba(255,109,41,0.04) 0%, transparent 100%)',
                }}
            />

            {/* Dashboard Blueprint Container */}
            <div className="relative" style={{ width: 520, height: 340 }}>

                <WorkerCursor />

                {/* ═══ OUTER FRAME ═══ */}
                <motion.div
                    className="absolute inset-0 rounded-2xl overflow-hidden"
                    style={{ border: '1.5px solid rgba(255,255,255,0.06)' }}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />

                {/* ═══ TOP RAIL ═══ */}
                <motion.div
                    className="absolute flex items-center justify-center"
                    style={{
                        top: 12,
                        left: 14,
                        right: 14,
                        height: 28,
                        borderRadius: 14,
                        background: skeletonBg,
                        border: skeletonBorder,
                    }}
                    initial={{ y: -40, opacity: 0 }}
                    animate={phase >= 0 ? { y: 0, opacity: 1 } : {}}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                >
                    {/* Mini nav dots — centered with even spacing */}
                    <div className="flex items-center gap-3">
                        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                            <motion.div
                                key={i}
                                className="rounded-full"
                                style={{
                                    width: 8,
                                    height: 8,
                                    background: i === 0 ? 'rgba(255,109,41,0.5)' : 'rgba(255,255,255,0.1)',
                                }}
                                initial={{ scale: 0 }}
                                animate={phase >= 0 ? { scale: 1 } : {}}
                                transition={{ delay: 0.4 + i * 0.06, duration: 0.3, type: 'spring' }}
                            />
                        ))}
                    </div>
                </motion.div>

                {/* ═══ AVATAR NOTCH (top-right) ═══ */}
                <motion.div
                    className="absolute"
                    style={{
                        top: 12,
                        right: 14,
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        background: skeletonBg,
                        border: skeletonBorder,
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={phase >= 0 ? { scale: 1, opacity: 1 } : {}}
                    transition={{ delay: 0.5, duration: 0.4, type: 'spring' }}
                >
                    <motion.div
                        className="absolute inset-[5px] rounded-full"
                        style={{ background: 'rgba(255,109,41,0.25)' }}
                        initial={{ scale: 0 }}
                        animate={phase >= 0 ? { scale: 1 } : {}}
                        transition={{ delay: 0.7, duration: 0.3, type: 'spring' }}
                    />
                </motion.div>

                {/* ═══ LEFT PANEL (Agent Showcase area) ═══ */}
                <motion.div
                    className="absolute"
                    style={{
                        top: 52,
                        left: 14,
                        width: '42%',
                        bottom: 56,
                        borderRadius: 12,
                        background: skeletonBg,
                        border: skeletonBorder,
                    }}
                    initial={{ x: -60, opacity: 0 }}
                    animate={phase >= 1 ? { x: 0, opacity: 1 } : {}}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    {/* Agent avatar placeholder */}
                    <motion.div
                        className="absolute rounded-lg"
                        style={{
                            top: 12, left: 12, width: 48, height: 48,
                            background: skeletonBgLit,
                            border: '1px solid rgba(255,109,41,0.12)',
                        }}
                        initial={{ scale: 0 }}
                        animate={phase >= 1 ? { scale: 1 } : {}}
                        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                    />
                    {/* Text lines */}
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="absolute rounded-full"
                            style={{
                                top: 16 + i * 16,
                                left: 72,
                                right: 16,
                                height: 8,
                                background: i === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                                width: i === 2 ? '40%' : undefined,
                            }}
                            initial={{ scaleX: 0, opacity: 0, originX: 0 }}
                            animate={phase >= 1 ? { scaleX: 1, opacity: 1 } : {}}
                            transition={{ delay: 0.4 + i * 0.12, duration: 0.4, ease: 'easeOut' }}
                        />
                    ))}
                    {/* Stats bar */}
                    <motion.div
                        className="absolute rounded-md"
                        style={{
                            bottom: 12, left: 12, right: 12, height: 32,
                            background: 'rgba(255,255,255,0.02)',
                            border: skeletonBorder,
                        }}
                        initial={{ y: 20, opacity: 0 }}
                        animate={phase >= 2 ? { y: 0, opacity: 1 } : {}}
                        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* Mini XP bar */}
                        <motion.div
                            className="absolute rounded-full"
                            style={{
                                top: 12, left: 8, height: 6,
                                background: 'linear-gradient(90deg, rgba(255,109,41,0.4), rgba(255,186,8,0.3))',
                                borderRadius: 3,
                            }}
                            initial={{ width: 0 }}
                            animate={phase >= 2 ? { width: '60%' } : {}}
                            transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
                        />
                    </motion.div>
                </motion.div>

                {/* ═══ RIGHT PANEL (Content area) ═══ */}
                <motion.div
                    className="absolute"
                    style={{
                        top: 52,
                        left: '46%',
                        right: 14,
                        bottom: 56,
                        borderRadius: 12,
                        background: skeletonBg,
                        border: skeletonBorder,
                    }}
                    initial={{ x: 60, opacity: 0 }}
                    animate={phase >= 1 ? { x: 0, opacity: 1 } : {}}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                >
                    {/* Mini cards grid */}
                    {[
                        { top: 12, left: 12, w: '45%', h: 64 },
                        { top: 12, left: '55%', w: '40%', h: 64 },
                        { top: 88, left: 12, w: '92%', h: 48 },
                        { top: 148, left: 12, w: '60%', h: 32 },
                    ].map((card, i) => (
                        <motion.div
                            key={i}
                            className="absolute rounded-lg"
                            style={{
                                top: card.top,
                                left: card.left,
                                width: card.w,
                                height: card.h,
                                background: i === 0 ? skeletonBgLit : 'rgba(255,255,255,0.02)',
                                border: skeletonBorder,
                            }}
                            initial={{ y: 30, opacity: 0, scale: 0.9 }}
                            animate={phase >= 2 ? { y: 0, opacity: 1, scale: 1 } : {}}
                            transition={{
                                delay: 0.1 + i * 0.15,
                                duration: 0.5,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                        >
                            {/* Inner shimmer for first card */}
                            {i === 0 && (
                                <motion.div
                                    className="absolute inset-0 rounded-lg overflow-hidden"
                                    initial={{ opacity: 0 }}
                                    animate={phase >= 2 ? { opacity: 1 } : {}}
                                    transition={{ delay: 0.5 }}
                                >
                                    <motion.div
                                        className="absolute inset-y-0 w-[40%]"
                                        style={{
                                            background: 'linear-gradient(90deg, transparent, rgba(255,109,41,0.08), transparent)',
                                        }}
                                        animate={{ left: ['-40%', '140%'] }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            ease: 'linear',
                                            delay: 1,
                                        }}
                                    />
                                </motion.div>
                            )}
                        </motion.div>
                    ))}
                </motion.div>

                {/* ═══ BOTTOM DOCK ═══ */}
                <motion.div
                    className="absolute flex items-center justify-center gap-2"
                    style={{
                        bottom: 14,
                        left: 14,
                        right: 14,
                        height: 32,
                        borderRadius: 16,
                        background: skeletonBg,
                        border: skeletonBorder,
                    }}
                    initial={{ y: 40, opacity: 0 }}
                    animate={phase >= 3 ? { y: 0, opacity: 1 } : {}}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="rounded-md"
                            style={{
                                width: 20,
                                height: 16,
                                background: i === 1 ? 'rgba(255,109,41,0.2)' : 'rgba(255,255,255,0.06)',
                                borderRadius: 4,
                            }}
                            initial={{ scale: 0 }}
                            animate={phase >= 3 ? { scale: 1 } : {}}
                            transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 300 }}
                        />
                    ))}
                </motion.div>

                {/* ═══ CONNECTION SPARKS ═══ */}
                <AnimatePresence>
                    {showSparks && (
                        <>
                            <Spark x="50%" y="44px" delay={0} />
                            <Spark x="44%" y="50%" delay={0.15} />
                            <Spark x="50%" y="82%" delay={0.3} />
                            <Spark x="14%" y="50%" delay={0.1} />
                            <Spark x="86%" y="50%" delay={0.2} />
                        </>
                    )}
                </AnimatePresence>

                {/* ═══ PULSE when assembled ═══ */}
                {phase >= 3 && (
                    <motion.div
                        className="absolute inset-0 rounded-2xl pointer-events-none"
                        style={{
                            border: '1px solid rgba(255,109,41,0.2)',
                        }}
                        initial={{ opacity: 0, scale: 1 }}
                        animate={{
                            opacity: [0, 0.6, 0],
                            scale: [1, 1.02, 1.04],
                        }}
                        transition={{
                            delay: 0.5,
                            duration: 1,
                            ease: 'easeOut',
                        }}
                    />
                )}
            </div>

            {/* ═══ STATUS TEXT ═══ */}
            <div className="mt-10 flex flex-col items-center gap-3">
                {/* Spinning gear icon */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1, rotate: 360 }}
                    transition={{
                        opacity: { duration: 0.4 },
                        scale: { duration: 0.4 },
                        rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
                    }}
                >
                    <Settings
                        size={20}
                        style={{ color: 'rgba(255,109,41,0.5)' }}
                    />
                </motion.div>

                {/* Animated cycling text */}
                <div className="h-5 relative">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={cyclingIndex}
                            className="text-sm font-medium tracking-wide"
                            style={{ color: 'rgba(245, 240, 235, 0.5)' }}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.4 }}
                        >
                            {CYCLING_MESSAGES[cyclingIndex]}
                        </motion.p>
                    </AnimatePresence>
                </div>

                {/* Progress bar — much slower fill */}
                <div
                    className="overflow-hidden rounded-full"
                    style={{
                        width: 180,
                        height: 3,
                        background: 'rgba(255,255,255,0.06)',
                    }}
                >
                    <motion.div
                        className="h-full rounded-full"
                        style={{
                            background: 'linear-gradient(90deg, #FF6D29, #FFBA08)',
                        }}
                        initial={{ width: '2%' }}
                        animate={{
                            width: isReady
                                ? '100%'
                                : ['2%', '15%', '28%', '40%', '52%', '60%'],
                        }}
                        transition={isReady
                            ? { duration: 0.5, ease: 'easeOut' }
                            : {
                                duration: 18,
                                ease: 'easeOut',
                                times: [0, 0.15, 0.35, 0.55, 0.75, 1],
                            }
                        }
                    />
                </div>
            </div>
        </motion.div>
    )
}
