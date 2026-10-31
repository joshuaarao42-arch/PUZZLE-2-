const FINAL_PAGE_URL = "";

const PUZZLES = [
  { name: "Launch window",   level: "Cadet",     shift: 3,  plain: "JOIN THE MISSION",
    hint: "Julius Caesar liked small shifts. Try a shift of 3." },
  { name: "Orbital relay",   level: "Navigator", shift: 7,  plain: "CODE BEYOND THE STARS",
    hint: "The shift is the number of days in a week." },
  { name: "Deep signal",     level: "Pilot",     shift: 13, plain: "ORBIT THE UNKNOWN",
    hint: "This shift is exactly halfway around the 26-letter alphabet. Applying it twice returns the original." },
  { name: "Dark nebula",     level: "Commander", shift: 11, plain: "THE SIGNAL IS HIDDEN IN PLAIN SIGHT",
    hint: "No shift given. Spot the two-letter word: IS was encrypted as TD. How far did I move?" },
  { name: "Mission control", level: "Admiral",   shift: 9,  plain: "WELCOME TO THE ACM USTP CDO MISSION CONTROL",
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
let elapsedSeconds = 0;
let totalAttempts = 0;
let attemptsThisPuzzle = 0;
let score = 0;
let hintUsed = false;
let bestTime = null;
const SAVE_KEY = "acm-cipher-breach-progress-v1";

function readSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!saved || saved.version !== 1) return null;
    return saved;
  } catch { return null; }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, cleared, bestTime })); }
  catch { /* Storage may be unavailable in private browsing. */ }
}
function formatTime(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
function updateStats() {
  $("timer").textContent = formatTime(elapsedSeconds);
  $("attempts").textContent = totalAttempts;
  $("score").textContent = score.toLocaleString();
  $("bestTime").textContent = bestTime == null ? "--:--" : formatTime(bestTime);
}
const savedProgress = readSave();
if (savedProgress) {
  cleared = Math.max(0, Math.min(PUZZLES.length, Number(savedProgress.cleared) || 0));
  bestTime = Number.isFinite(savedProgress.bestTime) ? savedProgress.bestTime : null;
}
current = Math.min(cleared, PUZZLES.length - 1);
setInterval(() => {
  if (cleared < PUZZLES.length) elapsedSeconds++;
  updateStats();
}, 1000);

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
  let svg = `<circle cx="120" cy="120" r="112" fill="rgba(3,8,28,.6)" stroke="rgba(76,195,255,.4)"/>
             <circle cx="120" cy="120" r="86" fill="none" stroke="rgba(139,92,246,.45)"/>
             <circle cx="120" cy="120" r="58" fill="rgba(5,8,22,.8)" stroke="rgba(120,150,255,.25)"/>
             <text x="120" y="114" fill="#9aa7d1" style="font-size:7px">ENCRYPTED OUTSIDE</text>
             <text x="120" y="127" fill="#9aa7d1" style="font-size:7px">DECODED INSIDE</text>`;
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
  attemptsThisPuzzle = 0;
  const p = PUZZLES[i];
  const encrypted = caesar(p.plain, p.shift);

  $("sectorTitle").textContent = `Sector ${i + 1} of ${PUZZLES.length}`;
  $("sectorName").textContent = p.name;
  $("difficulty").textContent = p.level;
  $("cipherText").dataset.text = encrypted;
  $("cipherText").classList.remove("decoded");
  scramble($("cipherText"), encrypted, 1000);
  $("hint").textContent = "Hint: " + p.hint;
  $("hint").classList.remove("show");
  $("hintBtn").textContent = "Show hint";
  hintUsed = false;
  $("copyBtn").textContent = "Copy cipher";
  $("copyBtn").classList.remove("copied");
  $("result").className = "result";
  $("proceed").classList.remove("show");
  $("answer").value = "";
  $("answer").disabled = false;
  $("decryptBtn").disabled = false;
  $("proceed").textContent = i === PUZZLES.length - 1 ? "RUN UNLOCK SEQUENCE" : "PROCEED TO NEXT PAGE";
  $("mission").style.display = "";
  $("finish").classList.remove("show");

  setWheel(0);
  setStatus("Awaiting decryption");
  updateProgress();
  updateStats();
  log(`Sector ${i + 1} online. Incoming transmission: ${p.name}.`, "sys");
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
  totalAttempts++;
  attemptsThisPuzzle++;
  const result = $("result");
  result.className = "result show";
  void result.offsetWidth; 

  if (guess === clean(PUZZLES[current].plain)) {
    solved = true;
    const sectorReward = Math.max(250, 1000 - ((attemptsThisPuzzle - 1) * 100) - (hintUsed ? 100 : 0));
    window.lastSectorReward = sectorReward;
    cleared = Math.max(cleared, current + 1);
    score += sectorReward;
    writeSave();
    result.className = "result show ok";
    scramble(result, "ACCESS GRANTED", 500);
    
    $("cipherText").classList.add("decoded");
    scramble($("cipherText"), PUZZLES[current].plain, 800);
    glitch($("cipherText"));
    $("answer").disabled = true;
    $("decryptBtn").disabled = true;
    $("proceed").classList.add("show");
    setStatus("Sector cleared", true);
    log("Cipher broken. Access granted.", "ok");
    updateProgress();
    updateStats();
  } else {
    score = Math.max(0, score - 25);
    updateStats();
    result.className = "result show bad";
    scramble(result, "ACCESS DENIED", 400);
    glitch($("cipherText"));
    glitch(document.querySelector("#mission .card"), 420);
    log("Decryption failed. Check your shift and try again.", "bad");
  }
}

