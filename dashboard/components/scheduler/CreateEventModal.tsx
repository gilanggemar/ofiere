'use client';

import { useState, useMemo } from 'react';
import { Calendar, Clock, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useSchedulerStore, type SchedulerEvent } from '@/store/useSchedulerStore';
import { useAvailableAgents } from '@/hooks/useAvailableAgents';
import { useTaskStore } from '@/lib/useTaskStore';

// ─── Day-of-week toggle (reused) ────────────────────────────────────────────

const DAYS = [
    { value: 0, label: 'S' },
    { value: 1, label: 'M' },
    { value: 2, label: 'T' },
    { value: 3, label: 'W' },
    { value: 4, label: 'T' },
    { value: 5, label: 'F' },
    { value: 6, label: 'S' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function CreateEventModal() {
    const {
        createModalOpen, createModalDate,
        setCreateModalOpen, createEvent,
    } = useSchedulerStore();
    const socketAgents = useAvailableAgents();
    const tasks = useTaskStore((s) => s.tasks);

    // Fallback agents when WebSocket hasn't connected yet
    const FALLBACK_AGENTS = useMemo(() => [
        { id: 'daisy', name: 'Daisy' },
        { id: 'ivy', name: 'Ivy' },
        { id: 'celia', name: 'Celia' },
        { id: 'thalia', name: 'Thalia' },
    ], []);
    const agentList = (socketAgents.length > 0 ? socketAgents : FALLBACK_AGENTS).filter((a: any) => a.id);
    const pendingTasks = useMemo(() =>
        tasks.filter(t => t.status === 'PENDING'),
        [tasks]);

    // Form state
    const [title, setTitle] = useState('');
    const [agentId, setAgentId] = useState('');
    const [description, setDescription] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [priority, setPriority] = useState('medium');
    const [linkedTaskId, setLinkedTaskId] = useState<string>('');
    const [recurrenceType, setRecurrenceType] = useState('none');
    const [recurrenceInterval, setRecurrenceInterval] = useState(1);
    const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<number[]>([]);
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

    // Pre-fill date when opened from column quick-add
    const effectiveDate = scheduledDate || createModalDate || format(new Date(), 'yyyy-MM-dd');

    // Auto-fill from linked task
    const handleTaskLink = (taskId: string) => {
        const realTaskId = taskId === '__none__' ? '' : taskId;
        setLinkedTaskId(realTaskId);
        if (realTaskId && tasks.find(t => t.id === realTaskId)) {
            const task = tasks.find(t => t.id === taskId)!;
            if (!title) setTitle(task.title);
            if (!agentId) setAgentId(task.agentId);
            if (task.description && !description) setDescription(task.description);
        }
    };

    const resetForm = () => {
        setTitle('');
        setAgentId('');
        setDescription('');
        setScheduledDate('');
        setScheduledTime('');
        setDurationMinutes(60);
        setPriority('medium');
        setLinkedTaskId('');
        setRecurrenceType('none');
        setRecurrenceInterval(1);
        setRecurrenceDaysOfWeek([]);
        setRecurrenceEndDate('');
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            toast.error('Title is required');
            return;
        }
        if (!agentId) {
            toast.error('Agent is required');
            return;
        }

        await createEvent({
            title: title.trim(),
            agentId,
            description: description || null,
            scheduledDate: effectiveDate,
            scheduledTime: scheduledTime || null,
            durationMinutes,
            priority: priority as SchedulerEvent['priority'],
            taskId: linkedTaskId || null,
            recurrenceType: recurrenceType as SchedulerEvent['recurrenceType'],
            recurrenceInterval,
            recurrenceDaysOfWeek: recurrenceDaysOfWeek.length > 0 ? recurrenceDaysOfWeek : null,
            recurrenceEndDate: recurrenceEndDate || null,
        });

        toast.success('Event created');
        resetForm();
        setCreateModalOpen(false);
    };

    const recurrenceLabel = recurrenceType === 'hourly' ? 'hours'
        : recurrenceType === 'daily' ? 'days'
            : recurrenceType === 'weekly' ? 'weeks'
                : recurrenceType === 'monthly' ? 'months'
                    : '';

    return (
        <Dialog
            open={createModalOpen}
            onOpenChange={(open) => {
                if (!open) resetForm();
                setCreateModalOpen(open);
            }}
        >
            <DialogContent className="nerv-glass-3 max-w-lg">
                <DialogHeader>
                    <DialogTitle className="nerv-h2">Create Event</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Title */}
                    <div>
                        <label className="nerv-caption mb-1 block">Title *</label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Event title..."
                            className="bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]"
                        />
                    </div>

                    {/* Agent */}
                    <div>
                        <label className="nerv-caption mb-1 block">Agent *</label>
                        <Select value={agentId} onValueChange={setAgentId}>
                            <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]">
                                <SelectValue placeholder="Select agent..." />
                            </SelectTrigger>
                            <SelectContent className="nerv-glass-3">
                                {agentList.map((agent) => (
                                    <SelectItem key={agent.id} value={agent.id}>
                                        {agent.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="nerv-caption mb-1 block">Description</label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional description..."
                            className="bg-white/[0.04] border-white/[0.06] min-h-[60px] resize-none text-[var(--text-primary)]"
                        />
                    </div>

                    {/* Date + Time + Duration */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="nerv-caption mb-1 block flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Date *
                            </label>
                            <Input
                                type="date"
                                value={effectiveDate}
                                onChange={(e) => setScheduledDate(e.target.value)}
                                className="bg-white/[0.04] border-white/[0.06] text-sm text-[var(--text-primary)]"
                            />
                        </div>
                        <div>
                            <label className="nerv-caption mb-1 block flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Time
                            </label>
                            <Input
                                type="time"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                className="bg-white/[0.04] border-white/[0.06] text-sm text-[var(--text-primary)]"
                            />
                        </div>
                        <div>
                            <label className="nerv-caption mb-1 block">Duration (min)</label>
                            <Input
                                type="number"
                                value={durationMinutes}
                                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                min={5}
                                className="bg-white/[0.04] border-white/[0.06] text-sm text-[var(--text-primary)]"
                            />
                        </div>
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="nerv-caption mb-1 block">Priority</label>
                        <Select value={priority} onValueChange={setPriority}>
                            <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="nerv-glass-3">
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Link to task */}
                    {pendingTasks.length > 0 && (
                        <div>
                            <label className="nerv-caption mb-1 block">Link to Existing Task</label>
                            <Select value={linkedTaskId || '__none__'} onValueChange={handleTaskLink}>
                                <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]">
                                    <SelectValue placeholder="None (standalone event)" />
                                </SelectTrigger>
                                <SelectContent className="nerv-glass-3">
                                    <SelectItem value="__none__">None</SelectItem>
                                    {pendingTasks.map((task) => (
                                        <SelectItem key={task.id} value={task.id}>
                                            {task.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Recurrence */}
                    <div className="border-t border-white/[0.06] pt-3">
                        <label className="nerv-caption mb-2 block flex items-center gap-1">
                            <Repeat className="w-3 h-3" /> Recurrence
                        </label>
                        <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                            <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="nerv-glass-3">
                                <SelectItem value="none">No recurrence</SelectItem>
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                        </Select>

                        {recurrenceType !== 'none' && (
                            <div className="mt-2 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="nerv-caption">Every</span>
                                    <Input
                                        type="number"
                                        value={recurrenceInterval}
                                        onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
                                        min={1}
                                        className="w-16 h-7 text-xs bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]"
                                    />
                                    <span className="nerv-caption">{recurrenceLabel}</span>
                                </div>

                                {recurrenceType === 'weekly' && (
                                    <div>
                                        <label className="nerv-caption mb-1.5 block">Days of Week</label>
                                        <div className="flex items-center gap-1">
                                            {DAYS.map(({ value, label }) => (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    onClick={() => {
                                                        setRecurrenceDaysOfWeek(prev =>
                                                            prev.includes(value)
                                                                ? prev.filter(d => d !== value)
                                                                : [...prev, value]
                                                        );
                                                    }}
                                                    className={cn(
                                                        'w-7 h-7 rounded-full text-xs font-medium transition-all',
                                                        recurrenceDaysOfWeek.includes(value)
                                                            ? 'bg-[var(--accent-base)] text-[var(--text-on-accent)]'
                                                            : 'bg-white/[0.06] text-[var(--text-muted)] hover:bg-white/[0.1]',
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="nerv-caption mb-1 block">Until (optional)</label>
                                    <Input
                                        type="date"
                                        value={recurrenceEndDate}
                                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                        className="h-8 text-xs bg-white/[0.04] border-white/[0.06] text-[var(--text-primary)]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => { resetForm(); setCreateModalOpen(false); }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-[var(--accent-base)] hover:bg-[var(--accent-hover)] text-[var(--text-on-accent)]"
                    >
                        Create Event
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
