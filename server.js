require('dotenv').config();

const app = require('./api/index');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n  Clinique Dentaire Angus-Maisonneuve (Urgence et Familiale)`);
  console.log(`    Server: http://localhost:${PORT}\n`);
});
