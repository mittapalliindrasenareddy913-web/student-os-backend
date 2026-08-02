require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const uploadToR2 = require('../utils/uploadToR2');
const deleteFromR2 = require('../utils/deleteFromR2');

const run = async () => {
  try {
    console.log('🚀 Starting Cloudflare R2 Upload Test...');
    
    // Create a dummy text buffer representing a file
    const fileBuffer = Buffer.from('hello cloudflare r2 from student os test script!');
    const originalName = 'test_r2_upload.txt';
    const mimeType = 'text/plain';
    const folder = 'temp';

    console.log(`📤 Uploading dummy file: ${originalName} to folder: ${folder}`);
    const uploadResult = await uploadToR2(fileBuffer, originalName, mimeType, folder);
    
    console.log('\n✅ Upload Success!');
    console.log(JSON.stringify(uploadResult, null, 2));

    const fileUrl = uploadResult.publicUrl;
    console.log(`🔗 Public URL: ${fileUrl}`);

    // Wait a brief second and test deletion
    console.log('\n🗑️  Testing deletion of uploaded file...');
    const deleteResult = await deleteFromR2(fileUrl);
    console.log(`✅ Deletion Success: ${deleteResult}`);

  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
};

run();
