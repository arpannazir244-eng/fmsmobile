// ==========================================
// FMS WORKSPACE — MOBILE APPLICATION LOGIC
// ==========================================

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbydC0_cPM6D2Nct5GztT6alfevNfHESwNuL4-L4ehs-u4tkQUpLjGCiFHFtEtXTlIjj/exec";
const LOGIN_WEB_APP_URL = WEB_APP_URL;

let eolDataCache = null; // Store fetched data
let currentUnitFilter = 'ALL';

// ---------- User Profile Synchronization ----------
function initUserProfile() {
  const username = localStorage.getItem('nimbus_username') || 'Inspector';
  const cleanName = username.trim();
  
  const parts = cleanName.split(' ');
  const initials = parts.length > 1 
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : cleanName.slice(0, 2).toUpperCase();

  const heroGreeting = document.getElementById('heroGreeting');
  if (heroGreeting) heroGreeting.textContent = `Welcome, ${cleanName}`;

  const drawerUserName = document.getElementById('drawerUserName');
  if (drawerUserName) drawerUserName.textContent = cleanName;

  const drawerUserInitial = document.getElementById('drawerUserInitial');
  if (drawerUserInitial) drawerUserInitial.textContent = initials;

  const userAvatarText = document.getElementById('userAvatarText');
  if (userAvatarText) userAvatarText.textContent = initials;
}

// ---------- Segmented Switcher (Line Stages <-> Store/Warehouse KPIs) ----------
const syncBtn = document.getElementById('syncBtn');
const segStagesBtn = document.getElementById('segStagesBtn');
const segKpiBtn = document.getElementById('segKpiBtn');
const stagesGrid = document.getElementById('stagesGrid');
const kpiGrid = document.getElementById('kpiGrid');
const stagesSectionLabel = document.getElementById('stagesSectionLabel');

function setStagesView(showKpi) {
  if (!stagesGrid || !kpiGrid) return;
  
  if (showKpi) {
    stagesGrid.hidden = true;
    kpiGrid.hidden = false;
    if (segStagesBtn) segStagesBtn.classList.remove('active');
    if (segKpiBtn) segKpiBtn.classList.add('active');
    if (stagesSectionLabel) stagesSectionLabel.textContent = 'Inventory Transfer';
    showToast('Showing Store & Warehouse');
  } else {
    kpiGrid.hidden = true;
    stagesGrid.hidden = false;
    if (segKpiBtn) segKpiBtn.classList.remove('active');
    if (segStagesBtn) segStagesBtn.classList.add('active');
    if (stagesSectionLabel) stagesSectionLabel.textContent = 'Line Stages';
    showToast('Showing Line Stages');
  }
}

if (segStagesBtn) segStagesBtn.addEventListener('click', () => setStagesView(false));
if (segKpiBtn) segKpiBtn.addEventListener('click', () => setStagesView(true));
if (syncBtn) {
  syncBtn.addEventListener('click', () => {
    const isShowingKpi = kpiGrid && !kpiGrid.hidden;
    setStagesView(!isShowingKpi);
  });
}

// ---------- Notification Sheet ----------
const bellBtn = document.getElementById('bellBtn');
const notifSheet = document.getElementById('notifSheet');
const notifOverlay = document.getElementById('notifOverlay');
const notifCloseBtn = document.getElementById('notifCloseBtn');

function openNotifSheet() {
  if (notifSheet && notifOverlay) {
    notifSheet.classList.add('open');
    notifOverlay.classList.add('open');
  }
}

function closeNotifSheet() {
  if (notifSheet && notifOverlay) {
    notifSheet.classList.remove('open');
    notifOverlay.classList.remove('open');
  }
}

if (bellBtn) bellBtn.addEventListener('click', openNotifSheet);
if (notifCloseBtn) notifCloseBtn.addEventListener('click', closeNotifSheet);
if (notifOverlay) notifOverlay.addEventListener('click', closeNotifSheet);

// ---------- Side Drawer Navigation ----------
const menuBtn = document.getElementById('menuBtn');
const sidePanel = document.getElementById('sidePanel');
const sideOverlay = document.getElementById('sideOverlay');
const sideCloseBtn = document.getElementById('sideCloseBtn');
const drawerSyncBtn = document.getElementById('drawerSyncBtn');
const drawerLogoutBtn = document.getElementById('drawerLogoutBtn');

function openSidePanel() {
  if (!sidePanel || !sideOverlay) return;
  sidePanel.classList.add('open');
  sideOverlay.classList.add('open');
}

function closeSidePanel() {
  if (!sidePanel || !sideOverlay) return;
  sidePanel.classList.remove('open');
  sideOverlay.classList.remove('open');
}

if (menuBtn) menuBtn.addEventListener('click', openSidePanel);
if (sideCloseBtn) sideCloseBtn.addEventListener('click', closeSidePanel);
if (sideOverlay) sideOverlay.addEventListener('click', closeSidePanel);

