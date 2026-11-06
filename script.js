'use strict';

const $ = id => document.getElementById(id);
const isAddr = s => /^0x[a-fA-F0-9]{40}$/.test(s);

function setText(id, txt) { const e = $(id); if (e) e.textContent = txt; }
function bindClick(id, fn) { const e = $(id); if (e) e.onclick = fn; else console.warn('v26: elemen #' + id + ' tidak ada di HTML, dilewati (bukan crash)'); }
let lastAnthem = null;

let playMode = 'free';
let challengeCode = null;
function todayStr(d) { const t = d || new Date(); const p = n => String(n).padStart(2, '0'); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; }
function yesterdayStr() { const t = new Date(); t.setDate(t.getDate() - 1); return todayStr(t); }
function seedKeyFor(mode) {
  if (mode === 'daily') return 'DAILY-' + todayStr();
  if (mode === 'challenge' && challengeCode) return challengeCode;
  return 'FREE-' + Math.floor(Math.random() * 1e9);
}
function walletKey(w) { return (w || 'GUEST').toLowerCase(); }
function loadJSON(k, fb) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v === null ? fb : v; } catch { return fb; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

const XP_LEVELS = [0, 100, 250, 500, 900, 1500, 2500, 4000];
function totalXP(w) { return loadJSON('sqk24:xp:' + walletKey(w), 0) | 0; }
function levelFor(xp) { let lv = 1; for (let i = 0; i < XP_LEVELS.length; i++) if (xp >= XP_LEVELS[i]) lv = i + 1; return lv; }

const MISSION_POOL = [
  { id: 'acc95', text: 'Akurasi >= 95%', check: r => r.acc >= 95 },
  { id: 'combo50', text: 'Combo >= 50', check: r => r.maxCombo >= 50 },
  { id: 'miss0', text: '0 Miss dalam satu lagu', check: r => r.miss === 0 },
  { id: 'score5000', text: 'Skor >= 5000', check: r => r.score >= 5000 },
  { id: 'perfect30', text: 'Perfect >= 30', check: r => r.perfect >= 30 },
  { id: 'hard', text: 'Selesaikan satu lagu di HARD', check: r => r.diff === 'hard' },
];
function dailyMissions(dateStr) {
  const r = rng(cyrb53('MISSION-' + dateStr));
  const pool = MISSION_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}
function missionsDoneKey(w) { return 'sqk24:missions:' + walletKey(w) + ':' + todayStr(); }

let hitOffsets = [];
let quality = 'ultra';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let muted = false;

function say(t, c) { const el = $('message'); if (!el) return; el.textContent = t; el.style.color = c ? `var(--${c})` : ''; }
function show(id) { ['mainPanel', 'gamePanel', 'resultPanel'].forEach(p => $(p).classList.toggle('hidden', p !== id)); }
window.addEventListener('error', (e) => { try { say('ERROR: ' + String(e.message || e.error || 'unknown').slice(0, 80), 'pink'); } catch (_) {} });

// ==========================================
// 1. WEBGL BACKGROUND
// ==========================================
const glCanvas = document.getElementById('bg-gl');
let gl = null, prog = null, glSeed = 0, glAudio = 0, glGlitch = 0, glShockwave = 0, glCombo = 0;
let uRes = null, uTime = null, uSeed = null, uAudio = null, uGlitch = null, uShock = null, uCombo = null;
let glRunning = false;

function compileShader(glCtx, type, src) {
  const s = glCtx.createShader(type); glCtx.shaderSource(s, src); glCtx.compileShader(s);
  if (!glCtx.getShaderParameter(s, glCtx.COMPILE_STATUS)) { console.warn(glCtx.getShaderInfoLog(s)); return null; }
  return s;
}

function initGL() {
  try {
    gl = glCanvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }) || glCanvas.getContext('experimental-webgl');
    if (!gl) throw new Error('no-webgl');
    const vsSource = `attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution; uniform float u_time; uniform float u_seed;
      uniform float u_audio; uniform float u_glitch; uniform float u_shock; uniform float u_combo;
      float map(vec3 p) {
          float s = u_seed; p.xz = mat2(cos(s), -sin(s), sin(s), cos(s)) * p.xz;
          float pulse = 1.0 + sin(u_time * 3.0) * 0.1 + u_audio * 0.5;
          float sphere = length(p) - (1.0 * pulse);
          float torus = length(vec2(length(p.xz)-1.5, p.y)) - 0.2;
          float shape = mix(sphere, torus, fract(s));
          shape += sin(p.x * 10.0 + u_time * 5.0) * u_glitch * 0.2;
          return shape;
      }
      void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
          float dist = length(uv);
          float ripple = sin(dist * 20.0 - u_time * 10.0) * u_shock * 0.1;
          uv += (dist > 0.001 ? normalize(uv) : vec2(0.0)) * ripple;
          vec3 ro = vec3(0.0, 0.0, -3.0 - u_audio * 0.5);
          vec3 rd = normalize(vec3(uv, 1.0));
          float t = 0.0;
          for(int i = 0; i < 48; i++) {
              vec3 p = ro + rd * t; float d = map(p);
              if(d < 0.001 || t > 20.0) break; t += d * 0.8;
          }
          vec3 col = vec3(0.0);
          if (t < 20.0) {
              vec3 p = ro + rd * t;
              float e = 0.01;
              float d0 = map(p);
              vec3 n = normalize(vec3(map(p+vec3(e,0.,0.))-d0, map(p+vec3(0.,e,0.))-d0, map(p+vec3(0.,0.,e))-d0));
              float diff = max(dot(n, normalize(vec3(1.0, 1.0, -1.0))), 0.0);
              vec3 c1 = vec3(0.0, 1.0, 0.0); vec3 c2 = vec3(1.0, 0.0, 1.0);
              if (u_combo > 20.0) c1 = vec3(0.0, 1.0, 1.0);
              if (u_combo > 50.0) c2 = vec3(1.0, 1.0, 0.0);
              col = mix(c1, c2, n.x * 0.5 + 0.5) * diff;
          }
          if(u_glitch > 0.0) { col.r = mix(col.r, 1.0, u_glitch); col += vec3(sin(uv.y * 50.0) * u_glitch); }
          gl_FragColor = vec4(col, 1.0);
      }
    `;
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) throw new Error('shader-failed');
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link-failed');
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, 'position'); gl.enableVertexAttribArray(posLoc); gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    uRes = gl.getUniformLocation(prog, 'u_resolution'); uTime = gl.getUniformLocation(prog, 'u_time'); uSeed = gl.getUniformLocation(prog, 'u_seed'); uAudio = gl.getUniformLocation(prog, 'u_audio'); uGlitch = gl.getUniformLocation(prog, 'u_glitch'); uShock = gl.getUniformLocation(prog, 'u_shock'); uCombo = gl.getUniformLocation(prog, 'u_combo');
    resizeGL(); window.addEventListener('resize', resizeGL); glRunning = true; requestAnimationFrame(renderGL); setText('glStatus', 'WEBGL: OK • QLTY: ' + quality.toUpperCase() + ' • BACKGROUND 3D BERGERAK');
  } catch (err) { gl = null; glRunning = false; document.body.classList.add('no-gl'); setText('glStatus', 'WEBGL: GAGAL — BACKGROUND GRADIENT + GRID CSS (TETAP BERGERAK) • QLTY: ' + quality.toUpperCase()); }
}
function resizeGL() { if (!gl) return; const scale = 0.66; const dpr = Math.min(1.5, window.devicePixelRatio || 1); glCanvas.width = Math.max(2, Math.floor(window.innerWidth * dpr * scale)); glCanvas.height = Math.max(2, Math.floor(window.innerHeight * dpr * scale)); gl.viewport(0, 0, glCanvas.width, glCanvas.height); }
let lastGlFrame = 0;
function renderGL(time) {
  if (!glRunning || !gl) return; requestAnimationFrame(renderGL);
  if (document.hidden) return; if (prefersReducedMotion && time - lastGlFrame < 66) return; lastGlFrame = time;
  gl.uniform2f(uRes, glCanvas.width, glCanvas.height); gl.uniform1f(uTime, time * 0.001); gl.uniform1f(uSeed, glSeed); gl.uniform1f(uAudio, prefersReducedMotion ? 0 : glAudio); gl.uniform1f(uGlitch, prefersReducedMotion ? 0 : glGlitch); gl.uniform1f(uShock, prefersReducedMotion ? 0 : glShockwave); gl.uniform1f(uCombo, glCombo);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); glGlitch *= 0.95; glShockwave *= 0.92;
}
initGL();

