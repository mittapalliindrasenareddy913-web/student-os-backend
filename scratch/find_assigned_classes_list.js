const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\campus\\web\\src\\pages\\CampusDashboard.tsx';

function checkAssignedClassesList() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log('Searching for "assignedClassesList"...');
    lines.forEach((line, index) => {
      if (line.includes('assignedClassesList')) {
        console.log(`Line ${index + 1}: ${line.trim()}`);
      }
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkAssignedClassesList();
