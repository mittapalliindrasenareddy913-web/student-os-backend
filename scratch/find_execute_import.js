const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\backend\\controllers\\erpController.js';

function checkExecuteImport() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log('Total lines in erpController:', lines.length);

    console.log('\nSearching for executeImportData...');
    let startIndex = -1;
    lines.forEach((line, index) => {
      if (line.includes('const executeImportData') || line.includes('exports.executeImportData') || line.includes('executeImportData =')) {
        startIndex = index;
      }
    });

    if (startIndex !== -1) {
      console.log(`Found executeImportData at line ${startIndex + 1}:`);
      for (let i = startIndex; i < Math.min(startIndex + 180, lines.length); i++) {
        console.log(`${i+1}: ${lines[i]}`);
      }
    } else {
      console.log('Could not find executeImportData definition!');
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkExecuteImport();
