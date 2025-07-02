import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vrsevexauaiaylqshmxa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyc2V2ZXhhdWFpYXlscXNobXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU1MjgwMDQsImV4cCI6MjA2MTEwNDAwNH0.o-vcsoaGqtS76q0nB9d0ZZtmv_0YeJQdc8nrJ2COOww';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
