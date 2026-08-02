const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

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

async function runLiveTest() {
  console.log('🚀 Launching Live Chrome for Visual Testing...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const artifactDir = 'C:\\Users\\mitta\\.gemini\\antigravity\\brain\\2577e7a1-fd2d-4f65-bb39-42ebc96ea4dd';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  // 1. Student OS Portal Test
  console.log('📍 1. Testing Student OS Portal (http://localhost:5173)...');
  const page1 = await browser.newPage();
  await page1.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  
  const emailInput = await page1.$('input[type="email"], input[name="email"]');
  if (emailInput) {
    await page1.type('input[type="email"], input[name="email"]', 'student@studentos.com', { delay: 50 });
    await page1.type('input[type="password"], input[name="password"]', 'Password123!', { delay: 50 });
    
    const submitBtn = await page1.$('button[type="submit"], button');
    if (submitBtn) {
      await submitBtn.click();
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  const studentShotPath = path.join(artifactDir, 'student_portal_live.png');
  await page1.screenshot({ path: studentShotPath });
  console.log('✅ Student Portal Live Screenshot Saved:', studentShotPath);

  // 2. Campus Admin Web Test
  console.log('📍 2. Testing Campus Admin Web (http://localhost:5175)...');
  const page2 = await browser.newPage();
  await page2.goto('http://localhost:5175/', { waitUntil: 'networkidle2' });

  const adminEmail = await page2.$('input[type="email"], input[name="email"]');
  if (adminEmail) {
    await page2.type('input[type="email"], input[name="email"]', 'admin@campus.com', { delay: 50 });
    await page2.type('input[type="password"], input[name="password"]', 'Password123!', { delay: 50 });
    
    const adminSubmit = await page2.$('button[type="submit"], button');
    if (adminSubmit) {
      await adminSubmit.click();
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  const campusShotPath = path.join(artifactDir, 'campus_admin_live.png');
  await page2.screenshot({ path: campusShotPath });
  console.log('✅ Campus Admin Live Screenshot Saved:', campusShotPath);

  console.log('🎉 Live Visual Testing Completed Successfully!');
  await new Promise(r => setTimeout(r, 4000));
  await browser.close();
}

runLiveTest().catch(err => {
  console.error('Live Test Error:', err);
  process.exit(1);
});