function setQuality(q) {
  quality = q; const b = $('qualityBtn'); if (b) b.textContent = q === 'ultra' ? 'QLTY: ULTRA' : 'QLTY: HEMAT';
  document.body.classList.toggle('hemat', q === 'hemat');
  if (q === 'hemat') { glRunning = false; document.body.classList.add('no-gl'); }
  else { document.body.classList.remove('no-gl'); if (gl && !glRunning) { glRunning = true; requestAnimationFrame(renderGL); } }
  setText('glStatus', 'WEBGL: ' + (gl ? 'OK' : 'GAGAL') + ' • QLTY: ' + q.toUpperCase() + (q === 'hemat' ? ' • BACKGROUND: GRADIENT DIAM' : ' • BACKGROUND: 3D / GRID BERGERAK'));
  say('QLTY: ' + q.toUpperCase() + (q === 'hemat' ? ' — WebGL dimatikan, background gradient diam.' : ' — WebGL / grid bergerak.'), 'cyan');
  try { localStorage.setItem('sqk-quality', q); } catch (_) {}
}
try { const savedQ = localStorage.getItem('sqk-quality'); if (savedQ === 'hemat') quality = 'hemat'; } catch (_) {}
if (quality === 'hemat') setQuality('hemat');

// ==========================================
// 2. WEB3 & API
// ==========================================
class CircuitBreaker {
  constructor(threshold = 3, timeout = 10000) { this.threshold = threshold; this.timeout = timeout; this.fails = 0; this.state = 'CLOSED'; this.next = Date.now(); }
  async execute(fn) { if (this.state === 'OPEN') { if (Date.now() > this.next) this.state = 'HALF_OPEN'; else throw new Error('CIRCUIT_OPEN'); } try { const res = await fn(); this.fails = 0; this.state = 'CLOSED'; return res; } catch (e) { this.fails++; if (this.fails >= this.threshold) { this.state = 'OPEN'; this.next = Date.now() + this.timeout; } throw e; } }
}
const rpcBreaker = new CircuitBreaker(3, 10000);
const CONFIG = { API_URL: 'https://api.squeekchain.com/v1/status', RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com', TOKEN: '0x810239d271e80a86023f4f315943acbd65b59281', BARS: 32, LEAD_IN: 2, HIT_Y: 450, SPEED: 350, W: { perfect: .045, great: .09, good: .135 } };
const DIFFICULTIES = { easy: { speed: 350, density: 0.4, chord: 0.0 }, normal: { speed: 480, density: 0.7, chord: 0.1 }, hard: { speed: 600, density: 0.9, chord: 0.25 } };
const GENRES = { cyber: { scales: ['Phrygian', 'Harmonic Minor', 'Minor Pentatonic'], bpm: 120 }, synth: { scales: ['Dorian', 'Major Pentatonic'], bpm: 100 }, chip: { scales: ['Major Pentatonic', 'Dorian'], bpm: 140 } };
let currentDiff = 'easy', currentGenre = 'cyber';

function bindToggle(rowId, attr, cb) { document.querySelectorAll(`#${rowId} .btn-diff`).forEach(b => b.addEventListener('click', () => { document.querySelectorAll(`#${rowId} .btn-diff`).forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('active'); b.setAttribute('aria-pressed', 'true'); cb(b.dataset[attr]); })); }
bindToggle('diffRow', 'diff', v => { currentDiff = v; preview(); });
bindToggle('genreRow', 'genre', v => { currentGenre = v; preview(); });

function cyrb53(str, seed = 0) { let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677) } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return 4294967296 * (2097151 & h2) + (h1 >>> 0) }
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const seedOf = w => cyrb53((w || 'GUEST').toLowerCase());
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = { 'Minor Pentatonic': [0, 3, 5, 7, 10], 'Dorian': [0, 2, 3, 5, 7, 9, 10], 'Phrygian': [0, 1, 3, 5, 7, 8, 10], 'Major Pentatonic': [0, 2, 4, 7, 9], 'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11] };

function makeAnthem(wallet, randomize = false, seedOverride = null) {
  let seed = seedOverride ? cyrb53(seedOverride) : seedOf(wallet);
  if (randomize && !seedOverride) seed += Math.floor(Math.random() * 999999);
  const r = rng(seed), genreInfo = GENRES[currentGenre];
  const scaleName = genreInfo.scales[Math.floor(r() * genreInfo.scales.length)];
  const scale = SCALES[scaleName], root = Math.floor(r() * 12);
  const bpm = genreInfo.bpm + Math.floor(r() * 20) - 10, step = 60 / bpm / 4, span = scale.length * 2;
  const chart = [], drums = [], diff = DIFFICULTIES[currentDiff]; let lastT = -1;
  for (let bar = 0; bar < CONFIG.BARS; bar++) {
    for (let s = 0; s < 16; s++) {
      const t = (bar * 16 + s) * step;
      drums.push({ t, kick: s % 4 === 0 || (s === 10 && r() < .3), hat: s % 2 === 0, snare: s === 4 || s === 12, bass: s % 8 === 0 ? [0, 3, 4, 5, 2][Math.floor(r() * 5)] % scale.length : null });
      const onBeat = s % 4 === 0, onEighth = s % 2 === 0;
      const want = bar < 2 ? (onBeat && s % 8 === 0) : (onEighth ? r() < diff.density : (onBeat && r() < diff.density * 1.2));
      if (want && (t - lastT > 0.25)) {
        let deg = Math.floor(r() * span);
        const midi = 60 + root + scale[deg % scale.length] + 12 * Math.floor(deg / scale.length);
        const lane = Math.min(2, Math.floor(deg / span * 3));
        chart.push({ t, lane, midi, judged: null }); lastT = t;
        if (s % 4 === 0 && r() < diff.chord) chart.push({ t, lane: (lane + 1 + Math.floor(r() * 2)) % 3, midi: midi - 12, judged: null });
      }
    }
  }
  chart.sort((a, b) => a.t - b.t);
  return { bpm, step, scaleName, key: NOTE_NAMES[root], root, scale, chart, drums, duration: CONFIG.BARS * 16 * step, hue: Math.floor(r() * 360) };
}

// ==========================================
// 3. AUDIO ENGINE
// ==========================================
let ac = null, master = null, analyser = null, noiseBuf = null, audioDataArray = null;
let introOsc = null, introGain = null, introInterval = null;

async function initAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw new Error('Audio unsupported');
    ac = new AC({ latencyHint: 'interactive' });
    master = ac.createGain(); master.gain.value = muted ? 0 : .4;
    analyser = ac.createAnalyser(); analyser.fftSize = 64; audioDataArray = new Uint8Array(analyser.frequencyBinCount);
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(analyser); analyser.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * .3, ac.sampleRate); const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state !== 'running') await ac.resume();
}

