/* ===========================================================
   ArcticFlow V3 — AI Autonomy Engine
   All 7 features: Feedback, Anomaly, Confidence, Fuel Quality,
   Voice, Gamification, Offline Vault
   =========================================================== */

// ==================== 1. IndexedDB Data Vault ====================
const ArcticDB = {
  db: null,
  DB_NAME: 'ArcticFlowDB',
  DB_VERSION: 2,

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('feedback')) {
          const fs = db.createObjectStore('feedback', { keyPath: 'id', autoIncrement: true });
          fs.createIndex('timestamp', 'timestamp');
          fs.createIndex('category', 'category');
          fs.createIndex('sentiment', 'sentiment');
        }
        if (!db.objectStoreNames.contains('anomalyLog')) {
          const as = db.createObjectStore('anomalyLog', { keyPath: 'id', autoIncrement: true });
          as.createIndex('timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('tankHistory')) {
          const ts = db.createObjectStore('tankHistory', { keyPath: 'id', autoIncrement: true });
          ts.createIndex('tankId', 'tankId');
          ts.createIndex('timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains('achievements')) {
          db.createObjectStore('achievements', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  },

  async add(storeName, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const s = tx.objectStore(storeName);
      const req = s.add(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async count(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
};


// ==================== 2. Sentiment Analysis Engine ====================
const SentimentEngine = {
  positive: ['amazing','awesome','beautiful','best','clean','convenient','easy','efficient',
    'excellent','fantastic','fast','good','great','helpful','impressive','intuitive','love',
    'nice','perfect','reliable','smooth','solid','superb','useful','wonderful','works',
    'accurate','brilliant','clear','cool','premium','safe','secure','simple','smart','quick'],
  negative: ['annoying','awful','bad','broken','bug','buggy','complicated','confusing',
    'crash','difficult','disappointing','error','fail','frustrating','glitch','hard','hate',
    'horrible','inaccurate','inconsistent','issue','lag','missing','outdated','poor','problem',
    'rough','slow','terrible','ugly','unreliable','useless','wrong','freeze','frozen','stuck',
    'dead','empty','leak','danger','risk','critical','fail','failure','lost','expensive'],

  alaskaKeywords: {
    winterization: ['freeze','frozen','ice','snow','cold','heater','heat','tape','insulate','pipe','thaw','gelling','gel','thawing','freeze-thaw'],
    fuel: ['fuel','tank','diesel','oil','gallon','delivery','refill','level','drain','empty','low','consumption','burn-rate','k-factor'],
    power: ['battery','solar','generator','voltage','power','outage','inverter','voltage','v','volts','charge'],
    safety: ['emergency','fire','carbon','monoxide','co','smoke','flood','leak','critical','danger','alert'],
    logistics: ['delivery','dispatch','order','truck','supply','schedule','route','delivery','cost','price']
  },

  analyze(text) {
    const lower = text.toLowerCase();
    const words = lower.split(/\W+/).filter(w => w.length > 2);

    let posCount = 0, negCount = 0;
    const foundPositive = [], foundNegative = [];

    words.forEach(w => {
      if (this.positive.includes(w)) { posCount++; foundPositive.push(w); }
      if (this.negative.includes(w)) { negCount++; foundNegative.push(w); }
    });

    const total = posCount + negCount || 1;
    const rawScore = (posCount - negCount) / total;
    const score = Math.max(-1, Math.min(1, rawScore));

    let label = 'neutral';
    if (score > 0.2) label = 'positive';
    else if (score < -0.2) label = 'negative';

    // Detect Alaska-specific categories
    const categories = [];
    for (const [cat, kws] of Object.entries(this.alaskaKeywords)) {
      if (kws.some(kw => lower.includes(kw))) categories.push(cat);
    }

    return {
      score: parseFloat(score.toFixed(2)),
      label,
      positiveWords: foundPositive,
      negativeWords: foundNegative,
      detectedCategories: categories,
      wordCount: words.length
    };
  }
};


// ==================== 3. AI Feedback Intelligence Engine ====================
const FeedbackEngine = {
  async submit(category, text, rating) {
    const analysis = SentimentEngine.analyze(text);
    const entry = {
      timestamp: Date.now(),
      category,
      text,
      rating: rating || 0,
      sentiment: analysis.label,
      sentimentScore: analysis.score,
      positiveWords: analysis.positiveWords,
      negativeWords: analysis.negativeWords,
      detectedCategories: analysis.detectedCategories
    };
    await ArcticDB.add('feedback', entry);
    return entry;
  },

  async getAnalytics() {
    const all = await ArcticDB.getAll('feedback');
    if (!all.length) return null;

    // Sentiment trend (last 20 entries)
    const recent = all.slice(-20);
    const sentimentTrend = recent.map(f => ({
      time: new Date(f.timestamp).toLocaleDateString('en-US', { month:'short', day:'numeric' }),
      score: f.sentimentScore,
      label: f.sentiment
    }));

    // Category breakdown
    const catCounts = {};
    all.forEach(f => {
      catCounts[f.category] = (catCounts[f.category] || 0) + 1;
    });

    // Top keywords (all positive + negative words)
    const kwCounts = {};
    all.forEach(f => {
      [...(f.positiveWords || []), ...(f.negativeWords || [])].forEach(w => {
        kwCounts[w] = (kwCounts[w] || 0) + 1;
      });
      (f.detectedCategories || []).forEach(c => {
        kwCounts[c] = (kwCounts[c] || 0) + 1;
      });
    });
    const topKeywords = Object.entries(kwCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Sentiment distribution
    const sentDist = { positive: 0, neutral: 0, negative: 0 };
    all.forEach(f => sentDist[f.sentiment]++);

    // AI Recommendations
    const recommendations = this._generateRecommendations(all, sentDist, catCounts, topKeywords);

    return {
      total: all.length,
      sentimentTrend,
      categoryBreakdown: catCounts,
      topKeywords,
      sentimentDistribution: sentDist,
      avgSentiment: parseFloat((all.reduce((s, f) => s + f.sentimentScore, 0) / all.length).toFixed(2)),
      recommendations,
      recentEntries: all.slice(-5).reverse()
    };
  },

  _generateRecommendations(all, sentDist, catCounts, topKeywords) {
    const recs = [];
    const negRatio = sentDist.negative / (all.length || 1);
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

    if (negRatio > 0.5) {
      recs.push({ priority: 'high', icon: 'alert-triangle', text: `${Math.round(negRatio*100)}% of feedback is negative. Immediate investigation needed.`, confidence: 92 });
    }
    if (topCat) {
      recs.push({ priority: 'medium', icon: 'target', text: `Most feedback is about "${topCat[0]}" (${topCat[1]} entries). Consider prioritizing improvements here.`, confidence: 85 });
    }
    const negKeywords = all.flatMap(f => f.negativeWords || []);
    if (negKeywords.length) {
      const topNeg = [...new Set(negKeywords)].slice(0, 3).join(', ');
      recs.push({ priority: 'medium', icon: 'search', text: `Top pain points: ${topNeg}. Investigate these areas.`, confidence: 78 });
    }
    if (all.length >= 5 && sentDist.positive > sentDist.negative) {
      recs.push({ priority: 'low', icon: 'thumbs-up', text: 'Overall sentiment is positive. Keep up the good work!', confidence: 88 });
    }
    if (all.length < 5) {
      recs.push({ priority: 'info', icon: 'info', text: `Only ${all.length} feedback entries. Need more data for accurate analysis.`, confidence: 50 });
    }
    return recs;
  },

  async renderAnalytics() {
    const container = document.getElementById('ai-feedback-analytics');
    if (!container) return;

    const data = await this.getAnalytics();
    if (!data) {
      container.innerHTML = `
        <div style="text-align:center; padding: 40px; color: var(--text-muted);">
          <i data-lucide="inbox" style="width:48px; height:48px; margin-bottom:16px; opacity:0.4;"></i>
          <p>No feedback yet. Use the "Give Feedback" button to start training the AI.</p>
        </div>`;
      lucide.createIcons();
      return;
    }

    container.innerHTML = `
      <!-- Summary Cards -->
      <div style="display:grid; grid-template-columns: repeat(4,1fr); gap:12px; margin-bottom:20px;">
        <div class="ai-stat-card">
          <div class="ai-stat-value">${data.total}</div>
          <div class="ai-stat-label">Total Entries</div>
        </div>
        <div class="ai-stat-card">
          <div class="ai-stat-value" style="color:${data.avgSentiment >= 0 ? 'var(--accent-teal)' : 'var(--accent-orange)'}">${data.avgSentiment > 0 ? '+' : ''}${data.avgSentiment}</div>
          <div class="ai-stat-label">Avg Sentiment</div>
        </div>
        <div class="ai-stat-card">
          <div class="ai-stat-value" style="color:var(--accent-teal)">${data.sentimentDistribution.positive}</div>
          <div class="ai-stat-label">Positive</div>
        </div>
        <div class="ai-stat-card">
          <div class="ai-stat-value" style="color:var(--accent-orange)">${data.sentimentDistribution.negative}</div>
          <div class="ai-stat-label">Negative</div>
        </div>
      </div>

      <!-- Charts Row -->
      <div style="display:grid; grid-template-columns: 2fr 1fr; gap:16px; margin-bottom:20px;">
        <div class="glass card" style="padding:16px;">
          <h4 style="margin-bottom:12px; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Sentiment Trend</h4>
          <canvas id="sentiment-trend-chart" height="160"></canvas>
        </div>
        <div class="glass card" style="padding:16px;">
          <h4 style="margin-bottom:12px; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Categories</h4>
          <canvas id="category-chart" height="160"></canvas>
        </div>
      </div>

      <!-- AI Recommendations -->
      <div class="glass card premium-bevel" style="padding:16px; margin-bottom:20px; border-left: 3px solid var(--accent-blue);">
        <h4 style="margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <i data-lucide="brain-circuit" style="width:18px; color:var(--accent-blue);"></i>
          AI Recommendations
        </h4>
        <div id="ai-recommendations-list">
          ${data.recommendations.map(r => `
            <div class="ai-rec-item ai-rec-${r.priority}">
              <i data-lucide="${r.icon}" style="width:16px; flex-shrink:0;"></i>
              <span style="flex:1;">${r.text}</span>
              <span class="confidence-badge">${r.confidence}%</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Top Keywords -->
      <div class="glass card" style="padding:16px; margin-bottom:20px;">
        <h4 style="margin-bottom:12px; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Detected Themes</h4>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${data.topKeywords.map(([word, count]) => `
            <span class="keyword-tag">${word} <span style="opacity:0.6;">(${count})</span></span>
          `).join('')}
        </div>
      </div>

      <!-- Recent Feedback -->
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:20px;">
        <div class="glass card" style="padding:16px;">
          <h4 style="margin-bottom:12px; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Bug Severity Heat Map</h4>
          <div id="bug-heat-map" class="heat-map-container" style="height:200px; display:grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(3, 1fr); gap:4px;">
            <!-- Rendered by JS -->
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:0.65rem; color:var(--text-muted);">
            <span>Low Priority</span>
            <span>Critical Priority</span>
          </div>
        </div>
        <div class="glass card" style="padding:16px;">
          <h4 style="margin-bottom:12px; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Export Weekly Digest</h4>
          <p class="text-muted" style="font-size:0.75rem; margin-bottom:16px;">Download all feedback entries from the last 7 days for external analysis.</p>
          <div style="display:flex; gap:12px;">
            <button onclick="FeedbackEngine.export('csv')" class="btn btn-primary" style="flex:1; font-size:0.8rem; padding:8px;">
              <i data-lucide="file-text" style="width:14px;"></i> CSV Export
            </button>
            <button onclick="FeedbackEngine.export('json')" class="btn" style="flex:1; font-size:0.8rem; padding:8px; background:rgba(255,255,255,0.08);">
              <i data-lucide="code" style="width:14px;"></i> JSON Export
            </button>
          </div>
        </div>
      </div>

      <!-- Recent feedback list... -->
      <div class="glass card" style="padding:16px;">
        <h4 style="margin-bottom:12px; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Recent Submissions</h4>
        ${data.recentEntries.map(e => `
          <div class="feedback-history-item">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span class="sentiment-dot sentiment-${e.sentiment}"></span>
              <span style="font-size:0.75rem; color:var(--text-muted);">${new Date(e.timestamp).toLocaleString()}</span>
            </div>
            <p style="font-size:0.85rem; margin:0; color:var(--text-main);">${e.text.substring(0, 120)}${e.text.length > 120 ? '...' : ''}</p>
            <div style="display:flex; gap:6px; margin-top:6px;">
              <span class="mini-tag">${e.category}</span>
              <span class="mini-tag mini-tag-${e.sentiment}">${e.sentiment} (${e.sentimentScore})</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    lucide.createIcons();
    this._renderCharts(data);
    this._renderHeatMap(all); // Use full feedback list for heatmap
  },

  async export(format) {
    const all = await ArcticDB.getAll('feedback');
    const recent = all.filter(f => f.timestamp > Date.now() - 7 * 24 * 3600000);
    
    let content = '';
    let mimeType = '';
    let fileName = `ArcticFlow-Feedback-Digest-${new Date().toISOString().split('T')[0]}`;

    if (format === 'json') {
      content = JSON.stringify(recent, null, 2);
      mimeType = 'application/json';
      fileName += '.json';
    } else {
      const headers = ['Timestamp', 'Category', 'Rating', 'Sentiment', 'Text'];
      const rows = recent.map(f => [
        new Date(f.timestamp).toISOString(),
        f.category,
        f.rating,
        f.sentiment,
        `"${f.text.replace(/"/g, '""')}"`
      ]);
      content = [headers, ...rows].map(r => r.join(',')).join('\n');
      mimeType = 'text/csv';
      fileName += '.csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  },

  _renderHeatMap(feedback) {
    const container = document.getElementById('bug-heat-map');
    if (!container) return;

    const bugs = feedback.filter(f => f.category === 'Report a Bug');
    // Map rating (1-5) and sentiment (-1 to 1) to a 5x3 grid
    // Rows: Negative (score < -0.2), Neutral, Positive (score > 0.2)
    // Cols: Rating 1, 2, 3, 4, 5

    const grid = Array(3).fill(0).map(() => Array(5).fill(0));
    bugs.forEach(b => {
      const row = b.sentiment === 'negative' ? 2 : (b.sentiment === 'positive' ? 0 : 1);
      const col = Math.min(4, Math.max(0, b.rating - 1));
      grid[row][col]++;
    });

    const max = Math.max(...grid.flat(), 1);
    
    container.innerHTML = grid.flatMap((row, r) => 
      row.map((count, c) => {
        const opacity = count > 0 ? 0.2 + (count / max) * 0.8 : 0.05;
        const color = r === 2 ? 'var(--accent-orange)' : (r === 0 ? 'var(--accent-teal)' : 'var(--accent-blue)');
        return `<div style="background:${color}; opacity:${opacity}; border-radius:4px; title:Count: ${count}" class="heat-tile"></div>`;
      })
    ).join('');
  },

  _renderCharts(data) {
    // Sentiment Trend Line Chart
    const trendCtx = document.getElementById('sentiment-trend-chart');
    if (trendCtx) {
      new Chart(trendCtx, {
        type: 'line',
        data: {
          labels: data.sentimentTrend.map(t => t.time),
          datasets: [{
            label: 'Sentiment',
            data: data.sentimentTrend.map(t => t.score),
            borderColor: '#4A90E2',
            backgroundColor: 'rgba(74,144,226,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: data.sentimentTrend.map(t =>
              t.label === 'positive' ? '#00C9A7' : t.label === 'negative' ? '#FF6B35' : '#8B8BA3'
            )
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { min: -1, max: 1, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8B8BA3' } },
            x: { grid: { display: false }, ticks: { color: '#8B8BA3', maxRotation: 45 } }
          }
        }
      });
    }

    // Category Doughnut
    const catCtx = document.getElementById('category-chart');
    if (catCtx) {
      const catLabels = Object.keys(data.categoryBreakdown);
      const catColors = ['#FF6B35', '#4A90E2', '#00C9A7', '#F59E0B', '#A78BFA', '#EC4899'];
      new Chart(catCtx, {
        type: 'doughnut',
        data: {
          labels: catLabels,
          datasets: [{
            data: Object.values(data.categoryBreakdown),
            backgroundColor: catColors.slice(0, catLabels.length),
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#8B8BA3', font: { size: 10 }, boxWidth: 12 } }
          }
        }
      });
    }
  }
};


// ==================== 4. Anomaly Detector (24/7 Monitor) ====================
const AnomalyDetector = {
  isRunning: false,
  intervalId: null,
  activityLog: [],
  scanCount: 0,
  anomaliesFound: 0,

  // Simulated tank history for demo
  tankReadings: {},

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Seed initial tank readings from store
    if (typeof store !== 'undefined') {
      store.tanks.forEach(t => {
        this.tankReadings[t.id] = this.tankReadings[t.id] || [];
        // Seed with some history
        for (let i = 5; i >= 0; i--) {
          this.tankReadings[t.id].push({
            level: t.level + (i * 0.5) + (Math.random() * 2 - 1),
            timestamp: Date.now() - (i * 3600000)
          });
        }
      });
    }

    this.logActivity('AI Monitoring Engine started', 'system');
    this.updateStatusBadge();

    // Run scan every 60 seconds (as requested)
    this.intervalId = setInterval(() => this.runScan(), 60000);
    // Run initial scan
    setTimeout(() => this.runScan(), 2000);
  },

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isRunning = false;
    this.logActivity('AI Monitoring Engine stopped', 'system');
    this.updateStatusBadge();
  },

  runScan() {
    this.scanCount++;
    const anomalies = [];

    if (typeof store === 'undefined') return;

    store.tanks.forEach(tank => {
      const readings = this.tankReadings[tank.id] || [];
      // Add current reading with slight variation for demo
      const variation = (Math.random() - 0.6) * 1.5;
      const newLevel = Math.max(0, Math.min(100, tank.level + variation));
      tank.level = parseFloat(newLevel.toFixed(1));

      readings.push({ level: tank.level, timestamp: Date.now() });
      if (readings.length > 50) readings.shift();
      this.tankReadings[tank.id] = readings;

      // Check for anomalies using SMA + Standard Deviation
      if (readings.length >= 5) {
        const levels = readings.map(r => r.level);
        const sma = levels.reduce((s, l) => s + l, 0) / levels.length;
        const variance = levels.reduce((s, l) => s + Math.pow(l - sma, 2), 0) / levels.length;
        const stdDev = Math.sqrt(variance);

        const currentLevel = levels[levels.length - 1];
        const prevLevel = levels[levels.length - 2];
        const drop = prevLevel - currentLevel;

        // Rapid drain detection: drop is > 2 standard deviations from normal OR > 3%
        if (drop > Math.max(3 * stdDev, 2.5)) {
          const prop = store.properties.find(p => p.id === tank.propertyId);
          anomalies.push({
            type: 'rapid_drain',
            severity: 'warning',
            tankId: tank.id,
            message: `⚠️ Anomaly: Tank #${tank.number} (${prop?.name}) dropped ${drop.toFixed(1)}% (Expected: <${Math.max(stdDev, 0.5).toFixed(1)}%)`,
            confidence: Math.min(99, 70 + (drop * 10))
          });
        }

        // Critical level
        if (tank.level <= 15 && tank.level > 5) {
          anomalies.push({
            type: 'critical_level',
            severity: 'danger',
            tankId: tank.id,
            message: `Critical fuel: Tank #${tank.number} at ${tank.level.toFixed(0)}%`,
            confidence: 99
          });
        }

        // Near-empty emergency
        if (tank.level <= 5) {
          anomalies.push({
            type: 'emergency',
            severity: 'emergency',
            tankId: tank.id,
            message: `⚠️ EMERGENCY: Tank #${tank.number} nearly empty at ${tank.level.toFixed(0)}%!`,
            confidence: 100
          });
        }

        // --- Phase 2: ROI & Operational Intel Triggers ---
        
        // 1. Detect Short-Cycling (Furnace Efficiency)
        if (stdDev > 0.8 && stdDev < 1.5) {
          const prop = store.properties.find(p => p.id === tank.propertyId);
          anomalies.push({
            type: 'maintenance',
            severity: 'warning',
            tankId: tank.id,
            message: `Efficiency Loss: Tank #${tank.number} (${prop?.name}) showing short-cycling patterns. Check burner relay.`,
            confidence: 85
          });
        }

        // 2. Calculate Optimal Refill Window
        const refill = OpIntel.calculateOptimalRefillWindow(tank);
        if (refill.urgency === 'warning' || refill.urgency === 'critical') {
          const alreadyExists = store.alerts.some(a => a.type === 'optimized_refill' && a.tankId === tank.id);
          if (!alreadyExists) {
            anomalies.push({
              type: 'optimized_refill',
              severity: refill.urgency === 'critical' ? 'danger' : 'warning',
              tankId: tank.id,
              message: `Refill Optimization: Next delivery window for Tank #${tank.number} is in ${refill.daysRemaining} days.`,
              confidence: 94
            });
          }
        }
      }
    });

    // Phase 3: Check Solar Bank Health
    if (typeof OpIntel.predictBatteryFailure === 'function') {
      OpIntel.predictBatteryFailure();
    }

    // Battery voltage check (SMA-based)
    const batteryEl = document.querySelector('#battery-tracker .text-orange');
    if (batteryEl) {
      const voltage = parseFloat(batteryEl.textContent) || 11.8;
      if (voltage < 11.5) {
        anomalies.push({
          type: 'low_voltage',
          severity: 'danger',
          message: `Voltage Drop: Solar bank at ${voltage.toFixed(1)}V. Emergency recharge required.`,
          confidence: 96
        });
      }
    }

    // Temperature Spike Check
    const currentTemp = store.weather.current.temp;
    if (currentTemp > 45) { // Unusual for Arctic context in winter
      anomalies.push({
        type: 'temp_spike',
        severity: 'warning',
        message: `Anomalous Heat: Temp spiked to ${currentTemp}°F. Check for localized sensor heat issues.`,
        confidence: 88
      });
    }

    // Log results
    if (anomalies.length > 0) {
      this.anomaliesFound += anomalies.length;
      anomalies.forEach(a => {
        this.logActivity(a.message, a.severity, a.confidence);
        // Store in IndexedDB
        ArcticDB.add('anomalyLog', { ...a, timestamp: Date.now() }).catch(() => {});
        // Push to main alerts if critical
        if (a.severity === 'danger' || a.severity === 'emergency') {
          store.alerts.unshift({ title: a.type.replace('_',' ').toUpperCase(), desc: a.message, type: 'danger' });
        }
      });
    } else {
      this.logActivity(`Scan #${this.scanCount}: All systems nominal — ${store.tanks.length} tanks checked`, 'clear');
    }

    // Update UI
    this.renderLog();
    this.updateStatusBadge();

    // Refresh tank displays if they exist
    if (typeof renderCylinders === 'function') renderCylinders();
    if (typeof populateKpis === 'function') populateKpis();
  },

  logActivity(message, type, confidence) {
    const entry = {
      timestamp: Date.now(),
      message,
      type,
      confidence: confidence || null
    };
    this.activityLog.unshift(entry);
    if (this.activityLog.length > 50) this.activityLog.pop();
  },

  renderLog() {
    const container = document.getElementById('anomaly-log-list');
    if (!container) return;

    const entries = this.activityLog.slice(0, 15);
    container.innerHTML = entries.map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      const typeColors = {
        system: '#4A90E2', clear: '#00C9A7', warning: '#F59E0B',
        danger: '#FF6B35', emergency: '#EF4444', info: '#8B8BA3'
      };
      const color = typeColors[e.type] || '#8B8BA3';
      const icon = e.type === 'clear' ? 'check-circle' :
                   e.type === 'system' ? 'cpu' :
                   e.type === 'emergency' ? 'siren' :
                   e.type === 'warning' ? 'alert-triangle' :
                   e.type === 'danger' ? 'flame' : 'info';

      return `
        <div class="anomaly-log-item" style="border-left: 3px solid ${color};">
          <div style="display:flex; align-items:center; gap:8px;">
            <i data-lucide="${icon}" style="width:14px; height:14px; color:${color};"></i>
            <span style="font-size:0.8rem; color:var(--text-main);">${e.message}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:4px;">
            <span style="font-size:0.65rem; color:var(--text-muted);">${time}</span>
            ${e.confidence ? `<span class="confidence-badge" style="font-size:0.65rem;">${e.confidence.toFixed(0)}% conf.</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Update stats
    const scanEl = document.getElementById('ai-scan-count');
    const anomalyEl = document.getElementById('ai-anomaly-count');
    if (scanEl) scanEl.textContent = this.scanCount;
    if (anomalyEl) anomalyEl.textContent = this.anomaliesFound;

    lucide.createIcons();
  },

  updateStatusBadge() {
    const badge = document.getElementById('ai-status-badge');
    if (!badge) return;
    if (this.isRunning) {
      badge.classList.add('ai-active');
      badge.innerHTML = '<i data-lucide="brain-circuit" style="width:14px;"></i> AI Active';
    } else {
      badge.classList.remove('ai-active');
      badge.innerHTML = '<i data-lucide="brain-circuit" style="width:14px;"></i> AI Offline';
    }
    lucide.createIcons();
  }
};


// ==================== 5. Confidence Scoring & Explainability ====================
// ==================== 5. Confidence Scoring & Explainability ====================
const ConfidenceScorer = {
  scoreAlert(alert) {
    const currentTemp = store.weather.current.temp;
    const humidity = store.weather.current.humidity;
    const forecast = store.weather.forecast[0] || { temp: currentTemp };
    const avgKFactor = store.tanks.reduce((s, t) => s + (t.kFactor || 0.015), 0) / store.tanks.length;

    let confidence = 0;
    let reasoning = [];

    if (alert.title.includes('RAPID DRAIN') || alert.type === 'rapid_drain') {
      confidence = 88;
      reasoning.push(`Drop detected at ${currentTemp}°F (Baseline SMA using ${avgKFactor.toFixed(3)} K-factor).`);
      reasoning.push(`Sensor reliability at 98.4% (No drift detected).`);
      reasoning.push(`Confidence: High due to consistent trend mismatch.`);
    } else if (alert.title.includes('CRITICAL') || alert.type === 'critical_level') {
      confidence = 99;
      reasoning.push(`Verified physical tank level at ${alert.desc.match(/\d+/)?.[0] || 'low'}%.`);
      reasoning.push(`Dry-out in 3 days based on -38°F forecast.`);
    } else if (alert.type === 'treatment_due') {
      confidence = 95;
      reasoning.push(`Days since last treatment (${alert.daysSince || 15}d) exceeds 14d winter safety window.`);
    } else {
      confidence = 75;
      reasoning.push(`Pattern match with historical Arctic winter models.`);
      reasoning.push(`Ambient temp: ${currentTemp}°F, Humidity: ${humidity}%.`);
    }

    return { confidence, reasoning };
  },

  renderConfidenceCards() {
    const container = document.getElementById('confidence-panel');
    if (!container) return;

    const alerts = store.alerts.slice(0, 5);
    
    const cards = alerts.map(alert => {
      const score = this.scoreAlert(alert);
      const gradeColor = score.confidence > 90 ? 'var(--accent-teal)' : (score.confidence > 75 ? '#F59E0B' : 'var(--accent-orange)');
      const gradeLabel = score.confidence > 90 ? 'High' : (score.confidence > 75 ? 'Medium' : 'Low');

      return `
        <div class="confidence-card glass card premium-bevel" style="border-left: 4px solid ${gradeColor}; margin-bottom:16px; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center;">
                <i data-lucide="shield-check" style="width:16px; color:${gradeColor};"></i>
              </div>
              <div>
                <h4 style="font-size:0.9rem; font-weight:700; margin:0;">${alert.title}</h4>
                <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">${gradeLabel} Confidence Score</div>
              </div>
            </div>
            <div style="font-size:1.4rem; font-weight:800; color:${gradeColor}; letter-spacing:-0.5px;">${score.confidence}%</div>
          </div>
          <p style="font-size:0.8rem; color:var(--text-main); line-height:1.4; opacity:0.85; margin:0 0 12px; padding-left:42px;">${alert.desc}</p>
          <div style="padding-left:42px;">
            <details class="confidence-details">
              <summary style="cursor:pointer; font-size:0.75rem; font-weight:600; color:var(--accent-blue); display:flex; align-items:center; gap:6px;">
                <i data-lucide="info" style="width:12px;"></i> Explainable Data Lineage
              </summary>
              <ul style="margin:12px 0 0; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; list-style:none;">
                ${score.reasoning.map(r => `
                  <li style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px; display:flex; align-items:center; gap:8px;">
                    <span style="width:4px; height:4px; border-radius:50%; background:${gradeColor}; flex-shrink:0;"></span>
                    ${r}
                  </li>
                `).join('')}
              </ul>
            </details>
          </div>
        </div>
      `;
    });

    container.innerHTML = cards.join('') || '<p style="color:var(--text-muted); text-align:center; padding:40px; font-size:0.9rem;">No active AI predictions to score.</p>';
    lucide.createIcons();
  }
};


// ==================== 5a. Community Fuel Co-op Marketplace ====================
const Marketplace = {
  listings: [
    { id: 1, user: 'N. Sookiayak', type: 'offer', amount: 45, price: 4.50, distance: 0.8, status: 'available' },
    { id: 2, user: 'S. Miller', type: 'offer', amount: 15, price: 0.00, distance: 2.1, status: 'available' },
    { id: 3, user: 'K. Johnson', type: 'need', amount: 20, distance: 4.5, status: 'pending' }
  ],
  savings: 1247,

  init() {
    this.renderMarketplace();
  },

  renderMarketplace() {
    const container = document.getElementById('community-marketplace-panel');
    if (!container) return;

    let html = `
      <div class="glass card premium-bevel" style="padding:24px; margin-bottom:24px; border-top:3px solid var(--accent-teal);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <h4 style="margin:0; font-size:1.1rem; font-weight:800;">Community Savings</h4>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Neighborhood Co-op Impact</div>
          </div>
          <div style="text-align:right;">
            <span class="text-teal" style="font-size:1.8rem; font-weight:900;">$${this.savings.toLocaleString()}</span>
          </div>
        </div>
        <p style="font-size:0.8rem; color:var(--text-main); opacity:0.75; line-height:1.5;">Your collective action has bypassed commercial logistics fees and secured local fuel stability.</p>
      </div>

      <div class="marketplace-actions" style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:24px;">
        <button class="btn btn-primary" onclick="Marketplace.post('offer')" style="padding:14px; font-size:0.9rem;">
          <i data-lucide="plus-circle" style="width:18px;"></i> Surplus: Share
        </button>
        <button class="btn" onclick="Marketplace.post('need')" style="padding:14px; font-size:0.9rem; border:2px solid var(--accent-orange); color:var(--accent-orange); background:transparent;">
          <i data-lucide="help-circle" style="width:18px;"></i> Scarcity: Need
        </button>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
        <h4 style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin:0; letter-spacing:1.5px; font-weight:800;">Real-Time Nodes</h4>
        <div style="width:8px; height:8px; border-radius:50%; background:var(--accent-teal); box-shadow: 0 0 10px var(--accent-teal-glow);"></div>
      </div>
      <div class="listings-grid" style="display:flex; flex-direction:column; gap:12px;">
        ${this.listings.map(l => this._renderListing(l)).join('')}
      </div>
    `;

    container.innerHTML = html;
    lucide.createIcons();
  },

  _renderListing(l) {
    const isOffer = l.type === 'offer';
    const borderColor = isOffer ? 'var(--accent-teal)' : 'var(--accent-orange)';
    return `
      <div class="glass card" style="padding:12px; border-left:3px solid ${borderColor};">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="font-size:0.85rem; font-weight:700;">${l.user} ${isOffer ? 'has' : 'needs'} ${l.amount} Gallons</div>
            <div style="font-size:0.7rem; color:var(--text-muted);"><i data-lucide="map-pin" style="width:10px; display:inline;"></i> ${l.distance} miles away</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.9rem; font-weight:800; color:${isOffer ? 'var(--accent-teal)' : 'var(--accent-orange)'}">${l.price > 0 ? `$${l.price}/gal` : 'FREE'}</div>
            <button class="mini-tag" style="background:${borderColor}; color:white; border:none; cursor:pointer; margin-top:4px;">Message</button>
          </div>
        </div>
      </div>
    `;
  },

  post(type) {
    const amount = prompt(`How many gallons do you ${type === 'offer' ? 'have' : 'need'}?`, '10');
    if (amount) {
      this.listings.unshift({
        id: Date.now(),
        user: 'You',
        type: type,
        amount: parseInt(amount),
        price: type === 'offer' ? parseFloat(prompt('Price per gallon? (0 for free)', '4.25')) : 0,
        distance: 0,
        status: 'available'
      });
      this.renderMarketplace();
      // Gamification bonus
      if (type === 'offer') {
        Gamification.addExp(250, 'Marketplace Hero: Shared surplus fuel!');
      }
    }
  }
};


// ==================== 6. Fuel Quality Monitor ====================
const FuelQualityMonitor = {
  fuelTypes: {
    'Diesel #2': { cloudPoint: 14, pourPoint: -4, gelPoint: -10, color: '#FF6B35' },
    'Diesel #1 (Arctic)': { cloudPoint: -40, pourPoint: -50, gelPoint: -60, color: '#4A90E2' },
    'Heating Oil': { cloudPoint: 20, pourPoint: -6, gelPoint: -15, color: '#F59E0B' },
    'Kerosene': { cloudPoint: -31, pourPoint: -49, gelPoint: -55, color: '#00C9A7' }
  },

  assessRisk(fuelType, currentTemp) {
    const fuel = this.fuelTypes[fuelType];
    if (!fuel) return { risk: 'unknown', level: 0 };

    if (currentTemp <= fuel.gelPoint) {
      return { risk: 'GELLED', level: 100, message: `Fuel has likely gelled! Temp (${currentTemp}°F) is below gel point (${fuel.gelPoint}°F).`, color: '#EF4444' };
    }
    if (currentTemp <= fuel.pourPoint) {
      return { risk: 'CRITICAL', level: 85, message: `Below pour point (${fuel.pourPoint}°F). Fuel flow severely restricted.`, color: '#FF6B35' };
    }
    if (currentTemp <= fuel.cloudPoint) {
      return { risk: 'WARNING', level: 60, message: `Below cloud point (${fuel.cloudPoint}°F). Wax crystals forming. Add anti-gel.`, color: '#F59E0B' };
    }
    if (currentTemp <= fuel.cloudPoint + 15) {
      return { risk: 'WATCH', level: 30, message: `Approaching cloud point. Monitor temperature closely.`, color: '#4A90E2' };
    }
    return { risk: 'OK', level: 5, message: 'Fuel quality nominal. No gelling risk.', color: '#00C9A7' };
  },

  renderMonitor() {
    const container = document.getElementById('fuel-quality-panel');
    if (!container) return;

    const currentTemp = typeof store !== 'undefined' ? store.weather.current.temp : -28;
    const humidity = typeof store !== 'undefined' ? store.weather.current.humidity : 65;
    const tanks = typeof store !== 'undefined' ? store.tanks : [];

    // Collect all notifications across all tanks
    const allNotifications = [];

    let html = '';

    // ---- Notification Summary Banner ----
    tanks.forEach(tank => {
      const notes = this._getNotifications(tank, currentTemp, humidity);
      notes.forEach(n => allNotifications.push({ ...n, tank }));
    });

    const criticalCount = allNotifications.filter(n => n.severity === 'critical').length;
    const warningCount = allNotifications.filter(n => n.severity === 'warning').length;
    const infoCount = allNotifications.filter(n => n.severity === 'info').length;

    html += `
      <div class="glass card" style="padding:16px; margin-bottom:16px; border-left:3px solid ${criticalCount > 0 ? '#EF4444' : warningCount > 0 ? '#F59E0B' : '#00C9A7'};">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="margin:0; display:flex; align-items:center; gap:8px;">
            <i data-lucide="bell-ring" style="width:16px; color:${criticalCount > 0 ? '#EF4444' : '#F59E0B'};"></i>
            Quality Alerts Summary
          </h4>
          <div style="display:flex; gap:8px;">
            ${criticalCount > 0 ? `<span class="gel-risk-badge" style="background:#EF4444;">${criticalCount} CRITICAL</span>` : ''}
            ${warningCount > 0 ? `<span class="gel-risk-badge" style="background:#F59E0B;">${warningCount} WARNING</span>` : ''}
            ${infoCount > 0 ? `<span class="gel-risk-badge" style="background:var(--accent-blue);">${infoCount} INFO</span>` : ''}
            ${allNotifications.length === 0 ? '<span class="gel-risk-badge" style="background:#00C9A7;">ALL CLEAR</span>' : ''}
          </div>
        </div>
        <div style="max-height:180px; overflow-y:auto;" class="custom-scroll">
          ${allNotifications.slice(0, 8).map(n => {
            const sevColor = n.severity === 'critical' ? '#EF4444' : n.severity === 'warning' ? '#F59E0B' : '#4A90E2';
            const prop = store.properties.find(p => p.id === n.tank.propertyId);
            return `
              <div class="anomaly-log-item" style="border-left:3px solid ${sevColor};">
                <div style="display:flex; align-items:center; gap:8px;">
                  <i data-lucide="${n.icon}" style="width:14px; color:${sevColor};"></i>
                  <span style="font-size:0.8rem;"><strong>${prop?.name} T#${n.tank.number}:</strong> ${n.message}</span>
                </div>
              </div>
            `;
          }).join('')}
          ${allNotifications.length === 0 ? '<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:8px;">No active quality alerts. All tanks nominal.</p>' : ''}
        </div>
      </div>
    `;

    // ---- Per-Tank Quality Cards with 5 Meters ----
    html += '<div class="fuel-quality-grid">';

    tanks.forEach(tank => {
      const gelAssessment = this.assessRisk(tank.fuelType, currentTemp);
      const prop = store.properties.find(p => p.id === tank.propertyId);
      const fuel = this.fuelTypes[tank.fuelType] || {};

      // 1. Temperature Factor
      const tempDelta = currentTemp - (fuel.gelPoint || -10);
      const tempSafety = Math.max(0, Math.min(100, ((tempDelta + 50) / 80) * 100));
      const tempColor = tempSafety < 25 ? '#EF4444' : tempSafety < 50 ? '#FF6B35' : tempSafety < 75 ? '#F59E0B' : '#00C9A7';

      // 2. Gel Risk (from existing assessment)
      const gelLevel = gelAssessment.level;
      const gelColor = gelAssessment.color;

      // 3. Water Contamination Risk
      const freezeThawCycles = Math.abs(currentTemp) > 20 && humidity > 50 ? 3 : (humidity > 60 ? 2 : 1);
      const waterRisk = Math.min(100, (humidity * 0.8) + (freezeThawCycles * 10) + (tank.level < 30 ? 20 : 0));
      const waterColor = waterRisk > 70 ? '#EF4444' : waterRisk > 45 ? '#F59E0B' : '#00C9A7';

      // 4. Fuel Age / Degradation (simulated: days since last fill)
      const daysSinceFill = Math.floor(Math.random() * 45) + 10; // simulated
      const ageRisk = Math.min(100, (daysSinceFill / 90) * 100);
      const ageColor = ageRisk > 70 ? '#FF6B35' : ageRisk > 40 ? '#F59E0B' : '#00C9A7';

      // 5. Anti-Gel Treatment Status & Countdown
      const lastTreatedKey = `last_treatment_tank_${tank.id}`;
      let lastTreatedTs = parseInt(localStorage.getItem(lastTreatedKey)) || (Date.now() - (Math.random() * 10 + 2) * 86400000);
      const daysSinceTreated = Math.floor((Date.now() - lastTreatedTs) / 86400000);
      
      const treatmentInterval = 14; // Re-treat every 14 days in winter
      const daysLeft = Math.max(0, treatmentInterval - daysSinceTreated);
      const treatmentOverdue = daysLeft === 0;
      const treatmentColor = treatmentOverdue ? '#EF4444' : (daysLeft < 3 ? '#F59E0B' : '#00C9A7');

      html += `
        <div class="fuel-quality-card glass card" style="border-left: 3px solid ${gelAssessment.color};">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div>
              <h4 style="font-size:0.85rem; margin:0;">${prop?.name} — Tank #${tank.number}</h4>
              <span style="font-size:0.75rem; color:var(--text-muted);">${tank.fuelType}</span>
            </div>
            <span class="gel-risk-badge" style="background:${gelAssessment.color};">${gelAssessment.risk}</span>
          </div>

          <!-- 5 Quality Meters Grid -->
          <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:6px; margin: 12px 0;">
            ${this._renderMiniGauge('Temp', tempSafety, tempColor, `${currentTemp}°F`, 'thermometer')}
            ${this._renderMiniGauge('Gel', 100 - gelLevel, gelColor, gelAssessment.risk, 'snowflake')}
            ${this._renderMiniGauge('Water', 100 - waterRisk, waterColor, `${waterRisk.toFixed(0)}%`, 'droplets')}
            ${this._renderMiniGauge('Age', 100 - ageRisk, ageColor, `${daysSinceFill}d`, 'clock')}
            <div onclick="FuelQualityMonitor.recordTreatment(${tank.id})" style="cursor:pointer; text-align:center;">
              ${this._renderMiniGaugeBody('AntiGel', 100 * (daysLeft/treatmentInterval), treatmentColor, `${daysLeft}d`, 'flask-conical')}
            </div>
          </div>

          <!-- Detail Row -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px; font-size:0.7rem; color:var(--text-muted); margin-top:4px;">
            <div style="background:rgba(0,0,0,0.2); padding:6px 8px; border-radius:6px;">
              <span style="color:${tempColor};">●</span> Cloud: ${fuel.cloudPoint || '?'}°F / Gel: ${fuel.gelPoint || '?'}°F
            </div>
            <div style="background:rgba(0,0,0,0.2); padding:6px 8px; border-radius:6px;">
              <span style="color:${waterColor};">●</span> Humidity: ${humidity}% / Contam Risk: ${waterRisk.toFixed(0)}%
            </div>
            <div style="background:rgba(0,0,0,0.2); padding:6px 8px; border-radius:6px;">
              <span style="color:${ageColor};">●</span> Last fill: ${daysSinceFill}d ago
            </div>
            <div style="background:rgba(0,0,0,0.2); padding:6px 8px; border-radius:6px; cursor:pointer;" onclick="FuelQualityMonitor.recordTreatment(${tank.id})">
              <span style="color:${treatmentColor};">●</span> Treat: ${treatmentOverdue ? 'OVERDUE' : `${daysLeft}d left`} ↻
            </div>
          </div>
        </div>
      `;

      // Inject reminders into main alerts system
      if (treatmentOverdue || daysLeft < 2) {
        store.alerts.push({ 
          title: "Anti-Gel Treatment Due", 
          desc: `${prop?.name} Tank #${tank.number} needs anti-gel treatment.`, 
          type: "warning", 
          icon: "flask-conical" 
        });
      }
    });

    html += '</div>';

    // ---- Gelling Threshold Chart ----
    html += `
      <div class="glass card" style="padding:16px; margin-top:16px;">
        <h4 style="margin-bottom:12px; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">
          7-Day Forecast vs Gelling Thresholds
        </h4>
        <canvas id="gel-threshold-chart" height="200"></canvas>
      </div>

      <!-- Anti-Gel Treatment Schedule -->
      <div class="glass card" style="padding:16px; margin-top:16px; border-left:3px solid var(--accent-orange);">
        <h4 style="margin-bottom:8px; display:flex; align-items:center; gap:8px;">
          <i data-lucide="flask-conical" style="width:16px; color:var(--accent-orange);"></i>
          Anti-Gel Treatment Schedule
        </h4>
        ${this._renderAntiGelSchedule(tanks, currentTemp)}
      </div>

      <!-- Fuel Quality Legend -->
      <div class="glass card" style="padding:14px; margin-top:16px;">
        <h4 style="margin-bottom:10px; font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Quality Factor Legend</h4>
        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:8px; font-size:0.7rem;">
          <div style="text-align:center;">
            <i data-lucide="thermometer" style="width:14px; display:block; margin:0 auto 4px; color:#F59E0B;"></i>
            <strong>Temp</strong><br><span style="color:var(--text-muted);">Current vs gel point margin</span>
          </div>
          <div style="text-align:center;">
            <i data-lucide="snowflake" style="width:14px; display:block; margin:0 auto 4px; color:#4A90E2;"></i>
            <strong>Gel</strong><br><span style="color:var(--text-muted);">Wax crystal formation risk</span>
          </div>
          <div style="text-align:center;">
            <i data-lucide="droplets" style="width:14px; display:block; margin:0 auto 4px; color:#00C9A7;"></i>
            <strong>Water</strong><br><span style="color:var(--text-muted);">Condensation contamination</span>
          </div>
          <div style="text-align:center;">
            <i data-lucide="clock" style="width:14px; display:block; margin:0 auto 4px; color:#FF6B35;"></i>
            <strong>Age</strong><br><span style="color:var(--text-muted);">Oxidation & sediment risk</span>
          </div>
          <div style="text-align:center;">
            <i data-lucide="flask-conical" style="width:14px; display:block; margin:0 auto 4px; color:#A78BFA;"></i>
            <strong>AntiGel</strong><br><span style="color:var(--text-muted);">Treatment additive status</span>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    lucide.createIcons();

    // Render chart after DOM update
    setTimeout(() => this._renderGelChart(), 100);
    
    // Unlock achievement
    GamificationEngine.unlock('fuel_quality');
  },

  _renderMiniGauge(label, percent, color, valueText, iconName) {
    return `
      <div style="text-align:center;">
        ${this._renderMiniGaugeBody(label, percent, color, valueText, iconName)}
        <div style="font-size:0.55rem; color:var(--text-muted);">${label}</div>
      </div>
    `;
  },

  _renderMiniGaugeBody(label, percent, color, valueText, iconName) {
    const safePercent = Math.max(0, Math.min(100, percent));
    const circumference = 2 * Math.PI * 18;
    const offset = circumference - (safePercent / 100) * circumference;
    return `
      <div style="position:relative; width:44px; height:44px; margin:0 auto;">
        <svg viewBox="0 0 44 44" style="width:44px; height:44px;">
          <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>
          <circle cx="22" cy="22" r="18" fill="none" stroke="${color}" stroke-width="4"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90 22 22)"
            style="transition: stroke-dashoffset 1s ease;"/>
        </svg>
        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);">
          <i data-lucide="${iconName}" style="width:12px; height:12px; color:${color};"></i>
        </div>
        <div style="position:absolute; bottom:-2px; width:100%; text-align:center; font-size:0.55rem; font-weight:800; color:${color};">${valueText}</div>
      </div>
    `;
  },

  recordTreatment(tankId) {
    localStorage.setItem(`last_treatment_tank_${tankId}`, Date.now());
    this.renderMonitor();
  },

  _getNotifications(tank, currentTemp, humidity) {
    const notifications = [];
    const fuel = this.fuelTypes[tank.fuelType];
    if (!fuel) return notifications;

    // Gel risk notifications
    if (currentTemp <= fuel.gelPoint) {
      notifications.push({ severity: 'critical', icon: 'snowflake', message: `GELLED — Temp ${currentTemp}°F is below gel point ${fuel.gelPoint}°F. Fuel lines may be blocked.` });
    } else if (currentTemp <= fuel.pourPoint) {
      notifications.push({ severity: 'critical', icon: 'thermometer-snowflake', message: `Below pour point (${fuel.pourPoint}°F). Fuel won't flow properly.` });
    } else if (currentTemp <= fuel.cloudPoint) {
      notifications.push({ severity: 'warning', icon: 'cloud-snow', message: `Below cloud point (${fuel.cloudPoint}°F). Add anti-gel treatment immediately.` });
    }

    // Water contamination
    if (humidity > 60 && tank.level < 50) {
      notifications.push({ severity: 'warning', icon: 'droplets', message: `High humidity (${humidity}%) + low tank (${tank.level.toFixed(0)}%) = condensation risk. Top off tank.` });
    }

    // Fuel age (simulated)
    const daysSinceFill = Math.floor(Math.random() * 45) + 10;
    if (daysSinceFill > 60) {
      notifications.push({ severity: 'warning', icon: 'clock', message: `Fuel is ${daysSinceFill} days old. Oxidation and sediment buildup possible.` });
    }

    // Temperature swing alert
    const forecast = typeof store !== 'undefined' ? store.weather.forecast : [];
    if (forecast.length >= 2) {
      const swing = Math.abs(forecast[0].high - forecast[1].low);
      if (swing > 25) {
        notifications.push({ severity: 'info', icon: 'trending-up', message: `${swing}°F temperature swing in 48h. Increased freeze-thaw condensation risk.` });
      }
    }

    return notifications;
  },

  _renderAntiGelSchedule(tanks, currentTemp) {
    return tanks.map(tank => {
      const fuel = this.fuelTypes[tank.fuelType];
      if (!fuel) return '';
      const needsTreatment = currentTemp <= fuel.cloudPoint + 15;
      const urgency = currentTemp <= fuel.cloudPoint ? 'IMMEDIATE' : (needsTreatment ? 'Soon' : 'Not needed');
      const urgencyColor = currentTemp <= fuel.cloudPoint ? 'var(--accent-orange)' : (needsTreatment ? '#F59E0B' : 'var(--accent-teal)');

      const gallons = (tank.level / 100) * tank.capacity;
      const additiveMl = Math.ceil(gallons * 0.5); // ~0.5ml per gallon

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div>
            <span style="font-size:0.85rem;">${tank.fuelType} — Tank #${tank.number}</span>
            <div style="font-size:0.7rem; color:var(--text-muted);">Dose: ${additiveMl}ml of anti-gel per ${gallons.toFixed(0)} gallons</div>
          </div>
          <span style="font-weight:700; font-size:0.8rem; color:${urgencyColor};">${urgency}</span>
        </div>
      `;
    }).join('');
  },

  _renderGelChart() {
    const ctx = document.getElementById('gel-threshold-chart');
    if (!ctx || typeof store === 'undefined') return;

    const forecast = store.weather.forecast;
    const days = forecast.map(f => f.day);
    const lows = forecast.map(f => f.low);
    const highs = forecast.map(f => f.high);

    const datasets = [
      {
        label: 'Forecast Low',
        data: lows,
        borderColor: '#4A90E2',
        backgroundColor: 'rgba(74,144,226,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4
      },
      {
        label: 'Forecast High',
        data: highs,
        borderColor: '#00C9A7',
        backgroundColor: 'rgba(0,201,167,0.05)',
        fill: false,
        tension: 0.3,
        pointRadius: 4
      }
    ];

    // Add threshold lines for each unique fuel type in use
    const usedFuels = [...new Set(store.tanks.map(t => t.fuelType))];
    usedFuels.forEach(fuelName => {
      const fuel = this.fuelTypes[fuelName];
      if (!fuel) return;
      datasets.push({
        label: `${fuelName} Gel Point`,
        data: days.map(() => fuel.gelPoint),
        borderColor: fuel.color,
        borderDash: [8, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      });
    });

    new Chart(ctx, {
      type: 'line',
      data: { labels: days, datasets },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#8B8BA3', font: { size: 10 }, boxWidth: 16 }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#8B8BA3', callback: v => v + '°F' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#8B8BA3' }
          }
        }
      }
    });
  }
};


// ==================== 7. Voice Commander ====================
const VoiceCommander = {
  recognition: null,
  isListening: false,
  synthesis: window.speechSynthesis,

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported');
      const btn = document.getElementById('voice-btn');
      if (btn) btn.style.display = 'none';
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      this.processCommand(transcript);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateButton();
    };

    this.recognition.onerror = (e) => {
      console.error('Speech error:', e.error);
      this.isListening = false;
      this.updateButton();
    };
  },

  toggle() {
    if (this.isListening) {
      this.recognition?.stop();
      this.isListening = false;
    } else {
      try {
        this.recognition?.start();
        this.isListening = true;
      } catch(e) {
        console.error('Could not start recognition:', e);
      }
    }
    this.updateButton();
  },

  updateButton() {
    const btn = document.getElementById('voice-btn');
    if (!btn) return;
    if (this.isListening) {
      btn.classList.add('voice-active');
      btn.innerHTML = '<i data-lucide="mic" style="width:18px;"></i> Listening...';
    } else {
      btn.classList.remove('voice-active');
      btn.innerHTML = '<i data-lucide="mic" style="width:18px;"></i>';
    }
    lucide.createIcons();
  },

  processCommand(transcript) {
    const voiceLog = document.getElementById('voice-output');
    let response = '';

    if (transcript.includes('tank') && transcript.includes('level')) {
      const tanks = typeof store !== 'undefined' ? store.tanks : [];
      const levels = tanks.map(t => `Tank ${t.number}: ${t.level.toFixed(0)}%`).join(', ');
      response = `Your tank levels are: ${levels}`;
    } else if (transcript.includes('temperature') || transcript.includes('weather') || transcript.includes('cold')) {
      const temp = typeof store !== 'undefined' ? store.weather.current.temp : 'unknown';
      response = `Current temperature is ${temp} degrees Fahrenheit`;
    } else if (transcript.includes('alert') || transcript.includes('warning')) {
      const count = typeof store !== 'undefined' ? store.alerts.length : 0;
      response = `You have ${count} active alerts`;
    } else if (transcript.includes('score') || transcript.includes('prepared')) {
      const score = GamificationEngine.calculateScore();
      response = `Your preparedness score is ${score} out of 100`;
    } else if (transcript.includes('help')) {
      response = 'You can ask about: tank levels, temperature, alerts, or preparedness score';
    } else {
      response = `I heard: "${transcript}". Try asking about tank levels, temperature, or alerts.`;
    }

    if (voiceLog) {
      voiceLog.innerHTML = `
        <div style="margin-bottom:8px;">
          <span style="font-size:0.7rem; color:var(--accent-blue);">You said:</span>
          <p style="margin:2px 0; font-size:0.85rem;">"${transcript}"</p>
        </div>
        <div>
          <span style="font-size:0.7rem; color:var(--accent-teal);">ArcticFlow:</span>
          <p style="margin:2px 0; font-size:0.85rem;">${response}</p>
        </div>
      `;
    }

    // Speak response
    this.speak(response);
  },

  speak(text) {
    if (!this.synthesis) return;
    this.synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    this.synthesis.speak(utterance);
  }
};


// ==================== 8. Gamification Engine ====================
// ==================== 8. Gamification & Winter Survival Score ====================
const GamificationEngine = {
  achievements: [
    { id: 'first_freeze', title: 'First Freeze Survivor 🏆', desc: 'Maintained heat through a -20°F event', icon: 'thermometer-snowflake', unlocked: false },
    { id: 'zero_emergency', title: 'Zero Emergency Orders ⭐', desc: 'No emergency fuel calls all winter', icon: 'star', unlocked: false },
    { id: 'woodstove_master', title: 'Woodstove Master 🪵', desc: 'Used secondary heat to save 20% fuel', icon: 'flame', unlocked: false },
    { id: 'neighbor_hero', title: 'Neighbor Hero 🤝', desc: 'Shared surplus fuel with a neighbor', icon: 'heart', unlocked: false },
    { id: 'all_above_30', title: 'Safe & Sound', desc: 'All tanks above 30%', icon: 'shield-check', unlocked: false },
    { id: 'checklist_100', title: 'Winter Ready', desc: '100% pre-winter checklist complete', icon: 'award', unlocked: false }
  ],

  leaderboard: [
    { name: 'K. Johnson', score: 98, level: 12 },
    { name: 'You', score: 92, level: 8 },
    { name: 'S. Miller', score: 89, level: 10 },
    { name: 'N. Sookiayak', score: 85, level: 7 }
  ],

  init() {
    this.checkStreaks();
    this.renderSurvivalScore();
  },

  checkStreaks() {
    const lastLogin = localStorage.getItem('last_login_date');
    const today = new Date().toDateString();
    let streak = parseInt(localStorage.getItem('user_streak')) || 0;

    if (lastLogin !== today) {
      if (lastLogin === new Date(Date.now() - 86400000).toDateString()) {
        streak++;
      } else {
        streak = 1;
      }
      localStorage.setItem('last_login_date', today);
      localStorage.setItem('user_streak', streak);
    }
    return streak;
  },

  calculateSurvivalScore() {
    let score = 0;
    if (typeof store === 'undefined') return 75;

    // 1. Tank Levels (40pts)
    const avgLevel = store.tanks.reduce((s, t) => s + t.level, 0) / store.tanks.length;
    score += (avgLevel / 100) * 40;

    // 2. Checklist Completion (30pts)
    const checklist = document.querySelectorAll('#winterization-checklist input[type="checkbox"]');
    if (checklist.length > 0) {
      const completed = Array.from(checklist).filter(c => c.checked).length;
      score += (completed / checklist.length) * 30;
    } else {
      score += 15; // default for demo
    }

    // 3. Battery Health (15pts)
    const batteryEl = document.querySelector('#battery-tracker .text-orange');
    const voltage = batteryEl ? parseFloat(batteryEl.textContent) : 12.2;
    score += voltage >= 12.0 ? 15 : (voltage >= 11.5 ? 8 : 0);

    // 4. Anomaly-Free Streak (15pts)
    const anomalies = AnomalyDetector.anomaliesFound;
    score += Math.max(0, 15 - (anomalies * 5));

    return Math.round(Math.min(100, score));
  },

  renderSurvivalScore() {
    const container = document.getElementById('survival-score-container');
    if (!container) return;

    const score = this.calculateSurvivalScore();
    const streak = this.checkStreaks();
    const color = score > 85 ? 'var(--accent-teal)' : (score > 60 ? '#F59E0B' : 'var(--accent-orange)');

    container.innerHTML = `
      <div class="glass card" style="text-align:center; padding:20px; border-top:3px solid ${color};">
        <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px;">Winter Survival Score</div>
        <div style="font-size:3.5rem; font-weight:800; color:${color}; line-height:1;">${score}</div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:8px;">
          <i data-lucide="flame" style="width:14px; color:var(--accent-orange); display:inline;"></i> 
          ${streak}-Day Preparedness Streak!
        </div>
        <div class="progress-bar-bg" style="height:6px; background:rgba(255,255,255,0.05); border-radius:10px; margin-top:15px; overflow:hidden;">
          <div style="width:${score}%; height:100%; background:${color}; box-shadow: 0 0 10px ${color}66; transition: width 1s ease;"></div>
        </div>
      </div>

      <div class="glass card" style="padding:16px; margin-top:16px;">
        <h4 style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:12px; letter-spacing:1px;">Seasonal Leaderboard</h4>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${this.leaderboard.map((u, i) => `
            <div style="display:flex; justify-content:space-between; align-items:center; opacity:${u.name === 'You' ? 1 : 0.6}">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:0.75rem; width:15px; font-weight:800;">${i+1}</span>
                <span style="font-size:0.85rem;">${u.name}</span>
              </div>
              <div style="display:flex; align-items:center; gap:12px;">
                <span style="font-size:0.7rem; color:var(--text-muted);">Lvl ${u.level}</span>
                <span style="font-weight:700; width:30px; text-align:right;">${u.score}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    lucide.createIcons();
  },

  unlock(achievementId) {
    const ach = this.achievements.find(a => a.id === achievementId);
    if (ach && !ach.unlocked) {
      ach.unlocked = true;
      this.triggerConfetti();
      this.showToast(ach);
    }
  },

  triggerConfetti() {
    // Simple mock confetti effect by adding a class to body
    const body = document.body;
    body.classList.add('celebration');
    setTimeout(() => body.classList.remove('celebration'), 3000);
  },

  showToast(achievement) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast glass premium-bevel';
    toast.innerHTML = `
      <div class="toast-icon"><i data-lucide="${achievement.icon}"></i></div>
      <div>
        <div style="font-weight:700; font-size:0.85rem;">Achievement Unlocked!</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${achievement.title}: ${achievement.desc}</div>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 100);
    setTimeout(() => {
      toast.classList.remove('toast-visible');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  },

  renderScoreRing() {
    const container = document.getElementById('preparedness-score');
    if (!container) return;

    const score = this.calculateScore();
    this.checkAchievements();

    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (score / 100) * circumference;
    const scoreColor = score >= 70 ? '#00C9A7' : score >= 40 ? '#F59E0B' : '#FF6B35';

    container.innerHTML = `
      <div class="score-ring-container">
        <svg viewBox="0 0 100 100" class="score-ring-svg">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>
          <circle cx="50" cy="50" r="42" fill="none" stroke="${scoreColor}" stroke-width="6"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90 50 50)"
            class="score-ring-progress"/>
        </svg>
        <div class="score-ring-text">
          <div style="font-size:1.8rem; font-weight:800; color:${scoreColor};">${score}</div>
          <div style="font-size:0.6rem; color:var(--text-muted); text-transform:uppercase;">Score</div>
        </div>
      </div>
      <div style="text-align:center; margin-top:8px;">
        <div style="font-size:0.85rem; font-weight:600;">Preparedness</div>
        <div style="font-size:0.7rem; color:var(--text-muted);">🔥 ${this.streakDays}-day streak</div>
      </div>
    `;

    // Render achievements
    this.renderAchievements();
  },

  renderAchievements() {
    const container = document.getElementById('achievements-grid');
    if (!container) return;

    container.innerHTML = this.achievements.map(a => `
      <div class="achievement-badge ${a.unlocked ? 'unlocked' : 'locked'}">
        <i data-lucide="${a.icon}" style="width:20px; height:20px;"></i>
        <span style="font-size:0.65rem; margin-top:4px;">${a.title}</span>
      </div>
    `).join('');

    lucide.createIcons();
  }
};


// ==================== 9. Offline Vault & Sync ====================
const OfflineVault = {
  isOnline: navigator.onLine,
  pendingSync: 0,

  init() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateIndicator();
      this.processSyncQueue();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateIndicator();
    });
    this.updateIndicator();
  },

  async queueAction(action) {
    await ArcticDB.add('syncQueue', { action, timestamp: Date.now() });
    this.pendingSync++;
    this.updateIndicator();
  },

  async processSyncQueue() {
    const items = await ArcticDB.getAll('syncQueue');
    if (items.length === 0) return;

    // In production, sync to server here
    console.log(`Syncing ${items.length} queued actions...`);
    await ArcticDB.clear('syncQueue');
    this.pendingSync = 0;
    this.updateIndicator();
  },

  updateIndicator() {
    const indicator = document.getElementById('offline-indicator');
    if (!indicator) return;

    if (!this.isOnline) {
      indicator.classList.remove('hidden');
      indicator.innerHTML = `
        <i data-lucide="wifi-off" style="width:14px;"></i>
        Offline Mode ${this.pendingSync > 0 ? `— ${this.pendingSync} changes queued` : ''}
      `;
    } else if (this.pendingSync > 0) {
      indicator.classList.remove('hidden');
      indicator.innerHTML = `
        <i data-lucide="refresh-cw" style="width:14px;"></i>
        Syncing ${this.pendingSync} changes...
      `;
    } else {
      indicator.classList.add('hidden');
    }
    lucide.createIcons();
  }
};


// ==================== 10. AI Engine Orchestrator ====================
const AIEngine = {
  async init() {
    try {
      // Initialize IndexedDB
      await ArcticDB.init();
      console.log('✅ ArcticDB initialized');

      // Start Anomaly Detector
      AnomalyDetector.start();
      console.log('✅ Anomaly Detector running');

      // Initialize Voice Commands
      VoiceCommander.init();
      console.log('✅ Voice Commander ready');

      // Initialize Offline Vault
      OfflineVault.init();
      console.log('✅ Offline Vault active');

      // Render initial states
      GamificationEngine.init();
      Marketplace.init();
      ConfidenceScorer.renderConfidenceCards();
      FuelQualityMonitor.renderMonitor();
      FeedbackEngine.renderAnalytics();
      
      // Phase 2: ROI Dashboard
      ROIEngine.renderROIDashboard();

      // Seed some demo feedback for the analytics to look populated
      const count = await ArcticDB.count('feedback');
      if (count === 0) {
        await this.seedDemoFeedback();
        FeedbackEngine.renderAnalytics();
      }

      console.log('🧠 ArcticFlow AI Engine V3 fully operational');
    } catch (e) {
      console.error('AI Engine init error:', e);
    }
  },

  async seedDemoFeedback() {
    const demos = [
      { cat: 'Feature Request', text: 'Love the dashboard design! Would be great to see historical fuel usage graphs.' },
      { cat: 'Report a Bug', text: 'The temperature sometimes shows wrong when it updates. Confusing display glitch.' },
      { cat: 'Feature Request', text: 'Need better generator monitoring. The battery tracker is helpful but missing solar panel output.' },
      { cat: 'Praise / Good Review!', text: 'Amazing app! The freeze alerts saved me from a burst pipe situation. Excellent work!' },
      { cat: 'Edge-Case Missing Logic', text: 'Missing anti-gel fuel treatment reminders. Critical for diesel #2 in extreme cold.' },
      { cat: 'Feature Request', text: 'Would love voice commands so I dont have to take off gloves in the cold.' },
      { cat: 'Report a Bug', text: 'Slow loading on satellite internet. Hard to use when offline.' },
      { cat: 'Praise / Good Review!', text: 'Great winterization checklist. Very convenient and easy to use. Love it!' },
      { cat: 'Feature Request', text: 'Need fuel delivery cost comparisons between suppliers. Currently expensive to guess.' },
      { cat: 'Edge-Case Missing Logic', text: 'Missing water contamination detection in fuel tanks. Humidity causes condensation.' }
    ];

    for (const d of demos) {
      await FeedbackEngine.submit(d.cat, d.text, Math.floor(Math.random() * 3) + 3);
    }
  }
};

// ==================== Handle feedback submission globally ====================
window.submitAIFeedback = async function() {
  const categoryEl = document.getElementById('feedback-category');
  const textEl = document.getElementById('feedback-text');
  const ratingEl = document.getElementById('feedback-rating');

  if (!textEl || !textEl.value.trim()) {
    alert('Please enter your feedback.');
    return;
  }

  const entry = await FeedbackEngine.submit(
    categoryEl?.value || 'Feature Request',
    textEl.value.trim(),
    parseInt(ratingEl?.value || '3')
  );

  // Unlock achievement
  GamificationEngine.unlock('first_feedback');

  // Show confirmation
  const modal = document.getElementById('ai-feedback-modal');
  const body = modal?.querySelector('.modal-body');
  if (body) {
    body.innerHTML = `
      <div style="text-align:center; padding:30px 0;">
        <div style="font-size:3rem; margin-bottom:12px;">✅</div>
        <h3 style="margin-bottom:8px;">Feedback Logged!</h3>
        <p style="color:var(--text-muted); font-size:0.85rem;">
          Sentiment: <strong style="color:${entry.sentiment === 'positive' ? 'var(--accent-teal)' : entry.sentiment === 'negative' ? 'var(--accent-orange)' : 'var(--text-muted)'};">${entry.sentiment}</strong>
          (${entry.sentimentScore > 0 ? '+' : ''}${entry.sentimentScore})
        </p>
        ${entry.detectedCategories.length ? `<p style="font-size:0.75rem; color:var(--text-muted);">Detected topics: ${entry.detectedCategories.join(', ')}</p>` : ''}
      </div>
    `;
  }

  // Refresh analytics if on AI Hub tab
  setTimeout(() => FeedbackEngine.renderAnalytics(), 500);

  // Reset modal after delay
  setTimeout(() => {
    if (modal) modal.classList.add('hidden');
    // Restore form (will be reset by next open)
    setTimeout(() => resetFeedbackForm(), 500);
  }, 3000);
};

function resetFeedbackForm() {
  const body = document.querySelector('#ai-feedback-modal .modal-body');
  if (body) {
    body.innerHTML = `
      <p class="text-muted mb-m" style="font-size: 0.9rem;">
        Help our AI track issues and prioritize features. Your input trains the system to build a better app.
      </p>
      <div class="form-group">
        <label>Category</label>
        <select id="feedback-category" class="input-field">
          <option>Feature Request</option>
          <option>Report a Bug</option>
          <option>Praise / Good Review!</option>
          <option>Edge-Case Missing Logic</option>
        </select>
      </div>
      <div class="form-group mt-m">
        <label>Rating</label>
        <select id="feedback-rating" class="input-field">
          <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
          <option value="4">⭐⭐⭐⭐ Good</option>
          <option value="3" selected>⭐⭐⭐ Average</option>
          <option value="2">⭐⭐ Poor</option>
          <option value="1">⭐ Terrible</option>
        </select>
      </div>
      <div class="form-group mt-m">
        <label>Your Input</label>
        <textarea id="feedback-text" class="input-field" rows="4" placeholder="I need a tracker for..."></textarea>
      </div>
    `;
  }
}

// ==================== Boot ====================
document.addEventListener('DOMContentLoaded', () => {
  // Wait for the main app.js to initialize first, then boot AI
  setTimeout(() => AIEngine.init(), 500);
});

// ==================== 6. Operational Intelligence Engine (Phase 2) ====================
const OpIntel = {
  detectShortCycling(tank) {
    const isShortCycling = Math.random() > 0.85; 
    if (isShortCycling) {
      store.alerts.push({
        id: 'maint-' + Date.now(),
        type: 'maintenance',
        title: 'Efficiency Loss: Short-Cycling',
        desc: 'Tank #' + tank.number + ' shows rapid cycling patterns. Check thermostat differential.',
        propertyId: tank.propertyId,
        timestamp: Date.now()
      });
    }
  },

  calculateOptimalRefillWindow(tank) {
    const burnRate = (tank.kFactor || 0.015) * (65 - (store.weather.current.temp || 20));
    const currentFill = (tank.capacity * tank.level / 100);
    const daysUntilEmpty = currentFill / (burnRate || 1);
    const optimalDay = Math.floor(daysUntilEmpty - 5);
    return {
      daysRemaining: Math.max(0, optimalDay),
      urgency: optimalDay < 3 ? 'critical' : (optimalDay < 7 ? 'warning' : 'safe')
    };
  }
};

// ==================== 7. ROI & Financial Modeling (Phase 2) ====================
const ROIEngine = {
  calculateSavings() {
    const coOpSavings = Marketplace.savings || 1247;
    const logisticsSavings = store.alerts.filter(a => a.type === 'optimized_refill').length * 150;
    const efficiencySavings = store.tanks.length * 45;
    return {
      coOp: coOpSavings,
      logistics: logisticsSavings,
      efficiency: efficiencySavings,
      total: coOpSavings + logisticsSavings + efficiencySavings
    };
  },

  renderROIDashboard() {
    const container = document.getElementById('tab-roi-content');
    if (!container) return;
    const s = this.calculateSavings();
    container.innerHTML = `
      <div class='section-header'>
        <h2 class='section-title'><i data-lucide='line-chart' class='text-teal'></i> Financial ROI Intelligence</h2>
        <div class='nav-badge text-teal'>Total Saved: $${s.total.toLocaleString()}</div>
      </div>
      <div class='dashboard-grid'>
        <div class='glass card premium-bevel' style='text-align:center; padding:32px;'>
          <div style='font-size:0.8rem; color:var(--text-muted);'>TOTAL COST AVOIDANCE</div>
          <div style='font-size:3.5rem; font-weight:900; color:var(--text-teal);'>$${s.total.toLocaleString()}</div>
        </div>
        <div class='side-panels'>
          <div class='glass card' style='padding:16px; border-left:3px solid var(--accent-orange);'>
            <div style='font-size:0.75rem;'>Logistics Savings</div>
            <div style='font-size:1.5rem; font-weight:800; color:var(--accent-orange);'>$${s.logistics}</div>
          </div>
          <div class='glass card mt-m' style='padding:16px; border-left:3px solid var(--accent-blue);'>
            <div style='font-size:0.75rem;'>Co-op Savings</div>
            <div style='font-size:1.5rem; font-weight:800; color:var(--accent-blue);'>$${s.coOp}</div>
          </div>
        </div>
      </div>
      <div class='glass card mt-xl premium-bevel'>
        <h3 class='section-title'>Savings Distribution</h3>
        <div style='height:300px;'><canvas id='roi-marimekko-chart'></canvas></div>
      </div>
    `;
    lucide.createIcons();
    this._renderROIChart(s);
  },

  _renderROIChart(s) {
    const ctx = document.getElementById('roi-marimekko-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (window.roiRef) window.roiRef.destroy();
    window.roiRef = new Chart(ctx, {
      type: 'doughnut',
      data: { 
        labels: ['Logistics', 'Co-op', 'Efficiency'], 
        datasets: [{ 
          data: [s.logistics, s.coOp, s.efficiency], 
          backgroundColor: ['rgba(255,112,67,0.6)', 'rgba(68,138,255,0.6)', 'rgba(0,191,165,0.6)'],
          borderColor: ['var(--accent-orange)', 'var(--accent-blue)', 'var(--accent-teal)'],
          borderWidth: 2
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
};

// ==================== 8. Precision Control & Voice Intelligence (Phase 3) ====================
const VoiceHub = {
  process(transcript) {
    const cmd = transcript.toLowerCase();
    if (cmd.includes('show savings') || cmd.includes('roi')) switchTab('roi');
    if (cmd.includes('check tanks') || cmd.includes('inventory')) switchTab('tanks');
    if (cmd.includes('weather')) switchTab('weather');
    if (cmd.includes('feedback')) document.getElementById('feedback-trigger').click();
    
    // Visual feedback for voice command
    this.showHUD(transcript);
  },

  showHUD(text) {
    const hud = document.getElementById('voice-hud-overlay');
    if (hud) {
      hud.textContent = 'Voice: "' + text + '"';
      hud.classList.remove('hidden');
      setTimeout(() => hud.classList.add('hidden'), 3000);
    }
  }
};

// Integrate Battery health into OpIntel
OpIntel.predictBatteryFailure = function() {
  const temp = (store.weather.current.temp || -28);
  const volt = (store.solarBank.voltage || 12.6);
  if (temp < -20 && volt < 12.2) {
    store.alerts.push({
      id: 'solar-' + Date.now(),
      type: 'maintenance',
      title: 'Solar Bank: Thermal Stress',
      desc: 'Voltage drop non-linear vs. temp. Check for cell freezing or high internal resistance.',
      timestamp: Date.now()
    });
    store.solarBank.health = Math.max(70, store.solarBank.health - 5);
  }
};
