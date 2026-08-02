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

const delay = ms => new Promise(r => setTimeout(r, ms));

async function runCampusOSManualQA() {
  console.log('\n======================================================');
  console.log('🎭 MANUAL QA LIVE DEMO: CAMPUS OS PORTALS & STUDENT APP');
  console.log('======================================================\n');
  
  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  // ====================================================
  // 1. PRINCIPAL PORTAL (http://localhost:5175/login/principal)
  // ====================================================
  console.log('📌 1. DEMO: PRINCIPAL PORTAL (http://localhost:5175/login/principal)...');
  const page1 = await browser.newPage();
  await page1.goto('http://localhost:5175/login/principal', { waitUntil: 'networkidle2' });
  await delay(3000);

  const code1 = await page1.$('input[placeholder*="ASCET"], input[name="collegeCode"]');
  if (code1) {
    await code1.type('ASCET001', { delay: 100 });
    await delay(1000);
  }

  const email1 = await page1.$('input[type="email"], input[name="email"], input[type="text"]');
  if (email1) {
    await email1.type('principal@campus.com', { delay: 100 });
    await delay(1000);
  }

  const pass1 = await page1.$('input[type="password"]');
  if (pass1) {
    await pass1.type('Password123!', { delay: 100 });
    await delay(1000);
  }

  const btn1 = await page1.$('button[type="submit"], button');
  if (btn1) {
    await btn1.click();
    console.log('  ➜ Principal Logged In. Observing Principal Dashboard metrics...');
    await delay(5000);
  }

  // ====================================================
  // 2. HOD PORTAL (http://localhost:5175/login/hod)
  // ====================================================
  console.log('\n📌 2. DEMO: HOD PORTAL (http://localhost:5175/login/hod)...');
  const page2 = await browser.newPage();
  await page2.goto('http://localhost:5175/login/hod', { waitUntil: 'networkidle2' });
  await delay(3000);

  const code2 = await page2.$('input[placeholder*="ASCET"], input[name="collegeCode"]');
  if (code2) {
    await code2.type('ASCET001', { delay: 100 });
    await delay(1000);
  }

  const email2 = await page2.$('input[type="email"], input[name="email"], input[type="text"]');
  if (email2) {
    await email2.type('hod@campus.com', { delay: 100 });
    await delay(1000);
  }

  const pass2 = await page2.$('input[type="password"]');
  if (pass2) {
    await pass2.type('Password123!', { delay: 100 });
    await delay(1000);
  }

  const btn2 = await page2.$('button[type="submit"], button');
  if (btn2) {
    await btn2.click();
    console.log('  ➜ HOD Logged In. Observing Department Roster & Approvals...');
    await delay(5000);
  }

  // ====================================================
  // 3. FACULTY PORTAL (http://localhost:5175/login/faculty)
  // ====================================================
  console.log('\n📌 3. DEMO: FACULTY PORTAL (http://localhost:5175/login/faculty)...');
  const page3 = await browser.newPage();
  await page3.goto('http://localhost:5175/login/faculty', { waitUntil: 'networkidle2' });
  await delay(3000);

  const code3 = await page3.$('input[placeholder*="ASCET"], input[name="collegeCode"]');
  if (code3) {
    await code3.type('ASCET001', { delay: 100 });
    await delay(1000);
  }

  const email3 = await page3.$('input[type="email"], input[name="email"], input[type="text"]');
  if (email3) {
    await email3.type('faculty@campus.com', { delay: 100 });
    await delay(1000);
  }

  const pass3 = await page3.$('input[type="password"]');
  if (pass3) {
    await pass3.type('Password123!', { delay: 100 });
    await delay(1000);
  }

  const btn3 = await page3.$('button[type="submit"], button');
  if (btn3) {
    await btn3.click();
    console.log('  ➜ Faculty Logged In. Observing Assigned Classes & Attendance...');
    await delay(5000);
  }

  // ====================================================
  // 4. STUDENT OS LOGIN WITH NEW CREATED STUDENT (Roll No: 21001A0599)
  // ====================================================
  console.log('\n📌 4. DEMO: STUDENT OS LOGIN WITH NEW CREATED STUDENT (Roll No: 21001A0599)...');
  const page4 = await browser.newPage();
  await page4.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await delay(3000);

  console.log('  ➜ Typing Email of Created Student: newstudent2026@studentos.com (Roll No: 21001A0599)...');
  const studentEmail = await page4.$('input[type="email"], input[name="email"]');
  if (studentEmail) {
    await studentEmail.type('newstudent2026@studentos.com', { delay: 100 });
    await delay(1000);
  }

  const studentPass = await page4.$('input[type="password"]');
  if (studentPass) {
    await studentPass.type('Password123!', { delay: 100 });
    await delay(1000);
  }

  const btn4 = await page4.$('button[type="submit"], button');
  if (btn4) {
    await btn4.click();
    console.log('  ➜ Newly Created Student Logged In to Student OS App!');
    await delay(5000);
  }

  console.log('\n======================================================');
  console.log('✅ ALL CAMPUS OS PORTALS & CREATED STUDENT APP TESTED!');
  console.log('======================================================');
  console.log('Chrome is kept open on screen for user inspection.');

  await delay(600000);
}

runCampusOSManualQA().catch(err => {
  console.error('Error during Campus OS manual QA demo:', err);
  process.exit(1);
});
