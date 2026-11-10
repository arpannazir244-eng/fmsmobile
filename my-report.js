// ═════════════════════════════════════════════════════════════
// FMS WORKSPACE — MY QC REPORT CONTROLLER (my-report.js)
// STRICTLY Filtered to Logged-in User — 100% Sourced from "END OF LINE" Sheet
// Auto-Refreshes Live Data from Google Sheets Every 5 Seconds
// ═════════════════════════════════════════════════════════════

const EOL_SPREADSHEET_ID = '1uXjAFkcrWTF_sDDSXOoisl-q97n3vbHqa0JeSZ0fn2Q';
const EOL_SHEET_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${EOL_SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=END%20OF%20LINE&tq=` + encodeURIComponent("select A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S where A is not null");

let myAllUserRecords = [];
let myFilteredRecords = [];
let activeDatePreset = 'ALL';
let customDateFrom = '';
let customDateTo = '';
let currentSearchQuery = '';
let autoRefreshTimer = null;
let isRefreshingLive = false;

// ---------- Toast Notification Helper ----------
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ---------- Format Numbers with Commas ----------
function formatNumber(num) {
  const n = Number(num) || 0;
  return n.toLocaleString('en-IN');
}

// ---------- Standard Date Normalization (YYYY-MM-DD) ----------
function normalizeDateStr(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Date(yyyy, m, d) from Google Sheets GViz
  const gvizMatch = s.match(/Date\((\d+),\s*(\d+),\s*(\d+)/i);
  if (gvizMatch) {
    const y = gvizMatch[1];
    const m = String(parseInt(gvizMatch[2], 10) + 1).padStart(2, '0');
    const d = String(gvizMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // JavaScript timestamp / ISO string
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Recent';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parts[0];
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${months[m - 1] || m} ${y}`;
  }
  return dateStr;
}

// ---------- Clean Strict User Matching ----------
function isUserMatch(recordUser, loggedIn) {
  if (!recordUser || !loggedIn) return false;
  const r = recordUser.toString().trim().toLowerCase();
  const l = loggedIn.toString().trim().toLowerCase();
  if (!r || !l) return false;

  // Exact match or contains full name
  if (r === l) return true;
  if (r.includes(l) || l.includes(r)) return true;

  // Name tokens match (e.g., "Arun Bairagi" matching "ARUN BAIRAGI")
  const rTokens = r.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const lTokens = l.replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  if (rTokens.length >= 2 && lTokens.length >= 2) {
    const firstMatches = rTokens[0] === lTokens[0];
    const lastMatches = rTokens[rTokens.length - 1] === lTokens[lTokens.length - 1];
    return firstMatches && lastMatches;
  }

  return false;
}

// ---------- User Profile Setup ----------
function initUserProfile() {
  const username = localStorage.getItem('nimbus_username') || 'Inspector';
  const cleanName = username.trim();
  const parts = cleanName.split(' ');
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : cleanName.slice(0, 2).toUpperCase();

  const userAvatarText = document.getElementById('userAvatarText');
  if (userAvatarText) userAvatarText.textContent = initials;

  const heroAvatar = document.getElementById('heroAvatar');
  if (heroAvatar) heroAvatar.textContent = initials;

  const heroUserName = document.getElementById('heroUserName');
  if (heroUserName) heroUserName.textContent = cleanName;

  const heroUserNameSub = document.getElementById('heroUserNameSub');
  if (heroUserNameSub) heroUserNameSub.textContent = cleanName;

  const profileUserName = document.getElementById('profileUserName');
  if (profileUserName) profileUserName.textContent = cleanName;

  const profileAvatarText = document.getElementById('profileAvatarText');
  if (profileAvatarText) profileAvatarText.textContent = initials;

  // Bind profile drawer toggles
  const avatarBtn = document.getElementById('avatarBtn');
  const profileSheet = document.getElementById('profileSheet');
  const profileOverlay = document.getElementById('profileOverlay');
  const profileCloseBtn = document.getElementById('profileCloseBtn');
  const profileLogoutBtn = document.getElementById('profileLogoutBtn');

  if (avatarBtn && profileSheet && profileOverlay) {
    avatarBtn.addEventListener('click', () => {
      profileSheet.classList.add('open');
      profileOverlay.classList.add('open');
    });
  }

  if (profileCloseBtn && profileSheet && profileOverlay) {
    profileCloseBtn.addEventListener('click', () => {
      profileSheet.classList.remove('open');
      profileOverlay.classList.remove('open');
    });
  }

  if (profileOverlay && profileSheet) {
    profileOverlay.addEventListener('click', () => {
      profileSheet.classList.remove('open');
      profileOverlay.classList.remove('open');
    });
  }

  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to sign out?')) {
        localStorage.removeItem('nimbus_logged_in');
        localStorage.removeItem('nimbus_username');
        window.location.href = 'login.html';
      }
    });
  }
}

