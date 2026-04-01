"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ImageSequenceMapping } from "@/lib/games/pentagram/types";

// ============================================================
// IMAGE SEQUENCE ANIMATOR
// Preloads individual frame images and cycles through them
// using requestAnimationFrame for smooth playback.
// ============================================================

export interface ImageSequenceAnimatorHandle {
    goToFrame: (index: number) => void;
    play: () => void;
    pause: () => void;
    getCurrentFrame: () => number;
}

interface ImageSequenceAnimatorProps {
    animation: ImageSequenceMapping;
    /** Incremented to trigger a one-shot play or restart */
    triggerKey?: number;
    className?: string;
    /** If provided, hold this frame index regardless of animation state */
    overrideFrame?: number;
}

export const ImageSequenceAnimator = forwardRef<ImageSequenceAnimatorHandle, ImageSequenceAnimatorProps>(
    function ImageSequenceAnimator({ animation, triggerKey = 0, className, overrideFrame }, ref) {
        const [loadedFrames, setLoadedFrames] = useState<HTMLImageElement[]>([]);
        const [currentFrame, setCurrentFrame] = useState(0);
        const [isPlaying, setIsPlaying] = useState(true);
        const [isLoading, setIsLoading] = useState(true);
        const [loadProgress, setLoadProgress] = useState(0);

        const rafRef = useRef<number>(0);
        const lastTickRef = useRef(0);
        const directionRef = useRef(1); // 1 = forward, -1 = backward (for ping-pong)
        const prevTriggerRef = useRef(triggerKey);
        const canvasRef = useRef<HTMLCanvasElement>(null);

        // Stable key for frame URLs — only re-preload when actual URLs change
        const frameUrlsKey = (animation.frameUrls || []).join('|');

        useEffect(() => {
            if (!animation.frameUrls || animation.frameUrls.length === 0) {
                setIsLoading(false);
                return;
            }

            let cancelled = false;
            const images: HTMLImageElement[] = [];
            let loaded = 0;

            setIsLoading(true);
            setLoadProgress(0);

            animation.frameUrls.forEach((url, i) => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    if (cancelled) return;
                    images[i] = img;
                    loaded++;
                    setLoadProgress(Math.round((loaded / animation.frameUrls.length) * 100));
                    if (loaded === animation.frameUrls.length) {
                        setLoadedFrames([...images]);
                        setIsLoading(false);
                    }
                };
                img.onerror = () => {
                    if (cancelled) return;
                    loaded++;
                    setLoadProgress(Math.round((loaded / animation.frameUrls.length) * 100));
                    if (loaded === animation.frameUrls.length) {
                        setLoadedFrames([...images]);
                        setIsLoading(false);
                    }
                };
                img.src = url;
            });

            return () => {
                cancelled = true;
            };
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [frameUrlsKey]);

        // Draw current frame to canvas
        useEffect(() => {
            const canvas = canvasRef.current;
            if (!canvas || loadedFrames.length === 0) return;

            const frameIndex = overrideFrame !== undefined ? overrideFrame : currentFrame;
            const img = loadedFrames[Math.min(frameIndex, loadedFrames.length - 1)];
            if (!img) return;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Set canvas dimensions to match first frame
            if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
        }, [currentFrame, loadedFrames, overrideFrame]);

        // Animation loop
        const frameRef = useRef(0);
        useEffect(() => {
            if (!isPlaying || isLoading || loadedFrames.length === 0) return;
            if (overrideFrame !== undefined) return; // Manual frame control

            const totalFrames = animation.frameCount || loadedFrames.length;
            if (totalFrames <= 1) return;

            const tick = (now: number) => {
                if (!lastTickRef.current) lastTickRef.current = now;
                const elapsed = now - lastTickRef.current;
                const dur = animation.frameDurations?.[frameRef.current] ?? animation.frameDuration;

                if (elapsed >= dur) {
                    lastTickRef.current = now;

                    setCurrentFrame((prev) => {
                        let next = prev + directionRef.current;

                        if (animation.pingPong) {
                            if (next >= totalFrames - 1) {
                                directionRef.current = -1;
                                next = totalFrames - 1;
                            } else if (next <= 0) {
                                directionRef.current = 1;
                                next = 0;
                                if (!animation.loop) {
                                    setIsPlaying(false);
                                    return prev;
                                }
                            }
                        } else {
                            if (next >= totalFrames) {
                                if (animation.loop) {
                                    next = 0;
                                } else {
                                    setIsPlaying(false);
                                    return totalFrames - 1;
                                }
                            }
                        }

                        frameRef.current = next;
                        return next;
                    });
                }

                rafRef.current = requestAnimationFrame(tick);
            };

            lastTickRef.current = 0;
            frameRef.current = currentFrame;
            rafRef.current = requestAnimationFrame(tick);
            return () => cancelAnimationFrame(rafRef.current);
        }, [isPlaying, isLoading, loadedFrames, animation]);

        // Trigger key: restart animation
        useEffect(() => {
            if (triggerKey !== prevTriggerRef.current) {
                prevTriggerRef.current = triggerKey;
                directionRef.current = 1;

                if (animation.triggerFrame !== undefined) {
                    setCurrentFrame(animation.triggerFrame);
                } else {
                    setCurrentFrame(0);
                }
                setIsPlaying(true);
            }
        }, [triggerKey, animation.triggerFrame]);

        // Imperative handle
        useImperativeHandle(ref, () => ({
            goToFrame: (index: number) => {
                setCurrentFrame(Math.max(0, Math.min(index, (animation.frameCount || loadedFrames.length) - 1)));
            },
            play: () => setIsPlaying(true),
            pause: () => setIsPlaying(false),
            getCurrentFrame: () => currentFrame,
        }), [currentFrame, animation.frameCount, loadedFrames.length]);

        // Loading state
        if (isLoading) {
            return (
                <div className={cn("flex items-center justify-center", className)}>
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                        <span className="text-[10px] text-white/40 font-mono">
                            LOADING {loadProgress}%
                        </span>
                    </div>
                </div>
            );
        }

        // No frames
        if (loadedFrames.length === 0) {
            return (
                <div className={cn("flex items-center justify-center bg-black/20 rounded-lg", className)}>
                    <span className="text-[10px] text-white/30 font-mono">NO FRAMES</span>
                </div>
            );
        }

        return (
            <canvas
                ref={canvasRef}
                className={cn("image-rendering-auto", className)}
                style={{ imageRendering: "auto" }}
            />
        );
    }
);
