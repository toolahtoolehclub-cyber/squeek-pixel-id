'use strict';

const $ = id => document.getElementById(id);
const isAddr = s => /^0x[a-fA-F0-9]{40}$/.test(s);
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let muted = false;

function say(t, c) { const el = $('message'); if (!el) return; el.textContent = t; el.style.color = c ? `var(--${c})` : ''; }
function show(id) { ['mainPanel', 'gamePanel', 'resultPanel'].forEach(p => $(p).classList.toggle('hidden', p !== id)); }
window.addEventListener('error', (e) => { try { say('ERROR: ' + String(e.message || e.error || 'unknown').slice(0, 80), 'pink'); } catch (_) {} });

// ==========================================
// 1. WEBGL BACKGROUND
// ==========================================
const glCanvas = document.getElementById('bg-gl');
let gl = null, prog = null, glSeed = 0, glAudio = 0, glGlitch = 0;
let uRes = null, uTime = null, uSeed = null, uAudio = null, uGlitch = null;
let glRunning = false;

function compileShader(glCtx, type, src) {
  const s = glCtx.createShader(type);
  glCtx.shaderSource(s, src); glCtx.compileShader(s);
  if (!glCtx.getShaderParameter(s, glCtx.COMPILE_STATUS)) return null;
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
      uniform float u_audio; uniform float u_glitch;
      float map(vec3 p) {
          float s = u_seed;
          p.xz = mat2(cos(s), -sin(s), sin(s), cos(s)) * p.xz;
          float pulse = 1.0 + sin(u_time * 3.0) * 0.1 + u_audio * 0.5;
          float sphere = length(p) - (1.0 * pulse);
          float torus = length(vec2(length(p.xz)-1.5, p.y)) - 0.2;
          float shape = mix(sphere, torus, fract(s));
          shape += sin(p.x * 10.0 + u_time * 5.0) * u_glitch * 0.2;
          return shape;
      }
      void main() {
          vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
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
              col = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 1.0), n.x * 0.5 + 0.5) * diff;
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
    uRes = gl.getUniformLocation(prog, 'u_resolution'); uTime = gl.getUniformLocation(prog, 'u_time'); uSeed = gl.getUniformLocation(prog, 'u_seed'); uAudio = gl.getUniformLocation(prog, 'u_audio'); uGlitch = gl.getUniformLocation(prog, 'u_glitch');
    resizeGL(); window.addEventListener('resize', resizeGL); glRunning = true; requestAnimationFrame(renderGL);
  } catch (err) { gl = null; glRunning = false; document.body.classList.add('no-gl'); }
}
function resizeGL() { if (!gl) return; const scale = 0.66; const dpr = Math.min(1.5, window.devicePixelRatio || 1); glCanvas.width = Math.max(2, Math.floor(window.innerWidth * dpr * scale)); glCanvas.height = Math.max(2, Math.floor(window.innerHeight * dpr * scale)); gl.viewport(0, 0, glCanvas.width, glCanvas.height); }
let lastGlFrame = 0;
function renderGL(time) {
  if (!glRunning || !gl) return; requestAnimationFrame(renderGL);
  if (document.hidden) return; if (prefersReducedMotion && time - lastGlFrame < 66) return; lastGlFrame = time;
  gl.uniform2f(uRes, glCanvas.width, glCanvas.height); gl.uniform1f(uTime, time * 0.001); gl.uniform1f(uSeed, glSeed); gl.uniform1f(uAudio, prefersReducedMotion ? 0 : glAudio); gl.uniform1f(uGlitch, prefersReducedMotion ? 0 : glGlitch);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); glGlitch *= 0.95;
}
initGL();

