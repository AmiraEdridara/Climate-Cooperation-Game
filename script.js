// Country data: ISO 3166-1 numeric codes match the world-atlas TopoJSON
// Emissions in Gt CO2/yr (2024 estimates)
const COUNTRIES_SIM = [
  { id: 'china', name: 'China',          isoNumeric: ['156'], emissions: 12.0, gdp: 18, defaultStrat: 'emit' },
  { id: 'usa',   name: 'United States',  isoNumeric: ['840'], emissions: 4.7,  gdp: 25, defaultStrat: 'tit-for-tat' },
  { id: 'india', name: 'India',          isoNumeric: ['356'], emissions: 2.8,  gdp: 4,  defaultStrat: 'emit' },
  { id: 'eu',    name: 'European Union', isoNumeric: ['040','056','100','191','196','203','208','233','246','250','276','300','348','372','380','428','440','442','470','528','616','620','642','703','705','724','752'], emissions: 2.5, gdp: 17, defaultStrat: 'abate' },
  { id: 'russia', name: 'Russia',        isoNumeric: ['643'], emissions: 1.8,  gdp: 2,  defaultStrat: 'emit' },
  { id: 'japan', name: 'Japan',          isoNumeric: ['392'], emissions: 1.0,  gdp: 4,  defaultStrat: 'abate' },
  { id: 'iran',  name: 'Iran',           isoNumeric: ['364'], emissions: 0.8,  gdp: 0.4,defaultStrat: 'emit' },
  { id: 'saudi', name: 'Saudi Arabia',   isoNumeric: ['682'], emissions: 0.7,  gdp: 1.1,defaultStrat: 'emit' },
  { id: 'indonesia', name: 'Indonesia',  isoNumeric: ['360'], emissions: 0.7,  gdp: 1.4,defaultStrat: 'emit' },
  { id: 'canada', name: 'Canada',        isoNumeric: ['124'], emissions: 0.55, gdp: 2.1,defaultStrat: 'tit-for-tat' },
  { id: 'brazil', name: 'Brazil',        isoNumeric: ['076'], emissions: 0.5,  gdp: 1.8,defaultStrat: 'tit-for-tat' },
  { id: 'australia', name: 'Australia',  isoNumeric: ['036'], emissions: 0.4,  gdp: 1.7,defaultStrat: 'tit-for-tat' }
];
 
// Map ISO numeric → country id (for fast lookup during render)
const ISO_TO_COUNTRY = {};
COUNTRIES_SIM.forEach(c => c.isoNumeric.forEach(iso => { ISO_TO_COUNTRY[iso] = c.id; }));
 
// Historical chart data
const HISTORICAL = {
  emissions: {
    "USA":   [5085,5037,5111,5217,5301,5371,5527,5587,5610,5666,5824,5734,5751,5790,5871,5901,5828,5942,5740,5360,5535,5407,5226,5326,5341,5193,5076,5061,5202,5070,4570,4849,4811,4682],
    "China": [2484,2619,2731,2914,3094,3351,3499,3512,3355,3550,3644,3724,4098,4835,5211,5882,6486,6975,7492,7881,8610,9520,9767,9942,9976,9858,9748,10000,10347,10714,10897,11284,11712,12172],
    "EU27":  [3760,3680,3540,3470,3470,3530,3590,3520,3490,3450,3490,3540,3520,3580,3590,3550,3540,3500,3410,3110,3210,3140,3080,2990,2860,2880,2890,2940,2880,2790,2540,2680,2670,2470],
    "India": [600,631,657,678,717,783,819,882,891,949,974,994,1027,1067,1129,1185,1247,1351,1426,1574,1672,1773,1885,1925,2059,2058,2090,2210,2310,2438,2270,2521,2666,2807]
  },
  temperature: [0.45,0.40,0.22,0.24,0.32,0.45,0.32,0.47,0.61,0.40,0.42,0.55,0.62,0.61,0.54,0.67,0.62,0.59,0.54,0.65,0.72,0.58,0.65,0.67,0.74,0.90,1.01,0.92,0.85,0.97,1.02,0.85,0.89,1.45],
  atmCO2: [354,355,356,357,358,360,362,363,366,368,369,371,373,375,377,379,381,383,385,387,389,391,393,396,398,400,404,406,408,411,414,416,418,421]
};
const YEARS = Array.from({length: 34}, (_, i) => 1990 + i);
 
