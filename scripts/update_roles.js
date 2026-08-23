import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Upgrading legacy managers to owner/manager in brisk_users...');
  const emailsToOwner = ['peter', 'glen', 'katherine', 'pharmotago'];
  const emailsToManager = ['vicky'];

  for (const email of emailsToOwner) {
    const { error } = await supabase.from('brisk_users').update({ role: 'owner' }).ilike('email', `%${email}%`);
    if (error) console.error(error);
    else console.log(`Upgraded ${email} to owner.`);
  }

  for (const email of emailsToManager) {
    const { error } = await supabase.from('brisk_users').update({ role: 'manager' }).ilike('email', `%${email}%`);
    if (error) console.error(error);
    else console.log(`Upgraded ${email} to manager.`);
  }
}
run();
