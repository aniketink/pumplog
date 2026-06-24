const { google } = require('googleapis');
const { getAuth, COLS_LETTERS, jsDateToSerial, authenticate } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { sheetName, date, pumps, operatorName } = req.body;
    if (!sheetName || !date) return res.status(400).json({ error: 'Missing data' });
    
    const config = user.sheets[sheetName];
    if (!config) return res.status(403).json({ error: 'Forbidden' });
    if (user.spreadsheetId.includes('HERE')) return res.status(400).json({ error: 'Spreadsheet ID missing for this agency. Please configure it in the backend.' });

    const sheetsAPI = google.sheets({ version: 'v4', auth: getAuth() });

    const getRes = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: user.spreadsheetId,
      range: `${sheetName}!A${config.start}:S${config.end}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER'
    });

    const rows = getRes.data.values || [];
    const targetSerial = jsDateToSerial(date);
    let rowNum = -1;

    for (let i = 0; i < rows.length; i++) {
      if (rows[i][1] && typeof rows[i][1] === 'number' && Math.abs(rows[i][1] - targetSerial) < 0.5) {
        rowNum = config.start + i; break;
      }
    }
    if (rowNum === -1) {
      for (let i = 0; i < (config.end - config.start + 1); i++) {
        if (!rows[i] || rows[i][1] == null || rows[i][1] === '') { rowNum = config.start + i; break; }
      }
    }
    if (rowNum === -1) return res.status(400).json({ error: 'Sheet is full' });

    const data = [
      { range: `${sheetName}!A${rowNum}`, values: [[rowNum - config.start + 1]] },
      { range: `${sheetName}!B${rowNum}`, values: [[date]] },
    ];
    for (let i = 1; i <= 5; i++) {
      const p = pumps[i] || pumps[String(i)];
      if (p) {
        const cols = COLS_LETTERS[i];
        if (p.start !== undefined) data.push({ range: `${sheetName}!${cols.start}${rowNum}`, values: [[p.start]] });
        if (p.stop !== undefined) data.push({ range: `${sheetName}!${cols.stop}${rowNum}`, values: [[p.stop]] });
      }
    }
    if (operatorName !== undefined) data.push({ range: `${sheetName}!S${rowNum}`, values: [[operatorName]] });

    await sheetsAPI.spreadsheets.values.batchUpdate({
      spreadsheetId: user.spreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
