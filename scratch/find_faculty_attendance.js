const fs = require('fs');

const filePath = 'e:\\indra projects\\STUDENT OS\\campus\\web\\src\\pages\\CampusDashboard.tsx';

function checkFacultyAttendance() {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    console.log('Searching for renderFacultyAttendanceStep...');
    let startIndex = -1;
    lines.forEach((line, index) => {
      if (line.includes('const renderFacultyAttendanceStep')) {
        startIndex = index;
      }
    });

    if (startIndex !== -1) {
      console.log(`Found renderFacultyAttendanceStep at line ${startIndex + 1}:`);
      for (let i = startIndex; i < Math.min(startIndex + 150, lines.length); i++) {
        console.log(`${i+1}: ${lines[i]}`);
      }
    } else {
      console.log('Could not find renderFacultyAttendanceStep!');
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkFacultyAttendance();
