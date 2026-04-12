"use client";

import { useEffect } from "react";
import { usePMStore } from "@/store/usePMStore";
import type { PMViewType } from "@/lib/pm/types";

/**
 * Global keyboard shortcuts for the Projects page.
 * 
 * Navigation:
 *   J / ↓  — Select next task
 *   K / ↑  — Select previous task
 *   Enter  — Open selected task detail panel
 *   Escape — Close detail panel / deselect
 * 
 * Actions:
 *   N       — New task dialog
 *   1-5     — Switch view (table/board/timeline/stream/analytics)
 *   /       — Focus search (if in table view)
 *   Ctrl+S  — Force sync (re-hydrate)
 */
export function useProjectKeyboard() {
    const tasks = usePMStore((s) => s.tasks);
    const selectedTaskId = usePMStore((s) => s.selectedTaskId);
    const setSelectedTask = usePMStore((s) => s.setSelectedTask);
    const setCurrentView = usePMStore((s) => s.setCurrentView);
    const setCreateTaskOpen = usePMStore((s) => s.setCreateTaskOpen);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);
    const hydrate = usePMStore((s) => s.hydrate);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore when typing in inputs
            const tag = (e.target as HTMLElement).tagName;
            const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable;

            if (isEditing) {
                // Only handle Escape in editing context
                if (e.key === 'Escape') {
                    (e.target as HTMLElement).blur();
                }
                return;
            }

            const VIEW_KEYS: Record<string, PMViewType> = {
                '1': 'table',
                '2': 'board',
                '3': 'timeline',
                '4': 'stream',
                '5': 'analytics',
                '6': 'files',
            };

            // Get navigable tasks (non-subtasks in current scope)
            const getVisibleTasks = () => {
                let filtered = tasks.filter((t) => !t.parent_task_id);
                if (activeFolderId) filtered = filtered.filter((t) => t.folder_id === activeFolderId);
                else if (activeSpaceId) filtered = filtered.filter((t) => t.space_id === activeSpaceId);
                return filtered;
            };

            switch (e.key) {
                case 'j':
                case 'ArrowDown': {
                    e.preventDefault();
                    const visible = getVisibleTasks();
                    if (visible.length === 0) return;
                    if (!selectedTaskId) {
                        setSelectedTask(visible[0].id);
                    } else {
                        const idx = visible.findIndex((t) => t.id === selectedTaskId);
                        if (idx < visible.length - 1) setSelectedTask(visible[idx + 1].id);
                    }
                    break;
                }

                case 'k':
                case 'ArrowUp': {
                    e.preventDefault();
                    const visible = getVisibleTasks();
                    if (visible.length === 0) return;
                    if (!selectedTaskId) {
                        setSelectedTask(visible[visible.length - 1].id);
                    } else {
                        const idx = visible.findIndex((t) => t.id === selectedTaskId);
                        if (idx > 0) setSelectedTask(visible[idx - 1].id);
                    }
                    break;
                }

                case 'Enter': {
                    // If no task is selected, select the first one
                    if (!selectedTaskId) {
                        const visible = getVisibleTasks();
                        if (visible.length > 0) setSelectedTask(visible[0].id);
                    }
                    break;
                }

                case 'Escape': {
                    if (selectedTaskId) {
                        setSelectedTask(null);
                    }
                    break;
                }

                case 'n':
                case 'N': {
                    if (activeSpaceId) {
                        e.preventDefault();
                        setCreateTaskOpen(true);
                    }
                    break;
                }

                case '/': {
                    e.preventDefault();
                    // Focus search input if it exists
                    const searchInput = document.querySelector('[data-pm-search]') as HTMLInputElement;
                    if (searchInput) searchInput.focus();
                    break;
                }

                default: {
                    if (VIEW_KEYS[e.key]) {
                        e.preventDefault();
                        setCurrentView(VIEW_KEYS[e.key]);
                    }
                    // Ctrl+S = force sync
                    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        hydrate();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tasks, selectedTaskId, activeSpaceId, activeFolderId, setSelectedTask, setCurrentView, setCreateTaskOpen, hydrate]);
}