function playIntroMusic() {
    if (!ac || muted) return;
    stopIntroMusic();
    introOsc = ac.createOscillator();
    introGain = ac.createGain();
    introOsc.type = 'triangle';
    introOsc.frequency.setValueAtTime(220, ac.currentTime);
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, ac.currentTime);
    introOsc.connect(filter); filter.connect(introGain); introGain.connect(master);
    introGain.gain.setValueAtTime(0, ac.currentTime);
    introGain.gain.linearRampToValueAtTime(0.15, ac.currentTime + 2);
    introOsc.start();
    let t = 0;
    introInterval = setInterval(() => {
        if(!ac || !filter || !introOsc) return;
        t += 0.1;
        filter.frequency.setTargetAtTime(800 + Math.sin(t) * 400, ac.currentTime, 0.1);
        introOsc.frequency.setTargetAtTime(220 + Math.sin(t*0.5) * 60, ac.currentTime, 0.1);
    }, 100);
    if ($('mainPanel') && !$('mainPanel').classList.contains('hidden')) say('INTRO: ON (220 Hz, TERDENGAR) — KETUK MUTE UNTUK MATI.', 'green');
}

function stopIntroMusic() {
    const oldOsc = introOsc, oldGain = introGain, oldInterval = introInterval;
    introOsc = null; introGain = null; introInterval = null;
    if (oldInterval) clearInterval(oldInterval);
    if (oldGain) {
        try { oldGain.gain.setTargetAtTime(0, ac.currentTime, 0.2); } catch (_) {}
        setTimeout(() => { try { oldOsc.stop(); oldOsc.disconnect(); } catch(e){} }, 600);
    }
}

function toggleMute() { 
    muted = !muted; 
    if (master) master.gain.value = muted ? 0 : .4; 
    const b = $('muteBtn'); if (b) { b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(muted)); } 
    if (!muted && !G) playIntroMusic(); else if (muted) stopIntroMusic();
    return muted; 
}

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, a, p, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d) }
function tone(f, t, ty, p, d) { if (!ac || muted) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t); o.connect(g); g.connect(master); env(g, t, .004, p, d); o.start(t); o.stop(t + d + .05) }
function kick(t) { if (!ac || muted) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .12); o.connect(g); g.connect(master); env(g, t, .002, .9, .18); o.start(t); o.stop(t + .25) }
function noise(t, hp, p, d) { if (!ac || muted) return; const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp; s.connect(f); f.connect(g); g.connect(master); env(g, t, .001, p, d); s.start(t); s.stop(t + d + .05) }
function getAudioLevel() { if (!analyser || muted) return 0; if (!audioDataArray) audioDataArray = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(audioDataArray); let s = 0; for (let i = 0; i < audioDataArray.length; i++) s += audioDataArray[i]; return (s / audioDataArray.length) / 255; }

window.addEventListener('pointerdown', () => { if(!ac) initAudio(); playIntroMusic(); }, {once: true});

// ==========================================
// 4. GAME ENGINE
// ==========================================
const cv = $('game-canvas'), cx = cv.getContext('2d');
const GW = 360, GH = 540, LANES = 3, LW = GW / LANES;
function fitCanvas(c, ctx, w, h, scale) { const d = scale || Math.min(2, window.devicePixelRatio || 1); c.width = Math.floor(w * d); c.height = Math.floor(h * d); c.style.width = '100%'; c.style.height = 'auto'; c.style.aspectRatio = `${w}/${h}`; ctx.setTransform(d, 0, 0, d, 0, 0); }
fitCanvas(cv, cx, GW, GH);

let G = null, raf = 0, sched = 0, anthem = null, floatTexts = [];
function loadBest(w) { try { return JSON.parse(localStorage.getItem('sqk20:' + (w || 'GUEST').toLowerCase()) || 'null') } catch { return null } }
function saveBest(w, rec) { try { localStorage.setItem('sqk20:' + (w || 'GUEST').toLowerCase(), JSON.stringify(rec)); return true; } catch (e) { return false; } }
const songTime = () => ac ? ac.currentTime - G.start : 0;

async function play() {
  if (G && !G.ended) return say('GAME SUDAH BERJALAN.', 'cyan');
  const w = $('walletInput').value.trim();
  if (w && !isAddr(w)) { $('walletInput').classList.add('invalid'); return say('INVALID WALLET ADDRESS.', 'pink'); }
  $('walletInput').classList.remove('invalid');
  try { await initAudio(); stopIntroMusic(); } catch (e) { return say('AUDIO GAGAL: ' + String(e.message || e).slice(0, 60), 'pink'); }
  const seedKey = seedKeyFor(playMode);
  anthem = makeAnthem(w, false, seedKey); lastAnthem = anthem; hitOffsets = []; CONFIG.SPEED = DIFFICULTIES[currentDiff].speed; applyHue(anthem.hue);
  glSeed = w ? Math.abs(cyrb53(w) % 1000) / 100 : Math.random() * 10;
  glShockwave = 1.0;

  G = { wallet: w, start: ac.currentTime + CONFIG.LEAD_IN, next: 0, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, fx: [], flash: [0, 0, 0], ended: false, paused: false, chartIdx: 0, mode: playMode, seedKey, genre: currentGenre, diff: currentDiff };
  floatTexts = [];
  show('gamePanel'); setText('bpmVal', anthem.bpm); setText('gameAudioStatus', 'AUDIO: RUNNING • ' + anthem.bpm + ' BPM • AC: ' + (ac ? ac.state : '-')); hud();
  setText('pauseBtn', '[ PAUSE ]');
  clearInterval(sched); sched = setInterval(schedule, 25);
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  cv.focus({ preventScroll: true });
}

