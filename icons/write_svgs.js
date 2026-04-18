const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'general');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let count = 0;
for (const [name, svg] of Object.entries(data)) {
  if (svg && svg !== 'NOT_FOUND') {
    fs.writeFileSync(path.join(dir, name + '.svg'), svg);
    count++;
  }
}
console.log(`Wrote ${count} SVG files`);
