"use client";

import { useEffect, useState } from "react";
import { usePentagramStore } from "@/stores/usePentagramStore";
import { VisualNovelScreen } from "./VisualNovelScreen";
import { DevToolsPanel } from "./DevToolsPanel";
import { InteractSceneEditor } from "./InteractSceneEditor";
import { ChevronRight, ArrowLeft, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PentagramArenaPanelProps {
    onExit?: () => void;
}

export function PentagramArenaPanel({ onExit }: PentagramArenaPanelProps) {
    const restartGame = usePentagramStore((s) => s.restartGame);
    const isInteractEditorOpen = usePentagramStore((s) => s.isInteractEditorOpen);
    const setInteractEditorOpen = usePentagramStore((s) => s.setInteractEditorOpen);
    const [devToolsOpen, setDevToolsOpen] = useState(true);

    useEffect(() => {
        restartGame();
    }, [restartGame]);

    return (
        <div className="w-full h-full flex relative overflow-hidden bg-black">
            
            {/* Main: Visual Novel Screen — fills all available space */}
            <div id="pentagram-vn-container" className="flex-1 min-w-0 h-full relative">
                
                {/* Floating header bar inside the game — sits above the VN */}
                <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-4 px-6 py-4 pointer-events-none">
                    {onExit && (
                        <button
                            onClick={onExit}
                            className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest bg-black/60 backdrop-blur-md border border-white/10 text-neutral-400 hover:text-white hover:border-white/30 transition-all rounded-lg"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> End Session
                        </button>
                    )}
                    <h2 className="text-lg font-black uppercase tracking-tight text-white/80 pointer-events-none">
                        PENTAGRAM <span className="text-orange-500">PROTOCOL</span>
                    </h2>
                    <button
                        onClick={() => setInteractEditorOpen(!isInteractEditorOpen)}
                        className={cn(
                            "pointer-events-auto flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest backdrop-blur-md border rounded-lg transition-all ml-auto",
                            isInteractEditorOpen
                                ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                                : "bg-black/60 border-white/10 text-neutral-400 hover:text-white hover:border-white/30"
                        )}
                    >
                        <Settings2 className="w-3.5 h-3.5" /> Interact Editor
                    </button>
                </div>

                {/* VN fills entire area */}
                <div className="absolute inset-0">
                    <VisualNovelScreen />
                </div>

                {/* Interact Scene Editor (Floating) */}
                <InteractSceneEditor />
            </div>

            {/* Dev Tools Panel (Floating Overlay) */}
            <div className={cn(
                "absolute right-0 top-0 bottom-0 z-50 flex h-full transition-transform duration-300 ease-in-out",
                devToolsOpen ? "translate-x-0" : "translate-x-full"
            )}>
                
                {/* Toggle Button */}
                <button
                    onClick={() => setDevToolsOpen(!devToolsOpen)}
                    className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-12 bg-neutral-900 border border-white/10 border-r-0 rounded-l-md flex items-center justify-center hover:bg-neutral-800 focus:outline-none z-50 text-neutral-400 hover:text-white"
                >
                    <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${devToolsOpen ? 'rotate-0' : 'rotate-180'}`} />
                </button>

                <div className="w-80 shrink-0 h-full">
                    <DevToolsPanel />
                </div>
            </div>
        </div>
    );
}
