const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\backend\\controllers\\erpController.js';

function checkSendFcm() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log('Searching for "sendDirectFcm" in erpController.js...');
    lines.forEach((line, index) => {
      if (line.includes('sendDirectFcm')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkSendFcm();
