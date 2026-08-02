const axios = require('axios');
const FormData = require('form-data');
const BASE = 'http://localhost:5000/api';

const run = async () => {
  try {
    console.log('🚀 Running end-to-end API upload test...');

    // 1. Login to get token
    console.log('🔑 Logging in as Super Admin...');
    const loginRes = await axios.post(`${BASE}/auth/campus/login`, {
      emailOrEmployeeId: 'mittapalliindrasenareddy913@gmail.com',
      password: 'ISR@MB@d',
      role: 'super_admin'
    });
    const token = loginRes.data.token;
    console.log(`✅ Token received: ${token.substring(0, 25)}...`);

    // 2. Prepare upload form data
    console.log('📤 Submitting form upload request...');
    const form = new FormData();
    form.append('file', Buffer.from('Testing API integration for R2 object storage!'), {
      filename: 'api_r2_test_file.txt',
      contentType: 'text/plain'
    });

    const uploadRes = await axios.post(`${BASE}/community/posts/upload`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    console.log('\n✅ Upload API response:');
    console.log(JSON.stringify(uploadRes.data, null, 2));

    // 3. Test multiple uploads
    console.log('\n📤 Submitting multiple file uploads...');
    const multiForm = new FormData();
    multiForm.append('files', Buffer.from('File number 1'), { filename: 'file1.txt', contentType: 'text/plain' });
    multiForm.append('files', Buffer.from('File number 2'), { filename: 'file2.png', contentType: 'image/png' });

    const multiUploadRes = await axios.post(`${BASE}/community/posts/upload-multiple`, multiForm, {
      headers: {
        ...multiForm.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });

    console.log('\n✅ Multiple Upload API response:');
    console.log(JSON.stringify(multiUploadRes.data, null, 2));

  } catch (err) {
    console.error('❌ API Upload failed:', err.response ? err.response.data : err.message);
  }
};

run();
