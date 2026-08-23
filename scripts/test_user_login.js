const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

async function diagnose() {
  const email = 'pharmotago@gmail.com';
  console.log('--- Checking User in Supabase Auth ---');
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) {
    console.error('List users error:', listErr);
    return;
  }
  const user = users.find(u => u.email.toLowerCase() === email);
  console.log('User found in auth.users:', user ? {
    id: user.id,
    email: user.email,
    confirmed: !!user.email_confirmed_at,
    last_sign_in: user.last_sign_in_at,
    banned: user.banned_until,
    user_metadata: user.user_metadata
  } : 'NOT FOUND');

  console.log('\n--- Checking brisk_users ---');
  const { data: bUser, error: bErr } = await admin.from('brisk_users').select('*').eq('email', email).maybeSingle();
  console.log('brisk_users row:', bUser, bErr ? bErr.message : '');

  console.log('\n--- Checking brisk_employees ---');
  const { data: emp, error: empErr } = await admin.from('brisk_employees').select('*').eq('email', email).maybeSingle();
  console.log('brisk_employees row:', emp, empErr ? empErr.message : '');
}

diagnose().catch(console.error);
