import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jbghahvkpecjbqvnccxe.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZ2hhaHZrcGVjamJxdm5jY3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NzQ4NDAsImV4cCI6MjA4MzU1MDg0MH0.M4DbNR5BuajIMEUEsjFaPWjWcj5gtLbvaZ4bJZuXEH4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
