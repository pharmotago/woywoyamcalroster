const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://gcslfkujlfnznedatrsn.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function resetPeter() {
  const email = 'pharmotago@gmail.com';
  const defaultPass = 'Amcal2026!';

  console.log(`Resetting auth password for ${email}...`);

  // 1. Get user ID
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) throw listErr;

  const user = users.find(u => u.email.toLowerCase() === email);
  if (!user) throw new Error('User not found in auth.users');

  // 2. Set password to Amcal2026! and confirm email
  const { data: updateData, error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
    password: defaultPass,
    email_confirm: true,
    user_metadata: { name: 'Peter Kim', email_verified: true }
  });

  if (updateErr) throw updateErr;
  console.log('✅ Password successfully set to:', defaultPass);

  // 3. Ensure brisk_users has correct role and employee_id
  const { data: bUser, error: bErr } = await admin.from('brisk_users').upsert({
    id: user.id,
    email: email,
    name: 'Peter Kim',
    role: 'owner',
    employee_id: '222a783d-906c-44a9-91ec-8cb1f2dc67a4',
    password_hash: 'SUPABASE_AUTH_MANAGED'
  }).select().single();

  if (bErr) console.error('brisk_users update note:', bErr.message);
  else console.log('✅ brisk_users profile confirmed as owner:', bUser.role);

  // 4. Generate 1-Click Login / Recovery Link
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: { redirectTo: 'https://woywoyamcalroster.vercel.app' }
  });

  if (linkErr) console.error('Link gen error:', linkErr);
  else {
    console.log('\n======================================================');
    console.log('🎉 1-CLICK INSTANT LOGIN LINK FOR PETER KIM:');
    console.log(linkData?.properties?.action_link);
    console.log('======================================================\n');
  }
}

resetPeter().catch(console.error);
