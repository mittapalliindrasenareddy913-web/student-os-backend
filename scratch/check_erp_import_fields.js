const fs = require('fs');
const filePath = 'e:\\indra projects\\STUDENT OS\\campus\\web\\src\\pages\\CampusDashboard.tsx';

function checkErpFields() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    console.log('\n--- Lines 2904 to 3050 of CampusDashboard.tsx ---');
    for (let i = 2903; i < 3050; i++) {
      if (lines[i]) console.log(`${i+1}: ${lines[i]}`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkErpFields();
