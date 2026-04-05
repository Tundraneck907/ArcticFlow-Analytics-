/* =========================================================================
   ArcticFlow Analytics State & Logic
   ========================================================================= */

// --- Data Store ---
const store = {
  properties: [
    { id: 1, name: "Chena River Cabin", address: "123 Chena Hot Springs Rd", type: "cabin", lat: 64.856, lon: -147.642, tanks: [1,2] },
    { id: 2, name: "North Pole Duplex", address: "456 Santa Claus Ln", type: "duplex", lat: 64.751, lon: -147.353, tanks: [3] },
    { id: 3, name: "Salcha Trailer", address: "789 Richardson Hwy", type: "trailer", lat: 64.520, lon: -146.950, tanks: [4] }
  ],
  tanks: [
    { id: 1, propertyId: 1, number: 1, capacity: 500, level: 45, fuelType: "Diesel #2", lastUpdate: "10m ago" },
    { id: 2, propertyId: 1, number: 2, capacity: 300, level: 67, fuelType: "Heating Oil", lastUpdate: "1h ago" },
    { id: 3, propertyId: 2, number: 1, capacity: 1000, level: 62, fuelType: "Diesel #1 (Arctic)", lastUpdate: "30m ago" },
    { id: 4, propertyId: 3, number: 1, capacity: 250, level: 16, fuelType: "Diesel #2", lastUpdate: "Just now" }
  ],
  weather: {
    current: { temp: -28, humidity: 65, wind: 8, condition: "Snow", icon: "cloud-snow" },
    forecast: [
      { day: "Mon", high: -15, low: -35, precip: "2\"" },
      { day: "Tue", high: -12, low: -32, precip: "1\"" },
      { day: "Wed", high: -8, low: -28, precip: "0\"" },
      { day: "Thu", high: -18, low: -38, precip: "Snow" },
      { day: "Fri", high: -22, low: -42, precip: "Clear" },
      { day: "Sat", high: -20, low: -40, precip: "Clear" },
      { day: "Sun", high: -25, low: -45, precip: "Clear" }
    ]
  },
  alerts: [
    { title: "Critical Fuel Level", desc: "Salcha Trailer (Tank #1) is at 16%. Refill required immediately.", type: "danger" },
    { title: "Freeze Warning", desc: "Temperatures dropping to -38°F tonight. Monitor exterior lines.", type: "warning" },
    { title: "Thawing Danger", desc: "Humidity at 65%. Risk of thawing cycle at North Pole Duplex.", type: "info" }
  ],
  settings: {
    fuelPricePerGallon: 7.85  // Alaska average — editable in Settings
  }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  createSnowflakes();
  initDashboard();

  // Attach listeners to Settings Toggles to dynamically inject alerts immediately
  ['set-blockheater', 'set-heattape', 'set-generator', 'set-roof', 'set-wood'].forEach(id => {
    let el = document.getElementById(id);
    if(el) el.addEventListener('change', renderAlerts);
  });
});

function initDashboard() {
  populateKpis();
  renderCylinders(); // V2 Premium Upgrade
  renderProperties();
  renderTanks();
  renderWeather();
  renderAlerts();
  populatePropertyDropdowns();
  initForecastChart();
  renderChecklist(); // V2 Winterize Checklist
}

// --- Navigation ---
function switchTab(tabId) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`tab-${tabId}`).classList.add('active');

  // Update content panels
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
    content.classList.remove('transition-fade');
  });
  
  const activeContent = document.getElementById(`tab-${tabId}-content`);
  activeContent.classList.remove('hidden');
  // Trigger reflow for animation
  void activeContent.offsetWidth;
  activeContent.classList.add('transition-fade');
}

// --- KPI Rendering ---
function populateKpis() {
  document.getElementById('stat-properties').innerText = store.properties.length;
  document.getElementById('stat-tanks').innerText = store.tanks.length;
  
  const avg = Math.round(store.tanks.reduce((sum, t) => sum + t.level, 0) / store.tanks.length);
  document.getElementById('stat-avg').innerText = `${avg}%`;
  
  const criticalTanks = store.tanks.filter(t => t.level <= 20).length;
  document.getElementById('stat-alerts').innerText = criticalTanks + store.alerts.filter(a => a.type === 'danger').length;
  document.getElementById('alert-count').innerText = store.alerts.length;
  document.getElementById('alert-count').classList.remove('hidden');
}

