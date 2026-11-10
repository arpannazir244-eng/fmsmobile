// ==========================================
// FMS WORKSPACE — END OF LINE REPORT LOGIC (report-eol.js)
// 100% Powered by Database — Deep QC & Defect Reasons Analytics
// Sheet Source: "END LINE QC-FMS"
// ==========================================

let eolQcCache = [];
let allBatchesCache = [];
let currentReportUnitFilter = 'ALL';
let currentMonthFilter = 'ALL';
let currentDefectReasonFilter = 'ALL';
let currentCategoryFilter = 'ALL';
let currentReportMode = 'standard'; // 'standard' | 'details'
let currentStatusFilter = 'ALL';
let currentSearchTerm = '';
let currentInspectorFilter = 'ALL';

// 7 Standard QC Categories (as requested for Standard Report Column Chart)
const STANDARD_CATEGORIES = [
  { key: 'stitching', name: 'Stitching', color: '#ef4444', gradient: 'linear-gradient(180deg, #f87171 0%, #dc2626 100%)', bgLight: '#fef2f2', border: '#fca5a5' },
  { key: 'edge-paint', name: 'Edge-Paint', color: '#f97316', gradient: 'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)', bgLight: '#fff7ed', border: '#fdba74' },
  { key: 'workmanship', name: 'Workmanship', color: '#8b5cf6', gradient: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)', bgLight: '#f5f3ff', border: '#c4b5fd' },
  { key: 'finishing', name: 'Finishing', color: '#10b981', gradient: 'linear-gradient(180deg, #34d399 0%, #059669 100%)', bgLight: '#ecfdf5', border: '#6ee7b7' },
  { key: 'hardware', name: 'Hardware', color: '#3b82f6', gradient: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)', bgLight: '#eff6ff', border: '#93c5fd' },
  { key: 'assembly', name: 'Assembly', color: '#f59e0b', gradient: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)', bgLight: '#fffbeb', border: '#fcd34d' },
  { key: 'material', name: 'Material', color: '#06b6d4', gradient: 'linear-gradient(180deg, #22d3ee 0%, #0891b2 100%)', bgLight: '#ecfeff', border: '#67e8f9' }
];

// ---------- Toast Notification Helper ----------
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ---------- User Profile Synchronization ----------
function initUserProfile() {
  const username = localStorage.getItem('nimbus_username') || 'Inspector';
  const cleanName = username.trim();
  const parts = cleanName.split(' ');
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : cleanName.slice(0, 2).toUpperCase();

  const userAvatarText = document.getElementById('userAvatarText');
  if (userAvatarText) userAvatarText.textContent = initials;

  const profileUserName = document.getElementById('profileUserName');
  if (profileUserName) profileUserName.textContent = cleanName;

  const profileAvatarText = document.getElementById('profileAvatarText');
  if (profileAvatarText) profileAvatarText.textContent = initials;

  const profileAppVer = document.getElementById('profileAppVer');
  if (profileAppVer) {
    const v = localStorage.getItem('fms_installed_version') || '1.2.3';
    profileAppVer.textContent = `v${v}`;
  }
}

// ---------- Notification Sheet Controls ----------
function openNotifSheet() {
  closeProfileSheet();
  const sheet = document.getElementById('notifSheet');
  const overlay = document.getElementById('notifOverlay');
  if (sheet && overlay) {
    sheet.classList.add('open');
    overlay.classList.add('open');
  }
}

function closeNotifSheet() {
  const sheet = document.getElementById('notifSheet');
  const overlay = document.getElementById('notifOverlay');
  if (sheet && overlay) {
    sheet.classList.remove('open');
    overlay.classList.remove('open');
  }
}

// ---------- User Profile Card Sheet Controls ----------
function openProfileSheet() {
  closeNotifSheet();
  const sheet = document.getElementById('profileSheet');
  const overlay = document.getElementById('profileOverlay');
  if (sheet && overlay) {
    sheet.classList.add('open');
    overlay.classList.add('open');
  }
}

function closeProfileSheet() {
  const sheet = document.getElementById('profileSheet');
  const overlay = document.getElementById('profileOverlay');
  if (sheet && overlay) {
    sheet.classList.remove('open');
    overlay.classList.remove('open');
  }
}

// -------------------------------------------------------------
// CLEAN SVG ICON GENERATOR (Replaces all emojis with crisp SVGs)
// -------------------------------------------------------------
function getCategorySvg(category, size = 13, customClass = 'qc-cat-svg') {
  const s = size;
  const cat = (category || '').toLowerCase();

  switch (cat) {
    case 'stitching':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><path d="M6 3v18M6 4h9l-2 3 2 3H6"/><circle cx="18" cy="18" r="3"/></svg>`;

    case 'hardware':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;

    case 'edge-paint':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/><path d="M9 8c-2 3-4 3.5-7 4l8 8c.5-3 1-5 4-7"/></svg>`;

    case 'finishing':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`;

    case 'material':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;

    case 'assembly':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;

    case 'lining':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;

    case 'branding':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    case 'packaging':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

    case 'approved':
    case 'clean':
    case 'pass':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><polyline points="20 6 9 17 4 12"/></svg>`;

    case 'danger':
    case 'critical':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    case 'workmanship':
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><circle cx="12" cy="12" r="9"/><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    default: // General Defect
      return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="${customClass}"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  }
}

// -------------------------------------------------------------
// DYNAMIC DEFECT TAXONOMY & INTELLIGENT CLASSIFIER
// -------------------------------------------------------------
const DEFECT_TAXONOMY = [
  { key: 'thread', label: 'Thread uncut & excess trim', category: 'Finishing' },
  { key: 'stitch', label: 'Stitch open & loose tension', category: 'Stitching' },
  { key: 'edge', label: 'Edge ink / paint uneven smear', category: 'Edge-Paint' },
  { key: 'glue', label: 'Glue residue & adhesive stain', category: 'Finishing' },
  { key: 'leather', label: 'Leather surface scratch / mark', category: 'Material' },
  { key: 'hardware', label: 'Hardware plating & zip stiffness', category: 'Hardware' },
  { key: 'handle', label: 'Handle alignment tilt (>2mm)', category: 'Assembly' },
  { key: 'lining', label: 'Lining pocket skew & loose piping', category: 'Lining' },
  { key: 'needle', label: 'Needle hole puncture visible', category: 'Workmanship' },
  { key: 'shade', label: 'Colour shade variation on flap', category: 'Material' },
  { key: 'piping', label: 'Piping thickness irregularity', category: 'Stitching' },
  { key: 'logo', label: 'Embossing faint depth / skewed', category: 'Branding' },
  { key: 'rivet', label: 'Riveting off-center at base tab', category: 'Hardware' }
];

// Priority-ordered semantic keyword rules to intelligently categorize ANY new/unforeseen defect reasons:
// Including Indian leathercraft factory terms (pular, zipar, ledar, rong fata, gulo, tep gam, zilapi, belu, etc.)
const SEMANTIC_CATEGORY_RULES = [
  {
    category: 'Branding',
    words: ['logo', 'emboss', 'embossing', 'foil', 'stamp', 'print', 'monogram', 'faint']
  },
  {
    category: 'Hardware',
    words: ['hardware', 'zip', 'zipar', 'zipper', 'puller', 'pular', 'slider', 'teeth', 'rivet', 'buckle', 'd-ring', 'ring', 'snap', 'stud', 'lock', 'magnet', 't-bar', 'plating', 'rust', 'oxidation', 'metal', 'chain', 'try']
  },
  {
    category: 'Stitching',
    words: ['stitch', 'stitching', 'steching', 'seam', 'tension', 'loop', 'skip', 'pucker', 'wavy', 'broken thread', 'sewing', 'needle', 'weaving', 'stiching']
  },
  {
    category: 'Edge-Paint',
    words: ['edge', 'ej', 'paint', 'ink', 'inking', 'smear', 'dripping', 'bleed', 'aging', 'rough edge', 'primer', 'bubble']
  },
  {
    category: 'Finishing',
    words: ['thread', 'trim', 'uncut', 'tail', 'glue', 'gulo', 'gulu', 'tep', 'gam', 'tape', 'adhesive', 'clean', 'cleaning', 'dirt', 'stain', 'smudge', 'oil', 'dust', 'burn', 'poyent']
  },
  {
    category: 'Packaging',
    words: ['tag', 'barcode', 'label', 'sticker', 'box', 'polybag', 'dustbag', 'desiccant', 'hangtag', 'packing', 'carton']
  },
  {
    category: 'Material',
    words: ['leather', 'ledar', 'scuff', 'scratch', 'wrinkle', 'peel', 'shade', 'colour', 'color', 'rong', 'grain', 'vein', 'bite', 'scar', 'thickness', 'crack', 'fata', 'chota', 'hide', 'fabric', 'fabrick', 'pu', 'canvas', 'smell', 'damage', 'discoloration', 'cut mark', 'cuts']
  },
  {
    category: 'Lining',
    words: ['lining', 'pocket', 'interlining', 'crease', 'piping', 'zilapi', 'binding', 'reinforcement', 'foam', 'board', 'pauch']
  },
  {
    category: 'Assembly',
    words: ['handle', 'handel', 'flap', 'strap', 'gusset', 'base', 'tilt', 'skew', 'alignment', 'crooked', 'gap', 'offset', 'crease', 'kuchi', 'unequal', 'uneven', 'asymmetry', 'fitting', 'dimension', 'size', 'shape', 'belu', 'seting', 'setting', 'lus']
  }
];

function cleanReasonTitle(str) {
  if (!str) return 'Other Defect';
  const clean = str.toString().trim()
    .replace(/^\[.*?\]\s*/, '')
    .replace(/^[-â€“â€”â€¢\*\s\d'\.:]+/, '')
    .replace(/[\s\t\n]+/g, ' ');
  if (!clean) return 'Other Defect';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function categorizeReason(reasonStr) {
  if (!reasonStr || reasonStr.toString().trim() === '' || /^(nil|ok|pass|none|good|zero|approved|flawless|clean|no defect|na|n\/a)/i.test(reasonStr.toString().trim())) {
    return { name: 'Nil / 100% Passed', label: 'Nil / 100% Passed', category: 'Approved', key: 'clean' };
  }

  const rawClean = cleanReasonTitle(reasonStr);
  const low = rawClean.toLowerCase();

  // 1. Check predefined taxonomy exact or partial matches
  for (const item of DEFECT_TAXONOMY) {
    if (low.includes(item.key) || low.includes(item.label.toLowerCase())) {
      return {
        ...item,
        name: item.label
      };
    }
  }

  // 2. Intelligent semantic keyword categorization for ANY new/future defect reason
  for (const rule of SEMANTIC_CATEGORY_RULES) {
    for (const word of rule.words) {
      const regex = new RegExp('(?:^|[^a-z0-9])' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z0-9])', 'i');
      if (regex.test(low)) {
        return {
          key: word,
          label: rawClean,
          name: rawClean,
          category: rule.category
        };
      }
    }
  }

  // 3. Dynamic Fallback for completely novel / unexpected defect reasons:
  return {
    key: 'custom_' + low.replace(/[^a-z0-9]/g, '_').slice(0, 24),
    label: rawClean,
    name: rawClean,
    category: 'Workmanship'
  };
}

// -------------------------------------------------------------
// LIVE GOOGLE SHEET & LOCAL INDEXEDDB DATA ENGINE
// Sheet: "END LINE QC-FMS" (Public Google Sheet ID: 1uXjAFkcrWTF_sDDSXOoisl-q97n3vbHqa0JeSZ0fn2Q)
// -------------------------------------------------------------
// Pure Local-First IndexedDB Data Engine (No Google Sheet / Code.gs dependency)

function parseGvizDate(raw) {
  if (!raw) return '';
  const str = raw.toString().trim();
  const m = str.match(/Date\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const y = m[1];
    const mo = String(Number(m[2]) + 1).padStart(2, '0');
    const d = String(Number(m[3])).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, '0');
    const mo = dmy[2].padStart(2, '0');
    const y = dmy[3];
    return `${y}-${mo}-${d}`;
  }
  const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    const y = ymd[1];
    const mo = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
  return str.split('T')[0];
}

function formatMonthLabel(yyyyMm) {
  if (!yyyyMm || yyyyMm === 'ALL') return 'All Months';
  const parts = yyyyMm.split('-');
  if (parts.length < 2) return yyyyMm;
  const y = parts[0];
  const m = parseInt(parts[1], 10);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[m - 1] || m} ${y}`;
}

const EOL_SPREADSHEET_ID = (typeof SPREADSHEET_ID !== 'undefined') ? SPREADSHEET_ID : '1uXjAFkcrWTF_sDDSXOoisl-q97n3vbHqa0JeSZ0fn2Q';
// END LINE QC-FMS Sheet: Column AD = QC Name, Column U = Checked Qty, Column W = Repair Qty, Column AE = Check Date
const EOL_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${EOL_SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=END%20LINE%20QC-FMS&tq=` + encodeURIComponent("select B, K, L, O, J, M, E, F, AD, N, AE, U, W, V, Y, D, A, G where B is not null");

async function fetchLiveEndLineQcFromGoogleSheet(forceNocache = false) {
  if (typeof FMS_DB !== 'undefined' && typeof FMS_DB.fetchLiveEndLineQcRecords === 'function') {
    const dbRecs = await FMS_DB.fetchLiveEndLineQcRecords(forceNocache);
    if (dbRecs && dbRecs.length > 0) return dbRecs;
  }

  if (!navigator.onLine) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const nocacheParam = forceNocache ? `&_nocache=${Date.now()}` : '';
    const freshUrl = `https://docs.google.com/spreadsheets/d/${EOL_SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=END%20LINE%20QC-FMS${nocacheParam}&tq=` + encodeURIComponent("select B, K, L, O, J, M, E, F, AD, N, AE, U, W, V, Y, D, A, G where B is not null");
    const res = await fetch(freshUrl, { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
    if (!match || !match[1]) return null;
    const json = JSON.parse(match[1]);
    if (!json.table || !Array.isArray(json.table.rows)) return null;

    const records = [];
    json.table.rows.forEach((row, idx) => {
      const c = row.c;
      if (!c || !c[0] || !c[0].v) return;
      const batchId = String(c[0].v).trim();
      if (!batchId) return;

      const style = c[1] && c[1].v ? String(c[1].v).trim() : '';
      const colour = c[2] && c[2].v ? String(c[2].v).trim() : '';
      const po = c[3] && c[3].v ? String(c[3].v).trim() : '';
      const sku = c[4] ? (c[4].f ? String(c[4].f).trim() : (c[4].v !== undefined ? String(c[4].v).trim() : '')) : '';
      const orderQty = c[5] && c[5].v ? (Number(c[5].v) || 0) : 0;
      const unit = c[6] && c[6].v ? String(c[6].v).trim() : '';
      const fabricator = c[7] && c[7].v ? String(c[7].v).trim() : '';
      const qcNameRaw = c[8] && c[8].v ? String(c[8].v).trim() : '';
      const etd = c[9] ? parseGvizDate(c[9].f || c[9].v) : '';
      const checkDate = c[10] ? parseGvizDate(c[10].v || c[10].f) : (etd || '');
      const checkedQty = c[11] && c[11].v ? (Number(c[11].v) || 0) : 0;
      const repairQty = c[12] && c[12].v ? (Number(c[12].v) || 0) : 0;
      const whQty = c[13] && c[13].v ? (Number(c[13].v) || 0) : 0;
      const reason = c[14] && c[14].v ? String(c[14].v).trim() : '';
      const submittedBy = c[15] && c[15].v ? String(c[15].v).trim() : '';
      const timestamp = c[16] && c[16].v ? String(c[16].v).trim() : '';
      const brand = c[17] && c[17].v ? String(c[17].v).trim() : '';
      const repairCategory = '';

      if (String(batchId || '').toUpperCase().includes('TT-0025')) return;

      const isAudited = (checkedQty > 0 || whQty > 0 || repairQty > 0 || (reason && reason.length > 0));
      const status = (repairQty > 0) ? 'Repair' : ((checkedQty > 0 || whQty > 0) ? 'Approved' : 'Pending');
      const qcClean = (qcNameRaw && !/^(unassigned|qc inspector|inspector|unknown)$/i.test(qcNameRaw))
        ? qcNameRaw
        : ((submittedBy && !/^(unassigned|qc inspector|inspector|unknown)$/i.test(submittedBy)) ? submittedBy : 'Unassigned');
      const qcName = qcClean;

      records.push({
        id: idx + 1,
        batchId,
        unit,
        fabricator,
        brand,
        sku,
        style,
        colour,
        orderQty,
        etd,
        po,
        status,
        repairCategory,
        checkedQty,
        whQty,
        repairQty,
        reason,
        qcName,
        submittedBy,
        checkDate,
        timestamp,
        isAudited
      });
    });
    return records;
  } catch (err) {
    clearTimeout(timer);
    console.warn('Live Google Sheet fetch notice:', err.message || err);
    return null;
  }
}

async function fetchBundledEndLineQcJson() {
  if (typeof window !== 'undefined' && Array.isArray(window.BUNDLED_ENDLINE_QC) && window.BUNDLED_ENDLINE_QC.length > 0) {
    return window.BUNDLED_ENDLINE_QC;
  }
  try {
    const res = await fetch('endline_qc_data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Bundled endline_qc_data.json fetch error:', err);
    return null;
  }
}

// -------------------------------------------------------------
// HELPER TO MERGE LOCAL SUBMISSIONS FROM INDEXEDDB
// Guarantees zero-wait instant reflection of new submissions
// -------------------------------------------------------------
async function mergeLocalSubmissions(records) {
  if (typeof FMS_DB === 'undefined') return records;
  try {
    if (typeof FMS_DB.purgeInvalidSubmissions === 'function') {
      await FMS_DB.purgeInvalidSubmissions();
    }
    const subs = (await FMS_DB.getSubmissions()) || [];

    // Filter out any invalid test batch like TT-0025 from base records
    const list = [...(records || [])].filter(r => !String(r.batchId || '').toUpperCase().includes('TT-0025'));
    if (!subs || subs.length === 0) return list;

    const map = new Map();
    list.forEach((r, idx) => {
      const b = String(r.batchId || r.batch_id || '').trim().toUpperCase();
      if (b) map.set(b, idx);
    });

    subs.forEach(s => {
      const f = s.formData;
      if (!f || !f.batchId) return;
      const b = String(f.batchId).trim().toUpperCase();

      // Exclude TT-0025 or test batches
      if (b.includes('TT-0025') || b === 'TT-0025/26-27') return;

      if (map.has(b)) {
        const idx = map.get(b);
        const existing = list[idx];

        // If Google Sheet already has audited verification data (or submission was synced):
        // GOOGLE SHEET IS MASTER TRUTH! Never overwrite Google Sheet's checkDate or quantities!
        const sheetHasAudit = existing.isAudited || Number(existing.checkedQty) > 0 || Number(existing.repairQty) > 0 || Number(existing.whQty) > 0;
        if (s.status === 'synced' || sheetHasAudit) {
          return;
        }

        // Only for newly submitted in-flight verification that Google Sheets hasn't recorded yet:
        const checkedQty = Number(f.checkedQty || 0);
        const repairQty = Number(f.repairQty || 0);
        const whQty = Number(f.whQty || 0);
        const todayStr = new Date().toISOString().split('T')[0];
        const checkDate = f.checkDate || (f.timestamp ? f.timestamp.split('T')[0] : todayStr);

        list[idx] = {
          ...existing,
          checkedQty,
          repairQty,
          whQty,
          reason: (f.reason !== undefined && f.reason !== null) ? String(f.reason) : (existing.reason || ''),
          repairCategory: f.repairCategory || f.repair_category || f['Repair Category'] || existing.repairCategory || '',
          checkDate: checkDate || existing.checkDate || todayStr,
          qcName: (f.qcName && f.qcName !== 'QC Inspector') ? f.qcName : (existing.qcName || 'Unassigned'),
          unit: f.unit || existing.unit || '',
          style: f.style || existing.style || '',
          colour: f.colour || existing.colour || '',
          po: f.po || existing.po || '',
          sku: f.sku || existing.sku || '',
          fabricator: f.fabricator || existing.fabricator || '',
          floor: f.floor || existing.floor || '',
          isAudited: true,
          status: 'Approved'
        };
      } else {
        // If not in Google Sheet, only show if pending AND recently submitted (within 24 hrs)
        if (s.status === 'synced') return;
        const subAge = s.timestamp ? (Date.now() - new Date(s.timestamp).getTime()) : 0;
        if (subAge > 86400000) return; // Older than 24 hours and not in Google Sheet: ignore!

        // If batch doesn't exist anywhere in bundled production data or sheets, skip orphan test entry
        let resolvedBrand = f.brand || '';
        if (!resolvedBrand && typeof window !== 'undefined' && Array.isArray(window.BUNDLED_ENDLINE_QC)) {
          const match = window.BUNDLED_ENDLINE_QC.find(m => String(m.batchId || '').trim().toUpperCase() === b);
          if (match && match.brand) resolvedBrand = match.brand;
        }
        if (!resolvedBrand) return; // Do NOT add batches without authentic brand to official reports!

        const checkedQty = Number(f.checkedQty || 0);
        const repairQty = Number(f.repairQty || 0);
        const whQty = Number(f.whQty || 0);
        const todayStr = new Date().toISOString().split('T')[0];
        const checkDate = f.checkDate || (f.timestamp ? f.timestamp.split('T')[0] : todayStr);

        list.unshift({
          id: 'sub_' + (s.id || Math.random()),
          batchId: f.batchId,
          style: f.style || '',
          colour: f.colour || '',
          po: f.po || '',
          sku: f.sku || '',
          brand: resolvedBrand,
          floor: f.floor || '',
          unit: f.unit || '',
          fabricator: f.fabricator || '',
          qcName: (f.qcName && f.qcName !== 'QC Inspector') ? f.qcName : 'Unassigned',
          etd: f.etd || '',
          checkDate: checkDate,
          checkedQty,
          repairQty,
          whQty,
          orderQty: Number(f.quantity || 0) || checkedQty,
          reason: f.reason || '',
          repairCategory: f.repairCategory || f.repair_category || f['Repair Category'] || '',
          submittedBy: f.submittedBy || '',
          timestamp: f.timestamp || new Date().toISOString(),
          isAudited: true,
          status: 'Approved'
        });
        map.set(b, 0);
      }
    });

    return list;
  } catch (err) {
    console.warn('mergeLocalSubmissions notice:', err);
    return (records || []).filter(r => !String(r.batchId || '').toUpperCase().includes('TT-0025'));
  }
}

// -------------------------------------------------------------
// LOCAL-FIRST INDEXEDDB LOADER (Instant 0-wait local data loading)
// Completely independent of Code.gs!
// -------------------------------------------------------------
async function loadQcDataFromIndexedDB(forceReload = false) {
  if (forceReload) {
    eolQcCache = [];
  }

  // Purge any invalid/test submissions (e.g. TT-0025 ghost records) right away
  if (typeof FMS_DB !== 'undefined' && typeof FMS_DB.purgeInvalidSubmissions === 'function') {
    try {
      await FMS_DB.purgeInvalidSubmissions();
    } catch (_) {}
  }

  // Pre-seed immediately with bundled data if available so first render is instantaneous
  if ((!eolQcCache || eolQcCache.length === 0) && typeof window !== 'undefined' && Array.isArray(window.BUNDLED_ENDLINE_QC) && window.BUNDLED_ENDLINE_QC.length > 0) {
    eolQcCache = window.BUNDLED_ENDLINE_QC.filter(r => !String(r.batchId || '').toUpperCase().includes('TT-0025'));
  }

  if (eolQcCache && eolQcCache.length > 0 && !forceReload) {
    // Asynchronously sync with IndexedDB in background so local edits are reflected without blocking initial paint
    if (typeof FMS_DB !== 'undefined') {
      setTimeout(async () => {
        try {
          await FMS_DB.init();
          const recs = await FMS_DB.getEndLineQc();
          if (recs && recs.length > 0) {
            eolQcCache = (await mergeLocalSubmissions(recs)).filter(r => !String(r.batchId || '').toUpperCase().includes('TT-0025'));
            renderReportsView();
          }
        } catch (_) {}
      }, 50);
    }
    return eolQcCache;
  }

  try {
    if (typeof FMS_DB !== 'undefined') {
      await FMS_DB.init();
      if (forceReload && navigator.onLine) {
        await FMS_DB.purgeDeletedRecordsFromSheet().catch(() => {});
      }

      allBatchesCache = (await FMS_DB.getBatches()) || [];
      let records = await FMS_DB.getEndLineQc();

      if (records && records.length > 0) {
        records = await mergeLocalSubmissions(records);
        eolQcCache = (records || []).filter(r => !String(r.batchId || '').toUpperCase().includes('TT-0025'));
        return eolQcCache;
      }
    }

    const localBundled = await fetchBundledEndLineQcJson();
    if (localBundled && localBundled.length > 0) {
      let merged = await mergeLocalSubmissions(localBundled);
      eolQcCache = (merged || []).filter(r => !String(r.batchId || '').toUpperCase().includes('TT-0025'));
      if (typeof FMS_DB !== 'undefined') {
        await FMS_DB.saveEndLineQc(localBundled);
      }
      return eolQcCache;
    }
  } catch (err) {
    console.warn('IndexedDB load error, fallback to bundled:', err);
  }

  return (eolQcCache || []).filter(r => !String(r.batchId || '').toUpperCase().includes('TT-0025'));
}

// Non-blocking background sync from Google Sheet (Never blocks the user interface!)
async function refreshFromSheetInBackground() {
  if (typeof FMS_DB !== 'undefined') {
    const records = await FMS_DB.getEndLineQc();
    if (records && records.length > 0) {
      eolQcCache = (records || []).filter(r => !String(r.batchId || '').toUpperCase().includes('TT-0025'));
      renderReportsView();
    }
  }
}

// -------------------------------------------------------------
// BOOTSTRAP DATA GENERATOR: 338 REALISTIC INSPECTION RECORDS
// Mapped to actual inspectors (Arun: 96, Khokan: 156, Iyamat: 85, Shyama: 1)
// -------------------------------------------------------------
function generateBootstrapEndLineQc(batches) {
  const inspectors = [
    { name: 'Khokan Debnath', quota: 156, unit: 'P-32' },
    { name: 'Arun Bairagi', quota: 96, unit: 'S-18' },
    { name: 'Iyamat Sk', quota: 85, unit: 'S-37' },
    { name: 'Shyama Bhattacharjee', quota: 1, unit: 'S-29' }
  ];

  const defectPool = [
    { reason: 'Thread uncut & excess trim at shoulder strap', rate: 2 },
    { reason: 'Stitch open / loose tension near gusset corner', rate: 3 },
    { reason: 'Edge ink / paint uneven smear on top flap', rate: 2 },
    { reason: 'Glue residue & adhesive stain on front body panel', rate: 1 },
    { reason: 'Leather surface scratch & grain scuff mark', rate: 2 },
    { reason: 'Hardware plating abrasion on D-ring / zipper stiffness', rate: 1 },
    { reason: 'Handle alignment tilt (>2mm deviation)', rate: 2 },
    { reason: 'Lining pocket skew & loose piping', rate: 1 },
    { reason: 'Needle hole puncture visible at base corner', rate: 1 },
    { reason: 'Colour shade variation between flap and body', rate: 2 },
    { reason: 'Piping thickness irregularity at base', rate: 1 },
    { reason: 'Logo embossing faint depth / foil peel', rate: 1 },
    { reason: 'Riveting off-center at base tab', rate: 1 }
  ];

  const units = ['P-32', 'S-18', 'S-37', 'S-29', '14-B'];
  const styles = [
    { style: 'OHG/231/01', sku: '114550', fabricator: 'SUKANTA DEY', brand: 'RADLEY' },
    { style: 'OHG/231/02', sku: '114551', fabricator: 'MOMIN ALI', brand: 'RADLEY' },
    { style: 'TTR/410/01', sku: '108920', fabricator: 'HAFIJUL SK', brand: 'RADLEY' },
    { style: 'PIQ/782/01', sku: '209311', fabricator: 'GAUTAM/ SAHDEB', brand: 'PIQUADRO' },
    { style: 'PIQ/782/02', sku: '209312', fabricator: 'PROVAS SARKAR', brand: 'PIQUADRO' },
    { style: 'TTF/1056/01', sku: '304910', fabricator: 'GOPAL HARI', brand: 'PIQUADRO' },
    { style: 'TTF/1015/02', sku: '304915', fabricator: 'SUJIT HARI', brand: 'PIQUADRO' },
    { style: 'KAP/114/01', sku: '401201', fabricator: 'MUSTAFA KHAN', brand: 'BAVARIAN' },
    { style: 'ATT/550/03', sku: '502390', fabricator: 'KRISNENDU GHATA', brand: 'ATTENZA' }
  ];

  const records = [];
  let recordCounter = 1;

  inspectors.forEach(insp => {
    for (let i = 0; i < insp.quota; i++) {
      const batchRef = (batches && batches.length > i) ? batches[i] : null;
      const bIdx = (recordCounter * 7) % styles.length;
      const styleMeta = styles[bIdx];
      const batchNum = 300 + recordCounter;
      const batchId = batchRef ? batchRef.batchId : `TT-0${batchNum}/26-27`;

      // Checked quantity between 25 and 120 pcs
      const checkedQty = [25, 30, 40, 50, 60, 75, 100][(recordCounter * 3) % 7];

      // Defect probability: ~28% of batches have minor defects, 72% zero-defect flawless
      const hasDefect = (recordCounter % 3 === 0 || recordCounter % 7 === 0);
      let repairQty = 0;
      let reasonText = 'Nil / 100% Passed';

      if (hasDefect) {
        const dIdx = (recordCounter + i) % defectPool.length;
        const dObj = defectPool[dIdx];
        repairQty = Math.min(checkedQty, Math.max(1, dObj.rate + (recordCounter % 2)));
        reasonText = dObj.reason;
      }

      const whQty = checkedQty - repairQty;
      const assignedUnit = insp.unit || units[recordCounter % units.length];

      // Checking dates spread between Oct 10, 2026 and Nov 04, 2026
      const dayOffset = (recordCounter % 24);
      const dayStr = String(dayOffset + 1).padStart(2, '0');
      const checkDate = `2026-10-${dayStr}`;

      records.push({
        id: recordCounter,
        batchId: batchId,
        style: batchRef ? batchRef.style : styleMeta.style,
        colour: batchRef ? batchRef.colour : 'DARK OAK',
        po: batchRef ? batchRef.po : `UKPO000${2400 + (recordCounter % 50)}`,
        sku: batchRef ? batchRef.sku : styleMeta.sku,
        unit: assignedUnit,
        fabricator: batchRef ? batchRef.fabricator : styleMeta.fabricator,
        qcName: insp.name,
        checkDate: checkDate,
        checkedQty: checkedQty,
        repairQty: repairQty,
        whQty: whQty,
        reason: reasonText,
        submittedBy: insp.name,
        timestamp: `${checkDate}T10:30:00.000Z`
      });

      recordCounter++;
    }
  });

  return records;
}

// -------------------------------------------------------------
// REACTIVE DATA FILTERING
// -------------------------------------------------------------
function getBaseFilteredRecords() {
  if (!eolQcCache || eolQcCache.length === 0) return [];

  const cleanUnit = (currentReportUnitFilter || 'ALL').trim().toUpperCase().replace(/^UNIT\s*/i, '');
  const cleanMonth = (currentMonthFilter || 'ALL').trim().toUpperCase();
  const cleanStatus = (currentStatusFilter || 'ALL').trim().toUpperCase();
  const search = (currentSearchTerm || '').trim().toLowerCase();

  return eolQcCache.filter(item => {
    if (String(item.batchId || '').toUpperCase().includes('TT-0025')) return false;

    // If live search is active, search across ALL batches (audited and pending)
    if (search !== '') {
      const hay = [
        item.batchId,
        item.style,
        item.sku,
        item.po,
        item.unit,
        item.fabricator,
        item.reason,
        item.qcName,
        item.brand
      ].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    } else {
      // Default QC Quality Report view focuses on Audited batches
      const isAudited = item.isAudited !== false && (Number(item.checkedQty) > 0 || Number(item.repairQty) > 0 || Number(item.whQty) > 0 || (item.reason && item.reason !== ''));
      if (cleanStatus === 'ALL' && !isAudited) return false;
    }

    // 1. Month filter (Google Sheet Column AE: CHECK DATE)
    if (cleanMonth !== 'ALL' && cleanMonth !== '') {
      const dateStr = parseGvizDate(item.checkDate);
      const itemMonth = (dateStr || '').slice(0, 7);
      if (itemMonth !== cleanMonth) return false;
    }

    // 2. Unit filter
    if (cleanUnit !== 'ALL' && cleanUnit !== '') {
      const itemUnit = (item.unit || '').trim().toUpperCase().replace(/^UNIT\s*/i, '');
      if (itemUnit !== cleanUnit) return false;
    }

    // 2. Status filter
    if (cleanStatus === 'PASS') {
      const isAudited = item.isAudited !== false && (Number(item.checkedQty) > 0 || Number(item.whQty) > 0);
      if (!isAudited || Number(item.repairQty) > 0) return false;
    }
    if (cleanStatus === 'REPAIR') {
      if (Number(item.repairQty) === 0) return false;
    }

    return true;
  });
}

function getFilteredRecords(baseList) {
  let source = baseList || getBaseFilteredRecords();

  // 1. Filter by Standard QC Category (from Column S: matches if any category in Col S matches)
  if (currentCategoryFilter && currentCategoryFilter !== 'ALL') {
    const fCatLow = currentCategoryFilter.toLowerCase();
    source = source.filter(item => {
      const cats = getRecordCategories(item);
      return cats.some(c => c.toLowerCase() === fCatLow);
    });
  }

  // 2. Filter by Granular Defect Reason (from Column P)
  const cleanReason = (currentDefectReasonFilter || 'ALL').trim();
  if (cleanReason.toUpperCase() !== 'ALL' && cleanReason !== '') {
    const cleanReasonLow = cleanReason.toLowerCase();
    source = source.filter(item => {
      const itemReason = (item.reason || '').toLowerCase();
      const rTitle = cleanReasonTitle(item.reason).toLowerCase();
      if (rTitle === cleanReasonLow) return true;
      if (itemReason.includes(cleanReasonLow)) return true;
      const tax = categorizeReason(item.reason);
      if (tax.label && tax.label.toLowerCase() === cleanReasonLow) return true;
      if (tax.name && tax.name.toLowerCase() === cleanReasonLow) return true;
      if (tax.key && cleanReasonLow.includes(tax.key.toLowerCase())) return true;
      return false;
    });
  }

  // 3. Filter by QC Inspector (from Column AD: QC NAME)
  if (currentInspectorFilter && currentInspectorFilter !== 'ALL') {
    const fInspLow = currentInspectorFilter.toLowerCase();
    source = source.filter(item => {
      const qcn = (item.qcName || '').trim().toLowerCase();
      return qcn === fInspLow;
    });
  }

  return source;
}


// -------------------------------------------------------------
// 5-SECOND GOOGLE SHEETS LIVE AUTO-REFRESH ENGINE
// Silently fetches edits (e.g. check date, repair qty) from Google Sheet
// -------------------------------------------------------------
let isEolPollingLive = false;
let eolPollingTimer = null;
let lastEolDataSignature = '';

function computeEolDataSignature(records) {
  if (!records || records.length === 0) return '';
  let sig = '';
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.isAudited) {
      sig += `${r.batchId}:${r.checkDate}:${r.checkedQty}:${r.whQty}:${r.repairQty}:${r.reason}:${r.repairCategory || ""};`;
    }
  }
  return sig;
}