if (drawerSyncBtn) {
  drawerSyncBtn.addEventListener('click', () => {
    closeSidePanel();
    fetchEolData(true);
  });
}

if (drawerLogoutBtn) {
  drawerLogoutBtn.addEventListener('click', () => {
    localStorage.removeItem('nimbus_logged_in');
    localStorage.removeItem('nimbus_username');
    showToast('Logged out');
    setTimeout(() => { window.location.href = 'login.html'; }, 400);
  });
}

// ---------- End of Line Form Sheet Controls ----------
const eolSheet = document.getElementById('eolSheet');
const eolOverlay = document.getElementById('eolOverlay');
const eolCloseBtn = document.getElementById('eolCloseBtn');
const eolForm = document.getElementById('eolForm');
const navCenterAuditBtn = document.getElementById('navCenterAuditBtn');

function openEolSheet() {
  if (eolSheet && eolOverlay) {
    eolSheet.classList.add('open');
    eolOverlay.classList.add('open');
    if (navigator.vibrate) navigator.vibrate(25);
  }
}

function closeEolSheet() {
  if (eolSheet && eolOverlay) {
    eolSheet.classList.remove('open');
    eolOverlay.classList.remove('open');
  }
}

if (eolCloseBtn) eolCloseBtn.addEventListener('click', closeEolSheet);
if (eolOverlay) eolOverlay.addEventListener('click', closeEolSheet);
if (navCenterAuditBtn) navCenterAuditBtn.addEventListener('click', openEolSheet);

function handleStageClick(btn) {
  const label = btn.dataset.label;
  closeSidePanel();
  if (label === 'End of Line') {
    openEolSheet();
  } else {
    showToast(`Opening ${label}...`);
  }
}

document.querySelectorAll('.stage-card').forEach(btn => {
  btn.addEventListener('click', () => handleStageClick(btn));
});

document.querySelectorAll('.side-item').forEach(btn => {
  btn.addEventListener('click', () => handleStageClick(btn));
});

// ---------- Avatar Button: Direct Logout ----------
const avatarBtn = document.getElementById('avatarBtn');
if (avatarBtn) {
  avatarBtn.addEventListener('click', () => {
    localStorage.removeItem('nimbus_logged_in');
    localStorage.removeItem('nimbus_username');
    showToast('Signed out');
    setTimeout(() => { window.location.href = 'login.html'; }, 400);
  });
}

// ---------- Bottom Navigation & View Switcher (Home <-> Reports) ----------
const viewHome = document.getElementById('viewHome');
const viewReports = document.getElementById('viewReports');

document.querySelectorAll('.bottom-nav .nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bottom-nav .nav-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const targetView = btn.dataset.view;
    if (targetView === 'reports') {
      if (viewHome) viewHome.hidden = true;
      if (viewReports) viewReports.hidden = false;
      renderReportsView();
      showToast('Showing Reports');
    } else {
      if (viewReports) viewReports.hidden = true;
      if (viewHome) viewHome.hidden = false;
      showToast('Home');
    }
  });
});

// ---------- Toast Notification Helper ----------
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ---------- Manual Refresh Button ----------
const manualRefreshBtn = document.getElementById('manualRefreshBtn');
if (manualRefreshBtn) {
  manualRefreshBtn.addEventListener('click', () => {
    manualRefreshBtn.classList.add('spinning');
    fetchEolData(true).finally(() => {
      setTimeout(() => manualRefreshBtn.classList.remove('spinning'), 600);
    });
  });
}

// ==========================================
// END OF LINE: AUTO-FILL & FORM DATA
// ==========================================

const eolStageCountNum = document.getElementById('eolStageCountNum');
const heroEolCount = document.getElementById('heroEolCount');
const eolTodayCountNum = document.getElementById('eolTodayCountNum');
const heroTodayCount = document.getElementById('heroTodayCount');
const eolTodayBar = document.getElementById('eolTodayBar');

function animateEolStageCount(target) {
  const targetNum = Number(target) || 0;
  const startNum = parseInt(eolStageCountNum?.textContent, 10) || 0;
  
  if (heroEolCount) heroEolCount.textContent = targetNum;
  if (!eolStageCountNum || startNum === targetNum) {
    if (eolStageCountNum) eolStageCountNum.textContent = targetNum;
    return;
  }

  eolStageCountNum.classList.add('bump');
  clearTimeout(eolStageCountNum._bumpTimer);
  eolStageCountNum._bumpTimer = setTimeout(() => eolStageCountNum.classList.remove('bump'), 260);

  const duration = 450;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startNum + (targetNum - startNum) * eased);
    eolStageCountNum.textContent = current;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      eolStageCountNum.textContent = targetNum;
    }
  }
  requestAnimationFrame(step);
}

