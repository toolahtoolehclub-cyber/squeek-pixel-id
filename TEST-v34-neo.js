// v39 tests — run: node TEST-v34-neo.js  (cwd = the v39 folder)
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }

// --- 1. every v31 id still present exactly once (no feature lost) ---
const IDS = ['mainTitle', 'langBtn', 'qualityBtn', 'muteBtn', 'tabBar', 'tab-play', 'tab-daily', 'tab-live', 'tab-league', 'tab-me',
  'walletInput', 'walletWarn', 'connectBtn', 'anthemInfo', 'avatarPreviewWrap', 'avatar-preview', 'avatarLabel', 'levelLabel', 'anthemHash',
  'genreRow', 'diffRow', 'optionsRow', 'modeRow', 'lanesBtn', 'mirrorBtn', 'raceBox', 'petLine', 'raceInfo', 'raceLast', 'liveBox', 'liveInfo', 'liveLine',
  'dailyBox', 'dailyTitle', 'dailyInfo', 'streakLine', 'freezeLine', 'missionList', 'playBtn', 'genBtn', 'message', 'glStatus', 'card-canvas', 'dlBtn', 'shareBtn',
  'tutorialBox', 'tutorialSteps', 'tutorialCloseBtn', 'bossBox', 'bossLine', 'bossHist', 'bossBtn', 'champBox', 'champList', 'masteryBox', 'historyBars', 'masteryStats',
  'awayBox', 'awayLine', 'diaryList', 'diaryNote', 'diaryNoteBtn', 'predictBox', 'roundLine', 'predNapBtn', 'predJogBtn', 'predZoomiesBtn', 'predStatus', 'predResult',
  'roundHistBox', 'roundHistList', 'leagueBox', 'leagueList', 'achBox', 'achList', 'calibBox', 'offsetLine', 'offsetMinusBtn', 'offsetPlusBtn', 'calibBtn', 'calibMsg', 'calibTapBtn', 'calibProg', 'unlockBox',
  'gamePanel', 'scoreVal', 'comboVal', 'accVal', 'bpmVal', 'game-canvas', 'precisionBox', 'lastHit', 'avgHit', 'hitDir', 'feverTag', 'raceHud', 'raceYouBar', 'raceOppBar', 'raceYouTxt', 'raceOppTxt', 'cardErrMsg',
  'gameAudioStatus', 'liveHud', 'vizBars', 'pauseBtn', 'stopBtn', 'resultPanel', 'gradeVal', 'resultKv', 'bestMsg', 'xpMsg', 'missionResult', 'againBtn', 'toCardBtn', 'resultCardBtn',
  'duelBtn', 'shareXBtn', 'rivalBackMsg', 'duelMsg', 'duelOut', 'homeBtn', 'overlayBox', 'overlayTitle', 'overlayRpm', 'overlayDist', 'overlayRound', 'overlayZoom', 'overlayPet', 'overlaySong',
  'musicSplash', 'startMusicBtn', 'startMusicSantaiBtn', 'bg-gl', 'bg-anim', 'crt', 'volSlider', 'volVal', 'musicModeBtn', 'practiceBtn', 'obsBtn', 'howBtn'];
