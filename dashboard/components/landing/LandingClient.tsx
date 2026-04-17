'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, Cpu, Zap, Shield, Activity, X } from 'lucide-react'
import { Logo } from '@/components/logo'
import FloatingLines from '@/components/FloatingLines'

const CARD_DATA = {
    hero: {
        bgText: "ORCHESTRATE",
        badge: "PROTOCOL ZERO",
        title: "Orchestrate The Future.",
        subtitle: "The Premiere Paradigm for Agent Swarms.",
        description: "A highly optimized, deeply integrated orchestration layer for agent swarms. Build, deploy, and command without friction or limits. Ofiere orchestrates multiple parallelized agents simultaneously, combining their outputs for complex problem-solving at unprecedented velocity."
    },
    neural: {
        bgText: "NEURAL",
        badge: "COGNITIVE ARCHITECTURE",
        title: "Neural Execution",
        subtitle: "Parallelize Complex Reasoning.",
        description: "Distribute thousands of specialized agents instantly. Ofiere dynamically allocates ingestion, reasoning, and synthesis tasks across the swarm, dissolving the latency between human intent and machine execution."
    },
    edge: {
        bgText: "EDGE",
        badge: "GLOBAL NETWORK",
        title: "Global Edge Network",
        subtitle: "Instantaneous Consensus.",
        description: "Deploy your operational swarms geographically adjacent to the user. Our deeply embedded edge-compute infrastructure guarantees sub-10ms synchronization pathways and absolute zero-friction deployments."
    },
    zero_trust: {
        bgText: "SECURE",
        badge: "CRYPTOGRAPHIC LAYER",
        title: "Zero-Trust Security",
        subtitle: "Absolute Data Sovereignty.",
        description: "Every agent operation is cryptographically signed and executed within sandboxed environments. Ofiere enforces granular, role-based access controls and end-to-end encryption to ensure uncompromising security."
    },
    ecology: {
        bgText: "EXPAND",
        badge: "DEVELOPER ECOLOGY",
        title: "Infinite Extensibility",
        subtitle: "API-First Interoperability.",
        description: "Seamlessly connect the swarm to any foundational model, vector database, or external webhook. The Ofiere SDK and robust REST APIs provide the absolute freedom to forge the exact ecosystem you demand."
    }
}

