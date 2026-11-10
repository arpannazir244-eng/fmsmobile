// Google Apps Script (Code.gs)
// Spreadsheet ID: 1uXjAFkcrWTF_sDDSXOoisl-q97n3vbHqa0JeSZ0fn2Q

const SPREADSHEET_ID = '1uXjAFkcrWTF_sDDSXOoisl-q97n3vbHqa0JeSZ0fn2Q';

// The exact column order used for the "END OF LINE" sheet.
// doPost() writes rows in this order, and setupEndOfLineSheet() (below)
// writes a matching header row so the two always stay in sync.
const EOL_COLUMNS = [
  'Batch ID', 'Style', 'Colour', 'PO', 'SKU', 'Quantity', 'Floor', 'Unit',
  'Fabricator', 'QC Name', 'ETD', 'Check Date', 'Checked Qty', 'Repair Qty',
  'WH Qty', 'Reason', 'Submitted By', 'Timestamp', 'Repair Category'
];

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 1. Fetch Batch Data from END LINE QC-FMS (Fallback to PRODUCTION)
    const prodSheet = ss.getSheetByName("END LINE QC-FMS") || ss.getSheetByName("PRODUCTION");
    if (!prodSheet) {
      return createJsonResponse({ error: 'END LINE QC-FMS / PRODUCTION sheet not found' });
    }
    
    // Get all data from sheet (assuming header is row 1)
    const prodData = prodSheet.getDataRange().getValues();
    const isEndLineSheet = prodSheet.getName() === "END LINE QC-FMS";
    const productionList = [];
    const latestEolQuantitiesByBatch = isEndLineSheet ? {} : getLatestEolQuantitiesByBatch(ss);
    
    for (let i = 1; i < prodData.length; i++) {
      const row = prodData[i];
      const batchId = row[1]; // Col B (index 1)
      
      if (batchId) { // Only process if Batch ID exists
        const batchKey = batchId.toString().trim().toUpperCase();
        let availableQuantity = null;
        let totalQuantity = parseQuantity(row[12]); // Col M (index 12)
        let qcName = '';

        if (isEndLineSheet) {
          // In END LINE QC-FMS:
          // Col X (index 23) is PENDING QTY SEND TO WAREHOUSE
          // Col V (index 21) is QUANTITY SEND TO WAREHOUSE
          // Col AD (index 29) is QC NAME
          const pendingWhQty = row.length > 23 ? parseQuantity(row[23]) : null;
          const whQty = row.length > 21 ? parseQuantity(row[21]) : null;
          if (pendingWhQty !== null) {
            availableQuantity = pendingWhQty;
          } else if (totalQuantity !== null && whQty !== null) {
            availableQuantity = Math.max(0, totalQuantity - whQty);
          } else {
            availableQuantity = totalQuantity;
          }
          qcName = (row.length > 29 && row[29]) ? row[29].toString().trim() : '';
        } else {
          const latestEolQuantities = latestEolQuantitiesByBatch[batchKey];
          availableQuantity = latestEolQuantities && totalQuantity !== null
            ? Math.max(0, totalQuantity - latestEolQuantities.whQuantity)
            : totalQuantity;
        }

        productionList.push({
          batchId: batchId.toString(),
          style: row[10] ? row[10].toString() : '',      // Col K (index 10)
          colour: row[11] ? row[11].toString() : '',     // Col L (index 11)
          po: row[14] ? row[14].toString() : '',         // Col O (index 14)
          sku: row[9] ? row[9].toString() : '',          // Col J (index 9)
          quantity: formatQuantity(availableQuantity),    // Available quantity
          totalQuantity: formatQuantity(row[12]),         // Original production quantity
          unit: row[4] ? row[4].toString() : '',         // Col E (index 4)
          fabricator: row[5] ? row[5].toString() : '',   // Col F (index 5)
          etd: row[13] ? formatDate(row[13]) : '',       // Col N (index 13)
          qcName: qcName                                 // Col AD (index 29)
        });
      }
    }
    
    // 2. Fetch DROPDOWN Data (Unit to QC Name mapping)
    const dropdownSheet = ss.getSheetByName("DROPDOWN");
    const qcMapping = {}; // Format: { "UnitName": "QC Name" }
    
    if (dropdownSheet) {
      const ddData = dropdownSheet.getDataRange().getValues();
      for (let i = 1; i < ddData.length; i++) {
        const row = ddData[i];
        const unit = row[0] ? row[0].toString().trim() : ''; // Col A (index 0)
        const qcName = row[3] ? row[3].toString().trim() : ''; // Col D (index 3)
        
        if (unit && qcName) {
          qcMapping[unit] = qcName;
        }
      }
    }

    // 3. Fetch USERS data (for login) — username in Col A, password in Col B,
    // starting at row 2.
    const usersSheet = ss.getSheetByName("USERS");
    const users = [];

    if (usersSheet) {
      const lastRow = usersSheet.getLastRow();
      if (lastRow >= 2) {
        const userData = usersSheet.getRange(2, 1, lastRow - 1, 2).getValues();
        userData.forEach(function (row) {
          const username = row[0] ? row[0].toString().trim() : '';
          const password = row[1] ? row[1].toString().trim() : '';
          if (username) {
            users.push({ username: username, password: password });
          }
        });
      }
    }

    // 4. Fetch Batch IDs that have ALREADY been submitted to "END OF LINE",
    // so the client can warn about / block duplicate submissions before
    // the user even hits Submit.
    // 5. Total number of entries submitted to "END OF LINE" so far, shown
    // as a live count on the End of Line stage card.
    const eolSheetForCount = ss.getSheetByName("END OF LINE");
    const eolEntryCount = eolSheetForCount ? Math.max(0, eolSheetForCount.getLastRow() - 1) : 0;
    const eolEntryCountsByUser = getEolEntryCountsByUser(ss);
    const eolTodayEntryCountsByUser = getEolTodayEntryCountsByUser(ss);

    // 6. Return JSON Data
    return createJsonResponse({
      success: true,
      production: productionList,
      qcMapping: qcMapping,
      users: users,
      eolEntryCount: eolEntryCount,
      eolEntryCountsByUser: eolEntryCountsByUser,
      eolTodayEntryCountsByUser: eolTodayEntryCountsByUser
    });
    
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