// ==========================================
// 2. WEB3 & API
// ==========================================
class CircuitBreaker {
  constructor(threshold = 3, timeout = 10000) { this.threshold = threshold; this.timeout = timeout; this.fails = 0; this.state = 'CLOSED'; this.next = Date.now(); }
  async execute(fn) { if (this.state === 'OPEN') { if (Date.now() > this.next) this.state = 'HALF_OPEN'; else throw new Error('CIRCUIT_OPEN'); } try { const res = await fn(); this.fails = 0; this.state = 'CLOSED'; return res; } catch (e) { this.fails++; if (this.fails >= this.threshold) { this.state = 'OPEN'; this.next = Date.now() + this.timeout; } throw e; } }
}
const rpcBreaker = new CircuitBreaker(3, 10000);
const CONFIG = { API_URL: 'https://api.squeekchain.com/v1/status', RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com', TOKEN: '0x810239d271e80a86023f4f315943acbd65b59281', BARS: 20, LEAD_IN: 2, HIT_Y: 450, SPEED: 350, W: { perfect: .045, great: .09, good: .135 } };
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

function makeAnthem(wallet, randomize = false) {
  let seed = seedOf(wallet); if (randomize) seed += Math.floor(Math.random() * 999999);
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
function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : .4; const b = $('muteBtn'); if (b) { b.textContent = muted ? '🔇' : '🔊'; } return muted; }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, a, p, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d) }
function tone(f, t, ty, p, d) { if (!ac || muted) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t); o.connect(g); g.connect(master); env(g, t, .004, p, d); o.start(t); o.stop(t + d + .05) }
function kick(t) { if (!ac || muted) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .12); o.connect(g); g.connect(master); env(g, t, .002, .9, .18); o.start(t); o.stop(t + .25) }
function noise(t, hp, p, d) { if (!ac || muted) return; const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp; s.connect(f); f.connect(g); g.connect(master); env(g, t, .001, p, d); s.start(t); s.stop(t + d + .05) }
function getAudioLevel() { if (!analyser || muted || !audioDataArray) return 0; analyser.getByteFrequencyData(audioDataArray); let s = 0; for (let i = 0; i < audioDataArray.length; i++) s += audioDataArray[i]; return (s / audioDataArray.length) / 255; }

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
  const w = $('walletInput').value.trim();
  if (w && !isAddr(w)) { $('walletInput').classList.add('invalid'); return say('INVALID WALLET ADDRESS.', 'pink'); }
  $('walletInput').classList.remove('invalid');
  try { await initAudio(); } catch (e) { return say('AUDIO GAGAL.', 'pink'); }
  anthem = makeAnthem(w, true); CONFIG.SPEED = DIFFICULTIES[currentDiff].speed;
  glSeed = w ? Math.abs(cyrb53(w) % 1000) / 100 : Math.random() * 10;
  G = { wallet: w, start: ac.currentTime + CONFIG.LEAD_IN, next: 0, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, fx: [], flash: [0, 0, 0], ended: false, paused: false };
  floatTexts = [];
  show('gamePanel'); $('bpmVal').textContent = anthem.bpm; hud();
  $('pauseBtn').textContent = '[ PAUSE ]';
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
  if (!target || bd > CONFIG.W.good) return;
  const k = bd <= CONFIG.W.perfect ? 'perfect' : bd <= CONFIG.W.great ? 'great' : 'good';
  target.judged = k; G.counts[k]++; G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
  const mult = Math.min(2, 1 + Math.floor(G.combo / 10) * .1);
  G.score += Math.round({ perfect: 300, great: 200, good: 100 }[k] * mult);
  tone(mtof(target.midi), ac.currentTime, 'square', k === 'perfect' ? .18 : .12, .22);
  if (k === 'perfect') addFloatText('PERFECT!', '#00ff00'); else if (G.combo > 0 && G.combo % 10 === 0) addFloatText(`COMBO x${G.combo}!`, '#00ffff');
  for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 150; G.fx.push({ x: lane * LW + LW / 2, y: CONFIG.HIT_Y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50, life: .4, c: k === 'perfect' ? '#00ff00' : '#ff00ff' }) }
  hud();
}
let lastLoopTs = 0;
function loop(ts) {
  if (!G || G.ended) return;
  raf = requestAnimationFrame(loop);
  if (G.paused) { draw(songTime(), 0); return; }
  const dt = Math.min(0.05, lastLoopTs ? (ts - lastLoopTs) / 1000 : 1 / 60); lastLoopTs = ts;
  glAudio = getAudioLevel();
  const st = songTime();
  for (const n of anthem.chart) {
    if (n.judged) continue;
    if (st - n.t > CONFIG.W.good) { n.judged = 'miss'; G.counts.miss++; G.combo = 0; addFloatText('MISS', '#ff00ff'); hud(); glGlitch = 0.5; }
    else if (n.t > st) break;
  }
  if (st > anthem.duration + .8) return finish();
  draw(st, dt);
}
function draw(st, dt) {
  dt = dt || 1 / 60;
  cx.clearRect(0, 0, GW, GH); cx.fillStyle = '#050505'; cx.fillRect(0, 0, GW, GH);
  
  // FIX CLIPPING: Mencegah balok keluar dari area canvas
  cx.save();
  cx.beginPath();
  cx.rect(0, 0, GW, GH);
  cx.clip();

  const spb = 60 / anthem.bpm, beat = ((st / spb) % 1 + 1) % 1, pulse = st > 0 ? Math.max(0, 1 - beat * 4) : 0;
  for (let l = 0; l < LANES; l++) { const f = G.flash[l]; cx.fillStyle = `rgba(0,255,255,${.05 + f * .2})`; cx.fillRect(l * LW + 2, 0, LW - 4, GH); G.flash[l] = Math.max(0, f - dt * 5) }
  cx.strokeStyle = '#333'; cx.lineWidth = 2; for (let l = 1; l < LANES; l++) { cx.beginPath(); cx.moveTo(l * LW, 0); cx.lineTo(l * LW, GH); cx.stroke() }
  cx.strokeStyle = 'rgba(255,255,255,0.1)'; cx.lineWidth = 1; for (let b = Math.ceil(st / spb); b < st / spb + GH / CONFIG.SPEED / spb + 1; b++) { const y = CONFIG.HIT_Y - (b * spb - st) * CONFIG.SPEED; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(GW, y); cx.stroke() }
  cx.fillStyle = `rgba(0,255,0,${.2 + pulse * .3})`; cx.fillRect(0, CONFIG.HIT_Y - 15, GW, 30); cx.fillStyle = '#00ff00'; cx.fillRect(0, CONFIG.HIT_Y - 2, GW, 4);
  
  for (const n of anthem.chart) { 
      const y = CONFIG.HIT_Y - (n.t - st) * CONFIG.SPEED; 
      if (y < -30) break; 
      if (y > GH + 30 || (n.judged && n.judged !== 'miss')) continue; 
      const x = n.lane * LW + LW / 2; 
      cx.fillStyle = n.judged === 'miss' ? '#ff00ff' : ['#ff00ff', '#00ffff', '#ffff00'][n.lane]; 
      cx.fillRect(Math.round(x - 35), Math.round(y - 12), 70, 24) 
  }
  
  cx.restore(); // Selesai clipping area game

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
  $('gradeVal').textContent = g; $('gradeVal').style.color = g.startsWith('S') ? 'var(--green)' : g === 'A' ? 'var(--cyan)' : 'var(--pink)';
  const c = G.counts;
  $('resultKv').innerHTML = `<span>SCORE</span><b>${G.score}</b><span>ACCURACY</span><b>${a.toFixed(2)}%</b><span>MAX COMBO</span><b>${G.maxCombo}</b><span>PERFECT/GREAT</span><b>${c.perfect}/${c.great}</b><span>GOOD/MISS</span><b>${c.good}/${c.miss}</b><span>ANTHEM</span><b>${anthem.key} ${anthem.scaleName}</b>`;
  $('bestMsg').textContent = isNew ? 'NEW HIGH SCORE!' : `BEST: ${prev.score} (${prev.grade})`;
  show('resultPanel');
}
function stop() { if (G) { clearInterval(sched); cancelAnimationFrame(raf); if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); G = null; } show('mainPanel'); }
async function pauseGame() { if (!G || G.ended) return; G.paused = true; $('pauseBtn').textContent = '[ RESUME ]'; try { if (ac) await ac.suspend(); } catch (_) {} draw(songTime(), 0); }
async function resumeGame() { if (!G || G.ended) return; try { if (ac) await ac.resume(); } catch (_) {} G.paused = false; lastLoopTs = 0; $('pauseBtn').textContent = '[ PAUSE ]'; }
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

