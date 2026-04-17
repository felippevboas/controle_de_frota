import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function investigate() {
  const { data: comments } = await supabase.from('maintenance_order_comments').select('*').order('created_at', { ascending: true });
  const { data: orders } = await supabase.from('maintenance_orders').select('id, registration_number, notes');
  
  const commentsByOrder = comments.reduce((acc, c) => {
    if (!acc[c.order_id]) acc[c.order_id] = [];
    acc[c.order_id].push(c);
    return acc;
  }, {});
  
  const targetIds = ['OS-0021', 'OS-0018', 'OS-0022'];
  const targets = orders.filter(o => targetIds.includes(o.registration_number));
  
  for (const o of targets) {
    console.log(`\n\n--- ${o.registration_number} (ID: ${o.id}) ---`);
    console.log(`Current notes: ${o.notes}`);
    console.log(`All Comments:`);
    const orderComments = commentsByOrder[o.id] || [];
    orderComments.forEach((c, idx) => {
      console.log(`  [${idx}] (${c.created_at}) ${c.user_name}: ${c.comment}`);
    });
  }
}
investigate();