function schedule() {
  if (!G || G.paused || G.ended || !ac) return;
  const ahead = ac.currentTime + .15;
  while (G.next < anthem.drums.length && G.start + anthem.drums[G.next].t < ahead) {
    const d = anthem.drums[G.next], t = G.start + d.t;
    if (d.kick) kick(t); if (d.hat) noise(t, 7000, .08, .04); if (d.snare) noise(t, 1500, .35, .12);
    if (d.bass !== null) tone(mtof(36 + anthem.root + anthem.scale[d.bass]), t, 'triangle', .35, anthem.step * 7);
    G.next++;
  }
}

function addFloatText(txt, color) { floatTexts.push({ txt, color, x: GW / 2, y: 250, life: 1.0 }); }

function judge(lane) {
  if (!G || G.ended || G.paused || !ac) return;
  const st = songTime(); let target = null, bd = Infinity;
  for (const n of anthem.chart) {
    if (n.judged || n.lane !== lane) continue;
    if (n.t - st > CONFIG.W.good + 0.05) break;
    const dt = Math.abs(n.t - st); if (dt < bd) { bd = dt; target = n; }
  }
  G.flash[lane] = 1;
  glShockwave = 0.5;
  if (!target || bd > CONFIG.W.good) return;
  updatePrecision((target.t - st) * 1000, 'hit');
  const k = bd <= CONFIG.W.perfect ? 'perfect' : bd <= CONFIG.W.great ? 'great' : 'good';
  target.judged = k; G.counts[k]++; G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
  const mult = Math.min(2, 1 + Math.floor(G.combo / 10) * .1);
  G.score += Math.round({ perfect: 300, great: 200, good: 100 }[k] * mult);
  tone(mtof(target.midi), ac.currentTime, 'square', k === 'perfect' ? .18 : .12, .22);
  if (k === 'perfect') { addFloatText('PERFECT!', '#00ff00'); juiceHit('perfect'); } else if (G.combo > 0 && G.combo % 10 === 0) addFloatText(`COMBO x${G.combo}!`, '#00ffff');
  if (G.combo === 25 || G.combo === 50 || G.combo === 100) addFloatText(`COMBO x${G.combo}!!`, '#ffff00');
  for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 150; G.fx.push({ x: lane * LW + LW / 2, y: CONFIG.HIT_Y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50, life: .4, c: k === 'perfect' ? '#00ff00' : '#ff00ff' }) }
  hud();
}

let lastLoopTs = 0;
function loop(ts) {
  if (!G || G.ended) return;
  if (G.paused) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, lastLoopTs ? (ts - lastLoopTs) / 1000 : 1 / 60);
  lastLoopTs = ts;
  glAudio = getAudioLevel(); updateViz();
  glCombo = G.combo;
  const st = songTime();
  while (G.chartIdx < anthem.chart.length) {
    const n = anthem.chart[G.chartIdx];
    if (n.judged) { G.chartIdx++; continue; }
    if (st - n.t > CONFIG.W.good) { n.judged = 'miss'; G.counts.miss++; G.combo = 0; addFloatText('MISS', '#ff00ff'); hud(); glGlitch = 0.5; juiceHit('miss'); updatePrecision(0, 'miss'); G.chartIdx++; continue; }
    break;
  }
  if (st > anthem.duration + .8) return finish();
  draw(st, dt);
}

function draw(st, dt) {
  dt = dt || 1 / 60;
  cx.clearRect(0, 0, GW, GH); cx.fillStyle = '#050505'; cx.fillRect(0, 0, GW, GH);
  cx.save(); cx.beginPath(); cx.rect(0, 0, GW, GH); cx.clip();
  const spb = 60 / anthem.bpm, beat = ((st / spb) % 1 + 1) % 1, pulse = st > 0 ? Math.max(0, 1 - beat * 4) : 0;
  for (let l = 0; l < LANES; l++) { const f = G.flash[l]; cx.globalAlpha = .05 + f * .2; cx.fillStyle = '#00ffff'; cx.fillRect(l * LW + 2, 0, LW - 4, GH); cx.globalAlpha = 1; G.flash[l] = Math.max(0, f - dt * 5) }
  cx.strokeStyle = '#333'; cx.lineWidth = 2; for (let l = 1; l < LANES; l++) { cx.beginPath(); cx.moveTo(l * LW, 0); cx.lineTo(l * LW, GH); cx.stroke() }
  cx.strokeStyle = 'rgba(255,255,255,0.1)'; cx.lineWidth = 1; for (let b = Math.ceil(st / spb); b < st / spb + GH / CONFIG.SPEED / spb + 1; b++) { const y = CONFIG.HIT_Y - (b * spb - st) * CONFIG.SPEED; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(GW, y); cx.stroke() }
  cx.globalAlpha = .2 + pulse * .3; cx.fillStyle = '#00ff00'; cx.fillRect(0, CONFIG.HIT_Y - 15, GW, 30); cx.globalAlpha = 1; cx.fillRect(0, CONFIG.HIT_Y - 2, GW, 4);
  for (const n of anthem.chart) { const y = CONFIG.HIT_Y - (n.t - st) * CONFIG.SPEED; if (y < -30) break; if (y > GH + 30 || (n.judged && n.judged !== 'miss')) continue; const x = n.lane * LW + LW / 2; cx.fillStyle = n.judged === 'miss' ? '#ff00ff' : ['#ff00ff', '#00ffff', '#ffff00'][n.lane]; cx.fillRect(Math.round(x - 35), Math.round(y - 12), 70, 24) }
  cx.restore();
  for (let i = G.fx.length - 1; i >= 0; i--) { const p = G.fx[i]; p.life -= dt; if (p.life <= 0) { G.fx.splice(i, 1); continue } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; cx.globalAlpha = Math.max(0, p.life * 1.5); cx.fillStyle = p.c; cx.fillRect(p.x | 0, p.y | 0, 4, 4) }
  cx.globalAlpha = 1; cx.textAlign = 'center';
  for (let i = floatTexts.length - 1; i >= 0; i--) { const t = floatTexts[i]; t.life -= dt * 1.5; t.y -= dt * 50; if (t.life <= 0) { floatTexts.splice(i, 1); continue } cx.globalAlpha = Math.min(1, t.life); cx.fillStyle = t.color; cx.font = '16px "Press Start 2P"'; cx.fillText(t.txt, t.x, t.y) }
  cx.globalAlpha = 1;
  if (st < 0) { cx.fillStyle = '#ffff00'; cx.font = '32px "Press Start 2P"'; cx.fillText(Math.ceil(-st), GW / 2, GH / 2) }
  if (G.paused) { cx.fillStyle = 'rgba(0,0,0,.75)'; cx.fillRect(0, 0, GW, GH); cx.fillStyle = '#fff'; cx.font = '16px "Press Start 2P"'; cx.fillText('SYSTEM PAUSED', GW / 2, GH / 2) }
  cx.fillStyle = '#00ff00'; cx.fillRect(0, 0, GW * Math.max(0, Math.min(1, st / anthem.duration)), 6);
}