const COLORS_CHART = { USA: '#378ADD', China: '#D85A30', EU27: '#1D9E75', India: '#BA7517' };
 
// ─────── Map rendering with D3 ───────
let mapPathsByCountryId = {};
 
async function loadMap() {
  try {
    const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json());
    const countries = topojson.feature(world, world.objects.countries);
    
    const svg = d3.select('#worldMap');
    const width = 960, height = 480;
    
    const projection = d3.geoEqualEarth().fitSize([width, height], { type: 'Sphere' });
    const path = d3.geoPath(projection);
    
    // Sphere (ocean)
    svg.append('path').attr('class', 'sphere').attr('d', path({ type: 'Sphere' }));
    
    // Graticule
    const graticule = d3.geoGraticule10();
    svg.append('path').attr('class', 'graticule').attr('d', path(graticule));
    
    // Country shapes
    const paths = svg.append('g').selectAll('path')
      .data(countries.features)
      .enter().append('path')
      .attr('d', path)
      .attr('class', d => {
        const cid = ISO_TO_COUNTRY[d.id];
        return cid ? `country-shape neutral has-${cid}` : 'country-shape neutral';
      })
      .attr('data-cid', d => ISO_TO_COUNTRY[d.id] || '');
    
    // Build lookup of paths grouped by country id
    paths.each(function(d) {
      const cid = ISO_TO_COUNTRY[d.id];
      if (cid) {
        if (!mapPathsByCountryId[cid]) mapPathsByCountryId[cid] = [];
        mapPathsByCountryId[cid].push(this);
      }
    });
    
    document.getElementById('mapLoading').style.display = 'none';
    updateMap();
  } catch (err) {
    console.error('Map load failed:', err);
    document.getElementById('mapLoading').textContent = 'Map data could not be loaded — strategy controls below still work.';
  }
}
 
function updateMap() {
  if (!state || !state.countries) return;
  state.countries.forEach(c => {
    const cls = `country-shape ${c.lastAction || c.strategy}`;
    const paths = mapPathsByCountryId[c.id] || [];
    paths.forEach(p => {
      p.setAttribute('class', cls);
    });
  });
  
  // Heat overlay based on temperature
  const tempRise = state.baseTemp + (state.atmCO2 - 421) * 0.012;
  const heat = Math.min(0.4, Math.max(0, (tempRise - 1.5) / 6));
  document.getElementById('heatOverlay').style.setProperty('--heat', heat);
  document.getElementById('mapYear').textContent = state.year;
}
 
// ─────── Sim state ───────
let state = {};
let simInterval = null;
let running = false;
let previousRunSummary = null;
let currentChart = 'emissions';
let activePageTab = 'overview';

const PRESETS = {
  paris: {
    strategies: { usa: 'abate', china: 'abate', india: 'tit-for-tat', eu: 'abate', russia: 'tit-for-tat', japan: 'abate', iran: 'emit', saudi: 'emit', indonesia: 'tit-for-tat', canada: 'abate', brazil: 'tit-for-tat', australia: 'abate' },
    levers: { tax: 70, tech: 75, tariff: 30, adapt: 45 }
  },
  bau: {
    strategies: { usa: 'tit-for-tat', china: 'emit', india: 'emit', eu: 'abate', russia: 'emit', japan: 'abate', iran: 'emit', saudi: 'emit', indonesia: 'emit', canada: 'tit-for-tat', brazil: 'tit-for-tat', australia: 'tit-for-tat' },
    levers: { tax: 20, tech: 35, tariff: 10, adapt: 15 }
  },
  club: {
    strategies: { usa: 'abate', china: 'tit-for-tat', india: 'tit-for-tat', eu: 'abate', russia: 'emit', japan: 'abate', iran: 'emit', saudi: 'emit', indonesia: 'tit-for-tat', canada: 'abate', brazil: 'tit-for-tat', australia: 'abate' },
    levers: { tax: 60, tech: 65, tariff: 70, adapt: 25 }
  },
  rivalry: {
    strategies: { usa: 'emit', china: 'emit', india: 'emit', eu: 'abate', russia: 'emit', japan: 'tit-for-tat', iran: 'emit', saudi: 'emit', indonesia: 'emit', canada: 'tit-for-tat', brazil: 'tit-for-tat', australia: 'emit' },
    levers: { tax: 10, tech: 30, tariff: 50, adapt: 10 }
  }
};
 