function avatar(ctx, w, x0, y0, px) {
  const r = rng(seedOf(w) ^ 0x5eed), hue = Math.floor(r() * 360);
  const fur = `hsl(${hue},80%,62%)`, dark = `hsl(${hue},70%,32%)`, acc = `hsl(${(hue + 180) % 360},90%,60%)`;
  const grid = []; for (let y = 0; y < 16; y++) { grid[y] = []; for (let x = 0; x < 8; x++) { const dx = (x - 7.5) / 6.5, dy = (y - 9) / 6.5; grid[y][x] = dx * dx + dy * dy <= 1 ? (r() < .22 ? 2 : 1) : 0 } }
  for (let y = 1; y < 5; y++) for (let x = 2; x < 5; x++) if (x - 2 <= y - 1) grid[y][x] = (y > 2 && x === 3) ? 3 : 2;
  const eyeY = 8 + Math.floor(r() * 2), glasses = r() < .25, hat = r() < .3;
  ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, 16 * px, 16 * px);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const v = grid[y][x]; if (!v) continue; let c = v === 2 ? dark : v === 3 ? '#ff5c9a' : fur; if (y === eyeY && x === 5) c = glasses ? acc : '#000'; if (y === eyeY + 2 && x === 7) c = '#ff5c9a'; ctx.fillStyle = c; ctx.fillRect(x0 + x * px, y0 + y * px, px, px); ctx.fillRect(x0 + (15 - x) * px, y0 + y * px, px, px) }
  if (glasses) { ctx.fillStyle = acc; ctx.fillRect(x0 + 4 * px, y0 + eyeY * px, 8 * px, Math.max(1, px >> 1)) }
  if (hat) { ctx.fillStyle = acc; ctx.fillRect(x0 + 4 * px, y0 + 2 * px, 8 * px, 2 * px); ctx.fillRect(x0 + 3 * px, y0 + 4 * px, 10 * px, px) }
}

