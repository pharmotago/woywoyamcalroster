const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjc2xma3VqbGZuem5lZGF0cnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTEwODksImV4cCI6MjA5MjA2NzA4OX0.qCfeYYF2rcqfz_t2-wxLAE0fiosy9C2sbG3BShYVIT0';

const client = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

async function testLogin() {
  const email = 'pharmotago@gmail.com';
  const password = 'Amcal2026!';

  console.log(`Testing client login for ${email}...`);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('❌ Login failed:', error.message);
  } else {
    console.log('✅ Client login successful!');
    console.log('User ID:', data.user.id);
    console.log('Email:', data.user.email);
    console.log('Access Token exists:', !!data.session.access_token);
  }
}

testLogin().catch(console.error);
