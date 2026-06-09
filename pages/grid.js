/**
 * ============================================================
 *  Puchne — Grid View Script
 * ============================================================
 *
 *  Renders enabled AI services in a tiled CSS grid layout.
 *  All cells fill the container — resizing one cell pushes/pulls
 *  its neighbors (like split panes in VS Code / tmux).
 *
 *  Features:
 *    - 8-direction resize handles on every inner edge/corner
 *    - Drag-to-reposition by grabbing the title bar
 *    - Window resize scales proportionally (fractions stay fixed)
 *
 *  Frame-blocking headers are stripped by declarativeNetRequest
 *  rules in rules/grid_headers.json.
 * ============================================================
 */

const gridContainer  = document.getElementById("gridContainer");
const gridQueryForm  = document.getElementById("gridQueryForm");
const gridQueryInput = document.getElementById("gridQueryInput");

/* ── Layout State ──────────────────────────────────────────── */
let cols = 0;
let rows = 0;
let colFracs  = [];   // column width fractions, sum to 1
let rowFracs  = [];   // row height fractions, sum to 1
let cellMap   = [];   // [{ el, row, col, colSpan, service, index }]

const MIN_FRAC = 0.10; // minimum fraction for any track (10%)

/* ── Hover-to-Expand State ─────────────────────────────────── */
let hoverExpandDelay = 0;  // ms of dwell before expanding
const HOVER_EXPAND_FRAC  = 0.60;  // target fraction the hovered cell's span will occupy

let expandState = null; // { savedColFracs, savedRowFracs, cellObj } when a cell is expanded
let hoverExpand = true;
let hoverExpandMin = 2;
let isClosing = false;
let transitioningTimeout = null;

/* ── Grid Template Helpers ─────────────────────────────────── */

function updateGridTemplate() {
  gridContainer.style.gridTemplateColumns = colFracs.map(f => (f * 100) + "%").join(" ");
  gridContainer.style.gridTemplateRows    = rowFracs.map(f => (f * 100) + "%").join(" ");
}

function triggerTransition() {
  gridContainer.classList.add("transitioning");
  if (transitioningTimeout) {
    clearTimeout(transitioningTimeout);
  }
  transitioningTimeout = setTimeout(() => {
    gridContainer.classList.remove("transitioning");
    transitioningTimeout = null;
  }, 300);
}

function placeCellInGrid(c) {
  c.el.style.gridColumn = `${c.col + 1} / span ${c.colSpan}`;
  c.el.style.gridRow    = `${c.row + 1}`;
}

/* ── Resize Handles ────────────────────────────────────────── */

/**
 * Each shared boundary is owned by exactly one cell to avoid
 * doubled hover highlights:
 *   - South handle  → owns the horizontal boundary below this cell
 *   - East handle   → owns the vertical boundary to the right
 *   - SE corner     → owns the intersection point
 * N, W, NW, NE, SW are never created — those boundaries belong
 * to the neighboring cell's S, E, or SE handle.
 */
function addResizeHandles(cellEl, cellObj) {
  const dirs = getActiveHandles(cellObj);
  dirs.forEach((dir) => {
    const handle = document.createElement("div");
    handle.className = `resize-handle rh-${dir}`;
    handle.dataset.dir = dir;

    // On hover, highlight all handles on the same full boundary line
    handle.addEventListener("mouseenter", () => highlightBoundary(cellObj, dir, true));
    handle.addEventListener("mouseleave", () => highlightBoundary(cellObj, dir, false));

    cellEl.appendChild(handle);
  });
}

/**
 * Highlight (or un-highlight) every handle that sits on the same
 * grid boundary as `dir` on `cellObj`.
 *
 *   - "s" handle at row R  → highlight all "s" handles in row R
 *   - "e" handle ending at col boundary B → highlight all "e" handles at B
 *   - "se" → highlight both the full row and full column line
 */
