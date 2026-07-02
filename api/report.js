const { google } = require('googleapis');
const { getAuth, authenticate, AGENCIES, COLS_INDEX, serialToDateStr, fractionToTimeStr, GD_COLS_INDEX } = require('./_lib');

function timeStrToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function calculateHours(startStr, stopStr) {
  const startMins = timeStrToMinutes(startStr);
  const stopMins = timeStrToMinutes(stopStr);
  if (startMins === 0 && stopMins === 0) return 0;
  let diff = stopMins - startMins;
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

function getPumpCount(agencyKey, sheetConfig) {
  if (agencyKey === 'gdenterprise') return sheetConfig.pumps || 9;
  return 5;
}

function getRangeEndCol(pumpCount) {
  const lastHoursIdx = 4 + (pumpCount - 1) * 3;
  if (lastHoursIdx < 26) return String.fromCharCode(65 + lastHoursIdx);
  return String.fromCharCode(64 + Math.floor(lastHoursIdx / 26)) + String.fromCharCode(65 + (lastHoursIdx % 26));
}

const ROWS_CONFIG = [
  {
    sl: 1, loc: 'Garfa, Ward No-104, P.S-Garfa, Kolkta Municipal Corporation, Dist: 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 20 HP', pumps: 5, uom: 'Nos.',
    mapping: { agency: 'tecnico', sheetKey: 'GARFA' }
  },
  {
    sl: 2, loc: 'Charial-I 5 vent sluice, Ward No-3&4, Budge Budge Municipality, Dist: 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 20 HP', pumps: 3, uom: 'Nos.',
    mapping: { agency: 'sas', sheetKey: 'CHARIAL-I' }
  },
  {
    sl: 3, loc: 'Charial-II 5 vent sluice, Ward No-3&4, Budge Budge Municipality, Dist: 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Motor driven pump, 10 HP', pumps: 7, uom: 'Nos.',
    mapping: null
  },
  {
    sl: 4, loc: 'Pujali-I 10 vent, Ward No-2&3, Pujali Municipality, Dist: 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 20 HP', pumps: 3, uom: 'Nos.',
    mapping: { agency: 'tecnico', sheetKey: 'PUJALI' }
  },
  {
    sl: 5, loc: 'Pujali-II 10 vent, Ward No-2&3, Pujali Municipality, Dist: 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Motor driven pump, 10 HP', pumps: 7, uom: 'Nos.',
    mapping: null
  },
  {
    sl: 6, loc: 'Santoshpur Jora Bridge near Kishore Bharati Stadium , Santosh pur, Kolkta Municipal Corporation, Dist 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 26 HP and 10 HP', pumps: 8, uom: 'Nos.',
    mapping: { agency: 'tecnico', sheetKey: 'SANTOSHPUR' }
  },
  {
    sl: 7, loc: 'Suti-Guniagachi, Mukundapur, Ward No-109, P.S-Purba Jadavpur, Kolkta Municipal Corporation, Dist: 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 26HP', pumps: 5, uom: 'Nos.',
    mapping: { agency: 'sas', sheetKey: 'MUKUNDAPUR' }
  },
  {
    sl: 8, loc: 'Lake Town Main (Near VIP Road), Shribhumi (Near Permanent Pump House), Lake Town (Near Service Road Side), Anupama Housing Complex (VIP Road/Near Haldiram) in the Dist.- 24 Pgs (N)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 26 HP, 16 HP and 5 HP', pumps: 7, uom: 'Nos.',
    mapping: { agency: 'geebee', sheetKey: 'Sheet1' }
  },
  {
    sl: 9, loc: 'Outfall of Kheyada Khal (near Bamonghata), Dist.- 24 PGS (S)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 26 HP and 14 HP', pumps: 4, uom: 'Nos.',
    mapping: { agency: 'tecnico', sheetKey: 'KHEYADA KHAL2026' }
  },
  {
    sl: 10, loc: 'Kalagachia-I,Hanspukur, Ward No-144, P.S-Thakurpukur, Kolkata Municipal Corporation, Dist: 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 20HP', pumps: 5, uom: 'Nos.',
    mapping: { agency: 'sas', sheetKey: 'KALAGACHIA-I' }
  },
  {
    sl: 11, loc: 'Kalagachia-II,Hanspukur, Ward No-144, P.S-Thakurpukur, Kolkata Municipal Corporation, Dist: 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 20HP', pumps: 5, uom: 'Nos.',
    mapping: { agency: 'sas', sheetKey: 'KALAGACHIA-II' }
  },
  {
    sl: 12, loc: 'junction point-I of Begore and Monikhal, Mali para, near Sarkar Pool, Ward No-13 , Mahestala Municipality, Dist: 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 20HP', pumps: 5, uom: 'Nos.',
    mapping: { agency: 'sas', sheetKey: 'BEGORE-I' }
  },
  {
    sl: 13, loc: 'junction point-II of Begore and Monikhal, Mali para, near Sarkar Pool, Ward No-13 , Mahestala Municipality, Dist: 24 PGS (South)', subLoc: '',
    dist: 'Dist: 24 PGS (South)', type: 'Disel Engine Driven Pump. 20HP', pumps: 5, uom: 'Nos.',
    mapping: { agency: 'sas', sheetKey: 'BEGORE-II' }
  },
  {
    sl: 14, loc: 'Damjur GP-Bandra-I&II', subLoc: 'Peyadapara / lulshikhet jola -5 nos\nDakshinpara jola near Giyas factory-4nos',
    dist: 'Howrah', type: 'Disel Engine Driven Pump. 12.5/16/25.5/26HP', pumps: 9, uom: 'Nos.',
    mapping: { agency: 'gdenterprise', sheetKey: 'Piyadapara' }
  },
  {
    sl: 15, loc: 'Damjur GP-Bandra-I&II', subLoc: 'Fakir Para-4 nos\nDakshinparajola-etc- 4 nos',
    dist: 'Howrah', type: 'Disel Engine Driven Pump. 12.5/16/25.5/26HP', pumps: 8, uom: 'Nos.',
    mapping: { agency: 'gdenterprise', sheetKey: 'Fakir para' }
  },
  {
    sl: 16, loc: 'Damjur GP-Bandra-I,II&III', subLoc: 'Tejmaszid-2 nos\nNayabaz Rly strnd-2 nos\nSardarpara etc- 3 nos',
    dist: 'Howrah', type: 'Disel Engine Driven Pump. 12.5/25.5HP', pumps: 7, uom: 'Nos.',
    mapping: { agency: 'gdenterprise', sheetKey: 'Sardarparajola' }
  },
  {
    sl: 17, loc: 'Bally jagacha, G.P- Anandnagar-Chakpara', subLoc: 'Dashinjaypur Under Pass-4 nos\nJaipur School - 4 nos\nDakshin Jaipur-5 nos\nAnandnagar Kayalpara-4 nos\nNaskarpara-4 nos\nAnandnagar Fisheries- 5 nos',
    dist: 'Howrah', type: 'Motor Driven Pump. 10/12.5/20 HP', pumps: 26, uom: 'Nos.',
    mapping: null
  },
  {
    sl: 18, loc: 'Bally jagacha, G.P- Durgapur - Avoynagar', subLoc: 'Uttarjaipur bill- 5nos\nPandar chak field-4 nos\nBelanagar pender chak-4 nos\nHatipara-4 nos\nBelanagar Bhuipara-4 nos',
    dist: 'Howrah', type: 'Motor Driven Pump. 10/12.5HP', pumps: 21, uom: 'Nos.',
    mapping: null
  },
  {
    sl: 19, loc: 'Bally jagacha, G.P- Bally, Shantinagar Kumilla & Chamrail', subLoc: 'Belur Railway stan-4nos\nShantinagar/Ishanpally- 2 nos\nKona more--2 nos',
    dist: 'Howrah', type: 'Motor Driven Pump. 10/12.5HP', pumps: 8, uom: 'Nos.',
    mapping: null
  },
  {
    sl: 20, loc: 'Bally jagacha, G.P- Nischinda', subLoc: 'Nischinda water tank- 4nos\nSilpashree- 4 nos\nPalpukur--2 nos\nNischinda Paschimpara- 3 nos\nNischinda Dighipar-4 nos\nNischinda medlinic-3 nos',
    dist: 'Howrah', type: 'Motor Driven Pump. 10/12.5HP', pumps: 20, uom: 'Nos.',
    mapping: null
  },
  {
    sl: 21, loc: 'Bally jagacha, G.P- Sapuipara-Basukathi', subLoc: 'ESI Hospital- 4nos\nArbindanagar- 3 nos\nKristhanpara--2 nos\nsantinagr more- 2 nos\nAnandanagar B.ED College-4 nos\nBanstala-4 nos\nBhattanagar, Bagerjola, Dipus shop and Nayanjuli- 5 nos',
    dist: 'Howrah', type: 'Motor Driven Pump. 10/12.5HP', pumps: 24, uom: 'Nos.',
    mapping: null
  }
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = authenticate(req);
  if (!user || !user.isAdmin) return res.status(401).json({ error: 'Admin access required' });

  const targetDate = req.query.date || new Date().toISOString().split('T')[0];

  try {
    const sheetsAPI = google.sheets({ version: 'v4', auth: getAuth() });
    const allAgencies = Object.keys(AGENCIES).filter(k => k !== 'admin');
    
    // Fetch all active sheets data
    const fetchPromises = allAgencies.map(async (agencyKey) => {
      const agency = AGENCIES[agencyKey];
      if (!agency || !agency.spreadsheetId || agency.spreadsheetId.includes('HERE')) return [];
      
      const sheetKeys = Object.keys(agency.sheets);
      const results = [];
      for (const sheetKey of sheetKeys) {
        const config = agency.sheets[sheetKey];
        try {
          const pumpCount = getPumpCount(agencyKey, config);
          const rangeEnd = getRangeEndCol(pumpCount);
          const response = await sheetsAPI.spreadsheets.values.get({
            spreadsheetId: agency.spreadsheetId,
            range: `${sheetKey}!A${config.start}:${rangeEnd}${config.end}`,
            valueRenderOption: 'UNFORMATTED_VALUE',
            dateTimeRenderOption: 'SERIAL_NUMBER'
          });
          
          results.push({
            agencyKey, sheetKey, config, pumpCount,
            rows: response.data.values || []
          });
        } catch (err) {
          console.error(`Error fetching ${agencyKey}:${sheetKey} for report:`, err.message);
        }
      }
      return results;
    });

    const nestedData = await Promise.all(fetchPromises);
    const flattenedData = nestedData.flat();

    const dataMap = {}; // key: agencyKey + ':' + sheetKey

    for (const sheetData of flattenedData) {
      const { agencyKey, sheetKey, pumpCount, rows } = sheetData;
      let cumulativeHours = 0;
      let reportedDayHours = 0;
      let reportedDayRemarks = '';

      const isGdEnterprise = agencyKey === 'gdenterprise';
      const colMap = isGdEnterprise ? GD_COLS_INDEX : COLS_INDEX;
      
      for (const r of rows) {
        if (!r || !r[1] || r[1] === '') continue;
        const dateStr = serialToDateStr(r[1]);
        
        let dayHours = 0;
        for (let p = 1; p <= pumpCount; p++) {
          let start, stop;
          if (isGdEnterprise) {
            start = fractionToTimeStr(r[colMap[p].start]);
            stop = fractionToTimeStr(r[colMap[p].stop]);
            const hoursVal = r[colMap[p].hours];
            if ((start || stop) && (!hoursVal || hoursVal === 0)) {
              dayHours += calculateHours(start, stop);
            } else if (hoursVal && hoursVal > 0) {
              dayHours += hoursVal;
            }
          } else {
            start = fractionToTimeStr(r[colMap[p].start]);
            stop = fractionToTimeStr(r[colMap[p].stop]);
            if (start || stop) {
              dayHours += calculateHours(start, stop);
            }
          }
        }
        
        if (dayHours > 0) {
          if (dateStr <= targetDate) {
            cumulativeHours += dayHours;
          }
          if (dateStr === targetDate) {
            reportedDayHours += dayHours;
            // Remark column is typically after the last operator/hours
            // Just a guess or leave blank for now
          }
        }
      }

      dataMap[`${agencyKey}:${sheetKey}`] = {
        reportedDayHours,
        cumulativeHours
      };
    }

    const reportRows = ROWS_CONFIG.map(row => {
      let rdh = '';
      let cumh = '';
      if (row.mapping) {
        const key = `${row.mapping.agency}:${row.mapping.sheetKey}`;
        if (dataMap[key]) {
          rdh = dataMap[key].reportedDayHours > 0 ? dataMap[key].reportedDayHours.toFixed(1) : '';
          cumh = dataMap[key].cumulativeHours > 0 ? dataMap[key].cumulativeHours.toFixed(1) : '';
        }
      }
      return {
        ...row,
        reportedDayHours: rdh,
        cumulativeHours: cumh,
        remarks: ''
      };
    });

    res.json({ date: targetDate, report: reportRows });
  } catch (e) {
    console.error('Report API error:', e);
    res.status(500).json({ error: e.message });
  }
};
