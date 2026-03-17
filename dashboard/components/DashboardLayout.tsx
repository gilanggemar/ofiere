"use client";

import { Suspense, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClientShell } from "@/components/ClientShell";
import { TopRightUserMenu } from "@/components/navigation/TopRightUserMenu";
import { TopRail } from "@/components/navigation/TopRail";
import { ShellFrame } from "@/components/navigation/ShellFrame";
import { BottomDock } from "@/components/navigation/BottomDock";
import { PageLoadingIndicator } from "@/components/PageLoadingIndicator";
import { useTaskStore } from "@/lib/useTaskStore";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    const fetchTasks = useTaskStore((s) => s.fetchTasks);
    const hasFetched = useTaskStore((s) => s.hasFetched);

    useEffect(() => {
        if (!hasFetched) fetchTasks();
    }, [hasFetched, fetchTasks]);
    return (
        <TooltipProvider>
            <div className="nerv-app-shell">
                <TopRightUserMenu />
                <ShellFrame>
                    <TopRail />
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
