import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://wcpqanwpngqnsstcvvis.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcHFhbndwbmdxbnNzdGN2dmlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUwMzQzNCwiZXhwIjoyMDg3MDc5NDM0fQ.EB1jIwT5AsMT0hb6FN1q6Da9dpLkk39ohwx7FFnCtqo'
);

async function main() {
    // Create the developer user
    const { data, error } = await supabase.auth.admin.createUser({
        email: 'gilanggemar@gmail.com',
        password: 'Dotexe1996',
        email_confirm: true,
        user_metadata: {
            display_name: 'Gilang'
        }
    });

    if (error) {
        console.error('Error creating user:', error.message);
        process.exit(1);
    }

    console.log('User created! ID:', data.user.id);

    // Assign all existing data to this user
    const userId = data.user.id;
    const tables = [
        'agents', 'hero_images', 'agent_provider_config', 'agent_xp',
        'tasks', 'task_logs', 'summits', 'summit_messages',
        'providers', 'provider_models', 'telemetry_logs', 'audit_logs',
        'conversations', 'conversation_messages', 'knowledge_fragments', 'knowledge_documents',
        'workflows', 'workflow_runs', 'workflow_templates',
        'notifications', 'alert_rules',
        'scheduled_tasks', 'scheduler_events', 'webhook_configs',
        'mcp_servers', 'platform_bridges', 'api_keys',
        'war_room_sessions', 'war_room_events',
        'prompt_chunks', 'connection_secrets', 'connection_profiles',
        'xp_events', 'daily_missions', 'achievements', 'unlocked_achievements', 'operations_streak',
        'capability_mcps', 'capability_skills', 'agent_capability_assignments'
    ];

    for (const t of tables) {
        const { error: e } = await supabase.from(t).update({ user_id: userId }).is('user_id', null);
        console.log(e ? `X ${t}: ${e.message}` : `V ${t}`);
    }

    console.log('\nDone! User ID:', userId);
}

main().catch(console.error);