function accuracy() { const c = G.counts, tot = c.perfect + c.great + c.good + c.miss; return tot ? (c.perfect * 300 + c.great * 200 + c.good * 100) / (tot * 300) * 100 : 100 }
const grade = (a, miss) => a >= 95 && miss === 0 ? 'SS' : a >= 95 ? 'S' : a >= 88 ? 'A' : a >= 75 ? 'B' : a >= 60 ? 'C' : 'D';
function hud() { $('scoreVal').textContent = G.score; $('comboVal').textContent = G.combo; $('accVal').textContent = accuracy().toFixed(1) + '%' }

function finish() {
  G.ended = true; clearInterval(sched); cancelAnimationFrame(raf);
  const a = accuracy(), g = grade(a, G.counts.miss), key = (G.wallet || 'GUEST').toLowerCase(), prev = loadBest(G.wallet);
  const rec = { score: G.score, acc: +a.toFixed(2), grade: g, maxCombo: G.maxCombo, at: Date.now() };
  const isNew = !prev || rec.score > prev.score;
  if (isNew) saveBest(G.wallet, rec);
  const avgOff = hitOffsets.length ? Math.round(hitOffsets.reduce((x, v) => x + v, 0) / hitOffsets.length) : null;
  const res = { score: G.score, acc: +a.toFixed(2), maxCombo: G.maxCombo, miss: G.counts.miss, perfect: G.counts.perfect, diff: G.diff, mode: G.mode, avgOff };
  const missions = dailyMissions(todayStr());
  const doneKey = missionsDoneKey(G.wallet);
  const doneBefore = loadJSON(doneKey, []);
  const newlyDone = missions.filter(m => !doneBefore.includes(m.id) && m.check(res)).map(m => m.id);
  if (newlyDone.length) saveJSON(doneKey, doneBefore.concat(newlyDone));
  
  // FIX FATAL: Memisahkan komentar agar bonus XP berjalan
  let xpGain = Math.round(G.score / 30); 
  if (a >= 95) xpGain += 50; else if (a >= 88) xpGain += 25;
  if (G.counts.miss === 0) xpGain += 30;
  xpGain += newlyDone.length * 25;

  const xpBefore = totalXP(G.wallet), xpAfter = xpBefore + xpGain;
  saveJSON('sqk24:xp:' + walletKey(G.wallet), xpAfter);
  const lvBefore = levelFor(xpBefore), lvAfter = levelFor(xpAfter);
  const histKey = 'sqk24:hist:' + walletKey(G.wallet);
  const hist = loadJSON(histKey, []);
  hist.push({ at: Date.now(), score: G.score, acc: +a.toFixed(2), avgOff, grade: g, genre: G.genre, diff: G.diff, mode: G.mode });
  saveJSON(histKey, hist.slice(-10));
  let streakTxt = '';
  if (G.mode === 'daily') {
    const sk = 'sqk24:streak:' + walletKey(G.wallet);
    const st = loadJSON(sk, { last: null, count: 0 });
    if (st.last !== todayStr()) { st.count = st.last === yesterdayStr() ? st.count + 1 : 1; st.last = todayStr(); saveJSON(sk, st); }
    streakTxt = ` • STREAK ${st.count} HARI`;
  }
  const xpEl = $('xpMsg'); if (xpEl) xpEl.textContent = `+${xpGain} XP • LV ${lvBefore} -> LV ${lvAfter}${lvAfter > lvBefore ? ' — LEVEL UP! AVATAR BEREVOLUSI' : ''} • TOTAL ${xpAfter} XP${streakTxt}`;
  const mr = $('missionResult'); if (mr) mr.innerHTML = missions.map(m => `<div class="mission${doneBefore.concat(newlyDone).includes(m.id) ? ' done' : ''}">${m.text}</div>`).join('');
  renderDailyBox(); renderMastery(); renderAvatarPreview(G.wallet);
  $('gradeVal').textContent = g; $('gradeVal').style.color = g.startsWith('S') ? 'var(--green)' : g === 'A' ? 'var(--cyan)' : 'var(--pink)';
  const c = G.counts;
  $('resultKv').innerHTML = `<span>SCORE</span><b>${G.score}</b><span>ACCURACY</span><b>${a.toFixed(2)}%</b><span>MAX COMBO</span><b>${G.maxCombo}</b><span>PERFECT/GREAT</span><b>${c.perfect}/${c.great}</b><span>GOOD/MISS</span><b>${c.good}/${c.miss}</b><span>ANTHEM</span><b>${anthem.key} ${anthem.scaleName}</b>`;
  $('bestMsg').textContent = isNew ? 'NEW HIGH SCORE!' : `BEST: ${prev.score} (${prev.grade})`;
  show('resultPanel'); playIntroMusic(); 
}
function stop() { if (G) { clearInterval(sched); cancelAnimationFrame(raf); if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); G = null; } show('mainPanel'); playIntroMusic(); }
async function pauseGame() { if (!G || G.ended) return; G.paused = true; setText('pauseBtn', '[ RESUME ]'); try { if (ac) await ac.suspend(); } catch (_) {} draw(songTime(), 0); }
async function resumeGame() { if (!G || G.ended) return; try { if (ac) await ac.resume(); } catch (_) {} G.paused = false; lastLoopTs = 0; setText('pauseBtn', '[ PAUSE ]'); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
async function togglePause() { if (!G) return; if (G.paused) await resumeGame(); else await pauseGame(); }

const KEY_LANES = { ArrowLeft: 0, a: 0, A: 0, '1': 0, ArrowDown: 1, s: 1, S: 1, '2': 1, ArrowRight: 2, d: 2, D: 2, '3': 2 };
document.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (KEY_LANES[e.key] !== undefined) { e.preventDefault(); judge(KEY_LANES[e.key]); return; }
  if (e.key === 'p' || e.key === 'P') { togglePause(); }
  if (e.key === 'm' || e.key === 'M') { toggleMute(); }
  if (e.key === ' ' && G && !G.ended) { e.preventDefault(); judge(1); }
});
cv.addEventListener('pointerdown', e => { e.preventDefault(); if (G && G.paused) { resumeGame(); return } const r = cv.getBoundingClientRect(); judge(Math.min(LANES - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * LANES)))); }, { passive: false });
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.ended && !G.paused) { pauseGame(); } });

