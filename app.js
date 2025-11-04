// ---------- Tab navigation ----------
const ALL_TABS = ["about","contents","learn","quotes"];
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
function activate(targetId) {
  tabs.forEach(t => {
    const active = t.dataset.target === targetId;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", String(active));
  });
  panels.forEach(p => p.classList.toggle("active", p.id === targetId));
  localStorage.setItem("lastTab", targetId);
  if (location.hash.replace("#", "") !== targetId) {
    history.replaceState(null, "", "#" + targetId);
  }
}
tabs.forEach(btn => btn.addEventListener("click", () => activate(btn.dataset.target)));
async function loadDefaultsFromFiles() {
  // Only load defaults if the viewer has no local data yet
  const hasTimeline  = !!localStorage.getItem('timelineData_v2');
  const hasQuotes    = !!localStorage.getItem('quotes_v1');
  const hasFlash     = !!localStorage.getItem('flashcards_v1');

  if (hasTimeline && hasQuotes && hasFlash) return;

  // Small helper
  const fetchJSON = async (path) => {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  // Fetch files (with cache-busting query just in case)
  const [tl, q, fc] = await Promise.all([
    hasTimeline ? null : fetchJSON('timeline.json?v=1'),
    hasQuotes   ? null : fetchJSON('quotes.json?v=1'),
    hasFlash    ? null : fetchJSON('flashcards.json?v=1'),
  ]);

  // Seed timeline
  if (tl && Array.isArray(tl)) {
    // ensure each item has an id
    timelineData = tl.map(i => i?.id ? i : ({ ...i, id: uid() }));
    saveData?.();
  }

  // Seed quotes (if your code defines `quotes`, `saveQuotes`, `renderQuotes`)
  if (q && Array.isArray(q)) {
    if (typeof quotes !== 'undefined') {
      quotes = q;
      saveQuotes?.();
    }
  }

  // Seed flashcards (if your code defines `flashcards`, `saveFlashcards`, `renderCards`)
  if (fc && Array.isArray(fc)) {
    if (typeof flashcards !== 'undefined') {
      flashcards = fc;
      saveFlashcards?.();
    }
  }

  // Re-render UI after seeding
  try {
    buildYearOptions?.(timelineData);
    renderTimeline?.();
    renderQuotes?.();
    renderCards?.();
  } catch {}
}
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("yearNow").textContent = new Date().getFullYear();
  const fromHash = location.hash?.replace("#", "");
  const saved = localStorage.getItem("lastTab") || "about";
  const initial = ["about", "contents", "learn", "quotes"].includes(fromHash) ? fromHash : saved;
  activate(initial);
  initData();
  buildYearOptions(timelineData);
  renderTimeline();
});

// ---------- Data + persistence ----------
const STORAGE_KEY = "timelineData_v2"; // bump key due to new fields
let timelineData = [];

