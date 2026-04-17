'use client';

import type { DynamicColors } from '@/hooks/useImageDominantColor';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AgentProfile } from '@/lib/agentRoster';
import { useAgentAvatar } from '@/hooks/useAgentAvatar';
import { useAgentHeroGallery } from '@/hooks/useAgentHeroGallery';
import { AgentIdentityPlate } from '@/components/agent-showcase/AgentIdentityPlate';
import { AgentStatBlock } from '@/components/agent-showcase/AgentStatBlock';
import { AgentCapabilities } from '@/components/agent-showcase/AgentCapabilities';
import { AgentModelSelector } from '@/components/agent-showcase/AgentModelSelector';
import { AgentCarousel, type SocketAgent } from '@/components/command-center/AgentCarousel';
import { HeroImageUpload } from '@/components/agent-showcase/HeroImageUpload';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useOpenClawCapabilitiesStore } from '@/stores/useOpenClawCapabilitiesStore';
import { useVignetteStore } from '@/stores/useVignetteStore';

interface AgentShowcaseProps {
    agentProfile: AgentProfile;
    level: number;
    currentXp: number;
    xpToNext: number;
    rank: string;
    currentStreak: number;
    onBackgroundChanged?: () => void;
    onHeroChanged?: (heroUri: string | null, position: { x: number; y: number }) => void;
    availableAgents: SocketAgent[];
    onSelectAgent: (id: string) => void;
    dynamicColors?: DynamicColors;
}

const heavyVariants = {
    initial: { opacity: 0, filter: 'blur(8px)' },
    animate: { 
        opacity: 1, 
        filter: 'blur(0px)',
        transitionEnd: { 
            filter: 'none', 
            WebkitFilter: 'none'
        }
    },
    exit: { 
        opacity: 0, 
        filter: 'blur(8px)'
    },
};

const heavyTransition = (delay: number) => ({
    duration: 0.8,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
});

const lightVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

const lightTransition = (delay: number) => ({
    duration: 0.5,
    delay,
    ease: [0.25, 1, 0.5, 1] as [number, number, number, number],
});