// --- V2 Premium Cylinders ---
function renderCylinders() {
  const container = document.getElementById('gauges-grid');
  if(!container) return;
  container.innerHTML = '';

  const sortedTanks = [...store.tanks].sort((a,b) => a.level - b.level);

  sortedTanks.forEach(tank => {
    const prop = store.properties.find(p => p.id === tank.propertyId);
    let severityClass = tank.level <= 20 ? 'bg-danger' : (tank.level <= 45 ? 'bg-warning' : 'bg-safe');
    let textColor = tank.level <= 20 ? 'var(--accent-orange)' : (tank.level <= 45 ? 'var(--accent-orange)' : 'var(--accent-teal)');

    const div = document.createElement('div');
    div.className = 'tank-cylinder-wrapper';
    div.innerHTML = `
      <div class="glass-cylinder">
        <div class="liquid-fill ${severityClass}" style="height: 0%"></div>
      </div>
      <div style="text-align: center; margin-top: 8px;">
        <div style="font-size: 1.5rem; font-weight: 800; color: ${textColor}">${tank.level}%</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${prop.name}</div>
        <div style="font-size: 0.7rem; opacity: 0.5;">Tank #${tank.number}</div>
      </div>
    `;
    container.appendChild(div);

    // Trigger powerful liquid swell animation
    setTimeout(() => {
      const fill = div.querySelector('.liquid-fill');
      if (fill) fill.style.height = `${tank.level}%`;
    }, 150);
  });
}

// --- Properties Tab ---
function renderProperties() {
  const container = document.getElementById('properties-list');
  container.innerHTML = '';

  store.properties.forEach(prop => {
    const pTanks = store.tanks.filter(t => t.propertyId === prop.id);
    const avgLvl = pTanks.length ? Math.round(pTanks.reduce((s,t) => s+t.level, 0)/pTanks.length) : 0;
    
    container.innerHTML += `
      <div class="glass card prop-card">
        <div class="prop-header">
          <span class="prop-type">${prop.type}</span>
          <button class="icon-btn" onclick="alert('Editing ${prop.name}')"><i data-lucide="more-vertical"></i></button>
        </div>
        <div class="prop-name">${prop.name}</div>
        <div class="prop-address"><i data-lucide="map-pin" style="width:12px"></i> ${prop.address}</div>
        
        <div class="prop-stats">
          <div class="stat-col">
            <div class="stat-val text-blue">${pTanks.length}</div>
            <div class="stat-lbl">Active Tanks</div>
          </div>
          <div class="stat-col">
            <div class="stat-val ${avgLvl <= 20 ? 'text-orange glow-text' : 'text-teal'}">${avgLvl}%</div>
            <div class="stat-lbl">Avg Level</div>
          </div>
        </div>
      </div>
    `;
  });
  lucide.createIcons();
}

// --- Tanks Tab: Fuel Cost & Days-Until-Empty Calculator ---
function calcTankEstimates(tank) {
  const gallonsRemaining = (tank.level / 100) * tank.capacity;
  const price = store.settings.fuelPricePerGallon;
  const refillCost = ((100 - tank.level) / 100) * tank.capacity * price;

  // K-Factor based consumption: gallons per Heating Degree Day (HDD = 65 - currentTemp)
  const temp = store.weather.current.temp;
  const hdd = Math.max(65 - temp, 1);
  const kFactor = 0.012; // typical Alaskan residential baseline
  const gallonsPerDay = kFactor * hdd;
  const daysLeft = gallonsPerDay > 0 ? Math.floor(gallonsRemaining / gallonsPerDay) : 99;

  return { refillCost: refillCost.toFixed(0), daysLeft, gallonsRemaining: gallonsRemaining.toFixed(0) };
}

