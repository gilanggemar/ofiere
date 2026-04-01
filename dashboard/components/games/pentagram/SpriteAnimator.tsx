"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// DEPRECATED: This module is replaced by ImageSequenceAnimator.tsx
// Kept for reference. AnimationMapping is defined locally to avoid broken import.
interface AnimationMapping {
    spriteSheetUrl: string;
    frameCount: number;
    frameWidth: number;
    frameHeight: number;
    frameDuration: number;
    pingPong?: boolean;
    loop?: boolean;
}

interface SpriteAnimatorProps {
    animation: AnimationMapping;
    /** Trigger a single play-through (increment to replay) */
    triggerKey?: number;
    /** Override: force a specific frame (for manual control) */
    forceFrame?: number;
    /** CSS class for the canvas wrapper */
    className?: string;
    /** Callback when a single play-through completes */
    onComplete?: () => void;
    /** If true, animation is paused */
    paused?: boolean;
    /** Scale multiplier for rendering (default 1) */
    renderScale?: number;
}

/**
 * SpriteAnimator — renders a sprite sheet animation on a canvas.
 * Supports looping, ping-pong, triggered single plays, and manual frame control.
 */
export function SpriteAnimator({
    animation,
    triggerKey,
    forceFrame,
    className = "",
    onComplete,
    paused = false,
    renderScale = 1
}: SpriteAnimatorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const frameRef = useRef(0);
    const directionRef = useRef(1); // 1 = forward, -1 = backward (for ping-pong)
    const rafRef = useRef<number>(0);
    const lastFrameTimeRef = useRef(0);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Load sprite sheet
    useEffect(() => {
        if (!animation.spriteSheetUrl) return;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            imageRef.current = img;
            setImageLoaded(true);
        };
        img.onerror = () => {
            console.error(`[SpriteAnimator] Failed to load: ${animation.spriteSheetUrl}`);
        };
        img.src = animation.spriteSheetUrl;

        return () => {
            img.onload = null;
            img.onerror = null;
        };
    }, [animation.spriteSheetUrl]);

    // Reset frame on trigger change
    useEffect(() => {
        frameRef.current = 0;
        directionRef.current = 1;
    }, [triggerKey]);

    // Animation loop
    const drawFrame = useCallback((currentFrame: number) => {
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (!canvas || !img) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const { frameWidth, frameHeight, frameCount } = animation;
        // Calculate columns in the sprite sheet
        const cols = Math.floor(img.width / frameWidth);
        const frame = Math.min(currentFrame, frameCount - 1);
        const sx = (frame % cols) * frameWidth;
        const sy = Math.floor(frame / cols) * frameHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sx, sy, frameWidth, frameHeight, 0, 0, canvas.width, canvas.height);
    }, [animation]);

    useEffect(() => {
        if (!imageLoaded || !canvasRef.current) return;

        // If we have a forced frame, just draw it
        if (forceFrame !== undefined) {
            drawFrame(forceFrame);
            return;
        }

        if (paused) {
            drawFrame(frameRef.current);
            return;
        }

        const { frameDuration, frameCount, pingPong, loop } = animation;
        lastFrameTimeRef.current = performance.now();

        const tick = (now: number) => {
            const elapsed = now - lastFrameTimeRef.current;
            if (elapsed >= frameDuration) {
                lastFrameTimeRef.current = now;

                if (pingPong) {
                    frameRef.current += directionRef.current;
                    if (frameRef.current >= frameCount - 1) {
                        directionRef.current = -1;
                    } else if (frameRef.current <= 0) {
                        directionRef.current = 1;
                        if (!loop) {
                            drawFrame(0);
                            onComplete?.();
                            return;
                        }
                    }
                } else {
                    frameRef.current++;
                    if (frameRef.current >= frameCount) {
                        if (loop) {
                            frameRef.current = 0;
                        } else {
                            frameRef.current = frameCount - 1;
                            drawFrame(frameRef.current);
                            onComplete?.();
                            return;
                        }
                    }
                }

                drawFrame(frameRef.current);
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        drawFrame(frameRef.current);
        rafRef.current = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafRef.current);
        };
    }, [imageLoaded, animation, paused, forceFrame, triggerKey, drawFrame, onComplete]);

    const displayW = animation.frameWidth * renderScale;
    const displayH = animation.frameHeight * renderScale;

    return (
        <canvas
            ref={canvasRef}
            width={displayW}
            height={displayH}
            className={className}
            style={{ imageRendering: "auto" }}
        />
    );
}
