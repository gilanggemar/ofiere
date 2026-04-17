import { db } from '@/lib/db'
import { getAuthUserId } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function POST() {
    const userId = await getAuthUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        // Check if user already has agents (already onboarded)
        const { data: existingAgents } = await db
            .from('agents')
            .select('id')
            .eq('user_id', userId)
            .limit(1)

        if (existingAgents && existingAgents.length > 0) {
            return NextResponse.json({ message: 'Already onboarded' })
        }

        // Seed a default connection profile
        await db.from('connection_profiles').insert({
            id: crypto.randomUUID(),
            name: 'Default',
            is_active: true,
            openclaw_enabled: false,
            agent_zero_enabled: false,
            user_id: userId,
        })

        // Seed a welcome notification
        await db.from('notifications').insert({
            type: 'system',
            title: 'Welcome to Ofiere',
            message: 'Your dashboard is ready. Start by creating your first agent in the Command Center.',
            is_read: false,
            user_id: userId,
        })

        return NextResponse.json({ message: 'Onboarding complete' })
    } catch (error: unknown) {
        console.error('Onboarding error:', error)
        return NextResponse.json({ error: 'Onboarding failed' }, { status: 500 })
    }
}
