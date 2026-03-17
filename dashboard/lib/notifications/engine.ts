// ─── Notification & Alert Engine ─────────────────────────────────────────────

import { db } from '@/lib/db';
import type { Notification, AlertRule, NotificationType, AlertCondition, AlertSeverity, NotificationChannel } from './types';

export async function createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    agentId?: string,
    actionUrl?: string
): Promise<void> {
    const { error } = await db.from('notifications').insert({
        user_id: userId,
        type,
        title,
        message,
        agent_id: agentId || null,
        is_read: false,
        action_url: actionUrl || null,
    });
    
    if (error) {
        console.error("[Notification Engine] Failed to insert notification:", error);
        throw new Error(`DB Error: ${error.message}`);
    }
}

export async function getNotifications(limit: number = 50, unreadOnly: boolean = false) {
    let query = db.from('notifications').select('*');
    if (unreadOnly) {
        query = query.eq('is_read', false);
    }
    const { data } = await query.order('created_at', { ascending: false }).limit(limit);
    return data || [];
}

export async function markAsRead(id: number): Promise<void> {
    await db.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllAsRead(): Promise<void> {
    await db.from('notifications').update({ is_read: true }).eq('is_read', false);
}

export async function getUnreadCount(): Promise<number> {
    const { count } = await db.from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);
    return count || 0;
}

export async function deleteNotification(id: number): Promise<void> {
    await db.from('notifications').delete().eq('id', id);
}

// ─── Alert Rules ─────────────────────────────────────────────────────────────

export async function createAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    await db.from('alert_rules').insert({
        id,
        name: rule.name,
        condition: rule.condition,
        threshold: rule.threshold,
        severity: rule.severity,
        agent_id: rule.agentId || null,
        channels: rule.channels, // jsonb
        is_active: rule.isActive,
        cooldown_ms: rule.cooldownMs,
    });
    return id;
}

export async function getAlertRules() {
    const { data } = await db.from('alert_rules').select('*').order('created_at', { ascending: false });
    return data || [];
}

export async function updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<void> {
    const set: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) set.name = updates.name;
    if (updates.condition !== undefined) set.condition = updates.condition;
    if (updates.threshold !== undefined) set.threshold = updates.threshold;
    if (updates.severity !== undefined) set.severity = updates.severity;
    if (updates.agentId !== undefined) set.agent_id = updates.agentId || null;
    if (updates.channels !== undefined) set.channels = updates.channels; // jsonb
    if (updates.isActive !== undefined) set.is_active = updates.isActive;
    if (updates.cooldownMs !== undefined) set.cooldown_ms = updates.cooldownMs;
    if (updates.lastTriggeredAt !== undefined) set.last_triggered_at = updates.lastTriggeredAt;

    await db.from('alert_rules').update(set).eq('id', id);
}

export async function deleteAlertRule(id: string): Promise<void> {
    await db.from('alert_rules').delete().eq('id', id);
}

export function evaluateAlert(rule: AlertRule, currentValue: number): boolean {
    if (!rule.isActive) return false;
    if (rule.lastTriggeredAt && Date.now() - rule.lastTriggeredAt < rule.cooldownMs) return false;
    return currentValue > rule.threshold;
}
