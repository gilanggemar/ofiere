'use client';

import { cn } from '@/lib/utils';
import { FileText, Loader2, Heart } from 'lucide-react';

interface WorkspaceFile {
    name: string;
    size: number;
    modified: number;
}

interface FileListProps {
    files: WorkspaceFile[];
    selectedFileName: string | null;
    isLoading: boolean;
    onSelectFile: (fileName: string) => void;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(timestampMs: number): string {
    if (!timestampMs) return '';
    const now = Date.now();
    const diffMs = now - timestampMs;
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
}

export function FileList({ files, selectedFileName, isLoading, onSelectFile }: FileListProps) {
    const isCompanionSelected = selectedFileName === 'COMPANION.md';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 text-white/30 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-1.5 p-2">
            {/* OpenClaw workspace files */}
            {files.length === 0 ? (
                <div className="flex items-center justify-center py-6 px-4">
                    <p className="text-xs font-mono text-white/30 text-center">
                        No workspace files found.
                    </p>
                </div>
            ) : (
                files.map((file) => {
                    const isSelected = file.name === selectedFileName;
                    return (
                        <button
                            key={file.name}
                            onClick={() => onSelectFile(file.name)}
                            className={cn(
                                'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                                'hover:bg-white/5',
                                isSelected
                                    ? 'bg-orange-500/10 border border-orange-500/30'
                                    : 'border border-transparent'
                            )}
                        >
                            <FileText
                                size={14}
                                className={cn(
                                    'mt-0.5 shrink-0',
                                    isSelected ? 'text-orange-400' : 'text-white/30'
                                )}
                            />
                            <div className="flex flex-col min-w-0">
                                <span className={cn(
                                    'text-xs font-mono font-semibold truncate',
                                    isSelected ? 'text-orange-400' : 'text-white/80'
                                )}>
                                    {file.name}
                                </span>
                                <span className="text-[10px] font-mono text-white/30 mt-0.5">
                                    {formatFileSize(file.size)}
                                    {file.modified > 0 && ` · ${formatRelativeTime(file.modified)}`}
                                </span>
                            </div>
                        </button>
                    );
                })
            )}

            {/* Divider */}
            <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-[9px] font-mono text-white/20 uppercase tracking-wider">OFIERE</span>
                <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* COMPANION.md — always present, stored in Supabase */}
            <button
                onClick={() => onSelectFile('COMPANION.md')}
                className={cn(
                    'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                    'hover:bg-pink-500/8',
                    isCompanionSelected
                        ? 'bg-pink-500/10 border border-pink-500/30'
                        : 'border border-transparent'
                )}
            >
                <Heart
                    size={14}
                    className={cn(
                        'mt-0.5 shrink-0 transition-colors',
                        isCompanionSelected ? 'text-pink-400 fill-pink-400/30' : 'text-pink-500/40'
                    )}
                />
                <div className="flex flex-col min-w-0">
                    <span className={cn(
                        'text-xs font-mono font-semibold truncate',
                        isCompanionSelected ? 'text-pink-400' : 'text-white/70'
                    )}>
                        COMPANION.md
                    </span>
                    <span className="text-[10px] font-mono text-white/25 mt-0.5">
                        Character Profile · Supabase
                    </span>
                </div>
            </button>
        </div>
    );
}
