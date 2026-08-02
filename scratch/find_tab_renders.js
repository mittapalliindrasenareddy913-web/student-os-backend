const fs = require('fs');
const filePath = 'e:\\indra projects\\STUDENT OS\\campus\\web\\src\\pages\\CampusDashboard.tsx';

function findTabRenders() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    console.log('Searching for tab render switch...');
    lines.forEach((line, index) => {
      if (line.includes('activeTab') || line.includes('activeStep') || line.includes('workflowStep') || line.includes('=== \'erp\'') || line.includes('=== "erp"')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

findTabRenders();
