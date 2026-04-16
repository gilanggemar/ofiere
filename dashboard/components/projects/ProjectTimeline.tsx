"use client";

import { usePMStore } from "@/store/usePMStore";
import type { PMTask, PMTaskCustomFields, PMFolder } from "@/lib/pm/types";
import { cn } from "@/lib/utils";
import {
    ChevronLeft, ChevronRight,
    ChevronDown, ChevronRight as ChevronRightIcon,
    Calendar,
    Repeat,
    GripVertical,
    Trash2,
} from "lucide-react";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";

interface DrawingDep {
    fromTaskId: string;
    fromSide: 'left' | 'right';
    mouseX: number;
    mouseY: number;
    snappedTaskId?: string;
    snappedSide?: string;
    snappedX?: number;
    snappedY?: number;
}

const ROW_HEIGHT = 42;

// Default orange pill colors
const PARENT_BAR_COLOR = '#0A0908';
const PARENT_BAR_BG = '#FF6D29';
const PARENT_BAR_BORDER = 'rgba(255,130,71,0.6)';
const PARENT_BAR_GLOW = '0 0 12px rgba(255,109,41,0.25)';

// Slightly muted orange for children
const CHILD_BAR_COLOR = '#0A0908';
const CHILD_BAR_BG = '#D4874A';
const CHILD_BAR_BORDER = 'rgba(212,135,74,0.5)';
const CHILD_BAR_GLOW = '0 0 8px rgba(212,135,74,0.2)';

// Ghost bar
const GHOST_BAR_BG = 'rgba(255,109,41,0.06)';
const GHOST_BAR_BORDER = 'rgba(255,109,41,0.10)';

// Recurring ghost bar colors
const RECURRING_GHOST_BG = 'rgba(255,109,41,0.12)';
const RECURRING_GHOST_BORDER = 'rgba(255,109,41,0.25)';

// Color palette for right-click
const BAR_COLOR_PALETTE = [
    { label: 'Default', bg: null, border: null },
    { label: 'Red', bg: '#DC2626', border: 'rgba(220,38,38,0.6)' },
    { label: 'Rose', bg: '#E11D48', border: 'rgba(225,29,72,0.6)' },
    { label: 'Pink', bg: '#DB2777', border: 'rgba(219,39,119,0.6)' },
    { label: 'Purple', bg: '#9333EA', border: 'rgba(147,51,234,0.6)' },
    { label: 'Indigo', bg: '#4F46E5', border: 'rgba(79,70,229,0.6)' },
    { label: 'Blue', bg: '#2563EB', border: 'rgba(37,99,235,0.6)' },
    { label: 'Cyan', bg: '#0891B2', border: 'rgba(8,145,178,0.6)' },
    { label: 'Teal', bg: '#0D9488', border: 'rgba(13,148,136,0.6)' },
    { label: 'Green', bg: '#16A34A', border: 'rgba(22,163,74,0.6)' },
    { label: 'Lime', bg: '#65A30D', border: 'rgba(101,163,13,0.6)' },
    { label: 'Yellow', bg: '#CA8A04', border: 'rgba(202,138,4,0.6)' },
];

// Two-tone alternating project row backgrounds
const PROJECT_ROW_TINTS = [
    'rgba(255,255,255,0.02)',
    'transparent',
];

// Two-tone alternating project drag bar colors
const PROJECT_BAR_COLORS = [
    '#FF6D29',
    '#888888',
];

type ZoomLevel = 'day' | 'week' | 'month';
const ZOOM_DAY_WIDTHS: Record<ZoomLevel, number> = { day: 48, week: 28, month: 8 };
const ZOOM_TOTAL_DAYS: Record<ZoomLevel, number> = { day: 30, week: 63, month: 210 };

interface TimelineRow {
    task: PMTask;
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    hasAnyChildren: boolean;
    isSubtask: boolean;
    projectName?: string;
    projectIndex?: number;
    isFirstInProject?: boolean;
    folderName?: string;
    folderIndex?: number;
    isFirstInFolder?: boolean;
}