export function AgentShowcase({ agentProfile, level, currentXp, xpToNext, rank, currentStreak, onBackgroundChanged, onHeroChanged, availableAgents, onSelectAgent, dynamicColors }: AgentShowcaseProps) {
    const router = useRouter();
    const setActiveTab = useOpenClawCapabilitiesStore(s => s.setActiveTab);
    const setTargetAgent = useOpenClawCapabilitiesStore(s => s.setSelectedAgentId);
    const { avatarUri } = useAgentAvatar(agentProfile.id);
    const {
        images, activeIndex, activeImage, activePosition, imageCount,
        next, prev, setActiveIndex, invalidate,
    } = useAgentHeroGallery(agentProfile.id);

    // Notify parent whenever hero image or position changes
    useEffect(() => {
        onHeroChanged?.(activeImage, activePosition);
    }, [activeImage, activePosition]);



    const hasMultiple = imageCount > 1;

    // Pull live global settings from Vignette Store
    const { tunableBlur, tunableStart, tunableEnd, tunableDarkness } = useVignetteStore();

    return (
        <div className="w-full h-full z-20 pointer-events-none flex overflow-hidden relative">

            {/* ═══ LAYER 1: Core Vignette Filter Overlay ═══ */}
            {/* LEFT EDGE BLUR & Soft Dark Overlay */}
            <div className="absolute inset-y-0 left-0 w-[500px] pointer-events-none z-10">
                {/* Dynamic Blur Layer */}
                <div 
                    className="absolute inset-0"
                    style={{ 
                        backdropFilter: `blur(${tunableBlur}px)`,
                        WebkitBackdropFilter: `blur(${tunableBlur}px)`,
                        maskImage: `linear-gradient(to right, black ${tunableStart}%, transparent ${tunableEnd}%)`,
                        WebkitMaskImage: `linear-gradient(to right, black ${tunableStart}%, transparent ${tunableEnd}%)`
                    }}
                />
                {/* Dynamic Gradient Overlay */}
                <div 
                    className="absolute inset-0" 
                    style={{
                        background: `linear-gradient(to right, rgba(0,0,0,${tunableDarkness / 100}) ${tunableStart}%, transparent ${tunableEnd}%)`
                    }}
                />
            </div>

            {/* RIGHT EDGE BLUR & Soft Dark Overlay */}
            <div className="absolute inset-y-0 right-0 w-[480px] pointer-events-none z-10">
                <div 
                    className="absolute inset-0"
                    style={{ 
                        backdropFilter: `blur(${tunableBlur}px)`,
                        WebkitBackdropFilter: `blur(${tunableBlur}px)`,
                        maskImage: `linear-gradient(to left, black ${tunableStart}%, transparent ${tunableEnd}%)`,
                        WebkitMaskImage: `linear-gradient(to left, black ${tunableStart}%, transparent ${tunableEnd}%)`
                    }}
                />
                <div 
                    className="absolute inset-0" 
                    style={{
                        background: `linear-gradient(to left, rgba(0,0,0,${tunableDarkness / 100}) ${tunableStart}%, transparent ${tunableEnd}%)`
                    }}
                />
            </div>

            <AnimatePresence>
                <motion.div
                    key={agentProfile.id}
                    className="flex w-full h-full overflow-hidden absolute inset-0 z-20"
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    {/* LEFT COLUMN — Identity + Meta + Carousel */}
                    <div
                        className="w-[500px] flex-shrink-0 pointer-events-auto z-30 pl-10 pr-[160px] py-10 flex flex-col pt-16 overflow-visible"
                    >
                        <motion.div variants={heavyVariants} transition={heavyTransition(0)}>
                            <AgentIdentityPlate
                                agent={agentProfile}
                                level={level}
                                currentXp={currentXp}
                                xpToNext={xpToNext}
                                rank={rank}
                                currentStreak={currentStreak}
                                avatarUri={avatarUri}
                            />
                        </motion.div>

                        <motion.div variants={lightVariants} transition={lightTransition(0.05)} className="mt-5">
                            <AgentModelSelector agentId={agentProfile.id} colorHex={agentProfile.colorHex} />
                        </motion.div>

                        <motion.div variants={lightVariants} transition={lightTransition(0.1)} className="mt-5 flex-1 min-h-0 p-4 rounded-md border transition-colors duration-500" style={{ background: dynamicColors?.containerBg || 'rgba(0,0,0,0.6)', borderColor: dynamicColors?.containerBorder || 'rgba(255,255,255,0.05)', boxShadow: dynamicColors?.containerShadow || '0 8px 32px rgba(0,0,0,0.5)' }}>
                            <AgentCarousel
                                activeAgentId={agentProfile.id}
                                availableAgents={availableAgents}
                                onSelectAgent={onSelectAgent}
                            />
                        </motion.div>
                    </div>                    {/* CENTER — Empty spacer for layout */}
                    <div
                        className="flex-1 min-w-0 h-full pointer-events-none z-10 relative"
                        style={{ background: 'transparent' }}
                    />

                    {/* FREE FLOATING UI: Arrows & Portait Upload */}
                    {hasMultiple && (
                        <motion.button
                            variants={lightVariants}
                            transition={lightTransition(0.2)}
                            onClick={prev}
                            className="absolute left-[440px] top-1/2 -translate-y-1/2 z-40 pointer-events-auto
                                w-12 h-12 rounded-full flex items-center justify-center
                                border text-white/50
                                hover:text-white
                                transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95"
                            style={{ background: dynamicColors?.containerBg || 'rgba(0,0,0,0.6)', borderColor: dynamicColors?.containerBorder || 'rgba(255,255,255,0.1)', boxShadow: dynamicColors?.containerShadow || '0 4px 12px rgba(0,0,0,0.5)' }}
                        >
                            <ChevronLeft size={24} />
                        </motion.button>
                    )}

                    {hasMultiple && (
                        <motion.button
                            variants={lightVariants}
                            transition={lightTransition(0.2)}
                            onClick={next}
                            className="absolute right-[440px] top-1/2 -translate-y-1/2 z-40 pointer-events-auto
                                w-12 h-12 rounded-full flex items-center justify-center
                                border text-white/50
                                hover:text-white
                                transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95"
                            style={{ background: dynamicColors?.containerBg || 'rgba(0,0,0,0.6)', borderColor: dynamicColors?.containerBorder || 'rgba(255,255,255,0.1)', boxShadow: dynamicColors?.containerShadow || '0 4px 12px rgba(0,0,0,0.5)' }}
                        >
                            <ChevronRight size={24} />
                        </motion.button>
                    )}

                    <HeroImageUpload
                        agentId={agentProfile.id}
                        agentName={agentProfile.name}
                        agentColor={agentProfile.colorHex}
                        images={images}
                        activeIndex={activeIndex}
                        onSelectImage={setActiveIndex}
                        onGalleryChanged={invalidate}
                        onBackgroundChanged={onBackgroundChanged}
                        className="absolute top-10 right-[420px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto z-40 scale-110 origin-top-right"
                    />

                    {/* RIGHT COLUMN — Initiate + Stats + Capabilities */}
                    <motion.div
                        className="w-[480px] flex-shrink-0 pointer-events-auto z-30 pr-12 pl-[160px] pb-10 flex flex-col pt-16"
                        variants={lightVariants}
                        transition={lightTransition(0.15)}
                    >
                        {/* Initiate Button */}
                        <button
                            onClick={() => {
                                localStorage.setItem('ofiere_active_agent', agentProfile.id);
                                router.push('/chat');
                            }}
                            className="w-full py-4 mb-10 font-black tracking-[0.2em] font-mono text-[16px] transition-all duration-300 pointer-events-auto flex items-center justify-center relative overflow-hidden group rounded-sm"
                            style={{
                                backgroundColor: '#FF6D29', // BRAND ORANGE
                                color: '#000000', // BLACK
                                boxShadow: `0 0 30px rgba(255,109,41,0.4), inset 0 0 0 1px rgba(255,255,255,0.2)`,
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = `0 0 50px rgba(255,109,41,0.8), inset 0 0 0 1px rgba(255,255,255,0.5)`;
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = `0 0 30px rgba(255,109,41,0.4), inset 0 0 0 1px rgba(255,255,255,0.2)`;
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            <span className="relative z-10">INITIATE AGENT</span>
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                        </button>

                        <div className="flex-1 min-h-0 flex flex-col">
                            {/* Stats */}
                            <div className="flex-shrink-0">
                                <AgentStatBlock agent={agentProfile} level={level} dynamicColors={dynamicColors} />
                            </div>
                            
                            <div className="flex-shrink-0 h-px w-full bg-white/10 my-6" />
                            
                            {/* Capabilities List */}
                            <div className="flex-1 min-h-0">
                                <AgentCapabilities agent={agentProfile} dynamicColors={dynamicColors} />
                            </div>
                        </div>

                        {/* Bottom Action Buttons */}
                        <div className="flex gap-4 mt-8 pt-4">
                            <button
                                onClick={() => {
                                    setActiveTab('per-agent');
                                    setTargetAgent(agentProfile.id);
                                    router.push('/dashboard/capabilities');
                                }}
                                className="flex-1 py-3.5 border text-white/60 hover:text-white transition-all duration-500 font-mono text-[11px] tracking-widest font-bold pointer-events-auto text-center active:scale-95 rounded-sm"
                                style={{ background: dynamicColors?.containerBg || 'rgba(0,0,0,0.8)', borderColor: dynamicColors?.containerBorder || 'rgba(255,255,255,0.1)', boxShadow: dynamicColors?.containerShadow || '0 4px 16px rgba(0,0,0,0.5)' }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = dynamicColors?.containerBgHover || 'rgba(25,25,25,1)';
                                    e.currentTarget.style.borderColor = dynamicColors?.containerBorderHover || 'rgba(255,255,255,0.2)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = dynamicColors?.containerBg || 'rgba(0,0,0,0.8)';
                                    e.currentTarget.style.borderColor = dynamicColors?.containerBorder || 'rgba(255,255,255,0.1)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                CAPABILITIES
                            </button>
                            <button
                                onClick={() => {
                                    setActiveTab('core-files');
                                    setTargetAgent(agentProfile.id);
                                    router.push('/dashboard/capabilities');
                                }}
                                className="flex-1 py-3.5 border transition-all duration-500 font-mono text-[11px] tracking-widest font-bold pointer-events-auto text-center active:scale-95 hover:text-white rounded-sm"
                                style={{
                                    background: dynamicColors?.containerBg || 'rgba(0,0,0,0.8)',
                                    borderColor: `${agentProfile.colorHex}40`,
                                    color: agentProfile.colorHex,
                                    boxShadow: dynamicColors?.containerShadow || '0 4px 16px rgba(0,0,0,0.5)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = `${agentProfile.colorHex}15`;
                                    e.currentTarget.style.borderColor = agentProfile.colorHex;
                                    e.currentTarget.style.boxShadow = `0 8px 24px ${agentProfile.colorHex}30`;
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = dynamicColors?.containerBg || 'rgba(0,0,0,0.8)';
                                    e.currentTarget.style.borderColor = `${agentProfile.colorHex}40`;
                                    e.currentTarget.style.color = agentProfile.colorHex;
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                CORE FILES
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
