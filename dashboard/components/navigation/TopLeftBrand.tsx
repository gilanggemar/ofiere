"use client";

import { Logo } from "@/components/logo";

export function TopLeftBrand() {
    return (
        <div className="ofiere-top-left">
            <Logo className="h-6 w-6 text-foreground" />
            <span className="text-lg font-bold text-foreground tracking-tight">
                OFIERE
            </span>
        </div>
    );
}
