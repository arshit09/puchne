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
 *    - Close a cell, and re-open it again from the Closed menu
 *    - Reset layout, double-click a header to maximize one cell
 *    - Alt + 1..9 to jump between cells
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
let cellMap   = [];   // [{ el, iframe, row, col, colSpan, service, index }]

const MIN_FRAC = 0.10; // minimum fraction for any track (10%)

/* ── Session State ─────────────────────────────────────────── */
let closedServices = [];  // services the user closed, in close order
let loadedTargets  = [];  // services whose iframe actually embedded
let maximizedCell  = null;
let selfTabId      = null;
let lastQuery      = "";
let sendConfig     = { autoSubmit: true, cookieConsent: "accept", delayMs: undefined };

/* ── Hover-to-Expand State ─────────────────────────────────── */
// Expanding relayouts every iframe, so a dwell is required by default:
// a cursor crossing the grid must not trigger a cascade of reflows.
const HOVER_EXPAND_DELAY_DEFAULT = 200;
let hoverExpandDelay = HOVER_EXPAND_DELAY_DEFAULT;  // ms of dwell before expanding
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

/**
 * Grid dimensions for `count` cells: at most three logical columns, and a
 * six-column track when the last row holds two of three so those two can
 * each span three and stay centred.
 */
function computeLayout(count) {
  const logicalCols = Math.min(count, 3);
  const rowCount = Math.ceil(count / logicalCols);
  const lastRowCount = count - logicalCols * (rowCount - 1);
  const colCount = (logicalCols === 3 && lastRowCount === 2) ? 6 : logicalCols;
  return { logicalCols, rows: rowCount, cols: colCount, lastRowCount };
}

/**
 * Where the cell at `idx` sits under a given layout. Cells in a short last
 * row are stretched to fill the width instead of leaving a hole.
 */
function placementFor(idx, layout) {
  const { logicalCols, rows: rowCount, cols: colCount, lastRowCount } = layout;
  const row = Math.floor(idx / logicalCols);
  const colIdx = idx % logicalCols;
  const isLastRow = row === rowCount - 1 && lastRowCount < logicalCols;

  if (colCount === 6 && logicalCols === 3) {
    return isLastRow
      ? { row, col: colIdx * 3, colSpan: 3 }
      : { row, col: colIdx * 2, colSpan: 2 };
  }

  if (!isLastRow) return { row, col: colIdx, colSpan: 1 };

  // Distribute the short last row evenly across all columns
  const baseSpan = Math.floor(colCount / lastRowCount);
  const extra    = colCount % lastRowCount;
  const lastIdx  = idx - logicalCols * (rowCount - 1);
  let colStart = 0;
  for (let j = 0; j < lastIdx; j++) {
    colStart += baseSpan + (j < extra ? 1 : 0);
  }
  return { row, col: colStart, colSpan: baseSpan + (lastIdx < extra ? 1 : 0) };
}

/**
 * Re-places every cell for the current cellMap length. The single place
 * that knows how cells map onto tracks — initial render, close, restore
 * and reset all go through here.
 *
 * @param {{resetFracs?: boolean, animate?: boolean}} [opts]
 */
function applyLayout({ resetFracs = true, animate = false } = {}) {
  if (cellMap.length === 0) {
    showEmpty("No services to display. Enable some AI services in Settings.");
    updateClosedMenu();
    return;
  }

  restoreMaximize();
  // A previous empty state may still be occupying the container.
  gridContainer.querySelector(".grid-empty")?.remove();

  const layout = computeLayout(cellMap.length);
  cols = layout.cols;
  rows = layout.rows;

  if (resetFracs) {
    colFracs = Array(cols).fill(1 / cols);
    rowFracs = Array(rows).fill(1 / rows);
  }

  if (animate) triggerTransition();
  updateGridTemplate();

  cellMap.forEach((c, idx) => {
    const p = placementFor(idx, layout);
    c.row = p.row;
    c.col = p.col;
    c.colSpan = p.colSpan;
    c.index = idx;
    placeCellInGrid(c);
    refreshHandles(c);
  });

  saveLayout();
  updateClosedMenu();
}