// ==========================================
// 5. CARD & RPC
// ==========================================
async function tfetch(url, opt = {}, ms = 6000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { return await fetch(url, { ...opt, signal: c.signal }) } finally { clearTimeout(t) } }
function fmt(raw, dec) { if (dec === 0) return raw.toString(); if (dec > 30) return raw.toString() + ' (dec>30)'; const s = 10n ** BigInt(dec), w = raw / s, f = raw % s; const fs = f.toString().padStart(dec, '0').replace(/0+$/, ''); if (!fs) return w.toLocaleString('en-US'); if (w === 0n) { const i = fs.search(/[1-9]/); return i < 0 ? '0' : '0.' + fs.slice(0, i + 3); } return w.toLocaleString('en-US') + '.' + fs.slice(0, 2); }
function decodeStr(hex) { try { if (!hex || hex === '0x') return 'TOKEN'; const h = hex.slice(2); if (h.length < 64) return 'TOKEN'; const len = parseInt(h.slice(64, 128), 16); if (!Number.isFinite(len) || len <= 0 || len > 64) { const raw = decodeURIComponent(h.slice(0, 64).replace(/(00)+$/, '').replace(/../g, '%$&')); return raw.replace(/[^\x20-\x7E]/g, '').slice(0, 10) || 'TOKEN'; } const str = decodeURIComponent(h.slice(128, 128 + len * 2).replace(/../g, '%$&')); return str.slice(0, 10) || 'TOKEN'; } catch { return 'TOKEN'; } }

async function fetchBalance(w) {
  return rpcBreaker.execute(async () => {
    const call = (id, data) => ({ jsonrpc: '2.0', id, method: 'eth_call', params: [{ to: CONFIG.TOKEN, data }, 'latest'] });
    const payload = [call(1, '0x70a08231' + w.slice(2).toLowerCase().padStart(64, '0')), call(2, '0x313ce567'), call(3, '0x95d89b41')];
    const res = await tfetch(CONFIG.RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.status === 429) throw new Error('RATE_LIMITED'); if (!res.ok) throw new Error('RPC_HTTP_' + res.status);
    const arr = await res.json(), by = Object.fromEntries((Array.isArray(arr) ? arr : []).map(x => [x.id, x.result]));
    if (!by[1] || by[1] === '0x') throw new Error('NO_CONTRACT');
    const dec = by[2] && by[2] !== '0x' ? Number(BigInt(by[2])) : 18;
    const sym = by[3] && by[3] !== '0x' ? decodeStr(by[3]) : 'TOKEN';
    return { ok: true, val: fmt(BigInt(by[1]), dec), sym };
  });
}
async function fetchWheel() { try { const r = await tfetch(CONFIG.API_URL); if (!r.ok) return { ok: false, status: 'HTTP_' + r.status }; const m = (await r.json()).measurement; if (!m) return { ok: false, status: 'NO_DATA' }; return { ok: true, dist: Number(m.distanceMm) / 1e6, status: String(m.coreStatus).slice(0, 18) } } catch { return { ok: false, status: 'OFFLINE' } } }

function avatar(ctx, w, x0, y0, px, level) {
  level = level || 1;
  const r = rng(seedOf(w) ^ 0x5eed), hue = Math.floor(r() * 360);
  const fur = `hsl(${hue},80%,62%)`, dark = `hsl(${hue},70%,32%)`, acc = `hsl(${(hue + 180) % 360},90%,60%)`;
  const grid = []; for (let y = 0; y < 16; y++) { grid[y] = []; for (let x = 0; x < 8; x++) { const dx = (x - 7.5) / 6.5, dy = (y - 9) / 6.5; grid[y][x] = dx * dx + dy * dy <= 1 ? (r() < .22 ? 2 : 1) : 0 } }
  for (let y = 1; y < 5; y++) for (let x = 2; x < 5; x++) if (x - 2 <= y - 1) grid[y][x] = (y > 2 && x === 3) ? 3 : 2;
  const eyeY = 8 + Math.floor(r() * 2), glasses = level >= 2 || r() < .25, hat = level >= 3 || r() < .3, crown = level >= 4;
  ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, 16 * px, 16 * px);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const v = grid[y][x]; if (!v) continue; let c = v === 2 ? dark : v === 3 ? '#ff5c9a' : fur; if (y === eyeY && x === 5) c = glasses ? acc : '#000'; if (y === eyeY + 2 && x === 7) c = '#ff5c9a'; ctx.fillStyle = c; ctx.fillRect(x0 + x * px, y0 + y * px, px, px); ctx.fillRect(x0 + (15 - x) * px, y0 + y * px, px, px) }
  if (glasses) { ctx.fillStyle = acc; ctx.fillRect(x0 + 4 * px, y0 + eyeY * px, 8 * px, Math.max(1, px >> 1)) }
  if (hat) { ctx.fillStyle = acc; ctx.fillRect(x0 + 4 * px, y0 + 2 * px, 8 * px, 2 * px); ctx.fillRect(x0 + 3 * px, y0 + 4 * px, 10 * px, px) }
  if (crown) { ctx.fillStyle = '#ffff00'; ctx.fillRect(x0 + 4 * px, y0 + 0 * px, 8 * px, px); ctx.fillRect(x0 + 4 * px, y0 + 0 * px, px, 2 * px); ctx.fillRect(x0 + 7 * px, y0 + 0 * px, px, 2 * px); ctx.fillRect(x0 + 10 * px, y0 + 0 * px, px, 2 * px); }
}

