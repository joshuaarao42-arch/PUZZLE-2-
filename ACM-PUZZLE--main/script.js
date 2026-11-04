const FINAL_PAGE_URL = "";

const PUZZLES = [
  { name: "Containment door", level: "Intern",     shift: 3,  plain: "JOIN THE ORBITAL CREW",
    hint: "Julius Caesar liked small shifts. Try a shift of 3." },
  { name: "Cryo pod bay",     level: "Technician", shift: 7,  plain: "CODE BEYOND THE STARS",
    hint: "The shift is the number of days in a week." },
  { name: "Specimen vault",   level: "Analyst",    shift: 13, plain: "OPEN THE AIRLOCK VAULT",
    hint: "This shift is exactly halfway around the 26-letter alphabet. Applying it twice returns the original." },
  { name: "Server bay",       level: "Supervisor", shift: 11, plain: "THE SIGNAL IS HIDDEN IN PLAIN SIGHT",
    hint: "No shift given. Spot the two-letter word: IS was encrypted as TD. How far did I move?" },
  { name: "Control room",     level: "Director",   shift: 9,  plain: "WELCOME TO ACM USTP CDO",
    hint: "Count the letters in ACM, then multiply by 3." }
];

// Helpers
const $ = id => document.getElementById(id);
const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Positive shifts encode; negative shifts decode.
function caesar(text, k) {
  return text.replace(/[A-Z]/g, c => A[(A.indexOf(c) + k % 26 + 26) % 26]);
}
// Ignore case, spaces, and punctuation.
const clean = s => s.toUpperCase().replace(/[^A-Z]/g, "");

// Text effects
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const NOISE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*<>/";

// Reveal the text from left to right.
function scramble(el, finalText, duration = 900) {
  cancelAnimationFrame(el._raf);
  if (reduceMotion) { el.textContent = finalText; return; }
  const start = performance.now();
  let last = 0;
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    if (now - last > 45 || t === 1) {            
      last = now;
      let out = "";
      for (let i = 0; i < finalText.length; i++) {
        const ch = finalText[i];
        out += (ch === " " || i / finalText.length < t) ? ch : NOISE[Math.floor(Math.random() * NOISE.length)];
      }
      el.textContent = out;
    }
    if (t < 1) el._raf = requestAnimationFrame(step);
  }
  el._raf = requestAnimationFrame(step);
}

// Play a brief glitch.
function glitch(el, ms = 480) {
  el.classList.remove("glitching");
  void el.offsetWidth;                            
  el.classList.add("glitching");
  setTimeout(() => el.classList.remove("glitching"), ms);
}

// Current puzzle state
let current = 0;
let solved = false;
let cleared = 0;
let wheelShift = 0;
const SAVE_KEY = "acm-cipher-breach-progress-v1";

function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!saved || saved.version !== 1) return null;
    return saved;
  } catch { return null; }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, cleared })); }
  catch { /* Storage may be unavailable in private browsing. */ }
}
const savedProgress = readSave();
if (savedProgress) {
  cleared = Math.max(0, Math.min(PUZZLES.length, Number(savedProgress.cleared) || 0));
}
current = Math.min(cleared, PUZZLES.length - 1);

// Terminal
const term = $("term");
const queue = [];
let typing = false;

function log(text, type = "") {
  queue.push({ text, type });
  if (!typing) runQueue();
}
async function runQueue() {
  typing = true;
  while (queue.length) {
    const { text, type } = queue.shift();
    const p = document.createElement("p");
    if (type) p.className = type;
    term.appendChild(p);
    while (term.children.length > 35) term.removeChild(term.firstElementChild);
    for (const ch of text) {            
      p.textContent += ch;
      await new Promise(r => setTimeout(r, 14));
    }
    term.scrollTop = term.scrollHeight;
  }
  typing = false;
}

