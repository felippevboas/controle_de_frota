import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data: brands } = await supabase.from('brands').select('id').limit(1);
  if (brands && brands.length > 0) {
    const brand_id = brands[0].id;
    const { data, error } = await supabase.from('models').insert({
      name: 'TEST MODEL ' + Date.now(),
      brand_id: brand_id,
      target_consumption: 12.5
    }).select().single();
    console.log("Insert result:", data, error);
  } else {
    console.log("No brands found to test.");
  }
}
run();
