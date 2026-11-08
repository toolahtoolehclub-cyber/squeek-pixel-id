// v40 tests — run: node TEST-v34-neo.js  (cwd = the v40 folder)
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
const js = fs.readFileSync('script.js', 'utf8');
const readme = fs.readFileSync('README.md', 'utf8');
const engineSrc = fs.readFileSync('engine.js', 'utf8');
const SqueekEngine = require('./engine.js');
let pass = 0, fail = 0;
function t(name, ok) { if (ok) { pass++; } else { fail++; console.log('FAIL:', name); } }

// --- 1. every v31 id still present exactly once (no feature lost) ---
const IDS = ['mainTitle', 'langBtn', 'qualityBtn', 'muteBtn', 'tabBar', 'tab-play', 'tab-daily', 'tab-live', 'tab-league', 'tab-shop', 'tab-me',
  'walletInput', 'walletWarn', 'connectBtn', 'anthemInfo', 'avatarPreviewWrap', 'avatar-preview', 'avatarLabel', 'levelLabel', 'anthemHash',
  'genreRow', 'diffRow', 'optionsRow', 'modeRow', 'lanesBtn', 'mirrorBtn', 'raceBox', 'petLine', 'raceInfo', 'raceLast', 'liveBox', 'liveInfo', 'liveLine',
  'dailyBox', 'dailyTitle', 'dailyInfo', 'streakLine', 'freezeLine', 'missionList', 'playBtn', 'genBtn', 'message', 'glStatus', 'card-canvas', 'dlBtn', 'shareBtn',
  'tutorialBox', 'tutorialSteps', 'tutorialCloseBtn', 'bossBox', 'bossLine', 'bossHist', 'bossBtn', 'champBox', 'champList', 'masteryBox', 'historyBars', 'masteryStats',
  'awayBox', 'awayLine', 'diaryList', 'diaryNote', 'diaryNoteBtn', 'predictBox', 'roundLine', 'predNapBtn', 'predJogBtn', 'predZoomiesBtn', 'predStatus', 'predResult',
  'roundHistBox', 'roundHistList', 'leagueBox', 'leagueList', 'achBox', 'achList', 'calibBox', 'offsetLine', 'offsetMinusBtn', 'offsetPlusBtn', 'calibBtn', 'calibMsg', 'calibTapBtn', 'calibProg', 'unlockBox',
  'gamePanel', 'scoreVal', 'comboVal', 'accVal', 'bpmVal', 'game-canvas', 'precisionBox', 'lastHit', 'avgHit', 'hitDir', 'feverTag', 'raceHud', 'raceYouBar', 'raceOppBar', 'raceYouTxt', 'raceOppTxt', 'cardErrMsg',
  'gameAudioStatus', 'liveHud', 'vizBars', 'pauseBtn', 'stopBtn', 'resultPanel', 'gradeVal', 'resultKv', 'bestMsg', 'xpMsg', 'missionResult', 'againBtn', 'toCardBtn', 'resultCardBtn',
  'duelBtn', 'shareXBtn', 'rivalBackMsg', 'duelMsg', 'duelOut', 'homeBtn', 'overlayBox', 'overlayTitle', 'overlayRpm', 'overlayDist', 'overlayRound', 'overlayZoom', 'overlayPet', 'overlaySong',
  'musicSplash', 'startMusicBtn', 'startMusicSantaiBtn', 'bg-gl', 'bg-anim', 'crt', 'volSlider', 'volVal', 'musicModeBtn', 'practiceBtn', 'obsBtn', 'howBtn',
  'shopBox', 'cheeseBalance', 'shopCatalog', 'capsuleBtn', 'shopMsg', 'sqkShopBox', 'sqkShopSoon', 'sqkShopPool', 'sqkShopSeason', 'sqkShopBalance', 'sqkShopCatalog', 'sqkCapsulePity', 'sqkCommitBtn', 'sqkResolveBtn', 'sqkShopMsg', 'leagueWeeklyBox', 'leagueWeekLabel', 'leagueWeeklyRefreshBtn', 'leagueWeeklyList', 'leagueWeeklyRank'];
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
t('html says v42.2', (html.match(/v42\.2/g) || []).length >= 2);
t('browser tab title is v42.2', html.includes('<title>SQUEEKCHAIN // v42.2</title>'));
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
t('precision readout reset sits next to the hitOffsets reset', (() => { const a = js.indexOf("anthem = makeAnthem(w, false, seedKey, lanes, mirror, practiceMode); lastAnthem = anthem; hitOffsets = [];"); const b = js.indexOf("lh0.textContent = '-- ms'"); return a > 0 && b > a && b - a < 400; })());
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
['cardErrMsg', "state: 'paused'", "state: 'running'", "document.body.classList.add('cardbar')", "document.body.classList.remove('cardbar')", 'lastResultIsNew', '★ NEW BEST! ★', 'Math.pow(1 - p, 3)', '"${a.name}"'].forEach(s => t('js has ' + s, js.includes(s)));
// v40: SONG_MOODS + motif hidup di engine.js (buildChart), bukan lagi di script.js.
['SONG_MOODS', 'const motif', 'motif[bar % 2][s]'].forEach(s => t('engine has ' + s, engineSrc.includes(s)));
t('generateCard shows the error on the result panel', js.includes("if (em && !$('resultPanel').classList.contains('hidden'))"));
t('buildChart returns a song name (v40: in engine.js)', engineSrc.includes("name: (SONG_MOODS[scaleName]")); // v40: makeAnthem() di script.js kini mendelegasikan ke SqueekEngine.buildChart()
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
t('setTab defined with TABS list', setTabSrc.includes("['play', 'daily', 'live', 'league', 'shop', 'me']") || js.includes("const TABS = ['play', 'daily', 'live', 'league', 'shop', 'me']"));
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
['lbLoading', 'lbOffline', 'lbEmpty', 'lbSent', 'lbKept', 'lbNeedWallet', 'lbNoScore', 'lbPractice', 'lbYourRank', 'lbVerifying', 'lbVerified', 'lbVerifyRejected', 'lbVerifyUnknown'].forEach(k => t('MSG has lb key: ' + k, js.includes(k + ':')));
['lbTitle', 'lbNote', 'lbRefresh', 'lbSubmit'].forEach(k => t('I18N has lb key: ' + k, js.includes(k + ':')));
t('setTab fetches the board on LEAGUE', js.includes("if (name === 'league') { fetchLb(lbState.mode); fetchLeagueWeekly(); }"));
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
t('eth_requestAccounts only inside connect handlers (injected + WC, never on load)', (js.match(/method: 'eth_requestAccounts'/g) || []).length === 2);

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
t('meta description is v42.2, not v32 NEO', html.includes('SQUEEKCHAIN v42.2') && !html.includes('v32 NEO'));
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
t('submit sends replay + hash + gameVersion v42.2', js.includes('replay: lastResult.replay') && js.includes('replayHash: lastResult.replayHash') && js.includes("gameVersion: 'v42.2'"));
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
t('README title is v42.2', readme.startsWith('# Squeekchain v42.2'));
t('README documents the v40 engine extraction', readme.includes('**v40**') && readme.includes('engine.js'));
t('README still documents the v39 Batch 2 upgrade (history)', readme.includes('**v39**') && readme.includes('EIP-712'));

