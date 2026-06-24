const { google } = require('googleapis');
const { getAuth, SPREADSHEET_ID, SHEETS, authenticate } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const sheetsAPI = google.sheets({ version: 'v4', auth: getAuth() });
    
    // Only query sheets allowed for this user
    const allowedKeys = Object.keys(SHEETS).filter(k => user.allowedSheets.includes(k));
    const ranges = allowedKeys.map(k => `${k}!B${SHEETS[k].start}:B${SHEETS[k].end}`);
    
    const response = await sheetsAPI.spreadsheets.values.batchGet({ spreadsheetId: SPREADSHEET_ID, ranges });
    const valueRanges = response.data.valueRanges || [];
    
    let list = [];
    let i = 0;
    for (let key of allowedKeys) {
      const count = (valueRanges[i]?.values || []).filter(r => r && r[0] != null && r[0] !== '').length;
      list.push({ sheetName: key, displayName: SHEETS[key].name, entriesCount: count, maxEntries: SHEETS[key].end - SHEETS[key].start + 1 });
      i++;
    }
    res.json({ locations: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
