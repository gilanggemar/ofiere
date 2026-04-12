"use client";

import { useState } from "react";
import { usePMStore } from "@/store/usePMStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { SPACE_ICON_MAP, SPACE_ICON_KEYS, DEFAULT_SPACE_ICON } from "@/lib/pm/spaceIcons";

const SPACE_COLORS = ['#FF6D29', '#22D3EE', '#A855F7', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6'];

export function CreateSpaceDialog() {
    const open = usePMStore((s) => s.createSpaceOpen);
    const setOpen = usePMStore((s) => s.setCreateSpaceOpen);
    const createSpace = usePMStore((s) => s.createSpace);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [icon, setIcon] = useState(DEFAULT_SPACE_ICON);
    const [iconColor, setIconColor] = useState("#FF6D29");

    const handleCreate = async () => {
        if (!name.trim()) return;
        await createSpace(name.trim(), icon, iconColor);
        setName("");
        setDescription("");
        setIcon(DEFAULT_SPACE_ICON);
        setIconColor("#FF6D29");
        setOpen(false);
    };

    const handleClose = () => setOpen(false);

    if (!open) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-md border border-border rounded-xl bg-card shadow-2xl relative flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-accent-base/15 flex items-center justify-center">
                                <Rocket className="w-3.5 h-3.5 text-accent-base" />
                            </div>
                            <span className="text-[13px] font-medium text-foreground">New Space</span>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-1 rounded-md hover:bg-muted/40 transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Form */}
                    <div className="px-5 py-5 space-y-4 overflow-y-auto min-h-0 flex-1">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">Name</label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Research Division, Client Projects"
                                className="h-8 text-[12px] rounded-md border-border bg-background"
                                autoFocus
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">Description</label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What is this space for..."
                                className="min-h-14 text-[12px] rounded-md border-border bg-background resize-none"
                            />
                        </div>

                        {/* Icon Picker — Lucide SVG icons, colorable */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">Icon</label>
                            <div className="flex flex-wrap gap-2.5">
                                {SPACE_ICON_KEYS.map((key) => {
                                    const IconComp = SPACE_ICON_MAP[key];
                                    const isSelected = icon === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setIcon(key)}
                                            className={cn(
                                                "w-7 h-7 flex items-center justify-center rounded-md transition-all",
                                                isSelected
                                                    ? "scale-125"
                                                    : "opacity-50 hover:opacity-80 hover:scale-110"
                                            )}
                                        >
                                            <IconComp
                                                className="w-4.5 h-4.5"
                                                style={{ color: isSelected ? iconColor : undefined }}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Color Picker — changes the icon color */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">Color</label>
                            <div className="flex flex-wrap gap-1.5">
                                {SPACE_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setIconColor(c)}
                                        className={cn(
                                            "w-6 h-6 rounded-full border-2 transition-all",
                                            iconColor === c
                                                ? "border-foreground scale-125"
                                                : "border-transparent hover:scale-110"
                                        )}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">Preview</label>
                            <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-background border border-border/50">
                                {(() => {
                                    const PreviewIcon = SPACE_ICON_MAP[icon];
                                    return <PreviewIcon className="w-4 h-4" style={{ color: iconColor }} />;
                                })()}
                                <span className="text-[12px] text-foreground font-medium">
                                    {name.trim() || "My Space"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/50 shrink-0">
                        <Button
                            onClick={handleClose}
                            variant="ghost"
                            size="sm"
                            className="h-8 px-4 rounded-md text-[11px]"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            className="h-8 px-5 rounded-md text-[11px] bg-orange-500 text-white hover:bg-orange-600 gap-1.5 disabled:opacity-30"
                            onClick={handleCreate}
                            disabled={!name.trim()}
                        >
                            <Rocket className="w-3 h-3" />
                            Create Space
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