function init(){
  state = {
    year: 2025,
    atmCO2: 421,
    baseTemp: 1.45,
    globalGDP: 100,
    cumDamage: 0,
    countries: COUNTRIES_SIM.map(c => ({
      ...c,
      strategy: c.defaultStrat || 'emit',
      currentEmissions: c.emissions,
      currentGDP: c.gdp,
      lastAction: c.defaultStrat || 'emit',
    })),
    rounds: 0,
    focusCountry: 'usa',
    levers: { tax: 20, tech: 35, tariff: 10, adapt: 15 },
    thresholdFlags: { two: false, three: false },
    runSummary: null
  };
  hydrateFromUrl();
  applyLeverInputs();
  populateFocusCountry();
  renderCountries();
  updateDisplay();
  updateMap();
  updateFocusSummary();
  updatePolicyReadout();
  updateRunPanels();
  document.getElementById('logBox').textContent = '2025: Choose each country\'s strategy and press Start. Or click "Load historical" to use what countries actually played from 1990–2023.';
  document.getElementById('verdict').innerHTML = '';
  document.getElementById('verdict').className = 'verdict';
}
 
function renderCountries(){
  const grid = document.getElementById('countryGrid');
  grid.innerHTML = '';
  state.countries.forEach(c => {
    const div = document.createElement('div');
    div.className = 'country';
    div.tabIndex = 0;
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', `Focus ${c.name} on map`);
    const stratColor = c.strategy === 'abate' ? '#1D9E75' : c.strategy === 'emit' ? '#E24B4A' : '#BA7517';
    div.style.borderLeft = `4px solid ${stratColor}`;
    div.addEventListener('click', () => setFocusCountry(c.id));
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setFocusCountry(c.id);
      }
    });
    div.innerHTML = `
      <div class="country-head">
        <span class="country-name">${c.name}</span>
        <span class="country-strategy" id="strat-${c.id}">${c.strategy}</span>
      </div>
      <div class="country-stats">
        <span>Emit: <b id="emit-${c.id}">${c.currentEmissions.toFixed(1)}</b></span>
        <span>GDP: <b id="gdp-${c.id}">${c.currentGDP.toFixed(1)}</b></span>
      </div>
      <div class="strategy-picker">
        <button class="strategy-btn ${c.strategy==='abate'?'active':''}" aria-pressed="${c.strategy==='abate'}" onclick="setStrategy('${c.id}','abate')">Abate</button>
        <button class="strategy-btn ${c.strategy==='emit'?'active':''}" aria-pressed="${c.strategy==='emit'}" onclick="setStrategy('${c.id}','emit')">Emit</button>
        <button class="strategy-btn ${c.strategy==='tit-for-tat'?'active':''}" aria-pressed="${c.strategy==='tit-for-tat'}" onclick="setStrategy('${c.id}','tit-for-tat')">TfT</button>
      </div>
    `;
    grid.appendChild(div);
  });
}
 
function setStrategy(id, strat){
  const c = state.countries.find(x => x.id===id);
  c.strategy = strat;
  c.lastAction = strat;
  state.focusCountry = id;
  renderCountries();
  updateMap();
  updateFocusSummary();
  persistStateToUrl();
}
 
function setAll(strat){
  state.countries.forEach(c => { c.strategy = strat; c.lastAction = strat; });
  renderCountries();
  updateMap();
  updateFocusSummary();
  persistStateToUrl();
}
 
