const { google } = require('googleapis');
const path = require('path');

function getAuth() {
  if (process.env.GOOGLE_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }
  return new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), 'google-credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const AGENCIES = {
  'sas': {
    pass: 'sas123',
    spreadsheetId: '13Wx72GjXua4kFGJMEt6je_3aUH7fIkYiukYKiBWyW3c',
    sheets: {
      'CHARIAL-I':     { name: 'Charial-I',     start: 13, end: 118, pumps: 3 },
      'CHARIAL-II':    { name: 'Charial-II',    start: 13, end: 118, pumps: 7 },
      'MUKUNDAPUR':    { name: 'Mukundapur',    start: 13, end: 118, pumps: 5 },
      'KALAGACHIA-I':  { name: 'Kalagachia-I',  start: 13, end: 118, pumps: 5 },
      'KALAGACHIA-II': { name: 'Kalagachia-II', start: 13, end: 118, pumps: 5 },
      'BEGORE-I':      { name: 'Begore-I',      start: 13, end: 118, pumps: 5 },
      'BEGORE-II':     { name: 'Begore-II',     start: 13, end: 118, pumps: 5 },
    }
  },
  'tecnico': {
    pass: 'tecnico123',
    spreadsheetId: '1YvDRyxEIMqGbyqfbgobdOkNN1aBYRgjh9FLQkagowIs', 
    sheets: {
      'SANTOSHPUR':       { name: 'Santoshpur',   start: 13, end: 118, pumps: 8 },
      'GARFA':            { name: 'Garfa',        start: 13, end: 118, pumps: 5 },
      'PUJALI':           { name: 'Pujali-I',     start: 13, end: 118, pumps: 3 },
      'PUJALI-II':        { name: 'Pujali-II',    start: 13, end: 118, pumps: 7 },
      'KHEYADA KHAL2026': { name: 'Kheyada Khal', start: 13, end: 118, pumps: 4 },
    }
  },
  'geebee': {
    pass: 'geebee123',
    spreadsheetId: '1FISPmDehaA0DH1QTx44H1Y7d5pNb4EnXy4pbKos-UrI',
    sheets: {
      'Sheet1': { name: 'Laketown', start: 13, end: 118, pumps: 7 },
    }
  },
  'gdenterprise': {
    pass: 'gdenterprise123',
    spreadsheetId: '1ltkbkoVHaAg7vOUnWj5y7RS1r9k4J4UOyePgPuK3ANs',
    sheets: {
      'Piyadapara': { name: 'Piyadapara', start: 13, end: 118, pumps: 9 },
      'Fakir para': { name: 'Fakir para', start: 13, end: 118, pumps: 8 },
      'Sardarparajola': { name: 'Sardarparajola', start: 13, end: 118, pumps: 7 },
    }
  },
  'bally': {
    pass: 'bally123',
    spreadsheetId: 'INSERT_SPREADSHEET_ID_HERE',
    sheets: {
      'Anandnagar': { name: 'Anandnagar', start: 13, end: 118, pumps: 26 },
      'Durgapur': { name: 'Durgapur', start: 13, end: 118, pumps: 21 },
      'Bally': { name: 'Bally', start: 13, end: 118, pumps: 8 },
      'Nischinda': { name: 'Nischinda', start: 13, end: 118, pumps: 20 },
      'Sapuipara': { name: 'Sapuipara', start: 13, end: 118, pumps: 24 },
    }
  },
  'admin': {
    pass: 'admin123',
    isAdmin: true
  }
};

const COLS_INDEX = {
  1: { start: 2,  stop: 3  },
  2: { start: 5,  stop: 6  },
  3: { start: 8,  stop: 9  },
  4: { start: 11, stop: 12 },
  5: { start: 14, stop: 15 },
  6: { start: 17, stop: 18 },
  7: { start: 20, stop: 21 },
  8: { start: 23, stop: 24 },
  9: { start: 26, stop: 27 },
};

const COLS_LETTERS = {
  1: { start: 'C',  stop: 'D'  },
  2: { start: 'F',  stop: 'G'  },
  3: { start: 'I',  stop: 'J'  },
  4: { start: 'L',  stop: 'M'  },
  5: { start: 'O',  stop: 'P'  },
  6: { start: 'R',  stop: 'S'  },
  7: { start: 'U',  stop: 'V'  },
  8: { start: 'X',  stop: 'Y'  },
  9: { start: 'AA', stop: 'AB' },
};

const GD_COLS_INDEX = {
  1: { start: 2,  stop: 3,  hours: 4  },
  2: { start: 5,  stop: 6,  hours: 7  },
  3: { start: 8,  stop: 9,  hours: 10 },
  4: { start: 11, stop: 12, hours: 13 },
  5: { start: 14, stop: 15, hours: 16 },
  6: { start: 17, stop: 18, hours: 19 },
  7: { start: 20, stop: 21, hours: 22 },
  8: { start: 23, stop: 24, hours: 25 },
  9: { start: 26, stop: 27, hours: 28 },
};

const GD_COLS_LETTERS = {
  1: { start: 'C',  stop: 'D'  },
  2: { start: 'F',  stop: 'G'  },
  3: { start: 'I',  stop: 'J'  },
  4: { start: 'L',  stop: 'M'  },
  5: { start: 'O',  stop: 'P'  },
  6: { start: 'R',  stop: 'S'  },
  7: { start: 'U',  stop: 'V'  },
  8: { start: 'X',  stop: 'Y'  },
  9: { start: 'AA', stop: 'AB' },
};

function jsDateToSerial(dateString) {
  const d = new Date(dateString);
  return 25569.0 + Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / (1000 * 60 * 60 * 24);
}

function serialToDateStr(serial) {
  if (!serial || typeof serial !== 'number') return String(serial || '');
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().split('T')[0];
}

function fractionToTimeStr(frac) {
  if (frac == null || frac === '' || typeof frac !== 'number') return typeof frac === 'string' ? frac : '';
  const totalMins = Math.round(frac * 24 * 60);
  return `${String(Math.floor(totalMins / 60) % 24).padStart(2,'0')}:${String(totalMins % 60).padStart(2,'0')}`;
}

function authenticate(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const match = authHeader.match(/^Basic\s+(.*)$/);
  if (!match) return null;
  try {
    const [user, pass] = Buffer.from(match[1], 'base64').toString('utf8').split(':');
    const agency = AGENCIES[user];
    if (agency && agency.pass === pass) {
      return { username: user, agencyKey: user, spreadsheetId: agency.spreadsheetId, sheets: agency.sheets, isAdmin: !!agency.isAdmin };
    }
  } catch(e) {}
  return null;
}

function getOperatorColIndex(pumpCount) {
  return 3 + pumpCount * 3;
}

function getOperatorColLetter(pumpCount) {
  const idx = getOperatorColIndex(pumpCount);
  if (idx < 26) return String.fromCharCode(65 + idx);
  return String.fromCharCode(64 + Math.floor(idx / 26)) + String.fromCharCode(65 + (idx % 26));
}

function getRangeEnd(pumpCount) {
  return getOperatorColLetter(pumpCount);
}

module.exports = { getAuth, AGENCIES, COLS_INDEX, COLS_LETTERS, GD_COLS_INDEX, GD_COLS_LETTERS, jsDateToSerial, serialToDateStr, fractionToTimeStr, authenticate, getOperatorColIndex, getOperatorColLetter, getRangeEnd };
