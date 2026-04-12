"use client";

import { usePMStore } from "@/store/usePMStore";
import type { PMViewType } from "@/lib/pm/types";
import { Button } from "@/components/ui/button";
import {
    Table2, Kanban, GanttChart, Plus, Activity, FileText, BarChart3,
    MoreHorizontal, Pencil, Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const VIEWS: { id: PMViewType; icon: typeof Table2; label: string }[] = [
    { id: 'table', icon: Table2, label: 'Table' },
    { id: 'board', icon: Kanban, label: 'Board' },
    { id: 'timeline', icon: GanttChart, label: 'Timeline' },
    { id: 'stream', icon: Activity, label: 'Stream' },
    { id: 'analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'files', icon: FileText, label: 'Files' },
];

export function ProjectsHeader() {
    const currentView = usePMStore((s) => s.currentView);
    const setCurrentView = usePMStore((s) => s.setCurrentView);
    const setCreateTaskOpen = usePMStore((s) => s.setCreateTaskOpen);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);
    const activeProjectId = usePMStore((s) => s.activeProjectId);
    const spaces = usePMStore((s) => s.spaces);
    const folders = usePMStore((s) => s.folders);
    const setActiveSpace = usePMStore((s) => s.setActiveSpace);
    const setActiveFolder = usePMStore((s) => s.setActiveFolder);
    const setActiveProject = usePMStore((s) => s.setActiveProject);

    const activeSpace = spaces.find((s) => s.id === activeSpaceId);
    const activeFolder = activeFolderId ? folders.find((f) => f.id === activeFolderId) : null;
    const activeProject = activeProjectId ? folders.find((f) => f.id === activeProjectId) : null;

    // Build the full breadcrumb path from the active folder up to the root
    const folderBreadcrumb: { id: string; name: string; type: 'folder' | 'project' }[] = [];
    if (activeFolder) {
        let current: typeof activeFolder | undefined = activeFolder;
        while (current) {
            folderBreadcrumb.unshift({ id: current.id, name: current.name, type: current.folder_type || 'folder' });
            current = current.parent_folder_id
                ? folders.find((f) => f.id === current!.parent_folder_id)
                : undefined;
        }
    }

    // Determine the display title (project name if inside a project)
    const displayTitle = activeProject?.name || activeFolder?.name || activeSpace?.name || '';
    const isInsideProject = !!activeProjectId;

    return (
        <div className="flex flex-col">
            {/* Top bar: Breadcrumb + View tabs */}
            <div className="flex items-center justify-between px-4 py-2 gap-3">
                {/* Left: Breadcrumb (text-only, no icons) */}
                <div className="flex items-center gap-1.5 min-w-0">
                    {activeSpace && (
                        <span
                            className={cn(
                                "text-[12px] truncate cursor-pointer transition-colors",
                                folderBreadcrumb.length > 0
                                    ? "text-muted-foreground/50 hover:text-foreground"
                                    : "text-foreground font-medium"
                            )}
                            onClick={() => setActiveSpace(activeSpaceId!)}
                        >
                            {activeSpace.name}
                        </span>
                    )}
                    {/* Full folder breadcrumb path */}
                    {folderBreadcrumb.map((crumb, idx) => {
                        const isLast = idx === folderBreadcrumb.length - 1;
                        return (
                            <span key={crumb.id} className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] text-muted-foreground/20">/</span>
                                <span
                                    onClick={() => {
                                        if (crumb.type === 'project') {
                                            setActiveProject(crumb.id);
                                        } else {
                                            setActiveFolder(crumb.id);
                                        }
                                    }}
                                    className={cn(
                                        "text-[12px] truncate transition-colors cursor-pointer",
                                        isLast
                                            ? "text-foreground font-medium"
                                            : "text-muted-foreground/50 hover:text-foreground"
                                    )}
                                >
                                    {crumb.name}
                                </span>
                            </span>
                        );
                    })}
                </div>

                {/* Right: View tabs + New Task */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-foreground/3 rounded-lg p-0.5">
                        {VIEWS.map((v) => (
                            <button
                                key={v.id}
                                onClick={() => setCurrentView(v.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                                    currentView === v.id
                                        ? "bg-card text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <v.icon className="w-3.5 h-3.5" />
                                {v.label}
                            </button>
                        ))}
                    </div>

                    <Button
                        size="sm"
                        onClick={() => setCreateTaskOpen(true)}
                        className="rounded-md h-7 px-3 text-[11px] gap-1.5 bg-accent-base text-background hover:bg-accent-base/90"
                        disabled={!activeSpaceId}
                    >
                        <Plus className="w-3 h-3" />
                        New Task
                    </Button>
                </div>
            </div>

            {/* Directory Title — shows current space/folder/project name */}
            {(activeFolder || activeSpace) && (
                <div className="px-4 pb-2">
                    <h1 className="text-[18px] font-bold text-foreground tracking-tight">
                        {activeFolder ? activeFolder.name : activeSpace?.name}
                    </h1>
                </div>
            )}
        </div>
    );
}
