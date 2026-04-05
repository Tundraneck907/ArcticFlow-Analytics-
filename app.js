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
  solarBank: {
    voltage: 12.6,
    health: 98,
    charging: false,
    capacityAh: 400
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
  loadChecklistFromStorage();
  initDashboard();
  initDayNightCycle();
  initAccessibility();

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
  renderCordBurnRate(); // V3 Cord-Burn Optimizer
}

// --- Navigation ---
function switchTab(tabId) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const btn = document.getElementById(`tab-${tabId}`);
  if (btn) btn.classList.add('active');

  // Update content panels
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
    content.classList.remove('transition-fade');
  });
  
  const activeContent = document.getElementById(`tab-${tabId}-content`);
  if (!activeContent) return;
  activeContent.classList.remove('hidden');
  // Trigger reflow for animation
  void activeContent.offsetWidth;
  activeContent.classList.add('transition-fade');

  // Elite: Re-trigger staggered entry animations for children
  const children = activeContent.querySelectorAll(':scope > div, :scope > .dashboard-grid, :scope > .glass');
  children.forEach((child, index) => {
    child.style.animation = 'none';
    void child.offsetWidth; // trigger reflow
    child.style.animation = `slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) both ${0.1 * (index + 1)}s`;
  });

  // Logic for specific tabs
  if (tabId === 'ai') {
    if (typeof AnomalyDetector !== 'undefined') AnomalyDetector.renderLog();
    if (typeof FeedbackEngine !== 'undefined') FeedbackEngine.renderAnalytics();
    if (typeof ConfidenceScorer !== 'undefined') ConfidenceScorer.renderConfidenceCards();
  }
  if (tabId === 'roi' && typeof ROIEngine !== 'undefined') {
    ROIEngine.renderROIDashboard();
  }
  if (tabId === 'community' && typeof Marketplace !== 'undefined') {
    Marketplace.init();
  }
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

  renderSolarBank();
}

function renderSolarBank() {
  const vEl = document.getElementById('solar-voltage');
  const bEl = document.getElementById('solar-level-bar');
  const hEl = document.getElementById('solar-health');
  if(!vEl || !bEl || !hEl) return;

  const s = store.solarBank;
  vEl.innerText = `${s.voltage.toFixed(1)}V`;
  bEl.style.width = `${s.health}%`;
  bEl.style.background = s.health > 90 ? 'var(--accent-teal)' : (s.health > 75 ? 'var(--accent-orange)' : '#f44336');
  hEl.innerText = `${s.health}% ${s.health > 90 ? 'Perfect' : (s.health > 75 ? 'Nominal' : 'DEGRADED')}`;
}