function renderTanks() {
  const filterId = document.getElementById('tank-property-filter').value;
  const container = document.getElementById('tanks-list');
  container.innerHTML = '';

  const tanksToShow = filterId === 'all'
    ? store.tanks
    : store.tanks.filter(t => t.propertyId == filterId);

  tanksToShow.forEach(tank => {
    const prop = store.properties.find(p => p.id === tank.propertyId);
    const est = calcTankEstimates(tank);
    const urgencyColor = tank.level <= 20 ? 'var(--accent-orange)' : 'var(--accent-teal)';
    const daysColor = est.daysLeft <= 3 ? 'var(--accent-orange)' : est.daysLeft <= 7 ? '#F59E0B' : 'var(--accent-teal)';

    container.innerHTML += `
      <div class="glass card prop-card premium-bevel">
        <div class="prop-header">
          <span class="prop-type" style="background: rgba(255,107,53,0.1); color: var(--accent-orange)">${tank.fuelType}</span>
          <span class="stat-val" style="font-size: 1.5rem; color: ${tank.level <= 20 ? 'var(--accent-orange)' : 'var(--text-main)'}">${tank.level}%</span>
        </div>
        <div class="prop-name">Tank #${tank.number} &mdash; ${tank.capacity} Gal</div>
        <div class="prop-address">${prop.name}</div>

        <div style="background: rgba(255,255,255,0.1); border-radius: 4px; overflow:hidden; margin: 12px 0;">
          <div style="height: 6px; width: ${tank.level}%; background: ${urgencyColor}; transition: width 1s; border-radius: 4px;"></div>
        </div>

        <!-- Cost & Days Until Empty Estimator -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;">
          <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 1.2rem; font-weight: 800; color: ${daysColor};">${est.daysLeft}d</div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Days Until Empty</div>
          </div>
          <div style="background: rgba(0,0,0,0.3); border-radius: 10px; padding: 12px; text-align: center;">
            <div style="font-size: 1.2rem; font-weight: 800; color: var(--accent-blue);">$${est.refillCost}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">Est. Refill Cost</div>
          </div>
        </div>

        <button class="btn btn-primary w-full" style="padding: 8px"><i data-lucide="truck"></i> Request Delivery</button>
      </div>
    `;
  });
  lucide.createIcons();
}

