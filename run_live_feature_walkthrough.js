const puppeteer = require('puppeteer-core');
const fs = require('fs');

const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
];

let executablePath = chromePaths.find(p => fs.existsSync(p));

if (!executablePath) {
  console.error('Chrome executable not found!');
  process.exit(1);
}

async function runSlowMoWalkthrough() {
  console.log('🚀 Launching Live Interactive Chrome Feature Walkthrough (slowMo: 1000ms)...');
  
  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    slowMo: 1200, // 1.2 second pause per action so user can watch live on screen
    defaultViewport: null,
    args: ['--start-maximized']
  });

  // ==========================================
  // 1. STUDENT OS PORTAL (http://localhost:5173)
  // ==========================================
  console.log('\n===========================================');
  console.log('📍 1. LIVE DEMO: Student OS Portal (5173)');
  console.log('===========================================');
  const page1 = await browser.newPage();
  await page1.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

  // Fill credentials slowly
  console.log('  ➜ Typing Email: student@studentos.com...');
  const studentEmail = await page1.$('input[type="email"], input[name="email"]');
  if (studentEmail) {
    await studentEmail.click();
    await page1.type('input[type="email"], input[name="email"]', 'student@studentos.com');
  }

  console.log('  ➜ Typing Password...');
  const studentPass = await page1.$('input[type="password"], input[name="password"]');
  if (studentPass) {
    await studentPass.click();
    await page1.type('input[type="password"], input[name="password"]', 'Password123!');
  }

  console.log('  ➜ Clicking Login Button...');
  const studentLoginBtn = await page1.$('button[type="submit"], button');
  if (studentLoginBtn) {
    await studentLoginBtn.click();
    await new Promise(r => setTimeout(r, 2000));
  }

  // Click through available navigation links/buttons on Student Portal
  console.log('  ➜ Navigating through Student Portal sections...');
  const links1 = await page1.$$('a, button, nav [role="button"]');
  for (let i = 0; i < Math.min(links1.length, 8); i++) {
    try {
      const isVisible = await links1[i].isIntersectingViewport();
      if (isVisible) {
        await links1[i].click();
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {
      // Ignore non-clickable elements
    }
  }

  // ==========================================
  // 2. CAMPUS ADMIN PORTAL (http://localhost:5175)
  // ==========================================
  console.log('\n===========================================');
  console.log('📍 2. LIVE DEMO: Campus Admin Portal (5175)');
  console.log('===========================================');
  const page2 = await browser.newPage();
  await page2.goto('http://localhost:5175/', { waitUntil: 'networkidle2' });

  console.log('  ➜ Typing Email: admin@campus.com...');
  const adminEmail = await page2.$('input[type="email"], input[name="email"]');
  if (adminEmail) {
    await adminEmail.click();
    await page2.type('input[type="email"], input[name="email"]', 'admin@campus.com');
  }

  console.log('  ➜ Typing Password...');
  const adminPass = await page2.$('input[type="password"], input[name="password"]');
  if (adminPass) {
    await adminPass.click();
    await page2.type('input[type="password"], input[name="password"]', 'Password123!');
  }

  console.log('  ➜ Clicking Campus Admin Login...');
  const adminBtn = await page2.$('button[type="submit"], button');
  if (adminBtn) {
    await adminBtn.click();
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('  ➜ Navigating Campus Admin sections...');
  const links2 = await page2.$$('a, button');
  for (let i = 0; i < Math.min(links2.length, 8); i++) {
    try {
      const isVisible = await links2[i].isIntersectingViewport();
      if (isVisible) {
        await links2[i].click();
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {
      // Ignore non-clickable
    }
  }

  // ==========================================
  // 3. RECRUITER PORTAL (http://localhost:5182)
  // ==========================================
  console.log('\n===========================================');
  console.log('📍 3. LIVE DEMO: Recruiter Portal (5182)');
  console.log('===========================================');
  const page3 = await browser.newPage();
  await page3.goto('http://localhost:5182/', { waitUntil: 'networkidle2' });

  const links3 = await page3.$$('a, button');
  for (let i = 0; i < Math.min(links3.length, 6); i++) {
    try {
      if (await links3[i].isIntersectingViewport()) {
        await links3[i].click();
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {}
  }

  // ==========================================
  // 4. PLATFORM ADMIN (http://localhost:5176)
  // ==========================================
  console.log('\n===========================================');
  console.log('📍 4. LIVE DEMO: Platform SuperAdmin (5176)');
  console.log('===========================================');
  const page4 = await browser.newPage();
  await page4.goto('http://localhost:5176/', { waitUntil: 'networkidle2' });

  const links4 = await page4.$$('a, button');
  for (let i = 0; i < Math.min(links4.length, 6); i++) {
    try {
      if (await links4[i].isIntersectingViewport()) {
        await links4[i].click();
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {}
  }

  console.log('\n🎉 ALL PORTALS LIVE DEMO COMPLETED!');
  console.log('Keeping Chrome open so you can continue exploring live on screen...');
  await new Promise(r => setTimeout(r, 300000)); // Keep browser open for 5 minutes for user
}

runSlowMoWalkthrough().catch(err => {
  console.error('Error during live walkthrough:', err);
  process.exit(1);
});
