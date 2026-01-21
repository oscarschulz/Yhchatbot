const q = document.getElementById("q");
const goBtn = document.getElementById("goBtn");
const list = document.getElementById("list");
const empty = document.getElementById("empty");

// Person-connection flow UI
const personBox = document.getElementById("personBox");
const personHead = document.getElementById("personHead");
const personMsg = document.getElementById("personMsg");
const connectForm = document.getElementById("connectForm");
const connectStatus = document.getElementById("connectStatus");

// Fake "backend searching" timers (for person-connection flow)
let personSearchTimeout = null;
let personDotsInterval = null;

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

  // If the query has no meaningful tokens (e.g., "how", "what"), treat as no match.
  if (!tokens.length && query.length < 4) return 0;

  let score = 0;

  // Strong full-phrase match
  if (t.includes(query)) score += 8;
  if (keys.some(k => k.includes(query))) score += 6;

  // Token match
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

    head.addEventListener("click", () => {
      card.classList.toggle("open");
    });

    card.appendChild(head);
    card.appendChild(ans);
    list.appendChild(card);
  }
}

function hideOutputs() {
  // Clear any running fake-search timers
  if (personSearchTimeout) {
    clearTimeout(personSearchTimeout);
    personSearchTimeout = null;
  }
  if (personDotsInterval) {
    clearInterval(personDotsInterval);
    personDotsInterval = null;
  }

  list.classList.add("hidden");
  empty.classList.add("hidden");
  list.innerHTML = "";

  if (personBox) {
    personBox.classList.add("hidden");
    personBox.classList.add("open");
  }

  if (connectStatus) {
    connectStatus.classList.add("hidden");
  }

  if (connectForm) {
    connectForm.classList.remove("hidden");
  }
}