async function silentlyRefreshEndLineReport(force = false) {
  if (isEolPollingLive || !navigator.onLine) return;
  isEolPollingLive = true;

  try {
    const liveRecords = await fetchLiveEndLineQcFromGoogleSheet();
    if (liveRecords && liveRecords.length > 0) {
      if (typeof FMS_DB !== 'undefined' && typeof FMS_DB.pruneSyncedSubmissions === 'function') {
        await FMS_DB.pruneSyncedSubmissions(liveRecords);
      }
      const merged = await mergeLocalSubmissions(liveRecords);
      const newSig = computeEolDataSignature(merged);

      if (force || !lastEolDataSignature || newSig !== lastEolDataSignature) {
        lastEolDataSignature = newSig;
        eolQcCache = merged;

        if (typeof FMS_DB !== 'undefined') {
          await FMS_DB.saveEndLineQc(merged);
        }

        await renderReportsView();
        console.log(`[Google Sheets 5s Poll] Live update applied! Total audited: ${merged.filter(r => r.isAudited).length}`);
      }
    }
  } catch (err) {
    console.warn('[Google Sheets 5s Poll] Silent notice:', err);
  } finally {
    isEolPollingLive = false;
  }
}

function getEolDatasetMinMaxDates() {
  if (!Array.isArray(eolQcCache) || eolQcCache.length === 0) {
    return { minDate: '2026-08-09', maxDate: '2026-11-03' };
  }
  const dates = eolQcCache
    .map(r => parseGvizDate(r.checkDate))
    .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length === 0) {
    return { minDate: '2026-08-09', maxDate: '2026-11-03' };
  }
  return { minDate: dates[0], maxDate: dates[dates.length - 1] };
}

function updateAllDatePresetsToDatasetSpan() {
  const { minDate, maxDate } = getEolDatasetMinMaxDates();

  if (typeof ucSelectedPreset !== 'undefined' && ucSelectedPreset === 'ALL') {
    ucDateFrom = minDate;
    ucDateTo = maxDate;
    const inputFrom = document.getElementById('ucDateFrom');
    const inputTo = document.getElementById('ucDateTo');
    if (inputFrom) inputFrom.value = ucDateFrom;
    if (inputTo) inputTo.value = ucDateTo;
  }

  if (typeof selectedBrandDatePreset !== 'undefined' && selectedBrandDatePreset === 'ALL') {
    selectedBrandDateFrom = minDate;
    selectedBrandDateTo = maxDate;
    const bInputFrom = document.getElementById('brandDateFrom');
    const bInputTo = document.getElementById('brandDateTo');
    if (bInputFrom) bInputFrom.value = selectedBrandDateFrom;
    if (bInputTo) bInputTo.value = selectedBrandDateTo;
  }
}

async function syncReportSectionFromGoogleSheet(triggerBtn, sectionLabel) {
  const syncButtons = [
    document.getElementById('trendSyncBtn'),
    document.getElementById('ucSyncBtn'),
    document.getElementById('brandSyncBtn'),
    document.getElementById('inspectorSyncBtn')
  ].filter(Boolean);

  if (triggerBtn) triggerBtn.classList.add('syncing');
  syncButtons.forEach(b => b.classList.add('syncing'));

  try {
    // 1. Directly fetch 100% fresh live data from Google Sheets with cache-busting
    const liveRecords = await fetchLiveEndLineQcFromGoogleSheet(true);

    if (liveRecords && liveRecords.length > 0) {
      // 2. Prune any submissions already audited in Google Sheet so they cannot override live Google Sheet edits
      if (typeof FMS_DB !== 'undefined' && typeof FMS_DB.pruneSyncedSubmissions === 'function') {
        await FMS_DB.pruneSyncedSubmissions(liveRecords);
      }
      // 3. Preserve in-flight local pending submissions
      const merged = await mergeLocalSubmissions(liveRecords);
      lastEolDataSignature = computeEolDataSignature(merged);
      eolQcCache = merged;

      // 4. Update date filter presets to encompass full dataset span if 'ALL' preset is active
      updateAllDatePresetsToDatasetSpan();

      // 5. Persist to IndexedDB
      if (typeof FMS_DB !== 'undefined') {
        await FMS_DB.saveEndLineQc(merged);
      }

      // 6. Fully refresh all charts, month-wise trends, and KPI metrics
      await renderReportsView();
      showToast(sectionLabel ? `${sectionLabel} updated from Google Sheets!` : 'Live Google Sheet data & charts updated!');
    } else {
      await loadQcDataFromIndexedDB(true);
      updateAllDatePresetsToDatasetSpan();
      await renderReportsView();
      showToast('Synchronized with Database');
    }
  } catch (err) {
    console.warn('Sync section error:', err);
    await loadQcDataFromIndexedDB(true);
    await renderReportsView();
    showToast('Refreshed from Database');
  } finally {
    setTimeout(() => {
      if (triggerBtn) triggerBtn.classList.remove('syncing');
      syncButtons.forEach(b => b.classList.remove('syncing'));
    }, 450);
  }
}

async function syncTrendSectionFromGoogleSheet() {
  return syncReportSectionFromGoogleSheet(document.getElementById('trendSyncBtn'), 'Month-wise Trends');
}

function startEolReportAutoRefresh() {
  if (eolPollingTimer) clearInterval(eolPollingTimer);
  // Auto-refresh from Google Sheet every 45 seconds (45000ms)
  eolPollingTimer = setInterval(() => silentlyRefreshEndLineReport(false), 45000);
}

// -------------------------------------------------------------
// MAIN DASHBOARD RENDERER
// -------------------------------------------------------------
async function renderReportsView() {
  await loadQcDataFromIndexedDB();
  renderMonthFilterPills();
  updateUnitFilterPills();
  setupTrendCategoryEvents();
  const baseRecords = getBaseFilteredRecords();
  const filtered = getFilteredRecords(baseRecords);

  // 1. KPI Computations
  const totalChecked = filtered.reduce((sum, r) => sum + (Number(r.checkedQty) || 0), 0);
  const totalRepair = filtered.reduce((sum, r) => sum + (Number(r.repairQty) || 0), 0);
  const totalWh = filtered.reduce((sum, r) => sum + (Number(r.whQty) || 0), 0);

  const passRate = totalChecked > 0 ? +(((totalWh) / totalChecked) * 100).toFixed(1) : 100.0;
  const defectRate = totalChecked > 0 ? +((totalRepair / totalChecked) * 100).toFixed(1) : 0.0;

  // 2. Update QC Executive Hero & Radial Gauge
  const analysisPassRate = document.getElementById('analysisPassRate');
  if (analysisPassRate) analysisPassRate.textContent = `${passRate}%`;

  const qehGaugeProgress = document.getElementById('qehGaugeProgress');
  if (qehGaugeProgress) {
    const circumference = 201.06; // 2 * PI * 32
    const offset = circumference - (circumference * (Math.min(100, passRate) / 100));
    qehGaugeProgress.style.strokeDashoffset = offset;
    qehGaugeProgress.style.stroke = passRate >= 96 ? '#0b5c39' : (passRate >= 92 ? '#f59e0b' : '#dc2626');
  }

  const qehBatchBadge = document.getElementById('qehBatchBadge');
  if (qehBatchBadge) qehBatchBadge.textContent = `${filtered.length} Batch Checks`;

  const qehSubtitle = document.getElementById('qehSubtitle');
  if (qehSubtitle) {
    const monthText = currentMonthFilter !== 'ALL' ? ` (${formatMonthLabel(currentMonthFilter)})` : '';
    const unitText = currentReportUnitFilter !== 'ALL' ? ` • Unit ${currentReportUnitFilter}` : '';
    qehSubtitle.textContent = `Database Live Inspection Analytics${monthText}${unitText}`;
  }

  const qehGradeBadge = document.getElementById('qehGradeBadge');
  const qehHeadline = document.getElementById('qehHeadline');
  const qehDesc = document.getElementById('qehDesc');
  if (qehGradeBadge && qehHeadline && qehDesc) {
    if (passRate >= 95.0) {
      qehGradeBadge.className = 'qeh-grade-badge';
      qehGradeBadge.innerHTML = '<span>' + getCategorySvg('approved', 12) + '</span><span>AQL 1.5 Export Standard</span>';
      qehHeadline.textContent = 'High First-Time Pass Ratio';
      qehDesc.textContent = `Excellent workmanship across ${filtered.length} checked batches from Database.`;
    } else if (passRate >= 80.0) {
      qehGradeBadge.className = 'qeh-grade-badge warning';
      qehGradeBadge.innerHTML = '<span>' + getCategorySvg('workmanship', 12) + '</span><span>Standard Production Quality</span>';
      qehHeadline.textContent = 'Defect Rectification In Progress';
      qehDesc.textContent = `${totalRepair} pieces flagged for repair before final warehouse handover.`;
    } else {
      qehGradeBadge.className = 'qeh-grade-badge danger';
      qehGradeBadge.innerHTML = '<span>' + getCategorySvg('danger', 12) + '</span><span>Critical QC Action Needed</span>';
      qehHeadline.textContent = 'High Repair Volume Encountered';
      qehDesc.textContent = 'Critical threshold exceeded. Line inspection focus required.';
    }
  }

  // 3. Update 4-KPI Grid
  const elChecked = document.getElementById('analysisTotalChecked');
  const elCheckedBatches = document.getElementById('analysisCheckedBatches');
  if (elChecked) elChecked.textContent = totalChecked.toLocaleString();
  if (elCheckedBatches) elCheckedBatches.textContent = `${filtered.length} checked batches`;

  const elWh = document.getElementById('analysisTotalWh');
  const elWhPct = document.getElementById('analysisWhPct');
  if (elWh) elWh.textContent = totalWh.toLocaleString();
  if (elWhPct) elWhPct.textContent = `${passRate}% approved for store`;

  const elRepair = document.getElementById('analysisTotalRepair');
  const elRepairPieces = document.getElementById('analysisRepairPieces');
  if (elRepair) elRepair.textContent = totalRepair.toLocaleString();
  if (elRepairPieces) elRepairPieces.textContent = `${totalRepair} pieces rectified`;

  const elDefectRate = document.getElementById('analysisDefectRate');
  if (elDefectRate) elDefectRate.textContent = `${defectRate}%`;

  // 4. Render Standard 7-Category Column Chart & Deep Details Pareto Breakdown
  const baseTotalRepair = baseRecords.reduce((sum, r) => sum + (Number(r.repairQty) || 0), 0);
  renderStandardCategoryReport(baseRecords, baseTotalRepair);
  renderParetoAnalysis(baseRecords, baseTotalRepair);
  updateReportViewModeUI();

  // 5. Render Unit Quality Performance Matrix
  // 4b. Render Month-wise Repairing Trends & Smart Column + Graph Line Chart
  renderMonthlyRepairTrendChart();

  // 4c. Render Unit-wise Defect Category Analysis (Multi-Dimensional & Date Range)
  setupUnitCategoryControls();
  renderUnitCategoryAnalysis();

  // 4d. Render Brand-wise Repair Analysis (Column Statue + Defect Category Graph Lines)
  setupBrandControls();
  renderBrandRepairChart();

  renderUnitPerformanceMatrix(filtered);

  // 6. Render Inspector Verification Leaderboard & Combo Chart
  renderInspectorLeaderboard(baseRecords);

  // 7. Render Inspection Records List
  renderInspectionList(filtered);

  // 8. Refresh open fullscreen modal if active
  if (typeof window.refreshChartFullscreenIfOpen === 'function') {
    window.refreshChartFullscreenIfOpen();
  }

  window.dispatchEvent(new CustomEvent('fms:report-rendered'));
}

// -------------------------------------------------------------
// STANDARD 7-CATEGORY CLASSIFIER (Leather Goods Industry Standard)
// Categories: Stitching, Edge-Paint, Workmanship, Finishing, Hardware, Assembly, Material
// -------------------------------------------------------------
// Helper to extract ALL standard categories present in Column S (or fallback to classified category)
function getRecordCategories(record) {
  if (!record) return ['Workmanship'];
  const rep = Number(record.repairQty) || 0;
  if (rep <= 0) return ['Approved'];
  const rawCat = (record.repairCategory || record.repair_category || record.category || '').toString().trim();
  if (rawCat) {
    const parts = rawCat.split(',').map(s => s.trim()).filter(Boolean);
    const matched = [];
    parts.forEach(p => {
      const found = STANDARD_CATEGORIES.find(sc => sc.name.toLowerCase() === p.toLowerCase());
      if (found && !matched.includes(found.name)) {
        matched.push(found.name);
      }
    });
    if (matched.length > 0) return matched;
  }
  const single = classifyRecordToStandardCategory(record.reason, rep, record.repairCategory);
  return [single];
}

function classifyRecordToStandardCategory(reason, repairQty, explicitCategory) {
  if (Number(repairQty) <= 0) return 'Approved';
  // 1. Column S has highest authority (Sorted / Standard Categories)
  if (explicitCategory) {
    const cleanCat = String(explicitCategory).trim();
    if (cleanCat) {
      const parts = cleanCat.split(',').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        const match = STANDARD_CATEGORIES.find(c => c.name.toLowerCase() === p.toLowerCase());
        if (match) return match.name;
      }
    }
  }
  // 2. Bracketed prefix fallback
  const rClean = (reason || '').toString().trim();
  const bracketMatch = rClean.match(/^\[(.*?)\]/);
  if (bracketMatch && bracketMatch[1]) {
    const parts = bracketMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const p of parts) {
      const match = STANDARD_CATEGORIES.find(c => c.name.toLowerCase() === p.toLowerCase());
      if (match) return match.name;
    }
  }
  if (!rClean || /^(nil|ok|pass|none|approved)$/i.test(rClean)) {
    return 'Workmanship'; // General rework / touchup without specified defect notes
  }
  const low = rClean.toLowerCase();

  // 3. Fallback semantic keywords for older un-categorized records (Column P)
  if (low.includes('stitch') || low.includes('steching') || low.includes('stiching') || low.includes('seam') || low.includes('tension')) {
    return 'Stitching';
  }
  if (low.includes('ej colour') || low.includes('edge colour') || low.includes('edge') || low.includes('aging problem') || low.includes('paint') || /\bink\b/.test(low)) {
    return 'Edge-Paint';
  }
  if (low.includes('pular') || low.includes('puller') || low.includes('zip') || low.includes('zipar') || low.includes('zipper') || low.includes('try rong') || low.includes('buckle') || low.includes('rivet') || low.includes('hardware')) {
    return 'Hardware';
  }
  if (low.includes('shape') || low.includes('seting') || low.includes('setting') || low.includes('handel') || low.includes('handle') || low.includes('belu') || low.includes('zilapi') || low.includes('elastic') || low.includes('pauch') || low.includes('kuchi') || low.includes('fold') || low.includes('tie reverse')) {
    return 'Assembly';
  }
  if (low.includes('ledar') || low.includes('leather') || low.includes('cut') || low.includes('wrinkle') || low.includes('discoloration') || low.includes('colour chota') || low.includes('rong chota') || low.includes('rong fata') || low.includes('fabric') || low.includes('fabrick') || low.includes('material')) {
    return 'Material';
  }
  if (low.includes('clean') || low.includes('gulo') || low.includes('gulu') || low.includes('tep') || low.includes('gam') || low.includes('tape') || low.includes('thread') || low.includes('trim') || low.includes('poyent') || low.includes('spot') || low.includes('glue')) {
    return 'Finishing';
  }
  return 'Workmanship';
}

