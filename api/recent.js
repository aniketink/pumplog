const { google } = require('googleapis');
const { getAuth, SPREADSHEET_ID, SHEETS, COLS_INDEX, serialToDateStr, fractionToTimeStr, authenticate } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const sheet = req.query.sheet;
    const config = SHEETS[sheet];
    if (!config) return res.status(400).json({ error: 'Invalid sheet' });
    if (!user.allowedSheets.includes(sheet)) return res.status(403).json({ error: 'Forbidden' });

    const sheetsAPI = google.sheets({ version: 'v4', auth: getAuth() });
    const response = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheet}!A${config.start}:S${config.end}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER'
    });

    const rows = response.data.values || [];
    const entries = [];
    for (let i = rows.length - 1; i >= 0 && entries.length < 5; i--) {
      const r = rows[i];
      if (!r || !r[1] || r[1] === '') continue;
      const pumps = {};
      for (let p = 1; p <= 5; p++) {
        pumps[p] = { start: fractionToTimeStr(r[COLS_INDEX[p].start]), stop: fractionToTimeStr(r[COLS_INDEX[p].stop]) };
      }
      entries.push({ date: serialToDateStr(r[1]), operator: r[18] || '', pumps });
    }
    res.json({ entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
