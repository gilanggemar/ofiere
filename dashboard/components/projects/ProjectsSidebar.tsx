"use client";

import { usePMStore } from "@/store/usePMStore";
import type { PMSpace, PMFolder, PMTask } from "@/lib/pm/types";
import { resolveSpaceIcon } from "@/lib/pm/spaceIcons";
import { Button } from "@/components/ui/button";
import {
    FolderKanban, Plus, ChevronRight, ChevronDown,
    Folder, MoreHorizontal, Trash2, Pencil, FolderPlus,
    Search, Hash, Bot, CheckCircle2, FileText, Briefcase, GitBranch
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useRef, useEffect } from "react";

export function ProjectsSidebar() {
    const spaces = usePMStore((s) => s.spaces);
    const folders = usePMStore((s) => s.folders);
    const tasks = usePMStore((s) => s.tasks);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);
    const setActiveSpace = usePMStore((s) => s.setActiveSpace);
    const setActiveFolder = usePMStore((s) => s.setActiveFolder);
    const setActiveProject = usePMStore((s) => s.setActiveProject);
    const activeProjectId = usePMStore((s) => s.activeProjectId);
    const setCreateSpaceOpen = usePMStore((s) => s.setCreateSpaceOpen);
    const createFolder = usePMStore((s) => s.createFolder);
    const createProject = usePMStore((s) => s.createProject);
    const deleteSpace = usePMStore((s) => s.deleteSpace);
    const deleteFolder = usePMStore((s) => s.deleteFolder);
    const updateFolder = usePMStore((s) => s.updateFolder);
    const updateSpace = usePMStore((s) => s.updateSpace);
    const setSelectedTask = usePMStore((s) => s.setSelectedTask);
    const selectedTaskId = usePMStore((s) => s.selectedTaskId);

    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(spaces.map((s) => s.id)));
    const [contextMenu, setContextMenu] = useState<{ id: string; type: 'space' | 'folder'; x: number; y: number } | null>(null);
    const [sidebarSearch, setSidebarSearch] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [creatingFolderIn, setCreatingFolderIn] = useState<string | null>(null);
    const [creatingFolderParent, setCreatingFolderParent] = useState<string | null>(null);
    const [creatingType, setCreatingType] = useState<'folder' | 'project'>('folder');
    const [newFolderName, setNewFolderName] = useState('');
    const renameRef = useRef<HTMLInputElement>(null);
    const newFolderRef = useRef<HTMLInputElement>(null);

    // Auto-expand new spaces
    useEffect(() => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            spaces.forEach((s) => next.add(s.id));
            return next;
        });
    }, [spaces.length]);

    // Focus rename input
    useEffect(() => { if (renameRef.current) renameRef.current.focus(); }, [renamingId]);
    useEffect(() => { if (newFolderRef.current) newFolderRef.current.focus(); }, [creatingFolderIn]);

    const toggleExpand = (id: string) => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const buildFolderTree = (spaceId: string, parentId: string | null = null): PMFolder[] => {
        return folders
            .filter((f) => f.space_id === spaceId && f.parent_folder_id === parentId)
            .sort((a, b) => a.sort_order - b.sort_order);
    };

    const getTaskCount = (spaceId: string, folderId?: string) => {
        if (folderId) return tasks.filter((t) => t.folder_id === folderId).length;
        return tasks.filter((t) => t.space_id === spaceId).length;
    };

    const getStatusCounts = (spaceId: string, folderId?: string) => {
        const filtered = folderId
            ? tasks.filter((t) => t.folder_id === folderId)
            : tasks.filter((t) => t.space_id === spaceId);
        const done = filtered.filter((t) => t.status === 'DONE').length;
        const total = filtered.length;
        return { done, total };
    };

    const handleContextMenu = (e: React.MouseEvent, id: string, type: 'space' | 'folder') => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ id, type, x: e.clientX, y: e.clientY });
    };

    const handleNewFolder = async (spaceId: string, parentFolderId?: string, type: 'folder' | 'project' = 'folder') => {
        setCreatingFolderIn(spaceId);
        setCreatingFolderParent(parentFolderId || null);
        setCreatingType(type);
        setNewFolderName('');
        // Expand the parent node so the inline input is visible
        if (parentFolderId) {
            if (!expandedNodes.has(parentFolderId)) toggleExpand(parentFolderId);
        } else {
            if (!expandedNodes.has(spaceId)) toggleExpand(spaceId);
        }
    };

    const submitNewFolder = async () => {
        if (!newFolderName.trim() || !creatingFolderIn) return;
        if (creatingType === 'project') {
            const proj = await createProject(creatingFolderIn, newFolderName.trim(), creatingFolderParent);
            if (proj && creatingFolderParent) {
                setExpandedNodes((prev) => { const next = new Set(prev); next.add(creatingFolderParent); return next; });
            }
        } else {
            const folder = await createFolder(creatingFolderIn, newFolderName.trim(), creatingFolderParent);
            if (creatingFolderParent && folder) {
                setExpandedNodes((prev) => { const next = new Set(prev); next.add(creatingFolderParent); return next; });
            }
        }
        setCreatingFolderIn(null);
        setCreatingFolderParent(null);
        setNewFolderName('');
    };

    const cancelNewFolder = () => {
        setCreatingFolderIn(null);
        setCreatingFolderParent(null);
        setNewFolderName('');
    };

    const startRename = (id: string, currentName: string) => {
        setRenamingId(id);
        setRenameValue(currentName);
        setContextMenu(null);
    };

    const submitRename = (type: 'space' | 'folder') => {
        if (!renameValue.trim() || !renamingId) return;
        if (type === 'space') updateSpace(renamingId, { name: renameValue.trim() });
        else updateFolder(renamingId, { name: renameValue.trim() });
        setRenamingId(null);
    };

    // Filtered spaces/folders by search
    const filteredSpaces = useMemo(() => {
        if (!sidebarSearch.trim()) return spaces;
        const q = sidebarSearch.toLowerCase();
        return spaces.filter((s) => {
            if (s.name.toLowerCase().includes(q)) return true;
            // Include if any folder inside matches
            return folders.some((f) => f.space_id === s.id && f.name.toLowerCase().includes(q));
        });
    }, [spaces, folders, sidebarSearch]);



    const renderFolder = (folder: PMFolder, depth: number = 1, spaceId: string): React.ReactNode => {
        const isActive = activeFolderId === folder.id;
        const isExpanded = expandedNodes.has(folder.id);
        const children = buildFolderTree(spaceId, folder.id);
        const folderTasks = tasks.filter(t => t.folder_id === folder.id);
        const isRenaming = renamingId === folder.id;
        const hasChildren = children.length > 0;
        // Determine child type icons
        const hasChildFolders = children.some(f => f.folder_type !== 'project');
        const hasChildProjects = children.some(f => f.folder_type === 'project');
        const hasChildWorkflows = folderTasks.some(t => (t.custom_fields as any)?.type === 'workflow');
        const hasChildTasks = folderTasks.some(t => (t.custom_fields as any)?.type !== 'workflow');

        // Search filter for folders
        if (sidebarSearch.trim() && !folder.name.toLowerCase().includes(sidebarSearch.toLowerCase())) {
            return null;
        }

        return (
            <div key={folder.id}>
                <div
                    onClick={() => {
                        if (folder.folder_type === 'project') {
                            setActiveProject(folder.id);
                        } else {
                            setActiveFolder(folder.id);
                        }
                        if (!isExpanded && hasChildren) toggleExpand(folder.id);
                    }}
                    onContextMenu={(e) => handleContextMenu(e, folder.id, 'folder')}
                    className={cn(
                        "flex items-center gap-1.5 py-1.5 text-left transition-colors group cursor-pointer rounded-md mx-2",
                        isActive
                            ? "bg-white/[0.04] text-foreground"
                            : "text-foreground/70 hover:bg-white/[0.03] hover:text-foreground"
                    )}
                    style={{ paddingLeft: `${8 + depth * 20}px`, paddingRight: '6px' }}
                >
                    {hasChildren ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}
                            className="w-4 h-4 flex items-center justify-center shrink-0"
                        >
                            {isExpanded
                                ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                : <ChevronRight className="w-3 h-3 text-muted-foreground" />
                            }
                        </button>
                    ) : (
                        <span className="w-4 h-4 shrink-0" />
                    )}
                    {folder.folder_type === 'project' ? (
                        <Briefcase className={cn(
                            "w-3.5 h-3.5 shrink-0",
                            isActive ? "text-accent-base" : "text-accent-base/60"
                        )} />
                    ) : (
                        <Folder className={cn(
                            "w-3.5 h-3.5 shrink-0",
                            isActive ? "text-accent-base" : "text-muted-foreground/50"
                        )} />
                    )}
                    {isRenaming ? (
                        <input
                            ref={renameRef}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => submitRename('folder')}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitRename('folder'); if (e.key === 'Escape') setRenamingId(null); }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[12px] font-medium flex-1 bg-transparent border-none outline-none text-foreground min-w-0"
                        />
                    ) : (
                        <span className="text-[12px] font-medium truncate flex-1">{folder.name}</span>
                    )}
                    {/* Child type icons */}
                    <span className="flex items-center gap-0.5 shrink-0">
                        {hasChildFolders && <Folder className="w-2.5 h-2.5 text-muted-foreground/30" />}
                        {hasChildProjects && <Briefcase className="w-2.5 h-2.5 text-amber-500/50" />}
                        {hasChildWorkflows && <GitBranch className="w-2.5 h-2.5 text-violet-400/50" />}
                        {hasChildTasks && <FileText className="w-2.5 h-2.5 text-blue-400/50" />}
                    </span>
                </div>

                <AnimatePresence initial={false}>
                    {(isExpanded || (creatingFolderIn === spaceId && creatingFolderParent === folder.id)) && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                        >
                            {children.map((child) => renderFolder(child, depth + 1, spaceId))}



                            {/* Inline new sub-folder */}
                            {creatingFolderIn === spaceId && creatingFolderParent === folder.id && (
                                <div className="flex items-center gap-1.5 py-1 mx-1 rounded-md" style={{ paddingLeft: `${6 + (depth + 1) * 14}px`, paddingRight: '6px' }}>
                                    <Folder className="w-3.5 h-3.5 text-accent-base shrink-0" />
                                    <input
                                        ref={newFolderRef}
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        onBlur={() => { if (newFolderName.trim()) submitNewFolder(); else cancelNewFolder(); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') submitNewFolder();
                                            if (e.key === 'Escape') cancelNewFolder();
                                        }}
                                        placeholder="Folder name..."
                                        className="flex-1 text-[12px] font-medium bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30 min-w-0"
                                    />
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className="pm-sidebar flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Spaces
                </span>
                <button
                    onClick={() => setCreateSpaceOpen(true)}
                    className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                    title="New Space"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Sidebar search */}
            <div className="px-2 py-1.5">
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30" />
                    <input
                        value={sidebarSearch}
                        onChange={(e) => setSidebarSearch(e.target.value)}
                        placeholder="Find space"
                        className="w-full h-6 pl-6 pr-2 text-[10px] bg-foreground/3 rounded-md border-none outline-none placeholder:text-muted-foreground/20 text-foreground"
                    />
                </div>
            </div>

            {/* Space Tree */}
            <div className="flex-1 overflow-y-auto py-0.5 scrollbar-hide">
                {filteredSpaces.length === 0 && !sidebarSearch && (
                    <div className="px-3 py-6 text-center">
                        <p className="text-[10px] text-muted-foreground/40">No spaces yet</p>
                        <button
                            onClick={() => setCreateSpaceOpen(true)}
                            className="mt-2 text-[11px] text-accent-base hover:underline"
                        >
                            Create your first space
                        </button>
                    </div>
                )}

                {filteredSpaces.length === 0 && sidebarSearch && (
                    <div className="px-3 py-6 text-center">
                        <p className="text-[10px] text-muted-foreground/30">No matches found</p>
                    </div>
                )}

                {filteredSpaces.map((space) => {
                    const isActive = activeSpaceId === space.id && !activeFolderId;
                    const isExpanded = expandedNodes.has(space.id);
                    const rootFolders = buildFolderTree(space.id, null);
                    const { done, total } = getStatusCounts(space.id);
                    const isRenaming = renamingId === space.id;

                    return (
                        <div key={space.id} className="mb-0.5">
                            {/* Space Row */}
                            <div
                                onClick={() => {
                                    setActiveSpace(space.id);
                                    if (!isExpanded) toggleExpand(space.id);
                                }}
                                onContextMenu={(e) => handleContextMenu(e, space.id, 'space')}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-1.5 text-left transition-colors group cursor-pointer rounded-md mx-2",
                                    isActive
                                        ? "bg-white/[0.04] text-foreground"
                                        : "text-foreground/70 hover:bg-white/[0.03] hover:text-foreground"
                                )}
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleExpand(space.id); }}
                                    className="w-4 h-4 flex items-center justify-center shrink-0"
                                >
                                    {isExpanded
                                        ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                        : <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                    }
                                </button>
                                {(() => {
                                    const SpaceIcon = resolveSpaceIcon(space.icon);
                                    return <SpaceIcon className="w-4 h-4 shrink-0" style={{ color: space.icon_color }} />;
                                })()}
                                {isRenaming ? (
                                    <input
                                        ref={renameRef}
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => submitRename('space')}
                                        onKeyDown={(e) => { if (e.key === 'Enter') submitRename('space'); if (e.key === 'Escape') setRenamingId(null); }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-[12px] font-semibold flex-1 bg-transparent border-none outline-none text-foreground min-w-0"
                                    />
                                ) : (
                                    <span className="text-[12px] font-semibold truncate flex-1">{space.name}</span>
                                )}
                                
                                {/* Mini completion indicator */}
                                {total > 0 && (
                                    <span className="text-[8px] text-muted-foreground/25 tabular-nums shrink-0">
                                        {done}/{total}
                                    </span>
                                )}

                                <button
                                    onClick={(e) => { e.stopPropagation(); handleNewFolder(space.id); }}
                                    className="w-4 h-4 opacity-0 group-hover:opacity-100 flex items-center justify-center text-muted-foreground hover:text-foreground transition-opacity shrink-0"
                                    title="New Folder"
                                >
                                    <FolderPlus className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Folders */}
                            <AnimatePresence initial={false}>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="overflow-hidden"
                                    >
                                        {rootFolders.map((folder) => renderFolder(folder, 1, space.id))}



                                        {/* Inline new folder at space root level */}
                                        {creatingFolderIn === space.id && !creatingFolderParent && (
                                            <div className="flex items-center gap-1.5 py-1 mx-1 rounded-md" style={{ paddingLeft: '20px', paddingRight: '6px' }}>
                                                <Folder className="w-3.5 h-3.5 text-accent-base shrink-0" />
                                                <input
                                                    ref={newFolderRef}
                                                    value={newFolderName}
                                                    onChange={(e) => setNewFolderName(e.target.value)}
                                                    onBlur={() => { if (newFolderName.trim()) submitNewFolder(); else cancelNewFolder(); }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') submitNewFolder();
                                                        if (e.key === 'Escape') cancelNewFolder();
                                                    }}
                                                    placeholder="Folder name..."
                                                    className="flex-1 text-[12px] font-medium bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30 min-w-0"
                                                />
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>



            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
                    <div
                        className="fixed z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[160px]"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        <button
                            onClick={() => {
                                const item = contextMenu.type === 'space'
                                    ? spaces.find((s) => s.id === contextMenu.id)
                                    : folders.find((f) => f.id === contextMenu.id);
                                if (item) startRename(contextMenu.id, item.name);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-foreground/5 transition-colors"
                        >
                            <Pencil className="w-3 h-3" /> Rename
                        </button>
                        {contextMenu.type === 'space' && (
                            <button
                                onClick={() => { handleNewFolder(contextMenu.id); setContextMenu(null); }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-foreground/5 transition-colors"
                            >
                                <FolderPlus className="w-3 h-3" /> New Folder
                            </button>
                        )}
                        {contextMenu.type === 'folder' && (
                            <button
                                onClick={() => {
                                    const folder = folders.find((f) => f.id === contextMenu.id);
                                    if (folder) handleNewFolder(folder.space_id, folder.id);
                                    setContextMenu(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-foreground/5 transition-colors"
                            >
                                <FolderPlus className="w-3 h-3" /> New Sub-folder
                            </button>
                        )}
                        <div className="border-t border-border/30 my-1" />
                        <button
                            onClick={() => {
                                if (contextMenu.type === 'space') deleteSpace(contextMenu.id);
                                else deleteFolder(contextMenu.id);
                                setContextMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <Trash2 className="w-3 h-3" /> Delete
                        </button>
                    </div>
                </>
            )}

            {/* Keyboard hint */}
            <div className="px-3 py-1.5 border-t border-border/20">
                <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground/20">
                    <kbd className="px-1 py-0.5 rounded bg-foreground/3 font-mono">J</kbd>
                    <kbd className="px-1 py-0.5 rounded bg-foreground/3 font-mono">K</kbd>
                    <span>navigate</span>
                    <span className="mx-0.5">·</span>
                    <kbd className="px-1 py-0.5 rounded bg-foreground/3 font-mono">N</kbd>
                    <span>new</span>
                    <span className="mx-0.5">·</span>
                    <kbd className="px-1 py-0.5 rounded bg-foreground/3 font-mono">1-6</kbd>
                    <span>views</span>
                </div>
            </div>
        </div>
    );
}
