"use client";

import { usePMStore } from "@/store/usePMStore";
import type { PMTask } from "@/lib/pm/types";
import { cn } from "@/lib/utils";
import {
    ChevronLeft, ChevronRight,
    ChevronDown, ChevronRight as ChevronRightIcon,
    Calendar,
} from "lucide-react";
import { useMemo, useState, useRef, useCallback } from "react";

const ROW_HEIGHT = 42;

// Orange pill colors (solid, like the New Task button)
const PARENT_BAR_COLOR = '#0A0908';
const PARENT_BAR_BG = '#FF6D29';
const PARENT_BAR_BORDER = 'rgba(255,130,71,0.6)';
const PARENT_BAR_GLOW = '0 0 12px rgba(255,109,41,0.25)';

// Slightly muted orange for children (solid)
const CHILD_BAR_COLOR = '#0A0908';
const CHILD_BAR_BG = '#D4874A';
const CHILD_BAR_BORDER = 'rgba(212,135,74,0.5)';
const CHILD_BAR_GLOW = '0 0 8px rgba(212,135,74,0.2)';

// Ghost bar (transparent shadow indicator for children extending past parent)
const GHOST_BAR_BG = 'rgba(255,109,41,0.06)';
const GHOST_BAR_BORDER = 'rgba(255,109,41,0.10)';

type ZoomLevel = 'day' | 'week' | 'month';
const ZOOM_DAY_WIDTHS: Record<ZoomLevel, number> = { day: 48, week: 28, month: 8 };
const ZOOM_TOTAL_DAYS: Record<ZoomLevel, number> = { day: 30, week: 63, month: 210 };

interface TimelineRow {
    task: PMTask;
    depth: number;
    isExpanded: boolean;
    hasChildren: boolean;
    isSubtask: boolean;
}

