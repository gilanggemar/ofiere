'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { AgentProfile } from '@/lib/agentRoster';
import { useAgentAvatar } from '@/hooks/useAgentAvatar';
import { useAgentHeroGallery } from '@/hooks/useAgentHeroGallery';
import { AgentHeroPortrait } from '@/components/agent-showcase/AgentHeroPortrait';
import { AgentIdentityPlate } from '@/components/agent-showcase/AgentIdentityPlate';
import { AgentStatBlock } from '@/components/agent-showcase/AgentStatBlock';
import { AgentCarousel, type SocketAgent } from '@/components/command-center/AgentCarousel';

interface AgentShowcaseProps {
    agentProfile: AgentProfile;
    level: number;
    currentXp: number;
    xpToNext: number;
    rank: string;
    currentStreak: number;
    onBackgroundChanged?: () => void;
    availableAgents: SocketAgent[];
    onSelectAgent: (id: string) => void;
}

const columnVariants = {
    initial: { opacity: 0, y: 20, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: { opacity: 0, y: -10, filter: 'blur(8px)' },
};

const transition = (delay: number) => ({
    duration: 0.6,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
});

/** Decorative corner brackets for the HUD panel */
function HudCorners() {
    return (
        <>
            <div className="nerv-hud-corner nerv-hud-corner--tl" />
            <div className="nerv-hud-corner nerv-hud-corner--tr" />
            <div className="nerv-hud-corner nerv-hud-corner--bl" />
            <div className="nerv-hud-corner nerv-hud-corner--br" />
        </>
    );
}

export function AgentShowcase({ agentProfile, level, currentXp, xpToNext, rank, currentStreak, onBackgroundChanged, availableAgents, onSelectAgent }: AgentShowcaseProps) {
    const { avatarUri } = useAgentAvatar(agentProfile.id);
    const {
        images, activeIndex, activeImage, imageCount,
        next, prev, setActiveIndex, invalidate,
    } = useAgentHeroGallery(agentProfile.id);

    return (
        <div className="w-full h-full z-20 pointer-events-none flex overflow-hidden" style={{ gap: 0 }}>
            <AnimatePresence mode="wait">
                <motion.div
                    key={agentProfile.id}
                    className="flex w-full h-full overflow-hidden"
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    style={{ gap: 0 }}
                >
                    {/* LEFT COLUMN — Identity + Capabilities */}
                    <motion.div
                        className="w-[280px] flex-shrink-0 pointer-events-auto z-30 p-2 max-h-full"
                        variants={columnVariants}
                        transition={transition(0)}
                    >
                        <div
                            className="h-full max-h-full nerv-hud-panel nerv-hud-panel--breathing overflow-hidden"
                            style={{ '--panel-accent': agentProfile.colorHex } as React.CSSProperties}
                        >
                            <HudCorners />
                            <AgentIdentityPlate
                                agent={agentProfile}
                                level={level}
                                currentXp={currentXp}
                                xpToNext={xpToNext}
                                rank={rank}
                                currentStreak={currentStreak}
                            />
                        </div>
                    </motion.div>

                    {/* CENTER COLUMN — Hero Portrait (no container, edge-to-edge) */}
                    <motion.div
                        className="flex-1 min-w-0 h-full pointer-events-auto z-10 overflow-hidden"
                        style={{
                            padding: 0,
                            margin: 0,
                            border: 'none',
                            borderRadius: 0,
                            boxShadow: 'none',
                            background: 'transparent',
                        }}
                        variants={columnVariants}
                        transition={transition(0.08)}
                    >
                        <AgentHeroPortrait
                            agent={agentProfile}
                            heroUri={activeImage}
                            avatarUri={avatarUri}
                            imageCount={imageCount}
                            images={images}
                            activeIndex={activeIndex}
                            onPrev={prev}
                            onNext={next}
                            onSelectImage={setActiveIndex}
                            onGalleryChanged={invalidate}
                            onBackgroundChanged={onBackgroundChanged}
                        />
                    </motion.div>

                    {/* RIGHT COLUMN — Performance Stats & Agent Carousel */}
                    <motion.div
                        className="w-[300px] flex-shrink-0 pointer-events-auto z-30 p-2 max-h-full flex flex-col gap-4"
                        variants={columnVariants}
                        transition={transition(0.16)}
                    >
                        {/* Stats Card */}
                        <div
                            className="flex-[3] max-h-full nerv-hud-panel nerv-hud-panel--breathing overflow-hidden"
                            style={{ '--panel-accent': agentProfile.colorHex } as React.CSSProperties}
                        >
                            <HudCorners />
                            <AgentStatBlock
                                agent={agentProfile}
                                level={level}
                            />
                        </div>
                        
                        {/* Agent Carousel Card */}
                        <div
                            className="flex-[2] max-h-[40%] min-h-0 nerv-hud-panel nerv-hud-panel--breathing overflow-hidden flex flex-col"
                            style={{ '--panel-accent': agentProfile.colorHex } as React.CSSProperties}
                        >
                            <HudCorners />
                            <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-white/50 px-5 pt-5 pb-1 shrink-0">
                                Agents
                            </div>
                            <div className="flex-1 overflow-y-auto identity-scrollbar px-5 pb-5">
                                <AgentCarousel
                                    activeAgentId={agentProfile.id}
                                    availableAgents={availableAgents}
                                    onSelectAgent={onSelectAgent}
                                />
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
