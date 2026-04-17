'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bot, Cpu, Zap, Shield, Activity, Terminal, 
    Network, Layers, Code, Database, Globe, Server, ChevronDown
} from 'lucide-react';

const AVAILABLE_ICONS = [
    { id: 'bot', icon: Bot },
    { id: 'cpu', icon: Cpu },
    { id: 'zap', icon: Zap },
    { id: 'shield', icon: Shield },
    { id: 'activity', icon: Activity },
    { id: 'terminal', icon: Terminal },
    { id: 'network', icon: Network },
    { id: 'layers', icon: Layers },
    { id: 'code', icon: Code },
    { id: 'database', icon: Database },
    { id: 'globe', icon: Globe },
    { id: 'server', icon: Server },
];

interface AgentIconSelectorProps {
    agentId: string;
    colorHex: string;
}

export function AgentIconSelector({ agentId, colorHex }: AgentIconSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIconId, setSelectedIconId] = useState('bot');
    const containerRef = useRef<HTMLDivElement>(null);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(`ofiere_agent_icon_${agentId}`);
        if (saved && AVAILABLE_ICONS.some(icon => icon.id === saved)) {
            setSelectedIconId(saved);
        } else {
            // Default based on agentId if possible
            if (agentId === 'ivy') setSelectedIconId('code');
            else if (agentId === 'daisy') setSelectedIconId('globe');
            else if (agentId === 'celia') setSelectedIconId('layers');
            else if (agentId === 'thalia') setSelectedIconId('network');
            else if (agentId === 'agent-zero') setSelectedIconId('cpu');
            else setSelectedIconId('bot');
        }
    }, [agentId]);

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const SelectedIcon = AVAILABLE_ICONS.find(i => i.id === selectedIconId)?.icon || Bot;

    const handleSelect = (id: string) => {
        setSelectedIconId(id);
        localStorage.setItem(`ofiere_agent_icon_${agentId}`, id);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative z-20 w-16 h-16 flex-shrink-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-full flex flex-col items-center justify-center relative group cursor-pointer"
            >
                <SelectedIcon 
                    size={48} 
                    className="relative z-10 transition-transform duration-300 group-hover:scale-110" 
                    style={{ 
                        color: colorHex,
                        filter: `drop-shadow(0 0 12px ${colorHex}50)`
                    }} 
                />
                
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ChevronDown size={14} style={{ color: colorHex }} />
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-[72px] left-0 w-[180px] bg-black/90 backdrop-blur-xl border rounded-md shadow-2xl p-2 z-50 overflow-hidden"
                        style={{ borderColor: `${colorHex}40` }}
                    >
                        <div className="grid grid-cols-3 gap-1">
                            {AVAILABLE_ICONS.map(({ id, icon: Icon }) => {
                                const isSelected = id === selectedIconId;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => handleSelect(id)}
                                        className="p-3 rounded-md flex items-center justify-center transition-all duration-200 group relative"
                                        style={{
                                            backgroundColor: isSelected ? `${colorHex}20` : 'transparent',
                                            border: `1px solid ${isSelected ? colorHex : 'transparent'}`
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isSelected) {
                                                e.currentTarget.style.backgroundColor = `${colorHex}10`;
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isSelected) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }
                                        }}
                                    >
                                        <Icon 
                                            size={20} 
                                            style={{ 
                                                color: isSelected ? colorHex : '#888',
                                                filter: isSelected ? `drop-shadow(0 0 8px ${colorHex}80)` : 'none'
                                            }} 
                                            className="group-hover:scale-110 transition-transform"
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