function loadHistorical() {
  // Set strategies based on what each country actually played 1990-2023
  const historical = {
    'usa': 'tit-for-tat',
    'china': 'emit',
    'eu': 'abate',
    'india': 'emit',
    'russia': 'emit',
    'japan': 'abate',
    'iran': 'emit',
    'saudi': 'emit',
    'indonesia': 'emit',
    'canada': 'tit-for-tat',
    'brazil': 'tit-for-tat',
    'australia': 'tit-for-tat'
  };
  state.countries.forEach(c => {
    c.strategy = historical[c.id] || 'emit';
    c.lastAction = c.strategy;
  });
  renderCountries();
  updateMap();
  updateFocusSummary();
  persistStateToUrl();
  addLog('Loaded historical strategies (1990-2023). Press Start to run forward from 2025.');
}
 
function decideAction(c, others){
  if(c.strategy === 'abate') return 'abate';
  if(c.strategy === 'emit') return 'emit';
  // tit-for-tat: cooperate if majority of others did last round
  const cooperators = others.filter(o => o.lastAction === 'abate').length;
  return cooperators >= others.length / 2 ? 'abate' : 'emit';
}
 
function step(){
  state.year++;
  state.rounds++;
  
  state.countries.forEach(c => {
    const others = state.countries.filter(o => o.id !== c.id);
    const action = decideAction(c, others);
    c.lastAction = action;
    
    const taxBoost = 1 - state.levers.tax / 800;
    const techBoost = 1 - state.levers.tech / 900;
    const tariffPenalty = state.levers.tariff / 1000;
    const adaptShield = state.levers.adapt / 1200;

    if(action === 'abate'){
      c.currentEmissions = Math.max(0.05, c.currentEmissions * 0.94 * taxBoost * techBoost);
      c.currentGDP = c.gdp * (0.97 + state.levers.tech / 2000 - state.cumDamage * (0.5 - adaptShield));
    } else {
      c.currentEmissions = Math.min(c.emissions * 1.5, c.currentEmissions * (1.02 - state.levers.tax / 2500 + tariffPenalty));
      c.currentGDP = c.gdp * (1.02 - state.levers.tariff / 1800 - state.cumDamage * (0.8 - adaptShield));
    }
  });
  
  const totalEmissions = state.countries.reduce((s,c) => s + c.currentEmissions, 0);
  const otherEmissions = 10; // rest of world (not in our 12)
  const globalE = totalEmissions + otherEmissions;
  
  state.atmCO2 += globalE * 0.13;
  
  const tempRise = state.baseTemp + (state.atmCO2 - 421) * 0.012;
  state.cumDamage = Math.max(0, Math.pow(Math.max(0, tempRise - 1.5), 1.6) * 0.04);
  state.globalGDP = state.countries.reduce((s,c) => s + c.currentGDP, 0) + 22 * (1 - state.cumDamage * 0.5);
  
  const cooperators = state.countries.filter(c => c.lastAction === 'abate').length;
  
  if(state.rounds % 5 === 0){
    addLog(`${state.year}: Temp +${tempRise.toFixed(2)}°C, ${cooperators}/12 abating, damage ${(state.cumDamage*100).toFixed(1)}%`);
  }
  if (tempRise >= 2 && !state.thresholdFlags.two) {
    state.thresholdFlags.two = true;
    addLog(`Threshold crossed: +2°C. Extreme heat and adaptation stress accelerate.`);
  }
  if (tempRise >= 3 && !state.thresholdFlags.three) {
    state.thresholdFlags.three = true;
    addLog(`Threshold crossed: +3°C. Severe systemic climate risk likely.`);
  }
  
  updateDisplay();
  updateMap();
  updateFocusSummary();
  
  if(state.year >= 2100 || tempRise > 5){
    stopSim();
    showVerdict(tempRise);
  }
}
 
