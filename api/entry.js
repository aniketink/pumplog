const { google } = require('googleapis');
const { getAuth, COLS_LETTERS, GD_COLS_LETTERS, jsDateToSerial, authenticate, getRangeEnd } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { AGENCIES } = require('./_lib');
    const { sheetName, date, pumps, operatorName } = req.body;
    if (!sheetName || !date) return res.status(400).json({ error: 'Missing data' });
    
    let targetSpreadsheetId = user.spreadsheetId;
    let targetSheets = user.sheets;
    let actualSheetName = sheetName;

    if (user.isAdmin) {
      const parts = (sheetName || '').split(':');
      if (parts.length === 2) {
        const agencyKey = parts[0];
        actualSheetName = parts[1];
        const agency = AGENCIES[agencyKey];
        if (agency) {
          targetSpreadsheetId = agency.spreadsheetId;
          targetSheets = agency.sheets;
        }
      }
    }

    const config = targetSheets ? targetSheets[actualSheetName] : null;
    if (!config) return res.status(403).json({ error: 'Forbidden' });
    if (!targetSpreadsheetId || targetSpreadsheetId.includes('HERE')) return res.status(400).json({ error: 'Spreadsheet ID missing for this agency. Please configure it in the backend.' });

    const isGdEnterprise = user.agencyKey === 'gdenterprise' || (user.isAdmin && sheetName.startsWith('gdenterprise:'));
    const pumpCount = (config.pumps || (isGdEnterprise ? 8 : 5));
    const colsLetters = isGdEnterprise ? GD_COLS_LETTERS : COLS_LETTERS;
    const rangeEnd = getRangeEnd(pumpCount);
    const operatorCol = getRangeEnd(pumpCount);

    const sheetsAPI = google.sheets({ version: 'v4', auth: getAuth() });

    const getRes = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId,
      range: `${actualSheetName}!A${config.start}:${rangeEnd}${config.end}`,
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
      { range: `${actualSheetName}!A${rowNum}`, values: [[rowNum - config.start + 1]] },
      { range: `${actualSheetName}!B${rowNum}`, values: [[date]] },
    ];
    for (let i = 1; i <= pumpCount; i++) {
      const p = pumps[i] || pumps[String(i)];
      if (p) {
        const cols = colsLetters[i];
        if (p.start !== undefined) data.push({ range: `${actualSheetName}!${cols.start}${rowNum}`, values: [[p.start]] });
        if (p.stop !== undefined) data.push({ range: `${actualSheetName}!${cols.stop}${rowNum}`, values: [[p.stop]] });
      }
    }
    if (operatorName !== undefined) data.push({ range: `${actualSheetName}!${operatorCol}${rowNum}`, values: [[operatorName]] });

    await sheetsAPI.spreadsheets.values.batchUpdate({
      spreadsheetId: targetSpreadsheetId,
      requestBody: { valueInputOption: 'USER_ENTERED', data }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
