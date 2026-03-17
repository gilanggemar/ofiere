'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HeroImageUpload } from './HeroImageUpload';
import type { AgentProfile } from '@/lib/agentRoster';

interface HeroImage {
    id: number;
    imageData: string;
    sortOrder: number;
}

interface AgentHeroPortraitProps {
    agent: AgentProfile;
    heroUri: string | null;
    avatarUri: string | null;
    imageCount: number;
    images: HeroImage[];
    activeIndex: number;
    onPrev: () => void;
    onNext: () => void;
    onSelectImage: (index: number) => void;
    onGalleryChanged: () => void;
    onBackgroundChanged?: () => void;
}

export function AgentHeroPortrait({
    agent, heroUri, avatarUri,
    imageCount, images, activeIndex,
    onPrev, onNext,
    onSelectImage, onGalleryChanged,
    onBackgroundChanged,
}: AgentHeroPortraitProps) {
    const imageSrc = heroUri || avatarUri || agent.avatar || '/placeholder-hero.png';
    const hasMultiple = imageCount > 1;

    return (
        <div className="relative w-full h-full overflow-hidden group" style={{ background: 'transparent' }}>
            {/* Hero Image — contain, full visible, no crop */}
            <motion.img
                key={`hero-${agent.id}-${activeIndex}`}
                src={imageSrc}
                alt={agent.name}
                className="w-full h-full"
                style={{
                    objectFit: 'contain',
                    objectPosition: 'center bottom',
                }}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                draggable={false}
            />

            {/* Left Arrow — transparent, solid on hover */}
            {hasMultiple && (
                <button
                    onClick={onPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-20
                        w-9 h-9 rounded-full flex items-center justify-center
                        bg-white/0 border border-white/10 text-white/30
                        hover:bg-black/60 hover:border-white/25 hover:text-white
                        transition-all duration-200 cursor-pointer pointer-events-auto"
                >
                    <ChevronLeft size={18} />
                </button>
            )}

            {/* Right Arrow — transparent, solid on hover */}
            {hasMultiple && (
                <button
                    onClick={onNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-20
                        w-9 h-9 rounded-full flex items-center justify-center
                        bg-white/0 border border-white/10 text-white/30
                        hover:bg-black/60 hover:border-white/25 hover:text-white
                        transition-all duration-200 cursor-pointer pointer-events-auto"
                >
                    <ChevronRight size={18} />
                </button>
            )}

            {/* Upload / Gallery button — visible on hover */}
            <HeroImageUpload
                agentId={agent.id}
                agentName={agent.name}
                agentColor={agent.colorHex}
                images={images}
                activeIndex={activeIndex}
                onSelectImage={onSelectImage}
                onGalleryChanged={onGalleryChanged}
                onBackgroundChanged={onBackgroundChanged}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto z-20"
            />
        </div>
    );
}
