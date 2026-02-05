// toggle.js
// Scenery Switcher Logic
// - Default: NO LOOP
// - Scene 1, 2, 3: INFINITE LOOP
// - Auto-Save functionality included

(function initScenerySwitcher() {
  const btn = document.getElementById("sceneryBtn");
  const menu = document.getElementById("sceneryMenu");
  const options = document.querySelectorAll(".sOption");
  const video = document.getElementById("bgVideo");

  if (!btn || !menu || !video || !options.length) return;

  // --- HELPER: Set Video Source & Loop Settings ---
  const setVideo = (src) => {
    // Check kung ito ba ang Default video (yhvideo3.mp4)
    const isDefault = src.indexOf("yhvideo3.mp4") !== -1;

    video.src = src;
    
    // LOGIC: Kung Default -> False (Walang Loop). Kung Iba -> True (May Loop).
    if (isDefault) {
      video.loop = false; 
    } else {
      video.loop = true;
    }

    video.load();
    const p = video.play();
    if (p !== undefined) p.catch(() => {});
  };

  // --- 1. LOAD SAVED PREFERENCE (Auto-Recall) ---
  const savedSrc = localStorage.getItem("yhScenery");
  
  if (savedSrc) {
    const matchBtn = Array.from(options).find(opt => opt.getAttribute("data-src") === savedSrc);
    if (matchBtn) {
      options.forEach(o => o.classList.remove("active"));
      matchBtn.classList.add("active");
      setVideo(savedSrc);
    } else {
      // Kung walang match (or first load), ensure Default has NO loop
      video.loop = false;
    }
  } else {
    // First time load: Default video, NO loop
    video.loop = false;
  }

  // --- 2. CLICK LOGIC ---
  options.forEach(opt => {
    opt.addEventListener("click", () => {
      const src = opt.getAttribute("data-src");
      if (!src) return;

      // Kung ito na ang current video
      if (video.src.includes(src) || (src.startsWith("http") && video.src === src)) {
        menu.classList.add("hidden");
        return;
      }

      // Save to Storage
      localStorage.setItem("yhScenery", src);

      // UI Update
      options.forEach(o => o.classList.remove("active"));
      opt.classList.add("active");

      // Smooth Fade Transition
      video.style.transition = "opacity 0.5s ease";
      video.style.opacity = "0";

      setTimeout(() => {
        setVideo(src); // Apply Source & Loop Rule

        // Fade In
        video.oncanplay = () => { video.style.opacity = "1"; };
        setTimeout(() => { video.style.opacity = "1"; }, 500);
      }, 300);

      menu.classList.add("hidden");
    });
  });

  // --- 3. MENU TOGGLE ---
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.add("hidden");
    }
  });

})();