const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\backend\\controllers\\erpController.js';

function checkValidationPipeline() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log('\nSearching for runValidationPipeline...');
    let startIndex = -1;
    lines.forEach((line, index) => {
      if (line.includes('const runValidationPipeline') || line.includes('function runValidationPipeline') || line.includes('runValidationPipeline =')) {
        startIndex = index;
      }
    });

    if (startIndex !== -1) {
      console.log(`Found runValidationPipeline at line ${startIndex + 1}:`);
      for (let i = startIndex; i < Math.min(startIndex + 180, lines.length); i++) {
        console.log(`${i+1}: ${lines[i]}`);
      }
    } else {
      console.log('Could not find runValidationPipeline definition!');
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkValidationPipeline();