// --- V2 Premium Cylinders ---
// --- V2 Premium Cylinders with SVG Liquid Effects ---
function renderCylinders() {
  const container = document.getElementById('gauges-grid');
  if(!container) return;
  container.innerHTML = '';

  const sortedTanks = [...store.tanks].sort((a,b) => a.level - b.level);

  // SVG Filter for 3D Liquid Glass effect (injected once into DOM)
  if (!document.getElementById('liquid-filter-svg')) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.id = "liquid-filter-svg";
    svg.style.position = "absolute";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.innerHTML = `
      <filter id="liquid-glass">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
        <feSpecularLighting in="blur" surfaceScale="5" specularConstant="1" specularExponent="20" lighting-color="#ffffff" result="specular">
          <fePointLight x="-20" y="-20" z="100" />
        </feSpecularLighting>
        <feComposite in="specular" in2="SourceAlpha" operator="in" />
        <feComposite in="SourceGraphic" operator="arithmetic" k2="1" k3="1" />
      </filter>
    `;
    document.body.appendChild(svg);
  }

  sortedTanks.forEach(tank => {
    const prop = store.properties.find(p => p.id === tank.propertyId);
    let color = tank.level <= 20 ? 'var(--accent-orange)' : (tank.level <= 45 ? '#F59E0B' : 'var(--accent-teal)');
    let textColor = tank.level <= 20 ? 'var(--accent-orange)' : (tank.level <= 45 ? 'var(--accent-orange)' : 'var(--accent-teal)');

    const div = document.createElement('div');
    div.className = 'tank-cylinder-wrapper';
    div.innerHTML = `
      <div class="glass-cylinder premium-bevel">
        <div class="liquid-fill" style="height: 0%; background: ${color}; filter: url(#liquid-glass);">
          <div class="liquid-wave"></div>
        </div>
      </div>
      <div style="text-align: center; margin-top: 8px;">
        <div style="font-size: 1.5rem; font-weight: 800; color: ${textColor}">${tank.level}%</div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">${prop.name}</div>
        <div style="font-size: 0.7rem; opacity: 0.5;">Tank #${tank.number}</div>
      </div>
    `;
    container.appendChild(div);

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

// --- V3 Winterize Checklist Logic (localStorage + AI Tasks + Bulk Actions) ---
let checklistVisible = true;
const checklistData = [
  { id: 1, title: 'Disconnect Outside Hoses', desc: 'Remove and drain all external hoses. Cover spigots with insulation.', done: false, source: 'manual' },
  { id: 2, title: 'Check Heat Tape', desc: 'Test continuity on exposed water line heat tape wrapping.', done: false, source: 'manual' },
  { id: 3, title: 'Weatherstrip Doors & Windows', desc: 'Seal drafts to prevent extreme heat loss during negative temps.', done: false, source: 'manual' },
  { id: 4, title: 'Test Backup Heating', desc: 'Test Toyostove / pellet stove / woodstove operations.', done: false, source: 'manual' },
  { id: 5, title: 'Inspect Roof Vents', desc: 'Ensure vents are clear to prevent ice damming.', done: false, source: 'manual' },
  { id: 6, title: 'Clean Furnace Filters', desc: 'Replace all HVAC air filters before heavy winter load.', done: false, source: 'manual' },
  { id: 7, title: 'Bulk Winter Fuel Delivery', desc: 'Ensure tanks are topped off before ice-bridges freeze.', done: false, source: 'manual' },
  { id: 8, title: 'Test CO Detectors', desc: 'Replace batteries in all Carbon Monoxide units.', done: false, source: 'manual' },
  { id: 9, title: 'Emergency Survival Kit', desc: 'Stock non-perishables and emergency blankets in cabin.', done: false, source: 'manual' },
  { id: 10, title: 'Inspect Chimney Flue', desc: 'Clear creosote buildup to prevent fire hazards.', done: false, source: 'manual' }
];

let aiLastUpdatedChecklist = null;

function loadChecklistFromStorage() {
  try {
    const saved = localStorage.getItem('arcticflow_checklist');
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.forEach(s => {
        const item = checklistData.find(i => i.id === s.id);
        if (item) item.done = s.done;
      });
    }
    const vis = localStorage.getItem('arcticflow_checklist_visible');
    if (vis !== null) checklistVisible = vis === 'true';
  } catch(e) { /* ignore corrupt data */ }
}

function saveChecklistToStorage() {
  localStorage.setItem('arcticflow_checklist', JSON.stringify(checklistData.map(i => ({ id: i.id, done: i.done }))));
  localStorage.setItem('arcticflow_checklist_visible', String(checklistVisible));
}

function injectAIChecklistTasks() {
  // AI generates tasks based on current conditions
  const temp = store.weather.current.temp;
  const aiTasks = [];
  let nextId = 100;

  // Remove any previously injected AI tasks
  while (checklistData.length > 10) checklistData.pop();

  if (temp <= -30) {
    aiTasks.push({ id: nextId++, title: '⚠️ Extreme Cold: Run Faucets', desc: 'Keep water trickling to prevent pipe burst at temps below -30°F.', done: false, source: 'ai' });
  }
  if (temp <= -20) {
    aiTasks.push({ id: nextId++, title: '🔌 Plug In Block Heater NOW', desc: 'AI detected temps below -20°F. Vehicle engines need pre-heating.', done: false, source: 'ai' });
  }
  const lowTanks = store.tanks.filter(t => t.level < 25);
  if (lowTanks.length > 0) {
    aiTasks.push({ id: nextId++, title: `⛽ Refill ${lowTanks.length} Low Tank(s)`, desc: `AI flagged ${lowTanks.length} tank(s) below 25%. Schedule delivery before freeze locks roads.`, done: false, source: 'ai' });
  }
  if (store.weather.current.humidity > 60) {
    aiTasks.push({ id: nextId++, title: '💧 Check for Condensation', desc: 'Humidity above 60% increases tank condensation risk. Inspect fuel filters.', done: false, source: 'ai' });
  }

  if (aiTasks.length > 0) {
    checklistData.push(...aiTasks);
    aiLastUpdatedChecklist = new Date();
  }
}

function renderChecklist() {
  const container = document.getElementById('winter-checklist');
  if(!container) return;

  // Inject AI tasks on each render
  injectAIChecklistTasks();

  container.innerHTML = '';
  let completed = 0;
  const total = checklistData.length;
  
  // Bulk action buttons + toggle + AI timestamp
  container.innerHTML += `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
      <div style="display:flex; gap:8px;">
        <button onclick="markAllChecklist(true)" class="btn" style="padding:6px 12px; font-size:0.75rem; background:var(--accent-teal); color:white; border-radius:8px;">✓ Mark All</button>
        <button onclick="markAllChecklist(false)" class="btn" style="padding:6px 12px; font-size:0.75rem; background:rgba(255,255,255,0.08); color:var(--text-muted); border-radius:8px;">↺ Reset All</button>
        <button onclick="toggleChecklistVisibility()" class="btn" style="padding:6px 12px; font-size:0.75rem; background:rgba(255,255,255,0.05); color:var(--text-muted); border-radius:8px;">${checklistVisible ? '🔽 Hide List' : '🔼 Show List'}</button>
      </div>
      ${aiLastUpdatedChecklist ? `<span style="font-size:0.65rem; color:var(--accent-blue);">🤖 AI updated: ${aiLastUpdatedChecklist.toLocaleTimeString()}</span>` : ''}
    </div>
  `;

  if (!checklistVisible) {
    document.getElementById('checklist-progress').innerText = `${checklistData.filter(i=>i.done).length}/${total}`;
    lucide.createIcons();
    return;
  }

  checklistData.forEach(item => {
    if(item.done) completed++;
    const isAI = item.source === 'ai';
    container.innerHTML += `
      <div class="check-item ${item.done ? 'completed' : ''}" onclick="toggleChecklist(${item.id})" role="checkbox" aria-checked="${item.done}" aria-label="${item.title}" tabindex="0" onkeydown="if(event.key==='Enter') toggleChecklist(${item.id})">
        <div class="check-box">
          ${item.done ? '<i data-lucide="check" style="width:16px; color:white"></i>' : ''}
        </div>
        <div class="check-text">
          <div class="check-title">${isAI ? '<span style="color:var(--accent-blue); font-size:0.7rem;">🤖 AI </span>' : ''}${item.title}</div>
          <div class="check-desc">${item.desc}</div>
        </div>
      </div>
    `;
  });
  
  document.getElementById('checklist-progress').innerText = `${completed}/${total}`;
  lucide.createIcons();
}

window.toggleChecklist = function(id) {
  const item = checklistData.find(i => i.id === id);
  if(item) {
    item.done = !item.done;
    saveChecklistToStorage();
    renderChecklist();
  }
};

window.markAllChecklist = function(state) {
  checklistData.forEach(i => i.done = state);
  saveChecklistToStorage();
  renderChecklist();
};

window.toggleChecklistVisibility = function() {
  checklistVisible = !checklistVisible;
  saveChecklistToStorage();
  renderChecklist();
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

// ==================== V3: CORD-BURN RATE OPTIMIZER ====================
function renderCordBurnRate() {
  const container = document.getElementById('cord-burn-tracker');
  if (!container) return;

  const temp = store.weather.current.temp;
  const humidity = store.weather.current.humidity;

  // Auto-adjust burn rate based on conditions
  // Base: 0.08 cords/day at 0°F, scales with cold
  const baseBurnRate = 0.08;
  const tempFactor = Math.max(0.5, 1 + ((0 - temp) / 50)); // colder = more burn
  const humidityFactor = humidity > 50 ? 1 + ((humidity - 50) / 200) : 1; // humid = more burn (harder to heat)
  const adjustedBurnRate = parseFloat((baseBurnRate * tempFactor * humidityFactor).toFixed(3));

  // Simulated wood supply
  const cordsOnHand = 4.5;
  const daysRemaining = Math.floor(cordsOnHand / adjustedBurnRate);
  const weeklyBurn = (adjustedBurnRate * 7).toFixed(2);

  // AI-generated suggestion
  let suggestion = '';
  let suggColor = 'var(--accent-teal)';
  if (temp < -30) {
    suggestion = '🔥 Increase indoor target by 5°F — extreme cold detected.';
    suggColor = 'var(--accent-orange)';
  } else if (temp < -15) {
    suggestion = '♻️ Maintain steady 68°F. Consider closing off unused rooms.';
    suggColor = '#F59E0B';
  } else if (humidity > 65) {
    suggestion = '💨 High humidity reducing heat efficiency. Open a ceiling vent for 10 min.';
    suggColor = 'var(--accent-blue)';
  } else {
    suggestion = '✅ Burn rate is optimal for current conditions.';
    suggColor = 'var(--accent-teal)';
  }

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-bottom:12px;">
      <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; text-align:center;">
        <div style="font-size:1.3rem; font-weight:800; color:var(--accent-orange);">${cordsOnHand}</div>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">Cords On Hand</div>
      </div>
      <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; text-align:center;">
        <div style="font-size:1.3rem; font-weight:800; color:var(--accent-blue);">${adjustedBurnRate}</div>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">Cords/Day</div>
      </div>
      <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; text-align:center;">
        <div style="font-size:1.3rem; font-weight:800; color:${daysRemaining < 30 ? 'var(--accent-orange)' : 'var(--accent-teal)'};">${daysRemaining}d</div>
        <div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">Supply Left</div>
      </div>
    </div>

    <!-- Progress bar showing supply depletion -->
    <div style="background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden; margin-bottom:10px;">
      <div style="height:6px; width:${Math.min(100, (daysRemaining/90)*100)}%; background: linear-gradient(90deg, var(--accent-orange), var(--accent-teal)); border-radius:4px; transition:width 1s;"></div>
    </div>
    <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-muted); margin-bottom:12px;">
      <span>Weekly burn: ${weeklyBurn} cords</span>
      <span>Temp factor: ${tempFactor.toFixed(2)}x | Humidity: ${humidityFactor.toFixed(2)}x</span>
    </div>

    <!-- Burn Rate Optimizer Suggestion -->
    <div style="padding:10px 12px; background:rgba(0,0,0,0.25); border-left:3px solid ${suggColor}; border-radius:6px;">
      <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.5px; color:${suggColor}; margin-bottom:4px;">🧠 Burn-Rate Optimizer</div>
      <div style="font-size:0.8rem; color:var(--text-main);">${suggestion}</div>
    </div>
  `;
}


// ==================== V3: DAY/NIGHT CYCLE + DARK MODE OVERRIDE ====================
let darkModeOverride = false;

function initDayNightCycle() {
  // Check for saved dark mode preference
  const savedOverride = localStorage.getItem('arcticflow_darkmode_override');
  if (savedOverride === 'true') darkModeOverride = true;

  updateDayNightBackground();
  setInterval(updateDayNightBackground, 60000); // update every minute
}

function updateDayNightBackground() {
  if (darkModeOverride) {
    document.body.style.backgroundImage = `radial-gradient(circle at top right, rgba(74,144,226,0.05) 0%, transparent 40%),
      radial-gradient(circle at bottom left, rgba(255,107,53,0.05) 0%, transparent 40%)`;
    return;
  }

  const hour = new Date().getHours();
  let bgGradient;

  if (hour >= 6 && hour < 10) {
    // Sunrise
    bgGradient = `radial-gradient(circle at top right, rgba(255,183,77,0.08) 0%, transparent 50%),
      radial-gradient(circle at bottom left, rgba(74,144,226,0.05) 0%, transparent 40%)`;
  } else if (hour >= 10 && hour < 16) {
    // Day
    bgGradient = `radial-gradient(circle at top right, rgba(245,158,11,0.06) 0%, transparent 40%),
      radial-gradient(circle at bottom left, rgba(74,144,226,0.08) 0%, transparent 50%)`;
  } else if (hour >= 16 && hour < 20) {
    // Sunset
    bgGradient = `radial-gradient(circle at top right, rgba(255,107,53,0.08) 0%, transparent 45%),
      radial-gradient(circle at bottom left, rgba(74,144,226,0.06) 0%, transparent 40%)`;
  } else {
    // Night
    bgGradient = `radial-gradient(circle at top right, rgba(74,144,226,0.04) 0%, transparent 40%),
      radial-gradient(circle at bottom left, rgba(46,196,182,0.03) 0%, transparent 40%)`;
  }

  document.body.style.transition = 'background-image 2s ease';
  document.body.style.backgroundImage = bgGradient;

  // Update the sun/moon icon if it exists
  const daylightEl = document.querySelector('.daylight-icon');
  if (daylightEl) {
    const isDaytime = hour >= 7 && hour < 19;
    daylightEl.style.transition = 'transform 0.6s ease, opacity 0.6s ease';
    daylightEl.textContent = isDaytime ? '☀' : '🌙';
  }
}

window.toggleDarkModeOverride = function() {
  darkModeOverride = !darkModeOverride;
  localStorage.setItem('arcticflow_darkmode_override', String(darkModeOverride));
  updateDayNightBackground();
  const btn = document.getElementById('darkmode-toggle-btn');
  if (btn) btn.textContent = darkModeOverride ? '🌙 Night Locked' : '🌤️ Auto';
};


// ==================== V3: KPI DRILL-DOWN POPUPS ====================
window.openKpiDrilldown = function(metric) {
  let content = '';
  switch(metric) {
    case 'properties':
      content = store.properties.map(p => `
        <div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <strong>${p.name}</strong> <span class="text-muted" style="font-size:0.8rem;">(${p.type})</span>
          <div style="font-size:0.75rem; color:var(--text-muted);">${p.address}</div>
          <div style="font-size:0.75rem; color:var(--accent-blue); margin-top:2px;">Tanks: ${p.tanks.length} | Est. monthly: $${(p.tanks.length * 450).toLocaleString()}</div>
        </div>
      `).join('');
      break;
    case 'tanks':
      content = store.tanks.map(t => {
        const prop = store.properties.find(p => p.id === t.propertyId);
        const gals = Math.round(t.capacity * t.level / 100);
        return `
          <div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <strong>${prop?.name} — Tank #${t.number}</strong>
            <div style="font-size:0.8rem;">${t.fuelType} | ${gals}/${t.capacity} gal (${t.level}%)</div>
            <div style="height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:4px;"><div style="height:100%; width:${t.level}%; background:${t.level<25?'var(--accent-orange)':'var(--accent-teal)'}; border-radius:2px;"></div></div>
          </div>
        `;
      }).join('');
      break;
    case 'avg':
      const levels = store.tanks.map(t => t.level);
      const avg = Math.round(levels.reduce((s,v)=>s+v,0)/levels.length);
      const min = Math.min(...levels);
      const max = Math.max(...levels);
      content = `
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px;">
          <div style="text-align:center;"><div style="font-size:1.5rem; font-weight:800; color:var(--accent-orange);">${min}%</div><div style="font-size:0.7rem; color:var(--text-muted);">Lowest</div></div>
          <div style="text-align:center;"><div style="font-size:1.5rem; font-weight:800; color:var(--accent-teal);">${avg}%</div><div style="font-size:0.7rem; color:var(--text-muted);">Average</div></div>
          <div style="text-align:center;"><div style="font-size:1.5rem; font-weight:800; color:var(--accent-blue);">${max}%</div><div style="font-size:0.7rem; color:var(--text-muted);">Highest</div></div>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted);">Distribution across ${store.tanks.length} tanks</div>
      `;
      break;
    case 'alerts':
      content = store.alerts.map(a => `
        <div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <span style="color:${a.type==='danger'?'var(--accent-orange)':a.type==='warning'?'#F59E0B':'var(--accent-blue)'};">● ${a.title}</span>
          <div style="font-size:0.8rem; color:var(--text-muted);">${a.desc}</div>
        </div>
      `).join('');
      break;
  }

  // Create popup
  let popup = document.getElementById('kpi-drilldown-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'kpi-drilldown-popup';
    document.body.appendChild(popup);
  }
  popup.className = 'kpi-drilldown-overlay';
  popup.innerHTML = `
    <div class="kpi-drilldown-card glass premium-bevel" onclick="event.stopPropagation()">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:1rem;">📊 ${metric.charAt(0).toUpperCase() + metric.slice(1)} Breakdown</h3>
        <button onclick="document.getElementById('kpi-drilldown-popup').classList.add('hidden')" class="icon-btn close-btn" aria-label="Close drilldown"><i data-lucide="x"></i></button>
      </div>
      <div class="custom-scroll" style="max-height:400px; overflow-y:auto;">${content}</div>
      <button onclick="exportDrilldownCSV('${metric}')" class="btn" style="margin-top:12px; padding:8px 16px; font-size:0.8rem; background:rgba(255,255,255,0.08); color:var(--text-muted); border-radius:8px; width:100%;">
        📥 Export CSV
      </button>
    </div>
  `;
  popup.classList.remove('hidden');
  popup.onclick = () => popup.classList.add('hidden');
  lucide.createIcons();
};


// ==================== V3: CSV EXPORT ====================
window.exportDrilldownCSV = function(metric) {
  let csv = '';
  switch(metric) {
    case 'properties':
      csv = 'Name,Type,Address,Tanks\n' + store.properties.map(p => `"${p.name}","${p.type}","${p.address}",${p.tanks.length}`).join('\n');
      break;
    case 'tanks':
      csv = 'Property,Tank,Fuel Type,Capacity,Level %,Gallons\n' + store.tanks.map(t => {
        const prop = store.properties.find(p => p.id === t.propertyId);
        return `"${prop?.name}",${t.number},"${t.fuelType}",${t.capacity},${t.level},${Math.round(t.capacity*t.level/100)}`;
      }).join('\n');
      break;
    case 'alerts':
      csv = 'Title,Type,Description\n' + store.alerts.map(a => `"${a.title}","${a.type}","${a.desc}"`).join('\n');
      break;
    default:
      csv = 'Metric,Value\nAvg Level,' + Math.round(store.tanks.reduce((s,t)=>s+t.level,0)/store.tanks.length) + '%';
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `arcticflow_${metric}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};