// Post-unlock field report
function showDebrief(last) {
  const p = PUZZLES[current];
  const attempts = attemptsThisPuzzle;
  const rating = attempts === 1 && !hintUsed ? "S" : attempts <= 2 && !hintUsed ? "A" : attempts <= 3 ? "B" : "C";
  $("debriefTitle").textContent = last ? "Final sector secured" : "Sector secured";
  $("debriefSector").textContent = `SECTOR ${current + 1} · ${p.name.toUpperCase()} · ${p.level.toUpperCase()}`;
  $("debriefMessage").textContent = p.plain;
  $("debriefAttempts").textContent = attempts;
  $("debriefReward").textContent = `+${(window.lastSectorReward || 0).toLocaleString()}`;
  $("debriefRating").textContent = rating;
  $("debriefNote").textContent = hintUsed
    ? "Intel recovered. You used a hint, but the mission is still moving forward."
    : attempts === 1
      ? "Clean decode. No hints, no retries. Excellent signal work."
      : `Signal stabilized after ${attempts} attempts. The next transmission is ready when you are.`;
  $("debriefNext").textContent = last ? "VIEW MISSION COMPLETE" : `ENTER SECTOR ${current + 2}`;
  $("mission").style.display = "none";
  $("finish").classList.remove("show");
  $("debrief").classList.add("show");
  setStatus("Field report ready", true);
  log(`Sector ${current + 1} report generated. Recovery rating: ${rating}.`, "ok");
}

function completeMission() {
  if (FINAL_PAGE_URL) { window.location.href = FINAL_PAGE_URL; return; }
  $("debrief").classList.remove("show");
  $("mission").style.display = "none";
  $("finish").classList.add("show");
  if (bestTime == null || elapsedSeconds < bestTime) bestTime = elapsedSeconds;
  writeSave();
  updateStats();
  setStatus("Mission complete", true);
  log("All sectors cleared. Mission page unlocked (demo).", "ok");
}

function continueDebrief() {
  const last = current === PUZZLES.length - 1;
  $("debrief").classList.remove("show");
  if (last) { completeMission(); return; }
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
  $("overlayText").textContent = last ? "Unlocking ACM website sample..." : `Unlocking sector ${current + 2}...`;
  overlay.classList.add("show");
  glitch(overlay.querySelector(".box"), 700);

  setTimeout(() => {
    overlay.classList.remove("show");
    showDebrief(last);
  }, 1500);
}

// Event listeners
$("decryptBtn").addEventListener("click", decrypt);
$("answer").addEventListener("keydown", e => { if (e.key === "Enter") decrypt(); });
$("hintBtn").addEventListener("click", () => {
  const show = $("hint").classList.toggle("show");
  $("hintBtn").textContent = show ? "Hide hint" : "Show hint";
  if (show && !hintUsed && !solved) {
    hintUsed = true;
    score = Math.max(0, score - 100);
    updateStats();
    log("Hint accessed. Score penalty: 100 points.", "sys");
  }
});
$("minus").addEventListener("click", () => setWheel(wheelShift - 1));
$("plus").addEventListener("click", () => setWheel(wheelShift + 1));
$("proceed").addEventListener("click", proceed);
$("debriefNext").addEventListener("click", continueDebrief);
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
  elapsedSeconds = 0; totalAttempts = 0; score = 0; hintUsed = false; bestTime = null;
  loadPuzzle(0);
  updateStats();
  log("Mission reset. All sectors are locked again.", "sys");
});
document.addEventListener("keydown", e => {
  if (e.target === $("answer")) return;
  if (e.key === "ArrowLeft") setWheel(wheelShift - 1);
  if (e.key === "ArrowRight") setWheel(wheelShift + 1);
});

