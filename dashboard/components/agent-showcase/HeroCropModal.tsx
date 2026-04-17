'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Monitor, Move } from 'lucide-react';

interface HeroCropModalProps {
    file: File;
    agentId: string;
    onClose: () => void;
    onApply: (file: File, position?: { x: number; y: number }) => Promise<void>;
}

export function HeroCropModal({ file, agentId, onClose, onApply }: HeroCropModalProps) {
    // Screen resolution
    const [screenW, setScreenW] = useState(1920);
    const [screenH, setScreenH] = useState(1080);
    const aspectRatio = screenW / screenH;

    const [crop, setCrop] = useState<Crop>({
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
    });
    const [imageSrc, setImageSrc] = useState<string>('');
    const [isApplying, setIsApplying] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Draggable position offset within the preview (percentage-based)
    const [posX, setPosX] = useState(50); // 0-100, 50 = center
    const [posY, setPosY] = useState(100); // 0-100, 100 = bottom
    const previewRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    // Get screen resolution on mount and resize
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const updateSize = () => {
                setScreenW(window.innerWidth);
                setScreenH(window.innerHeight);
            };
            updateSize();
            window.addEventListener('resize', updateSize);
            return () => window.removeEventListener('resize', updateSize);
        }
    }, []);

    // Convert file to object URL on mount
    useEffect(() => {
        const url = URL.createObjectURL(file);
        setImageSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    // Compute cropped preview image as a data URL whenever crop changes
    const [croppedPreview, setCroppedPreview] = useState<string>('');
    useEffect(() => {
        if (!imgRef.current || !imageSrc) return;
        const img = imgRef.current;
        if (!img.naturalWidth) return;

        const canvas = document.createElement('canvas');
        const cropWidth = (crop.width / 100) * img.naturalWidth;
        const cropHeight = (crop.height / 100) * img.naturalHeight;
        const cropX = (crop.x / 100) * img.naturalWidth;
        const cropY = (crop.y / 100) * img.naturalHeight;

        if (cropWidth <= 0 || cropHeight <= 0) return;

        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        setCroppedPreview(canvas.toDataURL('image/webp', 0.6));
    }, [crop, imageSrc]);

    // Also regenerate preview when image loads
    const handleImageLoad = useCallback(() => {
        if (!imgRef.current) return;
        const img = imgRef.current;
        const canvas = document.createElement('canvas');
        const cropWidth = (crop.width / 100) * img.naturalWidth;
        const cropHeight = (crop.height / 100) * img.naturalHeight;
        const cropX = (crop.x / 100) * img.naturalWidth;
        const cropY = (crop.y / 100) * img.naturalHeight;
        if (cropWidth <= 0 || cropHeight <= 0) return;
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
        setCroppedPreview(canvas.toDataURL('image/webp', 0.6));
    }, [crop]);

    // Drag handlers for the preview panel
    const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        e.preventDefault();
    }, []);

    const handlePreviewMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current || !previewRef.current) return;
        const rect = previewRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPosX(Math.max(0, Math.min(100, x)));
        setPosY(Math.max(0, Math.min(100, y)));
    }, []);

    const handlePreviewMouseUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    // Global mouse up to catch releases outside the preview
    useEffect(() => {
        const handler = () => { isDragging.current = false; };
        window.addEventListener('mouseup', handler);
        return () => window.removeEventListener('mouseup', handler);
    }, []);

    // "Use Full Image" — skip cropping, upload raw file
    const handleSkipCrop = useCallback(async () => {
        setIsApplying(true);
        try {
            await onApply(file, { x: posX, y: posY });
        } finally {
            setIsApplying(false);
            onClose();
        }
    }, [file, onApply, onClose, posX, posY]);

    // Apply crop: draw onto canvas, export as WebP Blob
    const handleApplyCrop = useCallback(async () => {
        if (!imgRef.current) return;
        setIsApplying(true);

        try {
            const img = imgRef.current;
            const canvas = document.createElement('canvas');

            const cropWidth = (crop.width / 100) * img.naturalWidth;
            const cropHeight = (crop.height / 100) * img.naturalHeight;
            const cropX = (crop.x / 100) * img.naturalWidth;
            const cropY = (crop.y / 100) * img.naturalHeight;

            canvas.width = cropWidth;
            canvas.height = cropHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(
                img,
                cropX, cropY, cropWidth, cropHeight,
                0, 0, cropWidth, cropHeight
            );

            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const croppedFile = new File([blob], 'hero-cropped.webp', { type: 'image/webp' });
                await onApply(croppedFile, { x: posX, y: posY });
                setIsApplying(false);
                onClose();
            }, 'image/webp', 0.92);
        } catch {
            setIsApplying(false);
        }
    }, [crop, posX, posY, onApply, onClose]);

    // Preview dimensions
    const previewWidth = 420;
    const previewHeight = previewWidth / aspectRatio;

    return (
        <Dialog open modal={false}>
            <DialogContent 
                className="max-w-[95vw] sm:max-w-[95vw] w-fit max-h-[85vh] flex flex-col ofiere-glass-3 border-white/10 text-white overflow-hidden"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader className="shrink-0">
                    <DialogTitle className="text-[11px] uppercase tracking-[0.2em] font-mono text-white/70">
                        Adjust Hero Portrait
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Crop and position your agent hero portrait.
                    </DialogDescription>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-xs text-white/40">
                            Drag to crop, then position the portrait in the preview.
                        </p>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                            <Monitor size={12} className="text-white/50" />
                            <span className="text-[10px] font-mono text-white/50 tracking-wider">
                                {screenW} × {screenH}
                            </span>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex gap-5 mt-3 flex-1 min-h-0 overflow-hidden">
                    {/* LEFT: Cropper */}
                    <div className="flex-1 min-w-0 flex flex-col min-h-0">
                        <div className="text-[10px] uppercase tracking-[0.15em] font-mono text-white/40 mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-base, #FF6D29)' }} />
                            Crop Area
                        </div>
                        <div className="rounded-md overflow-hidden flex items-center justify-center min-h-0 flex-1">
                            {imageSrc && (
                                <ReactCrop
                                    crop={crop}
                                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                                    // Remove aspect ratio lock and explicit 100% width
                                    style={{ display: 'inline-flex', maxHeight: '100%', maxWidth: '100%' }}
                                >
                                    <img
                                        ref={imgRef}
                                        src={imageSrc}
                                        style={{ maxWidth: '100%', maxHeight: '65vh', width: 'auto', height: 'auto', display: 'block' }}
                                        alt="Hero preview"
                                        onLoad={handleImageLoad}
                                    />
                                </ReactCrop>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Live Screen Preview */}
                    <div className="flex flex-col shrink-0" style={{ width: previewWidth }}>
                        <div className="text-[10px] uppercase tracking-[0.15em] font-mono text-white/40 mb-2 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-base, #FF6D29)' }} />
                            Screen Preview
                            <span className="ml-auto flex items-center gap-1 text-white/25">
                                <Move size={10} />
                                Drag to position
                            </span>
                        </div>

                        {/* Screen preview container */}
                        <div
                            ref={previewRef}
                            className="relative rounded-lg overflow-hidden border border-white/10 select-none"
                            style={{
                                width: previewWidth,
                                height: previewHeight,
                                background: 'transparent',
                                cursor: isDragging.current ? 'grabbing' : 'grab',
                            }}
                            onMouseDown={handlePreviewMouseDown}
                            onMouseMove={handlePreviewMouseMove}
                            onMouseUp={handlePreviewMouseUp}
                        >
                            {/* Hero image in the preview — draggable position */}
                            {croppedPreview && (
                                <img
                                    src={croppedPreview}
                                    alt=""
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                    style={{
                                        objectFit: 'contain',
                                        objectPosition: `${posX}% ${posY}%`,
                                    }}
                                />
                            )}

                            {/* Left card placeholder */}
                            <div
                                className="absolute top-2 left-1.5 bottom-2 rounded-md border border-white/15"
                                style={{
                                    width: `${(280 / screenW) * 100}%`,
                                    background: 'rgba(20, 18, 15, 0.65)',
                                    backdropFilter: 'blur(8px)',
                                }}
                            >
                                <div className="p-2">
                                    <div className="w-8 h-1.5 rounded bg-white/10 mb-2" />
                                    <div className="w-12 h-2 rounded bg-white/15 mb-1.5" />
                                    <div className="w-6 h-1 rounded bg-white/8" />
                                    <div className="mt-4 space-y-1.5">
                                        <div className="w-full h-1 rounded bg-white/5" />
                                        <div className="w-3/4 h-1 rounded bg-white/5" />
                                        <div className="w-1/2 h-1 rounded bg-white/5" />
                                    </div>
                                </div>
                            </div>

                            {/* Right card placeholder */}
                            <div
                                className="absolute top-2 right-1.5 bottom-2 rounded-md border border-white/15"
                                style={{
                                    width: `${(300 / screenW) * 100}%`,
                                    background: 'rgba(20, 18, 15, 0.65)',
                                    backdropFilter: 'blur(8px)',
                                }}
                            >
                                <div className="p-2">
                                    <div className="w-10 h-1.5 rounded bg-white/10 mb-2" />
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <div className="w-8 h-1 rounded bg-white/8" />
                                            <div className="w-6 h-1 rounded bg-white/10" />
                                        </div>
                                        <div className="flex justify-between">
                                            <div className="w-10 h-1 rounded bg-white/8" />
                                            <div className="w-5 h-1 rounded bg-white/10" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Crosshair marker at current position */}
                            <div
                                className="absolute w-3 h-3 pointer-events-none"
                                style={{
                                    left: `${posX}%`,
                                    top: `${posY}%`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                <div className="w-full h-[1px] absolute top-1/2 left-0" style={{ background: 'var(--accent-base, #FF6D29)', opacity: 0.6 }} />
                                <div className="h-full w-[1px] absolute left-1/2 top-0" style={{ background: 'var(--accent-base, #FF6D29)', opacity: 0.6 }} />
                            </div>

                            {/* Border glow */}
                            <div
                                className="absolute inset-0 rounded-lg pointer-events-none"
                                style={{ boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}
                            />
                        </div>

                        {/* Position readout */}
                        <div className="flex items-center justify-between mt-2 px-1">
                            <span className="text-[9px] font-mono text-white/25 tracking-wider uppercase">
                                Position: {Math.round(posX)}%, {Math.round(posY)}%
                            </span>
                            <button
                                onClick={() => { setPosX(50); setPosY(100); }}
                                className="text-[9px] font-mono text-white/30 hover:text-white/60 uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom: Actions */}
                <div className="flex gap-3 justify-end mt-4 pt-3 border-t border-white/5 shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isApplying}
                        className="px-4 py-2.5 rounded-lg text-xs font-mono tracking-wider uppercase
                            text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer
                            disabled:opacity-50 pointer-events-auto"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSkipCrop}
                        disabled={isApplying}
                        className="px-4 py-2.5 rounded-lg text-xs font-mono tracking-wider uppercase
                            bg-white/10 border border-white/15 text-white/80
                            hover:bg-white/15 transition-colors cursor-pointer
                            disabled:opacity-50 pointer-events-auto"
                    >
                        {isApplying ? 'Uploading...' : 'Use Full Image'}
                    </button>
                    <button
                        onClick={handleApplyCrop}
                        disabled={isApplying}
                        className="px-5 py-2.5 rounded-lg text-xs font-mono tracking-wider uppercase
                            text-[#080706] font-bold cursor-pointer
                            hover:brightness-110 transition-all
                            disabled:opacity-50 pointer-events-auto"
                        style={{ background: 'var(--accent-base, #FF6D29)' }}
                    >
                        {isApplying ? 'Applying...' : 'Apply Crop'}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
