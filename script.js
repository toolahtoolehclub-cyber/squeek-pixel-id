'use strict';

// ==========================================
// 1. WEB3 ARCHITECTURE: CIRCUIT BREAKER & BATCHING
// ==========================================
class CircuitBreaker {
    constructor(threshold = 3, timeout = 10000) {
        this.threshold = threshold;
        this.timeout = timeout;
        this.failureCount = 0;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.nextAttempt = Date.now();
    }
    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() > this.nextAttempt) {
                this.state = 'HALF_OPEN';
            } else {
                throw new Error('CIRCUIT_BREAKER_OPEN');
            }
        }
        try {
            const result = await fn();
            this.failureCount = 0;
            this.state = 'CLOSED';
            return result;
        } catch (error) {
            this.failureCount++;
            if (this.failureCount >= this.threshold) {
                this.state = 'OPEN';
                this.nextAttempt = Date.now() + this.timeout;
            }
            throw error;
        }
    }
}

const rpcBreaker = new CircuitBreaker(3, 10000);

const CONFIG = {
    API_URL: 'https://api.squeekchain.com/v1/status',
    RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
    TOKEN: '0x810239d271e80a86023f4f315943acbd65b59281',
    BARS: 20, LEAD_IN: 2, HIT_Y: 450,
    W: { perfect: .045, great: .09, good: .135 }
};

const DIFFICULTIES = {
    easy:   { speed: 350, density: 0.4, chordChance: 0.0 },
    normal: { speed: 480, density: 0.7, chordChance: 0.1 },
    hard:   { speed: 600, density: 0.9, chordChance: 0.25 }
};

const GENRES = {
    cyber: { scales: ['Phrygian','Harmonic Minor','Minor Pentatonic'], bpmBase: 120 },
    synth: { scales: ['Dorian','Major Pentatonic'], bpmBase: 100 },
    chip:  { scales: ['Major Pentatonic','Dorian'], bpmBase: 140 }
};

const $ = id => document.getElementById(id);
const isAddr = s => /^0x[a-fA-F0-9]{40}$/.test(s);
let currentDiff = 'easy';
let currentGenre = 'cyber';

// Difficulty & Genre buttons
document.querySelectorAll('#diffRow .btn-diff').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#diffRow .btn-diff').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDiff = btn.dataset.diff;
    });
});
document.querySelectorAll('#genreRow .btn-diff').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#genreRow .btn-diff').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentGenre = btn.dataset.genre;
    });
});

// ==========================================
// 2. MATH & GENERATIVE AUDIO (Procedural)
// ==========================================
function cyrb53(str, seed = 0) { let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677) } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return 4294967296 * (2097151 & h2) + (h1 >>> 0) }
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const seedOf = w => cyrb53((w || 'GUEST').toLowerCase());

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SCALES = { 'Minor Pentatonic':[0,3,5,7,10], 'Dorian':[0,2,3,5,7,9,10], 'Phrygian':[0,1,3,5,7,8,10], 'Major Pentatonic':[0,2,4,7,9], 'Harmonic Minor':[0,2,3,5,7,8,11] };

