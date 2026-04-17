'use client';

import { useState, useEffect } from 'react';
import { useVignetteStore } from '@/stores/useVignetteStore';
import { motion, AnimatePresence } from 'framer-motion';

interface VignetteTuningModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function VignetteTuningModal({ isOpen, onClose }: VignetteTuningModalProps) {
    const { tunableBlur, tunableStart, tunableEnd, tunableDarkness, updateVignette } = useVignetteStore();
    
    // Snapshot state for canceling mutations
    const [snapshot, setSnapshot] = useState({
        tunableBlur: 24,
        tunableStart: 20,
        tunableEnd: 100,
        tunableDarkness: 30
    });

    // When modal opens, save snapshot
    useEffect(() => {
        if (isOpen) {
            setSnapshot({ tunableBlur, tunableStart, tunableEnd, tunableDarkness });
        }
    }, [isOpen, tunableBlur, tunableStart, tunableEnd, tunableDarkness]);

    const handleCancel = () => {
        updateVignette(snapshot);
        onClose();
    };

    const handleSave = () => {
        // Zustand persist automatically saves live updates
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: '-40%', x: '-50%' }}
                    animate={{ opacity: 1, scale: 1, y: '-50%', x: '-50%' }}
                    exit={{ opacity: 0, scale: 0.95, y: '-45%', x: '-50%' }}
                    className="fixed top-1/2 left-1/2 z-[9999] pointer-events-auto w-[400px] ofiere-glass-3 bg-black/90 p-6 rounded-md border border-[#FF6D29]/50 shadow-[0_0_30px_rgba(255,40,0,0.2)] text-white font-mono"
                    style={{ transform: 'translate(-50%, -50%)' }} // Fallback if framer-motion delays
                >
                    <h3 className="text-[#FF6D29] text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-center">
                        Vignette Core Tuning
                    </h3>
                    
                    <div className="flex flex-col gap-6 py-2">
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-[10px] text-white/50 uppercase tracking-wider font-bold">
                                <span>Blur Strength</span>
                                <span className="text-white">{tunableBlur}px</span>
                            </div>
                            <input type="range" min="0" max="64" value={tunableBlur} onChange={e => updateVignette({ tunableBlur: Number(e.target.value) })} className="w-full accent-[#FF6D29] h-1 bg-white/10 rounded-full appearance-none outline-none cursor-ew-resize" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-[10px] text-white/50 uppercase tracking-wider font-bold">
                                <span>Solid Edge Blur Start</span>
                                <span className="text-white">{tunableStart}%</span>
                            </div>
                            <input type="range" min="0" max="100" value={tunableStart} onChange={e => updateVignette({ tunableStart: Number(e.target.value) })} className="w-full accent-[#FF6D29] h-1 bg-white/10 rounded-full appearance-none outline-none cursor-ew-resize" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-[10px] text-white/50 uppercase tracking-wider font-bold">
                                <span>Fade Blur To (End)</span>
                                <span className="text-white">{tunableEnd}%</span>
                            </div>
                            <input type="range" min="0" max="100" value={tunableEnd} onChange={e => updateVignette({ tunableEnd: Number(e.target.value) })} className="w-full accent-[#FF6D29] h-1 bg-white/10 rounded-full appearance-none outline-none cursor-ew-resize" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-[10px] text-white/50 uppercase tracking-wider font-bold">
                                <span>Dark Overlay Shadow</span>
                                <span className="text-white">{tunableDarkness}%</span>
                            </div>
                            <input type="range" min="0" max="100" value={tunableDarkness} onChange={e => updateVignette({ tunableDarkness: Number(e.target.value) })} className="w-full accent-[#FF6D29] h-1 bg-white/10 rounded-full appearance-none outline-none cursor-ew-resize" />
                        </div>
                    </div>

                    <div className="flex gap-4 justify-between w-full mt-6">
                        <button
                            onClick={handleCancel}
                            className="flex-1 py-3 bg-black/60 border border-white/10 text-white/60 hover:text-white transition-colors text-[10px] font-mono tracking-widest font-bold focus:outline-none rounded-sm cursor-pointer"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 py-3 bg-[#FF6D29]/10 border border-[#FF6D29]/50 text-[#FF6D29] hover:bg-[#FF6D29]/20 hover:border-[#FF6D29] transition-colors text-[10px] font-mono tracking-widest font-bold focus:outline-none rounded-sm cursor-pointer"
                        >
                            SAVE
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