// Starfield
(function stars() {
  const c = $("stars"), ctx = c.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let list = [], galaxy = [], previousFrame = 0;
  function resize() {
    c.width = innerWidth; c.height = innerHeight;
    list = Array.from({ length: Math.round(innerWidth * innerHeight / 7000) }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      r: Math.random() * 1.25 + .25, p: Math.random() * 6.28, s: Math.random() * .02 + .005,
      dx: (Math.random() - .5) * 3.2, dy: (Math.random() - .5) * 3.2,
      hue: Math.random() < .25 ? "180,150,255" : "190,220,255"
    }));
    // Scatter stars along a tilted band.
    galaxy = Array.from({ length: Math.min(2800, Math.round(innerWidth * innerHeight / 620)) }, () => {
      const x = (Math.random() * 2 - 1) * (Math.random() < .18 ? 1.2 : 1);
      const gaussian = (Math.random() + Math.random() + Math.random() - 1.5) * .105;
      const y = gaussian + .11 * x * x;
      const dustLane = Math.abs(gaussian) < .027 && Math.random() < .62;
      return {
        x, y,
        r: Math.random() * 1.25 + .16,
        a: Math.random() * .5 + .18,
        dust: dustLane,
        tint: Math.random() < .2 ? "220,232,255" : "255,255,255"
      };
    });
  }
  function draw(t) {
    ctx.clearRect(0, 0, c.width, c.height);
    const seconds = t / 1000;
    const delta = previousFrame ? Math.min((t - previousFrame) / 1000, .05) : 0;
    previousFrame = t;
    const gx = c.width * (.65 + Math.sin(seconds * .035) * .018);
    const gy = c.height * (.42 + Math.cos(seconds * .028) * .018);
    const radius = Math.min(c.width * .72, c.height * 1.05);

    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(-.38 + seconds * .002);
    ctx.scale(radius, radius * .72);
    ctx.globalCompositeOperation = "screen";
    const core = ctx.createRadialGradient(0, 0, .008, 0, 0, .95);
    core.addColorStop(0, "rgba(255,255,255,.28)");
    core.addColorStop(.12, "rgba(238,244,255,.18)");
    core.addColorStop(.38, "rgba(220,232,255,.09)");
    core.addColorStop(.8, "rgba(190,210,255,.025)");
    core.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, .82, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(5,8,22,.3)";
    ctx.beginPath();
    ctx.moveTo(-1.08, -.055);
    ctx.quadraticCurveTo(0, .012, 1.08, .085);
    ctx.lineTo(1.08, .115);
    ctx.quadraticCurveTo(0, .045, -1.08, -.025);
    ctx.closePath();
    ctx.fill();
    for (const p of galaxy) {
      const shimmer = .74 + .26 * Math.sin(seconds * .7 + p.x * 13 + p.y * 9);
      if (p.dust) {
        ctx.fillStyle = `rgba(5,8,22,${p.a * .58})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r / radius * 2.2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = `rgba(${p.tint},${p.a * shimmer})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r / radius, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    for (const s of list) {
      if (!reduce) {
        s.x += s.dx * delta;
        s.y += s.dy * delta;
        if (s.x < 0) s.x = c.width; else if (s.x > c.width) s.x = 0;
        if (s.y < 0) s.y = c.height; else if (s.y > c.height) s.y = 0;
      }
      const a = .35 + .65 * Math.abs(Math.sin(s.p + t * s.s * .06));
      ctx.fillStyle = `rgba(${s.hue},${a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill();
    }
    if (!reduce) requestAnimationFrame(draw);
  }
  addEventListener("resize", resize);
  resize(); draw(0);
})();

// Start the interface
buildWheel();
buildTrack();
loadPuzzle(current);
if (cleared === PUZZLES.length) {
  $("mission").style.display = "none";
  $("finish").classList.add("show");
  setStatus("Mission complete", true);
}
log("Cipher Breach v0.2 initialised. Link to ACM relay established.", "sys");
