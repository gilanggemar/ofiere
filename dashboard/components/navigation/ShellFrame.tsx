"use client";

import { useEffect, useState } from "react";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useNavigationStore } from "@/store/useNavigationStore";

/**
 * ShellFrame — Viewport-fixed SVG border.
 *
 * Top: inverted U-notch for rail (dynamic width) + U-notch at top-right for avatar.
 * Bottom: U-notch for dock.
 * Solid fill mask outside the frame.
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
    const r = 20;

    // ─── Bottom dock notch ───
    const isDockExpanded = useLayoutStore((s) => s.isBottomDockExpanded);
    const dockW = isDockExpanded ? 196 : 64;
    const dockH = isDockExpanded ? 52 : 18;
    const dockCr = isDockExpanded ? 18 : 9; // Dynamically calculated to prevent backwards lines
    const cx = vw / 2;
    const dockLeft = cx - dockW / 2;
    const dockRight = cx + dockW / 2;
    const dockTop = bottom - dockH;

    // ─── Top rail notch (inverted U, identical matching width to dock) ───
    const isRailExpanded = useLayoutStore((s) => s.isTopRailExpanded);
    const activeGroup = useNavigationStore((s) => s.activeGroup);

    // Map the active group to a specific width
    const getRailWidth = () => {
        switch (activeGroup) {
            case "PRIMARY": return 242; // 6 icons
            case "OPERATIONS": return 166; // 4 icons
            case "INTELLIGENCE": return 166; // 4 icons
            case "SETTINGS": return 64; // 1 icon (collapses into tab)
            default: return 242;
        }
    };

    // When expanded: dynamic symmetrical width. When collapsed: small tab.
    const railW = isRailExpanded ? getRailWidth() : 64;
    const railH = isRailExpanded ? 48 : 18;
    const railCr = isRailExpanded ? 12 : 9; // Ensures mathematically perfect tangency
    const railLeft = cx - railW / 2;
    const railRight = cx + railW / 2;
    const railBottom = top + railH;

    // ─── Avatar notch (U-shape merging into right edge) ───
    const isAvExpanded = useLayoutStore((s) => s.isTopRightExpanded);
    // Avatar letter sits at approx center (vw-38, 28)
    // Notch: left wall at ~vw-58, bottom at ~50px from top, right wall IS the frame right edge
    const avNotchLeft = vw - 61; // Reduced width by 5px
    const avNotchBottom = top + (isAvExpanded ? 42 : 18);
    const avCr = isAvExpanded ? 18 : 9; // Smoother curve when expanded, tangency when collapsed

    // ─── Build SVG path (clockwise) ───
    const framePath = vw > 0 ? [
        // ═══ TOP-LEFT CORNER ═══
        `M ${left + r} ${top}`,

        // ═══ TOP EDGE → RAIL NOTCH ═══
        `L ${railLeft - railCr} ${top}`,
        `Q ${railLeft} ${top} ${railLeft} ${top + railCr}`,
        `L ${railLeft} ${railBottom - railCr}`,
        `Q ${railLeft} ${railBottom} ${railLeft + railCr} ${railBottom}`,
        `L ${railRight - railCr} ${railBottom}`,
        `Q ${railRight} ${railBottom} ${railRight} ${railBottom - railCr}`,
        `L ${railRight} ${top + railCr}`,
        `Q ${railRight} ${top} ${railRight + railCr} ${top}`,

        // ═══ TOP EDGE → AVATAR NOTCH ═══
        `L ${avNotchLeft - avCr} ${top}`,
        // Corner: curve DOWN
        `Q ${avNotchLeft} ${top} ${avNotchLeft} ${top + avCr}`,
        // Left wall: DOWN
        `L ${avNotchLeft} ${avNotchBottom - avCr}`,
        // Corner: curve RIGHT
        `Q ${avNotchLeft} ${avNotchBottom} ${avNotchLeft + avCr} ${avNotchBottom}`,
        // Floor: RIGHT to the right frame edge MINUS the corner radius
        `L ${right - avCr} ${avNotchBottom}`,
        // Corner: curve UP to meet the right edge
        `Q ${right} ${avNotchBottom} ${right} ${avNotchBottom + avCr}`,

        // ═══ RIGHT EDGE ═══
        `L ${right} ${bottom - r}`,
        `Q ${right} ${bottom} ${right - r} ${bottom}`,

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
        <div className="nerv-shell-frame">
            {vw > 0 && (
                <svg
                    className="nerv-shell-frame__svg"
                    width={vw}
                    height={vh}
                    viewBox={`0 0 ${vw} ${vh}`}
                    fill="none"
                    aria-hidden="true"
                >
                    <path
                        d={`${outerRect} ${framePath}`}
                        fillRule="evenodd"
                        className="nerv-shell-frame__fill"
                        style={{ transition: 'd 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}
                    />
                    <path
                        d={framePath}
                        fill="none"
                        className="nerv-shell-frame__path"
                        strokeWidth="1.5"
                        style={{ transition: 'd 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}
                    />
                </svg>
            )}
            <div className="nerv-shell-frame__content">
                {children}
            </div>
        </div>
    );
}