// --- Premium Startup Aesthetics: Chart.js Global Config ---
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = '#9CA3AF';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 15, 20, 0.9)';
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.titleFont = { weight: '700', size: 13 };
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding = 20;
}

// ==================== V3: ACCESSIBILITY ====================
function initAccessibility() {
  // Add ARIA labels to major navigation elements
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const tabName = btn.textContent.trim();
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-label', `${tabName} tab`);
  });

  document.querySelectorAll('.notification-btn').forEach(btn => {
    btn.setAttribute('aria-label', 'View notifications');
  });

  // Keyboard focus outline style (injected once)
  if (!document.getElementById('a11y-focus-styles')) {
    const style = document.createElement('style');
    style.id = 'a11y-focus-styles';
    style.textContent = `
      *:focus-visible {
        outline: 2px solid var(--accent-blue) !important;
        outline-offset: 2px;
        border-radius: 4px;
      }
      .check-item:focus-visible { outline-offset: -2px; }
      .tab-btn:focus-visible { box-shadow: 0 0 0 3px var(--accent-blue-glow); }
    `;
    document.head.appendChild(style);
  }
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

// ==================== V3: ADVANCED DATA STORYTELLING ====================
window.renderCharts = function() {
  if (typeof Chart === 'undefined') return;

  // 1. PARETO CHART: Consumption by Property
  const paretoCtx = document.getElementById('pareto-chart');
  if (paretoCtx) {
    // Generate Pareto data from actual store.tanks
    const propTotals = store.properties.map(p => {
      const pTanks = store.tanks.filter(t => t.propertyId === p.id);
      const totalCap = pTanks.reduce((s,t) => s + t.capacity, 0);
      const currentFill = pTanks.reduce((s,t) => s + (t.capacity * t.level / 100), 0);
      return { name: p.name, val: Math.round(totalCap - currentFill) }; // 'Drain' or 'Usage'
    }).sort((a,b) => b.val - a.val);

    const totalDrain = propTotals.reduce((s,i) => s + i.val, 0);
    let cum = 0;
    const cumData = propTotals.map(i => {
      cum += i.val;
      return totalDrain > 0 ? (cum / totalDrain) * 100 : 0;
    });

    if (window.paretoRef) window.paretoRef.destroy();
    window.paretoRef = new Chart(paretoCtx, {
      type: 'bar',
      data: {
        labels: propTotals.map(i => i.name),
        datasets: [
          {
            label: 'Cumulative %',
            data: cumData,
            type: 'line',
            yAxisID: 'y1',
            borderColor: 'var(--accent-orange)',
            backgroundColor: 'transparent',
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: '#fff',
            tension: 0.4
          },
          {
            label: 'Est. Drain (Gal)',
            data: propTotals.map(i => i.val),
            backgroundColor: 'rgba(0, 191, 165, 0.4)',
            hoverBackgroundColor: 'var(--accent-teal)',
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (ctx) => ctx.dataset.label === 'Cumulative %' ? `Total Coverage: ${ctx.raw.toFixed(1)}%` : `Used: ${ctx.raw} Gallons`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
          y1: { position: 'right', beginAtZero: true, max: 100, display: false }
        }
      }
    });
  }

  // 2. WATERFALL CHART: Inventory Reconciliation
  const waterfallCtx = document.getElementById('waterfall-chart');
  if (waterfallCtx) {
    // Labels: Start, Usage, Refill, Current
    // Let's use the first tank as a baseline for the story
    const tank = store.tanks[0];
    const dataParts = [
      { label: 'Beginning', value: tank.capacity * 0.8, type: 'start' },
      { label: 'Burn Rate', value: -(tank.capacity * 0.35), type: 'change' },
      { label: 'Refill Event', value: tank.capacity * 0.4, type: 'change' },
      { label: 'Forecasted Low', value: tank.capacity * tank.level / 100, type: 'end' }
    ];

    let currentSum = 0;
    const barData = dataParts.map(d => {
      const prev = currentSum;
      if (d.type === 'start' || d.type === 'end') {
        currentSum = d.value;
        return [0, d.value];
      }
      currentSum += d.value;
      return [prev, currentSum];
    });

    if (window.waterfallRef) window.waterfallRef.destroy();
    window.waterfallRef = new Chart(waterfallCtx, {
      type: 'bar',
      data: {
        labels: dataParts.map(d => d.label),
        datasets: [{
          label: 'Inventory Change',
          data: barData,
          backgroundColor: dataParts.map(d => 
            d.type === 'start' || d.type === 'end' ? 'rgba(74, 144, 226, 0.6)' : 
            d.value > 0 ? 'rgba(0, 191, 165, 0.6)' : 'rgba(255, 112, 67, 0.6)'
          ),
          borderColor: dataParts.map(d => 
            d.type === 'start' || d.type === 'end' ? 'var(--accent-blue)' : 
            d.value > 0 ? 'var(--accent-teal)' : 'var(--accent-orange)'
          ),
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: { 
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw[1] - ctx.raw[0];
                return `${val > 0 ? '+' : ''}${Math.round(val)} Gallons`;
              }
            }
          }
        },
        scales: { 
          x: { 
            beginAtZero: true, 
            grid: { color: 'rgba(255,255,255,0.05)' },
            title: { display: true, text: 'Gallons' }
          }
        }
      }
    });
  }

  // 3. DOT PLOT: Comparative Levels
  const dotCtx = document.getElementById('dotplot-chart');
  if (dotCtx) {
    const dotData = store.tanks.map((t, i) => ({
      x: t.level,
      y: i + 1,
      label: `T#${t.number} (${store.properties.find(p=>p.id===t.propertyId)?.name})`
    }));

    if (window.dotRef) window.dotRef.destroy();
    window.dotRef = new Chart(dotCtx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Tank Levels (%)',
          data: dotData,
          backgroundColor: dotData.map(d => d.x < 25 ? '#FF6B35' : '#2EC4B6'),
          pointRadius: 10,
          pointHoverRadius: 15
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { min: 0, max: 100, title: { display: true, text: 'Fill Level %' } },
          y: { 
            ticks: {
              callback: (val) => dotData.find(d => d.y === val)?.label || ''
            },
            title: { display: true, text: 'Active Tanks' }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw.label}: ${ctx.raw.x}%`
            }
          }
        }
      }
    });
  }
};