function saveLayout() {
  const cellOrder = [...cellMap]
    .sort((a, b) => a.row * cols + a.col - (b.row * cols + b.col))
    .map(c => c.service.id);
  chrome.storage.local.set({ gridLayout: { cols, rows, colFracs, rowFracs, cellOrder } });
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

  // Also highlight this cell's SE dot at the intersection if it exists
  if (dir === "s" || dir === "e") {
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

/** Remove old handles and re-create based on new grid position. */
function refreshHandles(cellObj) {
  cellObj.el.querySelectorAll(".resize-handle").forEach(h => h.remove());
  addResizeHandles(cellObj.el, cellObj);
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
    saveLayout();
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

    // Keep cellMap ordered by on-screen position so index-based features
    // (Alt+1..9, layout recomputes) stay in sync with what the user sees.
    cellMap.sort((a, b) => (a.row * cols + a.col) - (b.row * cols + b.col));
    cellMap.forEach((c, idx) => { c.index = idx; });

    // Update resize handle visibility for all cells
    cellMap.forEach(c => refreshHandles(c));

    saveLayout();
  }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
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
  if (isClosing || maximizedCell) return;
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

/* ── Maximize a single cell ────────────────────────────────── */

/**
 * Double-clicking a header blows one cell up to the full grid; doing it
 * again (or pressing Escape) puts everything back. The other cells are
 * only hidden, never unmounted, so their conversations survive.
 */
function toggleMaximize(cellObj) {
  if (maximizedCell === cellObj) {
    restoreMaximize();
    return;
  }
  collapseCell();
  maximizedCell = cellObj;
  gridContainer.classList.add("has-maximized");
  cellMap.forEach(c => c.el.classList.toggle("maximized", c === cellObj));
}

function restoreMaximize() {
  if (!maximizedCell) return;
  maximizedCell = null;
  gridContainer.classList.remove("has-maximized");
  cellMap.forEach(c => c.el.classList.remove("maximized"));
}

/* ── Keyboard cell switching ───────────────────────────────── */

/**
 * Focuses the nth cell: scrolls it into view, flashes a ring, and hands
 * keyboard focus to its iframe. If a cell is maximized, switches which one.
 * @param {number} n — 1-based cell number
 */
function focusCellByNumber(n) {
  const cellObj = cellMap[n - 1];
  if (!cellObj) return;

  if (maximizedCell) toggleMaximize(cellObj);

  cellObj.el.scrollIntoView({ block: "nearest", inline: "nearest" });
  cellObj.el.classList.remove("cell-flash");
  void cellObj.el.offsetWidth; // restart the animation if it is already running
  cellObj.el.classList.add("cell-flash");
  cellObj.el.addEventListener("animationend", () => {
    cellObj.el.classList.remove("cell-flash");
  }, { once: true });

  cellObj.iframe?.focus();
}

/**
 * Alt+1..9 jumps between cells. Ctrl is deliberately not bound: Chrome
 * reserves Ctrl+1..9 for tab switching and consumes it before a page can
 * see it, so binding it would only ever be dead code.
 *
 * This fires only while focus is in the grid's own chrome — keystrokes
 * inside a cross-origin iframe never reach this document.
 */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && maximizedCell) {
    restoreMaximize();
    return;
  }

  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (e.key < "1" || e.key > "9") return;

  const n = Number(e.key);
  if (n > cellMap.length) return;
  e.preventDefault();
  focusCellByNumber(n);
});

/* ── Cell Construction ─────────────────────────────────────── */

/**
 * Builds one grid cell (header, loading state, iframe) and wires its
 * interactions. Used by the first render and by re-opening a closed cell.
 *
 * @param {Object} service
 * @param {{delay?: number, isDark: boolean}} opts
 * @returns {{cellObj: object, loadPromise: Promise<{service: object, ok: boolean}>}}
 */
