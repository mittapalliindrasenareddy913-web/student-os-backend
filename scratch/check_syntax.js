const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dirsToCheck = ['modules', 'shared', 'routes', 'controllers', 'config', 'models', 'utils', 'middleware'];
const filesToCheck = [path.join(root, 'index.js'), path.join(root, 'socket.js')];

// Recursively find js files
function findJsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        results = results.concat(findJsFiles(filePath));
      }
    } else if (file.endsWith('.js')) {
      results.push(filePath);
    }
  });
  return results;
}

dirsToCheck.forEach(d => {
  const dirPath = path.join(root, d);
  if (fs.existsSync(dirPath)) {
    filesToCheck.push(...findJsFiles(dirPath));
  }
});

let failed = 0;
let passed = 0;

filesToCheck.forEach(file => {
  try {
    execSync(`node --check "${file}"`, { stdio: 'ignore' });
    passed++;
  } catch (err) {
    console.error(`Syntax Error in ${file}`);
    failed++;
  }
});

console.log(`\nSyntax Check Complete:`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
