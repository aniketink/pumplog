const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const SPREADSHEET_ID = '1eTbAZyLJDcHZGo3aKnzC8VWOsL7RyQxEyfHhEau-dAQ';

// Setup Google Auth using the downloaded credentials file
const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SHEETS = {
  'CHARIAL': { name: 'Charial', start: 13, end: 118 },
  'MUKUNDAPUR': { name: 'Mukundapur', start: 13, end: 118 },
  'KALAGACHIA-I': { name: 'Kalagachia-I', start: 13, end: 118 },
  'KALAGACHIA-II': { name: 'Kalagachia-II', start: 13, end: 118 },
  'BEGORE-1': { name: 'Begore-I', start: 13, end: 118 },
  'BEGORE-II': { name: 'Begore-II', start: 13, end: 118 },
};

// Maps pump 1..5 to Start and Stop columns
const COLS_INDEX = {
  1: { start: 2, stop: 3 }, // C, D (0-indexed: A=0, B=1, C=2, D=3)
  2: { start: 5, stop: 6 }, // F, G
  3: { start: 8, stop: 9 }, // I, J
  4: { start: 11, stop: 12 }, // L, M
  5: { start: 14, stop: 15 }, // O, P
};

const COLS_LETTERS = {
  1: { start: 'C', stop: 'D' },
  2: { start: 'F', stop: 'G' },
  3: { start: 'I', stop: 'J' },
  4: { start: 'L', stop: 'M' },
  5: { start: 'O', stop: 'P' },
};

// Convert YYYY-MM-DD string to Google Sheets serial date number
function jsDateToSerial(dateString) {
  const d = new Date(dateString);
  return 25569.0 + (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / (1000 * 60 * 60 * 24));
}

// Convert Google Sheets serial date to YYYY-MM-DD
function serialToDateStr(serial) {
  if (!serial || typeof serial !== 'number') return String(serial || '');
  let unixTime = Math.round((serial - 25569) * 86400 * 1000);
  let d = new Date(unixTime);
  return d.toISOString().split('T')[0];
}

// Convert Google Sheets time fraction to HH:MM
function fractionToTimeStr(frac) {
  if (frac == null || frac === '') return '';
  if (typeof frac === 'string') return frac; // In case it was stored as pure string
  if (typeof frac !== 'number') return '';
  let totalMins = Math.round(frac * 24 * 60);
  let h = String(Math.floor(totalMins / 60) % 24).padStart(2, '0');
  let m = String(totalMins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

app.get('/api/locations', async (req, res) => {
  try {
    const sheetsAPI = google.sheets({ version: 'v4', auth });
    let list = [];
    
    // Batch get all dates to count entries efficiently
    const ranges = Object.keys(SHEETS).map(key => `${key}!B${SHEETS[key].start}:B${SHEETS[key].end}`);
    
    const response = await sheetsAPI.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: ranges
    });
    
    const valueRanges = response.data.valueRanges || [];
    
    let i = 0;
    for (let key in SHEETS) {
      let count = 0;
      let values = valueRanges[i]?.values || [];
      // count non-empty values
      for (let row of values) {
        if (row && row[0] !== '' && row[0] != null) count++;
      }
      list.push({
        sheetName: key,
        displayName: SHEETS[key].name,
        entriesCount: count,
        maxEntries: SHEETS[key].end - SHEETS[key].start + 1
      });
      i++;
    }
    
    res.json({ locations: list });
  } catch (e) {
    console.error('API Error:', e.message);
    res.status(500).json({ error: 'Google Sheets API error' });
  }
});

app.post('/api/entry', async (req, res) => {
  try {
    const sheetsAPI = google.sheets({ version: 'v4', auth });
    let { sheetName, date, pumps, operatorName } = req.body;
    if (!sheetName || !date) return res.status(400).json({ error: 'Missing data' });

    let config = SHEETS[sheetName];
    
    // Fetch current data to find row
    const getRes = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${config.start}:S${config.end}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER'
    });
    
    let rows = getRes.data.values || [];
    let rowNum = -1;
    let targetDateSerial = jsDateToSerial(date);
    
    // 1. Find if date already exists
    for (let i = 0; i < rows.length; i++) {
      let rDate = rows[i][1]; // col B is index 1
      if (rDate && typeof rDate === 'number' && Math.abs(rDate - targetDateSerial) < 0.5) {
        rowNum = config.start + i;
        break;
      }
    }
    
    // 2. If not, find first empty row
    if (rowNum === -1) {
      for (let i = 0; i < (config.end - config.start + 1); i++) {
        let rDate = rows[i] ? rows[i][1] : null;
        if (rDate === null || rDate === '') {
          rowNum = config.start + i;
          break;
        }
      }
    }
    
    if (rowNum === -1) return res.status(400).json({ error: 'Sheet is full' });

    // 3. Prepare update payload
    let dataToUpdate = [];
    
    dataToUpdate.push({ range: `${sheetName}!A${rowNum}`, values: [[rowNum - config.start + 1]] });
    dataToUpdate.push({ range: `${sheetName}!B${rowNum}`, values: [[date]] });
    
    for (let i = 1; i <= 5; i++) {
      let pData = pumps[i] || pumps[String(i)];
      if (pData) {
        let cols = COLS_LETTERS[i];
        if (pData.start !== undefined) {
          dataToUpdate.push({ range: `${sheetName}!${cols.start}${rowNum}`, values: [[pData.start]] });
        }
        if (pData.stop !== undefined) {
          dataToUpdate.push({ range: `${sheetName}!${cols.stop}${rowNum}`, values: [[pData.stop]] });
        }
      }
    }
    
    if (operatorName !== undefined) {
      dataToUpdate.push({ range: `${sheetName}!S${rowNum}`, values: [[operatorName]] });
    }

    // 4. Batch Update to Google Sheets
    await sheetsAPI.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: dataToUpdate
      }
    });

    res.json({ success: true });
  } catch (e) {
    console.error('Save Error:', e.message);
    res.status(500).json({ error: 'Failed to save data to Google Sheets' });
  }
});

app.get('/api/recent/:sheet', async (req, res) => {
  try {
    const sheetsAPI = google.sheets({ version: 'v4', auth });
    let config = SHEETS[req.params.sheet];

    const response = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${req.params.sheet}!A${config.start}:S${config.end}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER'
    });

    let rows = response.data.values || [];
    let entries = [];
    
    // Traverse backwards to get the most recent entries
    for (let i = rows.length - 1; i >= 0; i--) {
      let r = rows[i];
      if (!r || !r[1] || r[1] === '') continue; // Skip empty rows

      let pumps = {};
      for (let p = 1; p <= 5; p++) {
        pumps[p] = {
          start: fractionToTimeStr(r[COLS_INDEX[p].start]),
          stop: fractionToTimeStr(r[COLS_INDEX[p].stop])
        };
      }

      entries.push({
        date: serialToDateStr(r[1]),
        operator: r[18] || '', // col S is index 18
        pumps
      });

      if (entries.length >= 5) break;
    }

    res.json({ entries });
  } catch (e) {
    console.error('Recent Fetch Error:', e.message);
    res.status(500).json({ error: 'Failed to load' });
  }
});

// Since we use Google Sheets now, redirect the download button to the Google Sheet directly
app.get('/api/download', (req, res) => {
  res.redirect(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`);
});

app.listen(3000, () => {
  console.log('Google Sheets Server started on port 3000');
});