function makeAnthem(wallet, randomize = false) {
    let seed = seedOf(wallet);
    if (randomize) seed += Math.floor(Math.random() * 999999);
    const r = rng(seed);
    const genreInfo = GENRES[currentGenre];
    const scaleName = genreInfo.scales[Math.floor(r() * genreInfo.scales.length)];
    const scale = SCALES[scaleName];
    const root = Math.floor(r() * 12);
    const bpm = genreInfo.bpmBase + Math.floor(r() * 20) - 10;
    const step = 60 / bpm / 4;
    const span = scale.length * 2;
    const chart = [], drums = [];
    const diff = DIFFICULTIES[currentDiff];
    let lastNoteTime = -1;

    for (let bar = 0; bar < CONFIG.BARS; bar++) {
        for (let s = 0; s < 16; s++) {
            const t = (bar * 16 + s) * step;
            drums.push({ t, kick: s % 4 === 0 || (s === 10 && r() < .3), hat: s % 2 === 0, snare: s === 4 || s === 12, bass: s % 8 === 0 ? [0,3,4,5,2][Math.floor(r() * 5)] % scale.length : null });
            
            const onBeat = s % 4 === 0, onEighth = s % 2 === 0;
            const want = bar < 2 ? (onBeat && s % 8 === 0) : (onEighth ? r() < diff.density : (onBeat && r() < diff.density * 1.2));
            const minGap = 0.25;

            if (want && (t - lastNoteTime > minGap)) {
                let deg = Math.floor(r() * span);
                const oct = Math.floor(deg / scale.length), midi = 60 + root + scale[deg % scale.length] + 12 * oct;
                const lane = Math.min(2, Math.floor(deg / span * 3));
                chart.push({ t, lane, midi, judged: null });
                lastNoteTime = t;

                if (s % 4 === 0 && r() < diff.chordChance) {
                    const lane2 = (lane + 1 + Math.floor(r() * 2)) % 3;
                    chart.push({ t, lane: lane2, midi: midi - 12, judged: null });
                }
            }
        }
    }
    const sig = Array.from({ length: 24 }, () => .2 + r() * .8);
    return { bpm, step, scaleName, key: NOTE_NAMES[root], root, scale, chart, drums, duration: CONFIG.BARS * 16 * step, sig, hue: Math.floor(r() * 360) };
}

// Audio Context
let ac = null, master = null, noiseBuf = null;
async function initAudio() {
    if (!ac) {
        ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
        master = ac.createGain(); master.gain.value = .5;
        const comp = ac.createDynamicsCompressor(); master.connect(comp).connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate * .3, ac.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state !== 'running') await ac.resume();
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec) }
function tone(freq, t, type, peak, dec) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); o.connect(g).connect(master); env(g, t, .004, peak, dec); o.start(t); o.stop(t + dec + .05) }
function kick(t) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .12); o.connect(g).connect(master); env(g, t, .002, .9, .18); o.start(t); o.stop(t + .25) }
function noise(t, hp, peak, dec) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp; s.connect(f).connect(g).connect(master); env(g, t, .001, peak, dec); s.start(t); s.stop(t + dec + .05) }

// ==========================================
// 3. GAME ENGINE & INTERACTION
// ==========================================
const cv = $('game'), cx = cv.getContext('2d');
const GW = 360, GH = 540, LANES = 3, LW = GW / LANES;
function fitCanvas(c, ctx, w, h, scale) { const d = scale || Math.max(1, window.devicePixelRatio || 1); c.width = w * d; c.height = h * d; c.style.width = w + 'px'; c.style.height = h + 'px'; ctx.setTransform(d, 0, 0, d, 0, 0) }
fitCanvas(cv, cx, GW, GH);

let G = null, raf = 0, sched = 0, anthem = null, floatTexts = [];
const best = w => { try { return JSON.parse(localStorage.getItem('sqk17:' + (w || 'GUEST').toLowerCase()) || 'null') } catch { return null } };
const songTime = () => ac.currentTime - G.start - (+$('offset')?.value || 0) / 1000;

async function play() {
    const w = $('walletInput').value.trim();
    if (w && !isAddr(w)) return say('INVALID WALLET ADDRESS.', 'pink');
    await initAudio();
    anthem = makeAnthem(w, true);
    CONFIG.SPEED = DIFFICULTIES[currentDiff].speed;

    G = { wallet: w, start: ac.currentTime + CONFIG.LEAD_IN, next: 0, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, fx: [], flash: [0, 0, 0], judge: null, ended: false, paused: false };
    floatTexts = [];
    show('gamePanel'); $('bpmVal').textContent = anthem.bpm; hud();
    clearInterval(sched); sched = setInterval(schedule, 25);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}