function initData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { timelineData = JSON.parse(stored); }
    catch { timelineData = []; }
  }
  if (!Array.isArray(timelineData) || timelineData.length === 0) {
    timelineData = [
      { id: uid(), date: "2025-10-20", title: "Kickoff", text: "Started the project and drafted structure.", tags: ["milestone"] },
      { id: uid(), date: "2025-10-21", title: "Design pass", text: "Chose colors, built base components.", tags: ["design"] },
      { id: uid(), date: "2025-10-23", title: "Interactive tabs", text: "Implemented tabs, timeline, sorting, filters, and now edit/delete.", tags: ["feature"] },
    ];
    saveData();
  } else {
    // Ensure pre-existing items get an id
    timelineData = timelineData.map(i => i.id ? i : ({ ...i, id: uid() }));
    saveData();
  }
}
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timelineData));
}
function uid() {
  return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

// ---------- DOM refs ----------
const timelineEl = document.getElementById("timeline");
const sortOrderEl = document.getElementById("sortOrder");
const yearFilterEl = document.getElementById("yearFilter");
const searchBoxEl = document.getElementById("searchBox");

// Editor refs
const editorForm = document.getElementById("editorForm");
const dateInput = document.getElementById("dateInput");
const titleInput = document.getElementById("titleInput");
const textInput = document.getElementById("textInput");
const tagsInput = document.getElementById("tagsInput");
const editorMsg = document.getElementById("editorMsg");

// ---------- Helpers ----------
function buildYearOptions(items) {
  const years = Array.from(new Set(items.map(i => i.date.slice(0,4)))).sort((a,b)=>b.localeCompare(a));
  yearFilterEl.innerHTML = '<option value="all" selected>All</option>' +
    years.map(y => `<option value="${y}">${y}</option>`).join("");
}
function parseISO(d){ const [y,m,da] = d.split("-").map(Number); return new Date(y, m-1, da); }
function isValidISODate(d){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const dt = parseISO(d);
  return dt instanceof Date && !isNaN(dt.getTime());
}
function escapeHTML(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

// ---------- Render ----------
function renderTimeline() {
  let items = [...timelineData];

  // year filter
  const yf = yearFilterEl.value || "all";
  if (yf !== "all") items = items.filter(i => i.date.startsWith(yf + "-"));

  // search filter
  const q = (searchBoxEl.value || "").trim().toLowerCase();
  if (q) {
    items = items.filter(i => {
      const hay = [
        i.title, i.text,
        (i.tags||[]).join(" "),
        i.date
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  // sort
  const order = sortOrderEl.value || "desc";
  items.sort((a, b) => {
    const da = parseISO(a.date).getTime();
    const db = parseISO(b.date).getTime();
    return order === "asc" ? da - db : db - da;
  });

  // render each item (with action buttons)
  timelineEl.innerHTML = items.map(i => renderItemHTML(i)).join("");
}

// Build HTML for a single item (view mode)
function renderItemHTML(i){
  const tags = (i.tags || []).map(t => `<span class="badge">${escapeHTML(t)}</span>`).join("");
  return `
    <li data-id="${i.id}">
      <article class="entry">
        <div class="entry-header">
          <div>
            <time datetime="${i.date}">${i.date}</time> ${tags}
            <h3>${escapeHTML(i.title)}</h3>
          </div>
          <div class="entry-actions">
            <button class="btn-sm" data-action="edit">Edit</button>
            <button class="btn-sm btn-danger" data-action="delete">Delete</button>
          </div>
        </div>
        <p>${escapeHTML(i.text)}</p>
      </article>
    </li>`;
}

// ---------- Events for filters/search ----------
sortOrderEl.addEventListener("change", renderTimeline);
yearFilterEl.addEventListener("change", renderTimeline);
searchBoxEl.addEventListener("input", renderTimeline);

// ---------- Add new item (top editor) ----------
editorForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const date = (dateInput.value || "").trim();
  const title = (titleInput.value || "").trim();
  const text = (textInput.value || "").trim();
  const tags = (tagsInput.value || "").split(",").map(t => t.trim()).filter(Boolean);

  if (!isValidISODate(date)) {
    editorMsg.textContent = "Please provide a valid date (YYYY-MM-DD).";
    return;
  }
  if (!title || !text) {
    editorMsg.textContent = "Title and text are required.";
    return;
  }

  timelineData.push({ id: uid(), date, title, text, tags });
  saveData();
  buildYearOptions(timelineData);
  renderTimeline();

  editorForm.reset();
  editorMsg.textContent = "Entry added.";
  setTimeout(()=> editorMsg.textContent = "", 1500);
});

// ---------- Inline Edit/Delete via event delegation ----------
timelineEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const li = e.target.closest("li[data-id]");
  if (!li) return;
  const id = li.getAttribute("data-id");
  const itemIndex = timelineData.findIndex(x => x.id === id);
  if (itemIndex === -1) return;

  const action = btn.getAttribute("data-action");

  if (action === "delete") {
    const ok = confirm("Delete this entry?");
    if (!ok) return;
    timelineData.splice(itemIndex, 1);
    saveData();
    buildYearOptions(timelineData);
    renderTimeline();
    return;
  }

  if (action === "edit") {
    // Replace the entry content with an inline form
    const item = timelineData[itemIndex];
    li.innerHTML = renderEditFormHTML(item);
    return;
  }

  if (action === "cancel-edit") {
    // Re-render original
    const item = timelineData[itemIndex];
    li.innerHTML = renderItemHTML(item);
    return;
  }

  if (action === "save-edit") {
    // Collect values from inline form
    const date = li.querySelector('[name="date"]').value.trim();
    const title = li.querySelector('[name="title"]').value.trim();
    const text = li.querySelector('[name="text"]').value.trim();
    const tagsRaw = li.querySelector('[name="tags"]').value.trim();
    const tags = tagsRaw ? tagsRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

    const status = li.querySelector('.edit-status');

    if (!isValidISODate(date)) {
      status.textContent = "Please use YYYY-MM-DD.";
      return;
    }
    if (!title || !text) {
      status.textContent = "Title and text are required.";
      return;
    }

    // Update item (allow any date — past or future)
    timelineData[itemIndex] = { ...timelineData[itemIndex], date, title, text, tags };
    saveData();
    // Re-render whole list to reflect sort changes if date changed
    renderTimeline();
    return;
  }
});

// Build inline editor form HTML
function renderEditFormHTML(item){
  const tagsStr = (item.tags || []).join(", ");
  return `
    <article class="entry">
      <div class="entry-header">
        <strong>Edit entry</strong>
        <div class="entry-actions">
          <button class="btn-sm" data-action="save-edit">Save</button>
          <button class="btn-sm btn-danger" data-action="cancel-edit">Cancel</button>
        </div>
      </div>

      <div class="inline-form">
        <div class="inline-row">
          <label>Date
            <input class="input" name="date" type="date" value="${item.date}" required />
          </label>
          <label>Title
            <input class="input" name="title" type="text" value="${escapeAttr(item.title)}" required />
          </label>
        </div>
        <label>Text
          <textarea class="textarea" name="text" rows="3" required>${escapeHTML(item.text)}</textarea>
        </label>
        <label>Tags (comma-separated)
          <input class="input" name="tags" type="text" value="${escapeAttr(tagsStr)}" />
        </label>
        <div class="inline-actions">
          <span class="muted small edit-status" role="status" aria-live="polite"></span>
        </div>
      </div>
    </article>
  `;
}
function escapeAttr(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;");
}

// Optional: expose helpers in console
window.addTimelineItem = function({date, title, text, tags=[]}){
  if (!isValidISODate(date)) throw new Error("Invalid date (YYYY-MM-DD).");
  timelineData.push({ id: uid(), date, title, text, tags });
  saveData();
  buildYearOptions(timelineData);
  renderTimeline();
  return "Added timeline item.";
};
/* =========================
   FLASHCARDS (Learn with me)
   ========================= */
const FLASH_KEY = "flashcards_v1";
let flashcards = [];

const cardsGrid = document.getElementById("cardsGrid");
const cardForm = document.getElementById("cardForm");
const cardTerm = document.getElementById("cardTerm");
const cardDef  = document.getElementById("cardDef");
const cardMsg  = document.getElementById("cardMsg");
const cardId   = document.getElementById("cardId");
const seed20Btn = document.getElementById("seed20Btn");

// Load / save
function loadFlashcards(){
  try{ flashcards = JSON.parse(localStorage.getItem(FLASH_KEY) || "[]"); }
  catch{ flashcards = []; }
}
function saveFlashcards(){
  localStorage.setItem(FLASH_KEY, JSON.stringify(flashcards));
}

// Render grid
function renderCards(){
  if(!cardsGrid) return;
  const html = flashcards.map(c => cardHTML(c)).join("") || emptyCardsHTML();
  cardsGrid.innerHTML = html;
}
function cardHTML(c){
  const empty = (!c.term && !c.def);
  return `
    <li class="card3d ${empty ? 'card-empty':''}" data-cid="${c.id}">
      <div class="card3d-inner">
        <div class="face front">
          <div class="card-actions">
            <button class="icon-btn" data-act="edit" title="Edit">⋯</button>
            <button class="icon-btn" data-act="del" title="Delete">✕</button>
          </div>
          <div class="card-title">${escapeHTML(c.term || "Blank card")}</div>
          <div class="card-sub">Click to flip</div>
        </div>
        <div class="face back">
          <div class="card-actions">
            <button class="icon-btn" data-act="edit" title="Edit">⋯</button>
            <button class="icon-btn" data-act="del" title="Delete">✕</button>
          </div>
          <div class="card-title">${escapeHTML(c.def || "Add a meaning…")}</div>
        </div>
      </div>
    </li>
  `;
}
function emptyCardsHTML(){
  // show a few placeholder empties if no cards yet
  return Array.from({length:6}).map(()=>`
    <li class="card3d card-empty">
      <div class="card3d-inner">
        <div class="face front">
          <div class="card-title">No cards yet</div>
          <div class="card-sub">Use the form above</div>
        </div>
        <div class="face back">
          <div class="card-title">No cards yet</div>
        </div>
      </div>
    </li>
  `).join("");
}

function fcUid(){ return "fc_" + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

// Flip / Edit / Delete (event delegation)
if (cardsGrid){
  cardsGrid.addEventListener("click", (e) => {
    const li = e.target.closest("li.card3d");
    if(!li) return;
    const cid = li.getAttribute("data-cid");
    const btn = e.target.closest("button.icon-btn");

    if (btn){
      const act = btn.getAttribute("data-act");
      if (act === "edit"){
        const item = flashcards.find(x => x.id === cid);
        if (!item) return;
        // Prefill form and jump to it
        cardId.value = item.id;
        cardTerm.value = item.term || "";
        cardDef.value  = item.def  || "";
        activate("learn");
        li.scrollIntoView({behavior:"smooth", block:"center"});
        cardTerm.focus();
      } else if (act === "del"){
        if (!confirm("Delete this card?")) return;
        flashcards = flashcards.filter(x => x.id !== cid);
        saveFlashcards(); renderCards();
      }
      return;
    }

    // no button → flip
    li.classList.toggle("flipped");
  });
}

// Seed 20 blank cards
if (seed20Btn){
  seed20Btn.addEventListener("click", () => {
    if (!confirm("Add 20 blank cards?")) return;
    const blanks = Array.from({length:20}).map(()=>({ id: fcUid(), term:"", def:"" }));
    flashcards = flashcards.concat(blanks).slice(0, 200); // soft cap
    saveFlashcards(); renderCards();
  });
}

// Add / Update via form
if (cardForm){
  cardForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    const id = (cardId.value || "").trim();
    const term = (cardTerm.value || "").trim();
    const def  = (cardDef.value  || "").trim();
    if (!term || !def){
      cardMsg.textContent = "Please enter both a keyword and a meaning.";
      return;
    }
    if (id){
      const ix = flashcards.findIndex(x => x.id === id);
      if (ix !== -1) flashcards[ix] = { ...flashcards[ix], term, def };
      cardMsg.textContent = "Card updated.";
    } else {
      flashcards.push({ id: fcUid(), term, def });
      cardMsg.textContent = "Card added.";
    }
    saveFlashcards(); renderCards();
    cardForm.reset(); cardId.value = "";
    setTimeout(()=> cardMsg.textContent = "", 1200);
  });
}

/* =================
   QUOTES
   ================= */
const QUOTES_KEY = "quotes_v1";
let quotes = [];

const quotesList = document.getElementById("quotesList");
const quoteForm  = document.getElementById("quoteForm");
const quoteText  = document.getElementById("quoteText");
const quoteAuthor= document.getElementById("quoteAuthor");
const quoteMsg   = document.getElementById("quoteMsg");
const quoteId    = document.getElementById("quoteId");

function loadQuotes(){
  try{ quotes = JSON.parse(localStorage.getItem(QUOTES_KEY) || "[]"); }
  catch{ quotes = []; }
}
function saveQuotes(){
  localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}
function qUid(){ return "qt_" + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function renderQuotes(){
  if(!quotesList) return;
  if (quotes.length === 0){
    quotesList.innerHTML = `<div class="muted small">No quotes yet. Add one above.</div>`;
    return;
  }
  quotesList.innerHTML = quotes.map(q => `
    <article class="quote-card" data-qid="${q.id}">
      <div class="quote-text">“${escapeHTML(q.text)}”</div>
      <div class="quote-author">— ${escapeHTML(q.author)}</div>
      <div class="quote-actions">
        <button class="btn-sm" data-qact="edit">Edit</button>
        <button class="btn-sm btn-danger" data-qact="del">Delete</button>
      </div>
    </article>
  `).join("");
}

// Add / Update
if (quoteForm){
  quoteForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    const id = (quoteId.value || "").trim();
    const text = (quoteText.value || "").trim();
    const author = (quoteAuthor.value || "").trim();
    if (!text || !author){
      quoteMsg.textContent = "Both quote and author are required.";
      return;
    }
    if (id){
      const ix = quotes.findIndex(x => x.id === id);
      if (ix !== -1) quotes[ix] = { ...quotes[ix], text, author };
      quoteMsg.textContent = "Quote updated.";
    } else {
      quotes.push({ id: qUid(), text, author });
      quoteMsg.textContent = "Quote added.";
    }
    saveQuotes(); renderQuotes();
    quoteForm.reset(); quoteId.value = "";
    setTimeout(()=> quoteMsg.textContent = "", 1200);
  });
}

// Edit / Delete via delegation
if (quotesList){
  quotesList.addEventListener("click", (e)=>{
    const card = e.target.closest("[data-qid]");
    if (!card) return;
    const qid = card.getAttribute("data-qid");
    const actBtn = e.target.closest("button[data-qact]");
    if (!actBtn) return;
    const act = actBtn.getAttribute("data-qact");

    const ix = quotes.findIndex(x => x.id === qid);
    if (ix === -1) return;

    if (act === "del"){
      if (!confirm("Delete this quote?")) return;
      quotes.splice(ix,1); saveQuotes(); renderQuotes();
      return;
    }
    if (act === "edit"){
      const q = quotes[ix];
      quoteId.value = q.id;
      quoteText.value = q.text;
      quoteAuthor.value = q.author;
      activate("quotes");
      quoteText.focus();
      return;
    }
  });
}

/* ======== Init when page loads ======== */
(function initExtras(){
  loadFlashcards(); renderCards();
  loadQuotes(); renderQuotes();

})();
