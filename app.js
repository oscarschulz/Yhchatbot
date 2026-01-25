const q = document.getElementById("q");
const goBtn = document.getElementById("goBtn");
const list = document.getElementById("list");
const empty = document.getElementById("empty");

// Go to Homepage logic (works even if embedded in iframe)
const homeBtn = document.getElementById("homeBtn");
if (homeBtn) {
  homeBtn.addEventListener("click", (e) => {
    // Let the <a href> work, but ensure top navigation for embedded contexts.
    // Prevent default only if you want to force the JS route:
    e.preventDefault();
    try {
      window.top.location.href = "https://younghustlers.net/";
    } catch (_) {
      // Fallback if top navigation blocked
      window.location.href = "https://younghustlers.net/";
    }
  });
}

// Person-connection flow UI elements
const personBox = document.getElementById("personBox");
const personHead = document.getElementById("personHead");
const personMsg = document.getElementById("personMsg");
const connectForm = document.getElementById("connectForm");
const connectStatus = document.getElementById("connectStatus");

// --- URL galing sa screenshot mo (Version 4) ---
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz1mh08zgqOU-gTAgVGX7bnnLWUcdqFQXK_sYh3ZYfghlOyufvt_WT9xa9IO9mOqhpF/exec"; 

// Timers for the fake searching animation
let personSearchTimeout = null;
let personDotsInterval = null;

// --- Helper Functions ---

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
  return normalize(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
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
  list.innerHTML = "";
  for (const item of items) {
    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "cardHead";
    const title = document.createElement("h3");
    title.className = "qTitle";
    title.textContent = item.title;
    const chev = document.createElement("div");
    chev.className = "chev";
    chev.textContent = "▾";

    head.appendChild(title);
    head.appendChild(chev);

    const ans = document.createElement("div");
    ans.className = "answer";
    ans.textContent = item.answer;

    head.addEventListener("click", () => card.classList.toggle("open"));
    card.appendChild(head);
    card.appendChild(ans);
    list.appendChild(card);
  }
}

function hideOutputs() {
  if (personSearchTimeout) clearTimeout(personSearchTimeout);
  if (personDotsInterval) clearInterval(personDotsInterval);

  list.classList.add("hidden");
  empty.classList.add("hidden");
  list.innerHTML = "";

  if (personBox) {
    personBox.classList.add("hidden");
  }
}

// --- Logic to detect "Person Search" ---

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
  let q = (raw || "").trim().replace(/\s+/g, " ");
  q = q.replace(/[?!.]+\s*$/, "");
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
  for (const p of patterns) q = q.replace(p, "");
  return q.trim() || (raw || "").trim();
}

function showPersonFlow(raw) {
  if (!personBox) return;
  if (personSearchTimeout) clearTimeout(personSearchTimeout);
  if (personDotsInterval) clearInterval(personDotsInterval);

  list.classList.add("hidden");
  empty.classList.add("hidden");
  list.innerHTML = "";

  personBox.classList.remove("hidden");
  personBox.classList.add("open");

  if (connectForm) {
    connectForm.reset();
    connectForm.classList.add("hidden");
    connectForm.style.display = ""; 
  }

  if (connectStatus) {
    connectStatus.classList.add("hidden");
    connectStatus.innerHTML = ""; 
    connectStatus.className = "hintRow hidden"; 
  }

  if (personMsg) {
    personMsg.style.display = "block";
    personMsg.className = ""; 
    personMsg.innerHTML = ""; 
  }

  const target = extractPersonTarget(raw);
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

    if (personMsg) personMsg.textContent = "We might be able to connect you with him, but firstly, fill this form out.";
    if (connectForm) connectForm.classList.remove("hidden");

    personBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }, delayMs);

  personBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

function runSearch() {
  const raw = (q.value || "").trim();
  if (!raw) {
    hideOutputs();
    return;
  }
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
    list.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.textContent = "No matches found.";
    list.innerHTML = "";
  } else {
    empty.classList.add("hidden");
    list.classList.remove("hidden");
    render(scored);
  }
}

function handleTyping() {
  const raw = (q.value || "").trim();
  if (!raw) {
    hideOutputs();
    return;
  }
  if (personSearchTimeout) clearTimeout(personSearchTimeout);
  if (personDotsInterval) clearInterval(personDotsInterval);

  if (personBox) personBox.classList.add("hidden");
  list.classList.add("hidden");
  empty.classList.add("hidden");
}

q.addEventListener("input", handleTyping);
q.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    runSearch();
  }
});
goBtn.addEventListener("click", runSearch);

if (personHead && personBox) {
  personHead.addEventListener("click", () => {
    personBox.classList.toggle("open");
  });
}

// -------------------------------------------------------------
// SUBMIT LOGIC WITH SUCCESS UI
// -------------------------------------------------------------
if (connectForm) {
  connectForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = new FormData(connectForm);
    const data = Object.fromEntries(formData.entries());

    const missing = [];
    if (!data.firstName) missing.push("Name");
    if (!data.surname) missing.push("Surname");
    if (!data.email) missing.push("Email");
    if (!data.age) missing.push("Age");
    if (!data.birthdate) missing.push("Birthdate");
    if (!data.country) missing.push("Country");
    if (!data.city) missing.push("City");
    if (!data.profession) missing.push("Profession");
    if (!data.experience) missing.push("Past Experience");

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
      connectForm.style.display = "none";

      if (personMsg) {
        personMsg.innerHTML = `
          <div style="text-align:center; padding: 20px 0;">
            <div style="font-size: 40px; margin-bottom: 10px;">✅</div>
            <h3 style="margin:0 0 8px; color:#EAF0FF;">Request Received</h3>
            <p style="margin:0; font-size:14px; color:rgba(234,240,255,.7);">
              We have received your details. If you are a match, a representative will contact you at <strong>${data.email}</strong>.
            </p>
          </div>
        `;
      }
    })
    .catch(err => {
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

hideOutputs();