function schedule() {
    if (!G || G.paused || G.ended) return;
    const ahead = ac.currentTime + .15;
    while (G.next < anthem.drums.length && G.start + anthem.drums[G.next].t < ahead) {
        const d = anthem.drums[G.next], t = G.start + d.t;
        if (d.kick) kick(t);
        if (d.hat) noise(t, 7000, .08, .04);
        if (d.snare) noise(t, 1500, .35, .12);
        if (d.bass !== null) tone(mtof(36 + anthem.root + anthem.scale[d.bass]), t, 'triangle', .35, anthem.step * 7);
        G.next++;
    }
}

function addFloatText(txt, color) { floatTexts.push({ txt, color, x: GW / 2, y: 250, life: 1.0 }); }

function judge(lane) {
    if (!G || G.ended || G.paused) return;
    const st = songTime(); let target = null, bd = 1;
    for (const n of anthem.chart) {
        if (n.judged || n.lane !== lane) continue;
        const dt = Math.abs(n.t - st); if (dt < bd) { bd = dt; target = n }
        if (n.t - st > .3) break;
    }
    G.flash[lane] = 1;
    if (!target || bd > CONFIG.W.good) return;

    const k = bd <= CONFIG.W.perfect ? 'perfect' : bd <= CONFIG.W.great ? 'great' : 'good';
    target.judged = k; G.counts[k]++; G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
    const mult = Math.min(2, 1 + Math.floor(G.combo / 10) * .1);
    G.score += Math.round({ perfect: 300, great: 200, good: 100 }[k] * mult);
    
    tone(mtof(target.midi), ac.currentTime, 'square', k === 'perfect' ? .18 : .12, .22);
    
    if (k === 'perfect') addFloatText('PERFECT!', '#00ff00');
    else if (G.combo > 0 && G.combo % 10 === 0) addFloatText(`COMBO x${G.combo}!`, '#00ffff');

    for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 150;
        G.fx.push({ x: lane * LW + LW / 2, y: CONFIG.HIT_Y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50, life: .4, c: k === 'perfect' ? '#00ff00' : '#ff00ff' });
    }
    hud();
}

function loop() {
    if (!G || G.ended) return;
    raf = requestAnimationFrame(loop);
    const st = songTime();
    for (const n of anthem.chart) {
        if (n.judged) continue;
        if (st - n.t > CONFIG.W.good) { n.judged = 'miss'; G.counts.miss++; G.combo = 0; addFloatText('MISS', '#ff00ff'); hud() }
        else if (n.t > st) break;
    }
    if (st > anthem.duration + .8) return finish();
    draw(st);
}

