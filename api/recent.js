const { google } = require('googleapis');
const { getAuth, COLS_INDEX, GD_COLS_INDEX, serialToDateStr, fractionToTimeStr, authenticate, getRangeEnd } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { AGENCIES } = require('./_lib');
    const sheet = req.query.sheet;
    let targetSpreadsheetId = user.spreadsheetId;
    let targetSheets = user.sheets;
    let actualSheetName = sheet;

    if (user.isAdmin) {
      const parts = (sheet || '').split(':');
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
    if (!targetSpreadsheetId || targetSpreadsheetId.includes('HERE')) return res.json({ entries: [] });

    const isGdEnterprise = user.agencyKey === 'gdenterprise' || (user.isAdmin && (sheet || '').startsWith('gdenterprise:'));
    const pumpCount = (config.pumps || (isGdEnterprise ? 8 : 5));
    const colsIndex = isGdEnterprise ? GD_COLS_INDEX : COLS_INDEX;
    const rangeEnd = getRangeEnd(pumpCount);

    const sheetsAPI = google.sheets({ version: 'v4', auth: getAuth() });
    const response = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: targetSpreadsheetId,
      range: `${actualSheetName}!A${config.start}:${rangeEnd}${config.end}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER'
    });

    const rows = response.data.values || [];
    const entries = [];
    for (let i = rows.length - 1; i >= 0 && entries.length < 5; i--) {
      const r = rows[i];
      if (!r || !r[1] || r[1] === '') continue;
      const pumps = {};
      for (let p = 1; p <= pumpCount; p++) {
        pumps[p] = { start: fractionToTimeStr(r[colsIndex[p].start]), stop: fractionToTimeStr(r[colsIndex[p].stop]) };
      }
      const opIdx = 3 + pumpCount * 3;
      entries.push({ date: serialToDateStr(r[1]), operator: r[opIdx] || '', pumps });
    }
    res.json({ entries });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
