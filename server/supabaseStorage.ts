import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase environment variables not set. SUPABASE_URL and SUPABASE_ANON_KEY are required.");
  // Depending on the application's needs, you might want to throw an error here
  // to halt startup if Supabase is essential.
  // throw new Error("Supabase environment variables not set.");
}

export const supabase = createClient(supabaseUrl!, supabaseKey!);