function draw(st) {
    const dt = 1 / 60;
    cx.clearRect(0, 0, GW, GH);
    cx.fillStyle = '#000000'; cx.fillRect(0, 0, GW, GH);
    
    const spb = 60 / anthem.bpm, beat = ((st / spb) % 1 + 1) % 1, pulse = st > 0 ? Math.max(0, 1 - beat * 4) : 0;
    
    for (let l = 0; l < LANES; l++) { const f = G.flash[l]; cx.fillStyle = `rgba(0, 255, 255, ${.05 + f * .2})`; cx.fillRect(l * LW + 2, 0, LW - 4, GH); G.flash[l] = Math.max(0, f - dt * 5) }
    cx.strokeStyle = '#333'; cx.lineWidth = 2;
    for (let l = 1; l < LANES; l++) { cx.beginPath(); cx.moveTo(l * LW, 0); cx.lineTo(l * LW, GH); cx.stroke() }
    
    cx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; cx.lineWidth = 1;
    for (let b = Math.ceil(st / spb); b < st / spb + GH / CONFIG.SPEED / spb + 1; b++) { const y = CONFIG.HIT_Y - (b * spb - st) * CONFIG.SPEED; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(GW, y); cx.stroke() }
    
    cx.fillStyle = `rgba(0, 255, 0, ${.2 + pulse * .3})`; cx.fillRect(0, CONFIG.HIT_Y - 15, GW, 30);
    cx.fillStyle = '#00ff00'; cx.fillRect(0, CONFIG.HIT_Y - 2, GW, 4);
    
    for (const n of anthem.chart) {
        const y = CONFIG.HIT_Y - (n.t - st) * CONFIG.SPEED;
        if (y < -30) break;
        if (y > GH + 30 || (n.judged && n.judged !== 'miss')) continue;
        const x = n.lane * LW + LW / 2;
        cx.fillStyle = n.judged === 'miss' ? '#ff00ff' : ['#ff00ff', '#00ffff', '#ffff00'][n.lane];
        cx.fillRect(Math.round(x - 35), Math.round(y - 12), 70, 24);
    }
    
    for (let i = G.fx.length - 1; i >= 0; i--) { const p = G.fx[i]; p.life -= dt; if (p.life <= 0) { G.fx.splice(i, 1); continue } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; cx.globalAlpha = p.life * 1.5; cx.fillStyle = p.c; cx.fillRect(p.x | 0, p.y | 0, 4, 4) }
    cx.globalAlpha = 1;
    
    cx.textAlign = 'center';
    for (let i = floatTexts.length - 1; i >= 0; i--) {
        const t = floatTexts[i]; t.life -= dt * 1.5; t.y -= dt * 50;
        if (t.life <= 0) { floatTexts.splice(i, 1); continue; }
        cx.globalAlpha = Math.min(1, t.life);
        cx.fillStyle = t.color;
        cx.font = '16px "Press Start 2P"';
        cx.fillText(t.txt, t.x, t.y);
    }
    cx.globalAlpha = 1;

    if (st < 0) { cx.fillStyle = '#ffff00'; cx.font = '32px "Press Start 2P"'; cx.fillText(Math.ceil(-st), GW / 2, GH / 2) }
    if (G.paused) { cx.fillStyle = '#000'; cx.fillRect(0, 0, GW, GH); cx.fillStyle = '#fff'; cx.font = '16px "Press Start 2P"'; cx.fillText('SYSTEM PAUSED', GW / 2, GH / 2) }
    
    cx.fillStyle = '#00ff00'; cx.fillRect(0, 0, GW * Math.max(0, Math.min(1, st / anthem.duration)), 6);
}

function accuracy() { const c = G.counts, tot = c.perfect + c.great + c.good + c.miss; return tot ? (c.perfect * 300 + c.great * 200 + c.good * 100) / (tot * 300) * 100 : 100 }
const grade = (a, miss) => a >= 95 && miss === 0 ? 'SS' : a >= 95 ? 'S' : a >= 88 ? 'A' : a >= 75 ? 'B' : a >= 60 ? 'C' : 'D';
function hud() { $('scoreVal').textContent = G.score; $('comboVal').textContent = G.combo; $('accVal').textContent = accuracy().toFixed(1) + '%' }

function finish() {
    G.ended = true; clearInterval(sched); cancelAnimationFrame(raf);
    const a = accuracy(), g = grade(a, G.counts.miss), key = (G.wallet || 'GUEST').toLowerCase(), prev = best(G.wallet);
    const rec = { score: G.score, acc: +a.toFixed(2), grade: g, maxCombo: G.maxCombo, at: Date.now() };
    const isNew = !prev || rec.score > prev.score;
    if (isNew) localStorage.setItem('sqk17:' + key, JSON.stringify(rec));
    $('gradeVal').textContent = g;
    $('gradeVal').style.color = g.startsWith('S') ? 'var(--neon-green)' : g === 'A' ? 'var(--neon-cyan)' : 'var(--neon-pink)';
    const c = G.counts;
    $('resultKv').innerHTML = `<span>SCORE</span><b>${G.score}</b><span>ACCURACY</span><b>${a.toFixed(2)}%</b><span>MAX COMBO</span><b>${G.maxCombo}</b><span>PERFECT/GREAT</span><b>${c.perfect}/${c.great}</b><span>GOOD/MISS</span><b>${c.good}/${c.miss}</b><span>ANTHEM</span><b>${anthem.key} ${anthem.scaleName}</b>`;
    $('bestMsg').textContent = isNew ? 'NEW HIGH SCORE!' : `BEST: ${prev.score} (${prev.grade})`;
    show('resultPanel');
}