export function ProjectTimeline() {
    const allTasks = usePMStore((s) => s.tasks);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);
    const activeProjectId = usePMStore((s) => s.activeProjectId);
    const agents = usePMStore((s) => s.agents);
    const setSelectedTask = usePMStore((s) => s.setSelectedTask);
    const selectedTaskId = usePMStore((s) => s.selectedTaskId);

    const [weekOffset, setWeekOffset] = useState(0);
    const [zoom, setZoom] = useState<ZoomLevel>('week');
    const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
    const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    const DAY_WIDTH = ZOOM_DAY_WIDTHS[zoom];
    const totalDays = ZOOM_TOTAL_DAYS[zoom];

    // Get parent tasks filtered by space/folder/project (only scheduled ones)
    const parentTasks = useMemo(() => {
        let filtered = allTasks.filter((t) => !t.parent_task_id);
        if (activeProjectId) {
            filtered = filtered.filter((t) => t.folder_id === activeProjectId);
        } else if (activeFolderId) {
            filtered = filtered.filter((t) => t.folder_id === activeFolderId);
        } else if (activeSpaceId) {
            filtered = filtered.filter((t) => t.space_id === activeSpaceId);
        }
        // Only show tasks that have dates
        return filtered.filter((t) => t.start_date && t.due_date);
    }, [allTasks, activeSpaceId, activeFolderId, activeProjectId]);

    // Get direct scheduled subtasks of a parent
    const getSubtasks = useCallback((parentId: string) => {
        return allTasks.filter((t) => t.parent_task_id === parentId && t.start_date && t.due_date);
    }, [allTasks]);

    // Check if a task has any scheduled children
    const hasScheduledChildren = useCallback((taskId: string) => {
        return allTasks.some((t) => t.parent_task_id === taskId && t.start_date && t.due_date);
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
            // Recurse into grandchildren
            const grandExtent = getDescendantExtent(c.id);
            if (grandExtent) {
                if (grandExtent.earliest < earliest) earliest = grandExtent.earliest;
                if (grandExtent.latest > latest) latest = grandExtent.latest;
            }
        });
        return { earliest, latest };
    }, [allTasks]);

    // Build flat row list with recursive expansion (unlimited depth)
    const rows: TimelineRow[] = useMemo(() => {
        const result: TimelineRow[] = [];

        const addTaskAndChildren = (task: PMTask, depth: number) => {
            const children = getSubtasks(task.id);
            const taskHasChildren = children.length > 0;
            const isExpanded = expandedTaskIds.has(task.id);
            result.push({
                task,
                depth,
                isExpanded,
                hasChildren: taskHasChildren,
                isSubtask: depth > 0,
            });
            if (isExpanded && taskHasChildren) {
                children.forEach((child) => addTaskAndChildren(child, depth + 1));
            }
        };

        parentTasks.forEach((task) => addTaskAndChildren(task, 0));
        return result;
    }, [parentTasks, getSubtasks, expandedTaskIds]);

    // Toggle expand
    const toggleExpand = useCallback((taskId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedTaskIds((prev) => {
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            return next;
        });
    }, []);

    // Calculate date range
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
        const viewStart = startOfView.getTime();

        const startOffset = Math.max(0, (start.getTime() - viewStart) / (1000 * 60 * 60 * 24));
        const endOffset = Math.min(totalDays, (end.getTime() - viewStart) / (1000 * 60 * 60 * 24) + 1);

        if (endOffset < 0 || startOffset > totalDays) return null;

        return {
            left: startOffset * DAY_WIDTH,
            width: Math.max(DAY_WIDTH * 0.9, (endOffset - startOffset) * DAY_WIDTH),
        };
    }, [startOfView, totalDays, DAY_WIDTH]);

    const todayIndex = Math.floor((today.getTime() - startOfView.getTime()) / (1000 * 60 * 60 * 24));

    // Group days by month for headers
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

    // Duration display
    const getDuration = (task: PMTask) => {
        if (!task.start_date || !task.due_date) return '';
        const start = new Date(task.start_date);
        const end = new Date(task.due_date);
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 7) return `${Math.floor(diffDays / 7)}w ${diffDays % 7}d`;
        return `${diffDays}d`;
    };

    // Date range display
    const dateRangeLabel = useMemo(() => {
        const s = days[0];
        const e = days[days.length - 1];
        if (!s || !e) return '';
        return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }, [days]);

    // Count all scheduled tasks (parents only for the count)
    const totalParentTasks = useMemo(() => {
        let filtered = allTasks.filter((t) => !t.parent_task_id);
        if (activeFolderId) {
            filtered = filtered.filter((t) => t.folder_id === activeFolderId);
        } else if (activeSpaceId) {
            filtered = filtered.filter((t) => t.space_id === activeSpaceId);
        }
        return filtered.length;
    }, [allTasks, activeSpaceId, activeFolderId]);

    return (
        <div className="flex flex-col h-full">
            {/* ── Controls ── */}
            <div
                className="flex items-center gap-3 px-4 py-2.5 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
                {/* Navigation */}
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

                {/* Zoom */}
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

            {/* ── Timeline Grid (full width, no left sidebar) ── */}
            <div ref={containerRef} className="flex-1 overflow-auto">
                <div style={{ minWidth: totalDays * DAY_WIDTH, minHeight: '100%' }}>
                    {/* Month header row */}
                    <div
                        className="flex"
                        style={{
                            height: 36,
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}
                    >
                        {headerGroups.map((g, i) => (
                            <div
                                key={i}
                                className="flex items-center text-[11px] font-semibold uppercase tracking-wider"
                                style={{
                                    width: g.span * DAY_WIDTH,
                                    paddingLeft: 12,
                                    color: 'rgba(255,109,41,0.55)',
                                    borderRight: '1px solid rgba(255,255,255,0.04)',
                                }}
                            >
                                {g.label}
                            </div>
                        ))}
                    </div>

                    {/* Day number row */}
                    <div
                        className="flex"
                        style={{
                            height: 28,
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                    >
                        {days.map((d, i) => {
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            const isToday = d.toDateString() === today.toDateString();
                            const isFirstOfMonth = d.getDate() === 1;
                            const isMonday = d.getDay() === 1;

                            let showLabel = false;
                            if (zoom === 'day') {
                                showLabel = true;
                            } else if (zoom === 'week') {
                                showLabel = isMonday || isFirstOfMonth;
                            } else {
                                showLabel = isFirstOfMonth || d.getDate() === 15;
                            }

                            // Separator line on this cell
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
                                                color: isToday
                                                    ? '#FF6D29'
                                                    : 'rgba(255,255,255,0.2)',
                                                fontWeight: isToday ? 700 : 500,
                                            }}
                                        >
                                            {d.getDate()}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Today line */}
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
                                {/* Today dot */}
                                <div
                                    className="absolute left-1/2 -translate-x-1/2"
                                    style={{
                                        top: -5,
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        backgroundColor: '#FF6D29',
                                        boxShadow: '0 0 8px rgba(255,109,41,0.5), 0 0 2px rgba(255,109,41,0.8)',
                                    }}
                                />
                            </div>
                        )}

                        {/* Task rows */}
                        {rows.map((row) => {
                            const { task, depth, isSubtask, hasChildren, isExpanded } = row;
                            const pos = getBarPosition(task);
                            const isSelected = selectedTaskId === task.id;
                            const isHovered = hoveredTaskId === task.id;
                            const isOverdue = task.due_date && task.status !== 'DONE' && new Date(task.due_date) < new Date();

                            // Orange vs desaturated orange
                            const barColor = isSubtask ? CHILD_BAR_COLOR : PARENT_BAR_COLOR;
                            const barBg = isSubtask ? CHILD_BAR_BG : PARENT_BAR_BG;
                            const barBorder = isSubtask ? CHILD_BAR_BORDER : PARENT_BAR_BORDER;
                            const barGlow = isSubtask ? CHILD_BAR_GLOW : PARENT_BAR_GLOW;

                            const rowH = ROW_HEIGHT;
                            const barHeight = 28;
                            const barTop = (rowH - barHeight) / 2;

                            // Ghost bar: shows descendant extent for any task with children
                            let ghostPos: { left: number; width: number } | null = null;
                            if (hasChildren && pos) {
                                const extent = getDescendantExtent(task.id);
                                if (extent) {
                                    const parentEnd = new Date(task.due_date!);
                                    const parentStart = new Date(task.start_date!);
                                    const overallStart = extent.earliest < parentStart ? extent.earliest : parentStart;
                                    const overallEnd = extent.latest > parentEnd ? extent.latest : parentEnd;

                                    if (overallEnd > parentEnd || overallStart < parentStart) {
                                        const viewStart = startOfView.getTime();
                                        const ghostStartOffset = Math.max(0, (overallStart.getTime() - viewStart) / (1000 * 60 * 60 * 24));
                                        const ghostEndOffset = Math.min(totalDays, (overallEnd.getTime() - viewStart) / (1000 * 60 * 60 * 24) + 1);
                                        if (ghostEndOffset > 0 && ghostStartOffset < totalDays) {
                                            ghostPos = {
                                                left: ghostStartOffset * DAY_WIDTH,
                                                width: Math.max(DAY_WIDTH, (ghostEndOffset - ghostStartOffset) * DAY_WIDTH),
                                            };
                                        }
                                    }
                                }
                            }

                            return (
                                <div
                                    key={task.id}
                                    className="relative transition-colors"
                                    style={{
                                        height: rowH,
                                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                                        background: isSelected
                                            ? 'rgba(255,109,41,0.04)'
                                            : isHovered
                                                ? 'rgba(255,255,255,0.02)'
                                                : 'transparent',
                                    }}
                                    onMouseEnter={() => setHoveredTaskId(task.id)}
                                    onMouseLeave={() => setHoveredTaskId(null)}
                                >
                                    {/* Weekend shading + separator lines */}
                                    {days.map((d, i) => {
                                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                        const isFirstOfMonth = d.getDate() === 1;
                                        const isMonday = d.getDay() === 1;

                                        // Show separator line based on zoom
                                        const showSep = zoom === 'month'
                                            ? isFirstOfMonth
                                            : zoom === 'week'
                                                ? (isFirstOfMonth || isMonday)
                                                : false;

                                        return (
                                            <div key={i}>
                                                {isWeekend && (
                                                    <div
                                                        className="absolute top-0 bottom-0"
                                                        style={{
                                                            left: i * DAY_WIDTH,
                                                            width: DAY_WIDTH,
                                                            background: 'rgba(255,255,255,0.012)',
                                                        }}
                                                    />
                                                )}
                                                {showSep && (
                                                    <div
                                                        className="absolute top-0 bottom-0"
                                                        style={{
                                                            left: i * DAY_WIDTH,
                                                            width: 1,
                                                            background: isFirstOfMonth
                                                                ? 'rgba(255,255,255,0.08)'
                                                                : 'rgba(255,255,255,0.04)',
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Ghost shadow bar — children extent indicator */}
                                    {ghostPos && (
                                        <div
                                            className="absolute"
                                            style={{
                                                left: ghostPos.left,
                                                width: ghostPos.width,
                                                top: barTop + 2,
                                                height: barHeight - 4,
                                                backgroundColor: GHOST_BAR_BG,
                                                border: `1px dashed ${GHOST_BAR_BORDER}`,
                                                borderRadius: 'var(--radius-sm)',
                                                zIndex: 0,
                                            }}
                                        />
                                    )}

                                    {/* Task bar */}
                                    {pos && (
                                        <div
                                            onClick={() => setSelectedTask(task.id)}
                                            className="absolute cursor-pointer transition-all group/bar"
                                            style={{
                                                left: pos.left,
                                                width: pos.width,
                                                top: barTop,
                                                height: barHeight,
                                                backgroundColor: barBg,
                                                border: `1px solid ${barBorder}`,
                                                borderRadius: 'var(--radius-sm)',
                                                boxShadow: isHovered || isSelected
                                                    ? barGlow
                                                    : 'none',
                                                transform: isHovered ? 'scaleY(1.06)' : 'scaleY(1)',
                                                zIndex: isHovered ? 5 : 1,
                                            }}
                                        >
                                            {/* Progress fill */}
                                            <div
                                                className="absolute inset-y-0 left-0 transition-all"
                                                style={{
                                                    width: `${Math.min(100, task.progress)}%`,
                                                    backgroundColor: barColor,
                                                    opacity: 0.25,
                                                    borderRadius: task.progress >= 100
                                                        ? 'var(--radius-sm)'
                                                        : 'var(--radius-sm) 0 0 var(--radius-sm)',
                                                }}
                                            />

                                            {/* Expand/Collapse chevron + label */}
                                            <span
                                                className="absolute inset-0 flex items-center truncate z-10"
                                                style={{
                                                    paddingLeft: 8,
                                                    paddingRight: 6,
                                                }}
                                            >
                                                {/* Chevron for tasks with children */}
                                                {hasChildren && (
                                                    <button
                                                        onClick={(e) => toggleExpand(task.id, e)}
                                                        className="flex items-center justify-center shrink-0 transition-colors mr-0.5"
                                                        style={{
                                                            color: barColor,
                                                        }}
                                                    >
                                                        {isExpanded
                                                            ? <ChevronDown className="w-3.5 h-3.5" />
                                                            : <ChevronRightIcon className="w-3.5 h-3.5" />
                                                        }
                                                    </button>
                                                )}

                                                {/* Task title */}
                                                {pos.width > 50 && (
                                                    <span
                                                        className="truncate leading-none"
                                                        style={{
                                                            fontSize: 10.5,
                                                            fontWeight: 500,
                                                            color: barColor,
                                                            letterSpacing: '0.01em',
                                                        }}
                                                    >
                                                        {task.title}
                                                    </span>
                                                )}
                                            </span>

                                            {/* Overdue indicator */}
                                            {isOverdue && (
                                                <div
                                                    className="absolute"
                                                    style={{
                                                        right: -4,
                                                        top: -4,
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        backgroundColor: '#ef4444',
                                                        boxShadow: '0 0 6px rgba(239,68,68,0.5)',
                                                    }}
                                                />
                                            )}

                                            {/* Hover tooltip */}
                                            {isHovered && (
                                                <div
                                                    className="absolute z-50 pointer-events-none"
                                                    style={{
                                                        bottom: barHeight + 6,
                                                        left: 0,
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    <div
                                                        className="px-2.5 py-1.5 rounded-md text-[10px] flex flex-col gap-0.5"
                                                        style={{
                                                            background: 'rgba(20,16,12,0.95)',
                                                            border: '1px solid rgba(255,255,255,0.08)',
                                                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                                        }}
                                                    >
                                                        <span className="font-medium text-foreground/90">{task.title}</span>
                                                        <span className="text-muted-foreground/50">
                                                            {task.start_date && new Date(task.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                            {' → '}
                                                            {task.due_date && new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                            {' · '}{getDuration(task)}
                                                            {' · '}{task.progress}%
                                                        </span>
                                                    </div>
                                                </div>
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
                    </div>
                </div>
            </div>
        </div>
    );
}
