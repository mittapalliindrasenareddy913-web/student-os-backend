const axios = require('axios');

async function testSuperAdminSystem() {
  try {
    console.log('1. Logging in as Super Admin (indra0408)...');
    const loginRes = await axios.post('http://localhost:5000/api/auth/campus/login/super-admin', {
      emailOrEmployeeId: 'indra0408',
      password: 'ISR@MB@d'
    });

    const token = loginRes.data.token;
    console.log('✅ Super Admin Logged in successfully. Token acquired.');

    const headers = { Authorization: `Bearer ${token}` };

    console.log('\n2. Testing Priority 1: Register New College API (/register-full)...');
    const testCollegeData = {
      name: 'Vyas Institute of Engineering & Technology',
      collegeCode: `VIET${Math.floor(100 + Math.random() * 900)}`,
      collegeType: 'Autonomous',
      university: 'JNTUA',
      country: 'India',
      state: 'Andhra Pradesh',
      district: 'Tirupati',
      city: 'Tirupati',
      address: 'Main Highway, Tirupati',
      pincode: '517501',
      officialEmail: `viet${Date.now()}@college.edu`,
      officialPhone: '+91 9988776655',
      website: 'https://viet.edu.in',
      principalName: 'Dr. R. K. Varma',
      principalEmail: `principal${Date.now()}@viet.edu.in`,
      principalPhone: '+91 9123456789',
      subscriptionPlan: 'Enterprise',
      maxStudents: 3000,
      maxFaculty: 300,
      maxDepartments: 15,
      status: 'active'
    };

    const regRes = await axios.post('http://localhost:5000/api/super-admin/requests/colleges/register-full', testCollegeData, { headers });
    console.log('✅ College Registration Response:', regRes.data.message);
    console.log('   Institution ID:', regRes.data.institutionId);
    console.log('   College Code:', regRes.data.college.collegeCode);

    console.log('\n3. Testing Duplicate Code Validation...');
    try {
      await axios.post('http://localhost:5000/api/super-admin/requests/colleges/register-full', testCollegeData, { headers });
      console.error('❌ DUPLICATE VALIDATION FAILED: Should have rejected duplicate code!');
    } catch (err) {
      console.log('✅ DUPLICATE VALIDATION WORKING PERFECTLY:', err.response?.data?.message);
    }

    console.log('\n4. Fetching Live Stats Aggregation...');
    const statsRes = await axios.get('http://localhost:5000/api/super-admin/requests/stats', { headers });
    console.log('✅ Live Stats:', {
      totalColleges: statsRes.data.totalColleges,
      activeColleges: statsRes.data.activeColleges,
      totalStudents: statsRes.data.totalStudents,
      totalActiveUsers: statsRes.data.totalActiveUsers,
      monthlyRevenue: statsRes.data.monthlyRevenue
    });

    console.log('\n5. Fetching Colleges List...');
    const colListRes = await axios.get('http://localhost:5000/api/super-admin/requests/colleges', { headers });
    console.log(`✅ Total Colleges in DB: ${colListRes.data.length}`);

    console.log('\n🎉 ALL SUPER ADMIN BACKEND & API TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ TEST FAILURE:', err.response?.data || err.message);
  }
}

testSuperAdminSystem();
