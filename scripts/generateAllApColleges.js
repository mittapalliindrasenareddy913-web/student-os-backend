require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Force Google DNS
const mongoose = require('mongoose');
const College = require('../models/College');
const apCollegesPreset = require('../utils/apCollegesData');

// Helper to determine city from district & address
const getCityForDistrict = (district, address) => {
  const addr = (address || '').toLowerCase();
  const dist = (district || '').toLowerCase();

  if (addr.includes('gudur')) return 'Gudur';
  if (addr.includes('tirupati')) return 'Tirupati';
  if (addr.includes('kavali')) return 'Kavali';
  if (addr.includes('nellore')) return 'Nellore';
  if (addr.includes('bhimavaram')) return 'Bhimavaram';
  if (addr.includes('tadepalligudem')) return 'Tadepalligudem';
  if (addr.includes('eluru')) return 'Eluru';
  if (addr.includes('surampalem')) return 'Surampalem';
  if (addr.includes('peddapuram')) return 'Peddapuram';
  if (addr.includes('kakinada')) return 'Kakinada';
  if (addr.includes('rajahmundry')) return 'Rajahmundry';
  if (addr.includes('vijayawada')) return 'Vijayawada';
  if (addr.includes('guntur')) return 'Guntur';
  if (addr.includes('narasaraopet')) return 'Narasaraopet';
  if (addr.includes('kurnool')) return 'Kurnool';
  if (addr.includes('nandyal')) return 'Nandyal';
  if (addr.includes('kadapa')) return 'Kadapa';
  if (addr.includes('madanapalle')) return 'Madanapalle';
  if (addr.includes('anantapur')) return 'Anantapur';
  if (addr.includes('puttaparthi')) return 'Puttaparthi';
  if (addr.includes('visakhapatnam')) return 'Visakhapatnam';
  if (addr.includes('vizianagaram')) return 'Vizianagaram';
  if (addr.includes('rajam')) return 'Rajam';
  if (addr.includes('srikakulam')) return 'Srikakulam';
  if (addr.includes('tekkali')) return 'Tekkali';
  if (addr.includes('puttur')) return 'Puttur';
  if (addr.includes('chirala')) return 'Chirala';
  if (addr.includes('bapatla')) return 'Bapatla';
  if (addr.includes('ongole')) return 'Ongole';
  if (addr.includes('kandukur')) return 'Kandukur';

  if (dist.includes('nellore')) return 'Nellore';
  if (dist.includes('tirupati') || dist.includes('chittoor')) return 'Tirupati';
  if (dist.includes('kadapa')) return 'Kadapa';
  if (dist.includes('annamayya')) return 'Madanapalle';
  if (dist.includes('sri sathya sai')) return 'Puttaparthi';
  if (dist.includes('anantapur')) return 'Anantapur';
  if (dist.includes('kurnool')) return 'Kurnool';
  if (dist.includes('nandyal')) return 'Nandyal';
  if (dist.includes('prakasam')) return 'Ongole';
  if (dist.includes('bapatla')) return 'Bapatla';
  if (dist.includes('palnadu')) return 'Narasaraopet';
  if (dist.includes('guntur')) return 'Guntur';
  if (dist.includes('ntr') || dist.includes('krishna')) return 'Vijayawada';
  if (dist.includes('eluru')) return 'Eluru';
  if (dist.includes('west godavari')) return 'Bhimavaram';
  if (dist.includes('east godavari') || dist.includes('kakinada') || dist.includes('konaseema')) return 'Kakinada';
  if (dist.includes('visakhapatnam') || dist.includes('anakapalli')) return 'Visakhapatnam';
  if (dist.includes('vizianagaram')) return 'Vizianagaram';
  if (dist.includes('srikakulam')) return 'Srikakulam';

  return district || 'Vijayawada';
};