// ---------- Fetch Live Data Directly from "END OF LINE" Google Sheet ----------
async function fetchLiveEndOfLineFromSheet(forceNocache = false) {
  if (!navigator.onLine) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const nocacheParam = `&_nocache=${Date.now()}`;
    const url = `${EOL_SHEET_GVIZ_URL}${nocacheParam}`;
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
    if (!match || !match[1]) return null;

    const json = JSON.parse(match[1]);
    if (!json.table || !Array.isArray(json.table.rows)) return null;

    const getCol = (c, idx) => {
      if (!c || c.length <= idx || !c[idx]) return '';
      const cell = c[idx];
      return cell.f !== undefined && cell.f !== null ? cell.f : (cell.v !== undefined && cell.v !== null ? cell.v : '');
    };

    const getNum = (c, idx) => {
      if (!c || c.length <= idx || !c[idx] || c[idx].v === undefined || c[idx].v === null) return 0;
      return Number(c[idx].v) || 0;
    };

    const records = [];
    json.table.rows.forEach((r, idx) => {
      const c = r.c;
      if (!c || !c[0] || !c[0].v) return;

      const batchId = String(getCol(c, 0)).trim();
      if (!batchId) return;

      records.push({
        id: idx + 1,
        batchId: batchId,
        style: String(getCol(c, 1)).trim(),
        colour: String(getCol(c, 2)).trim(),
        po: String(getCol(c, 3)).trim(),
        sku: String(getCol(c, 4)).trim(),
        orderQty: getNum(c, 5),
        floor: String(getCol(c, 6)).trim(),
        unit: String(getCol(c, 7)).trim().toUpperCase(),
        fabricator: String(getCol(c, 8)).trim(),
        qcName: String(getCol(c, 9)).trim(),
        etd: normalizeDateStr(getCol(c, 10)),
        checkDate: normalizeDateStr(getCol(c, 11)),
        checkedQty: getNum(c, 12),
        repairQty: getNum(c, 13),
        whQty: getNum(c, 14),
        reason: String(getCol(c, 15)).trim(),
        submittedBy: String(getCol(c, 16)).trim(),
        timestamp: String(getCol(c, 17)).trim(),
        repairCategory: String(getCol(c, 18)).trim()
      });
    });

    if (records.length > 0) {
      try {
        localStorage.setItem('fms_cached_end_of_line_sheet', JSON.stringify(records));
      } catch (e) {}
      return records;
    }
    return null;
  } catch (err) {
    console.warn('Live fetch from END OF LINE sheet failed:', err);
    return null;
  }
}

