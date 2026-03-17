import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
    addDays, addWeeks, addMonths, addHours,
    parseISO, format, isAfter, isBefore, isEqual,
    eachDayOfInterval, getDay,
} from 'date-fns';
import { getAuthUserId } from '@/lib/auth';

// ─── Recurrence expansion helpers ────────────────────────────────────────────

interface SchedulerEventRow {
    id: string;
    task_id: string | null;
    agent_id: string;
    title: string;
    description: string | null;
    scheduled_date: string;
    scheduled_time: string | null;
    duration_minutes: number | null;
    recurrence_type: string | null;
    recurrence_interval: number | null;
    recurrence_end_date: string | null;
    recurrence_days_of_week: string | null;
    status: string | null;
    last_run_at: number | null;
    next_run_at: number | null;
    run_count: number | null;
    color: string | null;
    priority: number | null;
    created_at: string | null;
    updated_at: string | null;
}

function expandRecurrence(
    event: SchedulerEventRow,
    rangeStart: Date,
    rangeEnd: Date,
) {
    const type = event.recurrence_type || 'none';
    if (type === 'none') return [];

    const interval = event.recurrence_interval || 1;
    const origin = parseISO(event.scheduled_date);
    const endLimit = event.recurrence_end_date
        ? parseISO(event.recurrence_end_date)
        : rangeEnd;
    const daysOfWeek: number[] = event.recurrence_days_of_week
        ? JSON.parse(event.recurrence_days_of_week)
        : [];

    const instances: Array<SchedulerEventRow & { virtualDate: string; isVirtual: boolean }> = [];
    let cursor = origin;
    let safety = 0;

    while (safety++ < 1000) {
        let nextDate: Date;
        if (type === 'hourly') {
            nextDate = addHours(cursor, interval);
        } else if (type === 'daily') {
            nextDate = addDays(cursor, interval);
        } else if (type === 'weekly') {
            if (daysOfWeek.length > 0 && safety === 1) {
                const weekEnd = addWeeks(origin, interval);
                const days = eachDayOfInterval({ start: addDays(origin, 1), end: isBefore(weekEnd, endLimit) ? weekEnd : endLimit });
                for (const d of days) {
                    const dow = getDay(d);
                    if (daysOfWeek.includes(dow) && !isBefore(d, rangeStart) && !isAfter(d, rangeEnd) && !isAfter(d, endLimit)) {
                        instances.push({
                            ...event,
                            virtualDate: format(d, 'yyyy-MM-dd'),
                            isVirtual: true,
                        });
                    }
                }
            }
            nextDate = addWeeks(cursor, interval);
        } else if (type === 'monthly') {
            nextDate = addMonths(cursor, interval);
        } else {
            break;
        }

        cursor = nextDate;
        if (isAfter(cursor, endLimit) || isAfter(cursor, rangeEnd)) break;

        if (!isBefore(cursor, rangeStart) || isEqual(cursor, rangeStart)) {
            const dateStr = format(cursor, 'yyyy-MM-dd');
            if (type === 'weekly' && daysOfWeek.length > 0) {
                const dow = getDay(cursor);
                if (!daysOfWeek.includes(dow)) continue;
            }
            instances.push({
                ...event,
                virtualDate: dateStr,
                isVirtual: true,
            });
        }
    }

    return instances;
}

// ─── GET: Fetch events in date range ────────────────────────────────────────

export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const agentId = searchParams.get('agentId');

        let query = db.from('scheduler_events').select('*').eq('user_id', userId);
        if (startDate) query = query.gte('scheduled_date', startDate);
        if (endDate) query = query.lte('scheduled_date', endDate);
        if (agentId) query = query.eq('agent_id', agentId);

        const { data: baseEvents, error } = await query;
        if (error) throw new Error(error.message);

        // Also fetch recurring events that START before range but recur into it
        const { data: allRecurring } = await db.from('scheduler_events')
            .select('*')
            .neq('recurrence_type', 'none')
            .not('recurrence_type', 'is', null);

        const filteredRecurring = (allRecurring || []).filter(
            (e: any) => e.recurrence_type && e.recurrence_type !== 'none'
        );

        const rangeStart = startDate ? parseISO(startDate) : new Date('2020-01-01');
        const rangeEnd = endDate ? parseISO(endDate) : addWeeks(new Date(), 12);

        const virtualInstances = filteredRecurring.flatMap((e: any) =>
            expandRecurrence(e as SchedulerEventRow, rangeStart, rangeEnd)
        );

        const result = [
            ...(baseEvents || []).map((e: any) => ({ ...e, isVirtual: false, virtualDate: e.scheduled_date })),
            ...virtualInstances.filter(v => {
                return !(baseEvents || []).some((b: any) => b.id === v.id && b.scheduled_date === v.virtualDate);
            }),
        ];

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('GET /api/scheduler/events error:', error);
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }
}

// ─── POST: Create a new event ───────────────────────────────────────────────

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        const body = await request.json();
        const id = body.id || crypto.randomUUID();

        // Compute nextRunAt from scheduledDate + scheduledTime
        let nextRunAt: number | null = null;
        if (body.scheduledDate) {
            const dateStr = body.scheduledDate;
            const timeStr = body.scheduledTime || '00:00';
            const dt = parseISO(`${dateStr}T${timeStr}:00`);
            nextRunAt = Math.floor(dt.getTime() / 1000);
        }

        // Convert priority label to integer (DB column is integer)
        const priorityMap: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
        const priorityVal = typeof body.priority === 'number'
            ? body.priority
            : priorityMap[String(body.priority).toLowerCase()] ?? 0;

        const insertData: Record<string, any> = {
            id,
            task_id: body.taskId || null,
            agent_id: body.agentId || null,
            title: body.title,
            description: body.description || null,
            scheduled_date: body.scheduledDate,
            scheduled_time: body.scheduledTime || null,
            duration_minutes: body.durationMinutes || 30,
            recurrence_type: body.recurrenceType || 'none',
            recurrence_interval: body.recurrenceInterval || 1,
            recurrence_end_date: body.recurrenceEndDate || null,
            recurrence_days_of_week: body.recurrenceDaysOfWeek
                ? JSON.stringify(body.recurrenceDaysOfWeek) : null,
            status: 'scheduled',
            next_run_at: nextRunAt,
            run_count: 0,
            color: body.color || null,
            priority: priorityVal,
        };
        if (userId) insertData.user_id = userId;

        const { error } = await db.from('scheduler_events').insert(insertData);

        if (error) {
            console.error('POST /api/scheduler/events Supabase error:', error.message, error.details, error.hint);
            // Retry without user_id if that column doesn't exist
            if (error.message?.includes('user_id')) {
                delete insertData.user_id;
                const retry = await db.from('scheduler_events').insert(insertData);
                if (retry.error) throw new Error(retry.error.message);
                return NextResponse.json({ id }, { status: 201 });
            }
            throw new Error(error.message);
        }
        return NextResponse.json({ id }, { status: 201 });
    } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('POST /api/scheduler/events error:', errMsg);
        return NextResponse.json({ error: 'Failed to create event', details: errMsg }, { status: 500 });
    }
}
