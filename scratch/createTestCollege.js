// End-to-end test: Create a test college, approve it, register principal
const BASE = 'http://localhost:5000/api';

const run = async () => {
  try {
    // ═══════════════════════════════════════════
    // STEP 1: Submit College Request
    // ═══════════════════════════════════════════
    console.log('\n═══ STEP 1: Submitting College Request ═══\n');
    
    const requestBody = {
      collegeName: 'Indra Institute of Technology & Sciences',
      aisheCode: 'C-99999',
      university: 'JNTUA',
      state: 'Andhra Pradesh',
      district: 'Nellore',
      city: 'Gudur',
      collegeType: 'Private',
      website: 'https://indratech.edu.in',
      officialEmail: 'admin@indratech.edu.in',
      officialPhone: '9876543210',
      address: 'NH-16, Gudur, SPSR Nellore District, Andhra Pradesh',
      pincode: '524101',
      principalName: 'Dr. Indra Kumar',
      principalEmail: 'principal@indratech.edu.in'
    };

    const submitRes = await fetch(`${BASE}/college-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    const submitData = await submitRes.json();
    console.log('Submit Response:', JSON.stringify(submitData, null, 2));

    if (!submitRes.ok) {
      console.error('❌ Submit failed:', submitData.message);
      return;
    }

    // ═══════════════════════════════════════════
    // STEP 2: Get the request ID
    // ═══════════════════════════════════════════
    console.log('\n═══ STEP 2: Fetching Pending Requests ═══\n');

    const listRes = await fetch(`${BASE}/college-requests`);
    const requests = await listRes.json();
    
    // Find our request
    const ourRequest = requests.find(r => r.collegeName === 'Indra Institute of Technology & Sciences' && r.status === 'pending');
    if (!ourRequest) {
      console.error('❌ Could not find the pending request');
      console.log('All requests:', requests.map(r => `${r.collegeName} [${r.status}]`));
      return;
    }
    console.log(`✅ Found request: ${ourRequest._id} (${ourRequest.status})`);

    // ═══════════════════════════════════════════
    // STEP 3: Login as Super Admin to get token
    // ═══════════════════════════════════════════
    console.log('\n═══ STEP 3: Super Admin Login ═══\n');

    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@campusos.com',
        password: 'superadmin123'
      })
    });
    const loginData = await loginRes.json();
    
    if (!loginRes.ok) {
      console.error('❌ Login failed:', loginData.message);
      return;
    }
    const token = loginData.token || loginData.accessToken;
    console.log(`✅ Super Admin logged in. Token: ${token?.substring(0, 30)}...`);

    // ═══════════════════════════════════════════
    // STEP 4: Approve the request
    // ═══════════════════════════════════════════
    console.log('\n═══ STEP 4: Approving College Request ═══\n');

    const approveRes = await fetch(`${BASE}/super-admin/requests/${ourRequest._id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const approveData = await approveRes.json();
    console.log('Approve Response:', JSON.stringify(approveData, null, 2));

    if (!approveRes.ok) {
      console.error('❌ Approve failed:', approveData.message);
      return;
    }

    const collegeCode = approveData.college?.collegeCode;
    console.log(`\n✅ College Approved! Code: ${collegeCode}`);

    // ═══════════════════════════════════════════
    // STEP 5: Register Principal
    // ═══════════════════════════════════════════
    console.log('\n═══ STEP 5: Registering Principal ═══\n');

    const principalRes = await fetch(`${BASE}/college/request-activation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collegeCode: collegeCode,
        email: 'principal@indratech.edu.in',
        password: 'IndraAdmin@2026',
        fullName: 'Dr. Indra Kumar',
        address: 'NH-16, Gudur, SPSR Nellore District'
      })
    });
    const principalData = await principalRes.json();
    console.log('Principal Registration Response:', JSON.stringify(principalData, null, 2));

    // ═══════════════════════════════════════════
    // FINAL SUMMARY
    // ═══════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║        🎉 TEST COLLEGE CREATED SUCCESSFULLY!        ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  College: Indra Institute of Technology & Sciences   ║`);
    console.log(`║  Code:    ${collegeCode.padEnd(43)}║`);
    console.log(`║  City:    Gudur, Nellore, Andhra Pradesh             ║`);
    console.log(`║  University: JNTUA                                   ║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║  PRINCIPAL LOGIN DETAILS:                            ║');
    console.log('║  Email:    principal@indratech.edu.in                 ║');
    console.log('║  Password: IndraAdmin@2026                           ║');
    console.log('╚══════════════════════════════════════════════════════╝');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
};

run();
