import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data, error } = await supabase.rpc('get_schema');
  // If get_schema doesn't exist, we can try to get column info from information_schema
  const { data: cols, error: err } = await supabase.from('models').select('*').limit(1);
  console.log("Cols:", cols);
  
  const { data: info, error: infoErr } = await supabase.rpc('get_table_info', { table_name: 'models' });
  console.log("Info:", info, infoErr);
}
run();