function stop() { if (G) { clearInterval(sched); cancelAnimationFrame(raf); G = null } show('mainPanel') }

// Pointer Events (Neo-Brutalist Interaction)
cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (G && G.paused) { resume(); return }
    const r = cv.getBoundingClientRect();
    judge(Math.min(LANES - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * LANES))));
}, { passive: false });

// Handle Interupsi OS
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.ended && !G.paused) { G.paused = true; ac.suspend() } });
async function resume() { await ac.resume(); G.paused = false }

// ==========================================
// 4. WEB3 RPC: BIGINT, BATCHING, CIRCUIT BREAKER
// ==========================================
async function tfetch(url, opt = {}, ms = 6000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { return await fetch(url, { ...opt, signal: c.signal }) } finally { clearTimeout(t) } }
function fmt(raw, dec) { if (dec === 0) return raw.toString(); const s = 10n ** BigInt(dec), w = raw / s, f = raw % s; const fs = f.toString().padStart(dec, '0').replace(/0+$/, ''); if (!fs) return w.toLocaleString('en-US'); if (w === 0n) { const i = fs.search(/[1-9]/); return '0.' + fs.slice(0, i + 3) } return w.toLocaleString('en-US') + '.' + fs.slice(0, 2) }
function decodeStr(hex) { try { const h = hex.slice(2); if (h.length === 64) return decodeURIComponent(h.replace(/(00)+$/, '').replace(/../g, '%$&')); const len = parseInt(h.slice(64, 128), 16); return decodeURIComponent(h.slice(128, 128 + len * 2).replace(/../g, '%$&')).slice(0, 10) } catch { return 'TOKEN' } }

async function fetchBalance(w) {
    return rpcBreaker.execute(async () => {
        const call = (id, data) => ({ jsonrpc: '2.0', id, method: 'eth_call', params: [{ to: CONFIG.TOKEN, data }, 'latest'] });
        // BATCHING: Menggabungkan 3 request menjadi 1
        const payload = [
            call(1, '0x70a08231' + w.slice(2).toLowerCase().padStart(64, '0')), // balanceOf
            call(2, '0x313ce567'), // decimals
            call(3, '0x95d89b41')  // symbol
        ];
        
        const res = await tfetch(CONFIG.RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.status === 429) throw new Error('RATE_LIMITED');
        const arr = await res.json();
        const by = Object.fromEntries((Array.isArray(arr) ? arr : []).map(x => [x.id, x.result]));
        
        if (!by[1] || by[1] === '0x') throw new Error('NO_CONTRACT');
        const dec = by[2] && by[2] !== '0x' ? Number(BigInt(by[2])) : 18;
        const sym = by[3] && by[3] !== '0x' ? decodeStr(by[3]) : 'TOKEN';
        
        // BIGINT PRECISION MANDATE
        const rawBal = BigInt(by[1]);
        return { ok: true, val: fmt(rawBal, dec), sym };
    });
}

async function fetchWheel() { try { const r = await tfetch(CONFIG.API_URL); if (!r.ok) return { ok: false, status: 'HTTP_' + r.status }; const m = (await r.json()).measurement; if (!m) return { ok: false, status: 'NO_DATA' }; return { ok: true, dist: Number(m.distanceMm) / 1e6, status: String(m.coreStatus).slice(0, 18) } } catch { return { ok: false, status: 'OFFLINE' } } }