async function generateCard() {
  const w = $('walletInput').value.trim();
  if (!isAddr(w)) { $('walletInput').classList.add('invalid'); return say('VALID WALLET REQUIRED FOR ID CARD.', 'pink'); }
  $('walletInput').classList.remove('invalid');
  const btn = $('genBtn'); btn.disabled = true; say('FETCHING ON-CHAIN DATA...', 'cyan');
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))]); } catch (_) {}

  let wheel, bal;
  try { [wheel, bal] = await Promise.all([fetchWheel(), fetchBalance(w)]); }
  catch (e) { bal = { ok: false, status: e.message === 'CIRCUIT_OPEN' ? 'RPC_BLOCKED' : 'FETCH_ERROR' }; wheel = { ok: false, status: 'OFFLINE' }; }

  const an = makeAnthem(w), b = loadBest(w), c = $('card-canvas'), ctx = c.getContext('2d'), CW = 400, CH = 600;
  fitCanvas(c, ctx, CW, CH, 3);

  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, CW - 6, CH - 6);
  ctx.fillStyle = '#00ff00'; ctx.fillRect(3, 3, CW - 6, 40);
  
  // FIX TEKS KARTU KEPOTONG (Ukuran font dikecilkan)
  ctx.textAlign = 'left'; ctx.fillStyle = '#000'; ctx.font = 'bold 16px "Space Mono"';
  ctx.fillText('SQUEEK CITIZEN // ID CARD', 15, 26);

  avatar(ctx, w, CW / 2 - 64, 60, 8);

  const row = (l, v, x, y, col) => { ctx.fillStyle = '#888'; ctx.font = '12px "Space Mono"'; ctx.fillText(l, x, y); ctx.fillStyle = col; ctx.font = 'bold 16px "Space Mono"'; ctx.fillText(v, x, y + 20); };

  row('WALLET:', w.slice(0, 10) + '...' + w.slice(-8), 25, 220, '#00ffff');
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(25, 260); ctx.lineTo(CW - 25, 260); ctx.stroke();
  row('ANTHEM:', `${an.key} ${an.scaleName}`, 25, 290, '#ff00ff');
  row('TEMPO:', `${an.bpm} BPM`, 220, 290, '#ff00ff');
  row('BEST SCORE:', b ? String(b.score) : 'NONE', 25, 340, '#ffff00');
  row('GRADE:', b ? b.grade : '--', 220, 340, '#ffff00');
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(25, 380); ctx.lineTo(CW - 25, 380); ctx.stroke();
  row('TOKEN BALANCE:', bal.ok ? `${bal.val} ${bal.sym}` : `[ ${bal.status} ]`, 25, 410, bal.ok ? '#00ff00' : '#ff00ff');
  row('WHEEL STATUS:', wheel.status, 25, 460, wheel.ok ? '#00ff00' : '#ff00ff');
  row('DISTANCE:', wheel.ok ? wheel.dist.toFixed(3) + ' KM' : '-', 220, 460, '#00ff00');

  ctx.fillStyle = '#fff'; ctx.font = '10px "Space Mono"'; ctx.textAlign = 'center';
  ctx.fillText(`UNOFFICIAL DATA // ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, CW / 2, CH - 15);

  $('cardArea').classList.remove('hidden'); btn.disabled = false; say('ID CARD GENERATED.', 'green');
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

function preview() {
  const w = $('walletInput').value.trim();
  if (w && !isAddr(w)) { $('anthemInfo').textContent = 'INVALID ADDRESS'; $('walletInput').classList.add('invalid'); return; }
  $('walletInput').classList.remove('invalid');
  const a = makeAnthem(w), b = loadBest(w);
  $('anthemInfo').textContent = `>> ANTHEM: ${a.key} ${a.scaleName} [${a.bpm} BPM] // NOTES: ${a.chart.length}${b ? ' // BEST: ' + b.score : ''}`;
}

$('walletInput').addEventListener('input', preview);
$('playBtn').onclick = play; $('genBtn').onclick = generateCard;
$('dlBtn').onclick = download; $('shareBtn').onclick = share;
$('stopBtn').onclick = stop; $('againBtn').onclick = play;
$('pauseBtn').onclick = togglePause;
$('muteBtn').onclick = toggleMute;
$('homeBtn').onclick = () => show('mainPanel');
$('toCardBtn').onclick = () => { show('mainPanel'); generateCard() };
preview();
