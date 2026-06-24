const express = require('express');
const { google } = require('googleapis');

const app = express();
app.use(express.json());

const SPREADSHEET_ID = '1eTbAZyLJDcHZGo3aKnzC8VWOsL7RyQxEyfHhEau-dAQ';

let auth;
if (process.env.GOOGLE_CREDENTIALS) {
  auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} else {
  auth = new google.auth.GoogleAuth({
    keyFile: 'google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const SHEETS = {
  'CHARIAL': { name: 'Charial', start: 13, end: 118 },
  'MUKUNDAPUR': { name: 'Mukundapur', start: 13, end: 118 },
  'KALAGACHIA-I': { name: 'Kalagachia-I', start: 13, end: 118 },
  'KALAGACHIA-II': { name: 'Kalagachia-II', start: 13, end: 118 },
  'BEGORE-1': { name: 'Begore-I', start: 13, end: 118 },
  'BEGORE-II': { name: 'Begore-II', start: 13, end: 118 },
};

const COLS_INDEX = {
  1: { start: 2, stop: 3 },
  2: { start: 5, stop: 6 },
  3: { start: 8, stop: 9 },
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
  return 25569.0 + (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / (1000 * 60 * 60 * 24));
}

function serialToDateStr(serial) {
  if (!serial || typeof serial !== 'number') return String(serial || '');
  let unixTime = Math.round((serial - 25569) * 86400 * 1000);
  let d = new Date(unixTime);
  return d.toISOString().split('T')[0];
}

function fractionToTimeStr(frac) {
  if (frac == null || frac === '') return '';
  if (typeof frac === 'string') return frac;
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
    res.status(500).json({ error: 'Google Sheets API error: ' + e.message });
  }
});

app.post('/api/entry', async (req, res) => {
  try {
    const sheetsAPI = google.sheets({ version: 'v4', auth });
    let { sheetName, date, pumps, operatorName } = req.body;
    if (!sheetName || !date) return res.status(400).json({ error: 'Missing data' });
    let config = SHEETS[sheetName];
    const getRes = await sheetsAPI.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${config.start}:S${config.end}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'SERIAL_NUMBER'
    });
    let rows = getRes.data.values || [];
    let rowNum = -1;
    let targetDateSerial = jsDateToSerial(date);
    for (let i = 0; i < rows.length; i++) {
      let rDate = rows[i][1];
      if (rDate && typeof rDate === 'number' && Math.abs(rDate - targetDateSerial) < 0.5) {
        rowNum = config.start + i;
        break;
      }
    }
    if (rowNum === -1) {
      for (let i = 0; i < (config.end - config.start + 1); i++) {
        let rDate = rows[i] ? rows[i][1] : null;
        if (rDate === null || rDate === '' || rDate === undefined) {
          rowNum = config.start + i;
          break;
        }
      }
    }
    if (rowNum === -1) return res.status(400).json({ error: 'Sheet is full' });
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
    res.status(500).json({ error: 'Failed to save: ' + e.message });
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
    for (let i = rows.length - 1; i >= 0; i--) {
      let r = rows[i];
      if (!r || !r[1] || r[1] === '') continue;
      let pumps = {};
      for (let p = 1; p <= 5; p++) {
        pumps[p] = {
          start: fractionToTimeStr(r[COLS_INDEX[p].start]),
          stop: fractionToTimeStr(r[COLS_INDEX[p].stop])
        };
      }
      entries.push({
        date: serialToDateStr(r[1]),
        operator: r[18] || '',
        pumps
      });
      if (entries.length >= 5) break;
    }
    res.json({ entries });
  } catch (e) {
    console.error('Recent Error:', e.message);
    res.status(500).json({ error: 'Failed to load' });
  }
});