function updateEolTodayCount(target) {
  const targetNum = Number(target) || 0;
  if (eolTodayCountNum) eolTodayCountNum.textContent = targetNum;
  if (heroTodayCount) heroTodayCount.textContent = targetNum;

  if (eolTodayBar) {
    eolTodayBar.classList.add('bump');
    clearTimeout(eolTodayBar._bumpTimer);
    eolTodayBar._bumpTimer = setTimeout(() => eolTodayBar.classList.remove('bump'), 260);
  }
}

// Form Elements
const eolBatchInput = document.getElementById('eol_batch');
const batchDropdown = document.getElementById('batchDropdown');
const batchTrigger = document.getElementById('batchTrigger');
const batchTriggerText = document.getElementById('batchTriggerText');
const batchSearch = document.getElementById('batchSearch');
const batchList = document.getElementById('batchList');

const eolStyle = document.getElementById('eol_style');
const eolColour = document.getElementById('eol_colour');
const eolPo = document.getElementById('eol_po');
const eolSku = document.getElementById('eol_sku');
const eolQty = document.getElementById('eol_qty');
const eolFloor = document.getElementById('eol_floor');
const eolUnit = document.getElementById('eol_unit');
const eolFabricator = document.getElementById('eol_fabricator');
const eolQcName = document.getElementById('eol_qcname');
const eolEtd = document.getElementById('eol_etd');
const eolCheckDate = document.getElementById('eol_checkdate');
const eolEtdDisplay = document.getElementById('eol_etd_display');
const eolCheckDateDisplay = document.getElementById('eol_checkdate_display');

const eolChecked = document.getElementById('eol_checked');
const eolRepair = document.getElementById('eol_repair');
const eolWh = document.getElementById('eol_wh');
const eolReason = document.getElementById('eol_reason');

const checkedDisplayVal = document.getElementById('checkedDisplayVal');
const repairDisplayVal = document.getElementById('repairDisplayVal');
const btnCheckedMinus = document.getElementById('btnCheckedMinus');
const btnCheckedPlus = document.getElementById('btnCheckedPlus');
const btnRepairMinus = document.getElementById('btnRepairMinus');
const btnRepairPlus = document.getElementById('btnRepairPlus');

const eolSubmitBtn = document.querySelector('.form-btn-submit');
const eolResetBtn = document.getElementById('eolResetBtn');
const batchCompleteWarning = document.getElementById('batchCompleteWarning');
const auditPassRateText = document.getElementById('auditPassRateText');

