/**
 * Update Webster Care Department staff in live database via production API endpoint
 */

async function main() {
  console.log('--- Querying current live employees from Amcal Woy Woy ---');
  
  const syncRes = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'pharmotago@gmail.com',
      'x-pharmacy-id': 'amcal_woywoy'
    },
    body: JSON.stringify({
      email: 'pharmotago@gmail.com',
      pharmacyId: 'amcal_woywoy'
    })
  });

  if (!syncRes.ok) {
    console.error('Failed to sync from production API:', syncRes.status, await syncRes.text());
    process.exit(1);
  }

  const syncData = await syncRes.json();
  const allEmployees = syncData.employees || [];
  console.log(`Retrieved ${allEmployees.length} active employees from server.`);

  const targets = allEmployees.filter(e => 
    e.name.toLowerCase().includes('gabby') || 
    e.name.toLowerCase().includes('emersyn')
  );

  console.log(`Found ${targets.length} target Webster staff members.`);

  for (const emp of targets) {
    console.log(`\nUpdating employee: ${emp.name} (ID: ${emp.id})`);
    console.log(`  Current role: ${emp.role}, department: ${emp.department || emp.availability?.department || 'none'}`);

    const updatedAvail = { ...(emp.availability || {}) };
    updatedAvail.department = 'webster';

    let certs = Array.isArray(updatedAvail.certificates) ? [...updatedAvail.certificates] : [];
    if (!certs.includes('Webster Packing Competency')) {
      certs.push('Webster Packing Competency');
    }
    updatedAvail.certificates = certs;

    const mutatePayload = {
      entity: 'employee',
      action: 'update',
      employee: {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        department: 'webster',
        availability: updatedAvail
      }
    };

    const mutateRes = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/mutate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'pharmotago@gmail.com',
        'x-pharmacy-id': 'amcal_woywoy'
      },
      body: JSON.stringify(mutatePayload)
    });

    if (!mutateRes.ok) {
      console.error(`  ❌ Failed to update ${emp.name}:`, mutateRes.status, await mutateRes.text());
    } else {
      const result = await mutateRes.json();
      console.log(`  ✅ Successfully updated ${emp.name}:`, result.success ? 'OK' : JSON.stringify(result));
    }
  }

  console.log('\n--- Verifying updated staff records ---');
  const verifyRes = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'pharmotago@gmail.com',
      'x-pharmacy-id': 'amcal_woywoy'
    },
    body: JSON.stringify({
      email: 'pharmotago@gmail.com',
      pharmacyId: 'amcal_woywoy'
    })
  });

  const verifyData = await verifyRes.json();
  const updatedTargets = (verifyData.employees || []).filter(e => 
    e.name.toLowerCase().includes('gabby') || 
    e.name.toLowerCase().includes('emersyn')
  );

  updatedTargets.forEach(e => {
    console.log(`Verified: ${e.name} | Dept: ${e.department || e.availability?.department} | Certs: ${JSON.stringify(e.certificates || e.availability?.certificates)}`);
  });

  console.log('\n--- Webster Care Staff Update Complete ---');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
