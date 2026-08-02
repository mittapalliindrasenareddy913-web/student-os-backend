const bcrypt = require('bcryptjs');
const College = require('../models/College');
const User = require('../models/User');
const { logAction } = require('../services/auditLogService');

// Search colleges in master database
const searchColleges = async (req, res) => {
  try {
    const { query } = req.query;
    const filter = query 
      ? { name: { $regex: query, $options: 'i' } } 
      : {};
    
    const colleges = await College.find(filter).select('collegeCode name university state district status');
    res.status(200).json(colleges);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Request activation of a college workspace (Principal details + password creation)
const requestActivation = async (req, res) => {
  try {
    const { collegeCode, email, password, fullName, address } = req.body;

    if (!collegeCode || !email || !password || !fullName) {
      return res.status(400).json({ message: 'All activation fields are required.' });
    }

    const college = await College.findOne({ collegeCode: collegeCode.toUpperCase() });
    if (!college) {
      return res.status(404).json({ message: 'College Code not found in Master Database.' });
    }

    if (college.status === 'active') {
      return res.status(400).json({ message: 'This college workspace is already activated.' });
    }

    // Verify if email is already registered as principal/admin
    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ message: 'This email is already in use.' });
    }

    // Hash principal password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create the Principal User record
    const principalUser = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'principal',
      collegeCode: collegeCode.toUpperCase(),
      employeeId: 'PRINCIPAL001',
      isActive: true
    });

    // Update status to pending approval by Super Admin
    college.status = 'pending_activation';
    await college.save();

    await logAction(principalUser._id, 'principal', collegeCode.toUpperCase(), '', 'REQUESTED_WORKSPACE_ACTIVATION', req);

    res.status(200).json({ 
      message: 'Activation request submitted successfully. Waiting for Super Admin approval.',
      collegeStatus: college.status
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

let collegesCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 30000; // 30 seconds cache TTL

const getCollegesCache = async () => {
  const now = Date.now();
  if (!collegesCache || (now - lastCacheUpdate) > CACHE_TTL) {
    collegesCache = await College.find({ status: { $in: ['active', 'verified', 'pending_verification'] } })
      .select('name city district state university collegeCode aisheCode collegeType status naacGrade verifiedBadge address logo')
      .lean();
    lastCacheUpdate = now;
  }
  return collegesCache;
};

// Fast Levenshtein distance with early exit for performance
function levenshteinDistance(s1, s2) {
  const len1 = s1.length;
  const len2 = s2.length;
  if (Math.abs(len1 - len2) > 3) return 99; // early exit for distinct lengths
  
  const matrix = [];
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[len1][len2];
}

function getSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const dist = levenshteinDistance(s1.toLowerCase().trim(), s2.toLowerCase().trim());
  if (dist === 99) return 0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - dist / maxLen;
}

// Searchable directory API for Register College wizard
const directorySearch = async (req, res) => {
  try {
    const { query, state, district, university, collegeType, naacGrade } = req.query;

    const allColleges = await getCollegesCache();

    // 1. Dropdown Filters
    let filtered = allColleges;
    if (state) {
      filtered = filtered.filter(c => c.state && c.state.toLowerCase() === state.toLowerCase());
    }
    if (district) {
      filtered = filtered.filter(c => c.district && c.district.toLowerCase() === district.toLowerCase());
    }
    if (university) {
      filtered = filtered.filter(c => c.university && c.university.toLowerCase() === university.toLowerCase());
    }
    if (collegeType) {
      filtered = filtered.filter(c => c.collegeType && c.collegeType.toLowerCase() === collegeType.toLowerCase());
    }
    if (naacGrade) {
      filtered = filtered.filter(c => c.naacGrade && c.naacGrade.toLowerCase() === naacGrade.toLowerCase());
    }

    // 2. If no search query, return filtered results directly
    if (!query || !query.trim()) {
      return res.status(200).json(filtered);
    }

    const q = query.toLowerCase().trim();
    const queryTokens = q.split(/\s+/).filter(t => t.length > 0);

    // 3. Search and scoring loop
    const scoredColleges = [];
    const matchedDistricts = new Set();

    for (const college of filtered) {
      let score = 0;
      let exactNameMatch = false;
      let exactCityMatch = false;
      let exactDistrictMatch = false;
      let exactStateMatch = false;
      let exactUnivMatch = false;
      let exactCodeMatch = false;
      let fuzzyMatch = false;

      const cName = (college.name || '').toLowerCase();
      const cCity = (college.city || '').toLowerCase();
      const cDist = (college.district || '').toLowerCase();
      const cState = (college.state || '').toLowerCase();
      const cUniv = (college.university || '').toLowerCase();
      const cCode = (college.collegeCode || '').toLowerCase();
      const cAishe = (college.aisheCode || '').toLowerCase();
      const cType = (college.collegeType || '').toLowerCase();

      // Exact/Substring matching
      if (cName === q) {
        score += 1000;
        exactNameMatch = true;
      } else if (cName.includes(q)) {
        score += 400;
      }

      if (cCity === q) {
        score += 800;
        exactCityMatch = true;
        if (college.district) matchedDistricts.add(college.district);
      } else if (cCity && cCity.includes(q)) {
        score += 300;
      }

      if (cDist === q) {
        score += 600;
        exactDistrictMatch = true;
        if (college.district) matchedDistricts.add(college.district);
      } else if (cDist && cDist.includes(q)) {
        score += 200;
      }

      if (cState === q) {
        score += 400;
        exactStateMatch = true;
      } else if (cState && cState.includes(q)) {
        score += 100;
      }

      if (cUniv === q) {
        score += 500;
        exactUnivMatch = true;
      } else if (cUniv && cUniv.includes(q)) {
        score += 150;
      }

      if (cCode === q || cAishe === q) {
        score += 900;
        exactCodeMatch = true;
      }

      if (cType === q) {
        score += 200;
      }

      // Token and Fuzzy (typo-corrected) matching
      for (const token of queryTokens) {
        if (cName.includes(token)) score += 80;
        if (cCity && cCity.includes(token)) score += 60;
        if (cDist && cDist.includes(token)) score += 40;
        if (cUniv && cUniv.includes(token)) score += 30;

        if (token.length >= 3) {
          const nameTokens = cName.split(/\s+/);
          for (const nt of nameTokens) {
            const sim = getSimilarity(token, nt);
            if (sim >= 0.75) {
              score += 200 * sim;
              fuzzyMatch = true;
            }
          }

          if (cCity) {
            const sim = getSimilarity(token, cCity);
            if (sim >= 0.75) {
              score += 300 * sim;
              fuzzyMatch = true;
              if (college.district) matchedDistricts.add(college.district);
            }
          }

          if (cDist) {
            const sim = getSimilarity(token, cDist);
            if (sim >= 0.75) {
              score += 250 * sim;
              fuzzyMatch = true;
              if (college.district) matchedDistricts.add(college.district);
            }
          }

          if (cState) {
            const sim = getSimilarity(token, cState);
            if (sim >= 0.75) {
              score += 150 * sim;
              fuzzyMatch = true;
            }
          }
        }
      }

      if (score > 0) {
        scoredColleges.push({
          college,
          score,
          exactNameMatch,
          exactCityMatch,
          exactDistrictMatch,
          exactStateMatch,
          exactUnivMatch,
          exactCodeMatch,
          fuzzyMatch,
          isNearbyMatch: false
        });
      }
    }

    // 4. District-level Fallback for "Nearby Colleges"
    if (matchedDistricts.size > 0) {
      for (const college of filtered) {
        const isMatched = scoredColleges.some(sc => sc.college.collegeCode === college.collegeCode);
        if (!isMatched && college.district && matchedDistricts.has(college.district)) {
          scoredColleges.push({
            college,
            score: 100, // Nearby match score
            exactNameMatch: false,
            exactCityMatch: false,
            exactDistrictMatch: false,
            exactStateMatch: false,
            exactUnivMatch: false,
            exactCodeMatch: false,
            fuzzyMatch: false,
            isNearbyMatch: true
          });
        }
      }
    }

    // 5. Filter out unrelated items if direct matches are found
    const maxScore = scoredColleges.reduce((max, item) => Math.max(max, item.score), 0);
    let finalItems = scoredColleges;

    if (maxScore >= 200) {
      finalItems = finalItems.filter(item => item.score >= 100);
    }

    // Sort by relevance score
    finalItems.sort((a, b) => b.score - a.score);

    // Map response structure and attach rating star counts (1-5)
    const results = finalItems.map(item => {
      let rating = 1;
      if (item.exactNameMatch || item.exactCodeMatch) rating = 5;
      else if (item.exactCityMatch) rating = 4;
      else if (item.exactDistrictMatch || item.isNearbyMatch) rating = 3;
      else if (item.exactStateMatch) rating = 2;
      else if (item.fuzzyMatch) rating = 1;

      return {
        ...item.college,
        rating,
        relevanceScore: item.score
      };
    });

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCollegeNameByCode = async (req, res) => {
  try {
    const { code } = req.params;
    const College = require('../models/College');
    const college = await College.findOne({ collegeCode: code.toUpperCase() }).select('name');
    if (!college) return res.status(404).json({ message: 'College not found.' });
    res.json({ name: college.name });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  searchColleges,
  requestActivation,
  directorySearch,
  getCollegeNameByCode
};
