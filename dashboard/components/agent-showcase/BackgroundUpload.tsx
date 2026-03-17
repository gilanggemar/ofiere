'use client';

import { useState, useRef } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { BackgroundCropModal } from './BackgroundCropModal';

interface BackgroundUploadProps {
    agentId: string;
    hasBackground: boolean;
    onUploaded: () => void;
    className?: string;
}

export function BackgroundUpload({ agentId, hasBackground, onUploaded, className = '' }: BackgroundUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (inputRef.current) inputRef.current.value = '';
        setSelectedFile(file);
    };

    const handleApplyCrop = async (croppedFile: File) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('agentId', agentId);
            formData.append('backgroundImage', croppedFile);
            await fetch('/api/agents/background', { method: 'POST', body: formData });
            onUploaded();
        } catch (err) {
            console.error('Failed to upload background:', err);
        } finally {
            setIsUploading(false);
            setSelectedFile(null);
        }
    };

    const handleRemove = async () => {
        setIsUploading(true);
        try {
            await fetch('/api/agents/background', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId }),
            });
            onUploaded();
        } catch (err) {
            console.error('Failed to remove background:', err);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <>
            <div className={`flex items-center gap-2 ${className}`}>
                <button
                    onClick={() => inputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono tracking-wider uppercase
                        bg-black/60 backdrop-blur-md border border-white/15 text-white/80
                        hover:bg-black/80 hover:border-white/30 hover:text-white
                        transition-all duration-200 cursor-pointer disabled:opacity-50 pointer-events-auto"
                >
                    {isUploading ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <ImagePlus size={14} />
                    )}
                    {hasBackground ? 'Change BG' : 'Set BG'}
                </button>
                {hasBackground && !isUploading && (
                    <button
                        onClick={handleRemove}
                        className="flex items-center justify-center w-7 h-7 rounded-full
                            bg-black/60 backdrop-blur-md border border-white/15 text-red-400/80
                            hover:bg-red-900/40 hover:border-red-400/30 hover:text-red-400
                            transition-all duration-200 cursor-pointer pointer-events-auto"
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />
            {selectedFile && (
                <BackgroundCropModal 
                    file={selectedFile} 
                    onClose={() => setSelectedFile(null)} 
                    onApply={handleApplyCrop} 
                />
            )}
        </>
    );
}