// -------------------------------------------------------------
// STANDARD REPORT VIEW UI SWITCHER
// -------------------------------------------------------------
function updateReportViewModeUI() {
  const standardView = document.getElementById('standardReportView');
  const detailsView = document.getElementById('detailsReportView');
  const titleEl = document.getElementById('paretoCardTitle');

  if (titleEl) titleEl.textContent = 'Repairing Reasons-Analysis';

  if (currentReportMode === 'standard') {
    if (standardView) standardView.style.display = 'block';
    if (detailsView) detailsView.style.display = 'none';
  } else {
    if (standardView) standardView.style.display = 'none';
    if (detailsView) detailsView.style.display = 'block';
  }
}

// -------------------------------------------------------------
// STANDARD REPORT: 7-CATEGORY COLUMN CHART & MATRIX RENDERER
// -------------------------------------------------------------
function renderStandardCategoryReport(baseRecords, totalRepairsCount) {
  const chartEl = document.getElementById('categoryColumnChart');
  const catListEl = document.getElementById('standardCategoryList');
  const resetBtn = document.getElementById('categoryFilterResetBtn');
  const dominantEl = document.getElementById('cisDominantVal');
  const secondaryEl = document.getElementById('cisSecondaryVal');
  const cleanEl = document.getElementById('cisCleanVal');

  // Calculate stats for all 7 standard categories
  const catMap = {};
  STANDARD_CATEGORIES.forEach(sc => {
    catMap[sc.name] = {
      ...sc,
      pcs: 0,
      batches: 0,
      reasonsMap: {}
    };
  });

  baseRecords.forEach(r => {
    const rep = Number(r.repairQty) || 0;
    if (rep > 0) {
      // Primary category receives piece volume from Column S
      const primaryCat = classifyRecordToStandardCategory(r.reason, rep, r.repairCategory);
      const allCats = getRecordCategories(r);
      const rKey = cleanReasonTitle(r.reason) || 'General rework touchup';

      if (catMap[primaryCat]) {
        catMap[primaryCat].pcs += rep;
      }
      allCats.forEach(cName => {
        if (catMap[cName]) {
          catMap[cName].batches += 1;
          catMap[cName].reasonsMap[rKey] = (catMap[cName].reasonsMap[rKey] || 0) + rep;
        }
      });
    }
  });

  const categories = STANDARD_CATEGORIES.map(sc => {
    const item = catMap[sc.name];
    item.pct = totalRepairsCount > 0 ? (item.pcs / totalRepairsCount) * 100 : 0;
    return item;
  });

  // Reset button state
  if (resetBtn) {
    if (currentCategoryFilter !== 'ALL') {
      resetBtn.style.display = 'inline-flex';
      resetBtn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        <span>Reset: ${currentCategoryFilter}</span>
      `;
      resetBtn.onclick = () => {
        currentCategoryFilter = 'ALL';
        renderReportsView();
      };
    } else {
      resetBtn.style.display = 'none';
    }
  }

  // Insight strip update
  const sortedByPcs = [...categories].sort((a, b) => b.pcs - a.pcs);
  if (dominantEl && sortedByPcs[0]) {
    dominantEl.textContent = `${sortedByPcs[0].name} (${sortedByPcs[0].pct.toFixed(0)}%)`;
  }
  if (secondaryEl && sortedByPcs[1]) {
    secondaryEl.textContent = `${sortedByPcs[1].name} (${sortedByPcs[1].pct.toFixed(0)}%)`;
  }
  if (cleanEl) {
    const nonZeroLow = [...categories].filter(c => c.pcs > 0).sort((a, b) => a.pcs - b.pcs)[0];
    if (nonZeroLow) {
      cleanEl.textContent = `${nonZeroLow.name} (${nonZeroLow.pct.toFixed(1)}%)`;
    }
  }

  function formatCategoryChartLabel(catName) {
  switch (catName) {
    case 'Edge-Paint':
      return 'Edge-<wbr>Paint';
    case 'Workmanship':
      return 'Workman&shy;ship';
    case 'Finishing':
      return 'Finish&shy;ing';
    case 'Hardware':
      return 'Hard&shy;ware';
    case 'Assembly':
      return 'Assem&shy;bly';
    case 'Material':
      return 'Mate&shy;rial';
    case 'Stitching':
      return 'Stitch&shy;ing';
    default:
      return catName;
  }
}

// 1. RENDER 7-CATEGORY COLUMN CHART
  if (chartEl) {
    const maxPcs = Math.max(1, ...categories.map(c => c.pcs));

    chartEl.innerHTML = categories.map(cat => {
      const barHeight = Math.max(12, Math.round((cat.pcs / maxPcs) * 125));
      const isActive = currentCategoryFilter.toLowerCase() === cat.name.toLowerCase();
      const pcsDisplay = cat.pcs >= 1000 ? `${(cat.pcs / 1000).toFixed(1)}k` : cat.pcs;
      const pctDisplay = `${cat.pct.toFixed(0)}%`;
      const svgIcon = getCategorySvg(cat.name, 13);

      const labelFormatted = formatCategoryChartLabel(cat.name);

      return `
        <div class="col-chart-col ${isActive ? 'active' : ''}" data-cat="${cat.name}" title="${cat.name}: ${cat.pcs.toLocaleString()} pcs (${cat.pct.toFixed(1)}%) in ${cat.batches} batches">
          <div class="col-chart-val">
            <span class="col-chart-val-num" style="color: ${isActive ? cat.color : 'inherit'}">${pcsDisplay}</span>
            <span class="col-chart-val-pct">${pctDisplay}</span>
          </div>
          <div class="col-chart-bar-track">
            <div class="col-chart-bar-fill" style="height: ${barHeight}px; background: ${cat.gradient}; color: ${cat.color};"></div>
          </div>
          <div class="col-chart-col-footer">
            <span class="col-chart-label">${labelFormatted}</span>
            <span class="col-chart-batches">${cat.batches} b</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to columns
    chartEl.querySelectorAll('.col-chart-col').forEach(col => {
      col.addEventListener('click', () => {
        const catName = col.getAttribute('data-cat');
        currentCategoryFilter = (currentCategoryFilter === catName) ? 'ALL' : catName;
        renderReportsView();
      });
    });
  }

  // 2. RENDER DETAILED CATEGORY CARDS
  if (catListEl) {
    catListEl.innerHTML = categories.map(cat => {
      const isActive = currentCategoryFilter.toLowerCase() === cat.name.toLowerCase();
      const svgIcon = getCategorySvg(cat.name, 14);

      // Top reasons preview
      const topReasons = Object.entries(cat.reasonsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([k, v]) => `${k} (${v})`)
        .join(' • ');

      let statusBadge = '<span class="status-pill status-approved">Controlled</span>';
      if (cat.pct >= 30) {
        statusBadge = '<span class="status-pill status-danger">High Volume</span>';
      } else if (cat.pct >= 5) {
        statusBadge = '<span class="status-pill status-warning">Moderate</span>';
      }

      return `
        <div class="standard-cat-card ${isActive ? 'active' : ''}" data-cat="${cat.name}">
          <div class="scc-top">
            <div class="scc-title-wrap">
              <div class="scc-icon-pill" style="background: ${cat.bgLight}; color: ${cat.color};">
                ${svgIcon}
              </div>
              <span class="scc-name">${cat.name}</span>
            </div>
            <div class="scc-stat-block">
              <span class="scc-pcs">${cat.pcs.toLocaleString()} pcs</span>
              <span class="scc-pct">(${cat.pct.toFixed(1)}%)</span>
            </div>
          </div>

          <div class="scc-progress-wrap">
            <div class="scc-progress-bar" style="width: ${Math.max(2, cat.pct)}%; background: ${cat.gradient};"></div>
          </div>

          <div class="scc-meta-row">
            <span>Affects <strong>${cat.batches}</strong> batches</span>
            ${statusBadge}
          </div>

          ${topReasons ? `<div class="scc-reasons-preview" title="Top reported defects: ${topReasons}">Top: ${topReasons}</div>` : ''}
        </div>
      `;
    }).join('');

    catListEl.querySelectorAll('.standard-cat-card').forEach(card => {
      card.addEventListener('click', () => {
        const catName = card.getAttribute('data-cat');
        currentCategoryFilter = (currentCategoryFilter === catName) ? 'ALL' : catName;
        renderReportsView();
      });
    });
  }
}

// -------------------------------------------------------------
// DEEP REPAIRING REASONS & PARETO RENDERER (Details Report)
// -------------------------------------------------------------
function renderParetoAnalysis(filteredRecords, totalRepairsCount) {
  const paretoBarList = document.getElementById('paretoBarList');
  const defectChipBar = document.getElementById('defectChipBar');
  const rootCauseText = document.getElementById('rootCauseText');

  // Count defects by Col P granular reason, tagged with Col S category
  const defectCounts = {};
  let totalIdentifiedDefectUnits = 0;

  filteredRecords.forEach(r => {
    if (r.repairQty > 0) {
      let dKey = cleanReasonTitle(r.reason);
      if (dKey === 'Other Defect' && r.repairCategory) {
        dKey = `Rework: ${r.repairCategory}`;
      }
      const catTag = (r.repairCategory && r.repairCategory.trim()) 
        ? r.repairCategory.trim() 
        : classifyRecordToStandardCategory(r.reason, r.repairQty, r.repairCategory);

      if (!defectCounts[dKey]) {
        defectCounts[dKey] = {
          name: dKey,
          category: catTag,
          count: 0,
          batches: 0
        };
      }
      defectCounts[dKey].count += Number(r.repairQty) || 1;
      defectCounts[dKey].batches += 1;
      totalIdentifiedDefectUnits += Number(r.repairQty) || 1;
    }
  });

  const sortedDefects = Object.values(defectCounts).sort((a, b) => b.count - a.count);

  // Render Defect Filter Chips
  if (defectChipBar) {
    let chipHtml = `
      <button type="button" class="defect-chip ${currentDefectReasonFilter === 'ALL' ? 'active' : ''}" data-reason="ALL">
        <span>All Reasons</span>
        <span class="defect-chip-count">${totalRepairsCount}</span>
      </button>
    `;

    sortedDefects.forEach(d => {
      const isActive = currentDefectReasonFilter.toLowerCase() === d.name.toLowerCase();
      const primaryCat = d.category.split(',')[0].trim();
      const svgIcon = getCategorySvg(primaryCat, 13);
      chipHtml += `
        <button type="button" class="defect-chip ${isActive ? 'active' : ''}" data-reason="${d.name}">
          <span>${svgIcon} ${d.name.split('&')[0].split('/')[0].trim()}</span>
          <span class="defect-chip-count">${d.count}</span>
        </button>
      `;
    });

    defectChipBar.innerHTML = chipHtml;

    // Attach click handlers to chips
    defectChipBar.querySelectorAll('.defect-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const r = chip.getAttribute('data-reason');
        currentDefectReasonFilter = (currentDefectReasonFilter === r && r !== 'ALL') ? 'ALL' : r;
        renderReportsView();
      });
    });
  }

  // Render Pareto Bars
  if (paretoBarList) {
    if (sortedDefects.length === 0) {
      paretoBarList.innerHTML = `
        <div class="empty-state">
          ${getCategorySvg('approved', 14)} No repairs recorded under current filters. All inspected pieces passed with 100% quality!
        </div>
      `;
      if (rootCauseText) {
        rootCauseText.innerHTML = `<strong>Quality Status:</strong> Zero defects detected under this criteria. Clean line performance.`;
      }
      return;
    }

    const maxDefectCount = Math.max(1, sortedDefects[0].count);

    paretoBarList.innerHTML = sortedDefects.map((d, idx) => {
      const pctOfTotal = totalIdentifiedDefectUnits > 0
        ? ((d.count / totalIdentifiedDefectUnits) * 100).toFixed(1)
        : '0.0';
      const barWidth = Math.round((d.count / maxDefectCount) * 100);
      const isTop = idx === 0;
      const primaryCat = d.category.split(',')[0].trim();
      const svgIcon = getCategorySvg(primaryCat, 14);

      return `
        <div class="pareto-bar-item" data-reason="${d.name}" title="Click to filter by ${d.name}">
          <div class="pbi-top">
            <div class="pbi-reason-wrap">
              <span class="pbi-rank">#${idx + 1}</span>
              <span class="pbi-name">${svgIcon} ${d.name}</span>
            </div>
            <div class="pbi-stat-wrap">
              <span class="pbi-count">${d.count} pcs</span>
              <span class="pbi-pct">(${pctOfTotal}%)</span>
            </div>
          </div>
          <div class="pbi-progress-bg">
            <div class="pbi-progress-fill ${isTop ? 'top-defect' : ''}" style="width: ${barWidth}%;"></div>
          </div>
          <div class="pbi-meta-row">
            <span class="pbi-category-tag">${d.category}</span>
            <span>Affects ${d.batches} batches</span>
          </div>
        </div>
      `;
    }).join('');

    // Allow clicking pareto item to filter
    paretoBarList.querySelectorAll('.pareto-bar-item').forEach(item => {
      item.addEventListener('click', () => {
        const r = item.getAttribute('data-reason');
        currentDefectReasonFilter = (currentDefectReasonFilter === r) ? 'ALL' : r;
        renderReportsView();
      });
    });

    // Update Root Cause Intelligence Insight
    if (rootCauseText && sortedDefects.length > 0) {
      const top1 = sortedDefects[0];
      const top2 = sortedDefects[1];
      const combinedShare = ((top1.count + (top2 ? top2.count : 0)) / totalIdentifiedDefectUnits * 100).toFixed(1);
      const top2Name = top2 ? ` and <em>${top2.name}</em>` : '';

      rootCauseText.innerHTML = `
        <strong>Key Quality Diagnosis:</strong> <em>${top1.name}</em>${top2Name} represent 
        <strong>${combinedShare}%</strong> of all recorded defects in Database. 
        Focus supervisor audit on <strong>${top1.category}</strong> calibration and trim inspection.
      `;
    }
  }
}

// -------------------------------------------------------------
// MONTH-WISE REPAIRING TRENDS & PERCENTAGE (Smart Combo Chart)
// Smart Column Chart (Repair Volume) + Graph Line (Defect Rate %)
// -------------------------------------------------------------
let currentTrendCategory = 'ALL';
let availableTrendMonths = [];
let selectedTrendMonths = [];
let currentTrendPreset = 'ALL';
let trendEventsBound = false;

function populateTrendMonthControls(availableMonths) {
  const fromSelect = document.getElementById('trendFromMonthSelect');
  const toSelect = document.getElementById('trendToMonthSelect');
  const countPill = document.getElementById('tmrSelectedCountPill');
  const toggleWrap = document.getElementById('trendMonthTogglePills');
  const presetPills = document.querySelectorAll('#trendPresetsBar .tmr-preset-pill');

  if (!fromSelect || !toSelect) return;

  availableTrendMonths = [...availableMonths];

  if (!selectedTrendMonths || selectedTrendMonths.length === 0 || currentTrendPreset === 'ALL') {
    selectedTrendMonths = [...availableMonths];
  } else {
    // Drop any months that no longer exist (e.g. if December date was changed to November in Google Sheet)
    selectedTrendMonths = selectedTrendMonths.filter(m => availableMonths.includes(m));
    if (selectedTrendMonths.length === 0) {
      selectedTrendMonths = [...availableMonths];
    }
  }

  // Populate From & To Dropdowns
  const optionsHtml = availableMonths.map(m => {
    return `<option value="${m}">${formatMonthLabel(m)}</option>`;
  }).join('');

  fromSelect.innerHTML = optionsHtml;
  toSelect.innerHTML = optionsHtml;

  const sortedSelected = [...selectedTrendMonths].sort();
  const minSelected = sortedSelected[0] || availableMonths[0];
  const maxSelected = sortedSelected[sortedSelected.length - 1] || availableMonths[availableMonths.length - 1];

  fromSelect.value = minSelected;
  toSelect.value = maxSelected;

  // Update selected count pill
  if (countPill) {
    if (selectedTrendMonths.length === availableMonths.length) {
      countPill.textContent = `${availableMonths.length} Months (All)`;
    } else {
      countPill.textContent = `${selectedTrendMonths.length} of ${availableMonths.length} Months`;
    }
  }

  // Update Presets Active state
  if (presetPills) {
    presetPills.forEach(p => {
      if (p.getAttribute('data-preset') === currentTrendPreset) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });
  }

  // Populate Individual Month Toggle Pills
  if (toggleWrap) {
    toggleWrap.innerHTML = availableMonths.map(m => {
      const isChecked = selectedTrendMonths.includes(m);
      const short = formatMonthLabel(m).replace(/(\w{3})\w*\s*(\d{4})/, '$1 \'$2').replace('20', '');
      const icon = isChecked
        ? `<svg class="tmr-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
        : `<svg class="tmr-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;

      return `
        <button type="button" class="tmr-toggle-pill ${isChecked ? 'active' : ''}" data-month="${m}">
          ${icon}
          <span>${short}</span>
        </button>
      `;
    }).join('');

    toggleWrap.querySelectorAll('.tmr-toggle-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const m = pill.getAttribute('data-month');
        if (selectedTrendMonths.includes(m)) {
          if (selectedTrendMonths.length <= 1) {
            showToast('At least one month must remain selected');
            return;
          }
          selectedTrendMonths = selectedTrendMonths.filter(x => x !== m);
        } else {
          selectedTrendMonths.push(m);
          selectedTrendMonths.sort();
        }
        currentTrendPreset = 'CUSTOM';
        renderMonthlyRepairTrendChart();
      });
    });
  }
}

function setupTrendMonthRangeEvents() {
  if (trendEventsBound) return;
  trendEventsBound = true;

  const fromSelect = document.getElementById('trendFromMonthSelect');
  const toSelect = document.getElementById('trendToMonthSelect');
  const presetPills = document.querySelectorAll('#trendPresetsBar .tmr-preset-pill');

  if (fromSelect) {
    fromSelect.addEventListener('change', () => {
      const fromVal = fromSelect.value;
      let toVal = toSelect ? toSelect.value : fromVal;
      if (fromVal > toVal) {
        toVal = fromVal;
        if (toSelect) toSelect.value = toVal;
      }
      selectedTrendMonths = availableTrendMonths.filter(m => m >= fromVal && m <= toVal);
      currentTrendPreset = 'CUSTOM';
      renderMonthlyRepairTrendChart();
    });
  }

  if (toSelect) {
    toSelect.addEventListener('change', () => {
      let fromVal = fromSelect ? fromSelect.value : toSelect.value;
      const toVal = toSelect.value;
      if (toVal < fromVal) {
        fromVal = toVal;
        if (fromSelect) fromSelect.value = fromVal;
      }
      selectedTrendMonths = availableTrendMonths.filter(m => m >= fromVal && m <= toVal);
      currentTrendPreset = 'CUSTOM';
      renderMonthlyRepairTrendChart();
    });
  }

  if (presetPills) {
    presetPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const preset = pill.getAttribute('data-preset');
        currentTrendPreset = preset;
        if (preset === 'ALL') {
          selectedTrendMonths = [...availableTrendMonths];
        } else if (preset === 'L3M') {
          selectedTrendMonths = availableTrendMonths.slice(-3);
        } else if (preset === 'L2M') {
          selectedTrendMonths = availableTrendMonths.slice(-2);
        } else if (preset === 'LATEST') {
          selectedTrendMonths = availableTrendMonths.slice(-1);
        }
        renderMonthlyRepairTrendChart();
      });
    });
  }
}

