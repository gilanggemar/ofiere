import { db } from './lib/db';

async function main() {
    console.log("Fetching notifications...");
    const { data, error } = await db.from('notifications').select('*').order('created_at', { ascending: false }).limit(5);
    if (error) {
        console.error("Error fetching:", error);
    } else {
        console.log("Recent notifications:");
        console.log(JSON.stringify(data, null, 2));
    }
}

main().catch(console.error);
