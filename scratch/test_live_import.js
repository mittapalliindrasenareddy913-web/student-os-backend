const axios = require('axios');

async function testLiveImport() {
  const backendUrl = 'https://student-os-backend-44v4.onrender.com/api';
  console.log(`1. Logging in to live Render backend ${backendUrl}...`);

  try {
    // Attempt login as college admin/principal
    const loginRes = await axios.post(`${backendUrl}/auth/campus/login`, {
      collegeCode: 'ASCET001',
      emailOrEmployeeId: 'principal@college.edu',
      password: 'principal123',
      role: 'principal'
    }, { timeout: 15000 });

    const token = loginRes.data.accessToken || loginRes.data.token;
    console.log('Login successful. Token acquired:', token ? `${token.substring(0, 15)}...` : 'undefined');

    if (!token) {
      console.error('Failed to acquire token.');
      return;
    }

    console.log('\n2. Sending erp/import execution request...');
    const records = [
      {
        'Roll Number': '25G2A04LA3',
        'Admission Number': 'ADM25G0403',
        'Student Name': 'MITTAPALLI INDRASENA REDDY',
        'Department': 'ECE',
        'Semester': '4',
        'Section': 'A',
        'Gender': 'Male',
        'DOB': '2004-05-12',
        'Blood Group': 'O+',
        'Address': 'Nellore Andhra Pradesh',
        'Parent Name': 'M Subba Reddy',
        'Parent Mobile': '9988776655',
        'Email': 'indrasena@gmail.com',
        'Phone': '8899001122'
      }
    ];

    const importRes = await axios.post(`${backendUrl}/erp/import`, {
      importType: 'students',
      records: records,
      fileName: 'test.csv',
      duplicateStrategy: 'Update Existing Records',
      dryRun: false
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: 15000
    });

    console.log('Success! Response Status:', importRes.status);
    console.log('Response JSON:', importRes.data);

  } catch (err) {
    console.error('\nERROR OCCURRED:');
    if (err.response) {
      console.error('Status Code:', err.response.status);
      console.error('Response Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('Error Message:', err.message);
    }
  }
}

testLiveImport();
