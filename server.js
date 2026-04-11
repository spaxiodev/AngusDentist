require('dotenv').config();

const app = require('./api/index');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n  Clinique Dentaire Angus`);
  console.log(`    Server: http://localhost:${PORT}`);
  console.log(`    Admin:  http://localhost:${PORT}/admin\n`);
});
