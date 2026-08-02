const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\campus\\web\\src\\pages\\CampusDashboard.tsx';

function findErpMethods() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    console.log('Searching for ERP render methods...');
    lines.forEach((line, index) => {
      if (line.includes('const render') && (line.toLowerCase().includes('erp') || line.toLowerCase().includes('import'))) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
      }
    });

    console.log('\nSearching for workflowSteps elements...');
    lines.forEach((line, index) => {
      if (index > 1650 && index < 1720) {
        console.log(`${index + 1}: ${line}`);
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

findErpMethods();