export function ProjectTimeline() {
    const allTasks = usePMStore((s) => s.tasks);
    const allFolders = usePMStore((s) => s.folders);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);
    const activeProjectId = usePMStore((s) => s.activeProjectId);
    const agents = usePMStore((s) => s.agents);
    const setSelectedTask = usePMStore((s) => s.setSelectedTask);
    const selectedTaskId = usePMStore((s) => s.selectedTaskId);
    const updateTask = usePMStore((s) => s.updateTask);
    const updateFolder = usePMStore((s) => s.updateFolder);
    // Store-based dependencies
    const dependencies = usePMStore((s) => s.dependencies);
    const storeAddDependency = usePMStore((s) => s.addDependency);
    const storeRemoveDependency = usePMStore((s) => s.removeDependency);
    const storeFetchDependencies = usePMStore((s) => s.fetchDependencies);

    const [weekOffset, setWeekOffset] = useState(0);
    const [zoom, setZoom] = useState<ZoomLevel>('week');
    const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
    const [expandedRecurringIds, setExpandedRecurringIds] = useState<Set<string>>(new Set());
    const [rowOrder, setRowOrder] = useState<string[]>([]);
    const [subtaskOrders, setSubtaskOrders] = useState<Record<string, string[]>>({});
    const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
    const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
    // Project-level drag state
    const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
    const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
    const [projectOrder, setProjectOrder] = useState<string[]>([]);
    // Folder-level drag state
    const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    const [folderOrder, setFolderOrder] = useState<string[]>([]);
    const [colorPickerTaskId, setColorPickerTaskId] = useState<string | null>(null);
    const [colorPickerPos, setColorPickerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    // Dependency drawing state
    const [drawingDep, setDrawingDep] = useState<DrawingDep | null>(null);
    const [hoveredDepId, setHoveredDepId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const colorPickerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const DAY_WIDTH = ZOOM_DAY_WIDTHS[zoom];
    const totalDays = ZOOM_TOTAL_DAYS[zoom];

    // Close color picker on click outside
    useEffect(() => {
        if (!colorPickerTaskId) return;
        const handler = (e: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
                setColorPickerTaskId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [colorPickerTaskId]);

    // Fetch dependencies on mount
    useEffect(() => { storeFetchDependencies(); }, [storeFetchDependencies]);

    // ── Drag-to-connect handlers (bidirectional) ──
    const handleConnectorMouseDown = useCallback((taskId: string, side: 'left' | 'right', e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;
        const rect = scrollEl.getBoundingClientRect();
        setDrawingDep({
            fromTaskId: taskId,
            fromSide: side,
            mouseX: e.clientX - rect.left + scrollEl.scrollLeft,
            mouseY: e.clientY - rect.top + scrollEl.scrollTop,
        });
    }, []);

    useEffect(() => {
        if (!drawingDep) return;
        const scrollEl = scrollRef.current;
        if (!scrollEl) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = scrollEl.getBoundingClientRect();
            const rawMouseX = e.clientX - rect.left + scrollEl.scrollLeft;
            const rawMouseY = e.clientY - rect.top + scrollEl.scrollTop;

            // Snap-to-dot: find closest connector dot within threshold
            const SNAP_RADIUS = 25;
            const depTargets = scrollEl.querySelectorAll('[data-dep-target]');
            let closestDist = Infinity;
            let snappedTaskId: string | undefined;
            let snappedSide: string | undefined;
            let snappedX: number | undefined;
            let snappedY: number | undefined;

            depTargets.forEach((el) => {
                const targetId = el.getAttribute('data-dep-target');
                const targetSide = el.getAttribute('data-dep-side') || 'left';
                if (!targetId || targetId === drawingDep.fromTaskId) return;
                const dotRect = el.getBoundingClientRect();
                const dotCenterX = dotRect.left + dotRect.width / 2 - rect.left + scrollEl.scrollLeft;
                const dotCenterY = dotRect.top + dotRect.height / 2 - rect.top + scrollEl.scrollTop;
                const dist = Math.sqrt((e.clientX - (dotRect.left + dotRect.width / 2)) ** 2 + (e.clientY - (dotRect.top + dotRect.height / 2)) ** 2);
                if (dist < SNAP_RADIUS && dist < closestDist) {
                    closestDist = dist;
                    snappedTaskId = targetId;
                    snappedSide = targetSide;
                    snappedX = dotCenterX;
                    snappedY = dotCenterY;
                }
            });

            setDrawingDep(prev => prev ? {
                ...prev,
                mouseX: rawMouseX,
                mouseY: rawMouseY,
                snappedTaskId,
                snappedSide,
                snappedX,
                snappedY,
            } : null);
        };

        const handleMouseUp = (e: MouseEvent) => {
            // If we have a snapped target, use that directly
            if (drawingDep.snappedTaskId) {
                if (drawingDep.fromSide === 'right') {
                    storeAddDependency(drawingDep.fromTaskId, drawingDep.snappedTaskId);
                } else {
                    storeAddDependency(drawingDep.snappedTaskId, drawingDep.fromTaskId);
                }
                setDrawingDep(null);
                return;
            }
            // Fallback: Find if we released on a connector dot
            const target = e.target as HTMLElement;
            const dropTarget = target.closest('[data-dep-target]');
            if (dropTarget) {
                const targetTaskId = dropTarget.getAttribute('data-dep-target');
                const targetSide = dropTarget.getAttribute('data-dep-side') || 'left';
                if (targetTaskId && targetTaskId !== drawingDep.fromTaskId) {
                    if (drawingDep.fromSide === 'right') {
                        storeAddDependency(drawingDep.fromTaskId, targetTaskId);
                    } else {
                        storeAddDependency(targetTaskId, drawingDep.fromTaskId);
                    }
                }
            }
            setDrawingDep(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [drawingDep, storeAddDependency]);

    // Recursively get all descendant folder/project IDs of a folder
    const getDescendantFolderIds = useCallback((folderId: string): string[] => {
        const children = allFolders.filter((f) => f.parent_folder_id === folderId);
        const ids: string[] = [];
        children.forEach((child) => {
            ids.push(child.id);
            ids.push(...getDescendantFolderIds(child.id));
        });
        return ids;
    }, [allFolders]);

    // Determine if the active folder is actually a "folder" (not a project)
    const activeFolder = useMemo(() =>
        allFolders.find((f) => f.id === activeFolderId),
    [allFolders, activeFolderId]);

    const isViewingFolder = activeFolder && activeFolder.folder_type === 'folder';

    // Get all project IDs that should be visible (includes descendants for folders)
    const visibleProjectIds = useMemo(() => {
        if (activeProjectId) return [activeProjectId];
        if (activeFolderId && isViewingFolder) {
            return getDescendantFolderIds(activeFolderId);
        }
        if (activeFolderId) return [activeFolderId];
        return [];
    }, [activeProjectId, activeFolderId, isViewingFolder, getDescendantFolderIds]);

    // Build a map from project ID to project name
    const projectNameMap = useMemo(() => {
        const map = new Map<string, string>();
        allFolders.forEach((f) => {
            map.set(f.id, f.name);
        });
        return map;
    }, [allFolders]);

    // Get parent tasks filtered by space/folder/project (only scheduled ones)
    const parentTasks = useMemo(() => {
        let filtered = allTasks.filter((t) => !t.parent_task_id);
        if (visibleProjectIds.length > 0) {
            filtered = filtered.filter((t) => t.folder_id && visibleProjectIds.includes(t.folder_id));
        } else if (activeSpaceId) {
            filtered = filtered.filter((t) => t.space_id === activeSpaceId);
        }
        return filtered.filter((t) => t.start_date && t.due_date);
    }, [allTasks, activeSpaceId, visibleProjectIds]);

    // Get direct scheduled subtasks of a parent
    const getSubtasks = useCallback((parentId: string) => {
        return allTasks.filter((t) => t.parent_task_id === parentId && t.start_date && t.due_date);
    }, [allTasks]);

    // Get the full date extent of ALL descendants (recursive)
    const getDescendantExtent = useCallback((parentId: string): { earliest: Date; latest: Date } | null => {
        const children = allTasks.filter((t) => t.parent_task_id === parentId && t.start_date && t.due_date);
        if (children.length === 0) return null;
        let earliest = new Date(children[0].start_date!);
        let latest = new Date(children[0].due_date!);
        children.forEach((c) => {
            const s = new Date(c.start_date!);
            const e = new Date(c.due_date!);
            if (s < earliest) earliest = s;
            if (e > latest) latest = e;
            const grandExtent = getDescendantExtent(c.id);
            if (grandExtent) {
                if (grandExtent.earliest < earliest) earliest = grandExtent.earliest;
                if (grandExtent.latest > latest) latest = grandExtent.latest;
            }
        });
        return { earliest, latest };
    }, [allTasks]);

    // Group parent tasks by project for separator logic
    const tasksByProject = useMemo(() => {
        const groups = new Map<string, PMTask[]>();
        parentTasks.forEach((t) => {
            const key = t.folder_id || '__none__';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(t);
        });
        return groups;
    }, [parentTasks]);

    // Sort parent tasks: group by project, with project order + row order within
    const orderedParentTasks = useMemo(() => {
        // Get project IDs and apply project order
        let projectIds = Array.from(tasksByProject.keys());
        if (projectOrder.length > 0) {
            const orderMap = new Map(projectOrder.map((id, i) => [id, i]));
            projectIds.sort((a, b) => {
                const aIdx = orderMap.get(a) ?? 999;
                const bIdx = orderMap.get(b) ?? 999;
                return aIdx - bIdx;
            });
        }

        // Apply custom row ordering within each project group
        const result: PMTask[] = [];
        projectIds.forEach((projectId) => {
            const tasks = tasksByProject.get(projectId) || [];
            if (rowOrder.length > 0) {
                const orderMap = new Map(rowOrder.map((id, i) => [id, i]));
                tasks.sort((a, b) => {
                    const aIdx = orderMap.get(a.id) ?? 999;
                    const bIdx = orderMap.get(b.id) ?? 999;
                    return aIdx - bIdx;
                });
            }
            result.push(...tasks);
        });
        return result;
    }, [tasksByProject, rowOrder, projectOrder]);

    // Get ALL subtasks of a parent (including unscheduled ones)
    const getAllSubtasks = useCallback((parentId: string) => {
        return allTasks.filter((t) => t.parent_task_id === parentId);
    }, [allTasks]);

    // Build flat row list with recursive expansion and project/folder grouping
    const rows: TimelineRow[] = useMemo(() => {
        const result: TimelineRow[] = [];

        // Use ordered project IDs (respects projectOrder from drag reorder)
        let orderedProjectIds = Array.from(tasksByProject.keys());
        if (projectOrder.length > 0) {
            const orderMap = new Map(projectOrder.map((id, i) => [id, i]));
            orderedProjectIds.sort((a, b) => {
                const aIdx = orderMap.get(a) ?? 999;
                const bIdx = orderMap.get(b) ?? 999;
                return aIdx - bIdx;
            });
        }

        // Group projects by their parent folder for folder-level grouping
        const folderToProjects = new Map<string, string[]>();
        orderedProjectIds.forEach((pid) => {
            const folder = allFolders.find((f) => f.id === pid);
            const parentFolderId = folder?.parent_folder_id || '__none__';
            if (!folderToProjects.has(parentFolderId)) folderToProjects.set(parentFolderId, []);
            folderToProjects.get(parentFolderId)!.push(pid);
        });

        // Apply folder ordering
        let orderedFolderIds = Array.from(folderToProjects.keys());
        if (folderOrder.length > 0) {
            const orderMap = new Map(folderOrder.map((id, i) => [id, i]));
            orderedFolderIds.sort((a, b) => {
                const aIdx = orderMap.get(a) ?? 999;
                const bIdx = orderMap.get(b) ?? 999;
                return aIdx - bIdx;
            });
        }

        const showProjectLabels = orderedProjectIds.length > 1;

        const addTaskAndChildren = (task: PMTask, depth: number, projectName?: string, projectIndex?: number, isFirst?: boolean, folderName?: string, folderIndex?: number, isFirstInFolder?: boolean) => {
            const scheduledChildren = getSubtasks(task.id); // only scheduled
            const allChildren = getAllSubtasks(task.id); // all children
            const hasScheduledChildren = scheduledChildren.length > 0;
            const hasAnyChildren = allChildren.length > 0;
            const isExpanded = expandedTaskIds.has(task.id);
            result.push({
                task,
                depth,
                isExpanded,
                hasChildren: hasScheduledChildren,
                hasAnyChildren,
                isSubtask: depth > 0,
                projectName: showProjectLabels ? projectName : undefined,
                projectIndex: projectIndex,
                isFirstInProject: isFirst,
                folderName,
                folderIndex,
                isFirstInFolder,
            });
            if (isExpanded && hasAnyChildren) {
                // Apply subtask ordering if available
                let orderedChildren = [...allChildren];
                const subtaskOrder = subtaskOrders[task.id];
                if (subtaskOrder && subtaskOrder.length > 0) {
                    const orderMap = new Map(subtaskOrder.map((id, i) => [id, i]));
                    orderedChildren.sort((a, b) => {
                        const aIdx = orderMap.get(a.id) ?? 999;
                        const bIdx = orderMap.get(b.id) ?? 999;
                        return aIdx - bIdx;
                    });
                }
                orderedChildren.forEach((child) => addTaskAndChildren(child, depth + 1, projectName, projectIndex, false, folderName, folderIndex, false));
            }
        };

        let globalPIdx = 0;
        orderedFolderIds.forEach((folderId, fIdx) => {
            const projectIdsInFolder = folderToProjects.get(folderId) || [];
            const folderObj = allFolders.find((f) => f.id === folderId);
            const fName = folderObj?.name || undefined;
            let isFirstRowInFolder = true;

            projectIdsInFolder.forEach((projectId) => {
                const tasks = orderedParentTasks.filter((t) => (t.folder_id || '__none__') === projectId);
                const pName = projectNameMap.get(projectId) || 'Ungrouped';
                tasks.forEach((task, tIdx) => {
                    addTaskAndChildren(task, 0, pName, globalPIdx, tIdx === 0, fName, fIdx, isFirstRowInFolder);
                    isFirstRowInFolder = false;
                });
                globalPIdx++;
            });
        });

        return result;
    }, [orderedParentTasks, getSubtasks, getAllSubtasks, expandedTaskIds, tasksByProject, projectNameMap, projectOrder, folderOrder, allFolders, subtaskOrders]);

    // Update rowOrder when tasks change
    useMemo(() => {
        const parentIds = parentTasks.map((t) => t.id);
        const currentOrder = rowOrder.filter((id) => parentIds.includes(id));
        const newIds = parentIds.filter((id) => !currentOrder.includes(id));
        if (newIds.length > 0) {
            setRowOrder([...currentOrder, ...newIds]);
        }
    }, [parentTasks]);

    // Toggle child expand
    const toggleExpand = useCallback((taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setExpandedTaskIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    }, []);

    // Toggle recurring expansion
    const toggleRecurring = useCallback((taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setExpandedRecurringIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) next.delete(taskId);
            else next.add(taskId);
            return next;
        });
    }, []);

    // Right-click handler for task bar
    const handleBarContextMenu = useCallback((taskId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setColorPickerTaskId(taskId);
        setColorPickerPos({ x: e.clientX, y: e.clientY });
    }, []);

    // Apply bar color
    const applyBarColor = useCallback((taskId: string, color: string | null) => {
        const task = allTasks.find((t) => t.id === taskId);
        if (task) {
            const cf = (task.custom_fields || {}) as PMTaskCustomFields;
            updateTask(taskId, {
                custom_fields: { ...cf, bar_color: color },
            });
        }
        setColorPickerTaskId(null);
    }, [allTasks, updateTask]);

    // Drag reorder handlers
    const handleDragStart = useCallback((taskId: string) => {
        setDraggedRowId(taskId);
    }, []);

    const handleDragOver = useCallback((taskId: string, e: React.DragEvent) => {
        e.preventDefault();
        if (taskId !== draggedRowId) setDragOverRowId(taskId);
    }, [draggedRowId]);

    const handleDrop = useCallback((targetId: string) => {
        if (!draggedRowId || draggedRowId === targetId) {
            setDraggedRowId(null);
            setDragOverRowId(null);
            return;
        }
        // Find the tasks
        const draggedTask = allTasks.find(t => t.id === draggedRowId);
        const targetTask = allTasks.find(t => t.id === targetId);
        if (!draggedTask || !targetTask) {
            setDraggedRowId(null);
            setDragOverRowId(null);
            return;
        }

        // Check if both are siblings (same parent)
        const draggedParent = draggedTask.parent_task_id || null;
        const targetParent = targetTask.parent_task_id || null;

        if (draggedParent === targetParent) {
            if (draggedParent === null) {
                // Both are top-level tasks: use existing rowOrder logic
                const parentIds = orderedParentTasks.map((t) => t.id);
                const fromIdx = parentIds.indexOf(draggedRowId);
                const toIdx = parentIds.indexOf(targetId);
                if (fromIdx >= 0 && toIdx >= 0) {
                    const newOrder = [...parentIds];
                    newOrder.splice(fromIdx, 1);
                    newOrder.splice(toIdx, 0, draggedRowId);
                    setRowOrder(newOrder);
                }
            } else {
                // Both are subtasks of the same parent: use subtaskOrders
                const siblings = allTasks.filter(t => t.parent_task_id === draggedParent);
                const currentOrder = subtaskOrders[draggedParent] || siblings.map(t => t.id);
                const fromIdx = currentOrder.indexOf(draggedRowId);
                const toIdx = currentOrder.indexOf(targetId);
                if (fromIdx >= 0 && toIdx >= 0) {
                    const newOrder = [...currentOrder];
                    newOrder.splice(fromIdx, 1);
                    newOrder.splice(toIdx, 0, draggedRowId);
                    setSubtaskOrders(prev => ({ ...prev, [draggedParent]: newOrder }));
                }
            }
        }
        setDraggedRowId(null);
        setDragOverRowId(null);
    }, [draggedRowId, orderedParentTasks, allTasks, subtaskOrders]);

    const handleDragEnd = useCallback(() => {
        setDraggedRowId(null);
        setDragOverRowId(null);
    }, []);

    // Project-level drag handlers
    const handleProjectDragStart = useCallback((projectId: string) => {
        setDraggedProjectId(projectId);
    }, []);

    const handleProjectDragOver = useCallback((projectId: string, e: React.DragEvent) => {
        e.preventDefault();
        if (projectId !== draggedProjectId) setDragOverProjectId(projectId);
    }, [draggedProjectId]);

    const handleProjectDrop = useCallback((targetProjectId: string) => {
        if (!draggedProjectId || draggedProjectId === targetProjectId) {
            setDraggedProjectId(null);
            setDragOverProjectId(null);
            return;
        }
        // Derive current displayed project order from rows (unique, in display order)
        const displayedProjectIds: string[] = [];
        rows.forEach((r) => {
            const pid = r.task.folder_id || '__none__';
            if (!displayedProjectIds.includes(pid)) displayedProjectIds.push(pid);
        });
        const fromIdx = displayedProjectIds.indexOf(draggedProjectId);
        const toIdx = displayedProjectIds.indexOf(targetProjectId);
        if (fromIdx >= 0 && toIdx >= 0) {
            const newOrder = [...displayedProjectIds];
            newOrder.splice(fromIdx, 1);
            newOrder.splice(toIdx, 0, draggedProjectId);
            setProjectOrder(newOrder);
        }
        setDraggedProjectId(null);
        setDragOverProjectId(null);
    }, [draggedProjectId, rows]);

    const handleProjectDragEnd = useCallback(() => {
        setDraggedProjectId(null);
        setDragOverProjectId(null);
    }, []);

    // Folder-level drag handlers
    const handleFolderDragStart = useCallback((folderId: string) => {
        setDraggedFolderId(folderId);
    }, []);

    const handleFolderDragOver = useCallback((folderId: string, e: React.DragEvent) => {
        e.preventDefault();
        if (folderId !== draggedFolderId) setDragOverFolderId(folderId);
    }, [draggedFolderId]);

    const handleFolderDrop = useCallback((targetFolderId: string) => {
        if (!draggedFolderId || draggedFolderId === targetFolderId) {
            setDraggedFolderId(null);
            setDragOverFolderId(null);
            return;
        }
        // Derive current displayed folder order from rows (unique parent_folder_id, in display order)
        const displayedFolderIds: string[] = [];
        rows.forEach((r) => {
            const folder = allFolders.find((f) => f.id === r.task.folder_id);
            const parentFolderId = folder?.parent_folder_id || '__none__';
            if (!displayedFolderIds.includes(parentFolderId)) displayedFolderIds.push(parentFolderId);
        });
        const fromIdx = displayedFolderIds.indexOf(draggedFolderId);
        const toIdx = displayedFolderIds.indexOf(targetFolderId);
        if (fromIdx >= 0 && toIdx >= 0) {
            const newOrder = [...displayedFolderIds];
            newOrder.splice(fromIdx, 1);
            newOrder.splice(toIdx, 0, draggedFolderId);
            setFolderOrder(newOrder);
        }
        setDraggedFolderId(null);
        setDragOverFolderId(null);
    }, [draggedFolderId, rows, allFolders]);

    const handleFolderDragEnd = useCallback(() => {
        setDraggedFolderId(null);
        setDragOverFolderId(null);
    }, []);

    // Date calculations
    const today = useMemo(() => new Date(), []);
    const startOfView = useMemo(() => {
        const d = new Date(today);
        d.setDate(today.getDate() - today.getDay() + (weekOffset * 7) - 7);
        d.setHours(0, 0, 0, 0);
        return d;
    }, [weekOffset, today]);

    const days = useMemo(() => {
        const arr: Date[] = [];
        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startOfView);
            d.setDate(startOfView.getDate() + i);
            arr.push(d);
        }
        return arr;
    }, [weekOffset, totalDays, startOfView]);

    const getBarPosition = useCallback((task: PMTask) => {
        if (!task.start_date || !task.due_date) return null;
        const start = new Date(task.start_date);
        const end = new Date(task.due_date);
        const viewStartNorm = new Date(startOfView);
        viewStartNorm.setHours(0, 0, 0, 0);
        const vs = viewStartNorm.getTime();
        const msPerDay = 1000 * 60 * 60 * 24;

        // Compute fractional day offset for start (e.g., 12:00 = 0.5 of that day)
        const startMidnight = new Date(start);
        startMidnight.setHours(0, 0, 0, 0);
        const startDayOffset = (startMidnight.getTime() - vs) / msPerDay;
        const startFraction = (start.getHours() * 60 + start.getMinutes()) / (24 * 60);
        const startPos = startDayOffset + startFraction;

        // Compute fractional day offset for end
        const endMidnight = new Date(end);
        endMidnight.setHours(0, 0, 0, 0);
        const endDayOffset = (endMidnight.getTime() - vs) / msPerDay;
        const endFraction = (end.getHours() * 60 + end.getMinutes()) / (24 * 60);
        // If time is 00:00 (default), fill through the end of the due date (offset +1)
        const endPos = (end.getHours() === 0 && end.getMinutes() === 0)
            ? endDayOffset + 1
            : endDayOffset + endFraction;

        if (endPos < 0 || startPos > totalDays) return null;
        const clampedStart = Math.max(0, startPos);
        const clampedEnd = Math.min(totalDays, endPos);
        return {
            left: clampedStart * DAY_WIDTH,
            width: Math.max(DAY_WIDTH * 0.5, (clampedEnd - clampedStart) * DAY_WIDTH),
        };
    }, [startOfView, totalDays, DAY_WIDTH]);

    // Generate recurring ghost bar positions (supports both recurrence modes)
    const getRecurringPositions = useCallback((task: PMTask, recurrenceDays: number, mode: 'start_to_start' | 'end_to_start' = 'end_to_start') => {
        if (!task.start_date || !task.due_date) return [];
        // Normalize to midnight local time
        const start = new Date(task.start_date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(task.due_date);
        end.setHours(0, 0, 0, 0);
        const taskDuration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const viewStartNorm = new Date(startOfView);
        viewStartNorm.setHours(0, 0, 0, 0);
        const vs = viewStartNorm.getTime();
        const msPerDay = 1000 * 60 * 60 * 24;
        const viewEnd = vs + totalDays * msPerDay;
        const positions: { left: number; width: number; label: string }[] = [];

        // Start-to-Start: next occurrence starts recurrenceDays after previous START
        // End-to-Start: next occurrence starts recurrenceDays after previous END
        let occurrenceStart: Date;
        if (mode === 'start_to_start') {
            occurrenceStart = new Date(start);
            occurrenceStart.setDate(occurrenceStart.getDate() + recurrenceDays);
        } else {
            occurrenceStart = new Date(end);
            occurrenceStart.setDate(occurrenceStart.getDate() + recurrenceDays);
        }
        occurrenceStart.setHours(0, 0, 0, 0);

        for (let i = 0; i < 50; i++) {
            const occEnd = new Date(occurrenceStart);
            occEnd.setDate(occEnd.getDate() + taskDuration);
            occEnd.setHours(0, 0, 0, 0);
            if (occurrenceStart.getTime() > viewEnd) break;
            const startOff = Math.round((occurrenceStart.getTime() - vs) / msPerDay);
            const endOff = Math.round((occEnd.getTime() - vs) / msPerDay) + 1;
            if (endOff > 0 && startOff < totalDays) {
                const clampedStart = Math.max(0, startOff);
                const clampedEnd = Math.min(totalDays, endOff);
                positions.push({
                    left: clampedStart * DAY_WIDTH,
                    width: Math.max(DAY_WIDTH * 0.9, (clampedEnd - clampedStart) * DAY_WIDTH),
                    label: `#${i + 2}`,
                });
            }
            if (mode === 'start_to_start') {
                occurrenceStart = new Date(occurrenceStart);
                occurrenceStart.setDate(occurrenceStart.getDate() + recurrenceDays);
            } else {
                occurrenceStart = new Date(occEnd);
                occurrenceStart.setDate(occurrenceStart.getDate() + recurrenceDays);
            }
            occurrenceStart.setHours(0, 0, 0, 0);
        }
        return positions;
    }, [startOfView, totalDays, DAY_WIDTH]);

    const todayIndex = Math.floor((today.getTime() - startOfView.getTime()) / (1000 * 60 * 60 * 24));

    const headerGroups = useMemo(() => {
        const groups: { label: string; span: number }[] = [];
        let currentLabel = '';
        let currentSpan = 0;
        days.forEach((d) => {
            const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
            if (label === currentLabel) {
                currentSpan++;
            } else {
                if (currentLabel) groups.push({ label: currentLabel, span: currentSpan });
                currentLabel = label;
                currentSpan = 1;
            }
        });
        if (currentLabel) groups.push({ label: currentLabel, span: currentSpan });
        return groups;
    }, [days, zoom]);

    const getDuration = (task: PMTask) => {
        if (!task.start_date || !task.due_date) return '';
        const start = new Date(task.start_date);
        const end = new Date(task.due_date);
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 7) return `${Math.floor(diffDays / 7)}w ${diffDays % 7}d`;
        return `${diffDays}d`;
    };

    const dateRangeLabel = useMemo(() => {
        const s = days[0];
        const e = days[days.length - 1];
        if (!s || !e) return '';
        return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }, [days]);

    const totalParentTasks = useMemo(() => {
        let filtered = allTasks.filter((t) => !t.parent_task_id);
        if (visibleProjectIds.length > 0) {
            filtered = filtered.filter((t) => t.folder_id && visibleProjectIds.includes(t.folder_id));
        } else if (activeSpaceId) {
            filtered = filtered.filter((t) => t.space_id === activeSpaceId);
        }
        return filtered.length;
    }, [allTasks, activeSpaceId, visibleProjectIds]);

    // Determine view level and how many drag columns to show
    // Space view: folder + project columns (no task drag)
    // Folder view: project + task columns
    // Project view: task column only
    const viewLevel = useMemo<'space' | 'folder' | 'project'>(() => {
        if (activeProjectId) return 'project';
        if (activeFolderId && isViewingFolder) return 'folder'; // viewing a folder (shows projects inside)
        if (activeFolderId) return 'project'; // viewing a project (shows tasks)
        if (activeSpaceId) return 'space';
        return 'space';
    }, [activeProjectId, activeFolderId, isViewingFolder, activeSpaceId]);

    const multipleProjects = useMemo(() => {
        const projectIds = Array.from(tasksByProject.keys());
        return projectIds.length > 1;
    }, [tasksByProject]);

    // Determine unique folder groups for space view
    const multipleFolders = useMemo(() => {
        if (viewLevel !== 'space') return false;
        const folderIds = new Set<string>();
        rows.forEach((r) => {
            const folder = allFolders.find((f) => f.id === r.task.folder_id);
            const parentFolderId = folder?.parent_folder_id || '__none__';
            folderIds.add(parentFolderId);
        });
        return folderIds.size > 1;
    }, [viewLevel, rows, allFolders]);

    // Width: folder bar (16px) + project bar (16px) + task grip (24px) — shown based on view level
    const DRAG_HANDLE_WIDTH = useMemo(() => {
        if (viewLevel === 'space') {
            // Folder + Project columns, no task grip
            return (multipleFolders ? 16 : 0) + (multipleProjects ? 16 : 0) + (multipleProjects || multipleFolders ? 0 : 24);
        }
        if (viewLevel === 'folder') {
            // Project + Task columns
            return (multipleProjects ? 16 : 0) + 24;
        }
        // Project view: just task grip
        return 24;
    }, [viewLevel, multipleFolders, multipleProjects]);

    return (
        <div className="flex flex-col h-full">
            {/* ── Controls ── */}
            <div
                className="flex items-center gap-3 px-4 py-2.5 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setWeekOffset((w) => w - (zoom === 'month' ? 4 : 1))}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setWeekOffset(0)}
                        className="text-[11px] px-3 py-1 rounded-md text-muted-foreground hover:text-foreground transition-colors font-medium"
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                        Today
                    </button>
                    <button
                        onClick={() => setWeekOffset((w) => w + (zoom === 'month' ? 4 : 1))}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>

                <span className="text-[11px] text-muted-foreground/50 font-mono">
                    {dateRangeLabel}
                </span>

                <div className="w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />

                <div
                    className="flex items-center rounded-lg p-0.5 gap-0.5"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                    {(['day', 'week', 'month'] as ZoomLevel[]).map((z) => (
                        <button
                            key={z}
                            onClick={() => setZoom(z)}
                            className={cn(
                                "text-[11px] px-3 py-1 rounded-md transition-all capitalize font-medium",
                                zoom === z
                                    ? "text-foreground shadow-sm"
                                    : "text-muted-foreground/40 hover:text-muted-foreground/70"
                            )}
                            style={zoom === z ? {
                                background: 'rgba(255,109,41,0.12)',
                                color: '#FF6D29',
                            } : undefined}
                        >
                            {z}
                        </button>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground/40">
                        {parentTasks.length} of {totalParentTasks} tasks scheduled
                    </span>
                </div>
            </div>

            {/* ── Timeline Grid with drag-handle column ── */}
            <div className="flex flex-1 overflow-hidden">
                {/* LEFT: Drag handle column (sticky) - spanning bars */}
                <div
                    className="flex flex-col shrink-0 overflow-hidden"
                    style={{
                        width: DRAG_HANDLE_WIDTH,
                        borderRight: '1px solid rgba(255,255,255,0.04)',
                    }}
                >
                    <div style={{ height: 36 + 28 }} />
                    {/* Use a relative container so we can position spanning bars */}
                    <div className="relative" style={{ height: rows.length * ROW_HEIGHT }}>
                        {/* Folder-level spanning drag bars (space view only) */}
                        {viewLevel === 'space' && multipleFolders && (() => {
                            // Compute folder group spans
                            const folderGroups: { folderId: string; startIdx: number; count: number; fIdx: number; name: string }[] = [];
                            let currentFolderId: string | null = null;
                            let currentStart = 0;
                            let currentCount = 0;
                            let currentFIdx = 0;
                            let currentName = '';
                            rows.forEach((row, idx) => {
                                const folder = allFolders.find((f) => f.id === row.task.folder_id);
                                const parentFolderId = folder?.parent_folder_id || '__none__';
                                if (parentFolderId !== currentFolderId) {
                                    if (currentFolderId !== null) {
                                        folderGroups.push({ folderId: currentFolderId, startIdx: currentStart, count: currentCount, fIdx: currentFIdx, name: currentName });
                                    }
                                    currentFolderId = parentFolderId;
                                    currentStart = idx;
                                    currentCount = 1;
                                    currentFIdx = row.folderIndex ?? 0;
                                    currentName = row.folderName || '';
                                } else {
                                    currentCount++;
                                }
                            });
                            if (currentFolderId !== null) {
                                folderGroups.push({ folderId: currentFolderId, startIdx: currentStart, count: currentCount, fIdx: currentFIdx, name: currentName });
                            }
                            const FOLDER_BAR_COLORS = ['#FF6D29', '#888888'];
                            return folderGroups.map((g) => {
                                const fColor = FOLDER_BAR_COLORS[g.fIdx % FOLDER_BAR_COLORS.length];
                                const isFolderDragging = draggedFolderId === g.folderId;
                                const isFolderDragOver = dragOverFolderId === g.folderId;
                                return (
                                    <div
                                        key={`fg-${g.folderId}`}
                                        className={cn(
                                            "absolute flex items-center justify-center transition-all cursor-grab active:cursor-grabbing",
                                            isFolderDragOver && "ring-1 ring-inset",
                                            isFolderDragging && "opacity-30"
                                        )}
                                        style={{
                                            left: 0,
                                            top: g.startIdx * ROW_HEIGHT,
                                            width: 16,
                                            height: g.count * ROW_HEIGHT,
                                            backgroundColor: `${fColor}18`,
                                            borderRight: `2px solid ${fColor}50`,
                                            ...(isFolderDragOver ? { ringColor: fColor } : {}),
                                        }}
                                        draggable
                                        onDragStart={() => handleFolderDragStart(g.folderId)}
                                        onDragOver={(e) => handleFolderDragOver(g.folderId, e)}
                                        onDrop={() => handleFolderDrop(g.folderId)}
                                        onDragEnd={handleFolderDragEnd}
                                        title={`Drag to reorder ${g.name || 'folder'}`}
                                    >
                                        <GripVertical className="w-2.5 h-2.5" style={{ color: `${fColor}60` }} />
                                    </div>
                                );
                            });
                        })()}

                        {/* Project-level spanning drag bars (space + folder views) */}
                        {(viewLevel === 'space' || viewLevel === 'folder') && multipleProjects && (() => {
                            // Compute project group spans
                            const projectGroups: { projectId: string; startIdx: number; count: number; pIdx: number; name: string }[] = [];
                            let currentProjectId: string | null = null;
                            let currentStart = 0;
                            let currentCount = 0;
                            let currentPIdx = 0;
                            let currentName = '';
                            rows.forEach((row, idx) => {
                                const pid = row.task.folder_id || '__none__';
                                if (pid !== currentProjectId) {
                                    if (currentProjectId !== null) {
                                        projectGroups.push({ projectId: currentProjectId, startIdx: currentStart, count: currentCount, pIdx: currentPIdx, name: currentName });
                                    }
                                    currentProjectId = pid;
                                    currentStart = idx;
                                    currentCount = 1;
                                    currentPIdx = row.projectIndex ?? 0;
                                    currentName = row.projectName || '';
                                } else {
                                    currentCount++;
                                }
                            });
                            if (currentProjectId !== null) {
                                projectGroups.push({ projectId: currentProjectId, startIdx: currentStart, count: currentCount, pIdx: currentPIdx, name: currentName });
                            }
                            // Offset left: if folder bars are shown, shift right by 16px
                            const projectBarLeft = (viewLevel === 'space' && multipleFolders) ? 16 : 0;
                            return projectGroups.map((g) => {
                                const pColor = PROJECT_BAR_COLORS[g.pIdx % PROJECT_BAR_COLORS.length];
                                const isProjectDragging = draggedProjectId === g.projectId;
                                const isProjectDragOver = dragOverProjectId === g.projectId;
                                return (
                                    <div
                                        key={`pg-${g.projectId}`}
                                        className={cn(
                                            "absolute flex items-center justify-center transition-all cursor-grab active:cursor-grabbing",
                                            isProjectDragOver && "ring-1 ring-inset",
                                            isProjectDragging && "opacity-30"
                                        )}
                                        style={{
                                            left: projectBarLeft,
                                            top: g.startIdx * ROW_HEIGHT,
                                            width: 16,
                                            height: g.count * ROW_HEIGHT,
                                            backgroundColor: `${pColor}18`,
                                            borderRight: `2px solid ${pColor}50`,
                                            ...(isProjectDragOver ? { ringColor: pColor } : {}),
                                        }}
                                        draggable
                                        onDragStart={() => handleProjectDragStart(g.projectId)}
                                        onDragOver={(e) => handleProjectDragOver(g.projectId, e)}
                                        onDrop={() => handleProjectDrop(g.projectId)}
                                        onDragEnd={handleProjectDragEnd}
                                        title={`Drag to reorder ${g.name || 'project'}`}
                                    >
                                        <GripVertical className="w-2.5 h-2.5" style={{ color: `${pColor}60` }} />
                                    </div>
                                );
                            });
                        })()}

                        {/* Task-level drag grips (folder + project views only, NOT space view) */}
                        {viewLevel !== 'space' && rows.map((row, idx) => {
                            const taskGripLeft = (viewLevel === 'folder' && multipleProjects) ? 16 : 0;
                            const taskGripWidth = DRAG_HANDLE_WIDTH - taskGripLeft;
                            // Allow dragging both top-level tasks AND subtasks (for reordering within parent)
                            const canDrag = true;
                            return (
                                <div
                                    key={row.task.id}
                                    className={cn(
                                        "absolute flex items-center justify-center transition-colors",
                                        canDrag && "cursor-grab active:cursor-grabbing",
                                        dragOverRowId === row.task.id && "bg-accent-base/10",
                                        draggedRowId === row.task.id && "opacity-40"
                                    )}
                                    style={{
                                        left: taskGripLeft,
                                        top: idx * ROW_HEIGHT,
                                        width: taskGripWidth,
                                        height: ROW_HEIGHT,
                                    }}
                                    draggable={canDrag}
                                    onDragStart={() => canDrag && handleDragStart(row.task.id)}
                                    onDragOver={(e) => canDrag && handleDragOver(row.task.id, e)}
                                    onDrop={() => canDrag && handleDrop(row.task.id)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <GripVertical
                                        className="w-3 h-3 transition-colors"
                                        style={{
                                            color: canDrag
                                                ? 'rgba(255,255,255,0.12)'
                                                : 'rgba(255,255,255,0.06)',
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT: Scrollable timeline area */}
                <div ref={(el) => { (containerRef as any).current = el; (scrollRef as any).current = el; }} className="flex-1 overflow-auto" style={{ isolation: 'isolate' }}>
                    <div style={{ minWidth: totalDays * DAY_WIDTH, minHeight: '100%' }}>
                        {/* Month header row - sticky */}
                        <div
                            className="flex"
                            style={{ height: 36, borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'sticky', top: 0, zIndex: 30, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)' }}
                        >
                            {headerGroups.map((g, i) => (
                                <div
                                    key={i}
                                    className="text-[11px] font-semibold uppercase tracking-wider"
                                    style={{
                                        width: g.span * DAY_WIDTH,
                                        borderRight: '1px solid rgba(255,255,255,0.04)',
                                        position: 'relative',
                                    }}
                                >
                                    <div
                                        className="flex items-center h-full"
                                        style={{
                                            position: 'sticky',
                                            left: 0,
                                            width: 'fit-content',
                                            paddingLeft: 12,
                                            paddingRight: 12,
                                            color: 'rgba(255,109,41,0.55)',
                                            zIndex: 31,
                                        }}
                                    >
                                        {g.label}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Day number row - sticky below month header */}
                        <div
                            className="flex"
                            style={{ height: 28, borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 36, zIndex: 29, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(12px)' }}
                        >
                            {days.map((d, i) => {
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                const isToday = d.toDateString() === today.toDateString();
                                const isFirstOfMonth = d.getDate() === 1;
                                const isMonday = d.getDay() === 1;

                                // Month view: only show 1st, 15th, and last day of month
                                const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                                const dayNum = d.getDate();
                                let showLabel = true;
                                if (zoom === 'month') {
                                    showLabel = dayNum === 1 || dayNum === 15 || dayNum === lastDayOfMonth;
                                }

                                const showSep = zoom === 'month'
                                    ? isFirstOfMonth
                                    : zoom === 'week'
                                        ? (isFirstOfMonth || isMonday)
                                        : false;

                                return (
                                    <div
                                        key={i}
                                        className="flex items-end justify-center pb-1 relative"
                                        style={{
                                            width: DAY_WIDTH,
                                            borderRight: '1px solid rgba(255,255,255,0.02)',
                                            background: isToday
                                                ? 'rgba(255,109,41,0.08)'
                                                : isWeekend
                                                    ? 'rgba(255,255,255,0.015)'
                                                    : 'transparent',
                                            borderLeft: showSep
                                                ? `1px solid ${isFirstOfMonth ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`
                                                : 'none',
                                        }}
                                    >
                                        {showLabel && (
                                            <span
                                                className="text-[10px] tabular-nums font-medium"
                                                style={{
                                                    color: isToday ? '#FF6D29' : 'rgba(255,255,255,0.2)',
                                                    fontWeight: isToday ? 700 : 500,
                                                }}
                                            >
                                                {dayNum}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Today line + Task rows */}
                        <div className="relative">
                            {todayIndex >= 0 && todayIndex < totalDays && (
                                <div
                                    className="absolute z-10"
                                    style={{
                                        left: todayIndex * DAY_WIDTH + DAY_WIDTH / 2,
                                        top: 0,
                                        bottom: 0,
                                        width: 2,
                                        background: 'linear-gradient(to bottom, rgba(255,109,41,0.6) 0%, rgba(255,109,41,0.4) 100%)',
                                        borderRadius: 1,
                                    }}
                                >
                                    <div
                                        className="absolute left-1/2 -translate-x-1/2"
                                        style={{
                                            top: -5, width: 10, height: 10, borderRadius: '50%',
                                            backgroundColor: '#FF6D29',
                                            boxShadow: '0 0 8px rgba(255,109,41,0.5), 0 0 2px rgba(255,109,41,0.8)',
                                        }}
                                    />
                                </div>
                            )}

                            {rows.map((row) => {
                                const { task, depth, isSubtask, hasChildren, hasAnyChildren, isExpanded, projectName, projectIndex, isFirstInProject } = row;
                                const pos = getBarPosition(task);
                                const isSelected = selectedTaskId === task.id;
                                const isHovered = hoveredTaskId === task.id;
                                const isOverdue = task.due_date && task.status !== 'DONE' && new Date(task.due_date) < new Date();
                                const taskCf = (task.custom_fields || {}) as PMTaskCustomFields;
                                const isRecurring = taskCf.recurrence_days && taskCf.recurrence_days > 0;
                                const isRecurringExpanded = expandedRecurringIds.has(task.id);
                                const customColor = taskCf.bar_color;

                                // Bar colors (custom or default)
                                const barColor = PARENT_BAR_COLOR;
                                const barBg = customColor || (isSubtask ? CHILD_BAR_BG : PARENT_BAR_BG);
                                const barBorder = customColor
                                    ? `${customColor}99`
                                    : (isSubtask ? CHILD_BAR_BORDER : PARENT_BAR_BORDER);
                                const barGlow = customColor
                                    ? `0 0 12px ${customColor}40`
                                    : (isSubtask ? CHILD_BAR_GLOW : PARENT_BAR_GLOW);

                                const rowH = ROW_HEIGHT;
                                const barHeight = 28;
                                const barTop = (rowH - barHeight) / 2;

                                // Ghost bar for children extent
                                let ghostPos: { left: number; width: number } | null = null;
                                if (hasChildren && pos) {
                                    const extent = getDescendantExtent(task.id);
                                    if (extent) {
                                        const parentEnd = new Date(task.due_date!);
                                        parentEnd.setHours(0, 0, 0, 0);
                                        const parentStart = new Date(task.start_date!);
                                        parentStart.setHours(0, 0, 0, 0);
                                        const eEarliest = new Date(extent.earliest);
                                        eEarliest.setHours(0, 0, 0, 0);
                                        const eLatest = new Date(extent.latest);
                                        eLatest.setHours(0, 0, 0, 0);
                                        const overallStart = eEarliest < parentStart ? eEarliest : parentStart;
                                        const overallEnd = eLatest > parentEnd ? eLatest : parentEnd;
                                        if (overallEnd > parentEnd || overallStart < parentStart) {
                                            const viewStartNorm = new Date(startOfView);
                                            viewStartNorm.setHours(0, 0, 0, 0);
                                            const vs = viewStartNorm.getTime();
                                            const msPerDay = 1000 * 60 * 60 * 24;
                                            const gStartOff = Math.max(0, Math.round((overallStart.getTime() - vs) / msPerDay));
                                            const gEndOff = Math.min(totalDays, Math.round((overallEnd.getTime() - vs) / msPerDay) + 1);
                                            if (gEndOff > 0 && gStartOff < totalDays) {
                                                ghostPos = {
                                                    left: gStartOff * DAY_WIDTH,
                                                    width: Math.max(DAY_WIDTH, (gEndOff - gStartOff) * DAY_WIDTH),
                                                };
                                            }
                                        }
                                    }
                                }

                                const recurringPositions = isRecurring && isRecurringExpanded
                                    ? getRecurringPositions(task, taskCf.recurrence_days!, taskCf.recurrence_mode || 'end_to_start')
                                    : [];

                                // Subtle row tint for project grouping
                                const projectTint = projectName && projectIndex !== undefined
                                    ? PROJECT_ROW_TINTS[projectIndex % PROJECT_ROW_TINTS.length]
                                    : undefined;

                                // Project separator color (matches left drag bar)
                                const pBarColor = projectIndex !== undefined
                                    ? PROJECT_BAR_COLORS[projectIndex % PROJECT_BAR_COLORS.length]
                                    : '#FF6D29';

                                return (
                                    <div
                                        key={task.id}
                                        className="relative transition-colors"
                                        style={{
                                            height: rowH,
                                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                                            borderTop: isFirstInProject && projectName
                                                ? `2px solid ${pBarColor}40`
                                                : undefined,
                                            background: isSelected
                                                ? 'rgba(255,109,41,0.04)'
                                                : dragOverRowId === task.id
                                                    ? 'rgba(255,109,41,0.06)'
                                                    : isHovered
                                                        ? 'rgba(255,255,255,0.02)'
                                                        : projectTint || 'transparent',
                                        }}
                                        onMouseEnter={() => setHoveredTaskId(task.id)}
                                        onMouseLeave={() => setHoveredTaskId(null)}
                                    >
                                        {/* Project label on the first row of each group (sticky) */}
                                        {isFirstInProject && projectName && (
                                            <div
                                                className="z-20 flex items-center"
                                                style={{
                                                    position: 'sticky',
                                                    left: 0,
                                                    top: 2,
                                                    width: 'fit-content',
                                                    paddingLeft: 6,
                                                    paddingRight: 8,
                                                    fontSize: 8,
                                                    fontWeight: 700,
                                                    color: `${pBarColor}80`,
                                                    letterSpacing: '0.06em',
                                                    textTransform: 'uppercase',
                                                    background: 'linear-gradient(90deg, rgba(20,16,12,0.95) 70%, transparent 100%)',
                                                    pointerEvents: 'none',
                                                }}
                                            >
                                                {projectName}
                                            </div>
                                        )}

                                        {/* Weekend shading + separator lines */}
                                        {days.map((d, i) => {
                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                            const isFirstOfMonth = d.getDate() === 1;
                                            const isMonday = d.getDay() === 1;
                                            const showSep = zoom === 'month'
                                                ? isFirstOfMonth
                                                : zoom === 'week'
                                                    ? (isFirstOfMonth || isMonday)
                                                    : false;
                                            return (
                                                <div key={i}>
                                                    {isWeekend && (
                                                        <div className="absolute top-0 bottom-0" style={{ left: i * DAY_WIDTH, width: DAY_WIDTH, background: 'rgba(255,255,255,0.012)' }} />
                                                    )}
                                                    {showSep && (
                                                        <div className="absolute top-0 bottom-0" style={{ left: i * DAY_WIDTH, width: 1, background: isFirstOfMonth ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)' }} />
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* Ghost shadow bar */}
                                        {ghostPos && (
                                            <div className="absolute" style={{
                                                left: ghostPos.left, width: ghostPos.width, top: barTop + 2, height: barHeight - 4,
                                                backgroundColor: GHOST_BAR_BG, border: `1px dashed ${GHOST_BAR_BORDER}`,
                                                borderRadius: 'var(--radius-sm)', zIndex: 0,
                                            }} />
                                        )}

                                        {/* Recurring ghost bars (inherit custom color) */}
                                        {recurringPositions.map((rp, rIdx) => (
                                            <div
                                                key={`r-${rIdx}`}
                                                className="absolute"
                                                style={{
                                                    left: rp.left, width: rp.width, top: barTop + 1, height: barHeight - 2,
                                                    backgroundColor: customColor ? `${customColor}20` : RECURRING_GHOST_BG,
                                                    border: `1px dashed ${customColor ? `${customColor}40` : RECURRING_GHOST_BORDER}`,
                                                    borderRadius: 'var(--radius-sm)', zIndex: 1,
                                                }}
                                            >
                                                <span className="absolute inset-0 flex items-center truncate" style={{ paddingLeft: 6, paddingRight: 4 }}>
                                                    <span className="truncate leading-none" style={{ fontSize: 9, fontWeight: 500, color: customColor ? `${customColor}99` : 'rgba(255,109,41,0.6)', letterSpacing: '0.01em' }}>
                                                        {rp.width > 40 ? task.title : rp.label}
                                                    </span>
                                                </span>
                                            </div>
                                        ))}

                                        {/* Task bar */}
                                        {pos && (
                                            <div
                                                onClick={() => setSelectedTask(task.id)}
                                                onContextMenu={(e) => handleBarContextMenu(task.id, e)}
                                                className="absolute cursor-pointer transition-all group/bar"
                                                style={{
                                                    left: pos.left, width: pos.width, top: barTop, height: barHeight,
                                                    backgroundColor: barBg, border: `1px solid ${barBorder}`,
                                                    borderRadius: 'var(--radius-sm)',
                                                    boxShadow: isHovered || isSelected ? barGlow : 'none',
                                                    transform: isHovered ? 'scaleY(1.06)' : 'scaleY(1)',
                                                    zIndex: isHovered ? 35 : 2,
                                                }}
                                            >
                                                {/* Progress fill */}
                                                <div className="absolute inset-y-0 left-0 transition-all" style={{
                                                    width: `${Math.min(100, task.progress)}%`,
                                                    backgroundColor: barColor, opacity: 0.25,
                                                    borderRadius: task.progress >= 100 ? 'var(--radius-sm)' : 'var(--radius-sm) 0 0 var(--radius-sm)',
                                                }} />

                                                {/* Chevron + label */}
                                                <span className="absolute inset-0 flex items-center truncate z-10" style={{ paddingLeft: 8, paddingRight: 6 }}>
                                                    {hasAnyChildren && (
                                                        <button onClick={(e) => toggleExpand(task.id, e)} className="flex items-center justify-center shrink-0 transition-colors mr-0.5" style={{ color: barColor }}>
                                                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}
                                                    {pos.width > 50 && (
                                                        <span className="truncate leading-none" style={{ fontSize: 10.5, fontWeight: 500, color: barColor, letterSpacing: '0.01em' }}>
                                                            {task.title}
                                                        </span>
                                                    )}
                                                </span>

                                                {/* Overdue indicator */}
                                                {isOverdue && (
                                                    <div className="absolute" style={{ right: -4, top: -4, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }} />
                                                )}

                                                {/* Recurring indicator (toggle) */}
                                                {isRecurring && (
                                                    <button
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onClick={(e) => toggleRecurring(task.id, e)}
                                                        className="absolute flex items-center justify-center transition-transform hover:scale-110"
                                                        style={{
                                                            right: isOverdue ? 8 : -4, bottom: -4,
                                                            width: 14, height: 14, borderRadius: '50%',
                                                            backgroundColor: '#FF6D29',
                                                            boxShadow: isRecurringExpanded ? '0 0 8px rgba(255,109,41,0.6)' : '0 0 6px rgba(255,109,41,0.4)',
                                                            border: isRecurringExpanded ? '1.5px solid rgba(255,255,255,0.3)' : 'none',
                                                        }}
                                                        title={isRecurringExpanded ? 'Hide recurring instances' : 'Show recurring instances'}
                                                    >
                                                        <Repeat style={{ width: 8, height: 8, color: '#0A0908' }} />
                                                    </button>
                                                )}

                                                {/* Hover tooltip */}
                                                {isHovered && (
                                                    <div className="absolute z-50 pointer-events-none" style={{ bottom: barHeight + 6, left: 0, whiteSpace: 'nowrap' }}>
                                                        <div className="px-2.5 py-1.5 rounded-md text-[10px] flex flex-col gap-0.5" style={{ background: 'rgba(20,16,12,0.95)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                                                            <span className="font-medium text-foreground/90">{task.title}</span>
                                                            <span className="text-muted-foreground/50">
                                                                {task.start_date && new Date(task.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                {' → '}
                                                                {task.due_date && new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                                {' · '}{getDuration(task)}
                                                                {' · '}{task.progress}%
                                                                {isRecurring && <>{' · '}↻ Every {taskCf.recurrence_days}d</>}
                                                            </span>
                                                            {projectName && (
                                                                <span className="text-muted-foreground/30">
                                                                    {projectName}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── Dependency Connector Dots (bidirectional) ── */}
                                                {pos && (
                                                    <>
                                                {/* Left connector (both drag source & drop target) */}
                                                        <div
                                                            data-dep-target={task.id}
                                                            data-dep-side="left"
                                                            className={cn(
                                                                "absolute transition-opacity z-20 cursor-crosshair",
                                                                drawingDep?.snappedTaskId === task.id && drawingDep?.snappedSide === 'left'
                                                                    ? 'opacity-100'
                                                                    : drawingDep
                                                                        ? 'opacity-60'
                                                                        : 'opacity-0 group-hover/bar:opacity-100'
                                                            )}
                                                            style={{
                                                                left: -5, top: '50%', transform: 'translateY(-50%)',
                                                                width: 10, height: 10, borderRadius: '50%',
                                                                backgroundColor: drawingDep?.snappedTaskId === task.id && drawingDep?.snappedSide === 'left'
                                                                    ? '#FF6D29'
                                                                    : drawingDep ? 'rgba(255,109,41,0.8)' : 'rgba(255,109,41,0.5)',
                                                                border: drawingDep?.snappedTaskId === task.id && drawingDep?.snappedSide === 'left'
                                                                    ? '2px solid rgba(255,255,255,0.8)'
                                                                    : '2px solid rgba(255,255,255,0.4)',
                                                                boxShadow: drawingDep?.snappedTaskId === task.id && drawingDep?.snappedSide === 'left'
                                                                    ? '0 0 12px rgba(255,109,41,0.8)'
                                                                    : drawingDep ? '0 0 8px rgba(255,109,41,0.6)' : 'none',
                                                            }}
                                                            onMouseDown={(e) => handleConnectorMouseDown(task.id, 'left', e)}
                                                            title="Drag to create dependency (as successor)"
                                                        />
                                                        {/* Right connector (both drag source & drop target) */}
                                                        <div
                                                            data-dep-target={task.id}
                                                            data-dep-side="right"
                                                            className={cn(
                                                                "absolute transition-opacity z-20 cursor-crosshair",
                                                                drawingDep?.snappedTaskId === task.id && drawingDep?.snappedSide === 'right'
                                                                    ? 'opacity-100'
                                                                    : drawingDep
                                                                        ? 'opacity-60'
                                                                        : 'opacity-0 group-hover/bar:opacity-100'
                                                            )}
                                                            style={{
                                                                right: -5, top: '50%', transform: 'translateY(-50%)',
                                                                width: 10, height: 10, borderRadius: '50%',
                                                                backgroundColor: drawingDep?.snappedTaskId === task.id && drawingDep?.snappedSide === 'right'
                                                                    ? '#FF6D29'
                                                                    : drawingDep ? 'rgba(255,109,41,0.8)' : 'rgba(255,109,41,0.5)',
                                                                border: drawingDep?.snappedTaskId === task.id && drawingDep?.snappedSide === 'right'
                                                                    ? '2px solid rgba(255,255,255,0.8)'
                                                                    : '2px solid rgba(255,255,255,0.4)',
                                                                boxShadow: drawingDep?.snappedTaskId === task.id && drawingDep?.snappedSide === 'right'
                                                                    ? '0 0 12px rgba(255,109,41,0.8)'
                                                                    : drawingDep ? '0 0 8px rgba(255,109,41,0.6)' : 'none',
                                                            }}
                                                            onMouseDown={(e) => handleConnectorMouseDown(task.id, 'right', e)}
                                                            title="Drag to create dependency (as predecessor)"
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {rows.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-20 gap-3">
                                    <Calendar className="w-8 h-8 text-muted-foreground/10" />
                                    <span className="text-[12px] text-muted-foreground/20">
                                        Add start and due dates to tasks to see them on the timeline.
                                    </span>
                                </div>
                            )}

                        {/* ── SVG Dependency Arrows Overlay ── */}
                        <svg
                            className="absolute inset-0 pointer-events-none z-[6]"
                            style={{ width: totalDays * DAY_WIDTH, height: rows.length * ROW_HEIGHT, overflow: 'visible' }}
                        >
                            <defs>
                                <marker id="dep-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                                    <path d="M0,0 L8,3 L0,6 Z" fill="rgba(255,109,41,0.7)" />
                                </marker>
                                <marker id="dep-arrow-hover" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                                    <path d="M0,0 L8,3 L0,6 Z" fill="#FF6D29" />
                                </marker>
                            </defs>
                            {dependencies.map((dep) => {
                                const predIdx = rows.findIndex(r => r.task.id === dep.predecessor_id);
                                const succIdx = rows.findIndex(r => r.task.id === dep.successor_id);
                                if (predIdx === -1 || succIdx === -1) return null;
                                const predTask = rows[predIdx].task;
                                const succTask = rows[succIdx].task;
                                const predPos = getBarPosition(predTask);
                                const succPos = getBarPosition(succTask);
                                if (!predPos || !succPos) return null;

                                const barH = 28;
                                const startX = predPos.left + predPos.width;
                                const startY = predIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                                const endX = succPos.left;
                                const endY = succIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                                // Curved path
                                const midX = (startX + endX) / 2;
                                const dx = Math.abs(endX - startX);
                                const cpOffset = Math.max(20, dx * 0.3);
                                const path = `M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX - cpOffset} ${endY}, ${endX} ${endY}`;

                                const isHover = hoveredDepId === dep.id;

                                return (
                                    <g key={dep.id}>
                                        {/* Invisible fat hit area */}
                                        <path
                                            d={path}
                                            fill="none"
                                            stroke="transparent"
                                            strokeWidth={12}
                                            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                                            onMouseEnter={() => setHoveredDepId(dep.id)}
                                            onMouseLeave={() => setHoveredDepId(null)}
                                            onClick={() => storeRemoveDependency(dep.id)}
                                        />
                                        {/* Visible path */}
                                        <path
                                            d={path}
                                            fill="none"
                                            stroke={isHover ? '#FF6D29' : 'rgba(255,109,41,0.4)'}
                                            strokeWidth={isHover ? 2.5 : 1.5}
                                            strokeDasharray={isHover ? 'none' : '4 3'}
                                            markerEnd={isHover ? 'url(#dep-arrow-hover)' : 'url(#dep-arrow)'}
                                            style={{ transition: 'stroke 0.15s, stroke-width 0.15s' }}
                                        />
                                        {/* Delete hint on hover */}
                                        {isHover && (
                                            <foreignObject
                                                x={(startX + endX) / 2 - 10}
                                                y={(startY + endY) / 2 - 10}
                                                width={20}
                                                height={20}
                                                style={{ pointerEvents: 'all', cursor: 'pointer' }}
                                                onClick={() => storeRemoveDependency(dep.id)}
                                            >
                                                <div style={{
                                                    width: 20, height: 20, borderRadius: '50%',
                                                    backgroundColor: 'rgba(239,68,68,0.9)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                                                }}>
                                                    <Trash2 style={{ width: 10, height: 10, color: '#fff' }} />
                                                </div>
                                            </foreignObject>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Drawing-in-progress line */}
                            {drawingDep && (() => {
                                const fromIdx = rows.findIndex(r => r.task.id === drawingDep.fromTaskId);
                                if (fromIdx === -1) return null;
                                const fromTask = rows[fromIdx].task;
                                const fromPos = getBarPosition(fromTask);
                                if (!fromPos) return null;
                                // Start from right or left side of bar based on fromSide
                                const startX = drawingDep.fromSide === 'right'
                                    ? fromPos.left + fromPos.width
                                    : fromPos.left;
                                const startY = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                                // Use snapped position if available, otherwise raw mouse
                                const endX = drawingDep.snappedX !== undefined ? drawingDep.snappedX : drawingDep.mouseX;
                                const endY = drawingDep.snappedY !== undefined ? (drawingDep.snappedY - 64) : (drawingDep.mouseY - 64);
                                const cpOffset = Math.max(20, Math.abs(endX - startX) * 0.3);
                                const path = `M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX - cpOffset} ${endY}, ${endX} ${endY}`;
                                const isSnapped = drawingDep.snappedTaskId !== undefined;
                                return (
                                    <>
                                        <path
                                            d={path}
                                            fill="none"
                                            stroke={isSnapped ? 'rgba(255,109,41,0.9)' : 'rgba(255,109,41,0.6)'}
                                            strokeWidth={isSnapped ? 2.5 : 2}
                                            strokeDasharray={isSnapped ? 'none' : '6 4'}
                                            markerEnd="url(#dep-arrow)"
                                        />
                                        {/* Snap indicator circle at endpoint */}
                                        {isSnapped && (
                                            <circle
                                                cx={endX}
                                                cy={endY}
                                                r={6}
                                                fill="rgba(255,109,41,0.3)"
                                                stroke="#FF6D29"
                                                strokeWidth={2}
                                            />
                                        )}
                                    </>
                                );
                            })()}
                        </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Color Picker Popover (right-click context menu) ── */}
            {colorPickerTaskId && (
                <div
                    ref={colorPickerRef}
                    className="fixed z-[9999] rounded-lg shadow-xl"
                    style={{
                        left: colorPickerPos.x,
                        top: colorPickerPos.y,
                        background: 'rgba(20,16,12,0.97)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }}
                >
                    <div className="px-2.5 py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Bar Color</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5 p-2.5">
                        {BAR_COLOR_PALETTE.map((c) => {
                            const taskCf = (allTasks.find(t => t.id === colorPickerTaskId)?.custom_fields || {}) as PMTaskCustomFields;
                            const isActive = c.bg === null
                                ? !taskCf.bar_color
                                : taskCf.bar_color === c.bg;
                            return (
                                <button
                                    key={c.label}
                                    onClick={() => applyBarColor(colorPickerTaskId!, c.bg)}
                                    className="relative w-7 h-7 rounded-md transition-transform hover:scale-110 flex items-center justify-center"
                                    style={{
                                        backgroundColor: c.bg || '#FF6D29',
                                        border: isActive
                                            ? '2px solid rgba(255,255,255,0.6)'
                                            : '1px solid rgba(255,255,255,0.1)',
                                        boxShadow: isActive ? `0 0 8px ${c.bg || '#FF6D29'}60` : 'none',
                                    }}
                                    title={c.label}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
