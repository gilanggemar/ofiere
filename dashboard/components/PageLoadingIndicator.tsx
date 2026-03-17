"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

/**
 * PageLoadingIndicator — Glassmorphic bottom-left overlay that shows
 * during Next.js page transitions. Persists until the page is truly idle
 * (requestIdleCallback fires after pathname change).
 */
export function PageLoadingIndicator() {
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(false);
    const prevPathRef = useRef(pathname);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // When a navigation starts (click on a link), show indicator
    const startLoading = useCallback(() => {
        setIsLoading(true);
        // Safety: auto-hide after 12 seconds max
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsLoading(false), 12000);
    }, []);

    // When navigation completes AND page is idle, hide indicator
    const finishLoading = useCallback(() => {
        // Wait for browser to be idle (page has finished rendering)
        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            (window as any).requestIdleCallback(() => {
                // Add a small delay to ensure paint is complete
                setTimeout(() => {
                    setIsLoading(false);
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                }, 150);
            }, { timeout: 3000 });
        } else {
            // Fallback: wait 800ms after pathname change
            setTimeout(() => {
                setIsLoading(false);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }, 800);
        }
    }, []);

    // Detect pathname change → page finished navigating, wait for idle
    useEffect(() => {
        if (pathname !== prevPathRef.current) {
            prevPathRef.current = pathname;
            finishLoading();
        }
    }, [pathname, finishLoading]);

    // Intercept link clicks to detect navigation start
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement)?.closest?.("a");
            if (!anchor) return;

            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
            if (anchor.target === "_blank") return;

            // Only show if navigating to a different page
            if (href !== pathname && !href.startsWith(pathname + "#")) {
                startLoading();
            }
        };

        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, [pathname, startLoading]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <AnimatePresence>
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                    className="nerv-page-loading-indicator"
                >
                    <div className="nerv-page-loading-indicator__orb" />
                    <Loader2 className="nerv-page-loading-indicator__spinner" />
                    <span className="nerv-page-loading-indicator__text">
                        Loading…
                    </span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