// ---------- Load Data Engine (Strictly END OF LINE Google Sheet) ----------
async function loadQcData(forceSync = false, isSilent = false) {
  const listEl = document.getElementById('myRepEntriesList');

  // Only show the loading spinner on initial cold start (NOT during silent 5s background auto-refresh)
  if (!isSilent && listEl && myAllUserRecords.length === 0) {
    listEl.innerHTML = `
      <div class="my-rep-empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1.2s linear infinite;">
          <circle cx="12" cy="10"></circle>
          <path d="M12 2a10 10 0 0 1 10 10"></path>
        </svg>
        <h4>Loading Inspection Data...</h4>
        <p>Connecting to END OF LINE sheet</p>
      </div>`;
  }

  // Visual pulse on live sync indicator
  const liveDot = document.querySelector('.mrh-dot');
  if (liveDot) {
    liveDot.style.transform = 'scale(1.4)';
    setTimeout(() => { liveDot.style.transform = 'scale(1)'; }, 400);
  }

  let sheetRecords = null;

  // 1. Try Live Google Sheet (Sheet: "END OF LINE")
  if (navigator.onLine || forceSync) {
    sheetRecords = await fetchLiveEndOfLineFromSheet(forceSync);
  }

  // 2. Fallback to localStorage Cache
  if (!sheetRecords || sheetRecords.length === 0) {
    try {
      const cached = localStorage.getItem('fms_cached_end_of_line_sheet');
      if (cached) {
        sheetRecords = JSON.parse(cached);
      }
    } catch (e) {}
  }

  // 3. Fallback to Bundled Data (339 authentic records from END OF LINE sheet)
  if (!sheetRecords || sheetRecords.length === 0) {
    if (typeof window.BUNDLED_END_OF_LINE !== 'undefined' && Array.isArray(window.BUNDLED_END_OF_LINE) && window.BUNDLED_END_OF_LINE.length > 0) {
      sheetRecords = window.BUNDLED_END_OF_LINE;
    } else {
      try {
        const res = await fetch('end_of_line_data.json', { cache: 'no-store' });
        if (res.ok) sheetRecords = await res.json();
      } catch (e) {}
    }
  }

  const allRecords = Array.isArray(sheetRecords) ? [...sheetRecords] : [];

  // 4. STRICT FILTER TO LOGGED-IN USER ONLY (FROM END OF LINE SHEET)
  // If user has 0 entries in END OF LINE sheet (e.g. Arpan Nazir), count is strictly 0!
  const loggedInUser = (localStorage.getItem('nimbus_username') || 'Inspector').trim();

  const userEntries = [];
  const seenKeys = new Set();

  allRecords.forEach(r => {
    if (!r) return;
    const batchId = String(r.batchId || '').trim();
    if (!batchId) return;

    const subBy = (r.submittedBy || '').trim();
    const qc = (r.qcName || '').trim();

    // Check if entry belongs to logged in user
    if (!isUserMatch(subBy, loggedInUser) && !isUserMatch(qc, loggedInUser)) {
      return;
    }

    const checkDate = normalizeDateStr(r.checkDate || r.etd || r.timestamp);
    const checkedQty = Number(r.checkedQty) || 0;
    const repairQty = Number(r.repairQty) || 0;
    const whQty = Number(r.whQty) || 0;

    const key = `${batchId}__${checkDate}__${checkedQty}__${repairQty}__${r.id || ''}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      userEntries.push({
        id: r.id,
        batchId: batchId,
        style: String(r.style || '').trim(),
        colour: String(r.colour || '').trim(),
        po: String(r.po || '').trim(),
        sku: String(r.sku || '').trim(),
        unit: String(r.unit || '').trim().toUpperCase(),
        fabricator: String(r.fabricator || '').trim(),
        orderQty: Number(r.orderQty) || 0,
        checkedQty: checkedQty,
        repairQty: repairQty,
        whQty: whQty,
        reason: String(r.reason || '').trim(),
        repairCategory: String(r.repairCategory || '').trim(),
        qcName: qc || subBy || loggedInUser,
        submittedBy: subBy || qc || loggedInUser,
        checkDate: checkDate,
        timestamp: r.timestamp || (checkDate ? new Date(checkDate).getTime() : Date.now())
      });
    }
  });

  // Sort descending by checkDate / timestamp
  userEntries.sort((a, b) => {
    const dateA = a.checkDate || '';
    const dateB = b.checkDate || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return (b.id || 0) - (a.id || 0);
  });

  myAllUserRecords = userEntries;

  // Apply active date and search filters and render to DOM
  applyFiltersAndRender();
  window.REPORT_READY = true;
}

// ---------- Date Range Calculations ----------
function getDateRangeFromPreset(preset) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  switch (preset) {
    case 'TODAY':
      return { from: todayStr, to: todayStr, label: 'Today' };

    case 'YESTERDAY': {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split('T')[0];
      return { from: yestStr, to: yestStr, label: 'Yesterday' };
    }

    case '7DAYS': {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 6);
      const past7Str = past7.toISOString().split('T')[0];
      return { from: past7Str, to: todayStr, label: 'Last 7 Days' };
    }

    case 'MONTH': {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const startOfMonth = `${y}-${m}-01`;
      return { from: startOfMonth, to: todayStr, label: 'This Month' };
    }

    case 'ALL':
    default:
      return { from: '', to: '', label: 'All Time' };
  }
}

// ---------- Filter Engine ----------
function applyFiltersAndRender() {
  const search = currentSearchQuery.trim().toLowerCase();

  // Determine active date boundaries
  let filterFrom = '';
  let filterTo = '';
  let presetLabel = 'All Time';

  if (customDateFrom || customDateTo) {
    filterFrom = customDateFrom;
    filterTo = customDateTo;
    presetLabel = `${formatDisplayDate(filterFrom) || 'Start'} &rarr; ${formatDisplayDate(filterTo) || 'Now'}`;
  } else {
    const range = getDateRangeFromPreset(activeDatePreset);
    filterFrom = range.from;
    filterTo = range.to;
    presetLabel = range.label;
  }

  const presetLabelEl = document.getElementById('activeDatePresetLabel');
  if (presetLabelEl) presetLabelEl.innerHTML = presetLabel;

  // Filter records
  myFilteredRecords = myAllUserRecords.filter(item => {
    // 1. Date Filter
    if (filterFrom && item.checkDate && item.checkDate < filterFrom) return false;
    if (filterTo && item.checkDate && item.checkDate > filterTo) return false;

    // 2. Search Filter
    if (search) {
      const haystack = [
        item.batchId,
        item.style,
        item.colour,
        item.po,
        item.sku,
        item.unit,
        item.fabricator,
        item.reason,
        item.repairCategory
      ].join(' ').toLowerCase();

      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  // Calculate KPIs
  let totalEntries = myFilteredRecords.length;
  let totalChecked = 0;
  let totalWh = 0;
  let totalRepair = 0;

  myFilteredRecords.forEach(r => {
    totalChecked += (r.checkedQty || 0);
    totalWh += (r.whQty || 0);
    totalRepair += (r.repairQty || 0);
  });

  // Render KPIs to DOM
  const elEntries = document.getElementById('kpiTotalEntries');
  const elChecked = document.getElementById('kpiCheckedPcs');
  const elWh = document.getElementById('kpiWhPcs');
  const elRepair = document.getElementById('kpiRepairPcs');

  if (elEntries) elEntries.textContent = formatNumber(totalEntries);
  if (elChecked) elChecked.textContent = formatNumber(totalChecked);
  if (elWh) elWh.textContent = formatNumber(totalWh);
  if (elRepair) elRepair.textContent = formatNumber(totalRepair);

  // Results count header
  const resultsCountEl = document.getElementById('repResultsCount');
  if (resultsCountEl) {
    resultsCountEl.textContent = `Showing ${formatNumber(totalEntries)} ${totalEntries === 1 ? 'entry' : 'entries'}`;
  }

  // Render list of entry cards
  renderEntryCards(myFilteredRecords);
}

// ---------- Render Inspection Cards ----------
function renderEntryCards(records) {
  const container = document.getElementById('myRepEntriesList');
  if (!container) return;

  const loggedInUser = localStorage.getItem('nimbus_username') || 'Inspector';

  if (!records || records.length === 0) {
    container.innerHTML = `
      <div class="my-rep-empty-state">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h4>No Entries Found for ${loggedInUser}</h4>
        <p>You currently have <strong>0 verified entries</strong> in the <strong>END OF LINE</strong> Google Sheet.</p>
        <p style="font-size: 10px; color: var(--text-muted); margin-top: 6px;">Live auto-refreshing every 5 seconds. As soon as you submit an inspection, it will appear here automatically.</p>
        <div style="display: flex; gap: 8px; justify-content: center; margin-top: 14px;">
          <button type="button" class="date-preset-pill active" id="emptyResetFiltersBtn">
            Reset Filters
          </button>
          <a href="end-of-line.html" class="date-preset-pill" style="text-decoration: none; background: #ecfdf5; border-color: #a7f3d0; color: #059669; font-weight: 750;">
            + Start New Inspection
          </a>
        </div>
      </div>`;

    const resetBtn = document.getElementById('emptyResetFiltersBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetAllFilters);
    }
    return;
  }

  const html = records.map(r => {
    const isRepair = (r.repairQty > 0);
    const statusBadge = isRepair
      ? `<span class="mec-status-badge mec-status-repair">Defect (${r.repairQty})</span>`
      : `<span class="mec-status-badge mec-status-approved">100% Passed</span>`;

    const displayDate = formatDisplayDate(r.checkDate);
    const cleanReason = (r.reason || '').trim();
    const cleanCategory = (r.repairCategory || '').trim();

    let reasonBox = '';
    if (cleanReason || cleanCategory) {
      reasonBox = `
        <div class="mec-reason-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div>
            ${cleanCategory ? `<strong>[${cleanCategory}]</strong> ` : ''}
            <span>${cleanReason || 'Defect noted during inspection'}</span>
          </div>
        </div>`;
    }

    return `
      <article class="my-entry-card">
        <div class="mec-top">
          <div class="mec-batch-wrap">
            <span class="mec-batch-id">#${r.batchId}</span>
            ${r.unit ? `<span class="mec-unit-badge">${r.unit}</span>` : ''}
          </div>
          ${statusBadge}
        </div>

        <div class="mec-meta-row">
          <div class="mec-style-info">
            <strong>${r.style || 'Standard Style'}</strong>
            ${r.colour ? ` &bull; ${r.colour}` : ''}
            ${r.po ? ` &bull; PO: ${r.po}` : ''}
          </div>
          <span class="mec-date">${displayDate}</span>
        </div>

        <div class="mec-quantities-row">
          <div class="mec-qty-chip">
            <span class="mqc-lbl">Checked</span>
            <span class="mqc-val">${formatNumber(r.checkedQty)}</span>
          </div>
          <div class="mec-qty-chip">
            <span class="mqc-lbl">W/H Passed</span>
            <span class="mqc-val val-green">${formatNumber(r.whQty)}</span>
          </div>
          <div class="mec-qty-chip">
            <span class="mqc-lbl">Repair</span>
            <span class="mqc-val ${isRepair ? 'val-rose' : ''}">${formatNumber(r.repairQty)}</span>
          </div>
        </div>

        ${reasonBox}
      </article>`;
  }).join('');

  container.innerHTML = html;
}

// ---------- Reset All Filters Helper ----------
function resetAllFilters() {
  activeDatePreset = 'ALL';
  customDateFrom = '';
  customDateTo = '';
  currentSearchQuery = '';

  const dateFrom = document.getElementById('repDateFrom');
  if (dateFrom) dateFrom.value = '';

  const dateTo = document.getElementById('repDateTo');
  if (dateTo) dateTo.value = '';

  const searchInput = document.getElementById('repSearchInput');
  if (searchInput) searchInput.value = '';

  const searchClearBtn = document.getElementById('repSearchClearBtn');
  if (searchClearBtn) searchClearBtn.style.display = 'none';

  // Highlight 'All Time' pill
  document.querySelectorAll('.date-preset-pill').forEach(pill => {
    pill.classList.toggle('active', pill.getAttribute('data-preset') === 'ALL');
  });

  applyFiltersAndRender();
  showToast('Filters reset to default');
}

// ---------- Excel / CSV Export Engine ----------
function exportReportData() {
  if (!myFilteredRecords || myFilteredRecords.length === 0) {
    showToast('No entries to export!');
    return;
  }

  showToast('Exporting QC entries...');

  const rows = myFilteredRecords.map((r, i) => ({
    'Sl No': i + 1,
    'Batch ID': r.batchId,
    'Unit': r.unit,
    'Check Date': r.checkDate,
    'Inspector': r.qcName,
    'Style': r.style,
    'Colour': r.colour,
    'PO Number': r.po,
    'SKU': r.sku,
    'Checked Qty': r.checkedQty,
    'W/H Passed Qty': r.whQty,
    'Repair Qty': r.repairQty,
    'Category': r.repairCategory,
    'Defect Reason': r.reason,
    'Fabricator': r.fabricator,
    'Submitted By': r.submittedBy
  }));

  const todayStr = new Date().toISOString().split('T')[0];
  const userClean = (localStorage.getItem('nimbus_username') || 'Inspector').replace(/\s+/g, '_');
  const filename = `My_QC_Report_${userClean}_${todayStr}.xlsx`;

  if (typeof XLSX !== 'undefined') {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'My QC Entries');
    XLSX.writeFile(wb, filename);
  } else {
    // Fallback to CSV
    const headers = Object.keys(rows[0]).join(',');
    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers, ...rows.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename.replace('.xlsx', '.csv'));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  showToast('Report exported successfully!');
}

// ---------- Auto-Refresh Polling Engine (Every 5 Seconds) ----------
function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(async () => {
    // Only refresh when browser tab is active
    if (document.hidden || isRefreshingLive) return;
    isRefreshingLive = true;
    try {
      await loadQcData(true, true); // forceNocache=true, isSilent=true
    } catch (e) {
      console.warn('Auto-refresh poll notice:', e);
    } finally {
      isRefreshingLive = false;
    }
  }, 5000);
}

// ---------- Event Listeners Setup ----------
function bindEventListeners() {
  // 1. Date Preset Pills
  const datePresets = document.querySelectorAll('.date-preset-pill');
  datePresets.forEach(pill => {
    pill.addEventListener('click', () => {
      datePresets.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      activeDatePreset = pill.getAttribute('data-preset');
      customDateFrom = '';
      customDateTo = '';
      const df = document.getElementById('repDateFrom');
      const dt = document.getElementById('repDateTo');
      if (df) df.value = '';
      if (dt) dt.value = '';

      applyFiltersAndRender();
    });
  });

  // 2. Custom Date Range
  const dateFrom = document.getElementById('repDateFrom');
  const dateTo = document.getElementById('repDateTo');
  const dateResetBtn = document.getElementById('repDateResetBtn');

  const onCustomDateChange = () => {
    customDateFrom = dateFrom ? dateFrom.value : '';
    customDateTo = dateTo ? dateTo.value : '';

    if (customDateFrom || customDateTo) {
      datePresets.forEach(p => p.classList.remove('active'));
      activeDatePreset = 'CUSTOM';
    }
    applyFiltersAndRender();
  };

  if (dateFrom) dateFrom.addEventListener('change', onCustomDateChange);
  if (dateTo) dateTo.addEventListener('change', onCustomDateChange);

  if (dateResetBtn) {
    dateResetBtn.addEventListener('click', () => {
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      customDateFrom = '';
      customDateTo = '';
      activeDatePreset = 'ALL';
      datePresets.forEach(p => {
        p.classList.toggle('active', p.getAttribute('data-preset') === 'ALL');
      });
      applyFiltersAndRender();
      showToast('Date filter cleared');
    });
  }

  // 3. Live Search Input
  const searchInput = document.getElementById('repSearchInput');
  const searchClearBtn = document.getElementById('repSearchClearBtn');

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value;
      if (searchClearBtn) {
        searchClearBtn.style.display = currentSearchQuery ? 'block' : 'none';
      }
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        applyFiltersAndRender();
      }, 120);
    });
  }

  if (searchClearBtn && searchInput) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      currentSearchQuery = '';
      searchClearBtn.style.display = 'none';
      applyFiltersAndRender();
    });
  }

  // 4. Manual Sync Button
  const syncBtn = document.getElementById('myRepSyncBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.style.animation = 'spin 0.8s linear infinite';
      showToast('Syncing latest records from END OF LINE sheet...');
      try {
        await loadQcData(true, false);
        showToast('END OF LINE sheet synchronized!');
      } catch (err) {
        console.warn('Sync failed:', err);
        showToast('Offline — Loaded cached data');
      } finally {
        syncBtn.style.animation = '';
      }
    });
  }

  // 5. Export Button
  const exportBtn = document.getElementById('repExportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportReportData);
  }

  // 6. Tab Visibility Change (immediate sync when user returns to tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      loadQcData(true, true);
    }
  });

  // 7. Cross-tab Broadcast listener
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel('fms_eol_channel');
      bc.onmessage = (ev) => {
        if (ev && ev.data && ev.data.type === 'EOL_SUBMITTED') {
          loadQcData(true, true);
        }
      };
    } catch (e) {}
  }
}

// ---------- Spin animation style injection ----------
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);

// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', () => {
  initUserProfile();
  bindEventListeners();
  loadQcData(false, false);
  startAutoRefresh(); // Starts 5-second Google Sheet polling
});