function updateDisplay(){
  const totalEmissions = state.countries.reduce((s,c) => s + c.currentEmissions, 0);
  const globalE = totalEmissions + 10;
  const tempRise = state.baseTemp + (state.atmCO2 - 421) * 0.012;
  const cooperators = state.countries.filter(c => c.lastAction === 'abate').length;
  
  document.getElementById('yearVal').textContent = state.year;
  document.getElementById('globalEmissions').textContent = globalE.toFixed(1);
  document.getElementById('atmCO2').textContent = state.atmCO2.toFixed(0);
  document.getElementById('totalGDP').textContent = state.globalGDP.toFixed(0);
  document.getElementById('cooperators').textContent = `${cooperators}/12`;
  document.getElementById('climateDamage').textContent = (state.cumDamage*100).toFixed(1) + '%';
  document.getElementById('thresholdNote').textContent =
    tempRise >= 3 ? 'Impact threshold: >3°C crossed.' :
    tempRise >= 2 ? 'Impact threshold: >2°C crossed.' :
    'No major threshold crossed yet.';
  
  const tempDisp = document.getElementById('tempDisplay');
  tempDisp.classList.toggle('safe', tempRise < 2);
  
  const delta = document.getElementById('tempDelta');
  if(state.rounds === 0){
    tempDisp.firstChild.textContent = `+${tempRise.toFixed(2)}°C `;
    delta.textContent = '— starting baseline (2025)';
  } else {
    tempDisp.firstChild.textContent = `+${tempRise.toFixed(2)}°C `;
    delta.textContent = `(year ${state.year})`;
  }
  
  state.countries.forEach(c => {
    const emitEl = document.getElementById('emit-'+c.id);
    const gdpEl = document.getElementById('gdp-'+c.id);
    const stratEl = document.getElementById('strat-'+c.id);
    if (emitEl) emitEl.textContent = c.currentEmissions.toFixed(1);
    if (gdpEl) gdpEl.textContent = c.currentGDP.toFixed(1);
    if (stratEl) stratEl.textContent = c.lastAction || c.strategy;
  });
}
 
function showVerdict(temp){
  const v = document.getElementById('verdict');
  let msg, cls;
  if(temp < 1.8){
    msg = `🌍 <strong>Paris Agreement met.</strong> Temperature held at +${temp.toFixed(2)}°C. Cooperation paid off — world GDP at ${state.globalGDP.toFixed(0)}.`;
    cls = 'win';
  } else if(temp < 2.5){
    msg = `⚠️ <strong>Limited success.</strong> Temperature reached +${temp.toFixed(2)}°C. Significant damage but civilization adapted.`;
    cls = 'win';
  } else if(temp < 3.5){
    msg = `🔥 <strong>Climate crisis.</strong> Temperature reached +${temp.toFixed(2)}°C. Major economic and ecological damage. World GDP fell to ${state.globalGDP.toFixed(0)}.`;
    cls = 'lose';
  } else {
    msg = `💀 <strong>Catastrophic warming.</strong> +${temp.toFixed(2)}°C. The Nash equilibrium of universal defection led to civilization-threatening outcomes.`;
    cls = 'lose';
  }
  v.className = 'verdict ' + cls;
  const oldSummary = state.runSummary;
  state.runSummary = `${state.year} end: +${temp.toFixed(2)}°C, ${state.countries.filter(c => c.lastAction === 'abate').length}/12 abating, GDP ${state.globalGDP.toFixed(0)}`;
  if (oldSummary) previousRunSummary = oldSummary;
  document.getElementById('currentRun').textContent = state.runSummary;
  updateRunPanels();
  v.innerHTML = `${msg}<div style="margin-top:10px;"><strong>Try improving this outcome:</strong> use Paris aligned preset, raise tech decline, and increase adaptation.</div>`;
}
 
function addLog(msg){
  const log = document.getElementById('logBox');
  log.textContent = msg + '\n' + log.textContent;
}
 
function toggleSim(){
  if(running){ stopSim(); }
  else { 
    running = true;
    document.getElementById('simBtn').textContent = 'Pause';
    const speed = +document.getElementById('speed').value;
    simInterval = setInterval(step, 900 - speed);
  }
}
 
function stopSim(){
  clearInterval(simInterval);
  running = false;
  document.getElementById('simBtn').textContent = 'Start';
}
 
function resetSim(){
  stopSim();
  init();
}
 
document.getElementById('speed').addEventListener('input', () => {
  if(running){
    clearInterval(simInterval);
    const speed = +document.getElementById('speed').value;
    simInterval = setInterval(step, 900 - speed);
  }
});
 