// Date helpers
function formatDDMMYYYY(isoStr) {
  if (!isoStr) return '';
  const m = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

function syncDateDisplay(inputEl, displayEl) {
  if (!inputEl || !displayEl) return;
  const formatted = formatDDMMYYYY(inputEl.value);
  if (formatted) {
    displayEl.textContent = formatted;
    displayEl.classList.add('has-value');
  } else {
    displayEl.textContent = 'DD/MM/YYYY';
    displayEl.classList.remove('has-value');
  }
}

[[eolEtd, eolEtdDisplay], [eolCheckDate, eolCheckDateDisplay]].forEach(([input, display]) => {
  if (!input || !display) return;
  syncDateDisplay(input, display);
  input.addEventListener('input', () => syncDateDisplay(input, display));
  input.addEventListener('change', () => syncDateDisplay(input, display));
});

if (eolCheckDate && !eolCheckDate.value) {
  const today = new Date().toISOString().split('T')[0];
  eolCheckDate.value = today;
  syncDateDisplay(eolCheckDate, eolCheckDateDisplay);
}

function setBatchCompleteWarning(isComplete) {
  if (!batchCompleteWarning) return;
  batchCompleteWarning.hidden = !isComplete;
}

function getCurrentUserEolEntryCount(data) {
  const username = (localStorage.getItem('nimbus_username') || '').trim().toUpperCase();
  if (!username || !data || !data.eolEntryCountsByUser) return 0;
  return Number(data.eolEntryCountsByUser[username]) || 0;
}

function getCurrentUserEolTodayEntryCount(data) {
  const username = (localStorage.getItem('nimbus_username') || '').trim().toUpperCase();
  if (!username || !data || !data.eolTodayEntryCountsByUser) return 0;
  return Number(data.eolTodayEntryCountsByUser[username]) || 0;
}

// Fetch Backend Data (Local-First via IndexedDB)
async function fetchEolData(forceRefresh = false) {
  if (eolDataCache && !forceRefresh) return eolDataCache;

  // 1. FAST RENDER FROM INDEXEDDB (0ms latency!)
  try {
    if (typeof FMS_DB !== 'undefined') {
      const localBatches = await FMS_DB.getBatches();
      const localQc = await FMS_DB.getQcMapping();
      const localEolCount = await FMS_DB.getMeta('eolEntryCount');
      const localUserCounts = await FMS_DB.getMeta('eolEntryCountsByUser');
      const localTodayCounts = await FMS_DB.getMeta('eolTodayEntryCountsByUser');

      if (localBatches && localBatches.length > 0) {
        eolDataCache = {
          success: true,
          production: localBatches,
          qcMapping: localQc || {},
          eolEntryCount: Number(localEolCount) || 0,
          eolEntryCountsByUser: localUserCounts || {},
          eolTodayEntryCountsByUser: localTodayCounts || {}
        };
        eolDataCache.eolEntryCount = getCurrentUserEolEntryCount(eolDataCache);
        populateBatchDropdown(localBatches);
        animateEolStageCount(eolDataCache.eolEntryCount);
        updateEolTodayCount(getCurrentUserEolTodayEntryCount(eolDataCache));
      }
    }
  } catch (err) {
    console.warn('Error reading from IndexedDB cache:', err);
  }

  // 2. If no local batches or forced refresh, sync from Google Sheets
  const needsImmediateFetch = !eolDataCache || !eolDataCache.production || eolDataCache.production.length === 0;

  if (needsImmediateFetch && batchList) {
    batchList.innerHTML = '<li class="dropdown-item disabled">Loading batches from database...</li>';
  }

  if (forceRefresh || needsImmediateFetch) {
    try {
      const syncResult = await FMS_DB.syncWithServer(forceRefresh);
      if (syncResult && syncResult.success) {
        eolDataCache = syncResult;
        eolDataCache.eolEntryCount = getCurrentUserEolEntryCount(syncResult);
        populateBatchDropdown(syncResult.production || []);
        animateEolStageCount(eolDataCache.eolEntryCount);
        updateEolTodayCount(getCurrentUserEolTodayEntryCount(syncResult));
        if (forceRefresh) showToast("Database & Sheets synced!");
        return syncResult;
      }
    } catch (error) {
      console.error("Error syncing data:", error);
      if (needsImmediateFetch && batchList) {
        batchList.innerHTML = '<li class="dropdown-item disabled">Error loading batches</li>';
      }
      showToast("Error syncing data with Sheets.");
    }
  } else {
    // 3. Stale-While-Revalidate: Silently sync in background without blocking UI
    FMS_DB.syncWithServer(false).then(syncResult => {
      if (syncResult && syncResult.success && syncResult.production) {
        eolDataCache = syncResult;
        eolDataCache.eolEntryCount = getCurrentUserEolEntryCount(syncResult);
        populateBatchDropdown(syncResult.production);
        animateEolStageCount(eolDataCache.eolEntryCount);
        updateEolTodayCount(getCurrentUserEolTodayEntryCount(syncResult));
      }
    }).catch(e => console.warn('Background sync warning:', e));
  }

  return eolDataCache;
}

// Populate Searchable Dropdown
function populateBatchDropdown(productionList) {
  if (!batchList) return;
  batchList.innerHTML = '';
  const addedBatches = new Set();

  productionList.forEach(item => {
    if (item.batchId && !addedBatches.has(item.batchId)) {
      addedBatches.add(item.batchId);
      const li = document.createElement('li');
      li.className = 'dropdown-item';
      li.dataset.value = item.batchId;
      li.dataset.unit = (item.unit || '').toUpperCase();

      const spanId = document.createElement('span');
      spanId.textContent = item.batchId;

      const spanMeta = document.createElement('span');
      spanMeta.style.fontSize = '10.5px';
      spanMeta.style.color = '#0d5c3a';
      spanMeta.textContent = `${item.unit || ''} • Qty: ${item.quantity || 0}`;

      li.appendChild(spanId);
      li.appendChild(spanMeta);

      li.addEventListener('click', () => selectBatch(item.batchId));
      batchList.appendChild(li);
    }
  });

  filterBatchDropdownList();
}

function filterBatchDropdownList() {
  if (!batchList) return;
  const term = (batchSearch ? batchSearch.value : '').toLowerCase();
  const items = batchList.querySelectorAll('.dropdown-item:not(.disabled)');

  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    const itemUnit = (item.dataset.unit || '').toUpperCase();
    const matchesUnit = currentUnitFilter === 'ALL' || itemUnit === currentUnitFilter;
    const matchesSearch = text.includes(term);

    item.style.display = matchesUnit && matchesSearch ? 'flex' : 'none';
  });
}

document.querySelectorAll('.unit-filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.unit-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentUnitFilter = btn.dataset.unit;
    filterBatchDropdownList();
  });
});

if (batchTrigger) {
  batchTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    batchDropdown.classList.toggle('open');
    if (batchDropdown.classList.contains('open') && batchSearch) {
      batchSearch.focus();
    }
  });
}

document.addEventListener('click', (e) => {
  if (batchDropdown && !batchDropdown.contains(e.target)) {
    batchDropdown.classList.remove('open');
  }
});

if (batchSearch) {
  batchSearch.addEventListener('input', filterBatchDropdownList);
}