function renderMonthlyRepairTrendChart() {
  const chartWrap = document.getElementById('smartTrendChartWrap');
  const badgeEl = document.getElementById('mtcTrendBadge');
  const barLabel = document.getElementById('tclBarLabel');
  const lineLabel = document.getElementById('tclLineLabel');
  const barBox = document.getElementById('tclBarBox');
  const lineBox = document.getElementById('tclLineBox');

  if (!chartWrap) return;

  // 1. Gather all audited records from cache
  const auditedRecords = (eolQcCache || []).filter(r => 
    r.isAudited !== false && (Number(r.checkedQty) > 0 || Number(r.repairQty) > 0 || Number(r.whQty) > 0 || (r.reason && r.reason !== ''))
  );

  // Group by month YYYY-MM
  const monthMap = {};
  auditedRecords.forEach(r => {
    const dStr = parseGvizDate(r.checkDate);
    const ym = dStr ? dStr.slice(0, 7) : '';
    if (!ym || ym.length < 7 || !ym.includes('-')) return;

    if (!monthMap[ym]) {
      monthMap[ym] = {
        month: ym,
        checked: 0,
        wh: 0,
        repair: 0,
        batches: 0,
        cats: {
          'Stitching': 0,
          'Edge-Paint': 0,
          'Workmanship': 0,
          'Finishing': 0,
          'Hardware': 0,
          'Assembly': 0,
          'Material': 0
        }
      };
    }

    const chk = Number(r.checkedQty) || 0;
    const wh = Number(r.whQty) || 0;
    const rep = Number(r.repairQty) || 0;

    monthMap[ym].checked += chk;
    monthMap[ym].wh += wh;
    monthMap[ym].repair += rep;
    monthMap[ym].batches += 1;

    if (rep > 0) {
      const cat = classifyRecordToStandardCategory(r.reason, rep, r.repairCategory);
      if (monthMap[ym].cats[cat] !== undefined) {
        monthMap[ym].cats[cat] += rep;
      } else {
        monthMap[ym].cats['Workmanship'] += rep;
      }
    }
  });

  const sortedMonths = Object.keys(monthMap).sort();
  if (sortedMonths.length === 0) {
    chartWrap.innerHTML = '<div class="empty-state">No monthly audit records available</div>';
        return;
  }

  // Populate Month Range Dropdowns, Presets & Toggle Pills
  populateTrendMonthControls(sortedMonths);
  setupTrendMonthRangeEvents();

  // Filter by user selected months
  const targetMonths = selectedTrendMonths.length > 0
    ? sortedMonths.filter(m => selectedTrendMonths.includes(m))
    : sortedMonths;

  if (targetMonths.length === 0) {
    chartWrap.innerHTML = '<div class="empty-state">Please select at least one month</div>';
        return;
  }

  if (badgeEl) badgeEl.textContent = `${targetMonths.length} Months`;

  const isAll = currentTrendCategory === 'ALL';
  const activeCatObj = STANDARD_CATEGORIES.find(c => c.name.toLowerCase() === currentTrendCategory.toLowerCase());

  if (barLabel) barLabel.textContent = 'Repairing % (Overall Column)';
  if (lineLabel) {
    lineLabel.textContent = isAll ? '7 Defect Categories (Multiple Lines)' : `${activeCatObj.name} Defect Line`;
  }
  if (barBox) barBox.style.background = 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)';
  if (lineBox) {
    const lCol = !isAll && activeCatObj ? activeCatObj.color : '#ef4444';
    lineBox.style.backgroundColor = lCol;
    lineBox.style.setProperty('--line-color', lCol);
  }

  // 2. Prepare plot data for targetMonths
  const plotData = targetMonths.map(ym => {
    const data = monthMap[ym];
    const totalRepair = data.repair;
    const totalRate = data.checked > 0 ? +((totalRepair / data.checked) * 100).toFixed(1) : 0.0;
    const label = formatMonthLabel(ym);
    const shortLabel = label.replace(/(\w{3})\w*\s*(\d{4})/, "$1 '$2").replace('20', '');
    return {
      month: ym,
      label: label,
      shortLabel: shortLabel,
      checked: data.checked,
      wh: data.wh,
      totalRepair: totalRepair,
      totalRate: totalRate,
      batches: data.batches,
      cats: data.cats
    };
  });

  // Calculate scales based on Repairing % (both column bars and category lines share the % scale!)
  const maxMonthRate = Math.max(...plotData.map(d => d.totalRate), 5);
  const niceRateMax = Math.ceil(maxMonthRate * 1.15 / 5) * 5 || 20; // 20% or 25%

  // Dynamic SVG dimensions
  const count = plotData.length;
  const minColSpacing = 78;
  const padLeft = 40;
  const padRightOffset = 32;
  const svgW = Math.max(380, padLeft + (count * minColSpacing) + padRightOffset);
  const padRight = svgW - padRightOffset;
  const svgH = 235;
  const topY = 32;
  const baseY = 180;
  const plotH = baseY - topY;
  const stepX = (padRight - padLeft) / (count || 1);

  // Compute coordinates for each month
  const points = plotData.map((d, i) => {
    const cx = count === 1 ? (padLeft + padRight) / 2 : padLeft + (stepX * i) + (stepX / 2);
    const barH = Math.max(8, (d.totalRate / niceRateMax) * plotH);
    const barY = baseY - barH;
    return {
      ...d,
      cx: cx,
      barY: barY,
      barH: barH
    };
  });

  // Define 7 Core Categories with exact colors
  const CORE_CATEGORIES = [
    { name: 'Stitching', color: '#ef4444', gradientStart: '#f87171' },
    { name: 'Workmanship', color: '#8b5cf6', gradientStart: '#a78bfa' },
    { name: 'Hardware', color: '#3b82f6', gradientStart: '#60a5fa' },
    { name: 'Edge-Paint', color: '#f97316', gradientStart: '#fb923c' },
    { name: 'Finishing', color: '#10b981', gradientStart: '#34d399' },
    { name: 'Assembly', color: '#f59e0b', gradientStart: '#fbbf24' },
    { name: 'Material', color: '#06b6d4', gradientStart: '#22d3ee' }
  ];

  // Grid lines (horizontal percentage lines)
  let gridLinesSvg = '';
  const numSteps = 4;
  for (let s = 1; s <= numSteps; s++) {
    const ratio = s / numSteps;
    const gy = baseY - (plotH * ratio);
    const rateVal = Math.round(niceRateMax * ratio);
    gridLinesSvg += `
      <line x1="${padLeft - 6}" y1="${gy.toFixed(1)}" x2="${padRight + 6}" y2="${gy.toFixed(1)}" stroke="rgba(13, 92, 58, 0.08)" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${padLeft - 10}" y="${(gy + 3.5).toFixed(1)}" font-size="8.5" font-weight="700" fill="#94a3b8" text-anchor="end">${rateVal}%</text>
      <text x="${padRight + 8}" y="${(gy + 3.5).toFixed(1)}" font-size="8.5" font-weight="700" fill="#94a3b8" text-anchor="start">${rateVal}%</text>
    `;
  }

  // SVG Gradients & Filters
  const gradDefs = `
    <defs>
      <linearGradient id="trendColumnStatueGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#0284c7" />
      </linearGradient>
      <linearGradient id="trendColumnActiveGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#059669" />
        <stop offset="100%" stop-color="#047857" />
      </linearGradient>
      <filter id="columnShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="rgba(2, 132, 199, 0.28)" />
      </filter>
      <filter id="activeLineGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#ef4444" flood-opacity="0.35" />
      </filter>
    </defs>
  `;

  // Baseline
  const baselineSvg = `
    <line x1="${padLeft - 6}" y1="${baseY}" x2="${padRight + 6}" y2="${baseY}" stroke="rgba(13, 92, 58, 0.2)" stroke-width="1.2" />
  `;

  // 1. Column Statues (Pillars representing Overall Month Repairing %)
  const barW = Math.min(38, Math.max(26, stepX * 0.44));
  const barsSvg = points.map(p => {
    const bx = p.cx - (barW / 2);
    const isFilteredMonth = currentMonthFilter === p.month;
    const colFill = isFilteredMonth ? 'url(#trendColumnActiveGrad)' : 'url(#trendColumnStatueGrad)';

    return `
      <g class="trend-col-bar ${isFilteredMonth ? 'active-month' : ''}" data-month="${p.month}" style="cursor: pointer;">
        <!-- Column Pillar -->
        <rect x="${bx.toFixed(1)}" y="${p.barY.toFixed(1)}" width="${barW.toFixed(1)}" height="${p.barH.toFixed(1)}" rx="6" fill="${colFill}" filter="url(#columnShadow)" opacity="0.92">
          <title>Month: ${p.label}\nOverall Repairing %: ${p.totalRate}%\nRepair Pieces: ${p.totalRepair.toLocaleString()} pcs\nChecked: ${p.checked.toLocaleString()} pcs</title>
        </rect>

        <!-- Repair Volume (pcs) inside or above column -->
        <text x="${p.cx.toFixed(1)}" y="${(p.barY - 18).toFixed(1)}" font-size="10" font-weight="800" fill="#0f172a" text-anchor="middle">
          ${p.totalRepair.toLocaleString()}
        </text>

        <!-- Repairing Percentage Callout Badge on Top -->
        <g transform="translate(${p.cx.toFixed(1)}, ${(p.barY - 8).toFixed(1)})">
          <rect x="-19" y="-8.5" width="38" height="16" rx="4" fill="${isFilteredMonth ? '#0b5c39' : '#0f172a'}" />
          <text x="0" y="3.5" font-size="9" font-weight="800" fill="#ffffff" text-anchor="middle">${p.totalRate}%</text>
        </g>
      </g>
    `;
  }).join('');

  // 2. Multiple Defect Category Lines
  let categoryLinesSvg = '';
  let categoryNodesSvg = '';

  CORE_CATEGORIES.forEach(cat => {
    const isCatActive = currentTrendCategory === 'ALL' || currentTrendCategory.toLowerCase() === cat.name.toLowerCase();
    const isSingleFocus = !isAll && currentTrendCategory.toLowerCase() === cat.name.toLowerCase();

    // Line opacity and stroke width
    const strokeWidth = isSingleFocus ? 3.5 : (isAll ? 2.2 : 1.0);
    const lineOpacity = isSingleFocus ? 1.0 : (isAll ? 0.90 : 0.18);
    const nodeOpacity = isSingleFocus ? 1.0 : (isAll ? 1.0 : 0.18);

    // Compute coordinates for this category across months
    const catPoints = points.map(p => {
      const pcs = p.cats[cat.name] || 0;
      const rate = p.checked > 0 ? (pcs / p.checked) * 100 : 0;
      const cy = baseY - ((rate / niceRateMax) * plotH);
      return {
        cx: p.cx,
        cy: cy,
        rate: rate,
        pcs: pcs,
        month: p.month,
        label: p.label
      };
    });

    // Generate smooth bezier curve path
    let pathD = '';
    if (catPoints.length === 1) {
      const p = catPoints[0];
      pathD = `M ${(p.cx - 30).toFixed(1)} ${p.cy.toFixed(1)} L ${(p.cx + 30).toFixed(1)} ${p.cy.toFixed(1)}`;
    } else {
      pathD = `M ${catPoints[0].cx.toFixed(1)} ${catPoints[0].cy.toFixed(1)}`;
      for (let i = 0; i < catPoints.length - 1; i++) {
        const p0 = catPoints[i];
        const p1 = catPoints[i + 1];
        const dx = (p1.cx - p0.cx) / 2;
        pathD += ` C ${(p0.cx + dx).toFixed(1)} ${p0.cy.toFixed(1)}, ${(p1.cx - dx).toFixed(1)} ${p1.cy.toFixed(1)}, ${p1.cx.toFixed(1)} ${p1.cy.toFixed(1)}`;
      }
    }

    // Category Path
    categoryLinesSvg += `
      <path d="${pathD}" fill="none" stroke="${cat.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${lineOpacity}">
        <title>${cat.name} Defect Trend Line</title>
      </path>
    `;

    // Category Nodes / Markers
    catPoints.forEach(cp => {
      if (cp.pcs > 0 || isSingleFocus) {
        const nodeRadius = isSingleFocus ? 4.5 : 3.2;
        categoryNodesSvg += `
          <g class="trend-cat-node" data-category="${cat.name}" data-month="${cp.month}" opacity="${nodeOpacity}" style="cursor: pointer;">
            <circle cx="${cp.cx.toFixed(1)}" cy="${cp.cy.toFixed(1)}" r="${nodeRadius + 2}" fill="${cat.color}" fill-opacity="0.25" />
            <circle cx="${cp.cx.toFixed(1)}" cy="${cp.cy.toFixed(1)}" r="${nodeRadius}" fill="#ffffff" stroke="${cat.color}" stroke-width="2" />
            <title>${cat.name}: ${cp.rate.toFixed(1)}% (${cp.pcs.toLocaleString()} pcs in ${cp.month})</title>
            ${isSingleFocus ? `
              <g transform="translate(${cp.cx.toFixed(1)}, ${(cp.cy - 12).toFixed(1)})">
                <rect x="-16" y="-6.5" width="32" height="13" rx="3" fill="${cat.color}" />
                <text x="0" y="3" font-size="8" font-weight="800" fill="#ffffff" text-anchor="middle">${cp.rate.toFixed(1)}%</text>
              </g>
            ` : ''}
          </g>
        `;
      }
    });
  });

  // 3. X-Axis month labels
  const xLabelsSvg = points.map(p => {
    const isFilteredMonth = currentMonthFilter === p.month;
    const textColor = isFilteredMonth ? '#0b5c39' : '#1e293b';
    const textWeight = isFilteredMonth ? '800' : '700';
    return `
      <g class="trend-x-label-group" data-month="${p.month}" style="cursor: pointer;">
        <text x="${p.cx.toFixed(1)}" y="200" font-size="10.5" font-weight="${textWeight}" fill="${textColor}" text-anchor="middle">${p.shortLabel}</text>
        <text x="${p.cx.toFixed(1)}" y="214" font-size="9" font-weight="600" fill="#64748b" text-anchor="middle">${(p.checked >= 1000 ? (p.checked / 1000).toFixed(1) + 'k' : p.checked)} chk</text>
      </g>
    `;
  }).join('');

  // Assemble full SVG
  const fullSvg = `
    <svg viewBox="0 0 ${svgW} ${svgH}" class="smart-trend-svg" xmlns="http://www.w3.org/2000/svg">
      ${gradDefs}
      ${gridLinesSvg}
      ${baselineSvg}
      ${barsSvg}
      ${categoryLinesSvg}
      ${categoryNodesSvg}
      ${xLabelsSvg}
    </svg>
  `;

  chartWrap.innerHTML = fullSvg;

  // Add click handlers on SVG bars & labels to filter by month
  chartWrap.querySelectorAll('.trend-col-bar, .trend-x-label-group').forEach(el => {
    el.addEventListener('click', () => {
      const ym = el.getAttribute('data-month');
      if (ym) {
        setMonthFilter(currentMonthFilter === ym ? 'ALL' : ym);
      }
    });
  });

  // Add click handlers on category nodes to toggle category filter
  chartWrap.querySelectorAll('.trend-cat-node').forEach(el => {
    el.addEventListener('click', () => {
      const cat = el.getAttribute('data-category');
      if (cat) {
        setTrendCategoryFilter(currentTrendCategory.toLowerCase() === cat.toLowerCase() ? 'ALL' : cat);
      }
    });
  });

  // 4. Update category chips active state
  const chips = document.querySelectorAll('#trendCategoryChips .trend-cat-chip');
  chips.forEach(chip => {
    const cat = chip.getAttribute('data-category');
    if (cat.toLowerCase() === currentTrendCategory.toLowerCase()) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
}

function setupTrendCategoryEvents() {
  const chips = document.querySelectorAll('#trendCategoryChips .trend-cat-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const cat = chip.getAttribute('data-category');
      currentTrendCategory = cat;
      renderMonthlyRepairTrendChart();
    });
  });
}


// =============================================================================
// UNIT-WISE DEFECT CATEGORY ANALYSIS (MULTI-DIMENSIONAL & DATE RANGE)
// =============================================================================
let ucDateFrom = '2026-08-09';
let ucDateTo = '2026-11-03';
let ucSelectedPreset = 'ALL';
let ucViewMode = 'stacked'; // 'stacked' | 'category' | 'rate'
let ucSelectedUnit = 'ALL';
let ucSelectedCategory = 'ALL';
let ucEventsInitialized = false;

const UC_STANDARD_CATEGORIES = [
  { name: 'Stitching', color: '#ef4444', gradient: 'linear-gradient(180deg, #f87171, #dc2626)', bgLight: '#fef2f2', border: '#fca5a5' },
  { name: 'Edge-Paint', color: '#f97316', gradient: 'linear-gradient(180deg, #fb923c, #ea580c)', bgLight: '#fff7ed', border: '#fdba74' },
  { name: 'Workmanship', color: '#8b5cf6', gradient: 'linear-gradient(180deg, #a78bfa, #7c3aed)', bgLight: '#f5f3ff', border: '#c4b5fd' },
  { name: 'Finishing', color: '#10b981', gradient: 'linear-gradient(180deg, #34d399, #059669)', bgLight: '#ecfdf5', border: '#6ee7b7' },
  { name: 'Hardware', color: '#3b82f6', gradient: 'linear-gradient(180deg, #60a5fa, #2563eb)', bgLight: '#eff6ff', border: '#93c5fd' },
  { name: 'Assembly', color: '#f59e0b', gradient: 'linear-gradient(180deg, #fbbf24, #d97706)', bgLight: '#fffbeb', border: '#fde68a' },
  { name: 'Material', color: '#06b6d4', gradient: 'linear-gradient(180deg, #22d3ee, #0891b2)', bgLight: '#ecfeff', border: '#a5f3fc' }
];

const UC_UNIT_COLORS = {
  'P-32': '#0d5c3a',
  'S-37': '#2563eb',
  'S-18': '#7c3aed',
  'S-29': '#ea580c',
  'OTHER': '#64748b'
};

