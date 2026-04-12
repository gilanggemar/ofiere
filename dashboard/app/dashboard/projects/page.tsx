"use client";

import { useEffect } from "react";
import { usePMStore } from "@/store/usePMStore";
import { ProjectsSidebar } from "@/components/projects/ProjectsSidebar";
import { ProjectsHeader } from "@/components/projects/ProjectsHeader";
import { ProjectsTable } from "@/components/projects/ProjectsTable";
import { ProjectsBoard } from "@/components/projects/ProjectsBoard";
import { ProjectTimeline } from "@/components/projects/ProjectTimeline";
import { ProjectStream } from "@/components/projects/ProjectStream";
import { ProjectAnalytics } from "@/components/projects/ProjectAnalytics";
import { ProjectFiles } from "@/components/projects/ProjectFiles";
import { ProjectStatsBar } from "@/components/projects/ProjectStatsBar";
import { TaskDetailPanel } from "@/components/projects/TaskDetailPanel";
import { CreateSpaceDialog } from "@/components/projects/CreateSpaceDialog";
import { CreateTaskDialog } from "@/components/projects/CreateTaskDialog";
import { AddWorkflowDialog } from "@/components/projects/AddWorkflowDialog";
import { ProjectsEmptyState } from "@/components/projects/ProjectsEmptyState";
import { useProjectKeyboard } from "@/components/projects/useProjectKeyboard";
import { motion, AnimatePresence } from "framer-motion";

export default function ProjectsPage() {
    const hydrate = usePMStore((s) => s.hydrate);
    const fetchAgents = usePMStore((s) => s.fetchAgents);
    const hasFetched = usePMStore((s) => s.hasFetched);
    const spaces = usePMStore((s) => s.spaces);
    const currentView = usePMStore((s) => s.currentView);
    const selectedTaskId = usePMStore((s) => s.selectedTaskId);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);

    useEffect(() => {
        hydrate();
        fetchAgents();
    }, [hydrate, fetchAgents]);

    // Keyboard shortcuts (J/K nav, 1-6 views, N new task, Esc close, / search)
    useProjectKeyboard();

    const hasSpaces = spaces.length > 0;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col h-full"
        >
            <div className="flex flex-1 min-h-0">
                {/* Left Sidebar: Space/Folder Tree */}
                <ProjectsSidebar />

                {/* Center Panel */}
                <div className="flex-1 flex flex-col min-w-0">
                    {!hasSpaces && hasFetched ? (
                        <ProjectsEmptyState />
                    ) : (
                        <>
                            <ProjectsHeader />
                            {activeSpaceId && <ProjectStatsBar />}
                            <div className="flex-1 overflow-auto">
                                {currentView === 'table' && <ProjectsTable />}
                                {currentView === 'board' && <ProjectsBoard />}
                                {currentView === 'timeline' && <ProjectTimeline />}
                                {currentView === 'stream' && <ProjectStream />}
                                {currentView === 'analytics' && <ProjectAnalytics />}
                                {currentView === 'files' && <ProjectFiles />}
                            </div>
                        </>
                    )}
                </div>

                {/* Right Detail Panel — Overlay with slide animation */}
                <AnimatePresence>
                    {selectedTaskId && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="fixed inset-0 z-40 bg-black/20"
                                onClick={() => { const { setSelectedTask } = usePMStore.getState(); setSelectedTask(null); }}
                            />
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                                className="fixed right-0 top-0 bottom-0 z-50"
                            >
                                <TaskDetailPanel />
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>

                {/* Dialogs */}
                <CreateSpaceDialog />
                <CreateTaskDialog />
                <AddWorkflowDialog />
            </div>
        </motion.div>
    );
}
