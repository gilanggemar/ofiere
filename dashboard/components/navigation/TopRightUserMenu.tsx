"use client";

import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useThemeStore } from "@/store/useThemeStore";
import { Sun, Moon, LogOut, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLayoutStore } from "@/store/useLayoutStore";

export function TopRightUserMenu() {
    const user = useAuthStore((s) => s.user);
    const signOut = useAuthStore((s) => s.signOut);
    const { theme, setTheme } = useThemeStore();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const isDark = theme === "dark" || theme === "system";

    const handleSignOut = async () => {
        await signOut();
        window.location.href = "/login";
    };

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    const initial = user?.email?.[0]?.toUpperCase() || "N";
    
    const isExpanded = useLayoutStore((s) => s.isTopRightExpanded);
    const setExpanded = useLayoutStore((s) => s.setTopRightExpanded);

    return (
        <div 
            className="fixed bottom-0 right-[9px] w-[48px] z-30 flex flex-col items-center pb-[10px] pt-6 px-2" 
            ref={ref}
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => { if (!open) setExpanded(false); }}
        >
            {/* Avatar button — only visible when notch is expanded */}
            {isExpanded ? (
                <motion.div
                    key="avatar-content"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                >
                    <button
                        onClick={() => setOpen(!open)}
                        className="ofiere-avatar-btn"
                        title={user?.email || "Account"}
                    >
                        {initial}
                    </button>
                </motion.div>
            ) : (
                <div
                    className="absolute bottom-[10px] h-4 w-4 flex items-center justify-center cursor-pointer"
                    style={{ color: 'var(--accent-base, #FF6D29)', filter: 'drop-shadow(0 0 4px rgba(255,109,41,0.5))' }}
                >
                    <ChevronDown className="w-4 h-4 rotate-180" />
                </div>
            )}

            {open && (
                <div className="ofiere-user-dropdown" style={{ position: 'absolute', bottom: '100%', top: 'auto', right: 0, marginBottom: 4 }}>
                    {/* User email */}
                    {user?.email && (
                        <div className="px-3 py-2 border-b border-border/50">
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {user.email}
                            </p>
                        </div>
                    )}

                    {/* Theme toggle */}
                    <button
                        onClick={() => setTheme(isDark ? "light" : "dark")}
                        className="ofiere-dropdown-item"
                    >
                        {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        <span>{isDark ? "Light mode" : "Dark mode"}</span>
                    </button>

                    {/* Logout */}
                    <button onClick={handleSignOut} className="ofiere-dropdown-item">
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign out</span>
                    </button>
                </div>
            )}
        </div>
    );
}
