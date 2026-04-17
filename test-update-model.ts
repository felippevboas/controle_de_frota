import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  const { data: models } = await supabase.from('models').select('id').limit(1);
  if (models && models.length > 0) {
    const id = models[0].id;
    const { error } = await supabase.from('models').update({ target_consumption: "10.5" }).eq('id', id);
    console.log("Update with string '10.5':", error ? error.message : "Success");
    
    const { error: error2 } = await supabase.from('models').update({ target_consumption: "" }).eq('id', id);
    console.log("Update with string '':", error2 ? error2.message : "Success");
  }
}
run();
