const { google } = require('googleapis');
const { getAuth, authenticate, AGENCIES } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = authenticate(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { AGENCIES } = require('./_lib');
    const sheetsAPI = google.sheets({ version: 'v4', auth: getAuth() });
    let list = [];

    if (user.isAdmin) {
      const agencyKeys = Object.keys(AGENCIES).filter(k => k !== 'admin');

      const promises = agencyKeys.map(async (agencyKey) => {
        const agency = AGENCIES[agencyKey];
        const allowedKeys = Object.keys(agency.sheets);

        if (!agency.spreadsheetId || agency.spreadsheetId.includes('HERE')) {
          return allowedKeys.map(k => ({
            sheetName: `${agencyKey}:${k}`,
            displayName: agency.sheets[k].name,
            entriesCount: 0,
            maxEntries: agency.sheets[k].end - agency.sheets[k].start + 1,
            pumps: agency.sheets[k].pumps || 5,
            agency: agencyKey
          }));
        }

        try {
          const ranges = allowedKeys.map(k => `${k}!B${agency.sheets[k].start}:B${agency.sheets[k].end}`);
          const response = await sheetsAPI.spreadsheets.values.batchGet({ spreadsheetId: agency.spreadsheetId, ranges });
          const valueRanges = response.data.valueRanges || [];

          return allowedKeys.map((key, i) => {
            const count = (valueRanges[i]?.values || []).filter(r => r && r[0] != null && r[0] !== '').length;
            return {
              sheetName: `${agencyKey}:${key}`,
              displayName: agency.sheets[key].name,
              entriesCount: count,
              maxEntries: agency.sheets[key].end - agency.sheets[key].start + 1,
              pumps: agency.sheets[key].pumps || 5,
              agency: agencyKey
            };
          });
        } catch (err) {
          console.error(`Error loading sheets for agency ${agencyKey}:`, err.message);
          return allowedKeys.map(k => ({
            sheetName: `${agencyKey}:${k}`,
            displayName: `${agency.sheets[k].name} [Error]`,
            entriesCount: 0,
            maxEntries: agency.sheets[k].end - agency.sheets[k].start + 1,
            pumps: agency.sheets[k].pumps || 5,
            agency: agencyKey
          }));
        }
      });

      const results = await Promise.all(promises);
      list = results.flat();
    } else {
      const allowedKeys = Object.keys(user.sheets);

      if (user.spreadsheetId.includes('HERE')) {
        list = allowedKeys.map(k => ({
          sheetName: k,
          displayName: user.sheets[k].name,
          entriesCount: 0,
          maxEntries: user.sheets[k].end - user.sheets[k].start + 1,
          pumps: user.sheets[k].pumps || 5
        }));
      } else {
        const ranges = allowedKeys.map(k => `${k}!B${user.sheets[k].start}:B${user.sheets[k].end}`);
        try {
          const response = await sheetsAPI.spreadsheets.values.batchGet({ spreadsheetId: user.spreadsheetId, ranges });
          const valueRanges = response.data.valueRanges || [];

          let i = 0;
          for (let key of allowedKeys) {
            const count = (valueRanges[i]?.values || []).filter(r => r && r[0] != null && r[0] !== '').length;
            list.push({
              sheetName: key,
              displayName: user.sheets[key].name,
              entriesCount: count,
              maxEntries: user.sheets[key].end - user.sheets[key].start + 1,
              pumps: user.sheets[key].pumps || 5
            });
            i++;
          }
        } catch (err) {
          console.error(`Error loading sheets for user:`, err.message);
          list = allowedKeys.map(k => ({
            sheetName: k,
            displayName: `${user.sheets[k].name} [Error]`,
            entriesCount: 0,
            maxEntries: user.sheets[k].end - user.sheets[k].start + 1,
            pumps: user.sheets[k].pumps || 5
          }));
        }
      }
    }

    res.json({ locations: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
