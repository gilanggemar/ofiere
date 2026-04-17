"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

/**
 * PageLoadingIndicator — Premium glassmorphic loading overlay
 * positioned in the bottom-left of the viewport. Features
 * animated orbital arcs and a glowing Ofiere pulse.
 */
export function PageLoadingIndicator() {
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(false);
    const prevPathRef = useRef(pathname);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const startLoading = useCallback(() => {
        setIsLoading(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsLoading(false), 12000);
    }, []);

    const finishLoading = useCallback(() => {
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            (window as any).requestIdleCallback(() => {
                setTimeout(() => {
                    setIsLoading(false);
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                }, 150);
            }, { timeout: 3000 });
        } else {
            setTimeout(() => {
                setIsLoading(false);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }, 800);
        }
    }, []);

    useEffect(() => {
        if (pathname !== prevPathRef.current) {
            prevPathRef.current = pathname;
            finishLoading();
        }
    }, [pathname, finishLoading]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement)?.closest?.("a");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
            if (anchor.target === "_blank") return;
            if (href !== pathname && !href.startsWith(pathname + "#")) {
                startLoading();
            }
        };
        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, [pathname, startLoading]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <AnimatePresence>
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.95 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    className="ofiere-page-loader"
                >
                    {/* Animated SVG orbital ring */}
                    <div className="ofiere-page-loader__ring-wrap">
                        <svg
                            className="ofiere-page-loader__ring"
                            viewBox="0 0 80 80"
                            fill="none"
                        >
                            {/* Outer orbit track */}
                            <circle
                                cx="40" cy="40" r="34"
                                stroke="oklch(0.75 0.18 55 / 0.08)"
                                strokeWidth="1"
                            />
                            {/* Inner orbit track */}
                            <circle
                                cx="40" cy="40" r="24"
                                stroke="oklch(0.75 0.18 55 / 0.05)"
                                strokeWidth="0.5"
                            />
                            {/* Sweeping arc — primary */}
                            <circle
                                cx="40" cy="40" r="34"
                                stroke="url(#ofiere-loader-grad)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeDasharray="50 164"
                                className="ofiere-page-loader__arc ofiere-page-loader__arc--primary"
                            />
                            {/* Sweeping arc — secondary (counter-rotate) */}
                            <circle
                                cx="40" cy="40" r="24"
                                stroke="url(#ofiere-loader-grad2)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeDasharray="30 121"
                                className="ofiere-page-loader__arc ofiere-page-loader__arc--secondary"
                            />
                            {/* Center glow dot */}
                            <circle
                                cx="40" cy="40" r="3"
                                className="ofiere-page-loader__core"
                            />
                            <defs>
                                <linearGradient id="ofiere-loader-grad" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="oklch(0.78 0.18 55)" stopOpacity="1" />
                                    <stop offset="100%" stopColor="oklch(0.78 0.18 55)" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="ofiere-loader-grad2" x1="80" y1="0" x2="0" y2="80" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="oklch(0.72 0.14 30)" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="oklch(0.72 0.14 30)" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    {/* Text block */}
                    <div className="ofiere-page-loader__info">
                        <span className="ofiere-page-loader__status">Loading module…</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
