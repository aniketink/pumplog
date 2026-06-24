let currentStation = '';
let stations = [];

window.onload = () => {
    // set default date
    document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
    
    // load saved operator name
    let opName = localStorage.getItem('opName');
    if (opName) document.getElementById('f-name').value = opName;

    // fetch locations
    fetch('/api/locations')
        .then(res => res.json())
        .then(data => {
            stations = data.locations;
            renderList();
            document.getElementById('loading').style.display = 'none';
            document.getElementById('nav').style.display = 'flex';
            document.getElementById('app-container').style.display = 'block';
        })
        .catch(e => {
            console.error(e);
            alert('Error loading dataset from server');
        });
};

function renderList() {
    let html = '';
    stations.forEach(s => {
        html += `
            <div class="station-item" onclick="openStation('${s.sheetName}', '${s.displayName}')">
                <h3>${s.displayName}</h3>
                <p>Recorded observations: ${s.entriesCount} / Capacity: ${s.maxEntries}</p>
            </div>
        `;
    });
    document.getElementById('list-container').innerHTML = html;
}

function openStation(id, name) {
    currentStation = id;
    document.getElementById('header-title').innerText = name;
    document.getElementById('view-select').style.display = 'none';
    document.getElementById('view-form').style.display = 'block';
    document.getElementById('back-btn').style.display = 'inline-block';

    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `
            <div class="pump-box">
                <h4>Pump Unit ${i}</h4>
                <div class="time-row">
                    <div class="form-group">
                        <label>Start Time (HH:MM)</label>
                        <input type="time" id="p${i}-start">
                    </div>
                    <div class="form-group">
                        <label>Stop Time (HH:MM)</label>
                        <input type="time" id="p${i}-stop">
                    </div>
                </div>
            </div>
        `;
    }
    document.getElementById('pump-inputs').innerHTML = html;

    // Attach live save listeners
    const inputs = document.querySelectorAll('#data-form input');
    inputs.forEach(input => {
        input.addEventListener('input', saveLive);
    });

    // When date changes, we might want to reload that day's data
    document.getElementById('f-date').addEventListener('change', () => {
        clearForm();
        loadRecent();
    });

    loadRecent();
}

function clearForm() {
    for (let i = 1; i <= 5; i++) {
        document.getElementById(`p${i}-start`).value = '';
        document.getElementById(`p${i}-stop`).value = '';
    }
}

function goBack() {
    document.getElementById('header-title').innerText = 'Station Selection';
    document.getElementById('view-select').style.display = 'block';
    document.getElementById('view-form').style.display = 'none';
    document.getElementById('back-btn').style.display = 'none';
}

let saveTimeout = null;
function saveLive() {
    clearTimeout(saveTimeout);
    let status = document.getElementById('save-status');
    if (!status) return;
    
    status.innerText = 'Live Sync: Saving...';
    status.style.color = '#d35400';

    saveTimeout = setTimeout(() => {
        let date = document.getElementById('f-date').value;
        let name = document.getElementById('f-name').value;
        
        if (!date) {
            status.innerText = 'Live Sync: Date required';
            status.style.color = 'red';
            return;
        }

        let pumps = {};
        let hasData = false;
        for (let i = 1; i <= 5; i++) {
            let start = document.getElementById(`p${i}-start`).value;
            let stop = document.getElementById(`p${i}-stop`).value;
            if (start || stop) {
                hasData = true;
                pumps[i] = { start, stop };
            }
        }

        if (!hasData) {
            status.innerText = 'Live Sync: Ready';
            status.style.color = '#666';
            return;
        }

        localStorage.setItem('opName', name);

        fetch('/api/entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sheetName: currentStation, 
                date: date, 
                pumps: pumps, 
                operatorName: name 
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                status.innerText = 'Live Sync: Saved to Excel \u2713';
                status.style.color = 'green';
                loadRecent();
            } else {
                status.innerText = 'Live Sync Error: ' + (data.error || 'Failed');
                status.style.color = 'red';
            }
        })
        .catch(e => {
            status.innerText = 'Live Sync: Network error';
            status.style.color = 'red';
        });
    }, 1000);
}

function loadRecent() {
    let status = document.getElementById('save-status');
    if (status && status.innerText.includes('Saved')) {
        // Keep the saved state
    } else if (status) {
        status.innerText = 'Syncing...';
    }

    fetch(`/api/recent/${currentStation}?limit=5`)
        .then(res => res.json())
        .then(data => {
            let html = '';
            if (!data.entries || data.entries.length === 0) {
                html = '<p style="text-align:center; font-style:italic;">No observations recorded yet.</p>';
            } else {
                html = `<table class="academic-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Operator</th>
                            <th>Pump 1</th>
                            <th>Pump 2</th>
                            <th>Pump 3</th>
                            <th>Pump 4</th>
                            <th>Pump 5</th>
                        </tr>
                    </thead>
                    <tbody>`;
                data.entries.forEach(row => {
                    html += `<tr>
                        <td><strong>${row.date}</strong></td>
                        <td>${row.operator || '—'}</td>`;
                    
                    for (let i = 1; i <= 5; i++) {
                        let p = row.pumps[i];
                        if (p && (p.start || p.stop)) {
                            html += `<td>${p.start || '-'} &rarr; ${p.stop || '-'}</td>`;
                        } else {
                            html += `<td>—</td>`;
                        }
                    }
                    html += `</tr>`;
                });
                html += `</tbody></table>`;
            }
            document.getElementById('recent-list').innerHTML = html;

            // Auto-fill form if today's data exists
            let currentDate = document.getElementById('f-date').value;
            let todayData = data.entries && data.entries.find(e => e.date === currentDate);
            
            // Only auto-fill if we haven't typed anything yet to avoid overwriting during live-sync
            let isFormEmpty = true;
            for (let i = 1; i <= 5; i++) {
                if (document.getElementById(`p${i}-start`).value || document.getElementById(`p${i}-stop`).value) {
                    isFormEmpty = false;
                    break;
                }
            }

            if (todayData && isFormEmpty) {
                for (let i = 1; i <= 5; i++) {
                    let p = todayData.pumps[i];
                    if (p) {
                        if (p.start) document.getElementById(`p${i}-start`).value = p.start;
                        if (p.stop) document.getElementById(`p${i}-stop`).value = p.stop;
                    }
                }
            }
        })
        .catch(e => console.log('error loading recent', e));
}