function highlightBoundary(cellObj, dir, on) {
  const cls = "rh-active";

  if (dir.includes("s")) {
    const rowBoundary = cellObj.row;
    for (const c of cellMap) {
      if (c.row === rowBoundary) {
        const h = c.el.querySelector(".rh-s");
        if (h) h.classList.toggle(cls, on);
      }
    }
  }

  if (dir.includes("e")) {
    const colBoundary = cellObj.col + cellObj.colSpan;
    for (const c of cellMap) {
      if (c.col + c.colSpan === colBoundary) {
        const h = c.el.querySelector(".rh-e");
        if (h) h.classList.toggle(cls, on);
      }
    }
  }

  // Also highlight the SE dot at the intersection if it exists
  if (dir === "s" || dir === "e") {
    const seCell = cellMap.find(c =>
      c.row === cellObj.row && c.col + c.colSpan === (dir === "s" ? cellObj.col + cellObj.colSpan : cellObj.col + cellObj.colSpan)
    );
    // For "s": find SE handle on the cell that shares both this row and has an east boundary
    // For "e": find SE handle on this cell's row
    const seHandle = cellObj.el.querySelector(".rh-se");
    if (seHandle) seHandle.classList.toggle(cls, on);
  }
}

function getActiveHandles(cellObj) {
  const atBottom = cellObj.row >= rows - 1;
  const atRight  = cellObj.col + cellObj.colSpan >= cols;

  const handles = [];
  if (!atBottom)              handles.push("s");
  if (!atRight)               handles.push("e");
  if (!atBottom && !atRight)  handles.push("se");
  return handles;
}

/* ── Iframe Overlay ────────────────────────────────────────── */

function createIframeOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "iframe-overlay";
  document.body.appendChild(overlay);
  return overlay;
}

function removeOverlay(overlay) {
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
}

/* ── Resize Logic (tiled — push/pull neighbors) ────────────── */

