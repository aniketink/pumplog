const { authenticate, AGENCIES } = require('./_lib');

module.exports = (req, res) => {
  if (req.query.token) {
    req.headers['authorization'] = `Basic ${req.query.token}`;
  }
  const user = authenticate(req);
  if (!user) return res.status(401).send('Unauthorized');

  let spreadsheetId = user.spreadsheetId;
  if (user.isAdmin) {
    const targetAgencyKey = req.query.agency;
    const agency = AGENCIES[targetAgencyKey];
    if (agency) {
      spreadsheetId = agency.spreadsheetId;
    } else {
      return res.status(400).send('Please specify a valid agency parameter (e.g., ?agency=sas)');
    }
  }

  if (!spreadsheetId || spreadsheetId.includes('HERE')) {
    return res.status(400).send('Spreadsheet ID missing for this agency. Please configure it.');
  }
  res.redirect(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`);
};
