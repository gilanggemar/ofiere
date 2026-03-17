import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
});

async function main() {
    // 1. Get the single user from auth.users (if any) or look at existing workflows
    const { data: existingWorkflows, error: getErr } = await supabase.from('workflows').select('user_id').limit(1);
    
    let userId = null;
    
    // We can also check existing workflows for user_id
    if (existingWorkflows && existingWorkflows.length > 0) {
        userId = existingWorkflows[0].user_id;
    } else {
        // Fallback to auth.users if possible
        const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers();
        if (usersData?.users?.length > 0) {
            userId = usersData.users[0].id;
        } else {
            console.error('No users found in database cannot insert workflow');
            process.exit(1);
        }
    }
    
    if (!userId) {
        console.error('Failed to resolve user_id');
        process.exit(1);
    }
    
    const id = crypto.randomUUID();
    const weatherWorkflow = {
        id,
        user_id: userId,
        name: 'Weather Report',
        description: 'Sends a message of the current weather using Ivy',
        status: 'draft',
        schedule: { type: 'manual' },
        steps: [
            { id: 'step-0', title: 'Trigger', agentId: '', dependsOn: [] },
            { id: 'step-1', title: 'Ivy Weather', agentId: 'ivy', dependsOn: ['step-0'] },
            { id: 'step-2', title: 'Output Message', agentId: '', dependsOn: ['step-1'] }
        ],
        nodes: [
            {
                id: 'trigger-1',
                type: 'trigger',
                position: { x: 100, y: 200 },
                data: {
                    label: 'Manual Start',
                    triggerType: 'Manual',
                    manualMode: 'click'
                }
            },
            {
                id: 'agent-1',
                type: 'agent',
                position: { x: 400, y: 200 },
                data: {
                    label: 'Ivy Weather Agent',
                    provider: 'OpenClaw',
                    agentId: 'ivy',
                    agentName: 'Ivy',
                    prompt: 'What is the current weather today? Please send me a message with the details.'
                }
            },
            {
                id: 'output-1',
                type: 'output',
                position: { x: 700, y: 200 },
                data: {
                    label: 'Notification',
                    outputType: 'Notification'
                }
            }
        ],
        edges: [
            {
                id: 'e-trigger-agent',
                source: 'trigger-1',
                target: 'agent-1',
                type: 'data',
                data: { label: 'DATA' }
            },
            {
                id: 'e-agent-output',
                source: 'agent-1',
                target: 'output-1',
                type: 'data',
                data: { label: 'DATA' }
            }
        ]
    };
    
    const { data: inserted, error: insertErr } = await supabase.from('workflows').insert(weatherWorkflow).select().single();
    if (insertErr) {
        console.error('Failed to insert workflow:', insertErr);
        process.exit(1);
    }
    
    console.log('Successfully inserted default workflow. ID:', inserted.id);
}

main().catch(console.error);
