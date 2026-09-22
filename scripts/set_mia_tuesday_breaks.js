/**
 * Update Mia Staniland's Tuesday shifts to 0 unpaid meal minutes (no lunch break)
 */

async function main() {
  console.log('--- Updating Mia Staniland Tuesday Shifts to 0 Lunch Break ---');

  const shiftIds = [
    { id: 'f8c6bf2b-b5da-4c9f-9cdc-9a7652c8eab3', date: '2026-09-22' },
    { id: '9c8e37f4-46e3-42e2-9d49-6fbf06fa005d', date: '2026-09-29' }
  ];

  for (const item of shiftIds) {
    console.log(`Updating shift ${item.id} on ${item.date}...`);
    const res = await fetch('https://woywoyamcalroster.vercel.app/api/schedule/mutate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': 'pharmotago@gmail.com',
        'x-pharmacy-id': 'amcal_woywoy'
      },
      body: JSON.stringify({
        entity: 'shift',
        action: 'update',
        shift: {
          id: item.id,
          unpaidMealMins: 0
        }
      })
    });

    if (!res.ok) {
      console.error(`  ❌ Failed to update ${item.date}:`, res.status, await res.text());
    } else {
      const data = await res.json();
      console.log(`  ✅ Successfully updated ${item.date}: unpaid_meal_mins =`, data.shift?.unpaid_meal_mins);
    }
  }

  console.log('--- Shift Updates Complete ---');
}

main().catch(console.error);
