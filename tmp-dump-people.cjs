const fs = require('fs');
const s = fs.readFileSync('C:/Users/ruzel/gym-web-app-template/src/admin/AdminPeople.tsx', 'utf8');
fs.writeFileSync('C:/Users/ruzel/gym-web-app-template/tmp-people-full.txt', s, 'utf8');
console.log('BYTES=' + Buffer.byteLength(s));
console.log('LINES=' + s.split(/\r?\n/).length);