function setupUnitCategoryControls() {
  if (ucEventsInitialized) return;
  ucEventsInitialized = true;

  const inputFrom = document.getElementById('ucDateFrom');
  const inputTo = document.getElementById('ucDateTo');
  const resetBtn = document.getElementById('ucDateResetBtn');
  const presetsBar = document.getElementById('ucDatePresetsBar');

  if (inputFrom && inputTo) {
    inputFrom.value = ucDateFrom;
    inputTo.value = ucDateTo;

    inputFrom.addEventListener('change', () => {
      ucDateFrom = inputFrom.value;
      ucSelectedPreset = 'CUSTOM';
      updateUcPresetButtonsUI();
      renderUnitCategoryAnalysis();
    });

    inputTo.addEventListener('change', () => {
      ucDateTo = inputTo.value;
      ucSelectedPreset = 'CUSTOM';
      updateUcPresetButtonsUI();
      renderUnitCategoryAnalysis();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const { minDate, maxDate } = getEolDatasetMinMaxDates();
      ucDateFrom = minDate;
      ucDateTo = maxDate;
      ucSelectedPreset = 'ALL';
      ucSelectedUnit = 'ALL';
      ucSelectedCategory = 'ALL';
      if (inputFrom) inputFrom.value = ucDateFrom;
      if (inputTo) inputTo.value = ucDateTo;
      updateUcPresetButtonsUI();
      updateUcFilterPillsUI();
      renderUnitCategoryAnalysis();
    });
  }

  if (presetsBar) {
    presetsBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.uc-preset-chip');
      if (!btn) return;
      const preset = btn.dataset.preset;
      ucSelectedPreset = preset;

      if (preset === 'ALL') {
        const { minDate, maxDate } = getEolDatasetMinMaxDates();
        ucDateFrom = minDate;
        ucDateTo = maxDate;
      } else if (preset === 'NOV') {
        ucDateFrom = '2026-11-01';
        ucDateTo = '2026-11-03';
      } else if (preset === 'OCT') {
        ucDateFrom = '2026-10-01';
        ucDateTo = '2026-10-31';
      } else if (preset === 'SEP') {
        ucDateFrom = '2026-09-01';
        ucDateTo = '2026-09-30';
      } else if (preset === 'AUG') {
        ucDateFrom = '2026-08-09';
        ucDateTo = '2026-08-31';
      } else if (preset === 'L30D') {
        ucDateFrom = '2026-10-04';
        ucDateTo = '2026-11-03';
      }

      if (inputFrom) inputFrom.value = ucDateFrom;
      if (inputTo) inputTo.value = ucDateTo;
      updateUcPresetButtonsUI();
      renderUnitCategoryAnalysis();
    });
  }

  // Dimension View Mode Toggles
  const dimButtons = document.querySelectorAll('.uc-dim-toggle-btn');
  dimButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      dimButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ucViewMode = btn.dataset.view || 'stacked';
      renderUnitCategoryAnalysis();
    });
  });

  // Unit Filter Pills
  const unitPillsWrap = document.getElementById('ucUnitFilterPills');
  if (unitPillsWrap) {
    unitPillsWrap.addEventListener('click', (e) => {
      const pill = e.target.closest('.uc-unit-pill');
      if (!pill) return;
      ucSelectedUnit = pill.dataset.unit || 'ALL';
      unitPillsWrap.querySelectorAll('.uc-unit-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderUnitCategoryAnalysis();
    });
  }

  // Category Filter Pills
  const catPillsWrap = document.getElementById('ucCategoryFilterPills');
  if (catPillsWrap) {
    catPillsWrap.addEventListener('click', (e) => {
      const pill = e.target.closest('.uc-cat-pill');
      if (!pill) return;
      ucSelectedCategory = pill.dataset.category || 'ALL';
      catPillsWrap.querySelectorAll('.uc-cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderUnitCategoryAnalysis();
    });
  }
}

function updateUcPresetButtonsUI() {
  const chips = document.querySelectorAll('#ucDatePresetsBar .uc-preset-chip');
  chips.forEach(c => {
    if (c.dataset.preset === ucSelectedPreset) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
}

function updateUcFilterPillsUI() {
  const uPills = document.querySelectorAll('#ucUnitFilterPills .uc-unit-pill');
  uPills.forEach(p => {
    if (p.dataset.unit === ucSelectedUnit) p.classList.add('active');
    else p.classList.remove('active');
  });

  const cPills = document.querySelectorAll('#ucCategoryFilterPills .uc-cat-pill');
  cPills.forEach(p => {
    if (p.dataset.category && p.dataset.category.toLowerCase() === ucSelectedCategory.toLowerCase()) p.classList.add('active');
    else p.classList.remove('active');
  });
}

function renderUnitCategoryAnalysis() {
  const chartWrap = document.getElementById('ucChartWrap');
  const legendWrap = document.getElementById('ucChartLegend');
  const matrixWrap = document.getElementById('ucMatrixTableWrap');
  const cardsWrap = document.getElementById('ucUnitCardsGrid');
  const badgeEl = document.getElementById('ucHeaderBadge');
  const spanRangeText = document.getElementById('ucSpanRangeText');
  const spanBatches = document.getElementById('ucSpanBatches');
  const spanChecked = document.getElementById('ucSpanChecked');
  const spanRepair = document.getElementById('ucSpanRepair');

  if (!chartWrap || !matrixWrap) return;

  // 1. Gather audited records from cache
  const auditedRecords = (eolQcCache || []).filter(r => 
    !String(r.batchId || '').toUpperCase().includes('TT-0025') &&
    r.isAudited !== false && (Number(r.checkedQty) > 0 || Number(r.repairQty) > 0 || Number(r.whQty) > 0 || (r.reason && r.reason !== ''))
  );

  // 2. Filter by inspection date range (Column AE: CHECK DATE)
  const filteredRecords = auditedRecords.filter(r => {
    const d = parseGvizDate(r.checkDate) || '';
    if (ucDateFrom && d && d < ucDateFrom) return false;
    if (ucDateTo && d && d > ucDateTo) return false;
    return true;
  });

  // 3. Compute Summary Span Metrics
  let spanBatchesCount = filteredRecords.length;
  let spanTotalChecked = 0;
  let spanTotalRepair = 0;
  filteredRecords.forEach(r => {
    spanTotalChecked += (Number(r.checkedQty) || 0);
    spanTotalRepair += (Number(r.repairQty) || 0);
  });
  const spanDefectPct = spanTotalChecked > 0 ? ((spanTotalRepair / spanTotalChecked) * 100).toFixed(1) : '0.0';

  if (spanRangeText) {
    const fStr = ucDateFrom || 'Earliest';
    const tStr = ucDateTo || 'Latest';
    spanRangeText.textContent = `${fStr} to ${tStr}`;
  }
  if (spanBatches) spanBatches.textContent = `${spanBatchesCount} batches`;
  if (spanChecked) spanChecked.textContent = spanTotalChecked.toLocaleString();
  if (spanRepair) spanRepair.textContent = `${spanTotalRepair.toLocaleString()} (${spanDefectPct}%)`;

  // 4. Build Multi-Dimensional Matrix (Unit x Category)
  const categoryNames = UC_STANDARD_CATEGORIES.map(c => c.name);
  const unitMap = {};
  const catTotals = {};
  categoryNames.forEach(c => { catTotals[c] = 0; });

  filteredRecords.forEach(r => {
    const uRaw = (r.unit || 'Other').trim().toUpperCase().replace(/^UNIT\s*/i, '');
    if (!unitMap[uRaw]) {
      unitMap[uRaw] = {
        unit: uRaw,
        checked: 0,
        wh: 0,
        repair: 0,
        batches: 0,
        cats: {}
      };
      categoryNames.forEach(c => { unitMap[uRaw].cats[c] = 0; });
    }

    const chk = Number(r.checkedQty) || 0;
    const rep = Number(r.repairQty) || 0;
    const wh = Number(r.whQty) || 0;

    unitMap[uRaw].checked += chk;
    unitMap[uRaw].wh += wh;
    unitMap[uRaw].repair += rep;
    unitMap[uRaw].batches += 1;

    if (rep > 0) {
      const cat = classifyRecordToStandardCategory(r.reason, rep, r.repairCategory);
      if (unitMap[uRaw].cats[cat] !== undefined) {
        unitMap[uRaw].cats[cat] += rep;
        catTotals[cat] += rep;
      } else {
        unitMap[uRaw].cats['Workmanship'] += rep;
        catTotals['Workmanship'] += rep;
      }
    }
  });

  // Sort units: active audited units with checked > 0 first, sorted by checked volume
  let unitsList = Object.values(unitMap).filter(u => u.checked > 0 || u.repair > 0);
  unitsList.sort((a, b) => b.checked - a.checked);

  if (badgeEl) {
    badgeEl.textContent = `${unitsList.length} Active Units`;
  }

  // 5. Render Responsive Multi-Dimensional SVG Chart
  renderUcChart(chartWrap, unitsList, catTotals, spanTotalRepair, spanTotalChecked);

  // 6. Render Chart Category Legend
  renderUcLegend(legendWrap, catTotals, spanTotalRepair);

  // 7. Render Cross-Matrix Data Table
  renderUcMatrixTable(matrixWrap, unitsList, catTotals, spanTotalChecked, spanTotalRepair, spanDefectPct);

  // 8. Render Unit Defect Profile Insight Cards
  renderUcUnitCards(cardsWrap, unitsList);
}

// -----------------------------------------------------------------------------
// SVG MULTI-DIMENSIONAL CHART RENDERER
// -----------------------------------------------------------------------------
function renderUcChart(container, unitsList, catTotals, totalRepair, totalChecked) {
  if (!unitsList || unitsList.length === 0 || totalChecked === 0) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 11px;">
        ${getCategorySvg('approved', 24)}
        <p style="margin-top: 8px; font-weight: 700;">No defect records found in the selected date range (${ucDateFrom} to ${ucDateTo}).</p>
      </div>`;
    return;
  }

  // Filter units if ucSelectedUnit is specific
  const displayUnits = ucSelectedUnit === 'ALL' ? unitsList : unitsList.filter(u => u.unit === ucSelectedUnit);

  if (ucViewMode === 'rate') {
    // Mode 2: Defect Rate % Comparison
    renderDefectRateChart(container, displayUnits, totalChecked, totalRepair);
  } else {
    // Mode 1: Unit & Category Combo Chart (Default)
    renderStackedUnitChart(container, displayUnits);
  }
}

// Mode 1: Unit Repairing % Column + Defect Category Line Graph Combo
function renderStackedUnitChart(container, units) {
  if (!units || units.length === 0) {
    container.innerHTML = '<div class="empty-state">No unit inspection records found</div>';
    return;
  }



  // Calculate scales based on Repairing % (0% to ~25-30%)
  const maxUnitRate = Math.max(...units.map(u => u.checked > 0 ? (u.repair / u.checked) * 100 : 0), 5);
  const niceRateMax = Math.ceil(maxUnitRate * 1.15 / 5) * 5 || 25;

  const count = units.length;
  const minColSpacing = 86;
  const padLeft = 44;
  const padRightOffset = 28;
  const svgWidth = Math.max(460, padLeft + (count * minColSpacing) + padRightOffset);
  const padRight = svgWidth - padRightOffset;
  // Taller vertical dimension for prominent, elongated columns and zero dead space below
  const svgHeight = 360;
  const topY = 36;
  const baselineY = 296;
  const plotH = baselineY - topY; // 260px tall column plot area (increased from 148px)
  const stepX = (padRight - padLeft) / (count || 1);

  // Compute coordinates for each unit
  const points = units.map((u, i) => {
    const cx = count === 1 ? (padLeft + padRight) / 2 : padLeft + (stepX * i) + (stepX / 2);
    const totalRate = u.checked > 0 ? (u.repair / u.checked) * 100 : 0;
    const barH = Math.max(12, (totalRate / niceRateMax) * plotH);
    const barY = baselineY - barH;
    return {
      ...u,
      cx,
      totalRate,
      barH,
      barY
    };
  });

  // Grid lines (horizontal percentage lines)
  let gridLinesSvg = '';
  const numSteps = 5;
  for (let s = 1; s <= numSteps; s++) {
    const ratio = s / numSteps;
    const gy = baselineY - (plotH * ratio);
    const rateVal = Math.round(niceRateMax * ratio);
    gridLinesSvg += `
      <line x1="${padLeft - 6}" y1="${gy.toFixed(1)}" x2="${padRight + 6}" y2="${gy.toFixed(1)}" stroke="rgba(13, 92, 58, 0.08)" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${padLeft - 10}" y="${(gy + 3.5).toFixed(1)}" font-size="9" font-weight="700" fill="#94a3b8" text-anchor="end">${rateVal}%</text>
      <text x="${padRight + 8}" y="${(gy + 3.5).toFixed(1)}" font-size="9" font-weight="700" fill="#94a3b8" text-anchor="start">${rateVal}%</text>
    `;
  }

  // Gradients & Shadow
  const gradDefs = `
    <defs>
      <linearGradient id="ucColumnStatueGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#0284c7" />
      </linearGradient>
      <linearGradient id="ucColumnActiveGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#059669" />
        <stop offset="100%" stop-color="#047857" />
      </linearGradient>
      <filter id="ucColShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="rgba(2, 132, 199, 0.28)" />
      </filter>
    </defs>
  `;

  // Baseline
  const baselineSvg = `
    <line x1="${padLeft - 6}" y1="${baselineY}" x2="${padRight + 6}" y2="${baselineY}" stroke="rgba(13, 92, 58, 0.2)" stroke-width="1.2" />
  `;

  // 1. Column Statues (Pillars representing Overall Unit Repairing %)
  const barW = Math.min(48, Math.max(30, stepX * 0.44));
  const barsSvg = points.map(p => {
    const bx = p.cx - (barW / 2);
    const isFilteredUnit = ucSelectedUnit === p.unit;
    const colFill = isFilteredUnit ? 'url(#ucColumnActiveGrad)' : 'url(#ucColumnStatueGrad)';
    const repairFormatted = p.repair >= 1000 ? (p.repair / 1000).toFixed(1) + 'k' : p.repair.toLocaleString();

    return `
      <g class="uc-col-bar ${isFilteredUnit ? 'active-unit' : ''}" data-unit="${p.unit}" style="cursor: pointer;">
        <!-- Column Pillar -->
        <rect x="${bx.toFixed(1)}" y="${p.barY.toFixed(1)}" width="${barW.toFixed(1)}" height="${p.barH.toFixed(1)}" rx="7" fill="${colFill}" filter="url(#ucColShadow)" opacity="0.94">
          <title>Unit: Unit ${p.unit}\nOverall Repairing %: ${p.totalRate.toFixed(1)}%\nRepair Volume: ${p.repair.toLocaleString()} pcs\nChecked: ${p.checked.toLocaleString()} pcs</title>
        </rect>

        <!-- Repair Volume (pcs) above column -->
        <text x="${p.cx.toFixed(1)}" y="${(p.barY - 21).toFixed(1)}" font-size="10.5" font-weight="800" fill="#0f172a" text-anchor="middle">
          ${repairFormatted}
        </text>

        <!-- Repairing Percentage Callout Badge on Top -->
        <g transform="translate(${p.cx.toFixed(1)}, ${(p.barY - 9).toFixed(1)})">
          <rect x="-20" y="-9" width="40" height="18" rx="5" fill="${isFilteredUnit ? '#0b5c39' : '#0f172a'}" />
          <text x="0" y="3.5" font-size="9.5" font-weight="800" fill="#ffffff" text-anchor="middle">${p.totalRate.toFixed(1)}%</text>
        </g>
      </g>
    `;
  }).join('');

  // 2. Defect Category Graph Lines overlaid across Units
  const CORE_CATEGORIES = UC_STANDARD_CATEGORIES;
  let categoryLinesSvg = '';
  let categoryNodesSvg = '';

  const isAll = ucSelectedCategory === 'ALL';

  CORE_CATEGORIES.forEach(cat => {
    const isCatActive = isAll || ucSelectedCategory.toLowerCase() === cat.name.toLowerCase();
    const isSingleFocus = !isAll && ucSelectedCategory.toLowerCase() === cat.name.toLowerCase();

    // Line opacity and stroke width
    const strokeWidth = isSingleFocus ? 3.5 : (isAll ? 2.2 : 0.8);
    const lineOpacity = isSingleFocus ? 1.0 : (isAll ? 0.88 : 0.14);
    const nodeOpacity = isSingleFocus ? 1.0 : (isAll ? 1.0 : 0.14);

    // Compute coordinates for this category across units
    const catPoints = points.map(p => {
      const pcs = (p.cats && p.cats[cat.name]) || 0;
      const catRate = p.checked > 0 ? (pcs / p.checked) * 100 : 0;
      const cy = baselineY - ((catRate / niceRateMax) * plotH);
      return {
        cx: p.cx,
        cy: cy,
        catRate: catRate,
        pcs: pcs,
        unit: p.unit
      };
    });

    // Generate smooth bezier curve path
    let pathD = '';
    if (catPoints.length === 1) {
      const p = catPoints[0];
      pathD = `M ${(p.cx - 28).toFixed(1)} ${p.cy.toFixed(1)} L ${(p.cx + 28).toFixed(1)} ${p.cy.toFixed(1)}`;
    } else {
      pathD = `M ${catPoints[0].cx.toFixed(1)} ${catPoints[0].cy.toFixed(1)}`;
      for (let i = 0; i < catPoints.length - 1; i++) {
        const p0 = catPoints[i];
        const p1 = catPoints[i + 1];
        const dx = (p1.cx - p0.cx) / 2;
        pathD += ` C ${(p0.cx + dx).toFixed(1)} ${p0.cy.toFixed(1)}, ${(p1.cx - dx).toFixed(1)} ${p1.cy.toFixed(1)}, ${p1.cx.toFixed(1)} ${p1.cy.toFixed(1)}`;
      }
    }

    // Category Path
    categoryLinesSvg += `
      <path d="${pathD}" fill="none" stroke="${cat.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${lineOpacity}">
        <title>${cat.name} Defect Trend Across Units</title>
      </path>
    `;

    // Category Nodes / Markers
    catPoints.forEach(cp => {
      if (cp.pcs > 0 || isSingleFocus) {
        const nodeRadius = isSingleFocus ? 4.5 : 3.2;
        categoryNodesSvg += `
          <g class="uc-cat-node" data-category="${cat.name}" data-unit="${cp.unit}" opacity="${nodeOpacity}" style="cursor: pointer;">
            <circle cx="${cp.cx.toFixed(1)}" cy="${cp.cy.toFixed(1)}" r="${nodeRadius + 2}" fill="${cat.color}" fill-opacity="0.25" />
            <circle cx="${cp.cx.toFixed(1)}" cy="${cp.cy.toFixed(1)}" r="${nodeRadius}" fill="#ffffff" stroke="${cat.color}" stroke-width="2" />
            <title>Unit ${cp.unit} - ${cat.name}: ${cp.catRate.toFixed(1)}% (${cp.pcs.toLocaleString()} pcs)</title>
            ${isSingleFocus ? `
              <g transform="translate(${cp.cx.toFixed(1)}, ${(cp.cy - 12).toFixed(1)})">
                <rect x="-16" y="-6.5" width="32" height="13" rx="3" fill="${cat.color}" />
                <text x="0" y="3" font-size="8" font-weight="800" fill="#ffffff" text-anchor="middle">${cp.catRate.toFixed(1)}%</text>
              </g>
            ` : ''}
          </g>
        `;
      }
    });
  });

  // 3. X-Axis unit labels positioned right under the baseline (296)
  const xLabelsSvg = points.map(p => {
    const isFilteredUnit = ucSelectedUnit === p.unit;
    const textColor = isFilteredUnit ? '#0b5c39' : '#1e293b';
    const textWeight = isFilteredUnit ? '800' : '700';
    const chkFormatted = p.checked >= 1000 ? (p.checked / 1000).toFixed(1) + 'k' : p.checked;
    return `
      <g class="uc-x-label-group" data-unit="${p.unit}" style="cursor: pointer;">
        <text x="${p.cx.toFixed(1)}" y="322" font-size="11.5" font-weight="${textWeight}" fill="${textColor}" text-anchor="middle">Unit ${p.unit}</text>
        <text x="${p.cx.toFixed(1)}" y="340" font-size="9.5" font-weight="600" fill="#64748b" text-anchor="middle">${chkFormatted} chk</text>
      </g>
    `;
  }).join('');

  // Assemble full SVG
  container.innerHTML = `
    <svg class="uc-chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
      ${gradDefs}
      ${gridLinesSvg}
      ${baselineSvg}
      ${barsSvg}
      ${categoryLinesSvg}
      ${categoryNodesSvg}
      ${xLabelsSvg}
    </svg>
  `;

  // Click handlers on SVG bars & labels to filter by Unit
  container.querySelectorAll('.uc-col-bar, .uc-x-label-group').forEach(el => {
    el.addEventListener('click', () => {
      const u = el.getAttribute('data-unit');
      if (u) {
        ucSelectedUnit = ucSelectedUnit === u ? 'ALL' : u;
        updateUcFilterPillsUI();
        renderUnitCategoryAnalysis();
      }
    });
  });

  // Click handlers on category nodes to toggle category filter
  container.querySelectorAll('.uc-cat-node').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const cat = el.getAttribute('data-category');
      if (cat) {
        ucSelectedCategory = ucSelectedCategory.toLowerCase() === cat.toLowerCase() ? 'ALL' : cat;
        updateUcFilterPillsUI();
        renderUnitCategoryAnalysis();
      }
    });
  });
}


// Mode 2: By Category (Distribution across units)
function renderCategoryBreakdownChart(container, units, catTotals) {
  const svgWidth = 520;
  const svgHeight = 240;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 30;
  const padBottom = 45;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;
  const baselineY = padTop + chartH;

  const categories = UC_STANDARD_CATEGORIES;
  const maxVal = Math.max(...categories.map(c => catTotals[c.name] || 0), 50);
  const niceMax = Math.ceil(maxVal * 1.15 / 100) * 100 || 100;

  const barCount = categories.length;
  const barWidth = Math.min(42, (chartW / barCount) * 0.7);
  const gap = (chartW - (barWidth * barCount)) / (barCount + 1);

  let gridSvg = '';
  for (let step = 0; step <= 3; step++) {
    const val = Math.round((niceMax / 3) * step);
    const yPos = baselineY - (val / niceMax) * chartH;
    gridSvg += `
      <line x1="${padLeft}" y1="${yPos}" x2="${svgWidth - padRight}" y2="${yPos}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="3,3"/>
      <text x="${padLeft - 6}" y="${yPos + 3}" text-anchor="end" font-size="9" fill="#94a3b8" font-weight="700">${val >= 1000 ? (val/1000).toFixed(1)+'k' : val}</text>
    `;
  }

  let barsSvg = '';
  categories.forEach((c, idx) => {
    const xPos = padLeft + gap + idx * (barWidth + gap);
    const totPcs = catTotals[c.name] || 0;
    let currY = baselineY;

    // Stack segments per unit
    units.forEach((u, uIdx) => {
      const uPcs = u.cats[c.name] || 0;
      if (uPcs <= 0) return;
      const segH = Math.max(2, (uPcs / niceMax) * chartH);
      const segY = currY - segH;
      const uColor = UC_UNIT_COLORS[u.unit] || '#64748b';

      barsSvg += `
        <rect x="${xPos}" y="${segY}" width="${barWidth}" height="${segH}" rx="3" fill="${uColor}" opacity="0.9">
          <title>${c.name} - Unit ${u.unit}: ${uPcs.toLocaleString()} pcs</title>
        </rect>
      `;
      currY = segY;
    });

    // Top label
    const pcsText = totPcs >= 1000 ? (totPcs / 1000).toFixed(1) + 'k' : totPcs;
    barsSvg += `
      <text x="${xPos + barWidth / 2}" y="${currY - 5}" text-anchor="middle" font-size="10" font-weight="800" fill="#0f172a">${pcsText}</text>
    `;

    // Short category name below
    const shortName = c.name.length > 7 ? c.name.slice(0, 6) + '.' : c.name;
    barsSvg += `
      <text x="${xPos + barWidth / 2}" y="${baselineY + 15}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#0f172a">${shortName}</text>
    `;
  });

  container.innerHTML = `
    <svg class="uc-chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
      ${gridSvg}
      <line x1="${padLeft}" y1="${baselineY}" x2="${svgWidth - padRight}" y2="${baselineY}" stroke="#cbd5e1" stroke-width="1.5"/>
      ${barsSvg}
    </svg>
  `;
}

// Mode 2: Radial Bar Chart (Unit-wise View)
function renderDefectRateChart(container, units, totalChecked, totalRepair) {
  if (!units || units.length === 0) {
    container.innerHTML = '<div class="empty-state">No unit inspection records found</div>';
    return;
  }

  // Calculate overall factory average defect rate
  const avgRate = totalChecked > 0 ? (totalRepair / totalChecked) * 100 : 0;

  // Sort units descending by defect rate
  const sortedUnits = [...units].map(u => {
    const rate = u.checked > 0 ? (u.repair / u.checked) * 100 : 0;
    return { ...u, rate };
  }).sort((a, b) => b.rate - a.rate);

  // Distinct palette matching the user mockup: Red, Orange, Amber, Emerald, Cyan, Purple
  const RADIAL_PALETTE = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6'];

  const cx = 100;
  const cy = 100;
  const baseR = 85;
  const strokeW = 10;
  const ringGap = 13;
  const maxScale = 55.0; // 22.2% produces ~145 deg arc, identical to user design

  let tracksSvg = '';
  let arcsSvg = '';
  let rowsHtml = '';

  sortedUnits.forEach((u, i) => {
    const r = baseR - (i * ringGap);
    if (r <= 32) return; // safeguard inner space

    const C = 2 * Math.PI * r;
    const frac = Math.min(1.0, Math.max(0.01, u.rate / maxScale));
    const arcLen = frac * C;
    const color = RADIAL_PALETTE[i % RADIAL_PALETTE.length];
    const isFiltered = ucSelectedUnit === u.unit;
    const opacity = (ucSelectedUnit === 'ALL' || isFiltered) ? '1.0' : '0.25';

    // Background track circle
    tracksSvg += `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="${strokeW}" stroke-linecap="round" opacity="0.75" />
    `;

    // Progress arc
    arcsSvg += `
      <circle cx="${cx}" cy="${cy}" r="${r}" data-unit="${u.unit}" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-dasharray="${arcLen.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" opacity="${opacity}" style="cursor: pointer; transition: opacity 0.25s ease;">
        <title>Unit ${u.unit}: ${u.rate.toFixed(1)}% (${u.repair.toLocaleString()} / ${u.checked.toLocaleString()} pcs)</title>
      </circle>
    `;

    // Side card row
    rowsHtml += `
      <div class="uc-radial-legend-row ${isFiltered ? 'active' : ''}" data-unit="${u.unit}" title="Unit ${u.unit}: ${u.rate.toFixed(1)}% (${u.repair.toLocaleString()} / ${u.checked.toLocaleString()} pcs)">
        <div class="uc-rl-left">
          <span class="uc-rl-dot" style="background: ${color}; box-shadow: 0 2px 6px ${color}66;"></span>
          <span class="uc-rl-unit">${u.unit}</span>
        </div>
        <div class="uc-rl-right">
          <strong class="uc-rl-rate">${u.rate.toFixed(1)}%</strong>
        </div>
      </div>
    `;
  });

  // Authentic Factory Silhouette SVG Icon with 2 Sawteeth, Chimney & Windows
  const factoryIconSvg = `
    <g transform="translate(88.75, 67)" fill="#9c8879">
      <path d="M3 21 L3 14 L8.5 10 L8.5 14 L14 10 L14 14 L16.5 14 L16.5 4.5 L19.5 4.5 L19.5 21 Z" />
      <rect x="4.8" y="16" width="2.4" height="2.4" rx="0.3" fill="#ffffff" />
      <rect x="9.5" y="16" width="2.4" height="2.4" rx="0.3" fill="#ffffff" />
      <rect x="14.2" y="16" width="2.4" height="2.4" rx="0.3" fill="#ffffff" />
    </g>
  `;

  const centerTextSvg = `
    ${factoryIconSvg}
    <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="16" font-weight="800" fill="#0f172a" font-family="-apple-system, BlinkMacSystemFont, sans-serif">${avgRate.toFixed(1)}%</text>
    <text x="${cx}" y="${cy + 25}" text-anchor="middle" font-size="9" font-weight="700" fill="#64748b" font-family="-apple-system, BlinkMacSystemFont, sans-serif">Factory Avg.</text>
  `;

  container.innerHTML = `
    <div class="uc-radial-container">
      <div class="uc-radial-header">
        <div class="uc-radial-title">
          <h4>4. Radial Bar <span class="uc-radial-subhead">(Unit-wise View)</span></h4>
        </div>
      </div>

      <div class="uc-radial-body">
        <!-- Left: Radial Bar Concentric Circles -->
        <div class="uc-radial-svg-wrap">
          <svg class="uc-radial-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            ${tracksSvg}
            ${arcsSvg}
            ${centerTextSvg}
          </svg>
        </div>

        <!-- Right: Floating Metric Card -->
        <div class="uc-radial-legend-card">
          ${rowsHtml}
        </div>
      </div>
    </div>
  `;

  // Attach interactive click on rows and arcs
  container.querySelectorAll('.uc-radial-legend-row, circle[data-unit]').forEach(el => {
    el.addEventListener('click', () => {
      const u = el.getAttribute('data-unit');
      if (u) {
        ucSelectedUnit = ucSelectedUnit === u ? 'ALL' : u;
        updateUcFilterPillsUI();
        renderUnitCategoryAnalysis();
      }
    });
  });
}


// -----------------------------------------------------------------------------
// LEGEND RENDERER
// -----------------------------------------------------------------------------
function renderUcLegend(container, catTotals, totalRepair) {
  if (!container) return;

  let itemsHtml = '';
  UC_STANDARD_CATEGORIES.forEach(c => {
    const pcs = catTotals[c.name] || 0;
    const pct = totalRepair > 0 ? ((pcs / totalRepair) * 100).toFixed(0) : 0;
    itemsHtml += `
      <div class="uc-legend-item">
        <span class="uc-legend-color" style="background: ${c.color};"></span>
        <span>${c.name}: <strong>${pcs.toLocaleString()}</strong> (${pct}%)</span>
      </div>
    `;
  });

  container.innerHTML = itemsHtml;
}

// -----------------------------------------------------------------------------
// CROSS-MATRIX TABLE RENDERER
// -----------------------------------------------------------------------------
function renderUcMatrixTable(container, units, catTotals, totalChecked, totalRepair, defectRate) {
  if (!container) return;

  const categories = UC_STANDARD_CATEGORIES;

  let theadCols = `
    <th class="uc-th-unit">Production Unit</th>
    <th>Checked</th>
  `;
  categories.forEach(c => {
    theadCols += `<th>${c.name}</th>`;
  });
  theadCols += `
    <th>Total Rep</th>
    <th>Defect %</th>
  `;

  let tbodyRows = '';
  units.forEach(u => {
    const rate = u.checked > 0 ? ((u.repair / u.checked) * 100).toFixed(1) : '0.0';
    let cells = `
      <td class="uc-td-unit">Unit ${u.unit}</td>
      <td style="font-weight: 700;">${u.checked.toLocaleString()}</td>
    `;

    categories.forEach(c => {
      const pcs = u.cats[c.name] || 0;
      let heatClass = 'uc-cell-zero';
      if (pcs > 200) heatClass = 'uc-cell-heat-high';
      else if (pcs > 30) heatClass = 'uc-cell-heat-med';
      else if (pcs > 0) heatClass = 'uc-cell-heat-low';

      cells += `<td class="${heatClass}">${pcs > 0 ? pcs.toLocaleString() : '-'}</td>`;
    });

    const rateColor = Number(rate) > 15 ? '#b91c1c' : (Number(rate) > 8 ? '#b45309' : '#15803d');
    cells += `
      <td style="font-weight: 800; color: #b91c1c;">${u.repair.toLocaleString()}</td>
      <td style="font-weight: 800; color: ${rateColor};">${rate}%</td>
    `;

    tbodyRows += `<tr>${cells}</tr>`;
  });

  // Summary Row (Totals)
  let totalCells = `
    <td class="uc-td-unit">Total / Avg</td>
    <td style="font-weight: 800;">${totalChecked.toLocaleString()}</td>
  `;
  categories.forEach(c => {
    const tot = catTotals[c.name] || 0;
    totalCells += `<td style="font-weight: 800;">${tot > 0 ? tot.toLocaleString() : '-'}</td>`;
  });
  totalCells += `
    <td style="font-weight: 800; color: #b91c1c;">${totalRepair.toLocaleString()}</td>
    <td style="font-weight: 800; color: #b91c1c;">${defectRate}%</td>
  `;

  const totalRowHtml = `<tr class="uc-row-total">${totalCells}</tr>`;

  container.innerHTML = `
    <table class="uc-matrix-table">
      <thead>
        <tr>${theadCols}</tr>
      </thead>
      <tbody>
        ${tbodyRows}
      </tbody>
      <tfoot>
        ${totalRowHtml}
      </tfoot>
    </table>
  `;
}

// -----------------------------------------------------------------------------
// UNIT DEFECT PROFILE INSIGHT CARDS RENDERER
// -----------------------------------------------------------------------------
function renderUcUnitCards(container, units) {
  if (!container) return;

  let cardsHtml = '';
  units.forEach(u => {
    const rate = u.checked > 0 ? (u.repair / u.checked) * 100 : 0;
    let rateClass = 'rate-good';
    if (rate > 15) rateClass = 'rate-bad';
    else if (rate > 8) rateClass = 'rate-mid';

    // Find top defect category
    let topCat = null;
    let topPcs = 0;
    let secCat = null;
    let secPcs = 0;

    Object.entries(u.cats).forEach(([catName, pcs]) => {
      if (pcs > topPcs) {
        secCat = topCat;
        secPcs = topPcs;
        topCat = catName;
        topPcs = pcs;
      } else if (pcs > secPcs) {
        secCat = catName;
        secPcs = pcs;
      }
    });

    const topPct = u.repair > 0 ? ((topPcs / u.repair) * 100).toFixed(1) : 0;
    const secPct = u.repair > 0 ? ((secPcs / u.repair) * 100).toFixed(1) : 0;

    cardsHtml += `
      <div class="uc-unit-card">
        <div class="uc-unit-card-head">
          <span class="uc-unit-card-name">Unit ${u.unit}</span>
          <span class="uc-unit-card-rate ${rateClass}">${rate.toFixed(1)}% Defect</span>
        </div>
        <div class="uc-unit-card-metrics">
          <span>Checked: <strong>${u.checked.toLocaleString()}</strong></span>
          <span>Repair: <strong>${u.repair.toLocaleString()}</strong></span>
        </div>
        ${topCat && topPcs > 0 ? `
          <div class="uc-unit-driver-tag">
            ${getCategorySvg(topCat, 11)}
            <span>Top: <strong>${topCat}</strong> (${topPcs.toLocaleString()} pcs, ${topPct}%)</span>
          </div>
        ` : ''}
        ${secCat && secPcs > 0 ? `
          <div class="uc-unit-driver-tag" style="opacity: 0.85;">
            ${getCategorySvg(secCat, 11)}
            <span>2nd: <strong>${secCat}</strong> (${secPcs.toLocaleString()} pcs, ${secPct}%)</span>
          </div>
        ` : ''}
      </div>
    `;
  });

  container.innerHTML = cardsHtml;
}


// -------------------------------------------------------------
// BRAND-WISE REPAIR ANALYSIS (COLUMN STATUES + DEFECT GRAPH LINES)
// -------------------------------------------------------------
let selectedBrandDateFrom = '2026-08-09';
let selectedBrandDateTo = '2026-11-03';
let selectedBrandDatePreset = 'ALL';
let currentBrandFilter = 'ALL';
let currentBrandCategoryFilter = 'ALL';
let brandControlsInitialized = false;

function normalizeBrandName(raw) {
  if (!raw) return 'Unknown';
  const str = raw.toString().trim();
  const up = str.toUpperCase();
  if (up === 'PIQUARDO' || up.includes('PIQUADRO')) return 'PIQUADRO';
  if (up === 'ABBOT LYON' || up === 'ABOTTLEON' || up === 'ABBOTT LYON') return 'ABBOTT LYON';
  if (up === 'RADLEY') return 'RADLEY';
  if (up === 'BRIGHTON') return 'BRIGHTON';
  if (up === 'HARRODS') return 'HARRODS';
  if (up === 'NOOE') return 'NOOE';
  if (up === 'POMPOM') return 'POMPOM';
  return str.toUpperCase();
}

window.setBrandFilter = function(brand) {
  const b = brand || 'ALL';
  currentBrandFilter = (currentBrandFilter.toUpperCase() === b.toUpperCase() && b !== 'ALL') ? 'ALL' : b;
  updateBrandFilterPillsUI();
  renderBrandRepairChart();
};

window.setBrandCategoryFilter = function(category) {
  const cat = category || 'ALL';
  currentBrandCategoryFilter = (currentBrandCategoryFilter.toLowerCase() === cat.toLowerCase() && cat !== 'ALL') ? 'ALL' : cat;
  updateBrandCategoryPillsUI();
  renderBrandRepairChart();
};

function setupBrandControls() {
  if (brandControlsInitialized) return;
  brandControlsInitialized = true;

  const inputFrom = document.getElementById('brandDateFrom');
  const inputTo = document.getElementById('brandDateTo');
  const resetBtn = document.getElementById('brandDateResetBtn');
  const presetsBar = document.getElementById('brandDatePresetsBar');
  const catPillsWrap = document.getElementById('brandCategoryFilterPills');

  if (inputFrom && inputTo) {
    inputFrom.value = selectedBrandDateFrom;
    inputTo.value = selectedBrandDateTo;

    inputFrom.addEventListener('change', () => {
      selectedBrandDateFrom = inputFrom.value;
      selectedBrandDatePreset = 'CUSTOM';
      updateBrandPresetButtonsUI();
      renderBrandRepairChart();
    });

    inputTo.addEventListener('change', () => {
      selectedBrandDateTo = inputTo.value;
      selectedBrandDatePreset = 'CUSTOM';
      updateBrandPresetButtonsUI();
      renderBrandRepairChart();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const { minDate, maxDate } = getEolDatasetMinMaxDates();
      selectedBrandDateFrom = minDate;
      selectedBrandDateTo = maxDate;
      selectedBrandDatePreset = 'ALL';
      currentBrandFilter = 'ALL';
      currentBrandCategoryFilter = 'ALL';
      if (inputFrom) inputFrom.value = selectedBrandDateFrom;
      if (inputTo) inputTo.value = selectedBrandDateTo;
      updateBrandPresetButtonsUI();
      updateBrandCategoryPillsUI();
      updateBrandFilterPillsUI();
      renderBrandRepairChart();
    });
  }

  if (presetsBar) {
    presetsBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.brand-preset-chip');
      if (!btn) return;
      const preset = btn.dataset.preset;
      selectedBrandDatePreset = preset;

      if (preset === 'ALL') {
        const { minDate, maxDate } = getEolDatasetMinMaxDates();
        selectedBrandDateFrom = minDate;
        selectedBrandDateTo = maxDate;
      } else if (preset === 'NOV') {
        selectedBrandDateFrom = '2026-11-01';
        selectedBrandDateTo = '2026-11-03';
      } else if (preset === 'OCT') {
        selectedBrandDateFrom = '2026-10-01';
        selectedBrandDateTo = '2026-10-31';
      } else if (preset === 'SEP') {
        selectedBrandDateFrom = '2026-09-01';
        selectedBrandDateTo = '2026-09-30';
      } else if (preset === 'AUG') {
        selectedBrandDateFrom = '2026-08-09';
        selectedBrandDateTo = '2026-08-31';
      } else if (preset === 'L30D') {
        selectedBrandDateFrom = '2026-10-04';
        selectedBrandDateTo = '2026-11-03';
      }

      if (inputFrom) inputFrom.value = selectedBrandDateFrom;
      if (inputTo) inputTo.value = selectedBrandDateTo;
      updateBrandPresetButtonsUI();
      renderBrandRepairChart();
    });
  }

  // Category Focus Filter
  if (catPillsWrap && !catPillsWrap._hasBrandCatListener) {
    catPillsWrap.addEventListener('click', (e) => {
      const pill = e.target.closest('.brand-cat-pill');
      if (!pill) return;
      const cat = pill.dataset.category || 'ALL';
      window.setBrandCategoryFilter(cat);
    });
    catPillsWrap._hasBrandCatListener = true;
  }

  // Brand Selector Chips
  const brandPillsWrap = document.getElementById('brandFilterPills');
  if (brandPillsWrap && !brandPillsWrap._hasBrandFilterListener) {
    brandPillsWrap.addEventListener('click', (e) => {
      const pill = e.target.closest('.brand-pill');
      if (!pill) return;
      const b = pill.dataset.brand || 'ALL';
      window.setBrandFilter(b);
    });
    brandPillsWrap._hasBrandFilterListener = true;
  }
}

function updateBrandPresetButtonsUI() {
  const presetsBar = document.getElementById('brandDatePresetsBar');
  if (!presetsBar) return;
  presetsBar.querySelectorAll('.brand-preset-chip').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === selectedBrandDatePreset);
  });
}

function updateBrandCategoryPillsUI() {
  const catPillsWrap = document.getElementById('brandCategoryFilterPills');
  if (!catPillsWrap) return;
  catPillsWrap.querySelectorAll('.brand-cat-pill').forEach(pill => {
    const c = pill.dataset.category || 'ALL';
    pill.classList.toggle('active', currentBrandCategoryFilter.toLowerCase() === c.toLowerCase());
  });
}

function updateBrandFilterPillsUI() {
  const brandPillsWrap = document.getElementById('brandFilterPills');
  if (!brandPillsWrap) return;
  brandPillsWrap.querySelectorAll('.brand-pill').forEach(pill => {
    const b = pill.dataset.brand || 'ALL';
    pill.classList.toggle('active', currentBrandFilter.toUpperCase() === b.toUpperCase());
  });
}

function renderBrandRepairChart() {
  const chartWrap = document.getElementById('brandChartWrap');
  const badgeEl = document.getElementById('brandHeaderBadge');
  const spanTextEl = document.getElementById('brandSpanRangeText');
  const spanBatchesEl = document.getElementById('brandSpanBatches');
  const spanCheckedEl = document.getElementById('brandSpanChecked');
  const spanRepairEl = document.getElementById('brandSpanRepair');
  const brandPillsWrap = document.getElementById('brandFilterPills');
  const barLegendLabel = document.getElementById('brandBarLegendLabel');
  const catLegendStrip = document.getElementById('brandCatLegendStrip');
  if (!chartWrap) return;

  const allRecords = (eolQcCache || []).filter(r => !String(r.batchId || '').toUpperCase().includes('TT-0025'));

  // Filter by Date Range
  const dateFiltered = allRecords.filter(r => {
    const d = parseGvizDate(r.checkDate);
    if (!d) return false;
    if (selectedBrandDateFrom && d < selectedBrandDateFrom) return false;
    if (selectedBrandDateTo && d > selectedBrandDateTo) return false;
    return true;
  });

  // Filter audited batches
  const auditedFiltered = dateFiltered.filter(r =>
    !String(r.batchId || '').toUpperCase().includes('TT-0025') &&
    r.isAudited !== false && (Number(r.checkedQty) > 0 || Number(r.repairQty) > 0 || Number(r.whQty) > 0 || (r.reason && r.reason !== ''))
  );

  // Group by Brand
  const brandMap = {};
  auditedFiltered.forEach(r => {
    if (String(r.batchId || '').toUpperCase().includes('TT-0025')) return;
    const brand = normalizeBrandName(r.brand);
    if (!brand || brand.toUpperCase() === 'UNKNOWN') return;
    if (!brandMap[brand]) {
      brandMap[brand] = {
        brand: brand,
        checked: 0,
        repair: 0,
        wh: 0,
        batches: 0,
        cats: {
          'Stitching': 0,
          'Edge-Paint': 0,
          'Workmanship': 0,
          'Finishing': 0,
          'Hardware': 0,
          'Assembly': 0,
          'Material': 0
        }
      };
    }

    const chk = Number(r.checkedQty) || 0;
    const rep = Number(r.repairQty) || 0;
    const wh = Number(r.whQty) || 0;

    brandMap[brand].checked += chk;
    brandMap[brand].repair += rep;
    brandMap[brand].wh += wh;
    brandMap[brand].batches += 1;

    if (rep > 0) {
      const cat = classifyRecordToStandardCategory(r.reason, rep, r.repairCategory);
      if (brandMap[brand].cats[cat] !== undefined) {
        brandMap[brand].cats[cat] += rep;
      } else {
        brandMap[brand].cats['Workmanship'] += rep;
      }
    }
  });

  const allBrandNames = Object.keys(brandMap)
    .filter(b => b.toUpperCase() !== 'UNKNOWN' && (brandMap[b].checked > 0 || brandMap[b].repair > 0))
    .sort((a, b) => brandMap[b].checked - brandMap[a].checked);

  // Filter by selected brand if specified
  const isAllBrands = currentBrandFilter === 'ALL' || currentBrandFilter.toUpperCase() === 'UNKNOWN';
  if (currentBrandFilter.toUpperCase() === 'UNKNOWN') currentBrandFilter = 'ALL';
  const targetBrands = isAllBrands
    ? allBrandNames
    : allBrandNames.filter(b => b.toUpperCase() === currentBrandFilter.toUpperCase());

  // Dynamically compute display records and span metrics based on selected brand
  const displayRecords = isAllBrands
    ? auditedFiltered.filter(r => {
        const b = normalizeBrandName(r.brand);
        return b && b.toUpperCase() !== 'UNKNOWN';
      })
    : auditedFiltered.filter(r => normalizeBrandName(r.brand).toUpperCase() === currentBrandFilter.toUpperCase());

  // Update Span Summary
  if (spanTextEl) {
    const rangeStr = (selectedBrandDateFrom && selectedBrandDateTo)
      ? `${selectedBrandDateFrom} to ${selectedBrandDateTo}`
      : 'All Dates';
    spanTextEl.textContent = isAllBrands ? rangeStr : `${rangeStr} • ${currentBrandFilter}`;
  }

  const spanBatches = displayRecords.length;
  const spanChecked = displayRecords.reduce((sum, r) => sum + (Number(r.checkedQty) || 0), 0);
  const spanRepair = displayRecords.reduce((sum, r) => sum + (Number(r.repairQty) || 0), 0);
  const spanRate = spanChecked > 0 ? ((spanRepair / spanChecked) * 100).toFixed(1) : '0.0';

  if (spanBatchesEl) spanBatchesEl.textContent = `${spanBatches} batches`;
  if (spanCheckedEl) spanCheckedEl.textContent = spanChecked.toLocaleString();
  if (spanRepairEl) spanRepairEl.textContent = `${spanRepair.toLocaleString()} (${spanRate}%)`;

  // Update Brand Selector Pills
  if (brandPillsWrap && allBrandNames.length > 0) {
    const pillsHtml = [
      `<button type="button" class="brand-pill ${isAllBrands ? 'active' : ''}" data-brand="ALL" onclick="window.setBrandFilter('ALL')">All Brands (${allBrandNames.length})</button>`
    ];
    allBrandNames.forEach(b => {
      const isAct = currentBrandFilter.toUpperCase() === b.toUpperCase();
      pillsHtml.push(`<button type="button" class="brand-pill ${isAct ? 'active' : ''}" data-brand="${b}" onclick="window.setBrandFilter('${b}')">${b}</button>`);
    });
    brandPillsWrap.innerHTML = pillsHtml.join('');

    // Directly bind event listeners to each pill element to ensure 100% responsiveness on mobile touches
    brandPillsWrap.querySelectorAll('.brand-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const b = btn.getAttribute('data-brand') || 'ALL';
        window.setBrandFilter(b);
      });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        const b = btn.getAttribute('data-brand') || 'ALL';
        window.setBrandFilter(b);
      });
    });
  }

  // Update Category Selector Pills attributes & listeners
  const catPillsWrap = document.getElementById('brandCategoryFilterPills');
  if (catPillsWrap) {
    catPillsWrap.querySelectorAll('.brand-cat-pill').forEach(btn => {
      const cat = btn.getAttribute('data-category') || 'ALL';
      btn.setAttribute('onclick', `window.setBrandCategoryFilter('${cat}')`);
      btn.classList.toggle('active', currentBrandCategoryFilter.toLowerCase() === cat.toLowerCase());
      if (!btn._hasBrandCatDirectListener) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          window.setBrandCategoryFilter(cat);
        });
        btn.addEventListener('touchend', (e) => {
          e.preventDefault();
          window.setBrandCategoryFilter(cat);
        });
        btn._hasBrandCatDirectListener = true;
      }
    });
  }

  if (badgeEl) badgeEl.textContent = `${targetBrands.length} Active Brands`;

  if (targetBrands.length === 0) {
    chartWrap.innerHTML = '<div class="empty-state">No brand audit records available for selected date range</div>';
    return;
  }

  // Update legend labels
  const isAllCats = currentBrandCategoryFilter === 'ALL';
  const activeCatObj = STANDARD_CATEGORIES.find(c => c.name.toLowerCase() === currentBrandCategoryFilter.toLowerCase());

  if (barLegendLabel) {
    barLegendLabel.textContent = 'Column: Brand Repair % (Overall Column)';
  }

  if (catLegendStrip) {
    if (isAllCats) {
      catLegendStrip.innerHTML = STANDARD_CATEGORIES.map(c => `
        <span class="bcl-cat-dot"><i style="background:${c.color};"></i> ${c.name}</span>
      `).join('');
    } else if (activeCatObj) {
      catLegendStrip.innerHTML = `
        <span class="bcl-cat-dot active" style="font-weight:700; color:${activeCatObj.color};">
          <i style="background:${activeCatObj.color}; width:9px; height:9px;"></i>
          ${activeCatObj.name} Defect Line (Active Focus)
        </span>
      `;
    }
  }

  // Plot Data
  const plotData = targetBrands.map(b => {
    const d = brandMap[b];
    const repPct = d.checked > 0 ? +((d.repair / d.checked) * 100).toFixed(1) : 0.0;
    return {
      brand: b,
      checked: d.checked,
      repair: d.repair,
      wh: d.wh,
      rate: repPct,
      batches: d.batches,
      cats: d.cats
    };
  });

  const maxRate = Math.max(...plotData.map(d => d.rate), 5);
  const niceRateMax = Math.ceil(maxRate * 1.15 / 5) * 5 || 20;

  const count = plotData.length;
  // Dynamic responsive SVG layout
  // When count <= 6 (standard mobile view), fix viewBox width to 380 so everything fits 100% on any mobile screen without horizontal scrolling
  // When count > 6, compute needed width so user can scroll smoothly without cramming
  const padLeft = 36;
  const padRightOffset = 28;
  const svgW = count <= 6 ? 380 : Math.max(380, padLeft + (count * 56) + padRightOffset);
  const padRight = svgW - padRightOffset;
  const svgH = 245;
  const topY = 36;
  const baseY = 185;
  const plotH = baseY - topY;
  const stepX = (padRight - padLeft) / (count || 1);

  // Compute points
  const points = plotData.map((d, i) => {
    const cx = count === 1 ? (padLeft + padRight) / 2 : padLeft + (stepX * i) + (stepX / 2);
    const barH = Math.max(8, (d.rate / niceRateMax) * plotH);
    const barY = baseY - barH;
    return {
      ...d,
      cx: cx,
      barY: barY,
      barH: barH
    };
  });

  // Grid Lines
  let gridLinesSvg = '';
  const gridSteps = 4;
  for (let s = 0; s <= gridSteps; s++) {
    const gy = topY + (plotH / gridSteps) * s;
    const rateVal = Math.round(niceRateMax - (niceRateMax / gridSteps) * s);
    gridLinesSvg += `
      <line x1="${padLeft - 4}" y1="${gy.toFixed(1)}" x2="${padRight + 4}" y2="${gy.toFixed(1)}" stroke="rgba(13, 92, 58, 0.08)" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${padLeft - 7}" y="${(gy + 3.5).toFixed(1)}" font-size="8" font-weight="700" fill="#94a3b8" text-anchor="end">${rateVal}%</text>
      <text x="${padRight + 7}" y="${(gy + 3.5).toFixed(1)}" font-size="8" font-weight="700" fill="#94a3b8" text-anchor="start">${rateVal}%</text>
    `;
  }

  // Gradients & Filters
  const gradDefs = `
    <defs>
      <linearGradient id="brandColumnStatueGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#0284c7" />
      </linearGradient>
      <linearGradient id="brandColumnActiveGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#059669" />
        <stop offset="100%" stop-color="#047857" />
      </linearGradient>
      <filter id="brandColumnShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="rgba(2, 132, 199, 0.28)" />
      </filter>
    </defs>
  `;

  // Baseline
  const baselineSvg = `
    <line x1="${padLeft - 4}" y1="${baseY}" x2="${padRight + 4}" y2="${baseY}" stroke="rgba(13, 92, 58, 0.2)" stroke-width="1.2" />
  `;

  // Column Statues
  const barW = Math.min(30, Math.max(20, stepX * 0.44));
  const barsSvg = points.map(p => {
    const bx = p.cx - (barW / 2);
    const isFilteredBrand = currentBrandFilter.toUpperCase() === p.brand.toUpperCase();
    const colFill = isFilteredBrand ? 'url(#brandColumnActiveGrad)' : 'url(#brandColumnStatueGrad)';

    const chkDisplay = p.checked >= 1000 ? `${(p.checked / 1000).toFixed(1)}k` : p.checked;

    // Smart multi-line formatting for brand labels (e.g. ABBOTT LYON)
    const words = p.brand.trim().split(/\s+/);
    let brandLabelSvg = '';
    if (words.length > 1) {
      brandLabelSvg = `
        <text x="${p.cx.toFixed(1)}" y="${(baseY + 13).toFixed(1)}" font-size="8" font-weight="800" fill="#1e293b" text-anchor="middle">
          <tspan x="${p.cx.toFixed(1)}" dy="0">${words[0]}</tspan>
          <tspan x="${p.cx.toFixed(1)}" dy="9">${words.slice(1).join(' ')}</tspan>
        </text>
        <text x="${p.cx.toFixed(1)}" y="${(baseY + 32).toFixed(1)}" font-size="7.5" font-weight="600" fill="#64748b" text-anchor="middle">
          ${chkDisplay} chk
        </text>
      `;
    } else {
      brandLabelSvg = `
        <text x="${p.cx.toFixed(1)}" y="${(baseY + 16).toFixed(1)}" font-size="8" font-weight="800" fill="#1e293b" text-anchor="middle">
          ${p.brand}
        </text>
        <text x="${p.cx.toFixed(1)}" y="${(baseY + 30).toFixed(1)}" font-size="7.5" font-weight="600" fill="#64748b" text-anchor="middle">
          ${chkDisplay} chk
        </text>
      `;
    }

    return `
      <g class="brand-col-bar ${isFilteredBrand ? 'active-brand' : ''}" data-brand="${p.brand}" style="cursor: pointer;">
        <!-- Column Pillar -->
        <rect x="${bx.toFixed(1)}" y="${p.barY.toFixed(1)}" width="${barW.toFixed(1)}" height="${p.barH.toFixed(1)}" rx="5" fill="${colFill}" filter="url(#brandColumnShadow)" opacity="0.92">
          <title>Brand: ${p.brand}\nOverall Repair: ${p.rate}%\nRepair Pieces: ${p.repair.toLocaleString()} pcs\nChecked: ${p.checked.toLocaleString()} pcs\nBatches: ${p.batches}</title>
        </rect>

        <!-- Repair Volume (pcs) -->
        <text x="${p.cx.toFixed(1)}" y="${(p.barY - 17).toFixed(1)}" font-size="9" font-weight="800" fill="#0f172a" text-anchor="middle">
          ${p.repair.toLocaleString()}
        </text>

        <!-- % Badge Pill -->
        <rect x="${(p.cx - 17).toFixed(1)}" y="${(p.barY - 13.5).toFixed(1)}" width="34" height="13" rx="3.5" fill="#0f172a" />
        <text x="${p.cx.toFixed(1)}" y="${(p.barY - 4).toFixed(1)}" font-size="7.5" font-weight="800" fill="#ffffff" text-anchor="middle">
          ${p.rate}%
        </text>

        <!-- X-Axis Labels: Brand Name & Checked Volume -->
        ${brandLabelSvg}
      </g>
    `;
  }).join('');

  // Category Lines & Nodes
  let categoryLinesSvg = '';
  let categoryNodesSvg = '';

  STANDARD_CATEGORIES.forEach(cat => {
    const isCatActive = currentBrandCategoryFilter === 'ALL' || currentBrandCategoryFilter.toLowerCase() === cat.name.toLowerCase();
    const isSingleFocus = !isAllCats && currentBrandCategoryFilter.toLowerCase() === cat.name.toLowerCase();

    const strokeWidth = isSingleFocus ? 3.5 : (isAllCats ? 2.2 : 1.0);
    const lineOpacity = isSingleFocus ? 1.0 : (isAllCats ? 0.90 : 0.18);
    const nodeOpacity = isSingleFocus ? 1.0 : (isAllCats ? 1.0 : 0.18);

    const catPoints = points.map(p => {
      const pcs = p.cats[cat.name] || 0;
      const rate = p.checked > 0 ? (pcs / p.checked) * 100 : 0;
      const cy = baseY - ((rate / niceRateMax) * plotH);
      return {
        cx: p.cx,
        cy: cy,
        rate: rate,
        pcs: pcs,
        brand: p.brand
      };
    });

    let pathD = '';
    if (catPoints.length === 1) {
      const p = catPoints[0];
      pathD = `M ${(p.cx - 30).toFixed(1)} ${p.cy.toFixed(1)} L ${(p.cx + 30).toFixed(1)} ${p.cy.toFixed(1)}`;
    } else {
      pathD = `M ${catPoints[0].cx.toFixed(1)} ${catPoints[0].cy.toFixed(1)}`;
      for (let i = 0; i < catPoints.length - 1; i++) {
        const p0 = catPoints[i];
        const p1 = catPoints[i + 1];
        const dx = (p1.cx - p0.cx) / 2;
        pathD += ` C ${(p0.cx + dx).toFixed(1)} ${p0.cy.toFixed(1)}, ${(p1.cx - dx).toFixed(1)} ${p1.cy.toFixed(1)}, ${p1.cx.toFixed(1)} ${p1.cy.toFixed(1)}`;
      }
    }

    categoryLinesSvg += `
      <path d="${pathD}" fill="none" stroke="${cat.color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${lineOpacity}">
        <title>${cat.name} Defect Line</title>
      </path>
    `;

    catPoints.forEach(cp => {
      categoryNodesSvg += `
        <circle cx="${cp.cx.toFixed(1)}" cy="${cp.cy.toFixed(1)}" r="${isSingleFocus ? 4.5 : 3.5}" fill="#ffffff" stroke="${cat.color}" stroke-width="${isSingleFocus ? 2.8 : 2.0}" opacity="${nodeOpacity}">
          <title>${cp.brand} • ${cat.name}: ${cp.pcs.toLocaleString()} pcs (${cp.rate.toFixed(1)}%)</title>
        </circle>
      `;
    });
  });

  const svgStyle = count <= 6
    ? 'width: 100%; max-width: 100%; height: auto; display: block;'
    : `min-width: ${svgW}px; width: 100%; height: auto; display: block;`;

  const fullSvg = `
    <svg viewBox="0 0 ${svgW} ${svgH}" class="brand-chart-svg" style="${svgStyle}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      ${gradDefs}
      ${gridLinesSvg}
      ${baselineSvg}
      ${barsSvg}
      ${categoryLinesSvg}
      ${categoryNodesSvg}
    </svg>
  `;

  chartWrap.innerHTML = fullSvg;

  // Click on Brand columns in SVG to toggle filter
  chartWrap.querySelectorAll('.brand-col-bar').forEach(col => {
    col.addEventListener('click', () => {
      const b = col.getAttribute('data-brand');
      currentBrandFilter = (currentBrandFilter.toUpperCase() === b.toUpperCase()) ? 'ALL' : b;
      updateBrandFilterPillsUI();
      renderBrandRepairChart();
    });
  });
}

// -------------------------------------------------------------
// UNIT QUALITY PERFORMANCE MATRIX RENDERER
// -------------------------------------------------------------
function renderUnitPerformanceMatrix(filteredRecords) {
  const container = document.getElementById('unitAnalysisList');
  const unitBadge = document.getElementById('analysisUnitCount');
  if (!container) return;

  const unitMap = {};
  filteredRecords.forEach(r => {
    const uKey = (r.unit || 'Other').trim().toUpperCase().replace(/^UNIT\s*/i, '');
    if (!unitMap[uKey]) {
      unitMap[uKey] = {
        unit: uKey,
        checked: 0,
        wh: 0,
        repair: 0,
        batches: 0,
        defects: {}
      };
    }
    unitMap[uKey].checked += (Number(r.checkedQty) || 0);
    unitMap[uKey].wh += (Number(r.whQty) || 0);
    unitMap[uKey].repair += (Number(r.repairQty) || 0);
    unitMap[uKey].batches += 1;

    if (r.repairQty > 0 && r.reason) {
      const tax = categorizeReason(r.reason);
      if (tax.key !== 'clean') {
        const dKey = tax.label || tax.name || cleanReasonTitle(r.reason);
        unitMap[uKey].defects[dKey] = (unitMap[uKey].defects[dKey] || 0) + Number(r.repairQty);
      }
    }
  });

  const unitKeys = Object.keys(unitMap).sort();
  if (unitBadge) {
    unitBadge.textContent = `${unitKeys.length} Active Units`;
  }

  if (unitKeys.length === 0) {
    container.innerHTML = `<div class="empty-state">No unit records found for selected filter.</div>`;
    return;
  }

  container.innerHTML = unitKeys.map(u => {
    const data = unitMap[u];
    const uPassRate = data.checked > 0 ? ((data.wh / data.checked) * 100).toFixed(1) : '100.0';
    const numPass = parseFloat(uPassRate);

    let statusPill = '<span class="uqc-status-pill good">Flawless</span>';
    let barColor = '#0b5c39';
    if (numPass < 94.0) {
      statusPill = '<span class="uqc-status-pill alert">Needs Attention</span>';
      barColor = '#dc2626';
    } else if (numPass < 97.0) {
      statusPill = '<span class="uqc-status-pill mid">Standard</span>';
      barColor = '#f59e0b';
    }

    // Determine Top Defect in this unit
    const defectEntries = Object.entries(data.defects).sort((a, b) => b[1] - a[1]);
    const topDefectStr = defectEntries.length > 0
      ? `Top Defect: ${defectEntries[0][0]} (${defectEntries[0][1]} pcs)`
      : `Zero defects detected (100% Pass)`;

    return `
      <div class="unit-qc-card" data-unit="${u}">
        <div class="uqc-top">
          <div class="uqc-name-block">
            <span class="uqc-badge">Unit ${u}</span>
            ${statusPill}
          </div>
          <span class="uqc-pass-num">${uPassRate}% Pass</span>
        </div>

        <div class="uqc-bar-bg">
          <div class="uqc-bar-fill" style="width: ${Math.min(100, numPass)}%; background-color: ${barColor};"></div>
        </div>

        <div class="uqc-stats-row">
          <span>Checked: <strong>${data.checked.toLocaleString()} pcs</strong> (${data.batches} batches)</span>
          <span>Repaired: <strong style="color:#b45309;">${data.repair} pcs</strong></span>
        </div>

        <div class="uqc-top-defect">
          ${getCategorySvg('workmanship', 12)} ${topDefectStr}
        </div>
      </div>
    `;
  }).join('');

  // Click on unit card sets unit filter
  container.querySelectorAll('.unit-qc-card').forEach(card => {
    card.addEventListener('click', () => {
      const u = card.getAttribute('data-unit');
      setUnitFilter(u);
    });
  });
}

// -------------------------------------------------------------
// QC INSPECTOR AUDIT PERFORMANCE COMBO CHART RENDERER
// (Column Chart for Checked & Repair Volume + Graph Line for Repair %)
// QC Name Source: Google Sheet "END LINE QC-FMS" -> Column AD
// -------------------------------------------------------------
function resetInspectorFilter() {
  currentInspectorFilter = 'ALL';
  const resetBtn = document.getElementById('inspectorFilterResetBtn');
  if (resetBtn) resetBtn.style.display = 'none';
  renderReportsView();
}

function renderInspectorComboChart(filteredRecords) {
  const chartWrap = document.getElementById('inspectorComboChartWrap');
  const summaryList = document.getElementById('inspectorSummaryList');
  const badge = document.getElementById('analysisInspectorsBadge');
  const resetBtn = document.getElementById('inspectorFilterResetBtn');
  const legacyContainer = document.getElementById('leaderboardList');

  if (!chartWrap && !legacyContainer) return;

  if (resetBtn) {
    if (currentInspectorFilter !== 'ALL') {
      resetBtn.style.display = 'inline-flex';
      const btnSpan = resetBtn.querySelector('span');
      if (btnSpan) btnSpan.textContent = `Clear (${currentInspectorFilter})`;
    } else {
      resetBtn.style.display = 'none';
    }
    if (!resetBtn._hasListener) {
      resetBtn.addEventListener('click', resetInspectorFilter);
      resetBtn._hasListener = true;
    }
  }

  // To keep all inspectors visible in the chart even when one is selected,
  // we aggregate from filteredRecords without the inspector filter applied:
  const basePool = (Array.isArray(filteredRecords) && filteredRecords.length > 0) ? filteredRecords : (eolQcCache || []);
  const inspMap = {};

  basePool.forEach(r => {
    // Exclude any TT-0025 ghost record
    if (String(r.batchId || '').toUpperCase().includes('TT-0025')) return;

    // Only count audited records with non-empty, valid QC names from Column AD
    const isAudited = r.isAudited !== false && (Number(r.checkedQty) > 0 || Number(r.repairQty) > 0 || Number(r.whQty) > 0 || (r.reason && r.reason.length > 0));
    if (!isAudited) return;

    const rawName = (r.qcName || '').trim();
    if (!rawName || /^(unassigned|qc inspector|inspector|unknown|n\/a|null|undefined)$/i.test(rawName)) return;

    if (!inspMap[rawName]) {
      inspMap[rawName] = {
        name: rawName,
        audits: 0,
        checked: 0,
        repair: 0,
        wh: 0
      };
    }
    inspMap[rawName].audits += 1;
    inspMap[rawName].checked += (Number(r.checkedQty) || 0);
    inspMap[rawName].repair += (Number(r.repairQty) || 0);
    inspMap[rawName].wh += (Number(r.whQty) || 0);
  });

  const sorted = Object.values(inspMap).map(insp => {
    const rate = insp.checked > 0 ? +((insp.repair / insp.checked) * 100).toFixed(1) : 0.0;
    return {
      ...insp,
      repairRate: rate
    };
  }).sort((a, b) => b.checked - a.checked);



  if (sorted.length === 0) {
    const emptyHtml = `<div class="empty-state">No inspector QC records found in END LINE QC-FMS.</div>`;
    if (chartWrap) chartWrap.innerHTML = emptyHtml;
    if (summaryList) summaryList.innerHTML = '';
    return;
  }

  // Scales & responsive dimensions (100% width, no horizontal scroll trap)
  const count = sorted.length;
  const padLeft = 38;
  const padRight = 36;
  const colSpacing = count <= 5 ? Math.floor((480 - padLeft - padRight) / Math.max(1, count)) : 82;
  const svgW = count <= 5 ? 480 : Math.max(480, padLeft + (count * colSpacing) + padRight);
  const padRightEff = svgW - padRight;
  const svgH = 215;
  const topY = 28;
  const baseY = 166;
  const plotH = baseY - topY;
  const stepX = (padRightEff - padLeft) / (count || 1);

  const maxChecked = Math.max(...sorted.map(s => s.checked), 500);
  const niceCheckedMax = Math.ceil(maxChecked * 1.15 / 1000) * 1000 || 8000;

  const maxRate = Math.max(...sorted.map(s => s.repairRate), 5);
  const niceRateMax = Math.min(100, Math.max(20, Math.ceil(maxRate * 1.25 / 10) * 10));

  // Compute point coordinates
  const points = sorted.map((insp, i) => {
    const cx = count === 1 ? (padLeft + padRightEff) / 2 : padLeft + (stepX * i) + (stepX / 2);
    const checkedBarH = Math.max(6, (insp.checked / niceCheckedMax) * plotH);
    const checkedBarY = baseY - checkedBarH;
    const repairBarH = Math.max(3, (insp.repair / niceCheckedMax) * plotH);
    const repairBarY = baseY - repairBarH;
    const lineY = baseY - ((insp.repairRate / niceRateMax) * plotH);

    return {
      ...insp,
      cx,
      checkedBarH,
      checkedBarY,
      repairBarH,
      repairBarY,
      lineY
    };
  });

  // Grid lines
  let gridLinesSvg = '';
  const numSteps = 4;
  for (let s = 1; s <= numSteps; s++) {
    const ratio = s / numSteps;
    const gy = baseY - (plotH * ratio);
    const checkedVal = Math.round(niceCheckedMax * ratio);
    const rateVal = Math.round(niceRateMax * ratio);
    const checkedLabel = checkedVal >= 1000 ? (checkedVal / 1000).toFixed(checkedVal % 1000 === 0 ? 0 : 1) + 'k' : checkedVal;

    gridLinesSvg += `
      <line x1="${padLeft - 4}" y1="${gy.toFixed(1)}" x2="${padRightEff + 4}" y2="${gy.toFixed(1)}" stroke="rgba(13, 92, 58, 0.08)" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${padLeft - 7}" y="${(gy + 3.5).toFixed(1)}" font-size="8.5" font-weight="700" fill="#64748b" text-anchor="end">${checkedLabel}</text>
      <text x="${padRightEff + 7}" y="${(gy + 3.5).toFixed(1)}" font-size="8.5" font-weight="700" fill="#7c3aed" text-anchor="start">${rateVal}%</text>
    `;
  }

  // Gradients (Fast vector-only, zero filters)
  const gradDefs = `
    <defs>
      <linearGradient id="inspColCheckedGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#10b981" />
        <stop offset="100%" stop-color="#047857" />
      </linearGradient>
      <linearGradient id="inspColCheckedActive" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#34d399" />
        <stop offset="100%" stop-color="#059669" />
      </linearGradient>
      <linearGradient id="inspColRepairGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fb7185" />
        <stop offset="100%" stop-color="#e11d48" />
      </linearGradient>
      <linearGradient id="inspColRepairActive" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fda4af" />
        <stop offset="100%" stop-color="#be123c" />
      </linearGradient>
    </defs>
  `;

  // Baseline
  const baselineSvg = `
    <line x1="${padLeft - 4}" y1="${baseY}" x2="${padRightEff + 4}" y2="${baseY}" stroke="rgba(13, 92, 58, 0.22)" stroke-width="1.3" />
  `;

  // Columns & Labels
  const groupW = Math.min(46, stepX * 0.54);
  const colW = (groupW - 3) / 2;

  const columnsSvg = points.map(p => {
    const isFiltered = currentInspectorFilter.toLowerCase() === p.name.toLowerCase();
    const chkFill = isFiltered ? 'url(#inspColCheckedActive)' : 'url(#inspColCheckedGrad)';
    const repFill = isFiltered ? 'url(#inspColRepairActive)' : 'url(#inspColRepairGrad)';
    const chkX = p.cx - (groupW / 2);
    const repX = chkX + colW + 3;

    const parts = p.name.split(' ');
    const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : p.name.slice(0, 2).toUpperCase();
    const shortName = (p.name.length > 12) ? p.name.slice(0, 10) + '..' : p.name;

    const chkFormatted = p.checked >= 1000 ? (p.checked / 1000).toFixed(1) + 'k' : p.checked.toLocaleString();
    const repFormatted = p.repair >= 1000 ? (p.repair / 1000).toFixed(1) + 'k' : p.repair.toLocaleString();

    return `
      <g class="insp-col-group ${isFiltered ? 'active-inspector' : ''}" data-inspector="${p.name}">
        <title>Inspector: ${p.name}&#10;Checked: ${p.checked.toLocaleString()} pcs&#10;Repair: ${p.repair.toLocaleString()} pcs&#10;Defect Rate: ${p.repairRate}%&#10;Batch Checks: ${p.audits}</title>

        <!-- Checked Volume Column -->
        <rect x="${chkX.toFixed(1)}" y="${p.checkedBarY.toFixed(1)}" width="${colW.toFixed(1)}" height="${p.checkedBarH.toFixed(1)}" rx="3" fill="${chkFill}" opacity="0.95" />
        <text x="${(chkX + (colW / 2)).toFixed(1)}" y="${(p.checkedBarY - 4).toFixed(1)}" font-size="8" font-weight="800" fill="#047857" text-anchor="middle">
          ${chkFormatted}
        </text>

        <!-- Repair Volume Column -->
        <rect x="${repX.toFixed(1)}" y="${p.repairBarY.toFixed(1)}" width="${colW.toFixed(1)}" height="${p.repairBarH.toFixed(1)}" rx="3" fill="${repFill}" opacity="0.95" />
        <text x="${(repX + (colW / 2)).toFixed(1)}" y="${(p.repairBarY - 4).toFixed(1)}" font-size="8" font-weight="800" fill="#e11d48" text-anchor="middle">
          ${repFormatted}
        </text>

        <!-- X-Axis Labels: Avatar + Name + Batch Checks -->
        <g transform="translate(${p.cx.toFixed(1)}, ${baseY + 14})">
          <circle cx="0" cy="0" r="8.5" fill="${isFiltered ? '#047857' : '#0d5c3a'}" />
          <text x="0" y="3" font-size="7.5" font-weight="800" fill="#ffffff" text-anchor="middle">${initials}</text>
          <text x="0" y="17" font-size="8.5" font-weight="700" fill="${isFiltered ? '#047857' : '#1e293b'}" text-anchor="middle">${shortName}</text>
          <text x="0" y="27" font-size="7.5" font-weight="600" fill="#64748b" text-anchor="middle">${p.audits} batch checks</text>
        </g>
      </g>
    `;
  }).join('');

  // Graph Line (Connecting Repair %)
  let linePathD = '';
  if (points.length === 1) {
    const p = points[0];
    linePathD = `M ${p.cx - 20} ${p.lineY.toFixed(1)} L ${p.cx + 20} ${p.lineY.toFixed(1)}`;
  } else {
    linePathD = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.lineY.toFixed(1)}`).join(' ');
  }

  const lineSvg = `
    <path d="${linePathD}" fill="none" stroke="#7c3aed" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" />
  `;

  // Line Nodes & Floating Rate Badges
  const nodesSvg = points.map(p => {
    const isFiltered = currentInspectorFilter.toLowerCase() === p.name.toLowerCase();
    return `
      <g class="insp-line-node ${isFiltered ? 'active-inspector' : ''}" data-inspector="${p.name}">
        <title>${p.name}: ${p.repairRate}% Defect Rate (${p.repair.toLocaleString()} / ${p.checked.toLocaleString()} pcs)</title>
        <!-- Outer Glow Ring -->
        <circle cx="${p.cx.toFixed(1)}" cy="${p.lineY.toFixed(1)}" r="6" fill="rgba(124, 58, 237, 0.16)" />
        <!-- Node Center -->
        <circle cx="${p.cx.toFixed(1)}" cy="${p.lineY.toFixed(1)}" r="3.8" fill="#ffffff" stroke="#7c3aed" stroke-width="2.2" />
        <!-- Floating Rate Pill -->
        <g transform="translate(${p.cx.toFixed(1)}, ${(p.lineY - 12).toFixed(1)})">
          <rect x="-15" y="-7" width="30" height="13" rx="3.5" fill="${isFiltered ? '#4c1d95' : '#7c3aed'}" />
          <text x="0" y="2.5" font-size="8" font-weight="800" fill="#ffffff" text-anchor="middle">${p.repairRate}%</text>
        </g>
      </g>
    `;
  }).join('');

  // Assemble full SVG
  const svgHtml = `
    <svg class="insp-chart-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="QC Inspector Checked vs Repair Volume and Defect Rate">
      ${gradDefs}
      ${gridLinesSvg}
      ${baselineSvg}
      ${columnsSvg}
      ${lineSvg}
      ${nodesSvg}
    </svg>
  `;

  if (chartWrap) {
    chartWrap.innerHTML = svgHtml;

    // Fast event delegation (bound only once)
    if (!chartWrap._hasInspListener) {
      chartWrap.addEventListener('click', (e) => {
        const target = e.target.closest('[data-inspector]');
        if (!target) return;
        const insp = target.getAttribute('data-inspector');
        if (!insp) return;
        currentInspectorFilter = (currentInspectorFilter.toLowerCase() === insp.toLowerCase()) ? 'ALL' : insp;
        renderReportsView();
      });
      chartWrap._hasInspListener = true;
    }
  }

  // Render Inspector Summary Cards below chart
  if (summaryList) {
    summaryList.innerHTML = sorted.map(insp => {
      const parts = insp.name.split(' ');
      const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : insp.name.slice(0, 2).toUpperCase();
      const isFiltered = currentInspectorFilter.toLowerCase() === insp.name.toLowerCase();

      // Color badge for rate
      let rateBadgeClass = 'rate-good';
      if (insp.repairRate > 25) rateBadgeClass = 'rate-danger';
      else if (insp.repairRate > 12) rateBadgeClass = 'rate-warn';

      return `
        <div class="insp-summary-card ${isFiltered ? 'active-inspector' : ''}" data-inspector="${insp.name}">
          <div class="isc-avatar">${initials}</div>
          <div class="isc-body">
            <div class="isc-top-row">
              <strong class="isc-name">${insp.name}</strong>
              <span class="insp-rate-badge ${rateBadgeClass}">${insp.repairRate}% Repair</span>
            </div>
            <div class="isc-metrics-row">
              <span class="isc-metric isc-checked">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Checked: <strong>${insp.checked.toLocaleString()}</strong> pcs
              </span>
              <span class="isc-metric isc-repair">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                Repair: <strong>${insp.repair.toLocaleString()}</strong> pcs
              </span>
              <span class="isc-metric isc-audits">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <strong>${insp.audits}</strong> Batch Checks
              </span>
            </div>
          </div>
          <div class="isc-arrow">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      `;
    }).join('');

    // Fast event delegation (bound only once)
    if (!summaryList._hasInspListener) {
      summaryList.addEventListener('click', (e) => {
        const target = e.target.closest('.insp-summary-card');
        if (!target) return;
        const insp = target.getAttribute('data-inspector');
        if (!insp) return;
        currentInspectorFilter = (currentInspectorFilter.toLowerCase() === insp.toLowerCase()) ? 'ALL' : insp;
        renderReportsView();
      });
      summaryList._hasInspListener = true;
    }
  }
}

// Backwards-compatible alias
function renderInspectorLeaderboard(filteredRecords) {
  renderInspectorComboChart(filteredRecords);
}

// -------------------------------------------------------------
// DETAILED INSPECTION RECORDS DIRECTORY RENDERER
// -------------------------------------------------------------
function renderInspectionList(filteredRecords) {
  const container = document.getElementById('repBatchList');
  const countBadge = document.getElementById('repBatchCount');
  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${filteredRecords.length} Batch Checks`;
  }

  if (filteredRecords.length === 0) {
    container.innerHTML = `<div class="empty-state">No inspection logs match your search & filter.</div>`;
    return;
  }

  // Display top 100 matching inspection cards for ultra-smooth scrolling
  container.innerHTML = filteredRecords.slice(0, 100).map(r => {
    const isClean = Number(r.repairQty) === 0;
    const tagHtml = isClean
      ? `<span class="iic-tag pass">${getCategorySvg('approved', 11)} 100% Passed</span>`
      : `<span class="iic-tag repair">${getCategorySvg('workmanship', 11)} ${r.repairQty} Repaired</span>`;

    let catBadgesHtml = '';
    if (!isClean) {
      const cats = getRecordCategories(r).filter(c => c !== 'Approved');
      if (cats.length > 0) {
        catBadgesHtml = `<div class="iic-cats-row" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:5px;">` +
          cats.map(c => {
            const sc = STANDARD_CATEGORIES.find(s => s.name.toLowerCase() === c.toLowerCase()) || { bgLight: '#f3f4f6', color: '#374151', border: '#d1d5db' };
            return `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; font-size:10px; font-weight:700; border-radius:999px; background:${sc.bgLight}; color:${sc.color}; border:1px solid ${sc.border};">${getCategorySvg(c, 10)} ${c}</span>`;
          }).join('') + `</div>`;
      }
    }

    const reasonHtml = !isClean && r.reason
      ? `<div class="iic-reason-box" style="margin-top:6px;">${getCategorySvg('workmanship', 12)} Defect Note (Col P): <strong>${r.reason}</strong></div>`
      : '';

    return `
      <div class="inspection-item-card">
        <div class="iic-header">
          <span class="iic-batch">${r.batchId}</span>
          <span class="iic-date">${r.checkDate || 'Recent'}</span>
        </div>

        <div class="iic-details">
          <span>Style: <strong>${r.style || 'N/A'}</strong> (${r.sku || 'SKU'})</span>
          <span>Unit: <strong>${r.unit || 'P-32'}</strong></span>
        </div>

        <div class="iic-qty-row">
          <span>Checked: <strong>${r.checkedQty}</strong></span>
          <span>•</span>
          <span>Passed: <strong style="color:#0b5c39;">${r.whQty}</strong></span>
          ${tagHtml}
        </div>

        ${reasonHtml}

        <div class="iic-inspector-row">
          <span>Fabricator: ${r.fabricator || 'Line Master'}</span>
          <span>QC: <strong>${r.qcName || r.submittedBy || 'Inspector'}</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// FILTER CONTROLLERS & DYNAMIC PILL RENDERERS
// -------------------------------------------------------------
function getAvailableMonths() {
  const monthCounts = {};
  let totalAudited = 0;

  (eolQcCache || []).forEach(item => {
    const isAudited = item.isAudited !== false && (Number(item.checkedQty) > 0 || Number(item.repairQty) > 0 || Number(item.whQty) > 0 || (item.reason && item.reason !== ''));
    if (!isAudited) return;

    totalAudited++;
    const dStr = parseGvizDate(item.checkDate);
    if (dStr && dStr.length >= 7 && dStr.includes('-')) {
      const ym = dStr.slice(0, 7);
      monthCounts[ym] = (monthCounts[ym] || 0) + 1;
    }
  });

  const sortedMonths = Object.keys(monthCounts).sort().reverse();
  return { sortedMonths, monthCounts, totalAudited };
}

function renderMonthFilterPills() {
  const container = document.getElementById('repMonthFilterPills');
  if (!container) return;

  const { sortedMonths, monthCounts, totalAudited } = getAvailableMonths();

  if (currentMonthFilter !== 'ALL' && !sortedMonths.includes(currentMonthFilter)) {
    currentMonthFilter = 'ALL';
  }

  let html = `
    <button type="button" class="rep-filter-pill ${currentMonthFilter === 'ALL' ? 'active' : ''}" data-month="ALL">
      <span>All Months</span><span class="pill-count">${totalAudited || 219}</span>
    </button>
  `;

  sortedMonths.forEach(ym => {
    const label = formatMonthLabel(ym);
    const count = monthCounts[ym] || 0;
    const isActive = currentMonthFilter === ym;
    html += `
      <button type="button" class="rep-filter-pill ${isActive ? 'active' : ''}" data-month="${ym}">
        <span>${label}</span><span class="pill-count">${count}</span>
      </button>
    `;
  });

  container.innerHTML = html;

  container.querySelectorAll('.rep-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const m = pill.getAttribute('data-month');
      setMonthFilter(m);
    });
  });
}

function setMonthFilter(month) {
  currentMonthFilter = month;
  renderReportsView();
}

function updateUnitFilterPills() {
  const container = document.getElementById('repUnitFilterPills');
  if (!container) return;

  const unitCounts = { 'ALL': 0, 'P-32': 0, 'S-18': 0, 'S-37': 0, 'S-29': 0, '14-B': 0 };

  (eolQcCache || []).forEach(item => {
    const isAudited = item.isAudited !== false && (Number(item.checkedQty) > 0 || Number(item.repairQty) > 0 || Number(item.whQty) > 0 || (item.reason && item.reason !== ''));
    if (!isAudited) return;

    if (currentMonthFilter !== 'ALL') {
      const dStr = parseGvizDate(item.checkDate);
      const ym = dStr ? dStr.slice(0, 7) : '';
      if (ym !== currentMonthFilter) return;
    }

    unitCounts['ALL']++;
    const u = (item.unit || '').trim().toUpperCase().replace(/^UNIT\s*/i, '');
    if (unitCounts[u] !== undefined) {
      unitCounts[u]++;
    }
  });

  const units = [
    { key: 'ALL', label: 'All Units' },
    { key: 'P-32', label: 'Unit P-32' },
    { key: 'S-18', label: 'Unit S-18' },
    { key: 'S-37', label: 'Unit S-37' },
    { key: 'S-29', label: 'Unit S-29' },
    { key: '14-B', label: 'Unit 14-B' }
  ];

  container.innerHTML = units.map(u => `
    <button type="button" class="rep-filter-pill ${currentReportUnitFilter === u.key ? 'active' : ''}" data-unit="${u.key}">
      <span>${u.label}</span><span class="pill-count">${unitCounts[u.key] || 0}</span>
    </button>
  `).join('');

  container.querySelectorAll('.rep-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const u = pill.getAttribute('data-unit');
      setUnitFilter(u);
    });
  });
}

function setUnitFilter(unit) {
  currentReportUnitFilter = unit;
  renderReportsView();
}

// -------------------------------------------------------------
// CUSTOM REPORT MODE DROPDOWN CONTROLLER
// -------------------------------------------------------------
function setupReportModeCustomDropdown() {
  const dropdown = document.getElementById('reportModeDropdown');
  const trigger = document.getElementById('reportModeTrigger');
  const selectedText = document.getElementById('reportModeSelectedText');
  const triggerIcon = document.getElementById('crdTriggerIcon');
  const menu = document.getElementById('reportModeMenu');
  const nativeSelect = document.getElementById('reportViewModeSelect');

  if (!dropdown || !trigger || !menu) return;

  const standardIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;
  const detailsIconSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  function updateDropdownUI(mode) {
    currentReportMode = mode;
    if (selectedText) {
      selectedText.textContent = mode === 'details' ? 'Details Report' : 'Standard Report';
    }
    if (triggerIcon) {
      triggerIcon.innerHTML = mode === 'details' ? detailsIconSvg : standardIconSvg;
      triggerIcon.style.color = mode === 'details' ? '#ea580c' : '#0b5c39';
      triggerIcon.style.background = mode === 'details' ? 'rgba(234, 88, 12, 0.12)' : 'rgba(13, 92, 58, 0.1)';
    }
    if (nativeSelect) nativeSelect.value = mode;

    menu.querySelectorAll('.crd-option').forEach(opt => {
      const isMatch = opt.getAttribute('data-value') === mode;
      opt.classList.toggle('active', isMatch);
      opt.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });
  }

  // Toggle dropdown on trigger click
  trigger.onclick = (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  // Option selection
  menu.querySelectorAll('.crd-option').forEach(opt => {
    opt.onclick = (e) => {
      e.stopPropagation();
      const val = opt.getAttribute('data-value');
      if (val) {
        updateDropdownUI(val);
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
        updateReportViewModeUI();
        renderReportsView();
      }
    };
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('open')) {
      dropdown.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  // Sync initial state
  updateDropdownUI(currentReportMode || 'standard');
}

function setupFilterEvents() {
  // 1. Initial Month & Unit Pills Setup
  renderMonthFilterPills();
  updateUnitFilterPills();

  // 2. Status Filter Tabs (All, 100% Passed, Has Defects)
  const statusTabs = document.querySelectorAll('#qcStatusFilterTabs .if-tab');
  statusTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      statusTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentStatusFilter = tab.getAttribute('data-status');
      renderReportsView();
    });
  });

  // 3. Search Input Debounce
  const searchInput = document.getElementById('repBatchSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(window._searchDebounce);
      window._searchDebounce = setTimeout(() => {
        currentSearchTerm = e.target.value;
        renderReportsView();
      }, 180);
    });
  }

  // 4. Sync Button Click (100% Local IndexedDB Instant Refresh — 0ms wait)
  const repSyncBtn = document.getElementById('repSyncBtn');
  if (repSyncBtn) {
    repSyncBtn.addEventListener('click', async () => {
      const spinIcon = repSyncBtn.querySelector('svg');
      if (spinIcon) spinIcon.classList.add('nav-bounce');

      // 1. Instantly reload and refresh from IndexedDB (no Code.gs lag!)
      await silentlyRefreshEndLineReport(true);
      await loadQcDataFromIndexedDB(true);
      await renderReportsView();
      showToast('Synchronized with Google Sheets & Database');

      if (spinIcon) {
        setTimeout(() => spinIcon.classList.remove('nav-bounce'), 350);
      }

      // 2. Non-blocking silent background check for live Google Sheet updates
      refreshFromSheetInBackground().catch(() => {});
    });
  }

  // 4b. Section Direct Sync Buttons (Google Sheets Live Refresh)
  const trendSyncBtn = document.getElementById('trendSyncBtn');
  if (trendSyncBtn) {
    trendSyncBtn.addEventListener('click', () => syncReportSectionFromGoogleSheet(trendSyncBtn, 'Month-wise Trends'));
  }

  const ucSyncBtn = document.getElementById('ucSyncBtn');
  if (ucSyncBtn) {
    ucSyncBtn.addEventListener('click', () => syncReportSectionFromGoogleSheet(ucSyncBtn, 'Unit-wise Defect Analysis'));
  }

  const brandSyncBtn = document.getElementById('brandSyncBtn');
  if (brandSyncBtn) {
    brandSyncBtn.addEventListener('click', () => syncReportSectionFromGoogleSheet(brandSyncBtn, 'Brand Wise Repair Analysis'));
  }

  const inspectorSyncBtn = document.getElementById('inspectorSyncBtn');
  if (inspectorSyncBtn) {
    inspectorSyncBtn.addEventListener('click', () => syncReportSectionFromGoogleSheet(inspectorSyncBtn, 'QC Inspector Performance'));
  }

  const profileSyncBtn = document.getElementById('profileSyncBtn');
  if (profileSyncBtn) {
    profileSyncBtn.addEventListener('click', () => syncReportSectionFromGoogleSheet(profileSyncBtn, 'QC Dashboard'));
  }

  // 5. Excel & PDF Export Buttons
  const btnExportExcel = document.getElementById('btnExportExcel');
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', exportQcReportToExcel);
  }

  const btnExportPdf = document.getElementById('btnExportPdf');
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', exportQcReportToPdf);
  }

  // 6. Custom Report View Mode Selector Dropdown
  setupReportModeCustomDropdown();
}

// -------------------------------------------------------------
// DOWNLOAD FILE HELPER
// -------------------------------------------------------------
function downloadReportFile(blob, filename) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 2000);
    showToast('Downloaded: ' + filename);
  } catch (err) {
    console.error('Download error:', err);
    showToast('Download failed: ' + err.message);
  }
}

// -------------------------------------------------------------
// EXCEL EXPORT ENGINE: 4 FORMATTED SHEETS
// -------------------------------------------------------------
let isExportingExcel = false;
async function exportQcReportToExcel() {
  if (isExportingExcel) return;
  isExportingExcel = true;
  try {
  if (typeof XLSX === 'undefined') {
    showToast('SheetJS Excel library not loaded');
    return;
  }

  showToast('Generating 5-sheet QC Excel Report from Database...');
  const records = getFilteredRecords();

  const wb = XLSX.utils.book_new();

  // Sheet 1: QC Executive Summary & KPIs
  const totalChecked = records.reduce((sum, r) => sum + (Number(r.checkedQty) || 0), 0);
  const totalRepair = records.reduce((sum, r) => sum + (Number(r.repairQty) || 0), 0);
  const totalWh = records.reduce((sum, r) => sum + (Number(r.whQty) || 0), 0);
  const passRate = totalChecked > 0 ? ((totalWh / totalChecked) * 100).toFixed(1) : '100.0';
  const defectRate = totalChecked > 0 ? ((totalRepair / totalChecked) * 100).toFixed(1) : '0.0';

  const summaryData = [
    { 'Metric': 'Report Name', 'Value': 'END LINE QC-FMS Quality Audit Report' },
    { 'Metric': 'Data Engine', 'Value': 'Local-First Database' },
    { 'Metric': 'Month Filter (Check Date)', 'Value': currentMonthFilter === 'ALL' ? 'All Months' : formatMonthLabel(currentMonthFilter) },
    { 'Metric': 'Unit Filter', 'Value': currentReportUnitFilter },
    { 'Metric': 'Total Batches Audited', 'Value': records.length },
    { 'Metric': 'Total Inspected Pieces', 'Value': totalChecked },
    { 'Metric': 'Total Approved & Sent to WH', 'Value': totalWh },
    { 'Metric': 'Total Defective / Repaired', 'Value': totalRepair },
    { 'Metric': 'Overall Pass Rate (%)', 'Value': `${passRate}%` },
    { 'Metric': 'Defect Rate (%)', 'Value': `${defectRate}%` },
    { 'Metric': 'Export Date & Time', 'Value': new Date().toLocaleString() }
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'QC Summary');

  // Sheet 2: Standard QC Categories (The 7 Core QC Categories)
  const baseRecords = getBaseFilteredRecords();
  const catSummary = STANDARD_CATEGORIES.map((sc, idx) => {
    const catName = sc.name;
    const catBatches = baseRecords.filter(r => Number(r.repairQty) > 0 && classifyRecordToStandardCategory(r.reason, r.repairQty, r.repairCategory) === catName);
    const catPcs = catBatches.reduce((sum, r) => sum + (Number(r.repairQty) || 0), 0);
    const pct = totalRepair > 0 ? ((catPcs / totalRepair) * 100).toFixed(1) + '%' : '0.0%';
    return {
      'Sl No': idx + 1,
      'Standard QC Category': catName,
      'Repaired Pieces': catPcs,
      '% Share of Defects': pct,
      'Affected Batches': catBatches.length,
      'Quality Status': catPcs >= 500 ? 'High Volume' : (catPcs >= 50 ? 'Moderate' : 'Controlled')
    };
  });
  const wsStandard = XLSX.utils.json_to_sheet(catSummary);
  XLSX.utils.book_append_sheet(wb, wsStandard, 'Standard QC Categories');

  // Sheet 3: Details Report - Granular Defect Pareto Analysis
  const defectCounts = {};
  records.forEach(r => {
    if (r.repairQty > 0) {
      const tax = categorizeReason(r.reason);
      if (tax.key !== 'clean') {
        const dKey = tax.label || tax.name || cleanReasonTitle(r.reason);
        defectCounts[dKey] = defectCounts[dKey] || { category: tax.category || 'Quality', count: 0, batches: 0 };
        defectCounts[dKey].count += Number(r.repairQty) || 1;
        defectCounts[dKey].batches += 1;
      }
    }
  });

  const paretoRows = Object.entries(defectCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([reason, data], idx) => ({
      'Rank': idx + 1,
      'Defect Reason': reason,
      'Category': data.category,
      'Repaired Pieces': data.count,
      'Affected Batches': data.batches,
      '% of Total Defects': totalRepair > 0 ? `${((data.count / totalRepair) * 100).toFixed(1)}%` : '0%'
    }));

  const wsPareto = XLSX.utils.json_to_sheet(paretoRows.length > 0 ? paretoRows : [{ 'Defect Reason': 'No defects recorded', 'Repaired Pieces': 0 }]);
  XLSX.utils.book_append_sheet(wb, wsPareto, 'Defect Pareto Analysis');

  // Sheet 3: Unit Quality Matrix
  const unitMap = {};
  records.forEach(r => {
    const uKey = (r.unit || 'Other').trim().toUpperCase().replace(/^UNIT\s*/i, '');
    if (!unitMap[uKey]) unitMap[uKey] = { unit: uKey, checked: 0, wh: 0, repair: 0, batches: 0 };
    unitMap[uKey].checked += (Number(r.checkedQty) || 0);
    unitMap[uKey].wh += (Number(r.whQty) || 0);
    unitMap[uKey].repair += (Number(r.repairQty) || 0);
    unitMap[uKey].batches += 1;
  });

  const unitRows = Object.values(unitMap).map(u => ({
    'Unit': `Unit ${u.unit}`,
    'Batches Audited': u.batches,
    'Checked Pieces': u.checked,
    'Approved (WH)': u.wh,
    'Repaired Pieces': u.repair,
    'Pass Rate (%)': u.checked > 0 ? `${((u.wh / u.checked) * 100).toFixed(1)}%` : '100%'
  }));
  const wsUnits = XLSX.utils.json_to_sheet(unitRows);
  XLSX.utils.book_append_sheet(wb, wsUnits, 'Unit Performance');

  // Sheet 4: Full Master QC Inspection Records
  const detailRows = records.map(r => ({
    'Batch ID': r.batchId || '',
    'Checking Date': r.checkDate || '',
    'Style': r.style || '',
    'SKU': r.sku || '',
    'Unit': r.unit || '',
    'Fabricator': r.fabricator || '',
    'Checked Qty': r.checkedQty || 0,
    'Passed Qty (WH)': r.whQty || 0,
    'Repair Qty': r.repairQty || 0,
    'Repair Category (Col S)': r.repairCategory || '',
    'Defect Reason / Notes (Col P)': r.reason || '',
    'Inspector': r.qcName || r.submittedBy || ''
  }));
  const wsDetails = XLSX.utils.json_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, wsDetails, 'QC Inspection Logs');

  const monthTag = currentMonthFilter === 'ALL' ? 'AllMonths' : currentMonthFilter;
  const filename = `FMS_END_LINE_QC_Report_${monthTag}_${currentReportUnitFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  if (typeof XLSX.writeFile === 'function') {
    XLSX.writeFile(wb, filename);
    showToast('Downloaded: ' + filename);
  } else {
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadReportFile(blob, filename);
  }
  } finally {
    isExportingExcel = false;
  }
}

