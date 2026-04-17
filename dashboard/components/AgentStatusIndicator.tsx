"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AgentStatusIndicatorProps {
    status: 'online' | 'active' | 'thinking' | 'error' | 'offline' | 'external';
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    className?: string;
}

const sizeMap = {
    sm: 8,
    md: 12,
    lg: 16,
};

const labelMap = {
    online: 'Online',
    active: 'Active',
    thinking: 'Thinking...',
    error: 'Error',
    offline: 'Offline',
    external: 'External',
};

const fontMap = {
    sm: 9,
    md: 11,
    lg: 13,
};

export const AgentStatusIndicator = React.memo(({
    status,
    size = 'md',
    showLabel = false,
    className
}: AgentStatusIndicatorProps) => {
    const dotSize = sizeMap[size];

    const renderIndicator = () => {
        switch (status) {
            case 'online':
                return (
                    <motion.div
                        layout={false}
                        animate={{ scale: [0.85, 1.0, 0.85] }}
                        transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity }}
                        style={{
                            width: dotSize,
                            height: dotSize,
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-lime)',
                            boxShadow: '0 0 0 2px oklch(from var(--accent-lime) l c h / 0.2)',
                            willChange: 'transform'
                        }}
                    />
                );
            case 'active':
                return (
                    <motion.div
                        layout={false}
                        animate={{
                            scale: [0.8, 1.15, 0.8],
                            boxShadow: [
                                '0 0 0px oklch(from var(--accent-base) l c h / 0.4)',
                                '0 0 6px oklch(from var(--accent-base) l c h / 0.4)',
                                '0 0 0px oklch(from var(--accent-base) l c h / 0.4)'
                            ]
                        }}
                        transition={{ duration: 1, ease: "easeInOut", repeat: Infinity }}
                        style={{
                            width: dotSize,
                            height: dotSize,
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-base)',
                            willChange: 'transform, box-shadow'
                        }}
                    />
                );
            case 'thinking':
                const thinkDotSize = dotSize * 0.6;
                return (
                    <div style={{ display: 'flex', gap: '4px', width: dotSize, justifyContent: 'center', alignItems: 'center' }}>
                        {[0, 150, 300].map((delay, index) => (
                            <motion.div
                                key={index}
                                layout={false}
                                animate={{ translateY: [0, -4, 0] }}
                                transition={{ duration: 0.6, ease: "easeInOut", repeat: Infinity, delay: delay / 1000 }}
                                style={{
                                    width: thinkDotSize,
                                    height: thinkDotSize,
                                    borderRadius: '50%',
                                    backgroundColor: 'var(--accent-violet)',
                                    willChange: 'transform',
                                    flexShrink: 0
                                }}
                            />
                        ))}
                    </div>
                );
            case 'error':
                return (
                    <motion.div
                        layout={false}
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], repeat: Infinity }}
                        style={{
                            width: dotSize,
                            height: dotSize,
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-coral)',
                            boxShadow: '0 0 0 2px oklch(from var(--accent-coral) l c h / 0.25)',
                            willChange: 'opacity'
                        }}
                    />
                );
            case 'offline':
                return (
                    <div
                        style={{
                            width: dotSize,
                            height: dotSize,
                            borderRadius: '50%',
                            backgroundColor: 'var(--status-offline)',
                            opacity: 0.4,
                        }}
                    />
                );
            case 'external':
                return (
                    <div style={{ position: 'relative', width: dotSize, height: dotSize, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.div
                            layout={false}
                            animate={{ scale: [1.0, 2.2], opacity: [0.5, 0] }}
                            transition={{ duration: 2, ease: "easeOut", repeat: Infinity }}
                            style={{
                                position: 'absolute',
                                width: dotSize,
                                height: dotSize,
                                borderRadius: '50%',
                                border: '1.5px solid var(--accent-ocean)',
                                willChange: 'transform, opacity'
                            }}
                        />
                        <div
                            style={{
                                width: dotSize,
                                height: dotSize,
                                borderRadius: '50%',
                                backgroundColor: 'var(--accent-ocean)',
                                zIndex: 1
                            }}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    const getColorVar = () => {
        switch (status) {
            case 'online': return 'var(--accent-lime)';
            case 'active': return 'var(--accent-base)';
            case 'thinking': return 'var(--accent-violet)';
            case 'error': return 'var(--accent-coral)';
            case 'offline': return 'var(--status-offline)';
            case 'external': return 'var(--accent-ocean)';
            default: return 'var(--text-primary)';
        }
    };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {renderIndicator()}
            {showLabel && (
                <span
                    className="ofiere-badge-text"
                    style={{
                        color: `oklch(from ${getColorVar()} l c h / 0.8)`,
                        fontSize: `${fontMap[size]}px`,
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}
                >
                    {labelMap[status]}
                </span>
            )}
        </div>
    );
});

AgentStatusIndicator.displayName = 'AgentStatusIndicator';
export default AgentStatusIndicator;
