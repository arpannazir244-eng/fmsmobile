// ==========================================
// FMS WORKSPACE — REPORTS HUB LOGIC (report.js)
// Controller for the 4-Stage QC Reports Hub
// ==========================================

let eolDataCache = null;

// ---------- Toast Notification Helper ----------
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
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
}

// ---------- Update Stage Counts on Cards ----------
function updateHubCounts() {
  if (!eolDataCache) return;
  const prodList = eolDataCache.production || [];
  const eolCount = eolDataCache.eolEntryCount || prodList.length;

  const repEolCountNum = document.getElementById('repEolCountNum');
  if (repEolCountNum) {
    repEolCountNum.textContent = eolCount > 0 ? eolCount.toLocaleString() : '0';
  }
}

// ---------- Data Fetching (Local-First via IndexedDB) ----------
async function fetchEolData(forceRefresh = false) {
  if (eolDataCache && !forceRefresh) {
    updateHubCounts();
    return eolDataCache;
  }

  // 1. FAST RENDER FROM INDEXEDDB
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
        updateHubCounts();
      }
    }
  } catch (err) {
    console.warn('Error reading from IndexedDB:', err);
  }

  // 2. Fetch or Sync with Server if needed
  const needsSync = !eolDataCache || !eolDataCache.production || eolDataCache.production.length === 0;

  if (forceRefresh || needsSync) {
    try {
      if (typeof FMS_DB !== 'undefined') {
        const syncResult = await FMS_DB.syncWithServer(forceRefresh);
        if (syncResult && syncResult.success) {
          eolDataCache = syncResult;
          updateHubCounts();
          return syncResult;
        }
      }
    } catch (error) {
      console.error("Error syncing data:", error);
      showToast("Error syncing data with Sheets");
    }
  } else if (typeof FMS_DB !== 'undefined') {
    // Background stale-while-revalidate
    FMS_DB.syncWithServer(false).then(syncResult => {
      if (syncResult && syncResult.success && syncResult.production) {
        eolDataCache = syncResult;
        updateHubCounts();
      }
    }).catch(e => console.warn('Background sync warning:', e));
  }

  return eolDataCache;
}

// ---------- Initial Page Load ----------
document.addEventListener('DOMContentLoaded', () => {
  initUserProfile();

  const repSyncBtn = document.getElementById('repSyncBtn');
  if (repSyncBtn) {
    repSyncBtn.addEventListener('click', async () => {
      showToast('Syncing latest reports data...');
      await fetchEolData(true);
      showToast('Stage reports updated');
    });
  }

  fetchEolData();
});