// Returns a de-duplicated array of every Batch ID already present in the
// "END OF LINE" sheet's Batch ID column (Col A). Shared by doGet() (so the
// client can pre-warn) and doPost() (so the server enforces it too).
// Helper to format Date objects to YYYY-MM-DD for HTML input type="date".
// <input type="date"> silently rejects (shows blank for) anything that
// isn't exactly YYYY-MM-DD, so this also handles the case where the sheet
// cell is stored as text instead of a real Date value.
function formatDate(dateObj) {
  if (!dateObj) return '';

  let d = dateObj;
  if (!(d instanceof Date)) {
    // Cell wasn't a real Date (e.g. entered/stored as text) — try to parse it.
    d = new Date(dateObj);
    if (isNaN(d.getTime())) {
      // Couldn't parse it at all; return as-is rather than lose the data.
      return dateObj.toString();
    }
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to return proper JSON response with CORS headers
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Converts a date coming from the <input type="date"> fields (which send
// "YYYY-MM-DD") into "DD/MM/YYYY" text for writing into the sheet.
function toDDMMYYYY(dateStr) {
  if (!dateStr) return '';

  const isoMatch = dateStr.toString().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }

  // Fallback: try to parse whatever was sent.
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return dateStr.toString();
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const eolSheet = ss.getSheetByName("END OF LINE");

    if (!eolSheet) {
      return createJsonResponse({ success: false, error: '"END OF LINE" sheet not found' });
    }

    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: 'No POST data received' });
    }

    // Parse the incoming payload
    const data = JSON.parse(e.postData.contents);

    const incomingBatchId = (data.batchId || '').toString().trim();
    if (!incomingBatchId) {
      return createJsonResponse({ success: false, error: 'Batch ID is required.' });
    }

    // SERVER-SIDE DUPLICATE CHECK — this is the source of truth. The client
    // also checks this before ever calling doPost (see main.js), but this
    // check is what actually prevents a duplicate row from being written,
    // e.g. if two people submit the same Batch ID at the same time, or if
    // the client's cached batch list happened to be stale.
    // IMPORTANT: this order must match EOL_COLUMNS above.
    // Run setupEndOfLineSheet() once (see below) to write a matching header
    // row into the sheet — after that, every field always lands in the
    // right column no matter what.
    // Extract Repair Category
    let repairCategoryVal = (
      data.repairCategory ||
      data.repair_category ||
      data['Repair Category'] ||
      data.category ||
      data.colS ||
      data.col_s ||
      ''
    ).toString().trim();

    // If repairCategory was embedded in reason like [Stitching, Edge-Paint], extract it as fallback
    if (!repairCategoryVal && data.reason) {
      const match = data.reason.toString().match(/^\[(.*?)\]/);
      if (match && match[1]) {
        repairCategoryVal = match[1].trim();
      }
    }

    const newRow = [
      incomingBatchId,                               // Col A: Batch ID
      data.style || '',                              // Col B: Style
      data.colour || '',                             // Col C: Colour
      data.po || '',                                 // Col D: PO
      data.sku || '',                                // Col E: SKU
      data.quantity || '',                           // Col F: Quantity
      data.floor || '',                              // Col G: Floor
      data.unit || '',                               // Col H: Unit
      data.fabricator || '',                         // Col I: Fabricator
      data.qcName || '',                             // Col J: QC Name
      data.etd ? toDDMMYYYY(data.etd) : '',          // Col K: ETD
      data.checkDate ? toDDMMYYYY(data.checkDate) : '', // Col L: Check Date
      data.checkedQty || '',                         // Col M: Checked Qty
      data.repairQty || '',                          // Col N: Repair Qty
      data.whQty || '',                              // Col O: WH Qty
      data.reason || '',                             // Col P: Reason
      data.submittedBy || '',                        // Col Q: Submitted By
      new Date(),                                    // Col R: Timestamp
      repairCategoryVal                              // Col S: Repair Category (19th Column!)
    ];

    // Append the row to the sheet (Columns A to S)
    eolSheet.appendRow(newRow);

    return createJsonResponse({ success: true, message: 'Data saved successfully' });

  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