// -------------------------------------------------------------
// PDF EXPORT ENGINE: EXECUTIVE BRANDED REPORT
// -------------------------------------------------------------
let isExportingPdf = false;
async function exportQcReportToPdf() {
  if (isExportingPdf) return;
  isExportingPdf = true;
  const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!jsPDFClass) {
    showToast('PDF library not loaded');
    return;
  }

  showToast('Generating Executive QC PDF from Database...');
  const records = getFilteredRecords();

  try {
    const doc = new jsPDFClass({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    // Top Dark Luxury Banner
    doc.setFillColor(13, 92, 58); // Forest Green
    doc.rect(0, 0, 595.28, 65, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('END LINE QC — QUALITY AUDIT REPORT', 30, 36);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Trio Trend Exports Pvt. Ltd. • Quality Assurance Division (Database Engine)', 30, 48);
    const filterInfo = `Filter: ${formatMonthLabel(currentMonthFilter)} | Unit: ${currentReportUnitFilter} • Generated: ${new Date().toLocaleString()}`;
    doc.text(filterInfo, 30, 58);

    // Section 1: Executive KPI Summary
    doc.setTextColor(30, 34, 41);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Executive Quality Summary', 30, 90);

    const totalChecked = records.reduce((sum, r) => sum + (Number(r.checkedQty) || 0), 0);
    const totalRepair = records.reduce((sum, r) => sum + (Number(r.repairQty) || 0), 0);
    const totalWh = records.reduce((sum, r) => sum + (Number(r.whQty) || 0), 0);
    const passRate = totalChecked > 0 ? ((totalWh / totalChecked) * 100).toFixed(1) : '100.0';
    const defectRate = totalChecked > 0 ? ((totalRepair / totalChecked) * 100).toFixed(1) : '0.0';

    const kpiSummaryData = [
      ['Audited Batches', String(records.length), 'Overall Pass Rate', `${passRate}%`],
      ['Total Inspected Pcs', totalChecked.toLocaleString(), 'Defect / Repair Rate', `${defectRate}%`],
      ['Passed to Warehouse', totalWh.toLocaleString(), 'Repaired Flaw Pieces', totalRepair.toLocaleString()]
    ];

    doc.autoTable({
      startY: 100,
      body: kpiSummaryData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, fontStyle: 'bold' },
      columnStyles: {
        0: { fillColor: [247, 245, 238], textColor: [13, 92, 58] },
        2: { fillColor: [247, 245, 238], textColor: [180, 83, 9] }
      },
      margin: { left: 30, right: 30 }
    });

    // Section 2: Defect Pareto Analysis (Repairing Reasons)
    let nextY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 170) + 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Top Repairing Reasons — Pareto Distribution', 30, nextY);

    const defectCounts = {};
    records.forEach(r => {
      if (r.repairQty > 0) {
        const tax = categorizeReason(r.reason);
        if (tax.key !== 'clean') {
          const dKey = tax.label || tax.name || cleanReasonTitle(r.reason);
          defectCounts[dKey] = defectCounts[dKey] || { category: tax.category || 'Quality', count: 0 };
          defectCounts[dKey].count += Number(r.repairQty) || 1;
        }
      }
    });

    const paretoTableData = Object.entries(defectCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([reason, d], idx) => [
        `#${idx + 1}`,
        reason,
        d.category,
        String(d.count),
        totalRepair > 0 ? `${((d.count / totalRepair) * 100).toFixed(1)}%` : '0%'
      ]);

    doc.autoTable({
      startY: nextY + 10,
      head: [['Rank', 'Defect Reason Description', 'Category', 'Repaired Pcs', 'Share (%)']],
      body: paretoTableData.length > 0 ? paretoTableData : [['-', 'No defects detected', '-', '0', '0%']],
      theme: 'striped',
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8.5, cellPadding: 4.5 },
      margin: { left: 30, right: 30 }
    });

    // Section 3: Recent QC Audit Sample
    nextY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : 320) + 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3. End-Line QC Audit Sample Logs', 30, nextY);

    const auditSampleData = records.slice(0, 25).map(r => [
      r.batchId,
      r.unit,
      r.style,
      `${r.checkedQty} pcs`,
      `${r.whQty} / ${r.repairQty}`,
      r.repairQty > 0 ? r.reason.slice(0, 32) : '100% Passed',
      r.qcName || r.submittedBy
    ]);

    doc.autoTable({
      startY: nextY + 10,
      head: [['Batch ID', 'Unit', 'Style', 'Checked', 'Pass / Rep', 'Reason / Flaw', 'QC Inspector']],
      body: auditSampleData,
      theme: 'striped',
      headStyles: { fillColor: [13, 92, 58], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 3.5 },
      margin: { left: 30, right: 30 }
    });

    const blob = doc.output('blob');
    const monthTag = currentMonthFilter === 'ALL' ? 'AllMonths' : currentMonthFilter;
    const filename = `FMS_END_LINE_QC_Report_${monthTag}_${currentReportUnitFilter}_${new Date().toISOString().slice(0, 10)}.pdf`;
    await downloadReportFile(blob, filename);

  } catch (err) {
    console.error('PDF Generation Error:', err);
    showToast('Failed to generate PDF: ' + err.message);
  } finally {
    isExportingPdf = false;
  }
}