function initResize(cellObj, dir, startX, startY) {
  gridContainer.classList.add("no-transition");
  if (expandState) { colFracs = expandState.savedColFracs; rowFracs = expandState.savedRowFracs; expandState = null; }
  const overlay = createIframeOverlay();
  const containerW = gridContainer.clientWidth;
  const containerH = gridContainer.clientHeight;

  // Snapshot fractions before drag
  const origColFracs = [...colFracs];
  const origRowFracs = [...rowFracs];

  function onMove(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Horizontal: east edge boundary (col+colSpan-1 ↔ col+colSpan)
    if (dir.includes("e")) {
      const tempCols = [...origColFracs];
      const leftIdx  = cellObj.col + cellObj.colSpan - 1;
      const rightIdx = cellObj.col + cellObj.colSpan;
      if (rightIdx < cols) {
        adjustFracs(tempCols, leftIdx, rightIdx, dx / containerW);
        colFracs = tempCols;
      }
    }

    // Vertical: south edge boundary (row ↔ row+1)
    if (dir.includes("s")) {
      const tempRows = [...origRowFracs];
      const topIdx    = cellObj.row;
      const bottomIdx = cellObj.row + 1;
      if (bottomIdx < rows) {
        adjustFracs(tempRows, topIdx, bottomIdx, dy / containerH);
        rowFracs = tempRows;
      }
    }

    updateGridTemplate();
  }

  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    removeOverlay(overlay);
    gridContainer.classList.remove("no-transition");
    const cellOrder = [...cellMap]
      .sort((a, b) => a.row * cols + a.col - (b.row * cols + b.col))
      .map(c => c.service.id);
    chrome.storage.local.set({ gridLayout: { cols, rows, colFracs, rowFracs, cellOrder } });
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/**
 * Adjust two adjacent fractions: increase fracs[a] and decrease fracs[b]
 * by `delta`, clamping both to MIN_FRAC.
 */
function adjustFracs(fracs, a, b, delta) {
  let newA = fracs[a] + delta;
  let newB = fracs[b] - delta;

  // Clamp
  if (newA < MIN_FRAC) { newB += (newA - MIN_FRAC); newA = MIN_FRAC; }
  if (newB < MIN_FRAC) { newA += (newB - MIN_FRAC); newB = MIN_FRAC; }

  fracs[a] = newA;
  fracs[b] = newB;
}

/* ── Drag-to-Reposition (swap cells) ──────────────────────── */

function initDrag(cellObj, startX, startY) {
  gridContainer.classList.add("no-transition");
  if (expandState) { colFracs = expandState.savedColFracs; rowFracs = expandState.savedRowFracs; expandState = null; }
  const overlay = createIframeOverlay();
  const header  = cellObj.el.querySelector(".cell-header");

  // Get cell's current bounding rect to position the fixed clone
  const rect = cellObj.el.getBoundingClientRect();
  let dropTarget = null;
  let dragSwapTimeout = null;

  // Capture initial layout and original rects of all cells before any drag transformations
  const initialLayout = new Map();
  const originalRects = new Map();
  for (const c of cellMap) {
    initialLayout.set(c, {
      row: c.row,
      col: c.col,
      colSpan: c.colSpan
    });
    originalRects.set(c, c.el.getBoundingClientRect());
  }

  // Create a placeholder to keep grid structure
  const ghost = document.createElement("div");
  ghost.className = "grid-cell drag-ghost";
  ghost.style.gridColumn = cellObj.el.style.gridColumn;
  ghost.style.gridRow    = cellObj.el.style.gridRow;
  gridContainer.insertBefore(ghost, cellObj.el);

  // Lift the cell out of flow
  cellObj.el.classList.add("dragging");
  cellObj.el.style.left   = rect.left + "px";
  cellObj.el.style.top    = rect.top + "px";
  cellObj.el.style.width  = rect.width + "px";
  cellObj.el.style.height = rect.height + "px";
  if (header) header.classList.add("grabbing");
  document.body.style.cursor = "grabbing";

  function cellUnderPointOriginal(px, py) {
    for (const [c, r] of originalRects) {
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) {
        return c;
      }
    }
    return null;
  }

  function swapPositionsWithAnimation(targetCell) {
    if (dragSwapTimeout) {
      clearTimeout(dragSwapTimeout);
    }

    // 1. Record first positions of all cells (except dragged) and ghost
    const firstRects = new Map();
    for (const c of cellMap) {
      if (c !== cellObj) {
        firstRects.set(c, c.el.getBoundingClientRect());
      }
    }
    const ghostFirst = ghost.getBoundingClientRect();

    // 2. Reset all cells to their initial layout coordinates
    for (const c of cellMap) {
      const init = initialLayout.get(c);
      c.row = init.row;
      c.col = init.col;
      c.colSpan = init.colSpan;
    }

    // 3. Swap coordinates of cellObj and targetCell (if provided)
    if (targetCell) {
      const initA = initialLayout.get(cellObj);
      const initB = initialLayout.get(targetCell);

      cellObj.row = initB.row;
      cellObj.col = initB.col;
      cellObj.colSpan = initB.colSpan;

      targetCell.row = initA.row;
      targetCell.col = initA.col;
      targetCell.colSpan = initA.colSpan;
    }

    // 4. Update DOM placement of ghost and all other cells
    ghost.style.gridColumn = `${cellObj.col + 1} / span ${cellObj.colSpan}`;
    ghost.style.gridRow    = `${cellObj.row + 1}`;
    for (const c of cellMap) {
      if (c !== cellObj) {
        placeCellInGrid(c);
      }
    }

    // 5. Record last positions
    const lastRects = new Map();
    for (const c of cellMap) {
      if (c !== cellObj) {
        lastRects.set(c, c.el.getBoundingClientRect());
      }
    }
    const ghostLast = ghost.getBoundingClientRect();

    // 6. Apply FLIP transition: set to original offsets instantly
    for (const c of cellMap) {
      if (c === cellObj) continue;
      const first = firstRects.get(c);
      const last = lastRects.get(c);
      if (first && last) {
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (dx !== 0 || dy !== 0) {
          c.el.style.transition = 'none';
          c.el.style.transform = `translate(${dx}px, ${dy}px)`;
        }
      }
    }

    const gDx = ghostFirst.left - ghostLast.left;
    const gDy = ghostFirst.top - ghostLast.top;
    if (gDx !== 0 || gDy !== 0) {
      ghost.style.transition = 'none';
      ghost.style.transform = `translate(${gDx}px, ${gDy}px)`;
    }

    // Force layout calculation (reflow) to register the start positions
    gridContainer.offsetHeight;

    // 7. Play: animate back to original layout positions (translate 0)
    for (const c of cellMap) {
      if (c === cellObj) continue;
      const first = firstRects.get(c);
      const last = lastRects.get(c);
      if (first && last) {
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (dx !== 0 || dy !== 0) {
          c.el.style.transition = 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)';
          c.el.style.transform = '';
        }
      }
    }

    if (gDx !== 0 || gDy !== 0) {
      ghost.style.transition = 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      ghost.style.transform = '';
    }

    // Clear styles after transition ends
    dragSwapTimeout = setTimeout(() => {
      for (const c of cellMap) {
        if (c !== cellObj) {
          c.el.style.transition = '';
          c.el.style.transform = '';
        }
      }
      ghost.style.transition = '';
      ghost.style.transform = '';
      dragSwapTimeout = null;
    }, 250);
  }

  function onMove(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    cellObj.el.style.left = (rect.left + dx) + "px";
    cellObj.el.style.top  = (rect.top + dy) + "px";

    // Find drop target under cursor based on original positions
    let newTarget = cellUnderPointOriginal(e.clientX, e.clientY);
    if (newTarget === cellObj) {
      newTarget = null;
    }

    if (newTarget !== dropTarget) {
      swapPositionsWithAnimation(newTarget);
      dropTarget = newTarget;
    }
  }

  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    removeOverlay(overlay);
    gridContainer.classList.remove("no-transition");

    if (header) header.classList.remove("grabbing");
    document.body.style.cursor = "";

    // Clear any pending swap timeout
    if (dragSwapTimeout) {
      clearTimeout(dragSwapTimeout);
      dragSwapTimeout = null;
    }

    // Record first position of dragged cell (which is current cursor position)
    const draggedFirst = cellObj.el.getBoundingClientRect();

    // Remove ghost
    ghost.remove();

    // Clean up dragging and inline placement styles from cellObj.el
    cellObj.el.classList.remove("dragging");
    cellObj.el.style.left = cellObj.el.style.top = cellObj.el.style.width = cellObj.el.style.height = "";

    // Place cell in its final grid slot
    placeCellInGrid(cellObj);

    // Record last position of dragged cell in its grid slot
    const draggedLast = cellObj.el.getBoundingClientRect();

    // Clear temporary inline styles on all cells to prevent lingering transition issues
    cellMap.forEach(c => {
      c.el.style.transition = '';
      c.el.style.transform = '';
    });

    // Apply snap back animation to the dragged cell using FLIP
    const dx = draggedFirst.left - draggedLast.left;
    const dy = draggedFirst.top - draggedLast.top;

    if (dx !== 0 || dy !== 0) {
      cellObj.el.style.transition = 'none';
      cellObj.el.style.transform = `translate(${dx}px, ${dy}px)`;

      // Force style recalculation/reflow
      gridContainer.offsetHeight;

      cellObj.el.style.transition = 'transform 250ms cubic-bezier(0.2, 0.8, 0.2, 1)';
      cellObj.el.style.transform = '';

      // Clean up snap styles after transition
      setTimeout(() => {
        cellObj.el.style.transition = '';
        cellObj.el.style.transform = '';
      }, 250);
    }

    // Update resize handle visibility for all cells
    cellMap.forEach(c => refreshHandles(c));

    // Persist new cell order
    const cellOrder = [...cellMap]
      .sort((a, b) => a.row * cols + a.col - (b.row * cols + b.col))
      .map(c => c.service.id);
    chrome.storage.local.set({ gridLayout: { cols, rows, colFracs, rowFracs, cellOrder } });
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/** Find a cellMap entry whose DOM element contains the given screen point. */
function cellUnderPoint(px, py, exclude) {
  for (const c of cellMap) {
    if (c === exclude) continue;
    const r = c.el.getBoundingClientRect();
    if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) return c;
  }
  return null;
}

