"use client";

import { usePMStore } from "@/store/usePMStore";
import { Button } from "@/components/ui/button";
import { FolderKanban, Plus, Zap, BookOpenCheck, Code2 } from "lucide-react";
import { motion } from "framer-motion";

const TEMPLATES = [
    {
        icon: Zap, title: "Research Pipeline",
        desc: "Research → Analyze → Summarize → Report",
        spaceName: "Research Pipeline",
        spaceIcon: "🧪",
        spaceColor: "#22D3EE",
    },
    {
        icon: BookOpenCheck, title: "Content Creation",
        desc: "Draft → Review → Edit → Publish",
        spaceName: "Content Creation",
        spaceIcon: "📝",
        spaceColor: "#A855F7",
    },
    {
        icon: Code2, title: "Code Review",
        desc: "Write → Test → Review → Deploy",
        spaceName: "Code Review",
        spaceIcon: "💻",
        spaceColor: "#10B981",
    },
];

export function ProjectsEmptyState() {
    const setCreateSpaceOpen = usePMStore((s) => s.setCreateSpaceOpen);
    const createSpace = usePMStore((s) => s.createSpace);

    const handleTemplate = async (template: typeof TEMPLATES[0]) => {
        await createSpace(template.spaceName, template.spaceIcon, template.spaceColor);
    };

    return (
        <div className="flex-1 flex items-center justify-center">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                className="max-w-lg w-full text-center space-y-6"
            >
                {/* Icon */}
                <div className="relative mx-auto w-20 h-20">
                    <div className="absolute inset-0 rounded-2xl bg-accent-base/8 blur-xl" />
                    <div className="relative w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center">
                        <FolderKanban className="w-8 h-8 text-accent-base/60" />
                    </div>
                </div>

                {/* Text */}
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-foreground tracking-tight">
                        Agent-Bridged Project Management
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                        Create spaces to organize your work. Assign tasks to your agents — Ivy, Daisy, Celia, Thalia — and track execution in real time.
                    </p>
                </div>

                {/* CTA */}
                <Button
                    onClick={() => setCreateSpaceOpen(true)}
                    className="rounded-full h-9 px-6 text-xs bg-foreground text-background hover:bg-foreground/90 gap-2"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Create Your First Space
                </Button>

                {/* Quick templates */}
                <div className="pt-4 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
                        Or start from a template
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {TEMPLATES.map((tpl) => (
                            <button
                                key={tpl.title}
                                onClick={() => handleTemplate(tpl)}
                                className="group rounded-xl border border-border/50 bg-card/50 p-3 text-left hover:border-border hover:bg-card transition-all duration-200"
                            >
                                <tpl.icon className="w-4 h-4 text-muted-foreground group-hover:text-accent-base transition-colors mb-2" />
                                <p className="text-[11px] font-medium text-foreground mb-0.5">{tpl.title}</p>
                                <p className="text-[9px] text-muted-foreground/50 leading-relaxed">{tpl.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
