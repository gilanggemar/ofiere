'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { usePinnedChatStore, SnapPosition } from '@/stores/usePinnedChatStore';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { X as XIcon } from 'lucide-react';

const ORB_SIZE = 52;
const MARGIN = 24;

/* Compute absolute top/left for a snap position (always using top+left, never bottom/right,
   so CSS transitions animate smoothly between any two corners) */
function getSnapXY(pos: SnapPosition): { x: number; y: number } {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
    switch (pos) {
        case 'top-left':     return { x: MARGIN, y: MARGIN };
        case 'top-right':    return { x: vw - ORB_SIZE - MARGIN, y: MARGIN };
        case 'bottom-left':  return { x: MARGIN, y: vh - ORB_SIZE - MARGIN };
        case 'bottom-right': return { x: vw - ORB_SIZE - MARGIN, y: vh - ORB_SIZE - MARGIN };
    }
}

/* Determine nearest snap corner from center coordinates */
function nearestCorner(cx: number, cy: number): SnapPosition {
    const midX = window.innerWidth / 2;
    const midY = window.innerHeight / 2;
    if (cx <= midX && cy <= midY) return 'top-left';
    if (cx > midX && cy <= midY) return 'top-right';
    if (cx <= midX && cy > midY) return 'bottom-left';
    return 'bottom-right';
}

export function PinnedChatOrb() {
    const { pinnedChat, snapPosition, setSnapPosition, togglePopover, unpinChat, isPopoverOpen, unreadCount } = usePinnedChatStore();
    const [isDragging, setIsDragging] = useState(false);
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    // For smooth snapping: track the resolved snap coordinates
    const [snapXY, setSnapXY] = useState<{ x: number; y: number }>(() => getSnapXY(snapPosition));
    const dragStartRef = useRef<{ x: number; y: number; time: number; orbX: number; orbY: number } | null>(null);
    const orbRef = useRef<HTMLDivElement>(null);

    // Recompute snap coords when position or window changes
    useEffect(() => {
        setSnapXY(getSnapXY(snapPosition));
        const handleResize = () => setSnapXY(getSnapXY(snapPosition));
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [snapPosition]);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const currentXY = getSnapXY(snapPosition);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            time: Date.now(),
            orbX: currentXY.x,
            orbY: currentXY.y,
        };
        setDragPos({ x: currentXY.x, y: currentXY.y });
        setIsDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [snapPosition]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging || !dragStartRef.current) return;
        e.preventDefault();

        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        let newX = dragStartRef.current.orbX + dx;
        let newY = dragStartRef.current.orbY + dy;

        // Clamp to viewport
        newX = Math.max(8, Math.min(newX, window.innerWidth - ORB_SIZE - 8));
        newY = Math.max(8, Math.min(newY, window.innerHeight - ORB_SIZE - 8));

        setDragPos({ x: newX, y: newY });
    }, [isDragging]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);

        const wasClick = dragStartRef.current && (Date.now() - dragStartRef.current.time < 200) &&
            Math.abs(e.clientX - dragStartRef.current.x) < 5 &&
            Math.abs(e.clientY - dragStartRef.current.y) < 5;

        if (wasClick) {
            setIsDragging(false);
            setDragPos(null);
            dragStartRef.current = null;
            togglePopover();
            return;
        }

        // Snap to nearest corner
        if (dragPos) {
            const cx = dragPos.x + ORB_SIZE / 2;
            const cy = dragPos.y + ORB_SIZE / 2;
            const corner = nearestCorner(cx, cy);

            // Animate from current drag position to the snap corner
            const target = getSnapXY(corner);
            setSnapXY(target);
            setSnapPosition(corner);
        }

        setIsDragging(false);
        setDragPos(null);
        dragStartRef.current = null;
    }, [isDragging, dragPos, setSnapPosition, togglePopover]);

    const handleClose = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        unpinChat();
    }, [unpinChat]);

    if (!pinnedChat) return null;

    // During drag: use dragPos directly, no transition
    // After drag: use snapXY with smooth transition
    const positionStyle: React.CSSProperties = isDragging && dragPos
        ? {
            position: 'fixed',
            left: dragPos.x,
            top: dragPos.y,
            transition: 'none',
          }
        : {
            position: 'fixed',
            left: snapXY.x,
            top: snapXY.y,
            transition: 'left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          };

    return (
        <div
            ref={orbRef}
            className="ofiere-pinned-orb"
            style={{
                ...positionStyle,
                width: ORB_SIZE,
                height: ORB_SIZE,
                zIndex: 9998,
                cursor: isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                userSelect: 'none',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Glow ring */}
            <div
                className="ofiere-pinned-orb__ring"
                style={{
                    position: 'absolute',
                    inset: -3,
                    borderRadius: '50%',
                    border: `2px solid ${isPopoverOpen ? 'var(--accent-base)' : 'rgba(255,109,41,0.4)'}`,
                    animation: isPopoverOpen ? 'none' : 'ofiere-orb-pulse 2.5s ease-in-out infinite',
                    transition: 'border-color 0.2s',
                }}
            />

            {/* Avatar */}
            <div style={{
                width: ORB_SIZE,
                height: ORB_SIZE,
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'var(--popover)',
                border: '2px solid var(--border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            }}>
                <AgentAvatar
                    agentId={pinnedChat.agentId}
                    name={pinnedChat.agentName}
                    size={ORB_SIZE - 4}
                    className="rounded-full"
                />
            </div>

            {/* Online indicator dot */}
            <div style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: 'var(--status-online, #22C55E)',
                border: '2px solid var(--popover)',
            }} />

            {/* Unread badge */}
            {unreadCount > 0 && !isPopoverOpen && (
                <div style={{
                    position: 'absolute',
                    top: -6,
                    left: -4,
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    background: 'var(--accent-base, #FF6D29)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 5px',
                    boxShadow: '0 2px 8px rgba(255,109,41,0.4)',
                    border: '2px solid var(--popover)',
                    zIndex: 3,
                    animation: 'ofiere-badge-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                </div>
            )}

            {/* Close button on hover */}
            <div
                onClick={handleClose}
                style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'var(--popover)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    opacity: isHovered ? 1 : 0,
                    transform: isHovered ? 'scale(1)' : 'scale(0.6)',
                    transition: 'opacity 0.15s, transform 0.15s',
                    pointerEvents: isHovered ? 'auto' : 'none',
                    zIndex: 2,
                }}
            >
                <XIcon style={{ width: 11, height: 11, color: 'var(--muted-foreground)' }} />
            </div>
        </div>
    );
}