function createCell(service, { delay = 0, isDark }) {
  const cell = document.createElement("div");
  cell.className = "grid-cell";

  const iconSrc = (isDark && service.iconPathDark) ? service.iconPathDark : service.iconPath;

  // Header bar (drag handle)
  const header = document.createElement("div");
  header.className = "cell-header";
  header.title = "Drag to move · double-click to maximize";
  header.innerHTML = `
    <div class="cell-header-left">
      <img src="../${iconSrc}" alt="${service.name}">
      <span>${service.name}</span>
    </div>
    <div class="cell-header-right">
      <button class="cell-icon-btn cell-max-btn" title="Maximize / restore this cell">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
        </svg>
      </button>
      <button class="cell-icon-btn cell-close-btn" title="Close window">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
  `;

  // Loading indicator
  const loading = document.createElement("div");
  loading.className = "cell-loading";
  loading.innerHTML = `<div class="spinner"></div> Loading ${service.name}…`;

  // Iframe
  const iframe = document.createElement("iframe");
  iframe.className = "cell-iframe";
  iframe.title = service.name;
  iframe.style.display = "none";

  cell.appendChild(header);
  cell.appendChild(loading);
  cell.appendChild(iframe);

  const cellObj = { el: cell, iframe, row: 0, col: 0, colSpan: 1, service, index: 0 };

  header.querySelector(".cell-close-btn").addEventListener("click", () => closeCell(cellObj));
  header.querySelector(".cell-max-btn").addEventListener("click", () => toggleMaximize(cellObj));
  header.addEventListener("dblclick", (e) => {
    if (e.target.closest("button")) return;
    toggleMaximize(cellObj);
  });

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
    if (maximizedCell) return; // nothing to rearrange while one cell owns the grid
    e.preventDefault();
    initDrag(cellObj, e.clientX, e.clientY);
  });

  // ── Hover-to-expand ──
  let hoverTimer = null;
  cell.addEventListener("mouseenter", () => {
    if (isClosing || maximizedCell) return;
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

  // Booting every SPA in the same instant is the jankiest moment in the
  // grid, so navigations are staggered. The load timeout starts when the
  // navigation does, not when the cell is built.
  const loadPromise = new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;

    iframe.addEventListener("load", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      loading.remove();
      iframe.style.display = "block";
      resolve({ service, ok: true });
    });

    setTimeout(() => {
      if (settled) return;
      // Cell was closed before its turn to load — nothing to navigate.
      if (!cell.isConnected) {
        settled = true;
        resolve({ service, ok: false });
        return;
      }
      iframe.src = service.url;
      timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        loading.remove();
        iframe.remove();
        showCellError(cell, service);
        resolve({ service, ok: false });
      }, 12000);
    }, delay);
  });

  return { cellObj, loadPromise };
}

/* ── Close & Re-open Cells ─────────────────────────────────── */

function closeCell(cellObj) {
  isClosing = true;
  restoreMaximize();
  if (expandState) {
    collapseCell();
  }

  // Smooth fade-out and scale-down before removal
  cellObj.el.style.transition = "opacity 200ms ease, transform 200ms ease";
  cellObj.el.style.opacity = "0";
  cellObj.el.style.transform = "scale(0.95)";

  setTimeout(() => {
    cellObj.el.remove();
    cellMap = cellMap.filter(c => c !== cellObj);
    loadedTargets = loadedTargets.filter(s => s.id !== cellObj.service.id);

    // Remembered so it can be re-opened from the Closed menu.
    if (!closedServices.some(s => s.id === cellObj.service.id)) {
      closedServices.push(cellObj.service);
    }

    applyLayout({ animate: true });
    isClosing = false;
  }, 200);
}