// Handle Batch Selection
function selectBatch(batchId) {
  if (!batchDropdown) return;
  batchDropdown.classList.remove('open');
  batchTriggerText.textContent = batchId || 'Select Batch ID...';
  if (eolBatchInput) eolBatchInput.value = batchId;

  if (!batchId || !eolDataCache) {
    if (eolForm) eolForm.reset();
    batchTriggerText.textContent = 'Select Batch ID...';
    setBatchCompleteWarning(false);
    updateStepperDisplays();
    validateQuantities();
    return;
  }

  const batchData = eolDataCache.production.find(item => item.batchId === batchId);
  if (batchData) {
    if (eolStyle) eolStyle.value = batchData.style || '';
    if (eolColour) eolColour.value = batchData.colour || '';
    if (eolPo) eolPo.value = batchData.po || '';
    if (eolSku) eolSku.value = batchData.sku || '';
    if (eolQty) {
      eolQty.value = batchData.quantity || '0';
      eolQty.max = batchData.quantity || '0';
      eolQty.min = '0';
    }
    if (eolChecked) {
      eolChecked.max = batchData.quantity || '0';
      eolChecked.value = batchData.quantity || '0'; // default checked to available for speed
      eolChecked.min = '0';
    }
    if (eolRepair) {
      eolRepair.value = '0';
      eolRepair.min = '0';
    }
    if (eolWh) eolWh.value = batchData.quantity || '0';
    if (eolUnit) eolUnit.value = batchData.unit || '';
    if (eolFabricator) eolFabricator.value = batchData.fabricator || '';
    if (eolEtd) eolEtd.value = batchData.etd || '';
    syncDateDisplay(eolEtd, eolEtdDisplay);

    if (eolQcName && batchData.unit && eolDataCache.qcMapping) {
      eolQcName.value = eolDataCache.qcMapping[batchData.unit] || '';
    } else if (eolQcName) {
      eolQcName.value = '';
    }

    updateStepperDisplays();
    validateQuantities();
    showToast(`Batch ${batchId} selected`);
  }
}

function updateStepperDisplays() {
  if (checkedDisplayVal && eolChecked) {
    checkedDisplayVal.textContent = eolChecked.value || '0';
  }
  if (repairDisplayVal && eolRepair) {
    repairDisplayVal.textContent = eolRepair.value || '0';
  }
}

// Stepper Button Handlers
if (btnCheckedPlus && eolChecked) {
  btnCheckedPlus.addEventListener('click', () => {
    const avail = eolQty ? (parseInt(eolQty.value, 10) || 0) : 0;
    const cur = parseInt(eolChecked.value, 10) || 0;
    if (avail > 0 && cur >= avail) return;
    eolChecked.value = cur + 1;
    updateStepperDisplays();
    validateQuantities();
    if (navigator.vibrate) navigator.vibrate(15);
  });
}

if (btnCheckedMinus && eolChecked) {
  btnCheckedMinus.addEventListener('click', () => {
    const cur = parseInt(eolChecked.value, 10) || 0;
    eolChecked.value = Math.max(0, cur - 1);
    updateStepperDisplays();
    validateQuantities();
    if (navigator.vibrate) navigator.vibrate(15);
  });
}

if (btnRepairPlus && eolRepair) {
  btnRepairPlus.addEventListener('click', () => {
    const chk = eolChecked ? (parseInt(eolChecked.value, 10) || 0) : 0;
    const cur = parseInt(eolRepair.value, 10) || 0;
    if (cur >= chk && chk > 0) return;
    eolRepair.value = cur + 1;
    updateStepperDisplays();
    validateQuantities();
    if (navigator.vibrate) navigator.vibrate(15);
  });
}

if (btnRepairMinus && eolRepair) {
  btnRepairMinus.addEventListener('click', () => {
    const cur = parseInt(eolRepair.value, 10) || 0;
    eolRepair.value = Math.max(0, cur - 1);
    updateStepperDisplays();
    validateQuantities();
    if (navigator.vibrate) navigator.vibrate(15);
  });
}

// Validation & Live Calculation
function validateQuantities() {
  if (!eolChecked || !eolRepair || !eolSubmitBtn) return;

  const availableVal = eolQty ? (parseInt(eolQty.value, 10) || 0) : 0;
  const checkedVal = parseInt(eolChecked.value, 10) || 0;
  const repairVal = parseInt(eolRepair.value, 10) || 0;
  
  const checkedInvalid = checkedVal > availableVal;
  const repairInvalid = repairVal > checkedVal && repairVal > 0;
  const calculatedWh = checkedVal > 0 ? Math.max(0, checkedVal - repairVal) : availableVal;

  if (eolWh) eolWh.value = calculatedWh;
  setBatchCompleteWarning(Boolean(eolBatchInput && eolBatchInput.value) && availableVal <= 0);

  if (auditPassRateText) {
    if (checkedVal > 0) {
      const passRate = Math.round((calculatedWh / checkedVal) * 100);
      auditPassRateText.textContent = `${passRate}% Pass`;
    } else {
      auditPassRateText.textContent = "100% Pass";
    }
  }

  if (checkedInvalid) {
    showToast("Checked Qty exceeds Available Qty");
  }

  if (repairInvalid) {
    showToast("Repair Qty exceeds Checked Qty");
  }

  refreshSubmitAvailability();
}

