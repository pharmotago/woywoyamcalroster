const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });

if (process.env.NODE_ENV === 'production' && !process.env.FORCE_SEED) {
  console.error('🛑 Error: seed.js cannot run in production environment without FORCE_SEED=true.');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Hash with unique random salt — matches production utils.ts 'salt:hash' format
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function seedPeter() {
  console.log('🧹 Clearing all existing data for Amcal Pharmacy Woywoy Rosters...');
  
  // 1. Delete all records (cascade constraints will handle foreign keys, but deleting in reverse order is safer)
  await supabase.from('brisk_invitations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('brisk_shifts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('brisk_timecards').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('brisk_leave_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('brisk_users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('brisk_employees').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('✅ All tables cleared.');

  console.log('👤 Registering Peter Kim and default staff (Wendy, Laynie, Emersyn, Mia, Katherine, Vicki)...');

  // 2. Insert Employee Profiles
  const { data: insertedEmployees, error: empsError } = await supabase
    .from('brisk_employees')
    .insert([
      {
        name: 'Peter Kim',
        email: 'pharmotago@gmail.com',
        role: 'Pharmacist Manager',
        hourly_rate: 85.00,
        max_hours: 45,
        availability: {
          0: null, // Sunday
          1: { start: '08:30', end: '17:30' }, // Monday
          2: { start: '08:30', end: '17:30' },
          3: { start: '08:30', end: '17:30' },
          4: { start: '08:30', end: '17:30' },
          5: { start: '08:30', end: '17:30' },
          6: { start: '09:00', end: '13:00' }  // Saturday
        },
        active: true
      },
      {
        name: 'Wendy Lobb',
        email: 'craftsisters.sydney@gmail.com',
        role: 'Pharmacy Assistant',
        hourly_rate: 30.00,
        max_hours: 38,
        availability: {
          0: null,
          1: { start: '09:00', end: '17:00' },
          2: { start: '09:00', end: '17:00' },
          3: { start: '09:00', end: '17:00' },
          4: { start: '09:00', end: '17:00' },
          5: { start: '09:00', end: '17:00' },
          6: null
        },
        active: true
      },
      {
        name: 'Laynie McManus',
        email: 'layniemcmanus09@outlook.com',
        role: 'Pharmacy Assistant',
        hourly_rate: 30.00,
        max_hours: 38,
        availability: {
          0: null,
          1: { start: '09:00', end: '17:00' },
          2: { start: '09:00', end: '17:00' },
          3: { start: '09:00', end: '17:00' },
          4: { start: '09:00', end: '17:00' },
          5: { start: '09:00', end: '17:00' },
          6: null
        },
        active: true
      },
      {
        name: 'Emersyn',
        email: 'craftsisters.sydney@gmail.com',
        role: 'Pharmacy Assistant',
        hourly_rate: 30.00,
        max_hours: 38,
        availability: {
          0: null,
          1: { start: '09:00', end: '17:00' },
          2: { start: '09:00', end: '17:00' },
          3: { start: '09:00', end: '17:00' },
          4: { start: '09:00', end: '17:00' },
          5: { start: '09:00', end: '17:00' },
          6: null
        },
        active: true
      },
      {
        name: 'Mia Staniland',
        email: 'mia.staniland07@gmail.com',
        role: 'Pharmacy Assistant',
        hourly_rate: 30.00,
        max_hours: 38,
        availability: {
          0: null,
          1: { start: '09:00', end: '17:00' },
          2: { start: '09:00', end: '17:00' },
          3: { start: '09:00', end: '17:00' },
          4: { start: '09:00', end: '17:00' },
          5: { start: '09:00', end: '17:00' },
          6: null
        },
        active: true
      },
      {
        name: 'Vicki Duffy',
        email: 'vickilorraine75@gmail.com',
        role: 'Pharmacy Assistant',
        hourly_rate: 30.00,
        max_hours: 38,
        availability: {
          0: null,
          1: { start: '09:00', end: '17:00' },
          2: { start: '09:00', end: '17:00' },
          3: { start: '09:00', end: '17:00' },
          4: { start: '09:00', end: '17:00' },
          5: { start: '09:00', end: '17:00' },
          6: null
        },
        active: true
      },
      {
        name: 'Katherine Nguyen',
        email: 'nguyek@hotmail.com',
        role: 'Pharmacy Assistant',
        hourly_rate: 30.00,
        max_hours: 38,
        availability: {
          0: null,
          1: { start: '09:00', end: '17:00' },
          2: { start: '09:00', end: '17:00' },
          3: { start: '09:00', end: '17:00' },
          4: { start: '09:00', end: '17:00' },
          5: { start: '09:00', end: '17:00' },
          6: null
        },
        active: true
      }
    ])
    .select();

  if (empsError || !insertedEmployees || insertedEmployees.length === 0) {
    console.error('❌ Failed to create employee profiles:', empsError?.message);
    process.exit(1);
  }

  const employee = insertedEmployees.find(e => e.email === 'pharmotago@gmail.com');
  const insertedIds = insertedEmployees.map(e => e.id);

  // 3. Create User Account — ADMIN_PASSWORD must be set in environment variables
  const defaultPassword = process.env.ADMIN_PASSWORD;
  if (!defaultPassword) {
    console.error('❌ ADMIN_PASSWORD environment variable is not set. Aborting for security.');
    await supabase.from('brisk_employees').delete().in('id', insertedIds);
    process.exit(1);
  }

  const email = 'pharmotago@gmail.com';
  
  // 먼저 기존 auth.users 에 동일 메일이 있으면 삭제 처리 (클리어 목적)
  const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();
  if (!listError && usersList && usersList.users) {
    const existingUser = usersList.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      console.log(`🧹 Removing existing auth user ${email}...`);
      await supabase.auth.admin.deleteUser(existingUser.id);
    }
  }

  console.log(`🔑 Creating Supabase Auth account for ${email}...`);
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { name: 'Peter Kim' }
  });

  if (authError || !authUser || !authUser.user) {
    console.error('❌ Failed to create auth user:', authError?.message);
    // Cleanup employees
    await supabase.from('brisk_employees').delete().in('id', insertedIds);
    process.exit(1);
  }

  const uid = authUser.user.id;
  const passwordHash = hashPassword(defaultPassword);

  const { error: userError } = await supabase
    .from('brisk_users')
    .insert({
      id: uid, // Auth user ID와 매핑
      email: email,
      password_hash: passwordHash,
      role: 'owner',
      employee_id: employee.id,
      name: 'Peter Kim' // name 필드 추가
    });

  if (userError) {
    console.error('❌ Failed to create user account:', userError.message);
    // Cleanup employees and auth user
    await supabase.from('brisk_employees').delete().in('id', insertedIds);
    await supabase.auth.admin.deleteUser(uid);
    process.exit(1);
  }

  // 4. Restore existing auth users back into brisk_users to map them properly
  const registeredUsers = [
    {
      id: 'da81ae02-7825-4236-93dd-ac413415e13f',
      email: 'mia.staniland07@gmail.com',
      name: 'Mia Staniland'
    },
    {
      id: '88adc3e2-49ec-41a0-a557-136221111a81',
      email: 'layniemcmanus09@outlook.com',
      name: 'Laynie McManus'
    },
    {
      id: '8a9bb0c2-0d62-487f-b745-c3c12deea0b1',
      email: 'nguyek@hotmail.com',
      name: 'Katherine Nguyen'
    },
    {
      id: '4c524936-40f4-440f-b2ac-951d5e0c599f',
      email: 'vickilorraine75@gmail.com',
      name: 'Vicki Duffy'
    }
  ];

  for (const reg of registeredUsers) {
    const emp = insertedEmployees.find(e => e.email.toLowerCase() === reg.email.toLowerCase());
    if (emp) {
      console.log(`🔗 Linking user profile for ${reg.name}...`);
      await supabase.from('brisk_users').insert({
        id: reg.id,
        email: reg.email,
        role: 'employee',
        employee_id: emp.id,
        name: reg.name,
        password_hash: 'auth-managed'
      });
    }
  }

  console.log('==========================================');
  console.log(' 🎉 Seeding and user restoration complete! 🎉');
  console.log('==========================================');
}

seedPeter();
