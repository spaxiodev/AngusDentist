require('dotenv').config();

const express = require('express');
const path = require('path');

const app = require('./api/index');
const PORT = process.env.PORT || 3000;

// Serve static files (locally only — Vercel serves from public/ automatically)
app.use(express.static(path.join(__dirname, 'public')));

// Serve main site
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Clinique Dentaire Angus`);
  console.log(`    Server: http://localhost:${PORT}`);
  console.log(`    Admin:  http://localhost:${PORT}/admin\n`);
});