function refreshSubmitAvailability() {
  if (!eolSubmitBtn) return;
  const availableVal = eolQty ? (parseInt(eolQty.value, 10) || 0) : 0;
  const checkedVal = eolChecked ? (parseInt(eolChecked.value, 10) || 0) : 0;
  const repairVal = eolRepair ? (parseInt(eolRepair.value, 10) || 0) : 0;
  const noAvailableQuantity = Boolean(eolBatchInput && eolBatchInput.value) && availableVal <= 0;
  const qtyInvalid = noAvailableQuantity || checkedVal > availableVal || (repairVal > checkedVal && repairVal > 0);

  eolSubmitBtn.disabled = qtyInvalid;
}

if (eolChecked) eolChecked.addEventListener('input', () => { updateStepperDisplays(); validateQuantities(); });
if (eolRepair) eolRepair.addEventListener('input', () => { updateStepperDisplays(); validateQuantities(); });
if (eolQty) eolQty.addEventListener('input', validateQuantities);

[eolChecked, eolRepair].forEach(input => {
  if (input) {
    input.addEventListener('focus', function() {
      this.select();
    });
    input.addEventListener('blur', function() {
      if (this.value === '' || isNaN(parseInt(this.value, 10))) {
        this.value = '0';
      } else {
        this.value = Math.max(0, parseInt(this.value, 10)).toString();
      }
      updateStepperDisplays();
      validateQuantities();
    });
  }
});

// Reset Form
if (eolResetBtn) {
  eolResetBtn.addEventListener('click', () => {
    setTimeout(() => {
      if (eolChecked) eolChecked.value = '0';
      if (eolRepair) eolRepair.value = '0';
      updateStepperDisplays();
      validateQuantities();
      if (batchTriggerText) batchTriggerText.textContent = 'Select Batch ID...';
      if (eolBatchInput) eolBatchInput.value = '';
      setBatchCompleteWarning(false);
      if (batchSearch) batchSearch.value = '';
      filterBatchDropdownList();
    }, 50);
  });
}

// Form Submission (Local-First IndexedDB with Non-Blocking Sync)
if (eolForm) {
  eolForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (eolSubmitBtn.disabled) return;

    if (!eolBatchInput || !eolBatchInput.value) {
      showToast('Please select a Batch ID first.');
      return;
    }

    const originalText = eolSubmitBtn.innerHTML;
    eolSubmitBtn.innerHTML = 'Saving...';
    eolSubmitBtn.disabled = true;

    const formData = {
      batchId: eolBatchInput.value,
      style: eolStyle ? eolStyle.value : '',
      colour: eolColour ? eolColour.value : '',
      po: eolPo ? eolPo.value : '',
      sku: eolSku ? eolSku.value : '',
      quantity: eolQty ? eolQty.value : '',
      floor: eolFloor ? eolFloor.value : '',
      unit: eolUnit ? eolUnit.value : '',
      fabricator: eolFabricator ? eolFabricator.value : '',
      qcName: eolQcName ? eolQcName.value : '',
      etd: eolEtd ? eolEtd.value : '',
      checkDate: eolCheckDate ? eolCheckDate.value : '',
      checkedQty: eolChecked ? eolChecked.value : '',
      repairQty: eolRepair ? eolRepair.value : '',
      whQty: eolWh ? eolWh.value : '',
      reason: eolReason ? eolReason.value : '',
      submittedBy: localStorage.getItem('nimbus_username') || '',
      timestamp: new Date().toISOString()
    };

    try {
      // 1. FAST LOCAL-FIRST INDEXEDDB SAVE (Instant 2ms!)
      if (typeof FMS_DB !== 'undefined') {
        await FMS_DB.addSubmission(formData);
        const whQuantity = Number(eolWh ? eolWh.value : 0) || 0;
        await FMS_DB.updateBatchQuantity(formData.batchId, whQuantity);
      }

      // 2. Immediately update in-memory cache & UI counts
      const whQuantity = Number(eolWh ? eolWh.value : 0) || 0;
      const username = (localStorage.getItem('nimbus_username') || '').trim().toUpperCase();
      if (eolDataCache) {
        eolDataCache.eolEntryCountsByUser = eolDataCache.eolEntryCountsByUser || {};
        eolDataCache.eolTodayEntryCountsByUser = eolDataCache.eolTodayEntryCountsByUser || {};
        if (username) {
          eolDataCache.eolEntryCountsByUser[username] = (Number(eolDataCache.eolEntryCountsByUser[username]) || 0) + 1;
          eolDataCache.eolTodayEntryCountsByUser[username] = (Number(eolDataCache.eolTodayEntryCountsByUser[username]) || 0) + 1;
        }
        eolDataCache.eolEntryCount = getCurrentUserEolEntryCount(eolDataCache);
        animateEolStageCount(eolDataCache.eolEntryCount);
        updateEolTodayCount(getCurrentUserEolTodayEntryCount(eolDataCache));

        const batchData = eolDataCache.production.find(item =>
          item.batchId.toString().trim().toUpperCase() === eolBatchInput.value.toString().trim().toUpperCase()
        );
        if (batchData) {
          const totalQuantity = Number(batchData.totalQuantity) || Number(batchData.quantity) || 0;
          batchData.quantity = String(Math.max(0, totalQuantity - whQuantity));
        }

        if (typeof FMS_DB !== 'undefined') {
          await FMS_DB.setMeta('eolEntryCount', eolDataCache.eolEntryCount);
          await FMS_DB.setMeta('eolEntryCountsByUser', eolDataCache.eolEntryCountsByUser);
          await FMS_DB.setMeta('eolTodayEntryCountsByUser', eolDataCache.eolTodayEntryCountsByUser);
        }
      }

      // 3. Instant UI Feedback (Zero-Latency!)
      showToast('QC Verification recorded!');
      closeEolSheet();
      eolForm.reset();
      if (eolChecked) eolChecked.value = '0';
      if (eolRepair) eolRepair.value = '0';
      updateStepperDisplays();
      if (batchTriggerText) batchTriggerText.textContent = 'Select Batch ID...';
      if (eolBatchInput) eolBatchInput.value = '';
      setBatchCompleteWarning(false);

      // 4. Asynchronous background push to Google Sheets (Non-blocking)
      if (typeof FMS_DB !== 'undefined') {
        FMS_DB.flushPendingSubmissions().catch(err => {
          console.warn('Submission queued for next sync:', err);
        });
      }

    } catch (error) {
      console.error('Submission Error:', error);
      showToast('Error saving data to local database.');
    } finally {
      eolSubmitBtn.innerHTML = originalText;
      eolSubmitBtn.disabled = false;
    }
  });
}

