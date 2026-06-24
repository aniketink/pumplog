const { google } = require('googleapis');
const { getAuth, authenticate } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const allowedKeys = Object.keys(user.sheets);
    
    if (user.spreadsheetId.includes('HERE')) {
      let list = allowedKeys.map(k => ({ sheetName: k, displayName: user.sheets[k].name, entriesCount: 0, maxEntries: user.sheets[k].end - user.sheets[k].start + 1 }));
      return res.json({ locations: list });
    }

    const sheetsAPI = google.sheets({ version: 'v4', auth: getAuth() });
    const ranges = allowedKeys.map(k => `${k}!B${user.sheets[k].start}:B${user.sheets[k].end}`);
    
    const response = await sheetsAPI.spreadsheets.values.batchGet({ spreadsheetId: user.spreadsheetId, ranges });
    const valueRanges = response.data.valueRanges || [];
    
    let list = [];
    let i = 0;
    for (let key of allowedKeys) {
      const count = (valueRanges[i]?.values || []).filter(r => r && r[0] != null && r[0] !== '').length;
      list.push({ sheetName: key, displayName: user.sheets[key].name, entriesCount: count, maxEntries: user.sheets[key].end - user.sheets[key].start + 1 });
      i++;
    }
    res.json({ locations: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
