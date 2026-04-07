"use client";

import { useState, useRef, useEffect } from "react";
import { useProjectStore, Project, ProjectFile } from "@/store/useProjectStore";
import {
    FolderOpen, Plus, X as XIcon, Upload, FileText, Image as ImageIcon,
    Trash2, Settings2, ChevronDown, Pencil, Check, Loader2
} from "lucide-react";

import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

interface ProjectPanelProps {
    agentId: string;
    agentName: string;
    className?: string;
}

export function ProjectPanel({ agentId, agentName, className }: ProjectPanelProps) {
    const {
        projects, activeProjectId, activeProject, isLoading,
        loadProjects, setActiveProject, createProject, updateProject, deleteProject,
        uploadFile, deleteFile,
    } = useProjectStore();

    const [showEditor, setShowEditor] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editInstructions, setEditInstructions] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Escape key to close modal
    useEffect(() => {
        if (!showEditor) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowEditor(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [showEditor]);

    // Load projects on mount / agent change
    useEffect(() => {
        loadProjects(agentId);
    }, [agentId, loadProjects]);

    // Restore active project from localStorage
    useEffect(() => {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('nerv_active_project') : null;
        if (saved && !activeProjectId) {
            setActiveProject(saved);
        }
    }, []);

    // Sync editor with active project
    useEffect(() => {
        if (activeProject) {
            setEditName(activeProject.name);
            setEditDescription(activeProject.description || "");
            setEditInstructions(activeProject.custom_instructions || "");
        }
    }, [activeProject?.id]);

    const handleCreate = async () => {
        setIsCreating(true);
        const id = await createProject({
            name: `New Project`,
            agent_id: agentId,
        });
        if (id) {
            setShowEditor(true);
            setEditName("New Project");
            setEditDescription("");
            setEditInstructions("");
        }
        setIsCreating(false);
    };

    const handleSave = async () => {
        if (!activeProjectId) return;
        await updateProject(activeProjectId, {
            name: editName.trim() || "Untitled",
            description: editDescription.trim() || null,
            custom_instructions: editInstructions.trim() || null,
        } as any);
        setShowEditor(false);
    };

    const handleFileUpload = async (files: File[]) => {
        if (!activeProjectId || files.length === 0) return;
        setIsUploading(true);
        for (const file of files) {
            await uploadFile(activeProjectId, file);
        }
        setIsUploading(false);
    };

    const getFileIcon = (type: string) => {
        if (type?.startsWith('image/')) return <ImageIcon className="w-3.5 h-3.5 text-blue-400" />;
        return <FileText className="w-3.5 h-3.5 text-orange-400" />;
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    return (
        <div className={className}>
            {/* Project Selector */}
            <div className="flex items-center gap-1.5">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="flex items-center h-7 px-2.5 rounded-sm text-xs gap-1.5 border border-border/50 hover:border-border transition-all"
                            style={{
                                color: activeProjectId ? 'var(--nerv-violet)' : 'var(--nerv-text-tertiary)',
                                borderColor: activeProjectId ? 'color-mix(in srgb, var(--nerv-violet) 30%, transparent)' : undefined,
                                background: activeProjectId ? 'color-mix(in srgb, var(--nerv-violet) 8%, transparent)' : 'transparent',
                            }}
                        >
                            <FolderOpen className="w-3 h-3" />
                            <span className="max-w-[120px] truncate">
                                {activeProject?.name || "No Project"}
                            </span>
                            <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" sideOffset={8} align="start" className="rounded-md p-1.5 min-w-[200px]">
                        {activeProjectId && (
                            <>
                                <DropdownMenuItem
                                    className="rounded-[calc(1rem-6px)] text-xs"
                                    onClick={() => setActiveProject(null)}
                                >
                                    <XIcon className="w-3.5 h-3.5 opacity-50 mr-2" />
                                    No Project
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                            </>
                        )}
                        {projects.map(p => (
                            <DropdownMenuItem
                                key={p.id}
                                className="rounded-[calc(1rem-6px)] text-xs justify-between group/item"
                                onClick={() => setActiveProject(p.id)}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--nerv-violet)' }} />
                                    <span className="truncate">{p.name}</span>
                                </div>
                                {p.id === activeProjectId && (
                                    <Check className="w-3 h-3 ml-2 shrink-0" style={{ color: 'var(--nerv-success)' }} />
                                )}
                            </DropdownMenuItem>
                        ))}
                        {projects.length > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                            className="rounded-[calc(1rem-6px)] text-xs"
                            onClick={handleCreate}
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                            ) : (
                                <Plus className="w-3.5 h-3.5 mr-2" />
                            )}
                            New Project
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Edit button for active project */}
                {activeProjectId && (
                    <button
                        onClick={() => setShowEditor(!showEditor)}
                        className="p-1 rounded-md hover:bg-white/5 transition-colors"
                        title="Edit project settings"
                    >
                        <Settings2 className="w-3.5 h-3.5" style={{ color: 'var(--nerv-text-tertiary)' }} />
                    </button>
                )}
            </div>

            {/* Modal Overlay for Project Editor */}
            {showEditor && activeProject && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ animation: 'fadeIn 150ms ease-out' }}
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setShowEditor(false)}
                    />

                    {/* Modal */}
                    <div
                        className="relative z-10 w-[380px] max-h-[85vh] overflow-y-auto rounded-md p-1 shadow-md"
                        style={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            animation: 'scaleIn 150ms ease-out',
                        }}
                    >
                        <div className="p-3 space-y-3">
                            {/* Project Name */}
                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-medium mb-1.5 block" style={{ color: 'var(--muted-foreground)' }}>
                                    Project Name
                                </label>
                                <input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full bg-transparent text-sm font-medium border-none outline-none transition-colors"
                                    style={{ color: 'var(--popover-foreground)' }}
                                    placeholder="My Project"
                                    autoFocus
                                />
                            </div>

                            {/* Divider */}
                            <div style={{ height: 1, background: 'var(--border)', opacity: 0.5 }} />

                            {/* Description */}
                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-medium mb-1.5 block" style={{ color: 'var(--muted-foreground)' }}>
                                    Description
                                </label>
                                <input
                                    value={editDescription}
                                    onChange={e => setEditDescription(e.target.value)}
                                    className="w-full bg-transparent text-xs outline-none transition-colors"
                                    style={{ color: 'var(--popover-foreground)', opacity: 0.8 }}
                                    placeholder="Brief description..."
                                />
                            </div>

                            {/* Divider */}
                            <div style={{ height: 1, background: 'var(--border)', opacity: 0.5 }} />

                            {/* Custom Instructions */}
                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-medium mb-1.5 block" style={{ color: 'var(--muted-foreground)' }}>
                                    Custom Instructions
                                </label>
                                <textarea
                                    value={editInstructions}
                                    onChange={e => setEditInstructions(e.target.value)}
                                    className="w-full bg-transparent text-xs resize-none outline-none min-h-[80px] transition-colors"
                                    style={{ color: 'var(--popover-foreground)', opacity: 0.8 }}
                                    placeholder="Tell the agent how to behave in this project context..."
                                    rows={4}
                                />
                            </div>

                            {/* Divider */}
                            <div style={{ height: 1, background: 'var(--border)', opacity: 0.5 }} />

                            {/* Files Section */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted-foreground)' }}>
                                        Files ({(activeProject.project_files || []).length})
                                    </label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className="sr-only"
                                        accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xlsx,.xml,.yaml,.yml,.toml,.log,.html"
                                        onChange={e => {
                                            const files = Array.from(e.target.files || []);
                                            handleFileUpload(files);
                                            e.target.value = '';
                                        }}
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-sm transition-colors"
                                        style={{ color: 'var(--accent-base)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {isUploading ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Upload className="w-3 h-3" />
                                        )}
                                        Upload
                                    </button>
                                </div>

                                {(activeProject.project_files || []).length > 0 ? (
                                    <div className="space-y-0.5 max-h-[150px] overflow-y-auto scrollbar-hide">
                                        {(activeProject.project_files || []).map(f => (
                                            <div
                                                key={f.id}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-sm group/file transition-colors"
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            >
                                                {getFileIcon(f.file_type)}
                                                <span className="text-[11px] truncate flex-1 min-w-0" style={{ color: 'var(--popover-foreground)', opacity: 0.8 }}>
                                                    {f.file_name}
                                                </span>
                                                <span className="text-[9px] shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                                                    {formatSize(f.file_size)}
                                                </span>
                                                {f.content_text && (
                                                    <span className="text-[8px] px-1 py-px rounded-full shrink-0"
                                                        style={{
                                                            background: 'color-mix(in srgb, var(--nerv-success) 15%, transparent)',
                                                            color: 'var(--nerv-success)',
                                                        }}
                                                    >
                                                        CTX
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => deleteFile(activeProject.id, f.id)}
                                                    className="opacity-0 group-hover/file:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all"
                                                >
                                                    <Trash2 className="w-3 h-3 text-red-400" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-4 gap-1" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
                                        <FileText className="w-5 h-5" />
                                        <span className="text-[10px]">No files yet</span>
                                    </div>
                                )}
                            </div>

                            {/* Divider */}
                            <div style={{ height: 1, background: 'var(--border)', opacity: 0.5 }} />

                            {/* Actions */}
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => {
                                        if (confirm('Delete this project?')) {
                                            deleteProject(activeProject.id);
                                            setShowEditor(false);
                                        }
                                    }}
                                    className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-sm transition-colors"
                                    style={{ color: 'hsl(0, 70%, 60%)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                </button>
                                <div className="flex gap-1.5">
                                    <button
                                        className="h-6 px-3 text-[11px] rounded-sm transition-colors"
                                        style={{ color: 'var(--popover-foreground)' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        onClick={() => setShowEditor(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="h-6 px-3 text-[11px] rounded-sm font-medium transition-colors"
                                        style={{
                                            background: 'var(--accent-base)',
                                            color: 'white',
                                        }}
                                        onClick={handleSave}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal animations */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95) translateY(8px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
}
