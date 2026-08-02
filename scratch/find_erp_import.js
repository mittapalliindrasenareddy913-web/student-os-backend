const fs = require('fs');
const path = require('path');

const filePath = 'e:\\indra projects\\STUDENT OS\\campus\\web\\src\\pages\\CampusDashboard.tsx';

function findERP() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    console.log('Total lines:', lines.length);

    console.log('\nSearching for "ERP Import"...');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('erp') || line.toLowerCase().includes('import')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

findERP();