// ------------------------------------------------------------------
// ONE-TIME SETUP
// Run this function ONCE from the Apps Script editor (select
// "setupEndOfLineSheet" in the function dropdown, then click ▶ Run).
// It creates the "END OF LINE" sheet if missing, and writes a header
// row that exactly matches the column order doPost() writes in —
// this is what fixes data landing in the wrong / missing columns.
// It is safe to run more than once: if the header is already there,
// it does nothing.
// ------------------------------------------------------------------
function setupEndOfLineSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let eolSheet = ss.getSheetByName("END OF LINE");

  if (!eolSheet) {
    eolSheet = ss.insertSheet("END OF LINE");
  }

  const firstCell = eolSheet.getRange(1, 1).getValue().toString().trim().toLowerCase();
  if (firstCell === 'batch id') {
    const lastCol = eolSheet.getLastColumn();
    const headers = eolSheet.getRange(1, 1, 1, Math.max(lastCol, 1)).getValues()[0].map(h => (h || '').toString().trim().toLowerCase());
    if (!headers.includes('repair category')) {
      const colS = eolSheet.getRange(1, 19);
      colS.setValue('Repair Category');
      colS.setFontWeight('bold').setBackground('#4a3fa6').setFontColor('#ffffff');
      eolSheet.autoResizeColumn(19);
      Logger.log('Added "Repair Category" header to Column S.');
    }
    Logger.log('Header row verified.');
    return;
  }

  // Insert a fresh row at the very top so any existing data (if present)
  // is preserved and simply shifted down — nothing gets deleted.
  eolSheet.insertRowBefore(1);

  const headerRange = eolSheet.getRange(1, 1, 1, EOL_COLUMNS.length);
  headerRange.setValues([EOL_COLUMNS]);
  headerRange
    .setFontWeight('bold')
    .setBackground('#4a3fa6')
    .setFontColor('#ffffff');

  eolSheet.setFrozenRows(1);
  eolSheet.autoResizeColumns(1, EOL_COLUMNS.length);

  Logger.log('"END OF LINE" sheet header row created successfully: ' + EOL_COLUMNS.join(', '));
}

// ------------------------------------------------------------------
// ONE-TIME MIGRATION (only needed if your "END OF LINE" sheet already
// existed BEFORE the "Submitted By" column was added above).
// Run this once from the Apps Script editor (select "addSubmittedByColumn"
// in the function dropdown, then click ▶ Run). It inserts a new
// "Submitted By" column right before "Timestamp" — existing data in
// every other column is left untouched. Safe to run more than once: if
// the column already exists, it does nothing.
// ------------------------------------------------------------------
function addSubmittedByColumn() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const eolSheet = ss.getSheetByName("END OF LINE");
  if (!eolSheet) {
    Logger.log('"END OF LINE" sheet not found — nothing to migrate.');
    return;
  }

  const lastCol = eolSheet.getLastColumn();
  const headers = eolSheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => h.toString().trim().toLowerCase());

  if (headers.includes('submitted by')) {
    Logger.log('"Submitted By" column already exists — nothing to do.');
    return;
  }

  const timestampCol = headers.indexOf('timestamp') + 1; // 1-based; 0 if not found
  const insertAt = timestampCol > 0 ? timestampCol : lastCol + 1;

  eolSheet.insertColumnBefore(insertAt);
  const headerCell = eolSheet.getRange(1, insertAt);
  headerCell.setValue('Submitted By');
  headerCell.setFontWeight('bold').setBackground('#4a3fa6').setFontColor('#ffffff');

  Logger.log('"Submitted By" column inserted at position ' + insertAt);
}

