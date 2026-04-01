'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useCommandCenter } from '@/hooks/useCommandCenter';
import { useAgentBackground, prefetchAgentBackground } from '@/hooks/useAgentBackground';
import { useAgentDynamicColors } from '@/hooks/useImageDominantColor';
import { AnimatePresence, motion } from 'framer-motion';
import { prefetchAgentHero } from '@/hooks/useAgentHeroGallery';
import { prefetchAgentAvatar } from '@/hooks/useAgentAvatar';
import { useEffect } from 'react';

const AgentShowcase = dynamic(
    () => import('@/components/command-center/AgentShowcase').then(mod => mod.AgentShowcase),
    { ssr: false }
);

const AgentCarousel = dynamic(
    () => import('@/components/command-center/AgentCarousel').then(mod => mod.AgentCarousel),
    { ssr: false }
);



const AtmosphereLayer = dynamic(
    () => import('@/components/command-center/AtmosphereLayer').then(mod => mod.AtmosphereLayer),
    { ssr: false }
);

export default function OverviewPage() {
    const {
        isMounted,
        activeAgent,
        activeAgentXp,
        fleetPowerScore,
        currentStreak,
        setActiveAgentId,
        availableAgents,
        profileFetched
    } = useCommandCenter();

    const agentId = activeAgent?.id || '';
    const { backgroundUri, invalidate: invalidateBg } = useAgentBackground(agentId);
    const dynamicColors = useAgentDynamicColors(activeAgent?.colorHex);

    // Hero image state (managed by AgentShowcase, rendered here as a full-screen layer)
    const [heroUri, setHeroUri] = useState<string | null>(null);
    const [heroPosition, setHeroPosition] = useState<{ x: number; y: number }>({ x: 50, y: 100 });

    const handleHeroChanged = useCallback((uri: string | null, position: { x: number; y: number }) => {
        setHeroUri(uri);
        setHeroPosition(position);
    }, []);

    // Prefetch all agent assets so there are no loading flashes or stutters during transition
    useEffect(() => {
        if (availableAgents && availableAgents.length > 0) {
            availableAgents.forEach(agent => {
                prefetchAgentBackground(agent.id);
                prefetchAgentHero(agent.id);
                prefetchAgentAvatar(agent.id);
            });
        }
    }, [availableAgents]);

    if (!isMounted) {
        return <div className="w-screen h-screen bg-black" />;
    }

    return (
        <div className="absolute inset-0 overflow-hidden text-white selection:bg-white/20">

            {/* Layer 0: Custom Background Image (desaturated + dimmed) */}
            <AnimatePresence>
                {backgroundUri && (
                    <motion.div
                        key={backgroundUri}
                        className="absolute inset-0 z-[1]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <img
                            src={backgroundUri}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Layer 1: Ambient Atmosphere Glow */}
            <AtmosphereLayer colorHex={activeAgent?.colorHex || '#FF6B00'} />

            {/* Layer 2: Full-Screen Hero Image (above BG, behind cards) */}
            <AnimatePresence>
                {heroUri && (
                    <motion.div
                        key={heroUri}
                        className="absolute inset-0 z-[5] pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <img
                            src={heroUri}
                            alt=""
                            className="absolute inset-0 w-full h-full"
                            style={{
                                objectFit: 'contain',
                                objectPosition: `${heroPosition.x}% ${heroPosition.y}%`,
                            }}
                            draggable={false}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Layer 3: Main Content — full height, overlay on hero */}
            <div className="absolute inset-0 z-10 pointer-events-none group">

                {activeAgent ? (
                    <>
                        {/* Three-Column Agent Showcase — fills 100% height */}
                        <AgentShowcase
                            agentProfile={activeAgent}
                            level={activeAgentXp.level}
                            currentXp={activeAgentXp.totalXp}
                            xpToNext={activeAgentXp.xpToNextLevel}
                            rank={activeAgentXp.rank}
                            currentStreak={currentStreak}
                            onBackgroundChanged={invalidateBg}
                            onHeroChanged={handleHeroChanged}
                            availableAgents={availableAgents}
                            onSelectAgent={setActiveAgentId}
                            dynamicColors={dynamicColors}
                        />
                    </>
                ) : !profileFetched ? (
                    /* While profile is still loading, show nothing (assembly overlay covers this) */
                    null
                ) : (
                    <div className="flex flex-col items-center justify-center w-full h-full pb-20 pointer-events-auto">
                        <div className="text-6xl mb-6 opacity-60">👻</div>
                        <h3 className="text-2xl font-semibold tracking-tight text-foreground mb-2">No Command Link Established</h3>
                        <p className="text-muted-foreground text-center max-w-md mb-8">
                            Your Command Center is offline. Connect an external operations engine (like OpenClaw or Agent Zero) to populate your dashboard and wake up your agents.
                        </p>
                        <a href="/settings/bridges" className="pointer-events-auto">
                            <button className="bg-white/10 hover:bg-white/20 text-white font-medium py-2.5 px-6 rounded-full transition-all duration-200 border border-white/10 backdrop-blur-md flex items-center gap-2">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></svg>
                                Connect Engine
                            </button>
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}
