const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\backend\\controllers\\erpController.js';

function checkProcessImportRow() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log('\nSearching for processImportRow...');
    let startIndex = -1;
    lines.forEach((line, index) => {
      if (line.includes('const processImportRow') || line.includes('function processImportRow') || line.includes('processImportRow =')) {
        startIndex = index;
      }
    });

    if (startIndex !== -1) {
      console.log(`Found processImportRow at line ${startIndex + 1}:`);
      for (let i = startIndex; i < Math.min(startIndex + 180, lines.length); i++) {
        console.log(`${i+1}: ${lines[i]}`);
      }
    } else {
      console.log('Could not find processImportRow definition!');
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkProcessImportRow();
