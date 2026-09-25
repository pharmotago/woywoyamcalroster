// Smoke test for v10.5.12 live deployments
async function runSmokeTest() {
  const t = Date.now();
  console.log('--- Probing Live Deployments for v10.5.12 ---');
  
  const [resWoyVersion, resBudgVersion, resWoyHtml, resBudgHtml] = await Promise.all([
    fetch('https://woywoyamcalroster.vercel.app/version.json?t=' + t),
    fetch('https://budgewoiddsroster.vercel.app/version.json?t=' + t),
    fetch('https://woywoyamcalroster.vercel.app/?t=' + t),
    fetch('https://budgewoiddsroster.vercel.app/?t=' + t)
  ]);

  console.log('HTTP Statuses:', {
    woyVersion: resWoyVersion.status,
    budgVersion: resBudgVersion.status,
    woyHtml: resWoyHtml.status,
    budgHtml: resBudgHtml.status
  });

  const vWoy = await resWoyVersion.json();
  const vBudg = await resBudgVersion.json();
  const htmlWoy = await resWoyHtml.text();
  const htmlBudg = await resBudgHtml.text();

  console.log('Woy Woy version.json:', vWoy.version);
  console.log('Budgewoi version.json:', vBudg.version);
  console.log('Woy Woy HTML contains 10.5.12:', htmlWoy.includes('10.5.12'));
  console.log('Budgewoi HTML contains 10.5.12:', htmlBudg.includes('10.5.12'));
  console.log('Budgewoi HTML contains Georgi Peek:', htmlBudg.includes('Georgi Peek'));
  console.log('Budgewoi HTML contains v10.5.12 changelog card:', htmlBudg.includes('Dispensary Leadership Authorization, Trading Hours Persistence'));

  if (vWoy.version === '10.5.12' && vBudg.version === '10.5.12' && htmlBudg.includes('10.5.12') && htmlWoy.includes('10.5.12')) {
    console.log('SUCCESS: All production endpoints are 100% verified on v10.5.12!');
    return;
  } else {
    console.error('FAILURE: Version mismatch detected!');
    process.exitCode = 1;
  }
}

runSmokeTest().catch(err => {
  console.error('Error running smoke test:', err);
  process.exitCode = 1;
});
