"use client";

import { CommandPalette } from "@/components/CommandPalette";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useGamificationStore } from "@/store/useGamificationStore";
import { useOpenClawGateway } from "@/lib/useOpenClawGateway";
import { useOpenClawStore } from "@/store/useOpenClawStore";
import { useConnectionStore } from "@/store/useConnectionStore";
import { ExecApprovalModal } from "@/components/ExecApprovalModal";
import { useHealthPoller } from "@/lib/useHealthPoller";
import dynamic from "next/dynamic";

const PinnedChatOrb = dynamic(
    () => import("@/components/chat/PinnedChatOrb").then(mod => mod.PinnedChatOrb),
    { ssr: false }
);
const PinnedChatPopover = dynamic(
    () => import("@/components/chat/PinnedChatPopover").then(mod => mod.PinnedChatPopover),
    { ssr: false }
);

export function ClientShell({ children }: { children: React.ReactNode }) {
    useKeyboardShortcuts();
    const pathname = usePathname();
    const fetchActiveProfile = useConnectionStore((s) => s.fetchActiveProfile);
    const fetchAll = useGamificationStore((s) => s.fetchAll);

    // Initialize gateway connection — this wires all events into the store
    const { approveExec } = useOpenClawGateway();

    // Initialize health polling for VPS connections (30s interval)
    useHealthPoller({ intervalMs: 30000 });

    // Exec approval queue
    const pendingApprovals = useOpenClawStore((s) => s.pendingApprovals);
    const resolveApproval = useOpenClawStore((s) => s.resolveApproval);

    useEffect(() => {
        // Initial fetch — may fail on fresh login if auth cookies aren't ready yet
        fetchAll();
        fetchActiveProfile().then(() => {
            // If profile wasn't found on first try, retry after a short delay
            // (common after login redirect when auth cookies are still settling)
            const state = useConnectionStore.getState();
            if (!state.activeProfile && state.profileFetched) {
                setTimeout(() => {
                    useConnectionStore.getState().fetchActiveProfile();
                    useGamificationStore.getState().fetchAll();
                }, 1500);
            }
        });

        const interval = setInterval(() => {
            useGamificationStore.getState().checkStreak();
        }, 1000 * 60 * 60 * 2);
        return () => clearInterval(interval);
    }, [fetchAll, fetchActiveProfile]);

    const handleApprove = async (id: string) => {
        try {
            await approveExec(id, true);
            resolveApproval(id);
        } catch (err) {
            console.error("Failed to approve exec:", err);
        }
    };

    const handleDeny = async (id: string) => {
        try {
            await approveExec(id, false);
            resolveApproval(id);
        } catch (err) {
            console.error("Failed to deny exec:", err);
        }
    };

    return (
        <>
            <AnimatePresence mode="popLayout">
                <motion.div
                    key={pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    className="h-full w-full"
                >
                    {children}
                </motion.div>
            </AnimatePresence>
            <CommandPalette />

            {/* Pinned Chat: Floating Orb + Popover */}
            <PinnedChatOrb />
            <PinnedChatPopover />

            {/* Exec Approval Modals */}
            {pendingApprovals.length > 0 && (
                <ExecApprovalModal
                    approval={pendingApprovals[0]}
                    onApprove={handleApprove}
                    onDeny={handleDeny}
                />
            )}
        </>
    );
}