function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return;
  state.countries.forEach(c => {
    c.strategy = preset.strategies[c.id] || c.strategy;
    c.lastAction = c.strategy;
  });
  state.levers = { ...preset.levers };
  applyLeverInputs();
  renderCountries();
  updateMap();
  updateFocusSummary();
  updatePolicyReadout();
  persistStateToUrl();
  addLog(`Preset loaded: ${name}.`);
}

function populateFocusCountry() {
  const el = document.getElementById('focusCountry');
  if (!el || el.options.length) return;
  el.innerHTML = COUNTRIES_SIM.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  el.value = state.focusCountry;
  el.addEventListener('change', (e) => {
    state.focusCountry = e.target.value;
    updateFocusSummary();
    persistStateToUrl();
  });
}

function updateFocusSummary() {
  const selected = state.countries.find(c => c.id === state.focusCountry);
  const el = document.getElementById('focusSummary');
  if (!el || !selected) return;
  const selectEl = document.getElementById('focusCountry');
  if (selectEl) selectEl.value = selected.id;
  const pct = ((selected.currentEmissions / (state.countries.reduce((s, c) => s + c.currentEmissions, 0) + 10)) * 100).toFixed(1);
  el.textContent = `${selected.name}: ${selected.lastAction}, ${selected.currentEmissions.toFixed(2)} GtCO2/yr, GDP index ${selected.currentGDP.toFixed(2)}, share ${pct}% of modeled global emissions.`;
}

function setFocusCountry(id) {
  if (!state.countries.some(c => c.id === id)) return;
  state.focusCountry = id;
  renderCountries();
  updateMap();
  updateFocusSummary();
  persistStateToUrl();
}

function updatePolicyReadout() {
  const r = document.getElementById('policyReadout');
  if (!r) return;
  r.textContent = `Tax ${state.levers.tax}/100, Tech ${state.levers.tech}/100, Tariff ${state.levers.tariff}/100, Adaptation ${state.levers.adapt}/100.`;
}

function applyLeverInputs() {
  const ids = { tax: 'leverTax', tech: 'leverTech', tariff: 'leverTariff', adapt: 'leverAdapt' };
  Object.entries(ids).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state.levers[k];
    if (!el.dataset.bound) {
      el.addEventListener('input', () => {
        state.levers[k] = +el.value;
        updatePolicyReadout();
        persistStateToUrl();
      });
      el.dataset.bound = '1';
    }
  });
}

function updateRunPanels() {
  document.getElementById('currentRun').textContent = state.runSummary || 'Not finished yet.';
  document.getElementById('previousRun').textContent = previousRunSummary || 'No previous run.';
}

function persistStateToUrl() {
  const params = new URLSearchParams();
  params.set('focus', state.focusCountry);
  params.set('lv', `${state.levers.tax},${state.levers.tech},${state.levers.tariff},${state.levers.adapt}`);
  params.set('strat', state.countries.map(c => `${c.id}:${c.strategy}`).join('|'));
  params.set('tab', activePageTab);
  history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
}

function hydrateFromUrl() {
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');
  if (tab) activePageTab = tab;
  const focus = params.get('focus');
  if (focus) state.focusCountry = focus;
  const lv = params.get('lv');
  if (lv) {
    const [tax, tech, tariff, adapt] = lv.split(',').map(Number);
    if ([tax, tech, tariff, adapt].every(Number.isFinite)) {
      state.levers = { tax, tech, tariff, adapt };
    }
  }
  const strat = params.get('strat');
  if (strat) {
    const map = Object.fromEntries(strat.split('|').map(p => p.split(':')));
    state.countries.forEach(c => {
      if (map[c.id]) {
        c.strategy = map[c.id];
        c.lastAction = map[c.id];
      }
    });
  }
}

function copyShareLink() {
  persistStateToUrl();
  navigator.clipboard.writeText(location.href)
    .then(() => addLog('Share link copied to clipboard.'))
    .catch(() => addLog('Could not copy link automatically. Copy URL from address bar.'));
}

