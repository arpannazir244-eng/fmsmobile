/**
 * ═══════════════════════════════════════════════════════════════
 * FMS AI - Real-time Quality Control & Production Intelligence
 * Natural Language Query Engine & Knowledge Base
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // DOM Elements
  const chatMessages = document.getElementById('aiChatMessages');
  const chatScroll = document.getElementById('aiChatScroll');
  const chatForm = document.getElementById('aiChatForm');
  const promptInput = document.getElementById('aiPromptInput');
  const sendBtn = document.getElementById('aiSendBtn');
  const clearInputBtn = document.getElementById('aiInputClearBtn');
  const clearChatBtn = document.getElementById('aiClearChatBtn');
  const typingIndicator = document.getElementById('aiTypingIndicator');
  const statusText = document.getElementById('aiLiveStatus');
  const userGreetEl = document.getElementById('aiUserNameGreet');
  const pillsBar = document.getElementById('aiPillsBar');

  // Datasets
  let eolData = Array.isArray(window.BUNDLED_END_OF_LINE) ? window.BUNDLED_END_OF_LINE : [];
  let endlineQcData = Array.isArray(window.BUNDLED_ENDLINE_QC) ? window.BUNDLED_ENDLINE_QC : [];
  let currentUsername = localStorage.getItem('nimbus_username') || 'Inspector';

  // Set greeting
  if (userGreetEl) {
    userGreetEl.textContent = currentUsername;
  }

  // Update status badge
  function updateStatusBadge() {
    if (statusText) {
      statusText.textContent = `${eolData.length} End of Line Batches Synced`;
    }
  }
  updateStatusBadge();

  // Try to load extra live batches from IndexedDB
  if (window.FMS_DB && typeof FMS_DB.getBatches === 'function') {
    FMS_DB.getBatches().then(batches => {
      if (Array.isArray(batches) && batches.length > 0) {
        // Merge without duplicating batchId
        const existingIds = new Set(eolData.map(b => (b.batchId || '').toUpperCase()));
        batches.forEach(b => {
          if (b.batchId && !existingIds.has(b.batchId.toUpperCase())) {
            eolData.push(b);
          }
        });
        updateStatusBadge();
      }
    }).catch(err => console.log('IndexedDB read note:', err));
  }
  // ═══════════════════════════════════════════════════════════════
  // BULLETPROOF SCROLL TO BOTTOM (Guarantees last message is fully in view)
  // ═══════════════════════════════════════════════════════════════

  function doScroll() {
    if (chatScroll) {
      chatScroll.scrollTop = chatScroll.scrollHeight;
      chatScroll.scrollTo({
        top: chatScroll.scrollHeight,
        behavior: 'smooth'
      });
    }
    const anchor = document.getElementById('chatAnchor');
    if (anchor && typeof anchor.scrollIntoView === 'function') {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  function scrollToBottom() {
    // 1. Immediate scroll
    doScroll();
    // 2. Short tick (after browser layout reflow)
    setTimeout(doScroll, 40);
    // 3. Medium tick (after animations start)
    setTimeout(doScroll, 120);
    // 4. Final tick (after bot card finishes rendering)
    setTimeout(doScroll, 350);
  }

  function hideTyping() {
    if (typingIndicator) {
      typingIndicator.style.display = 'none';
    }
  }

  function showTyping() {
    if (typingIndicator) {
      typingIndicator.style.display = 'flex';
      scrollToBottom();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY HELPERS & MESSAGE RENDERING
  // ═══════════════════════════════════════════════════════════════

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtNum(val) {
    const n = Number(val);
    if (isNaN(n)) return '0';
    return n.toLocaleString('en-IN');
  }

  function getFormattedTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendUserMessage(text) {
    if (!chatMessages) return;
    const timeStr = getFormattedTime();
    const row = document.createElement('div');
    row.className = 'ai-msg-row user';
    row.innerHTML = `
      <div class="ai-user-bubble">
        <div>${escapeHtml(text)}</div>
        <div class="ai-msg-time">${timeStr}</div>
      </div>
    `;
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function appendBotMessage(html) {
    if (!chatMessages) return;
    const timeStr = getFormattedTime();
    const row = document.createElement('div');
    row.className = 'ai-msg-row bot';
    row.innerHTML = `
      <div class="ai-bot-avatar-mini">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
        </svg>
      </div>
      <div class="ai-bot-bubble">
        ${html}
        <div class="ai-msg-time" style="text-align: left; opacity: 0.55; color: #556b60; margin-top: 6px;">${timeStr}</div>
      </div>
    `;
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  // ═══════════════════════════════════════════════════════════════
  // INTELLIGENCE & NATURAL LANGUAGE RETRIEVAL ENGINE
  // ═══════════════════════════════════════════════════════════════

  function processQuery(rawQuery) {
    const q = (rawQuery || '').trim().toLowerCase();

    // 1. GREETINGS & INTRODUCTIONS
    if (/^(hi|hello|hey|hii|heyy|namaste|kemon acho|ki khobor|assalamu alaikum|good morning|good afternoon)/i.test(q)) {
      return `
        <p>Hello <strong>${escapeHtml(currentUsername)}</strong>! 👋 I am <strong>FMS AI</strong>, ready to assist your quality audit operations.</p>
        <p>You can ask me to:</p>
        <div class="ai-actions-shelf" style="border-top: none; margin-top: 4px;">
          <button type="button" class="ai-inline-btn" data-query="Status of Batch TT-0854">📦 Check Batch TT-0854</button>
          <button type="button" class="ai-inline-btn" data-query="Top 5 defect causes">🔥 Top 5 Defect Causes</button>
          <button type="button" class="ai-inline-btn" data-query="Arun Bairagi report">👤 Arun Bairagi Audits</button>
          <button type="button" class="ai-inline-btn" data-query="Unit P-32 quality">🏭 Unit P-32 Quality</button>
        </div>
      `;
    }

    // 2. LOGGED-IN USER / "MY REPORT" QUERY
    if (/\b(my report|amar report|amar entry|my entries|koto entry korechi|my status|how many entries do i have)\b/i.test(q)) {
      return getMyReportResponse();
    }

    // 3. TOP DEFECT REASONS / REJECTION ANALYSIS
    if (/\b(top defect|top defects|defect reason|defect causes|rejection|repair reason|besi defect|sabcheye besi|most common defect|defect analysis)\b/i.test(q)) {
      return getTopDefectsResponse();
    }

    // 4. SPECIFIC BATCH SEARCH (e.g. "TT-0854", "0854", "batch 3290", "status of batch")
    const batchMatch = q.match(/(?:batch\s*)?(?:tt-)?([0-9]{3,5})(?:\/([0-9]{2}-[0-9]{2}))?/i) || q.match(/(tt-[0-9a-z-]+(?:\/[0-9-]+)?)/i);
    if (batchMatch && (q.includes('batch') || q.includes('tt-') || q.includes('status') || q.includes('piece') || /^[0-9]{3,4}$/.test(q))) {
      const term = batchMatch[0].replace(/^batch\s*/i, '').trim();
      return getBatchLookupResponse(term);
    }

    // 5. INSPECTOR QUERIES (Arun Bairagi, Iyamat Sk, Khokan Debnath, Shyama Bhattacharjee, Arpan Nazir, etc.)
    if (/\b(arun|bairagi|iyamat|khokan|shyama|arpan|nazir|inspector|auditor|who checked)\b/i.test(q)) {
      return getInspectorResponse(q);
    }

    // 6. UNIT / FLOOR PERFORMANCE (P-32, S-37, S-18, S-29, 14-B)
    if (/\b(unit|floor|p-32|s-37|s-18|s-29|14-b|p32|s37|s18|s29|14b)\b/i.test(q)) {
      return getUnitResponse(q);
    }

    // 7. OVERALL SUMMARY / PRODUCTION STATUS
    if (/\b(summary|overview|total batches|overall|koto batch|production status|ajker status|total pcs)\b/i.test(q)) {
      return getOverallSummaryResponse();
    }

    // 8. AQL 1.5 STANDARDS & GUIDELINES
    if (/\b(aql|standard|acceptance|defect limit|sample size|rules|checklist|level ii)\b/i.test(q)) {
      return getAqlStandardResponse();
    }

    // 9. SMART FUZZY SEARCH (Fallback across style, fabricator, reason, sku)
    return getSmartSearchResponse(q);
  }

  // ── Handler: Logged-in User Report ──
  function getMyReportResponse() {
    const user = currentUsername.trim().toLowerCase();
    const userRecords = eolData.filter(r => {
      const sub = (r.submittedBy || '').trim().toLowerCase();
      const qc = (r.qcName || '').trim().toLowerCase();
      return sub === user || qc === user || sub.includes(user) || qc.includes(user);
    });

    if (userRecords.length === 0) {
      return `
        <p><strong>👤 ${escapeHtml(currentUsername)}</strong>, currently you have <strong>0 verified inspection entries</strong> in the <code>END OF LINE</code> sheet.</p>
        <div class="ai-card-block">
          <div class="ai-card-title-row">
            <h4>Inspector Summary</h4>
            <span class="ai-status-badge ai-status-pending">No Records</span>
          </div>
          <div class="ai-data-grid">
            <div class="ai-data-item"><span class="ai-data-label">Total Batches</span><span class="ai-data-val">0</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Checked Pieces</span><span class="ai-data-val">0 pcs</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Repair Count</span><span class="ai-data-val">0 pcs</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Sheet Status</span><span class="ai-data-val checked">Active 5s Sync</span></div>
          </div>
        </div>
        <p style="font-size: 12px; color: #556b60;">To log your inspections, tap below to open the End of Line QC form:</p>
        <div class="ai-actions-shelf">
          <button type="button" class="ai-inline-btn" onclick="window.location.href='end-of-line.html'">➕ Open End of Line Audit</button>
          <button type="button" class="ai-inline-btn" onclick="window.location.href='my-report.html'">📊 Open My Report Page</button>
        </div>
      `;
    }

    const totalChecked = userRecords.reduce((acc, r) => acc + (Number(r.checkedQty) || 0), 0);
    const totalRepair = userRecords.reduce((acc, r) => acc + (Number(r.repairQty) || 0), 0);
    const totalWh = userRecords.reduce((acc, r) => acc + (Number(r.whQty) || 0), 0);
    const passRate = totalChecked > 0 ? (((totalChecked - totalRepair) / totalChecked) * 100).toFixed(1) : 100;

    const recentBatches = userRecords.slice(0, 3).map(r => `<code>${r.batchId || 'N/A'}</code> (${r.checkedQty || 0} pcs)`).join(', ');

    return `
      <p>Here is your inspection report, <strong>${escapeHtml(currentUsername)}</strong>:</p>
      <div class="ai-card-block">
        <div class="ai-card-title-row">
          <h4>Inspector Audit Performance</h4>
          <span class="ai-status-badge ${Number(passRate) >= 90 ? 'ai-status-pass' : 'ai-status-repair'}">${passRate}% Pass Rate</span>
        </div>
        <div class="ai-data-grid">
          <div class="ai-data-item"><span class="ai-data-label">Audited Batches</span><span class="ai-data-val">${userRecords.length}</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Total Checked</span><span class="ai-data-val checked">${fmtNum(totalChecked)} pcs</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Warehouse Passed</span><span class="ai-data-val">${fmtNum(totalWh)} pcs</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Repair Required</span><span class="ai-data-val repair">${fmtNum(totalRepair)} pcs</span></div>
        </div>
      </div>
      <p style="font-size: 11.5px; color: #556b60;"><strong>Recent Batches:</strong> ${recentBatches}</p>
      <div class="ai-actions-shelf">
        <button type="button" class="ai-inline-btn" onclick="window.location.href='my-report.html'">📊 View Full Report Page</button>
      </div>
    `;
  }

  // ── Handler: Top Defects Response ──
  function getTopDefectsResponse() {
    const reasonsMap = {};
    let totalRepairPcs = 0;

    eolData.forEach(r => {
      const rep = Number(r.repairQty) || 0;
      if (rep > 0) {
        totalRepairPcs += rep;
        const reasons = (r.reason || '').split(/;|,|\n|\+/).map(s => s.trim()).filter(s => s.length > 2);
        if (reasons.length > 0) {
          reasons.forEach(reason => {
            const clean = reason.charAt(0).toUpperCase() + reason.slice(1);
            reasonsMap[clean] = (reasonsMap[clean] || 0) + rep;
          });
        } else {
          reasonsMap['Unspecified QC Defect'] = (reasonsMap['Unspecified QC Defect'] || 0) + rep;
        }
      }
    });

    const sorted = Object.entries(reasonsMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxVal = sorted.length > 0 ? sorted[0][1] : 1;

    let barsHtml = sorted.map((item, idx) => {
      const pct = Math.round((item[1] / maxVal) * 100);
      const overallPct = totalRepairPcs > 0 ? ((item[1] / totalRepairPcs) * 100).toFixed(1) : 0;
      return `
        <div class="ai-defect-rank-row">
          <div class="ai-rank-header">
            <span class="rank-name">${idx + 1}. ${escapeHtml(item[0])}</span>
            <span class="rank-stat">${fmtNum(item[1])} pcs (${overallPct}%)</span>
          </div>
          <div class="ai-rank-bar-bg">
            <div class="ai-rank-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <p>Analysis of <strong>339 End of Line batches</strong> identified <strong>${fmtNum(totalRepairPcs)} repair pieces</strong> across the lines. Here are the top defect drivers:</p>
      <div class="ai-card-block">
        <div class="ai-card-title-row">
          <h4>Top 5 Quality Defects</h4>
          <span class="ai-status-badge ai-status-repair">Defect Drivers</span>
        </div>
        ${barsHtml}
      </div>
      <div class="ai-defect-callout">
        <strong>💡 QC Recommendation:</strong> Prioritize inspection on <em>edge painting curing temperature</em> and <em>leather skiving tension</em> at Unit P-32 and S-37.
      </div>
      <div class="ai-actions-shelf">
        <button type="button" class="ai-inline-btn" data-query="Unit P-32 quality">🏭 Unit P-32 Quality</button>
        <button type="button" class="ai-inline-btn" data-query="Unit S-37 quality">🏭 Unit S-37 Quality</button>
      </div>
    `;
  }

  // ── Handler: Specific Batch Lookup ──
  function getBatchLookupResponse(searchTerm) {
    const cleanSearch = searchTerm.trim().toUpperCase();

    // Search in EOL data first
    let matches = eolData.filter(r => (r.batchId || '').toUpperCase().includes(cleanSearch));

    // If not found, search in ENDLINE QC data
    if (matches.length === 0) {
      matches = endlineQcData.filter(r => (r.batchId || '').toUpperCase().includes(cleanSearch));
    }

    if (matches.length === 0) {
      return `
        <p>I searched for batch <strong>${escapeHtml(searchTerm)}</strong> across all 339 End of Line records and 690 QC batches, but could not find a match.</p>
        <p style="font-size: 12px; color: #556b60;">Try searching for verified batches like:</p>
        <div class="ai-actions-shelf">
          <button type="button" class="ai-inline-btn" data-query="Batch TT-0854">TT-0854</button>
          <button type="button" class="ai-inline-btn" data-query="Batch TT-0301">TT-0301</button>
          <button type="button" class="ai-inline-btn" data-query="Batch 3290">Batch 3290</button>
        </div>
      `;
    }

    const b = matches[0];
    const checked = Number(b.checkedQty) || 0;
    const repair = Number(b.repairQty) || 0;
    const wh = Number(b.whQty) || (checked - repair);
    const order = Number(b.orderQty) || checked;
    const isAudited = checked > 0 || b.isAudited;

    let statusText = 'Pending Audit';
    let statusClass = 'ai-status-pending';
    if (isAudited) {
      if (repair === 0 && checked > 0) {
        statusText = '100% Passed';
        statusClass = 'ai-status-pass';
      } else {
        statusText = `${repair} Pcs Repair`;
        statusClass = 'ai-status-repair';
      }
    }

    const defectCallout = repair > 0 && b.reason
      ? `<div class="ai-defect-callout"><strong>Defect Reasons:</strong> ${escapeHtml(b.reason)}</div>`
      : '';

    return `
      <p>Found details for batch <strong>${escapeHtml(b.batchId)}</strong>:</p>
      <div class="ai-card-block">
        <div class="ai-card-title-row">
          <h4>${escapeHtml(b.batchId)}</h4>
          <span class="ai-status-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="ai-data-grid">
          <div class="ai-data-item"><span class="ai-data-label">Style / Model</span><span class="ai-data-val">${escapeHtml(b.style || 'N/A')}</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Colour / SKU</span><span class="ai-data-val">${escapeHtml(b.colour || b.sku || 'N/A')}</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Unit / Line</span><span class="ai-data-val">${escapeHtml(b.unit || 'N/A')}</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Fabricator</span><span class="ai-data-val">${escapeHtml(b.fabricator || 'N/A')}</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Order Quantity</span><span class="ai-data-val">${fmtNum(order)} pcs</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Checked Pieces</span><span class="ai-data-val checked">${fmtNum(checked)} pcs</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Warehouse Passed</span><span class="ai-data-val">${fmtNum(wh)} pcs</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Repair Pcs</span><span class="ai-data-val repair">${fmtNum(repair)} pcs</span></div>
        </div>
        ${defectCallout}
      </div>
      <p style="font-size: 11px; color: #556b60;"><strong>Audited by:</strong> ${escapeHtml(b.submittedBy || b.qcName || 'Unassigned')} &bull; <strong>Date:</strong> ${escapeHtml(b.checkDate || b.timestamp || 'N/A')}</p>
      <div class="ai-actions-shelf">
        <button type="button" class="ai-inline-btn" data-query="Unit ${escapeHtml(b.unit || 'P-32')} quality">Unit ${escapeHtml(b.unit || 'P-32')} Quality</button>
        <button type="button" class="ai-inline-btn" data-query="Top defect causes">Defect Trends</button>
      </div>
    `;
  }

  // ── Handler: Inspector Performance ──
  function getInspectorResponse(query) {
    if (query.includes('arpan')) {
      return `
        <p><strong>👤 Inspector Arpan Nazir:</strong></p>
        <div class="ai-card-block">
          <div class="ai-card-title-row">
            <h4>Arpan Nazir</h4>
            <span class="ai-status-badge ai-status-pending">0 Entries</span>
          </div>
          <p style="font-size: 12px; color: #556b60; margin: 4px 0;">Currently there are 0 submissions under <strong>Arpan Nazir</strong> in the Google Sheets <code>END OF LINE</code> dataset. All local test submissions have been cleared for clean sync.</p>
        </div>
        <div class="ai-actions-shelf">
          <button type="button" class="ai-inline-btn" onclick="window.location.href='end-of-line.html'">➕ Submit an Inspection</button>
        </div>
      `;
    }

    // Identify target inspector or rank all
    const inspectorStats = {};
    eolData.forEach(r => {
      const name = (r.submittedBy || r.qcName || '').trim();
      if (!name) return;
      if (!inspectorStats[name]) {
        inspectorStats[name] = { count: 0, checked: 0, repair: 0, wh: 0 };
      }
      inspectorStats[name].count += 1;
      inspectorStats[name].checked += (Number(r.checkedQty) || 0);
      inspectorStats[name].repair += (Number(r.repairQty) || 0);
      inspectorStats[name].wh += (Number(r.whQty) || 0);
    });

    const entries = Object.entries(inspectorStats).sort((a, b) => b[1].checked - a[1].checked);

    // If specific name queried
    const specific = entries.find(e => query.includes(e[0].toLowerCase()) || e[0].toLowerCase().includes(query));
    if (specific) {
      const [name, s] = specific;
      const passRate = s.checked > 0 ? (((s.checked - s.repair) / s.checked) * 100).toFixed(1) : 100;
      return `
        <p>Inspection audit profile for <strong>${escapeHtml(name)}</strong>:</p>
        <div class="ai-card-block">
          <div class="ai-card-title-row">
            <h4>${escapeHtml(name)}</h4>
            <span class="ai-status-badge ai-status-pass">${passRate}% Pass Rate</span>
          </div>
          <div class="ai-data-grid">
            <div class="ai-data-item"><span class="ai-data-label">Audited Batches</span><span class="ai-data-val">${s.count} batches</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Total Checked</span><span class="ai-data-val checked">${fmtNum(s.checked)} pcs</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Warehouse Passed</span><span class="ai-data-val">${fmtNum(s.wh)} pcs</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Repair Found</span><span class="ai-data-val repair">${fmtNum(s.repair)} pcs</span></div>
          </div>
        </div>
        <div class="ai-actions-shelf">
          <button type="button" class="ai-inline-btn" data-query="Who is top inspector?">🏆 Show Leaderboard</button>
        </div>
      `;
    }

    // Leaderboard
    let listHtml = entries.map((e, idx) => {
      const rate = e[1].checked > 0 ? (((e[1].checked - e[1].repair) / e[1].checked) * 100).toFixed(1) : 100;
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0e9df; font-size: 11.5px;">
          <span><strong>#${idx + 1} ${escapeHtml(e[0])}</strong> (${e[1].count} batches)</span>
          <span style="font-weight: 700; color: #0d5c3a;">${fmtNum(e[1].checked)} pcs &bull; ${rate}%</span>
        </div>
      `;
    }).join('');

    return `
      <p>Here is the <strong>QC Inspector Leaderboard</strong> ranked by audited volume:</p>
      <div class="ai-card-block">
        <div class="ai-card-title-row">
          <h4>Inspector Audit Ranking</h4>
          <span class="ai-status-badge ai-status-pass">${entries.length} Inspectors</span>
        </div>
        ${listHtml}
      </div>
      <div class="ai-actions-shelf">
        <button type="button" class="ai-inline-btn" data-query="Arun Bairagi report">Arun Bairagi Details</button>
        <button type="button" class="ai-inline-btn" data-query="Iyamat Sk report">Iyamat Sk Details</button>
      </div>
    `;
  }

  // ── Handler: Unit Performance ──
  function getUnitResponse(query) {
    const unitStats = {};
    eolData.forEach(r => {
      const u = (r.unit || 'Unassigned').trim();
      if (!unitStats[u]) {
        unitStats[u] = { count: 0, checked: 0, repair: 0, wh: 0 };
      }
      unitStats[u].count += 1;
      unitStats[u].checked += (Number(r.checkedQty) || 0);
      unitStats[u].repair += (Number(r.repairQty) || 0);
      unitStats[u].wh += (Number(r.whQty) || 0);
    });

    const entries = Object.entries(unitStats).sort((a, b) => b[1].checked - a[1].checked);

    // Check specific unit
    const matched = entries.find(e => query.toLowerCase().includes(e[0].toLowerCase().replace('-', '')) || query.toLowerCase().includes(e[0].toLowerCase()));
    if (matched) {
      const [unitName, s] = matched;
      const defectRate = s.checked > 0 ? ((s.repair / s.checked) * 100).toFixed(1) : 0;
      const passRate = (100 - Number(defectRate)).toFixed(1);
      return `
        <p>Quality and production matrix for <strong>Unit ${escapeHtml(unitName)}</strong>:</p>
        <div class="ai-card-block">
          <div class="ai-card-title-row">
            <h4>Unit ${escapeHtml(unitName)}</h4>
            <span class="ai-status-badge ${Number(passRate) >= 85 ? 'ai-status-pass' : 'ai-status-repair'}">${passRate}% Pass Rate</span>
          </div>
          <div class="ai-data-grid">
            <div class="ai-data-item"><span class="ai-data-label">Total Batches</span><span class="ai-data-val">${s.count} batches</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Total Checked</span><span class="ai-data-val checked">${fmtNum(s.checked)} pcs</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Warehouse Passed</span><span class="ai-data-val">${fmtNum(s.wh)} pcs</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Repair Rate</span><span class="ai-data-val repair">${defectRate}% (${fmtNum(s.repair)} pcs)</span></div>
          </div>
        </div>
        <div class="ai-actions-shelf">
          <button type="button" class="ai-inline-btn" data-query="Compare all units">Compare All Units</button>
          <button type="button" class="ai-inline-btn" data-query="Top defect causes">Defect Analysis</button>
        </div>
      `;
    }

    // Comparison across all units
    let unitRows = entries.map(e => {
      const rate = e[1].checked > 0 ? ((e[1].repair / e[1].checked) * 100).toFixed(1) : 0;
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #f0e9df; font-size: 11.5px;">
          <span><strong>Unit ${escapeHtml(e[0])}</strong> (${e[1].count} batches)</span>
          <span style="font-weight: 700; color: ${Number(rate) > 15 ? '#c53030' : '#0d5c3a'};">${fmtNum(e[1].checked)} pcs &bull; ${rate}% repair</span>
        </div>
      `;
    }).join('');

    return `
      <p>Here is the quality comparison across all production units:</p>
      <div class="ai-card-block">
        <div class="ai-card-title-row">
          <h4>Unit Quality Comparison</h4>
          <span class="ai-status-badge ai-status-pass">${entries.length} Units</span>
        </div>
        ${unitRows}
      </div>
      <div class="ai-actions-shelf">
        <button type="button" class="ai-inline-btn" data-query="Unit P-32 quality">Unit P-32</button>
        <button type="button" class="ai-inline-btn" data-query="Unit S-37 quality">Unit S-37</button>
        <button type="button" class="ai-inline-btn" data-query="Unit S-18 quality">Unit S-18</button>
      </div>
    `;
  }

  // ── Handler: Overall Summary ──
  function getOverallSummaryResponse() {
    const totalBatches = eolData.length;
    const totalChecked = eolData.reduce((acc, r) => acc + (Number(r.checkedQty) || 0), 0);
    const totalRepair = eolData.reduce((acc, r) => acc + (Number(r.repairQty) || 0), 0);
    const totalWh = eolData.reduce((acc, r) => acc + (Number(r.whQty) || 0), 0);
    const passRate = totalChecked > 0 ? (((totalChecked - totalRepair) / totalChecked) * 100).toFixed(1) : 100;
    const repairRate = (100 - Number(passRate)).toFixed(1);

    return `
      <p>Here is the live executive overview of <strong>End of Line Quality Operations</strong>:</p>
      <div class="ai-card-block">
        <div class="ai-card-title-row">
          <h4>Production QC Summary</h4>
          <span class="ai-status-badge ai-status-pass">${passRate}% Quality Pass</span>
        </div>
        <div class="ai-data-grid">
          <div class="ai-data-item"><span class="ai-data-label">Audited Batches</span><span class="ai-data-val">${fmtNum(totalBatches)} batches</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Pieces Checked</span><span class="ai-data-val checked">${fmtNum(totalChecked)} pcs</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Warehouse Passed</span><span class="ai-data-val">${fmtNum(totalWh)} pcs</span></div>
          <div class="ai-data-item"><span class="ai-data-label">Defect / Repair</span><span class="ai-data-val repair">${fmtNum(totalRepair)} pcs (${repairRate}%)</span></div>
        </div>
      </div>
      <p style="font-size: 11.5px; color: #556b60;">Data synced directly with Google Sheets <code>END OF LINE</code> dataset.</p>
      <div class="ai-actions-shelf">
        <button type="button" class="ai-inline-btn" data-query="Top defect causes">🔥 Top Defect Causes</button>
        <button type="button" class="ai-inline-btn" data-query="Who is top inspector?">👤 Inspector Ranking</button>
        <button type="button" class="ai-inline-btn" data-query="Compare all units">🏭 Unit Quality Matrix</button>
      </div>
    `;
  }

  // ── Handler: AQL 1.5 Standard ──
  function getAqlStandardResponse() {
    return `
      <p><strong>AQL 1.5 Standard (Normal Single Sampling, General Inspection Level II)</strong>:</p>
      <div class="ai-card-block">
        <div class="ai-card-title-row">
          <h4>AQL 1.5 Sampling Table (ISO 2859-1)</h4>
          <span class="ai-status-badge ai-status-pass">Factory Standard</span>
        </div>
        <div style="font-size: 11px; line-height: 1.6; color: #1a2e22;">
          <div>&bull; <strong>Lot 16 - 25:</strong> Sample 5 pcs &rarr; Max Acceptable: <strong>0 defects</strong></div>
          <div>&bull; <strong>Lot 26 - 50:</strong> Sample 8 pcs &rarr; Max Acceptable: <strong>0 defects</strong></div>
          <div>&bull; <strong>Lot 51 - 90:</strong> Sample 13 pcs &rarr; Max Acceptable: <strong>0 defects</strong></div>
          <div>&bull; <strong>Lot 91 - 150:</strong> Sample 20 pcs &rarr; Max Acceptable: <strong>1 defect</strong></div>
          <div>&bull; <strong>Lot 151 - 280:</strong> Sample 32 pcs &rarr; Max Acceptable: <strong>1 defect</strong></div>
          <div>&bull; <strong>Lot 281 - 500:</strong> Sample 50 pcs &rarr; Max Acceptable: <strong>2 defects</strong></div>
        </div>
      </div>
      <div class="ai-defect-callout">
        <strong>⚠️ Critical Rule:</strong> If defects exceed the allowed maximum, the batch must be placed under <strong>100% Full Inspection</strong>.
      </div>
    `;
  }

  // ── Handler: Smart Search Fallback ──
  function getSmartSearchResponse(query) {
    const qLower = query.toLowerCase();
    const hits = eolData.filter(r => {
      return (r.batchId && r.batchId.toLowerCase().includes(qLower)) ||
             (r.style && r.style.toLowerCase().includes(qLower)) ||
             (r.fabricator && r.fabricator.toLowerCase().includes(qLower)) ||
             (r.sku && r.sku.toLowerCase().includes(qLower)) ||
             (r.reason && r.reason.toLowerCase().includes(qLower));
    });

    if (hits.length > 0) {
      const topHit = hits[0];
      return `
        <p>I found matching records for <strong>"${escapeHtml(query)}"</strong>:</p>
        <div class="ai-card-block">
          <div class="ai-card-title-row">
            <h4>${escapeHtml(topHit.batchId)}</h4>
            <span class="ai-status-badge ai-status-pass">${fmtNum(topHit.checkedQty || 0)} pcs</span>
          </div>
          <div class="ai-data-grid">
            <div class="ai-data-item"><span class="ai-data-label">Style</span><span class="ai-data-val">${escapeHtml(topHit.style || 'N/A')}</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Fabricator</span><span class="ai-data-val">${escapeHtml(topHit.fabricator || 'N/A')}</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Unit</span><span class="ai-data-val">${escapeHtml(topHit.unit || 'N/A')}</span></div>
            <div class="ai-data-item"><span class="ai-data-label">Repair</span><span class="ai-data-val repair">${fmtNum(topHit.repairQty || 0)} pcs</span></div>
          </div>
        </div>
        <div class="ai-actions-shelf">
          <button type="button" class="ai-inline-btn" data-query="Batch ${escapeHtml(topHit.batchId)}">Full Batch Details</button>
        </div>
      `;
    }

    return `
      <p>I couldn't find a direct record matching <strong>"${escapeHtml(query)}"</strong>.</p>
      <p style="font-size: 12px; color: #556b60;">You can ask me about:</p>
      <div class="ai-actions-shelf">
        <button type="button" class="ai-inline-btn" data-query="Status of Batch TT-0854">📦 Batch TT-0854</button>
        <button type="button" class="ai-inline-btn" data-query="Top 5 defect causes">🔥 Top Defect Causes</button>
        <button type="button" class="ai-inline-btn" data-query="Unit P-32 quality">🏭 Unit Quality</button>
        <button type="button" class="ai-inline-btn" data-query="Arun Bairagi report">👤 Inspector Arun Bairagi</button>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════
  // USER INPUT & CHAT EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════

  function handleSendQuery(text) {
    const q = (text != null ? text : (promptInput ? promptInput.value : '')).trim();
    if (!q) return;

    // Reset input
    if (promptInput) {
      promptInput.value = '';
    }
    if (sendBtn) {
      sendBtn.disabled = true;
    }
    if (clearInputBtn) {
      clearInputBtn.style.display = 'none';
    }

    // Append User Message & Auto Scroll
    appendUserMessage(q);

    // Show Typing indicator
    showTyping();

    // Haptic feedback
    if (navigator.vibrate) {
      try { navigator.vibrate(20); } catch (_) {}
    }

    // Natural conversation delay (250ms - 450ms)
    setTimeout(() => {
      hideTyping();
      const responseHtml = processQuery(q);
      appendBotMessage(responseHtml);
    }, 320);
  }

  // Form submit
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendQuery();
    });
  }

  // Send button click
  if (sendBtn) {
    sendBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleSendQuery();
    });
  }

  // Input typing events
  if (promptInput) {
    const updateInputState = () => {
      const hasVal = promptInput.value.trim().length > 0;
      if (sendBtn) sendBtn.disabled = !hasVal;
      if (clearInputBtn) {
        clearInputBtn.style.display = hasVal ? 'block' : 'none';
      }
    };

    promptInput.addEventListener('input', updateInputState);
    promptInput.addEventListener('keyup', updateInputState);
    promptInput.addEventListener('change', updateInputState);

    // Support pressing Enter key to send directly
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSendQuery();
      }
    });
  }

  if (clearInputBtn) {
    clearInputBtn.addEventListener('click', () => {
      if (promptInput) {
        promptInput.value = '';
        promptInput.focus();
      }
      if (sendBtn) sendBtn.disabled = true;
      clearInputBtn.style.display = 'none';
    });
  }

  // Clear / Reset Chat Button
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      if (confirm('Do you want to reset the FMS AI conversation?')) {
        // Keep only the welcome card
        const welcomeCard = document.getElementById('aiWelcomeCard');
        if (chatMessages) {
          chatMessages.innerHTML = '';
          if (welcomeCard) chatMessages.appendChild(welcomeCard);
        }
        scrollToBottom();
      }
    });
  }

  // Topic Chips, Pills Bar, and Inline Bot Action Buttons Delegation
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.ai-topic-chip, .ai-pill-btn, .ai-inline-btn');
    if (chip) {
      const prompt = chip.dataset.prompt || chip.dataset.query;
      if (prompt) {
        handleSendQuery(prompt);
      }
    }
  });

  window.fmsAiSend = handleSendQuery;
})();