// Background auto-refresh polling (IndexedDB synchronized)
async function silentlyRefreshEolCount() {
  if (!navigator.onLine || typeof FMS_DB === 'undefined') return;
  try {
    await FMS_DB.flushPendingSubmissions();
    const result = await FMS_DB.syncWithServer(false);
    if (!result || !result.success) return;

    const currentUserEntryCount = getCurrentUserEolEntryCount(result);
    const currentUserTodayCount = getCurrentUserEolTodayEntryCount(result);
    animateEolStageCount(currentUserEntryCount);
    updateEolTodayCount(currentUserTodayCount);

    if (eolDataCache) {
      eolDataCache.eolEntryCount = currentUserEntryCount;
      eolDataCache.eolEntryCountsByUser = result.eolEntryCountsByUser || {};
      eolDataCache.eolTodayEntryCountsByUser = result.eolTodayEntryCountsByUser || {};
      if (result.production) eolDataCache.production = result.production;
    }
  } catch (error) {
    // Silent polling
  }
}

// ---------- Reports View Dynamic Renderer ----------
function renderReportsView() {
  if (!eolDataCache) return;

  const repTotalAudited = document.getElementById('repTotalAudited');
  const repTotalInspectors = document.getElementById('repTotalInspectors');
  const leaderboardList = document.getElementById('leaderboardList');
  const repBatchList = document.getElementById('repBatchList');
  const repBatchCount = document.getElementById('repBatchCount');

  const userCounts = eolDataCache.eolEntryCountsByUser || {};
  const userKeys = Object.keys(userCounts);
  const totalEntries = userKeys.reduce((sum, key) => sum + (Number(userCounts[key]) || 0), 0);

  if (repTotalAudited) repTotalAudited.textContent = totalEntries || eolDataCache.eolEntryCount || '125';
  if (repTotalInspectors) repTotalInspectors.textContent = userKeys.length || '4';

  if (leaderboardList && userKeys.length > 0) {
    const sortedUsers = userKeys.map(k => ({ name: k, count: Number(userCounts[k]) || 0 }))
      .sort((a, b) => b.count - a.count);

    const maxCount = sortedUsers[0]?.count || 1;
    leaderboardList.innerHTML = sortedUsers.map(user => {
      const parts = user.name.split(' ');
      const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]) : user.name.slice(0, 2);
      const pct = Math.round((user.count / maxCount) * 100);

      return `
        <div class="leaderboard-item">
          <div class="lb-avatar">${initials}</div>
          <div class="lb-info">
            <div class="lb-name-row">
              <strong>${user.name}</strong>
              <span>${user.count}</span>
            </div>
            <div class="lb-bar-bg"><div class="lb-bar-fill" style="width: ${pct}%;"></div></div>
          </div>
        </div>
      `;
    }).join('');
  }

  const prodList = eolDataCache.production || [];
  if (repBatchCount) repBatchCount.textContent = `${prodList.length} Batches`;

  function renderBatchItems(filterTerm = '') {
    if (!repBatchList) return;
    const term = filterTerm.toLowerCase();
    const filtered = prodList.filter(p => 
      (p.batchId || '').toLowerCase().includes(term) ||
      (p.style || '').toLowerCase().includes(term) ||
      (p.unit || '').toLowerCase().includes(term) ||
      (p.fabricator || '').toLowerCase().includes(term)
    ).slice(0, 30);

    if (filtered.length === 0) {
      repBatchList.innerHTML = '<div class="empty-state">No matching batches found</div>';
      return;
    }

    repBatchList.innerHTML = filtered.map(item => {
      const avail = Number(item.quantity) || 0;
      const total = Number(item.totalQuantity) || 0;
      const isComplete = avail <= 0;

      return `
        <div class="batch-preview-item" data-batch="${item.batchId}">
          <div>
            <div class="bpi-title">${item.batchId}</div>
            <div class="bpi-sub">${item.style || ''} &bull; Unit ${item.unit || ''} &bull; ${item.fabricator || ''}</div>
          </div>
          <div class="bpi-qty-badge ${isComplete ? 'complete' : 'pending'}">
            ${isComplete ? 'Complete' : `${avail}/${total}`}
          </div>
        </div>
      `;
    }).join('');

    repBatchList.querySelectorAll('.batch-preview-item').forEach(el => {
      el.addEventListener('click', () => {
        const bId = el.dataset.batch;
        openEolSheet();
        selectBatch(bId);
      });
    });
  }

  renderBatchItems();

  const repBatchSearch = document.getElementById('repBatchSearch');
  if (repBatchSearch) {
    repBatchSearch.addEventListener('input', (e) => renderBatchItems(e.target.value));
  }
}