// ==========================================
// 5. ID CARD: NEO-BRUTALIST GENERATION
// ==========================================
 function avatar(ctx, w, x0, y0, px) {
    const r = rng(seedOf(w) ^ 0x5eed), hue = Math.floor(r() * 360);
    const fur = `hsl(${hue},80%,62%)`, dark = `hsl(${hue},70%,32%)`, acc = `hsl(${(hue + 180) % 360},90%,60%)`;
    const grid = [];
    for (let y = 0; y < 16; y++) { grid[y] = []; for (let x = 0; x < 8; x++) { const dx = (x - 7.5) / 6.5, dy = (y - 9) / 6.5; grid[y][x] = dx * dx + dy * dy <= 1 ? (r() < .22 ? 2 : 1) : 0 } }
    for (let y = 1; y < 5; y++) for (let x = 2; x < 5; x++) if (x - 2 <= y - 1) grid[y][x] = (y > 2 && x === 3) ? 3 : 2;
    const eyeY = 8 + Math.floor(r() * 2), glasses = r() < .25, hat = r() < .3;
    ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, 16 * px, 16 * px);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
        const v = grid[y][x]; if (!v) continue;
        let c = v === 2 ? dark : v === 3 ? '#ff5c9a' : fur;
        if (y === eyeY && x === 5) c = glasses ? acc : '#000';
        if (y === eyeY + 2 && x === 7) c = '#ff5c9a';
        ctx.fillStyle = c; ctx.fillRect(x0 + x * px, y0 + y * px, px, px); ctx.fillRect(x0 + (15 - x) * px, y0 + y * px, px, px);
    }
    if (glasses) { ctx.fillStyle = acc; ctx.fillRect(x0 + 4 * px, y0 + eyeY * px, 8 * px, Math.max(1, px >> 1)) }
    if (hat) { ctx.fillStyle = acc; ctx.fillRect(x0 + 4 * px, y0 + 2 * px, 8 * px, 2 * px); ctx.fillRect(x0 + 3 * px, y0 + 4 * px, 10 * px, px) }
}