// --- 14. v40: engine.js extraction + determinism ---
// 14a. Wiring: engine.js dimuat SEBELUM script.js; script.js mendelegasikan.
t('engine.js is loaded before script.js', html.indexOf('<script src="engine.js"') > 0 && html.indexOf('<script src="engine.js"') < html.indexOf('<script src="script.js"'));
t('script.js aliases cyrb53/rng to the engine (single source of truth)', js.includes('const cyrb53 = SqueekEngine.cyrb53;') && js.includes('const rng = SqueekEngine.mulberry32;'));
t('script.js has no second cyrb53/rng implementation', !js.includes('function cyrb53(') && !js.includes('function rng('));
t('makeAnthem delegates to SqueekEngine.buildChart', js.includes('return SqueekEngine.buildChart(header);'));
t('play() passes practiceMode into makeAnthem', js.includes('makeAnthem(w, false, seedKey, lanes, mirror, practiceMode)'));
t('play() no longer scales the anthem by hand', !js.includes('anthem.bpm = Math.round(anthem.bpm * 0.6)'));
t('race ZOOMIES flips at poll time in refreshLive (v40 determinism fix)', js.includes("if (G && !G.ended && G.mode === 'race') computeZoomies();"));
t('liveZoomies is still reset at the start of play() (v39 fix kept)', js.includes('liveZoomies = false; replay = null;'));
t('engine exports the four required functions', ['cyrb53', 'mulberry32', 'buildChart', 'simulate'].every(k => typeof SqueekEngine[k] === 'function'));
function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1'); }
const engineCode = stripComments(engineSrc);
t('engine is pure (no DOM, network, Date, Math.random, storage, timers)', !/document\.|window\.|fetch\(|XMLHttpRequest|new Date|Date\.now|Date\.parse|Math\.random|localStorage|sessionStorage|setTimeout|setInterval|requestAnimationFrame/.test(engineCode));
t('engine has no bare global cyrb53/rng (UMD namespace only)', !/^function cyrb53/m.test(engineCode) && !/^function rng/m.test(engineCode));

// 14b. cyrb53 / mulberry32 — known vectors (diukur dari implementasi v39
// sebelum refactor; nilai ini mengunci hash + RNG agar tidak bergeser).
t('cyrb53("") = 3338908027751811', SqueekEngine.cyrb53('') === 3338908027751811);
t('cyrb53("a") = 7929297801672961', SqueekEngine.cyrb53('a') === 7929297801672961);
t('cyrb53("FREE-123456789") = 5616028065809105', SqueekEngine.cyrb53('FREE-123456789') === 5616028065809105);
t('cyrb53("DAILY-2026-11-08") = 3139317285301407', SqueekEngine.cyrb53('DAILY-2026-11-08') === 3139317285301407);
t('cyrb53 seed param changes the hash', SqueekEngine.cyrb53('x', 7) === 7806563198393042 && SqueekEngine.cyrb53('x', 7) !== SqueekEngine.cyrb53('x'));
t('mulberry32(0) first outputs', (() => { const r = SqueekEngine.mulberry32(0); return r() === 0.26642920868471265 && r() === 0.0003297457005828619 && r() === 0.2232720274478197; })());
t('mulberry32(12345) first output', SqueekEngine.mulberry32(12345)() === 0.9797282677609473);
t('mulberry32 is deterministic per seed', SqueekEngine.mulberry32(99)() === SqueekEngine.mulberry32(99)());
t('mulberry32 differs per seed', SqueekEngine.mulberry32(1)() !== SqueekEngine.mulberry32(2)());

// 14c. Golden charts: buildChart == makeAnthem v39 ASLI, byte-per-byte.
// Fixture diambil dari script.js v39 SEBELUM refactor (14 header: semua
// genre/diff, LIVE/RACE/DAILY/BOSS/DUEL, wallet, 4-lane, mirror, practice).
const golden = JSON.parse(fs.readFileSync('TEST-v40-golden-charts.json', 'utf8'));
t('golden fixture has 14 cases', golden.length === 14);
golden.forEach((c, i) => t('golden chart ' + i + ' (' + c.header.seedKey + ' ' + c.header.genre + '/' + c.header.diff + (c.header.practice ? ' practice' : '') + ') matches buildChart', JSON.stringify(SqueekEngine.buildChart(c.header)) === JSON.stringify(c.anthem)));

// 14d. Tabel data engine == tabel script.js (GENRES/DIFFICULTIES dipakai
// juga di luar makeAnthem, jadi tetap ada di script.js — keduanya harus sama).
function tableLine(src, marker) { const l = src.split('\n').find(x => x.trimStart().startsWith(marker)); return l.split('//')[0].trim(); }
t('engine GENRES == script.js GENRES', tableLine(engineSrc, 'const GENRES =') === tableLine(js, 'const GENRES ='));
t('engine DIFFICULTIES == script.js DIFFICULTIES', tableLine(engineSrc, 'const DIFFICULTIES =') === tableLine(js, 'const DIFFICULTIES ='));

// 14e. buildChart determinism + wrapper makeAnthem (script.js) == buildChart.
const W40 = '0x372D48abe5eDccCcDE9BD914a6dE30Dc53e3a1Db';
const mkSrc40 = fnSrc38('makeAnthem');
const makeAnthem40 = new Function('SqueekEngine', 'currentGenre', 'currentDiff', 'cyrb53', mkSrc40 + '\nreturn makeAnthem;')(SqueekEngine, 'cyber', 'normal', SqueekEngine.cyrb53);
const hdrCN = { seedKey: 'FREE-123456789', genre: 'cyber', diff: 'normal', lanes: 3, mirror: false };
t('buildChart is deterministic (same header -> identical chart)', JSON.stringify(SqueekEngine.buildChart(hdrCN)) === JSON.stringify(SqueekEngine.buildChart(hdrCN)));
t('buildChart differs per seedKey', JSON.stringify(SqueekEngine.buildChart(hdrCN)) !== JSON.stringify(SqueekEngine.buildChart({ ...hdrCN, seedKey: 'FREE-123456790' })));
t('buildChart LIVE bpm comes from the seedKey', SqueekEngine.buildChart({ seedKey: 'LIVE-2026-11-08-128', genre: 'cyber', diff: 'normal', lanes: 3, mirror: false }).bpm === 128);
t('buildChart RACE bpm comes from rng (LIVE regex does not match RACE)', SqueekEngine.buildChart({ seedKey: 'RACE-2026-11-08-145', genre: 'cyber', diff: 'normal', lanes: 3, mirror: false }).bpm !== 145);
t('buildChart practice scales duration by 1/0.6', SqueekEngine.buildChart({ ...hdrCN, practice: true }).duration === SqueekEngine.buildChart(hdrCN).duration * (1 / 0.6));
t('buildChart practice rounds bpm to 60%', SqueekEngine.buildChart({ ...hdrCN, practice: true }).bpm === Math.round(SqueekEngine.buildChart(hdrCN).bpm * 0.6));
t('buildChart mirror flips every lane', (() => { const a = SqueekEngine.buildChart(hdrCN), b = SqueekEngine.buildChart({ ...hdrCN, mirror: true }); return a.chart.every((n, i) => b.chart[i].lane === 2 - n.lane && b.chart[i].t === n.t); })());
t('buildChart rejects an unknown genre/diff', (() => { try { SqueekEngine.buildChart({ seedKey: 'X', genre: 'nope', diff: 'normal', lanes: 3 }); return false; } catch (_) { try { SqueekEngine.buildChart({ seedKey: 'X', genre: 'cyber', diff: 'nope', lanes: 3 }); return false; } catch (_) { return true; } } })());
t('wrapper makeAnthem == buildChart (free/normal)', JSON.stringify(makeAnthem40(W40, false, 'FREE-123456789', 3, false)) === JSON.stringify(SqueekEngine.buildChart(hdrCN)));
t('wrapper makeAnthem == buildChart (practice)', JSON.stringify(makeAnthem40(W40, false, 'FREE-123456789', 3, false, true)) === JSON.stringify(SqueekEngine.buildChart({ ...hdrCN, practice: true })));
t('wrapper makeAnthem == buildChart (wallet seed, mirror 4-lane)', JSON.stringify(makeAnthem40(W40, false, null, 4, true)) === JSON.stringify(SqueekEngine.buildChart({ seedKey: W40.toLowerCase(), genre: 'cyber', diff: 'normal', lanes: 4, mirror: true })));
t('wrapper makeAnthem == buildChart (LIVE seedKey)', JSON.stringify(makeAnthem40(W40, false, 'LIVE-2026-11-08-128', 3, false)) === JSON.stringify(SqueekEngine.buildChart({ seedKey: 'LIVE-2026-11-08-128', genre: 'cyber', diff: 'normal', lanes: 3, mirror: false })));

// 14f. simulate() vs judge() CLIENT ASLI — driver menjalankan judge()
// yang diekstrak verbatim dari script.js (dengan stub DOM/audio), lalu
// hasilnya dibandingkan EXACT dengan SqueekEngine.simulate() untuk replay
// yang sama. Driver BUKAN engine: ia memakai kode client, bukan salinan.
// (Lihat AUDIT-v40 §3.3 untuk corner-case yang sengaja dihindari: tap yang
// jatuh dalam 1 frame sesudah note kedaluwarsa + tie input/golden di ms
// yang sama — keduanya ambigu di client sendiri.)
const judgeSrc40 = fnSrc38('judge');
function runClientGame(chartNotes, replay) {
  const W = { perfect: 0.045, great: 0.09, good: 0.135 };
  const CONFIG = { W };
  const anthem = { chart: chartNotes.map(n => ({ t: n.t, lane: n.lane, midi: n.midi === undefined ? 60 : n.midi, judged: null })) };
  const offsetMs = replay.header.offsetMs || 0;
  const isRace = replay.header.mode === 'race';
  // Client: di luar live/race, liveZoomies tidak pernah menyala (reset di
  // awal play(), snapZoom + updateLiveHud/computeZoomies hanya jalan di
  // live/race) — driver memodelkan itu, sama seperti simulate().
  const zoomiesApplies = replay.header.mode === 'live' || replay.header.mode === 'race';
  let liveZoomies = zoomiesApplies && !!replay.header.initialZoomies;
  let glShockwave = 0;
  let LW = 360 / (replay.header.lanes || 3); // lebar jalur (script.js: LW = GW / lanes)
  const ac = { currentTime: 0 };
  const G = {
    start: 0, taps: 0, score: 0, combo: 0, maxCombo: 0,
    counts: { perfect: 0, great: 0, good: 0, miss: 0 },
    fever: false, ended: false, paused: false, lanes: replay.header.lanes,
    flash: [0, 0, 0, 0], fx: [], glitchT: 0,
    race: isRace ? { playerDist: 0, goldenNote: null } : null,
  };
  const songTime = () => ac.currentTime - G.start;
  const noop = () => {};
  const recordReplayInput = noop, updatePrecision = noop, tone = noop, addFloatText = noop, hud = noop, juiceHit = noop;
  const navigator = { vibrate: noop };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  eval(judgeSrc40); // judge() asli client, menutup atas G/anthem/liveZoomies di atas
  const timeline = [];
  (replay.events.inputs || []).forEach((e, i) => timeline.push({ kind: 'input', t: e.t, lane: e.lane, i }));
  (replay.events.golden || []).forEach((e, i) => timeline.push({ kind: 'golden', t: e.t, index: e.index, i }));
  timeline.sort((a, b) => (a.t - b.t) || (a.kind === b.kind ? a.i - b.i : (a.kind === 'input' ? -1 : 1)));
  const polls = (replay.events.polls || []).slice().sort((a, b) => a.t - b.t);
  let pollIdx = 0;
  function syncZoomies(uptoT) { if (!zoomiesApplies) return; while (pollIdx < polls.length && polls[pollIdx].t <= uptoT) { const p = polls[pollIdx++]; liveZoomies = !!(p.ok && p.rpm >= 70); } }
  let missIdx = 0;
  function expireNotes(uptoT) {
    while (missIdx < anthem.chart.length) {
      const n = anthem.chart[missIdx];
      if (n.judged) { missIdx++; continue; }
      if (uptoT - n.t > W.good) {
        n.judged = 'miss'; G.counts.miss++; G.combo = 0; G.fever = false;
        if (G.race && G.race.goldenNote === n) G.race.goldenNote = null;
        missIdx++; continue;
      }
      break;
    }
  }
  for (const ev of timeline) {
    syncZoomies(ev.t);
    expireNotes(ev.t);
    ac.currentTime = ev.t;
    if (ev.kind === 'input') judge(ev.lane);
    else { const note = anthem.chart[ev.index]; if (G.race && note && !note.judged) G.race.goldenNote = note; }
  }
  expireNotes(Infinity);
  const tot = G.counts.perfect + G.counts.great + G.counts.good + G.counts.miss;
  const acc = tot ? (G.counts.perfect * 300 + G.counts.great * 200 + G.counts.good * 100) / (tot * 300) * 100 : 100;
  return { score: G.score, acc, maxCombo: G.maxCombo, counts: { ...G.counts }, playerDistM: G.race ? G.race.playerDist : 0 };
}
function handChart(n, stepS) { const out = []; for (let i = 0; i < n; i++) out.push({ t: +(1 + i * stepS).toFixed(3), lane: i % 3, midi: 60 + i }); return out; }
function handReplay(header, inputs, polls, goldens, finish) {
  return { v: 1, header, events: { inputs, polls: polls || [], golden: goldens || [], finish: finish || { t: 60, oppDistM: null } }, claim: null };
}
function tapsPerfect(chart, off) { return chart.map(n => ({ t: +(n.t + off).toFixed(3), lane: n.lane })); }
function expectSimEqualsClient(name, chart, replay) {
  const client = runClientGame(chart, replay);
  replay.claim = { score: client.score, acc: +client.acc.toFixed(2), maxCombo: client.maxCombo, counts: { ...client.counts } };
  const sim = SqueekEngine.simulate(chart, replay);
  const same = sim.score === client.score && sim.acc === client.acc && sim.maxCombo === client.maxCombo &&
    sim.counts.perfect === client.counts.perfect && sim.counts.great === client.counts.great &&
    sim.counts.good === client.counts.good && sim.counts.miss === client.counts.miss &&
    sim.playerDistM === client.playerDistM;
  t(name + ' — simulate == client judge EXACT (score ' + client.score + ')', same);
  if (!same) console.log('  client:', JSON.stringify(client), '\n  sim:', JSON.stringify({ score: sim.score, acc: sim.acc, maxCombo: sim.maxCombo, counts: sim.counts, playerDistM: sim.playerDistM }));
  t(name + ' — simulate == replay.claim', sim.score === replay.claim.score && sim.maxCombo === replay.claim.maxCombo && +sim.acc.toFixed(2) === replay.claim.acc && JSON.stringify(sim.counts) === JSON.stringify(replay.claim.counts));
  return sim;
}
// Kasus tangan (angka dihitung manual, bukan dari engine):
const HC12 = handChart(12, 1); // 12 note, t=1..12, lane 0,1,2 berputar
const H_FREE = { wallet: '0xabc', mode: 'free', seedKey: 'HAND-12', seed: 1, genre: 'cyber', diff: 'easy', lanes: 3, mirror: false, practice: false, offsetMs: 0, wallStartMs: 1700000000000, duration: 60, initialZoomies: false, initialDistKm: 0 };
const sHand1 = expectSimEqualsClient('hand: 12x PERFECT', HC12, handReplay(H_FREE, tapsPerfect(HC12, 0)));
t('hand: 12x PERFECT score 3690 (dihitung manual)', sHand1.score === 3690 && sHand1.acc === 100 && sHand1.maxCombo === 12 && sHand1.grade === 'SS');
const HC35 = handChart(35, 1);
const sHand2 = expectSimEqualsClient('hand: 35x PERFECT (fever)', HC35, handReplay(H_FREE, tapsPerfect(HC35, 0)));
t('hand: 35x PERFECT score 13110 incl. FEVER x1.5 (dihitung manual)', sHand2.score === 13110 && sHand2.maxCombo === 35);
const mixedTaps = HC12.map((n, i) => {
  const d = [0, 0.06, 0.11, 0, 0.06, 0.11, 0, 0, 0, 0, 0, 0][i];
  return { t: +(n.t + d).toFixed(3), lane: n.lane };
});
const sHand3 = expectSimEqualsClient('hand: mixed P/G/Go', HC12, handReplay(H_FREE, mixedTaps));
t('hand: mixed P/G/Go score 3090, acc 83.33 (dihitung manual)', sHand3.score === 3090 && sHand3.counts.perfect === 8 && sHand3.counts.great === 2 && sHand3.counts.good === 2 && Math.abs(sHand3.acc - 83.33333333333333) < 1e-9);
// Offset +50 ms: tap di note.t + 0,05 -> st = note.t -> PERFECT.
const sHand4 = expectSimEqualsClient('hand: offset +50ms, tap di note.t+0.05', HC12, handReplay({ ...H_FREE, offsetMs: 50 }, tapsPerfect(HC12, 0.05)));
t('hand: offset +50ms tetap PERFECT semua', sHand4.score === 3690 && sHand4.counts.perfect === 12);
// Offset +50 ms tapi tap TEPAT di note.t -> st = note.t - 0,05 -> GREAT semua.
const sHand5 = expectSimEqualsClient('hand: offset +50ms, tap di note.t', HC12, handReplay({ ...H_FREE, offsetMs: 50 }, tapsPerfect(HC12, 0)));
t('hand: offset +50ms tap di note.t = GREAT semua, skor 2460', sHand5.score === 2460 && sHand5.counts.great === 12 && Math.abs(sHand5.acc - 66.66666666666667) < 1e-9);
// Tap kosong + tap telat + miss: note 6 tidak kena, kombo putus.
const gapTaps = tapsPerfect(HC12, 0).filter((_, i) => i !== 5);
gapTaps.splice(5, 0, { t: 5.5, lane: 0 }); // tap kosong (note lane 0 terdekat di t=4 dan t=7)
gapTaps.splice(6, 0, { t: 6.2, lane: 2 }); // tap telat di note 6 (dt 0,2 > 0,135)
const sHand6 = expectSimEqualsClient('hand: tap kosong + tap telat + miss', HC12, handReplay(H_FREE, gapTaps));
t('hand: tap kosong/telat tidak menambah skor, miss 1, maxCombo 6', sHand6.score === 3300 && sHand6.counts.miss === 1 && sHand6.maxCombo === 6 && Math.abs(sHand6.acc - 91.66666666666667) < 1e-9);
// ZOOMIES dari log poll saja: poll gagal tidak menyalakan, rpm 80 nyala 5,5-8,5.
const zoomPolls = [{ t: 0, rpm: 0, dist: 0, ok: true }, { t: 3, rpm: 90, dist: 0, ok: false }, { t: 5.5, rpm: 80, dist: 0, ok: true }, { t: 8.5, rpm: 0, dist: 0, ok: true }];
const sHand7 = expectSimEqualsClient('hand: ZOOMIES x2 dari polls (5.5-8.5)', HC12, handReplay({ ...H_FREE, mode: 'live' }, tapsPerfect(HC12, 0), zoomPolls));
t('hand: ZOOMIES skor 4590 (dihitung manual)', sHand7.score === 4590);
// ZOOMIES dari initialZoomies bila belum ada poll.
const sHand8 = expectSimEqualsClient('hand: initialZoomies=true (tanpa poll)', HC12, handReplay({ ...H_FREE, mode: 'live', initialZoomies: true }, tapsPerfect(HC12, 0), []));
t('hand: initialZoomies x2 semua tap (3690x2=7380)', sHand8.score === 7380);
// ZOOMIES TIDAK berlaku di luar live/race: replay free yang mengklaim
// initialZoomies=true + poll rpm 80 harus tetap dihitung tanpa x2 (client
// tidak pernah menyalakan zoomies di mode free — tidak ada poll, snapZoom
// hanya untuk live/race). Driver di atas memakai judge() asli, jadi ini
// juga mengunci perilaku client, bukan hanya engine.
const sHand8b = expectSimEqualsClient('hand: zoomies diabaikan di mode free', HC12, handReplay({ ...H_FREE, mode: 'free', initialZoomies: true }, tapsPerfect(HC12, 0), [{ t: 5, rpm: 80, dist: 0, ok: true }]));
t('hand: free + initialZoomies + poll 80rpm tetap skor normal 3690', sHand8b.score === 3690);
// GOLDEN race: event t=5,5, index 5 (note t=6) — kena PERFECT -> +1000, +5 m.
const H_RACE = { ...H_FREE, mode: 'race', initialDistKm: 12.5 };
const racePolls = [{ t: 0, rpm: 0, dist: 12.5, ok: true }, { t: 5, rpm: 0, dist: 12.505, ok: true }, { t: 10, rpm: 0, dist: 12.51, ok: true }];
const sHand9 = expectSimEqualsClient('hand: GOLDEN kena (+1000, +5m)', HC12, handReplay(H_RACE, tapsPerfect(HC12, 0), racePolls, [{ t: 5.5, index: 5 }], { t: 60, oppDistM: 10 }));
t('hand: GOLDEN skor 4690, playerDist 17 m, menang vs 10 m', sHand9.score === 4690 && sHand9.playerDistM === 17 && sHand9.win === true && sHand9.goldenHits === 1);
t('hand: GOLDEN pick valid (expected index 5)', sHand9.goldenChecks.length === 1 && sHand9.goldenChecks[0].ok === true && sHand9.goldenChecks[0].expected === 5);
t('hand: oppDistM dari poll = 10 m, cocok dengan finish', sHand9.oppDistMDerived === 10 && sHand9.oppDistMMatch === true);
// GOLDEN dilewatkan (tidak ada tap di note 6): tanpa bonus, note jadi miss.
const goldMissTaps = tapsPerfect(HC12, 0).filter((_, i) => i !== 5);
const sHand10 = expectSimEqualsClient('hand: GOLDEN dilewatkan (miss)', HC12, handReplay(H_RACE, goldMissTaps, racePolls, [{ t: 5.5, index: 5 }], { t: 60, oppDistM: 10 }));
t('hand: GOLDEN dilewatkan skor 3300, playerDist 11 m, tanpa bonus', sHand10.score === 3300 && sHand10.playerDistM === 11 && sHand10.goldenHits === 0 && sHand10.counts.miss === 1);
// GOLDEN kena GREAT (dt 0,06): bonus tetap jatuh.
const goldGreatTaps = tapsPerfect(HC12, 0).map((tp, i) => i === 5 ? { t: 6.06, lane: tp.lane } : tp);
const sHand11 = expectSimEqualsClient('hand: GOLDEN kena GREAT', HC12, handReplay(H_RACE, goldGreatTaps, racePolls, [{ t: 5.5, index: 5 }], { t: 60, oppDistM: 10 }));
t('hand: GOLDEN GREAT skor 4590 (3590+1000), playerDist 16.7 m', sHand11.score === 4590 && Math.abs(sHand11.playerDistM - 16.7) < 1e-9 && sHand11.goldenHits === 1);
// GOLDEN pick yang SALAH (index 6 padahal yang pertama belum di-judge
// adalah 5): skor tetap direproduksi, tapi check melaporkannya.
const sHand12 = SqueekEngine.simulate(HC12, handReplay(H_RACE, tapsPerfect(HC12, 0), racePolls, [{ t: 5.5, index: 6 }], { t: 60, oppDistM: 10 }));
t('hand: GOLDEN pick salah tetap direproduksi skornya, tapi check gagal', sHand12.score === 4690 && sHand12.goldenChecks[0].ok === false && sHand12.goldenChecks[0].expected === 5);
// simulate tidak memutasi chart pemanggil + idempotent.
const hcCopy = JSON.parse(JSON.stringify(HC12));
SqueekEngine.simulate(HC12, handReplay(H_FREE, tapsPerfect(HC12, 0)));
t('simulate tidak memutasi chart pemanggil', JSON.stringify(HC12) === JSON.stringify(hcCopy));
t('simulate idempotent (dua kali = hasil sama)', JSON.stringify(SqueekEngine.simulate(HC12, handReplay(H_FREE, tapsPerfect(HC12, 0)))) === JSON.stringify(SqueekEngine.simulate(HC12, handReplay(H_FREE, tapsPerfect(HC12, 0)))));
// 14g. Lagu ASLI (buildChart) + tap script acak deterministik (LCG) —
// driver client vs simulate harus EXACT di semua mode.
function lcg(seed) { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
function makeTapScript(chart, offsetMs, rand) {
  const off = offsetMs / 1000, taps = [];
  for (const n of chart) {
    const u = rand();
    // Tap dicatat max(0, ...) — persis replaySongT() client: tap di LEAD_IN
    // (song-time negatif) terekam sebagai t=0.
    // Offset +20 ms dipilih untuk live test supaya tap GOOD (dt 0,11) tidak
    // jatuh di zona ambigu sub-frame (T - n.t dalam (0,135, 0,151] — lihat
    // AUDIT-v40 §3.4); semua offset lain di bawah juga aman dari zona itu.
    if (u < 0.55) taps.push({ t: Math.max(0, +(n.t + off).toFixed(3)), lane: n.lane });
    else if (u < 0.72) taps.push({ t: Math.max(0, +(n.t + 0.06 + off).toFixed(3)), lane: n.lane });
    else if (u < 0.82) taps.push({ t: Math.max(0, +(n.t + 0.11 + off).toFixed(3)), lane: n.lane });
    else if (u < 0.90) { /* miss: tanpa tap */ }
    else taps.push({ t: Math.max(0, +(n.t + 0.2 + off).toFixed(3)), lane: n.lane }); // tap telat
  }
  return taps;
}
const realAnthem = SqueekEngine.buildChart({ seedKey: 'FREE-123456789', genre: 'cyber', diff: 'normal', lanes: 3, mirror: false });
const realChart = realAnthem.chart;
const livePolls = [{ t: 5, rpm: 0, dist: 0, ok: true }, { t: 15, rpm: 80, dist: 0, ok: true }, { t: 25, rpm: 0, dist: 0, ok: true }, { t: 35, rpm: 90, dist: 0, ok: false }, { t: 45, rpm: 75, dist: 0, ok: true }];
expectSimEqualsClient('real: FREE cyber/normal, offset +20ms, polls zoomies', realChart,
  handReplay({ ...H_FREE, mode: 'live', seedKey: 'FREE-123456789', genre: 'cyber', diff: 'normal', offsetMs: 20, duration: +realAnthem.duration.toFixed(3) }, makeTapScript(realChart, 20, lcg(7)), livePolls));
const raceAnthem = SqueekEngine.buildChart({ seedKey: 'RACE-2026-11-08-145', genre: 'cyber', diff: 'normal', lanes: 3, mirror: false });
const raceChart = raceAnthem.chart;
const goldIdx = raceChart.findIndex(n => n.t > 0.5); // event di t=0,5, sebelum tap pertama
const racePolls2 = [{ t: 5, rpm: 0, dist: 12.5, ok: true }, { t: 10, rpm: 80, dist: 12.52, ok: true }, { t: 20, rpm: 0, dist: 12.55, ok: true }, { t: 30, rpm: 85, dist: 12.58, ok: true }, { t: 40, rpm: 0, dist: 12.6, ok: true }];
const raceOpp = +((12.6 - 12.5) * 1000).toFixed(1);
expectSimEqualsClient('real: RACE + golden + zoomies + offset -30ms', raceChart,
  handReplay({ ...H_FREE, mode: 'race', seedKey: 'RACE-2026-11-08-145', genre: 'cyber', diff: 'normal', offsetMs: -30, initialZoomies: true, initialDistKm: 12.5, duration: +raceAnthem.duration.toFixed(3) }, makeTapScript(raceChart, -30, lcg(21)), racePolls2, [{ t: 0.5, index: goldIdx }], { t: 60, oppDistM: raceOpp }));
const pracAnthem = SqueekEngine.buildChart({ seedKey: 'FREE-999', genre: 'cyber', diff: 'normal', lanes: 3, mirror: false, practice: true });
expectSimEqualsClient('real: PRACTICE (tempo 60%)', pracAnthem.chart,
  handReplay({ ...H_FREE, mode: 'free', seedKey: 'FREE-999', genre: 'cyber', diff: 'normal', practice: true, offsetMs: 0, duration: +pracAnthem.duration.toFixed(3) }, makeTapScript(pracAnthem.chart, 0, lcg(99)), []));
const mirAnthem = SqueekEngine.buildChart({ seedKey: 'FREE-123456789', genre: 'synth', diff: 'hard', lanes: 4, mirror: true });
expectSimEqualsClient('real: 4-lane MIRROR hard', mirAnthem.chart,
  handReplay({ ...H_FREE, mode: 'free', seedKey: 'FREE-123456789', genre: 'synth', diff: 'hard', lanes: 4, mirror: true, offsetMs: -80, duration: +mirAnthem.duration.toFixed(3) }, makeTapScript(mirAnthem.chart, -80, lcg(5)), []));
// Fuzz: 5 seed berbeda, driver vs simulate harus EXACT semua.
for (let f = 0; f < 5; f++) {
  const fa = SqueekEngine.buildChart({ seedKey: 'FUZZ-' + f, genre: ['cyber', 'synth', 'chip', 'void'][f % 4], diff: ['easy', 'normal', 'hard'][f % 3], lanes: 3, mirror: f % 2 === 0 });
  const off = [-100, -40, 0, 60, 120][f];
  expectSimEqualsClient('fuzz seed ' + f + ' (offset ' + off + 'ms)', fa.chart,
    handReplay({ ...H_FREE, mode: 'free', seedKey: 'FUZZ-' + f, offsetMs: off, duration: +fa.duration.toFixed(3) }, makeTapScript(fa.chart, off, lcg(1000 + f)), []));
}
// 14h. Determinisme race (b): oppDistM terekam == nilai keputusan di
// finish() — satu variabel oppDist (baris 1100-1101 dipakai ulang di 1148) —
// dan playerDist hanya ditulis di judge() (hit + golden).
t('finish() memakai SATU oppDist untuk menang/kalah DAN replay.finish', js.includes('if (G.race) { oppDist = raceOppDist(); raceWin = G.race.playerDist > oppDist; }') && js.includes('oppDistM: G.race ? +oppDist.toFixed(1) : null'));
t('playerDist hanya bertambah di judge() (hit + golden)', (js.match(/playerDist \+=/g) || []).length === 2 && js.includes("G.race.playerDist += { perfect: 1.0, great: 0.7, good: 0.4 }[k];") && js.includes('G.race.playerDist += 5;'));
t('deriveOppDistM: poll ok terakhir - initialDistKm', SqueekEngine.deriveOppDistM({ initialDistKm: 12.5 }, [{ t: 0, dist: 12.5, ok: true }, { t: 10, dist: 12.51, ok: true }]) === 10);
t('deriveOppDistM: tanpa poll ok -> 0', SqueekEngine.deriveOppDistM({ initialDistKm: 12.5 }, [{ t: 0, dist: 12.5, ok: false }]) === 0);
t('deriveOppDistM: tidak pernah negatif', SqueekEngine.deriveOppDistM({ initialDistKm: 12.5 }, [{ t: 0, dist: 12.4, ok: true }]) === 0);

// --- v40.1: verified badge ---
t('MSG lbVerifying exists in both langs', (js.match(/lbVerifying:/g) || []).length === 2);
t('MSG lbVerified exists in both langs', (js.match(/lbVerified:/g) || []).length === 2);
t('MSG lbVerifyRejected exists in both langs', (js.match(/lbVerifyRejected:/g) || []).length === 2);
t('MSG lbVerifyUnknown exists in both langs', (js.match(/lbVerifyUnknown:/g) || []).length === 2);
t('renderLb shows ✓ for verified rows only', js.includes('r.verified ?') && js.includes('lb-verified') && js.includes('✓'));
t('CSS has .lb-verified', css.includes('.lb-verified'));
t('pollVerify polls GET /verify with the replay hash', js.includes("'/verify?replayHash=' + encodeURIComponent(replayHash)"));
t('pollVerify interval 10s, max 9 tries (~90s)', js.includes('VERIFY_POLL_INTERVAL_MS = 10000') && js.includes('VERIFY_POLL_MAX_TRIES = 9'));
t('submitLb polls /verify on pending submit', js.includes('pollVerify(hash, showStatus)') && js.includes("d.pending && (d.replayHash || lastResult.replayHash)"));
t('submitLb stops an old poll on a fresh submit', js.includes('stopVerifyPoll(); // v40.1'));
t('resetLbSubmit stops the poll', js.includes('function resetLbSubmit() {\n  stopVerifyPoll();'));
// --- v40.1: poller behaviour with mocked fetch/timers ---
const verifySrc = js.slice(js.indexOf('const VERIFY_POLL_INTERVAL_MS'), js.indexOf('function resetLbSubmit'));
function mkVerifyHarness(responses) {
  let calls = 0; const timers = []; const urls = [];
  const fakeFetch = async (url) => {
    urls.push(url);
    const r = responses[Math.min(calls++, responses.length - 1)];
    if (r instanceof Error) throw r;
    return { status: r.status, json: async () => r.body };
  };
  const fakeSetTimeout = (fn, ms) => { const id = timers.length + 1; timers.push({ fn, ms, id }); return id; };
  const fakeClearTimeout = (id) => { const i = timers.findIndex(x => x.id === id); if (i >= 0) timers.splice(i, 1); };
  const api = new Function('CONFIG', 'tfetch', 'setTimeout', 'clearTimeout', verifySrc + '; return { pollVerify: pollVerify, verifyPollOutcome: verifyPollOutcome, verifyBadgeText: verifyBadgeText, stopVerifyPoll: stopVerifyPoll };')({ LB_URL: 'https://lb.test' }, fakeFetch, fakeSetTimeout, fakeClearTimeout);
  return { api, timers, urls, get calls() { return calls; } };
}
async function driveVerify(h) {
  let guard = 0;
  while (h.timers.length && guard++ < 20) { const tk = h.timers.shift(); await tk.fn(); }
}
async function runVerifyPollTests() {
  const T = { verified: 'TERVERIFIKASI ✓', verifying: 'MENUNGGU VERIFIKASI…', rejected: 'VERIFIKASI DITOLAK', unknown: 'BELUM DIKETAHUI' };
  const V = mkVerifyHarness([]).api;
  t('verifyPollOutcome: 202 -> pending', V.verifyPollOutcome(202, null) === 'pending');
  t('verifyPollOutcome: 202 with body -> pending', V.verifyPollOutcome(202, { verification_status: 'pending' }) === 'pending');
  t('verifyPollOutcome: 200 verified -> verified', V.verifyPollOutcome(200, { verification_status: 'verified' }) === 'verified');
  t('verifyPollOutcome: 200 other -> unknown', V.verifyPollOutcome(200, { verification_status: 'pending' }) === 'unknown');
  t('verifyPollOutcome: 422 -> rejected', V.verifyPollOutcome(422, { verification_status: 'rejected' }) === 'rejected');
  t('verifyPollOutcome: 404 -> unknown', V.verifyPollOutcome(404, { error: 'replay not found' }) === 'unknown');
  t('verifyPollOutcome: 500 -> unknown', V.verifyPollOutcome(500, null) === 'unknown');
  t('verifyBadgeText verified with hash+sig', V.verifyBadgeText('verified', 'abcd1234', 'ff001122', T) === 'TERVERIFIKASI ✓ • abcd1234 • 0xff001122');
  t('verifyBadgeText verified without hash/sig', V.verifyBadgeText('verified', '', '', T) === 'TERVERIFIKASI ✓');
  t('verifyBadgeText pending', V.verifyBadgeText('pending', '', '', T) === 'MENUNGGU VERIFIKASI…');
  t('verifyBadgeText rejected', V.verifyBadgeText('rejected', '', '', T) === 'VERIFIKASI DITOLAK');
  t('verifyBadgeText unknown', V.verifyBadgeText('unknown', '', '', T) === 'BELUM DIKETAHUI');
  // verified after 2 pending ticks
  {
    const h = mkVerifyHarness([
      { status: 202, body: { verification_status: 'pending' } },
      { status: 202, body: { verification_status: 'pending' } },
      { status: 200, body: { verification_status: 'verified', signature: '0x' + 'ab'.repeat(32), replayHash: '0x' + 'cd'.repeat(32) } },
    ]);
    const seen = [];
    h.api.pollVerify('0x' + 'cd'.repeat(32), (s, d) => seen.push([s, d ? d.verification_status : null, d && d.signature ? d.signature.slice(0, 6) : null]));
    await driveVerify(h);
    t('pollVerify: pending then verified', seen.length === 2 && seen[0][0] === 'pending' && seen[1][0] === 'verified');
    t('pollVerify: verified carries the signature', seen[1][2] === '0xabab');
    t('pollVerify: stops after verified (no timers left)', h.timers.length === 0);
    t('pollVerify: fetched /verify 3 times', h.calls === 3);
    t('pollVerify: polls the submitted replay hash', h.urls.every(u => u.includes('/verify?replayHash=0x' + 'cd'.repeat(32))));
  }
  // rejected on first tick
  {
    const h = mkVerifyHarness([{ status: 422, body: { verification_status: 'rejected', reason: 'sim mismatch' } }]);
    const seen = [];
    h.api.pollVerify('0x' + 'ee'.repeat(32), (s) => seen.push(s));
    await driveVerify(h);
    t('pollVerify: rejected stops the poll', seen.length === 2 && seen[0] === 'pending' && seen[1] === 'rejected' && h.timers.length === 0 && h.calls === 1);
  }
  // network down: 9 tries, then unknown — never claims verified
  {
    const h = mkVerifyHarness([new Error('offline')]);
    const seen = [];
    h.api.pollVerify('0x' + 'ff'.repeat(32), (s) => seen.push(s));
    await driveVerify(h);
    t('pollVerify: offline 9 tries then unknown', seen.length === 2 && seen[0] === 'pending' && seen[1] === 'unknown' && h.calls === 9);
    t('pollVerify: offline never reports verified', !seen.includes('verified'));
  }
  // a fresh pollVerify cancels the previous timer
  {
    const h = mkVerifyHarness([{ status: 202, body: { verification_status: 'pending' } }]);
    const seen = [];
    h.api.pollVerify('0x' + '11'.repeat(32), (s) => seen.push(s));
    h.api.pollVerify('0x' + '22'.repeat(32), (s) => seen.push(s));
    t('pollVerify: restart cancels the old timer', h.timers.length === 1);
    await driveVerify(h);
    t('pollVerify: restart polls the new hash only', h.urls.every(u => u.includes('0x' + '22'.repeat(32))));
  }
}
// --- v41: Toko Keju + Liga Mingguan (Worker v5, off-chain only) ---
// 15a. Worker pure functions — run the real code from worker.js.
function oneLineW(prefix) { const l = workerLines.find(x => x.startsWith(prefix)); if (!l) throw new Error('line not found in worker: ' + prefix); return l; }
function constSrcW(marker) {
  const start = worker.indexOf(marker);
  if (start < 0) throw new Error('const not found in worker: ' + marker);
  let depth = 0, seen = false, end = start;
  for (let i = start; i < worker.length; i++) { const ch = worker[i]; if (ch === '[' || ch === '{') { depth++; seen = true; } if (ch === ']' || ch === '}') depth--; if (seen && depth === 0) { end = i; break; } }
  return worker.slice(start, end + 1);
}
function constSrc38(marker) {
  const start = js.indexOf(marker);
  if (start < 0) throw new Error('const not found in script.js: ' + marker);
  let depth = 0, seen = false, end = start;
  for (let i = start; i < js.length; i++) { const ch = js[i]; if (ch === '[' || ch === '{') { depth++; seen = true; } if (ch === ']' || ch === '}') depth--; if (seen && depth === 0) { end = i; break; } }
  return js.slice(start, end + 1);
}
const cheeseEarned = new Function(oneLineW('const CHEESE_PER_SONG =') + '\n' + oneLineW('const CHEESE_GRADE_S_BONUS =') + '\n' + fnSrcW('cheeseEarned') + '\nreturn cheeseEarned;')();
t('cheeseEarned S = 600', cheeseEarned('S') === 600);
t('cheeseEarned SS = 600', cheeseEarned('SS') === 600);
t('cheeseEarned A/B/C/D = 100', ['A', 'B', 'C', 'D'].every(g => cheeseEarned(g) === 100));
t('cheeseEarned bad grade = 100', cheeseEarned(null) === 100 && cheeseEarned('') === 100 && cheeseEarned('s') === 100);
const squeekDayKey = new Function(fnSrcW('squeekDayKey') + '\nreturn squeekDayKey;')();
t('squeekDayKey 11:59 UTC -> yesterday', squeekDayKey(Date.parse('2026-11-08T11:59:00Z')) === '2026-11-07');
t('squeekDayKey 12:00 UTC -> today', squeekDayKey(Date.parse('2026-11-08T12:00:00Z')) === '2026-11-08');
t('squeekDayKey 00:30 UTC -> yesterday', squeekDayKey(Date.parse('2026-11-08T00:30:00Z')) === '2026-11-07');
t('squeekDayKey matches client squeekTodayStr', squeekDayKey(Date.parse('2026-11-08T11:59:59Z')) === '2026-11-07' && squeekDayKey(Date.parse('2026-11-08T12:00:00Z')) === '2026-11-08');
// Week: Monday 19:00 WIB = Monday 12:00 UTC. 9 Nov 2026 is a Monday.
const weekStartMs = new Function(fnSrcW('weekStartMs') + '\nreturn weekStartMs;')();
const weekStartKey = new Function(fnSrcW('weekStartMs') + '\n' + fnSrcW('weekStartKey') + '\nreturn weekStartKey;')();
t('weekStartMs Sunday 19:00 WIB -> Monday 2 Nov 12:00 UTC', weekStartMs(Date.parse('2026-11-08T12:00:00Z')) === Date.parse('2026-11-02T12:00:00Z'));
t('weekStartMs Monday 18:59 WIB -> still last week', weekStartMs(Date.parse('2026-11-09T11:59:00Z')) === Date.parse('2026-11-02T12:00:00Z'));
t('weekStartMs Monday 19:00 WIB -> this Monday', weekStartMs(Date.parse('2026-11-09T12:00:00Z')) === Date.parse('2026-11-09T12:00:00Z'));
t('weekStartMs Monday 18:00 UTC -> this Monday', weekStartMs(Date.parse('2026-11-09T18:00:00Z')) === Date.parse('2026-11-09T12:00:00Z'));
t('weekStartMs Saturday -> same Monday', weekStartMs(Date.parse('2026-11-14T03:00:00Z')) === Date.parse('2026-11-09T12:00:00Z'));
t('weekStartKey Sunday -> 2026-11-02', weekStartKey(Date.parse('2026-11-08T12:00:00Z')) === '2026-11-02');
t('weekStartKey Monday 19:00 WIB -> 2026-11-09', weekStartKey(Date.parse('2026-11-09T12:00:00Z')) === '2026-11-09');
t('weekStartKey Monday 18:59 WIB -> 2026-11-02', weekStartKey(Date.parse('2026-11-09T11:59:00Z')) === '2026-11-02');
t('next reset is weekStart + 7 days', weekStartMs(Date.parse('2026-11-09T12:00:00Z')) + 7 * 24 * 3600 * 1000 === Date.parse('2026-11-16T12:00:00Z'));
const capsuleRarity = new Function(fnSrcW('capsuleRarity') + '\nreturn capsuleRarity;')();
[[0, 'common'], [0.6999, 'common'], [0.7, 'rare'], [0.9199, 'rare'], [0.92, 'epic'], [0.9899, 'epic'], [0.99, 'legendary'], [0.9999, 'legendary']].forEach(([r, want]) => t('capsuleRarity(' + r + ') = ' + want, capsuleRarity(r) === want));
t('capsuleRarity rejects out-of-range', capsuleRarity(-0.1) === null && capsuleRarity(1) === null && capsuleRarity(NaN) === null && capsuleRarity('x') === null);
const catalogSrcW = constSrcW('const CHEESE_CATALOG = [');
const CHEESE_CATALOG = new Function(catalogSrcW + '\nreturn CHEESE_CATALOG;')();
const capsulePool = new Function(catalogSrcW + '\n' + fnSrcW('capsulePool') + '\nreturn capsulePool;')();
const capsulePick = new Function(catalogSrcW + '\n' + fnSrcW('capsulePool') + '\n' + fnSrcW('capsulePick') + '\nreturn capsulePick;')();
const dupCompensation = new Function(constSrcW('const CHEESE_DUP_COMP = {') + '\n' + fnSrcW('dupCompensation') + '\nreturn dupCompensation;')();
const catalogItem = new Function(catalogSrcW + '\n' + fnSrcW('catalogItem') + '\nreturn catalogItem;')();
t('catalog has 8 items', CHEESE_CATALOG.length === 8);
t('catalog ids are unique', new Set(CHEESE_CATALOG.map(c => c.id)).size === 8);
t('catalog has 2 items per rarity', ['common', 'rare', 'epic', 'legendary'].every(r => CHEESE_CATALOG.filter(c => c.rarity === r).length === 2));
t('catalog has 2 slots x 4 items', ['note', 'frame'].every(s => CHEESE_CATALOG.filter(c => c.slot === s).length === 4));
t('capsule-only items are legendary with price 0', CHEESE_CATALOG.filter(c => c.capsuleOnly).length === 2 && CHEESE_CATALOG.filter(c => c.capsuleOnly).every(c => c.rarity === 'legendary' && c.price === 0));
t('buyable items have a Keju price > 0', CHEESE_CATALOG.filter(c => !c.capsuleOnly).every(c => c.price > 0));
t('capsulePool common = mint + neon', capsulePool('common').map(c => c.id).join(',') === 'note-mint,frame-neon');
t('capsulePool legendary = rainbow pair', capsulePool('legendary').map(c => c.id).join(',') === 'note-rainbow,frame-rainbow');
t('capsulePool bogus rarity = empty', capsulePool('bogus').length === 0);
t('capsulePick common 0 = note-mint', capsulePick('common', 0).id === 'note-mint');
t('capsulePick common 1 = frame-neon', capsulePick('common', 1).id === 'frame-neon');
t('capsulePick wraps the pool', capsulePick('common', 2).id === 'note-mint' && capsulePick('rare', -1).id === 'frame-gold');
t('capsulePick rejects bad input', capsulePick('bogus', 0) === null && capsulePick('common', 1.5) === null);
t('dupCompensation 25/50/100/250', dupCompensation('common') === 25 && dupCompensation('rare') === 50 && dupCompensation('epic') === 100 && dupCompensation('legendary') === 250);
t('dupCompensation bogus = 0', dupCompensation('bogus') === 0);
t('catalogItem finds note-gold', catalogItem('note-gold').slot === 'note' && catalogItem('note-gold').rarity === 'rare' && catalogItem('note-gold').price === 800);
t('catalogItem misses unknown ids', catalogItem('nope') === null);
// 15b. Worker v5 wiring (string checks — the live D1 + endpoint checks run after deploy).
t('worker root reports version 8', worker.includes('version: 8'));
t('worker has GET /cheese', worker.includes("url.pathname === \"/cheese\" && request.method === \"GET\""));
t('worker has POST /cheese/buy', worker.includes("url.pathname === \"/cheese/buy\" && request.method === \"POST\""));
t('worker has POST /cheese/pull', worker.includes("url.pathname === \"/cheese/pull\" && request.method === \"POST\""));
t('worker has POST /cheese/equip', worker.includes("url.pathname === \"/cheese/equip\" && request.method === \"POST\""));
t('worker has GET /league', worker.includes("url.pathname === \"/league\" && request.method === \"GET\""));
t('league returns top 30', worker.includes('LIMIT 30') && worker.includes('ORDER BY l.best_score DESC, l.updated_at ASC'));
t('league normalizes the week param', worker.includes("weekStartKey(weekMs)") && worker.includes("Date.parse(weekParam + \"T12:00:00Z\")"));
t('verifyOne credits cheese from sim.grade', worker.includes('cheeseEarned(sim.grade)'));
t('verifyOne upserts the cheese balance', worker.includes('INSERT INTO cheese_balances') && worker.includes('ON CONFLICT(wallet) DO UPDATE SET balance = cheese_balances.balance + excluded.balance'));
t('verifyOne logs the song credit idempotently', worker.includes("INSERT OR IGNORE INTO cheese_ledger") && worker.includes("'song'"));
t('verifyOne logs the daily mission once per day', worker.includes("kind = 'daily'") && worker.includes('CHEESE_DAILY_BONUS'));
t('verifyOne writes the weekly league only for FREE', worker.includes("if (mode === \"free\")") && worker.includes('INSERT INTO league_scores') && worker.includes('MAX(league_scores.best_score, excluded.best_score)'));
t('buy/pull deduct atomically (balance >= price)', (worker.match(/balance >= \?/g) || []).length >= 2);
t('pull uses server RNG, never client input', worker.includes('crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296') && worker.includes('capsuleRarity(r)'));
t('pull refunds a lost buy race', worker.includes('Lost a race with a concurrent buy: refund.'));
t('equip clears the slot then sets one equipped', worker.includes('UPDATE cheese_inventory SET equipped = 0') && worker.includes('UPDATE cheese_inventory SET equipped = 1'));
t('cheese endpoints validate the wallet', (worker.match(/url\.pathname === "\/cheese/g) || []).length >= 4);
t('migrate-v5.sql creates all four v5 tables', (() => { const m = fs.readFileSync('migrate-v5.sql', 'utf8'); return ['cheese_balances', 'cheese_ledger', 'cheese_inventory', 'league_scores'].every(tn => m.includes('CREATE TABLE IF NOT EXISTS ' + tn)); })());
t('migrate-v5.sql has the replay + daily uniqueness indexes', (() => { const m = fs.readFileSync('migrate-v5.sql', 'utf8'); return m.includes('idx_cheese_ledger_replay') && m.includes('idx_cheese_ledger_daily') && m.includes('idx_league_week'); })());
// 15c. Client: note skins + result frames — run the real functions.
const noteSkinsSrc = constSrc38('const NOTE_SKINS = {');
const noteColor = new Function(noteSkinsSrc + '\n' + fnSrc38('noteColor') + '\nreturn noteColor;')();
const THEME_NOTES = ['#ff00ff', '#00ffff', '#ffff00', '#ff8800'];
t('noteColor uses the theme with no skin', noteColor(1, THEME_NOTES, null) === '#00ffff' && noteColor(0, THEME_NOTES, undefined) === '#ff00ff');
t('noteColor gold skin recolors lane 1', noteColor(1, THEME_NOTES, 'note-gold') === '#ffb020');
t('noteColor mint skin wraps lane 5 to index 1', noteColor(5, THEME_NOTES, 'note-mint') === '#5ce1e6');
t('noteColor unknown skin falls back to theme', noteColor(2, THEME_NOTES, 'bogus') === '#ffff00');
t('every catalog note skin has client colors', CHEESE_CATALOG.filter(c => c.slot === 'note').every(c => { const m = new Function(noteSkinsSrc + '\nreturn NOTE_SKINS;')(); return Array.isArray(m[c.id]) && m[c.id].length === 4; }));
t('every catalog frame skin has a client class', CHEESE_CATALOG.filter(c => c.slot === 'frame').every(c => js.includes("FRAME_SKINS = ['frame-neon', 'frame-gold', 'frame-royal', 'frame-rainbow']") && js.includes("'" + c.id + "'")));
const skinStore = {};
const skinLS = { getItem: k => (k in skinStore ? skinStore[k] : null), setItem: (k, v) => { skinStore[k] = String(v); }, removeItem: k => { delete skinStore[k]; } };
const skinFns = new Function('localStorage', oneLine38('function loadJSON') + '\n' + oneLine38('function saveJSON') + '\n' + fnSrc38('shopSkin') + '\n' + fnSrc38('saveShopSkin') + '\nreturn { shopSkin, saveShopSkin };')(skinLS);
t('shopSkin defaults to nothing equipped', skinFns.shopSkin().note === null && skinFns.shopSkin().frame === null);
skinFns.saveShopSkin({ note: 'note-gold', frame: 'frame-neon' });
t('shopSkin round-trips through sqk41:skin', skinFns.shopSkin().note === 'note-gold' && skinFns.shopSkin().frame === 'frame-neon');
t('shopSkin survives a corrupt store', (() => { skinStore['sqk41:skin'] = 'not-json'; return skinFns.shopSkin().note === null; })());
// 15d. Client wiring: shop tab, league weekly, cosmetics in the game.
t('setTab fetches the shop on SHOP', js.includes("if (name === 'shop') { fetchShop(); fetchSqkShop(); }"));
t('setTab fetches the weekly league on LEAGUE', js.includes("if (name === 'league') { fetchLb(lbState.mode); fetchLeagueWeekly(); }"));
['fetchShop', 'renderShop', 'buyItem', 'pullCapsule', 'equipItem', 'fetchLeagueWeekly', 'renderLeagueWeekly', 'applyResultFrame', 'shopSkin', 'saveShopSkin', 'noteColor', 'shopOwned', 'shopEquipped'].forEach(s => t('v41 js has ' + s, js.includes('function ' + s)));
t('shop fetches GET /cheese', js.includes("CONFIG.LB_URL + '/cheese'"));
t('buy posts to /cheese/buy', js.includes("CONFIG.LB_URL + '/cheese/buy'"));
t('pull posts to /cheese/pull', js.includes("CONFIG.LB_URL + '/cheese/pull'"));
t('equip posts to /cheese/equip', js.includes("CONFIG.LB_URL + '/cheese/equip'"));
t('league weekly fetches GET /league', js.includes("CONFIG.LB_URL + '/league'"));
t('shop buttons are wired at boot', js.includes("bindClick('capsuleBtn'") && js.includes("bindClick('leagueWeeklyRefreshBtn'"));
t('draw uses noteColor with the equipped skin', js.includes('noteColor(n.lane, th.notes, G.noteSkin)') && js.includes('drawHamster(x, y, 48, col)'));
t('play() snapshots the equipped note skin', js.includes('noteSkin: shopSkin().note'));
t('finish() applies the equipped result frame', js.includes('applyResultFrame(); // v41'));
t('result frame adds exactly one frame class', js.includes("FRAME_SKINS.forEach(f => p.classList.remove(f))") && js.includes("p.classList.add(frame)"));
t('verified submit refreshes shop + weekly league', js.includes("if (status === 'verified') { fetchLb(lbState.mode); fetchShop(); fetchLeagueWeekly(); }"));
t('dedupe-verified submit refreshes shop + weekly league', js.includes('fetchShop(); fetchLeagueWeekly(); // v41: dedupe-verified replay'));
t('shop never computes its own balance', !js.includes('shopState.balance +') && !js.includes('shopState.balance -'));
t('shop shows the server catalog, never a hardcoded one', js.includes('shopState.catalog.map') && !js.includes('const SHOP_CATALOG'));
t('CSS has shop items', css.includes('.shop-item') && css.includes('#shopCatalog'));
t('CSS has all four result frames', ['frame-neon', 'frame-gold', 'frame-royal', 'frame-rainbow'].every(f => css.includes('#resultPanel.' + f)));
t('CSS hides the empty weekly rank line', css.includes('#leagueWeeklyRank:empty'));
t('SHOP tab button exists once', (html.match(/data-tab="shop"/g) || []).length === 1);
t('SHOP panel exists once', (html.match(/id="tab-shop"/g) || []).length === 1);
t('weekly league box lives inside the LEAGUE tab', html.indexOf('id="leagueWeeklyBox"') > html.indexOf('id="tab-league"') && html.indexOf('id="leagueWeeklyBox"') < html.indexOf('id="tab-shop"'));
t('README documents the v41 cheese economy', readme.includes('**v41**') && readme.includes('100 per verified song') && readme.includes('league_scores'));
t('README documents the v41 shop catalog', readme.includes('Mint/Golden/Void/Rainbow') && readme.includes('capsule-only legendary'));

// --- 15e. v41.1: weekly league verified ✓ (same badge as the global board) ---
t('worker v6: /league joins scores for verified', worker.includes("LEFT JOIN scores s ON s.wallet = l.wallet AND s.mode = 'free'") && worker.includes('COALESCE(s.verified, 0) AS verified'));
t('worker v6: /league rows carry verified', worker.includes('verified: r.verified ? 1 : 0'));
t('worker v6: /league you carries verified', worker.includes('verified: me.verified ? 1 : 0'));
t('worker version is 8', worker.includes('{ service: "squeekchain-leaderboard", version: 8 }'));
t('worker verification path untouched by v41.1', worker.includes('function verifyOne') && worker.includes('function validateReplay') && worker.includes('function verifySimulated'));
t('renderLeagueWeekly shows ✓ for verified rows only', js.includes("r.verified ? ` <span class=\"lb-verified\"") && js.includes('✓'));
t('submit sends gameVersion v42.2', js.includes("gameVersion: 'v42.2'"));
t('html title is v42.2', html.includes('<title>SQUEEKCHAIN // v42.2</title>'));
t('README documents v41.1 league badge', readme.includes('**v41.1**') && readme.includes('LEFT JOIN'));
// Functional: run the REAL renderLeagueWeekly with a fake DOM + mock /league rows.
(function () {
  const src = js.slice(js.indexOf('function renderLeagueWeekly()'), js.indexOf('async function fetchLeagueWeekly()'));
  const els = {};
  const $ = (id) => (els[id] || (els[id] = { innerHTML: '', textContent: '' }));
  const fakes = {
    escHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    truncAddr: (w) => (w || '').slice(0, 6) + '...' + (w || '').slice(-4),
    msg: (k) => k,
    msgf: (k, o) => k + JSON.stringify(o || {}),
    currentWallet: () => '',
    I18N: { en: { leagueWeekNote: 'NOTE', leagueWeeklyEmpty: 'EMPTY' }, id: { leagueWeekNote: 'NOTE', leagueWeeklyEmpty: 'EMPTY' } },
    lang: 'en',
  };
  const run = (state) => {
    const fn = new Function('$', 'currentWallet', 'escHtml', 'truncAddr', 'msg', 'msgf', 'I18N', 'lang', 'leagueWeeklyState', 'els', src + '; renderLeagueWeekly(); return els;');
    return fn($, fakes.currentWallet, fakes.escHtml, fakes.truncAddr, fakes.msg, fakes.msgf, fakes.I18N, fakes.lang, state, els);
  };
  const rows = [
    { rank: 1, wallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', name: 'AAA', best_score: 500, verified: 1 },
    { rank: 2, wallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', name: 'BBB', best_score: 300, verified: 0 },
  ];
  const out = run({ week_start: '2026-11-02', scores: rows, you: { rank: 1, best_score: 500, verified: 1 } });
  const htmlOut = out.leagueWeeklyList.innerHTML;
  const badgeCount = (htmlOut.match(/lb-verified/g) || []).length;
  t('league weekly: verified=1 row shows ✓', badgeCount === 1 && htmlOut.includes('✓'));
  const rowDivs = htmlOut.split('</div>').filter(Boolean);
  t('league weekly: verified=0 row shows no ✓', rowDivs.length === 2 && !rowDivs[1].includes('✓') && rowDivs[1].includes('BBB'));
  t('league weekly: verified row keeps score + name', rowDivs[0].includes('AAA') && rowDivs[0].includes('500'));
  const outEmpty = run({ week_start: '2026-11-02', scores: [], you: null });
  t('league weekly: empty board shows the empty message', outEmpty.leagueWeeklyList.innerHTML.includes('EMPTY'));
})();


// --- 15f. v42.1: SQK shop + golden capsule (Worker v8, shop DEPLOYED) ---
t('sqk ids are inside the SHOP tab', html.indexOf('id="sqkShopBox"') > html.indexOf('id="tab-shop"') && html.indexOf('id="sqkShopBox"') > html.indexOf('id="shopMsg"'));
t('sqk commit + resolve buttons are disabled in the HTML', html.includes('id="sqkCommitBtn" data-i18n="sqkCommitBtn" disabled') && html.includes('id="sqkResolveBtn" data-i18n="sqkResolveBtn" disabled'));
t('sqk coming-soon banner element is in the HTML (hidden at runtime when deployed)', html.includes('id="sqkShopSoon"') && html.includes('SQK SHOP COMING SOON'));
t('renderSqkShop hides the banner when the shop is deployed', js.includes("soon.classList.toggle('hidden', deployed)"));
t('client SHOP_ADDRESS is the deployed shop', js.includes("CONFIG.SHOP_ADDRESS = '0x43f568AcfaDcee4333785c9F26596719ED0B02fb'"));
t('client has SQK_TOKEN + SEPOLIA_RPC', js.includes('CONFIG.SQK_TOKEN = CONFIG.TOKEN') && js.includes('CONFIG.SEPOLIA_RPC = CONFIG.RPC_URL'));
['renderSqkShop', 'fetchSqkShop', 'buySqkItem', 'commitSqkCapsule', 'resolveSqkCapsule', 'sqkPermitAndSend', 'sqkWaitReceipt', 'sqkEncodeBuy', 'sqkEncodeCommit', 'sqkEncodeResolve', 'sqkShopDeployed', 'sqkSplitMilli', 'sqkCapsuleRarity', 'sqkPermitDomain'].forEach(f => t('v42.1 js has ' + f, js.includes('function ' + f)));
t('client buy/commit/resolve selectors are the frozen ABI selectors', js.includes("buyWithPermit: '0x01a833fb'") && js.includes("commitCapsule: '0x4dd52bb4'") && js.includes("resolveCapsule: '0x6172f59f'"));
t('client has the CapsuleResolved + CapsuleCommitted topic0s', js.includes('0xb1190a79761e5e0820f774b1613ed3b5022912a9aa445806273a260a8527a502') && js.includes('0xfcdae1bdc0120a94c455ae8babdec61a16a600fcf9f786fd9d0a4b46c835bc25'));
t('client permit uses eth_signTypedData_v4 + eth_sendTransaction only (no private key)', js.includes("method: 'eth_signTypedData_v4'") && js.includes("method: 'eth_sendTransaction'") && !/privateKey/.test(js.slice(js.indexOf('// --- v42.1: SQK shop'), js.indexOf('// --- v41: weekly league'))));
t('client targetRound is settled + 2', js.includes('const targetRound = settled + 2;'));
t('client resolves via the Worker first', js.includes("CONFIG.LB_URL + '/capsule-resolve'") && js.includes("CONFIG.LB_URL + '/capsule'"));
t('client credits Keju only from a Worker-verified receipt', js.includes('Credit the Keju compensation via the Worker (verified receipt)'));
t('client disables sqk buttons while the shop is undeployed', js.includes('commit.disabled = !deployed') && js.includes('if (!sqkShopDeployed()) return sqkShopMsg(msg(') && js.includes("sqkShopSoon')"));
t('sqk i18n exists in EN + ID', js.includes("sqkShopSoon: 'SQK SHOP COMING SOON") && js.includes("sqkShopSoon: 'TOKO SQK SEGERA HADIR") && js.includes("sqkCapsuleOdds: 'ODDS: COMMON 70%") && js.includes("sqkCapsuleOdds: 'PELUANG: COMMON 70%"));
t('shop tab fetches the SQK shop too', js.includes("if (name === 'shop') { fetchShop(); fetchSqkShop(); }"));
// --- 15g. v42.2: WalletConnect (Reown) — connect from a plain browser ---
t('WC UMD script tag is in the HTML (correct path, before script.js)', html.includes('https://unpkg.com/@walletconnect/ethereum-provider@2.26.0/dist/index.umd.js') && !html.includes('dist/umd/index.min.js') && html.indexOf('@walletconnect/ethereum-provider') < html.indexOf('src="script.js"'));
t('WC script tag is deferred (order preserved)', html.includes('<script src="https://unpkg.com/@walletconnect/ethereum-provider@2.26.0/dist/index.umd.js" defer></script>'));
t('CONFIG has WC_PROJECT_ID + WC_CHAINS', js.includes("CONFIG.WC_PROJECT_ID = '1f186dd3221f938c4e0b8c72c233a3be'") && js.includes('CONFIG.WC_CHAINS = [11155111]'));
['getEth', 'sqkChainIdHex', 'ensureSepoliaChain', 'wcGetProvider', 'connectWalletConnect', 'restoreWalletConnectSession'].forEach(f => t('v42.2 js has ' + f, js.includes('function ' + f)));
t('WC init uses the verified API (projectId, chains, showQrModal, rpcMap, metadata)', js.includes('window.EthereumProvider.init({') && js.includes('projectId: CONFIG.WC_PROJECT_ID') && js.includes('chains: CONFIG.WC_CHAINS') && js.includes('showQrModal: true') && js.includes('rpcMap: { 11155111: CONFIG.SEPOLIA_RPC }') && js.includes("name: 'Squeek Pixel ID'") && js.includes("url: 'https://squeekpixel.web.id/'"));
t('WC connect opens the modal then requests accounts', js.includes('await p.connect()') && js.includes("await p.request({ method: 'eth_requestAccounts' })"));
t('connectWallet has both paths (injected first, WC fallback)', js.includes('await connectWalletConnect()') && js.includes("const eth = window.ethereum;"));
t('WC load failure is fail-soft (message, no crash)', js.includes("typeof window.EthereumProvider === 'undefined'") && js.includes("msg('wcLoadFail')"));
t('WC session restore is gated on a wc@2: key (no relay on plain loads)', js.includes("k.indexOf('wc@2:') === 0") && js.includes('restoreWalletConnectSession()'));
t('tx paths use getEth() (permit, receipt, resolve)', (js.split('const eth = getEth();').length - 1) === 3);
t('chain ensure switches + adds Sepolia (0xaa36a7, 4902)', js.includes("method: 'wallet_switchEthereumChain'") && js.includes("method: 'wallet_addEthereumChain'") && js.includes("chainId: '0xaa36a7'") && js.includes('e.code === 4902'));
t('chain id normalises number + hex (WC returns a number)', js.includes("typeof v === 'number'") && js.includes('v.toString(16)'));
t('WC i18n exists in EN + ID', js.includes("wcLoadFail: 'WALLETCONNECT FAILED TO LOAD") && js.includes("wcLoadFail: 'WALLETCONNECT GAGAL DIMUAT") && js.includes("wcRejected: 'WALLETCONNECT CANCELLED") && js.includes("wcRejected: 'WALLETCONNECT DIBATALKAN"));
t('no direct window.ethereum in tx paths', !js.slice(js.indexOf('async function sqkPermitAndSend'), js.indexOf('async function buySqkItem')).includes('const eth = window.ethereum;'));
t('WC provider is module-level (not on G)', js.includes('let wcProvider = null;') && !js.includes('G.wcProvider'));
t('no private key anywhere in the WC code', !/privateKey|PRIVATE_KEY|mnemonic|seed phrase/i.test(js.slice(js.indexOf('// --- v42.2: WalletConnect'), js.indexOf("bindClick('connectBtn'"))));

t('no BNB/Binance anywhere incl. worker (v42.1)', !/BNB|Binance/i.test(html + css + js + readme + worker));
t('README documents v42.1 + SQK catalog + split', readme.includes('**v42.1**') && readme.includes('Skin Rare 5') && readme.includes('70% owner / 30% prize pool') && readme.includes('SHOP_CONTRACT'));
t('worker v8: SCORES_CONTRACT is the Batch 4 address', worker.includes('0x06be1517d7187ec1663c4f26d11a8f6cc217304f'));
t('worker v8: SHOP_CONTRACT is the deployed shop', worker.includes('const SHOP_CONTRACT = "0x43f568AcfaDcee4333785c9F26596719ED0B02fb"'));
t('worker v8: SQK token address', worker.includes('0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e'));
t('worker v8: capsule endpoints exist', worker.includes('url.pathname === "/capsule-resolve"') && worker.includes('url.pathname === "/capsule"'));
t('worker v8: 503 shop-not-deployed gate present as a guard (inactive while deployed)', (worker.match(/shop not deployed/g) || []).length >= 2);
t('worker v8: 409 round not settled yet', worker.includes('round not settled yet'));
t('worker v8: CapsuleResolve typehash field order is frozen', worker.includes('CapsuleResolve(address player,uint256 pullId,uint256 targetRound,bytes32 dataHash,uint256 deadline)'));
t('worker v8: receipt checks status + from + to + CapsuleResolved log', worker.includes('receipt.status') && worker.includes('receipt.from') && worker.includes('receipt.to') && worker.includes('parseCapsuleResolvedLog'));
t('worker v8: duplicate credit is idempotent per txHash', worker.includes("'capsule-duplicate'") && worker.includes('UNIQUE replay_hash') || worker.includes('capsule-duplicate'));
t('worker v8: dataHash is the settlement tx hash (fallback keccak)', worker.includes('dataHashForSettlement') && worker.includes('settlementForRound') && worker.includes("transactionHash"));
t('worker v8: no new D1 migration (reuses cheese tables)', !/migrate-v6|CREATE TABLE IF NOT EXISTS cheese/.test(worker) && worker.includes('cheese_ledger'));
t('worker verification path untouched by v8', worker.includes('function verifyOne') && worker.includes('function validateReplay') && worker.includes('function verifySimulated') && worker.includes('function signAttestation'));
// Functional: run the REAL v42.1 client pure functions from script.js.
(function () {
  const isAddr = (s) => /^0x[a-fA-F0-9]{40}$/.test(s);
  const CONFIG = { SHOP_ADDRESS: '0x0000000000000000000000000000000000000000', SQK_TOKEN: '0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e' };
  const src = js.slice(js.indexOf('const SQK_SHOP_CATALOG'), js.indexOf('const DIFFICULTIES')) + '\n' + js.slice(js.indexOf('function sqkWordUint'), js.indexOf('async function sqkEthCall'));
  const fn = new Function('CONFIG', 'isAddr', src + '; return { SQK_SHOP_CATALOG, SQK_CAPSULE_PRICE, SQK_CAPSULE_ODDS, SQK_CAPSULE_DUP_COMP, SQK_CAPSULE_PITY, SQK_SEL, sqkShopDeployed, sqkShopItem, sqkSplitMilli, sqkCapsuleRarity, sqkPermitDomain, sqkWordUint, sqkWordAddr, sqkWordBytes32, sqkEncodeBuy, sqkEncodeCommit, sqkEncodeResolve };');
  const S = fn(CONFIG, isAddr);
  t('sqk catalog: 6 items, prices 5/10/15/20/50/100', JSON.stringify(S.SQK_SHOP_CATALOG.map(c => c.priceSqk)) === '[5,10,15,20,50,100]');
  t('sqk catalog: names match the frozen interface', S.SQK_SHOP_CATALOG.map(c => c.name).join('|') === 'Skin Rare|Efek Epic|Bingkai Animasi|Skin Epic|Golden Wheel|Skin Legendary');
  t('sqk capsule price is 2 SQK', S.SQK_CAPSULE_PRICE === 2);
  t('sqk odds are 70/22/7/1', S.SQK_CAPSULE_ODDS.common === 70 && S.SQK_CAPSULE_ODDS.rare === 22 && S.SQK_CAPSULE_ODDS.epic === 7 && S.SQK_CAPSULE_ODDS.legendary === 1);
  t('sqk duplicate comp is 25/50/100/250', S.SQK_CAPSULE_DUP_COMP.common === 25 && S.SQK_CAPSULE_DUP_COMP.rare === 50 && S.SQK_CAPSULE_DUP_COMP.epic === 100 && S.SQK_CAPSULE_DUP_COMP.legendary === 250);
  t('sqk shop is NOT deployed while SHOP_ADDRESS is zero', S.sqkShopDeployed() === false);
  const S2 = fn({ SHOP_ADDRESS: '0x43f568AcfaDcee4333785c9F26596719ED0B02fb', SQK_TOKEN: '0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e' }, isAddr);
  t('sqk shop IS deployed with the real SHOP_ADDRESS', S2.sqkShopDeployed() === true);
  t('sqk split 5 SQK -> 3500/1500 milli', JSON.stringify(S.sqkSplitMilli(5)) === '{"ownerMilli":3500,"poolMilli":1500}');
  t('sqk split 2 SQK -> 1400/600 milli', JSON.stringify(S.sqkSplitMilli(2)) === '{"ownerMilli":1400,"poolMilli":600}');
  t('sqk split 100 SQK -> 70000/30000 milli', JSON.stringify(S.sqkSplitMilli(100)) === '{"ownerMilli":70000,"poolMilli":30000}');
  t('sqk rarity boundaries 0/0.69/0.7/0.92/0.99', S.sqkCapsuleRarity(0, 0) === 'common' && S.sqkCapsuleRarity(0.69, 0) === 'common' && S.sqkCapsuleRarity(0.7, 0) === 'rare' && S.sqkCapsuleRarity(0.92, 0) === 'epic' && S.sqkCapsuleRarity(0.99, 0) === 'legendary');
  t('sqk pity: r=0.1 counter 19 -> rare (forced)', S.sqkCapsuleRarity(0.1, 19) === 'rare');
  t('sqk pity: r=0.1 counter 18 -> common (not yet)', S.sqkCapsuleRarity(0.1, 18) === 'common');
  t('sqk pity: r=0.95 counter 19 stays epic', S.sqkCapsuleRarity(0.95, 19) === 'epic');
  t('sqk pity threshold is 20', S.SQK_CAPSULE_PITY === 20);
  const dom = S.sqkPermitDomain('Squeek');
  t('sqk permit domain is Squeek/1/Sepolia/token', dom.name === 'Squeek' && dom.version === '1' && dom.chainId === 11155111 && dom.verifyingContract === CONFIG.SQK_TOKEN);
  t('sqk permit domain falls back to Squeek', S.sqkPermitDomain().name === 'Squeek');
  t('sqk permit domain separator was verified live (documented constant)', js.includes('0x2cc99df9c423e838a7b45ff60b5ee38ad122ea209dca8da37a8d2f3befdf0017'));
  const buy = S.sqkEncodeBuy(1, 1794000000, 27, '0x' + '11'.repeat(32), '0x' + '22'.repeat(32));
  t('sqk buy calldata: selector + 5 words', buy.startsWith('0x01a833fb') && buy.length === 2 + 8 + 64 * 5);
  t('sqk buy calldata: itemId=1, deadline, v=27 in order', buy.slice(10, 74) === '0'.repeat(63) + '1' && buy.slice(74, 138) === (1794000000).toString(16).padStart(64, '0') && buy.slice(138, 202) === '0'.repeat(62) + '1b');
  const commit = S.sqkEncodeCommit(694, 1794000000, 28, '0x' + '11'.repeat(32), '0x' + '22'.repeat(32));
  t('sqk commit calldata: selector + targetRound first', commit.startsWith('0x4dd52bb4') && commit.length === 2 + 8 + 64 * 5 && commit.slice(10, 74) === (694).toString(16).padStart(64, '0'));
  const sig65 = '0x' + 'ab'.repeat(65);
  const res = S.sqkEncodeResolve(3, '0x' + 'cd'.repeat(32), 1794000000, sig65);
  t('sqk resolve calldata: selector + pullId/dataHash/deadline/offset=128', res.startsWith('0x6172f59f') && res.slice(10, 74) === '0'.repeat(63) + '3' && res.slice(74, 138) === 'cd'.repeat(32) && res.slice(202, 266) === (128).toString(16).padStart(64, '0'));
  t('sqk resolve calldata: tail is length 65 + sig bytes', res.slice(266, 330) === (65).toString(16).padStart(64, '0') && res.slice(330, 330 + 130) === 'ab'.repeat(65));
})();
// Functional: run the REAL v42.1 worker pure functions from worker.js.
(function () {
  const wsrc = worker.slice(worker.indexOf('// --- SQK shop + golden capsule (v7,'), worker.indexOf('// --- EIP-712 (Fase 1) ---'));
  const fn = new Function(wsrc + '; return { SQK_SHOP_CATALOG, SQK_CAPSULE_PRICE, sqkShopItem, sqkShopDeployed, sqkSplitMilli, sqkCapsuleRarity };');
  const W = fn();
  t('worker sqk catalog matches the client catalog', JSON.stringify(W.SQK_SHOP_CATALOG.map(c => c.priceSqk)) === '[5,10,15,20,50,100]');
  t('worker sqk split matches the client split', JSON.stringify(W.sqkSplitMilli(5)) === '{"ownerMilli":3500,"poolMilli":1500}' && JSON.stringify(W.sqkSplitMilli(2)) === '{"ownerMilli":1400,"poolMilli":600}');
  t('worker sqk pity matches the client pity', W.sqkCapsuleRarity(0.1, 19) === 'rare' && W.sqkCapsuleRarity(0.1, 18) === 'common');
  t('worker sqk shop IS deployed (SHOP_CONTRACT is the live shop)', W.sqkShopDeployed() === true);
})();

runVerifyPollTests().then(() => {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
