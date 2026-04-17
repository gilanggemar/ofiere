'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Play, Calendar, Clock, Repeat, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useSchedulerStore, type SchedulerEvent } from '@/store/useSchedulerStore';
import { useAvailableAgents } from '@/hooks/useAvailableAgents';

// ─── Day-of-week toggle ─────────────────────────────────────────────────────

const DAYS = [
    { value: 0, label: 'S' },
    { value: 1, label: 'M' },
    { value: 2, label: 'T' },
    { value: 3, label: 'W' },
    { value: 4, label: 'T' },
    { value: 5, label: 'F' },
    { value: 6, label: 'S' },
];

function DayToggle({
    activeDays, onChange,
}: { activeDays: number[]; onChange: (days: number[]) => void }) {
    const toggle = (day: number) => {
        if (activeDays.includes(day)) {
            onChange(activeDays.filter(d => d !== day));
        } else {
            onChange([...activeDays, day]);
        }
    };

    return (
        <div className="flex items-center gap-1">
            {DAYS.map(({ value, label }) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => toggle(value)}
                    className={cn(
                        'w-7 h-7 rounded-full text-xs font-medium transition-all duration-150',
                        activeDays.includes(value)
                            ? 'bg-[var(--accent-base)] text-[var(--text-on-accent)]'
                            : 'bg-white/[0.06] text-[var(--text-muted)] hover:bg-white/[0.1]',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function EventDetailPanel() {
    const {
        selectedEventId, events,
        setSelectedEvent, updateEvent, deleteEvent, executeEvent,
    } = useSchedulerStore();
    const agents = useAvailableAgents();

    const event = useMemo(() =>
        events.find(e => e.id === selectedEventId) || null,
        [events, selectedEventId]);

    // Local form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [priority, setPriority] = useState<string>('medium');
    const [recurrenceType, setRecurrenceType] = useState<string>('none');
    const [recurrenceInterval, setRecurrenceInterval] = useState(1);
    const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([]);
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

    // Sync form state with selected event
    useEffect(() => {
        if (!event) return;
        setTitle(event.title || '');
        setDescription(event.description || '');
        setScheduledDate(event.scheduledDate || '');
        setScheduledTime(event.scheduledTime || '');
        setDurationMinutes(event.durationMinutes || 30);
        // Priority may come as integer from DB — convert to string label
        const priorityMap: Record<number, string> = { 0: 'low', 1: 'medium', 2: 'high', 3: 'critical' };
        const p = event.priority;
        setPriority(typeof p === 'number' ? (priorityMap[p] || 'medium') : (p || 'medium'));
        setRecurrenceType(event.recurrenceType || 'none');
        setRecurrenceInterval(event.recurrenceInterval || 1);
        setRecurrenceDaysOfWeek(event.recurrenceDaysOfWeek || []);
        setRecurrenceEndDate(event.recurrenceEndDate || '');
    }, [event]);

    if (!event) return null;

    const handleSave = async () => {
        await updateEvent(event.id, {
            title,
            description: description || null,
            scheduledDate,
            scheduledTime: scheduledTime || null,
            durationMinutes,
            priority: priority as SchedulerEvent['priority'],
            recurrenceType: recurrenceType as SchedulerEvent['recurrenceType'],
            recurrenceInterval,
            recurrenceDaysOfWeek: recurrenceDaysOfWeek.length > 0 ? recurrenceDaysOfWeek : null,
            recurrenceEndDate: recurrenceEndDate || null,
        });
        toast.success('Event updated');
    };

    const handleDelete = async () => {
        await deleteEvent(event.id);
        setSelectedEvent(null);
        toast.success('Event deleted');
    };

    const handleExecute = async () => {
        await executeEvent(event.id);
        toast.success(`Executing "${event.title}"`);
    };

    const recurrenceLabel = recurrenceType === 'hourly' ? 'hours'
        : recurrenceType === 'daily' ? 'days'
            : recurrenceType === 'weekly' ? 'weeks'
                : recurrenceType === 'monthly' ? 'months'
                    : '';

    return (
        <AnimatePresence>
            {selectedEventId && (
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="ofiere-glass-3 border-t border-white/[0.08] p-6 max-h-[40vh] overflow-y-auto"
                >
                    {/* ─── Top bar ─── */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="ofiere-h2 bg-transparent border-none px-0 h-auto focus-visible:ring-0 font-semibold text-[var(--text-primary)]"
                            />
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            {(() => {
                                const agent = agents.find((a: any) => a.id === event.agentId);
                                return agent ? <span className="ofiere-body-sm opacity-70">{agent.name}</span> : null;
                            })()}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="ofiere-glass-3">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Event</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete &quot;{event.title}&quot;. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDelete}
                                            className="bg-destructive hover:bg-destructive/90"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button
                                variant="ghost" size="icon"
                                onClick={() => setSelectedEvent(null)}
                                className="h-7 w-7"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* ─── Description ─── */}
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add a description..."
                        className="mb-4 min-h-[40px] bg-white/[0.04] border-white/[0.06] text-sm resize-none text-[var(--text-primary)]"
                    />

                    <div className="grid grid-cols-2 gap-6">
                        {/* ─── Schedule section ─── */}
                        <div>
                            <h4 className="ofiere-section mb-3 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" /> Schedule
                            </h4>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="ofiere-caption mb-1 block">Date</label>
                                    <Input
                                        type="date"
                                        value={scheduledDate}
                                        onChange={(e) => setScheduledDate(e.target.value)}
                                        className="h-8 text-xs bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="ofiere-caption mb-1 block">Time</label>
                                    <Input
                                        type="time"
                                        value={scheduledTime}
                                        onChange={(e) => setScheduledTime(e.target.value)}
                                        className="h-8 text-xs bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]"
                                    />
                                </div>
                                <div>
                                    <label className="ofiere-caption mb-1 block">Duration</label>
                                    <Input
                                        type="number"
                                        value={durationMinutes}
                                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                        min={5}
                                        className="h-8 text-xs bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]"
                                    />
                                </div>
                            </div>
                            <div className="mt-3">
                                <label className="ofiere-caption mb-1 block">Priority</label>
                                <Select value={priority} onValueChange={setPriority}>
                                    <SelectTrigger className="h-8 text-xs bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="ofiere-glass-3">
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* ─── Recurrence section ─── */}
                        <div>
                            <h4 className="ofiere-section mb-3 flex items-center gap-1.5">
                                <Repeat className="w-3.5 h-3.5" /> Recurrence
                            </h4>
                            <div className="space-y-2">
                                <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                                    <SelectTrigger className="h-8 text-xs bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="ofiere-glass-3">
                                        <SelectItem value="none">No recurrence</SelectItem>
                                        <SelectItem value="hourly">Hourly</SelectItem>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>

                                {recurrenceType !== 'none' && (
                                    <div className="flex items-center gap-2">
                                        <span className="ofiere-caption">Every</span>
                                        <Input
                                            type="number"
                                            value={recurrenceInterval}
                                            onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                                            min={1}
                                            className="w-16 h-7 text-xs bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]"
                                        />
                                        <span className="ofiere-caption">{recurrenceLabel}</span>
                                    </div>
                                )}

                                {recurrenceType === 'weekly' && (
                                    <div>
                                        <label className="ofiere-caption mb-1.5 block">Days of Week</label>
                                        <DayToggle
                                            activeDays={recurrenceDaysOfWeek}
                                            onChange={setRecurrenceDaysOfWeek}
                                        />
                                    </div>
                                )}

                                {recurrenceType !== 'none' && (
                                    <div>
                                        <label className="ofiere-caption mb-1 block">Until (optional)</label>
                                        <Input
                                            type="date"
                                            value={recurrenceEndDate}
                                            onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                            className="h-8 text-xs bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ─── Execution history ─── */}
                    {event.runCount > 0 && (
                        <div className="mt-4 border-t border-white/[0.06] pt-3">
                            <h4 className="ofiere-section mb-2">Execution History</h4>
                            <div className="ofiere-caption space-y-1">
                                <div className="flex items-center gap-2">
                                    <span>Runs: {event.runCount}</span>
                                    {event.lastRunAt && (
                                        <span>• Last: {format(new Date(event.lastRunAt * 1000), 'MMM d, HH:mm')}</span>
                                    )}
                                    <span>• Status: {event.status}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── Action buttons ─── */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.06]">
                        <Button
                            size="sm"
                            onClick={handleSave}
                            className="gap-1.5 bg-[var(--accent-base)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)]"
                        >
                            <Save className="w-3.5 h-3.5" />
                            Save Changes
                        </Button>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExecute}
                                className="gap-1.5"
                            >
                                <Play className="w-3.5 h-3.5" />
                                Execute Now
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedEvent(null)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