async function generateCard() {
  const w = $('walletInput').value.trim();
  if (!isAddr(w)) { $('walletInput').classList.add('invalid'); return say('VALID WALLET REQUIRED FOR ID CARD.', 'pink'); }
  $('walletInput').classList.remove('invalid');
  const btn = $('genBtn'); if (btn) btn.disabled = true; say('FETCHING ON-CHAIN DATA...', 'cyan');
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))]); } catch (_) {}

  let wheel, bal;
  try { [wheel, bal] = await Promise.all([fetchWheel(), fetchBalance(w)]); }
  catch (e) { bal = { ok: false, status: e.message === 'CIRCUIT_OPEN' ? 'RPC_BLOCKED' : 'FETCH_ERROR' }; wheel = { ok: false, status: 'OFFLINE' }; }

  const an = (lastAnthem && G && G.wallet && G.wallet.toLowerCase() === w.toLowerCase()) ? lastAnthem : makeAnthem(w);
  const b = loadBest(w), c = $('card-canvas'), ctx = c.getContext('2d'), CW = 400, CH = 600;
  fitCanvas(c, ctx, CW, CH, 3);

  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, CW - 6, CH - 6);
  ctx.fillStyle = '#00ff00'; ctx.fillRect(3, 3, CW - 6, 40);
  ctx.textAlign = 'left'; ctx.fillStyle = '#000'; ctx.font = 'bold 16px "Space Mono"';
  ctx.fillText('SQUEEK CITIZEN // ID CARD', 15, 26);

  avatar(ctx, w, CW / 2 - 64, 60, 8, levelFor(totalXP(w)));

  const row = (l, v, x, y, col) => { ctx.fillStyle = '#888'; ctx.font = '12px "Space Mono"'; ctx.fillText(l, x, y); ctx.fillStyle = col; ctx.font = 'bold 16px "Space Mono"'; ctx.fillText(v, x, y + 20); };

  row('WALLET:', w.slice(0, 10) + '...' + w.slice(-8), 25, 220, '#00ffff');
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(25, 260); ctx.lineTo(CW - 25, 260); ctx.stroke();
  row('ANTHEM:', `${an.key} ${an.scaleName}`, 25, 290, '#ff00ff');
  row('TEMPO:', `${an.bpm} BPM`, 220, 290, '#ff00ff');
  row('BEST SCORE:', b ? String(b.score) : 'NONE', 25, 340, '#ffff00');
  row('GRADE:', b ? b.grade : '--', 220, 340, '#ffff00');
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(25, 380); ctx.lineTo(CW - 25, 380); ctx.stroke();
  row('TOKEN (SEPOLIA):', bal.ok ? `${bal.val} ${bal.sym}` : `[ ${bal.status} ]`, 25, 410, bal.ok ? '#00ff00' : '#ff00ff');
  row('WHEEL STATUS:', wheel.status, 25, 460, wheel.ok ? '#00ff00' : '#ff00ff');
  row('DISTANCE:', wheel.ok ? wheel.dist.toFixed(3) + ' KM' : '-', 220, 460, '#00ff00');

  ctx.fillStyle = '#fff'; ctx.font = '10px "Space Mono"'; ctx.textAlign = 'center';
  ctx.fillText(`UNOFFICIAL DATA // ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, CW / 2, CH - 15);

  $('cardArea').classList.remove('hidden'); if (btn) btn.disabled = false; say('ID CARD GENERATED.', 'green');
  c.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const cardBlob = () => new Promise(r => { try { $('card-canvas').toBlob(r, 'image/png'); } catch { r(null); } });
async function download() {
  const b = await cardBlob(); if (!b) return say('DOWNLOAD GAGAL: canvas kosong.', 'pink');
  const u = URL.createObjectURL(b), a = document.createElement('a');
  a.href = u; a.download = 'squeek-id.png'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
async function share() {
  const b = await cardBlob(); if (!b) return download();
  const f = new File([b], 'squeek-id.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Squeek Citizen ID' }) } catch (_) {} } else download();
}

// ==========================================
// 6. UI WIRING
// ==========================================
function applyHue(hue) { try { document.documentElement.style.setProperty('--accent', `hsl(${hue},90%,60%)`); document.documentElement.style.setProperty('--accent2', `hsl(${(hue + 180) % 360},90%,60%)`); } catch (_) {} }
let previewSpin = null;
function startPreviewSpin(w) {
  const c = $('avatar-preview'); if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return;
  if (previewSpin) clearInterval(previewSpin);
  let a = 0;
  previewSpin = setInterval(() => {
    a += 0.08; const sx = Math.max(0.15, Math.abs(Math.cos(a)));
    ctx.save(); ctx.clearRect(0, 0, 128, 128); ctx.translate(64, 64); ctx.scale(sx, 1); ctx.translate(-64, -64);
    avatar(ctx, w, 0, 0, 8, levelFor(totalXP(w))); ctx.restore();
  }, 50);
}
function renderAvatarPreview(w) {
  const wrap = $('avatarPreviewWrap'), c = $('avatar-preview');
  if (!wrap || !c || !isAddr(w)) { if (wrap) wrap.classList.add('hidden'); return; }
  const ctx = c.getContext('2d'); if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const lv = levelFor(totalXP(w));
  avatar(ctx, w, 0, 0, 8, lv);
  const ll = $('levelLabel');
  if (ll) { const st = loadJSON('sqk24:streak:' + walletKey(w), { count: 0 }); ll.textContent = `LV ${lv} • ${totalXP(w)} XP${st.count ? ' • STREAK ' + st.count + ' HARI' : ''}`; }
  wrap.classList.remove('hidden');
  startPreviewSpin(w);
  const h = $('anthemHash');
  if (h) { const a = makeAnthem(w); h.textContent = `SEED #${String(seedOf(w) % 100000).padStart(5, '0')} • ${a.key} ${a.scaleName} • ${a.bpm} BPM`; applyHue(a.hue); }
}
function updatePrecision(offsetMs, judged) {
  const last = $('lastHit'), avg = $('avgHit'), dir = $('hitDir');
  if (!last) return;
  if (judged === 'miss') { if (dir) dir.textContent = 'MISS'; return; }
  const ms = Math.round(offsetMs);
  last.textContent = (ms > 0 ? '+' : '') + ms + ' ms';
  if (dir) dir.textContent = ms === 0 ? 'PERFECT' : ms > 0 ? 'LATE' : 'EARLY';
  hitOffsets.push(ms); if (hitOffsets.length > 20) hitOffsets.shift();
  if (avg) { const a = hitOffsets.reduce((s, v) => s + v, 0) / hitOffsets.length; avg.textContent = (a > 0 ? '+' : '') + Math.round(a) + ' ms'; }
}
function updateViz() {
  const bars = document.querySelectorAll('#vizBars i'); if (!bars.length || !audioDataArray) return;
  for (let i = 0; i < bars.length; i++) {
    const v = audioDataArray[Math.floor(i * audioDataArray.length / bars.length)] / 255;
    bars[i].style.height = Math.max(8, Math.round(v * 100)) + '%';
  }
}
function juiceHit(kind) {
  const scoreStat = document.querySelector('.stat');
  if (kind === 'perfect' && scoreStat) { scoreStat.classList.remove('pop'); void scoreStat.offsetWidth; scoreStat.classList.add('pop'); }
  if (kind === 'miss') { const gp = $('gamePanel'); if (gp) { gp.classList.remove('shake'); void gp.offsetWidth; gp.classList.add('shake'); } }
}

