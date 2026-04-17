"use client";

import { cn } from "@/lib/utils";

interface OfiereSkeletonProps {
    variant: 'card' | 'metric' | 'text' | 'avatar' | 'chart';
    className?: string;
}

export function OfiereSkeleton({ variant, className }: OfiereSkeletonProps) {
    const baseClasses = "relative overflow-hidden bg-muted/20 border border-border/10";

    // The specific shimmering styles are defined inline or via Tailwind
    // We'll use a custom animation matching Ofiere's visual language
    const shimmerStyle = {
        background: "linear-gradient(90deg, oklch(0.18 0.005 0 / 0.5) 0%, oklch(0.25 0.01 0 / 0.5) 50%, oklch(0.18 0.005 0 / 0.5) 100%)",
        backgroundSize: "200% 100%",
        animation: "ofiere-shimmer 1.5s ease-in-out infinite"
    };

    let variantClasses = "";
    switch (variant) {
        case 'card':
            variantClasses = "h-[120px] w-full rounded-md";
            break;
        case 'metric':
            variantClasses = "h-[40px] w-[80px] rounded-lg";
            break;
        case 'text':
            variantClasses = "h-[14px] rounded-md"; // width usually set by consumer or random
            break;
        case 'avatar':
            variantClasses = "w-[32px] h-[32px] rounded-full";
            break;
        case 'chart':
            variantClasses = "h-[200px] w-full rounded-md";
            break;
    }

    return (
        <div
            className={cn(baseClasses, variantClasses, className)}
            style={shimmerStyle}
            suppressHydrationWarning
        />
    );
}
