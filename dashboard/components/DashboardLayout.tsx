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
            <div className="nerv-app-shell">
                <TopRightUserMenu />
                <ShellFrame>
                    <main className="nerv-content-viewport">
                        <ClientShell>
                            <Suspense fallback={
                                <div className="flex items-center justify-center h-full w-full">
                                    <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
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

