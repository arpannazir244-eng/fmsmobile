// ==========================================
// FMS WORKSPACE — INDEXEDDB LOCAL-FIRST ENGINE (db.js)
// Local-First Performance with Guaranteed Google Sheets Synchronization
// ==========================================

const FMS_DB_NAME = 'FMS_Workspace_DB';
const FMS_DB_VERSION = 3;
const SPREADSHEET_ID = "1uXjAFkcrWTF_sDDSXOoisl-q97n3vbHqa0JeSZ0fn2Q";
const FMS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbydC0_cPM6D2Nct5GztT6alfevNfHESwNuL4-L4ehs-u4tkQUpLjGCiFHFtEtXTlIjj/exec";

// Default seed users to guarantee instant 0ms offline login
const DEFAULT_SEED_USERS = [
  { username: "Arpan Nazir", password: "Arpan@4523", altPassword: "arpan@N#260702@1105#", access: ["Warehouse","End Of Line","Reports","Edge Paint","Pre-AQL","Post AQL","Production"] },
  { username: "Aloke Saha", password: "Aloke@5879", altPassword: "aloke@S#260703@1121#", access: [] },
  { username: "Amit Some", password: "amit@S#260703@1106#", access: [] },
  { username: "Jyoti Chhetri", password: "jyoti@C#260703@1114#", access: [] },
  { username: "Susanta Kar", password: "susanta@K260703@1124#", access: [] },
  { username: "Prasanta Mondal", password: "prasanta@M#260703@0600#", access: [] },
  { username: "Anjan Bose", password: "anjan@B#260716#", access: [] },
  { username: "Sandip Chatterjee", password: "sandip@C#260721#", access: [] },
  { username: "Arup Kumar Kirtania", password: "arup@K#260724#", access: [] },
  { username: "Arun Bairagi", password: "arun@B#2026", access: ["End Of Line"] },
  { username: "Tanmay Aguan", password: "tanmay@A#260730#", access: [] },
  { username: "Rajib Bhattacharjee", password: "rajib@B##260731#", access: [] },
  { username: "Biswajit Halder", password: "biswajit@H#260703#", access: [] },
  { username: "Shyama Bhattacharjee", password: "shyama@B#2026", access: ["Reports","End Of Line","Edge Paint","Pre-AQL","Post AQL","Production","Warehouse"] },
  { username: "Iyamat Sk", password: "Iyamat@1102#", access: ["End Of Line"] },
  { username: "Khokan Debnath", password: "Khokan@2505#", access: ["End Of Line"] },
  { username: "Sanjoy Mondal", password: "Sanjoy@5899#", access: ["End Of Line"] },
  { username: "Abhijeet Dey", password: "Abhijeet@5623", access: [] }
];

// Default Unit -> QC Inspector Mapping
const DEFAULT_QC_MAPPING = {
  "P-32": "Shyama Bhattacharjee",
  "S-18": "Arun Bairagi",
  "S-37": "Iyamat Sk",
  "S-29": "Khokan Debnath",
  "14-B": "Sanjoy Mondal"
};

class FmsDatabase {
  constructor() {
    this.db = null;
    this.isBootstrapping = false;
    this.isFlushing = false;
    this.isSyncingGoogleSheets = false;
    this.baselineBatchesMap = null;
  }

  // ---------- Load Baseline Production Quantities Map ----------
  async loadBaselineBatchesMap() {
    if (this.baselineBatchesMap && Object.keys(this.baselineBatchesMap).length > 0) {
      return this.baselineBatchesMap;
    }
    this.baselineBatchesMap = {};
    try {
      let bundled = (typeof window !== 'undefined' && Array.isArray(window.BUNDLED_ENDLINE_QC) && window.BUNDLED_ENDLINE_QC.length > 0) ? window.BUNDLED_ENDLINE_QC : null;
      if (!bundled) {
        const res = await fetch('endline_qc_data.json', { cache: 'no-store' });
        if (res.ok) bundled = await res.json();
      }
      if (Array.isArray(bundled)) {
          bundled.forEach(item => {
            if (item && item.batchId) {
              const k = String(item.batchId).trim().toUpperCase();
              this.baselineBatchesMap[k] = {
                orderQty: Number(item.orderQty) || 0,
                style: (item.style || '').toString(),
                colour: (item.colour || '').toString(),
                po: (item.po || '').toString(),
                sku: (item.sku || '').toString(),
                unit: (item.unit || '').toString(),
                fabricator: (item.fabricator || '').toString()
              };
            }
          });
        }
    } catch (e) {
      console.warn('loadBaselineBatchesMap notice:', e);
    }
    return this.baselineBatchesMap;
  }