function looksLikeSpecificPersonQuery(raw) {
  const s = normalize(raw);
  if (!s) return false;

  // Common phrasing for asking about a specific person (kept narrow)
  if (/\bdo\s+(you|u)\s+know\b/.test(s)) return true;

  // If the query is clearly about Young Hustlers itself, do NOT route to the person form
  // unless the user explicitly signals a connection/contact request.
  const isYHContext =
    s.includes("young hustlers") ||
    s.includes("younghustlers") ||
    /\byh\b/.test(s) ||
    /\byhf\b/.test(s);

  // Direct "contact/connect" intents
  const intentSignals = [
    "connect", "contact", "reach", "introduce", "link", "meet", "talk to", "speak to",
    "phone", "number", "email", "address", "telegram", "whatsapp", "instagram", "ig", "dm",
    "handle", "@"
  ];

  const hasIntentSignal = intentSignals.some(x => s.includes(x));
  if (hasIntentSignal) return true;

  // "who is X" / "where is X" patterns often mean a specific individual.
  const hasWhoWhere = /\bwho\s+is\b/.test(s) || /\bwhere\s+is\b/.test(s);
  if (hasWhoWhere) {
    const toks = meaningfulTokens(s);
    if (toks.length >= 1) return true;
  }

  // If this is YH context and there's no explicit person-intent, keep it in FAQ mode.
  if (isYHContext) return false;

  // If user types a short name-like query (2+ tokens), treat as person request.
  const rawParts = (raw || "").trim().split(/\s+/).filter(Boolean);
  if (rawParts.length >= 2) {
    const lastTwo = rawParts.slice(-2);
    const lastTwoNorm = normalize(lastTwo.join(" "));
    if (lastTwoNorm === "young hustlers") return false;
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

  q = q.trim();
  return q || (raw || "").trim();
}

function showPersonFlow(raw) {
  if (!personBox) return;

  // Clear any prior fake-search timers
  if (personSearchTimeout) {
    clearTimeout(personSearchTimeout);
    personSearchTimeout = null;
  }
  if (personDotsInterval) {
    clearInterval(personDotsInterval);
    personDotsInterval = null;
  }

  // Hide FAQ results
  list.classList.add("hidden");
  empty.classList.add("hidden");
  list.innerHTML = "";

  // Show the connection card (form is revealed after a short fake "search")
  personBox.classList.remove("hidden");
  personBox.classList.add("open");

  // Reset + hide the form while we "search"
  if (connectForm) {
    connectForm.reset();
    connectForm.classList.add("hidden");
  }
  if (connectStatus) {
    connectStatus.classList.add("hidden");
    connectStatus.textContent = "";
  }

  const target = extractPersonTarget(raw);
  const base = target
    ? `Searching the YH network for "${target}"`
    : "Searching the YH network";

  let dots = 0;
  if (personMsg) personMsg.textContent = base;

  personDotsInterval = setInterval(() => {
    dots = (dots + 1) % 4;
    if (personMsg) personMsg.textContent = base + ".".repeat(dots);
  }, 420);

  // Simulated backend delay before revealing the form
  const delayMs = 1200 + Math.floor(Math.random() * 900);
  personSearchTimeout = setTimeout(() => {
    if (personDotsInterval) {
      clearInterval(personDotsInterval);
      personDotsInterval = null;
    }
    personSearchTimeout = null;

    if (personMsg) {
      personMsg.textContent =
        "We might be able to connect you with him, but firstly, fill this form out.";
    }
    if (connectForm) connectForm.classList.remove("hidden");

    // Bring the card into view once the form is ready
    personBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }, delayMs);

  // Initial scroll so users see that something is happening
  personBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showFaqResults(items) {
  if (personBox) personBox.classList.add("hidden");

  if (!items.length) {
    list.classList.add("hidden");
    empty.classList.remove("hidden");
    empty.textContent = "No matches found.";
    list.innerHTML = "";
    return;
  }

  empty.classList.add("hidden");
  list.classList.remove("hidden");
  render(items);
}

function runSearch() {
  const raw = (q.value || "").trim();

  if (!raw) {
    hideOutputs();
    return;
  }

  // 1) Person-specific requests take priority
  if (looksLikeSpecificPersonQuery(raw)) {
    showPersonFlow(raw);
    return;
  }

  // 2) Otherwise, only answer if it matches YH knowledge base
  const query = normalize(raw);

  const scored = (window.KB || [])
    .map(item => ({ item, s: scoreItem(item, query) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.item);

  showFaqResults(scored);
}

// Disable auto-results while typing; only search on Enter or click.
function handleTyping() {
  const raw = (q.value || "").trim();

  if (!raw) {
    hideOutputs();
    return;
  }

  // If the user changes the query while a fake-search is running, cancel it.
  if (personSearchTimeout) {
    clearTimeout(personSearchTimeout);
    personSearchTimeout = null;
  }
  if (personDotsInterval) {
    clearInterval(personDotsInterval);
    personDotsInterval = null;
  }

  // If user is editing the query, hide previous outputs until they search again.
  if (personBox) personBox.classList.add("hidden");
  list.classList.add("hidden");
  empty.classList.add("hidden");
}

// Events
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

if (connectForm) {
  connectForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const firstName = (connectForm.elements.firstName?.value || "").trim();
    const surname = (connectForm.elements.surname?.value || "").trim();
    const age = (connectForm.elements.age?.value || "").trim();
    const birthdate = (connectForm.elements.birthdate?.value || "").trim();
    const country = (connectForm.elements.country?.value || "").trim();
    const city = (connectForm.elements.city?.value || "").trim();

    const missing = [];
    if (!firstName) missing.push("Name");
    if (!surname) missing.push("Surname");
    if (!age) missing.push("Age");
    if (!birthdate) missing.push("Birthdate");
    if (!country) missing.push("Country of residency");
    if (!city) missing.push("Current location / city");

    if (missing.length) {
      alert("Please fill: " + missing.join(", "));
      return;
    }

    // UI-only “submitting” state (premium feel). No backend yet.
    const submitBtn = connectForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? (submitBtn.dataset.originalText || submitBtn.textContent) : "";

    if (submitBtn) {
      submitBtn.dataset.originalText = originalBtnText;
      submitBtn.disabled = true;
      submitBtn.classList.add("is-loading");
      submitBtn.textContent = "Submitting";
    }

    if (connectStatus) {
      connectStatus.textContent = "Submitting your request…";
      connectStatus.classList.remove("hidden");
    }

    // Simulate network latency
    setTimeout(() => {
      if (connectStatus) {
        connectStatus.textContent = "Submitted. If we can connect you, we’ll follow up.";
        connectStatus.classList.remove("hidden");
      }

      connectForm.reset();

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove("is-loading");
        submitBtn.textContent = originalBtnText || "Submit";
      }
    }, 1200);
  });
}

// Initial state: nothing visible
hideOutputs();
