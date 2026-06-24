const { authenticate } = require('./_lib');

module.exports = (req, res) => {
  if (req.query.token) {
    req.headers['authorization'] = `Basic ${req.query.token}`;
  }
  const user = authenticate(req);
  if (!user) return res.status(401).send('Unauthorized');
  if (user.spreadsheetId.includes('HERE')) return res.status(400).send('Spreadsheet ID missing for this agency. Please configure it in the backend.');
  res.redirect(`https://docs.google.com/spreadsheets/d/${user.spreadsheetId}/export?format=xlsx`);
};