/** Refresh which resize handles are enabled/disabled for a cell. */
/** Remove old handles and re-create based on new grid position. */
function refreshHandles(cellObj) {
  cellObj.el.querySelectorAll(".resize-handle").forEach(h => h.remove());
  addResizeHandles(cellObj.el, cellObj);
}

/* ── Hover-to-Expand ────────────────────────────────────────── */

/**
 * Redistribute fracs so the span [startIdx, startIdx+spanLen) reaches
 * expandTarget, stealing proportionally from the other tracks.
 */
function computeExpandedFracs(fracs, startIdx, spanLen, expandTarget) {
  if (fracs.length <= spanLen) return fracs; // only one track — nothing to expand

  const current = fracs.slice(startIdx, startIdx + spanLen).reduce((s, f) => s + f, 0);
  if (current >= expandTarget) return fracs;

  const delta = expandTarget - current;
  const newFracs = [...fracs];

  const otherIdxs = fracs.map((_, i) => i).filter(i => i < startIdx || i >= startIdx + spanLen);
  const otherTotal = otherIdxs.reduce((s, i) => s + fracs[i], 0);
  if (otherTotal <= 0) return fracs;

  // Scale others down proportionally, respecting MIN_FRAC
  otherIdxs.forEach(i => {
    newFracs[i] = Math.max(MIN_FRAC, fracs[i] - (fracs[i] / otherTotal) * delta);
  });

  // Expand the target span, keeping internal proportions
  for (let i = startIdx; i < startIdx + spanLen; i++) {
    newFracs[i] = current > 0 ? fracs[i] * (expandTarget / current) : expandTarget / spanLen;
  }

  return newFracs;
}

