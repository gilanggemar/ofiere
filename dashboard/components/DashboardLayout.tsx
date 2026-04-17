"use client";

import { Suspense, useEffect } from "react";
import { usePathname } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClientShell } from "@/components/ClientShell";
import { TopRightUserMenu } from "@/components/navigation/TopRightUserMenu";
import { ShellFrame } from "@/components/navigation/ShellFrame";
import { BottomDock } from "@/components/navigation/BottomDock";
import { PageLoadingIndicator } from "@/components/PageLoadingIndicator";
import { useTaskStore } from "@/lib/useTaskStore";
import { useNavigationStore } from "@/store/useNavigationStore";
import { useConnectionStore } from "@/store/useConnectionStore";
import { useAssemblyStore } from "@/store/useAssemblyStore";


export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const fetchTasks = useTaskStore((s) => s.fetchTasks);
    const hasFetched = useTaskStore((s) => s.hasFetched);
    const syncFromPath = useNavigationStore((s) => s.syncFromPath);
    const pathname = usePathname();
    const profileFetched = useConnectionStore((s) => s.profileFetched);
    const markReady = useAssemblyStore((s) => s.markReady);

    // When profile data is fetched, signal the global assembly to dismiss
    useEffect(() => {
        if (profileFetched) {
            markReady();
        }
    }, [profileFetched, markReady]);

    useEffect(() => {
        if (!hasFetched) fetchTasks();
    }, [hasFetched, fetchTasks]);

    // Sync navigation state from URL (previously in TopRail)
    useEffect(() => {
        if (pathname) syncFromPath(pathname);
    }, [pathname, syncFromPath]);

    return (
        <TooltipProvider>
            <div className="ofiere-app-shell">
                <TopRightUserMenu />
                <ShellFrame>
                    <main className={`ofiere-content-viewport${pathname === '/dashboard/constellation' || pathname === '/dashboard/projects' || pathname?.match(/^\/dashboard\/workflows\/[^/]+\/builder/) ? ' ofiere-content-fullbleed' : ''}`}>
                        <ClientShell>
                            <Suspense fallback={
                                <div className="flex items-center justify-center h-full w-full">
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: 0.5 }}>
                                        <svg width="48" height="48" viewBox="0 0 80 80" fill="none">
                                            <circle cx="40" cy="40" r="34" stroke="oklch(0.75 0.18 55 / 0.12)" strokeWidth="1" />
                                            <circle cx="40" cy="40" r="34" stroke="oklch(0.78 0.18 55)" strokeWidth="2" strokeLinecap="round" strokeDasharray="50 164" style={{ transformOrigin: '40px 40px', animation: 'ofiere-orbit-cw 2.4s linear infinite' }} />
                                            <circle cx="40" cy="40" r="3" fill="oklch(0.78 0.18 55)" />
                                        </svg>
                                    </div>
                                </div>
                            }>
                                {children}
                            </Suspense>
                        </ClientShell>
                    </main>
                </ShellFrame>
                <BottomDock />
                <PageLoadingIndicator />
            </div>
        </TooltipProvider>
    );
}

