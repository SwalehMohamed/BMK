// Run this in a Node.js REPL or script
const bcrypt = require('bcryptjs');
console.log('Admin hash:', bcrypt.hashSync('admin123', 10));
console.log('User hash:', bcrypt.hashSync('user123', 10));