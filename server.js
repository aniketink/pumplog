const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve index.html from root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static assets from public folder
app.use(express.static('public'));

// Import API routes to ensure parity with Vercel functions
const locationsHandler = require('./api/locations');
const entryHandler = require('./api/entry');
const recentHandler = require('./api/recent');
const downloadHandler = require('./api/download');
const statsHandler = require('./api/stats');
const loginHandler = require('./api/login');

app.get('/api/locations', locationsHandler);
app.post('/api/entry', entryHandler);
app.get('/api/recent', recentHandler);
app.get('/api/download', downloadHandler);
app.get('/api/stats', statsHandler);
app.post('/api/login', loginHandler);

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => {
    console.log('Google Sheets Server started on port 3000');
  });
}

module.exports = app;
