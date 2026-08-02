const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\campus\\web\\src\\pages\\CampusDashboard.tsx';

function findImportType() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log('Searching for erpImportType state and choices...');
    lines.forEach((line, index) => {
      if (line.includes('erpImportType') || line.includes('setErpImportType')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

findImportType();
