"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    MessageCircle,
    Users,
    ListPlus,
    Search,
    Activity,
    ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

export const QuickActionsDock = () => {
    const router = useRouter();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Alt+C : Quick Chat
            if (e.altKey && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                toast("Quick Chat — Coming in Phase 4");
            }

            // Alt+S : Start Summit
            if (e.altKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                router.push('/summit');
            }

            // Alt+T : New Task
            if (e.altKey && e.key.toLowerCase() === 't') {
                e.preventDefault();
                toast("New Task — Coming in Phase 4");
            }

            // Cmd+K / Ctrl+K : Command Palette
            // We don't prevent default here intentionally if there's already a global Cmd+K handler.
            // If we confirm there isn't one, we could add preventDefault and open a local state.
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                // Just let it propagate to existing handlers.
            }

            // Alt+H : Status Overview
            if (e.altKey && e.key.toLowerCase() === 'h') {
                e.preventDefault();
                toast("Status Overview — Coming in Phase 4");
            }

            // Alt+Shift+E : Emergency
            if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'e') {
                e.preventDefault();
                // Since we need to open the dialog, we'd ideally trigger a state here.
                // For simplicity without complex global dialog state, we'll just toast the keybind trigger.
                // The visual button will still open the actual dialog.
                toast.error("Emergency shortcut pressed. Click the dock button to confirm shutdown.");
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [router]);

    return (
        <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 25 }}
            className="hidden md:flex fixed bottom-[20px] left-1/2 -translate-x-1/2 z-50 rounded-full px-3 py-1.5 ofiere-glass-3 gap-1 shadow-[inset_0_1px_0_oklch(1_0_0/0.08)]"
        >
            <TooltipProvider delayDuration={200}>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toast("Quick Chat — Coming in Phase 4")}
                            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full text-foreground/50 hover:text-[var(--accent-base)] hover:bg-[oklch(from_var(--accent-base)_l_c_h/0.1)] transition-colors duration-150"
                        >
                            <MessageCircle size={18} />
                        </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="hidden lg:block ofiere-caption text-foreground bg-popover/90 backdrop-blur-md mb-2">
                        Quick Chat <span className="text-muted-foreground ml-1">(Alt+C)</span>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => router.push('/summit')}
                            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full text-foreground/50 hover:text-[var(--accent-violet)] hover:bg-[oklch(from_var(--accent-violet)_l_c_h/0.1)] transition-colors duration-150"
                        >
                            <Users size={18} />
                        </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="hidden lg:block ofiere-caption text-foreground bg-popover/90 backdrop-blur-md mb-2">
                        Start Summit <span className="text-muted-foreground ml-1">(Alt+S)</span>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toast("New Task — Coming in Phase 4")}
                            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full text-foreground/50 hover:text-[var(--accent-teal)] hover:bg-[oklch(from_var(--accent-teal)_l_c_h/0.1)] transition-colors duration-150"
                        >
                            <ListPlus size={18} />
                        </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="hidden lg:block ofiere-caption text-foreground bg-popover/90 backdrop-blur-md mb-2">
                        New Task <span className="text-muted-foreground ml-1">(Alt+T)</span>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                // Dispatch Cmd+K event simulating user input to trigger Command Palette globally
                                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true });
                                document.dispatchEvent(event);
                                toast("Command Palette Triggered (Simulated)");
                            }}
                            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full text-foreground/50 hover:text-foreground hover:bg-[oklch(from_var(--foreground)_l_c_h/0.1)] transition-colors duration-150"
                        >
                            <Search size={18} />
                        </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="hidden lg:block ofiere-caption text-foreground bg-popover/90 backdrop-blur-md mb-2">
                        Command Palette <span className="text-muted-foreground ml-1">(⌘K)</span>
                    </TooltipContent>
                </Tooltip>

                <div className="w-[1px] h-5 my-auto bg-[oklch(1_0_0/0.1)] mx-1" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toast("Status Overview — Coming in Phase 4")}
                            className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full text-foreground/50 hover:text-[var(--accent-lime)] hover:bg-[oklch(from_var(--accent-lime)_l_c_h/0.1)] transition-colors duration-150"
                        >
                            <Activity size={18} />
                        </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="hidden lg:block ofiere-caption text-foreground bg-popover/90 backdrop-blur-md mb-2">
                        Status Check <span className="text-muted-foreground ml-1">(Alt+H)</span>
                    </TooltipContent>
                </Tooltip>

                <AlertDialog>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center rounded-full text-foreground/50 opacity-60 hover:opacity-100 hover:text-[var(--accent-coral)] hover:bg-[oklch(from_var(--accent-coral)_l_c_h/0.1)] transition-all duration-150"
                                >
                                    <ShieldAlert size={18} />
                                </motion.button>
                            </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="hidden lg:block ofiere-caption text-foreground bg-popover/90 backdrop-blur-md mb-2">
                            Emergency Shutdown <span className="text-muted-foreground ml-1">(Alt+Shift+E)</span>
                        </TooltipContent>
                    </Tooltip>

                    <AlertDialogContent className="ofiere-glass-3 border-[var(--accent-coral-soft)] shadow-[0_0_40px_oklch(from_var(--accent-coral)_l_c_h/0.2)]">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="ofiere-h2 flex items-center gap-2 text-[var(--accent-coral)]">
                                <ShieldAlert size={24} />
                                Emergency Shutdown
                            </AlertDialogTitle>
                            <AlertDialogDescription className="ofiere-body text-foreground/80">
                                Are you sure? This will halt all active operations from connected agents and sever WebSocket communication temporarily.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-4">
                            <AlertDialogCancel className="hover:bg-foreground/5 border-foreground/10">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => toast.error("Emergency shutdown triggered!")}
                                className="bg-[var(--accent-coral)] text-[var(--text-on-accent)] hover:bg-[var(--accent-pressed)]"
                            >
                                Confirm Shutdown
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </TooltipProvider>
        </motion.div>
    );
};

export default QuickActionsDock;
