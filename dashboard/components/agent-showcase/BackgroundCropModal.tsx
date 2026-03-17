'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Contrast, SunMedium } from 'lucide-react';

interface BackgroundCropModalProps {
    file: File;
    onClose: () => void;
    onApply: (file: File) => Promise<void>;
}

export function BackgroundCropModal({ file, onClose, onApply }: BackgroundCropModalProps) {
    const [aspectRatio, setAspectRatio] = useState<number>(16 / 9);
    
    // Default to the center crop
    const [crop, setCrop] = useState<Crop>({
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
    });
    
    // Sliders for image adjustment
    // 100 = full color/brightness, 0 = no color/brightness
    const [saturation, setSaturation] = useState(100);
    const [brightness, setBrightness] = useState(100);

    const [imageSrc, setImageSrc] = useState<string>('');
    const [isApplying, setIsApplying] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Get screen aspect ratio on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const screenRatio = window.innerWidth / window.innerHeight;
            setAspectRatio(screenRatio);
        }
    }, []);

    // Convert file to object URL on mount
    useEffect(() => {
        const url = URL.createObjectURL(file);
        setImageSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    // Apply crop: draw onto canvas with filters, export as Blob
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

            // Apply filters to baked canvas
            const grayscaleVal = 100 - saturation; 
            ctx.filter = `grayscale(${grayscaleVal}%) brightness(${brightness}%)`;

            ctx.drawImage(
                img,
                cropX,
                cropY,
                cropWidth,
                cropHeight,
                0, 0,
                cropWidth,
                cropHeight
            );

            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const croppedFile = new File([blob], 'bg-cropped.webp', { type: 'image/webp' });
                await onApply(croppedFile);
                setIsApplying(false);
                onClose();
            }, 'image/webp', 0.9);
        } catch {
            setIsApplying(false);
        }
    }, [crop, saturation, brightness, onApply, onClose]);

    return (
        <Dialog open onOpenChange={() => !isApplying && onClose()}>
            <DialogContent className="max-w-5xl w-[95vw] max-h-[85vh] flex flex-col nerv-glass-3 border-white/10 text-white">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="text-[11px] uppercase tracking-[0.2em] font-mono text-white/70">
                        Adjust Background Preview
                    </DialogTitle>
                    <p className="text-xs text-white/40 mt-1">
                        Drag to crop the background to fit the screen aspect ratio perfectly. Use the sliders to adjust the color and brightness.
                    </p>
                </DialogHeader>

                <div className="flex flex-col gap-4 mt-2 flex-1 min-h-0">
                    {/* Crop Area */}
                    <div className="bg-black/40 rounded-xl overflow-hidden flex items-center justify-center p-2 flex-1 min-h-0 shrink">
                        {imageSrc && (
                            <ReactCrop
                                crop={crop}
                                aspect={aspectRatio}
                                onChange={(_, percentCrop) => setCrop(percentCrop)}
                                style={{ maxHeight: '100%', maxWidth: '100%', display: 'flex' }}
                            >
                                <img
                                    ref={imgRef}
                                    src={imageSrc}
                                    style={{ 
                                        maxWidth: '100%', 
                                        maxHeight: '45vh', 
                                        objectFit: 'contain',
                                        filter: `grayscale(${100 - saturation}%) brightness(${brightness}%)` 
                                    }}
                                    alt="Background preview"
                                />
                            </ReactCrop>
                        )}
                    </div>

                    {/* Controls Bottom Bar */}
                    <div className="flex flex-col md:flex-row gap-6 p-5 rounded-xl bg-black/30 border border-white/5 items-center justify-between shrink-0 mt-2">
                        
                        {/* Sliders Area */}
                        <div className="flex flex-col flex-1 w-full gap-5 md:pr-6 md:border-r border-white/10">
                            {/* Saturation */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-white/70 font-mono tracking-widest uppercase">
                                    <span className="flex items-center gap-1.5"><Contrast size={14}/> Saturation</span>
                                    <span>{saturation}%</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={[saturation]}
                                    onValueChange={(val) => setSaturation(val[0])}
                                    className="w-full"
                                />
                                <div className="text-[10px] text-white/40 uppercase tracking-widest">
                                    Drag left to desaturate
                                </div>
                            </div>

                            {/* Dimmer */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-white/70 font-mono tracking-widest uppercase">
                                    <span className="flex items-center gap-1.5"><SunMedium size={14}/> Dimmer</span>
                                    <span>{brightness}%</span>
                                </div>
                                <Slider
                                    min={20}
                                    max={100}
                                    step={1}
                                    value={[brightness]}
                                    onValueChange={(val) => setBrightness(val[0])}
                                    className="w-full"
                                />
                                <div className="text-[10px] text-white/40 uppercase tracking-widest">
                                    Drag left to dim
                                </div>
                            </div>
                        </div>
                        
                        {/* Actions Area */}
                        <div className="flex flex-col w-full md:w-[130px] gap-3 items-center shrink-0">
                            <button
                                onClick={handleApplyCrop}
                                disabled={isApplying}
                                className="w-full px-3 py-3 rounded-lg text-[10px] font-mono tracking-widest uppercase
                                    text-[#080706] font-bold cursor-pointer transition-all hover:brightness-110
                                    disabled:opacity-50 pointer-events-auto shrink-0"
                                style={{ background: 'var(--accent-base, #FF6D29)' }}
                            >
                                {isApplying ? 'Applying...' : 'Apply & Save'}
                            </button>
                            <button
                                onClick={onClose}
                                disabled={isApplying}
                                className="w-full px-3 py-3 rounded-lg text-[10px] font-mono tracking-widest uppercase
                                    text-white/50 hover:text-white/90 hover:bg-white/5 transition-colors cursor-pointer
                                    disabled:opacity-50 pointer-events-auto shrink-0"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
                            
            </DialogContent>
        </Dialog>
    );
}
