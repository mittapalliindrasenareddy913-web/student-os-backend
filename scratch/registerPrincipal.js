// Register principal for the already-approved test college
const BASE = 'http://localhost:5000/api';

const run = async () => {
  try {
    console.log('\n═══ Registering Principal for IIOTS724 ═══\n');

    const res = await fetch(`${BASE}/college/request-activation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collegeCode: 'IIOTS724',
        email: 'principal@indratech.edu.in',
        password: 'IndraAdmin@2026',
        fullName: 'Dr. Indra Kumar',
        address: 'NH-16, Gudur, SPSR Nellore District'
      })
    });
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (res.ok) {
      console.log('\n╔══════════════════════════════════════════════════════════╗');
      console.log('║     🎉 TEST COLLEGE FULLY CREATED & READY TO USE!       ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║  College: Indra Institute of Technology & Sciences       ║');
      console.log('║  Code:    IIOTS724                                       ║');
      console.log('║  City:    Gudur, Nellore, Andhra Pradesh                 ║');
      console.log('║  University: JNTUA                                       ║');
      console.log('╠══════════════════════════════════════════════════════════╣');
      console.log('║  PRINCIPAL LOGIN:                                        ║');
      console.log('║  Email:    principal@indratech.edu.in                     ║');
      console.log('║  Password: IndraAdmin@2026                               ║');
      console.log('║  Portal:   http://localhost:5180/login/principal          ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
    } else {
      console.error('❌ Failed:', data.message);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
};

run();
