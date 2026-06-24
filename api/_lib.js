const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = '1eTbAZyLJDcHZGo3aKnzC8VWOsL7RyQxEyfHhEau-dAQ';

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

const SHEETS = {
  'CHARIAL':       { name: 'Charial',      start: 13, end: 118 },
  'MUKUNDAPUR':    { name: 'Mukundapur',   start: 13, end: 118 },
  'KALAGACHIA-I':  { name: 'Kalagachia-I', start: 13, end: 118 },
  'KALAGACHIA-II': { name: 'Kalagachia-II',start: 13, end: 118 },
  'BEGORE-1':      { name: 'Begore-I',     start: 13, end: 118 },
  'BEGORE-II':     { name: 'Begore-II',    start: 13, end: 118 },
};

const COLS_INDEX = {
  1: { start: 2,  stop: 3  },
  2: { start: 5,  stop: 6  },
  3: { start: 8,  stop: 9  },
  4: { start: 11, stop: 12 },
  5: { start: 14, stop: 15 },
};

const COLS_LETTERS = {
  1: { start: 'C', stop: 'D' },
  2: { start: 'F', stop: 'G' },
  3: { start: 'I', stop: 'J' },
  4: { start: 'L', stop: 'M' },
  5: { start: 'O', stop: 'P' },
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

const USERS = {
  'charial': { pass: 'charial123', sheets: ['CHARIAL'] },
  'mukundapur': { pass: 'mukundapur123', sheets: ['MUKUNDAPUR'] },
  'kalagachia': { pass: 'kalagachia123', sheets: ['KALAGACHIA-I', 'KALAGACHIA-II'] },
  'begore': { pass: 'begore123', sheets: ['BEGORE-1', 'BEGORE-II'] },
  'admin': { pass: 'admin123', sheets: Object.keys(SHEETS) }
};

function authenticate(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const match = authHeader.match(/^Basic\s+(.*)$/);
  if (!match) return null;
  try {
    const [user, pass] = Buffer.from(match[1], 'base64').toString('utf8').split(':');
    const u = USERS[user];
    if (u && u.pass === pass) {
      return { username: user, allowedSheets: u.sheets };
    }
  } catch(e) {}
  return null;
}

module.exports = { getAuth, SPREADSHEET_ID, SHEETS, COLS_INDEX, COLS_LETTERS, jsDateToSerial, serialToDateStr, fractionToTimeStr, authenticate };