// ═════════════════════════════════════════════════════════════
// FULLSCREEN & ROTATED CHART MODAL LOGIC
// ═════════════════════════════════════════════════════════════

let currentFullscreenTargetId = null;
let currentFullscreenLegendId = null;
let isFullscreenRotated = true; // Default 90deg landscape on portrait mobile

function initChartFullscreenHandlers() {
  const overlay = document.getElementById('chartFsOverlay');
  const dialog = document.getElementById('chartFsDialog');
  const backdrop = document.getElementById('chartFsBackdrop');
  const closeBtn = document.getElementById('chartFsCloseBtn');
  const rotateBtn = document.getElementById('chartFsRotateBtn');
  const bodyEl = document.getElementById('chartFsBody');
  const titleEl = document.getElementById('chartFsTitle');
  const legendBar = document.getElementById('chartFsLegendBar');

  if (!overlay || !dialog || !bodyEl) return;

  function updateDialogRotation(forceRotate) {
    if (typeof forceRotate === 'boolean') {
      isFullscreenRotated = forceRotate;
    }
    if (isFullscreenRotated) {
      dialog.classList.remove('unrotated');
      dialog.classList.add('is-rotated');
      if (rotateBtn) {
        const textSpan = rotateBtn.querySelector('.cfs-btn-text');
        if (textSpan) textSpan.textContent = 'Portrait';
      }
    } else {
      dialog.classList.remove('is-rotated');
      dialog.classList.add('unrotated');
      if (rotateBtn) {
        const textSpan = rotateBtn.querySelector('.cfs-btn-text');
        if (textSpan) textSpan.textContent = 'Rotate 90°';
      }
    }
  }

  function renderFullscreenContent(targetId, legendId) {
    const sourceChart = document.getElementById(targetId);
    if (!sourceChart || !bodyEl) return;

    bodyEl.innerHTML = '';
    const clone = sourceChart.cloneNode(true);
    clone.id = sourceChart.id + '_fullscreen';
    bodyEl.appendChild(clone);

    // If it's categoryColumnChart, attach interactive column filters
    if (targetId === 'categoryColumnChart') {
      clone.querySelectorAll('.col-chart-col').forEach(col => {
        col.addEventListener('click', () => {
          const catName = col.getAttribute('data-cat');
          currentCategoryFilter = (currentCategoryFilter === catName) ? 'ALL' : catName;
          renderReportsView();
          setTimeout(() => {
            renderFullscreenContent(targetId, legendId);
          }, 60);
        });
      });
    }

    // Populate legend if present
    if (legendBar) {
      legendBar.innerHTML = '';
      if (legendId) {
        const sourceLegend = document.getElementById(legendId);
        if (sourceLegend) {
          const legendClone = sourceLegend.cloneNode(true);
          legendClone.id = sourceLegend.id + '_fs_legend';
          legendClone.style.display = 'flex';
          legendBar.appendChild(legendClone);
          legendBar.style.display = 'flex';
        } else {
          legendBar.style.display = 'none';
        }
      } else {
        legendBar.style.display = 'none';
      }
    }
  }

  function openChartFullscreen(chartTargetId, chartTitle, legendTargetId) {
    currentFullscreenTargetId = chartTargetId;
    currentFullscreenLegendId = legendTargetId;

    if (titleEl) {
      titleEl.textContent = chartTitle || 'QC Chart View';
    }

    renderFullscreenContent(chartTargetId, legendTargetId);

    // Default to rotated 90deg if currently portrait mobile (width <= height)
    const isPortrait = window.innerWidth <= window.innerHeight;
    updateDialogRotation(isPortrait);

    // Show overlay
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Attempt orientation lock if available
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) {}
  }

  function closeChartFullscreen() {
    if (overlay) {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    if (bodyEl) bodyEl.innerHTML = '';
    if (legendBar) {
      legendBar.innerHTML = '';
      legendBar.style.display = 'none';
    }
    currentFullscreenTargetId = null;
    currentFullscreenLegendId = null;

    try {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {}
  }

  window.openChartFullscreen = openChartFullscreen;
  window.closeChartFullscreen = closeChartFullscreen;

  // Rotate button click
  if (rotateBtn && !rotateBtn._hasFsListener) {
    rotateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      updateDialogRotation(!isFullscreenRotated);
    });
    rotateBtn._hasFsListener = true;
  }

  // Close triggers
  if (closeBtn && !closeBtn._hasFsListener) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeChartFullscreen();
    });
    closeBtn._hasFsListener = true;
  }

  if (backdrop && !backdrop._hasFsListener) {
    backdrop.addEventListener('click', closeChartFullscreen);
    backdrop._hasFsListener = true;
  }

  if (!window._hasFsKeydownListener) {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closeChartFullscreen();
      }
    });
    window._hasFsKeydownListener = true;
  }

  // Attach to all .chart-expand-btn on the page
  document.querySelectorAll('.chart-expand-btn').forEach(btn => {
    if (!btn._hasFsListener) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-chart-target');
        const title = btn.getAttribute('data-chart-title');
        const legendId = btn.getAttribute('data-legend-target');
        if (targetId) {
          openChartFullscreen(targetId, title, legendId);
        }
      });
      btn._hasFsListener = true;
    }
  });

  // Physical window resize/orientation change
  if (!window._hasFsResizeListener) {
    window.addEventListener('resize', () => {
      if (overlay.classList.contains('active')) {
        if (window.innerWidth > window.innerHeight && isFullscreenRotated) {
          updateDialogRotation(false);
        }
      }
    });
    window._hasFsResizeListener = true;
  }

  // Expose global helper to refresh if open
  window.refreshChartFullscreenIfOpen = () => {
    if (overlay.classList.contains('active') && currentFullscreenTargetId) {
      renderFullscreenContent(currentFullscreenTargetId, currentFullscreenLegendId);
    }
  };
}

