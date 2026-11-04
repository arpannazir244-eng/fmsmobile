// ==========================================
// FMS WORKSPACE — INDEXEDDB LOCAL-FIRST ENGINE (db.js)
// High-Speed Local Caching & Offline Synchronization
// ==========================================

const FMS_DB_NAME = 'FMS_Workspace_DB';
const FMS_DB_VERSION = 3;
const FMS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbydC0_cPM6D2Nct5GztT6alfevNfHESwNuL4-L4ehs-u4tkQUpLjGCiFHFtEtXTlIjj/exec";

// Default seed users from Google Sheet to guarantee instant offline login
const DEFAULT_SEED_USERS = [
  { username: "Arpan Nazir", password: "arpan@N#260702@1105#", access: ["Warehouse","End Of Line","Reports","Edge Paint","Pre-AQL","Post AQL","Production"] },
  { username: "Aloke Saha", password: "aloke@S#260703@1121#", access: [] },
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
  { username: "Sanjoy Mondal", password: "Sanjoy@5899#", access: ["End Of Line"] }
];

class FmsDatabase {
  constructor() {
    this.db = null;
    this.isSyncing = false;
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
        // Check if users store needs bootstrap seeding
        await this.bootstrapUsersIfNeeded();
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        resolve(this.db);
      };
    });
  }

  // ---------- Bootstrap Seed Users ----------
  async bootstrapUsersIfNeeded() {
    try {
      const users = await this.getUsers();
      if (!users || users.length === 0) {
        await this.saveUsers(DEFAULT_SEED_USERS);
      }
    } catch (e) {
      console.warn('Bootstrap users warning:', e);
    }
  }

  // ---------- User Authentication & Queries ----------
  async authenticate(username, password) {
    await this.init();
    if (!username || !password) return { success: false, error: 'Empty credentials' };

    const cleanInputUser = username.trim().toLowerCase();
    const cleanInputPass = password.trim();

    // 1. Fast Query Local IndexedDB (0ms latency!)
    const user = await this.getUserByCleanName(cleanInputUser);
    if (user && user.password === cleanInputPass) {
      return { success: true, user: user, source: 'indexedDB' };
    }

    // 2. If not found locally and browser is online, fetch fresh users from Google Apps Script
    if (navigator.onLine) {
      try {
        const response = await fetch(FMS_WEB_APP_URL, { cache: 'no-store' });
        const result = await response.json();
        if (result && result.success && Array.isArray(result.users)) {
          await this.saveUsers(result.users);
          const freshUser = await this.getUserByCleanName(cleanInputUser);
          if (freshUser && freshUser.password === cleanInputPass) {
            return { success: true, user: freshUser, source: 'server' };
          }
        }
      } catch (err) {
        console.warn('Online auth fallback error:', err);
      }
    }

    return { success: false, error: 'Invalid username or password.' };
  }

  async getUserByCleanName(cleanUsername) {
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['users'], 'readonly');
      const store = tx.objectStore('users');
      const req = store.get(cleanUsername);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
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
            access: u.access || []
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
          store.put({
            batchId: b.batchId.toString().trim(),
            style: (b.style || '').toString(),
            colour: (b.colour || '').toString(),
            po: (b.po || '').toString(),
            sku: (b.sku || '').toString(),
            quantity: (b.quantity || '0').toString(),
            totalQuantity: (b.totalQuantity || b.quantity || '0').toString(),
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

    const currentQty = Number(batch.quantity) || 0;
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

  // ---------- QC Mapping Store ----------
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

  async addEndLineQcRecord(record) {
    if (!record) return;
    await this.init();
    return new Promise((resolve, reject) => {
      try {
        if (!this.db.objectStoreNames.contains('endline_qc')) return resolve();
        const tx = this.db.transaction(['endline_qc'], 'readwrite');
        const store = tx.objectStore('endline_qc');
        const req = store.add(record);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch (e) {
        resolve();
      }
    });
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
  async addSubmission(formData) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['submissions'], 'readwrite');
      const store = tx.objectStore('submissions');
      const entry = {
        formData: formData,
        status: 'pending',
        timestamp: Date.now(),
        retries: 0
      };
      const req = store.add(entry);
      req.onsuccess = () => resolve(req.result); // returns auto-increment id
      req.onerror = () => reject(req.error);
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
    await this.init();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['submissions'], 'readwrite');
      const store = tx.objectStore('submissions');
      const req = store.get(id);
      req.onsuccess = () => {
        const item = req.result;
        if (item) {
          item.status = 'synced';
          item.syncedAt = Date.now();
          store.put(item);
        }
        resolve();
      };
      req.onerror = () => resolve();
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

  // ---------- Sync Pending Submissions with Google Apps Script ----------
  async flushPendingSubmissions() {
    if (!navigator.onLine) return;
    const pending = await this.getPendingSubmissions();
    if (!pending || pending.length === 0) return;

    for (const sub of pending) {
      try {
        await fetch(FMS_WEB_APP_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(sub.formData)
        });
        await this.markSubmissionSynced(sub.id);
      } catch (err) {
        console.warn('Failed to push submission id', sub.id, err);
      }
    }
  }

  // ---------- Full Server Sync (Stale-While-Revalidate Engine) ----------
  async syncWithServer(force = false) {
    if (this.isSyncing) return null;
    this.isSyncing = true;

    try {
      // 1. Push any queued offline submissions first
      await this.flushPendingSubmissions();

      // 2. Fetch fresh data from Google Apps Script
      if (!navigator.onLine) {
        return { success: true, offline: true };
      }

      const response = await fetch(FMS_WEB_APP_URL, { cache: 'no-store' });
      const result = await response.json();

      if (result && result.success) {
        // Save in background to IndexedDB stores
        if (Array.isArray(result.production)) {
          await this.saveBatches(result.production);
        }
        if (result.qcMapping) {
          await this.saveQcMapping(result.qcMapping);
        }
        if (Array.isArray(result.users)) {
          await this.saveUsers(result.users);
        }

        // Store counts and metadata
        await this.setMeta('eolEntryCount', result.eolEntryCount || 0);
        await this.setMeta('eolEntryCountsByUser', result.eolEntryCountsByUser || {});
        await this.setMeta('eolTodayEntryCountsByUser', result.eolTodayEntryCountsByUser || {});
        await this.setMeta('eolTodayDate', new Date().toISOString().split('T')[0]);
        await this.setMeta('last_sync_time', Date.now());

        return result;
      }
    } catch (error) {
      console.warn('Background sync error:', error);
      return null;
    } finally {
      this.isSyncing = false;
    }
  }
}

// Global Singleton Instance
const FMS_DB = new FmsDatabase();
window.FMS_DB = FMS_DB;