function expandCell(cellObj) {
  if (isClosing) return;
  if (expandState) return;
  triggerTransition();
  expandState = {
    savedColFracs: [...colFracs],
    savedRowFracs: [...rowFracs],
    cellObj,
  };
  colFracs = computeExpandedFracs(colFracs, cellObj.col, cellObj.colSpan, HOVER_EXPAND_FRAC);
  rowFracs = computeExpandedFracs(rowFracs, cellObj.row, 1, HOVER_EXPAND_FRAC);
  updateGridTemplate();
}

function collapseCell() {
  if (!expandState) return;
  triggerTransition();
  colFracs = expandState.savedColFracs;
  rowFracs = expandState.savedRowFracs;
  expandState = null;
  updateGridTemplate();
}

/* ── Close Cell & Re-layout ────────────────────────────────── */

function closeCell(cellObj) {
  isClosing = true;
  if (expandState) {
    collapseCell();
  }

  // Smooth fade-out and scale-down before removal
  cellObj.el.style.transition = "opacity 200ms ease, transform 200ms ease";
  cellObj.el.style.opacity = "0";
  cellObj.el.style.transform = "scale(0.95)";

  setTimeout(() => {
    // Remove element from DOM
    cellObj.el.remove();

    // Remove from cellMap
    cellMap = cellMap.filter(c => c !== cellObj);

    const count = cellMap.length;
    if (count === 0) {
      showEmpty("No services to display. Enable some AI services in Settings.");
      return;
    }

    // Compute new grid dimensions
    const logicalCols = Math.min(count, 3);
    rows = Math.ceil(count / logicalCols);

    const lastRowCount = count - logicalCols * (rows - 1);

    if (logicalCols === 3 && lastRowCount === 2) {
      cols = 6;
    } else {
      cols = logicalCols;
    }

    // Reset to equal fractions for the new dimensions
    colFracs = Array(cols).fill(1 / cols);
    rowFracs = Array(rows).fill(1 / rows);

    triggerTransition();
    // Update layout and placement of remaining cells
    updateGridTemplate();

    cellMap.forEach((c, idx) => {
      const row = Math.floor(idx / logicalCols);
      const colIdx = idx % logicalCols;
      const isLastRow = row === rows - 1 && lastRowCount < logicalCols;

      let colStart, colSpan;
      if (cols === 6 && logicalCols === 3) {
        if (isLastRow) {
          colStart = colIdx * 3;
          colSpan = 3;
        } else {
          colStart = colIdx * 2;
          colSpan = 2;
        }
      } else {
        if (isLastRow) {
          const baseSpan = Math.floor(cols / lastRowCount);
          const extra    = cols % lastRowCount;
          const lastIdx  = idx - logicalCols * (rows - 1);
          colStart = 0;
          for (let j = 0; j < lastIdx; j++) {
            colStart += baseSpan + (j < extra ? 1 : 0);
          }
          colSpan = baseSpan + (lastIdx < extra ? 1 : 0);
        } else {
          colStart = colIdx;
          colSpan  = 1;
        }
      }

      c.row = row;
      c.col = colStart;
      c.colSpan = colSpan;
      c.index = idx;

      placeCellInGrid(c);
      refreshHandles(c);
    });

    // Save the updated layout
    const cellOrder = [...cellMap]
      .sort((a, b) => a.row * cols + a.col - (b.row * cols + b.col))
      .map(c => c.service.id);
    chrome.storage.local.set({ gridLayout: { cols, rows, colFracs, rowFracs, cellOrder } });
    isClosing = false;
  }, 200);
}