function setActivePageTab(tabName) {
  const tabs = ['overview', 'simulation', 'reality', 'insights'];
  activePageTab = tabs.includes(tabName) ? tabName : 'overview';

  document.querySelectorAll('.page-tab').forEach(btn => {
    const active = btn.dataset.tab === activePageTab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active-panel', panel.dataset.panel === activePageTab);
  });

  if (activePageTab === 'reality') {
    // Canvas needs a visible container for correct sizing.
    requestAnimationFrame(() => {
      drawChart();
      updateChartLegend();
      updateChartCommentary();
    });
  }
  if (activePageTab === 'simulation') {
    requestAnimationFrame(updateMap);
  }
  persistStateToUrl();
}

function initPageTabs() {
  document.querySelectorAll('.page-tab').forEach(btn => {
    btn.addEventListener('click', () => setActivePageTab(btn.dataset.tab));
  });
  setActivePageTab(activePageTab);
}

// ─────── Historical chart ───────
 
function switchChart(name) {
  currentChart = name;
  document.querySelectorAll('.backtest-tab').forEach((t,i) => {
    t.classList.toggle('active', ['emissions','temperature','co2','compare'][i] === name);
  });
  drawChart();
  updateChartLegend();
  updateChartCommentary();
}
 
function drawChart() {
  const c = document.getElementById('historyCanvas');
  const rect = c.getBoundingClientRect();
  c.width = rect.width;
  c.height = rect.height;
  const ctx = c.getContext('2d');
  const W = c.width, H = c.height;
  const padL = 50, padR = 20, padT = 20, padB = 32;
  ctx.clearRect(0,0,W,H);
  
  const isDark = matchMedia('(prefers-color-scheme:dark)').matches;
  const textCol = isDark ? '#a8a69c' : '#5f5e5a';
  const gridCol = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  
  let series = [], maxY = 0, minY = 0, yLabel = '';
  
  if (currentChart === 'emissions') {
    series = [
      { name: 'USA', data: HISTORICAL.emissions.USA, color: COLORS_CHART.USA },
      { name: 'China', data: HISTORICAL.emissions.China, color: COLORS_CHART.China },
      { name: 'EU27', data: HISTORICAL.emissions.EU27, color: COLORS_CHART.EU27 },
      { name: 'India', data: HISTORICAL.emissions.India, color: COLORS_CHART.India }
    ];
    maxY = 13000; yLabel = 'Mt CO₂/yr';
  } else if (currentChart === 'temperature') {
    series = [{ name: 'Temperature', data: HISTORICAL.temperature, color: '#E24B4A' }];
    maxY = 1.6; minY = 0; yLabel = '°C above baseline';
  } else if (currentChart === 'co2') {
    series = [{ name: 'Atmospheric CO₂', data: HISTORICAL.atmCO2, color: '#7F77DD' }];
    minY = 350; maxY = 425; yLabel = 'ppm';
  } else if (currentChart === 'compare') {
    const realTotal = YEARS.map((_, i) =>
      HISTORICAL.emissions.USA[i] + HISTORICAL.emissions.China[i] +
      HISTORICAL.emissions.EU27[i] + HISTORICAL.emissions.India[i]
    );
    const baseEmissions = realTotal[0];
    const theoryAbate = YEARS.map((_, i) => baseEmissions * Math.pow(0.97, i));
    const theoryEmit = YEARS.map((_, i) => baseEmissions * Math.pow(1.025, i));
    series = [
      { name: 'Real', data: realTotal, color: isDark ? '#e8e6dc' : '#2c2c2a' },
      { name: 'All abate (theory)', data: theoryAbate, color: COLORS_CHART.EU27 },
      { name: 'All emit (theory)', data: theoryEmit, color: COLORS_CHART.China }
    ];
    maxY = Math.max(...theoryEmit, ...realTotal) * 1.05;
    yLabel = 'Mt CO₂/yr (4 majors)';
  }
  const showUncertainty = !!document.getElementById('uncertaintyToggle')?.checked;
  
  ctx.strokeStyle = gridCol; ctx.lineWidth = 1;
  ctx.font = '11px sans-serif'; ctx.fillStyle = textCol;
  
  for (let i = 0; i <= 5; i++) {
    const y = padT + i * (H - padT - padB) / 5;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    const val = maxY - (maxY - minY) * i / 5;
    ctx.textAlign = 'right';
    ctx.fillText(val.toFixed(currentChart === 'temperature' ? 2 : 0), padL - 6, y + 4);
  }
  
  ctx.textAlign = 'center';
  [1990, 2000, 2010, 2020].forEach(yr => {
    const idx = yr - 1990;
    const x = padL + (idx / 33) * (W - padL - padR);
    ctx.fillText(yr, x, H - 12);
  });
  
  ctx.save(); ctx.translate(14, H/2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.fillText(yLabel, 0, 0); ctx.restore();
  
  series.forEach(s => {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2;
    ctx.beginPath();
    s.data.forEach((v, i) => {
      const x = padL + (i / (s.data.length - 1)) * (W - padL - padR);
      const y = padT + (1 - (v - minY) / (maxY - minY)) * (H - padT - padB);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    if (showUncertainty) {
      ctx.fillStyle = s.color + '22';
      ctx.beginPath();
      s.data.forEach((v, i) => {
        const x = padL + (i / (s.data.length - 1)) * (W - padL - padR);
        const spread = Math.max((maxY - minY) * 0.03, v * 0.04);
        const y = padT + (1 - ((v + spread) - minY) / (maxY - minY)) * (H - padT - padB);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      for (let i = s.data.length - 1; i >= 0; i--) {
        const v = s.data[i];
        const x = padL + (i / (s.data.length - 1)) * (W - padL - padR);
        const spread = Math.max((maxY - minY) * 0.03, v * 0.04);
        const y = padT + (1 - ((v - spread) - minY) / (maxY - minY)) * (H - padT - padB);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  });
}
 
function updateChartLegend() {
  const el = document.getElementById('chartLegend');
  let items = [];
  if (currentChart === 'emissions') {
    items = [
      { name: 'United States', color: COLORS_CHART.USA },
      { name: 'China', color: COLORS_CHART.China },
      { name: 'EU27', color: COLORS_CHART.EU27 },
      { name: 'India', color: COLORS_CHART.India }
    ];
  } else if (currentChart === 'temperature') {
    items = [{ name: 'Temperature anomaly (°C)', color: '#E24B4A' }];
  } else if (currentChart === 'co2') {
    items = [{ name: 'Mauna Loa CO₂ (ppm)', color: '#7F77DD' }];
  } else if (currentChart === 'compare') {
    items = [
      { name: 'Real combined emissions', color: 'var(--text)' },
      { name: 'Theory: if all 4 had abated', color: COLORS_CHART.EU27 },
      { name: 'Theory: if all 4 had defected', color: COLORS_CHART.China }
    ];
  }
  el.innerHTML = items.map(it => `<span><i style="background:${it.color}"></i>${it.name}</span>`).join('');
}
 
function updateChartCommentary() {
  const el = document.getElementById('chartCommentary');
  const texts = {
    emissions: "China's trajectory dominates: it tripled emissions while the EU cut by a third. The US plateaued then declined modestly. India grew fast from a low base.",
    temperature: "The trend is unmistakable. The 2023 spike to +1.45°C effectively crossed the Paris 1.5°C threshold for the first time.",
    co2: "Concentrations rose monotonically from 354 to 421 ppm. The COVID dip in 2020 was barely visible — climate is a stock problem, not a flow problem.",
    compare: "The blue line shows what would have happened if all four major emitters had played 'abate' from 1990. The red line shows pure 'emit'. Reality (black) tracks much closer to the defection curve."
  };
  el.textContent = texts[currentChart] || '';
}
 
window.addEventListener('resize', () => { drawChart(); });

const uncertaintyToggle = document.getElementById('uncertaintyToggle');

if (uncertaintyToggle) uncertaintyToggle.addEventListener('change', drawChart);
 
// ─────── Init ───────
init();
initPageTabs();
loadMap();
drawChart();
updateChartLegend();
updateChartCommentary();