app.get('/api/download', (req, res) => {
  res.redirect(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`);
});

app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(PAGE_HTML);
});

const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pump Log Sheet</title>
<style>
:root{--text-main:#1a1a1a;--text-muted:#555;--bg-desk:#e9ecef;--bg-paper:#fdfdfc;--border-light:#e0e0e0;--border-dark:#222;--accent:#8b0000}
body{font-family:Cambria,Georgia,"Times New Roman",serif;background:var(--bg-desk);color:var(--text-main);margin:0;padding:0;line-height:1.6;font-size:16px}
.center-text{text-align:center;padding:50px;font-size:1.2rem;font-style:italic}
.container{max-width:850px;margin:40px auto;background:var(--bg-paper);padding:60px 80px;box-shadow:0 10px 30px rgba(0,0,0,.08);min-height:calc(100vh - 80px);box-sizing:border-box}
.top-nav{display:flex;justify-content:space-between;padding:10px 20px;background:transparent;font-family:Helvetica,Arial,sans-serif;font-size:.85rem;position:absolute;width:100%;top:0;box-sizing:border-box}
.top-nav button{background:rgba(255,255,255,.8);border:1px solid #aaa;padding:4px 12px;cursor:pointer;font-size:.8rem;color:#333;border-radius:2px}
.top-nav button:hover{background:#fff;border-color:#333}
.academic-header{text-align:center;margin-bottom:40px}
.academic-header h1{font-size:2.2rem;margin:0 0 10px;font-weight:normal;font-variant:small-caps}
.academic-header h2{font-size:1.3rem;margin:0 0 15px;font-weight:normal;font-style:italic;color:var(--text-muted)}
.affiliation{font-size:1rem;margin:0 0 25px;color:var(--text-muted)}
.heavy-rule{border:0;border-top:2px solid var(--border-dark);border-bottom:1px solid var(--border-dark);height:4px;margin-bottom:40px}
.light-rule{border:0;border-top:1px solid #ccc;margin:30px 0}
.form-section{border:none;border-top:1px solid var(--border-dark);margin:40px 0;padding:25px 0 0}
.form-section legend{font-weight:bold;font-size:1.1rem;padding:0 15px;margin-left:-15px;text-transform:uppercase;letter-spacing:.08em}
.form-group-inline{display:flex;gap:40px;margin-bottom:20px}
.form-group{flex:1}
.form-group label{display:block;margin-bottom:5px;font-size:.85rem;font-family:Helvetica,Arial,sans-serif;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em}
.form-group input{width:100%;padding:8px 0;border:none;border-bottom:1px solid var(--border-light);font-family:inherit;font-size:1.1rem;color:var(--text-main);background:transparent;box-sizing:border-box}
.form-group input:focus{outline:none;border-bottom:2px solid var(--accent)}
.pump-box{margin-bottom:15px;display:flex;align-items:flex-end;padding:10px 0 20px;border-bottom:1px dotted var(--border-light)}
.pump-box:last-child{border-bottom:none}
.pump-box h4{margin:0 0 8px;font-size:1.1rem;font-style:italic;font-weight:normal;width:150px}
.time-row{display:flex;gap:30px;flex:1}
.action-row{margin-top:20px;padding-top:15px;border-top:1px solid var(--border-light);text-align:right;font-family:Helvetica,Arial,sans-serif}
#save-status{font-size:.9rem;font-style:italic;padding:4px 10px;background:#f9f9f9;border:1px solid var(--border-light);border-radius:3px}
.recent-section{margin-top:60px}
.recent-section h3{font-size:1.1rem;font-weight:normal;text-align:center;margin-bottom:15px;font-variant:small-caps}
.academic-table{width:100%;border-collapse:collapse;font-size:.9rem}
.academic-table th,.academic-table td{padding:10px 8px;text-align:left}
.academic-table th{border-top:2px solid var(--border-dark);border-bottom:1px solid var(--border-dark);font-family:Helvetica,sans-serif;text-transform:uppercase;font-size:.75rem;letter-spacing:.05em;font-weight:normal;color:var(--text-muted)}
.academic-table tr:last-child td{border-bottom:2px solid var(--border-dark)}
.academic-table td{border-bottom:1px solid var(--border-light)}
.station-item{padding:25px 30px;border:1px solid var(--border-light);margin-bottom:20px;cursor:pointer;transition:all .2s;background:#fff}
.station-item:hover{border-color:var(--border-dark);box-shadow:3px 3px 0 var(--border-light);transform:translate(-2px,-2px)}
.station-item h3{margin:0 0 8px;font-size:1.3rem;font-weight:normal;font-variant:small-caps;color:var(--accent)}
.station-item p{margin:0;font-style:italic;color:var(--text-muted);font-size:.95rem}
@media(max-width:768px){
.container{padding:40px 25px;margin:0;min-height:100vh;width:100%}
.top-nav{position:relative;padding:15px 25px;background:#fff;border-bottom:1px solid var(--border-light)}
.form-group-inline{flex-direction:column;gap:20px}
.pump-box{flex-direction:column;align-items:flex-start;padding:15px 0}
.time-row{flex-direction:row;width:100%}
.academic-table{display:block;overflow-x:auto;white-space:nowrap}
}
</style>
</head>
<body>
<div id="loading" class="center-text">Loading dataset...</div>
<div class="top-nav" id="nav" style="display:none">
<div><button id="back-btn" onclick="goBack()" style="display:none">&larr; Back</button></div>
<div><button onclick="window.open('/api/download')">Download (.xlsx)</button></div>
</div>
<div class="container" id="app-container" style="display:none">
<header class="academic-header">
<h1>Digital Log Sheet: Operational Data</h1>
<h2 id="header-title">Station Selection</h2>
<p class="affiliation">Metropolitan Electrical Division, Irrigation &amp; Waterways Directorate</p>
<hr class="heavy-rule">
</header>
<div id="view-select"><div id="list-container"></div></div>
<div id="view-form" style="display:none">
<div id="data-form">
<fieldset class="form-section"><legend>I. General Information</legend>
<div class="form-group-inline">
<div class="form-group"><label>Date of Observation *</label><input type="date" id="f-date" required></div>
<div class="form-group"><label>Operator / Recorder Name</label><input type="text" id="f-name"></div>
</div></fieldset>
<fieldset class="form-section"><legend>II. Pump Operational Metrics</legend><div id="pump-inputs"></div></fieldset>
<div class="action-row"><span id="save-status" style="color:#666">Live Sync: Ready</span></div>
</div>
<div class="recent-section"><hr class="light-rule"><h3>Table 1: Recent Observations</h3><div id="recent-list"></div></div>
</div>
</div>
<script>
var currentStation='',stations=[];
window.onload=function(){
document.getElementById('f-date').value=new Date().toISOString().split('T')[0];
var n=localStorage.getItem('opName');if(n)document.getElementById('f-name').value=n;
fetch('/api/locations').then(function(r){return r.json()}).then(function(d){
stations=d.locations;renderList();
document.getElementById('loading').style.display='none';
document.getElementById('nav').style.display='flex';
document.getElementById('app-container').style.display='block';
}).catch(function(e){console.error(e);alert('Error loading data')});
};
function renderList(){
var h='';for(var i=0;i<stations.length;i++){var s=stations[i];
h+='<div class="station-item" onclick="openStation(\\''+s.sheetName+'\\',\\''+s.displayName+'\\')"><h3>'+s.displayName+'</h3><p>Entries: '+s.entriesCount+' / '+s.maxEntries+'</p></div>';
}document.getElementById('list-container').innerHTML=h;
}
function openStation(id,name){
currentStation=id;
document.getElementById('header-title').innerText=name;
document.getElementById('view-select').style.display='none';
document.getElementById('view-form').style.display='block';
document.getElementById('back-btn').style.display='inline-block';
var h='';for(var i=1;i<=5;i++){
h+='<div class="pump-box"><h4>Pump Unit '+i+'</h4><div class="time-row"><div class="form-group"><label>Start</label><input type="time" id="p'+i+'-start"></div><div class="form-group"><label>Stop</label><input type="time" id="p'+i+'-stop"></div></div></div>';
}document.getElementById('pump-inputs').innerHTML=h;
var inputs=document.querySelectorAll('#data-form input');
for(var j=0;j<inputs.length;j++)inputs[j].addEventListener('input',saveLive);
document.getElementById('f-date').addEventListener('change',function(){clearForm();loadRecent()});
loadRecent();
}
function clearForm(){for(var i=1;i<=5;i++){document.getElementById('p'+i+'-start').value='';document.getElementById('p'+i+'-stop').value='';}}
function goBack(){
document.getElementById('header-title').innerText='Station Selection';
document.getElementById('view-select').style.display='block';
document.getElementById('view-form').style.display='none';
document.getElementById('back-btn').style.display='none';
}
var saveTimeout=null;
function saveLive(){
clearTimeout(saveTimeout);
var st=document.getElementById('save-status');if(!st)return;
st.innerText='Live Sync: Saving...';st.style.color='#d35400';
saveTimeout=setTimeout(function(){
var date=document.getElementById('f-date').value;
var name=document.getElementById('f-name').value;
if(!date){st.innerText='Date required';st.style.color='red';return}
var pumps={},hasData=false;
for(var i=1;i<=5;i++){var a=document.getElementById('p'+i+'-start').value,b=document.getElementById('p'+i+'-stop').value;if(a||b){hasData=true;pumps[i]={start:a,stop:b}}}
if(!hasData){st.innerText='Live Sync: Ready';st.style.color='#666';return}
localStorage.setItem('opName',name);
fetch('/api/entry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sheetName:currentStation,date:date,pumps:pumps,operatorName:name})})
.then(function(r){return r.json()}).then(function(d){
if(d.success){st.innerText='Saved \\u2713';st.style.color='green';loadRecent()}
else{st.innerText='Error: '+(d.error||'Failed');st.style.color='red'}
}).catch(function(){st.innerText='Network error';st.style.color='red'});
},1000);
}
function loadRecent(){
fetch('/api/recent/'+currentStation+'?limit=5').then(function(r){return r.json()}).then(function(d){
var h='';
if(!d.entries||d.entries.length===0){h='<p style="text-align:center;font-style:italic">No data yet.</p>'}
else{h='<table class="academic-table"><thead><tr><th>Date</th><th>Operator</th><th>P1</th><th>P2</th><th>P3</th><th>P4</th><th>P5</th></tr></thead><tbody>';
for(var i=0;i<d.entries.length;i++){var row=d.entries[i];h+='<tr><td><strong>'+row.date+'</strong></td><td>'+(row.operator||'\\u2014')+'</td>';
for(var p=1;p<=5;p++){var pm=row.pumps[p];h+='<td>'+((pm&&(pm.start||pm.stop))?((pm.start||'-')+' \\u2192 '+(pm.stop||'-')):'\\u2014')+'</td>'}
h+='</tr>'}h+='</tbody></table>'}
document.getElementById('recent-list').innerHTML=h;
var cd=document.getElementById('f-date').value;
var td=d.entries&&d.entries.find(function(e){return e.date===cd});
var empty=true;for(var i=1;i<=5;i++){if(document.getElementById('p'+i+'-start').value||document.getElementById('p'+i+'-stop').value){empty=false;break}}
if(td&&empty){for(var i=1;i<=5;i++){var pp=td.pumps[i];if(pp){if(pp.start)document.getElementById('p'+i+'-start').value=pp.start;if(pp.stop)document.getElementById('p'+i+'-stop').value=pp.stop}}}
}).catch(function(e){console.log('err',e)});
}
</script>
</body>
</html>`;

module.exports = app;
