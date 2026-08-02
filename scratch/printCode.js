const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\campus\\web\\src\\pages\\CampusDashboard.tsx';

function printCode() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    console.log('\n--- Lines 1680 to 1750 ---');
    for (let i = 1679; i < 1750; i++) {
      if (lines[i]) console.log(`${i+1}: ${lines[i]}`);
    }

    console.log('\n--- Lines 10450 to 10550 ---');
    for (let i = 10449; i < 10550; i++) {
      if (lines[i]) console.log(`${i+1}: ${lines[i]}`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

printCode();