IDS.forEach(id => {
  const n = (html.match(new RegExp('id="' + id + '"', 'g')) || []).length;
  t('id present once: ' + id, n === 1);
});
// --- 2. new v32 ids (kept) + new v33 ids ---
['settingsBtn', 'settingsSheet', 'settingsBackdrop', 'settingsCloseBtn', 'latVal', 'latCalibBtn'].forEach(id => {
  const n = (html.match(new RegExp('id="' + id + '"', 'g')) || []).length;
  t('v32 id present once: ' + id, n === 1);
});
['cardOverlay', 'cardBackdrop', 'cardCloseBtn', 'cardMinBtn', 'cardBar', 'cardBarOpen', 'cardBarClose', 'cardTitle'].forEach(id => {
  const n = (html.match(new RegExp('id="' + id + '"', 'g')) || []).length;
  t('v33 id present once: ' + id, n === 1);
});
t('cardArea is gone (overlay replaces it)', !html.includes('cardArea'));
t('html has neo-head', html.includes('class="neo-head"'));
// --- 3. no arcade leftovers in the HTML ---
['INSERT COIN', 'class="marquee"', 'class="bulbs"', 'cab-side', 'splash-coin', 'btn-arcade', 'v31 ARCADE'].forEach(s => t('html free of arcade leftover: ' + s, !html.includes(s)));
t('html says v39', (html.match(/v39/g) || []).length >= 2);
t('browser tab title is v39', html.includes('<title>SQUEEKCHAIN // v39</title>'));
t('no BNB/Binance anywhere (v37.1)', !/BNB|Binance/i.test(html + css + js + readme));
t('SQK token is the current deployment (v37.1)', /TOKEN: '0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e'/.test(js) && !js.includes('0x810239'));
// --- v37.1 CHAIN panel + frontier-aware Round History ---
['chainBox', 'chainLines'].forEach(id => t('v37.1 chain id present once: ' + id, (html.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1));
t('chain box uses i18n title', html.includes('data-i18n="chainTitle"') && html.includes('data-i18n="chainLoading"'));
['CORE_URL', 'ECONOMY_URL', 'GENESIS_TS', 'fetchChain', 'refreshChain', 'renderChainBox', 'roundIdForKey', 'roundSettled', 'estWork', 'estBlocks'].forEach(s => t('v37.1 js has ' + s, js.includes(s)));
t('chain urls are the public API', js.includes("CORE_URL: 'https://api.squeekchain.com/v1/core'") && js.includes("ECONOMY_URL: 'https://api.squeekchain.com/v1/economy/state'"));
t('genesis ts matches docs', js.includes('GENESIS_TS = 1793735400'));
t('chain unknown never zero', js.includes("chainUnknown") && js.includes("'UNAVAILABLE'"));
t('round hist template has work/blocks/state', js.includes('{work}') && js.includes('{blocks}') && js.includes('{state}'));
t('estWork is avg x 10', js.includes('function estWork(avg) { return Math.round(avg * 10); }'));
t('estBlocks is work x 1000 / difficulty', js.includes('work * 1000 / diff'));
t('frontier compare is <= settled', js.includes('id <= chainSnapshot.settled'));
// roundIdForKey: run it — round 533 starts at unix 1794055200 (2026-11-07 12:40 UTC)
const rifSrc = js.slice(js.indexOf('function roundIdForKey'), js.indexOf('function roundSettled'));
const rif = new Function('GENESIS_TS', rifSrc + '; return roundIdForKey;')(1793735400);
const d533 = new Date(1794055200 * 1000);
const p2 = n => String(n).padStart(2, '0');
const key533 = `${d533.getFullYear()}-${p2(d533.getMonth() + 1)}-${p2(d533.getDate())}-${p2(d533.getHours())}:${p2(Math.floor(d533.getMinutes() / 10) * 10)}`;
t('roundIdForKey maps round 533', rif(key533) === 533);
t('roundIdForKey rejects bad keys', rif('nope') === null && rif('') === null);
const ewLine = js.slice(js.indexOf('function estWork'), js.indexOf('\n', js.indexOf('function estWork')));
const ebLine = js.slice(js.indexOf('function estBlocks'), js.indexOf('\n', js.indexOf('function estBlocks')));
const eb = new Function(ewLine + '\n' + ebLine + '\nreturn { estWork, estBlocks };')();
t('estWork(35) = 350', eb.estWork(35) === 350);
t('estBlocks(35, 8238) = 4.2', eb.estBlocks(35, 8238) === 4.2);
t('estBlocks needs a difficulty', eb.estBlocks(35, 0) === null);
// --- v37.1 MY SQUEEK on the ID Card ---
t('fetchAccount defined', js.includes('async function fetchAccount(w)'));
t('account url is the public API', js.includes("https://api.squeekchain.com/v1/accounts/' + w.toLowerCase()"));
t('card fetches account with wheel + balance', js.includes('[wheel, bal, acct] = await Promise.all([fetchWheel(), fetchBalance(w), fetchAccount(w)])'));
t('card is taller for MY SQUEEK', js.includes('CW = 400, CH = 680;'));
['MY SQUEEK', 'NEXT MERGE', 'STAKED SQK', 'CLAIMABLE'].forEach(s => t('card has row: ' + s, js.includes("row('" + s + "'")));
t('card shows NONE YET honestly', js.includes("'NONE YET — NO SQUEEK FOUND'"));
t('card shows READY NOW for merge-ready', js.includes("'READY NOW'"));
t('account picks staking custody first', js.includes("b.custody === 'staking'"));
t('account power uses fmtSqk', js.includes('fmtSqk(power.nftPower') && js.includes('fmtSqk(rewards.claimableBaseUnits'));
// fmtSqk on the real reserve-Safe account numbers (browser check 2026-11-07)
const fmtSrc = js.slice(js.indexOf('function fmt('), js.indexOf('function decodeStr'));
const fsqLine = js.slice(js.indexOf('function fmtSqk'), js.indexOf('\n', js.indexOf('function fmtSqk')));
const fsq = new Function(fmtSrc + '\n' + fsqLine + '\nreturn fmtSqk;')();
t('fmtSqk scales power 1e21 -> 1,000', fsq('1000000000000000000000') === '1,000');
t('fmtSqk claimable -> 25,260.72', fsq('25260722452361385112852') === '25,260.72');
t('fmtSqk zero -> 0', fsq('0') === '0');
t('fmtSqk bad input -> ?', fsq('nope') === '?');
// --- v37.1 Squeek art on the ID Card ---
['fetchSqueekImage', 'loadSqueekImage', 'fixSvgSize', 'squeekImgCache'].forEach(s => t('v37.1 js has ' + s, js.includes(s)));
t('squeek image url is the public API', js.includes("https://api.squeekchain.com/v1/squeeks/' + id"));
t('card draws the Squeek image', js.includes('drawImage(sqkImg, 26, 510, 72, 72)'));
t('card frames the image', js.includes('strokeRect(24, 508, 76, 76)'));
t('card has a dashed placeholder', js.includes('setLineDash([4, 4])'));
t('image fetch is time-boxed', js.includes('setTimeout(() => res(null), 4000)') && js.includes('setTimeout(() => r(null), 5000)'));
t('card is 400x680 (v37.1)', js.includes('CW = 400, CH = 680;'));
// fixSvgSize: run it on real-shape samples
const fssSrc = js.slice(js.indexOf('function fixSvgSize'), js.indexOf('function loadSqueekImage'));
const fss = new Function(fssSrc + '; return fixSvgSize;')();
const bareSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
const bareUri = 'data:image/svg+xml;base64,' + Buffer.from(bareSvg).toString('base64');
const fixed = fss(bareUri);
const fixedSvg = Buffer.from(fixed.split(',')[1], 'base64').toString('utf-8');
t('fixSvgSize adds 512x512 when missing', fixedSvg.includes('width="512"') && fixedSvg.includes('height="512"'));
const sizedSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1568" height="1568" viewBox="0 0 25088 25088"></svg>';
const sizedUri = 'data:image/svg+xml;base64,' + Buffer.from(sizedSvg).toString('base64');
t('fixSvgSize leaves sized SVGs alone', fss(sizedUri) === sizedUri);
t('fixSvgSize passes bad input through', fss('not-a-uri') === 'not-a-uri' && fss(null) === null);
// --- v37.1 ANTHEM no longer collides with TEMPO ---
t('anthemSize defined', js.includes('function anthemSize(v)'));
t('row() takes an optional font size', js.includes("const row = (l, v, x, y, col, fs) =>"));
t('ANTHEM row uses anthemSize', js.includes("row('ANTHEM', anVal, 24, 292, '#ff5ce1', anthemSize(anVal))"));
// anthemSize: run it — first case is the exact value from the user's phone screenshot
const asSrc = js.slice(js.indexOf('function anthemSize'), js.indexOf('async function generateCard'));
const asz = new Function(asSrc + '; return anthemSize;')();
t('anthemSize shrinks the screenshot value', asz('"Blues Minor Pentatonic" • A') === 10);
t('anthemSize shrinks the longest name', asz('"Sunny Major Pentatonic" • C') === 10);
t('anthemSize keeps short names at 14', asz('"Neon Dorian" • C') === 14);
t('anthemSize boundary is 22 chars', asz('x'.repeat(22)) === 14 && asz('x'.repeat(23)) === 10);
t('worst case fits the 200px column', 30 * 10 * 0.6 < 200 && 22 * 14 * 0.6 < 200);
// --- v37.1 LIVE tab fetches immediately ---
t('setTab refreshes LIVE on open', js.includes("if (name === 'live') refreshLive();"));
// --- v37.1 precision readout resets with the game ---
t('game start resets the precision readout', js.includes("if (lh0) lh0.textContent = '-- ms';") && js.includes("if (ah0) ah0.textContent = '-- ms';") && js.includes("if (hd0) hd0.textContent = '—';"));
t('precision readout reset sits next to the hitOffsets reset', (() => { const a = js.indexOf("anthem = makeAnthem(w, false, seedKey, lanes, mirror); lastAnthem = anthem; hitOffsets = [];"); const b = js.indexOf("lh0.textContent = '-- ms'"); return a > 0 && b > a && b - a < 400; })());
t('Genesis meta present', html.includes('<meta name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7">'));
t('README proof last line', readme.trimEnd().split('\n').pop().trim() === 'squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7');
// --- 4. CSS: NEO layer present ---
['.neo-head', '#settingsSheet', '#settingsBackdrop', '.sheet-row', '.lat-row', 'body.playing', '.tab-btn.active', 'border-radius: 999px', '#cardOverlay', '#cardBar', '.card-head'].forEach(s => t('css has ' + s, css.includes(s)));
t('css playing rule hides bg layers', css.includes("body.playing #bg-gl") && css.includes('display: none !important'));
t('css latVal nowrap (v32.2)', css.includes('#latVal { white-space: nowrap; }'));
t('setMode says modeFree on FREE (v32.2)', js.includes("else if (m === 'free') say(msg('modeFree'"));
t('css header is sticky (v33.1)', css.includes('.neo-head { position: sticky;'));
t('css result panel solid (v33.1)', css.includes('#resultPanel { background: rgba(5, 6, 7, .94); }'));
t('css cardbar clearance (v33.1)', css.includes('body.cardbar { padding-bottom: 72px; }'));
t('css scroll-margin below sticky header (v33.2)', css.includes('#gamePanel, #resultPanel { scroll-margin-top: 76px; }'));
t('css mode button tints (v34)', ['#modeRow [data-mode="free"]', '#modeRow [data-mode="daily"]', '#modeRow [data-mode="live"]', '#modeRow [data-mode="race"]'].every(s => css.includes(s)));
t('css theme panel glow (v34)', css.includes('body[data-theme] #gamePanel'));
// --- 5. dict regions ---
function region(src, startMarker, endMarker) { const a = src.indexOf(startMarker); const b = src.indexOf(endMarker, a); return src.slice(a, b); }
const msgEn = region(js, 'const MSG = {', "  id: {");
const msgId = region(js, "  id: {", "};\nfunction msg(");
const i18nEn = region(js, 'const I18N = {', "  id: {");
const i18nId = region(js, 'const I18N = {', "};\nlet lang");
const rlEn = region(js, 'const RLBL = {', "  id: {");
const rlId = region(js, 'const RLBL = {', "};\nfunction rl(");
// every data-i18n key in HTML exists in both I18N dicts
const i18nKeys = [...new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]))];
t('data-i18n keys found: ' + i18nKeys.length, i18nKeys.length >= 40);
i18nKeys.forEach(k => {
  t('I18N en has ' + k, i18nEn.includes(k + ':'));
  t('I18N id has ' + k, i18nId.includes(k + ':'));
});
// every msg()/msgf() key exists in both MSG dicts
const msgKeys = [...new Set([...js.matchAll(/msgf?\('([^']+)'/g)].map(m => m[1]))];
t('msg keys found: ' + msgKeys.length, msgKeys.length >= 80);
msgKeys.forEach(k => {
  t('MSG en has ' + k, msgEn.includes(k + ':'));
  t('MSG id has ' + k, msgId.includes(k + ':'));
});
// every rl() key exists in both RLBL dicts
const rlKeys = [...new Set([...js.matchAll(/rl\('([^']+)'/g)].map(m => m[1]))];
rlKeys.forEach(k => {
  t('RLBL en has ' + k, rlEn.includes(k + ':'));
  t('RLBL id has ' + k, rlId.includes(k + ':'));
});
// every I18N[lang].x usage exists in both I18N dicts
const i18nUse = [...new Set([...js.matchAll(/I18N\[lang\]\.([a-zA-Z]+)/g)].map(m => m[1]))];
i18nUse.forEach(k => {
  t('I18N usage en has ' + k, i18nEn.includes(k + ':'));
  t('I18N usage id has ' + k, i18nId.includes(k + ':'));
});
// TUT bilingual, 6 steps each
t('TUT en 6 steps', (msgEn.match(/'1\. /g) || []).length >= 0); // placeholder, real check below
const tut = js.slice(js.indexOf('const TUT = {'), js.indexOf('};', js.indexOf('const TUT = {')) + 2);
t('TUT has en + id', tut.includes('en: [') && tut.includes('id: ['));
t('TUT 6 steps each', (tut.match(/'1\. /g) || []).length === 2 && (tut.match(/'6\. /g) || []).length === 2);
// --- 6. performance wiring ---
['document.body.classList.add(\'playing\')', "document.body.classList.remove('playing')", 'function pauseGL()', 'function resumeGL()', 'pauseGL()', 'resumeGL()', 'lastVizTs', 'function closeSettings()', "bindClick('latCalibBtn'"].forEach(s => t('js has ' + s, js.includes(s)));
t('viz throttle 100ms', js.includes('lastVizTs > 100'));
t('sheet wiring present', js.includes("bindClick('settingsBtn'") && js.includes("bindClick('settingsCloseBtn'") && js.includes("bindClick('settingsBackdrop'"));

// --- 6b. v33 NEO+ wiring ---
t('settings sheet lives outside mainPanel', html.indexOf('id="settingsSheet"') > html.indexOf('</main>'));
t('card overlay lives outside mainPanel', html.indexOf('id="cardOverlay"') > html.indexOf('</main>'));
t('pause row sits above the canvas', html.indexOf('id="pauseBtn"') < html.indexOf('id="game-canvas"'));
t('ACC is an integer (no truncation)', js.includes("Math.round(accuracy()) + '%'"));
t('10 scales defined', ['Lydian', 'Mixolydian', 'Aeolian', 'Blues', 'Major'].every(s => js.includes("'" + s + "'")));
t('cyber has 5 scales', js.includes("scales: ['Phrygian', 'Harmonic Minor', 'Minor Pentatonic', 'Aeolian', 'Blues']"));
t('shockwave rings exist', js.includes("type: 'ring'") && js.includes('p.r += 320 * dt'));
t('miss glitch exists', js.includes('G.glitchT'));
t('hue-tinted canvas bg exists', js.includes('G.bgGrad'));
t('lane flash stronger', js.includes('.10 + f * .45'));
t('14 particles per hit', js.includes('for (let i = 0; i < 14; i++)'));
t('fever gold hit line', js.includes("G.fever ? '#ffd700'"));
t('judgement text at the hit lane', js.includes("addFloatText(k === 'perfect' ? 'PERFECT!'"));
t('play scrolls to the game', js.includes("$('gamePanel').scrollIntoView"));
t('finish scrolls to the result', js.includes("$('resultPanel').scrollIntoView"));
t('shared cardFrame helper', js.includes('function cardFrame('));
t('no CREATOR line on the cards', !js.includes('CREATOR: pancigoreng'));
t('id card 400x680, result card 400x560 (v37.1)', js.includes('CW = 400, CH = 680;') && (js.match(/CW = 400, CH = 560/g) || []).length === 1);
t('overlay open/close/minimize wired', js.includes("bindClick('cardCloseBtn'") && js.includes("bindClick('cardMinBtn'") && js.includes("bindClick('cardBarOpen'"));
t('ID card opens the overlay', js.includes("openCard(msg('cardTitleId'))"));
t('result card opens the overlay', js.includes("openCard(msg('cardTitleResult'))"));
t('no panel jump for cards', !js.includes("setTab('play'); show('mainPanel'); generateCard()") && !js.includes("show('mainPanel'); say(msg('cardReady')"));
t('settings pause the game mid-song', js.includes('pausedBySettings'));
t('tutorial cannot abandon a running song', js.includes("if (G && !G.ended) { closeSettings(); return; }"));

// --- 6c. v33.1 wiring ---
t('card error line exists in the result panel', html.indexOf('id="cardErrMsg"') > html.indexOf('id="resultPanel"'));
['cardErrMsg', "state: 'paused'", "state: 'running'", "document.body.classList.add('cardbar')", "document.body.classList.remove('cardbar')", 'SONG_MOODS', 'const motif', 'motif[bar % 2][s]', 'lastResultIsNew', '★ NEW BEST! ★', 'Math.pow(1 - p, 3)', '"${a.name}"'].forEach(s => t('js has ' + s, js.includes(s)));
t('generateCard shows the error on the result panel', js.includes("if (em && !$('resultPanel').classList.contains('hidden'))"));
t('makeAnthem returns a song name', js.includes("name: (SONG_MOODS[scaleName]"));
// v39 (Batch 2): the result card no longer reads the score from G with a
// val(0) fallback — drawResultCard() reads STATE (lastResult + G): the score
// comes from G.score with a lastResult.score fallback, and every other number
// (acc, combo, counts, anthem, setup) from lastResult, never from DOM
// innerText. The old expectation ('G.score !== undefined ? G.score : val(0)')
// described the pre-v39 card and is retired, not deleted.
t('result card reads the score from state G/lastResult (v39, count-up safe)', js.includes('const r = lastResult || {};') && js.includes("String(G && G.score !== undefined ? G.score : (r.score !== undefined ? r.score : 0))"));
t('result card never parses the panel DOM', !js.includes("resultKv').innerText") && !js.includes('resultKv").innerText') && !js.includes('val(0)'));
t('result card anthem row reads the lastResult song snapshot (v39)', js.includes('detail(rl(\'anthem\'), r.song ? `"${r.song.name}" • ${r.song.key}` : \'—\');'));

// --- 6d. v33.2 wiring ---
t('audio template has a {run} word (v33.2)', js.includes("gameAudioTpl: 'AUDIO: {run}"));
t('audio run word passed in play/pause/resume', js.includes("run: msg('audioRunning')") && js.includes("run: msg('audioPaused')"));
// v39 (Batch 2): the result panel anthem row reads the snapshot of the song
// actually PLAYED (G.song, taken in play()), not the global `anthem` which
// preview may have rebuilt since. The old v33.2 expectation
// ('"${anthem.name}" • ${anthem.key}') is retired — it allowed the smoke-test
// bug where the panel showed a different song than the one played.
t('anthem kv row is name + key from the played-song snapshot G.song (v39)', js.includes('<b>"${G.song.name}" • ${G.song.key}</b>') && !js.includes('<b>"${anthem.name}" • ${anthem.key}</b>'));
t('ID card anthem row is name + key only, adaptive size (v37.1)', js.includes('const anVal = `"${an.name}" • ${an.key}`;') && js.includes("row('ANTHEM', anVal, 24, 292, '#ff5ce1', anthemSize(anVal))"));
t('card detail slice is 40 (v33.2)', js.includes('.slice(0, 40)'));
t('no 34-char card slice left', !js.includes('.slice(0, 34)'));

// --- 6e. v34 THEMES wiring ---
['cyber', 'sunrise', 'wheel', 'versus', 'calm', 'void', 'gold'].forEach(k => t('THEMES has ' + k, js.includes('const THEMES = {') && new RegExp(k + ':\\s*\\{').test(js)));
t('themeKeyFor maps modes', js.includes("function themeKeyFor(mode, boss)") && js.includes("mode === 'daily'") && js.includes("mode === 'live'") && js.includes("mode === 'race'"));
t('drawHamster defined with 7x7 grid', js.includes('function drawHamster(x, y, size, body)') && js.includes("'.H...H.'") && js.includes("'HDHWHDH'"));
t('notes drawn as hamsters', js.includes('drawHamster(x, y, 48, col)'));
t('no rectangle notes left', !js.includes('fillRect(Math.round(x - 35)'));
t('receptor rings drawn', js.includes('cx.arc(rx, CONFIG.HIT_Y, 26 + f * 8'));
t('pixel grid drawn', js.includes('th.grid') && js.includes('gx += 30') && js.includes('gy += 30'));
t('theme assigned in play', js.includes("G.theme = THEMES[themeKey]") && js.includes('document.body.dataset.theme = themeKey'));
t('theme cleared in stop', js.includes('delete document.body.dataset.theme'));
t('draw uses the theme', js.includes('const th = G.theme || THEMES.cyber') && js.includes('th.pulse') && js.includes('th.lane') && js.includes('th.hit'));
t('ZOOMIES banner on transition', js.includes("addFloatText('ZOOMIES ×2!'"));
t('theme gradient background', js.includes('G.theme.bg[0]') && js.includes('G.theme.bg[1]'));

// --- 7. applyLang re-renders the new dynamic bits ---
['preview();', 'renderDailyBox();', 'renderMastery();', 'renderUnlocks();', 'renderPracticeBtn();', 'updateMusicModeBtn();', 'renderOffsetLine();', 'renderLiveBox();', 'renderAway();'].forEach(s => t('applyLang calls ' + s, js.includes(s)));
t('applyLang sets placeholders', js.includes('diaryNote') && js.includes('duelOut') && js.includes('placeholder'));
// --- 8. setTab still works (stub DOM) ---
const setTabSrc = js.slice(js.indexOf('function setTab'), js.indexOf('function setTab') + 900);
t('setTab defined with TABS list', setTabSrc.includes("['play', 'daily', 'live', 'league', 'me']") || js.includes("const TABS = ['play', 'daily', 'live', 'league', 'me']"));
t('setTab persists sqk31:tab', js.includes("sqk31:tab"));
// --- 9. no arcade strings in JS UI text ---
['INSERT COIN', 'SQUEEKCHAIN</h1>'].forEach(s => t('js free of: ' + s, !js.includes(s)));
// --- 10. storage keys unchanged (no user data lost) ---
['sqk24:', 'sqk28:', 'sqk29:', 'sqk30:', 'sqk31:tab'].forEach(s => t('storage key kept: ' + s, js.includes(s)));

// --- 11. v37.1 global leaderboard (Cloudflare Workers + D1) ---
['lbBox', 'lbName', 'lbModes', 'lbList', 'lbRank', 'lbRefreshBtn', 'lbSubmitBtn', 'lbSubmitMsg'].forEach(id => {
  const n = (html.match(new RegExp('id="' + id + '"', 'g')) || []).length;
  t('v37.1 id present once: ' + id, n === 1);
});
t('lbBox uses i18n title/note', html.includes('data-i18n="lbTitle"') && html.includes('data-i18n="lbNote"'));
t('lb submit button uses i18n', html.includes('data-i18n="lbSubmit"'));
['LB_URL', 'LB_MODES', 'lbState', 'lastResult', 'truncAddr', 'lbCleanName', 'lbMode', 'lbName', 'renderLbModes', 'renderLb', 'fetchLb', 'fetchLbRank', 'resetLbSubmit', 'submitLb'].forEach(s => t('v37.1 js has ' + s, js.includes(s)));
t('LB_URL is the workers.dev endpoint', js.includes("LB_URL: 'https://squeekchain-leaderboard.pancigoreng.workers.dev'"));
t('lb modes are the six game modes', js.includes("const LB_MODES = ['free', 'daily', 'live', 'race', 'boss', 'challenge'];"));
['lbLoading', 'lbOffline', 'lbEmpty', 'lbSent', 'lbKept', 'lbNeedWallet', 'lbNoScore', 'lbPractice', 'lbYourRank'].forEach(k => t('MSG has lb key: ' + k, js.includes(k + ':')));
['lbTitle', 'lbNote', 'lbRefresh', 'lbSubmit'].forEach(k => t('I18N has lb key: ' + k, js.includes(k + ':')));
t('setTab fetches the board on LEAGUE', js.includes("if (name === 'league') fetchLb(lbState.mode);"));
t('endGame captures the submittable result (v38: + sessionId/taps/notes/durationMs)', js.includes('lastResult = { score: G.score, acc: a, mode: G.mode, practice: G.practice, sessionId: G.sessionId || null, taps: G.taps || 0, notes:') && js.includes('durationMs: anthem ? Math.round(anthem.duration * 1000) : 0'));
t('submit is disabled while sending', js.includes('b.disabled = true') && js.includes('resetLbSubmit()'));
t('submit posts to /scores', js.includes("CONFIG.LB_URL + '/scores'") && js.includes("method: 'POST'"));
t('submit only beats the stored best (worker upsert)', js.includes("d.improved ? msg('lbSent') : msg('lbKept')"));
t('board rows escape names', js.includes("escHtml(r.name || 'GUEST')") && js.includes('escHtml(truncAddr(r.wallet))'));
t('practice runs cannot submit', js.includes("if (lastResult.practice) return show(msg('lbPractice'));"));
t('no wallet cannot submit', js.includes("if (!isAddr(w)) return show(msg('lbNeedWallet'));"));
t('lb name saved to sqk37', js.includes('sqk37:lbname'));
const taSrc = js.slice(js.indexOf('function truncAddr'), js.indexOf('\n', js.indexOf('function truncAddr')));
const ta = new Function(taSrc + '; return truncAddr;')();
t('truncAddr shortens a wallet', ta('0x372D48abe5eDccCcDE9BD914a6dE30Dc53e3a1Db') === '0x372D...a1Db');
t('truncAddr rejects non-wallets', ta('x') === 'GUEST' && ta('') === 'GUEST');
const cnSrc = js.slice(js.indexOf('function lbCleanName'), js.indexOf('\n', js.indexOf('function lbCleanName')));
const cn = new Function(cnSrc + '; return lbCleanName;')();
t('lbCleanName trims and caps at 16', cn('  pancigoreng-panjang  ') === 'pancigoreng-panj');
t('lbCleanName strips markup', cn('a<b>c') === 'abc' && cn('x"y') === 'xy');
t('lbCleanName empty is GUEST', cn('') === 'GUEST' && cn(null) === 'GUEST');
const lmSrc = js.slice(js.indexOf('function lbMode'), js.indexOf('\n', js.indexOf('function lbMode')));
const lm = new Function("const LB_MODES = ['free', 'daily', 'live', 'race', 'boss', 'challenge'];\n" + lmSrc + '; return lbMode;')();
t('lbMode passes known modes', lm('race') === 'race' && lm('boss') === 'boss');
t('lbMode falls back to free', lm('bogus') === 'free' && lm('') === 'free');

// --- 11b. v37.1 LEAGUE layout fixes (phone width, user screenshot 22:05 WIB 7 Nov) ---
t('v37.1 refresh button does not take the whole row', /\.lb-row\s+\.btn-secondary\s*\{[^}]*width:\s*auto/.test(css));
t('v37.1 mode buttons size to content so CHALLENGE wraps', /\.lb-mode\s*\{[^}]*flex:\s*none/.test(css));
t('v37.1 empty rank line is hidden', /#lbRank:empty\s*\{\s*display:\s*none/.test(css));
t('v37.1 name input still flexes to fill the row', /\.lb-row\s+input\[type=text\]\s*\{[^}]*flex:\s*1/.test(css));
t('v37.1 mode row still wraps', /#lbModes\s*\{[^}]*flex-wrap:\s*wrap/.test(css));

// --- 11c. v37.2 compact avatar + centered LEAGUE modes (user phone screenshots 23:07/23:10 WIB 7 Nov) ---
t('v37.2 avatar box is a horizontal row', /#avatarPreviewWrap\s*\{[^}]*flex-direction:\s*row/.test(css));
t('v37.2 avatar canvas is compact (84px)', /#avatar-preview\s*\{[^}]*width:\s*84px/.test(css));
t('v37.2 avatar labels sit beside the canvas', html.includes('class="avatar-meta"') && html.includes('id="avatarLabel"') && html.includes('id="levelLabel"') && html.includes('id="anthemHash"'));
['avatarPreviewWrap', 'avatar-preview', 'avatarLabel', 'levelLabel', 'anthemHash'].forEach(id => {
  const n = (html.match(new RegExp('id="' + id + '"', 'g')) || []).length;
  t('v37.2 avatar id present once: ' + id, n === 1);
});
t('v37.2 LEAGUE mode buttons are centered', /#lbModes\s*\{[^}]*justify-content:\s*center/.test(css));

// --- 12. v38: XP economy, Squeek day, remembered wallet, LEGACY LV8, pause, sessions ---
const jsLines = js.split('\n');
function fnSrc38(name) {
  const start = jsLines.findIndex(l => l.startsWith('function ' + name + '('));
  if (start < 0) throw new Error('function not found: ' + name);
  let depth = 0, end = start;
  for (let i = start; i < jsLines.length; i++) { for (const ch of jsLines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return jsLines.slice(start, end + 1).join('\n');
}
function oneLine38(prefix) { const l = jsLines.find(l => l.startsWith(prefix)); if (!l) throw new Error('line not found: ' + prefix); return l; }

// 12a. XP_LEVELS + levelFor (run the real functions)
t('XP_LEVELS is the v38 curve', js.includes('const XP_LEVELS = [0, 700, 2000, 4300, 8500, 16000, 29500, 54000];'));
const levelFor = new Function(oneLine38('const XP_LEVELS =') + '\n' + oneLine38('function levelFor') + '\nreturn levelFor;')();
[[0, 1], [699, 1], [700, 2], [1999, 2], [2000, 3], [4299, 3], [4300, 4], [8499, 4], [8500, 5], [15999, 5], [16000, 6], [29499, 6], [29500, 7], [53999, 7], [54000, 8], [100000, 8]].forEach(([xp, lv]) => t('levelFor(' + xp + ') = LV' + lv, levelFor(xp) === lv));
t('old LV8 total 4000 XP is now LV3', levelFor(4000) === 3);
t('no old XP thresholds left', !js.includes('[0, 100, 250, 500, 900, 1500, 2500, 4000]'));

// 12b. squeekTodayStr() — Squeek day boundary 12:00 UTC (= 19:00 WIB)
const squeekTodayStr = new Function(oneLine38('function squeekTodayStr') + '\nreturn squeekTodayStr;')();
t('squeekTodayStr 11:59 UTC -> yesterday', squeekTodayStr(new Date('2026-11-08T11:59:00Z')) === '2026-11-07');
t('squeekTodayStr 12:00 UTC -> today', squeekTodayStr(new Date('2026-11-08T12:00:00Z')) === '2026-11-08');
t('squeekTodayStr 00:30 UTC -> yesterday', squeekTodayStr(new Date('2026-11-08T00:30:00Z')) === '2026-11-07');
t('squeekTodayStr 18:59 WIB (11:59 UTC) is still the old Squeek day', squeekTodayStr(new Date('2026-11-08T11:59:59Z')) === '2026-11-07');
t('squeekTodayStr uses Squeek helpers, not local todayStr, for daily/missions/streak', js.includes("squeekTodayStr()") && !js.includes('function yesterdayStr(') && !js.includes('function twoDaysAgoStr('));

// 12c. remembered wallet — run the real saveWallet38 with a mock localStorage
const store38 = {};
const ls38 = { getItem: k => (k in store38 ? store38[k] : null), setItem: (k, v) => { store38[k] = String(v); }, removeItem: k => { delete store38[k]; } };
const saveWallet38 = new Function('localStorage', oneLine38('const isAddr =') + '\n' + oneLine38('function saveWallet38') + '\nreturn saveWallet38;')(ls38);
const W38 = '0x372D48abe5eDccCcDE9BD914a6dE30Dc53e3a1Db';
saveWallet38(W38);
t('saveWallet38 stores under key sqk38:wallet', store38['sqk38:wallet'] === W38);
saveWallet38('not-a-wallet');
t('saveWallet38 ignores invalid addresses', store38['sqk38:wallet'] === W38);
saveWallet38('');
t('saveWallet38 ignores empty input', store38['sqk38:wallet'] === W38);
t('wallet refill reads sqk38:wallet on load', js.includes("localStorage.getItem('sqk38:wallet')"));
t('forgetWallet38 removes sqk38:wallet', js.includes("localStorage.removeItem('sqk38:wallet')"));
t('forget wallet button exists once', (html.match(/id="forgetWalletBtn"/g) || []).length === 1);
t('wallet saved on connect + accountsChanged + change/blur', (js.match(/saveWallet38\(/g) || []).length >= 4);
t('no auto eth_requestAccounts outside connectWallet', (js.match(/method: 'eth_requestAccounts'/g) || []).length === 1);

// 12d. LEGACY LV8 — check is always false; run the real migration with a mock store
const legacyLine = jsLines.find(l => l.includes("id: 'legacy8'"));
t('LEGACY LV8 is in ACHIEVEMENTS', !!legacyLine && legacyLine.includes("name: 'LEGACY LV8'"));
t('LEGACY LV8 check is always false', /check: \(\) => false/.test(legacyLine || ''));
const migStore = {};
const migLS = { getItem: k => (k in migStore ? migStore[k] : null), setItem: (k, v) => { migStore[k] = String(v); }, removeItem: k => { delete migStore[k]; } };
const migSrc = ['walletKey', 'loadJSON', 'saveJSON', 'totalXP', 'maybeMigrateLegacy8'].map(fnSrc38).join('\n');
const maybeMigrateLegacy8 = new Function('localStorage', migSrc + '\nreturn maybeMigrateLegacy8;')(migLS);
const WLEG = '0x88538a82143065664232422e2dec4309038fcf9a';
migStore['sqk24:xp:' + WLEG.toLowerCase()] = '5000';
t('migration grants legacy8 to old-LV8 wallet (xp 5000)', maybeMigrateLegacy8(WLEG) === true && JSON.parse(migStore['sqk29:ach:' + WLEG.toLowerCase()]).includes('legacy8'));
t('migration sets per-wallet + global flag', migStore['sqk38:migrated:' + WLEG.toLowerCase()] === '1' && migStore['sqk38:migrated'] === '1');
t('migration runs only once (no duplicate badge)', maybeMigrateLegacy8(WLEG) === false && JSON.parse(migStore['sqk29:ach:' + WLEG.toLowerCase()]).length === 1);
const WLOW = '0x00000000000000000000000000000000000000dEaD';
migStore['sqk24:xp:' + WLOW.toLowerCase()] = '3999';
t('migration skips wallet below 4000 XP', maybeMigrateLegacy8(WLOW) === false && !('sqk29:ach:' + WLOW.toLowerCase() in migStore));
t('migration marks the low wallet too (no second chance)', maybeMigrateLegacy8(WLOW) === false);
const WEDGE = '0x1111111111111111111111111111111111111111';
migStore['sqk24:xp:' + WEDGE.toLowerCase()] = '4000';
t('migration boundary: exactly 4000 XP qualifies', maybeMigrateLegacy8(WEDGE) === true);
t('ID card counts 11 achievements', js.includes(" + '/11 — '") && js.includes("'0/11 — PLAY TO UNLOCK'"));

// 12e. real pause menu (DOM overlay, no window.confirm)
['pauseOverlay', 'pauseVolSlider', 'pauseVolVal', 'pauseCalibBtn', 'pauseResumeBtn', 'pauseExitBtn', 'backToGameBtn'].forEach(id => t('v38 pause id present once: ' + id, (html.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1));
t('no window.confirm anywhere', !js.includes('window.confirm('));
t('exit/terminate are two-step armed', js.includes('armOrExit') && js.includes("pauseSure") && js.includes('[ SURE? TAP AGAIN ]'));
t('pause overlay has its CSS', /#pauseOverlay\s*\{/.test(css) && css.includes('.pause-box'));

// 12f. verified sessions
t('play() requests a server session before building the song', js.includes("CONFIG.LB_URL + '/session'") && js.includes("body: JSON.stringify({ wallet: w || 'GUEST', mode: playMode })"));
t('FREE plays the server seed', js.includes("'FREE-' + String(session38.seed)"));
t('submit carries sessionId/taps/notes/durationMs', js.includes('sessionId: lastResult.sessionId') && js.includes('notes: lastResult.notes') && js.includes('taps: lastResult.taps') && js.includes('durationMs: lastResult.durationMs'));

// 12g. OG/Twitter meta + Genesis proofs intact
const htmlLines = html.split('\n');
t('Genesis meta tag is line 8, byte-identical', htmlLines[7] === '<meta name="squeekchain-project" content="05432539-b4e4-4f90-97b3-c258583905b7">');
t('README last line is the Genesis proof', readme.trimEnd().split('\n').pop() === 'squeekchain-project: 05432539-b4e4-4f90-97b3-c258583905b7');
t('OG image is absolute on the live domain', html.includes('og:image" content="https://squeekpixel.web.id/squeekchain-headline-simple.png"'));
t('Twitter card is summary_large_image', html.includes('twitter:card" content="summary_large_image"'));
t('meta description is v39, not v32 NEO', html.includes('SQUEEKCHAIN v39') && !html.includes('v32 NEO'));
t('README documents 11 achievements', readme.includes('11 named achievements'));
t('README documents the v38 XP economy', readme.includes('54,000 total XP') && readme.includes('[0, 700, 2000, 4300, 8500, 16000, 29500, 54000]'));
t('README documents the 19:00 WIB Squeek-day reset', readme.includes('19:00 WIB'));

// 12h. dead-code cleanup
['.marquee', 'bulbChase', 'neonFlicker', 'spin3D', 'cab-side', 'btn-arcade', 'splash-coin'].forEach(s => t('dead v31 CSS gone from style.css: ' + s, !css.includes(s)));
t('introOsc/introGain only survive in one v38 comment', (js.match(/introOsc/g) || []).length === 1 && (js.match(/introGain/g) || []).length === 1);

// --- 13. v39 Batch 2: EIP-712 replay recorder, 3 smoke-test bug fixes, preview prefetch ---

// 13a. Panel hasil = lagu yang DIMAINKAN (bug smoke test v38 #1).
// Akar penyebab: panel membaca global `anthem` (bisa dibangun ulang preview
// sesudah lagu mulai) dan preview memakai seed wallet sementara play() memakai
// seed server — lagu yang dijanjikan != lagu yang dimainkan. Perbaikan: snapshot
// G.song di play(), panel + kartu baca snapshot; preview memakai seed sesi yang sama.
t('play() snapshots the played song into G.song', js.includes('G.song = { name: anthem.name, key: anthem.key, scaleName: anthem.scaleName, bpm: anthem.bpm, notes: anthem.chart.length };'));
t('resultKv anthem row reads G.song, not the global anthem', js.includes('<b>"${G.song.name}" • ${G.song.key}</b>'));
t('lastResult carries the song snapshot', js.includes('song: G.song ? { name: G.song.name, key: G.song.key, scaleName: G.song.scaleName, bpm: G.song.bpm, notes: G.song.notes } : null'));
t('previewFreeSeedKey derives the FREE seed from the preview session', js.includes("return (previewSessionValid(previewSession) && (previewSession.wallet || 'guest') === w) ? 'FREE-' + String(previewSession.seed) : null;"));
t('preview builds the anthem from the preview seed', js.includes('seedOverride = previewFreeSeedKey(w);') && js.includes('const a = makeAnthem(w, false, seedOverride, lanes, mirror)'));
t('play() reuses the preview session and marks it used (one session = one play)', js.includes('session38 = previewSession;') && js.includes('previewSession.used = true;'));
t('FREE seedKey comes from the session seed', js.includes("'FREE-' + String(session38.seed)"));

// 13a (lanjutan): jalankan fungsi prefetch asli — satu sesi = satu seedKey
// untuk preview DAN play, jadi lagu yang dijanjikan == lagu yang dimainkan.
const pvsSrc = fnSrc38('previewSessionValid');
const pfskSrc = fnSrc38('previewFreeSeedKey');
const mkPreviewFns = new Function('previewSession', oneLine38('const PREVIEW_SESSION_GRACE_MS =') + '\n' + pvsSrc + '\n' + pfskSrc + '\nreturn { previewSessionValid, previewFreeSeedKey };');
const W39 = '0x372D48abe5eDccCcDE9BD914a6dE30Dc53e3a1Db';
const sessOK = { sessionId: 's-1', seed: 123456789, nonce: 'n1', expiresAt: Date.now() + 30 * 60 * 1000, wallet: W39.toLowerCase(), mode: 'free', used: false };
const pf = mkPreviewFns(sessOK);
t('preview session valid (fresh, free, same wallet)', pf.previewSessionValid(sessOK) === true);
t('preview seedKey == play seedKey (same session seed)', pf.previewFreeSeedKey(W39) === 'FREE-123456789' && pf.previewFreeSeedKey(W39.toLowerCase()) === 'FREE-123456789');
t('used session is invalid (no second play on one session)', pf.previewSessionValid({ ...sessOK, used: true }) === false && mkPreviewFns({ ...sessOK, used: true }).previewFreeSeedKey(W39) === null);
t('expired session is invalid (grace 5s)', mkPreviewFns({ ...sessOK, expiresAt: Date.now() }).previewFreeSeedKey(W39) === null);
t('non-free session is invalid', mkPreviewFns({ ...sessOK, mode: 'daily' }).previewFreeSeedKey(W39) === null);
t('seed out of uint32 range is invalid', mkPreviewFns({ ...sessOK, seed: 4294967296 }).previewFreeSeedKey(W39) === null);
t('preview seedKey is null for another wallet', pf.previewFreeSeedKey('0x88538a82143065664232422e2dec4309038fcf9a') === null);

// 13b. Hitungan note (bug smoke test v38 #2): MISS 103 vs NOTES 98.
// Akar penyebab: chart yang dimainkan (seed server, 103 note) bukan chart
// preview (seed wallet, 98 note). Loop MISS sendiri menghitung tiap note
// tepat sekali (chartIdx monoton naik + flag judged); guard finish() adalah
// pengaman bila chart berubah di tengah lagu. Invarian: PERFECT+GREAT+GOOD+MISS = NOTES.
const guardStart = js.indexOf('const totalNotes = anthem ? anthem.chart.length : 0;');
const guardEnd = js.indexOf('\n  }', guardStart) + 4;
const guardSrc = js.slice(guardStart, guardEnd);
t('finish() has the MISS guard (MISS = NOTES - judged)', guardSrc.includes('G.counts.miss = Math.max(0, totalNotes - (G.counts.perfect + G.counts.great + G.counts.good))'));
const runGuard = new Function('anthem', 'G', guardSrc + '\nreturn G.counts;');
function guardCase(notes, counts) { return runGuard({ chart: { length: notes } }, { counts: { ...counts } }); }
const g1 = guardCase(98, { perfect: 0, great: 0, good: 0, miss: 103 });
t('guard: 103 MISS on a 98-note chart -> MISS 98, sum = NOTES', g1.miss === 98 && g1.perfect + g1.great + g1.good + g1.miss === 98);
const g2 = guardCase(98, { perfect: 50, great: 20, good: 10, miss: 30 });
t('guard: over-counted judgements -> MISS 18, sum = NOTES', g2.miss === 18 && g2.perfect + g2.great + g2.good + g2.miss === 98);
const g3 = guardCase(98, { perfect: 50, great: 20, good: 10, miss: 18 });
t('guard: exact counts untouched', g3.miss === 18 && g3.perfect + g3.great + g3.good + g3.miss === 98);
const g4 = guardCase(0, { perfect: 0, great: 0, good: 0, miss: 5 });
t('guard: no chart (0 notes) -> counts untouched', g4.miss === 5);
t('miss loop judges each note once (chartIdx monotonic + judged flag)', js.includes('while (G.chartIdx < anthem.chart.length)') && js.includes("if (n.judged) { G.chartIdx++; continue; }") && js.includes("n.judged = 'miss'"));

// 13c. Banner rekor (bug smoke test v38 #3): skor 0 + rekor 2300 menampilkan
// "SKOR BARU TERBAIK!" dan bisa menimpa rekor. Akar penyebab: kondisi "rekor
// baru" tersebar di tiga tempat (banner, kartu, simpan) dan bisa desinkron.
// Perbaikan v39: SATU kondisi isNewBest di finish() — skor HARUS > 0.
t('finish() has one explicit isNewBest condition (score must be > 0)', js.includes('const isNewBest = G.score > 0 && (!prev || G.score > prev.score);'));
const isNewBestSrc = js.slice(js.indexOf('const isNewBest = '), js.indexOf(';', js.indexOf('const isNewBest = ')));
const isNewBest = new Function('G', 'prev', isNewBestSrc.replace('const isNewBest = ', 'return ') + ';');
t('score 0 + stored best 2300 -> NOT a new best', isNewBest({ score: 0 }, { score: 2300, grade: 'A' }) === false);
t('score 0 on the first game -> NOT a new best (no 0 record saved)', isNewBest({ score: 0 }, null) === false);
t('score 2300 ties the stored best -> NOT a new best', isNewBest({ score: 2300 }, { score: 2300, grade: 'A' }) === false);
t('score 2301 beats the stored best -> new best', isNewBest({ score: 2301 }, { score: 2300, grade: 'A' }) === true);
t('first ever score > 0 -> new best', isNewBest({ score: 100 }, null) === true);
t('best is saved only when isNewBest', js.includes('if (!G.practice && isNewBest) saveBest(G.wallet, rec);'));
t('bestMsg banner uses the same isNewBest', js.includes("$('bestMsg').textContent = isNewBest ? msg('newHigh')"));
t('result card ribbon uses the same isNewBest', js.includes('lastResultIsNew = isNewBest;'));

// 13d. Replay v1: canonical JSON client == server (hash stabil), offset clamp, header.seed.
const worker = fs.readFileSync('worker.js', 'utf8');
const workerLines = worker.split('\n');
function fnSrcW(name) {
  const start = workerLines.findIndex(l => l.startsWith('function ' + name + '('));
  if (start < 0) throw new Error('function not found in worker: ' + name);
  let depth = 0, end = start;
  for (let i = start; i < workerLines.length; i++) { for (const ch of workerLines[i]) { if (ch === '{') depth++; if (ch === '}') depth--; } if (i > start && depth === 0) { end = i; break; } }
  return workerLines.slice(start, end + 1).join('\n');
}
['canonicalJSON', 'replayHashOf', 'recordReplayInput', 'recordReplayPoll', 'recordReplayGolden', 'replaySongT'].forEach(s => t('v39 replay recorder has ' + s, js.includes('function ' + s)));
t('finish() is async (replay hash awaited before the panel)', js.includes('async function finish()') && js.includes('lastResult.replayHash = await replayHashOf(replay);'));
t('submit sends replay + hash + gameVersion v39', js.includes('replay: lastResult.replay') && js.includes('replayHash: lastResult.replayHash') && js.includes("gameVersion: 'v39'"));
t('client hashes the canonical JSON with SHA-256', js.includes('const data = new TextEncoder().encode(canonicalJSON(rep));') && js.includes("await crypto.subtle.digest('SHA-256', data)"));
t('server hashes the canonical JSON with SHA-256', worker.includes('sha256(new TextEncoder().encode(canonical(replay)))'));
const canonicalJSON = new Function(fnSrc38('canonicalJSON') + '\nreturn canonicalJSON;')();
const canonical = new Function(fnSrcW('canonical') + '\nreturn canonical;')();
const repA = { v: 1, header: { wallet: '0xabc', mode: 'free', seedKey: 'FREE-123', seed: 123, genre: 'cyber', diff: 'normal', lanes: 3, mirror: false, practice: false, offsetMs: 0, wallStartMs: 1700000000000, duration: 60, initialZoomies: false, initialDistKm: 0 }, events: { inputs: [{ t: 0.5, lane: 1 }], polls: [], golden: [], finish: { t: 60, oppDistM: null } }, claim: { score: 100, acc: 90, maxCombo: 60, counts: { perfect: 60, great: 20, good: 10, miss: 10 } } };
const repB = JSON.parse('{"claim":{"counts":{"miss":10,"good":10,"great":20,"perfect":60},"maxCombo":60,"acc":90,"score":100},"events":{"finish":{"oppDistM":null,"t":60},"golden":[],"inputs":[{"lane":1,"t":0.5}],"polls":[]},"header":{"wallStartMs":1700000000000,"seedKey":"FREE-123","seed":123,"practice":false,"offsetMs":0,"mirror":false,"mode":"free","lanes":3,"initialZoomies":false,"initialDistKm":0,"genre":"cyber","duration":60,"diff":"normal","wallet":"0xabc"},"v":1}');
t('canonical JSON: client == server on the same replay', canonicalJSON(repA) === canonical(repA));
t('canonical JSON: stable under key insertion order', canonicalJSON(repA) === canonicalJSON(repB) && canonical(repA) === canonical(repB));
t('canonical JSON: keys sorted recursively', canonicalJSON({ b: 1, a: { d: 4, c: 3 } }) === '{"a":{"c":3,"d":4},"b":1}');
const { createHash } = require('crypto');
const sha = s => '0x' + createHash('sha256').update(s).digest('hex');
t('replay hash stable across key order', sha(canonicalJSON(repA)) === sha(canonicalJSON(repB)));
t('replay hash is 0x + 64 lowercase hex', /^0x[0-9a-f]{64}$/.test(sha(canonicalJSON(repA))));
t('replay hash differs when the claim differs', sha(canonicalJSON(repA)) !== sha(canonicalJSON({ ...repA, claim: { ...repA.claim, score: 101 } })));
// offset clamp ±150 ms, rounded to 5 ms
const offsetMsClamp = new Function(oneLine38('function offsetMsClamp') + '\nreturn offsetMsClamp;')();
[[200, 150], [-200, -150], [153, 150], [152, 150], [148, 150], [147, 145], [7, 5], [-7, -5], [3, 5], [2, 0], [0, 0], [150, 150], [-150, -150]].forEach(([v, want]) => t('offsetMsClamp(' + v + ') = ' + want, offsetMsClamp(v) === want));
t('replay header carries the clamped offset', js.includes('offsetMs: Math.max(-150, Math.min(150, offsetMs))'));
// header.seed == session seed
t('headerSeed is the session seed when a session exists', js.includes('const headerSeed = sessionSeed !== null ? sessionSeed : (cyrb53(seedKey) % 4294967296);'));
t('replay header.seed is headerSeed', js.includes('seed: headerSeed,'));
t('G carries sessionSeed for the finish() seed check', js.includes('sessionId: session38 ? session38.sessionId : null, sessionSeed'));
t('finish() throws away the replay on a seed mismatch', js.includes("if (G.sessionId && replay.header.seed !== G.sessionSeed) throw new Error('replay seed mismatch');"));

// 13e. Label versi v39 yang terlihat.
t('README title is v39', readme.startsWith('# Squeekchain v39'));
t('README documents the v39 Batch 2 upgrade', readme.includes('**v39**') && readme.includes('EIP-712'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