/* ── Main ──────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  const stored   = await chrome.storage.sync.get("settings");
  const settings = stored.settings || {};
  const theme    = settings.theme || "dark";
  applyTheme(document.documentElement, theme);

  hoverExpand    = settings.hoverExpand !== false;
  hoverExpandMin = settings.hoverExpandMin ?? 2;
  hoverExpandDelay = settings.hoverExpandDelay ?? 0;

  const data     = await chrome.storage.local.get("gridData");
  const gridData = data.gridData;

  if (!gridData || !gridData.targets || gridData.targets.length === 0) {
    showEmpty("No services to display. Enable some AI services in Settings.");
    return;
  }

  const query         = gridData.query || "";
  let   targets       = gridData.targets;
  const autoSubmit    = gridData.autoSubmit;
  const cookieConsent = gridData.cookieConsent || "accept";
  const delayMs       = gridData.delayMs;

  // Initialize header toggle switch state and sync listeners
  const toggleEl = document.getElementById("hoverExpandToggle");
  if (toggleEl) {
    toggleEl.checked = hoverExpand;
    toggleEl.addEventListener("change", async () => {
      const isEnabled = toggleEl.checked;
      hoverExpand = isEnabled;
      if (!isEnabled) {
        collapseCell();
      }

      // Save setting to sync storage
      const stored = await chrome.storage.sync.get("settings");
      const settings = stored.settings || {};
      settings.hoverExpand = isEnabled;
      await chrome.storage.sync.set({ settings });
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
      const newSettings = changes.settings.newValue || {};
      const isEnabled = newSettings.hoverExpand !== false;
      hoverExpand = isEnabled;
      hoverExpandMin = newSettings.hoverExpandMin ?? 2;
      hoverExpandDelay = newSettings.hoverExpandDelay ?? 0;

      const toggleEl = document.getElementById("hoverExpandToggle");
      if (toggleEl && toggleEl.checked !== isEnabled) {
        toggleEl.checked = isEnabled;
      }

      if (!isEnabled) {
        collapseCell();
      }
    }
  });

  gridContainer.addEventListener("transitionend", (e) => {
    if (e.target === gridContainer) {
      gridContainer.classList.remove("transitioning");
      if (transitioningTimeout) {
        clearTimeout(transitioningTimeout);
        transitioningTimeout = null;
      }
    }
  });

  if (query && gridQueryInput) {
    gridQueryInput.value = query;
  }

  // Compute grid dimensions
  const logicalCols = Math.min(targets.length, 3);
  rows = Math.ceil(targets.length / logicalCols);

  const lastRowCount = targets.length - logicalCols * (rows - 1);

  if (logicalCols === 3 && lastRowCount === 2) {
    cols = 6;
  } else {
    cols = logicalCols;
  }

  // Initialize equal fractions
  colFracs = Array(cols).fill(1 / cols);
  rowFracs = Array(rows).fill(1 / rows);

  // Restore saved layout if grid dimensions match
  const savedLayout = await chrome.storage.local.get("gridLayout");
  const saved = savedLayout.gridLayout;
  if (saved && saved.cols === cols && saved.rows === rows &&
      Array.isArray(saved.colFracs) && saved.colFracs.length === cols &&
      Array.isArray(saved.rowFracs) && saved.rowFracs.length === rows) {
    colFracs = saved.colFracs;
    rowFracs = saved.rowFracs;
    // Restore cell order if saved and valid
    if (Array.isArray(saved.cellOrder) && saved.cellOrder.length === targets.length) {
      const byId = Object.fromEntries(targets.map(t => [t.id, t]));
      const reordered = saved.cellOrder.map(id => byId[id]).filter(Boolean);
      if (reordered.length === targets.length) targets = reordered;
    }
  }

  updateGridTemplate();

  const isDark = theme === "dark";
  const iframeLoadPromises = [];

  targets.forEach((service, i) => {
    const row = Math.floor(i / logicalCols);
    const colIdx = i % logicalCols;
    const isLastRow = row === rows - 1 && lastRowCount < logicalCols;

    let colStart, colSpan;
    if (cols === 6 && logicalCols === 3) {
      if (isLastRow) {
        colStart = colIdx * 3;
        colSpan = 3;
      } else {
        colStart = colIdx * 2;
        colSpan = 2;
      }
    } else {
      if (isLastRow) {
        // Distribute last-row cells evenly across all columns
        const baseSpan = Math.floor(cols / lastRowCount);
        const extra    = cols % lastRowCount;
        const lastIdx  = i - logicalCols * (rows - 1);   // index within last row
        // Compute start by summing previous last-row cells' spans
        colStart = 0;
        for (let j = 0; j < lastIdx; j++) {
          colStart += baseSpan + (j < extra ? 1 : 0);
        }
        colSpan = baseSpan + (lastIdx < extra ? 1 : 0);
      } else {
        colStart = colIdx;
        colSpan  = 1;
      }
    }

    const cell = document.createElement("div");
    cell.className = "grid-cell";

    const iconSrc = (isDark && service.iconPathDark) ? service.iconPathDark : service.iconPath;

    // Header bar (drag handle)
    const header = document.createElement("div");
    header.className = "cell-header";
    header.innerHTML = `
      <div class="cell-header-left">
        <img src="../${iconSrc}" alt="${service.name}">
        <span>${service.name}</span>
      </div>
      <div class="cell-header-right">
        <button class="cell-close-btn" title="Close window">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
    header.querySelector(".cell-close-btn").addEventListener("click", () => {
      closeCell(cellObj);
    });

    // Loading indicator
    const loading = document.createElement("div");
    loading.className = "cell-loading";
    loading.innerHTML = `<div class="spinner"></div> Loading ${service.name}\u2026`;

    // Iframe
    const iframe = document.createElement("iframe");
    iframe.className = "cell-iframe";
    iframe.src = service.url;
    iframe.style.display = "none";

    const loadPromise = new Promise((resolve) => {
      let settled = false;
      iframe.addEventListener("load", () => {
        if (settled) return;
        settled = true;
        loading.remove();
        iframe.style.display = "block";
        resolve({ service, ok: true });
      });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        loading.remove();
        iframe.remove();
        showCellError(cell, service);
        resolve({ service, ok: false });
      }, 12000);
    });
    iframeLoadPromises.push(loadPromise);

    cell.appendChild(header);
    cell.appendChild(loading);
    cell.appendChild(iframe);

    const cellObj = { el: cell, row, col: colStart, colSpan, service, index: i };
    cellMap.push(cellObj);

    // Resize handles
    addResizeHandles(cell, cellObj);
    placeCellInGrid(cellObj);
    gridContainer.appendChild(cell);

    // ── Resize binding ──
    cell.addEventListener("mousedown", (e) => {
      const handle = e.target.closest(".resize-handle");
      if (!handle || handle.classList.contains("rh-disabled")) return;
      e.preventDefault();
      initResize(cellObj, handle.dataset.dir, e.clientX, e.clientY);
    });

    // ── Drag binding (header only, excluding buttons) ──
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      initDrag(cellObj, e.clientX, e.clientY);
    });

    // ── Hover-to-expand ──
    if (targets.length >= 2) {
      let hoverTimer = null;

      cell.addEventListener("mouseenter", () => {
        if (isClosing) return;
        if (!hoverExpand || cellMap.length < hoverExpandMin) return;
        if (expandState) return;
        hoverTimer = setTimeout(() => {
          hoverTimer = null;
          expandCell(cellObj);
        }, hoverExpandDelay);
      });

      cell.addEventListener("mouseleave", () => {
        if (hoverTimer) {
          clearTimeout(hoverTimer);
          hoverTimer = null;
        }
        if (expandState && expandState.cellObj === cellObj) {
          collapseCell();
        }
      });
    }
  });

  // Clean up one-time grid data
  await chrome.storage.local.remove("gridData");

  // Wait for all iframes
  const loadResults  = await Promise.all(iframeLoadPromises);
  const loadedTargets = loadResults.filter(r => r.ok).map(r => r.service);

  if (loadedTargets.length === 0) {
    console.warn("[Puchne Grid] No iframes loaded successfully.");
    return;
  }

  const tab = await chrome.tabs.getCurrent();
  if (!tab) return;

  console.log(`[Puchne Grid] Requesting injection for ${loadedTargets.length} frames...`);
  chrome.runtime.sendMessage(
    { action: "injectGridQueries", tabId: tab.id, targets: loadedTargets, query, autoSubmit, cookieConsent, delayMs },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Puchne Grid] Injection request failed:", chrome.runtime.lastError.message);
      } else {
        console.log("[Puchne Grid] Injection results:", response);
      }
    }
  );

  if (gridQueryForm) {
    gridQueryForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const newQuery = gridQueryInput.value.trim();
      if (!newQuery) return;
      
      console.log(`[Puchne Grid] Requesting follow-up injection for ${loadedTargets.length} frames...`);
      // We pass delayMs: 0 since the pages are already fully loaded
      chrome.runtime.sendMessage(
        { action: "injectGridQueries", tabId: tab.id, targets: loadedTargets, query: newQuery, autoSubmit: true, cookieConsent: "off", delayMs: 0 },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Puchne Grid] Follow-up injection request failed:", chrome.runtime.lastError.message);
          } else {
            console.log("[Puchne Grid] Follow-up injection results:", response);
          }
        }
      );
    });
  }
});

/* ── Utility Functions ─────────────────────────────────────── */

function showEmpty(message) {
  gridContainer.innerHTML = `
    <div class="grid-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
      <p>${message}</p>
    </div>`;
}

function showCellError(cell, service) {
  const error = document.createElement("div");
  error.className = "cell-error";
  error.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
    <p>${service.name} could not be embedded.<br>Try opening it in a separate tab.</p>
    <a class="open-link" href="${service.url}" target="_blank">Open ${service.name} \u2197</a>
  `;
  cell.appendChild(error);
}
