"use client";

import { cn } from "@/lib/utils";
import { useNavigationStore, NAV_GROUPS, type NavGroup } from "@/store/useNavigationStore";
import { useRouter } from "next/navigation";
import { LayoutGrid, Briefcase, Brain, Settings, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLayoutStore } from "@/store/useLayoutStore";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";

const DOCK_ITEMS: { group: NavGroup; icon: typeof LayoutGrid; label: string }[] = [
    { group: "PRIMARY", icon: LayoutGrid, label: "Primary" },
    { group: "OPERATIONS", icon: Briefcase, label: "Operations" },
    { group: "INTELLIGENCE", icon: Brain, label: "Intelligence" },
    { group: "SETTINGS", icon: Settings, label: "Settings" },
];

export function BottomDock() {
    const activeGroup = useNavigationStore((s) => s.activeGroup);
    const setActiveGroup = useNavigationStore((s) => s.setActiveGroup);
    const router = useRouter();
    
    const isExpanded = useLayoutStore((s) => s.isBottomDockExpanded);
    const setExpanded = useLayoutStore((s) => s.setBottomDockExpanded);

    const handleGroupClick = (group: NavGroup) => {
        setActiveGroup(group);
        const firstRoute = NAV_GROUPS[group][0];
        if (firstRoute) {
            router.push(firstRoute.link);
        }
    };

    return (
        <div 
            className="fixed bottom-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pb-[8px] pt-8 px-12"
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
        >
            <AnimatePresence>
                {isExpanded ? (
                    <motion.div
                        key="dock-content"
                        initial={{ opacity: 0, y: 52 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 52 }}
                        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                        className="nerv-bottom-dock relative"
                    >
                        <div className="nerv-dock-pill">
                            {DOCK_ITEMS.map(({ group, icon: Icon, label }) => {
                                const isActive = activeGroup === group;
                                return (
                                    <Tooltip key={group}>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={() => handleGroupClick(group)}
                                                className={cn(
                                                    "nerv-dock-btn",
                                                    isActive && "nerv-dock-btn--active"
                                                )}
                                                aria-label={label}
                                                aria-current={isActive ? "page" : undefined}
                                            >
                                                <Icon className="w-[18px] h-[18px]" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent 
                                            side="top" 
                                            sideOffset={11}
                                            className="bg-[var(--accent-base)] text-black font-semibold border-[var(--accent-base)]"
                                        >
                                            {label}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="dock-chevron"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-[8px] h-4 w-16 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-pointer"
                    >
                        <ChevronUp className="w-4 h-4" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
