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
    // 1. Get the Weather workflow
    const { data: workflows, error: getErr } = await supabase.from('workflows').select('*').eq('name', 'Weather Report');
    
    if (getErr || !workflows || workflows.length === 0) {
        console.error('Workflow not found or error', getErr);
        process.exit(1);
    }
    
    const wf = workflows[0];
    let updated = false;

    // 2. Change the trigger to 'Execute'
    wf.nodes = wf.nodes.map(node => {
        if (node.type === 'trigger') {
            updated = true;
            return {
                ...node,
                data: {
                    ...node.data,
                    triggerType: 'Execute'
                }
            };
        }
        return node;
    });

    if (!updated) {
        console.log('No trigger node found');
        return;
    }
    
    const { error: updateErr } = await supabase.from('workflows').update({ nodes: wf.nodes }).eq('id', wf.id);
    if (updateErr) {
        console.error('Failed to update workflow:', updateErr);
        process.exit(1);
    }
    
    console.log('Successfully updated Weather Report workflow trigger to Execute.');
}

main().catch(console.error);