// Cipher wheel
const wheel = $("wheel");
function buildWheel() {
  const ns = "http://www.w3.org/2000/svg";
  let svg = `<defs>
               <linearGradient id="glassRim" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e4fbff" stop-opacity=".75"/><stop offset=".4" stop-color="#34f0ff" stop-opacity=".25"/><stop offset=".75" stop-color="#7b6cff" stop-opacity=".3"/><stop offset="1" stop-color="#e4fbff" stop-opacity=".5"/></linearGradient>
               <radialGradient id="glassCore"><stop stop-color="#34f0ff" stop-opacity=".16"/><stop offset=".75" stop-color="#06182a" stop-opacity=".7"/><stop offset="1" stop-color="#030a14" stop-opacity=".85"/></radialGradient>
             </defs>
             <circle cx="120" cy="120" r="113" fill="rgba(20,50,74,.38)" stroke="url(#glassRim)" stroke-width="2"/>
             <circle cx="120" cy="120" r="105" fill="rgba(4,12,24,.5)" stroke="#34f0ff" stroke-opacity=".45" stroke-width="1"/>
             <circle cx="120" cy="120" r="91" fill="rgba(52,240,255,.07)" stroke="#8ff7ff" stroke-opacity=".5" stroke-width="1.5"/>
             <circle cx="120" cy="120" r="84" fill="rgba(4,12,24,.55)" stroke="#34f0ff" stroke-opacity=".35" stroke-width="1" stroke-dasharray="2 4"/>
             <circle cx="120" cy="120" r="59" fill="url(#glassCore)" stroke="#8ff7ff" stroke-opacity=".6" stroke-width="1.5"/>
             <ellipse cx="120" cy="120" rx="109" ry="14" fill="none" stroke="#e4fbff" stroke-opacity=".14" stroke-width="2"/>
             <text x="120" y="114" fill="#8fb4c0" style="font-size:7px">ENCRYPTED OUTSIDE</text>
             <text x="120" y="127" fill="#8fb4c0" style="font-size:7px">DECODED INSIDE</text>`;
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    const x = 120 + Math.cos(angle) * 98;
    const y = 120 + Math.sin(angle) * 98;
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.1" fill="#8ff7ff" fill-opacity=".8" stroke="#34f0ff" stroke-opacity=".6" stroke-width="1"/>`;
  }
  let outer = "", inner = "";
  for (let i = 0; i < 26; i++) {
    const rot = i * (360 / 26);
    outer += `<text class="o-letter" x="120" y="20" transform="rotate(${rot} 120 120)">${A[i]}</text>`;
    inner += `<text class="i-letter" x="120" y="46" transform="rotate(${rot} 120 120)">${A[i]}</text>`;
  }
  wheel.innerHTML = svg + outer + `<g class="inner" id="innerRing">${inner}</g>`;
}
function setWheel(k) {
  wheelShift = (k + 26) % 26;
  $("innerRing").style.transform = `rotate(${wheelShift * (360 / 26)}deg)`;
  $("shiftOut").textContent = "Shift " + wheelShift;
  $("preview").textContent = caesar($("cipherText").dataset.text, -wheelShift);
}

// Progress and status
function buildTrack() {
  const track = $("track");
  track.querySelectorAll(".node").forEach(n => n.remove());
  PUZZLES.forEach((p, i) => {
    const n = document.createElement("div");
    n.className = "node";
    n.id = "node" + i;
    n.innerHTML = `<i>${i + 1}</i><span>${p.level}</span>`;
    track.appendChild(n);
  });
}
function updateProgress() {
  PUZZLES.forEach((_, i) => {
    const n = $("node" + i);
    n.classList.toggle("done", i < cleared);
    n.classList.toggle("active", i === current && !solved);
  });
  const f = Math.min(cleared / PUZZLES.length, 1);
  $("fill").style.width = `calc(${f * 100}% - ${f * 36}px)`;
}
function setStatus(text, ok) {
  $("statusText").textContent = text;
  $("status").classList.toggle("cleared", !!ok);
}

