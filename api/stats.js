const { google } = require('googleapis');
const { getAuth, COLS_INDEX, serialToDateStr, fractionToTimeStr, authenticate, AGENCIES } = require('./_lib');

function timeStrToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  return hours * 60 + mins;
}

function calculateHours(startStr, stopStr) {
  const startMins = timeStrToMinutes(startStr);
  const stopMins = timeStrToMinutes(stopStr);
  if (startMins === 0 && stopMins === 0) return 0;
  let diff = stopMins - startMins;
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = authenticate(req);
  if (!user || !user.isAdmin) return res.status(401).json({ error: 'Admin access required' });

  try {
    const sheetsAPI = google.sheets({ version: 'v4', auth: getAuth() });
    
    const kolkataAgencies = ['sas', 'geebee'];
    const howrahAgencies = ['tecnico'];

    async function fetchAgencyData(agencyKeys) {
      const allData = [];
      
      for (const agencyKey of agencyKeys) {
        const agency = AGENCIES[agencyKey];
        if (!agency || !agency.spreadsheetId || agency.spreadsheetId.includes('HERE')) continue;
        
        const sheetKeys = Object.keys(agency.sheets);
        for (const sheetKey of sheetKeys) {
          const config = agency.sheets[sheetKey];
          try {
            const response = await sheetsAPI.spreadsheets.values.get({
              spreadsheetId: agency.spreadsheetId,
              range: `${sheetKey}!A${config.start}:S${config.end}`,
              valueRenderOption: 'UNFORMATTED_VALUE',
              dateTimeRenderOption: 'SERIAL_NUMBER'
            });
            
            const rows = response.data.values || [];
            for (const r of rows) {
              if (!r || !r[1] || r[1] === '') continue;
              const date = serialToDateStr(r[1]);
              let dayHours = 0;
              let workingPumps = 0;
              
              for (let p = 1; p <= 5; p++) {
                const start = fractionToTimeStr(r[COLS_INDEX[p].start]);
                const stop = fractionToTimeStr(r[COLS_INDEX[p].stop]);
                if (start || stop) {
                  workingPumps++;
                  dayHours += calculateHours(start, stop);
                }
              }
              
              if (workingPumps > 0 || dayHours > 0) {
                allData.push({ date, hours: dayHours, pumps: workingPumps, station: agency.sheets[sheetKey].name, agency: agencyKey });
              }
            }
          } catch (err) {
            console.error(`Error fetching ${agencyKey}:${sheetKey}:`, err.message);
          }
        }
      }
      return allData;
    }

    const [kolkataData, howrahData] = await Promise.all([
      fetchAgencyData(kolkataAgencies),
      fetchAgencyData(howrahAgencies)
    ]);

    function aggregateByDate(data) {
      const map = new Map();
      for (const d of data) {
        const existing = map.get(d.date) || { hours: 0, pumps: 0, stations: new Set() };
        existing.hours += d.hours;
        existing.pumps = Math.max(existing.pumps, d.pumps);
        existing.stations.add(d.station);
        map.set(d.date, existing);
      }
      
      const sortedDates = Array.from(map.keys()).sort();
      return sortedDates.map(date => ({
        date,
        cumulativeHours: map.get(date).hours,
        workingPumps: map.get(date).pumps,
        activeStations: map.get(date).stations.size
      }));
    }

    function calculateCumulative(dailyData) {
      let cumHours = 0;
      return dailyData.map(d => {
        cumHours += d.cumulativeHours;
        return {
          date: d.date,
          dailyHours: d.cumulativeHours,
          cumulativeHours: cumHours,
          workingPumps: d.workingPumps,
          activeStations: d.activeStations
        };
      });
    }

    const kolkataDaily = aggregateByDate(kolkataData);
    const howrahDaily = aggregateByDate(howrahData);

    const kolkataCumulative = calculateCumulative(kolkataDaily);
    const howrahCumulative = calculateCumulative(howrahDaily);

    const kolkataTotalHours = kolkataCumulative.reduce((sum, d) => sum + d.dailyHours, 0);
    const howrahTotalHours = howrahCumulative.reduce((sum, d) => sum + d.dailyHours, 0);
    const kolkataAvgPumps = kolkataDaily.length ? (kolkataDaily.reduce((sum, d) => sum + d.workingPumps, 0) / kolkataDaily.length).toFixed(1) : 0;
    const howrahAvgPumps = howrahDaily.length ? (howrahDaily.reduce((sum, d) => sum + d.workingPumps, 0) / howrahDaily.length).toFixed(1) : 0;

    res.json({
      kolkata: {
        summary: {
          totalHours: kolkataTotalHours.toFixed(1),
          avgPumpsPerDay: kolkataAvgPumps,
          totalDays: kolkataDaily.length
        },
        daily: kolkataCumulative
      },
      howrah: {
        summary: {
          totalHours: howrahTotalHours.toFixed(1),
          avgPumpsPerDay: howrahAvgPumps,
          totalDays: howrahDaily.length
        },
        daily: howrahCumulative
      }
    });

  } catch (e) {
    console.error('Stats error:', e);
    res.status(500).json({ error: e.message });
  }
};