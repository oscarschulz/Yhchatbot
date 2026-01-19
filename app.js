const q = document.getElementById("q");
const list = document.getElementById("list");
const empty = document.getElementById("empty");

function normalize(s) {
  return (s || "").toString().toLowerCase().trim();
}

function scoreItem(item, query) {
  if (!query) return 0;

  const t = normalize(item.title);
  const keys = (item.keywords || []).map(normalize);

  let score = 0;

  // strong title match
  if (t.includes(query)) score += 6;

  // keyword match
  if (keys.some(k => k.includes(query))) score += 4;

  // token matching
  const parts = query.split(/\s+/).filter(Boolean);
  for (const p of parts) {
    if (p.length < 2) continue;
    if (t.includes(p)) score += 2;
    if (keys.some(k => k.includes(p))) score += 1;
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

function applyFilter() {
  const query = normalize(q.value);

  // IMPORTANT: nothing visible until user types
  if (!query) {
    list.classList.add("hidden");
    empty.classList.add("hidden");
    list.innerHTML = "";
    return;
  }

  const scored = (window.KB || [])
    .map(item => ({ item, s: scoreItem(item, query) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.item);

  // show results area only after typing
  list.classList.remove("hidden");

  if (!scored.length) {
    empty.classList.remove("hidden");
    list.innerHTML = "";
    return;
  }

  empty.classList.add("hidden");
  render(scored);
}

q.addEventListener("input", applyFilter);

// initial: nothing visible
applyFilter();