// Load a puzzle
function loadPuzzle(i) {
  current = i;
  solved = false;
  const p = PUZZLES[i];
  const encrypted = caesar(p.plain, p.shift);

  $("zoneTitle").textContent = `Zone ${i + 1} of ${PUZZLES.length}`;
  $("zoneName").textContent = p.name;
  $("difficulty").textContent = p.level;
  $("cipherText").dataset.text = encrypted;
  $("cipherText").classList.remove("decoded");
  scramble($("cipherText"), encrypted, 1000);
  $("hint").textContent = "Hint: " + p.hint;
  $("hint").classList.remove("show");
  $("hintBtn").textContent = "Show hint";
  $("copyBtn").textContent = "Copy cipher";
  $("copyBtn").classList.remove("copied");
  $("result").className = "result";
  $("proceed").classList.remove("show");
  $("answer").value = "";
  $("answer").disabled = false;
  $("decryptBtn").disabled = false;
  $("proceed").textContent = i === PUZZLES.length - 1 ? "RUN UNLOCK SEQUENCE" : "OPEN NEXT DOOR";
  $("mission").style.display = "";
  $("finish").classList.remove("show");

  setWheel(0);
  setStatus("Door locked");
  updateProgress();
  log(`Zone ${i + 1} online. Door lock engaged: ${p.name}.`, "sys");
  $("answer").focus({ preventScroll: true });
}

// Check the answer
function decrypt() {
  if (solved) return;
  const guess = clean($("answer").value);
  if (!guess) {
    $("result").className = "result show bad";
    $("result").textContent = "ENTER A DECODED MESSAGE";
    $("answer").focus();
    return;
  }
  const result = $("result");
  result.className = "result show";
  void result.offsetWidth; 

  if (guess === clean(PUZZLES[current].plain)) {
    solved = true;
    cleared = Math.max(cleared, current + 1);
    writeSave();
    result.className = "result show ok";
    scramble(result, "ACCESS GRANTED", 500);
    
    $("cipherText").classList.add("decoded");
    scramble($("cipherText"), PUZZLES[current].plain, 800);
    glitch($("cipherText"));
    $("answer").disabled = true;
    $("decryptBtn").disabled = true;
    $("proceed").classList.add("show");
    setStatus("Door unlocked", true);
    log("Cipher broken. Access granted.", "ok");
    updateProgress();
  } else {
    result.className = "result show bad";
    scramble(result, "ACCESS DENIED", 400);
    glitch($("cipherText"));
    glitch(document.querySelector("#mission .card"), 420);
    log("Decryption failed. Check your shift and try again.", "bad");
  }
}

function completeMission() {
  if (FINAL_PAGE_URL) { window.location.href = FINAL_PAGE_URL; return; }
  $("mission").style.display = "none";
  $("finish").classList.add("show");
  $("finish").classList.remove("doors-opening");
  void $("finish").offsetWidth;
  $("finish").classList.add("doors-opening");
  writeSave();
  setStatus("Mission complete", true);
  log("All zones cleared. Mission page unlocked (demo).", "ok");
}

function continueToNextLevel() {
  if (current === PUZZLES.length - 1) { completeMission(); return; }
  const mission = $("mission");
  mission.style.display = "";
  mission.classList.add("stage-out");
  setTimeout(() => {
    loadPuzzle(current + 1);
    mission.classList.remove("stage-out", "stage-in");
    void mission.offsetWidth;
    mission.classList.add("stage-in");
  }, 180);
}

// Finish and unlock
function proceed() {
  const overlay = $("overlay");
  const last = current === PUZZLES.length - 1;
  $("overlayText").textContent = last ? "Opening final containment doors..." : `Opening door to zone ${current + 2}...`;
  overlay.classList.remove("opening");
  overlay.classList.add("show");
  document.body.classList.add("flythrough");
  setTimeout(() => overlay.classList.add("opening"), 250);

  setTimeout(() => {
    overlay.classList.remove("show", "opening");
    document.body.classList.remove("flythrough");
    continueToNextLevel();
  }, 1550);
}

