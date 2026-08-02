const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\backend\\index.js';

function findErpRoutes() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    console.log('Searching for "erp" in index.js...');
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('erp')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

findErpRoutes();
