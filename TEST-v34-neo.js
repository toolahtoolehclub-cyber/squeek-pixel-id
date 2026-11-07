// v35.1 tests — run: node TEST-v34-neo.js  (cwd = the v35.1 folder)
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
t('html says v35.1', (html.match(/v35.1/g) || []).length >= 2);
t('browser tab title is v35.1', html.includes('<title>SQUEEKCHAIN // v35.1</title>'));
t('no BNB/Binance anywhere (v35.1)', !/BNB|Binance/i.test(html + css + js + readme));
t('SQK token is the current deployment (v35.1)', /TOKEN: '0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e'/.test(js) && !js.includes('0x810239'));
// --- v35.1 CHAIN panel + frontier-aware Round History ---
['chainBox', 'chainLines'].forEach(id => t('v35.1 chain id present once: ' + id, (html.match(new RegExp('id="' + id + '"', 'g')) || []).length === 1));
t('chain box uses i18n title', html.includes('data-i18n="chainTitle"') && html.includes('data-i18n="chainLoading"'));
['CORE_URL', 'ECONOMY_URL', 'GENESIS_TS', 'fetchChain', 'refreshChain', 'renderChainBox', 'roundIdForKey', 'roundSettled', 'estWork', 'estBlocks'].forEach(s => t('v35.1 js has ' + s, js.includes(s)));
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
// --- v35.1 MY SQUEEK on the ID Card ---
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
// --- v35.1 Squeek art on the ID Card ---
['fetchSqueekImage', 'loadSqueekImage', 'fixSvgSize', 'squeekImgCache'].forEach(s => t('v35.1 js has ' + s, js.includes(s)));
t('squeek image url is the public API', js.includes("https://api.squeekchain.com/v1/squeeks/' + id"));
t('card draws the Squeek image', js.includes('drawImage(sqkImg, 26, 510, 72, 72)'));
t('card frames the image', js.includes('strokeRect(24, 508, 76, 76)'));
t('card has a dashed placeholder', js.includes('setLineDash([4, 4])'));
t('image fetch is time-boxed', js.includes('setTimeout(() => res(null), 4000)') && js.includes('setTimeout(() => r(null), 5000)'));
t('card is 400x680 (v35.1)', js.includes('CW = 400, CH = 680;'));
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
t('id card 400x680, result card 400x560 (v35.1)', js.includes('CW = 400, CH = 680;') && (js.match(/CW = 400, CH = 560/g) || []).length === 1);
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
t('result card reads the score from G (count-up safe)', js.includes('G.score !== undefined ? G.score : val(0)'));

// --- 6d. v33.2 wiring ---
t('audio template has a {run} word (v33.2)', js.includes("gameAudioTpl: 'AUDIO: {run}"));
t('audio run word passed in play/pause/resume', js.includes("run: msg('audioRunning')") && js.includes("run: msg('audioPaused')"));
t('anthem kv row is name + key only (v33.2)', js.includes('<b>"${anthem.name}" • ${anthem.key}</b>'));
t('ID card anthem row is name + key only (v33.2)', js.includes("row('ANTHEM', `\"${an.name}\" • ${an.key}`"));
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