export default function LandingClient() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [selectedCard, setSelectedCard] = useState<keyof typeof CARD_DATA | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent scrolling when modal is open
    useEffect(() => {
        if (selectedCard) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset' };
    }, [selectedCard]);

    if (!mounted) return <div className="min-h-screen bg-[#080706]" />;

    return (
        <div className="relative w-full min-h-screen bg-[#080706] text-[#F5F0EB] font-sans selection:bg-[#FF6D29] selection:text-[#080706] overflow-hidden flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12">
            
            {/* Ambient Background Glow */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-[#FF6D29] rounded-full blur-[120px] opacity-[0.03] pointer-events-none" />

            {/* FloatingLines Background */}
            <div style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }}>
                <FloatingLines
                    linesGradient={["#f54747", "#611515", "#f54747"]}
                    animationSpeed={1}
                    interactive
                    bendRadius={5}
                    bendStrength={-0.5}
                    mouseDamping={0.05}
                    parallax
                    parallaxStrength={0.2}
                />
            </div>

            {/* Bento Grid Container */}
            <div className="w-full h-full max-w-[1600px] grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-4 md:gap-6 relative z-10 pointer-events-none">
                
                {/* 1. HERO TILE - Spans 3 columns, 2 rows */}
                <motion.div 
                    layoutId="hero"
                    onClick={() => setSelectedCard('hero')}
                    className="md:col-span-3 md:row-span-2 bg-[#0C0A09] border border-white/5 p-8 md:p-16 flex flex-col justify-between group hover:border-[#FF6D29]/30 transition-all duration-500 overflow-hidden cursor-pointer relative pointer-events-auto shadow-[0_4px_40px_rgba(0,0,0,0.5)]"
                    style={{ borderRadius: '1.5rem' }}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
                    
                    <div className="flex items-center gap-4 z-10">
                        <div className="bg-[#FF6D29] w-12 h-12 rounded-md flex items-center justify-center shadow-[0_0_20px_rgba(255,109,41,0.2)]">
                            <Logo className="w-6 h-6 text-[#080706]" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-[#F5F0EB]">
                            OFIERE
                        </span>
                    </div>

                    <div className="z-10 mt-12 md:mt-0">
                        <h1 className="text-5xl md:text-7xl lg:text-[6rem] font-semibold leading-[0.95] tracking-tighter text-white mb-6">
                            Orchestrate <br/> 
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6D29] to-[#cc551e]">The Future.</span>
                        </h1>
                        <p className="text-lg md:text-xl text-neutral-400 font-normal leading-relaxed max-w-2xl text-balance">
                            A highly optimized, deeply integrated orchestration layer for agent swarms. 
                            Build, deploy, and command without friction or limits.
                        </p>
                    </div>
                </motion.div>

                {/* 2. ENTER TILE - STATIC */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
                    onClick={() => router.push('/login')}
                    className="md:col-span-1 md:row-span-2 bg-[#FF6D29] rounded-md p-8 flex flex-col items-center justify-center cursor-pointer group hover:bg-[#ff8247] transition-all duration-300 relative shadow-[0_0_40px_rgba(255,109,41,0.1)] hover:shadow-[0_0_60px_rgba(255,109,41,0.2)] pointer-events-auto"
                >
                    <div className="flex flex-col items-center gap-6">
                        <span className="text-4xl md:text-5xl lg:text-6xl font-black text-[#080706] uppercase tracking-tighter">
                            Enter
                        </span>
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-[#080706] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ease-out">
                            <ArrowRight className="w-10 h-10 text-[#FF6D29] group-hover:translate-x-2 transition-transform duration-500" strokeWidth={3} />
                        </div>
                    </div>
                </motion.div>

                {/* 3. NEURAL EXECUTION TILE */}
                <motion.div 
                    layoutId="neural"
                    onClick={() => setSelectedCard('neural')}
                    className="md:col-span-1 md:row-span-1 bg-[#0C0A09] border border-white/5 p-8 flex flex-col justify-between group cursor-pointer hover:border-[#FF6D29]/30 transition-all duration-500 pointer-events-auto overflow-hidden"
                    style={{ borderRadius: '1.5rem' }}
                >
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold tracking-widest text-neutral-500 group-hover:text-[#FF6D29] uppercase transition-colors pointer-events-none">Neural Execution</span>
                        <Cpu className="w-5 h-5 text-neutral-500 group-hover:text-[#FF6D29] transition-colors duration-300 pointer-events-none" />
                    </div>
                    <div className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-4 pointer-events-none">
                        Parallelize<br/>Reasoning<span className="text-[#FF6D29]">.</span>
                    </div>
                </motion.div>

                {/* 4. EDGE NETWORK TILE */}
                <motion.div 
                    layoutId="edge"
                    onClick={() => setSelectedCard('edge')}
                    className="md:col-span-1 md:row-span-1 bg-[#0C0A09] border border-white/5 p-8 flex flex-col justify-between group cursor-pointer hover:border-[#FF6D29]/30 transition-all duration-500 pointer-events-auto overflow-hidden"
                    style={{ borderRadius: '1.5rem' }}
                >
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold tracking-widest text-neutral-500 group-hover:text-[#FF6D29] uppercase transition-colors pointer-events-none">Global Edge</span>
                        <Zap className="w-5 h-5 text-neutral-500 group-hover:text-[#FF6D29] transition-colors duration-300 pointer-events-none" />
                    </div>
                    <div className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-4 pointer-events-none">
                        &lt; 10ms<br/>Consensus<span className="text-[#FF6D29]">.</span>
                    </div>
                </motion.div>

                {/* 5. ZERO-TRUST TILE */}
                <motion.div 
                    layoutId="zero_trust"
                    onClick={() => setSelectedCard('zero_trust')}
                    className="md:col-span-1 md:row-span-1 bg-[#0C0A09] border border-white/5 p-8 flex flex-col justify-between group cursor-pointer hover:border-[#FF6D29]/30 transition-all duration-500 pointer-events-auto overflow-hidden"
                    style={{ borderRadius: '1.5rem' }}
                >
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-semibold tracking-widest text-neutral-500 group-hover:text-[#FF6D29] uppercase transition-colors pointer-events-none">Zero-Trust</span>
                        <Shield className="w-5 h-5 text-neutral-500 group-hover:text-[#FF6D29] transition-colors duration-300 pointer-events-none" />
                    </div>
                    <div className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-4 pointer-events-none">
                        Absolute<br/>Security<span className="text-[#FF6D29]">.</span>
                    </div>
                </motion.div>

                {/* 6. DEVELOPER ECOLOGY TILE */}
                <motion.div 
                    layoutId="ecology"
                    onClick={() => setSelectedCard('ecology')}
                    className="md:col-span-1 md:row-span-1 bg-[#0C0A09] border border-white/5 p-8 flex flex-col justify-between group cursor-pointer hover:border-[#FF6D29]/30 transition-all duration-500 relative overflow-hidden pointer-events-auto"
                    style={{ borderRadius: '1.5rem' }}
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6D29]/10 rounded-full blur-[40px] group-hover:bg-[#FF6D29]/20 transition-colors duration-500 pointer-events-none" />
                    
                    <div className="flex justify-between items-start z-10">
                        <span className="text-xs font-semibold tracking-widest text-neutral-500 group-hover:text-[#FF6D29] uppercase transition-colors pointer-events-none">Developer API</span>
                        <Activity className="w-5 h-5 text-[#FF6D29]" />
                    </div>
                    <div className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-4 z-10 pointer-events-none">
                        Infinite<br/>Extensibility<span className="text-[#FF6D29]">.</span>
                    </div>
                </motion.div>

            </div>

            {/* FULL SCREEN EXPANDED OVERLAY */}
            <AnimatePresence>
                {selectedCard && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                        
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="absolute inset-0 bg-[#0C0A09]/90 backdrop-blur-xl pointer-events-auto cursor-pointer"
                            onClick={() => setSelectedCard(null)}
                        />
                        
                        <motion.div 
                            layoutId={selectedCard}
                            className="absolute z-10 inset-0 w-full h-full bg-[#0C0A09] pointer-events-auto shadow-[0_0_120px_rgba(255,109,41,0.15)] flex flex-col cursor-default overflow-hidden"
                            style={{ borderRadius: '0px' }}
                            transition={{ type: "spring", stiffness: 350, damping: 35, mass: 0.8 }}
                        >
                            {/* PERSISTENT CLOSE BUTTON - Anchored to the expanding container geometry, unaffected by internal scroll */}
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                                transition={{ delay: 0.2 }}
                                className="absolute top-6 right-6 md:top-10 md:right-10 z-[100] pointer-events-none flex justify-end"
                            >
                                <button 
                                    onClick={() => setSelectedCard(null)}
                                    className="pointer-events-auto w-12 h-12 md:w-14 md:h-14 bg-black/40 hover:bg-[#FF6D29] border border-white/10 hover:border-transparent rounded-full flex items-center justify-center transition-all duration-300 group backdrop-blur-md shadow-2xl"
                                >
                                    <X className="w-5 h-5 md:w-6 md:h-6 text-white group-hover:text-[#080706] transition-colors" />
                                </button>
                            </motion.div>

                            {/* ISOLATED SCROLL CONTAINER - Locked to absolute viewport size to PREVENT content squish/wrap during layout morph.
                                By fading this content out rapidly (0.15s), the shell container smoothly scales back down without any DOM distortion. */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                                transition={{ delay: 0.1, duration: 0.4 }}
                                className="absolute top-0 left-0 w-[100vw] h-[100vh] overflow-y-auto overflow-x-hidden"
                            >
                                {/* Inner ambient glow */}
                                <div className="absolute top-0 right-0 w-[80vw] h-[80vw] md:w-[60vw] md:h-[60vw] bg-[#FF6D29]/5 rounded-full blur-[150px] pointer-events-none" />

                                {/* Heavy Typography Background Watermark (Fixed header area) */}
                                <div className="absolute top-0 left-0 right-0 h-[80vh] flex items-center justify-center pointer-events-none overflow-hidden select-none">
                                    <motion.span 
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 0.03 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                        className="text-[25vw] leading-none font-black text-white whitespace-nowrap tracking-tighter uppercase blur-sm mix-blend-overlay"
                                    >
                                        {CARD_DATA[selectedCard].bgText}
                                    </motion.span>
                                </div>

                                {/* Top Hero Content Area (First Viewport) */}
                                <div className="relative z-20 flex flex-col justify-center min-h-screen p-8 md:p-16 lg:p-24 2xl:p-32">
                                    <div className="max-w-6xl mt-0">
                                        
                                        <motion.div 
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.2 }}
                                            className="inline-block mb-6 md:mb-8 px-4 py-2 rounded-full border border-[#FF6D29]/30 bg-[#FF6D29]/10 text-[#FF6D29] text-sm md:text-base font-bold tracking-[0.2em] uppercase origin-left"
                                        >
                                            {CARD_DATA[selectedCard].badge}
                                        </motion.div>
                                        
                                        <motion.h2 
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 }}
                                            className="text-6xl sm:text-7xl md:text-8xl lg:text-[9rem] font-black tracking-tighter leading-[0.85] text-white mb-8 uppercase drop-shadow-2xl"
                                        >
                                            {CARD_DATA[selectedCard].title}
                                        </motion.h2>
                                        
                                        <motion.h3 
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.4 }}
                                            className="text-3xl md:text-4xl lg:text-5xl font-semibold text-[#FF6D29] tracking-tight mb-8 md:mb-12 max-w-4xl"
                                        >
                                            {CARD_DATA[selectedCard].subtitle}
                                        </motion.h3>
                                        
                                        <motion.p 
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.5 }}
                                            className="text-xl md:text-2xl lg:text-3xl text-neutral-300 font-normal leading-relaxed text-balance max-w-4xl"
                                        >
                                            {CARD_DATA[selectedCard].description}
                                        </motion.p>
                                    </div>

                                    {/* Scroll Indicator */}
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1, duration: 1 }}
                                        className="absolute bottom-12 left-8 md:left-16 lg:left-24 animate-bounce text-neutral-500 flex flex-col items-center gap-2"
                                    >
                                        <span className="text-xs uppercase tracking-[0.3em] font-bold">Scroll</span>
                                        <div className="w-px h-8 bg-gradient-to-b from-neutral-500 to-transparent" />
                                    </motion.div>
                                </div>
                                
                                {/* Scrollable Additional Graphics Area */}
                                <div className="w-full relative z-20 px-8 md:px-16 lg:px-24 mb-32">
                                    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 lg:gap-24">
                                        
                                        {/* Abstract Graphic Canvas */}
                                        <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden group">
                                            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-[#FF6D29]/10 rounded-full blur-[60px] group-hover:bg-[#FF6D29]/20 transition-all duration-700" />
                                            
                                            <div className="flex justify-between items-center mb-10">
                                                <h4 className="text-sm font-bold tracking-[0.2em] text-[#FF6D29] uppercase">Active Matrix</h4>
                                                <div className="flex gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-[#FF6D29] animate-pulse" />
                                                    <div className="w-2 h-2 rounded-full bg-white/20" />
                                                    <div className="w-2 h-2 rounded-full bg-white/20" />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-4">
                                                {[1, 2, 3].map((i) => (
                                                    <div key={i} className="h-16 w-full bg-[#080706]/80 rounded-md border border-white/5 flex items-center px-6 overflow-hidden relative">
                                                        <motion.div 
                                                            initial={{ x: '-100%' }}
                                                            animate={{ x: '200%' }}
                                                            transition={{ repeat: Infinity, duration: 2.5 + i * 0.5, ease: "linear" }}
                                                            className="absolute top-0 bottom-0 w-32 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-[-20deg]"
                                                        />
                                                        <div className={`h-2 rounded-full bg-gradient-to-r ${i === 2 ? 'from-[#FF6D29] to-[#cc551e] w-3/4' : 'from-white/20 to-white/5 w-1/2'}`} />
                                                        <div className="ml-auto text-xs font-mono text-neutral-500">
                                                            {i === 2 ? 'SYS_OPT' : 'IDLE_0X'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {/* Expanded Text Column */}
                                        <div className="flex-1 flex flex-col justify-center space-y-8">
                                            <div className="w-16 h-1 bg-[#FF6D29] rounded-full" />
                                            <h4 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-[0.9]">
                                                Continuous Evolution
                                            </h4>
                                            <p className="text-xl md:text-2xl text-neutral-400 leading-relaxed font-normal">
                                                By leveraging deeply integrated orchestration protocols, Ofiere ensures that your swarm continually adapts. From dynamic task routing to self-healing node repair, every parameter is optimized for an environment of rapid growth.
                                                <br /><br />
                                                Eliminate static infrastructure. Embrace the swarm.
                                            </p>
                                            <div className="w-full h-px bg-white/10 my-4" />
                                            <div className="flex items-center gap-4 text-[#FF6D29] font-bold tracking-widest uppercase text-sm cursor-pointer hover:text-white transition-colors group">
                                                <span>Explore Documentation</span>
                                                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </motion.div>

                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}
