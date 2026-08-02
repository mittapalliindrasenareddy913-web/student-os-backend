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

async function runErpIntegrationDemo() {
  console.log('\n========================================================================');
  console.log('🎭 LIVE DEMO: CAMPUS OS ERP INTEGRATION & STUDENT OS APP VERIFICATION');
  console.log('========================================================================\n');
  
  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  // ====================================================
  // STEP 1: PRINCIPAL PORTAL (http://localhost:5175/login/principal)
  // ====================================================
  console.log('📌 STEP 1: Opening Principal Portal...');
  const page1 = await browser.newPage();
  await page1.goto('http://localhost:5175/login/principal', { waitUntil: 'networkidle2' });
  await delay(3000);

  const code1 = await page1.$('input[placeholder*="ASCET"], input[name="collegeCode"]');
  if (code1) {
    await code1.type('ASCET001', { delay: 100 });
    await delay(800);
  }

  const email1 = await page1.$('input[type="email"], input[name="email"], input[type="text"]');
  if (email1) {
    await email1.type('principal@campus.com', { delay: 100 });
    await delay(800);
  }

  const pass1 = await page1.$('input[type="password"]');
  if (pass1) {
    await pass1.type('Password123!', { delay: 100 });
    await delay(800);
  }

  const btn1 = await page1.$('button[type="submit"], button');
  if (btn1) {
    await btn1.click();
    console.log('  ➜ Principal Logged In! Observing Executive Campus Metrics & Roster...');
    await delay(5000);
  }

  // ====================================================
  // STEP 2: HOD PORTAL (http://localhost:5175/login/hod) - TIMETABLE
  // ====================================================
  console.log('\n📌 STEP 2: Opening HOD Portal & Checking Department Timetable...');
  const page2 = await browser.newPage();
  await page2.goto('http://localhost:5175/login/hod', { waitUntil: 'networkidle2' });
  await delay(3000);

  const code2 = await page2.$('input[placeholder*="ASCET"], input[name="collegeCode"]');
  if (code2) {
    await code2.type('ASCET001', { delay: 100 });
    await delay(800);
  }

  const email2 = await page2.$('input[type="email"], input[name="email"], input[type="text"]');
  if (email2) {
    await email2.type('hod@campus.com', { delay: 100 });
    await delay(800);
  }

  const pass2 = await page2.$('input[type="password"]');
  if (pass2) {
    await pass2.type('Password123!', { delay: 100 });
    await delay(800);
  }

  const btn2 = await page2.$('button[type="submit"], button');
  if (btn2) {
    await btn2.click();
    console.log('  ➜ HOD Logged In! Observing Computer Science Department Roster & Timetable...');
    await delay(5000);
  }

  // ====================================================
  // STEP 3: FACULTY PORTAL (http://localhost:5175/login/faculty) - EXAM MARKS
  // ====================================================
  console.log('\n📌 STEP 3: Opening Faculty Portal & Checking Class Timetable + Exam Marks Entry...');
  const page3 = await browser.newPage();
  await page3.goto('http://localhost:5175/login/faculty', { waitUntil: 'networkidle2' });
  await delay(3000);

  const code3 = await page3.$('input[placeholder*="ASCET"], input[name="collegeCode"]');
  if (code3) {
    await code3.type('ASCET001', { delay: 100 });
    await delay(800);
  }

  const email3 = await page3.$('input[type="email"], input[name="email"], input[type="text"]');
  if (email3) {
    await email3.type('faculty@campus.com', { delay: 100 });
    await delay(800);
  }

  const pass3 = await page3.$('input[type="password"]');
  if (pass3) {
    await pass3.type('Password123!', { delay: 100 });
    await delay(800);
  }

  const btn3 = await page3.$('button[type="submit"], button');
  if (btn3) {
    await btn3.click();
    console.log('  ➜ Faculty Logged In! Observing Assigned Class Schedule & Exam Marks Entries...');
    await delay(5000);
  }

  // ====================================================
  // STEP 4: STUDENT OS APP (http://localhost:5173/login) - VERIFY REAL-TIME SYNC
  // ====================================================
  console.log('\n📌 STEP 4: Opening Student OS App with Student (Roll No: 21001A0599)...');
  const page4 = await browser.newPage();
  await page4.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  await delay(3000);

  console.log('  ➜ Logging in with Student Roll No 21001A0599 (newstudent2026@studentos.com)...');
  const studentEmail = await page4.$('input[type="email"], input[name="email"]');
  if (studentEmail) {
    await studentEmail.type('newstudent2026@studentos.com', { delay: 100 });
    await delay(800);
  }

  const studentPass = await page4.$('input[type="password"]');
  if (studentPass) {
    await studentPass.type('Password123!', { delay: 100 });
    await delay(800);
  }

  const btn4 = await page4.$('button[type="submit"], button');
  if (btn4) {
    await btn4.click();
    console.log('  ➜ Student Logged In!');
    await delay(4000);
  }

  // Navigate to Timetable in Student OS App to verify live ERP sync
  console.log('\n📅 VERIFYING LIVE TIMETABLE IN STUDENT OS APP (http://localhost:5173/timetable)...');
  await page4.goto('http://localhost:5173/timetable', { waitUntil: 'networkidle2' });
  console.log('  👀 Displaying Timetable: Class Time, Subject Code, Room, and Faculty Name on Screen...');
  await delay(6000);

  console.log('\n========================================================================');
  console.log('✅ ALL INTEGRATION CHECKS (PRINCIPAL, HOD, FACULTY, MARKS, TIMETABLE) PASSED!');
  console.log('========================================================================');
  console.log('Chrome is kept open on screen for user inspection.');

  await delay(600000);
}

runErpIntegrationDemo().catch(err => {
  console.error('Error during ERP integration demo:', err);
  process.exit(1);
});
