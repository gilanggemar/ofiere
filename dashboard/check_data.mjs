import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://wcpqanwpngqnsstcvvis.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcHFhbndwbmdxbnNzdGN2dmlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUwMzQzNCwiZXhwIjoyMDg3MDc5NDM0fQ.EB1jIwT5AsMT0hb6FN1q6Da9dpLkk39ohwx7FFnCtqo'
);

async function checkData() {
    console.log("Checking auth.users:");
    const { data: users, error: userErr } = await supabase.auth.admin.listUsers();
    if (userErr) console.error("User err:", userErr);
    else {
        users.users.forEach(u => console.log(`- ${u.email}: ${u.id}`));
    }

    console.log("\nChecking agents table user_ids:");
    const { data: agents, error: agentErr } = await supabase.from('agents').select('id, name, user_id');
    if (agentErr) console.error("Agent err:", agentErr);
    else {
        agents.forEach(a => console.log(`- Agent ${a.id} (${a.name}): user_id = ${a.user_id}`));
    }

    console.log("\nChecking connection_profiles user_ids:");
    const { data: connections, error: connErr } = await supabase.from('connection_profiles').select('id, name, user_id');
    if (connErr) console.error("Conn err:", connErr);
    else {
        connections.forEach(c => console.log(`\nProfile: ${c.name}\nID: ${c.id}\nOwner: ${c.user_id}\n`));
    }
}

checkData().catch(console.error);