/**
 * Builds a cell for a previously closed service and attaches it. The caller
 * runs applyLayout once afterwards, so restoring several at a time costs one
 * relayout rather than one per cell.
 * @returns {Promise<{service: object, ok: boolean}>} the iframe load result
 */
function mountService(service, delay = 0) {
  closedServices = closedServices.filter(s => s.id !== service.id);

  const isDark = document.documentElement.dataset.theme === "dark";
  const { cellObj, loadPromise } = createCell(service, { delay, isDark });
  cellMap.push(cellObj);
  gridContainer.appendChild(cellObj.el);
  return loadPromise;
}

/**
 * Once a restored cell has loaded, sends it the prompt the other cells got,
 * so re-opening a cell brings back its context instead of a blank chat.
 */
async function injectRestored(loadPromise) {
  const result = await loadPromise;
  if (!result.ok || !lastQuery) return;

  loadedTargets.push(result.service);
  chrome.runtime.sendMessage({
    action: "injectGridQueries",
    tabId: selfTabId,
    targets: [result.service],
    query: lastQuery,
    autoSubmit: sendConfig.autoSubmit,
    cookieConsent: sendConfig.cookieConsent,
    delayMs: sendConfig.delayMs,
  }, () => void chrome.runtime.lastError);
}

/** Re-opens one closed cell from the Closed menu. */
async function reopenService(service) {
  const loadPromise = mountService(service);
  applyLayout({ animate: true });
  await injectRestored(loadPromise);
}

/**
 * Resets the grid to an even layout, restoring every closed cell first.
 * The cells are mounted and laid out immediately — the reset is visible at
 * once rather than after every restored iframe has finished loading.
 */
async function resetLayout() {
  restoreMaximize();
  collapseCell();

  const loadPromises = [...closedServices].map((service, i) =>
    mountService(service, i * GRID_STAGGER_MS)
  );
  applyLayout({ resetFracs: true, animate: true });

  await Promise.all(loadPromises.map(injectRestored));
}

/* ── Closed-cells menu ─────────────────────────────────────── */

function updateClosedMenu() {
  const wrap  = document.getElementById("closedMenu");
  const count = document.getElementById("closedCount");
  const list  = document.getElementById("closedList");
  if (!wrap || !count || !list) return;

  wrap.hidden = closedServices.length === 0;
  if (closedServices.length === 0) {
    wrap.classList.remove("open");
    return;
  }

  count.textContent = String(closedServices.length);
  list.innerHTML = "";

  const isDark = document.documentElement.dataset.theme === "dark";
  closedServices.forEach((service) => {
    const item = document.createElement("button");
    item.className = "grid-menu-item";
    const icon = (isDark && service.iconPathDark) ? service.iconPathDark : service.iconPath;
    item.innerHTML = `<img src="../${icon}" alt=""><span>${service.name}</span>`;
    item.addEventListener("click", () => {
      wrap.classList.remove("open");
      reopenService(service);
    });
    list.appendChild(item);
  });
}

/**
 * Reads this tab's grid payload. The background writes the key right after
 * creating the tab, so on a cold open it may not have landed yet — wait for
 * it instead of giving up. On a reload the key is already there and this
 * resolves immediately, which is what makes refresh re-render the layout.
 * @param {number} tabId
 * @returns {Promise<object|null>}
 */
async function readGridData(tabId) {
  const key    = `${GRID_DATA_PREFIX}${tabId}`;
  const stored = await chrome.storage.local.get(key);
  if (stored[key]) return stored[key];

  return new Promise((resolve) => {
    const done = (value) => {
      chrome.storage.onChanged.removeListener(onChanged);
      clearTimeout(timer);
      resolve(value);
    };
    const onChanged = (changes, area) => {
      if (area === "local" && changes[key]?.newValue) done(changes[key].newValue);
    };
    const timer = setTimeout(() => done(null), GRID_DATA_WAIT_MS);
    chrome.storage.onChanged.addListener(onChanged);
  });
}

