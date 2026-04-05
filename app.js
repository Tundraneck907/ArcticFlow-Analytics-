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
  ]
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  createSnowflakes();
  initDashboard();
});

function initDashboard() {
  populateKpis();
  renderGauges();
  renderProperties();
  renderTanks();
  renderWeather();
  renderAlerts();
  populatePropertyDropdowns();
  initForecastChart();
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

// --- Gauges ---
function renderGauges() {
  const container = document.getElementById('gauges-grid');
  container.innerHTML = '';

  const sortedTanks = [...store.tanks].sort((a,b) => a.level - b.level); // lowest first

  sortedTanks.forEach(tank => {
    const prop = store.properties.find(p => p.id === tank.propertyId);
    let severityClass = tank.level <= 20 ? 'low' : (tank.level <= 45 ? 'med' : 'high');
    
    // Calculate SVG circle dashoffset
    // Circle length = 2 * PI * r (r=45 here for a 100px SVG viewed at 140px)
    const c = Math.PI * (45 * 2);
    const offset = c - (tank.level / 100) * c;

    const div = document.createElement('div');
    div.className = 'tank-info';
    div.innerHTML = `
      <div class="circ-gauge">
        <svg viewBox="0 0 100 100" class="gauge-svg">
          <circle class="gauge-bg" cx="50" cy="50" r="45"></circle>
          <circle class="gauge-fill ${severityClass}" cx="50" cy="50" r="45" 
                  stroke-dasharray="${c}" stroke-dashoffset="${c}"></circle>
        </svg>
        <div class="gauge-text">
          <span class="gauge-value" style="color: var(--accent-${severityClass === 'low' ? 'orange' : severityClass === 'med' ? 'orange' : 'teal'})">
            ${tank.level}%
          </span>
          <span class="gauge-label">${tank.lastUpdate}</span>
        </div>
      </div>
      <div class="tank-name">Tank #${tank.number}</div>
      <div class="tank-prop">${prop.name}</div>
    `;
    container.appendChild(div);

    // Trigger animation
    setTimeout(() => {
      const fillCircle = div.querySelector('.gauge-fill');
      if (fillCircle) fillCircle.style.strokeDashoffset = offset;
    }, 100);
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

// --- Tanks Tab ---
function renderTanks() {
  // Can be filtered by dropdown
  const filterId = document.getElementById('tank-property-filter').value;
  const container = document.getElementById('tanks-list');
  container.innerHTML = '';

  const tanksToShow = filterId === 'all' 
    ? store.tanks 
    : store.tanks.filter(t => t.propertyId == filterId);

  tanksToShow.forEach(tank => {
    const prop = store.properties.find(p => p.id === tank.propertyId);
    container.innerHTML += `
      <div class="glass card prop-card">
        <div class="prop-header">
          <span class="prop-type" style="background: rgba(255,107,53,0.1); color: var(--accent-orange)">${tank.fuelType}</span>
          <span class="stat-val" style="font-size: 1.5rem; color: ${tank.level <= 20 ? 'var(--accent-orange)' : 'var(--text-main)'}">${tank.level}%</span>
        </div>
        <div class="prop-name">Tank #${tank.number} &mdash; ${tank.capacity} Gal</div>
        <div class="prop-address">${prop.name}</div>
        
        <div class="w-full bg-gray-900 rounded-full h-2 mb-4" style="background: rgba(255,255,255,0.1); border-radius: 4px; overflow:hidden;">
          <div class="h-2 rounded-full" style="width: ${tank.level}%; background: ${tank.level <= 20 ? 'var(--accent-orange)' : 'var(--accent-teal)'}; transition: width 1s;"></div>
        </div>
        <button class="btn btn-primary w-full" style="padding: 8px"><i data-lucide="truck"></i> Request Delivery</button>
      </div>
    `;
  });
  lucide.createIcons();
}

// --- Weather Tab ---
function renderWeather() {
  const current = store.weather.current;
  const weatherContent = document.getElementById('weather-content');
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
  container.innerHTML = '';
  store.alerts.forEach(alert => {
    const icon = alert.type === 'danger' ? 'alert-triangle' : (alert.type === 'warning' ? 'thermometer-snowflake' : 'info');
    const colorClass = alert.type === 'danger' ? 'text-orange' : (alert.type === 'warning' ? 'text-blue' : 'text-teal');
    
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

function showAlerts() {
  switchTab('weather');
}

function handleLogin() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  // Re-run animation logic when shown
  setTimeout(renderGauges, 100); 
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