// Counts END OF LINE entries by the user stored in the "Submitted By"
// column (Col Q). Keys are normalized for case-insensitive matching.
function getEolEntryCountsByUser(ss) {
  const eolSheet = ss.getSheetByName("END OF LINE");
  if (!eolSheet || eolSheet.getLastRow() < 2 || eolSheet.getLastColumn() < 17) return {};

  const users = eolSheet.getRange(2, 17, eolSheet.getLastRow() - 1, 1).getValues();
  const counts = {};

  users.forEach(function (row) {
    const username = row[0] ? row[0].toString().trim() : '';
    if (!username) return;

    const key = username.toUpperCase();
    counts[key] = (counts[key] || 0) + 1;
  });

  return counts;
}

// Counts END OF LINE entries submitted TODAY, grouped by the user in the
// "Submitted By" column (Col Q). "Today" is determined using the
// spreadsheet's own timezone (Settings, not the server's), so it matches
// what the person in the sheet actually considers "today". Keys are
// normalized for case-insensitive matching, same as getEolEntryCountsByUser.
function getEolTodayEntryCountsByUser(ss) {
  const eolSheet = ss.getSheetByName("END OF LINE");
  if (!eolSheet || eolSheet.getLastRow() < 2 || eolSheet.getLastColumn() < 18) return {};

  // Submitted By (Col Q, 17) and Timestamp (Col R, 18) together.
  const rows = eolSheet.getRange(2, 17, eolSheet.getLastRow() - 1, 2).getValues();
  const counts = {};
  const tz = ss.getSpreadsheetTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  rows.forEach(function (row) {
    const username = row[0] ? row[0].toString().trim() : '';
    const rawTimestamp = row[1];
    if (!username || !rawTimestamp) return;

    let ts = rawTimestamp;
    if (!(ts instanceof Date)) {
      ts = new Date(rawTimestamp);
      if (isNaN(ts.getTime())) return; // Can't tell what day this was — skip it.
    }

    const tsStr = Utilities.formatDate(ts, tz, 'yyyy-MM-dd');
    if (tsStr !== todayStr) return;

    const key = username.toUpperCase();
    counts[key] = (counts[key] || 0) + 1;
  });

  return counts;
}

// Returns the TOTAL (cumulative) Sent to WH quantity across ALL EOL entries
// for every Batch ID — a batch can be checked and sent to warehouse in
// multiple separate submissions over time, so every entry's WH Qty for that
// batch must be added together, not just the most recent one. Available Qty
// is calculated against the original PRODUCTION quantity:
// original - SUM(Sent to WH across all entries for that batch).
// Repair Qty is already included in the quantity that was not sent to the
// warehouse, so it must not be counted a second time.
function getLatestEolQuantitiesByBatch(ss) {
  const eolSheet = ss.getSheetByName("END OF LINE");
  if (!eolSheet || eolSheet.getLastRow() < 2) return {};

  const entries = eolSheet.getRange(2, 1, eolSheet.getLastRow() - 1, 15).getValues();
  const quantities = {};

  entries.forEach(function (row) {
    const batchId = row[0] ? row[0].toString().trim() : '';
    if (!batchId) return;

    const key = batchId.toUpperCase();
    const whQuantity = parseQuantity(row[14]); // Col O: WH Qty
    const checkedQuantity = parseQuantity(row[12]); // Col M: Checked Qty

    // Older entries may not have WH Qty; use Checked Qty as a safe fallback.
    const effectiveWh = whQuantity === null ? (checkedQuantity === null ? 0 : checkedQuantity) : whQuantity;

    if (!quantities[key]) {
      quantities[key] = { whQuantity: 0 };
    }
    // Accumulate across every entry for this batch, not just the latest one.
    quantities[key].whQuantity += effectiveWh;
  });

  return quantities;
}

function parseQuantity(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value.toString().replace(/,/g, '').trim());
  return isNaN(parsed) ? null : parsed;
}

function formatQuantity(value) {
  const quantity = parseQuantity(value);
  if (quantity === null) return value ? value.toString() : '';
  return quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
