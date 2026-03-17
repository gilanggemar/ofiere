'use client';

import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { HeroGalleryModal } from './HeroGalleryModal';

interface HeroImage {
    id: number;
    imageData: string;
    sortOrder: number;
}

interface HeroImageUploadProps {
    agentId: string;
    agentName: string;
    agentColor: string;
    images: HeroImage[];
    activeIndex: number;
    onSelectImage: (index: number) => void;
    onGalleryChanged: () => void;
    onBackgroundChanged?: () => void;
    className?: string;
}

export function HeroImageUpload({
    agentId, agentName, agentColor,
    images, activeIndex,
    onSelectImage, onGalleryChanged,
    onBackgroundChanged,
    className = '',
}: HeroImageUploadProps) {
    const [showGallery, setShowGallery] = useState(false);

    return (
        <>
            <button
                onClick={() => setShowGallery(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono tracking-wider uppercase
                    bg-black/60 backdrop-blur-md border border-white/15 text-white/80
                    hover:bg-black/80 hover:border-white/30 hover:text-white
                    transition-all duration-200 cursor-pointer ${className}`}
            >
                <Camera size={14} />
                Update Portrait
            </button>

            {/* Gallery Modal */}
            {showGallery && (
                <HeroGalleryModal
                    agentId={agentId}
                    agentName={agentName}
                    agentColor={agentColor}
                    images={images}
                    activeIndex={activeIndex}
                    onSelectImage={onSelectImage}
                    onImageAdded={onGalleryChanged}
                    onImageDeleted={onGalleryChanged}
                    onBackgroundChanged={onBackgroundChanged}
                    onClose={() => setShowGallery(false)}
                />
            )}
        </>
    );
}