/* ── Main ──────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  const stored   = await chrome.storage.sync.get("settings");
  const settings = stored.settings || {};
  const theme    = settings.theme || "dark";
  applyTheme(document.documentElement, theme);

  hoverExpand    = settings.hoverExpand !== false;
  hoverExpandMin = settings.hoverExpandMin ?? 2;
  hoverExpandDelay = settings.hoverExpandDelay ?? HOVER_EXPAND_DELAY_DEFAULT;

  if (settings.showFollowUpInput === false && gridQueryForm) {
    gridQueryForm.style.display = "none";
  }

  const selfTab  = await chrome.tabs.getCurrent();
  selfTabId = selfTab?.id ?? null;
  const gridData = selfTab ? await readGridData(selfTab.id) : null;

  if (!gridData || !gridData.targets || gridData.targets.length === 0) {
    showEmpty("No services to display. Enable some AI services in Settings.");
    return;
  }

  lastQuery  = gridData.query || "";
  sendConfig = {
    autoSubmit: gridData.autoSubmit,
    cookieConsent: gridData.cookieConsent || "accept",
    delayMs: gridData.delayMs,
  };
  let targets = gridData.targets;

  initHeaderControls();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
      const newSettings = changes.settings.newValue || {};
      const isEnabled = newSettings.hoverExpand !== false;
      hoverExpand = isEnabled;
      hoverExpandMin = newSettings.hoverExpandMin ?? 2;
      hoverExpandDelay = newSettings.hoverExpandDelay ?? HOVER_EXPAND_DELAY_DEFAULT;

      const toggleEl = document.getElementById("hoverExpandToggle");
      if (toggleEl && toggleEl.checked !== isEnabled) {
        toggleEl.checked = isEnabled;
      }

      if (!isEnabled) {
        collapseCell();
      }

      if (gridQueryForm) {
        gridQueryForm.style.display = newSettings.showFollowUpInput === false ? "none" : "";
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

  // Restore a saved layout when it still fits this many services
  const layout = computeLayout(targets.length);
  cols = layout.cols;
  rows = layout.rows;
  colFracs = Array(cols).fill(1 / cols);
  rowFracs = Array(rows).fill(1 / rows);

  const savedLayout = await chrome.storage.local.get("gridLayout");
  const saved = savedLayout.gridLayout;
  let keepFracs = false;
  if (saved && saved.cols === cols && saved.rows === rows &&
      Array.isArray(saved.colFracs) && saved.colFracs.length === cols &&
      Array.isArray(saved.rowFracs) && saved.rowFracs.length === rows) {
    colFracs = saved.colFracs;
    rowFracs = saved.rowFracs;
    keepFracs = true;
    if (Array.isArray(saved.cellOrder) && saved.cellOrder.length === targets.length) {
      const byId = Object.fromEntries(targets.map(t => [t.id, t]));
      const reordered = saved.cellOrder.map(id => byId[id]).filter(Boolean);
      if (reordered.length === targets.length) targets = reordered;
    }
  }

  const isDark = theme === "dark";
  const iframeLoadPromises = [];

  targets.forEach((service, i) => {
    const { cellObj, loadPromise } = createCell(service, { delay: i * GRID_STAGGER_MS, isDark });
    cellMap.push(cellObj);
    gridContainer.appendChild(cellObj.el);
    iframeLoadPromises.push(loadPromise);
  });

  applyLayout({ resetFracs: !keepFracs });

  // Wait for all iframes
  const loadResults = await Promise.all(iframeLoadPromises);
  loadedTargets = loadResults.filter(r => r.ok).map(r => r.service);
  const failedIds = loadResults.filter(r => !r.ok).map(r => r.service.id);

  if (loadedTargets.length === 0) {
    console.warn("[Puchne Grid] No iframes loaded successfully.");
    // Still report the failures so the delivery status isn't stuck on pending.
    chrome.runtime.sendMessage(
      { action: "injectGridQueries", tabId: selfTabId, targets: [], query: lastQuery, failedIds },
      () => void chrome.runtime.lastError
    );
    return;
  }

  console.log(`[Puchne Grid] Requesting injection for ${loadedTargets.length} frames...`);
  chrome.runtime.sendMessage(
    {
      action: "injectGridQueries",
      tabId: selfTabId,
      targets: loadedTargets,
      query: lastQuery,
      autoSubmit: sendConfig.autoSubmit,
      cookieConsent: sendConfig.cookieConsent,
      delayMs: sendConfig.delayMs,
      failedIds,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Puchne Grid] Injection request failed:", chrome.runtime.lastError.message);
      } else {
        console.log("[Puchne Grid] Injection results:", response);
      }
    }
  );

  if (gridQueryForm) {
    const submitFollowUp = () => {
      const newQuery = gridQueryInput.value.trim();
      if (!newQuery) return;

      gridQueryInput.value = "";
      lastQuery = newQuery;

      console.log(`[Puchne Grid] Requesting follow-up injection for ${loadedTargets.length} frames...`);
      chrome.runtime.sendMessage(
        {
          action: "injectGridQueries",
          tabId: selfTabId,
          targets: loadedTargets,
          query: newQuery,
          autoSubmit: sendConfig.autoSubmit,
          cookieConsent: "off",
          delayMs: 0,
          followUp: true,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("[Puchne Grid] Follow-up injection request failed:", chrome.runtime.lastError.message);
          } else {
            console.log("[Puchne Grid] Follow-up injection results:", response);
          }
        }
      );
    };

    // Enter submits; Shift+Enter inserts a newline
    gridQueryInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitFollowUp();
      }
    });

    // Keep form submit working for any other trigger (e.g. the send button)
    gridQueryForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitFollowUp();
    });
  }
});

/* ── Header Controls ───────────────────────────────────────── */