// Event listeners
$("decryptBtn").addEventListener("click", decrypt);
$("answer").addEventListener("keydown", e => { if (e.key === "Enter") decrypt(); });
$("hintBtn").addEventListener("click", () => {
  const show = $("hint").classList.toggle("show");
  $("hintBtn").textContent = show ? "Hide hint" : "Show hint";
  if (show && !solved) log("Hint accessed.", "sys");
});
$("minus").addEventListener("click", () => setWheel(wheelShift - 1));
$("plus").addEventListener("click", () => setWheel(wheelShift + 1));
$("proceed").addEventListener("click", proceed);
$("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("cipherText").dataset.text || "");
    $("copyBtn").textContent = "Copied!";
    $("copyBtn").classList.add("copied");
    log("Encrypted transmission copied to clipboard.", "ok");
  } catch {
    $("copyBtn").textContent = "Copy unavailable";
    log("Clipboard access is unavailable in this browser.", "bad");
  }
});
$("resetBtn").addEventListener("click", () => {
  if (!confirm("Reset all saved mission progress?")) return;
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  current = 0; cleared = 0; solved = false;
  loadPuzzle(0);
  log("Mission reset. All zones are locked again.", "sys");
});
document.addEventListener("keydown", e => {
  if (e.target === $("answer")) return;
  if (e.key === "ArrowLeft") setWheel(wheelShift - 1);
  if (e.key === "ArrowRight") setWheel(wheelShift + 1);
});

// Drifting dust in the lab light
(function dust() {
  const c = $("stars"), ctx = c.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let motes = [], previous = 0;
  function resize() {
    c.width = innerWidth; c.height = innerHeight;
    motes = Array.from({ length: Math.round(innerWidth * innerHeight / 14000) }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      r: Math.random() * 1.4 + .3, a: Math.random() * .35 + .08,
      dx: (Math.random() - .5) * 6, dy: -(Math.random() * 7 + 2),
      tint: Math.random() < .3 ? "127,211,255" : "174,177,185"
    }));
  }
  function draw(t) {
    const delta = previous ? Math.min((t - previous) / 1000, .05) : 0;
    previous = t;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const m of motes) {
      if (!reduce) {
        m.x += m.dx * delta; m.y += m.dy * delta;
        if (m.y < -5) { m.y = c.height + 5; m.x = Math.random() * c.width; }
        if (m.x < -5) m.x = c.width + 5; else if (m.x > c.width + 5) m.x = -5;
      }
      ctx.fillStyle = `rgba(${m.tint},${m.a})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.28); ctx.fill();
    }
    if (!reduce) requestAnimationFrame(draw);
  }
  addEventListener("resize", resize);
  resize(); draw(0);
})();

// Look around the corridor with the pointer
document.addEventListener("pointermove", e => {
  document.body.style.setProperty("--px", (e.clientX / innerWidth - .5).toFixed(3));
  document.body.style.setProperty("--py", (e.clientY / innerHeight - .5).toFixed(3));
});

// Let the corridor drift a few pixels as the page scrolls, keeping the depth
// effect subtle on touch devices and inexpensive on long pages.
let scrollFrame = 0;
function updateScrollDepth() {
  scrollFrame = 0;
  const shift = Math.min(window.scrollY, 1400) * -0.035;
  document.body.style.setProperty("--scroll-shift", `${shift.toFixed(2)}px`);
}
addEventListener("scroll", () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollDepth);
}, { passive: true });
updateScrollDepth();

// A little ambient signal noise keeps the interface feeling alive without
// competing with the puzzle controls.
if (!reduceMotion) {
  const glitchTargets = [$("cipherText"), document.querySelector(".hero"), ...document.querySelectorAll("#mission .card")];
  setInterval(() => {
    const target = glitchTargets[Math.floor(Math.random() * glitchTargets.length)];
    if (target && Math.random() > .25) glitch(target, 220 + Math.random() * 260);
  }, 4200);
}

// Start the interface
buildWheel();
buildTrack();
loadPuzzle(current);
if (cleared === PUZZLES.length) {
  $("mission").style.display = "none";
  $("finish").classList.add("show");
  $("finish").classList.add("doors-opening");
  setStatus("Mission complete", true);
}
log("Cipher Breach v0.6 online. Welcome aboard.", "sys");
