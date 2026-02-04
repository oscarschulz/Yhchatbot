// ============================
// Ask YH — app.js
// UPDATE: Fixed Minimize Logic (Toggle Only) & Backend Safe
// All original logic retained.
// ============================

const q = document.getElementById("q");
const goBtn = document.getElementById("goBtn");
const list = document.getElementById("list");
const empty = document.getElementById("empty");

// Person-connection flow UI elements
const personBox = document.getElementById("personBox");
const personHead = document.getElementById("personHead");
const personMsg = document.getElementById("personMsg");
const connectForm = document.getElementById("connectForm");
const connectStatus = document.getElementById("connectStatus");
const closeCard = document.getElementById("closeCard"); // The Arrow Button

// --- BACKEND URL (RETAINED) ---
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz1mh08zgqOU-gTAgVGX7bnnLWUcdqFQXK_sYh3ZYfghlOyufvt_WT9xa9IO9mOqhpF/exec";

// Timers for the fake searching animation
let personSearchTimeout = null;
let personDotsInterval = null;

// -----------------------------
// HERO INTRO (true sync to video timeline)
// -----------------------------
(function initHeroIntroSyncedToVideo(){
  const headline = document.getElementById("heroHeadline");
  const subhead  = document.getElementById("heroSubhead");
  const searchCard = document.getElementById("searchCard");
  const video = document.getElementById("bgVideo");

  if (!headline || !subhead || !searchCard) {
    document.body.classList.remove("hero-prep");
    document.body.classList.add("video-ready", "hero-text", "hero-ui");
    return;
  }

  const fullH = headline.textContent.trim();
  const fullS = subhead.textContent.trim();

  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heroStartMs = Number(video?.dataset?.heroStartMs || 2500);
  const freezeAtMs  = Number(video?.dataset?.freezeAtMs  || 3300);
  const heroStartS = heroStartMs / 1000;
  const freezeAtS  = freezeAtMs / 1000;

  const typeText = (el, text, speed, done) => {
    if (prefersReduced) {
      el.textContent = text;
      done && done();
      return;
    }
    el.textContent = "";
    el.classList.add("typing");
    let i = 1;
    const tick = () => {
      el.textContent = text.slice(0, i);
      i += 1;
      if (i <= text.length) {
        window.setTimeout(tick, speed);
      } else {
        el.textContent = text;
        el.classList.remove("typing");
        done && done();
      }
    };
    tick();
  };

  let heroStarted = false;
  let frozen = false;

  const startHero = () => {
    if (heroStarted) return;
    heroStarted = true;
    document.body.classList.add("video-ready");
    document.body.classList.remove("hero-prep");
    document.body.classList.add("hero-text");
    typeText(headline, fullH, 42, () => {
      typeText(subhead, fullS, 26, () => {
        document.body.classList.add("hero-ui");
      });
    });
  };

  const freezeVideo = () => {
    if (frozen) return;
    frozen = true;
    if (!video) return;
    try {
      const dur = Number.isFinite(video.duration) ? video.duration : null;
      const safeFreeze = dur ? Math.min(freezeAtS, Math.max(0, dur - 0.05)) : freezeAtS;
      if (Number.isFinite(safeFreeze)) video.currentTime = safeFreeze;
      video.loop = false;
      video.pause();
    } catch (_) {}
  };

  const tickSync = () => {
    if (!video) return;
    const t = video.currentTime || 0;
    if (!document.body.classList.contains("video-ready") && t >= 0) {
      document.body.classList.add("video-ready");
    }
    if (!heroStarted && t >= heroStartS) startHero();
    if (!frozen && t >= freezeAtS) freezeVideo();
  };

  const begin = () => {
    if (prefersReduced) {
      document.body.classList.add("video-ready");
      window.setTimeout(() => {
        document.body.classList.remove("hero-prep");
        document.body.classList.add("hero-text", "hero-ui");
        headline.textContent = fullH;
        subhead.textContent = fullS;
      }, heroStartMs);
      window.setTimeout(() => freezeVideo(), freezeAtMs);
      return;
    }
    if (video && typeof video.requestVideoFrameCallback === "function") {
      const onFrame = () => {
        tickSync();
        if (!frozen) video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
    } else {
      const iv = window.setInterval(() => {
        tickSync();
        if (frozen) window.clearInterval(iv);
      }, 40);
    }
    window.setTimeout(() => {
      if (!heroStarted) startHero();
    }, heroStartMs + 1200);
  };

  if (video) {
    video.addEventListener("loadedmetadata", () => { try { video.currentTime = 0; } catch (_) {} }, { once: true });
    try { video.play().catch(() => {}); } catch (_) {}
    video.addEventListener("playing", begin, { once: true });
    video.addEventListener("canplay", () => document.body.classList.add("video-ready"), { once: true });
    video.addEventListener("loadeddata", () => document.body.classList.add("video-ready"), { once: true });
    window.setTimeout(() => begin(), 700);
    video.addEventListener("error", () => {
      document.body.classList.add("video-ready");
      startHero();
    }, { once: true });
  } else {
    document.body.classList.add("video-ready");
    window.setTimeout(() => startHero(), 200);
  }
})();

// --- Helper Functions ---

function closeKeyboard(){
  try{
    const ae = document.activeElement;
    if (ae && typeof ae.blur === "function") ae.blur();
    if (q && typeof q.blur === "function") q.blur();
  }catch(_){}
}

function safeScrollTo(el, offset = 16){
  if (!el) return;
  try{
    const rect = el.getBoundingClientRect();
    const top = rect.top + (window.pageYOffset || window.scrollY || 0) - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }catch(_){
    try{ el.scrollIntoView({ behavior: "smooth", block: "start" }); }catch(__){}
  }
}

function normalize(s) {
  return (s || "").toString().toLowerCase().trim();
}

const STOPWORDS = new Set([
  "a","an","the","and","or","but","to","of","in","on","for","with","at","by","from",
  "is","are","was","were","be","been","being","do","does","did",
  "what","who","where","when","why","how","much","many","can","could","should","would","will",
  "i","me","my","you","your","we","our","they","them","he","him","she","her","it","its",
  "please","pls","kindly"
]);

function tokenize(s) {
  return normalize(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function meaningfulTokens(s) {
  return tokenize(s).filter(t => t.length > 2 && !STOPWORDS.has(t));
}

function scoreItem(item, query) {
  if (!query) return 0;
  const t = normalize(item.title);
  const keys = (item.keywords || []).map(normalize);
  const tokens = meaningfulTokens(query);

  if (!tokens.length && query.length < 4) return 0;
  let score = 0;

  if (t.includes(query)) score += 8;
  if (keys.some(k => k.includes(query))) score += 6;

  for (const tok of tokens) {
    if (t.includes(tok)) score += 3;
    if (keys.some(k => k.includes(tok))) score += 2;
  }
  return score;
}

function render(items) {
  if (!list) return;
  list.innerHTML = "";
  for (const item of items) {
    const card = document.createElement("div");
    card.className = "card";
    const head = document.createElement("div");
    head.className = "cardHead";
    const title = document.createElement("h3");
    title.className = "qTitle";
    title.textContent = item.title;
    
    // Toggle Arrow for FAQ
    const chev = document.createElement("div");
    chev.className = "chev";
    chev.textContent = "▾";
    head.appendChild(title);
    head.appendChild(chev);

    const ans = document.createElement("div");
    ans.className = "cardBody"; // Reusing cardBody for style
    ans.innerHTML = `<div style="padding-top:0;">${item.answer}</div>`;
    ans.style.maxHeight = "0"; 
    ans.style.padding = "0 40px";
    ans.style.opacity = "0";
    ans.style.transition = "all 0.4s ease"; 

    // FAQ Toggle Logic
    head.addEventListener("click", () => {
      const isOpen = ans.style.maxHeight !== "0px" && ans.style.maxHeight !== "0";
      if (isOpen) {
        ans.style.maxHeight = "0";
        ans.style.opacity = "0";
        ans.style.padding = "0 40px";
        chev.style.transform = "rotate(-90deg)";
      } else {
        ans.style.maxHeight = "500px";
        ans.style.opacity = "1";
        ans.style.padding = "40px";
        chev.style.transform = "rotate(0deg)";
      }
    });

    card.appendChild(head);
    card.appendChild(ans);
    list.appendChild(card);
  }
}

function hideOutputs() {
  if (personSearchTimeout) clearTimeout(personSearchTimeout);
  if (personDotsInterval) clearInterval(personDotsInterval);

  if (list) {
    list.classList.add("hidden");
    list.innerHTML = "";
  }
  if (empty) empty.classList.add("hidden");

  if (personBox) {
    personBox.classList.add("hidden");
    personBox.classList.remove("minimized"); // Reset minimized so it opens fresh next time
  }
}

function looksLikeSpecificPersonQuery(raw) {
  const s = normalize(raw);
  if (!s) return false;
  if (/\bdo\s+(you|u)\s+know\b/.test(s)) return true;
  const isYHContext = s.includes("young hustlers") || s.includes("younghustlers") || /\byh\b/.test(s);
  const intentSignals = [
    "connect", "contact", "reach", "introduce", "link", "meet", "talk to", "speak to",
    "phone", "number", "email", "address", "telegram", "whatsapp", "instagram", "ig", "dm", "handle", "@"
  ];
  if (intentSignals.some(x => s.includes(x))) return true;
  const hasWhoWhere = /\bwho\s+is\b/.test(s) || /\bwhere\s+is\b/.test(s);
  if (hasWhoWhere && meaningfulTokens(s).length >= 1) return true;
  if (isYHContext) return false;
  const rawParts = (raw || "").trim().split(/\s+/).filter(Boolean);
  if (rawParts.length >= 2) {
    const lastTwo = rawParts.slice(-2);
    if (normalize(lastTwo.join(" ")) === "young hustlers") return false;
    const alphaLike = lastTwo.every(w => /^[A-Za-z.'-]{2,}$/.test(w));
    const hasUpper = lastTwo.some(w => w[0] && w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase());
    if (alphaLike && (hasUpper || meaningfulTokens(raw).length >= 2)) return true;
  }
  return false;
}

function extractPersonTarget(raw) {
  let qx = (raw || "").trim().replace(/\s+/g, " ");
  qx = qx.replace(/[?!.]+\s*$/, "");
  const patterns = [
    /^do\s+(you|u)\s+know\s+/i,
    /^who\s+is\s+/i,
    /^where\s+is\s+/i,
    /^can\s+you\s+(connect|contact|reach|introduce)\s+(me\s+)?(to|with)\s+/i,
    /^connect\s+(me\s+)?(to|with)\s+/i,
    /^contact\s+/i,
    /^reach\s+/i,
    /^introduce\s+(me\s+)?to\s+/i,
  ];
  for (const p of patterns) qx = qx.replace(p, "");
  return qx.trim() || (raw || "").trim();
}

function showPersonFlow(raw) {
  if (!personBox) return;
  closeKeyboard();

  if (personSearchTimeout) clearTimeout(personSearchTimeout);
  if (personDotsInterval) clearInterval(personDotsInterval);

  if (list) { list.classList.add("hidden"); list.innerHTML = ""; }
  if (empty) empty.classList.add("hidden");

  // SHOW THE BOX and RESET STATE
  // FIX: Siguraduhin na visible ang box at hindi minimized
  personBox.classList.remove("hidden");
  personBox.classList.remove("minimized"); 

  if (connectForm) {
    connectForm.reset();
    connectForm.classList.add("hidden");
    connectForm.style.display = "";
  }
  if (connectStatus) {
    connectStatus.classList.add("hidden");
    connectStatus.textContent = "";
    connectStatus.style.color = "";
  }
  if (personMsg) {
    personMsg.style.display = "block";
    personMsg.innerHTML = "";
  }

  const target = extractPersonTarget(raw);
  const contactPersonEl = document.getElementById("contactPerson");
  if (contactPersonEl) contactPersonEl.value = target || raw;

  const base = target ? `Searching the YH network for "${target}"` : "Searching the YH network";
  let dots = 0;
  if (personMsg) personMsg.textContent = base;

  personDotsInterval = setInterval(() => {
    dots = (dots + 1) % 4;
    if (personMsg) personMsg.textContent = base + ".".repeat(dots);
  }, 420);

  const delayMs = 1200 + Math.floor(Math.random() * 900);
  personSearchTimeout = setTimeout(() => {
    clearInterval(personDotsInterval);
    personDotsInterval = null;
    personSearchTimeout = null;

    if (personMsg) personMsg.textContent = "Complete the form below. Our team will review it and get back to you if the request qualifies.";
    if (connectForm) connectForm.classList.remove("hidden");
    safeScrollTo(personBox, 18);
  }, delayMs);

  window.setTimeout(() => safeScrollTo(personBox, 18), 60);
}

function runSearch() {
  const raw = (q?.value || "").trim();
  if (!raw) { hideOutputs(); return; }
  closeKeyboard();

  if (looksLikeSpecificPersonQuery(raw)) {
    showPersonFlow(raw);
    return;
  }

  const query = normalize(raw);
  const scored = (window.KB || [])
    .map(item => ({ item, s: scoreItem(item, query) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.item);

  if (personBox) personBox.classList.add("hidden");

  if (!scored.length) {
    if (list) { list.classList.add("hidden"); list.innerHTML = ""; }
    if (empty) {
      empty.classList.remove("hidden");
      empty.textContent = "No matches found.";
    }
  } else {
    if (empty) empty.classList.add("hidden");
    if (list) list.classList.remove("hidden");
    render(scored);
  }
}

function handleTyping() {
  const raw = (q?.value || "").trim();
  if (!raw) { hideOutputs(); return; }
  
  if (personSearchTimeout) clearTimeout(personSearchTimeout);
  if (personDotsInterval) clearInterval(personDotsInterval);

  if (personBox) personBox.classList.add("hidden");
  if (list) list.classList.add("hidden");
  if (empty) empty.classList.add("hidden");
}

// Events
q?.addEventListener("input", handleTyping);
q?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    runSearch();
  }
});
goBtn?.addEventListener("click", runSearch);


// ============================================
// HEADER & TOGGLE LOGIC (FIXED)
// ============================================

// 1. Header Click (Toggle)
if (personHead && personBox) {
  personHead.addEventListener("click", () => {
    personBox.classList.toggle("minimized");
  });
}

// 2. Arrow Click (Toggle ONLY - HINDI CLOSE/DELETE)
if (closeCard) {
  closeCard.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation(); // Stop event bubbling
    personBox.classList.toggle("minimized"); // Add/Remove 'minimized' class
  });
}

// -------------------------------------------------------------
// SUBMIT LOGIC WITH SUCCESS UI (BACKEND PRESERVED)
// -------------------------------------------------------------
if (connectForm) {
  connectForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = new FormData(connectForm);
    const data = Object.fromEntries(formData.entries());

    // Basic Validation
    const missing = [];
    if (!data.firstName) missing.push("Name");
    if (!data.surname) missing.push("Surname");
    if (!data.email) missing.push("Email");
    if (!data.age) missing.push("Age");
    if (!data.country) missing.push("Country");
    if (!data.city) missing.push("City");
    if (!data.contactPerson) missing.push("Contact Person");
    if (!data.profession) missing.push("Profession");
    if (!data.experience) missing.push("Experience");
    if (!data.purpose) missing.push("Purpose");

    if (missing.length) {
      alert("Please fill: " + missing.join(", "));
      return;
    }

    const submitBtn = connectForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? (submitBtn.dataset.originalText || submitBtn.textContent) : "Submit";

    if (submitBtn) {
      submitBtn.dataset.originalText = originalBtnText;
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      submitBtn.textContent = "Sending...";
    }

    fetch(WEB_APP_URL, {
      method: "POST",
      body: formData
    })
    .then(res => res.text())
    .then(() => {
      connectForm.classList.add("hidden");
      connectForm.style.display = "none";

      if (personBox) personBox.dataset.mode = "success";

      document.body.classList.add("yhSuccess");
      const h1 = document.getElementById("heroHeadline");
      const sh = document.getElementById("heroSubhead");
      const sc = document.getElementById("searchCard");
      const er = document.getElementById("exploreRow");
      if (h1) h1.classList.add("hidden");
      if (sh) sh.classList.add("hidden");
      if (sc) sc.classList.add("hidden");
      if (er) er.classList.add("hidden");

      if (personMsg) {
        const safeEmail = (data.email || "").replace(/</g, "&lt;");
        personMsg.innerHTML = `
          <div class="underReview">
            <div class="urIcon" aria-hidden="true">⏳</div>
            <div class="urTitle">Request Under Review</div>
            <div class="urBody">
              Your request has been successfully received.<br/>
              Our team is currently reviewing your information.<br/><br/>
              If approved, a representative will contact you at <b>${safeEmail}</b>.<br/>
              Please allow up to 48 hours for review.<br/><br/>
              Due to high demand, not all requests are approved.<br/><br/>
              In the meantime, you may explore Young Hustlers.
            </div>
            <a class="urBtn" href="https://www.younghustlers.net/main" target="_top" rel="noopener">Explore Young Hustlers</a>
          </div>
        `;
      }
    })
    .catch((err) => {
      console.error(err);
      if (connectStatus) {
        connectStatus.textContent = "Error submitting. Please try again.";
        connectStatus.classList.remove("hidden");
        connectStatus.style.color = "#ff6b6b";
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
        submitBtn.textContent = originalBtnText;
      }
    });
  });
}

// Initial UI state
hideOutputs();