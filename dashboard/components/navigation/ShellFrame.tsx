"use client";

import { useEffect, useState } from "react";
import { useLayoutStore } from "@/store/useLayoutStore";

/**
 * ShellFrame — Viewport-fixed SVG border.
 *
 * Top: U-notch at top-right for avatar.
 * Bottom: U-notch for dock.
 * The top-center rail notch has been removed — submenu now blooms from the dock.
 */
export function ShellFrame({ children }: { children: React.ReactNode }) {
    const [vp, setVp] = useState({ w: 0, h: 0 });

    useEffect(() => {
        const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    const { w: vw, h: vh } = vp;

    // Uniform margin
    const m = 10;
    const left = m;
    const top = m;
    const right = vw - m;
    const bottom = vh - m;
    const r = 6;

    // ─── Bottom dock notch ───
    const isDockExpanded = useLayoutStore((s) => s.isBottomDockExpanded);
    const dockW = isDockExpanded ? 196 : 64;
    const dockH = isDockExpanded ? 52 : 18;
    const dockCr = isDockExpanded ? 18 : 9;
    const cx = vw / 2;
    const dockLeft = cx - dockW / 2;
    const dockRight = cx + dockW / 2;
    const dockTop = bottom - dockH;

    // ─── Avatar notch (bottom-right) ───
    const isAvExpanded = useLayoutStore((s) => s.isTopRightExpanded);
    const avNotchLeft = vw - 61;
    const avNotchTop = bottom - (isAvExpanded ? 42 : 18);
    
    // Tuning radii carefully so expanded/collapsed states are perfectly smooth.
    // In collapsed (h=18): avCr(6) + avBottomCr(12) == 18. The curves meet at a perfect continuous vertical tangent.
    const avCr = isAvExpanded ? 18 : 6;
    const avOuterCr = isAvExpanded ? 18 : 12;
    const avBottomCr = isAvExpanded ? 18 : 12;

    // A single unified path for both states ensuring flawless CSS shape morphing
    const notchSegments = [
        `L ${right} ${avNotchTop - avOuterCr}`,
        `Q ${right} ${avNotchTop} ${right - avOuterCr} ${avNotchTop}`,
        `L ${avNotchLeft + avCr} ${avNotchTop}`,
        `Q ${avNotchLeft} ${avNotchTop} ${avNotchLeft} ${avNotchTop + avCr}`,
        `L ${avNotchLeft} ${bottom - avBottomCr}`,
        `Q ${avNotchLeft} ${bottom} ${avNotchLeft - avBottomCr} ${bottom}`,
    ];
    // ─── Build SVG path (clockwise) ───
    const framePath = vw > 0 ? [
        // ═══ TOP-LEFT CORNER ═══
        `M ${left + r} ${top}`,

        // ═══ TOP EDGE → straight to TOP-RIGHT CORNER ═══
        `L ${right - r} ${top}`,
        `Q ${right} ${top} ${right} ${top + r}`,

        // ═══ RIGHT EDGE → AVATAR NOTCH (bottom-right) ═══
        ...notchSegments,

        // ═══ BOTTOM EDGE → DOCK NOTCH ═══
        `L ${dockRight + dockCr} ${bottom}`,
        `Q ${dockRight} ${bottom} ${dockRight} ${bottom - dockCr}`,
        `L ${dockRight} ${dockTop + dockCr}`,
        `Q ${dockRight} ${dockTop} ${dockRight - dockCr} ${dockTop}`,
        `L ${dockLeft + dockCr} ${dockTop}`,
        `Q ${dockLeft} ${dockTop} ${dockLeft} ${dockTop + dockCr}`,
        `L ${dockLeft} ${bottom - dockCr}`,
        `Q ${dockLeft} ${bottom} ${dockLeft - dockCr} ${bottom}`,

        // ═══ BOTTOM-LEFT CORNER ═══
        `L ${left + r} ${bottom}`,
        `Q ${left} ${bottom} ${left} ${bottom - r}`,

        // ═══ LEFT EDGE ═══
        `L ${left} ${top + r}`,
        `Q ${left} ${top} ${left + r} ${top}`,

        `Z`
    ].join(' ') : '';

    const outerRect = `M 0 0 L ${vw} 0 L ${vw} ${vh} L 0 ${vh} Z`;

    return (
        <div className="ofiere-shell-frame">
            {vw > 0 && (
                <svg
                    className="ofiere-shell-frame__svg"
                    width={vw}
                    height={vh}
                    viewBox={`0 0 ${vw} ${vh}`}
                    fill="none"
                    aria-hidden="true"
                >
                    <path
                        d={`${outerRect} ${framePath}`}
                        fillRule="evenodd"
                        className="ofiere-shell-frame__fill"
                        style={{ transition: 'd 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}
                    />
                    <path
                        d={framePath}
                        fill="none"
                        className="ofiere-shell-frame__path"
                        strokeWidth="1.5"
                        style={{ transition: 'd 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}
                    />
                </svg>
            )}
            <div className="ofiere-shell-frame__content">
                {children}
                {/* Radial blur overlay — wraps the dock notch */}
                {vw > 0 && (
                <div
                    aria-hidden="true"
                    style={{
                        position: 'sticky',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        height: dockH * 7,
                        marginTop: -(dockH * 7),
                        pointerEvents: 'none',
                        zIndex: 5,
                        opacity: isDockExpanded ? 1 : 0,
                        transition: 'opacity 0.35s ease',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        background: 'rgba(0,0,0,1)',
                        WebkitMaskImage: `radial-gradient(ellipse ${dockW * 2}px ${dockH * 4}px at 50% 100%, black 0%, black 10%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.65) 30%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.1) 70%, rgba(0,0,0,0.03) 85%, transparent 100%)`,
                        maskImage: `radial-gradient(ellipse ${dockW * 2}px ${dockH * 4}px at 50% 100%, black 0%, black 10%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.65) 30%, rgba(0,0,0,0.45) 40%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.1) 70%, rgba(0,0,0,0.03) 85%, transparent 100%)`,
                        overflow: 'hidden',
                    }}
                >
                    {/* Dark grain noise with radial falloff */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.15 0 0 0 0 0.15 0 0 0 0 0.15 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'repeat',
                        opacity: 0.5,
                        mixBlendMode: 'multiply' as React.CSSProperties['mixBlendMode'],
                        WebkitMaskImage: `radial-gradient(ellipse ${dockW * 1.8}px ${dockH * 3.5}px at 50% 100%, black 0%, black 10%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0.15) 60%, transparent 100%)`,
                        maskImage: `radial-gradient(ellipse ${dockW * 1.8}px ${dockH * 3.5}px at 50% 100%, black 0%, black 10%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0.15) 60%, transparent 100%)`,
                    }} />
                </div>
                )}
            </div>
        </div>
    );
}
