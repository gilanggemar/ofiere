'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Check, X, Loader2, ImagePlus, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeroCropModal } from './HeroCropModal';
import { BackgroundCropModal } from './BackgroundCropModal';
import { useAgentBackground } from '@/hooks/useAgentBackground';
import { VignetteTuningModal } from './VignetteTuningModal';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

interface HeroImage {
    id: number;
    imageData: string;
    sortOrder: number;
    positionX: number;
    positionY: number;
}

interface HeroGalleryModalProps {
    agentId: string;
    agentName: string;
    agentColor: string;
    images: HeroImage[];
    activeIndex: number;
    onSelectImage: (index: number) => void;
    onImageAdded: () => void;
    onImageDeleted: () => void;
    onClose: () => void;
    onBackgroundChanged?: () => void;
    onTuneVignette: () => void;
}

async function uploadHeroImage(agentId: string, file: File, position?: { x: number; y: number }): Promise<boolean> {
    const formData = new FormData();
    // ... file upload logic
    formData.append('agentId', agentId);
    formData.append('heroImage', file);
    if (position) {
        formData.append('positionX', String(position.x));
        formData.append('positionY', String(position.y));
    }
    const res = await fetch('/api/agents/hero', { method: 'POST', body: formData });
    const data = await res.json();
    return !!data.success;
}

async function deleteHeroImage(imageId: number, agentId: string): Promise<boolean> {
    const res = await fetch('/api/agents/hero', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, agentId }),
    });
    const data = await res.json();
    return !!data.success;
}

