const axios = require('axios');

async function testUrls() {
  const url1 = 'https://studentos-backend.onrender.com';
  const url2 = 'https://student-os-backend-44v4.onrender.com';

  console.log('Testing URLs with 60s timeout to wake up Render...');
  
  try {
    const res1 = await axios.get(url1, { timeout: 60000 });
    console.log(`URL 1 (${url1}) is UP! Response:`, res1.status, res1.data);
  } catch (err) {
    console.log(`URL 1 (${url1}) failed:`, err.message);
  }

  try {
    const res2 = await axios.get(url2, { timeout: 60000 });
    console.log(`URL 2 (${url2}) is UP! Response:`, res2.status, res2.data);
  } catch (err) {
    console.log(`URL 2 (${url2}) failed:`, err.message);
  }
}

testUrls();