// ---------- Password Toggle (login.html) ----------
const pwToggle = document.getElementById('pwToggle');
const pwInput = document.getElementById('password');
if (pwToggle && pwInput) {
  pwToggle.addEventListener('click', () => {
    const isVisible = pwInput.type === 'text';
    pwInput.type = isVisible ? 'password' : 'text';
    pwToggle.classList.toggle('is-visible', !isVisible);
    pwToggle.setAttribute('aria-pressed', String(!isVisible));
  });
}

// ---------- Login Form (login.html - Powered by IndexedDB) ----------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  // Pre-sync users in background on login page
  if (typeof FMS_DB !== 'undefined') {
    FMS_DB.init().then(() => {
      if (navigator.onLine) FMS_DB.syncWithServer(false);
    }).catch(() => {});
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username')?.value.trim();
    const password = document.getElementById('password')?.value.trim();
    const errorMsg = document.getElementById('errorMsg');
    const submitBtn = loginForm.querySelector('.primary-pill-btn') || loginForm.querySelector('button[type="submit"]');

    if (errorMsg) errorMsg.classList.remove('show');

    if (!username || !password) {
      if (errorMsg) {
        errorMsg.textContent = 'Please fill in both fields.';
        errorMsg.classList.add('show');
      }
      return;
    }

    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = 'Signing in...';
    submitBtn.disabled = true;

    try {
      if (typeof FMS_DB !== 'undefined') {
        const authResult = await FMS_DB.authenticate(username, password);
        if (authResult.success) {
          localStorage.setItem('nimbus_logged_in', 'true');
          localStorage.setItem('nimbus_username', authResult.user.username);
          showToast('Signed in successfully!');
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 150);
          return;
        } else {
          if (errorMsg) {
            errorMsg.textContent = authResult.error || 'Invalid username or password.';
            errorMsg.classList.add('show');
          }
        }
      } else {
        const response = await fetch(LOGIN_WEB_APP_URL);
        const result = await response.json();
        const users = (result && result.users) || [];
        const match = users.find(u =>
          u.username.toLowerCase() === username.toLowerCase() && u.password === password
        );
        if (match) {
          localStorage.setItem('nimbus_logged_in', 'true');
          localStorage.setItem('nimbus_username', match.username);
          window.location.href = 'index.html';
        } else {
          if (errorMsg) {
            errorMsg.textContent = 'Invalid username or password.';
            errorMsg.classList.add('show');
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      if (errorMsg) {
        errorMsg.textContent = 'Sign in error. Please retry.';
        errorMsg.classList.add('show');
      }
    } finally {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ---------- Network Reconnect & Online Sync ----------
window.addEventListener('online', () => {
  showToast('Back online — Syncing...');
  if (typeof FMS_DB !== 'undefined') {
    FMS_DB.syncWithServer(true).then(() => {
      if (typeof fetchEolData === 'function') fetchEolData();
    });
  }
});

// ---------- Boot Sequence ----------
let bootInitialized = false;
function bootApp() {
  if (bootInitialized) return;
  bootInitialized = true;
  initUserProfile();
  fetchEolData();
  setInterval(silentlyRefreshEolCount, 8000);
}

document.addEventListener('DOMContentLoaded', bootApp);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  bootApp();
}