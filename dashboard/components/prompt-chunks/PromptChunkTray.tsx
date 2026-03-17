'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { usePromptChunkStore } from '@/store/usePromptChunkStore';
import { PromptChunkPill } from './PromptChunkPill';
import { PromptChunkDialog } from './PromptChunkDialog';

export function PromptChunkTray() {
    const { chunks, fetchChunks, openCreateDialog } = usePromptChunkStore();

    useEffect(() => {
        fetchChunks();
    }, [fetchChunks]);

    return (
        <>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 px-1">
                {/* Add new chunk button */}
                <button
                    type="button"
                    onClick={openCreateDialog}
                    className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md border border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 transition-all duration-150"
                    title="Add prompt chunk"
                >
                    <Plus size={14} className="text-white/50" />
                </button>

                {/* Chunk pills */}
                <AnimatePresence mode="popLayout">
                    {chunks.map((chunk) => (
                        <motion.div
                            key={chunk.id}
                            layout
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                        >
                            <PromptChunkPill chunk={chunk} />
                        </motion.div>
                    ))}
                </AnimatePresence>

            </div>

            {/* Dialog renders as a portal */}
            <PromptChunkDialog />
        </>
    );
}