async function generateCard() {
    const w = $('walletInput').value.trim();
    if (!isAddr(w)) return say('VALID WALLET REQUIRED FOR ID CARD.', 'pink');
    $('genBtn').disabled = true; say('FETCHING ON-CHAIN DATA...', 'cyan');
    await document.fonts.ready;

    let wheel, bal;
    try {
        [wheel, bal] = await Promise.all([fetchWheel(), fetchBalance(w)]);
    } catch (e) {
        bal = { ok: false, status: e.message === 'CIRCUIT_BREAKER_OPEN' ? 'RPC_BLOCKED' : 'FETCH_ERROR' };
        wheel = { ok: false, status: 'OFFLINE' };
    }

    const an = makeAnthem(w), b = best(w), c = $('card'), ctx = c.getContext('2d'), CW = 400, CH = 600;
    
    // Canvas Neo-Brutalist
    fitCanvas(c, ctx, CW, CH, 3);
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, CW - 6, CH - 6);
    ctx.fillStyle = '#00ff00'; ctx.fillRect(3, 3, CW - 6, 40);
    
    ctx.textAlign = 'left'; ctx.fillStyle = '#000'; ctx.font = 'bold 20px "Space Mono"';
    ctx.fillText('SQUEEK CITIZEN // ID CARD', 15, 30);
    
    // Avatar (Kotak, tanpa blur)
    avatar(ctx, w, CW/2 - 64, 60, 8);
    
    const row = (l, v, x, y, col) => {
        ctx.fillStyle = '#888'; ctx.font = '12px "Space Mono"'; ctx.fillText(l, x, y);
        ctx.fillStyle = col; ctx.font = 'bold 16px "Space Mono"'; ctx.fillText(v, x, y + 20);
    };

    row('WALLET:', w.slice(0, 10) + '...' + w.slice(-8), 25, 220, '#00ffff');
    
    // Kotak pemisah
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(25, 260); ctx.lineTo(CW-25, 260); ctx.stroke();

    row('ANTHEM:', `${an.key} ${an.scaleName}`, 25, 290, '#ff00ff');
    row('TEMPO:', `${an.bpm} BPM`, 220, 290, '#ff00ff');
    row('BEST SCORE:', b ? String(b.score) : 'NONE', 25, 340, '#ffff00');
    row('GRADE:', b ? b.grade : '--', 220, 340, '#ffff00');
    
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(25, 380); ctx.lineTo(CW-25, 380); ctx.stroke();

    const balText = bal.ok ? `${bal.val} ${bal.sym}` : `[ ${bal.status} ]`;
    row('TOKEN BALANCE:', balText, 25, 410, bal.ok ? '#00ff00' : '#ff00ff');
    
    row('WHEEL STATUS:', wheel.status, 25, 460, wheel.ok ? '#00ff00' : '#ff00ff');
    row('DISTANCE:', wheel.ok ? wheel.dist.toFixed(3) + ' KM' : '-', 220, 460, '#00ff00');

    // Signature Bars
    ctx.fillStyle = '#888'; ctx.font = '12px "Space Mono"'; ctx.fillText('ANTHEM SIGNATURE:', 25, 510);
    an.sig.forEach((v, i) => {
        const h = v * 40; ctx.fillStyle = `hsl(${(an.hue + i * 8) % 360}, 100%, 50%)`;
        ctx.fillRect(25 + i * 14, 560 - h, 10, h);
    });

    // Barcode garis kasar
    ctx.fillStyle = '#fff'; ctx.font = '10px "Space Mono"'; ctx.textAlign = 'center';
    ctx.fillText(`UNOFFICIAL DATA // ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, CW / 2, CH - 15);

    $('cardArea').classList.remove('hidden'); $('genBtn').disabled = false; say('ID CARD GENERATED.', 'green');
    c.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const cardBlob = () => new Promise(r => $('card').toBlob(r, 'image/png'));
async function download() { const b = await cardBlob(), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = 'squeek-id-' + $('walletInput').value.trim().slice(2, 8) + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000) }
async function share() { const b = await cardBlob(), f = new File([b], 'squeek-id.png', { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'Squeek Citizen ID' }) } catch { } } else download(); }

// ==========================================
// 6. UI WIRING
// ==========================================
function say(t, c) { $('message').textContent = t; $('message').style.color = `var(--neon-${c})`; }
function show(id) { ['mainPanel', 'gamePanel', 'resultPanel'].forEach(p => $(p).classList.toggle('hidden', p !== id)) }
function preview() { const w = $('walletInput').value.trim(); if (w && !isAddr(w)) { $('anthemInfo').textContent = 'INVALID ADDRESS'; return } const a = makeAnthem(w), b = best(w); $('anthemInfo').textContent = `>> ANTHEM: ${a.key} ${a.scaleName} [${a.bpm} BPM] // NOTES: ${a.chart.length}${b ? ' // BEST: ' + b.score : ''}` }

$('walletInput').addEventListener('input', preview);
$('connectBtn').onclick = async () => {
    if (!window.ethereum) return say('WEB3 WALLET NOT DETECTED.', 'pink');
    try { const [a] = await window.ethereum.request({ method: 'eth_requestAccounts' }); $('walletInput').value = a; preview(); say('WALLET LINKED.', 'green') } catch { say('CONNECTION REJECTED.', 'pink') }
};
$('playBtn').onclick = play; $('genBtn').onclick = generateCard;
$('dlBtn').onclick = download; $('shareBtn').onclick = share;
$('stopBtn').onclick = stop; $('againBtn').onclick = play;
$('homeBtn').onclick = () => show('mainPanel');
$('toCardBtn').onclick = () => { show('mainPanel'); generateCard() };
preview();