// --- Alaskan Daylight Clock (pure math, no API) ---
function calcSunTimes(lat, lon) {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

  // Solar declination
  const decl = 23.45 * Math.sin((Math.PI / 180) * (360 / 365) * (dayOfYear - 81));
  const declRad = decl * (Math.PI / 180);
  const latRad = lat * (Math.PI / 180);

  // Hour angle at sunrise
  const cosHA = -Math.tan(latRad) * Math.tan(declRad);
  if (cosHA < -1) return { sunrise: '--', sunset: '--', hours: 24, polar: 'Polar Day' };
  if (cosHA > 1) return { sunrise: '--', sunset: '--', hours: 0, polar: 'Polar Night' };

  const haRad = Math.acos(cosHA);
  const haDeg = haRad * (180 / Math.PI);

  // Equation of time correction (approx)
  const B = (360 / 365) * (dayOfYear - 81) * (Math.PI / 180);
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const lonCorr = 4 * (lon % 15);
  const noon = 720 - lonCorr - eot; // solar noon in minutes from midnight

  const sunriseMin = noon - haDeg * 4;
  const sunsetMin  = noon + haDeg * 4;
  const totalMins  = sunsetMin - sunriseMin;

  const fmt = m => {
    const h = Math.floor(((m % 1440) + 1440) % 1440 / 60);
    const min = Math.floor(m % 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${((h + 11) % 12 + 1)}:${String(min).padStart(2,'0')} ${ampm}`;
  };

  return {
    sunrise: fmt(sunriseMin),
    sunset: fmt(sunsetMin),
    hours: (totalMins / 60).toFixed(1),
    polar: null
  };
}

// --- Weather Tab ---
function renderWeather() {
  const current = store.weather.current;
  const weatherContent = document.getElementById('weather-content');

  // Compute daylight for first property's lat/lon
  const prop = store.properties[0];
  const sun = calcSunTimes(prop.lat, prop.lon);
  const daylightWarning = parseFloat(sun.hours) < 5 ? 'var(--accent-orange)' : 'var(--accent-teal)';

  weatherContent.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
      <div>
        <div style="font-size: 3rem; font-weight:800; line-height:1">${current.temp}°</div>
        <div style="color:var(--text-muted)">${current.condition}</div>
      </div>
      <i data-lucide="${current.icon}" style="width: 48px; height: 48px; color: var(--accent-blue)"></i>
    </div>
    <div style="font-size:0.85rem; padding-top: 1rem; border-top: 1px solid var(--border-glass)">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="color:var(--text-muted)">Wind</span> <strong>${current.wind} mph</strong>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted)">Humidity</span> <strong>${current.humidity}%</strong>
      </div>
    </div>

    <!-- Alaska Daylight Clock Widget -->
    <div style="margin-top: 16px; padding: 14px; background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
      <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 10px;">Alaska Daylight Clock</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center;">
        <div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #F59E0B;">☀ ${sun.sunrise}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">Sunrise</div>
        </div>
        <div>
          <div style="font-size: 1.1rem; font-weight: 800; color: ${daylightWarning};">${sun.polar || sun.hours + 'h'}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">Daylight</div>
        </div>
        <div>
          <div style="font-size: 0.95rem; font-weight: 700; color: var(--accent-blue);">🌙 ${sun.sunset}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">Sunset</div>
        </div>
      </div>
    </div>
  `;
  lucide.createIcons();
}

function initForecastChart() {
  const container = document.getElementById('forecast-chart-container');
  if(!container) return;
  container.innerHTML = '';
  
  // Custom Glass Tube Chart
  const forecast = store.weather.forecast;
  let maxHigh = Math.max(...forecast.map(f => f.high));
  let minLow = Math.min(...forecast.map(f => f.low));
  let range = maxHigh - minLow || 1;

  forecast.forEach((f, i) => {
    // Normalizing values (0 to 1)
    let fillPercentHigh = ((f.high - minLow) / range) * 100;
    let fillPercentLow = ((f.low - minLow) / range) * 100;
    
    // We make a glowing vertical capsule
    let barHtml = `
      <div class="glass-bar-wrapper" style="animation-delay: ${i * 0.1}s">
        <div class="bar-label top-label">${f.high}°</div>
        <div class="glass-tube">
          <div class="glow-fill high-fill" style="height: ${fillPercentHigh}%"></div>
          <div class="glow-fill low-fill" style="height: ${fillPercentLow}%"></div>
        </div>
        <div class="bar-label bottom-label">${f.low}°</div>
        <div class="bar-day">${f.day}</div>
      </div>
    `;
    container.innerHTML += barHtml;
  });
}

function renderAlerts() {
  const container = document.getElementById('weather-alerts');
  if(!container) return;
  container.innerHTML = '';

  // Smart Engine Reminders Auto-Injection
  let injectedAlerts = [...store.alerts];
  if(document.getElementById('set-blockheater')?.checked) {
    injectedAlerts.push({ title: "Engine Block Heater", desc: "Temps are below 0°F. Plug in vehicles tonight.", type: "warning", icon: "plug" });
  }
  if(document.getElementById('set-heattape')?.checked) {
    injectedAlerts.push({ title: "Heat Tape Required", desc: "Ensure water line heat tape breaker is ON.", type: "info", icon: "flame" });
  }

  // Edge-Case Tracker for Off-grid power
  injectedAlerts.push({ title: "Solar Bank Voltage Low", desc: "Main bank at 11.8V. Start backup generator.", type: "danger", icon: "battery-charging" });

  injectedAlerts.forEach(alert => {
    let icon = alert.icon || (alert.type === 'danger' ? 'alert-triangle' : (alert.type === 'warning' ? 'thermometer-snowflake' : 'info'));
    let colorClass = alert.type === 'danger' ? 'text-orange' : (alert.type === 'warning' ? 'text-blue' : 'text-teal');
    
    container.innerHTML += `
      <li class="alert-item">
        <i data-lucide="${icon}" class="alert-icon ${colorClass}"></i>
        <div class="alert-content flex-1">
          <h4 style="color: var(--text-main)">${alert.title}</h4>
          <p>${alert.desc}</p>
        </div>
      </li>
    `;
  });
}

// --- Utils & Modals ---
function populatePropertyDropdowns() {
  const selects = [document.getElementById('tank-property-filter'), document.getElementById('kfactor-property')];
  selects.forEach(select => {
    if(!select) return;
    // Keep 'All' placeholder if filtering tanks
    if(select.id === 'tank-property-filter') {
      select.innerHTML = '<option value="all">All Properties</option>';
    } else {
      select.innerHTML = '';
    }
    
    store.properties.forEach(p => {
      select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
    });
  });
}

function calculateKFactor() {
  const temp = parseFloat(document.getElementById('kfactor-temp').value);
  const gallons = parseFloat(document.getElementById('kfactor-gallons').value);
  
  if(isNaN(temp) || isNaN(gallons)) return alert('Please enter valid numbers');
  
  // Basic K-Factor logic (HDD = 65 - avg temp)
  const hdd = 65 - temp;
  const k = gallons / hdd;
  
  document.getElementById('kfactor-result').classList.remove('hidden');
  document.getElementById('kfactor-value').innerText = k.toFixed(3);
}

function openPropertyModal() {
  document.getElementById('property-modal').classList.remove('hidden');
}

function closePropertyModal() {
  document.getElementById('property-modal').classList.add('hidden');
}

function saveProperty() {
  const name = document.getElementById('new-prop-name').value;
  if(!name) return alert('Property name required');
  alert(`Provisioned Property: ${name}`);
  closePropertyModal();
}

// --- V2 Winterize Checklist Logic ---
const checklistData = [
  { id: 1, title: 'Disconnect Outside Hoses', desc: 'Remove and drain all external hoses. Cover spigots with insulation.', done: false },
  { id: 2, title: 'Check Heat Tape', desc: 'Test continuity on exposed water line heat tape wrapping.', done: false },
  { id: 3, title: 'Weatherstrip Doors & Windows', desc: 'Seal drafts to prevent extreme heat loss during negative temps.', done: false },
  { id: 4, title: 'Test Backup Heating', desc: 'Test Toyostove / pellet stove / woodstove operations.', done: false },
  { id: 5, title: 'Inspect Roof Vents', desc: 'Ensure vents are clear to prevent ice damming.', done: false },
  { id: 6, title: 'Clean Furnace Filters', desc: 'Replace all HVAC air filters before heavy winter load.', done: false },
  { id: 7, title: 'Bulk Winter Fuel Delivery', desc: 'Ensure tanks are topped off before ice-bridges freeze.', done: false },
  { id: 8, title: 'Test CO Detectors', desc: 'Replace batteries in all Carbon Monoxide units.', done: false },
  { id: 9, title: 'Emergency Survival Kit', desc: 'Stock non-perishables and emergency blankets in cabin.', done: false },
  { id: 10, title: 'Inspect Chimney Flue', desc: 'Clear creosote buildup to prevent fire hazards.', done: false }
];

function renderChecklist() {
  const container = document.getElementById('winter-checklist');
  if(!container) return;
  container.innerHTML = '';
  
  let completed = 0;
  
  checklistData.forEach(item => {
    if(item.done) completed++;
    container.innerHTML += `
      <div class="check-item ${item.done ? 'completed' : ''}" onclick="toggleChecklist(${item.id})">
        <div class="check-box">
          ${item.done ? '<i data-lucide="check" style="width:16px; color:white"></i>' : ''}
        </div>
        <div class="check-text">
          <div class="check-title">${item.title}</div>
          <div class="check-desc">${item.desc}</div>
        </div>
      </div>
    `;
  });
  
  document.getElementById('checklist-progress').innerText = `${completed}/10`;
  lucide.createIcons();
}

// Ensure function is exposed globally for inline HTML click handlers
window.toggleChecklist = function(id) {
  const item = checklistData.find(i => i.id === id);
  if(item) {
    item.done = !item.done;
    renderChecklist();
  }
};

function showAlerts() {
  switchTab('weather');
}

function handleLogin() {
  document.getElementById('login-screen')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
  // Re-run animation logic when shown
  setTimeout(renderCylinders, 100); 
}

function handleLogout() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

// --- Effects ---
function createSnowflakes() {
  const container = document.getElementById('snowflakes');
  if (!container) return;

  for (let i = 0; i < 30; i++) {
    const flake = document.createElement('div');
    flake.className = 'snowflake';
    flake.style.fontSize = `${Math.random() * 8 + 4}px`;
    flake.innerHTML = '❄';
    flake.style.top = '-20px';
    flake.style.left = `${Math.random() * 100}vw`;
    flake.style.opacity = Math.random() * 0.5 + 0.1;

    flake.style.animation = `fall ${Math.random() * 15 + 10}s linear infinite`;
    flake.style.animationDelay = `${Math.random() * 5}s`;
    
    container.appendChild(flake);
  }
}
