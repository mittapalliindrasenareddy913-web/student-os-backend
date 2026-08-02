const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\backend\\controllers\\erpController.js';

function checkAutoConfig() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log('Searching for "runErpAutoConfigurations" in erpController.js...');
    let startIndex = -1;
    lines.forEach((line, index) => {
      if (line.includes('runErpAutoConfigurations')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
        if (line.includes('const') || line.includes('function')) {
          startIndex = index;
        }
      }
    });

    if (startIndex !== -1) {
      console.log(`\nFound runErpAutoConfigurations definition starting at line ${startIndex + 1}:`);
      for (let i = startIndex; i < Math.min(startIndex + 100, lines.length); i++) {
        console.log(`${i+1}: ${lines[i]}`);
      }
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkAutoConfig();