// ── Lists for Programmatic Generation ──────────────────────────────────────────
const collegeNames = [
  "Sri Venkateswara", "Lendi", "Raghu", "Sree Vidyanikethan", "Avanthi", "Lenora", 
  "GMR", "KLEF", "Chaitanya", "Vignan", "Aditya", "Adarsh", "GIET", "Kakinada Institute", 
  "Godavari", "Sir C.R. Reddy", "Ramachandra", "Eluru", "Swarnandhra", "West Godavari", 
  "Sasi", "Sri Vasavi", "Bhimavaram", "GVP", "Gayatri", "Baba", "Visakha", "Sanketika", 
  "Anil Neerukonda", "SITAM", "Sree Sivani", "AITAM", "Loyola", "MIC", "Gudlavalleru", 
  "NRI", "Vikas", "Nimra", "Dhanekula", "Andhra Loyola", "PVP", "Velagapudi Ramakrishna", 
  "Kallam Haranadhareddy", "Chalapathi", "KKR & KSR", "RVR & JC", "Vignan's Lara", 
  "Vignan's Nirula", "Sri Mittapalli", "Chebrolu", "Narasaraopeta", "Tirumala", 
  "Newton's", "Loyola Institute", "Bapatla", "St. Ann's", "QIS", "Pace", "Prakasam", 
  "Rao & Naidu", "Geethanjali", "Narayana", "Audisankara", "PBR VITS", "NBKR", 
  "Siddharth", "Siddartha", "MJR", "Annamacharya", "KSRM", "KLM", "Sanskrithi", 
  "Santhiram", "G. Pulla Reddy", "Dr. K.V. Subba Reddy", "St. Johns", "Bhuma", 
  "AVR & SVR", "Anantha Lakshmi", "PVKK", "Sri Ramakrishna", "Intel", "Sreenivasa", 
  "Sree Rama", "Chadalawada", "Priyadarshini", "Gouthami", "Gates", "KORM", 
  "Vaagdevi", "Sree Chaitanya", "Sri Krishna", "SSN", "Kottakkal", "Kuppam", 
  "Vemu", "Sree Pratapa", "Visvodaya", "Santhirama", "Hindustan", "Pragati",
  "Pioneer", "Pinnacle", "Vanguard", "Apex", "Nova", "St. Mary's", "St. Joseph's",
  "Nagarjuna", "Guntur Institute", "Krishna Institute", "Godavari Institute", 
  "Nellore Engineering", "Tirupati Institute", "Chittoor College", "Rayalaseema College",
  "Palnadu Institute", "Bapatla College", "Srikakulam Engineering", "Vizianagaram Tech"
];

const suffixes = [
  "College of Engineering",
  "Institute of Technology & Science",
  "Engineering College",
  "Institute of Science & Technology",
  "Institute of Technology",
  "College of Engineering & Technology",
  "Technical Campus",
  "Institute of Engineering & Technology",
  "Degree & PG College",
  "SaaS Institute of Engineering"
];

const rayalaseemaDistricts = [
  "Nellore", "Tirupati", "Chittoor", "Kadapa", "Annamayya", "Sri Sathya Sai", "Anantapur", "Kurnool", "Nandyal"
];

const coastalDistricts = [
  "Visakhapatnam", "Anakapalli", "Vizianagaram", "Srikakulam", "Parvathipuram Manyam", 
  "East Godavari", "Kakinada", "Konaseema", "Eluru", "West Godavari", 
  "Bapatla", "Palnadu", "Guntur", "NTR", "Krishna", "Prakasam"
];

const collegeTypes = ["Autonomous", "Private", "Government"];
const naacGrades = ["A++", "A+", "A", "B++", "B+", "B"];
const defaultDepts = ["CSE", "ECE", "EEE", "Mechanical", "Civil", "IT"];

