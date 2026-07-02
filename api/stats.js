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

const GD_ENTERPRISE_COLS = {
  1: { start: 2, stop: 3, hours: 4 },
  2: { start: 5, stop: 6, hours: 7 },
  3: { start: 8, stop: 9, hours: 10 },
  4: { start: 11, stop: 12, hours: 13 },
  5: { start: 14, stop: 15, hours: 16 },
  6: { start: 17, stop: 18, hours: 19 },
  7: { start: 20, stop: 21, hours: 22 },
  8: { start: 23, stop: 24, hours: 25 },
  9: { start: 26, stop: 27, hours: 28 },
};

function getPumpCount(agencyKey, sheetConfig) {
  if (agencyKey === 'gdenterprise') {
    return sheetConfig.pumps || 9;
  }
  return 5;
}

function getRangeEndCol(pumpCount) {
  const lastHoursIdx = 4 + (pumpCount - 1) * 3;
  if (lastHoursIdx < 26) return String.fromCharCode(65 + lastHoursIdx);
  return String.fromCharCode(64 + Math.floor(lastHoursIdx / 26)) + String.fromCharCode(65 + (lastHoursIdx % 26));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = authenticate(req);
  if (!user || !user.isAdmin) return res.status(401).json({ error: 'Admin access required' });

  try {
    const sheetsAPI = google.sheets({ version: 'v4', auth: getAuth() });
    
    const kolkataAgencies = ['sas', 'geebee', 'tecnico'];
    const howrahAgencies = ['gdenterprise'];
    const allAgencies = ['sas', 'geebee', 'tecnico', 'gdenterprise'];

    function calcTotalInstalled(agencyKeys) {
      let total = 0;
      for (const key of agencyKeys) {
        const agency = AGENCIES[key];
        if (!agency) continue;
        for (const sheetKey of Object.keys(agency.sheets)) {
          total += getPumpCount(key, agency.sheets[sheetKey]);
        }
      }
      return total;
    }

    async function fetchAgencyData(agencyKeys) {
      const allData = [];
      
      for (const agencyKey of agencyKeys) {
        const agency = AGENCIES[agencyKey];
        if (!agency || !agency.spreadsheetId || agency.spreadsheetId.includes('HERE')) continue;
        
        const sheetKeys = Object.keys(agency.sheets);
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
            
            const rows = response.data.values || [];
            const isGdEnterprise = agencyKey === 'gdenterprise';
            const colMap = isGdEnterprise ? GD_ENTERPRISE_COLS : COLS_INDEX;
            
            for (const r of rows) {
              if (!r || !r[1] || r[1] === '') continue;
              const date = serialToDateStr(r[1]);
              let dayHours = 0;
              let workingPumps = 0;
              const activePumpNums = new Set();
              
              for (let p = 1; p <= pumpCount; p++) {
                let start, stop;
                if (isGdEnterprise) {
                  start = fractionToTimeStr(r[colMap[p].start]);
                  stop = fractionToTimeStr(r[colMap[p].stop]);
                  const hoursVal = r[colMap[p].hours];
                  if ((start || stop) && (!hoursVal || hoursVal === 0)) {
                    workingPumps++;
                    activePumpNums.add(p);
                    dayHours += calculateHours(start, stop);
                  } else if (hoursVal && hoursVal > 0) {
                    workingPumps++;
                    activePumpNums.add(p);
                    dayHours += hoursVal;
                  }
                } else {
                  start = fractionToTimeStr(r[colMap[p].start]);
                  stop = fractionToTimeStr(r[colMap[p].stop]);
                  if (start || stop) {
                    workingPumps++;
                    activePumpNums.add(p);
                    dayHours += calculateHours(start, stop);
                  }
                }
              }
              
              if (workingPumps > 0 || dayHours > 0) {
                allData.push({
                  date, hours: dayHours, pumps: workingPumps,
                  station: agency.sheets[sheetKey].name, agency: agencyKey,
                  activePumps: Array.from(activePumpNums)
                });
              }
            }
          } catch (err) {
            console.error(`Error fetching ${agencyKey}:${sheetKey}:`, err.message);
          }
        }
      }
      return allData;
    }

    function computeRegionStats(rawData, agencyKeys) {
      const totalInstalled = calcTotalInstalled(agencyKeys);
      const everUsedPumps = new Set();
      const stationPumpMap = {};

      for (const d of rawData) {
        for (const p of d.activePumps) {
          everUsedPumps.add(`${d.station}-P${p}`);
        }
        const key = d.station;
        if (!stationPumpMap[key]) stationPumpMap[key] = new Set();
        d.activePumps.forEach(p => stationPumpMap[key].add(p));
      }

      const totalOperationPumps = everUsedPumps.size;

      const statByStation = {};
      for (const d of rawData) {
        if (!statByStation[d.station]) statByStation[d.station] = { hours: 0, maxPumps: 0 };
        statByStation[d.station].hours += d.hours;
        statByStation[d.station].maxPumps = Math.max(statByStation[d.station].maxPumps, d.pumps);
      }

      const aggregate = aggregateByDate(rawData);
      const cumulative = calculateCumulative(aggregate);
      const totalHours = cumulative.reduce((s, d) => s + d.dailyHours, 0);
      const avgPumps = aggregate.length
        ? (aggregate.reduce((s, d) => s + d.workingPumps, 0) / aggregate.length).toFixed(1)
        : 0;

      return {
        summary: {
          totalInstalled,
          totalInOperation: totalOperationPumps,
          totalHours: totalHours.toFixed(1),
          avgPumpsPerDay: avgPumps,
          totalDays: aggregate.length
        },
        daily: cumulative,
        stationStats: Object.entries(statByStation).map(([name, st]) => ({
          name,
          totalHours: st.hours.toFixed(1),
          maxPumps: st.maxPumps
        }))
      };
    }

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

    const allRawData = await fetchAgencyData(allAgencies);
    const kolkataRaw = allRawData.filter(d => kolkataAgencies.includes(d.agency));
    const howrahRaw = allRawData.filter(d => howrahAgencies.includes(d.agency));

    const kolkataStats = computeRegionStats(kolkataRaw, kolkataAgencies);
    const howrahStats = computeRegionStats(howrahRaw, howrahAgencies);

    const overallInstalled = kolkataStats.summary.totalInstalled + howrahStats.summary.totalInstalled;
    const overallInOperation = kolkataStats.summary.totalInOperation + howrahStats.summary.totalInOperation;
    const overallTotalHours = (parseFloat(kolkataStats.summary.totalHours) + parseFloat(howrahStats.summary.totalHours)).toFixed(1);

    res.json({
      overall: {
        totalInstalled: overallInstalled,
        totalInOperation: overallInOperation,
        totalHours: overallTotalHours
      },
      kolkata: kolkataStats,
      howrah: howrahStats
    });

  } catch (e) {
    console.error('Stats error:', e);
    res.status(500).json({ error: e.message });
  }
};