function initHeaderControls() {
  const toggleEl = document.getElementById("hoverExpandToggle");
  if (toggleEl) {
    toggleEl.checked = hoverExpand;
    toggleEl.addEventListener("change", async () => {
      const isEnabled = toggleEl.checked;
      hoverExpand = isEnabled;
      if (!isEnabled) collapseCell();

      const stored = await chrome.storage.sync.get("settings");
      const settings = stored.settings || {};
      settings.hoverExpand = isEnabled;
      await chrome.storage.sync.set({ settings });
    });
  }

  document.getElementById("resetLayoutBtn")?.addEventListener("click", resetLayout);

  const closedMenu = document.getElementById("closedMenu");
  document.getElementById("closedTrigger")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closedMenu.classList.toggle("open");
  });
  window.addEventListener("click", () => closedMenu?.classList.remove("open"));

  updateClosedMenu();
}

/* ── Follow-up Input Focus Guard ───────────────────────────── */
/*
 * Injecting a prompt focuses the editor inside each iframe, which
 * steals focus from the follow-up input while the user is typing.
 * If focus jumps to an iframe and the user didn't deliberately
 * click into a cell (pointer outside the grid, or they were typing
 * a moment ago), give focus back to the input.
 */
let pointerInGrid = false;
let lastInputTypeTs = 0;

gridContainer.addEventListener("mouseenter", () => { pointerInGrid = true; });
gridContainer.addEventListener("mouseleave", () => { pointerInGrid = false; });

if (gridQueryInput) {
  gridQueryInput.addEventListener("input", () => { lastInputTypeTs = Date.now(); });

  gridQueryInput.addEventListener("blur", () => {
    // Let the browser settle on the new focus target first
    setTimeout(() => {
      if (document.activeElement?.tagName !== "IFRAME") return;
      const typedRecently = Date.now() - lastInputTypeTs < 1000;
      if (!pointerInGrid || typedRecently) {
        gridQueryInput.focus();
      }
    }, 0);
  });
}

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
    <a class="open-link" href="${service.url}" target="_blank">Open ${service.name} ↗</a>
  `;
  cell.appendChild(error);
}