const generateUniqueColleges = (targetCount) => {
  // Map preset to assign city field
  const generatedList = apCollegesPreset.map(c => ({
    ...c,
    city: c.city || getCityForDistrict(c.district, c.address || c.name)
  }));
  
  const seenCodes = new Set(generatedList.map(c => c.collegeCode.toUpperCase()));
  const seenNames = new Set(generatedList.map(c => c.name.toLowerCase()));

  let index = 1;
  while (generatedList.length < targetCount) {
    const isRayalaseema = Math.random() > 0.5;
    const district = isRayalaseema 
      ? rayalaseemaDistricts[Math.floor(Math.random() * rayalaseemaDistricts.length)]
      : coastalDistricts[Math.floor(Math.random() * coastalDistricts.length)];

    let university = "JNTUK";
    if (isRayalaseema) {
      university = Math.random() > 0.3 ? "JNTUA" : "Sri Venkateswara University";
    } else {
      const rand = Math.random();
      if (rand < 0.4) university = "JNTUK";
      else if (rand < 0.7) university = "Andhra University";
      else university = "Acharya Nagarjuna University";
    }

    const baseName = collegeNames[Math.floor(Math.random() * collegeNames.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const name = `${baseName} ${suffix}`;

    // Skip duplicates
    if (seenNames.has(name.toLowerCase())) {
      continue;
    }

    // Generate unique college code
    const initials = name
      .split(' ')
      .map(w => w[0])
      .join('')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .substring(0, 4);
    
    const uniqueNum = String(100 + index).substring(1);
    const collegeCode = `${initials}AP${uniqueNum}`;

    if (seenCodes.has(collegeCode)) {
      index++;
      continue;
    }

    const aisheCode = `C-${Math.floor(20000 + Math.random() * 80000)}`;
    const collegeType = collegeTypes[Math.floor(Math.random() * collegeTypes.length)];
    const naacGrade = naacGrades[Math.floor(Math.random() * naacGrades.length)];
    const address = `${baseName} Campus, ${district}, Andhra Pradesh`;
    const city = getCityForDistrict(district, address || name);

    generatedList.push({
      collegeCode,
      name,
      address,
      university,
      state: "Andhra Pradesh",
      district,
      city,
      departments: defaultDepts,
      status: "active",
      aisheCode,
      collegeType,
      aicteApproved: true,
      ugcApproved: true,
      naacGrade,
      nbaAccredited: Math.random() > 0.5,
      verifiedBadge: true
    });

    seenCodes.add(collegeCode);
    seenNames.add(name.toLowerCase());
    index++;
  }

  return generatedList;
};

// Seed script execution
const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("MONGO_URI not defined.");

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    // Generate 450 unique colleges in AP
    const allApColleges = generateUniqueColleges(450);
    console.log(`Generated ${allApColleges.length} colleges for seeding.`);

    let insertedCount = 0;
    let skippedCount = 0;

    for (const c of allApColleges) {
      const exists = await College.findOne({ collegeCode: c.collegeCode });
      if (!exists) {
        await College.create(c);
        insertedCount++;
      } else {
        // Update details
        exists.name = c.name;
        exists.address = c.address;
        exists.university = c.university;
        exists.state = c.state;
        exists.district = c.district;
        exists.city = c.city;
        exists.aisheCode = c.aisheCode;
        exists.collegeType = c.collegeType;
        exists.naacGrade = c.naacGrade;
        exists.verifiedBadge = c.verifiedBadge;
        exists.status = c.status;
        await exists.save();
        skippedCount++;
      }
    }

    console.log(`\n🎉 Andhra Pradesh Comprehensive Registry Seeding Completed!`);
    console.log(`Total colleges in AP registered: ${allApColleges.length}`);
    console.log(`New additions: ${insertedCount}`);
    console.log(`Updated: ${skippedCount}`);

    // Export dataset as JSON file so frontend or seeder can use it directly
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(
      path.resolve(__dirname, '../utils/apCollegesData.js'),
      `const apColleges = ${JSON.stringify(allApColleges, null, 2)};\n\nmodule.exports = apColleges;\n`
    );
    console.log(`💾 Updated apCollegesData.js file with all 450 records.`);

  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed.");
    process.exit(0);
  }
};

run();
