"use client";

import { usePMStore } from "@/store/usePMStore";
import { cn } from "@/lib/utils";
import {
    FileText, Image, Film, File, Music, Archive, Code,
    Download, Trash2, Plus, Upload, Search, Grid, List
} from "lucide-react";
import { useMemo, useState } from "react";

const FILE_ICONS: Record<string, typeof FileText> = {
    image: Image,
    video: Film,
    audio: Music,
    document: FileText,
    code: Code,
    archive: Archive,
};

const FILE_COLORS: Record<string, string> = {
    image: 'text-pink-400 bg-pink-500/10',
    video: 'text-red-400 bg-red-500/10',
    audio: 'text-amber-400 bg-amber-500/10',
    document: 'text-blue-400 bg-blue-500/10',
    code: 'text-green-400 bg-green-500/10',
    archive: 'text-zinc-400 bg-zinc-500/10',
    default: 'text-muted-foreground bg-foreground/5',
};

const getFileCategory = (type: string | null): string => {
    if (!type) return 'default';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type.includes('pdf') || type.includes('doc') || type.includes('text')) return 'document';
    if (type.includes('zip') || type.includes('tar') || type.includes('rar')) return 'archive';
    if (type.includes('javascript') || type.includes('json') || type.includes('typescript') || type.includes('python')) return 'code';
    return 'default';
};

const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Since we don't have a full files API yet, this view shows an empty state with upload capability
// and will display files when the pm_files table is populated

interface MockFile {
    id: string;
    file_name: string;
    file_type: string | null;
    file_size: number | null;
    file_url: string;
    task_id: string | null;
    created_at: string;
}

export function ProjectFiles() {
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const tasks = usePMStore((s) => s.tasks);

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string | null>(null);

    // For now, we show files as a coming-soon feature with structure ready
    const files: MockFile[] = [];

    const filteredFiles = useMemo(() => {
        let result = files;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter((f) => f.file_name.toLowerCase().includes(q));
        }
        if (filterType) {
            result = result.filter((f) => getFileCategory(f.file_type) === filterType);
        }
        return result;
    }, [files, searchQuery, filterType]);

    // Group by category
    const grouped = useMemo(() => {
        const groups = new Map<string, MockFile[]>();
        filteredFiles.forEach((f) => {
            const cat = getFileCategory(f.file_type);
            if (!groups.has(cat)) groups.set(cat, []);
            groups.get(cat)!.push(f);
        });
        return groups;
    }, [filteredFiles]);

    return (
        <div className="flex-1 overflow-auto">
            {/* Toolbar */}
            <div className="sticky top-0 border-b border-border/20 px-4 py-2 z-10">
                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative flex-1 max-w-[220px]">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/30" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search files..."
                            className="w-full h-6 pl-6 pr-2 text-[10px] bg-foreground/3 rounded-md border-none outline-none placeholder:text-muted-foreground/30 text-foreground"
                        />
                    </div>

                    {/* Type filters */}
                    <div className="flex items-center gap-1">
                        {['image', 'document', 'video', 'code', 'archive'].map((type) => {
                            const Icon = FILE_ICONS[type] || File;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(filterType === type ? null : type)}
                                    className={cn(
                                        "w-6 h-6 rounded flex items-center justify-center transition-colors",
                                        filterType === type
                                            ? "bg-accent-base/10 text-accent-base"
                                            : "text-muted-foreground/30 hover:text-muted-foreground hover:bg-foreground/5"
                                    )}
                                    title={type}
                                >
                                    <Icon className="w-3 h-3" />
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-1" />

                    {/* View toggle */}
                    <div className="flex items-center bg-foreground/3 rounded-md p-0.5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn("w-6 h-5 rounded flex items-center justify-center transition-colors",
                                viewMode === 'grid' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/40"
                            )}
                        >
                            <Grid className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn("w-6 h-5 rounded flex items-center justify-center transition-colors",
                                viewMode === 'list' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground/40"
                            )}
                        >
                            <List className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {filteredFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-foreground/3 flex items-center justify-center mb-4 border border-dashed border-border/30">
                            <Upload className="w-6 h-6 text-muted-foreground/15" />
                        </div>
                        <h3 className="text-[13px] font-semibold text-foreground mb-1">No files yet</h3>
                        <p className="text-[11px] text-muted-foreground/30 max-w-xs mb-4">
                            Attach files to tasks in the detail panel to see them here. Supports images, documents, code, and more.
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/20">
                                <Image className="w-3 h-3" /> Images
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/20">
                                <FileText className="w-3 h-3" /> Documents
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/20">
                                <Code className="w-3 h-3" /> Code files
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/20">
                                <Film className="w-3 h-3" /> Videos
                            </div>
                        </div>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {filteredFiles.map((file) => {
                            const cat = getFileCategory(file.file_type);
                            const Icon = FILE_ICONS[cat] || File;
                            const color = FILE_COLORS[cat] || FILE_COLORS.default;

                            return (
                                <div
                                    key={file.id}
                                    className="rounded-xl border border-border/20 bg-card p-3 hover:border-border/40 transition-colors cursor-pointer group"
                                >
                                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-2", color)}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <p className="text-[11px] font-medium text-foreground truncate">{file.file_name}</p>
                                    <p className="text-[9px] text-muted-foreground/30 mt-0.5">
                                        {formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {filteredFiles.map((file) => {
                            const cat = getFileCategory(file.file_type);
                            const Icon = FILE_ICONS[cat] || File;
                            const color = FILE_COLORS[cat] || FILE_COLORS.default;

                            return (
                                <div
                                    key={file.id}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/2 transition-colors cursor-pointer group"
                                >
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", color)}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium text-foreground truncate">{file.file_name}</p>
                                        <p className="text-[9px] text-muted-foreground/30">{formatFileSize(file.file_size)}</p>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground/25">
                                        {new Date(file.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