export function HeroGalleryModal({
    agentId,
    agentName,
    agentColor,
    images,
    activeIndex,
    onSelectImage,
    onImageAdded,
    onImageDeleted,
    onClose,
    onBackgroundChanged,
    onTuneVignette,
}: HeroGalleryModalProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isTuningVignette, setIsTuningVignette] = useState(false);

    // Background state
    const { backgroundUri, invalidate: invalidateBg } = useAgentBackground(agentId);
    const [isBgUploading, setIsBgUploading] = useState(false);
    const [pendingBgFile, setPendingBgFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
            setPendingFile(file);
        }
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleCropApply = async (file: File, position?: { x: number; y: number }) => {
        setIsUploading(true);
        try {
            await uploadHeroImage(agentId, file, position);
            onImageAdded();
        } finally {
            setIsUploading(false);
            setPendingFile(null);
        }
    };

    const handleDelete = async (img: HeroImage) => {
        setDeletingId(img.id);
        try {
            await deleteHeroImage(img.id, agentId);
            onImageDeleted();
        } finally {
            setDeletingId(null);
        }
    };

    // Background handlers
    const handleBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (bgInputRef.current) bgInputRef.current.value = '';

        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        setPendingBgFile(file);
    };

    const handleBgCropApply = async (file: File) => {
        setIsBgUploading(true);
        try {
            const formData = new FormData();
            formData.append('agentId', agentId);
            formData.append('backgroundImage', file);
            await fetch('/api/agents/background', { method: 'POST', body: formData });
            invalidateBg();
            onBackgroundChanged?.();
        } catch (err) {
            console.error('Failed to upload background:', err);
        } finally {
            setIsBgUploading(false);
            setPendingBgFile(null);
        }
    };

    const handleBgDelete = async () => {
        setIsBgUploading(true);
        try {
            await fetch('/api/agents/background', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId }),
            });
            invalidateBg();
            onBackgroundChanged?.();
        } catch (err) {
            console.error('Failed to remove background:', err);
        } finally {
            setIsBgUploading(false);
        }
    };

    return (
        <>
            <Dialog open onOpenChange={() => !isUploading && !pendingFile && !pendingBgFile && onClose()}>
                <DialogContent 
                    className="max-w-2xl ofiere-glass-3 border-white/10 text-white"
                    onInteractOutside={(e) => {
                        if (pendingFile || pendingBgFile) {
                            e.preventDefault();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle className="text-[11px] uppercase tracking-[0.2em] font-mono text-white/70">
                            {agentName} — Portrait Gallery
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Portrait gallery for agent {agentName}.
                        </DialogDescription>
                        <p className="text-xs text-white/40 mt-1">
                            Select a portrait to display, or add a new one.
                        </p>
                    </DialogHeader>

                    <div className="mt-4">
                        {/* Grid of portrait images */}
                        <div className="grid grid-cols-4 gap-3">
                            {images.map((img, idx) => {
                                const isActive = idx === activeIndex;
                                const isDeleting = deletingId === img.id;

                                return (
                                    <motion.div
                                        key={img.id}
                                        className="relative group aspect-[3/4] rounded-lg overflow-hidden cursor-pointer border-2 transition-all duration-200"
                                        style={{
                                            borderColor: isActive ? agentColor : 'rgba(255,255,255,0.08)',
                                            boxShadow: isActive ? `0 0 16px ${agentColor}40` : 'none',
                                        }}
                                        onClick={() => {
                                            onSelectImage(idx);
                                        }}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                    >
                                        <img
                                            src={img.imageData}
                                            alt={`Portrait ${idx + 1}`}
                                            className="w-full h-full object-cover object-top"
                                        />

                                        {/* Active check */}
                                        {isActive && (
                                            <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                                                style={{ background: agentColor }}
                                            >
                                                <Check size={12} className="text-black" />
                                            </div>
                                        )}

                                        {/* Delete button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(img);
                                            }}
                                            disabled={isDeleting}
                                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full
                                                bg-black/70 flex items-center justify-center
                                                opacity-0 group-hover:opacity-100 transition-opacity
                                                hover:bg-red-900/80 cursor-pointer pointer-events-auto"
                                        >
                                            {isDeleting ? (
                                                <Loader2 size={12} className="animate-spin text-white/60" />
                                            ) : (
                                                <Trash2 size={12} className="text-red-400" />
                                            )}
                                        </button>

                                        {/* Hover overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
                                    </motion.div>
                                );
                            })}

                            {/* Add new image button */}
                            <motion.button
                                onClick={() => inputRef.current?.click()}
                                disabled={isUploading}
                                className="aspect-[3/4] rounded-lg border-2 border-dashed border-white/15
                                    flex flex-col items-center justify-center gap-2
                                    hover:border-white/30 hover:bg-white/5 transition-all cursor-pointer
                                    disabled:opacity-50 pointer-events-auto"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                {isUploading ? (
                                    <Loader2 size={24} className="text-white/40 animate-spin" />
                                ) : (
                                    <Plus size={24} className="text-white/40" />
                                )}
                                <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">
                                    {isUploading ? 'Uploading...' : 'Add'}
                                </span>
                            </motion.button>
                        </div>

                        {images.length === 0 && (
                            <p className="text-center text-white/30 text-sm mt-4 font-mono">
                                No portraits yet. Click + to add one.
                            </p>
                        )}
                    </div>

                    {/* ═══ Background Gallery Section ═══ */}
                    <div className="mt-6 pt-5 border-t border-white/10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-white/70 mb-1">
                                    Background Gallery
                                </div>
                                <p className="text-xs text-white/40">
                                    Set a custom background for this agent&apos;s showcase view.
                                </p>
                            </div>
                            <button
                                onClick={onTuneVignette}
                                className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#FF6D29]/30 text-[#FF6D29] bg-[#FF6D29]/10 hover:bg-[#FF6D29]/20 transition-colors pointer-events-auto cursor-pointer flex-shrink-0"
                            >
                                <SlidersHorizontal size={14} />
                                <span className="text-[9px] font-mono tracking-widest font-bold uppercase">Tune Vignette</span>
                            </button>
                        </div>

                        <div className="flex gap-3 items-start">
                            {/* Current background preview */}
                            {backgroundUri && (
                                <motion.div
                                    className="relative group w-36 aspect-video rounded-lg overflow-hidden border-2 transition-all duration-200"
                                    style={{
                                        borderColor: agentColor,
                                        boxShadow: `0 0 12px ${agentColor}30`,
                                    }}
                                    whileHover={{ scale: 1.03 }}
                                >
                                    <img
                                        src={backgroundUri}
                                        alt="Current background"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-1 left-1 w-4 h-4 rounded-full flex items-center justify-center"
                                        style={{ background: agentColor }}
                                    >
                                        <Check size={10} className="text-black" />
                                    </div>

                                    {/* Delete bg button */}
                                    <button
                                        onClick={handleBgDelete}
                                        disabled={isBgUploading}
                                        className="absolute top-1 right-1 w-5 h-5 rounded-full
                                            bg-black/70 flex items-center justify-center
                                            opacity-0 group-hover:opacity-100 transition-opacity
                                            hover:bg-red-900/80 cursor-pointer"
                                    >
                                        {isBgUploading ? (
                                            <Loader2 size={10} className="animate-spin text-white/60" />
                                        ) : (
                                            <Trash2 size={10} className="text-red-400" />
                                        )}
                                    </button>
                                </motion.div>
                            )}

                            {/* Add / Change background button */}
                            <motion.button
                                onClick={() => bgInputRef.current?.click()}
                                disabled={isBgUploading}
                                className="w-36 aspect-video rounded-lg border-2 border-dashed border-white/15
                                    flex flex-col items-center justify-center gap-1.5
                                    hover:border-white/30 hover:bg-white/5 transition-all cursor-pointer
                                    disabled:opacity-50"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                {isBgUploading ? (
                                    <Loader2 size={20} className="text-white/40 animate-spin" />
                                ) : (
                                    <ImagePlus size={20} className="text-white/40" />
                                )}
                                <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">
                                    {isBgUploading ? 'Uploading...' : backgroundUri ? 'Change' : 'Set BG'}
                                </span>
                            </motion.button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Hidden file inputs */}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />
            <input
                ref={bgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBgFileChange}
            />

            {/* Crop modals after file selection */}
            {pendingFile && (
                <HeroCropModal
                    file={pendingFile}
                    agentId={agentId}
                    onClose={() => setPendingFile(null)}
                    onApply={handleCropApply}
                />
            )}
            
            {pendingBgFile && (
                <BackgroundCropModal
                    file={pendingBgFile}
                    onClose={() => setPendingBgFile(null)}
                    onApply={handleBgCropApply}
                />
            )}

            <VignetteTuningModal 
                isOpen={isTuningVignette} 
                onClose={() => setIsTuningVignette(false)} 
            />
        </>
    );
}