function preview() {
  const w = $('walletInput').value.trim();
  if (w && !isAddr(w)) { $('anthemInfo').textContent = 'INVALID ADDRESS'; $('walletInput').classList.add('invalid'); return; }
  $('walletInput').classList.remove('invalid');
  const a = playMode === 'free' ? makeAnthem(w) : makeAnthem(w, false, seedKeyFor(playMode)), b = loadBest(w);
  const modeTag = playMode === 'free' ? '' : playMode === 'daily' ? ' // DAILY ' + todayStr() : ' // DUEL ' + String(challengeCode || '').slice(0, 12);
  $('anthemInfo').textContent = `>> ANTHEM: ${a.key} ${a.scaleName} [${a.bpm} BPM] // NOTES: ${a.chart.length}${b ? ' // BEST: ' + b.score : ''}${modeTag}`;
  renderAvatarPreview(w); applyHue(a.hue);
}

const walletEl = $('walletInput');
if (walletEl) walletEl.addEventListener('input', preview);
bindClick('playBtn', play); bindClick('genBtn', generateCard);
bindClick('dlBtn', download); bindClick('shareBtn', share);
bindClick('stopBtn', stop); bindClick('againBtn', play);
bindClick('pauseBtn', togglePause); bindClick('muteBtn', toggleMute);
bindClick('qualityBtn', () => setQuality(quality === 'ultra' ? 'hemat' : 'ultra'));
bindClick('homeBtn', () => show('mainPanel'));
bindClick('toCardBtn', () => { show('mainPanel'); generateCard() });

function renderDailyBox() {
  const box = $('dailyBox'); if (!box) return;
  const w = $('walletInput') ? $('walletInput').value.trim() : '';
  const isDaily = playMode === 'daily';
  box.classList.toggle('hidden', !isDaily);
  if (!isDaily) return;
  const st = loadJSON('sqk24:streak:' + walletKey(w), { count: 0 });
  const sl = $('streakLine'); if (sl) sl.textContent = `STREAK: ${st.count} HARI — main Daily tiap hari untuk menjaga api tetap hidup.`;
  const dt = $('dailyTitle'); if (dt) dt.textContent = 'DAILY ANTHEM — ' + todayStr();
  const done = loadJSON(missionsDoneKey(w), []);
  const ml = $('missionList');
  if (ml) ml.innerHTML = dailyMissions(todayStr()).map(m => `<div class="mission${done.includes(m.id) ? ' done' : ''}">${m.text}</div>`).join('');
}
function renderMastery() {
  const w = $('walletInput') ? $('walletInput').value.trim() : '';
  const hist = loadJSON('sqk24:hist:' + walletKey(w), []);
  const bars = $('historyBars'), stats = $('masteryStats');
  if (!bars || !stats) return;
  if (!hist.length) { bars.innerHTML = ''; stats.textContent = 'Belum ada game tercatat di browser ini.'; return; }
  const max = Math.max.apply(null, hist.map(h => h.score).concat([1]));
  const best = Math.max.apply(null, hist.map(h => h.score));
  bars.innerHTML = hist.map(h => `<i style="height:${Math.max(6, Math.round(h.score / max * 100))}%" title="${h.score} • ${h.acc}%"></i>`).join('');
  const avgAcc = (hist.reduce((s, h) => s + h.acc, 0) / hist.length).toFixed(1);
  const avgOffs = hist.filter(h => h.avgOff !== null && h.avgOff !== undefined);
  const avgOff = avgOffs.length ? Math.round(avgOffs.reduce((s, h) => s + h.avgOff, 0) / avgOffs.length) : null;
  const bestBy = {};
  hist.forEach(h => { const k = h.genre + '/' + h.diff; if (!bestBy[k] || h.score > bestBy[k]) bestBy[k] = h.score; });
  stats.textContent = `GAME: ${hist.length} • BEST: ${best} • RATA-RATA AKURASI: ${avgAcc}%` +
    (avgOff !== null ? ` • AVG OFFSET: ${avgOff > 0 ? '+' : ''}${avgOff} ms` : '') +
    ' • BEST PER GENRE/DIFF: ' + Object.entries(bestBy).map(([k, v]) => `${k} ${v}`).join(', ');
}
function setMode(m) {
  playMode = m;
  document.querySelectorAll('#modeRow .btn-diff').forEach(x => { const on = x.dataset.mode === m; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); });
  renderDailyBox(); preview();
  if (m === 'daily') { say('DAILY AKTIF — ' + todayStr() + ' • LAGU HARI INI SAMA UNTUK SEMUA ORANG (GENRE/DIFF SAMA).', 'yellow'); const db = $('dailyBox'); if (db) db.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
function duelLink() { if (!G || !G.seedKey) return null; const base = location.href.split('?')[0]; return `${base}?challenge=${encodeURIComponent(G.seedKey)}&genre=${G.genre}&diff=${G.diff}`; }
async function shareDuel() {
  const link = duelLink();
  const dm = $('duelMsg'), out = $('duelOut');
  if (!link) { if (dm) dm.textContent = 'MAIN DULU SATU LAGU, BARU DUEL BISA DIBAGIKAN.'; return; }
  if (out) out.value = link;
  try { await navigator.clipboard.writeText(link); if (dm) dm.textContent = 'DUEL LINK TERSALIN — KIRIM KE TEMAN, MEREKA MAIN LAGU YANG SAMA PERSIS.'; }
  catch (e) { if (dm) dm.textContent = 'CLIPBOARD DIBLOKIR — LINK ADA DI KOTAK DI BAWAH, COPY MANUAL.'; }
  if (out) { out.focus(); out.select(); }
}
document.querySelectorAll('#modeRow .btn-diff').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
bindClick('duelBtn', shareDuel);

try {
  const params = new URLSearchParams(location.search);
  const qw = (params.get('wallet') || '').trim();
  if (qw && isAddr(qw) && walletEl) walletEl.value = qw;
  const qg = params.get('genre'); if (qg && GENRES[qg]) { currentGenre = qg; document.querySelectorAll('#genreRow .btn-diff').forEach(x => { const on = x.dataset.genre === qg; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); }); }
  const qd = params.get('diff'); if (qd && DIFFICULTIES[qd]) { currentDiff = qd; document.querySelectorAll('#diffRow .btn-diff').forEach(x => { const on = x.dataset.diff === qd; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); }); }
  const qc = params.get('challenge'); if (qc) { challengeCode = qc; playMode = 'challenge'; }
  else if (params.get('daily') === '1') playMode = 'daily';
  if (playMode !== 'free') document.querySelectorAll('#modeRow .btn-diff').forEach(x => { const on = x.dataset.mode === playMode || (playMode === 'challenge' && x.dataset.mode === 'free'); x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); });
  if (quality === 'hemat') setQuality('hemat'); else setQuality('ultra');
} catch (_) {}
renderDailyBox(); renderMastery();
preview();
