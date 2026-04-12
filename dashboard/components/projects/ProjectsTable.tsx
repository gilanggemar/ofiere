"use client";

import { usePMStore } from "@/store/usePMStore";
import { PRIORITY_LABELS, PRIORITY_DOTS, STATUS_LABELS } from "@/lib/pm/types";
import type { PMTask, PMTaskStatus, PMFolder } from "@/lib/pm/types";
import { cn } from "@/lib/utils";
import {
    Bot, User, Zap, ChevronRight, ChevronDown, Plus,
    Filter, Columns3, ArrowUpDown, Search, X, Tag, CheckCircle2,
    Folder, FolderOpen, Briefcase, Link2, FileText, GripVertical, GitBranch
} from "lucide-react";
import { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_DOTS: Record<string, string> = {
    PENDING: 'bg-zinc-500',
    IN_PROGRESS: 'bg-accent-base',
    DONE: 'bg-accent-lime',
    FAILED: 'bg-red-500',
};

const ASSIGNEE_ICONS: Record<string, typeof Bot> = {
    agent: Bot,
    human: User,
    auto: Zap,
};

// Column definitions
type ColumnId = 'title' | 'status' | 'priority' | 'assignee' | 'due_date' | 'start_date' | 'progress' | 'tags' | 'created_at';

interface ColumnDef {
    id: ColumnId;
    label: string;
    flex: string;
    sortable: boolean;
    defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
    { id: 'title', label: 'Name', flex: 'flex-[3]', sortable: true, defaultVisible: true },
    { id: 'status', label: 'Status', flex: 'flex-[1]', sortable: true, defaultVisible: true },
    { id: 'priority', label: 'Priority', flex: 'flex-[1]', sortable: true, defaultVisible: true },
    { id: 'assignee', label: 'Assignee', flex: 'flex-[1.5]', sortable: false, defaultVisible: true },
    { id: 'start_date', label: 'Start date', flex: 'flex-[1]', sortable: true, defaultVisible: true },
    { id: 'due_date', label: 'Due date', flex: 'flex-[1]', sortable: true, defaultVisible: true },
    { id: 'progress', label: 'Progress', flex: 'flex-[1]', sortable: true, defaultVisible: false },
    { id: 'tags', label: 'Tags', flex: 'flex-[1.2]', sortable: false, defaultVisible: false },
    { id: 'created_at', label: 'Created', flex: 'flex-[1]', sortable: true, defaultVisible: false },
];

type GroupBy = 'none' | 'status' | 'priority' | 'assignee';
type Density = 'comfortable' | 'spacious';

const DENSITY_PADDING: Record<Density, string> = {
    comfortable: 'py-2.5',
    spacious: 'py-3.5',
};

// ── Drag & Drop types ──
interface DragItem {
    id: string;
    type: 'folder' | 'task';
    parentFolderId: string | null;
    parentTaskId: string | null;
    folderId: string | null;
    depth: number;
}

interface DropTarget {
    id: string;
    type: 'folder' | 'task';
    position: 'before' | 'after' | 'inside';
}

export function ProjectsTable() {
    const allTasks = usePMStore((s) => s.tasks);
    const allFolders = usePMStore((s) => s.folders);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);
    const activeProjectId = usePMStore((s) => s.activeProjectId);
    const selectedTaskId = usePMStore((s) => s.selectedTaskId);
    const setSelectedTask = usePMStore((s) => s.setSelectedTask);
    const setActiveFolder = usePMStore((s) => s.setActiveFolder);
    const setActiveProject = usePMStore((s) => s.setActiveProject);
    const updateTask = usePMStore((s) => s.updateTask);
    const createTask = usePMStore((s) => s.createTask);
    const createFolder = usePMStore((s) => s.createFolder);
    const updateFolder = usePMStore((s) => s.updateFolder);
    const createProject = usePMStore((s) => s.createProject);
    const setCreateTaskOpen = usePMStore((s) => s.setCreateTaskOpen);
    const setCreateWorkflowItemOpen = usePMStore((s) => s.setCreateWorkflowItemOpen);
    const agents = usePMStore((s) => s.agents);
    const dependencies = usePMStore((s) => s.dependencies);

    // Get child folders for the current view (space root or inside a folder)
    const childFolders = useMemo(() => {
        if (activeFolderId) {
            // Show sub-folders of the active folder
            return allFolders
                .filter((f) => f.parent_folder_id === activeFolderId)
                .sort((a, b) => a.sort_order - b.sort_order);
        } else if (activeSpaceId) {
            // Show root folders of the active space
            return allFolders
                .filter((f) => f.space_id === activeSpaceId && !f.parent_folder_id)
                .sort((a, b) => a.sort_order - b.sort_order);
        }
        return [];
    }, [allFolders, activeSpaceId, activeFolderId]);

    // Helper: count all tasks recursively inside a folder and its sub-folders
    const getRecursiveTaskCount = useCallback((folderId: string): number => {
        const directTasks = allTasks.filter((t) => t.folder_id === folderId).length;
        const subFolders = allFolders.filter((f) => f.parent_folder_id === folderId);
        const subFolderTasks = subFolders.reduce((sum, sf) => sum + getRecursiveTaskCount(sf.id), 0);
        return directTasks + subFolderTasks;
    }, [allTasks, allFolders]);

    // Helper: count sub-folders inside a folder
    const getSubFolderCount = useCallback((folderId: string): number => {
        return allFolders.filter((f) => f.parent_folder_id === folderId).length;
    }, [allFolders]);

    // Helper: recursively count all child items by type inside a folder
    const getRecursiveChildSummary = useCallback((folderId: string): { folders: number; projects: number; workflows: number; tasks: number } => {
        const childFolders = allFolders.filter(f => f.parent_folder_id === folderId);
        const directTasks = allTasks.filter(t => t.folder_id === folderId);

        let folders = childFolders.filter(f => f.folder_type !== 'project').length;
        let projects = childFolders.filter(f => f.folder_type === 'project').length;
        let workflows = directTasks.filter(t => (t.custom_fields as any)?.type === 'workflow').length;
        let tasks = directTasks.filter(t => (t.custom_fields as any)?.type !== 'workflow').length;

        // Recurse into child folders
        for (const cf of childFolders) {
            const sub = getRecursiveChildSummary(cf.id);
            folders += sub.folders;
            projects += sub.projects;
            workflows += sub.workflows;
            tasks += sub.tasks;
        }
        return { folders, projects, workflows, tasks };
    }, [allTasks, allFolders]);

    const tasks = useMemo(() => {
        let filtered = allTasks.filter((t) => !t.parent_task_id);
        if (activeFolderId) {
            filtered = filtered.filter((t) => t.folder_id === activeFolderId);
        } else if (activeSpaceId) {
            // When viewing a space root, only show tasks that belong directly to the space
            // (i.e. not inside any folder)
            filtered = filtered.filter((t) => t.space_id === activeSpaceId && !t.folder_id);
        }
        return filtered;
    }, [allTasks, activeSpaceId, activeFolderId]);

    // ── UI State ──
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(() =>
        new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id))
    );
    const [density, setDensity] = useState<Density>('comfortable');
    const [groupBy, setGroupBy] = useState<GroupBy>('none');
    const [searchQuery, setSearchQuery] = useState('');
    const [showColumnPicker, setShowColumnPicker] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string | null>(null);
    const [filterPriority, setFilterPriority] = useState<number | null>(null);
    const [inlineAddVisible, setInlineAddVisible] = useState(false);
    const [inlineTitle, setInlineTitle] = useState('');
    const inlineInputRef = useRef<HTMLInputElement>(null);
    const [editingCell, setEditingCell] = useState<{ taskId: string; column: ColumnId } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [addMenuOpen, setAddMenuOpen] = useState(false);
    const [inlineAddType, setInlineAddType] = useState<'task' | 'folder' | 'project'>('task');
    const [inlineFolderName, setInlineFolderName] = useState('');
    const inlineFolderRef = useRef<HTMLInputElement>(null);
    const [showGroupBy, setShowGroupBy] = useState(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [dropdownPos, setDropdownPos] = useState<{ x: number; y: number } | null>(null);

    // ── Reorder / Drag-drop state ──
    const [reorderMode, setReorderMode] = useState(false);
    const [dragItem, setDragItem] = useState<DragItem | null>(null);
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleColumn = (colId: ColumnId) => {
        setVisibleColumns((prev) => {
            const next = new Set(prev);
            if (next.has(colId)) {
                if (colId !== 'title') next.delete(colId); // title always visible
            } else {
                next.add(colId);
            }
            return next;
        });
    };

    const toggleGroupCollapse = (groupKey: string) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey); else next.add(groupKey);
            return next;
        });
    };

    const getSubtasks = (parentId: string) => allTasks.filter((t) => t.parent_task_id === parentId);

    const handleSort = (col: string) => {
        if (sortBy === col) {
            setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(col);
            setSortDir('asc');
        }
    };

    // ── Filtering ──
    const filteredTasks = useMemo(() => {
        let result = tasks;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter((t) =>
                t.title.toLowerCase().includes(q) ||
                t.description?.toLowerCase().includes(q) ||
                t.tags?.some((tag: string) => tag.includes(q))
            );
        }
        if (filterStatus) result = result.filter((t) => t.status === filterStatus);
        if (filterPriority !== null) result = result.filter((t) => t.priority === filterPriority);
        return result;
    }, [tasks, searchQuery, filterStatus, filterPriority]);

    // ── Sorting ──
    const sortedTasks = useMemo(() => {
        if (!sortBy) return filteredTasks;
        return [...filteredTasks].sort((a, b) => {
            let valA: any, valB: any;
            switch (sortBy) {
                case 'title': valA = a.title.toLowerCase(); valB = b.title.toLowerCase(); break;
                case 'status': valA = a.status; valB = b.status; break;
                case 'priority': valA = a.priority; valB = b.priority; break;
                case 'due_date': valA = a.due_date || '9999'; valB = b.due_date || '9999'; break;
                case 'start_date': valA = a.start_date || '9999'; valB = b.start_date || '9999'; break;
                case 'progress': valA = a.progress; valB = b.progress; break;
                case 'created_at': valA = a.created_at; valB = b.created_at; break;
                default: return 0;
            }
            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredTasks, sortBy, sortDir]);

    // ── Grouping ──
    const groups = useMemo(() => {
        if (groupBy === 'none') return [{ key: 'all', label: '', tasks: sortedTasks }];

        const grouped: Record<string, PMTask[]> = {};
        sortedTasks.forEach((t) => {
            let key: string;
            switch (groupBy) {
                case 'status': key = t.status; break;
                case 'priority': key = String(t.priority); break;
                case 'assignee': key = t.agent_id || 'unassigned'; break;
                default: key = 'other';
            }
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(t);
        });

        return Object.entries(grouped).map(([key, tasks]) => {
            let label: string;
            switch (groupBy) {
                case 'status': label = STATUS_LABELS[key] || key; break;
                case 'priority': label = PRIORITY_LABELS[Number(key)] || 'Unknown'; break;
                case 'assignee': label = agents.find((a) => a.id === key)?.name || (key === 'unassigned' ? 'Unassigned' : key); break;
                default: label = key;
            }
            return { key, label, tasks };
        });
    }, [sortedTasks, groupBy, agents]);

    const getAgentName = (agentId: string | null) => {
        if (!agentId) return null;
        return agents.find((a) => a.id === agentId)?.name || agentId;
    };

    // ── Inline Add ──
    const handleInlineAdd = async () => {
        if (!inlineTitle.trim()) { setInlineAddVisible(false); return; }
        await createTask({ title: inlineTitle.trim() });
        setInlineTitle('');
        // Keep inline add open for rapid entry
    };

    const handleInlineFolderAdd = async () => {
        if (!inlineFolderName.trim()) { setInlineAddVisible(false); return; }
        if (inlineAddType === 'project') {
            await createProject(activeSpaceId!, inlineFolderName.trim(), activeFolderId || undefined);
        } else {
            await createFolder(activeSpaceId!, inlineFolderName.trim(), activeFolderId || undefined);
        }
        setInlineFolderName('');
        setInlineAddVisible(false);
    };

    // ── Inline Edit ──
    const startEditing = (taskId: string, column: ColumnId, currentValue: string) => {
        setEditingCell({ taskId, column });
        setEditValue(currentValue);
    };

    const commitEdit = () => {
        if (!editingCell) return;
        const { taskId, column } = editingCell;
        if (column === 'title' && editValue.trim()) {
            updateTask(taskId, { title: editValue.trim() });
        }
        setEditingCell(null);
    };

    const activeFilters = [filterStatus, filterPriority].filter((f) => f !== null).length;
    const cols = ALL_COLUMNS.filter((c) => visibleColumns.has(c.id));

    // ── Row index tracking ── (mutable ref to share between renderFolderRow and renderRow)
    let globalRowIndex = 0;

    // ── Drag-and-drop handlers ──
    const handleDragStart = useCallback((item: DragItem) => (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify(item));
        setDragItem(item);
    }, []);

    const handleDragOver = useCallback((targetId: string, targetType: 'folder' | 'task') => (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const rect = e.currentTarget.getBoundingClientRect();
        const yRatio = (e.clientY - rect.top) / rect.height;

        let pos: 'before' | 'inside' | 'after';
        if (targetType === 'folder') {
            if (yRatio < 0.25) pos = 'before';
            else if (yRatio > 0.75) pos = 'after';
            else pos = 'inside';
        } else {
            pos = yRatio < 0.5 ? 'before' : 'after';
        }

        setDropTarget({ id: targetId, type: targetType, position: pos });
    }, []);

    const handleDragLeave = useCallback(() => {
        setDropTarget(null);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        if (!dragItem || !dropTarget) { setDragItem(null); setDropTarget(null); return; }
        if (dragItem.id === dropTarget.id) { setDragItem(null); setDropTarget(null); return; }

        const targetFolder = allFolders.find(f => f.id === dropTarget.id);
        const targetTask = allTasks.find(t => t.id === dropTarget.id);

        if (dragItem.type === 'folder') {
            // Moving a folder
            if (dropTarget.position === 'inside' && dropTarget.type === 'folder') {
                // Move folder inside target folder
                await updateFolder(dragItem.id, { parent_folder_id: dropTarget.id });
            } else if (dropTarget.type === 'folder') {
                // Move before/after a folder => same parent
                const parentId = targetFolder?.parent_folder_id || null;
                await updateFolder(dragItem.id, { parent_folder_id: parentId });
            }
        } else if (dragItem.type === 'task') {
            // Moving a task
            if (dropTarget.position === 'inside' && dropTarget.type === 'folder') {
                // Drop task inside a folder
                await updateTask(dragItem.id, { folder_id: dropTarget.id, parent_task_id: null });
            } else if (dropTarget.type === 'folder') {
                // Drop before/after a folder => move to same parent as that folder
                const parentId = targetFolder?.parent_folder_id || null;
                if (parentId) {
                    await updateTask(dragItem.id, { folder_id: parentId, parent_task_id: null });
                } else {
                    // Folder is at root level — move task to space root (outside any folder)
                    await updateTask(dragItem.id, { folder_id: null, parent_task_id: null });
                }
            } else if (dropTarget.type === 'task') {
                // Drop before/after a task => move to same folder as target task
                const folderId = targetTask?.folder_id || null;
                await updateTask(dragItem.id, { folder_id: folderId, parent_task_id: targetTask?.parent_task_id || null });
            }
        }

        setDragItem(null);
        setDropTarget(null);
    }, [dragItem, dropTarget, allFolders, allTasks, updateFolder, updateTask]);

    const handleDragEnd = useCallback(() => {
        setDragItem(null);
        setDropTarget(null);
    }, []);

    // ── Render Folder Row (recursive — shows children inline when expanded) ──
    const renderFolderRow = (folder: PMFolder, depth: number = 0) => {
        const taskCount = getRecursiveTaskCount(folder.id);
        const subFolderCount = getSubFolderCount(folder.id);
        const isExpanded = expandedRows.has(folder.id);
        const rowNum = ++globalRowIndex;

        // Get direct children: sub-folders + tasks
        const subFolders = allFolders
            .filter((f) => f.parent_folder_id === folder.id)
            .sort((a, b) => a.sort_order - b.sort_order);
        const folderTasks = allTasks
            .filter((t) => t.folder_id === folder.id && !t.parent_task_id);
        const hasChildren = subFolders.length > 0 || folderTasks.length > 0;

        const isDragTarget = dropTarget?.id === folder.id;
        const isDragging = dragItem?.id === folder.id;

        return (
            <div key={folder.id}>
                {/* Drop indicator — before */}
                {isDragTarget && dropTarget?.position === 'before' && (
                    <div className="h-0.5 bg-accent-base mx-8 rounded-full" />
                )}
                <div
                    onClick={() => {
                        if (folder.folder_type === 'project') {
                            setActiveProject(folder.id);
                        } else {
                            setActiveFolder(folder.id);
                        }
                    }}
                    draggable={reorderMode}
                    onDragStart={reorderMode ? handleDragStart({ id: folder.id, type: 'folder', parentFolderId: folder.parent_folder_id, parentTaskId: null, folderId: null, depth }) : undefined}
                    onDragOver={reorderMode ? handleDragOver(folder.id, 'folder') : undefined}
                    onDragLeave={reorderMode ? handleDragLeave : undefined}
                    onDrop={reorderMode ? handleDrop : undefined}
                    onDragEnd={reorderMode ? handleDragEnd : undefined}
                    className={cn(
                        "pm-table-row flex items-center transition-all cursor-pointer group",
                        DENSITY_PADDING[density],
                        "hover:bg-accent-base/4",
                        isDragging && "opacity-40",
                        isDragTarget && dropTarget?.position === 'inside' && "bg-accent-base/8 ring-1 ring-accent-base/30 ring-inset rounded",
                    )}
                    style={{ paddingLeft: '8px' }}
                >
                    {/* Row number / drag handle */}
                    <div className="w-8 shrink-0 flex items-center justify-center">
                        {reorderMode ? (
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing" />
                        ) : (
                            <span className="text-[11px] text-muted-foreground/30 tabular-nums">{rowNum}</span>
                        )}
                    </div>

                    {/* Title column — contains depth spacer + chevron + icon + text */}
                    <div className={cn(cols.find(c => c.id === 'title')?.flex || 'flex-[3]', "min-w-0 px-2 overflow-hidden")}>
                        <div className="flex items-center gap-0">
                            {/* Depth indentation spacer */}
                            {depth > 0 && <div style={{ width: `${depth * 1.5}rem` }} className="shrink-0" />}
                            {/* Chevron — click toggles expand */}
                            <div
                                className="w-5 shrink-0 flex items-center justify-center"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (hasChildren) toggleExpand(folder.id);
                                }}
                            >
                                {hasChildren ? (
                                    isExpanded
                                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                                ) : (
                                    <span className="w-5" />
                                )}
                            </div>
                            <div className="flex items-center gap-2 min-w-0 ml-1.5">
                                {folder.folder_type === 'project' ? (
                                    <Briefcase className="w-4 h-4 text-accent-base/70 shrink-0" />
                                ) : (
                                    <Folder className="w-4 h-4 text-accent-base/60 shrink-0" />
                                )}
                                <span className="text-[13px] font-medium text-foreground truncate">{folder.name}</span>
                                <span className="text-[10px] text-muted-foreground/30 shrink-0">
                                    {(() => {
                                        const s = getRecursiveChildSummary(folder.id);
                                        const parts: string[] = [];
                                        if (s.folders > 0) parts.push(`${s.folders} folder${s.folders > 1 ? 's' : ''}`);
                                        if (s.projects > 0) parts.push(`${s.projects} project${s.projects > 1 ? 's' : ''}`);
                                        if (s.workflows > 0) parts.push(`${s.workflows} workflow${s.workflows > 1 ? 's' : ''}`);
                                        if (s.tasks > 0) parts.push(`${s.tasks} task${s.tasks > 1 ? 's' : ''}`);
                                        return parts.join(' \u00b7 ');
                                    })()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Empty cells for remaining columns */}
                    {cols.filter(c => c.id !== 'title').map((col) => (
                        <div key={col.id} className={cn(col.flex, "px-2 flex items-center justify-center")}>
                            {col.id === 'status' && taskCount > 0 && (
                                <span className="text-[9px] text-muted-foreground/30">
                                    {allTasks.filter(t => t.folder_id === folder.id && t.status === 'DONE').length}/{taskCount} done
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Expanded children — with smooth animation */}
                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                        >
                            {subFolders.map((sf) => renderFolderRow(sf, depth + 1))}
                            {folderTasks.map((task) => renderRow(task, depth + 1))}
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Drop indicator — after */}
                {isDragTarget && dropTarget?.position === 'after' && (
                    <div className="h-0.5 bg-accent-base mx-8 rounded-full" />
                )}
            </div>
        );
    };

    // ── Render Row ──
    const renderRow = (task: PMTask, depth: number = 0) => {
        const subtasks = getSubtasks(task.id);
        const hasSubtasks = subtasks.length > 0;
        const isExpanded = expandedRows.has(task.id);
        const isSelected = selectedTaskId === task.id;
        const isOverdue = task.due_date && task.status !== 'DONE' && new Date(task.due_date) < new Date();
        const AssigneeIcon = ASSIGNEE_ICONS[task.assignee_type] || Bot;
        const isEditingTitle = editingCell?.taskId === task.id && editingCell?.column === 'title';
        const rowNum = ++globalRowIndex;
        const isDragTarget = dropTarget?.id === task.id;
        const isDragging = dragItem?.id === task.id;

        return (
            <div key={task.id}>
                {/* Drop indicator — before */}
                {isDragTarget && dropTarget?.position === 'before' && (
                    <div className="h-0.5 bg-accent-base mx-8 rounded-full" />
                )}
                <div
                    onClick={() => setSelectedTask(task.id)}
                    draggable={reorderMode}
                    onDragStart={reorderMode ? handleDragStart({ id: task.id, type: 'task', parentFolderId: null, parentTaskId: task.parent_task_id, folderId: task.folder_id, depth }) : undefined}
                    onDragOver={reorderMode ? handleDragOver(task.id, 'task') : undefined}
                    onDragLeave={reorderMode ? handleDragLeave : undefined}
                    onDrop={reorderMode ? handleDrop : undefined}
                    onDragEnd={reorderMode ? handleDragEnd : undefined}
                    className={cn(
                        "pm-table-row flex items-center transition-colors cursor-pointer group",
                        DENSITY_PADDING[density],
                        isSelected ? "bg-accent-base/6" : "hover:bg-foreground/2",
                        isDragging && "opacity-40",
                    )}
                    style={{ paddingLeft: '8px' }}
                >
                    {/* Row number / drag handle */}
                    <div className="w-8 shrink-0 flex items-center justify-center">
                        {reorderMode ? (
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing" />
                        ) : (
                            <span className="text-[11px] text-muted-foreground/30 tabular-nums">{rowNum}</span>
                        )}
                    </div>

                    {cols.map((col) => {
                        switch (col.id) {
                            case 'title':
                                return (
                                    <div key={col.id} className={cn(col.flex, "min-w-0 px-2 overflow-hidden")}>
                                        <div className="flex items-center gap-0">
                                            {/* Depth indentation spacer */}
                                            {depth > 0 && <div style={{ width: `${depth * 1.5}rem` }} className="shrink-0" />}
                                            {/* Expand chevron */}
                                            <div className="w-5 shrink-0 flex items-center justify-center">
                                                {hasSubtasks ? (
                                                    <button onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}>
                                                        {isExpanded
                                                            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                                            : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                                        }
                                                    </button>
                                                ) : (
                                                    <span className="w-5" />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 min-w-0 ml-1.5">
                                            {(task.custom_fields as any)?.type === 'workflow'
                                                ? <GitBranch className="w-4 h-4 text-accent-violet/60 shrink-0" />
                                                : <FileText className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                                            }
                                            {isEditingTitle ? (
                                                <input
                                                    autoFocus
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={commitEdit}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-[13px] bg-transparent border-none outline-none w-full text-foreground"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2 min-w-0" onDoubleClick={(e) => { e.stopPropagation(); startEditing(task.id, 'title', task.title); }}>
                                                    <span className="text-[13px] text-foreground truncate">{task.title}</span>
                                                    {hasSubtasks && (
                                                        <span className="text-[10px] text-muted-foreground/40 shrink-0">
                                                            ({subtasks.filter((s) => s.status === 'DONE').length}/{subtasks.length})
                                                        </span>
                                                    )}
                                                    {(() => {
                                                        const deps = dependencies.filter(d => d.predecessor_id === task.id || d.successor_id === task.id);
                                                        return deps.length > 0 ? (
                                                            <span className="flex items-center gap-0.5 text-[10px] text-accent-base/50 shrink-0" title={`${deps.length} dependenc${deps.length > 1 ? 'ies' : 'y'}`}>
                                                                <Link2 className="w-3 h-3" />{deps.length}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </div>
                                            )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            case 'status': {
                                const dropdownId = `${task.id}:status`;
                                const isOpen = openDropdown === dropdownId;
                                return (
                                    <div key={col.id} className={cn(col.flex, "px-2 flex items-center justify-center")}>
                                        <div className="relative inline-flex items-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isOpen) { setOpenDropdown(null); setDropdownPos(null); }
                                                    else {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setDropdownPos({ x: rect.left + rect.width / 2, y: rect.bottom + 4 });
                                                        setOpenDropdown(dropdownId);
                                                    }
                                                }}
                                                className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                            >
                                                {STATUS_LABELS[task.status]}
                                                <ChevronDown className="w-3 h-3 text-muted-foreground/40" />
                                            </button>
                                            <AnimatePresence>
                                                {isOpen && dropdownPos && (
                                                    <>
                                                        <div className="fixed inset-0 z-[199]" onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); setDropdownPos(null); }} />
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 4 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 4 }}
                                                            className="fixed z-[200] bg-card border border-border rounded-lg shadow-xl p-1 flex flex-col gap-0.5"
                                                            style={{ left: dropdownPos.x, top: dropdownPos.y, transform: 'translateX(-50%)' }}
                                                        >
                                                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                                                <button
                                                                    key={k}
                                                                    onClick={(e) => { e.stopPropagation(); updateTask(task.id, { status: k as PMTaskStatus }); setOpenDropdown(null); setDropdownPos(null); }}
                                                                    className={cn(
                                                                        "w-full text-left text-[11px] px-2.5 py-1.5 rounded-md transition-colors",
                                                                        task.status === k
                                                                            ? "bg-accent-base/10 text-accent-base"
                                                                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                                                    )}
                                                                >
                                                                    {v}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                );
                            }
                            case 'priority': {
                                const dropdownId = `${task.id}:priority`;
                                const isOpen = openDropdown === dropdownId;
                                return (
                                    <div key={col.id} className={cn(col.flex, "px-2 flex items-center justify-center")}>
                                        <div className="relative inline-flex items-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isOpen) { setOpenDropdown(null); setDropdownPos(null); }
                                                    else {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setDropdownPos({ x: rect.left + rect.width / 2, y: rect.bottom + 4 });
                                                        setOpenDropdown(dropdownId);
                                                    }
                                                }}
                                                className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                            >
                                                {PRIORITY_LABELS[task.priority]}
                                                <ChevronDown className="w-3 h-3 text-muted-foreground/40" />
                                            </button>
                                            <AnimatePresence>
                                                {isOpen && dropdownPos && (
                                                    <>
                                                        <div className="fixed inset-0 z-[199]" onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); setDropdownPos(null); }} />
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 4 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: 4 }}
                                                            className="fixed z-[200] bg-card border border-border rounded-lg shadow-xl p-1 flex flex-col gap-0.5"
                                                            style={{ left: dropdownPos.x, top: dropdownPos.y, transform: 'translateX(-50%)' }}
                                                        >
                                                            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                                                                <button
                                                                    key={k}
                                                                    onClick={(e) => { e.stopPropagation(); updateTask(task.id, { priority: Number(k) as any }); setOpenDropdown(null); setDropdownPos(null); }}
                                                                    className={cn(
                                                                        "w-full text-left text-[11px] px-2.5 py-1.5 rounded-md transition-colors",
                                                                        task.priority === Number(k)
                                                                            ? "bg-accent-base/10 text-accent-base"
                                                                            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                                                    )}
                                                                >
                                                                    {v}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    </>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                );
                            }
                            case 'assignee':
                                return (
                                    <div key={col.id} className={cn(col.flex, "px-2 flex items-center justify-center")}>
                                        <div className="flex items-center gap-2">
                                            <AssigneeIcon className={cn("w-3.5 h-3.5", task.assignee_type === 'agent' ? "text-accent-violet" : "text-accent-ocean")} />
                                            <span className="text-[12px] text-muted-foreground truncate">
                                                {getAgentName(task.agent_id) || (task.assignee_type === 'human' ? 'You' : 'Unassigned')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            case 'due_date':
                                return (
                                    <div key={col.id} className={cn(col.flex, "px-2 flex items-center justify-center")}>
                                        <span className={cn("text-[12px] tabular-nums", isOverdue ? "text-red-400 font-medium" : "text-muted-foreground/70")}>
                                            {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}
                                        </span>
                                    </div>
                                );
                            case 'start_date':
                                return (
                                    <div key={col.id} className={cn(col.flex, "px-2 flex items-center justify-center")}>
                                        <span className="text-[12px] text-muted-foreground/70 tabular-nums">
                                            {task.start_date ? new Date(task.start_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—'}
                                        </span>
                                    </div>
                                );
                            case 'progress':
                                return (
                                    <div key={col.id} className={cn(col.flex, "px-2 flex items-center justify-center")}>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                                                <div className="h-full rounded-full bg-accent-base/60 transition-all" style={{ width: `${task.progress}%` }} />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground/50 tabular-nums w-[28px] text-right">{task.progress}%</span>
                                        </div>
                                    </div>
                                );
                            case 'tags':
                                return (
                                    <div key={col.id} className={cn(col.flex, "px-2 flex items-center justify-center")}>
                                        <div className="flex items-center gap-1 overflow-hidden">
                                            {(task.tags || []).slice(0, 2).map((tag: string) => (
                                                <span key={tag} className="text-[10px] bg-foreground/5 text-muted-foreground/60 rounded px-1.5 py-0.5 truncate">
                                                    {tag}
                                                </span>
                                            ))}
                                            {(task.tags || []).length > 2 && (
                                                <span className="text-[9px] text-muted-foreground/30">+{task.tags!.length - 2}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            case 'created_at':
                                return (
                                    <div key={col.id} className={cn(col.flex, "px-2 flex items-center justify-center")}>
                                        <span className="text-[12px] text-muted-foreground/60 tabular-nums">
                                            {new Date(task.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                                        </span>
                                    </div>
                                );
                            default: return null;
                        }
                    })}
                </div>

                {/* Subtasks */}
                <AnimatePresence initial={false}>
                    {isExpanded && hasSubtasks && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                        >
                            {subtasks.map((sub) => renderRow(sub, depth + 1))}
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Drop indicator — after */}
                {isDragTarget && dropTarget?.position === 'after' && (
                    <div className="h-0.5 bg-accent-base mx-8 rounded-full" />
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2 px-3 py-1.5">
                {/* Search */}
                <div className="relative flex-1 max-w-[220px]">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/40" />
                    <input
                        data-pm-search
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search tasks... ( / )"
                        className="w-full h-6 pl-6 pr-2 text-[11px] bg-foreground/3 rounded-md border-none outline-none placeholder:text-muted-foreground/30 text-foreground"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                            <X className="w-2.5 h-2.5 text-muted-foreground/40 hover:text-foreground" />
                        </button>
                    )}
                </div>

                <div className="w-px h-4 bg-border/30" />

                {/* Filter */}
                <div className="relative">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            "flex items-center gap-1 h-6 px-2 text-[10px] rounded-md transition-colors",
                            activeFilters > 0
                                ? "bg-accent-base/10 text-accent-base"
                                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                        )}
                    >
                        <Filter className="w-3 h-3" />
                        Filter
                        {activeFilters > 0 && (
                            <span className="w-3.5 h-3.5 rounded-full bg-accent-base text-background text-[8px] flex items-center justify-center font-bold">{activeFilters}</span>
                        )}
                    </button>

                    {/* Filter Dropdown */}
                    <AnimatePresence>
                        {showFilters && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-3 min-w-[200px] space-y-3"
                                >
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider">Status</label>
                                        <div className="flex flex-wrap gap-1">
                                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                                <button
                                                    key={k}
                                                    onClick={() => setFilterStatus(filterStatus === k ? null : k)}
                                                    className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded-md border transition-colors",
                                                        filterStatus === k
                                                            ? "border-accent-base bg-accent-base/10 text-accent-base"
                                                            : "border-border/50 text-muted-foreground hover:border-border"
                                                    )}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider">Priority</label>
                                        <div className="flex flex-wrap gap-1">
                                            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                                                <button
                                                    key={k}
                                                    onClick={() => setFilterPriority(filterPriority === Number(k) ? null : Number(k))}
                                                    className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded-md border transition-colors flex items-center gap-1",
                                                        filterPriority === Number(k)
                                                            ? "border-accent-base bg-accent-base/10 text-accent-base"
                                                            : "border-border/50 text-muted-foreground hover:border-border"
                                                    )}
                                                >
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_DOTS[Number(k)])} />
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {activeFilters > 0 && (
                                        <button
                                            onClick={() => { setFilterStatus(null); setFilterPriority(null); }}
                                            className="text-[10px] text-red-400 hover:underline"
                                        >
                                            Clear all filters
                                        </button>
                                    )}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* Group by */}
                <div className="relative">
                    <button
                        onClick={() => setShowGroupBy(!showGroupBy)}
                        className="flex items-center gap-1 h-6 px-2 text-[10px] rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                    >
                        {groupBy === 'none' ? 'No grouping' : `Group by ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`}
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    <AnimatePresence>
                        {showGroupBy && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowGroupBy(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1.5 min-w-[160px] space-y-0.5"
                                >
                                    {(['none', 'status', 'priority', 'assignee'] as GroupBy[]).map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => { setGroupBy(g); setShowGroupBy(false); }}
                                            className={cn(
                                                "w-full text-left text-[11px] px-2.5 py-1.5 rounded-md transition-colors",
                                                groupBy === g
                                                    ? "bg-accent-base/10 text-accent-base"
                                                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                            )}
                                        >
                                            {g === 'none' ? 'No grouping' : `Group by ${g.charAt(0).toUpperCase() + g.slice(1)}`}
                                        </button>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                <div className="w-px h-4 bg-border/30" />

                {/* Density */}
                <div className="flex items-center bg-foreground/3 rounded-md p-0.5">
                    {(['comfortable', 'spacious'] as Density[]).map((d) => (
                        <button
                            key={d}
                            onClick={() => setDensity(d)}
                            className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded transition-colors capitalize",
                                density === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/50"
                            )}
                        >
                            {d}
                        </button>
                    ))}
                </div>

                {/* Column picker */}
                <div className="relative ml-auto">
                    <button
                        onClick={() => setShowColumnPicker(!showColumnPicker)}
                        className="flex items-center gap-1 h-6 px-2 text-[10px] rounded-md text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
                    >
                        <Columns3 className="w-3 h-3" />
                        Columns
                    </button>

                    <AnimatePresence>
                        {showColumnPicker && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 4 }}
                                    className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-2 min-w-[160px] space-y-0.5"
                                >
                                    {ALL_COLUMNS.map((col) => (
                                        <button
                                            key={col.id}
                                            onClick={() => toggleColumn(col.id)}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-2 py-1 rounded-md text-[11px] transition-colors",
                                                visibleColumns.has(col.id) ? "text-foreground" : "text-muted-foreground/40"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                                                visibleColumns.has(col.id) ? "bg-accent-base border-accent-base" : "border-border"
                                            )}>
                                                {visibleColumns.has(col.id) && <CheckCircle2 className="w-2.5 h-2.5 text-background" />}
                                            </div>
                                            {col.label}
                                        </button>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Column Headers ── */}
            <div className="flex items-center border-b border-border/30 py-2" style={{ paddingLeft: '8px' }}>
                {/* Row # header / Reorder toggle */}
                <div className="w-8 shrink-0 flex items-center justify-center">
                    <button
                        onClick={() => setReorderMode(!reorderMode)}
                        title={reorderMode ? 'Exit reorder mode' : 'Enable drag to reorder'}
                        className={cn(
                            "w-5 h-5 rounded flex items-center justify-center transition-colors",
                            reorderMode
                                ? "bg-accent-base/15 text-accent-base"
                                : "text-muted-foreground/30 hover:text-muted-foreground hover:bg-foreground/5"
                        )}
                    >
                        <GripVertical className="w-3 h-3" />
                    </button>
                </div>
                {cols.map((col) => (
                    <div key={col.id} className={cn(col.flex, "px-2", col.id !== 'title' && "text-center")}>
                        {col.sortable ? (
                            <button
                                onClick={() => handleSort(col.id)}
                                className={cn(
                                    "text-[12px] font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center gap-1",
                                    col.id !== 'title' && "justify-center w-full"
                                )}
                            >
                                {col.label}
                                {sortBy === col.id && (
                                    <ArrowUpDown className="w-3 h-3" />
                                )}
                            </button>
                        ) : (
                            <span className={cn("text-[12px] font-semibold text-muted-foreground/60", col.id !== 'title' && "block text-center")}>{col.label}</span>
                        )}
                    </div>
                ))}
            </div>

            {/* ── Rows ── */}
            <div className="flex-1 overflow-auto">
                {/* ── Child Folder Rows ── */}
                {childFolders.length > 0 && (
                    <div>
                        {childFolders.map((folder) => renderFolderRow(folder))}
                    </div>
                )}

                {/* ── Task Group Rows ── */}
                {groups.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.key);
                    return (
                        <div key={group.key}>
                            {/* Group header */}
                            {groupBy !== 'none' && (
                                <div
                                    onClick={() => toggleGroupCollapse(group.key)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-foreground/3 border-b border-border/20 cursor-pointer hover:bg-foreground/5 transition-colors"
                                >
                                    {isCollapsed
                                        ? <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                        : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                    }
                                    <span className="text-[11px] font-semibold text-foreground">{group.label}</span>
                                    <span className="text-[9px] text-muted-foreground/40 tabular-nums">{group.tasks.length}</span>
                                </div>
                            )}

                            {/* Tasks */}
                            {!isCollapsed && group.tasks.map((task) => renderRow(task))}
                        </div>
                    );
                })}



                {/* Inline add row */}
                {inlineAddVisible ? (
                    inlineAddType === 'task' ? (
                        <div className="flex items-center py-2" style={{ paddingLeft: '8px' }}>
                            <div className="w-8 shrink-0" />
                            <div className="w-5 shrink-0" />
                            <div className="flex-1 px-2 flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground/20 shrink-0" />
                                <input
                                    ref={inlineInputRef}
                                    autoFocus
                                    value={inlineTitle}
                                    onChange={(e) => setInlineTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleInlineAdd();
                                        if (e.key === 'Escape') { setInlineAddVisible(false); setInlineTitle(''); }
                                    }}
                                    onBlur={() => { if (!inlineTitle.trim()) setInlineAddVisible(false); }}
                                    placeholder="Task name..."
                                    className="text-[13px] bg-transparent border-none outline-none w-full text-foreground placeholder:text-muted-foreground/30"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center py-2" style={{ paddingLeft: '8px' }}>
                            <div className="w-8 shrink-0" />
                            <div className="w-5 shrink-0" />
                            <div className="flex-1 px-2 flex items-center gap-2">
                                {inlineAddType === 'project' ? (
                                    <Briefcase className="w-3.5 h-3.5 text-accent-base/50 shrink-0" />
                                ) : (
                                    <Folder className="w-3.5 h-3.5 text-accent-base/50 shrink-0" />
                                )}
                                <input
                                    ref={inlineFolderRef}
                                    autoFocus
                                    value={inlineFolderName}
                                    onChange={(e) => setInlineFolderName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleInlineFolderAdd();
                                        if (e.key === 'Escape') { setInlineAddVisible(false); setInlineFolderName(''); }
                                    }}
                                    onBlur={() => { if (!inlineFolderName.trim()) setInlineAddVisible(false); }}
                                    placeholder={inlineAddType === 'project' ? 'Project name...' : 'Folder name...'}
                                    className="text-[13px] bg-transparent border-none outline-none w-full text-foreground placeholder:text-muted-foreground/30"
                                />
                            </div>
                        </div>
                    )
                ) : (
                    <div className="relative">
                        <button
                            onClick={() => setAddMenuOpen(!addMenuOpen)}
                            className="flex items-center gap-2 py-2.5 text-[12px] text-muted-foreground/30 hover:text-muted-foreground hover:bg-foreground/2 transition-colors w-full"
                            style={{ paddingLeft: '50px' }}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Item
                        </button>

                        {/* Add menu popup */}
                        <AnimatePresence>
                            {addMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        className="absolute left-[44px] top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
                                    >
                                        <button
                                            onClick={() => {
                                                setCreateTaskOpen(true);
                                                setAddMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-foreground/80 hover:bg-foreground/5 transition-colors"
                                        >
                                            <FileText className="w-3.5 h-3.5 text-muted-foreground/50" />
                                            Task
                                        </button>
                                        <button
                                            onClick={() => {
                                                setInlineAddType('folder');
                                                setInlineAddVisible(true);
                                                setAddMenuOpen(false);
                                                setInlineFolderName('');
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-foreground/80 hover:bg-foreground/5 transition-colors"
                                        >
                                            <Folder className="w-3.5 h-3.5 text-accent-base/50" />
                                            Folder
                                        </button>
                                        <button
                                            onClick={() => {
                                                setInlineAddType('project');
                                                setInlineAddVisible(true);
                                                setAddMenuOpen(false);
                                                setInlineFolderName('');
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-foreground/80 hover:bg-foreground/5 transition-colors"
                                        >
                                            <Briefcase className="w-3.5 h-3.5 text-accent-base/70" />
                                            Project
                                        </button>
                                        <button
                                            onClick={() => {
                                                setCreateWorkflowItemOpen(true);
                                                setAddMenuOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-foreground/80 hover:bg-foreground/5 transition-colors"
                                        >
                                            <GitBranch className="w-3.5 h-3.5 text-accent-violet/70" />
                                            Workflow
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}