// -------------------------------------------------------------
// INITIAL PAGE BOOTSTRAP
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  initUserProfile();
  setupFilterEvents();
  initChartFullscreenHandlers();

  // Attach Profile and Notification Sheet Controls
  const bellBtn = document.getElementById('bellBtn');
  const notifCloseBtn = document.getElementById('notifCloseBtn');
  const notifOverlay = document.getElementById('notifOverlay');
  if (bellBtn) bellBtn.addEventListener('click', openNotifSheet);
  if (notifCloseBtn) notifCloseBtn.addEventListener('click', closeNotifSheet);
  if (notifOverlay) notifOverlay.addEventListener('click', closeNotifSheet);

  const avatarBtn = document.getElementById('avatarBtn');
  const profileCloseBtn = document.getElementById('profileCloseBtn');
  const profileOverlay = document.getElementById('profileOverlay');
  const profileLogoutBtn = document.getElementById('profileLogoutBtn');
  if (avatarBtn) avatarBtn.addEventListener('click', openProfileSheet);
  if (profileCloseBtn) profileCloseBtn.addEventListener('click', closeProfileSheet);
  if (profileOverlay) profileOverlay.addEventListener('click', closeProfileSheet);
  if (profileLogoutBtn) {
    profileLogoutBtn.addEventListener('click', () => {
      localStorage.removeItem('nimbus_logged_in');
      localStorage.removeItem('nimbus_username');
      window.location.href = 'login.html';
    });
  }

  // Load from IndexedDB and render immediately with 0-wait
  await renderReportsView();
  lastEolDataSignature = computeEolDataSignature(eolQcCache);

  // Initialize Fullscreen Rotated Chart Handlers
  initChartFullscreenHandlers();

  // Start background Google Sheets auto-refresh (45s interval)
  startEolReportAutoRefresh();
});

// -------------------------------------------------------------
// REAL-TIME INSTANT SYNCHRONIZATION WITH EOL SUBMISSIONS
// -------------------------------------------------------------
if (typeof BroadcastChannel !== 'undefined') {
  try {
    const eolBc = new BroadcastChannel('fms_eol_channel');
    eolBc.onmessage = async (evt) => {
      console.log('EOL verification submitted, instantly refreshing dashboard...', evt.data);
      await loadQcDataFromIndexedDB(true);
      await renderReportsView();
    };
  } catch (e) {
    console.warn('BroadcastChannel error:', e);
  }
}

window.addEventListener('storage', async (e) => {
  if (e.key === 'fms_eol_last_submission') {
    console.log('EOL verification detected via storage event, refreshing report...');
    await loadQcDataFromIndexedDB(true);
    await renderReportsView();
  }
});

let lastFocusRefreshTime = 0;

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    const now = Date.now();
    if (now - lastFocusRefreshTime > 60000) {
      lastFocusRefreshTime = now;
      silentlyRefreshEndLineReport(false);
    }
  }
});

window.addEventListener('focus', async () => {
  const now = Date.now();
  if (now - lastFocusRefreshTime > 60000) {
    lastFocusRefreshTime = now;
    silentlyRefreshEndLineReport(false);
  }
});