  // ---------- Initialize Database ----------
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(FMS_DB_NAME, FMS_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Users Store
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'username_clean' });
        }

        // 2. Production Batches Store
        if (!db.objectStoreNames.contains('batches')) {
          const batchStore = db.createObjectStore('batches', { keyPath: 'batchId' });
          batchStore.createIndex('unit', 'unit', { unique: false });
          batchStore.createIndex('style', 'style', { unique: false });
        }

        // 3. Dropdown QC Mapping Store
        if (!db.objectStoreNames.contains('qc_mapping')) {
          db.createObjectStore('qc_mapping', { keyPath: 'unit' });
        }

        // 4. Offline / EOL Submissions Queue Store
        if (!db.objectStoreNames.contains('submissions')) {
          const subStore = db.createObjectStore('submissions', { keyPath: 'id', autoIncrement: true });
          subStore.createIndex('status', 'status', { unique: false });
          subStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 5. App Meta Store (last sync, total counts, user quotas)
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }

        // 6. END LINE QC-FMS Inspection Records Store
        if (!db.objectStoreNames.contains('endline_qc')) {
          const qcStore = db.createObjectStore('endline_qc', { keyPath: 'id', autoIncrement: true });
          qcStore.createIndex('batchId', 'batchId', { unique: false });
          qcStore.createIndex('unit', 'unit', { unique: false });
          qcStore.createIndex('checkDate', 'checkDate', { unique: false });
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB upgrade blocked by open connection.');
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        this.db.onversionchange = () => {
          if (this.db) {
            this.db.close();
            this.db = null;
          }
        };
        // Ensure initial authentic data is seeded if database is fresh
        await this.bootstrapDatabaseIfNeeded();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        resolve(this.db);
      };
    });
  }

  // ---------- Unified Bootstrap Engine (Zero Network / Local JSON) ----------
  async bootstrapDatabaseIfNeeded() {
    if (this.isBootstrapping) return;
    this.isBootstrapping = true;

    try {
      // 1. Seed or Update Users with latest verified credentials
      await this.saveUsers(DEFAULT_SEED_USERS);

      // 2. Seed QC Mapping
      const qcMap = await this.getQcMapping();
      if (!qcMap || Object.keys(qcMap).length === 0) {
        await this.saveQcMapping(DEFAULT_QC_MAPPING);
      }

      // 3. Seed Batches & EndLine QC Records if empty
      const existingBatches = await this.getBatches();
      const existingQc = await this.getEndLineQc();

      if (!existingBatches || existingBatches.length === 0 || !existingQc || existingQc.length === 0) {
        let bundled = (typeof window !== 'undefined' && Array.isArray(window.BUNDLED_ENDLINE_QC) && window.BUNDLED_ENDLINE_QC.length > 0) ? window.BUNDLED_ENDLINE_QC : null;
        if (!bundled) {
          try {
            const res = await fetch('endline_qc_data.json', { cache: 'no-store' });
            if (res.ok) {
              bundled = await res.json();
            }
          } catch (err) {
            console.warn('Failed to load local endline_qc_data.json:', err);
          }
        }

        if (Array.isArray(bundled) && bundled.length > 0) {
          if (!existingQc || existingQc.length === 0) {
            await this.saveEndLineQc(bundled);
          }

          if (!existingBatches || existingBatches.length === 0) {
            const batchMap = {};
            bundled.forEach(item => {
              if (item && item.batchId) {
                const bId = item.batchId.toString().trim();
                const totalQ = Number(item.orderQty) || 0;
                const pendingQ = (item.pendingWhQty !== undefined && item.pendingWhQty !== null && item.pendingWhQty !== '')
                  ? Number(item.pendingWhQty)
                  : Math.max(0, totalQ - (Number(item.whQty) || 0));

                if (!batchMap[bId]) {
                  batchMap[bId] = {
                    batchId: bId,
                    style: (item.style || '').toString(),
                    colour: (item.colour || '').toString(),
                    po: (item.po || '').toString(),
                    sku: (item.sku || '').toString(),
                    unit: (item.unit || '').toString().toUpperCase(),
                    fabricator: (item.fabricator || '').toString(),
                    quantity: String(pendingQ),
                    totalQuantity: String(totalQ),
                    etd: (item.etd || item.checkDate || 'Recent').toString(),
                    qcName: (item.qcName && item.qcName.toLowerCase() !== 'unassigned') ? item.qcName.toString() : ''
                  };
                } else {
                  const currentAvail = Number(batchMap[bId].quantity) || 0;
                  batchMap[bId].quantity = String(Math.min(currentAvail, pendingQ));
                  if (!batchMap[bId].qcName && item.qcName && item.qcName.toLowerCase() !== 'unassigned') {
                    batchMap[bId].qcName = item.qcName.toString();
                  }
                }
              }
            });
            await this.saveBatches(Object.values(batchMap));
          }

          // Compute initial counts from authentic records
          const audited = bundled.filter(r => r.isAudited !== false && (Number(r.checkedQty) > 0 || Number(r.repairQty) > 0 || Number(r.whQty) > 0 || (r.reason && r.reason !== '')));
          const userCounts = {};
          const todayCounts = {};
          const todayStr = new Date().toISOString().split('T')[0];

          audited.forEach(r => {
            const u = r.qcName || r.submittedBy;
            if (u && u !== 'Unassigned') {
              const cleanU = u.toString().trim().toUpperCase();
              userCounts[cleanU] = (userCounts[cleanU] || 0) + 1;
              if (r.checkDate && r.checkDate.startsWith(todayStr)) {
                todayCounts[cleanU] = (todayCounts[cleanU] || 0) + 1;
              }
            }
          });

          await this.setMeta('eolEntryCount', audited.length);
          await this.setMeta('eolEntryCountsByUser', userCounts);
          await this.setMeta('eolTodayEntryCountsByUser', todayCounts);
          await this.setMeta('eolTodayDate', todayStr);
          await this.setMeta('last_sync_time', Date.now());
        }
      }
    } catch (e) {
      console.warn('Bootstrap database error:', e);
    } finally {
      this.isBootstrapping = false;
    }
  }

  // ---------- User Authentication (Instant Local IndexedDB + Online Fallback) ----------
  async authenticate(username, password) {
    await this.init();
    if (!username || !password) return { success: false, error: 'Empty credentials' };

    const cleanInputPass = password.trim();

    const checkPassword = (u, pass) => {
      if (!u || !u.password) return false;
      const uPass = u.password.toString().trim();
      if (uPass === pass) return true;
      if (uPass.toLowerCase() === pass.toLowerCase()) return true;
      if (u.altPassword && (u.altPassword.toString().trim() === pass || u.altPassword.toString().trim().toLowerCase() === pass.toLowerCase())) return true;
      return false;
    };

    // 1. Try local lookup first (instant 0ms)
    let user = await this.findUser(username);
    if (user && checkPassword(user, cleanInputPass)) {
      return { success: true, user: user, source: 'indexedDB' };
    }

    // 2. If not matched locally and online, fetch fresh users live from Google Sheets
    if (navigator.onLine) {
      try {
        const liveUsers = await this.fetchLiveUsers();
        if (Array.isArray(liveUsers) && liveUsers.length > 0) {
          await this.saveUsers(liveUsers);
          user = await this.findUser(username);
          if (user && checkPassword(user, cleanInputPass)) {
            return { success: true, user: user, source: 'google-sheets-live' };
          }
        }
      } catch (err) {
        console.warn('[FMS_DB] Live auth fallback notice:', err);
      }
    }

    return { success: false, error: 'Invalid username or password.' };
  }

  async findUser(inputUsername) {
    if (!inputUsername) return null;
    await this.init();
    const clean = inputUsername.trim().toLowerCase().replace(/\s+/g, ' ');
    const allUsers = await this.getUsers();
    if (!allUsers || allUsers.length === 0) return null;

    // 1. Exact match on username_clean
    let match = allUsers.find(u => (u.username_clean || (u.username || '').toLowerCase()) === clean);
    if (match) return match;

    // 2. Ignore internal spaces (e.g. "arunbairagi", "khokandebnath")
    const noSpaces = clean.replace(/\s+/g, '');
    match = allUsers.find(u => (u.username || '').toLowerCase().replace(/\s+/g, '') === noSpaces);
    if (match) return match;

    // 3. Match by First Name (e.g. "Khokan", "Iyamat", "Shyama", "Arun", "Sanjoy", "Arpan", "Aloke")
    const firstName = clean.split(' ')[0];
    if (firstName && firstName.length >= 3) {
      match = allUsers.find(u => {
        const uFirst = (u.username || '').toLowerCase().trim().split(' ')[0];
        return uFirst === firstName;
      });
      if (match) return match;
    }

    // 4. Substring match if unambiguous
    const partials = allUsers.filter(u => (u.username || '').toLowerCase().includes(clean));
    if (partials.length === 1) return partials[0];

    return null;
  }

  async getUserByCleanName(cleanUsername) {
    return await this.findUser(cleanUsername);
  }

  async fetchLiveUsers() {
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=USERS`;
      const res = await fetch(gvizUrl, { cache: 'no-store' });
      if (res.ok) {
        const txt = await res.text();
        const start = txt.indexOf('{');
        const end = txt.lastIndexOf('}') + 1;
        if (start >= 0 && end > start) {
          const data = JSON.parse(txt.substring(start, end));
          const rows = (data.table && data.table.rows) || [];
          const users = [];
          rows.forEach(r => {
            const c = r.c || [];
            const uname = c[0] && c[0].v ? String(c[0].v).trim() : '';
            const pwd = c[1] && c[1].v ? String(c[1].v).trim() : '';
            const acc = c[2] && c[2].v ? String(c[2].v).trim() : '';
            if (uname && uname.toUpperCase() !== 'USERNAME') {
              users.push({
                username: uname,
                password: pwd,
                access: acc ? acc.split(',').map(s => s.trim()).filter(Boolean) : []
              });
            }
          });
          if (users.length > 0) return users;
        }
      }
    } catch (_) {}

    try {
      const res = await fetch(FMS_WEB_APP_URL, { cache: 'no-store' });
      if (res.ok) {
        const sData = await res.json();
        if (sData && sData.success && Array.isArray(sData.users)) {
          return sData.users;
        }
      }
    } catch (_) {}

    return DEFAULT_SEED_USERS;
  }

  async getUsers() {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['users'], 'readonly');
      const store = tx.objectStore('users');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async saveUsers(usersList) {
    if (!Array.isArray(usersList) || usersList.length === 0) return;
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['users'], 'readwrite');
      const store = tx.objectStore('users');
      usersList.forEach(u => {
        if (u && u.username) {
          const item = {
            username: u.username.trim(),
            username_clean: u.username.trim().toLowerCase(),
            password: (u.password || '').toString(),
            altPassword: (u.altPassword || '').toString(),
            access: Array.isArray(u.access) ? u.access : (typeof u.access === 'string' ? u.access.split(',').map(s => s.trim()).filter(Boolean) : [])
          };
          store.put(item);
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------- Production Batches Store ----------
  async getBatches() {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['batches'], 'readonly');
      const store = tx.objectStore('batches');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async getBatch(batchId) {
    if (!batchId) return null;
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['batches'], 'readonly');
      const store = tx.objectStore('batches');
      const req = store.get(batchId.toString().trim());
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async saveBatches(batchesList) {
    if (!Array.isArray(batchesList)) return;
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['batches'], 'readwrite');
      const store = tx.objectStore('batches');
      batchesList.forEach(b => {
        if (b && b.batchId) {
          const totalQ = (b.totalQuantity !== undefined && b.totalQuantity !== null && String(b.totalQuantity).trim() !== '' && Number(b.totalQuantity) > 0)
            ? String(b.totalQuantity)
            : (b.quantity || '0').toString();
          store.put({
            batchId: b.batchId.toString().trim(),
            style: (b.style || '').toString(),
            colour: (b.colour || '').toString(),
            po: (b.po || '').toString(),
            sku: (b.sku || '').toString(),
            quantity: (b.quantity || '0').toString(),
            totalQuantity: totalQ,
            unit: (b.unit || '').toString(),
            fabricator: (b.fabricator || '').toString(),
            etd: (b.etd || '').toString()
          });
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async updateBatchQuantity(batchId, whQty) {
    if (!batchId) return;
    const batch = await this.getBatch(batchId);
    if (!batch) return;

    const bKey = String(batch.batchId || '').trim().toUpperCase();
    let totalQty = Number(batch.totalQuantity) || 0;
    if (totalQty <= 0) {
      const baselineMap = await this.loadBaselineBatchesMap();
      if (baselineMap && baselineMap[bKey] && baselineMap[bKey].orderQty > 0) {
        totalQty = baselineMap[bKey].orderQty;
      } else {
        totalQty = Number(batch.quantity) || 0;
      }
    }
    batch.totalQuantity = String(totalQty);

    const currentQty = Number(batch.quantity) || totalQty;
    const deduct = Number(whQty) || 0;
    const newQty = String(Math.max(0, currentQty - deduct));

    batch.quantity = newQty;

    return new Promise((resolve) => {
      const tx = this.db.transaction(['batches'], 'readwrite');
      const store = tx.objectStore('batches');
      const req = store.put(batch);
      req.onsuccess = () => resolve(batch);
      req.onerror = () => resolve(null);
    });
  }

  // ---------- QC Records Store ----------
  async getEndLineQc() {
    await this.init();
    return new Promise((resolve) => {
      try {
        if (!this.db.objectStoreNames.contains('endline_qc')) return resolve([]);
        const tx = this.db.transaction(['endline_qc'], 'readonly');
        const store = tx.objectStore('endline_qc');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async saveEndLineQc(records) {
    if (!Array.isArray(records) || records.length === 0) return;
    await this.init();
    return new Promise((resolve) => {
      try {
        if (!this.db || !this.db.objectStoreNames.contains('endline_qc')) return resolve();
        const tx = this.db.transaction(['endline_qc'], 'readwrite');
        const store = tx.objectStore('endline_qc');
        store.clear();
        records.forEach(r => {
          if (r && (r.batchId || r.batch_id)) {
            store.put(r);
          }
        });
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => {
          console.warn('saveEndLineQc tx error:', e);
          resolve();
        };
      } catch (e) {
        console.warn('saveEndLineQc catch:', e);
        resolve();
      }
    });
  }

  async upsertEndLineQcRecord(record) {
    if (!record || !record.batchId) return;
    await this.init();
    const cleanBatch = String(record.batchId).trim().toUpperCase();
    return new Promise((resolve, reject) => {
      try {
        if (!this.db || !this.db.objectStoreNames.contains('endline_qc')) return resolve();
        const tx = this.db.transaction(['endline_qc'], 'readwrite');
        const store = tx.objectStore('endline_qc');
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          const existing = list.find(r => String(r.batchId || r.batch_id || '').trim().toUpperCase() === cleanBatch);
          if (existing) {
            const updated = Object.assign({}, existing, record, { id: existing.id });
            const putReq = store.put(updated);
            putReq.onsuccess = () => resolve(updated);
            putReq.onerror = () => reject(putReq.error);
          } else {
            const addReq = store.add(record);
            addReq.onsuccess = () => resolve(addReq.result);
            addReq.onerror = () => reject(addReq.error);
          }
        };
        req.onerror = () => reject(req.error);
      } catch (e) {
        resolve();
      }
    });
  }

  async addEndLineQcRecord(record) {
    return this.upsertEndLineQcRecord(record);
  }

  async getQcMapping() {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['qc_mapping'], 'readonly');
      const store = tx.objectStore('qc_mapping');
      const req = store.getAll();
      req.onsuccess = () => {
        const result = {};
        (req.result || []).forEach(item => {
          if (item && item.unit) result[item.unit] = item.qcName;
        });
        resolve(result);
      };
      req.onerror = () => resolve({});
    });
  }

  async saveQcMapping(qcMappingObj) {
    if (!qcMappingObj || typeof qcMappingObj !== 'object') return;
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['qc_mapping'], 'readwrite');
      const store = tx.objectStore('qc_mapping');
      Object.keys(qcMappingObj).forEach(unit => {
        store.put({ unit: unit.trim().toUpperCase(), qcName: (qcMappingObj[unit] || '').toString().trim() });
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------- App Metadata Store ----------
  async getMeta(key) {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['meta'], 'readonly');
      const store = tx.objectStore('meta');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    });
  }

  async setMeta(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['meta'], 'readwrite');
      const store = tx.objectStore('meta');
      const req = store.put({ key: key, value: value, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ---------- Form Submissions Queue Store ----------
  async addSubmission(formData, status = 'pending') {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['submissions'], 'readwrite');
      const store = tx.objectStore('submissions');
      const entry = {
        formData: formData,
        status: status,
        timestamp: Date.now()
      };
      const req = store.add(entry);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async updateSubmissionStatus(id, newStatus) {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['submissions'], 'readwrite');
      const store = tx.objectStore('submissions');
      const req = store.get(id);
      req.onsuccess = () => {
        const item = req.result;
        if (item) {
          item.status = newStatus;
          if (newStatus === 'completed' || newStatus === 'synced') {
            item.syncedAt = Date.now();
          }
          store.put(item);
        }
        resolve();
      };
      req.onerror = () => resolve();
    });
  }

  async getUnsyncedSubmissions() {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['submissions'], 'readonly');
      const store = tx.objectStore('submissions');
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        // Any item marked 'pending' or without a syncedAt timestamp
        const unsynced = all.filter(s => s.status === 'pending' || (!s.syncedAt && s.status !== 'synced'));
        resolve(unsynced);
      };
      req.onerror = () => resolve([]);
    });
  }

  async getPendingSubmissions() {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['submissions'], 'readonly');
      const store = tx.objectStore('submissions');
      const index = store.index('status');
      const req = index.getAll('pending');
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async markSubmissionSynced(id) {
    return this.updateSubmissionStatus(id, 'synced');
  }

  async getSubmissions() {
    await this.init();
    return new Promise((resolve) => {
      try {
        if (!this.db || !this.db.objectStoreNames.contains('submissions')) return resolve([]);
        const tx = this.db.transaction(['submissions'], 'readonly');
        const store = tx.objectStore('submissions');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async getAllSubmissions(limit = 10) {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['submissions'], 'readonly');
      const store = tx.objectStore('submissions');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(list.slice(0, limit));
      };
      req.onerror = () => resolve([]);
    });
  }

  // ---------- ATOMIC FAST EOL VERIFICATION ENTRY (Instant Local + Guaranteed Google Sheets Sync) ----------
  async recordEolVerification(formData) {
    await this.init();
    const batchId = (formData.batchId || '').toString().trim();
    if (!batchId) throw new Error('Batch ID is required');

    const whQuantity = Number(formData.whQty || 0) || 0;
    const checkedQuantity = Number(formData.checkedQty || 0) || 0;
    const repairQuantity = Number(formData.repairQty || 0) || 0;
    const username = formData.submittedBy || localStorage.getItem('nimbus_username') || '';
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Add record into endline_qc inspection logs (IndexedDB)
    const qcRecord = {
      batchId: batchId,
      style: (formData.style || '').toString(),
      colour: (formData.colour || '').toString(),
      po: (formData.po || '').toString(),
      sku: (formData.sku || '').toString(),
      floor: (formData.floor || '').toString(),
      unit: (formData.unit || '').toString(),
      fabricator: (formData.fabricator || '').toString(),
      qcName: (formData.qcName || username || 'Unassigned').toString(),
      etd: (formData.etd || '').toString(),
      checkDate: formData.checkDate || todayStr,
      checkedQty: checkedQuantity,
      repairQty: repairQuantity,
      whQty: whQuantity,
      orderQty: Number(formData.quantity || 0) || checkedQuantity,
      repairCategory: (formData.repairCategory || formData.repair_category || formData.category || formData.colS || formData.col_s || formData['Repair Category'] || '').toString(),
      reason: (formData.rawReason !== undefined && formData.rawReason !== '' ? formData.rawReason : (formData.reason || '')).toString(),
      submittedBy: username,
      timestamp: formData.timestamp || new Date().toISOString(),
      isAudited: true,
      status: 'Approved'
    };
    await this.upsertEndLineQcRecord(qcRecord);

    // 2. Deduct WH quantity from remaining batch quantity
    await this.updateBatchQuantity(batchId, whQuantity);

    // 3. Queue into submissions store with status: 'pending' to push to Google Sheets
    await this.addSubmission(formData, 'pending');

    // 4. Update Meta counts in IndexedDB
    let totalCount = Number(await this.getMeta('eolEntryCount')) || 0;
    totalCount += 1;
    await this.setMeta('eolEntryCount', totalCount);

    let userCounts = (await this.getMeta('eolEntryCountsByUser')) || {};
    let todayCounts = (await this.getMeta('eolTodayEntryCountsByUser')) || {};
    const lastDate = await this.getMeta('eolTodayDate');
    if (lastDate !== todayStr) {
      todayCounts = {};
      await this.setMeta('eolTodayDate', todayStr);
    }
    if (username) {
      const cleanUser = username.toString().trim().toUpperCase();
      userCounts[cleanUser] = (Number(userCounts[cleanUser]) || 0) + 1;
      todayCounts[cleanUser] = (Number(todayCounts[cleanUser]) || 0) + 1;
      await this.setMeta('eolEntryCountsByUser', userCounts);
      await this.setMeta('eolTodayEntryCountsByUser', todayCounts);
    }

    // Broadcast instant update to all open report/dashboard windows
    try {
      localStorage.setItem('fms_eol_last_submission', JSON.stringify({
        batchId,
        checkedQty: checkedQuantity,
        repairQty: repairQuantity,
        whQty: whQuantity,
        timestamp: Date.now()
      }));
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('fms_eol_channel');
        bc.postMessage({ type: 'EOL_SUBMITTED', batchId, timestamp: Date.now() });
        bc.close();
      }
    } catch (e) {}

    // 5. Instantly trigger background push to Google Sheets (Non-blocking, single queue)
    this.flushPendingSubmissions().catch(err => {
      console.warn('Background Google Sheets push notice:', err);
    });

    return {
      success: true,
      eolEntryCount: totalCount,
      eolEntryCountsByUser: userCounts,
      eolTodayEntryCountsByUser: todayCounts
    };
  }

  // ---------- Single Queue Processor (Guaranteed NO DUPLICATE Google Sheets Sync) ----------
  async flushPendingSubmissions() {
    if (!navigator.onLine || this.isFlushing) return;
    this.isFlushing = true;

    try {
      const unsynced = await this.getUnsyncedSubmissions();
      if (!unsynced || unsynced.length === 0) return;

      for (const sub of unsynced) {
        if (sub.status === 'in_flight' || sub.status === 'synced') continue;

        // Mark in-flight immediately BEFORE fetch so no concurrent loop can re-send it!
        await this.updateSubmissionStatus(sub.id, 'in_flight');

        try {
          await fetch(FMS_WEB_APP_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(sub.formData)
          });
          await this.markSubmissionSynced(sub.id);
          console.log('Pushed submission to Google Sheets successfully for Batch:', sub.formData ? sub.formData.batchId : sub.id);
        } catch (err) {
          console.warn('Failed to push submission to Google Sheet, will retry:', err);
          await this.updateSubmissionStatus(sub.id, 'pending');
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }

  // Purge any locally queued or added inspection records that have been deleted in Google Sheets
  async purgeDeletedRecordsFromSheet() {
    await this.init();
    if (!navigator.onLine) return;

    try {
      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=END%20OF%20LINE&tq=` + encodeURIComponent("select A label A ''");
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
      if (!match || !match[1]) return;
      const json = JSON.parse(match[1]);
      const validBatches = new Set();
      if (json.table && Array.isArray(json.table.rows)) {
        json.table.rows.forEach(r => {
          if (r.c && r.c[0] && r.c[0].v) {
            validBatches.add(String(r.c[0].v).trim().toUpperCase());
          }
        });
      }

      // Collect pending submission batch IDs to NEVER delete them!
      const pendingSubs = (await this.getSubmissions()) || [];
      const pendingBatches = new Set(
        pendingSubs.map(s => String(s.formData ? s.formData.batchId : '').trim().toUpperCase()).filter(Boolean)
      );

      // Filter endline_qc records: baseline records (id <= 648), audited records, or records present in Google Sheets
      const allQc = await this.getEndLineQc();
      if (allQc && allQc.length > 0) {
        const cleanedQc = allQc.filter(r => {
          const b = String(r.batchId || r.batch_id || '').trim().toUpperCase();
          // 1. ALWAYS preserve any batch that has a pending/in-flight submission
          if (pendingBatches.has(b)) return true;
          // 2. ALWAYS preserve audited or inspected batches
          if (r.isAudited === true || Number(r.checkedQty) > 0 || Number(r.whQty) > 0 || Number(r.repairQty) > 0) return true;
          // 3. Keep baseline records
          if (r.id !== undefined && Number(r.id) <= 648) return true;
          // 4. Otherwise keep if present in Google Sheets
          return b && validBatches.has(b);
        });

        if (cleanedQc.length !== allQc.length) {
          await this.saveEndLineQc(cleanedQc);
          console.log(`Cleaned up ${allQc.length - cleanedQc.length} deleted records from endline_qc`);
        }
      }
    } catch (e) {
      console.warn('purgeDeletedRecords error:', e);
    }
  }

  // Thoroughly purge orphan, dummy, or invalid test submissions (e.g. TT-0025/26-27)
  async purgeInvalidSubmissions() {
    try {
      await this.init();
      if (!this.db) return;

      // 1. Purge from submissions store
      if (this.db.objectStoreNames.contains('submissions')) {
        await new Promise((resolve) => {
          const tx = this.db.transaction(['submissions'], 'readwrite');
          const store = tx.objectStore('submissions');
          const req = store.getAll();
          req.onsuccess = () => {
            const subs = req.result || [];
            subs.forEach(s => {
              const b = String(s.formData ? s.formData.batchId : (s.batchId || '')).trim().toUpperCase();
              if (b.includes('TT-0025') || b === 'TT-0025/26-27' || s.status === 'synced') {
                store.delete(s.id);
                console.log('[FMS DB] Purged invalid submission:', b);
              }
            });
            resolve();
          };
          req.onerror = () => resolve();
        });
      }

      // 2. Purge from endline_qc store
      if (this.db.objectStoreNames.contains('endline_qc')) {
        await new Promise((resolve) => {
          const tx = this.db.transaction(['endline_qc'], 'readwrite');
          const store = tx.objectStore('endline_qc');
          const req = store.getAll();
          req.onsuccess = () => {
            const list = req.result || [];
            list.forEach(r => {
              const b = String(r.batchId || r.batch_id || '').trim().toUpperCase();
              if (b.includes('TT-0025') || b === 'TT-0025/26-27') {
                if (r.id !== undefined) {
                  store.delete(r.id);
                  console.log('[FMS DB] Purged TT-0025 from endline_qc store:', b);
                }
              }
            });
            resolve();
          };
          req.onerror = () => resolve();
        });
      }

      // 3. Clean from localStorage
      try {
        const lastSub = localStorage.getItem('fms_eol_last_submission');
        if (lastSub && lastSub.includes('TT-0025')) {
          localStorage.removeItem('fms_eol_last_submission');
        }
      } catch (_) {}
    } catch (e) {
      console.warn('purgeInvalidSubmissions error:', e);
    }
  }

  // Purge any submissions from local store that are already audited in Google Sheets or orphan/test submissions
  async pruneSyncedSubmissions(sheetRecords) {
    await this.purgeInvalidSubmissions();
    if (!sheetRecords || sheetRecords.length === 0) return;
    try {
      await this.init();
      if (!this.db || !this.db.objectStoreNames.contains('submissions')) return;
      const allSheetBatches = new Set(
        sheetRecords
          .map(r => String(r.batchId || '').trim().toUpperCase())
          .filter(Boolean)
      );
      const auditedBatches = new Set(
        sheetRecords
          .filter(r => r.isAudited || Number(r.checkedQty) > 0 || Number(r.repairQty) > 0)
          .map(r => String(r.batchId || '').trim().toUpperCase())
          .filter(Boolean)
      );

      return new Promise((resolve) => {
        const tx = this.db.transaction(['submissions'], 'readwrite');
        const store = tx.objectStore('submissions');
        const req = store.getAll();
        req.onsuccess = () => {
          const subs = req.result || [];
          subs.forEach(s => {
            if (s && s.formData && s.formData.batchId) {
              const b = String(s.formData.batchId).trim().toUpperCase();
              const subAge = s.timestamp ? (Date.now() - new Date(s.timestamp).getTime()) : 0;
              // Delete if audited in sheet, or marked synced, or test TT-0025, or not in sheet & > 24h old
              if (auditedBatches.has(b) || s.status === 'synced' || b.includes('TT-0025') || (!allSheetBatches.has(b) && subAge > 86400000)) {
                store.delete(s.id);
              }
            }
          });
          resolve();
        };
        req.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('pruneSyncedSubmissions notice:', e);
    }
  }

  // ---------- Fetch Fresh End-Line QC Rows from Google Sheet (Sheet: END OF LINE) ----------
  // Column S = Repair Category (sorted / standardized), Column P = Reason (details)
  async fetchLiveEndLineQcRecords(forceNocache = false) {
    if (!navigator.onLine) return null;
    try {
      const nocacheParam = forceNocache ? `&_nocache=${Date.now()}` : '';
      // END LINE QC-FMS: select B (Batch), K (Style), L (Colour), O (PO), J (SKU), M (Quantity), E (Unit), F (Fabricator), AD (QC Name), N (ETD), AE (Check Date), U (Checked Qty), W (Repair Qty), V (WH Qty), Y (Reason), D (Creator/Doer), A (Timestamp), G (Brand), X (Pending WH Qty)
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=END%20LINE%20QC-FMS${nocacheParam}&tq=` + encodeURIComponent("select B, K, L, O, J, M, E, F, AD, N, AE, U, W, V, Y, D, A, G, X where B is not null");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const res = await fetch(gvizUrl, { cache: 'no-store', signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return null;
      const text = await res.text();
      const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
      if (!match || !match[1]) return null;
      const json = JSON.parse(match[1]);
      if (!json.table || !Array.isArray(json.table.rows)) return null;

      const parseDate = (val) => {
        if (!val) return '';
        const str = String(val).trim();
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
      };

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
        const etd = c[9] ? parseDate(c[9].f || c[9].v) : '';
        const checkDate = c[10] ? parseDate(c[10].v || c[10].f) : (etd || '');
        const checkedQty = c[11] && c[11].v ? (Number(c[11].v) || 0) : 0;
        const repairQty = c[12] && c[12].v ? (Number(c[12].v) || 0) : 0;
        const whQty = c[13] && c[13].v ? (Number(c[13].v) || 0) : 0;
        const reason = c[14] && c[14].v ? String(c[14].v).trim() : '';
        const submittedBy = c[15] && c[15].v ? String(c[15].v).trim() : '';
        const timestamp = c[16] && c[16].v ? String(c[16].v).trim() : '';
        const brand = c[17] && c[17].v ? String(c[17].v).trim() : '';
        const pendingWhQty = (c[18] && c[18].v !== null && c[18].v !== undefined && c[18].v !== '')
          ? Number(c[18].v)
          : Math.max(0, orderQty - whQty);
        const repairCategory = '';

        const isAudited = (checkedQty > 0 || whQty > 0 || repairQty > 0 || (reason && reason.length > 0));
        const status = (repairQty > 0) ? 'Repair' : ((checkedQty > 0 || whQty > 0) ? 'Approved' : 'Pending');
        const qcName = (qcNameRaw && qcNameRaw.toLowerCase() !== 'unassigned') ? qcNameRaw : (submittedBy || 'Unassigned');

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
          pendingWhQty,
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
    } catch (e) {
      console.warn('fetchLiveEndLineQcRecords notice:', e.message || e);
      return null;
    }
  }

  // ---------- Fast Google Sheet & Local DB Synchronizer ----------
  async syncLiveFromGoogleSheet(isFullSync = false) {
    await this.init();
    await this.bootstrapDatabaseIfNeeded();

    if (this.isSyncingGoogleSheets) {
      return {
        success: true,
        source: 'indexedDB-busy',
        production: (await this.getBatches()) || [],
        qcMapping: (await this.getQcMapping()) || {},
        users: (await this.getUsers()) || [],
        eolEntryCount: Number(await this.getMeta('eolEntryCount')) || 0,
        eolEntryCountsByUser: (await this.getMeta('eolEntryCountsByUser')) || {},
        eolTodayEntryCountsByUser: (await this.getMeta('eolTodayEntryCountsByUser')) || {},
        eolAuditedCount: Number(await this.getMeta('eolAuditedCount')) || 219
      };
    }

    this.isSyncingGoogleSheets = true;

    try {
      // 1. Flush any pending submissions first
      if (navigator.onLine) {
        await this.flushPendingSubmissions().catch(() => {});
      }

      let gvizSucceeded = false;
      let totalCount = 0;
      let userCounts = {};
      let todayCounts = {};
      let auditedCount = 0;

      // 2. Fetch fresh live counts directly from Google Sheet via GViz (Fast ~1s!)
      if (navigator.onLine) {
        try {
          const now = new Date();
          const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          
          const gvizAllUsersUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=END%20OF%20LINE&tq=` + encodeURIComponent("select Q, count(A) where Q is not null group by Q label count(A) ''");
          const gvizTodayUsersUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=END%20OF%20LINE&tq=` + encodeURIComponent(`select Q, count(A) where Q is not null and R >= datetime '${todayDateStr} 00:00:00' group by Q label count(A) ''`);
          const gvizQcFmsUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=END%20LINE%20QC-FMS&tq=` + encodeURIComponent("select count(A) where U > 0 or V > 0 or W > 0 or Y is not null label count(A) ''");
          const gvizBatchWhUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=END%20OF%20LINE&tq=` + encodeURIComponent("select A, sum(O) where A is not null group by A label sum(O) ''");

          const fetchWithTimeout = (url, timeoutMs = 6000) => {
            return new Promise((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('GViz timeout')), timeoutMs);
              fetch(url, { cache: 'no-store' })
                .then(res => {
                  clearTimeout(timer);
                  if (res.ok) return res.text();
                  throw new Error(`HTTP ${res.status}`);
                })
                .then(resolve)
                .catch(err => {
                  clearTimeout(timer);
                  reject(err);
                });
            });
          };

          const parseGviz = (text) => {
            if (!text) return null;
            const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
            if (!match || !match[1]) return null;
            return JSON.parse(match[1]);
          };

          const [allUsersRes, todayUsersRes, qcFmsRes, batchWhRes] = await Promise.allSettled([
            fetchWithTimeout(gvizAllUsersUrl),
            fetchWithTimeout(gvizTodayUsersUrl),
            fetchWithTimeout(gvizQcFmsUrl),
            fetchWithTimeout(gvizBatchWhUrl)
          ]);

          if (allUsersRes.status === 'fulfilled' && allUsersRes.value) {
            const parsed = parseGviz(allUsersRes.value);
            if (parsed && parsed.table && Array.isArray(parsed.table.rows)) {
              parsed.table.rows.forEach(r => {
                if (r.c && r.c[0] && r.c[0].v) {
                  const u = String(r.c[0].v).trim().toUpperCase();
                  const cnt = Number(r.c[1] ? r.c[1].v : 0) || 0;
                  userCounts[u] = cnt;
                  totalCount += cnt;
                }
              });
              gvizSucceeded = true;
            }
          }

          if (todayUsersRes.status === 'fulfilled' && todayUsersRes.value) {
            const parsed = parseGviz(todayUsersRes.value);
            if (parsed && parsed.table && Array.isArray(parsed.table.rows)) {
              parsed.table.rows.forEach(r => {
                if (r.c && r.c[0] && r.c[0].v) {
                  const u = String(r.c[0].v).trim().toUpperCase();
                  const cnt = Number(r.c[1] ? r.c[1].v : 0) || 0;
                  todayCounts[u] = cnt;
                }
              });
            }
          }

          if (qcFmsRes.status === 'fulfilled' && qcFmsRes.value) {
            const parsed = parseGviz(qcFmsRes.value);
            if (parsed && parsed.table && parsed.table.rows && parsed.table.rows[0] && parsed.table.rows[0].c && parsed.table.rows[0].c[0]) {
              auditedCount = Number(parsed.table.rows[0].c[0].v) || 0;
            }
          }

          // Parse batch dispatch quantities
          var whDispatchedByBatch = {};
          var batchWhSucceeded = false;
          if (batchWhRes.status === 'fulfilled' && batchWhRes.value) {
            const parsed = parseGviz(batchWhRes.value);
            if (parsed && parsed.table && Array.isArray(parsed.table.rows)) {
              parsed.table.rows.forEach(r => {
                if (r.c && r.c[0] && r.c[0].v !== undefined && r.c[0].v !== null) {
                  const bKey = String(r.c[0].v).trim().toUpperCase();
                  const qty = Number(r.c[1] ? r.c[1].v : 0) || 0;
                  whDispatchedByBatch[bKey] = qty;
                }
              });
              batchWhSucceeded = true;
            }
          }
        } catch (err) {
          console.warn('GViz live sync warning:', err);
        }
      }

      // 3. Fallback or overwrite with Google Sheets truth
      if (!gvizSucceeded) {
        totalCount = Number(await this.getMeta('eolEntryCount')) || 0;
        userCounts = (await this.getMeta('eolEntryCountsByUser')) || {};
        todayCounts = (await this.getMeta('eolTodayEntryCountsByUser')) || {};
        auditedCount = Number(await this.getMeta('eolAuditedCount')) || 219;
      } else {
        // OVERWRITE IndexedDB with exact live Google Sheets numbers
        await this.setMeta('eolEntryCount', totalCount);
        await this.setMeta('eolEntryCountsByUser', userCounts);
        await this.setMeta('eolTodayEntryCountsByUser', todayCounts);
        if (auditedCount > 0) {
          await this.setMeta('eolAuditedCount', auditedCount);
        }
      }

      // Check and purge any records that were deleted in Google Sheet
      await this.purgeDeletedRecordsFromSheet().catch(() => {});
      if (!auditedCount || auditedCount === 0) {
        auditedCount = Number(await this.getMeta('eolAuditedCount')) || 219;
      }
      await this.setMeta('eolAuditedCount', auditedCount);

      // 4. Update Batches directly from "END LINE QC-FMS" sheet
      let batches = (await this.getBatches()) || [];
      try {
        const liveEndLine = await this.fetchLiveEndLineQcRecords(isFullSync);
        if (Array.isArray(liveEndLine) && liveEndLine.length > 0) {
          const batchMap = {};
          liveEndLine.forEach(r => {
            if (r && r.batchId) {
              const bId = r.batchId.toString().trim();
              const totalQ = Number(r.orderQty) || 0;
              const pendingQ = (r.pendingWhQty !== undefined && r.pendingWhQty !== null && r.pendingWhQty !== '')
                ? Number(r.pendingWhQty)
                : Math.max(0, totalQ - (Number(r.whQty) || 0));

              if (!batchMap[bId]) {
                batchMap[bId] = {
                  batchId: bId,
                  style: (r.style || '').toString(),
                  colour: (r.colour || '').toString(),
                  po: (r.po || '').toString(),
                  sku: (r.sku || '').toString(),
                  unit: (r.unit || '').toString().toUpperCase(),
                  fabricator: (r.fabricator || '').toString(),
                  quantity: String(pendingQ),
                  totalQuantity: String(totalQ),
                  etd: (r.etd || r.checkDate || 'Recent').toString(),
                  qcName: (r.qcName && r.qcName.toLowerCase() !== 'unassigned') ? r.qcName.toString() : ''
                };
              } else {
                const currentAvail = Number(batchMap[bId].quantity) || 0;
                batchMap[bId].quantity = String(Math.min(currentAvail, pendingQ));
                if (!batchMap[bId].qcName && r.qcName && r.qcName.toLowerCase() !== 'unassigned') {
                  batchMap[bId].qcName = r.qcName.toString();
                }
              }
            }
          });
          const endLineBatches = Object.values(batchMap);
          if (endLineBatches.length > 0) {
            await this.saveBatches(endLineBatches);
            batches = endLineBatches;
            console.log(`[FMS_DB] Synced ${batches.length} batches live from "END LINE QC-FMS" sheet`);
          }
        }
      } catch (err) {
        console.warn('Syncing batches from END LINE QC-FMS notice:', err);
      }

      // 5. Fetch users and QC unit mapping from Apps Script if needed
      let qcMapping = (await this.getQcMapping()) || {};
      let users = (await this.getUsers()) || [];

      if (navigator.onLine) {
        try {
          const liveUsers = await this.fetchLiveUsers();
          if (Array.isArray(liveUsers) && liveUsers.length > 0) {
            await this.saveUsers(liveUsers);
            users = liveUsers;
          }

          const appScriptRes = await fetch(FMS_WEB_APP_URL, { cache: 'no-store' });
          if (appScriptRes.ok) {
            const sData = await appScriptRes.json();
            if (sData && sData.success) {
              if (sData.qcMapping && Object.keys(sData.qcMapping).length > 0) {
                await this.saveQcMapping(sData.qcMapping);
                qcMapping = sData.qcMapping;
              }
              if (sData.users && sData.users.length > 0) {
                await this.saveUsers(sData.users);
                users = sData.users;
              }
              if (sData.eolEntryCountsByUser) {
                userCounts = sData.eolEntryCountsByUser;
                await this.setMeta('eolEntryCountsByUser', userCounts);
              }
              if (sData.eolTodayEntryCountsByUser) {
                todayCounts = sData.eolTodayEntryCountsByUser;
                await this.setMeta('eolTodayEntryCountsByUser', todayCounts);
              }
              if (sData.eolEntryCount !== undefined) {
                totalCount = Number(sData.eolEntryCount) || totalCount;
                await this.setMeta('eolEntryCount', totalCount);
              }
            }
          }
        } catch (err) {
          console.warn('Apps Script sync warning:', err);
        }
      }

      return {
        success: true,
        source: gvizSucceeded ? 'google-sheets-gviz' : 'indexedDB',
        production: batches,
        qcMapping: qcMapping,
        users: users,
        eolEntryCount: totalCount,
        eolEntryCountsByUser: userCounts,
        eolTodayEntryCountsByUser: todayCounts,
        eolAuditedCount: auditedCount
      };
    } finally {
      this.isSyncingGoogleSheets = false;
    }
  }

  // ---------- Full Server & Local Synchronizer ----------
  async syncWithServer(force = false) {
    return await this.syncLiveFromGoogleSheet(force);
  }
}

// Global Singleton Instance
const FMS_DB = new FmsDatabase();
window.FMS_DB = FMS_DB;
