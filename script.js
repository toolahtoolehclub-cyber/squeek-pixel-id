'use strict';
/* SQUEEKCHAIN v29 MEGA — basis v28 FIX + all remaining upgrades from the
 * 72-screenshot competitor analysis, built in one pass:
 * P1) LIVE RACE vs Squeektoshi (real wheel distance vs hit distance, Golden
 * Note on 10-minute round change, menu pet mirroring the live wheel);
 * P2) Wheel Call predictions (Nap/Jog/Zoomies per 10-min round, settled from
 * recorded RPM samples, +40 XP) + named Achievements gallery (10);
 * P3) Duel League (local rivals from duel links carrying from+score) +
 * shareable result card PNG;
 * P4) OBS overlay mode (?overlay=1), EN/ID toggle (menu labels), While-You-
 * Were-Away summary + mini diary;
 * EXTRA) Weekly Boss, Fever combo (x1.5 at combo 30+), Streak Freeze (earned
 * by clearing all 3 daily missions), Practice mode (60% tempo, no XP).
 * v28 FIX — PRECISION offset calibration; Daily fully consistent; LV5–LV8 unlocks.
 * v27 LIVE — song tempo follows the real hamster wheel.
 * v26 FIX — basis v25 ULTIMATE + v24 RETENTION.
 * Perbaikan dari tes HP 2026-11-06 (AudioContext running, WebGL OK, clipboard OK):
 * #1 intro 50Hz sawtooth -> 220Hz triangle + stop race-safe; #4 avatar putar di dalam canvas, kartu tidak ikut muter;
 * #5 Daily banner + scroll; #6 Duel Link feedback di resultPanel + kotak link terlihat; #7 QLTY efek terlihat walau WebGL mati + status WebGL;
 * XP divisor 20->30 karena BARS 32; shader normalize(0,0) guard; footer deep-link + bindClick warning dikembalikan.
 */

const $ = id => document.getElementById(id);
const isAddr = s => /^0x[a-fA-F0-9]{40}$/.test(s);

function setText(id, txt) { const e = $(id); if (e) e.textContent = txt; }
function bindClick(id, fn) { const e = $(id); if (e) e.onclick = fn; else console.warn('v26: elemen #' + id + ' tidak ada di HTML, dilewati (bukan crash)'); }
let lastAnthem = null;

let playMode = 'free';
let challengeCode = null;
// v27 LIVE state: last wheel snapshot, poll timer, ZOOMIES flag (70+ RPM = x2 score).
let liveSnapshot = null, livePoll = null, liveZoomies = false;
// v39 REPLAY RECORDER v1 (tanpa enforcement — Batch 3 yang menegakkan):
// objek replay lagu yang sedang berjalan, atau null bila tidak ada / gagal
// dibangun. Caps: inputs max notes+50, polls max 600 (server menolak lebih).
let replay = null;
const REPLAY_MAX_POLLS = 600, REPLAY_MAX_EXTRA_INPUTS = 50;
function todayStr(d) { const t = d || new Date(); const p = n => String(n).padStart(2, '0'); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; }
// v38: yesterdayStr() removed — the streak now uses squeekYesterdayStr() (Squeek day, 12:00 UTC).
// v38 DAILY RESET 19:00 WIB: the Squeek day runs 12:00 UTC-12:00 UTC
// (19:00 WIB-19:00 WIB). squeekTodayStr() is the UTC date of the current
// Squeek day: before 12:00 UTC it is still yesterday's UTC date.
function squeekTodayStr(d) { const t = d ? new Date(d) : new Date(); const u = new Date(t.getTime() - 12 * 3600 * 1000); const p = n => String(n).padStart(2, '0'); return `${u.getUTCFullYear()}-${p(u.getUTCMonth() + 1)}-${p(u.getUTCDate())}`; }
function squeekYesterdayStr() { const t = new Date(); t.setDate(t.getDate() - 1); return squeekTodayStr(t); }
function squeekTwoDaysAgoStr() { const t = new Date(); t.setDate(t.getDate() - 2); return squeekTodayStr(t); }
function seedKeyFor(mode) {
  if (mode === 'daily') return 'DAILY-' + squeekTodayStr();
  if (mode === 'live') return 'LIVE-' + squeekTodayStr() + '-' + (liveSnapshot && liveSnapshot.ok ? liveBpm(liveSnapshot.rpm) : 128);
  if (mode === 'race') return 'RACE-' + squeekTodayStr() + '-' + (liveSnapshot && liveSnapshot.ok ? liveBpm(liveSnapshot.rpm) : 128); // v29: race replays like a live song
  if (mode === 'boss') return 'BOSS-' + weeklyKey(); // v29: weekly boss seed
  if (mode === 'lullaby') return 'LULLABY-' + squeekTodayStr(); // v42.5: satu lagu malam per hari Squeek
  if (mode === 'challenge' && challengeCode) return challengeCode;
  return 'FREE-' + Math.floor(Math.random() * 1e9);
}
function walletKey(w) { return (w || 'GUEST').toLowerCase(); }
function loadJSON(k, fb) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v === null ? fb : v; } catch { return fb; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

// --- v32 FIX: MSG / RLBL / I18N live at the TOP of the file. initGL() runs at
// load (line ~240) and now calls msgf(), so these consts must be initialized
// before it — leaving them mid-file threw 'Cannot access MSG before
// initialization', killed the whole script, and the music splash never closed.
// --- v30 TOTAL: dynamic game messages, EN + ID ---
// Static menu labels stay in I18N (below); the messages the game speaks
// (say() calls, result rows, XP line) live here so both languages are real.
// msgf() fills {placeholders}. The test asserts every key exists in both langs.
const MSG = {
  en: {
    wheelCallSet: 'WHEEL CALL SET: {label} FOR ROUND {round} — GOOD LUCK.',
    predNoData: 'ROUND {round}: NO DATA — THE PAGE WAS CLOSED, NO XP LOST.',
    predDone: 'ROUND {round}: {actual} (AVG {avg} RPM) — YOUR CALL {pick} WAS {result}.',
    predCorrect: 'CORRECT ✓ +40 XP',
    predWrong: 'WRONG',
    achUnlock: '🏆 ACHIEVEMENT UNLOCKED: ',
    achXp: ' (+25 XP EACH)',
    bossFight: 'WEEKLY BOSS: {name} — HARD MODE. GOOD LUCK.',
    practiceOn: 'PRACTICE ON — 60% TEMPO, NO XP, NO STREAK.',
    practiceOff: 'PRACTICE OFF.',
    modeLive: 'LIVE ACTIVE — THE SONG TEMPO FOLLOWS THE REAL HAMSTER WHEEL. 70+ RPM = ZOOMIES ×2 SCORE.',
    modeRace: 'RACE ACTIVE — BEAT THE LIVE HAMSTER. YOUR HITS MOVE YOU FORWARD, THE WHEEL MOVES SQUEEKTOSHI.',
    modeDaily: 'DAILY ACTIVE — {date} • TODAY: {genre} / {diff} — SAME SONG FOR EVERYONE.',
    modeFree: 'FREE MODE — YOUR OWN ANTHEM, ANY GENRE, ANY DIFFICULTY.',
    cardTitleId: 'SQUEEK CITIZEN // ID CARD', cardTitleResult: 'SQUEEK // RESULT CARD',
    calibDone: 'CALIBRATION DONE — OFFSET {off} ms.',
    calibFail: 'CALIBRATION FAILED — NOT ENOUGH GOOD TAPS.',
    calibNeedSound: 'UNMUTE FIRST — CALIBRATION NEEDS SOUND.',
    calibNoAudio: 'AUDIO NOT RUNNING — TAP THE SCREEN ONCE, THEN CALIBRATE.',
    calibAudioFail: 'AUDIO FAILED — CALIBRATION NEEDS SOUND.',
    obsCopied: 'OBS OVERLAY LINK COPIED — ADD IT AS A BROWSER SOURCE IN OBS (1920×1080, TRANSPARENT).',
    obsBlocked: 'CLIPBOARD BLOCKED — THE LINK IS: {url}',
    diaryFirst: 'PLAY A SONG FIRST — THE DIARY IS EMPTY.',
    diarySaved: 'NOTE SAVED TO YOUR LAST SONG.',
    cardFail: 'RESULT CARD FAILED — PLAY A SONG FIRST.',
    cardReady: 'RESULT CARD READY — DOWNLOAD OR SHARE IT BELOW.',
    cardWallet: 'VALID WALLET REQUIRED FOR ID CARD.',
    cardFetching: 'FETCHING ON-CHAIN DATA...',
    cardDone: 'ID CARD GENERATED.',
    levelUp: ' — LEVEL UP! ',
    unlocked: 'UNLOCKED: ',
    avatarEvolved: 'AVATAR EVOLVED',
    streakDays: ' • STREAK {n} DAYS',
    freezeUsed: ' (STREAK FREEZE USED)',
    practiceRun: 'PRACTICE RUN — NO XP • NO STREAK • NOT RECORDED.',
    newHigh: 'NEW HIGH SCORE!',
    bestIs: 'BEST: {score} ({grade})',
    rivalBack: 'YOU ANSWERED A DUEL — SEND YOUR OWN DUEL LINK BACK (BUTTON ABOVE) SO THE CHALLENGER SEES YOUR SCORE IN THEIR LEAGUE.',
    bossLine: '{name} • {week} • {genre} / HARD • FINISH THE SONG TO DEFEAT IT (+100 XP).',
    pastBosses: 'PAST BOSSES: ',
    duelNoSong: 'PLAY ONE SONG FIRST, THEN DUEL CAN BE SHARED.',
    duelCopied: 'DUEL LINK COPIED — SEND IT TO A FRIEND, THEY PLAY THE EXACT SAME SONG.',
    duelBlocked: 'CLIPBOARD BLOCKED — THE LINK IS IN THE BOX BELOW, COPY IT MANUALLY.',
    gameRunning: 'GAME ALREADY RUNNING.',
    anthemPrefix: '>> ANTHEM: ', anthemBest: ' // BEST: {score}',
    anthemDaily: ' // DAILY {date} • {genre}/{diff}', anthemLive: ' // LIVE {live}', anthemRace: ' // RACE VS SQUEEKTOSHI {live}',
    anthemBoss: ' // WEEKLY BOSS {week}', anthemDuel: ' // DUEL {code}{lanes}{mirror}',
    anthemLiveOk: 'RPM {rpm} • {bpm} BPM', anthemLiveOff: 'WHEEL OFFLINE • 128 BPM FALLBACK',
    invalidAddr: 'INVALID ADDRESS', invalidWallet: 'INVALID WALLET ADDRESS.', audioFail: 'AUDIO FAILED: {err}',
    fetchingWheel: 'FETCHING LIVE WHEEL...', wheelOffline: 'WHEEL OFFLINE — LIVE MODE USES 128 BPM FALLBACK (NOT LIVE DATA).',
    duelUnlock: 'DUEL UNLOCK: {mods}— TRY IT IN THIS SONG.', downloadFail: 'DOWNLOAD FAILED: empty canvas.',
    noWallet: 'NO WALLET FOUND IN THIS BROWSER — TYPE YOUR 0x ADDRESS MANUALLY.',
    walletInvalid: 'WALLET RETURNED NO VALID ADDRESS — TYPE YOUR 0x ADDRESS MANUALLY.',
    walletConnected: 'WALLET CONNECTED: {addr} — ADDRESS ONLY, NO SIGNATURE REQUESTED.',
    connRejected: 'CONNECTION REJECTED — TYPE YOUR 0x ADDRESS MANUALLY.', connFail: 'CONNECT FAILED: {err}', wcLoadFail: 'WALLETCONNECT FAILED TO LOAD — CHECK YOUR CONNECTION AND RETRY.', wcRejected: 'WALLETCONNECT CANCELLED — NOTHING WAS CONNECTED.', wcRestoreNoteTpl: 'WC RESTORE FAILED: {reason} — TAP [ CONNECT WALLET ] TO RECONNECT.', wcRestoring: 'RECONNECTING TO YOUR WALLET…', wcChainFail: 'COULD NOT SWITCH TO SEPOLIA — SWITCH MANUALLY IN YOUR WALLET.',
    walletSwitched: 'WALLET SWITCHED TO {addr}.', walletDisconnected: 'WALLET DISCONNECTED.', walletConnectedTpl: 'WALLET CONNECTED: {addr} • Transactions use THIS address (OKX / WalletConnect / in-app wallet).', calibStart: 'CALIBRATING… TAP ON EACH OF THE 8 BEATS.',
    qltyEco: ' — WebGL off, static gradient background.', qltyUltra: ' — WebGL / moving grid.',
    voidLock: '🔒 VOID GENRE UNLOCKS AT LV5 — PLAY MORE SONGS TO EARN XP.',
    lanesLock: '🔒 4 LANES UNLOCKS AT LV6 — PLAY MORE SONGS TO EARN XP.',
    mirrorLock: '🔒 MIRROR MODE UNLOCKS AT LV7 — PLAY MORE SONGS TO EARN XP.',
    musicIntro: 'MUSIC: {label} • TAP MUTE TO SILENCE.', introOn: 'INTRO: ON — {label} • TAP MUTE TO SILENCE.',
    audioTap: 'AUDIO: {state} — TAP AGAIN FOR MUSIC.', musicTapFor: '— TAP FOR {other}',
    gameAudioTpl: 'AUDIO: {run} • {bpm} BPM • AC: {state}{practice}', audioRunning: 'RUNNING', audioPaused: 'PAUSED', practiceTag2: ' • PRACTICE (NO XP)',
    pauseBtn: '[ PAUSE ]', resumeBtn: '[ RESUME ]',
    kbd3: 'KEYBOARD: ← ↓ → / A S D  •  P = PAUSE  •  M = MUTE', kbd4: 'KEYBOARD: ← ↓ ↑ → / A S D F  •  P = PAUSE  •  M = MUTE',
    streakTpl: 'STREAK: {n} DAYS — play Daily every day to keep the flame alive.',
    dailyTitleTpl: 'DAILY ANTHEM — {date}',
    dailyInfoTpl: "Today's song is the same for everyone: {genre} / {diff} — {date}. Play today, come back tomorrow — the song changes.",
    freezeTpl: '❄️ STREAK FREEZE ×{n} — MISS ONE DAY AND YOUR STREAK SURVIVES (EARN MORE BY CLEARING ALL 3 MISSIONS).',
    masteryEmpty: 'No games recorded in this browser yet.',
    masteryTpl: 'GAMES: {n} • BEST: {best} • AVG ACCURACY: {acc}%{avgOff}{bestPer}',
    masteryAvgOff: ' • AVG OFFSET: {off} ms', masteryBestPer: ' • BEST PER GENRE/DIFF: {list}',
    offsetDefault: ' (DEFAULT — TAP AUTO-CALIBRATE IF YOUR HITS FEEL EARLY/LATE)',
    latTpl: 'LATENCY: {off} ms',
    calibListen: 'LISTEN… THE FIRST BEAT COMES IN 1 SECOND — TAP THE BUTTON ON EACH BEAT.',
    calibTapN: 'TAP {n}/8 — {more}', calibKeep: 'KEEP GOING, TAP ON EACH BEAT.', calibCalc: 'DONE — CALCULATING…',
    calibFew: 'ONLY {n} GOOD TAPS — NEED AT LEAST 4. TRY AGAIN, TAP RIGHT ON THE BEAT.',
    calibDoneTpl: 'CALIBRATED: OFFSET {off} ms (MEDIAN OF {n} TAPS, AVG {avg} ms — {verdict}).',
    calibLate: 'YOU TAP LATE ON AVERAGE', calibEarly: 'YOU TAP EARLY ON AVERAGE', calibSpot: 'YOUR TIMING IS SPOT ON',
    roundTpl: 'ROUND {cur} • NOW: {cls}{avg} • NEXT ROUND IN {cd}', roundAvgPart: ' (AVG {avg} RPM)',
    petWaiting: '🐹 SQUEEKTOSHI IS WAITING…', petOffline: '❓ WHEEL OFFLINE — SQUEEKTOSHI IS HIDING.',
    petRunning: '🐹 SQUEEKTOSHI IS RUNNING — {rpm} RPM{zoom}', petZoom: ' • ZOOMIES!', petNapping: '😴 SQUEEKTOSHI IS NAPPING (0 RPM) — EASY WIN?',
    raceLastTpl: 'LAST RACE: YOU {you} m vs SQUEEKTOSHI {opp} m — {result}', raceLastWin: 'YOU WON ✓', raceLastLose: 'SQUEEKTOSHI WON',
    raceLastNone: 'NO RACE YET — BEAT THE HAMSTER.',
    awayEmpty: 'Welcome back — play a song and your diary starts here.',
    awayTpl: 'LAST VISIT {date} • STREAK {n} DAYS • BEST {best} • NEW ACHIEVEMENTS SINCE THEN: {new}.{away}',
    awayRoundsTpl: ' • WHILE YOU WERE AWAY: {list}', awayNoRounds: ' • NO RECORDED WHEEL ROUNDS WHILE YOU WERE AWAY.',
    awayRoundItem: '{time} {label} (AVG {avg} RPM)', awayNewNone: 'NONE',
    liveSumOff: 'WHEEL OFFLINE — NEXT SONG USES 128 BPM FALLBACK (NOT LIVE DATA)',
    liveSumTpl: 'RPM {rpm} • {dist} KM • {daynight} • SONG {bpm} BPM{zoom}',
    liveSumDay: 'DAY — HAMSTER RUNNING', liveSumNight: 'NIGHT — HAMSTER RESTING', liveSumZoom: ' • ZOOMIES ×2',
    liveHudTpl: 'LIVE • RPM {rpm} • {dist} KM • {daynight}{zoom}',
    liveHudDay: '☀️ DAY', liveHudNight: '🌙 NIGHT', liveHudZoom: ' • ZOOMIES ×2 SCORE',
    liveHudOff: 'LIVE: OFFLINE — FALLBACK 128 BPM (NOT LIVE DATA)',
    glOk: 'WEBGL: OK • QLTY: {q} • MOVING 3D BACKGROUND', glFail: 'WEBGL: FAILED — GRADIENT BACKGROUND + CSS GRID (STILL MOVING) • QLTY: {q}',
    glStatusTpl: 'WEBGL: {webgl} • QLTY: {q}{tail}', glTailEco: ' • BACKGROUND: STATIC GRADIENT', glTailUltra: ' • BACKGROUND: 3D / MOVING GRID',
    leagueWin: 'WIN ✓', leagueLose: 'LOSE',
    lbLoading: 'LOADING LEADERBOARD…', lbOffline: 'LEADERBOARD OFFLINE — CHECK YOUR CONNECTION.', lbEmpty: 'NO SCORES YET — BE THE FIRST.', lbSent: 'SCORE SENT — NEW BEST!', lbKept: 'SCORE SENT — YOUR BEST STANDS.', lbNeedWallet: 'CONNECT A WALLET FIRST TO SUBMIT YOUR SCORE.', lbNoScore: 'NO SCORE TO SUBMIT.', lbPractice: 'PRACTICE RUNS DO NOT COUNT.', lbYourRank: 'YOUR RANK #{rank} OF {total}', lbVerifying: 'WAITING FOR VERIFICATION…', lbVerified: 'VERIFIED ✓', lbVerifyRejected: 'VERIFICATION REJECTED — SCORE NOT ON THE BOARD.', lbVerifyRejectedReason: 'VERIFICATION REJECTED — {reason}. PLAY AGAIN AND RESUBMIT.', lbVerifyUnknown: 'VERIFICATION STATUS UNKNOWN — CHECK THE LEAGUE TAB.',
    shopNeedWallet: 'CONNECT A WALLET FIRST TO USE THE SHOP.', shopOffline: 'SHOP OFFLINE — CHECK YOUR CONNECTION.', shopBought: 'BOUGHT {item} ✓', shopPulled: 'CAPSULE: {item} ({rarity}) ✓', shopDup: 'CAPSULE: {item} (DUPLICATE) → +{n} 🧀', shopEquipped: 'EQUIPPED {item} ✓', shopUnequipped: 'UNEQUIPPED {item} ✓', shopNoCheese: 'NOT ENOUGH 🧀 — PLAY A VERIFIED SONG TO EARN MORE.', shopOwned: 'ALREADY OWNED.', shopCapsuleOnly: 'CAPSULE ONLY — PULL TO WIN IT.', shopBalanceTpl: '🧀 BALANCE: {n}', shopBuyTpl: '[ BUY — {price} 🧀 ]', sqkPoolTpl: '🏆 PRIZE POOL: {pool} SQK', sqkSeasonTpl: 'SEASON ENDS: {date}', sqkSweepTpl: 'After the season ends, the remaining pool is swept to the owner 7 days later ({date}).', sqkSwept: 'PRIZE POOL SWEPT — SEASON OVER.', sqkBalanceTpl: 'SQK BALANCE: {n}', sqkBuyTpl: '[ BUY — {price} SQK ]', sqkOwnedTpl: 'OWNED ×{n}', sqkBought: 'BOUGHT {item} ✓', sqkEquipBtn: '[ EQUIP ]', sqkEquippedTpl: 'EQUIPPED ✓', sqkEquipped: 'EQUIPPED: {item} ✓ — YOUR NEXT SONG USES THE NEW SKIN.', sqkUnequipBtn: '[ UNEQUIP ]', sqkUnequipped: 'UNEQUIPPED: {item} ✓ — BACK TO DEFAULT.', sqkNotOwned: 'YOU DO NOT OWN {item} YET — BUY IT FIRST.', sqkEquipFail: 'CANNOT EQUIP THIS ITEM.', sqkNeedWallet: 'CONNECT A WALLET FIRST TO USE THE SQK SHOP.', sqkNoProvider: 'NO WALLET CONNECTED — TAP [ CONNECT WALLET ] TO CONNECT (WORKS WITH OKX, METAMASK AND OTHER WALLETS).', sqkWrongChain: 'SWITCH YOUR WALLET TO SEPOLIA TO BUY.', sqkNoSqk: 'NOT ENOUGH SQK.', sqkPermitRejected: 'SIGNATURE REJECTED — NOTHING WAS BOUGHT.', sqkTxRejected: 'TRANSACTION REJECTED — NOTHING WAS BOUGHT.', sqkWaiting: 'WAITING FOR CONFIRMATION…', sqkTxFail: 'TRANSACTION FAILED ON-CHAIN.', sqkShopOffline: 'SQK SHOP OFFLINE — CHECK YOUR CONNECTION.', sqkPityTpl: 'PITY: {n} / 20', sqkCommitBtn: '[ COMMIT CAPSULE — 2 SQK ]', sqkResolveBtn: '[ RESOLVE CAPSULE ]', sqkCommitted: 'CAPSULE COMMITTED (PULL #{pull}, ROUND {round}) — RESOLVE AFTER ROUND {round} SETTLES.', sqkResolved: 'CAPSULE: {item} ({rarity}) ✓', sqkDupKeju: 'CAPSULE: {item} ({rarity}, DUPLICATE) → +{n} 🧀', sqkRoundUnknown: 'CURRENT ROUND UNKNOWN — CHECK YOUR CONNECTION.', sqkNotSettled: 'ROUND {round} HAS NOT SETTLED YET — SETTLEMENTS ONLY HAPPEN WHEN THE HAMSTER RUNS (DAYTIME). TRY AGAIN AFTER THE MORNING RUN.', sqkNoPending: 'NO PENDING CAPSULE — COMMIT ONE FIRST.', sqkResolveFail: 'RESOLVE FAILED — CHECK THE WORKER / TRY AGAIN.', sqkRateLimited: 'TOO MANY REQUESTS — TRY AGAIN AT {time}.', lbRateLimited: 'TOO MANY SUBMITS — TRY AGAIN AT {time}.', lbRateLimitedNoTime: 'TOO MANY SUBMITS — TRY AGAIN IN A FEW MINUTES.', lbSlow: 'SLOW CONNECTION — TRY AGAIN.', lbRetrying: 'SLOW CONNECTION — RETRYING…', lbLullaby: 'LULLABY SCORES DO NOT COUNT — SWEET DREAMS.', ghostNapping: '😴 SQUEEKTOSHI IS ASLEEP — RACING HIS GHOST (SIMULATION).', ghostOffline: '❓ WHEEL OFFLINE — RACING A GHOST (SIMULATION).', ghostPaceTpl: 'GHOST PACE: {pace} m/s — REAL 7-DAY DAYTIME AVERAGE (SIMULATION, NOT LIVE DATA).', ghostWokeUp: '🐹 SQUEEKTOSHI WOKE UP — BACK TO THE LIVE HAMSTER!', dreamPlanted: 'DREAM SEED PLANTED 🌱 — PLAY A LULLABY TO WATER IT, HARVEST IN THE MORNING.', dreamAlready: 'A DREAM SEED IS ALREADY GROWING TONIGHT.', dreamNotNight: 'DREAM SEEDS ARE PLANTED AT NIGHT (19:00–06:00 WIB) OR WHILE THE HAMSTER SLEEPS.', dreamWatered: 'DREAM SEED WATERED 💧 — STAGE {stage}/2.', dreamNoSeed: 'NO DREAM SEED TO HARVEST — PLANT ONE TONIGHT.', dreamNotReady: 'THE SEED NEEDS WATER FIRST — PLAY A LULLABY TONIGHT.', dreamHarvested: 'HARVESTED +{n} 🧀 — SWEET DREAMS PAID OFF.', dreamNeedWallet: 'CONNECT OR TYPE A WALLET TO HARVEST.', dreamLineNone: 'No seed planted — plant one tonight (19:00–06:00) or while the hamster sleeps, then water it with a Lullaby song.', dreamLineDay: 'Dream Seeds grow at night (19:00–06:00) or while the hamster sleeps. The hamster is awake right now.', dreamLineStage: 'Seed planted {night} — stage {stage}/2. Play a Lullaby song to water it (2 = ready to harvest).', dreamHarvestFail: 'HARVEST FAILED — CHECK THE SERVER / TRY AGAIN.', modeLullaby: 'LULLABY — SLOW NIGHT SONG (60% TEMPO). SCORES ARE NOT SUBMITTED; +50 XP AND IT WATERS YOUR DREAM SEED.', lullabyInfo: 'A slow 60 BPM song for the night, while the hamster sleeps. No board submit — this is a lullaby, not a race. Finish it for +50 XP and to water your Dream Seed.', lullabyInfoAwake: 'The hamster is AWAKE right now — Lullaby is a slow night song (60% tempo). Scores are NOT submitted; +50 XP and it waters your Dream Seed.', sqkShopSoon: 'SQK SHOP COMING SOON — the shop contract is not deployed yet. SQK shopping opens after the deploy.', leagueWeeklyLoading: 'LOADING WEEKLY LEAGUE…', leagueWeeklyOffline: 'WEEKLY LEAGUE OFFLINE — CHECK YOUR CONNECTION.', leagueWeeklyYourRank: 'YOUR WEEK RANK #{rank}',
    leagueRowTpl: 'YOU {mine} vs {rival} {theirs} — {result} • {date}',
    roundHistRowTpl: '{key} — {label} (AVG {avg} RPM, {n} SAMPLES, ~{work} WORK, {blocks} BLOCKS) — {state}',
    chainUnknown: 'CHAIN STATE UNKNOWN [{status}] — SHOWING NOTHING AS ZERO.',
    chainBlockTpl: 'SQUEEK BLOCK #{height} — {pct}% TO THE NEXT BLOCK',
    chainDiffTpl: 'DIFFICULTY {diff} WORK / 1000 BLOCKS • SETTLED THROUGH ROUND {settled}',
    chainEcoTpl: 'SQK ISSUED {issued} • STAKED {staked} • SQUEEKS BURNED {burned} / 9,999',
    roundStateSettled: 'SETTLED ✓',
    roundStateSettling: 'SETTLING… (UNKNOWN, NOT ZERO)',
    roundStateUnknown: 'FRONTIER UNKNOWN',
    unlockTitleTpl: 'UNLOCKS — LV {lv}',
    unlockVoid: 'NEW GENRE: VOID', unlockLanes: '4 LANES MODE', unlockMirror: 'MIRROR MODE', unlockGold: 'GOLD AVATAR',
    missionAcc: 'Accuracy >= 95%', missionCombo: 'Combo >= 50', missionMiss0: '0 Miss in one song',
    missionScore: 'Score >= 5000', missionPerfect: 'Perfect >= 30', missionHard: 'Finish one song on HARD',
    achFirst: 'Finish 1 song', achPerfect: '30+ PERFECT in one song', achCombo: 'Max combo 100+',
    achZoomies: 'Finish a live/race song with ZOOMIES', achRacewin: 'Win a race vs Squeektoshi',
    achOracle: 'A correct Wheel Call', achStreak: '7-day daily streak', achGold: 'Reach LV8',
    achVoid: 'Finish a VOID song', achMirror: 'Finish a Mirror song',
    achLegacy8: 'LV8 under the old XP curve (before v38) — a one-time legacy badge, never earnable again',
    walletForgotten: 'SAVED WALLET FORGOTTEN — BACK TO GUEST.',
    ovRpmOff: 'RPM — (WHEEL OFFLINE)', ovDistOff: 'DIST — KM',
    ovZoomOn: '🔥 ZOOMIES ×2 — SCORE DOUBLED', ovZoomJog: '🏃 JOG — NORMAL SCORE', ovZoomNap: '😴 NAP — NORMAL SCORE', ovZoomOff: 'ZOOMIES —',
    ovPetRun: '🐹 SQUEEKTOSHI RUNNING — {rpm} RPM', ovPetNap: '😴 SQUEEKTOSHI NAPPING (0 RPM)', ovPetOff: '❓ WHEEL OFFLINE — SQUEEKTOSHI HIDING',
    ovSong: 'SONG {key} {scale} • {bpm} BPM', ovSongOff: 'SONG —',
    ovRoundTpl: 'ROUND {cur} • {cls} • NEXT IN {cd}',
    practiceOnBtn: 'PRACTICE: ON (60% TEMPO, NO XP)', practiceOffBtn: 'PRACTICE: OFF',
    mirrorOn: 'ON', mirrorOff: 'OFF',
  },
  id: {
    wheelCallSet: 'TEBAKAN DIPASANG: {label} UNTUK RONDE {round} — SEMOGA BERUNTUNG.',
    predNoData: 'RONDE {round}: TIDAK ADA DATA — HALAMAN DITUTUP, TIDAK ADA XP HILANG.',
    predDone: 'RONDE {round}: {actual} (RATA-RATA {avg} RPM) — TEBAKANMU {pick} {result}.',
    predCorrect: 'BENAR ✓ +40 XP',
    predWrong: 'SALAH',
    achUnlock: '🏆 PENCAPAIAN TERBUKA: ',
    achXp: ' (+25 XP MASING-MASING)',
    bossFight: 'BOSS MINGGUAN: {name} — MODE SULIT. SEMOGA BERUNTUNG.',
    practiceOn: 'LATIHAN AKTIF — TEMPO 60%, TANPA XP, TANPA STREAK.',
    practiceOff: 'LATIHAN MATI.',
    modeLive: 'MODE LIVE AKTIF — TEMPO LAGU MENGIKUTI RODA HAMSTER ASLI. 70+ RPM = ZOOMIES ×2 SKOR.',
    modeRace: 'MODE BALAPAN AKTIF — KALAHKAN HAMSTER ASLI. PUKULANMU MEMAJUKANMU, RODA MENGGERAKKAN SQUEEKTOSHI.',
    modeDaily: 'LAGU HARIAN AKTIF — {date} • HARI INI: {genre} / {diff} — LAGU YANG SAMA UNTUK SEMUA ORANG.',
    modeFree: 'MODE FREE — LAGUMU SENDIRI, GENRE DAN KESULITAN BEBAS.',
    cardTitleId: 'SQUEEK CITIZEN // KARTU ID', cardTitleResult: 'SQUEEK // KARTU HASIL',
    calibDone: 'KALIBRASI SELESAI — OFFSET {off} ms.',
    calibFail: 'KALIBRASI GAGAL — KETUKAN BAGUS KURANG.',
    calibNeedSound: 'NYALAKAN SUARA DULU — KALIBRASI BUTUH SUARA.',
    calibNoAudio: 'AUDIO BELUM JALAN — KETUK LAYAR SEKALI, LALU KALIBRASI.',
    calibAudioFail: 'AUDIO GAGAL — KALIBRASI BUTUH SUARA.',
    obsCopied: 'TAUTAN OVERLAY OBS DISALIN — TAMBAHKAN SEBAGAI BROWSER SOURCE DI OBS (1920×1080, TRANSPARAN).',
    obsBlocked: 'CLIPBOARD DIBLOKIR — TAUTANNYA: {url}',
    diaryFirst: 'MAIN LAGU DULU — DIARINYA MASIH KOSONG.',
    diarySaved: 'CATATAN TERSIMPAN DI LAGU TERAKHIRMU.',
    cardFail: 'KARTU HASIL GAGAL — MAIN LAGU DULU.',
    cardReady: 'KARTU HASIL SIAP — UNDUH ATAU BAGIKAN DI BAWAH.',
    cardWallet: 'BUTUH WALLET YANG VALID UNTUK ID CARD.',
    cardFetching: 'MENGAMBIL DATA ON-CHAIN...',
    cardDone: 'ID CARD DIBUAT.',
    levelUp: ' — NAIK LEVEL! ',
    unlocked: 'TERBUKA: ',
    avatarEvolved: 'AVATAR BEREVOLUSI',
    streakDays: ' • STREAK {n} HARI',
    freezeUsed: ' (STREAK FREEZE TERPAKAI)',
    practiceRun: 'LATIHAN — TANPA XP • TANPA STREAK • TIDAK DICATAT.',
    newHigh: 'SKOR TERTINGGI BARU!',
    bestIs: 'TERBAIK: {score} ({grade})',
    rivalBack: 'KAMU MENJAWAB DUEL — KIRIM DUEL LINK-MU KEMBALI (TOMBOL DI ATAS) SUPAYA PENANTANG MELIHAT SKORMU DI LIGANYA.',
    bossLine: '{name} • {week} • {genre} / SULIT • SELESAIKAN LAGUNYA UNTUK MENGALAHKAN BOSS (+100 XP).',
    pastBosses: 'BOSS SEBELUMNYA: ',
    duelNoSong: 'MAIN SATU LAGU DULU, BARU BISA BAGIKAN DUEL.',
    duelCopied: 'DUEL LINK DISALIN — KIRIM KE TEMAN, MEREKA MEMAINKAN LAGU YANG SAMA PERSIS.',
    duelBlocked: 'CLIPBOARD DIBLOKIR — TAUTAN ADA DI KOTAK DI BAWAH, SALIN MANUAL.',
    gameRunning: 'GAME SUDAH BERJALAN.',
    anthemPrefix: '>> LAGU: ', anthemBest: ' // TERBAIK: {score}',
    anthemDaily: ' // HARIAN {date} • {genre}/{diff}', anthemLive: ' // LIVE {live}', anthemRace: ' // BALAPAN VS SQUEEKTOSHI {live}',
    anthemBoss: ' // BOSS MINGGUAN {week}', anthemDuel: ' // DUEL {code}{lanes}{mirror}',
    anthemLiveOk: 'RPM {rpm} • {bpm} BPM', anthemLiveOff: 'RODA OFFLINE • 128 BPM CADANGAN',
    invalidAddr: 'ALAMAT TIDAK VALID', invalidWallet: 'ALAMAT WALLET TIDAK VALID.', audioFail: 'AUDIO GAGAL: {err}',
    fetchingWheel: 'MENGAMBIL DATA RODA LIVE...', wheelOffline: 'RODA OFFLINE — MODE LIVE MEMAKAI 128 BPM CADANGAN (BUKAN DATA LIVE).',
    duelUnlock: 'DUEL TERBUKA: {mods}— COBA DI LAGU INI.', downloadFail: 'UNDUH GAGAL: kanvas kosong.',
    noWallet: 'TIDAK ADA WALLET DI BROWSER INI — KETIK ALAMAT 0x SECARA MANUAL.',
    walletInvalid: 'WALLET TIDAK MENGEMBALIKAN ALAMAT VALID — KETIK ALAMAT 0x SECARA MANUAL.',
    walletConnected: 'WALLET TERHUBUNG: {addr} — HANYA ALAMAT, TANPA SIGNATURE.',
    connRejected: 'KONEKSI DITOLAK — KETIK ALAMAT 0x SECARA MANUAL.', connFail: 'KONEKSI GAGAL: {err}', wcLoadFail: 'WALLETCONNECT GAGAL DIMUAT — PERIKSA KONEKSIMU DAN COBA LAGI.', wcRejected: 'WALLETCONNECT DIBATALKAN — TIDAK ADA YANG TERHUBUNG.', wcRestoreNoteTpl: 'WC RESTORE GAGAL: {reason} — KETUK [ CONNECT WALLET ] UNTUK MENGHUBUNGKAN LAGI.', wcRestoring: 'MENGHUBUNGKAN KEMBALI KE WALLET…', wcChainFail: 'TIDAK BISA PINDAH KE SEPOLIA — PINDAH MANUAL DI WALLETMU.',
    walletSwitched: 'WALLET BERGANTI KE {addr}.', walletDisconnected: 'WALLET TERPUTUS.', walletConnectedTpl: 'WALLET TERHUBUNG: {addr} • Transaksi memakai alamat INI (OKX / WalletConnect / wallet dalam aplikasi).', calibStart: 'MENGALIBRASI… KETUK DI SETIAP DARI 8 KETUKAN.',
    qltyEco: ' — WebGL mati, latar gradien statis.', qltyUltra: ' — WebGL / grid bergerak.',
    voidLock: '🔒 GENRE VOID TERBUKA DI LV5 — MAIN LAGU LAGI UNTUK XP.',
    lanesLock: '🔒 4 JALUR TERBUKA DI LV6 — MAIN LAGU LAGI UNTUK XP.',
    mirrorLock: '🔒 MODE CERMIN TERBUKA DI LV7 — MAIN LAGU LAGI UNTUK XP.',
    musicIntro: 'MUSIK: {label} • KETUK MUTE UNTUK MEMBISUKAN.', introOn: 'INTRO: AKTIF — {label} • KETUK MUTE UNTUK MEMBISUKAN.',
    audioTap: 'AUDIO: {state} — KETUK LAGI UNTUK MUSIK.', musicTapFor: '— KETUK UNTUK {other}',
    gameAudioTpl: 'AUDIO: {run} • {bpm} BPM • AC: {state}{practice}', audioRunning: 'BERJALAN', audioPaused: 'DIJEDA', practiceTag2: ' • LATIHAN (TANPA XP)',
    pauseBtn: '[ JEDA ]', resumeBtn: '[ LANJUT ]',
    kbd3: 'KEYBOARD: ← ↓ → / A S D  •  P = JEDA  •  M = BISU', kbd4: 'KEYBOARD: ← ↓ ↑ → / A S D F  •  P = JEDA  •  M = BISU',
    streakTpl: 'STREAK: {n} HARI — main Daily setiap hari supaya apinya tetap menyala.',
    dailyTitleTpl: 'LAGU HARIAN — {date}',
    dailyInfoTpl: 'Lagu hari ini sama untuk semua orang: {genre} / {diff} — {date}. Main hari ini, kembali besok — lagunya berganti.',
    freezeTpl: '❄️ STREAK FREEZE ×{n} — LEWAT SATU HARI DAN STREAK-MU TETAP AMAN (DAPATKAN LAGI DENGAN MENYELESAIKAN KETIGA MISI).',
    masteryEmpty: 'Belum ada game yang tercatat di browser ini.',
    masteryTpl: 'GAME: {n} • TERBAIK: {best} • AKURASI RATA-RATA: {acc}%{avgOff}{bestPer}',
    masteryAvgOff: ' • OFFSET RATA-RATA: {off} ms', masteryBestPer: ' • TERBAIK PER GENRE/DIFF: {list}',
    offsetDefault: ' (BAWAAN — KETUK KALIBRASI OTOMATIS JIKA PUKULANMU TERASA TERLALU AWAL/TERLAMBAT)',
    latTpl: 'LATENSI: {off} ms',
    calibListen: 'DENGARKAN… KETUKAN PERTAMA DATANG DALAM 1 DETIK — KETUK TOMBOLNYA DI SETIAP KETUKAN.',
    calibTapN: 'KETUK {n}/8 — {more}', calibKeep: 'TERUSKAN, KETUK DI SETIAP KETUKAN.', calibCalc: 'SELESAI — MENGHITUNG…',
    calibFew: 'HANYA {n} KETUKAN BAGUS — BUTUH MINIMAL 4. COBA LAGI, KETUK TEPAT DI KETUKAN.',
    calibDoneTpl: 'TERKALIBRASI: OFFSET {off} ms (MEDIAN DARI {n} KETUKAN, RATA-RATA {avg} ms — {verdict}).',
    calibLate: 'KAMU RATA-RATA KETUK TERLAMBAT', calibEarly: 'KAMU RATA-RATA KETUK TERLALU AWAL', calibSpot: 'TIMINGMU TEPAT SEKALI',
    roundTpl: 'RONDE {cur} • SEKARANG: {cls}{avg} • RONDE BERIKUTNYA DALAM {cd}', roundAvgPart: ' (RATA-RATA {avg} RPM)',
    petWaiting: '🐹 SQUEEKTOSHI MENUNGGU…', petOffline: '❓ RODA OFFLINE — SQUEEKTOSHI SEMBUNYI.',
    petRunning: '🐹 SQUEEKTOSHI BERLARI — {rpm} RPM{zoom}', petZoom: ' • ZOOMIES!', petNapping: '😴 SQUEEKTOSHI TIDUR (0 RPM) — MENANG MUDAH?',
    raceLastTpl: 'BALAPAN TERAKHIR: KAMU {you} m vs SQUEEKTOSHI {opp} m — {result}', raceLastWin: 'KAMU MENANG ✓', raceLastLose: 'SQUEEKTOSHI MENANG',
    raceLastNone: 'BELUM ADA BALAPAN — KALAHKAN HAMSTERNYA.',
    awayEmpty: 'Selamat datang kembali — main satu lagu dan diarimu dimulai di sini.',
    awayTpl: 'KUNJUNGAN TERAKHIR {date} • STREAK {n} HARI • TERBAIK {best} • PENCAPAIAN BARU SEJAK SAAT ITU: {new}.{away}',
    awayRoundsTpl: ' • SELAMA KAMU PERGI: {list}', awayNoRounds: ' • TIDAK ADA RONDE RODA TERCATAT SELAMA KAMU PERGI.',
    awayRoundItem: '{time} {label} (RATA-RATA {avg} RPM)', awayNewNone: 'TIDAK ADA',
    liveSumOff: 'RODA OFFLINE — LAGU BERIKUTNYA MEMAKAI 128 BPM CADANGAN (BUKAN DATA LIVE)',
    liveSumTpl: 'RPM {rpm} • {dist} KM • {daynight} • LAGU {bpm} BPM{zoom}',
    liveSumDay: 'SIANG — HAMSTER BERLARI', liveSumNight: 'MALAM — HAMSTER ISTIRAHAT', liveSumZoom: ' • ZOOMIES ×2',
    liveHudTpl: 'LIVE • RPM {rpm} • {dist} KM • {daynight}{zoom}',
    liveHudDay: '☀️ SIANG', liveHudNight: '🌙 MALAM', liveHudZoom: ' • ZOOMIES ×2 SKOR',
    liveHudOff: 'LIVE: OFFLINE — CADANGAN 128 BPM (BUKAN DATA LIVE)',
    glOk: 'WEBGL: OK • KUALITAS: {q} • LATAR 3D BERGERAK', glFail: 'WEBGL: GAGAL — LATAR GRADIEN + GRID CSS (TETAP BERGERAK) • KUALITAS: {q}',
    glStatusTpl: 'WEBGL: {webgl} • KUALITAS: {q}{tail}', glTailEco: ' • LATAR: GRADIEN STATIS', glTailUltra: ' • LATAR: 3D / GRID BERGERAK',
    leagueWin: 'MENANG ✓', leagueLose: 'KALAH',
    lbLoading: 'MEMUAT LEADERBOARD…', lbOffline: 'LEADERBOARD OFFLINE — PERIKSA KONEKSIMU.', lbEmpty: 'BELUM ADA SKOR — JADILAH YANG PERTAMA.', lbSent: 'SKOR TERKIRIM — REKOR BARU!', lbKept: 'SKOR TERKIRIM — REKORMU TETAP.', lbNeedWallet: 'HUBUNGKAN WALLET DULU UNTUK KIRIM SKOR.', lbNoScore: 'TIDAK ADA SKOR UNTUK DIKIRIM.', lbPractice: 'LATIHAN TIDAK DIHITUNG.', lbYourRank: 'PERINGKATMU #{rank} DARI {total}', lbVerifying: 'MENUNGGU VERIFIKASI…', lbVerified: 'TERVERIFIKASI ✓', lbVerifyRejected: 'VERIFIKASI DITOLAK — SKOR TIDAK MASUK BOARD.', lbVerifyRejectedReason: 'VERIFIKASI DITOLAK — {reason}. MAIN ULANG DAN KIRIM LAGI.', lbVerifyUnknown: 'STATUS VERIFIKASI BELUM DIKETAHUI — CEK TAB LEAGUE.',
    shopNeedWallet: 'HUBUNGKAN WALLET DULU UNTUK MEMAKAI TOKO.', shopOffline: 'TOKO OFFLINE — PERIKSA KONEKSIMU.', shopBought: 'TERBELI {item} ✓', shopPulled: 'KAPSUL: {item} ({rarity}) ✓', shopDup: 'KAPSUL: {item} (DUPLIKAT) → +{n} 🧀', shopEquipped: 'DIPAKAI {item} ✓', shopUnequipped: 'DILEPAS {item} ✓', shopNoCheese: '🧀 TIDAK CUKUP — MAIN SATU LAGU TERVERIFIKASI UNTUK DAPAT LEBIH.', shopOwned: 'SUDAH DIMILIKI.', shopCapsuleOnly: 'HANYA KAPSUL — TARIK UNTUK MENDAPATKANNYA.', shopBalanceTpl: '🧀 SALDO: {n}', shopBuyTpl: '[ BELI — {price} 🧀 ]', sqkPoolTpl: '🏆 PRIZE POOL: {pool} SQK', sqkSeasonTpl: 'MUSIM BERAKHIR: {date}', sqkSweepTpl: 'Setelah musim berakhir, sisa pool disapu ke owner 7 hari kemudian ({date}).', sqkSwept: 'PRIZE POOL SUDAH DISAPU — MUSIM SELESAI.', sqkBalanceTpl: 'SALDO SQK: {n}', sqkBuyTpl: '[ BELI — {price} SQK ]', sqkOwnedTpl: 'DIMILIKI ×{n}', sqkBought: 'TERBELI {item} ✓', sqkEquipBtn: '[ PAKAI ]', sqkEquippedTpl: 'DIPAKAI ✓', sqkEquipped: 'DIPAKAI: {item} ✓ — LAGU BERIKUTNYA PAKAI SKIN BARU.', sqkUnequipBtn: '[ LEPAS ]', sqkUnequipped: 'DILEPAS: {item} ✓ — KEMBALI KE DEFAULT.', sqkNotOwned: 'KAMU BELUM MEMILIKI {item} — BELI DULU.', sqkEquipFail: 'TIDAK BISA MEMAKAI ITEM INI.', sqkNeedWallet: 'HUBUNGKAN WALLET DULU UNTUK MEMAKAI TOKO SQK.', sqkNoProvider: 'WALLET BELUM TERHUBUNG — TEKAN [ HUBUNGKAN WALLET ] UNTUK CONNECT (OKX, METAMASK, DLL).', sqkWrongChain: 'PINDAHKAN WALLETMU KE SEPOLIA UNTUK MEMBELI.', sqkNoSqk: 'SQK TIDAK CUKUP.', sqkPermitRejected: 'SIGNATURE DITOLAK — TIDAK ADA YANG TERBELI.', sqkTxRejected: 'TRANSAKSI DITOLAK — TIDAK ADA YANG TERBELI.', sqkWaiting: 'MENUNGGU KONFIRMASI…', sqkTxFail: 'TRANSAKSI GAGAL ON-CHAIN.', sqkShopOffline: 'TOKO SQK OFFLINE — PERIKSA KONEKSIMU.', sqkPityTpl: 'PITY: {n} / 20', sqkCommitBtn: '[ COMMIT KAPSUL — 2 SQK ]', sqkResolveBtn: '[ RESOLVE KAPSUL ]', sqkCommitted: 'KAPSUL DI-COMMIT (PULL #{pull}, RONDE {round}) — RESOLVE SETELAH RONDE {round} SETTLED.', sqkResolved: 'KAPSUL: {item} ({rarity}) ✓', sqkDupKeju: 'KAPSUL: {item} ({rarity}, DUPLIKAT) → +{n} 🧀', sqkRoundUnknown: 'RONDE SAAT INI TIDAK DIKETAHUI — PERIKSA KONEKSIMU.', sqkNotSettled: 'RONDE {round} BELUM SETTLED — SETTLEMENT HANYA TERJADI SAAT HAMSTER LARI (SIANG HARI). COBA LAGI SETELAH LARI PAGI.', sqkNoPending: 'TIDAK ADA KAPSUL TERTUNDA — COMMIT DULU.', sqkResolveFail: 'RESOLVE GAGAL — PERIKSA WORKER / COBA LAGI.', sqkRateLimited: 'TERLALU SERING — COBA LAGI {time}.', lbRateLimited: 'TERLALU SERING KIRIM SKOR — COBA LAGI {time}.', lbRateLimitedNoTime: 'TERLALU SERING KIRIM SKOR — COBA LAGI BEBERAPA MENIT LAGI.', lbSlow: 'KONEKSI LAMBAT — COBA LAGI.', lbRetrying: 'KONEKSI LAMBAT — MENCOBA LAGI…', lbLullaby: 'SKOR LULLABY TIDAK DIHITUNG — SELAMAT TIDUR.', ghostNapping: '😴 SQUEEKTOSHI TIDUR — BALAPAN MELAWAN HANTUNYA (SIMULASI).', ghostOffline: '❓ RODA OFFLINE — BALAPAN MELAWAN HANTU (SIMULASI).', ghostPaceTpl: 'PACE HANTU: {pace} m/dtk — RATA-RATA SIANG ASLI 7 HARI (SIMULASI, BUKAN DATA LIVE).', ghostWokeUp: '🐹 SQUEEKTOSHI BANGUN — KEMBALI KE HAMSTER ASLI!', dreamPlanted: 'DREAM SEED DITANAM 🌱 — MAIN LULLABY UNTUK MENYIRAM, PANEN PAGI HARI.', dreamAlready: 'SUDAH ADA DREAM SEED YANG TUMBUH MALAM INI.', dreamNotNight: 'DREAM SEED DITANAM DI MALAM HARI (19:00–06:00 WIB) ATAU SAAT HAMSTER TIDUR.', dreamWatered: 'DREAM SEED DISIRAM 💧 — TAHAP {stage}/2.', dreamNoSeed: 'TIDAK ADA DREAM SEED UNTUK DIPANEN — TANAM MALAM INI.', dreamNotReady: 'BENIH PERLU DISIRAM DULU — MAIN LULLABY MALAM INI.', dreamHarvested: 'PANEN +{n} 🧀 — MIMPI INDAH BERBUAH.', dreamNeedWallet: 'HUBUNGKAN ATAU KETIK WALLET UNTUK PANEN.', dreamLineNone: 'Belum ada benih — tanam malam ini (19:00–06:00) atau saat hamster tidur, lalu siram dengan lagu Lullaby.', dreamLineDay: 'Dream Seed tumbuh di malam hari (19:00–06:00) atau saat hamster tidur. Hamster sedang bangun sekarang.', dreamLineStage: 'Benih ditanam {night} — tahap {stage}/2. Mainkan lagu Lullaby untuk menyiram (2 = siap panen).', dreamHarvestFail: 'PANEN GAGAL — PERIKSA SERVER / COBA LAGI.', modeLullaby: 'LULLABY — LAGU MALAM PELAN (TEMPO 60%). SKOR TIDAK DISUBMIT; +50 XP DAN MENYIRAM DREAM SEED.', lullabyInfo: 'Lagu pelan 60 BPM untuk malam hari, saat hamster tidur. Tidak masuk board — ini lagu pengantar tidur, bukan balapan. Selesaikan untuk +50 XP dan menyiram Dream Seed.', lullabyInfoAwake: 'Hamster sedang BANGUN sekarang — Lullaby adalah lagu malam yang pelan (tempo 60%). Skor TIDAK disubmit; +50 XP dan menyiram Dream Seed kamu.', sqkShopSoon: 'TOKO SQK SEGERA HADIR — kontrak toko belum di-deploy. Belanja SQK dibuka setelah deploy.', leagueWeeklyLoading: 'MEMUAT LIGA MINGGUAN…', leagueWeeklyOffline: 'LIGA MINGGUAN OFFLINE — PERIKSA KONEKSIMU.', leagueWeeklyYourRank: 'PERINGKAT MINGGUMU #{rank}',
    leagueRowTpl: 'KAMU {mine} vs {rival} {theirs} — {result} • {date}',
    roundHistRowTpl: '{key} — {label} (RATA-RATA {avg} RPM, {n} SAMPEL, ~{work} KERJA, {blocks} BLOK) — {state}',
    chainUnknown: 'STATUS CHAIN TIDAK DIKETAHUI [{status}] — TIDAK ADA YANG DITAMPILKAN SEBAGAI NOL.',
    chainBlockTpl: 'BLOK SQUEEK #{height} — {pct}% KE BLOK BERIKUTNYA',
    chainDiffTpl: 'DIFFICULTY {diff} KERJA / 1000 BLOK • SUDAH SETTLED SAMPAI RONDE {settled}',
    chainEcoTpl: 'SQK DITERBITKAN {issued} • DI-STAKE {staked} • SQUEEK DIBAKAR {burned} / 9.999',
    roundStateSettled: 'SETTLED ✓',
    roundStateSettling: 'MASIH SETTLING… (BELUM DIKETAHUI, BUKAN NOL)',
    roundStateUnknown: 'FRONTIER BELUM DIKETAHUI',
    unlockTitleTpl: 'TERBUKA — LV {lv}',
    unlockVoid: 'GENRE BARU: VOID', unlockLanes: 'MODE 4 JALUR', unlockMirror: 'MODE CERMIN', unlockGold: 'AVATAR EMAS',
    missionAcc: 'Akurasi >= 95%', missionCombo: 'Kombo >= 50', missionMiss0: '0 Miss dalam satu lagu',
    missionScore: 'Skor >= 5000', missionPerfect: 'Perfect >= 30', missionHard: 'Selesaikan satu lagu di SULIT',
    achFirst: 'Selesaikan 1 lagu', achPerfect: '30+ PERFECT dalam satu lagu', achCombo: 'Kombo maks 100+',
    achZoomies: 'Selesaikan lagu live/balapan dengan ZOOMIES', achRacewin: 'Menangkan balapan vs Squeektoshi',
    achOracle: 'Satu tebakan Wheel Call benar', achStreak: 'Streak harian 7 hari', achGold: 'Capai LV8',
    achVoid: 'Selesaikan lagu VOID', achMirror: 'Selesaikan lagu Mirror',
    achLegacy8: 'LV8 di kurva XP lama (sebelum v38) — badge legacy sekali saja, tidak bisa didapat lagi',
    walletForgotten: 'WALLET TERSIMPAN DILUPAKAN — KEMBALI KE GUEST.',
    ovRpmOff: 'RPM — (RODA OFFLINE)', ovDistOff: 'JARAK — KM',
    ovZoomOn: '🔥 ZOOMIES ×2 — SKOR BERLIPAT', ovZoomJog: '🏃 JOG — SKOR NORMAL', ovZoomNap: '😴 NAP — SKOR NORMAL', ovZoomOff: 'ZOOMIES —',
    ovPetRun: '🐹 SQUEEKTOSHI BERLARI — {rpm} RPM', ovPetNap: '😴 SQUEEKTOSHI TIDUR (0 RPM)', ovPetOff: '❓ RODA OFFLINE — SQUEEKTOSHI SEMBUNYI',
    ovSong: 'LAGU {key} {scale} • {bpm} BPM', ovSongOff: 'LAGU —',
    ovRoundTpl: 'RONDE {cur} • {cls} • BERIKUTNYA DALAM {cd}',
    practiceOnBtn: 'LATIHAN: AKTIF (TEMPO 60%, TANPA XP)', practiceOffBtn: 'LATIHAN: MATI',
    mirrorOn: 'AKTIF', mirrorOff: 'MATI',
  }
};
function msg(k) { const d = MSG[lang] || MSG.en; return d[k] !== undefined ? d[k] : (MSG.en[k] !== undefined ? MSG.en[k] : k); }
function msgf(k, vars) { let s = msg(k); if (vars) for (const [a, b] of Object.entries(vars)) s = s.split('{' + a + '}').join(String(b)); return s; }

// --- v30 TOTAL: result-panel row labels, EN + ID ---
const RLBL = {
  en: { score: 'SCORE', acc: 'ACCURACY', combo: 'MAX COMBO', pg: 'PERFECT/GREAT', gm: 'GOOD/MISS', anthem: 'ANTHEM', setup: 'SETUP', live: 'LIVE WHEEL', race: 'RACE', boss: 'WEEKLY BOSS', offline: 'OFFLINE (128 BPM FALLBACK)', raceWin: 'YOU WIN! +50 XP', raceLose: 'SQUEEKTOSHI WINS', bossDefeated: 'DEFEATED ✓ +100 XP', tryCalib: ' • TRY CALIBRATION', practiceTag: ' • PRACTICE', lullabyTag: ' • LULLABY', ghostTag: ' (GHOST — SIMULATION)' },
  id: { score: 'SKOR', acc: 'AKURASI', combo: 'KOMBO MAKSIMAL', pg: 'PERFECT/GREAT', gm: 'GOOD/MISS', anthem: 'LAGU', setup: 'PENGATURAN', live: 'RODA LIVE', race: 'BALAPAN', boss: 'BOSS MINGGUAN', offline: 'OFFLINE (128 BPM CADANGAN)', raceWin: 'KAMU MENANG! +50 XP', raceLose: 'SQUEEKTOSHI MENANG', bossDefeated: 'KALAH ✓ +100 XP', tryCalib: ' • COBA KALIBRASI', practiceTag: ' • LATIHAN', lullabyTag: ' • LULLABY', ghostTag: ' (HANTU — SIMULASI)' },
};
function rl(k) { const d = RLBL[lang] || RLBL.en; return d[k] !== undefined ? d[k] : RLBL.en[k]; }

// --- EN/ID toggle (v32: menu labels AND dynamic messages are both translated) ---
const I18N = {
  en: { wallet: 'WALLET ADDRESS', connect: '[ CONNECT WALLET ]', connectedTpl: '[ CONNECTED: {addr} ]', genre: '// GENRE', diff: '// DIFFICULTY', options: '// OPTIONS', mode: '// MODE', play: 'INITIALIZE RHYTHM', card: 'GENERATE ID CARD', retry: 'RETRY', resultCard: '[ SHARE RESULT CARD ]', obs: '[ OBS OVERLAY LINK ]', wheelcall: 'WHEEL CALL — PREDICT THE NEXT ROUND', boss: 'WEEKLY BOSS', bossFight: '[ FIGHT WEEKLY BOSS ]', league: 'DUEL LEAGUE — LOCAL RIVALS', lbTitle: 'GLOBAL LEADERBOARD — TOP SCORES', lbNote: 'Scores are public. Your wallet shows truncated.', lbRefresh: '[ REFRESH ]', lbSubmit: '[ SUBMIT SCORE ]', ach: 'ACHIEVEMENTS', away: 'WHILE YOU WERE AWAY', addNote: '[ ADD NOTE ]', howto: 'HOW TO PLAY', gotIt: '[ GOT IT — LET\'S PLAY ]', howBtn: '[ HOW TO PLAY ]', roundhist: 'ROUND HISTORY — LAST 12 ROUNDS', chainTitle: 'CHAIN — LIVE FROM SQUEEKCORE', chainLoading: 'FETCHING CHAIN STATE…', champs: 'DAILY CHAMPIONS — YOUR BEST SCORE EACH DAY',
    warn: '⚠️ 0x address ONLY. NEVER enter a seed phrase / private key here, anywhere.',
    splashSub: 'CHOOSE YOUR OPENING MUSIC', splashNote: 'Browsers block sound before your first tap — the music starts on your first tap, not before.',
    liveInfo: 'The song\'s tempo follows the real hamster wheel, live from api.squeekchain.com/v1/status. Resting hamster = CALM 100 BPM. Running hamster = 100 + RPM (max 180). At 70+ RPM ZOOMIES starts and all scores double. Day follows the wheel running, night follows it resting. If the wheel is offline, the song uses a 128 BPM fallback and says so.',
    raceInfo: 'A real race against the live hamster: your distance grows with every note you hit (PERFECT 1.0 m • GREAT 0.7 m • GOOD 0.4 m). Squeektoshi\'s distance is the real wheel\'s distance since the song started. Win the race for +50 XP. When a new 10-minute round starts mid-song, the next note turns GOLDEN (+1000 pts, +5 m).',
    predStatus: 'Rounds are 10 minutes. NAP < 5 RPM • JOG 5–69 RPM • ZOOMIES 70+ RPM. A correct call earns +40 XP.',
    duelMsgPh: 'THE DUEL LINK WILL APPEAR HERE AFTER THE GAME ENDS.',
    diaryPh: 'Add a note to your last song…', duelOutPh: 'The duel link will appear here — copy it manually if the clipboard is blocked.',
    hintTap: 'TAP LANE WHEN BLOCK HITS THE LINE.', lastHitLbl: 'LAST HIT', avgHitLbl: 'AVG',
    calibTitle: 'PRECISION — TIMING CALIBRATION', calibBtn: '[ AUTO-CALIBRATE — TAP THE BEAT ]', calibTap: 'TAP ON THE BEAT!',
    masteryTitle: 'MASTERY — LAST 10 GAMES', volLabel: 'VOLUME', settingsTitle: 'SETTINGS',
    footerNote: 'UNOFFICIAL. On-chain data is read read-only (Sepolia token). Optional wallet connect reads your address only — no signature, no approval, no transactions. Made in Indonesia.',
    duelLink: '[ DUEL LINK ]', shareX: '[ SHARE RESULT TO X ]', exitMenu: 'EXIT TO MENU', latCalib: '[ CALIBRATE ]',
    langLabel: 'LANGUAGE', qualityLabel: 'GRAPHICS', soundLabel: 'SOUND', avatarSelf: 'YOUR PIXEL SELF',
    download: '[ DOWNLOAD ]', share: '[ SHARE ]', feverTag: '🔥 FEVER ×1.5 — COMBO 30+', youLbl: 'YOU',
    leagueEmpty: 'No duels yet — send a Duel Link after a song, and when a friend plays it, their result lands here.',
    champsEmpty: 'No champions yet — your best score of each day lands here.',
    roundHistEmpty: 'No finished rounds recorded yet — keep this page open and rounds settle here.',
    cardBarLbl: 'ID CARD — TAP TO OPEN',
    forgetWallet: '[ FORGET SAVED WALLET ]', pauseTitle: 'PAUSED', pauseCalib: '[ CALIBRATE ]', pauseResume: '[ RESUME ]', pauseExit: '[ EXIT ]', pauseSure: '[ SURE? TAP AGAIN ]', backToGame: '[ BACK TO GAME ]',
    shopTitle: 'CHEESE SHOP — SPEND KEJU, NOT MONEY', shopNote: 'Keju is earned by playing: 100 per verified song, +500 for grade S, +50 for the daily mission (first verified song of the day). Capsule: 100 Keju per pull. Cosmetics only — nothing here makes you stronger.', capsuleTitle: 'CHEESE CAPSULE — 100 KEJU / PULL', capsuleBtn: '[ PULL CAPSULE — 100 🧀 ]', equipBtn: '[ EQUIP ]', unequipBtn: '[ UNEQUIP ]', equippedLbl: 'EQUIPPED ✓', ownedLbl: 'OWNED', capsuleOnlyLbl: 'CAPSULE ONLY', leagueWeekly: 'WEEKLY LEAGUE — TOP 30 THIS WEEK', leagueWeekNote: 'Best FREE score of the week. Resets every Monday 19:00 WIB.', leagueWeeklyEmpty: 'No weekly scores yet — play a FREE song and verify it to join this week.',
    sqkShopTitle: 'SQK SHOP — COSMETICS FOR SQK (TESTNET)', sqkShopNote: 'Cosmetics only — nothing here makes you stronger. You pay with SQK (Sepolia testnet, no real money value) via permit: 1 signature + 1 transaction, exact amount, 10-minute deadline. NO unlimited approval, ever.', sqkShopSoon: 'SQK SHOP COMING SOON — the shop contract is not deployed yet. SQK shopping opens after the deploy.', sqkPoolTpl: '🏆 PRIZE POOL: {pool} SQK', sqkSeasonTpl: 'SEASON ENDS: {date}', sqkSweepTpl: 'After the season ends, the remaining pool is swept to the owner 7 days later ({date}).', sqkSwept: 'PRIZE POOL SWEPT — SEASON OVER.', sqkBalanceTpl: 'SQK BALANCE: {n}', sqkBuyTpl: '[ BUY — {price} SQK ]', sqkOwnedTpl: 'OWNED ×{n}', sqkBought: 'BOUGHT {item} ✓', sqkEquipBtn: '[ EQUIP ]', sqkEquippedTpl: 'EQUIPPED ✓', sqkEquipped: 'EQUIPPED: {item} ✓ — YOUR NEXT SONG USES THE NEW SKIN.', sqkNotOwned: 'YOU DO NOT OWN {item} YET — BUY IT FIRST.', sqkEquipFail: 'CANNOT EQUIP THIS ITEM.', sqkNeedWallet: 'CONNECT A WALLET FIRST TO USE THE SQK SHOP.', sqkNoProvider: 'NO WALLET CONNECTED — TAP [ CONNECT WALLET ] TO CONNECT (WORKS WITH OKX, METAMASK AND OTHER WALLETS).', sqkWrongChain: 'SWITCH YOUR WALLET TO SEPOLIA TO BUY.', sqkNoSqk: 'NOT ENOUGH SQK.', sqkPermitRejected: 'SIGNATURE REJECTED — NOTHING WAS BOUGHT.', sqkTxRejected: 'TRANSACTION REJECTED — NOTHING WAS BOUGHT.', sqkWaiting: 'WAITING FOR CONFIRMATION…', sqkTxFail: 'TRANSACTION FAILED ON-CHAIN.', sqkShopOffline: 'SQK SHOP OFFLINE — CHECK YOUR CONNECTION.', sqkCapsuleTitle: 'GOLDEN CAPSULE — 2 SQK / PULL', sqkCapsuleOdds: 'ODDS: COMMON 70% • RARE 22% • EPIC 7% • LEGENDARY 1%. Duplicate → Keju compensation (25/50/100/250). Hard pity: pull 20 is at least RARE.', sqkPityTpl: 'PITY: {n} / 20', sqkCommitBtn: '[ COMMIT CAPSULE — 2 SQK ]', sqkResolveBtn: '[ RESOLVE CAPSULE ]', sqkCommitted: 'CAPSULE COMMITTED (PULL #{pull}, ROUND {round}) — RESOLVE AFTER ROUND {round} SETTLES.', sqkResolved: 'CAPSULE: {item} ({rarity}) ✓', sqkDupKeju: 'CAPSULE: {item} ({rarity}, DUPLICATE) → +{n} 🧀', sqkRoundUnknown: 'CURRENT ROUND UNKNOWN — CHECK YOUR CONNECTION.', sqkNotSettled: 'ROUND {round} HAS NOT SETTLED YET — SETTLEMENTS ONLY HAPPEN WHEN THE HAMSTER RUNS (DAYTIME). TRY AGAIN AFTER THE MORNING RUN.', sqkNoPending: 'NO PENDING CAPSULE — COMMIT ONE FIRST.', sqkResolveFail: 'RESOLVE FAILED — CHECK THE WORKER / TRY AGAIN.', tagline: 'Your high score depends on a hamster.', walletManualNote: 'MANUAL — type an address to play & submit scores without connecting a wallet. This is NOT a connection.', disconnect: '[ DISCONNECT ]', modeLullaby: 'LULLABY', lullabyInfo: 'A slow 60 BPM song for the night, while the hamster sleeps. No board submit — this is a lullaby, not a race. Finish it for +50 XP and to water your Dream Seed.', dreamTitle: 'DREAM SEEDS — GROW OVERNIGHT', dreamPlant: '[ PLANT DREAM SEED ]', dreamHarvest: '[ HARVEST ]' },
  id: { wallet: 'ALAMAT WALLET', connect: '[ HUBUNGKAN WALLET ]', connectedTpl: '[ TERHUBUNG: {addr} ]', genre: '// GENRE', diff: '// KESULITAN', options: '// OPSI', mode: '// MODE', play: 'MULAI RHYTHM', card: 'BUAT ID CARD', retry: 'ULANGI', resultCard: '[ BAGIKAN KARTU HASIL ]', obs: '[ TAUTAN OVERLAY OBS ]', wheelcall: 'WHEEL CALL — TEBAK RONDE BERIKUTNYA', boss: 'BOSS MINGGUAN', bossFight: '[ LAWAN BOSS MINGGUAN ]', league: 'LIGA DUEL — RIVAL LOKAL', lbTitle: 'LEADERBOARD GLOBAL — SKOR TERATAS', lbNote: 'Skor bersifat publik. Walletmu tampil terpotong.', lbRefresh: '[ MUAT ULANG ]', lbSubmit: '[ KIRIM SKOR ]', ach: 'PENCAPAIAN', away: 'SELAMA KAMU PERGI', addNote: '[ TAMBAH CATATAN ]', howto: 'CARA MAIN', gotIt: '[ PAHAM — AYO MAIN ]', howBtn: '[ CARA MAIN ]', roundhist: 'RIWAYAT RONDE — 12 RONDE TERAKHIR', chainTitle: 'CHAIN — LIVE DARI SQUEEKCORE', chainLoading: 'MENGAMBIL STATUS CHAIN…', champs: 'JUARA HARIAN — SKOR TERBAIKMU SETIAP HARI',
    warn: '⚠️ Hanya alamat 0x. JANGAN PERNAH memasukkan seed phrase / private key di sini, di mana pun.',
    splashSub: 'PILIH MUSIK PEMBUKA', splashNote: 'Browser memblokir suara sebelum ketukan pertamamu — musik mulai saat kamu pertama kali mengetuk, bukan sebelumnya.',
    liveInfo: 'Tempo lagu mengikuti roda hamster asli, live dari api.squeekchain.com/v1/status. Hamster istirahat = CALM 100 BPM. Hamster berlari = 100 + RPM (maks 180). Di 70+ RPM ZOOMIES mulai dan semua skor berlipat dua. Siang mengikuti roda yang berlari, malam mengikuti roda yang istirahat. Kalau rodanya offline, lagu memakai 128 BPM cadangan dan mengatakannya.',
    raceInfo: 'Balapan sungguhan melawan hamster live: jarakmu bertambah setiap not yang kamu pukul (PERFECT 1,0 m • GREAT 0,7 m • GOOD 0,4 m). Jarak Squeektoshi adalah jarak roda aslinya sejak lagu dimulai. Menangkan balapannya untuk +50 XP. Saat ronde 10 menit baru dimulai di tengah lagu, not berikutnya berubah EMAS (+1000 poin, +5 m).',
    predStatus: 'Ronde berdurasi 10 menit. NAP < 5 RPM • JOG 5–69 RPM • ZOOMIES 70+ RPM. Tebakan benar dapat +40 XP.',
    duelMsgPh: 'TAUTAN DUEL AKAN MUNCUL DI SINI SETELAH GAME SELESAI.',
    diaryPh: 'Tambahkan catatan untuk lagu terakhirmu…', duelOutPh: 'Tautan duel akan muncul di sini — salin manual jika clipboard diblokir.',
    hintTap: 'KETUK JALUR SAAT BLOK MENYENTUH GARIS.', lastHitLbl: 'TERAKHIR', avgHitLbl: 'RATA-RATA',
    calibTitle: 'PRESISI — KALIBRASI TIMING', calibBtn: '[ KALIBRASI OTOMATIS — KETUK MENGIKUTI KETUKAN ]', calibTap: 'KETUK MENGIKUTI KETUKAN!',
    masteryTitle: 'MASTERY — 10 GAME TERAKHIR', volLabel: 'VOLUME', settingsTitle: 'PENGATURAN',
    footerNote: 'TIDAK RESMI. Data on-chain dibaca read-only (token Sepolia). Koneksi wallet opsional hanya membaca alamatmu — tanpa signature, tanpa approval, tanpa transaksi. Dibuat di Indonesia.',
    duelLink: '[ TAUTAN DUEL ]', shareX: '[ BAGIKAN HASIL KE X ]', exitMenu: 'KELUAR KE MENU', latCalib: '[ KALIBRASI ]',
    langLabel: 'BAHASA', qualityLabel: 'GRAFIS', soundLabel: 'SUARA', avatarSelf: 'DIRIMU DALAM PIXEL',
    download: '[ UNDUH ]', share: '[ BAGIKAN ]', feverTag: '🔥 FEVER ×1.5 — KOMBO 30+', youLbl: 'KAMU',
    leagueEmpty: 'Belum ada duel — kirim Duel Link setelah satu lagu, dan saat teman memainkannya, hasilnya muncul di sini.',
    champsEmpty: 'Belum ada juara — skor terbaikmu setiap hari muncul di sini.',
    roundHistEmpty: 'Belum ada ronde selesai yang tercatat — biarkan halaman ini terbuka dan ronde akan tercatat di sini.',
    cardBarLbl: 'KARTU ID — KETUK UNTUK BUKA',
    forgetWallet: '[ LUPAKAN WALLET TERSIMPAN ]', pauseTitle: 'DIJEDA', pauseCalib: '[ KALIBRASI ]', pauseResume: '[ LANJUT ]', pauseExit: '[ KELUAR ]', pauseSure: '[ YAKIN? KETUK LAGI ]', backToGame: '[ KEMBALI KE GAME ]',
    shopTitle: 'TOKO KEJU — BELANJA PAKAI KEJU', shopNote: 'Keju didapat dari bermain: 100 per lagu terverifikasi, +500 untuk grade S, +50 untuk misi harian (lagu terverifikasi pertama hari itu). Kapsul: 100 Keju per pull. Kosmetik saja — tidak ada yang membuatmu lebih kuat.', capsuleTitle: 'KAPSUL KEJU — 100 KEJU / PULL', capsuleBtn: '[ TARIK KAPSUL — 100 🧀 ]', equipBtn: '[ PAKAI ]', unequipBtn: '[ LEPAS ]', equippedLbl: 'DIPAKAI ✓', ownedLbl: 'DIMILIKI', capsuleOnlyLbl: 'HANYA KAPSUL', leagueWeekly: 'LIGA MINGGUAN — 30 TERATAS MINGGU INI', leagueWeekNote: 'Skor FREE terbaik minggu ini. Reset tiap Senin 19:00 WIB.', leagueWeeklyEmpty: 'Belum ada skor minggu ini — main satu lagu FREE dan verifikasi untuk ikut minggu ini.',
    sqkShopTitle: 'TOKO SQK — KOSMETIK UNTUK SQK (TESTNET)', sqkShopNote: 'Kosmetik saja — tidak ada yang membuatmu lebih kuat. Bayar pakai SQK (testnet Sepolia, tanpa nilai uang) via permit: 1 signature + 1 transaksi, jumlah exact, deadline 10 menit. TIDAK ADA unlimited approve.', sqkShopSoon: 'TOKO SQK SEGERA HADIR — kontrak toko belum di-deploy. Belanja SQK dibuka setelah deploy.', sqkPoolTpl: '🏆 PRIZE POOL: {pool} SQK', sqkSeasonTpl: 'MUSIM BERAKHIR: {date}', sqkSweepTpl: 'Setelah musim berakhir, sisa pool disapu ke owner 7 hari kemudian ({date}).', sqkSwept: 'PRIZE POOL SUDAH DISAPU — MUSIM SELESAI.', sqkBalanceTpl: 'SALDO SQK: {n}', sqkBuyTpl: '[ BELI — {price} SQK ]', sqkOwnedTpl: 'DIMILIKI ×{n}', sqkBought: 'TERBELI {item} ✓', sqkEquipBtn: '[ PAKAI ]', sqkEquippedTpl: 'DIPAKAI ✓', sqkEquipped: 'DIPAKAI: {item} ✓ — LAGU BERIKUTNYA PAKAI SKIN BARU.', sqkNotOwned: 'KAMU BELUM MEMILIKI {item} — BELI DULU.', sqkEquipFail: 'TIDAK BISA MEMAKAI ITEM INI.', sqkNeedWallet: 'HUBUNGKAN WALLET DULU UNTUK MEMAKAI TOKO SQK.', sqkNoProvider: 'WALLET BELUM TERHUBUNG — TEKAN [ HUBUNGKAN WALLET ] UNTUK CONNECT (OKX, METAMASK, DLL).', sqkWrongChain: 'PINDAHKAN WALLETMU KE SEPOLIA UNTUK MEMBELI.', sqkNoSqk: 'SQK TIDAK CUKUP.', sqkPermitRejected: 'SIGNATURE DITOLAK — TIDAK ADA YANG TERBELI.', sqkTxRejected: 'TRANSAKSI DITOLAK — TIDAK ADA YANG TERBELI.', sqkWaiting: 'MENUNGGU KONFIRMASI…', sqkTxFail: 'TRANSAKSI GAGAL ON-CHAIN.', sqkShopOffline: 'TOKO SQK OFFLINE — PERIKSA KONEKSIMU.', sqkCapsuleTitle: 'KAPSUL EMAS — 2 SQK / TARIK', sqkCapsuleOdds: 'PELUANG: COMMON 70% • RARE 22% • EPIC 7% • LEGENDARY 1%. Duplikat → kompensasi Keju (25/50/100/250). Hard pity: tarikan ke-20 minimal RARE.', sqkPityTpl: 'PITY: {n} / 20', sqkCommitBtn: '[ COMMIT KAPSUL — 2 SQK ]', sqkResolveBtn: '[ RESOLVE KAPSUL ]', sqkCommitted: 'KAPSUL DI-COMMIT (PULL #{pull}, RONDE {round}) — RESOLVE SETELAH RONDE {round} SETTLED.', sqkResolved: 'KAPSUL: {item} ({rarity}) ✓', sqkDupKeju: 'KAPSUL: {item} ({rarity}, DUPLIKAT) → +{n} 🧀', sqkRoundUnknown: 'RONDE SAAT INI TIDAK DIKETAHUI — PERIKSA KONEKSIMU.', sqkNotSettled: 'RONDE {round} BELUM SETTLED — SETTLEMENT HANYA TERJADI SAAT HAMSTER LARI (SIANG HARI). COBA LAGI SETELAH LARI PAGI.', sqkNoPending: 'TIDAK ADA KAPSUL TERTUNDA — COMMIT DULU.', sqkResolveFail: 'RESOLVE GAGAL — PERIKSA WORKER / COBA LAGI.', tagline: 'Skormu tergantung pada seekor hamster.', walletManualNote: 'MANUAL — ketik alamat untuk main & kirim skor tanpa connect wallet. Ini BUKAN koneksi.', disconnect: '[ PUTUSKAN ]', modeLullaby: 'LULLABY', lullabyInfo: 'Lagu pelan 60 BPM untuk malam hari, saat hamster tidur. Tidak masuk board — ini lagu pengantar tidur, bukan balapan. Selesaikan untuk +50 XP dan menyiram Dream Seed.', dreamTitle: 'DREAM SEEDS — TUMBUH SEMALAM', dreamPlant: '[ TANAM DREAM SEED ]', dreamHarvest: '[ PANEN ]' },
};
let lang = loadJSON('sqk29:lang', 'en');

// v38 XP ECONOMY: LV8 now needs 54,000 total XP (was 4,000). Cumulative
// thresholds [0, 700, 2000, 4300, 8500, 16000, 29500, 54000]; per-level
// increments ~x1.8 each (700, 1300, 2300, 4200, 7500, 13500, 24500) —
// early levels fall in 1-2 songs, the last level is a real grind. Measured
// on the live chart generator (20 seeds): a perfect NORMAL song is ~165
// notes / ~119,700 pts / ~4,070 XP; a casual song (acc ~70%, broken
// combos) is ~1,200-1,600 XP. So LV8 is ~13-14 perfect NORMAL songs,
// ~22 perfect EASY songs, or ~35-45 casual songs. Existing total XP is
// kept as-is; levelFor() just re-reads it against the new thresholds.
const XP_LEVELS = [0, 700, 2000, 4300, 8500, 16000, 29500, 54000];
function totalXP(w) { return loadJSON('sqk24:xp:' + walletKey(w), 0) | 0; }
function levelFor(xp) { let lv = 1; for (let i = 0; i < XP_LEVELS.length; i++) if (xp >= XP_LEVELS[i]) lv = i + 1; return lv; }

// v28 FIX — LV5–LV8 UNLOCKS (real, not labels): LV5 VOID genre, LV6 4 lanes,
// LV7 Mirror mode, LV8 Gold avatar. LV1–LV4 already evolve the avatar
// (glasses LV2, hat LV3, crown LV4).
const UNLOCKS = {
  5: { id: 'void', text: 'NEW GENRE: VOID', k: 'unlockVoid' },
  6: { id: 'lanes4', text: '4 LANES MODE', k: 'unlockLanes' },
  7: { id: 'mirror', text: 'MIRROR MODE', k: 'unlockMirror' },
  8: { id: 'gold', text: 'GOLD AVATAR', k: 'unlockGold' },
};
function unlocksForLevel(lv) { const out = []; for (let l = 5; l <= lv && l <= 8; l++) if (UNLOCKS[l]) out.push(UNLOCKS[l]); return out; }
function playerLevel(w) { return levelFor(totalXP(w)); }

// v28 FIX — PRECISION OFFSET (ms). Positive = the player taps late on average,
// so the game judges the tap as if it came offsetMs earlier. Stored per
// device (this browser), not per wallet — it is a property of the device.
function offsetMsClamp(v) { return Math.max(-150, Math.min(150, Math.round(v / 5) * 5)); }
function loadOffsetMs() { const v = loadJSON('sqk28:offsetMs', 0); return offsetMsClamp(typeof v === 'number' && Number.isFinite(v) ? v : 0); }
let offsetMs = loadOffsetMs();
function setOffsetMs(v) { offsetMs = offsetMsClamp(v); saveJSON('sqk28:offsetMs', offsetMs); renderOffsetLine(); }

// v28 FIX — DAILY SPEC: the daily song is the same for EVERYONE, so the genre
// and difficulty come from the date itself (not the player's selection). Only
// the 3 base genres are used — VOID is a LV5 unlock and must never be the
// daily song for a player who has not unlocked it.
const DAILY_GENRES = ['cyber', 'synth', 'chip'];
const DIFF_KEYS = ['easy', 'normal', 'hard'];
function dailySpec(dateStr) {
  const d = dateStr || squeekTodayStr();
  return { genre: DAILY_GENRES[cyrb53('DAILY-GENRE-' + d) % DAILY_GENRES.length], diff: DIFF_KEYS[cyrb53('DAILY-DIFF-' + d) % DIFF_KEYS.length] };
}
function applyDailySpec(dateStr) {
  const s = dailySpec(dateStr);
  currentGenre = s.genre; currentDiff = s.diff;
  syncGenreDiffButtons();
  return s;
}
function syncGenreDiffButtons() {
  document.querySelectorAll('#genreRow .btn-diff').forEach(x => { const on = x.dataset.genre === currentGenre; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); });
  document.querySelectorAll('#diffRow .btn-diff').forEach(x => { const on = x.dataset.diff === currentDiff; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); });
}
function lockGenreDiffRows(locked) {
  ['genreRow', 'diffRow'].forEach(r => {
    const row = document.getElementById(r); if (!row) return;
    row.classList.toggle('locked-row', locked);
    row.querySelectorAll('.btn-diff').forEach(b => { b.disabled = locked; });
  });
}

// v28 FIX — LANES & MIRROR (menu toggles, stored per browser).
let lanes4Enabled = loadJSON('sqk28:lanes4', false) === true;
let mirrorEnabled = loadJSON('sqk28:mirror', false) === true;
let challengeLanes = 3, challengeMirror = false;
function currentWallet() { const el = $('walletInput'); return el ? el.value.trim() : ''; }
// v42.5 (P1-1): transaksi on-chain HARUS memakai alamat wallet yang
// TERHUBUNG (connectedAddr), BUKAN isi field teks — field bisa diedit
// setelah connect dan wallet akan menolak transaksi dengan error yang
// membingungkan. Bila tidak ada koneksi, pakai field (akan gagal di getEth()
// dengan sqkNoProvider — benar, karena transaksi butuh provider).
function txWallet() { return connectedAddr || currentWallet(); }
function lanesForSong() {
  if (playMode === 'challenge') return challengeLanes;
  if (playMode === 'daily') return 3; // canonical daily: same song for everyone
  return (playerLevel(currentWallet()) >= 6 && lanes4Enabled) ? 4 : 3;
}
function mirrorForSong() {
  if (playMode === 'challenge') return challengeMirror;
  if (playMode === 'daily') return false;
  return mirrorEnabled && playerLevel(currentWallet()) >= 7;
}

const MISSION_POOL = [
  { id: 'acc95', text: 'Accuracy >= 95%', k: 'missionAcc', check: r => r.acc >= 95 },
  { id: 'combo50', text: 'Combo >= 50', k: 'missionCombo', check: r => r.maxCombo >= 50 },
  { id: 'miss0', text: '0 Miss in one song', k: 'missionMiss0', check: r => r.miss === 0 },
  { id: 'score5000', text: 'Score >= 5000', k: 'missionScore', check: r => r.score >= 5000 },
  { id: 'perfect30', text: 'Perfect >= 30', k: 'missionPerfect', check: r => r.perfect >= 30 },
  { id: 'hard', text: 'Finish one song on HARD', k: 'missionHard', check: r => r.diff === 'hard' },
];
function dailyMissions(dateStr) {
  const r = rng(cyrb53('MISSION-' + dateStr));
  const pool = MISSION_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}
function missionsDoneKey(w) { return 'sqk24:missions:' + walletKey(w) + ':' + squeekTodayStr(); }

let hitOffsets = [];
let quality = 'ultra';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let muted = false;

function say(t, c) { const el = $('message'); if (!el) return; el.textContent = t; el.style.color = c ? `var(--${c})` : ''; }
function show(id) { ['mainPanel', 'gamePanel', 'resultPanel'].forEach(p => $(p).classList.toggle('hidden', p !== id)); }
window.addEventListener('error', (e) => { try { say('ERROR: ' + String(e.message || e.error || 'unknown').slice(0, 80), 'pink'); } catch (_) {} });

// ==========================================
// 1. WEBGL BACKGROUND (SHOCKWAVE & REACTIVE)
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
    
    // SHADER DENGAN EFEK SHOCKWAVE & WARNA COMBO
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution; uniform float u_time; uniform float u_seed;
      uniform float u_audio; uniform float u_glitch; uniform float u_shock; uniform float u_combo;

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
          
          // SHOCKWAVE DISTORTION
          float dist = length(uv);
          float ripple = sin(dist * 20.0 - u_time * 10.0) * u_shock * 0.1;
          uv += (dist > 0.001 ? normalize(uv) : vec2(0.0)) * ripple; // v26: normalize(0,0) di tengah layar itu undefined — jaga dari NaN

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
              
              vec3 c1 = vec3(0.0, 1.0, 0.0); // Hijau
              vec3 c2 = vec3(1.0, 0.0, 1.0); // Pink
              if (u_combo > 20.0) c1 = vec3(0.0, 1.0, 1.0); // Cyan
              if (u_combo > 50.0) c2 = vec3(1.0, 1.0, 0.0); // Kuning
              
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
    resizeGL(); window.addEventListener('resize', resizeGL); glRunning = true; requestAnimationFrame(renderGL); setText('glStatus', msgf('glOk', { q: quality.toUpperCase() }));
  } catch (err) { gl = null; glRunning = false; document.body.classList.add('no-gl'); setText('glStatus', msgf('glFail', { q: quality.toUpperCase() })); }
}
function resizeGL() { if (!gl) return; const scale = 0.66; const dpr = Math.min(1.5, window.devicePixelRatio || 1); glCanvas.width = Math.max(2, Math.floor(window.innerWidth * dpr * scale)); glCanvas.height = Math.max(2, Math.floor(window.innerHeight * dpr * scale)); gl.viewport(0, 0, glCanvas.width, glCanvas.height); }
let lastGlFrame = 0;
function renderGL(time) {
  if (!glRunning || !gl) return; requestAnimationFrame(renderGL);
  if (document.hidden) return; if (prefersReducedMotion && time - lastGlFrame < 66) return; lastGlFrame = time;
  gl.uniform2f(uRes, glCanvas.width, glCanvas.height); 
  gl.uniform1f(uTime, time * 0.001); gl.uniform1f(uSeed, glSeed); 
  gl.uniform1f(uAudio, prefersReducedMotion ? 0 : glAudio); 
  gl.uniform1f(uGlitch, prefersReducedMotion ? 0 : glGlitch);
  gl.uniform1f(uShock, prefersReducedMotion ? 0 : glShockwave);
  gl.uniform1f(uCombo, glCombo);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); 
  glGlitch *= 0.95; 
  glShockwave *= 0.92; // Shockwave mereda
}
initGL();

function setQuality(q) {
  quality = q; const b = $('qualityBtn'); if (b) b.textContent = q === 'ultra' ? 'QLTY: ULTRA' : 'QLTY: ECO';
  document.body.classList.toggle('hemat', q === 'hemat'); // v26 FIX #7: efek terlihat walau WebGL mati — background halaman berubah jelas
  if (q === 'hemat') { glRunning = false; document.body.classList.add('no-gl'); }
  else { document.body.classList.remove('no-gl'); if (gl && !glRunning) { glRunning = true; requestAnimationFrame(renderGL); } }
  setText('glStatus', msgf('glStatusTpl', { webgl: gl ? 'OK' : 'FAILED', q: q.toUpperCase(), tail: q === 'hemat' ? msg('glTailEco') : msg('glTailUltra') }));
  say('QLTY: ' + q.toUpperCase() + (q === 'hemat' ? msg('qltyEco') : msg('qltyUltra')), 'cyan');
  try { localStorage.setItem('sqk-quality', q); } catch (_) {}
}
// v32 PERFORMANCE: pause/resume the WebGL background loop. renderGL stops
// rescheduling itself when glRunning is false, so pauseGL freezes it and
// resumeGL restarts it. Called on game start/stop/finish.
function pauseGL() { glRunning = false; }
function resumeGL() { if (gl && quality !== 'hemat' && !glRunning) { glRunning = true; requestAnimationFrame(renderGL); } }
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
const CONFIG = { API_URL: 'https://api.squeekchain.com/v1/status', CORE_URL: 'https://api.squeekchain.com/v1/core', ECONOMY_URL: 'https://api.squeekchain.com/v1/economy/state', STATS_URL: 'https://api.squeekchain.com/v1/measurement/stats?range=7d', LB_URL: 'https://squeekchain-leaderboard.pancigoreng.workers.dev', RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com', TOKEN: '0xd78a3956cF63164d1Fa1C622ad3c66623162Fa1e', BARS: 32, LEAD_IN: 2, HIT_Y: 450, SPEED: 350, W: { perfect: .045, great: .09, good: .135 } }; // BARS 32 (Lagu lebih panjang)
// --- v42.1: SQK shop (Batch 5, wired). SHOP_ADDRESS is the DEPLOYED
// shop contract 0x43f568AcfaDcee4333785c9F26596719ED0B02fb (Sepolia,
// deployed by the user 2026-11-08 via Remix, Sourcify full match):
// the whole SQK section renders live (see renderSqkShop) — buy buttons
// enabled, prize pool / season end / sweep read live from the contract.
// The honest disabled state still exists for the zero address only.
// SQK_TOKEN duplicates CONFIG.TOKEN on purpose: the shop code reads
// SQK_TOKEN so a future token change touches one place. SEPOLIA_RPC
// duplicates RPC_URL for the same reason. Selectors below are the
// 4-byte keccak selectors of the FROZEN shop interface, precomputed
// (verified with @noble/hashes 2026-11-08); the client has no keccak.
CONFIG.SHOP_ADDRESS = '0x43f568AcfaDcee4333785c9F26596719ED0B02fb';
CONFIG.SQK_TOKEN = CONFIG.TOKEN;
CONFIG.SEPOLIA_RPC = CONFIG.RPC_URL;
// --- v42.3: WalletConnect (Reown). WC_PROJECT_ID is PUBLIC by design —
// it identifies the dApp to the WalletConnect relay, it is not a secret
// and it grants no access to any wallet. Created by the user at
// cloud.reown.com (free). The provider is a VENDORED esbuild bundle
// (wc-provider.bundle.js, @walletconnect/ethereum-provider 2.26.0 +
// viem/lit/bs58/valtio/qrcode/big.js, IIFE, window.EthereumProvider),
// lazy-loaded ONLY when CONNECT WALLET is pressed from a plain browser
// (see wcLoadBundle). v42.2 loaded the unpkg UMD instead — that file is
// NOT standalone (its global branch needs window.bs58/viem/lit/... as
// globals, so the factory threw before EthereumProvider was assigned and
// the modal never opened). The vendored bundle was verified by REAL
// execution (jsdom load + EthereumProvider.init, see AUDIT-v42.3.md),
// not by grepping the file. WC_CHAINS is the only chain the game ever
// uses: Sepolia 11155111.
CONFIG.WC_PROJECT_ID = '1f186dd3221f938c4e0b8c72c233a3be';
CONFIG.WC_CHAINS = [11155111];
// v42.4 (BUG 3): slot + skin — tiap item SQK yang dibeli BISA DIPAKAI.
// slot 'note' mewarnai not via noteColor(); slot 'frame' membingkai panel
// hasil via applyResultFrame(). skin id merujuk ke NOTE_SKINS / FRAME_SKINS.
const SQK_SHOP_CATALOG = [
  { id: 1, name: 'Skin Rare', priceSqk: 5, slot: 'note', skin: 'note-sqk-rare' },
  { id: 2, name: 'Efek Epic', priceSqk: 10, slot: 'note', skin: 'note-sqk-epic' },
  { id: 3, name: 'Bingkai Animasi', priceSqk: 15, slot: 'frame', skin: 'frame-sqk' },
  { id: 4, name: 'Skin Epic', priceSqk: 20, slot: 'note', skin: 'note-sqk-lime' },
  { id: 5, name: 'Golden Wheel', priceSqk: 50, slot: 'note', skin: 'note-sqk-platinum' },
  { id: 6, name: 'Skin Legendary', priceSqk: 100, slot: 'note', skin: 'note-sqk-inferno' },
];
const SQK_CAPSULE_PRICE = 2; // SQK per pull
const SQK_CAPSULE_ODDS = { common: 70, rare: 22, epic: 7, legendary: 1 };
const SQK_CAPSULE_DUP_COMP = { common: 25, rare: 50, epic: 100, legendary: 250 };
const SQK_CAPSULE_PITY = 20; // pityCounter >= 19 -> hasil minimal rare
const SQK_RARITY_NAMES = ['common', 'rare', 'epic', 'legendary'];
const SQK_SEL = {
  buyWithPermit: '0x01a833fb', commitCapsule: '0x4dd52bb4', resolveCapsule: '0x6172f59f',
  prizePool: '0x719ce73e', seasonEnd: '0xe757b20d', sweepAvailableAt: '0xfa9b12a5', isSwept: '0xc31cb3da',
  itemPrice: '0xadcb005c', balanceOfItem: '0x4496166b', pityCounter: '0x175c2792', nextPullId: '0x6cb9e7ee',
  pulls: '0x7a9dfa7e', // v42.5.4: pulls(uint256) -> (player, targetRound, resolved); keccak256("pulls(uint256)")[:4], verified live vs shop
  balanceOf: '0x70a08231', allowance: '0xdd62ed3e', nonces: '0x7ecebe00', name: '0x06fdde03', domainSeparator: '0x3644e515',
};
const SQK_PERMIT_TYPEHASH = '0x6e71edae'; // keccak("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
const SQK_CAPSULE_COMMITTED_TOPIC0 = '0xfcdae1bdc0120a94c455ae8babdec61a16a600fcf9f786fd9d0a4b46c835bc25';
const SQK_CAPSULE_RESOLVED_TOPIC0 = '0xb1190a79761e5e0820f774b1613ed3b5022912a9aa445806273a260a8527a502';
const SQK_SEPOLIA_CHAIN_ID = 11155111;
const SQK_ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
function sqkShopDeployed() { return isAddr(CONFIG.SHOP_ADDRESS) && CONFIG.SHOP_ADDRESS.toLowerCase() !== SQK_ZERO_ADDRESS; }
function sqkShopItem(id) { return SQK_SHOP_CATALOG.find(c => c.id === id) || null; }
// Split in milli-SQK (integers, no floats): 5 SQK -> 3500/1500, 2 SQK -> 1400/600.
function sqkSplitMilli(priceSqk) { const m = Math.round(priceSqk * 1000); return { ownerMilli: m * 70 / 100, poolMilli: m * 30 / 100 }; }
// Capsule rarity from a uniform r in [0,1) + pity counter (contract rule).
function sqkCapsuleRarity(r, pityCounter) {
  if (!(r >= 0 && r < 1)) return null;
  if (pityCounter >= SQK_CAPSULE_PITY - 1 && r < 0.7) return 'rare';
  if (r < 0.7) return 'common';
  if (r < 0.92) return 'rare';
  if (r < 0.99) return 'epic';
  return 'legendary';
}
// EIP-2612 permit domain for the SQK token. name is read live via
// name() (on-chain: "Squeek"); version "1" is VERIFIED: the domain
// separator computed from ("Squeek","1",11155111,token) equals the
// token's on-chain DOMAIN_SEPARATOR()
// 0x2cc99df9c423e838a7b45ff60b5ee38ad122ea209dca8da37a8d2f3befdf0017
// (checked live 2026-11-08). Fallback name "Squeek" if the read fails.
function sqkPermitDomain(tokenName) {
  return { name: tokenName || 'Squeek', version: '1', chainId: SQK_SEPOLIA_CHAIN_ID, verifyingContract: CONFIG.SQK_TOKEN };
}
const DIFFICULTIES = { easy: { speed: 350, density: 0.4, chord: 0.0 }, normal: { speed: 480, density: 0.7, chord: 0.1 }, hard: { speed: 600, density: 0.9, chord: 0.25 } };
const GENRES = { cyber: { scales: ['Phrygian', 'Harmonic Minor', 'Minor Pentatonic', 'Aeolian', 'Blues'], bpm: 120 }, synth: { scales: ['Dorian', 'Major Pentatonic', 'Lydian', 'Major'], bpm: 100 }, chip: { scales: ['Major Pentatonic', 'Dorian', 'Mixolydian', 'Blues'], bpm: 140 }, void: { scales: ['Phrygian', 'Harmonic Minor', 'Aeolian', 'Blues'], bpm: 150 } }; // v33: 10 scales, 4-5 per genre (was 5 total) — songs stop feeling the same
let currentDiff = 'easy', currentGenre = 'cyber';

function bindToggle(rowId, attr, cb, guard) { document.querySelectorAll(`#${rowId} .btn-diff`).forEach(b => b.addEventListener('click', () => { if (guard && !guard(b.dataset[attr])) return; document.querySelectorAll(`#${rowId} .btn-diff`).forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('active'); b.setAttribute('aria-pressed', 'true'); cb(b.dataset[attr]); })); }
bindToggle('diffRow', 'diff', v => { currentDiff = v; preview(); });
bindToggle('genreRow', 'genre', v => { currentGenre = v; preview(); }, v => {
  if (v === 'void' && playerLevel(currentWallet()) < 5) { say(msg('voidLock'), 'pink'); return false; }
  return true;
});

// v40: cyrb53 + rng (Mulberry32) kini hidup di engine.js (SqueekEngine) —
// satu sumber kebenaran untuk client dan Worker (verifikasi replay).
// Alias ini menjaga semua pemakaian lama (dailySpec, dailyMissions,
// avatar, headerSeed, makeAnthem) tetap jalan tanpa perubahan.
const cyrb53 = SqueekEngine.cyrb53;
const rng = SqueekEngine.mulberry32;
const seedOf = w => cyrb53((w || 'GUEST').toLowerCase());
// v34 THEMES — one look per mode, so no two modes feel the same. Reference:
// the official Squeekchain pixel art (blue pixel grid, yellow pixel hamster,
// chunky pixel font) — the grid + the hamster note carry that language in-game.
const THEMES = {
  cyber:   { name: 'CYBER',   bg: ['#0a161a', '#050607'], grid: 'rgba(0,229,255,.07)',  lane: '#00ffff', hit: '#00ff00', pulse: '#00e5ff', notes: ['#ff00ff', '#00ffff', '#ffff00', '#ff8800'], accent: '#00e5ff', glow: 'rgba(0,229,255,.28)' },
  sunrise: { name: 'SUNRISE', bg: ['#1a1206', '#0a0703'], grid: 'rgba(255,176,32,.08)',  lane: '#ffb020', hit: '#ffd700', pulse: '#ffb020', notes: ['#ffd700', '#ff8800', '#ff5ce1', '#00e5ff'], accent: '#ffb020', glow: 'rgba(255,176,32,.28)' },
  wheel:   { name: 'WHEEL',   bg: ['#061a12', '#040805'], grid: 'rgba(0,255,136,.08)',  lane: '#00ff88', hit: '#00ff88', pulse: '#00ff88', notes: ['#00ff88', '#00e5ff', '#a8ff00', '#ff5ce1'], accent: '#00ff88', glow: 'rgba(0,255,136,.28)' },
  versus:  { name: 'VERSUS',  bg: ['#1a0612', '#08030a'], grid: 'rgba(255,0,255,.08)',   lane: '#ff00ff', hit: '#ff2e63', pulse: '#ff00ff', notes: ['#ff2e63', '#ff00ff', '#ffd700', '#00e5ff'], accent: '#ff2e63', glow: 'rgba(255,46,99,.30)' },
  calm:    { name: 'CALM',    bg: ['#0a1220', '#05070d'], grid: 'rgba(120,160,255,.07)', lane: '#7aa0ff', hit: '#7aa0ff', pulse: '#7aa0ff', notes: ['#7aa0ff', '#a8c8ff', '#5ce1e6', '#c8a8ff'], accent: '#7aa0ff', glow: 'rgba(122,160,255,.28)' },
  void:    { name: 'VOID',    bg: ['#12061f', '#07030d'], grid: 'rgba(160,80,255,.09)',  lane: '#a050ff', hit: '#c050ff', pulse: '#a050ff', notes: ['#a050ff', '#ff5ce1', '#7a50ff', '#ff8800'], accent: '#a050ff', glow: 'rgba(160,80,255,.30)' },
  gold:    { name: 'GOLD',    bg: ['#1a1506', '#0a0803'], grid: 'rgba(255,215,0,.08)',   lane: '#ffd700', hit: '#ffd700', pulse: '#ffd700', notes: ['#ffd700', '#ffb020', '#fff0a8', '#ff8800'], accent: '#ffd700', glow: 'rgba(255,215,0,.28)' }
};
function themeKeyFor(mode, boss) { if (boss) return 'void'; if (mode === 'daily') return 'sunrise'; if (mode === 'live') return 'wheel'; if (mode === 'race') return 'versus'; if (mode === 'challenge') return 'gold'; return 'cyber'; }

// v40: lagu + chart dibangun oleh engine.js (SqueekEngine.buildChart) —
// satu sumber kebenaran untuk client dan Worker (verifikasi replay).
// Audio (drums -> tone/kick/noise di schedule()) tetap di script.js.
// seedKey di sini adalah string sumber seed chart (seed sesi TIDAK dipakai
// untuk chart — lihat engine.js aturan 1). practice=true menerapkan
// penskalaan tempo 60% di dalam buildChart (dulu blok manual di play()).
function makeAnthem(wallet, randomize = false, seedOverride = null, lanes = 3, mirror = false, practice = false) {
  const seedKey = seedOverride || (wallet || 'GUEST').toLowerCase();
  const header = { seedKey, genre: currentGenre, diff: currentDiff, lanes: lanes === 4 ? 4 : 3, mirror: !!mirror, practice: !!practice };
  if (randomize && !seedOverride) header.seedNum = cyrb53(seedKey) + Math.floor(Math.random() * 999999);
  return SqueekEngine.buildChart(header);
}

// ==========================================
// 3. AUDIO ENGINE (INTRO & GAMEPLAY)
// ==========================================
let ac = null, master = null, analyser = null, noiseBuf = null, audioDataArray = null;
let introInterval = null; // v38: introOsc/introGain were dead (declared + reset, never assigned a node) — removed

async function initAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw new Error('Audio unsupported');
    ac = new AC({ latencyHint: 'interactive' });
    master = ac.createGain(); master.gain.value = muted ? 0 : (vol / 100) * 0.4; // v30: volume slider (vol is a `let` declared below; initAudio only runs after user interaction, so it is initialized by then)
    analyser = ac.createAnalyser(); analyser.fftSize = 64; audioDataArray = new Uint8Array(analyser.frequencyBinCount);
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(analyser); analyser.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * .3, ac.sampleRate); const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state !== 'running') await ac.resume();
}

// INTRO MUSIC: 2 MODES — CALM 100 BPM (soft, pleasant to loop) and
// HYPE 128 BPM (catchy, power chord, double-kick, all notes >=220 Hz).
// Default HYPE. Switch modes anytime with 1 tap.
const INTRO_MODES = {
  santai: { bpm: 100, lead: [72, 76, 79, 81, 79, 76, 72, 76, 74, 77, 81, 84, 81, 77, 74, 77], bass: [48, 48, 45, 43, 48, 48, 45, 43, 48, 48, 45, 43, 41, 43, 45, 48], leadType: 'triangle', leadVol: 0.10, bassType: 'triangle', bassVol: 0.20, kickSteps: [0, 8], snare: false, hatVol: 0.02, pad: true, label: 'CALM 100 BPM' },
  seru: { bpm: 128, lead: [72, 79, 76, 81, 79, 76, 74, 79, 72, 79, 81, 84, 81, 79, 76, 74], bass: [48, 48, 45, 43, 48, 48, 50, 43, 48, 48, 45, 43, 41, 43, 45, 48], leadType: 'square', leadVol: 0.12, bassType: 'sawtooth', bassVol: 0.22, kickSteps: [0, 4, 8, 12, 14], snare: true, hatVol: 0.04, pad: false, label: 'HYPE 128 BPM' }
};
let introMode = 'seru';
let introStep = 0, introNextTime = 0;
function introCfg() { return INTRO_MODES[introMode]; }
function scheduleIntro() {
    if (!ac || muted) return;
    const cfg = introCfg(), stepDur = 60 / cfg.bpm / 4;
    while (introNextTime < ac.currentTime + 0.18) {
        const s = introStep % 16, t = introNextTime;
        tone(mtof(cfg.lead[s]), t, cfg.leadType, cfg.leadVol, stepDur * 1.4);
        if (introMode === 'seru') tone(mtof(cfg.lead[s] + 7), t, 'sawtooth', 0.06, stepDur * 1.2);
        tone(mtof(cfg.bass[s]), t, cfg.bassType, cfg.bassVol, stepDur * 1.8);
        if (cfg.pad && (s === 0 || s === 8)) { tone(mtof(60), t, 'triangle', 0.04, stepDur * 8); tone(mtof(64), t, 'triangle', 0.04, stepDur * 8); tone(mtof(67), t, 'triangle', 0.04, stepDur * 8); }
        if (cfg.kickSteps.includes(s)) kick(t);
        if (cfg.snare && (s === 4 || s === 12)) noise(t, 1500, 0.25, 0.12);
        if (s % 2 === 1) noise(t, 7000, cfg.hatVol, 0.03);
        introStep++; introNextTime += stepDur;
    }
}
function updateMusicModeBtn() { const b = $('musicModeBtn'); if (b) b.textContent = (lang === 'id' ? 'MUSIK: ' : 'MUSIC: ') + introCfg().label + ' ' + msgf('musicTapFor', { other: introMode === 'seru' ? 'CALM' : 'HYPE' }); }
function setIntroMode(m) {
    introMode = m; updateMusicModeBtn();
    if (introInterval) { stopIntroMusic(); if (ac && ac.state === 'running' && !muted) playIntroMusic(); }
    if ($('mainPanel') && !$('mainPanel').classList.contains('hidden')) say(msgf('musicIntro', { label: introCfg().label }), 'green');
}
function playIntroMusic() {
    if (!ac || muted) return;
    if (introInterval) return; // sudah jalan — jangan dobel
    stopIntroMusic();
    introStep = 0; introNextTime = ac.currentTime + 0.05;
    introInterval = setInterval(scheduleIntro, 40);
    updateMusicModeBtn();
    if ($('mainPanel') && !$('mainPanel').classList.contains('hidden')) say(msgf('introOn', { label: introCfg().label }), 'green');
}

function stopIntroMusic() {
    if (introInterval) { clearInterval(introInterval); introInterval = null; }
    introStep = 0;
}

function toggleMute() { 
    muted = !muted; 
    applyVol(); // v30: mute now goes through the volume slider value instead of a fixed 0.4
    const b = $('muteBtn'); if (b) { b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(muted)); } 
    if (!muted && !G) playIntroMusic(); else if (muted) stopIntroMusic(); // v26: unmute di tengah game JANGAN nyalakan intro di atas lagu
    return muted; 
}

// --- v30 TOTAL: volume slider (0–100, persisted; master gain = vol% of 0.4) ---
let vol = loadJSON('sqk30:vol', 80);
function applyVol() { if (master) master.gain.value = muted ? 0 : (vol / 100) * 0.4; const v = $('volVal'); if (v) v.textContent = vol + '%'; const s = $('volSlider'); if (s && +s.value !== vol) s.value = vol; const pv = $('pauseVolVal'); if (pv) pv.textContent = vol + '%'; const ps = $('pauseVolSlider'); if (ps && +ps.value !== vol) ps.value = vol; } // v38: also syncs the pause-menu slider/label

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, a, p, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d) }
function tone(f, t, ty, p, d) { if (!ac || muted) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = ty; o.frequency.setValueAtTime(f, t); o.connect(g); g.connect(master); env(g, t, .004, p, d); o.start(t); o.stop(t + d + .05) }
function kick(t) { if (!ac || muted) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + .12); o.connect(g); g.connect(master); env(g, t, .002, .9, .18); o.start(t); o.stop(t + .25) }
function noise(t, hp, p, d) { if (!ac || muted) return; const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp; s.connect(f); f.connect(g); g.connect(master); env(g, t, .001, p, d); s.start(t); s.stop(t + d + .05) }
function getAudioLevel() { if (!analyser || muted) return 0; if (!audioDataArray) audioDataArray = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(audioDataArray); let s = 0; for (let i = 0; i < audioDataArray.length; i++) s += audioDataArray[i]; return (s / audioDataArray.length) / 255; }

// Musik mulai di ketukan pertama (browser memblokir autoplay suara sebelum interaksi).
// Tombol splash di atas adalah ketukan itu — jadi musik terasa "muncul saat dibuka".
function hideMusicSplash() { const s = $('musicSplash'); if (s) s.classList.add('hidden'); }
async function startMusicFromTap(mode) {
    if (mode) introMode = mode;
    try { await initAudio(); } catch (_) {}
    hideMusicSplash(); updateMusicModeBtn();
    if (ac && ac.state === 'running') playIntroMusic();
    else if ($('mainPanel') && !$('mainPanel').classList.contains('hidden')) say(msgf('audioTap', { state: ac ? ac.state : 'NONE' }), 'pink');
}
window.addEventListener('pointerdown', () => { startMusicFromTap(); }, {once: true});
bindClick('startMusicBtn', () => { startMusicFromTap('seru'); });
bindClick('startMusicSantaiBtn', () => { startMusicFromTap('santai'); });
bindClick('musicModeBtn', () => { setIntroMode(introMode === 'seru' ? 'santai' : 'seru'); });
window.addEventListener('load', () => { initAudio().then(() => { if (ac && ac.state === 'running') { hideMusicSplash(); playIntroMusic(); } }).catch(() => {}); });

// ==========================================
// 4. GAME ENGINE
// ==========================================
const cv = $('game-canvas'), cx = cv.getContext('2d');
const GW = 360, GH = 540, LANES = 3; let LW = GW / LANES; // v28: LW changes per song (4-lane mode)
function fitCanvas(c, ctx, w, h, scale) { const d = scale || Math.min(2, window.devicePixelRatio || 1); c.width = Math.floor(w * d); c.height = Math.floor(h * d); c.style.width = '100%'; c.style.height = 'auto'; c.style.aspectRatio = `${w}/${h}`; ctx.setTransform(d, 0, 0, d, 0, 0); }
fitCanvas(cv, cx, GW, GH);

let G = null, raf = 0, sched = 0, anthem = null, floatTexts = [];
function loadBest(w) { try { return JSON.parse(localStorage.getItem('sqk20:' + (w || 'GUEST').toLowerCase()) || 'null') } catch { return null } }
function saveBest(w, rec) { try { localStorage.setItem('sqk20:' + (w || 'GUEST').toLowerCase(), JSON.stringify(rec)); return true; } catch (e) { return false; } }
const songTime = () => ac ? ac.currentTime - G.start : 0;

// --- v39 REPLAY RECORDER v1 (tanpa enforcement) ---
// Format replay mengikuti kontrak worker Fase 1 (worker.js): {v:1, header,
// events:{inputs, polls, golden, finish}, claim}. Hash = SHA-256 atas
// canonical JSON (key diurutkan rekursif) — HARUS sama persis dengan
// canonical() di worker, atau server menolak dengan "replayHash mismatch".
// Semua waktu t = song-time (detik, audio time ac.currentTime - G.start),
// BUKAN event.timeStamp, BUKAN wall clock. Fail-soft: semua perekaman
// dibungkus try/catch — bila gagal, replay dibuang dan submit tetap jalan
// tanpa replay (jalur verified=0 seperti sebelumnya).
function canonicalJSON(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJSON).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonicalJSON(v[k])).join(',') + '}';
}
async function replayHashOf(rep) {
  const data = new TextEncoder().encode(canonicalJSON(rep));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return '0x' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
// v42.4: Song-time detik, presisi 4 desimal, MENTAH (boleh negatif).
// LEAD_IN 2 detik sebelum lagu mulai memberi song-time negatif, dan
// judge() memakai songTime() mentah — jadi rekaman HARUS mentah juga,
// atau replay tidak mereproduksi judge() (bug v42.3: tap lead-in dijepit
// jadi t=0, engine menilainya PERFECT padahal client MISS → Worker
// menolak dengan "simulated score mismatch"). Presisi 4 desimal (±0,05 ms)
// supaya not yang jatuh <0,5 ms dari tepi jendela tidak terbalik.
function replaySongT() { return +songTime().toFixed(4); }
function recordReplayInput(lane, t) {
  try {
    if (!replay || !G || G.ended) return;
    // v42.5.3: t opsional — bila judge() memberi satu sampel songTime(),
    // pakai itu (jangan panggil songTime() lagi) supaya rekaman dan judgement
    // memakai waktu yang sama persis.
    if (replay.events.inputs.length < anthem.chart.length + REPLAY_MAX_EXTRA_INPUTS) replay.events.inputs.push({ t: (typeof t === 'number' ? +t.toFixed(4) : replaySongT()), lane });
  } catch (_) {}
}
function recordReplayPoll(s) {
  try {
    if (!replay || !G || G.ended) return;
    if (replay.events.polls.length >= REPLAY_MAX_POLLS) return;
    // Poll GAGAL ikut direkam (ok:false, rpm/dist null) — poll gagal = zoomies mati.
    replay.events.polls.push({ t: replaySongT(), rpm: s && s.ok ? +s.rpm.toFixed(3) : null, dist: s && s.ok ? +s.dist.toFixed(3) : null, ok: !!(s && s.ok) });
  } catch (_) {}
}
function recordReplayGolden(note, st) {
  try {
    if (!replay || !G || !anthem) return;
    // Satu entri per golden note, saat muncul. Bila kena, TIDAK ada entri
    // kedua — entri yang sama ini yang dipakai verifikasi.
    replay.events.golden.push({ t: +st.toFixed(4), index: anthem.chart.indexOf(note) }); // v42.4: mentah seperti replaySongT (pick golden saat lead-in nyaris mustahil, tapi konsistensi lebih murah daripada pengecualian)
  } catch (_) {}
}

async function play() {
  if (G && !G.ended) return say(msg('gameRunning'), 'cyan');
  analyticsEvent('play'); analyticsEvent('mode_' + playMode); // v42.5 (P2-5)
  // v39: BUG FIX — liveZoomies di-reset di AWAL play(), sebelum lagu mulai.
  // Sebelumnya flag ini hanya di-reset di finish()/stop(), jadi sisa ZOOMIES
  // dari lagu sebelumnya bisa bocor ke lagu berikutnya. replay lama dibuang.
  liveZoomies = false; replay = null;
  const w = $('walletInput').value.trim();
  if (w && !isAddr(w)) { $('walletInput').classList.add('invalid'); return say(msg('invalidWallet'), 'pink'); }
  $('walletInput').classList.remove('invalid');
  saveWallet38(w); // v38: the typed wallet is remembered when a song starts
  try { await initAudio(); stopIntroMusic(); } catch (e) { return say(msgf('audioFail', { err: String(e.message || e).slice(0, 60) }), 'pink'); }
  // v27 LIVE: sample the real wheel right before the song is built — the tempo
  // IS the hamster's tempo at this moment. If the wheel is offline, the song
  // still starts on a 128 BPM fallback and says so (never fake live data).
  // v29: RACE uses the same live tempo (the race is against the live wheel).
  let liveStart = null;
  if (playMode === 'live' || playMode === 'race') {
    say(msg('fetchingWheel'), 'cyan');
    liveStart = await refreshLive();
    if (!liveStart.ok) say(msg('wheelOffline'), 'pink');
  }
  // v42.5 GHOST: bila roda offline atau hamster tidur (RPM 0) saat lagu
  // dimulai, lawan RACE jadi simulasi dengan pace rata-rata siang 7 hari.
  // Dilabeli SIMULASI di mana-mana — jangan pernah pura-pura live.
  let ghostPace = null;
  if (playMode === 'race' && (!liveStart || !liveStart.ok || liveStart.rpm <= 0)) {
    ghostPace = await fetchGhostPace();
    say(msgf('ghostPaceTpl', { pace: ghostPace.toFixed(2) }), 'yellow');
  }
  // v38 SESSION: ask the leaderboard Worker for a verified session before
  // the song is built. FREE mode plays the server seed; other modes keep
  // their deterministic seed (same song for everyone / duel replay) and
  // only carry the sessionId. Offline/failure = local seed, no sessionId —
  // the score still submits, as unverified.
  let session38 = null;
  // v39 B2: FREE — pakai ulang sesi preview bila masih valid (belum dipakai,
  // belum kedaluwarsa, wallet sama). Satu sesi = satu play; sesi yang dipakai
  // di sini ditandai used supaya play kedua tidak memakai sesi yang sama
  // (Worker menolak sesi used — skor kedua akan unverified). Bila tidak ada
  // sesi preview yang valid, ambil sesi baru seperti dulu. Mode non-FREE
  // selalu ambil sesi baru seperti dulu (sesi preview hanya ada untuk FREE).
  if (playMode === 'free' && previewSessionValid(previewSession) && (previewSession.wallet || 'guest') === (w || 'GUEST').toLowerCase()) {
    session38 = previewSession;
    previewSession.used = true;
  } else {
    try {
      const sr = await tfetch(CONFIG.LB_URL + '/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: w || 'GUEST', mode: playMode }) }, 5000);
      if (sr.ok) { const sj = await sr.json(); if (sj && sj.sessionId) session38 = sj; }
    } catch (_) { session38 = null; }
  }
  const seedKey = playMode === 'free' && session38 && session38.seed !== undefined && session38.seed !== null && String(session38.seed).length ? 'FREE-' + String(session38.seed) : seedKeyFor(playMode);
  // v39: seed numerik sesi (uint32) untuk header replay. Worker menuntut
  // header.seed == seed sesi bila sessionId ikut dikirim — bila tidak ada
  // sesi (offline), turunkan deterministik dari seedKey (cyrb53 % 2^32).
  const sessionSeed = session38 && Number.isInteger(session38.seed) && session38.seed >= 0 && session38.seed <= 4294967295 ? session38.seed : null;
  const headerSeed = sessionSeed !== null ? sessionSeed : (cyrb53(seedKey) % 4294967296);
  if (playMode === 'daily') applyDailySpec(); // v28: daily genre+diff come from the date, not the selection
  if (playMode === 'boss') { const bs = weeklySpec(); currentGenre = bs.genre; currentDiff = 'hard'; syncGenreDiffButtons(); } // v29: weekly boss is always HARD
  if (playMode === 'lullaby') { currentGenre = 'synth'; currentDiff = 'easy'; syncGenreDiffButtons(); } // v42.5: Lullaby selalu synth/easy 60% tempo
  const lanes = lanesForSong(), mirror = mirrorForSong();
  anthem = makeAnthem(w, false, seedKey, lanes, mirror, practiceMode); lastAnthem = anthem; hitOffsets = []; CONFIG.SPEED = DIFFICULTIES[currentDiff].speed; applyHue(anthem.hue);
  const lh0 = $('lastHit'), ah0 = $('avgHit'), hd0 = $('hitDir'); if (lh0) lh0.textContent = '-- ms'; if (ah0) ah0.textContent = '-- ms'; if (hd0) hd0.textContent = '—'; // v36.1: the precision readout reset with the game — the previous game's last/avg offsets no longer linger until the first tap (smoke test 2026-11-07)
  // v29 PRACTICE: 60% tempo, no XP/streak/history. v40: penskalaan waktu
  // (bpm/step/durasi/chart/drums) kini di dalam buildChart (practice=true
  // di atas) — di sini tinggal SPEED, yang hanya soal rendering.
  if (practiceMode) { CONFIG.SPEED = Math.round(CONFIG.SPEED * 0.6); }
  LW = GW / lanes; // v28: 4-lane mode widens the highway per lane
  const kh = document.querySelector('.kbd-hint'); if (kh) kh.textContent = lanes === 4 ? msg('kbd4') : msg('kbd3');
  glSeed = w ? Math.abs(cyrb53(w) % 1000) / 100 : Math.random() * 10;
  glShockwave = 1.0; // Shockwave saat mulai

  G = { wallet: w, start: ac.currentTime + CONFIG.LEAD_IN, next: 0, score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 }, fx: [], flash: Array(lanes).fill(0), glitchT: 0, ended: false, paused: false, taps: 0, sessionId: session38 ? session38.sessionId : null, sessionSeed, chartIdx: 0, mode: playMode, seedKey, genre: currentGenre, diff: currentDiff, lanes, mirror, fever: false, practice: practiceMode || playMode === 'lullaby', lullaby: playMode === 'lullaby', live: (playMode === 'live' || playMode === 'race') ? { rpm: liveStart ? liveStart.rpm : 0, dist: liveStart ? liveStart.dist : 0, offline: !(liveStart && liveStart.ok), peakRpm: liveStart ? liveStart.rpm : 0, zoomiesEver: false } : null, race: playMode === 'race' ? { startDistKm: liveStart && liveStart.ok ? liveStart.dist : 0, offline: !(liveStart && liveStart.ok), playerDist: 0, roundKey: roundKeyFor(new Date()), goldenNote: null, ghost: ghostPace !== null, ghostPaceMs: ghostPace || 0, wokeUp: false } : null, boss: playMode === 'boss', noteSkin: shopSkin().note };
  // v39: snapshot lagu yang SEDANG dimainkan (state, bukan DOM) + keadaan
  // zoomies saat lagu mulai. Panel hasil & kartu hasil membaca dari sini —
  // nama lagu di panel tidak boleh lagi datang dari innerText.
  G.song = { name: anthem.name, key: anthem.key, scaleName: anthem.scaleName, bpm: anthem.bpm, notes: anthem.chart.length };
  const snapZoom = (playMode === 'live' || playMode === 'race') && !!(liveStart && liveStart.ok && liveStart.rpm >= ZOOMIES_RPM);
  liveZoomies = snapZoom; // v39: zoomies saat lagu mulai (poll pertama baru 5 detik lagi; judge() butuh nilai benar dari tap pertama)
  try {
    replay = {
      v: 1,
      header: { wallet: w || 'GUEST', mode: G.mode, seedKey: G.seedKey, seed: headerSeed, genre: G.genre, diff: G.diff, lanes: G.lanes, mirror: G.mirror, practice: G.practice, offsetMs: Math.max(-150, Math.min(150, offsetMs)), wallStartMs: Date.now(), duration: +anthem.duration.toFixed(3), initialZoomies: snapZoom, initialDistKm: (liveStart && liveStart.ok) ? +liveStart.dist.toFixed(3) : 0, ghost: (G.mode === 'race' && !!(G.race && G.race.ghost)), ghostPaceMs: (G.race && G.race.ghost) ? +G.race.ghostPaceMs.toFixed(3) : 0 },
      events: { inputs: [], polls: [], golden: [] },
      claim: null
    };
  } catch (_) { replay = null; }
  const themeKey = themeKeyFor(playMode, G.boss); G.theme = THEMES[themeKey]; document.body.dataset.theme = themeKey; // v34: one look per mode
  try { const cg = cx.createLinearGradient(0, 0, 0, GH); cg.addColorStop(0, G.theme.bg[0]); cg.addColorStop(1, G.theme.bg[1]); G.bgGrad = cg; } catch (_) {} // v34: theme gradient background (was the anthem hue)
  if (playMode === 'challenge' && (challengeLanes === 4 || challengeMirror)) say(msgf('duelUnlock', { mods: (challengeLanes === 4 ? '4 LANES ' : '') + (challengeMirror ? 'MIRROR ' : '') }), 'yellow');
  floatTexts = [];
  show('gamePanel'); document.body.classList.add('playing'); pauseGL(); closeSettings(); // v32: freeze decorations + WebGL while playing (lag fix)
  const emPlay = $('cardErrMsg'); if (emPlay) emPlay.classList.add('hidden'); // v33.1: a stale card error must not survive into the next game
  $('gamePanel').scrollIntoView({ behavior: 'auto', block: 'start' }); // v33: no more manual scroll to find the score + lanes
  setText('bpmVal', anthem.bpm); setText('gameAudioStatus', msgf('gameAudioTpl', { run: msg('audioRunning'), bpm: anthem.bpm, state: ac ? ac.state : '-', practice: practiceMode ? msg('practiceTag2') : '' })); hud();
  stopMenuPoll(); // v29: the menu poll pauses while a game runs
  if (playMode === 'live') { const lh = $('liveHud'); if (lh) lh.classList.remove('hidden'); updateLiveHud(); startLivePoll(5000); }
  else if (playMode === 'race') { const lh = $('liveHud'); if (lh) lh.classList.add('hidden'); const rh = $('raceHud'); if (rh) rh.classList.remove('hidden'); updateRaceHud(); startLivePoll(5000); startRaceTick(); }
  else { const lh = $('liveHud'); if (lh) lh.classList.add('hidden'); }
  setText('pauseBtn', msg('pauseBtn'));
  disarmPauseExit(); // v38: a TERMINATE tap armed in the previous game must not survive
  clearInterval(sched); sched = setInterval(schedule, 25);
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  cv.focus({ preventScroll: true });
}

function schedule() {
  if (!G || G.paused || G.ended || !ac) return;
  const ahead = ac.currentTime + .15;
  while (G.next < anthem.drums.length && G.start + anthem.drums[G.next].t < ahead) {
    const d = anthem.drums[G.next], t = G.start + d.t;
    const stepInBar = G.next % 16, barNo = Math.floor(G.next / 16);
    if (d.kick) kick(t); if (d.hat) noise(t, 7000, .08, .04); if (d.snare) noise(t, 1500, .35, .12);
    if (d.bass !== null) tone(mtof(36 + anthem.root + anthem.scale[d.bass]), t, 'triangle', .35, anthem.step * 7);
    // v26-musik: lapisan punk di semua difficulty — bass 8th-note + riff lead dari scale anthem
    if (stepInBar % 2 === 0) tone(mtof(36 + anthem.root), t, 'sawtooth', 0.16, anthem.step * 1.5);
    if (stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14) {
      const riffDeg = [7, 5, 4, 7, 5, 3, 2, 4][barNo % 8];
      const riffMidi = 72 + anthem.root + anthem.scale[riffDeg % anthem.scale.length];
      tone(mtof(riffMidi), t, 'square', 0.10, anthem.step * 1.5);
      tone(mtof(riffMidi + 7), t, 'sawtooth', 0.05, anthem.step * 1.5);
    }
    G.next++;
  }
}

function addFloatText(txt, color, x) { floatTexts.push({ txt, color, x: x === undefined ? GW / 2 : x, y: 250, life: 1.0 }); } // v33: judgement text pops at the hit lane, not always dead-center

function judge(lane) {
  if (!G || G.ended || G.paused || !ac) return;
  if (lane < 0 || lane >= G.lanes) return; // v28: lane 3 only exists in 4-lane songs
  G.taps++; // v38: every tap that reaches the game counts (hit, empty tap or miss alike)
  // v42.5.3: SATU sampel songTime() per tap — dipakai untuk rekaman input DAN
  // perhitungan st. Dulu recordReplayInput() memanggil songTime() sendiri lalu
  // st memanggilnya lagi; audio clock terus jalan di antara kedua panggilan,
  // sehingga replay tidak mereproduksi judge() persis. Guard raw-expiry di
  // bawah membuat judgement menjadi fungsi murni dari (chart, input, offset)
  // — persis yang dimodelkan engine — dan menutup zona ambigu tap lambat
  // raw dt (0.135, 0.175] yang dulu hasilnya bergantung timing frame rAF:
  // GHOST race 34720 ditolak server karena satu note (idx 56, t=28.0952)
  // dipukul tap lambat t=28.2347 (raw dt +0.1395) — client GOOD, engine MISS.
  const raw = songTime();
  recordReplayInput(lane, raw);
  const st = raw - offsetMs / 1000; // v28: PRECISION offset — judge the tap as if it came offsetMs earlier
  let target = null, bd = Infinity;
  for (const n of anthem.chart) {
    if (n.judged || n.lane !== lane) continue;
    if (n.t - st > CONFIG.W.good + 0.05) break;
    const dt = Math.abs(n.t - st); if (dt < bd) { bd = dt; target = n; }
  }
  G.flash[lane] = 1;
  glShockwave = 0.5; // Shockwave kecil tiap tap
  if (!target || bd > CONFIG.W.good) return;
  if (raw - target.t > CONFIG.W.good) return; // v42.5.3: raw-expiry guard — note yang sudah lewat batas kedaluwarsa mentahnya (raw songTime - n.t > W.good) tidak boleh dipukul, walau st ber-offset masih di dalam jendela; tanpanya tap lambat di zona (W.good, W.good + offsetMs] kadang GOOD (frame loop belum menandai miss) kadang MISS — engine selalu menolaknya
  updatePrecision((st - target.t) * 1000, 'hit'); // v28: positive = player tapped LATE (matches the LATE/EARLY label)
  const k = bd <= CONFIG.W.perfect ? 'perfect' : bd <= CONFIG.W.great ? 'great' : 'good';
  target.judged = k; G.counts[k]++; G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
  G.fever = G.combo >= 30; // v29 FEVER: combo 30+ = x1.5 score until the combo breaks
  const mult = Math.min(2, 1 + Math.floor(G.combo / 10) * .1) * (liveZoomies ? 2 : 1) * (G.fever ? 1.5 : 1); // v27 LIVE: ZOOMIES (70+ RPM) doubles all scores while it lasts
  G.score += Math.round({ perfect: 300, great: 200, good: 100 }[k] * mult);
  try { if (navigator.vibrate) navigator.vibrate(k === 'perfect' ? 12 : 6); } catch (_) {} // v30: haptic on mobile hits
  // v29 RACE: every hit moves you forward; a GOLDEN NOTE pays +1000 pts and +5 m.
  if (G.race) G.race.playerDist += { perfect: 1.0, great: 0.7, good: 0.4 }[k];
  if (G.race && G.race.goldenNote === target) { G.score += 1000; G.race.playerDist += 5; G.race.goldenNote = null; addFloatText('GOLDEN NOTE! +1000', '#ffd700'); tone(mtof(target.midi + 12), ac.currentTime, 'square', .25, .3); }
  if (G.combo === 30) addFloatText('FEVER! x1.5', '#ffd700');
  tone(mtof(target.midi), ac.currentTime, 'sawtooth', k === 'perfect' ? .22 : .15, .22); // v26-musik: hit note sawtooth, lebih galak
  const jcol = k === 'perfect' ? '#00ff00' : k === 'great' ? '#00e5ff' : '#ffe14d';
  addFloatText(k === 'perfect' ? 'PERFECT!' : k === 'great' ? 'GREAT!' : 'GOOD', jcol, lane * LW + LW / 2); // v33: every hit shows its judgement at the lane
  if (k === 'perfect') juiceHit('perfect');
  else if (G.combo > 0 && G.combo % 10 === 0) addFloatText(`COMBO x${G.combo}!`, '#00ffff');
  if (G.combo === 25 || G.combo === 50 || G.combo === 100) addFloatText(`COMBO x${G.combo}!!`, '#ffff00');
  for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 180; G.fx.push({ x: lane * LW + LW / 2, y: CONFIG.HIT_Y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: .5, s: 6, c: k === 'perfect' ? '#00ff00' : k === 'great' ? '#00e5ff' : '#ffe14d' }) } // v33: 14 bigger particles (was 8 tiny ones)
  G.fx.push({ type: 'ring', x: lane * LW + LW / 2, y: CONFIG.HIT_Y, r: 10, life: .35, c: k === 'perfect' ? '#00ff00' : '#00e5ff' }); // v33: shockwave ring, in-canvas (WebGL is paused while playing)
  hud();
}

let lastLoopTs = 0, lastVizTs = 0; // v32: viz + analyser update at most every 100ms (was every frame)
function loop(ts) {
  if (!G || G.ended) return;
  if (G.paused) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, lastLoopTs ? (ts - lastLoopTs) / 1000 : 1 / 60);
  lastLoopTs = ts;
  if (ts - lastVizTs > 100) { lastVizTs = ts; glAudio = getAudioLevel(); updateViz(); }
  glCombo = G.combo;
  const st = songTime();
  // v29 GOLDEN NOTE: when a 10-minute round boundary passes mid-song, the next
  // unjudged note turns golden. The boundary is wall-clock, deterministic.
  if (G.race && !G.race.goldenNote) {
    const rk = roundKeyFor(new Date());
    if (rk !== G.race.roundKey) {
      G.race.roundKey = rk;
      for (const n of anthem.chart) { if (!n.judged && n.t > st) { G.race.goldenNote = n; recordReplayGolden(n, st); addFloatText('GOLDEN NOTE INCOMING!', '#ffd700'); break; } }
    }
  }
  while (G.chartIdx < anthem.chart.length) {
    const n = anthem.chart[G.chartIdx];
    if (n.judged) { G.chartIdx++; continue; }
    if (st - n.t > CONFIG.W.good) { n.judged = 'miss'; G.counts.miss++; G.combo = 0; G.fever = false; if (G.race && G.race.goldenNote === n) G.race.goldenNote = null; addFloatText('MISS', '#ff00ff', n.lane * LW + LW / 2); hud(); glGlitch = 0.5; G.glitchT = 0.3; juiceHit('miss'); updatePrecision(0, 'miss'); try { if (navigator.vibrate) navigator.vibrate(30); } catch (_) {} G.chartIdx++; continue; }
    break;
  }
  if (st > anthem.duration + .8) return finish();
  draw(st, dt);
}

// v34: the note is a pixel hamster, not a rectangle — Guitar Hero's gem, in
// Squeekchain's pixel language (see the official pixel-grid post). 7x7 grid:
// ear bumps, eyes, pink nose. The white dot in the middle is the aim point —
// tap when it sits inside the receptor ring on the hit line. The old
// rectangle's leading edge invited early taps (its top arrived ~30-60ms
// before the judged time at slow speeds).
function drawHamster(x, y, size, body) {
  const P = ['.H...H.', 'HHHHHHH', 'HHHHHHH', 'HDHWHDH', 'HHHHHHH', '.HHNHH.', '..HHH..'];
  const px = size / 7, ox = x - size / 2, oy = y - size / 2;
  for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
    const ch = P[r][c];
    if (ch === '.') continue;
    cx.fillStyle = ch === 'D' ? '#111111' : ch === 'N' ? '#ff5ce1' : ch === 'W' ? '#ffffff' : body;
    cx.fillRect(Math.round(ox + c * px), Math.round(oy + r * px), Math.ceil(px) + 1, Math.ceil(px) + 1);
  }
}
function draw(st, dt) {
  dt = dt || 1 / 60;
  cx.clearRect(0, 0, GW, GH); cx.fillStyle = G.bgGrad || '#050505'; cx.fillRect(0, 0, GW, GH);
  cx.save(); cx.beginPath(); cx.rect(0, 0, GW, GH); cx.clip();
  const th = G.theme || THEMES.cyber; // v34: every color in the game comes from the mode theme
  cx.strokeStyle = th.grid; cx.lineWidth = 1; // v34: pixel grid, like the official Squeekchain poster
  for (let gx = 30; gx < GW; gx += 30) { cx.beginPath(); cx.moveTo(gx, 0); cx.lineTo(gx, GH); cx.stroke(); }
  for (let gy = 30; gy < GH; gy += 30) { cx.beginPath(); cx.moveTo(0, gy); cx.lineTo(GW, gy); cx.stroke(); }
  const spb = 60 / anthem.bpm, beat = ((st / spb) % 1 + 1) % 1, pulse = st > 0 ? Math.max(0, 1 - beat * 4) : 0;
  const lanes = G.lanes || LANES; // v28: 4-lane songs draw 4 lanes
  if (pulse > 0) { cx.globalAlpha = pulse * .10; cx.fillStyle = th.pulse; cx.fillRect(0, 0, GW, GH); cx.globalAlpha = 1; } // v34: beat pulse wash in the theme accent
  for (let l = 0; l < lanes; l++) { const f = G.flash[l] || 0; cx.globalAlpha = .10 + f * .45; cx.fillStyle = th.lane; cx.fillRect(l * LW + 2, 0, LW - 4, GH); cx.globalAlpha = 1; G.flash[l] = Math.max(0, f - dt * 5) } // v33: lane flash stronger (was .05 + f*.2)
  cx.strokeStyle = '#333'; cx.lineWidth = 2; for (let l = 1; l < lanes; l++) { cx.beginPath(); cx.moveTo(l * LW, 0); cx.lineTo(l * LW, GH); cx.stroke() }
  cx.strokeStyle = 'rgba(255,255,255,0.1)'; cx.lineWidth = 1; for (let b = Math.ceil(st / spb); b < st / spb + GH / CONFIG.SPEED / spb + 1; b++) { const y = CONFIG.HIT_Y - (b * spb - st) * CONFIG.SPEED; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(GW, y); cx.stroke() }
  cx.globalAlpha = .2 + pulse * .3; cx.fillStyle = G.fever ? '#ffd700' : th.hit; cx.fillRect(0, CONFIG.HIT_Y - 15, GW, 30); cx.globalAlpha = 1; cx.fillRect(0, CONFIG.HIT_Y - 2, GW, 4); // v34: hit line in the theme color (gold in FEVER)
  for (let l = 0; l < lanes; l++) { const rx = l * LW + LW / 2, f = G.flash[l] || 0; cx.strokeStyle = th.notes[l]; cx.lineWidth = 3; cx.beginPath(); cx.arc(rx, CONFIG.HIT_Y, 26 + f * 8, 0, Math.PI * 2); cx.stroke(); cx.globalAlpha = .35; cx.fillStyle = th.notes[l]; cx.beginPath(); cx.arc(rx, CONFIG.HIT_Y, 4, 0, Math.PI * 2); cx.fill(); cx.globalAlpha = 1; } // v34: Guitar Hero receptors — the hamster lands inside the ring; the ring pops on a hit
  for (const n of anthem.chart) { const y = CONFIG.HIT_Y - (n.t - st) * CONFIG.SPEED; if (y < -30) break; if (y > GH + 30 || (n.judged && n.judged !== 'miss')) continue; const x = n.lane * LW + LW / 2; const golden = G.race && G.race.goldenNote === n; const col = golden ? '#ffd700' : n.judged === 'miss' ? '#ff00ff' : noteColor(n.lane, th.notes, G.noteSkin); drawHamster(x, y, 48, col); if (golden) { cx.strokeStyle = '#ffffff'; cx.lineWidth = 2; cx.strokeRect(Math.round(x - 26), Math.round(y - 26), 52, 52); } }
  cx.restore();
  if (G.glitchT > 0) { G.glitchT -= dt; cx.globalAlpha = Math.min(.45, G.glitchT * 1.5); cx.fillStyle = '#ff00ff'; cx.fillRect(0, Math.random() * GH * .4, GW, 4); cx.fillStyle = '#00ffff'; cx.fillRect(0, GH - Math.random() * GH * .4, GW, 4); cx.globalAlpha = 1; } // v33: miss glitch, in-canvas
  for (let i = G.fx.length - 1; i >= 0; i--) { const p = G.fx[i]; p.life -= dt; if (p.life <= 0) { G.fx.splice(i, 1); continue } if (p.type === 'ring') { p.r += 320 * dt; cx.globalAlpha = Math.max(0, p.life * 2.5); cx.strokeStyle = p.c; cx.lineWidth = 3; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.stroke(); continue } p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; cx.globalAlpha = Math.max(0, p.life * 1.5); cx.fillStyle = p.c; const s = p.s || 4; cx.fillRect((p.x - s / 2) | 0, (p.y - s / 2) | 0, s, s) } // v33: shockwave rings + bigger particles
  cx.globalAlpha = 1; cx.textAlign = 'center';
  for (let i = floatTexts.length - 1; i >= 0; i--) { const t = floatTexts[i]; t.life -= dt * 1.5; t.y -= dt * 50; if (t.life <= 0) { floatTexts.splice(i, 1); continue } cx.globalAlpha = Math.min(1, t.life); cx.fillStyle = t.color; cx.font = '18px "Press Start 2P"'; cx.fillText(t.txt, t.x, t.y) }
  cx.globalAlpha = 1;
  if (st < 0) { cx.fillStyle = '#ffff00'; cx.font = '32px "Press Start 2P"'; cx.fillText(Math.ceil(-st), GW / 2, GH / 2) }
  if (G.paused) { cx.fillStyle = 'rgba(0,0,0,.75)'; cx.fillRect(0, 0, GW, GH); cx.fillStyle = '#fff'; cx.font = '16px "Press Start 2P"'; cx.fillText('SYSTEM PAUSED', GW / 2, GH / 2) }
  cx.fillStyle = '#00ff00'; cx.fillRect(0, 0, GW * Math.max(0, Math.min(1, st / anthem.duration)), 6);
}

function accuracy() { const c = G.counts, tot = c.perfect + c.great + c.good + c.miss; return tot ? (c.perfect * 300 + c.great * 200 + c.good * 100) / (tot * 300) * 100 : 100 }
const grade = (a, miss) => a >= 95 && miss === 0 ? 'SS' : a >= 95 ? 'S' : a >= 88 ? 'A' : a >= 75 ? 'B' : a >= 60 ? 'C' : 'D';
function hud() { $('scoreVal').textContent = G.score; $('comboVal').textContent = G.combo; $('accVal').textContent = Math.round(accuracy()) + '%'; const ft = $('feverTag'); if (ft) ft.classList.toggle('hidden', !(G && G.fever)); } // v33: ACC as an integer — "58.1%" was truncated to "58..." on phones

async function finish() { // v39: async — hash replay (SHA-256) dihitung di akhir, sebelum panel tampil
  G.ended = true; disarmPauseExit(); clearInterval(sched); cancelAnimationFrame(raf); stopLivePoll(); stopRaceTick(); liveZoomies = false; document.body.classList.remove('live-day', 'live-night');
  const rh = $('raceHud'); if (rh) rh.classList.add('hidden');
  const a = accuracy(), g = grade(a, G.counts.miss), key = (G.wallet || 'GUEST').toLowerCase(), prev = loadBest(G.wallet);
  const rec = { score: G.score, acc: +a.toFixed(2), grade: g, maxCombo: G.maxCombo, at: Date.now() };
  const isNewBest = G.score > 0 && (!prev || G.score > prev.score); // v39 (bug smoke test #3): SATU kondisi eksplisit untuk "rekor baru" — skor HARUS > 0 DAN (belum ada rekor ATAU skor > rekor). Skor 0 tidak pernah jadi rekor baru dan tidak pernah menimpa rekor tersimpan. Sebelumnya kondisi yang sama tersebar di tiga tempat (banner, kartu, simpan) sehingga bisa desinkron.
  lastResultIsNew = isNewBest; // v33.1: the result card draws a NEW BEST ribbon from this
  if (!G.practice && isNewBest) saveBest(G.wallet, rec);
  const avgOff = hitOffsets.length ? Math.round(hitOffsets.reduce((x, v) => x + v, 0) / hitOffsets.length) : null;
  // v39 (bug smoke test #2): guard — total judgement tidak boleh melebihi
  // jumlah note chart. Akar masalah MISS 103 vs NOTES 98: chart yang
  // DIMAINKAN (seed server, 103 note) bukan chart yang ditampilkan menu
  // preview (seed wallet, 98 note). Loop MISS di loop() sendiri menghitung
  // tiap note tepat sekali (chartIdx monoton naik + flag judged), jadi tidak
  // ada hitung ganda; guard ini pengaman bila chart berubah di tengah lagu.
  // Invarian: PERFECT+GREAT+GOOD+MISS = NOTES.
  const totalNotes = anthem ? anthem.chart.length : 0;
  if (totalNotes > 0 && G.counts.perfect + G.counts.great + G.counts.good + G.counts.miss > totalNotes) {
    G.counts.miss = Math.max(0, totalNotes - (G.counts.perfect + G.counts.great + G.counts.good));
  }
  const res = { score: G.score, acc: +a.toFixed(2), maxCombo: G.maxCombo, miss: G.counts.miss, perfect: G.counts.perfect, diff: G.diff, mode: G.mode, avgOff };
  const missions = dailyMissions(squeekTodayStr());
  const doneKey = missionsDoneKey(G.wallet);
  const doneBefore = loadJSON(doneKey, []);
  const newlyDone = G.practice ? [] : missions.filter(m => !doneBefore.includes(m.id) && m.check(res)).map(m => m.id);
  if (newlyDone.length) saveJSON(doneKey, doneBefore.concat(newlyDone));
  // v29 STREAK FREEZE: clearing all 3 daily missions in one day earns 1 freeze (max 2).
  if (!G.practice && newlyDone.length && doneBefore.concat(newlyDone).length >= 3) { const fk = 'sqk29:freeze:' + walletKey(G.wallet); saveJSON(fk, Math.min(2, loadJSON(fk, 0) + 1)); }
  // v29: race win +50 XP, weekly boss +100 XP.
  // BUG FIX (found in the v29 pass): since v26 the accuracy / no-miss / mission
  // bonuses sat behind a `//` comment and never applied — xpGain was score/30
  // only. Restored here, with the v26 divisor (30) kept.
  let raceWin = false, oppDist = 0;
  if (G.race) { oppDist = raceOppDist(); raceWin = G.race.playerDist > oppDist; }
  const xpGain = G.lullaby ? 50 : G.practice ? 0 : Math.round(G.score / 30) + (a >= 95 ? 50 : a >= 88 ? 25 : 0) + (G.counts.miss === 0 ? 30 : 0) + newlyDone.length * 25 + (raceWin ? 50 : 0) + (G.boss ? 100 : 0); // v42.5: Lullaby = +50 XP flat (mode malam, tanpa submit)
  const xpBefore = totalXP(G.wallet), xpAfter = xpBefore + xpGain;
  saveJSON('sqk24:xp:' + walletKey(G.wallet), xpAfter);
  // v42.5: Lullaby menyiram Dream Seed yang ditanam malam ini (maks. 2 tahap).
  if (G.lullaby) { const st = waterDream(); if (st) say(msgf('dreamWatered', { stage: st }), 'green'); renderDreamBox(); }
  const lvBefore = levelFor(xpBefore), lvAfter = levelFor(xpAfter);
  const histKey = 'sqk24:hist:' + walletKey(G.wallet);
  const hist = loadJSON(histKey, []);
  if (!G.practice) { hist.push({ at: Date.now(), score: G.score, acc: +a.toFixed(2), avgOff, grade: g, genre: G.genre, diff: G.diff, mode: G.mode }); saveJSON(histKey, hist.slice(-10)); }
  let streakTxt = '';
  if (G.mode === 'daily' && !G.practice) {
    const sk = 'sqk24:streak:' + walletKey(G.wallet);
    const st = loadJSON(sk, { last: null, count: 0 });
    if (st.last !== squeekTodayStr()) {
      const fk = 'sqk29:freeze:' + walletKey(G.wallet);
      const freezes = loadJSON(fk, 0);
      let freezeUsed = false;
      if (st.last === squeekYesterdayStr()) st.count = st.count + 1;
      else if (st.last === squeekTwoDaysAgoStr() && freezes > 0) { saveJSON(fk, freezes - 1); st.count = st.count + 1; freezeUsed = true; } // v29: a freeze saves a streak after exactly one missed day
      else st.count = 1;
      st.last = squeekTodayStr(); saveJSON(sk, st);
      streakTxt = msgf('streakDays', { n: st.count }) + (freezeUsed ? msg('freezeUsed') : '');
    }
  }
  const xpEl = $('xpMsg');
  const newUnlocks = [];
  for (let l = lvBefore + 1; l <= lvAfter; l++) if (UNLOCKS[l]) newUnlocks.push(UNLOCKS[l].text);
  const levelUpTxt = lvAfter > lvBefore ? msg('levelUp') + (newUnlocks.length ? msg('unlocked') + newUnlocks.join(' • ') : msg('avatarEvolved')) : '';
  if (xpEl) xpEl.textContent = G.lullaby ? `+${xpGain} XP • LV ${lvBefore} -> LV ${lvAfter}${levelUpTxt} • TOTAL ${xpAfter} XP` : G.practice ? msg('practiceRun') : `+${xpGain} XP • LV ${lvBefore} -> LV ${lvAfter}${levelUpTxt} • TOTAL ${xpAfter} XP${streakTxt}`;
  const mr = $('missionResult');
  if (mr) mr.innerHTML = missions.map(m => `<div class="mission${doneBefore.concat(newlyDone).includes(m.id) ? ' done' : ''}">${m.text}</div>`).join('');
  renderDailyBox(); renderMastery(); renderAvatarPreview(G.wallet); renderUnlocks();
  const wasDuelResponse = G.mode === 'challenge' && !!pendingRival; // v30: captured before pendingRival is cleared below
  if (!G.practice) {
    recordDiary({ at: Date.now(), song: `${G.genre.toUpperCase()} / ${G.diff.toUpperCase()} • "${anthem.name}" • ${anthem.key} ${anthem.scaleName}`, score: G.score, grade: g, mode: G.mode });
    recordChampion({ score: G.score, grade: g, mode: G.mode }); // v30: daily champion (best score of the day)
    if (G.race) saveJSON('sqk29:lastRace:' + walletKey(G.wallet), { at: Date.now(), you: +G.race.playerDist.toFixed(1), opp: +oppDist.toFixed(1), win: raceWin, ghost: !!G.race.ghost });
    if (G.mode === 'challenge' && pendingRival) { recordLeagueResult(pendingRival, G.score); pendingRival = null; }
    const achAdded = checkAchievements({ res, raceWin, mode: G.mode, genre: G.genre, mirror: G.mirror, zoomiesEver: G.live ? G.live.zoomiesEver : false, level: lvAfter, streak: loadJSON('sqk24:streak:' + walletKey(G.wallet), { count: 0 }).count });
    if (achAdded.length && xpEl) xpEl.textContent += ' • +' + (achAdded.length * 25) + ' XP (ACHIEVEMENTS)'; // v30: achievement XP is awarded inside checkAchievements — keep the XP line honest
  }
  renderRaceBox(); renderLeague(); renderAchievements(); renderPredict(); renderBossBox(); renderDiaryList(); renderChamps();
  lastResult = { score: G.score, acc: a, mode: G.mode, practice: G.practice, lullaby: !!G.lullaby, sessionId: G.sessionId || null, taps: G.taps || 0, notes: anthem ? anthem.chart.length : 0, durationMs: anthem ? Math.round(anthem.duration * 1000) : 0, grade: g, maxCombo: G.maxCombo, counts: { perfect: G.counts.perfect, great: G.counts.great, good: G.counts.good, miss: G.counts.miss }, avgOff, song: G.song ? { name: G.song.name, key: G.song.key, scaleName: G.song.scaleName, bpm: G.song.bpm, notes: G.song.notes } : null, lanes: G.lanes, mirror: G.mirror, live: G.live ? { offline: G.live.offline, peakRpm: G.live.peakRpm, dist: G.live.dist, zoomiesEver: G.live.zoomiesEver } : null, race: G.race ? { you: +G.race.playerDist.toFixed(1), opp: +oppDist.toFixed(1), win: raceWin, offline: G.race.offline, ghost: !!G.race.ghost, pace: G.race.ghost ? +G.race.ghostPaceMs.toFixed(3) : 0 } : null, boss: !!G.boss }; resetLbSubmit(); // v37: this result is submittable to the global board (v38: + sessionId/taps/notes/durationMs; v39: + grade/maxCombo/counts/avgOff/song/live/race — kartu hasil baca dari sini, bukan DOM)
  // v39: finalisasi replay + hash SHA-256 (async). Fail-soft: exception apa
  // pun (termasuk crypto.subtle tak tersedia) = replay dibuang, lastResult
  // tetap tanpa replay, submit jalan seperti biasa (verified=0).
  if (replay) {
    try {
      // v42.5 GHOST: header mencatat keadaan AKHIR (ghost bisa bangun di
      // tengah lagu → kembali live; Worker memvalidasi jarak lawan sesuai
      // keadaan akhir ini, bukan keadaan awal).
      if (replay.header && G.race) { replay.header.ghost = !!G.race.ghost; replay.header.ghostPaceMs = G.race.ghost ? +G.race.ghostPaceMs.toFixed(3) : 0; }
      replay.events.finish = { t: replaySongT(), oppDistM: G.race ? +oppDist.toFixed(1) : null };
      replay.claim = { score: G.score, acc: +a.toFixed(2), maxCombo: G.maxCombo, counts: { perfect: G.counts.perfect, great: G.counts.great, good: G.counts.good, miss: G.counts.miss } };
      if (G.sessionId && replay.header.seed !== G.sessionSeed) throw new Error('replay seed mismatch');
      lastResult.replay = replay;
      lastResult.replayHash = await replayHashOf(replay);
    } catch (_) { replay = null; delete lastResult.replay; delete lastResult.replayHash; }
  }
  $('gradeVal').textContent = g; $('gradeVal').style.color = g.startsWith('S') ? 'var(--green)' : g === 'A' ? 'var(--cyan)' : 'var(--pink)';
  const c = G.counts;
  $('resultKv').innerHTML = `<span>${rl('score')}</span><b>${G.score}</b><span>${rl('acc')}</span><b>${a.toFixed(2)}%</b><span>${rl('combo')}</span><b>${G.maxCombo}</b><span>${rl('pg')}</span><b>${c.perfect}/${c.great}</b><span>${rl('gm')}</span><b>${c.good}/${c.miss}</b><span>${rl('anthem')}</span><b>"${G.song.name}" • ${G.song.key}</b><span>${rl('setup')}</span><b>${G.lanes} LANES${G.mirror ? ' • MIRROR' : ''} • OFFSET ${offsetMs > 0 ? '+' : ''}${offsetMs} ms${avgOff !== null ? ' • AVG ' + (avgOff > 0 ? '+' : '') + avgOff + ' ms' : ''}${avgOff !== null && Math.abs(avgOff) >= 30 ? rl('tryCalib') : ''}${G.lullaby ? rl('lullabyTag') : G.practice ? rl('practiceTag') : ''}</b>` + (G.live ? `<span>${rl('live')}</span><b>${G.live.offline ? rl('offline') : 'PEAK RPM ' + Math.round(G.live.peakRpm) + ' • ' + G.live.dist.toFixed(3) + ' KM' + (G.live.zoomiesEver ? ' • ZOOMIES ×2' : '')}</b>` : '') + (G.race ? `<span>${rl('race')}</span><b>YOU ${G.race.playerDist.toFixed(0)} m vs SQUEEKTOSHI ${oppDist.toFixed(0)} m — ${raceWin ? rl('raceWin') : rl('raceLose')}${G.race.ghost ? rl('ghostTag') : ''}${G.race.offline ? ' (' + rl('offline') + ')' : ''}</b>` : '') + (G.boss ? `<span>${rl('boss')}</span><b>${rl('bossDefeated')}</b>` : ''); // v39: nama lagu dibaca dari snapshot G.song (state lagu yang dimainkan), bukan global anthem — panel tidak bisa lagi menampilkan lagu lain
  $('bestMsg').textContent = isNewBest ? msg('newHigh') : (prev ? msgf('bestIs', { score: prev.score, grade: prev.grade }) : ''); // v39: satu kondisi isNewBest (skor 0 tidak pernah jadi rekor baru)
  // v33.1: the score counts up instead of appearing instantly (skipped for reduced motion).
  const sb = $('resultKv').querySelector('b');
  if (sb && !prefersReducedMotion && G.score > 0) { const target = G.score, t0 = performance.now(); const tick = now => { const p = Math.min(1, (now - t0) / 700); sb.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
  const rbm = $('rivalBackMsg'); // v30: after answering a duel, tell the player how the challenger sees their score
  if (rbm) { if (wasDuelResponse) { rbm.classList.remove('hidden'); rbm.textContent = msg('rivalBack'); } else rbm.classList.add('hidden'); }
  show('resultPanel');
  applyResultFrame(); // v41: equipped frame skin restyles the result panel
  $('resultPanel').scrollIntoView({ behavior: 'auto', block: 'start' }); // v33: the grade is at the top of the screen, not below the fold
  playResultJingle(g);
  playIntroMusic(); // Kembalikan intro setelah selesai
  startMenuPoll();
  document.body.classList.remove('playing'); resumeGL(); // v32: decorations back on
}
function playResultJingle(g) {
  // v26-musik: fanfare hasil — SS/S naik penuh, A/B sedang, C/D pendek turun
  if (!ac || muted) return;
  const t0 = ac.currentTime + 0.05;
  const seq = (g === 'SS' || g === 'S') ? [81, 84, 88, 93, 88, 93] : (g === 'A' || g === 'B') ? [81, 84, 88, 84] : [81, 79, 76];
  seq.forEach((m, i) => { tone(mtof(m), t0 + i * 0.11, 'square', 0.16, 0.16); tone(mtof(m + 7), t0 + i * 0.11, 'sawtooth', 0.07, 0.16); });
  if (g === 'SS' || g === 'S') kick(t0);
}
function stop() { hidePauseOverlay(); syncBackToGameBtn(); if (G) { clearInterval(sched); cancelAnimationFrame(raf); if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); G = null; } stopLivePoll(); stopRaceTick(); liveZoomies = false; replay = null; // v39: replay lagu yang dibatalkan dibuang — tidak boleh menempel ke hasil berikutnya
  document.body.classList.remove('live-day', 'live-night'); delete document.body.dataset.theme; /* v34: the mode theme leaves with the game */ const lh = $('liveHud'); if (lh) lh.classList.add('hidden'); const rh = $('raceHud'); if (rh) rh.classList.add('hidden'); document.body.classList.remove('playing'); resumeGL(); show('mainPanel'); playIntroMusic(); startMenuPoll(); }
async function pauseGame() { if (!G || G.ended) return; G.paused = true; setText('pauseBtn', msg('resumeBtn')); setText('gameAudioStatus', msgf('gameAudioTpl', { run: msg('audioPaused'), bpm: anthem.bpm, state: 'paused', practice: G.practice ? msg('practiceTag2') : '' })); try { if (ac) await ac.suspend(); } catch (_) {} draw(songTime(), 0); showPauseOverlay(); } // v33.2: v33.1 only changed the AC state — the template's leading word still said RUNNING (v38: the real pause menu opens here)
async function resumeGame() { if (!G || G.ended) return; hidePauseOverlay(); try { if (ac) await ac.resume(); } catch (_) {} G.paused = false; lastLoopTs = 0; setText('pauseBtn', msg('pauseBtn')); setText('gameAudioStatus', msgf('gameAudioTpl', { run: msg('audioRunning'), bpm: anthem.bpm, state: 'running', practice: G.practice ? msg('practiceTag2') : '' })); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
async function togglePause() { if (!G) return; if (G.paused) await resumeGame(); else await pauseGame(); }

// --- v38 REAL PAUSE MENU (DOM overlay, no window.confirm anywhere) ---
// EXIT / TERMINATE are two-step armed: first tap arms ("SURE? TAP AGAIN"),
// second tap executes; arming auto-expires after 3s. CALIBRATE keeps the
// game paused and jumps to the ME tab (the TAP button lives there); the
// [ BACK TO GAME ] button in ME returns to the paused game.
let exitArmed = false, exitArmTimer = null, stopArmed = false, stopArmTimer = null;
function pauseI18n(k) { const d = I18N[lang] || I18N.en; return d[k] || I18N.en[k] || k; }
function showPauseOverlay() { const o = $('pauseOverlay'); if (o) o.classList.remove('hidden'); syncBackToGameBtn(); }
function hidePauseOverlay() { const o = $('pauseOverlay'); if (o) o.classList.add('hidden'); disarmPauseExit(); syncBackToGameBtn(); }
function disarmPauseExit() {
  exitArmed = false; stopArmed = false;
  if (exitArmTimer) { clearTimeout(exitArmTimer); exitArmTimer = null; }
  if (stopArmTimer) { clearTimeout(stopArmTimer); stopArmTimer = null; }
  const pe = $('pauseExitBtn'); if (pe) pe.textContent = pauseI18n('pauseExit');
  const st = $('stopBtn'); if (st) st.textContent = '[ TERMINATE ]';
}
function armOrExit(btn, which) {
  const armed = which === 'pause' ? exitArmed : stopArmed;
  if (!armed) {
    if (which === 'pause') { exitArmed = true; exitArmTimer = setTimeout(disarmPauseExit, 3000); }
    else { stopArmed = true; stopArmTimer = setTimeout(disarmPauseExit, 3000); }
    btn.textContent = pauseI18n('pauseSure');
    return;
  }
  disarmPauseExit(); hidePauseOverlay(); stop();
}
function syncBackToGameBtn() { const b = $('backToGameBtn'); if (!b) return; b.classList.toggle('hidden', !(G && G.paused && !G.ended)); }
function pauseCalibrate() {
  if (!G || G.ended) return;
  hidePauseOverlay(); // G stays paused; audio stays suspended
  show('mainPanel'); setTab('me');
  syncBackToGameBtn();
  const cb = $('calibBox'); if (cb) cb.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const KEY_LANES = { ArrowLeft: 0, a: 0, A: 0, '1': 0, ArrowDown: 1, s: 1, S: 1, '2': 1, ArrowRight: 2, d: 2, D: 2, '3': 2, ArrowUp: 3, f: 3, F: 3, '4': 3 }; // v28: lane 3 (4th) = ↑ / F — only active in 4-lane songs (judge() guards the lane)
document.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.key === ' ' && calib) { e.preventDefault(); calibTap(); return; } // v28: Space taps during calibration
  if (KEY_LANES[e.key] !== undefined) { e.preventDefault(); judge(KEY_LANES[e.key]); return; }
  if (e.key === 'p' || e.key === 'P') { togglePause(); }
  if (e.key === 'm' || e.key === 'M') { toggleMute(); }
  if (e.key === ' ' && G && !G.ended) { e.preventDefault(); judge(1); }
});
cv.addEventListener('pointerdown', e => { e.preventDefault(); if (G && G.paused) { resumeGame(); return } const r = cv.getBoundingClientRect(); const lanes = G ? G.lanes : LANES; judge(Math.min(lanes - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * lanes)))); }, { passive: false });
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.ended && !G.paused) { pauseGame(); } });

// ==========================================
// 5. CARD & RPC
// ==========================================
async function tfetch(url, opt = {}, ms = 6000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { return await fetch(url, { ...opt, signal: c.signal }) } finally { clearTimeout(t) } }
function isTimeoutError(e) { return !!e && (e.name === 'AbortError' || e.name === 'TimeoutError'); } // v42.5.2 (FIX 2): tfetch memakai AbortController — timeout muncul sebagai AbortError; bedakan dari offline generik
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
async function fetchWheel() { try { const r = await tfetch(CONFIG.API_URL); if (!r.ok) return { ok: false, status: 'HTTP_' + r.status }; const m = (await r.json()).measurement; if (!m) return { ok: false, status: 'NO_DATA' }; return { ok: true, dist: Number(m.distanceMm) / 1e6, status: String(m.coreStatus).slice(0, 18), rpm: Number(m.rpmMilli || 0) / 1000, fresh: String(m.freshness || '') } } catch { return { ok: false, status: 'OFFLINE' } } }

// ==========================================
// v35 CHAIN — live SqueekCore + economy state (read-only public API, no key).
// /v1/core gives settled work, block height, difficulty and the settled
// frontier; /v1/economy/state gives SQK issued, staked and Squeeks burned.
// Honesty rule from the whitepaper: a response that says "unavailable" means
// UNKNOWN, never zero — so a failed fetch shows UNKNOWN, not 0.
// ==========================================
const GENESIS_TS = 1793735400; // SqueekCore genesis time (docs: developers.md)
let chainSnapshot = null, chainLastFetch = 0;
function fmtSqk(baseUnits) { try { return fmt(BigInt(baseUnits), 18); } catch { return '?'; } }
async function fetchChain() {
  try {
    const [cr, er] = await Promise.all([tfetch(CONFIG.CORE_URL), tfetch(CONFIG.ECONOMY_URL)]);
    if (!cr.ok || !er.ok) return { ok: false, status: 'HTTP_' + (cr.ok ? er.status : cr.status) };
    const cj = await cr.json(), ej = await er.json();
    if (cj.status !== 'available' || ej.status !== 'available') return { ok: false, status: 'UNAVAILABLE' };
    const c = cj.core || {}, sup = ej.supply || {}, st = ej.staking || {}, nft = ej.nft || {};
    return { ok: true,
      height: Number(c.blockHeight || 0),
      progress: Number(c.blockProgress || 0) / 1e9,
      difficulty: Number(c.workPerThousandBlocks || 0),
      settled: Number(c.settledThroughRound || 0),
      issued: fmtSqk(sup.miningMintedBaseUnits || (ej.schedule && ej.schedule.issuedBaseUnits) || 0),
      staked: fmtSqk(st.totalStakedBaseUnits || 0),
      burned: Number(nft.burned || 0) };
  } catch { return { ok: false, status: 'OFFLINE' }; }
}
// --- v35: MY SQUEEK — the player's account on Squeekchain (read-only public API) ---
// /v1/accounts/{address} returns power (scaled by 1e18, like the staking
// parameters), stake, claimable rewards and the Squeeks themselves — each token
// entry already carries level, basePower, nextMergeHeight and mergeState, so
// no second fetch is needed. Tokens come 25 per page; we take the best of the
// first page (deposited in Staking first, then highest power).
async function fetchAccount(w) {
  try {
    const r = await tfetch('https://api.squeekchain.com/v1/accounts/' + w.toLowerCase());
    if (!r.ok) return { ok: false, status: 'HTTP_' + r.status };
    const j = await r.json();
    if (j.status !== 'available') return { ok: false, status: 'UNAVAILABLE' };
    const power = j.power || {}, stake = j.stake || {}, rewards = j.rewards || {};
    const counts = j.tokenCounts || {};
    const tokens = Array.isArray(j.tokens) ? j.tokens : [];
    const sorted = tokens.slice().sort((a, b) => ((b.custody === 'staking') - (a.custody === 'staking')) || (Number(b.basePower || 0) - Number(a.basePower || 0)));
    return { ok: true,
      nftPower: fmtSqk(power.nftPower || 0),
      sqkPower: fmtSqk(power.sqkPower || 0),
      staked: fmtSqk(stake.principalBaseUnits || 0),
      claimable: fmtSqk(rewards.claimableBaseUnits || 0),
      count: Number(counts.staking || 0) + Number(counts.wallet || 0),
      first: sorted[0] || null };
  } catch { return { ok: false, status: 'OFFLINE' }; }
}
// --- v35.1: the Squeek's own DotGrid art for the ID Card ---
// /v1/squeeks/{id} returns metadata.imageDataUri — a base64 inline SVG (the
// real on-chain art, ~74 KB for #8889, intrinsic 1568x1568). SVG data URIs
// without width/height render as 0x0 in some browsers, so fixSvgSize injects
// 512x512 when the root tag has none. Everything is fail-soft: a slow or
// failed fetch draws the dashed placeholder, never breaks the card.
let squeekImgCache = {};
function fixSvgSize(dataUri) {
  try {
    const m = /^data:image\/svg\+xml;base64,(.+)$/.exec(dataUri || '');
    if (!m) return dataUri;
    let svg = atob(m[1]);
    if (!/width\s*=/.test(svg)) svg = svg.replace(/<svg\b/i, '<svg width="512" height="512"');
    return 'data:image/svg+xml;base64,' + btoa(svg);
  } catch { return dataUri; }
}
function loadSqueekImage(id, dataUri) {
  if (squeekImgCache[id]) return Promise.resolve(squeekImgCache[id]);
  return new Promise(res => {
    const img = new Image();
    const to = setTimeout(() => res(null), 4000);
    img.onload = () => { clearTimeout(to); squeekImgCache[id] = img; res(img); };
    img.onerror = () => { clearTimeout(to); res(null); };
    img.src = fixSvgSize(dataUri);
  });
}
async function fetchSqueekImage(id) {
  try {
    const r = await tfetch('https://api.squeekchain.com/v1/squeeks/' + id);
    if (!r.ok) return null;
    const j = await r.json();
    const uri = j && j.metadata && j.metadata.imageDataUri;
    if (!uri) return null;
    return await loadSqueekImage(id, uri);
  } catch { return null; }
}
async function refreshChain(force) {
  const now = Date.now();
  if (!force && chainSnapshot && now - chainLastFetch < 60000) { renderChainBox(); return chainSnapshot; }
  chainLastFetch = now;
  chainSnapshot = await fetchChain();
  renderChainBox();
  renderRoundHist(); // the frontier may have moved
  return chainSnapshot;
}
function renderChainBox() {
  const el = $('chainLines'); if (!el) return;
  const s = chainSnapshot;
  if (!s) { el.innerHTML = `<p class="msg">${escHtml(I18N[lang].chainLoading)}</p>`; return; }
  if (!s.ok) { el.innerHTML = `<p class="msg">${escHtml(msgf('chainUnknown', { status: s.status }))}</p>`; return; }
  const pct = Math.floor(s.progress * 100);
  el.innerHTML = [
    msgf('chainBlockTpl', { height: s.height.toLocaleString('en-US'), pct }),
    msgf('chainDiffTpl', { diff: s.difficulty.toLocaleString('en-US'), settled: s.settled }),
    msgf('chainEcoTpl', { issued: s.issued, staked: s.staked, burned: s.burned }),
  ].map(t => `<p class="msg">${escHtml(t)}</p>`).join('');
}

// --- v35: chain round numbers — rounds are 600s buckets from genesis ---
// Local round keys ('YYYY-MM-DD-HH:MM') share the same 10-minute boundaries
// as chain rounds (genesis is exactly on a boundary), so a key converts
// cleanly to a chain round id.
function roundIdForKey(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2}):(\d{2})$/.exec(key || '');
  if (!m) return null;
  const sec = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0).getTime() / 1000;
  if (!Number.isFinite(sec)) return null;
  return Math.floor((sec - GENESIS_TS) / 600);
}
function roundSettled(key) {
  if (!chainSnapshot || !chainSnapshot.ok) return null; // frontier unknown
  const id = roundIdForKey(key);
  if (id === null) return null;
  return id <= chainSnapshot.settled;
}
function estWork(avg) { return Math.round(avg * 10); } // ~1 rev = 1 work unit, 10-min round
function estBlocks(work, diff) { if (!diff || diff <= 0 || !Number.isFinite(work)) return null; return +(work * 1000 / diff).toFixed(1); }

// ==========================================
// 5b. LIVE MODE — RACE THE HAMSTER
// The song's tempo follows the real hamster wheel (api.squeekchain.com/v1/status).
// Resting hamster (RPM 0) = CALM 100 BPM. Running hamster = 100 + RPM, capped at 180.
// At 70+ RPM ZOOMIES starts: all scores x2 while it lasts. Day follows the wheel
// running, night follows it resting. If the wheel is offline the song uses a
// 128 BPM fallback and says so — never fake live data.
// ==========================================
const ZOOMIES_RPM = 70;
// --- v42.5 GHOST Squeektoshi: pace lawan simulasi dari data NYATA 7 hari.
// 1 work unit = 1 magnet passage; jarak seumur hidup 25.202.990 mm /
// 28.705 work unit = 0,878 m per passage (stats 7d, 2026-11-08). Rata-rata
// bucket siang (10:00–14:00 WIB = 03:00–07:00 UTC) ~1075 work / 30 mnt
// → 1075 × 0,878 / 1800 ≈ 0,52 m/s. Default 0,5 m/s (dibulatkan ke bawah);
// Worker menolak pace klaim > 1,0 m/s (batas atas yang longgar: pace siang
// tercepat yang teramati ~0,6 m/s).
const GHOST_WHEEL_M_PER_PASSAGE = 0.878;
const GHOST_DEFAULT_PACE_MS = 0.5;
const GHOST_DAY_START_MIN_UTC = 180, GHOST_DAY_END_MIN_UTC = 420; // 10:00–14:00 WIB
const GHOST_PACE_CACHE_KEY = 'sqk42:ghostPace', GHOST_PACE_CACHE_MS = 24 * 60 * 60 * 1000;
function liveBpm(rpm) { if (!Number.isFinite(rpm) || rpm <= 0) return 100; return Math.min(180, Math.round(100 + rpm)); }
function liveIsDay(s) { return !!(s && s.ok && s.rpm > 0); }
function liveSummary(s) {
  if (!s || !s.ok) return msg('liveSumOff');
  const bpm = liveBpm(s.rpm);
  return msgf('liveSumTpl', { rpm: Math.round(s.rpm), dist: s.dist.toFixed(3), daynight: liveIsDay(s) ? msg('liveSumDay') : msg('liveSumNight'), bpm, zoom: s.rpm >= ZOOMIES_RPM ? msg('liveSumZoom') : '' });
}
function renderLiveBox() {
  const box = $('liveBox'); if (!box) return;
  box.classList.toggle('hidden', playMode !== 'live');
  if (playMode !== 'live') return;
  const ll = $('liveLine'); if (ll) ll.textContent = liveSnapshot ? liveSummary(liveSnapshot) : msg('fetchingWheel');
}
let lastSeenRound = null; // v30: the round the page is currently watching, so a round ending mid-session is finalized immediately
async function refreshLive() {
  const s = await fetchWheel();
  liveSnapshot = s;
  refreshChain(); // v35: chain state rides along, throttled to 60s
  if (s.ok) recordRpmSample(s.rpm); // v29: feed the prediction settler
  const cur = currentRoundKey();
  if (lastSeenRound && cur !== lastSeenRound) finalizeRound(lastSeenRound); // v30: round history, live
  lastSeenRound = cur;
  settlePredictions(); // v29: resolve predictions whose round has ended
  renderLiveBox();
  renderPredict(); renderRaceBox(); renderLullabyBox(); renderDreamBox(); updateOverlay(); // v29; v42.5: night boxes follow the hamster state
  // v27.1: the menu anthem line is built by preview() from liveSnapshot — refresh
  // it once the snapshot lands, or it stays stuck on the pre-fetch fallback text
  // while the LIVE box already shows real data. Never during a running game:
  // preview() re-rolls the accent hue, which must not change mid-song.
  if (!G) preview();
  if (G && !G.ended && G.mode === 'live') updateLiveHud();
  // v40 DETERMINISME: di mode RACE, ZOOMIES ikut flip TEPAT saat poll
  // mendarat (bukan hanya lewat tick 500 ms di startRaceTick). Sebelumnya
  // flip bisa tertunda 0-500 ms sesudah poll — selisih itu tidak terekam di
  // replay, jadi simulate() tidak bisa mereproduksi skornya secara exact.
  // Poll tercatat di recordReplayPoll tepat sesudah baris ini, jadi waktu
  // flip == waktu poll. Tidak mengubah HUD (tetap di tick) atau rumus skor.
  if (G && !G.ended && G.mode === 'race') computeZoomies();
  recordReplayPoll(s); // v39: tiap poll live direkam (termasuk yang gagal)
  return s;
}
function startLivePoll(ms) { stopLivePoll(); livePoll = setInterval(() => { refreshLive(); }, ms); }
function stopLivePoll() { if (livePoll) { clearInterval(livePoll); livePoll = null; } }
function updateLiveHud() {
  const lh = $('liveHud'); if (!lh || !G || G.mode !== 'live') return;
  const s = liveSnapshot;
  const wasZoomies = liveZoomies;
  liveZoomies = !!(s && s.ok && s.rpm >= ZOOMIES_RPM);
  if (!wasZoomies && liveZoomies && G && !G.ended && !G.paused) addFloatText('ZOOMIES ×2!', '#ff00ff'); // v34: the wheel going wild gets a banner
  if (G.live && s && s.ok) { G.live.dist = s.dist; G.live.peakRpm = Math.max(G.live.peakRpm, s.rpm); if (liveZoomies) G.live.zoomiesEver = true; }
  const day = liveIsDay(s);
  document.body.classList.toggle('live-day', day);
  document.body.classList.toggle('live-night', !day);
  lh.classList.toggle('zoomies', liveZoomies);
  lh.textContent = s && s.ok
    ? msgf('liveHudTpl', { rpm: Math.round(s.rpm), dist: s.dist.toFixed(3), daynight: day ? msg('liveHudDay') : msg('liveHudNight'), zoom: liveZoomies ? msg('liveHudZoom') : '' })
    : msg('liveHudOff');
}

function avatar(ctx, w, x0, y0, px, level) {
  level = level || 1;
  const r = rng(seedOf(w) ^ 0x5eed), hue = Math.floor(r() * 360);
  let fur = `hsl(${hue},80%,62%)`, dark = `hsl(${hue},70%,32%)`, acc = `hsl(${(hue + 180) % 360},90%,60%)`;
  if (level >= 8) { fur = 'hsl(45,90%,60%)'; dark = 'hsl(45,70%,32%)'; acc = 'hsl(48,100%,68%)'; } // v28: LV8 GOLD avatar
  const grid = []; for (let y = 0; y < 16; y++) { grid[y] = []; for (let x = 0; x < 8; x++) { const dx = (x - 7.5) / 6.5, dy = (y - 9) / 6.5; grid[y][x] = dx * dx + dy * dy <= 1 ? (r() < .22 ? 2 : 1) : 0 } }
  for (let y = 1; y < 5; y++) for (let x = 2; x < 5; x++) if (x - 2 <= y - 1) grid[y][x] = (y > 2 && x === 3) ? 3 : 2;
  const eyeY = 8 + Math.floor(r() * 2), glasses = level >= 2 || r() < .25, hat = level >= 3 || r() < .3, crown = level >= 4;
  ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, 16 * px, 16 * px);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) { const v = grid[y][x]; if (!v) continue; let c = v === 2 ? dark : v === 3 ? '#ff5c9a' : fur; if (y === eyeY && x === 5) c = glasses ? acc : '#000'; if (y === eyeY + 2 && x === 7) c = '#ff5c9a'; ctx.fillStyle = c; ctx.fillRect(x0 + x * px, y0 + y * px, px, px); ctx.fillRect(x0 + (15 - x) * px, y0 + y * px, px, px) }
  if (glasses) { ctx.fillStyle = acc; ctx.fillRect(x0 + 4 * px, y0 + eyeY * px, 8 * px, Math.max(1, px >> 1)) }
  if (hat) { ctx.fillStyle = acc; ctx.fillRect(x0 + 4 * px, y0 + 2 * px, 8 * px, 2 * px); ctx.fillRect(x0 + 3 * px, y0 + 4 * px, 10 * px, px) }
  if (crown) { ctx.fillStyle = '#ffff00'; ctx.fillRect(x0 + 4 * px, y0 + 0 * px, 8 * px, px); ctx.fillRect(x0 + 4 * px, y0 + 0 * px, px, 2 * px); ctx.fillRect(x0 + 7 * px, y0 + 0 * px, px, 2 * px); ctx.fillRect(x0 + 10 * px, y0 + 0 * px, px, 2 * px); }
}

// --- v33: card overlay — the ID card and the result card open ON TOP of
// whatever panel is showing (no more jumping back to the menu), with close
// and minimize controls. Closing returns to the panel underneath, untouched.
function openCard(title) { if (title) setText('cardTitle', title); const o = $('cardOverlay'), b = $('cardBackdrop'), bar = $('cardBar'); if (o) o.classList.remove('hidden'); if (b) b.classList.remove('hidden'); if (bar) bar.classList.add('hidden'); document.body.classList.remove('cardbar'); }
function closeCard() { const o = $('cardOverlay'), b = $('cardBackdrop'), bar = $('cardBar'); if (o) o.classList.add('hidden'); if (b) b.classList.add('hidden'); if (bar) bar.classList.add('hidden'); document.body.classList.remove('cardbar'); }
function minimizeCard() { const o = $('cardOverlay'), b = $('cardBackdrop'), bar = $('cardBar'); if (o) o.classList.add('hidden'); if (b) b.classList.add('hidden'); if (bar) bar.classList.remove('hidden'); document.body.classList.add('cardbar'); } // v33.1: the fixed bar must not float over the footer text
bindClick('cardCloseBtn', closeCard);
bindClick('cardBackdrop', closeCard);
bindClick('cardMinBtn', minimizeCard);
bindClick('cardBarOpen', () => openCard());
bindClick('cardBarClose', closeCard);

// --- v33: shared card frame — gradient hairline border, corner ticks,
// gradient header band. Both cards use it so the ID card and the result
// card look like one family instead of two different eras.
function cardFrame(ctx, CW, CH, title, right) {
  const bg = ctx.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, '#0a161a'); bg.addColorStop(1, '#050607');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
  const edge = ctx.createLinearGradient(0, 0, CW, 0); edge.addColorStop(0, '#00e5ff'); edge.addColorStop(1, '#00ff88');
  ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.strokeRect(2, 2, CW - 4, CH - 4);
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3;
  const T = 16, o = 8; // corner ticks
  [[o, o, 1, 1], [CW - o, o, -1, 1], [o, CH - o, 1, -1], [CW - o, CH - o, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x + T * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + T * sy); ctx.stroke(); });
  const band = ctx.createLinearGradient(0, 0, CW, 0); band.addColorStop(0, '#00e5ff'); band.addColorStop(1, '#00ff88');
  ctx.fillStyle = band; ctx.fillRect(2, 2, CW - 4, 44);
  ctx.textAlign = 'left'; ctx.fillStyle = '#000'; ctx.font = 'bold 15px "Space Mono"';
  ctx.fillText(title, 16, 30);
  if (right) { ctx.textAlign = 'right'; ctx.fillText(right, CW - 16, 30); }
  ctx.textAlign = 'left';
}

// v35.2: the ANTHEM value shares its row with TEMPO (column at x=224), so a long
// anthem name must shrink instead of colliding — 14px fits <=22 chars, 10px fits
// any value (row() slices to 30 chars; 30 x 6.0px = 180px < the 200px column).
// Longest real name: "Sunny Major Pentatonic" (22) -> card value 28 chars.
function anthemSize(v) { return String(v).length > 22 ? 10 : 14; }

async function generateCard() {
  const w = $('walletInput').value.trim();
  if (!isAddr(w)) { $('walletInput').classList.add('invalid'); say(msg('cardWallet'), 'pink'); const em = $('cardErrMsg'); if (em && !$('resultPanel').classList.contains('hidden')) { em.textContent = msg('cardWallet'); em.classList.remove('hidden'); } return; } // v33.1: say() writes to #message in the menu — invisible from the result panel, so the error must also show there
  $('walletInput').classList.remove('invalid');
  const btn = $('genBtn'); if (btn) btn.disabled = true; say(msg('cardFetching'), 'cyan');
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))]); } catch (_) {}

  let wheel, bal, acct;
  try { [wheel, bal, acct] = await Promise.all([fetchWheel(), fetchBalance(w), fetchAccount(w)]); }
  catch (e) { bal = { ok: false, status: e.message === 'CIRCUIT_OPEN' ? 'RPC_BLOCKED' : 'FETCH_ERROR' }; wheel = { ok: false, status: 'OFFLINE' }; acct = { ok: false, status: 'FETCH_ERROR' }; }
  let sqkImg = null;
  if (acct && acct.ok && acct.first) { try { sqkImg = await Promise.race([fetchSqueekImage(acct.first.tokenId), new Promise(r => setTimeout(() => r(null), 5000))]); } catch { sqkImg = null; } }

  const an = (lastAnthem && G && G.wallet && G.wallet.toLowerCase() === w.toLowerCase()) ? lastAnthem : makeAnthem(w);
  const b = loadBest(w), c = $('card-canvas'), ctx = c.getContext('2d'), CW = 400, CH = 680;
  fitCanvas(c, ctx, CW, CH, 3);
  const lv = levelFor(totalXP(w)), xp = totalXP(w);
  cardFrame(ctx, CW, CH, 'SQUEEK CITIZEN // ID CARD', 'LV ' + lv);

  // Avatar in a framed badge — no more floating in a void.
  ctx.strokeStyle = 'rgba(0,229,255,.6)'; ctx.lineWidth = 2; ctx.strokeRect(CW / 2 - 72, 58, 144, 144);
  avatar(ctx, w, CW / 2 - 64, 66, 8, lv);
  ctx.textAlign = 'center'; ctx.fillStyle = '#9aa5a8'; ctx.font = '11px "Space Mono"';
  ctx.fillText('LV ' + lv + '  •  ' + xp + ' XP', CW / 2, 216);
  ctx.textAlign = 'left';

  const row = (l, v, x, y, col, fs) => { ctx.fillStyle = '#7d8a8d'; ctx.font = '10px "Space Mono"'; ctx.fillText(l, x, y); ctx.fillStyle = col; ctx.font = 'bold ' + (fs || 14) + 'px "Space Mono"'; ctx.fillText(String(v).slice(0, 30), x, y + 19); };
  const hair = y => { ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(CW - 24, y); ctx.stroke(); };
  row('WALLET', w.slice(0, 10) + '...' + w.slice(-8), 24, 244, '#00e5ff');
  hair(268);
  const anVal = `"${an.name}" • ${an.key}`;
  row('ANTHEM', anVal, 24, 292, '#ff5ce1', anthemSize(anVal)); // v35.2: long names shrink to 10px instead of colliding with TEMPO (phone screenshot 2026-11-07: "Blues Minor Pentatonic" ran into "114 BPM")
  row('TEMPO', `${an.bpm} BPM`, 224, 292, '#ff5ce1');
  row('BEST SCORE', b ? String(b.score) : 'NONE', 24, 336, '#ffe14d');
  row('GRADE', b ? b.grade : '--', 224, 336, '#ffe14d');
  hair(360);
  row('TOKEN (SEPOLIA)', bal.ok ? `${bal.val} ${bal.sym}` : `[ ${bal.status} ]`, 24, 384, bal.ok ? '#00ff88' : '#ff5ce1');
  row('WHEEL', wheel.status, 24, 428, wheel.ok ? '#00ff88' : '#ff5ce1');
  row('DISTANCE', wheel.ok ? wheel.dist.toFixed(3) + ' KM' : '-', 224, 428, '#00ff88');
  const achCard = loadJSON('sqk29:ach:' + walletKey(w), []);
  row('ACHIEVEMENTS', achCard.length ? achCard.length + '/11 — ' + achCard.slice(0, 2).join(', ') : '0/11 — PLAY TO UNLOCK', 24, 472, '#ffe14d');
  hair(496);
  // v35.1: the Squeek's own DotGrid art, live from /v1/squeeks/{id}.
  // A failed/slow fetch draws a dashed placeholder — the card never breaks for an image.
  if (sqkImg) {
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2; ctx.strokeRect(24, 508, 76, 76);
    ctx.drawImage(sqkImg, 26, 510, 72, 72);
  } else {
    ctx.save();
    ctx.strokeStyle = '#ff5ce1'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.strokeRect(24, 508, 76, 76); ctx.setLineDash([]);
    ctx.fillStyle = '#ff5ce1'; ctx.font = 'bold 20px "Space Mono"'; ctx.textAlign = 'center';
    ctx.fillText('?', 62, 556); ctx.restore();
  }
  ctx.textAlign = 'left';
  // v35: MY SQUEEK — the player's Squeek, stake and claimable, live from /v1/accounts.
  // An empty account is shown honestly as NONE YET; a failed fetch as [ STATUS ], never 0.
  if (acct && acct.ok && acct.first) {
    row('MY SQUEEK', '#' + acct.first.tokenId + ' • LV ' + acct.first.level + ' • POWER ' + Number(acct.first.basePower || 0).toLocaleString('en-US'), 116, 516, '#00e5ff');
    row('NEXT MERGE', acct.first.mergeState === 'ready' ? 'READY NOW' : 'BLOCK ' + acct.first.nextMergeHeight, 116, 560, '#00e5ff');
    row('STAKED SQK', acct.staked + ' SQK', 24, 604, '#00ff88');
    row('CLAIMABLE', acct.claimable + ' SQK', 224, 604, '#00ff88');
  } else if (acct && acct.ok) {
    row('MY SQUEEK', 'NONE YET — NO SQUEEK FOUND', 116, 516, '#ff5ce1');
    row('NEXT MERGE', '—', 116, 560, '#ff5ce1');
    row('STAKED SQK', '0 SQK', 24, 604, '#00ff88');
    row('CLAIMABLE', '0 SQK', 224, 604, '#00ff88');
  } else {
    row('MY SQUEEK', '[ ' + (acct ? acct.status : 'UNKNOWN') + ' ]', 116, 516, '#ff5ce1');
    row('NEXT MERGE', '—', 116, 560, '#ff5ce1');
    row('STAKED SQK', '[ ? ]', 24, 604, '#ff5ce1');
    row('CLAIMABLE', '[ ? ]', 224, 604, '#ff5ce1');
  }

  ctx.textAlign = 'center'; ctx.fillStyle = '#5c6669'; ctx.font = '9px "Space Mono"';
  ctx.fillText('squeekpixel.web.id  •  UNOFFICIAL DATA // ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', CW / 2, CH - 16);
  ctx.textAlign = 'left';

  if (btn) btn.disabled = false; say(msg('cardDone'), 'green');
  const emDone = $('cardErrMsg'); if (emDone) emDone.classList.add('hidden');
  openCard(msg('cardTitleId')); // v33: the card opens on top — no jump back to the menu
}

const cardBlob = () => new Promise(r => { try { $('card-canvas').toBlob(r, 'image/png'); } catch { r(null); } });
async function download() {
  const b = await cardBlob(); if (!b) return say(msg('downloadFail'), 'pink');
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
  if (ll) { const st = loadJSON('sqk24:streak:' + walletKey(w), { count: 0 }); ll.textContent = `LV ${lv} • ${totalXP(w)} XP` + (st.count ? msgf('streakDays', { n: st.count }) : '') + (lv >= 8 ? ' • GOLD' : ''); }
  wrap.classList.toggle('gold', lv >= 8); // v28: LV8 gold frame
  wrap.classList.remove('hidden');
  startPreviewSpin(w); // v26 FIX #4: putaran di DALAM canvas (scaleX = cos), kotaknya diam, teks tidak gepeng
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

// ==========================================
// v39 B2 — PREFETCH SESI PREVIEW (FREE)
// Pekerja B membuktikan bug smoke test #1+#2 berakar pada divergensi seed:
// preview() membangun lagu FREE dari seed wallet, sedangkan play()
// membangun lagu dari seed server ('FREE-'+session.seed). Panel hasil kini
// membaca snapshot G.song (benar), tapi preview masih menjanjikan lagu yang
// berbeda. Prefetch ini menutup separuh itu: preview memakai seed sesi yang
// SAMA dengan yang akan dipakai play(), jadi preview == lagu yang dimainkan.
//
// Aturan hemat (rate limit Worker: 10/wallet/jam, 30/IP/jam):
// - SATU fetch per kunjungan tab PLAY; sesi yang sama dipakai ulang untuk
//   semua perubahan genre/diff (anthem dibangun ulang dari seed sesi +
//   genre/diff baru — tanpa fetch baru).
// - Sesi yang sudah dipakai play() ditandai used dan TIDAK boleh dipakai
//   untuk play kedua; preview berikutnya mengambil sesi baru.
// - Fail-soft: fetch gagal/offline/429 -> preview kembali ke seed wallet
//   seperti dulu, play() kembali seperti dulu. Game tidak pernah crash.
// - Hanya FREE yang memakai seed server. DAILY (dailySpec), CHALLENGE
//   (challengeCode dari duel link — deterministik), BOSS (weeklyKey)
//   deterministik — tidak disentuh. LIVE/RACE memakai seed dari snapshot
//   wheel — tidak disentuh.
let previewSession = null; // { sessionId, seed, nonce, expiresAt, wallet, mode, used }
let previewFetchInFlight = null; // janji POST /session yang sedang berjalan (dedupe)
let previewFetchWallet = null; // wallet yang dimintakan fetch in-flight itu
const PREVIEW_SESSION_GRACE_MS = 5000; // sesi harus hidup > 5 detik lagi agar dipakai

function previewSessionValid(s) {
  return !!(s && !s.used && s.mode === 'free' && Number.isFinite(s.expiresAt) && s.expiresAt > Date.now() + PREVIEW_SESSION_GRACE_MS && Number.isInteger(s.seed) && s.seed >= 0 && s.seed <= 4294967295);
}

// Ambil (atau pakai ulang) sesi preview untuk wallet saat ini. Mengembalikan
// objek sesi, atau null bila offline/gagal — pemanggil WAJIB fail-soft.
async function ensurePreviewSession(wallet) {
  const w = (wallet || 'GUEST').toLowerCase();
  if (previewSessionValid(previewSession) && (previewSession.wallet || 'guest') === w) return previewSession;
  if (previewFetchInFlight) {
    if (previewFetchWallet !== w) return null; // fetch untuk wallet lain sedang jalan — jangan tumpuk; preview berikutnya akan mengambil sesi baru
    try { return await previewFetchInFlight; } catch (_) { return null; }
  }
  previewFetchWallet = w;
  previewFetchInFlight = (async () => {
    try {
      const sr = await tfetch(CONFIG.LB_URL + '/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: wallet || 'GUEST', mode: 'free' }) }, 5000);
      if (!sr.ok) return null;
      const sj = await sr.json();
      if (!sj || !sj.sessionId || !Number.isInteger(sj.seed)) return null;
      const exp = Number.isFinite(+sj.expiresAt) ? +sj.expiresAt : Date.now() + 30 * 60 * 1000; // Worker selalu kirim expiresAt (TTL 30 mnt); fallback = TTL terdokumentasi
      previewSession = { sessionId: sj.sessionId, seed: sj.seed, nonce: sj.nonce, expiresAt: exp, wallet: w, mode: 'free', used: false };
      return previewSession;
    } catch (_) { return null; }
  })();
  try { return await previewFetchInFlight; } finally { previewFetchInFlight = null; previewFetchWallet = null; }
}

// seedKey FREE dari sesi preview (dipakai preview DAN play — SATU sumber
// kebenaran, jadi lagu yang dijanjikan == lagu yang dimainkan). null =
// tidak ada sesi valid untuk wallet ini -> pemanggil pakai fallback lama
// (seed wallet).
function previewFreeSeedKey(wallet) {
  const w = (wallet || 'GUEST').toLowerCase();
  return (previewSessionValid(previewSession) && (previewSession.wallet || 'guest') === w) ? 'FREE-' + String(previewSession.seed) : null;
}

async function preview() {
  const w = $('walletInput').value.trim();
  if (w && !isAddr(w)) { $('anthemInfo').textContent = msg('invalidAddr'); $('walletInput').classList.add('invalid'); return; }
  $('walletInput').classList.remove('invalid');
  maybeMigrateLegacy8(w); // v38: one-time legacy check whenever the wallet is (re)entered
  if (playMode === 'daily') applyDailySpec(); // v28: daily genre+diff come from the date
  const lanes = lanesForSong(), mirror = mirrorForSong();
  // v39 B2: FREE — preview memakai seed sesi server yang SAMA dengan play()
  // (prefetch; fail-soft ke seed wallet bila offline/tanpa sesi). Mode lain
  // deterministik (seedKeyFor) dan tidak disentuh. Guard pasca-await: bila
  // mode/wallet berubah selagi fetch berjalan, preview terbaru sudah
  // dirender oleh pemanggil lain — jangan timpa dengan render basi.
  let seedOverride = playMode === 'free' ? null : seedKeyFor(playMode);
  if (playMode === 'free') {
    await ensurePreviewSession(w);
    if (playMode !== 'free' || $('walletInput').value.trim() !== w) return;
    seedOverride = previewFreeSeedKey(w);
  }
  const a = makeAnthem(w, false, seedOverride, lanes, mirror), b = loadBest(w);
  const liveTag = liveSnapshot && liveSnapshot.ok ? msgf('anthemLiveOk', { rpm: Math.round(liveSnapshot.rpm), bpm: a.bpm }) : msg('anthemLiveOff');
  const modeTag = playMode === 'free' ? '' : playMode === 'daily' ? msgf('anthemDaily', { date: squeekTodayStr(), genre: currentGenre.toUpperCase(), diff: currentDiff.toUpperCase() }) : playMode === 'live' ? msgf('anthemLive', { live: liveTag }) : playMode === 'race' ? msgf('anthemRace', { live: liveTag }) : playMode === 'boss' ? msgf('anthemBoss', { week: weeklyKey() }) : msgf('anthemDuel', { code: String(challengeCode || '').slice(0, 12), lanes: lanes === 4 ? ' • 4 LANES' : '', mirror: mirror ? ' • MIRROR' : '' });
  $('anthemInfo').textContent = msg('anthemPrefix') + `"${a.name}" • ${a.key} ${a.scaleName} [${a.bpm} BPM] // NOTES: ${a.chart.length}` + (b ? msgf('anthemBest', { score: b.score }) : '') + modeTag;
  renderAvatarPreview(w); renderUnlocks(); applyHue(a.hue);
}

const walletEl = $('walletInput');
// v38 WALLET REMEMBERED: refill the saved address on load (autofill only —
// never auto-request accounts). ?wallet= in the URL still wins (boot code).
try { const saved38 = localStorage.getItem('sqk38:wallet'); if (walletEl && !walletEl.value && saved38 && isAddr(saved38)) walletEl.value = saved38; } catch (_) {}
function saveWallet38(addr) { try { if (addr && isAddr(addr)) localStorage.setItem('sqk38:wallet', addr); } catch (_) {} }
function forgetWallet38() {
  try { localStorage.removeItem('sqk38:wallet'); } catch (_) {}
  // v42.5: bila wallet sedang terhubung, field menampilkan alamat koneksi
  // (read-only) — jangan dikosongkan seolah-olah tidak ada wallet.
  if (walletEl) walletEl.value = connectedAddr || '';
  preview(); renderUnlocks(); renderDailyBox(); renderMastery(); renderAchievements(); renderLeague(); renderChamps();
  say(msg('walletForgotten'), 'cyan');
}
if (walletEl) walletEl.addEventListener('input', preview);
if (walletEl) { walletEl.addEventListener('change', () => saveWallet38(walletEl.value.trim())); walletEl.addEventListener('blur', () => saveWallet38(walletEl.value.trim())); }

// v26.1 CONNECT WALLET (read-only): fills the address field from the browser
// wallet (MetaMask / any EIP-1193 wallet). It only asks the
// wallet to REVEAL the address (eth_requestAccounts) — no signature, no
// approval, no transaction, no chain switch. If no provider exists, or the
// user rejects, manual 0x input stays the way in. Never auto-requests on load.
// --- v42.2: WalletConnect (Reown) — path B for plain browsers (Chrome)
// that have no injected wallet. v42.3: the provider comes from the
// lazy-loaded VENDORED bundle (wc-provider.bundle.js), never a CDN tag.
// @walletconnect/ethereum-provider 2.26.0 .d.ts (API surface, verified):
// EthereumProvider.init({projectId, chains, optionalChains, showQrModal,
// rpcMap, metadata}) -> provider.connect() opens the AppKit modal (QR +
// wallet list) -> provider.request() works like any EIP-1193 provider.
// eth_chainId on the WC provider returns a NUMBER (not a hex string) —
// sqkChainIdHex normalises both. A live session is restored from
// localStorage by init() itself; we only attempt the restore when a
// "wc@2:" key exists, so plain loads never open a relay connection.
let wcProvider = null; // active WalletConnect provider (module-level: G is replaced every game)
function getEth() {
  if (wcProvider && typeof wcProvider.request === 'function' && wcProvider.connected !== false) return wcProvider;
  const eth = window.ethereum;
  if (eth && typeof eth.request === 'function') return eth;
  return null;
}
function sqkChainIdHex(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return '0x' + v.toString(16);
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (/^0x[0-9a-f]+$/.test(s)) return s;
  if (/^[0-9]+$/.test(s)) return '0x' + parseInt(s, 10).toString(16);
  return s;
}
async function ensureSepoliaChain(eth) {
  if (!eth || typeof eth.request !== 'function') return false;
  try {
    const cid = await eth.request({ method: 'eth_chainId' });
    if (cid !== null && cid !== undefined && sqkChainIdHex(cid) === '0xaa36a7') return true;
  } catch (_) {}
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
    return true;
  } catch (e) {
    if (e && e.code === 4902) {
      try {
        await eth.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0xaa36a7', chainName: 'Sepolia', nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: [CONFIG.SEPOLIA_RPC], blockExplorerUrls: ['https://eth-sepolia.blockscout.com'] }] });
        return true;
      } catch (_) { return false; }
    }
    return false;
  }
}
let wcBundlePromise = null; // v42.3: one in-flight load of the vendored WC bundle (deduped)
function wcLoadBundle(timeoutMs) {
  // Lazy-load the vendored bundle ONLY on demand (~2 MB; plain players
  // must never pay for it) — except the v42.5.2 FIX 3 restore preload,
  // which runs at page load ONLY when a wc@2: session key exists.
  // Returns true iff window.EthereumProvider exists afterwards. Resolves
  // false on any failure (network, CSP, bundle error) — never throws,
  // never hangs. v42.5.2 FIX 3: the watchdog is a parameter — the restore
  // path waits up to 60 s (the bundle cannot download in 15 s at ~3 K/s);
  // a manual connect click keeps the 15 s watchdog.
  const waitMs = (typeof timeoutMs === 'number' && timeoutMs > 0) ? timeoutMs : 15000;
  if (typeof window.EthereumProvider !== 'undefined') return Promise.resolve(true);
  if (wcBundlePromise) return wcBundlePromise;
  wcBundlePromise = new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    try {
      const s = document.createElement('script');
      s.src = 'wc-provider.bundle.js';
      s.onload = () => finish(typeof window.EthereumProvider !== 'undefined');
      s.onerror = () => finish(false);
      document.head.appendChild(s);
      setTimeout(() => finish(typeof window.EthereumProvider !== 'undefined'), waitMs);
    } catch (_) { finish(false); }
  });
  return wcBundlePromise;
}
async function wcGetProvider(bundleTimeoutMs, forRestore) {
  if (wcProvider) return wcProvider;
  if (typeof window.EthereumProvider === 'undefined') {
    const ok = await wcLoadBundle(bundleTimeoutMs); // v42.3: vendored bundle, loaded on demand
    if (!ok || typeof window.EthereumProvider === 'undefined') return null;
  }
  const p = await window.EthereumProvider.init({
    projectId: CONFIG.WC_PROJECT_ID,
    chains: CONFIG.WC_CHAINS,
    optionalChains: CONFIG.WC_CHAINS,
    showQrModal: !forRestore, // v42.5.2 FIX 3: restore init NEVER opens a modal on page load — the vendored bundle opens it only when showQrModal is true
    rpcMap: { 11155111: CONFIG.SEPOLIA_RPC },
    metadata: {
      name: 'Squeek Pixel ID',
      description: 'Pixel rhythm game on Squeekchain — the hamster sets the tempo',
      url: 'https://squeekpixel.web.id/',
      icons: ['https://squeekchain-leaderboard.pancigoreng.workers.dev/icon.png'],
    },
  });
  if (!forRestore) wcProvider = p; // v42.5.2 FIX 3: a restore provider is cached only after a successful restore (see restoreWalletConnectSession)
  if (typeof p.on === 'function') {
    p.on('accountsChanged', (accounts) => {
      const addr = Array.isArray(accounts) ? accounts[0] : null;
      if (addr && isAddr(addr) && walletEl) { walletEl.value = addr; saveWallet38(addr); preview(); setConnected(addr); say(msgf('walletSwitched', { addr: addr.slice(0, 6) + '...' + addr.slice(-4) }), 'cyan'); }
      else if (!addr) setConnected(null); // v42.4: akun kosong = terputus — tombol kembali ke CONNECT WALLET
    });
    p.on('disconnect', () => { wcProvider = null; setConnected(null); say(msg('walletDisconnected'), 'cyan'); }); // v42.4: tombol kembali ke CONNECT WALLET
  }
  return p;
}
async function connectWalletConnect() {
  let p = null;
  try { p = await wcGetProvider(); } catch (_) { p = null; }
  if (!p) return say(msg('wcLoadFail'), 'pink');
  try {
    await p.connect(); // AppKit modal: QR + wallet list (OKX, MetaMask, ...)
    const accounts = await p.request({ method: 'eth_requestAccounts' });
    const addr = Array.isArray(accounts) ? accounts[0] : null;
    if (!addr || !isAddr(addr)) return say(msg('walletInvalid'), 'pink');
    if (walletEl) walletEl.value = addr;
    saveWallet38(addr);
    preview();
    setConnected(addr); // v42.4: tombol berubah jadi TERHUBUNG
    say(msgf('walletConnected', { addr: addr.slice(0, 6) + '...' + addr.slice(-4) }), 'green');
  } catch (_) {
    return say(msg('wcRejected'), 'pink'); // modal closed / rejected — never an error, never a crash
  }
}
// v42.5.2 FIX 3 — WalletConnect restore: diagnosis + fix (details in
// AUDIT-v42.5.2.md). The restore NEVER worked on the user's phone.
// Diagnosis, verified against the vendored @walletconnect/
// ethereum-provider 2.26.0 bundle: (a) restore only read accounts
// PASSIVELY (p.accounts / eth_accounts) — on a provider that has not
// connected yet that returns [] even when a session is stored; only
// enable() re-activates the stored session (bundle: enable() =
// this.session || await this.connect(), then eth_requestAccounts —
// with a session present connect() is SKIPPED, so no modal, no hang).
// (b) the 2.1 MB bundle had to download first behind a 15 s watchdog —
// impossible at ~3 K/s on cold load, so restore died silently before
// it could try. Fix: preload the bundle at page load when a wc@2: key
// exists; restore waits up to 60 s for it; enable() is called only when
// a session key exists AND p.session is present (never when there is no
// session at all); restore init uses showQrModal:false so a modal can
// NEVER open on page load. Every failure records a reason shown as
// small text under the wallet card, so the user can report the exact
// reason if it still fails.
let wcRestoreReason = null; // v42.5.2 FIX 3: last restore failure code, for diagnosis
function setWcRestoreNote(reason) {
  wcRestoreReason = reason || null;
  const el = $('wcRestoreNote');
  if (el) {
    // v42.5.4: the restore status is VISIBLE, not a small hidden note.
    // 'restoring' = the stored session is being re-activated (the 2.1 MB
    // bundle can take 1–3 minutes on a slow connection) — shown in cyan.
    // The three failure codes are shown in yellow, one readable line.
    // A missing session key is the normal never-connected state, not a
    // failure worth displaying.
    const show = reason === 'restoring' || reason === 'bundle-timeout' || reason === 'no-accounts' || reason === 'enable-rejected';
    el.classList.toggle('hidden', !show);
    el.classList.toggle('restoring', reason === 'restoring');
    el.classList.toggle('failed', reason === 'bundle-timeout' || reason === 'no-accounts' || reason === 'enable-rejected');
    if (reason === 'restoring') el.textContent = msg('wcRestoring');
    else if (show) el.textContent = msgf('wcRestoreNoteTpl', { reason });
  }
  // v42.5.4: disable the CONNECT WALLET button while a restore runs, so
  // the user cannot tap connect mid-restore and create a second session.
  // Re-enabling on failure is done here; on success updateConnectBtn()
  // (via setConnected) owns the button. null / no-session-key leave the
  // button alone — updateConnectBtn() owns its normal state.
  const cb = $('connectBtn');
  if (cb) {
    if (reason === 'restoring') cb.disabled = true;
    else if (reason === 'bundle-timeout' || reason === 'no-accounts' || reason === 'enable-rejected') cb.disabled = false;
  }
}
function hasWcSessionKey() {
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf('wc@2:') === 0) return true; } } catch (_) {}
  return false;
}
async function restoreWalletConnectSession() {
  try {
    if (window.ethereum) return; // injected path owns the wallet field
    if (!hasWcSessionKey()) { setWcRestoreNote('no-session-key'); return; }
    // v42.5.4: show a VISIBLE "reconnecting" status and disable the
    // CONNECT WALLET button while the restore runs (the 2.1 MB bundle
    // can take 1–3 minutes on a slow connection — until now the button
    // still said CONNECT WALLET, so users thought the restore had failed
    // when it was still running). The finally below guarantees the
    // status never sticks: every exit path ends with a final reason.
    setWcRestoreNote('restoring');
    try {
      const p = await wcGetProvider(60000, true); // v42.5.2 FIX 3: 60 s bundle wait, no modal
      if (!p) { setWcRestoreNote('bundle-timeout'); return; }
      let accounts = (p.accounts && p.accounts.length) ? p.accounts : null;
      if (!accounts) { try { accounts = await p.request({ method: 'eth_accounts' }); } catch (_) { accounts = null; } }
      let addr = Array.isArray(accounts) ? accounts[0] : null;
      if (!addr && p.session) {
        // Passive read empty but a stored session exists: re-activate it
        // silently. enable() skips connect() when this.session is set
        // (verified in the vendored bundle), so no modal and no hang.
        try {
          const enabled = await p.enable();
          addr = Array.isArray(enabled) ? enabled[0] : null;
          if (!addr) { try { const a2 = await p.request({ method: 'eth_accounts' }); addr = Array.isArray(a2) ? a2[0] : null; } catch (_) {} }
        } catch (_) { setWcRestoreNote('enable-rejected'); return; }
      }
      if (addr && isAddr(addr)) {
        wcProvider = p; // cache only after a successful restore
        if (walletEl) walletEl.value = addr; saveWallet38(addr); preview(); setConnected(addr);
        setWcRestoreNote(null);
      } else setWcRestoreNote('no-accounts');
    } finally {
      // v42.5.4: the "reconnecting" status must never stick — if the
      // body ended without setting a final reason (unexpected throw),
      // clear it here; the outer catch then reports bundle-timeout.
      if (wcRestoreReason === 'restoring') setWcRestoreNote(null);
    }
  } catch (_) { setWcRestoreNote('bundle-timeout'); }
}
async function restoreInjectedSession() { // v42.4: browser dalam-app wallet (MetaMask/OKX) tetap terhubung saat reload — baca akun TANPA prompt (eth_accounts tidak pernah membuka pop-up)
  try {
    const eth = window.ethereum;
    if (!eth || typeof eth.request !== 'function') return;
    const accounts = await eth.request({ method: 'eth_accounts' });
    const addr = Array.isArray(accounts) ? accounts[0] : null;
    if (addr && isAddr(addr)) { if (walletEl) walletEl.value = addr; saveWallet38(addr); preview(); setConnected(addr); }
  } catch (_) {}
}
// v42.4 — STATUS TOMBOL CONNECT (BUG 2): satu-satunya sumber kebenaran
// adalah koneksi provider yang AKTIF (path A injected atau path B WC),
// BUKAN isi field alamat (alamat bisa diketik manual tanpa connect).
// connectedAddr = alamat provider yang terhubung, null bila tidak ada.
// Tombol yang terhubung menampilkan alamat + disabled (tidak bisa
// diklik dua kali / disconnect tak sengaja); ganti wallet dilakukan dari
// aplikasi wallet-nya (accountsChanged), disconnect mengembalikan tombol.
let connectedAddr = null;
function updateConnectBtn() {
  const b = $('connectBtn'); if (!b) return;
  const connected = !!(connectedAddr && isAddr(connectedAddr));
  const dict = I18N[lang] || I18N.en;
  const short = connected ? connectedAddr.slice(0, 6) + '...' + connectedAddr.slice(-4) : '';
  // v42.5.4: while a WC session restore is running, the button stays
  // disabled — the restore re-activates the stored session, and tapping
  // connect mid-restore would open a second session. The visible
  // "MENGHUBUNGKAN KEMBALI…" status lives in #wcRestoreNote. (typeof
  // guard: unit harnesses that extract this function may not declare
  // wcRestoreReason.)
  const restoring = (typeof wcRestoreReason !== 'undefined') && wcRestoreReason === 'restoring';
  if (connected) {
    b.textContent = (dict.connectedTpl || '[ CONNECTED: {addr} ]').split('{addr}').join(short);
    b.disabled = true;
  } else if (restoring) {
    b.textContent = dict.connect || '[ CONNECT WALLET ]';
    b.disabled = true;
  } else {
    b.textContent = dict.connect || '[ CONNECT WALLET ]';
    b.disabled = false;
  }
  // v42.5 (P1-1): kartu status hijau + tombol DISCONNECT sendiri saat
  // terhubung; field alamat jadi read-only (isinya alamat koneksi, bukan
  // input bebas). Saat belum terhubung: kartu + disconnect disembunyikan,
  // field bisa diedit dan dilabeli MANUAL — alamat lama yang tersimpan
  // tidak boleh tampil seolah-olah connect.
  const st = $('walletStatus');
  if (st) {
    st.classList.toggle('hidden', !connected);
    if (connected) { st.classList.remove('not-connected'); st.textContent = msgf('walletConnectedTpl', { addr: short }); }
  }
  const dc = $('disconnectBtn');
  if (dc) dc.classList.toggle('hidden', !connected);
  if (walletEl) walletEl.readOnly = connected;
  const mn = $('walletManualNote');
  if (mn) mn.classList.toggle('hidden', connected);
}
// v42.5 (P1-1): DISCONNECT sendiri di halaman (dulu hanya bisa dari
// aplikasi wallet). WalletConnect: putuskan sesi provider. Injected
// (MetaMask/OKX dalam aplikasi): tidak ada disconnect programatik —
// bersihkan state lokal saja (wallet tetap terhubung di aplikasinya;
// connect berikutnya memakai akun yang sama tanpa prompt baru).
async function disconnectWallet() {
  try { if (wcProvider && typeof wcProvider.disconnect === 'function') await wcProvider.disconnect(); } catch (_) {}
  wcProvider = null;
  setConnected(null);
  say(msg('walletDisconnected'), 'cyan');
}
function setConnected(addr) { connectedAddr = (addr && isAddr(addr)) ? addr : null; if (connectedAddr) setWcRestoreNote(null); updateConnectBtn(); }
async function connectWallet() {
  const eth = window.ethereum;
  if (eth && typeof eth.request === 'function') {
    // Path A (unchanged since v26.1): in-wallet browser (MetaMask/OKX app).
    try {
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      const addr = Array.isArray(accounts) ? accounts[0] : null;
      if (!addr || !isAddr(addr)) return say(msg('walletInvalid'), 'pink');
      if (walletEl) walletEl.value = addr;
      saveWallet38(addr);
      preview();
      setConnected(addr); // v42.4: tombol berubah jadi TERHUBUNG
      say(msgf('walletConnected', { addr: addr.slice(0, 6) + '...' + addr.slice(-4) }), 'green');
    } catch (e) {
      const code = e && e.code;
      if (code === 4001) return say(msg('connRejected'), 'pink');
      return say(msgf('connFail', { err: String((e && e.message) || e).slice(0, 60) }), 'pink');
    }
    return;
  }
  // Path B (v42.2): plain browser (Chrome) — WalletConnect modal.
  await connectWalletConnect();
}
if (window.ethereum && typeof window.ethereum.on === 'function') {
  window.ethereum.on('accountsChanged', (accounts) => {
    const addr = Array.isArray(accounts) ? accounts[0] : null;
    if (addr && isAddr(addr) && walletEl) { walletEl.value = addr; saveWallet38(addr); preview(); setConnected(addr); say(msgf('walletSwitched', { addr: addr.slice(0, 6) + '...' + addr.slice(-4) }), 'cyan'); }
    else if (!addr) setConnected(null); // v42.4: akun kosong = terputus — tombol kembali ke CONNECT WALLET
  });
}
// v42.5.2 FIX 3: preload the WC bundle in the background when a session
// key exists, so the restore does not wait for a cold 2.1 MB download.
// (Fire-and-forget: the load is deduped via wcBundlePromise and the
// restore below awaits the same promise.)
if (!window.ethereum && hasWcSessionKey()) wcLoadBundle(60000);
restoreWalletConnectSession();
restoreInjectedSession(); // v42.4: pulihkan status terhubung di in-app browser tanpa prompt
// v42.5 (P1-1): bila restore gagal, tampilkan status BELUM TERHUBUNG dengan
// jelas — jangan pernah menampilkan alamat lama (field manual) seolah-olah
// connect. Restore berjalan async; updateConnectBtn() dipanggil lagi di
// akhir setConnected() bila ada sesi yang berhasil dipulihkan.
updateConnectBtn();
bindClick('connectBtn', connectWallet);
bindClick('disconnectBtn', disconnectWallet); // v42.5 (P1-1)
bindClick('playBtn', play); bindClick('genBtn', generateCard);
bindClick('dlBtn', download); bindClick('shareBtn', share);
bindClick('stopBtn', () => armOrExit($('stopBtn'), 'stop')); bindClick('againBtn', play);
bindClick('pauseResumeBtn', resumeGame); bindClick('pauseExitBtn', () => armOrExit($('pauseExitBtn'), 'pause')); bindClick('pauseCalibBtn', pauseCalibrate);
bindClick('backToGameBtn', () => { if (!G || G.ended) return; show('gamePanel'); showPauseOverlay(); });
bindClick('forgetWalletBtn', forgetWallet38);
bindClick('pauseBtn', togglePause); bindClick('muteBtn', toggleMute);
bindClick('qualityBtn', () => setQuality(quality === 'ultra' ? 'hemat' : 'ultra'));
bindClick('homeBtn', () => show('mainPanel'));
bindClick('toCardBtn', () => { generateCard(); }); // v33: generateCard opens the overlay itself — no panel jump
// v32 NEO: settings sheet + PLAY-tab latency shortcut
let pausedBySettings = false; // v33: opening settings mid-song pauses; closing resumes only if we paused it
function openSettings() { const s = $('settingsSheet'), b = $('settingsBackdrop'); if (s) s.classList.remove('hidden'); if (b) b.classList.remove('hidden'); if (G && !G.ended && !G.paused) { pausedBySettings = true; pauseGame(); } }
function closeSettings() { const s = $('settingsSheet'), b = $('settingsBackdrop'); if (s) s.classList.add('hidden'); if (b) b.classList.add('hidden'); if (pausedBySettings) { pausedBySettings = false; resumeGame(); } }
bindClick('settingsBtn', openSettings);
bindClick('settingsCloseBtn', closeSettings);
bindClick('settingsBackdrop', closeSettings);
bindClick('latCalibBtn', () => { startCalibration(); });

function renderDailyBox() {
  const box = $('dailyBox'); if (!box) return;
  const w = $('walletInput') ? $('walletInput').value.trim() : '';
  const isDaily = playMode === 'daily';
  box.classList.toggle('hidden', !isDaily);
  if (!isDaily) return;
  const st = loadJSON('sqk24:streak:' + walletKey(w), { count: 0 });
  const sl = $('streakLine'); if (sl) sl.textContent = msgf('streakTpl', { n: st.count });
  const fl = $('freezeLine'); if (fl) { const fr = loadJSON('sqk29:freeze:' + walletKey(w), 0); fl.classList.toggle('hidden', fr <= 0); fl.textContent = fr > 0 ? msgf('freezeTpl', { n: fr }) : ''; }
  const dt = $('dailyTitle'); if (dt) dt.textContent = msgf('dailyTitleTpl', { date: squeekTodayStr() });
  const di = $('dailyInfo'); if (di) { const s = dailySpec(); di.textContent = msgf('dailyInfoTpl', { genre: s.genre.toUpperCase(), diff: s.diff.toUpperCase(), date: squeekTodayStr() }); }
  const done = loadJSON(missionsDoneKey(w), []);
  const ml = $('missionList');
  if (ml) ml.innerHTML = dailyMissions(squeekTodayStr()).map(m => `<div class="mission${done.includes(m.id) ? ' done' : ''}">${msg(m.k)}</div>`).join('');
}
function renderMastery() {
  const w = $('walletInput') ? $('walletInput').value.trim() : '';
  const hist = loadJSON('sqk24:hist:' + walletKey(w), []);
  const bars = $('historyBars'), stats = $('masteryStats');
  if (!bars || !stats) return;
  if (!hist.length) { bars.innerHTML = ''; stats.textContent = msg('masteryEmpty'); return; }
  const max = Math.max.apply(null, hist.map(h => h.score).concat([1]));
  const best = Math.max.apply(null, hist.map(h => h.score));
  bars.innerHTML = hist.map(h => `<i style="height:${Math.max(6, Math.round(h.score / max * 100))}%" title="${h.score} • ${h.acc}%"></i>`).join('');
  const avgAcc = (hist.reduce((s, h) => s + h.acc, 0) / hist.length).toFixed(1);
  const avgOffs = hist.filter(h => h.avgOff !== null && h.avgOff !== undefined);
  const avgOff = avgOffs.length ? Math.round(avgOffs.reduce((s, h) => s + h.avgOff, 0) / avgOffs.length) : null;
  const bestBy = {};
  hist.forEach(h => { const k = h.genre + '/' + h.diff; if (!bestBy[k] || h.score > bestBy[k]) bestBy[k] = h.score; });
  stats.textContent = msgf('masteryTpl', { n: hist.length, best, acc: avgAcc, avgOff: avgOff !== null ? msgf('masteryAvgOff', { off: (avgOff > 0 ? '+' : '') + avgOff }) : '', bestPer: msgf('masteryBestPer', { list: Object.entries(bestBy).map(([k, v]) => `${k} ${v}`).join(', ') }) });
}

// v28 FIX — UNLOCKS road map in the menu + options row (lanes / mirror).
function renderUnlocks() {
  const box = $('unlockBox'); if (!box) return;
  const lv = playerLevel(currentWallet());
  box.innerHTML = `<p class="unlock-title">${msgf('unlockTitleTpl', { lv })}</p>` + [5, 6, 7, 8].map(l => {
    const u = UNLOCKS[l], done = lv >= l;
    return `<div class="unlock${done ? ' done' : ''}">${done ? '✓' : '🔒'} LV${l} — ${msg(u.k)}</div>`;
  }).join('');
  const vg = document.querySelector('#genreRow [data-genre="void"]');
  if (vg) { vg.classList.toggle('locked', lv < 5); vg.textContent = lv < 5 ? 'VOID 🔒 LV5' : 'VOID'; }
  renderOptionsRow();
}
function renderOptionsRow() {
  const lv = playerLevel(currentWallet());
  const lb = $('lanesBtn'), mb = $('mirrorBtn');
  if (lb) { lb.textContent = 'LANES: ' + (lanes4Enabled ? '4' : '3') + (lv < 6 ? ' 🔒 LV6' : ''); lb.classList.toggle('locked', lv < 6); }
  if (mb) { mb.textContent = 'MIRROR: ' + (mirrorEnabled ? msg('mirrorOn') : msg('mirrorOff')) + (lv < 7 ? ' 🔒 LV7' : ''); mb.classList.toggle('locked', lv < 7); }
}
function renderOffsetLine() {
  const off = (offsetMs > 0 ? '+' : '') + offsetMs;
  const el = $('offsetLine'); if (el) el.textContent = 'OFFSET: ' + off + ' ms' + (offsetMs === 0 ? msg('offsetDefault') : '');
  const lv2 = $('latVal'); if (lv2) lv2.textContent = msgf('latTpl', { off }); // v32: the PLAY-tab latency row mirrors the offset
}

// v28 FIX — AUTO-CALIBRATE: 8 metronome beats (100 BPM) on the audio clock;
// the player taps the big button on each beat. The median tap error becomes
// the offset (clamped ±150ms, rounded to 5ms). Needs sound — aborts if muted.
let calib = null, calibTimer = null;
function startCalibration() {
  if (calib) { cancelCalibration('CALIBRATION CANCELLED.'); return; }
  if (muted) return say(msg('calibNeedSound'), 'pink');
  initAudio().then(() => {
    if (!ac || ac.state !== 'running') return say(msg('calibNoAudio'), 'pink');
    stopIntroMusic();
    const t0 = ac.currentTime + 1.0, beats = [];
    for (let i = 0; i < 8; i++) beats.push(t0 + i * 0.6);
    calib = { beats, taps: [], next: 0 };
    const tb = $('calibTapBtn'), pm = $('calibProg'), cm = $('calibMsg');
    if (tb) tb.classList.remove('hidden');
    if (pm) { pm.classList.remove('hidden'); pm.textContent = msg('calibListen'); }
    if (cm) cm.classList.add('hidden');
    say(msg('calibStart'), 'yellow');
    calibTimer = setInterval(() => {
      if (!calib) return;
      const now = ac.currentTime;
      while (calib.next < calib.beats.length && calib.beats[calib.next] < now + 0.18) {
        const t = calib.beats[calib.next];
        kick(t); tone(880, t, 'square', 0.2, 0.1);
        calib.next++;
      }
      if (calib.next >= calib.beats.length && now > calib.beats[calib.beats.length - 1] + 0.6) finishCalibration();
    }, 40);
  }).catch(() => say(msg('calibAudioFail'), 'pink'));
}
function calibTap() {
  if (!calib || !ac) return;
  const now = ac.currentTime;
  let best = null, bd = Infinity;
  calib.beats.forEach((b, i) => { const d = Math.abs(now - b); if (d < bd) { bd = d; best = i; } });
  if (best === null || bd > 0.25) return; // tap far from any beat — ignore
  if (calib.taps.some(t => t.beat === best)) return; // one tap per beat
  calib.taps.push({ beat: best, err: (now - calib.beats[best]) * 1000 });
  const pm = $('calibProg');
  if (pm) pm.textContent = msgf('calibTapN', { n: calib.taps.length, more: calib.taps.length < 8 ? msg('calibKeep') : msg('calibCalc') });
}
function finishCalibration() {
  if (!calib) return;
  clearInterval(calibTimer); calibTimer = null;
  const taps = calib.taps.slice().sort((a, b) => a.err - b.err);
  const cm = $('calibMsg'), tb = $('calibTapBtn'), pm = $('calibProg');
  if (tb) tb.classList.add('hidden');
  if (pm) pm.classList.add('hidden');
  if (taps.length < 4) {
    if (cm) { cm.classList.remove('hidden'); cm.textContent = msgf('calibFew', { n: taps.length }); }
    say(msg('calibFail'), 'pink');
  } else {
    const med = taps[Math.floor(taps.length / 2)].err;
    setOffsetMs(med);
    const avg = Math.round(taps.reduce((s, t) => s + t.err, 0) / taps.length);
    if (cm) { cm.classList.remove('hidden'); cm.textContent = msgf('calibDoneTpl', { off: (offsetMs > 0 ? '+' : '') + offsetMs, n: taps.length, avg: (avg > 0 ? '+' : '') + avg, verdict: offsetMs > 0 ? msg('calibLate') : offsetMs < 0 ? msg('calibEarly') : msg('calibSpot') }); }
    say(msgf('calibDone', { off: (offsetMs > 0 ? '+' : '') + offsetMs }), 'green');
  }
  calib = null;
  if (!muted) playIntroMusic();
}
function cancelCalibration(msg) {
  if (calibTimer) { clearInterval(calibTimer); calibTimer = null; }
  calib = null;
  const tb = $('calibTapBtn'), pm = $('calibProg');
  if (tb) tb.classList.add('hidden');
  if (pm) pm.classList.add('hidden');
  if (msg) say(msg, 'cyan');
  if (!muted) playIntroMusic();
}
function setMode(m) {
  playMode = m;
  document.querySelectorAll('#modeRow .btn-diff').forEach(x => { const on = x.dataset.mode === m; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); });
  lockGenreDiffRows(m === 'daily' || m === 'lullaby'); // v28: in Daily the genre+diff are fixed by the date; v42.5: Lullaby is always synth/easy
  if (m === 'daily') applyDailySpec();
  if (m === 'lullaby') { currentGenre = 'synth'; currentDiff = 'easy'; syncGenreDiffButtons(); }
  renderDailyBox(); renderLiveBox(); renderRaceBox(); renderLullabyBox(); renderDreamBox(); preview(); // v29.1: the race box must hide when leaving RACE mode (it stayed visible until the next poll)
  if (m === 'live') { refreshLive(); startLivePoll(10000); say(msg('modeLive'), 'yellow'); const lb = $('liveBox'); if (lb) lb.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else if (m === 'race') { renderRaceBox(); refreshLive(); startLivePoll(10000); say(msg('modeRace'), 'yellow'); const rb = $('raceBox'); if (rb) rb.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else if (m === 'lullaby') { renderLullabyBox(); refreshLive(); say(msg('modeLullaby'), 'cyan'); const lb = $('lullabyBox'); if (lb) lb.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else stopLivePoll();
  if (m === 'daily') { const s = dailySpec(); say(msgf('modeDaily', { date: squeekTodayStr(), genre: s.genre.toUpperCase(), diff: s.diff.toUpperCase() }), 'yellow'); const db = $('dailyBox'); if (db) db.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  else if (m === 'free') say(msg('modeFree'), 'cyan'); // v32.2: switching back to FREE used to leave the stale "MODE LIVE AKTIF" banner in #message
}
function duelLink() { if (!G || !G.seedKey) return null; const base = location.href.split('?')[0]; const from = isAddr(G.wallet) ? G.wallet.slice(0, 6) + '...' + G.wallet.slice(-4) : 'GUEST'; return `${base}?challenge=${encodeURIComponent(G.seedKey)}&genre=${G.genre}&diff=${G.diff}${G.lanes === 4 ? '&lanes=4' : ''}${G.mirror ? '&mirror=1' : ''}&from=${encodeURIComponent(from)}&score=${G.score}`; }
async function shareDuel() {
  // v26 FIX #6: feedback ditulis ke #duelMsg / #duelOut DI DALAM resultPanel — bukan ke #message di mainPanel yang tersembunyi
  const link = duelLink();
  const dm = $('duelMsg'), out = $('duelOut');
  if (!link) { if (dm) dm.textContent = msg('duelNoSong'); return; }
  if (out) out.value = link;
  try { await navigator.clipboard.writeText(link); if (dm) dm.textContent = msg('duelCopied'); }
  catch (e) { if (dm) dm.textContent = msg('duelBlocked'); }
  if (out) { out.focus(); out.select(); }
}
document.querySelectorAll('#modeRow .btn-diff').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
bindClick('duelBtn', shareDuel);
bindClick('offsetMinusBtn', () => setOffsetMs(offsetMs - 5));
bindClick('offsetPlusBtn', () => setOffsetMs(offsetMs + 5));
bindClick('calibBtn', startCalibration);
bindClick('calibTapBtn', calibTap);
bindClick('lanesBtn', () => {
  if (playerLevel(currentWallet()) < 6) return say(msg('lanesLock'), 'pink');
  lanes4Enabled = !lanes4Enabled; saveJSON('sqk28:lanes4', lanes4Enabled); renderOptionsRow(); preview();
  say(lanes4Enabled ? 'LANES: 4 — HARDER HIGHWAY, MORE NOTES.' : 'LANES: 3 — CLASSIC.', 'cyan');
});
bindClick('mirrorBtn', () => {
  if (playerLevel(currentWallet()) < 7) return say(msg('mirrorLock'), 'pink');
  mirrorEnabled = !mirrorEnabled; saveJSON('sqk28:mirror', mirrorEnabled); renderOptionsRow(); preview();
  say(mirrorEnabled ? 'MIRROR: ON — THE CHART IS FLIPPED.' : 'MIRROR: OFF.', 'cyan');
});

// ==========================================
// 7. v29 MEGA — RACE, PREDICTION, ACHIEVEMENTS, LEAGUE, BOSS, DIARY, I18N, OBS
// All localStorage-only, no server, no transaction. Honesty rules from v27
// carry over: the wheel is only ever what the API returns; a prediction with
// no recorded samples settles as NO DATA (no XP lost); the league trusts the
// score carried in the duel link itself (a friendly local table).
// ==========================================
// v38: twoDaysAgoStr() removed — the streak now uses squeekTwoDaysAgoStr() (Squeek day, 12:00 UTC).

// --- 10-minute rounds (shared vocabulary: Nap / Jog / Zoomies) ---
function roundKeyFor(d) { const p = n => String(n).padStart(2, '0'); return `${todayStr(d)}-${p(d.getHours())}:${p(Math.floor(d.getMinutes() / 10) * 10)}`; }
function roundClass(avg) { if (!Number.isFinite(avg)) return null; return avg < 5 ? 'nap' : avg < 70 ? 'jog' : 'zoomies'; }
function roundLabel(c) { return c === 'nap' ? '😴 NAP' : c === 'jog' ? '🏃 JOG' : c === 'zoomies' ? '⚡ ZOOMIES' : '—'; }
function nextRoundInMs(d) { const t = d || new Date(); return (10 - (t.getMinutes() % 10)) * 60000 - t.getSeconds() * 1000 - t.getMilliseconds(); }
function fmtCountdown(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
function currentRoundKey() { return roundKeyFor(new Date()); }
function nextRoundKey() { return roundKeyFor(new Date(Date.now() + nextRoundInMs(new Date()))); }

// --- RPM samples: every wheel fetch records one sample for the current round ---
function recordRpmSample(rpm) {
  if (!Number.isFinite(rpm)) return;
  const k = 'sqk29:samples:' + roundKeyFor(new Date());
  const arr = loadJSON(k, []);
  arr.push(Math.round(rpm));
  saveJSON(k, arr.slice(-120)); // cap: 120 samples per round
}
function roundAvg(key) { const arr = loadJSON('sqk29:samples:' + key, []); if (!arr.length) return null; return arr.reduce((s, v) => s + v, 0) / arr.length; }

// --- v30 TOTAL: Round History (settled rounds, from recorded samples) ---
// A round is finalized once: when the round ends while the page is open
// (refreshLive), when its prediction settles, or at boot for rounds recorded
// before the page was closed. A round with no samples is never invented.
function loadRounds() { return loadJSON('sqk30:rounds', []); } // [{key, cls, avg, n}]
function finalizeRound(key) {
  const avg = roundAvg(key);
  if (avg === null) return false;
  const list = loadRounds();
  if (list.some(r => r.key === key)) return false;
  const arr = loadJSON('sqk29:samples:' + key, []);
  list.push({ key, cls: roundClass(avg), avg: +avg.toFixed(1), n: arr.length });
  saveJSON('sqk30:rounds', list.slice(-12));
  return true;
}
function renderRoundHist() {
  const el = $('roundHistList'); if (!el) return;
  const list = loadRounds().slice().reverse();
  if (!list.length) { el.innerHTML = `<p class="msg">${I18N[lang].roundHistEmpty}</p>`; return; }
  const diff = chainSnapshot && chainSnapshot.ok ? chainSnapshot.difficulty : 0;
  el.innerHTML = list.map(r => {
    const st = roundSettled(r.key);
    const work = estWork(r.avg);
    const blk = st === true ? estBlocks(work, diff) : null;
    const state = st === null ? msg('roundStateUnknown') : st ? msg('roundStateSettled') : msg('roundStateSettling');
    return `<div class="league-row">${msgf('roundHistRowTpl', { key: r.key, label: roundLabel(r.cls), avg: r.avg, n: r.n, work, blocks: blk === null ? '?' : '~' + blk, state })}</div>`;
  }).join('');
}

// --- v30 TOTAL: Daily Champions (best score of each day, this wallet) ---
function recordChampion(res) {
  const w = currentWallet();
  const key = 'sqk30:champs:' + walletKey(w);
  const list = loadJSON(key, []);
  const today = squeekTodayStr();
  const entry = list.find(c => c.date === today);
  if (!entry) list.push({ date: today, score: res.score, grade: res.grade, mode: res.mode });
  else if (res.score > entry.score) { entry.score = res.score; entry.grade = res.grade; entry.mode = res.mode; }
  saveJSON(key, list.slice(-7));
}
function renderChamps() {
  const el = $('champList'); if (!el) return;
  const list = loadJSON('sqk30:champs:' + walletKey(currentWallet()), []).slice().reverse();
  if (!list.length) { el.innerHTML = `<p class="msg">${I18N[lang].champsEmpty}</p>`; return; }
  el.innerHTML = list.map(c => `<div class="league-row">${c.date} — ${c.score} PTS • ${c.grade} • ${c.mode.toUpperCase()}</div>`).join('');
}

// --- Wheel Call predictions (next 10-min round; settled from recorded samples) ---
function predKey(w) { return 'sqk29:pred:' + walletKey(w); }
function loadPreds(w) { return loadJSON(predKey(w), {}); } // {roundKey: {pick, resolved, correct, avg, actual, noData}}
function placePrediction(pick) {
  const w = currentWallet();
  const rk = nextRoundKey();
  const preds = loadPreds(w);
  preds[rk] = { pick, resolved: false };
  saveJSON(predKey(w), preds);
  renderPredict();
  say(msgf('wheelCallSet', { label: roundLabel(pick), round: rk }), 'yellow');
}
function settlePredictions() {
  const w = currentWallet();
  const preds = loadPreds(w);
  const now = currentRoundKey();
  let changed = false;
  for (const rk of Object.keys(preds)) {
    const p = preds[rk];
    if (p.resolved || rk >= now) continue; // zero-padded keys sort lexicographically
    const avg = roundAvg(rk);
    if (avg === null) { p.resolved = true; p.correct = false; p.noData = true; changed = true; continue; }
    finalizeRound(rk); // v30: the round is settled — it now also joins the round history
    const actual = roundClass(avg);
    p.resolved = true; p.correct = p.pick === actual; p.avg = +avg.toFixed(1); p.actual = actual; changed = true;
    if (p.correct) { saveJSON('sqk24:xp:' + walletKey(w), totalXP(w) + 40); checkAchievements({}); }
  }
  if (changed) { saveJSON(predKey(w), preds); renderPredict(); renderAvatarPreview(w); }
}
function renderPredict() {
  const rl = $('roundLine'); if (!rl) return;
  const now = new Date();
  const cur = currentRoundKey();
  const avg = roundAvg(cur);
  const curClass = avg !== null ? roundClass(avg) : (liveSnapshot && liveSnapshot.ok ? roundClass(liveSnapshot.rpm) : null);
  rl.textContent = msgf('roundTpl', { cur, cls: curClass ? roundLabel(curClass) : '—', avg: avg !== null ? msgf('roundAvgPart', { avg: avg.toFixed(0) }) : '', cd: fmtCountdown(nextRoundInMs(now)) });
  const w = currentWallet();
  const preds = loadPreds(w);
  const mine = preds[nextRoundKey()];
  ['predNapBtn', 'predJogBtn', 'predZoomiesBtn'].forEach((id, i) => { const b = $(id); if (b) b.classList.toggle('picked', !!(mine && mine.pick === ['nap', 'jog', 'zoomies'][i])); });
  const pr = $('predResult');
  if (pr) {
    const settled = Object.entries(preds).filter(([k, p]) => p.resolved).sort().slice(-1)[0];
    if (settled) { const [k, p] = settled; pr.classList.remove('hidden'); pr.textContent = p.noData ? msgf('predNoData', { round: k }) : msgf('predDone', { round: k, actual: roundLabel(p.actual), avg: p.avg, pick: roundLabel(p.pick), result: p.correct ? msg('predCorrect') : msg('predWrong') }); }
    else pr.classList.add('hidden');
  }
  renderRoundHist(); // v30: the history box refreshes with every prediction render
}

// --- Achievements (11, named) ---
// v38 LEGACY LV8: migration-only. Its check is ALWAYS false, so no new
// player can ever earn it by reaching 4000 XP — only maybeMigrateLegacy8()
// (below) can add it, once, to players who were already LV8 under the
// old curve. It pays no XP (added directly to storage, not via
// checkAchievements()).
const ACHIEVEMENTS = [
  { id: 'first', name: 'FIRST STEPS', desc: 'Finish 1 song', k: 'achFirst', check: c => c.games >= 1 },
  { id: 'perfect30', name: 'PERFECT 30', desc: '30+ PERFECT in one song', k: 'achPerfect', check: c => c.res && c.res.perfect >= 30 },
  { id: 'combo100', name: 'COMBO 100', desc: 'Max combo 100+', k: 'achCombo', check: c => c.res && c.res.maxCombo >= 100 },
  { id: 'zoomies', name: 'ZOOMIES RIDER', desc: 'Finish a live/race song with ZOOMIES', k: 'achZoomies', check: c => !!c.zoomiesEver },
  { id: 'racewin', name: 'RACE WINNER', desc: 'Win a race vs Squeektoshi', k: 'achRacewin', check: c => !!c.raceWin },
  { id: 'oracle', name: 'ORACLE', desc: 'A correct Wheel Call', k: 'achOracle', check: c => !!c.oracle },
  { id: 'streak7', name: 'WEEK STREAK', desc: '7-day daily streak', k: 'achStreak', check: c => (c.streak || 0) >= 7 },
  { id: 'gold', name: 'GOLDEN', desc: 'Reach LV8', k: 'achGold', check: c => (c.level || 0) >= 8 },
  { id: 'void', name: 'VOID WALKER', desc: 'Finish a VOID song', k: 'achVoid', check: c => c.genre === 'void' },
  { id: 'mirror', name: 'MIRROR MASTER', desc: 'Finish a Mirror song', k: 'achMirror', check: c => c.mirror === true },
  { id: 'legacy8', name: 'LEGACY LV8', desc: 'LV8 under the old XP curve (before v38)', k: 'achLegacy8', check: () => false },
];
// --- v38 LEGACY LV8 (one-time migration, no XP) ---
// Players who already reached LV8 under the old curve (totalXP >= 4000)
// get the LEGACY LV8 badge once. The guard is per wallet
// ('sqk38:migrated:<key>') so a wallet typed in later is still checked;
// the global 'sqk38:migrated' key records that the v38 migration has run
// at least once (the spec key). Runs inside preview(), i.e. on every boot
// and every wallet (re)entry. A wallet first seen below 4000 XP is marked
// and never gets the badge later — reaching 4000 under the new curve is
// only LV3 (LV4 starts at 4300), not old-LV8.
function maybeMigrateLegacy8(w) {
  const key = walletKey(w);
  if (loadJSON('sqk38:migrated:' + key, 0)) return false;
  saveJSON('sqk38:migrated:' + key, 1);
  saveJSON('sqk38:migrated', 1);
  if (totalXP(w) >= 4000) {
    const ak = 'sqk29:ach:' + key, have = loadJSON(ak, []);
    if (!have.includes('legacy8')) { have.push('legacy8'); saveJSON(ak, have); }
    return true;
  }
  return false;
}
function achCtx(extra) {
  const w = currentWallet();
  const hist = loadJSON('sqk24:hist:' + walletKey(w), []);
  const ctx = { games: hist.length, level: playerLevel(w), streak: loadJSON('sqk24:streak:' + walletKey(w), { count: 0 }).count, oracle: Object.values(loadPreds(w)).some(p => p.resolved && p.correct) };
  return Object.assign(ctx, extra || {});
}
function checkAchievements(extra) {
  const w = currentWallet();
  const ctx = achCtx(extra);
  const key = 'sqk29:ach:' + walletKey(w);
  const have = loadJSON(key, []);
  const added = [];
  for (const a of ACHIEVEMENTS) { if (!have.includes(a.id) && a.check(ctx)) { have.push(a.id); added.push(a); } }
  if (added.length) { saveJSON(key, have); saveJSON('sqk24:xp:' + walletKey(w), totalXP(w) + added.length * 25); say(msg('achUnlock') + added.map(a => a.name).join(' • ') + msg('achXp'), 'yellow'); } // v30: an unlocked achievement now pays +25 XP each
  renderAchievements();
  return added;
}
function renderAchievements() {
  const el = $('achList'); if (!el) return;
  const have = loadJSON('sqk29:ach:' + walletKey(currentWallet()), []);
  el.innerHTML = ACHIEVEMENTS.map(a => `<span class="ach-chip${have.includes(a.id) ? ' done' : ''}" title="${msg(a.k)}">${have.includes(a.id) ? '🏆 ' : '🔒 '}${a.name}</span>`).join('');
}

// --- Duel League (local rivals; the score travels inside the duel link) ---
let pendingRival = null; // set from ?from=&score= when a duel link is opened
// v29.2 SECURITY: a duel link is a URL anyone can craft — the rival name in
// ?from= is only accepted in the exact shape the game itself writes
// (0xXXXX...XXXX or GUEST). Anything else becomes GUEST, so a crafted link
// cannot smuggle markup into the league table. renderLeague escapes the name
// as a second layer, so even an old stored entry cannot execute markup.
function validRivalName(s) { return /^0x[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4}$/.test(s) || s === 'GUEST' ? s : 'GUEST'; }
function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function recordLeagueResult(rival, myScore) {
  const w = currentWallet();
  const key = 'sqk29:league:' + walletKey(w);
  const list = loadJSON(key, []);
  list.push({ rival: rival.from, rivalScore: rival.score, myScore, win: myScore > rival.score, date: todayStr() });
  saveJSON(key, list.slice(-20));
  renderLeague();
}
function renderLeague() {
  const el = $('leagueList'); if (!el) return;
  const list = loadJSON('sqk29:league:' + walletKey(currentWallet()), []);
  if (!list.length) { el.innerHTML = `<p class="msg">${I18N[lang].leagueEmpty}</p>`; return; }
  const sorted = list.slice().sort((a, b) => b.myScore - a.myScore).slice(0, 8);
  el.innerHTML = sorted.map(r => `<div class="league-row${r.win ? ' win' : ' lose'}">${msgf('leagueRowTpl', { mine: r.myScore, rival: escHtml(r.rival), theirs: r.rivalScore, result: r.win ? msg('leagueWin') : msg('leagueLose'), date: r.date })}</div>`).join('');
}

// --- v37: Global leaderboard (Cloudflare Workers + D1, public scoreboard) ---
// The board is real server data, never fabricated: fetchLb shows the live top
// 10, and when the backend is unreachable the box says OFFLINE instead of
// inventing scores. Scores are public; wallets display truncated.
const LB_MODES = ['free', 'daily', 'live', 'race', 'boss', 'challenge'];
const lbState = { mode: 'free', rows: [], loading: false };
// --- v42.5 (P2-5): analitik ringan — hitungan anonim saja (kunjungan, mode
// dimainkan, titik berhenti). TANPA data pribadi, TANPA wallet, TANPA IP
// yang disimpan. Worker menyimpan analytics_daily(day_key, event, n).
const ANALYTICS_EVENTS = ['visit', 'play', 'mode_free', 'mode_daily', 'mode_live', 'mode_race', 'mode_boss', 'mode_lullaby', 'shop_open', 'submit'];
function analyticsEvent(event) {
  if (ANALYTICS_EVENTS.indexOf(event) < 0) return;
  try {
    if (event === 'visit' && sessionStorage.getItem('sqk42:visitLogged')) return;
    if (event === 'visit') sessionStorage.setItem('sqk42:visitLogged', '1');
  } catch (_) {}
  try { tfetch(CONFIG.LB_URL + '/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }) }, 5000).catch(() => {}); } catch (_) {}
}
let lastResult = null;
function truncAddr(w) { return (typeof w === 'string' && w.length === 42 && w.slice(0, 2) === '0x') ? '0x' + w.slice(2, 6) + '...' + w.slice(-4) : 'GUEST'; }
function lbCleanName(n) { const s = String(n || '').replace(/[\u0000-\u001f<>&"']/g, '').trim(); return s.slice(0, 16) || 'GUEST'; }
function lbMode(m) { return LB_MODES.indexOf(m) >= 0 ? m : 'free'; }
function lbName() { const el = $('lbName'); const v = el ? el.value : ''; return lbCleanName(v || loadJSON('sqk37:lbname', '')); }
function renderLbModes() {
  const el = $('lbModes'); if (!el) return;
  el.innerHTML = LB_MODES.map(m => `<button class="btn-diff lb-mode${lbState.mode === m ? ' active' : ''}" type="button" data-mode="${m}">${m.toUpperCase()}</button>`).join('');
  el.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { lbState.mode = b.dataset.mode; renderLbModes(); fetchLb(lbState.mode); }));
}
function renderLb() {
  const el = $('lbList'); if (!el) return;
  if (!lbState.rows.length) { el.innerHTML = `<p class="msg">${msg('lbEmpty')}</p>`; return; }
  const me = (currentWallet() || '').toLowerCase();
  el.innerHTML = lbState.rows.map(r => `<div class="league-row lb-row${r.wallet && r.wallet.toLowerCase() === me ? ' lb-me' : ''}"><span class="lb-rank">#${r.rank}</span> <b>${escHtml(r.name || 'GUEST')}</b> <span class="lb-wallet">${escHtml(truncAddr(r.wallet))}</span> <b class="lb-score">${r.score}</b> <span>${(+r.acc || 0).toFixed(1)}%</span>${r.verified ? ` <span class="lb-verified" title="${escHtml(msg('lbVerified'))}">✓</span>` : ''}</div>`).join(''); // v40.1: verified=1 rows carry a ✓ (field already returned by GET /scores); verified=0 rows unchanged
}
async function fetchLb(mode) {
  const el = $('lbList'); if (!el) return;
  lbState.mode = lbMode(mode);
  lbState.loading = true;
  el.innerHTML = `<p class="msg">${msg('lbLoading')}</p>`;
  try {
    const r = await tfetch(CONFIG.LB_URL + '/scores?mode=' + lbState.mode + '&limit=10', null, 20000); // v42.5.2 (FIX 2): 20 detik — board di koneksi ~3 K/s
    if (!r.ok) throw new Error('HTTP_' + r.status);
    const d = await r.json();
    if (!d || !Array.isArray(d.scores)) throw new Error('bad board');
    lbState.rows = d.scores; lbState.loading = false;
    renderLb(); fetchLbRank();
  } catch (_) {
    lbState.rows = []; lbState.loading = false;
    el.innerHTML = `<p class="msg">${msg('lbOffline')}</p>`;
    const rk = $('lbRank'); if (rk) rk.textContent = '';
  }
}
async function fetchLbRank() {
  const rk = $('lbRank'); if (!rk) return;
  const w = currentWallet();
  if (!isAddr(w)) { rk.textContent = ''; return; }
  try {
    const r = await tfetch(CONFIG.LB_URL + '/rank?wallet=' + w + '&mode=' + lbState.mode, null, 20000); // v42.5.2 (FIX 2): 20 detik — koneksi lambat
    if (!r.ok) throw new Error('HTTP_' + r.status);
    const d = await r.json();
    rk.textContent = (d && d.rank) ? msgf('lbYourRank', { rank: d.rank, total: d.total }) : '';
  } catch (_) { rk.textContent = ''; }
}
// --- v40.1: verified badge — Worker v4 verifies replays ASYNC (Cron per
// menit), so POST /scores returns 202 pending with NO signature yet. Poll
// GET /verify?replayHash=... until the replay is verified/rejected.
// GET /rank has no verified field, so it cannot drive this poll — /verify is
// the purpose-built endpoint (202 pending / 200 verified + signature /
// 422 rejected / 404 not found).
const VERIFY_POLL_INTERVAL_MS = 10000, VERIFY_POLL_MAX_TRIES = 12; // v42.5 (P2-3): ~120s max — verifikasi async Cron per menit bisa melebihi 90 detik
// v42.5 (P2-3): status verifikasi terakhir, dicek ulang saat tab LEAGUE dibuka.
let lastVerifyHash = null, lastVerifyStatus = null;
async function recheckVerifyOnLeague() {
  if (!lastVerifyHash || lastVerifyStatus === 'verified') return;
  try {
    const r = await tfetch(CONFIG.LB_URL + '/verify?replayHash=' + encodeURIComponent(lastVerifyHash), null, 20000); // v42.5.2 (FIX 2): 20 detik — koneksi lambat
    const d = await r.json().catch(() => null);
    const status = verifyPollOutcome(r.status, d);
    if (status === 'verified' || status === 'rejected') {
      lastVerifyStatus = status;
      const m = $('lbSubmitMsg');
      if (m) {
        if (status === 'verified') { m.textContent = msg('lbVerified'); fetchLb(lbState.mode); fetchShop(); fetchLeagueWeekly(); }
        else m.textContent = verifyRejectedText(d);
        m.classList.remove('hidden');
      }
    }
  } catch (_) {}
}
function verifyPollOutcome(httpStatus, body) {
  if (httpStatus === 202) return 'pending';
  if (httpStatus === 200 && body && body.verification_status === 'verified') return 'verified';
  if (httpStatus === 422) return 'rejected';
  return 'unknown';
}
function verifyBadgeText(status, h8, s8, T) {
  if (status === 'verified') return T.verified + (h8 ? ' • ' + h8 : '') + (s8 ? ' • 0x' + s8 : '');
  if (status === 'rejected') return T.rejected;
  if (status === 'pending') return T.verifying;
  return T.unknown;
}
let verifyPollTimer = null;
function stopVerifyPoll() { if (verifyPollTimer) { clearTimeout(verifyPollTimer); verifyPollTimer = null; } }
function verifyRejectedText(data) { // v42.4: penolakan menampilkan alasan server + apa yang harus dilakukan — user tidak boleh dibiarkan menebak kenapa skornya hilang
  const reason = data && data.reason ? String(data.reason) : '';
  return reason ? msgf('lbVerifyRejectedReason', { reason }) : msg('lbVerifyRejected');
}
async function pollVerify(replayHash, onStatus) {
  // onStatus is called exactly twice: 'pending' at start, then ONE terminal
  // status ('verified' | 'rejected' | 'unknown'). Intermediate ticks are
  // silent — a transient network blip must not flip the message to unknown
  // while tries remain.
  lastVerifyHash = replayHash; lastVerifyStatus = 'pending'; // v42.5 (P2-3)
  stopVerifyPoll();
  let tries = 0;
  const tick = async () => {
    tries++;
    let status = 'unknown', data = null;
    try {
      const r = await tfetch(CONFIG.LB_URL + '/verify?replayHash=' + encodeURIComponent(replayHash), null, 20000); // v42.5.2 (FIX 2): 20 detik — koneksi lambat
      const d = await r.json().catch(() => null);
      status = verifyPollOutcome(r.status, d); data = d;
    } catch (_) { status = 'unknown'; }
    if (status === 'verified' || status === 'rejected') { lastVerifyStatus = status; onStatus(status, data); return; }
    if (tries >= VERIFY_POLL_MAX_TRIES) { lastVerifyStatus = 'unknown'; onStatus('unknown', null); return; }
    verifyPollTimer = setTimeout(tick, VERIFY_POLL_INTERVAL_MS);
  };
  onStatus('pending', null);
  verifyPollTimer = setTimeout(tick, 0);
}
function resetLbSubmit() {
  stopVerifyPoll();
  const b = $('lbSubmitBtn');
  if (b) {
    // v42.5.1 (BUG 2): Lullaby/Practice tidak pernah disubmit — sembunyikan
    // tombolnya di panel hasil (lapisan pertama; submitLb sendiri sudah
    // berjaga dengan return awal untuk keduanya).
    b.classList.toggle('hidden', !!(lastResult && (lastResult.lullaby || lastResult.practice)));
    b.disabled = false;
  }
  const m = $('lbSubmitMsg'); if (m) { m.textContent = ''; m.classList.add('hidden'); }
}
async function submitLb() {
  const m = $('lbSubmitMsg');
  const show = t => { if (m) { m.textContent = t; m.classList.remove('hidden'); } };
  if (!lastResult || !lastResult.score) return show(msg('lbNoScore'));
  if (lastResult.lullaby) return show(msg('lbLullaby')); // v42.5: Lullaby = mode malam, tidak disubmit
  if (lastResult.practice) return show(msg('lbPractice'));
  const w = currentWallet();
  if (!isAddr(w)) return show(msg('lbNeedWallet'));
  const b = $('lbSubmitBtn'); if (b) b.disabled = true;
  stopVerifyPoll(); // v40.1: a fresh submit replaces any older verification poll
  // v42.5 (P3-1): TIDAK ada lagi retry fail-soft tanpa replay — Worker
  // menolak tanpa-replay dengan 422, retry itu tidak pernah berhasil dan
  // hanya membakar 1 baris rate-limit. 400 = replay tidak valid, tunjukkan
  // apa adanya. 429 (rate limit) TIDAK pernah di-retry.
  const bodyBase = { wallet: w, name: lbName(), score: lastResult.score, acc: lastResult.acc, mode: lbMode(lastResult.mode), sessionId: lastResult.sessionId || undefined, notes: lastResult.notes, taps: lastResult.taps, durationMs: lastResult.durationMs };
  const postScores = body => tfetch(CONFIG.LB_URL + '/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 30000); // v42.5.2 (FIX 2): 30 detik — upload replay (puluhan KB) di koneksi ~3 K/s butuh >8 detik
  try {
    const body = lastResult.replay ? { ...bodyBase, replay: lastResult.replay, replayHash: lastResult.replayHash || undefined, gameVersion: 'v42.5.4' } : bodyBase;
    let r;
    try { r = await postScores(body); }
    catch (e1) {
      // v42.5.2 (FIX 2): SATU retry otomatis bila request jelas gagal/timeout
      // SEBELUM respons diterima — replay yang sama, server dedupe via
      // replay_hash (percobaan pertama yang ternyata sampai tidak akan
      // tercatat dua kali). Respons yang SUDAH diterima (422/429/400) TIDAK
      // pernah di-retry.
      show(msg('lbRetrying'));
      r = await postScores(body); // gagal lagi -> catch luar (lbSlow/lbOffline)
    }
    if (r.status === 429) { // v42.5 (P0-1): pesan spesifik + jam retry, bukan "offline" generik
      const d429 = await r.json().catch(() => null);
      const t = d429 && d429.retryAfterSec ? new Date(Date.now() + d429.retryAfterSec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      show(t ? msgf('lbRateLimited', { time: t }) : msg('lbRateLimitedNoTime'));
      if (b) b.disabled = false;
      return;
    }
    if (!r.ok) throw new Error('HTTP_' + r.status);
    const d = await r.json();
    if (!d || !d.ok) throw new Error('submit failed');
    analyticsEvent('submit'); // v42.5 (P2-5)
    const T = { verified: msg('lbVerified'), verifying: msg('lbVerifying'), rejected: msg('lbVerifyRejected'), unknown: msg('lbVerifyUnknown') };
    let txt = d.improved ? msg('lbSent') : msg('lbKept');
    // v39: respons berisi signature = server sudah menandatangani replay ini
    // (dedupe: replay yang sama sudah terverifikasi sebelumnya).
    if (d.signature) {
      lastVerifyHash = String(d.replayHash || lastResult.replayHash); lastVerifyStatus = 'verified'; // v42.5 (P2-3)
      const h8 = String(d.replayHash || lastResult.replayHash || '').replace(/^0x/, '').slice(0, 8);
      const s8 = String(d.signature).replace(/^0x/, '').slice(0, 8);
      txt += ' • ' + verifyBadgeText('verified', h8, s8, T);
      show(txt);
      fetchShop(); fetchLeagueWeekly(); // v41: dedupe-verified replay — cheese was already credited; refresh the balance + weekly board
    } else if (d.pending && (d.replayHash || lastResult.replayHash)) {
      // v40.1: Worker v4 memverifikasi async (Cron per menit) — POST hanya
      // mengembalikan 202 pending tanpa signature. Poll GET /verify sampai
      // terverifikasi/ditolak (maks ~90 detik), lalu tampilkan statusnya.
      // Poll gagal/offline = netral (tidak error, tidak klaim verified).
      const hash = String(d.replayHash || lastResult.replayHash);
      const showStatus = (status, data) => {
        if (status === 'rejected') { show(verifyRejectedText(data)); return; }
        const h8 = String((data && data.replayHash) || hash).replace(/^0x/, '').slice(0, 8);
        const s8 = String((data && data.signature) || '').replace(/^0x/, '').slice(0, 8);
        show(txt + ' • ' + verifyBadgeText(status, h8, s8, T));
        if (status === 'verified') { fetchLb(lbState.mode); fetchShop(); fetchLeagueWeekly(); } // v41: cheese is credited server-side on verification — refresh the balance + weekly board
      };
      pollVerify(hash, showStatus);
    } else {
      show(txt);
    }
    saveJSON('sqk37:lbname', lbName());
    lbState.mode = lbMode(lastResult.mode); renderLbModes(); fetchLb(lbState.mode);
  } catch (e) { // v42.5.2 (FIX 2): bedakan timeout/koneksi lambat dari offline
    show(isTimeoutError(e) ? msg('lbSlow') : msg('lbOffline'));
    if (b) b.disabled = false;
  }
}

// --- v41: TOKO KEJU + LIGA MINGGUAN (off-chain; Worker v5) ---
// Cheese is earned ONLY on verified songs (server-side, see worker.js):
// 100/song + 500 grade S/SS + 50 daily mission (first verified song of
// the Squeek day). The client never computes its own balance — it reads
// GET /cheese and renders what the server returns. Cosmetics only:
// note skins recolor the hamster notes, frames restyle the result panel.
const NOTE_SKINS = {
  'note-mint': ['#7dffc8', '#5ce1e6', '#a8ffce', '#7dffc8'],
  'note-gold': ['#ffd700', '#ffb020', '#fff0a8', '#ff8800'],
  'note-void': ['#a050ff', '#ff5ce1', '#7a50ff', '#ff8800'],
  'note-rainbow': ['#ff5ce1', '#ffd700', '#00e5ff', '#7dffc8'],
  // v42.4 (BUG 3): palet SQK — hue sengaja BERBEDA dari keempat skin Keju
  // di atas (mint 150°, gold 45°, void 270°, rainbow multi) supaya skin
  // yang dibeli langsung terlihat beda di game.
  'note-sqk-rare': ['#3b82f6', '#60a5fa', '#1d4ed8', '#93c5fd'], // sapphire blue
  'note-sqk-epic': ['#f43f5e', '#fb7185', '#be123c', '#fda4af'], // rose crimson
  'note-sqk-lime': ['#a3e635', '#bef264', '#4d7c0f', '#d9f99d'], // chartreuse lime
  'note-sqk-platinum': ['#f8fafc', '#cbd5e1', '#64748b', '#ffffff'], // platinum white
  'note-sqk-inferno': ['#ff6b00', '#ffa200', '#ff3d00', '#ffe08a'], // inferno orange
};
const FRAME_SKINS = ['frame-neon', 'frame-gold', 'frame-royal', 'frame-rainbow', 'frame-sqk']; // v42.4: + frame-sqk (Bingkai Animasi, item 3)
// v42.5.1 (BUG 1): dua sumber skin hidup BERDAMPINGAN — Keju (disinkron
// server via fetchShop, kunci sqk41:skin-keju) dan SQK (lokal via
// equipSqkItem, kunci sqk41:skin-sqk). Yang TERAKHIR di-equip per slot yang
// menang (penanda sqk41:skin-last); bila sumber pemenang kosong, jatuh ke
// sumber satunya. fetchShop HANYA menulis kunci Keju — skin SQK tidak
// pernah lagi tertimpa. Migrasi sekali: kunci lama sqk41:skin (v42.4)
// disalin ke kedua kunci baru, lalu dihapus.
function shopSkin() {
  let keju = loadJSON('sqk41:skin-keju', null);
  let sqk = loadJSON('sqk41:skin-sqk', null);
  if (!keju && !sqk) {
    const legacy = loadJSON('sqk41:skin', null);
    if (legacy && typeof legacy === 'object') {
      keju = { note: legacy.note || null, frame: legacy.frame || null };
      sqk = { note: legacy.note || null, frame: legacy.frame || null };
      saveJSON('sqk41:skin-keju', keju); saveJSON('sqk41:skin-sqk', sqk);
      try { if (typeof localStorage !== 'undefined') localStorage.removeItem('sqk41:skin'); } catch (_) {}
    }
  }
  keju = (keju && typeof keju === 'object') ? keju : { note: null, frame: null };
  sqk = (sqk && typeof sqk === 'object') ? sqk : { note: null, frame: null };
  const last = loadJSON('sqk41:skin-last', null) || {};
  const pick = slot => {
    if (last[slot] === 'sqk') return sqk[slot] || keju[slot] || null;
    if (last[slot] === 'keju') return keju[slot] || sqk[slot] || null;
    return keju[slot] || sqk[slot] || null;
  };
  return { note: pick('note'), frame: pick('frame') };
}
function saveKejuSkin(s) { saveJSON('sqk41:skin-keju', s); }
function saveSqkSkin(s) { saveJSON('sqk41:skin-sqk', s); }
function saveSkinLast(slot, src) { const last = loadJSON('sqk41:skin-last', {}) || {}; last[slot] = src; saveJSON('sqk41:skin-last', last); }
function noteColor(lane, themeNotes, skinId) {
  if (skinId && NOTE_SKINS[skinId]) return NOTE_SKINS[skinId][lane % NOTE_SKINS[skinId].length];
  return themeNotes[lane];
}
function applyResultFrame() {
  const p = $('resultPanel'); if (!p) return;
  FRAME_SKINS.forEach(f => p.classList.remove(f));
  const frame = shopSkin().frame;
  if (frame && FRAME_SKINS.indexOf(frame) >= 0) p.classList.add(frame);
}
// --- v42.5 (P1-5): preview produk di toko — gambar produknya sendiri dari
// palet yang sudah ada (tanpa aset baru). Skin not: deretan not hamster
// dengan warna skin itu; frame: mini panel berbingkai gaya frame itu;
// kapsul: chip warna rarity.
function skinPreviewHtml(skinId, slot) {
  if (slot === 'frame') {
    const label = String(skinId || 'frame').replace(/^frame-/, '').toUpperCase();
    return `<span class="shop-preview"><span class="pv-frame ${escHtml(skinId || '')}">◆ ${escHtml(label)} ◆</span></span>`;
  }
  const pal = NOTE_SKINS[skinId];
  if (!pal) return '';
  return `<span class="shop-preview">${pal.map(c => `<i class="pv-dot" style="background:${escHtml(c)}"></i>`).join('')}</span>`;
}
function capsulePreviewHtml() {
  return `<span class="shop-preview">${['common', 'rare', 'epic', 'legendary'].map(r => `<span class="pv-cap ${r}">● ${r.toUpperCase()}</span>`).join('')}</span>`;
}
let shopState = { balance: 0, items: [], catalog: [] };
function shopOwned(id) { return shopState.items.some(i => i.id === id); }
function shopEquipped(id) { const it = shopState.items.find(i => i.id === id); return !!(it && it.equipped); }
function shopMsg(t) { const m = $('shopMsg'); if (m) { m.textContent = t; m.classList.remove('hidden'); } }
function renderShop() {
  const bal = $('cheeseBalance'); if (bal) bal.textContent = msgf('shopBalanceTpl', { n: shopState.balance });
  const cat = $('shopCatalog'); if (!cat) return;
  const w = currentWallet();
  if (!shopState.catalog.length) { cat.innerHTML = `<p class="msg">${msg('shopOffline')}</p>`; return; }
  cat.innerHTML = shopState.catalog.map(c => {
    const owned = shopOwned(c.id), eq = shopEquipped(c.id);
    const btn = !isAddr(w) ? '' : eq ? `<span class="msg">${I18N[lang].equippedLbl}</span> <button class="btn-secondary" type="button" data-unequip="${c.slot}">${I18N[lang].unequipBtn}</button>` // v42.5.2 (FIX 1): UNEQUIP — skin yang dipakai bisa dicopot, kembali ke default
      : owned ? `<button class="btn-secondary" type="button" data-equip="${c.id}">${I18N[lang].equipBtn}</button>`
      : c.capsuleOnly ? `<span class="msg">${I18N[lang].capsuleOnlyLbl}</span>`
      : `<button class="btn-secondary" type="button" data-buy="${c.id}">${msgf('shopBuyTpl', { price: c.price })}</button>`;
    return `<div class="shop-item"><b>${escHtml(c.name)}</b>${skinPreviewHtml(c.id, c.slot)}<span class="shop-meta">${escHtml(c.slot.toUpperCase())} • ${escHtml(c.rarity.toUpperCase())}${owned ? ' • ' + I18N[lang].ownedLbl : ''}</span>${btn}</div>`;
  }).join('');
  cat.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => buyItem(b.dataset.buy)));
  cat.querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => equipItem(b.dataset.equip)));
  cat.querySelectorAll('[data-unequip]').forEach(b => b.addEventListener('click', () => unequipItem(b.dataset.unequip))); // v42.5.2 (FIX 1)
  const cp = $('capsulePreview'); if (cp) cp.innerHTML = capsulePreviewHtml(); // v42.5 (P1-5)
}
async function fetchShop() {
  const w = currentWallet();
  try {
    const r = await tfetch(CONFIG.LB_URL + '/cheese' + (isAddr(w) ? '?wallet=' + w : ''), null, 8000);
    if (!r.ok) throw new Error('HTTP_' + r.status);
    const d = await r.json();
    if (!d || !Array.isArray(d.catalog)) throw new Error('bad shop');
    shopState = { balance: d.balance || 0, items: Array.isArray(d.items) ? d.items : [], catalog: d.catalog };
    // Sync the equipped Keju cosmetics into local state (single source:
    // server) — HANYA kunci Keju yang ditulis; kunci SQK + penanda
    // terakhir-di-equip TIDAK disentuh (v42.5.1 BUG 1).
    const note = shopState.items.find(i => i.slot === 'note' && i.equipped);
    const frame = shopState.items.find(i => i.slot === 'frame' && i.equipped);
    saveKejuSkin({ note: note ? note.id : null, frame: frame ? frame.id : null });
    renderShop();
  } catch (_) {
    renderShop();
  }
}
async function buyItem(id) {
  const w = currentWallet();
  if (!isAddr(w)) return shopMsg(msg('shopNeedWallet'));
  try {
    const r = await tfetch(CONFIG.LB_URL + '/cheese/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: w, item_id: id }) }, 8000);
    const d = await r.json().catch(() => null);
    if (!r.ok) {
      if (r.status === 402) return shopMsg(msg('shopNoCheese'));
      if (d && d.error === 'already owned') return shopMsg(msg('shopOwned'));
      if (d && d.error === 'capsule only') return shopMsg(msg('shopCapsuleOnly'));
      throw new Error('HTTP_' + r.status);
    }
    const item = shopState.catalog.find(c => c.id === id);
    shopMsg(msgf('shopBought', { item: item ? item.name : id }));
    await fetchShop();
  } catch (_) { shopMsg(msg('shopOffline')); }
}
async function pullCapsule() {
  const w = currentWallet();
  if (!isAddr(w)) return shopMsg(msg('shopNeedWallet'));
  const b = $('capsuleBtn'); if (b) b.disabled = true;
  try {
    const r = await tfetch(CONFIG.LB_URL + '/cheese/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: w }) }, 8000);
    const d = await r.json().catch(() => null);
    if (!r.ok) {
      if (r.status === 402) return shopMsg(msg('shopNoCheese'));
      throw new Error('HTTP_' + r.status);
    }
    if (d.duplicate) shopMsg(msgf('shopDup', { item: d.item.name, n: d.compensation }));
    else shopMsg(msgf('shopPulled', { item: d.item.name, rarity: d.item.rarity }));
    await fetchShop();
  } catch (_) { shopMsg(msg('shopOffline')); }
  finally { if (b) b.disabled = false; }
}
async function equipItem(id) {
  const w = currentWallet();
  if (!isAddr(w)) return shopMsg(msg('shopNeedWallet'));
  try {
    const r = await tfetch(CONFIG.LB_URL + '/cheese/equip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: w, item_id: id }) }, 8000);
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error('HTTP_' + r.status);
    const item = shopState.catalog.find(c => c.id === id);
    const keju = loadJSON('sqk41:skin-keju', { note: null, frame: null }) || { note: null, frame: null };
    if (d.slot === 'note') keju.note = id; else if (d.slot === 'frame') keju.frame = id;
    saveKejuSkin(keju); saveSkinLast(d.slot, 'keju'); // v42.5.1 (BUG 1): Keju ke kuncinya sendiri + penanda terakhir-di-equip
    applyResultFrame();
    shopMsg(msgf('shopEquipped', { item: item ? item.name : id }));
    await fetchShop();
  } catch (_) { shopMsg(msg('shopOffline')); }
}
async function unequipItem(slot) { // v42.5.2 (FIX 1): copot skin Keju — status equipped Keju hidup di SERVER (Worker /cheese/equip), jadi unequip lokal saja TIDAK cukup (fetchShop akan mengembalikannya). POST /cheese/unequip (Worker v12) membersihkan flag equipped di D1; lokal: slot Keju dikosongkan + penanda terakhir-di-equip pindah ke 'sqk' supaya skin SQK (bila ada) tampil kembali. Kepemilikan TIDAK disentuh: item tetap OWNED, hanya tidak dipakai.
  const w = currentWallet();
  if (!isAddr(w)) return shopMsg(msg('shopNeedWallet'));
  if (slot !== 'note' && slot !== 'frame') return shopMsg(msg('shopOffline'));
  try {
    const r = await tfetch(CONFIG.LB_URL + '/cheese/unequip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: w, slot }) }, 8000);
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error('HTTP_' + r.status);
    const item = shopState.items.find(i => i.slot === slot && i.equipped);
    const keju = loadJSON('sqk41:skin-keju', { note: null, frame: null }) || { note: null, frame: null };
    keju[slot] = null;
    saveKejuSkin(keju); saveSkinLast(slot, 'sqk');
    applyResultFrame();
    shopMsg(msgf('shopUnequipped', { item: item ? item.name : slot }));
    await fetchShop(); // re-sync dari server: server kini melaporkan tidak ada yang terpasang di slot ini
  } catch (_) { shopMsg(msg('shopOffline')); }
}
// --- v42.1: SQK shop (Batch 5) — permit buys + golden capsule ---
// The client NEVER touches a private key: every signature goes through
// the browser wallet provider (eth_signTypedData_v4) and every
// transaction through eth_sendTransaction (the user confirms in
// MetaMask). All reads are eth_call (no wallet needed). While
// CONFIG.SHOP_ADDRESS is the deployed shop: the section renders live
// and every action works — the coming-soon banner hides when deployed
// (renderSqkShop toggles it) and only shows for the zero address.
let sqkState = { pool: null, seasonEnd: null, sweepAt: null, swept: false, sqkBalance: null, owned: {}, pity: null };
function sqkShopMsg(t) { const m = $('sqkShopMsg'); if (m) { m.textContent = t; m.classList.remove('hidden'); } }
function sqkPendingCapsule() { const p = loadJSON('sqk42:capsule', null); return (p && typeof p === 'object' && p.pullId) ? p : null; }
function sqkSavePendingCapsule(p) { saveJSON('sqk42:capsule', p); }
function sqkClearPendingCapsule() { try { localStorage.removeItem('sqk42:capsule'); } catch (_) {} }
// ABI encoding without ethers (selectors are precomputed constants above).
function sqkWordUint(n) { return BigInt(n).toString(16).padStart(64, '0'); }
function sqkWordAddr(a) { return '0'.repeat(24) + String(a).slice(2).toLowerCase(); }
function sqkWordBytes32(h) { return String(h).slice(2).toLowerCase().padStart(64, '0'); }
function sqkSplitSig(sig) {
  const s = String(sig || '').slice(2);
  if (s.length !== 130) return null;
  return { r: '0x' + s.slice(0, 64), s: '0x' + s.slice(64, 128), v: parseInt(s.slice(128, 130), 16) };
}
function sqkEncodeBuy(itemId, deadline, v, r, s) {
  return SQK_SEL.buyWithPermit + sqkWordUint(itemId) + sqkWordUint(deadline) + sqkWordUint(v) + sqkWordBytes32(r) + sqkWordBytes32(s);
}
function sqkEncodeCommit(targetRound, deadline, v, r, s) {
  return SQK_SEL.commitCapsule + sqkWordUint(targetRound) + sqkWordUint(deadline) + sqkWordUint(v) + sqkWordBytes32(r) + sqkWordBytes32(s);
}
function sqkEncodeResolve(pullId, dataHash, deadline, sig) {
  const sigBytes = String(sig).slice(2);
  const head = sqkWordUint(pullId) + sqkWordBytes32(dataHash) + sqkWordUint(deadline) + sqkWordUint(128);
  const tail = sqkWordUint(sigBytes.length / 2) + sigBytes + '0'.repeat((64 - (sigBytes.length % 64)) % 64);
  return SQK_SEL.resolveCapsule + head + tail;
}
async function sqkEthCall(to, data) {
  return rpcBreaker.execute(async () => {
    const res = await tfetch(CONFIG.SEPOLIA_RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }) }, 8000);
    if (!res.ok) throw new Error('RPC_HTTP_' + res.status);
    const j = await res.json();
    if (!j.result || j.result === '0x') throw new Error('NO_RESULT');
    return j.result;
  });
}
function sqkUint(result) { try { return BigInt(result); } catch { return null; } }
function sqkDateStr(epochSec) { if (!epochSec) return '—'; try { return new Date(Number(epochSec) * 1000).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; } }
function sqkIsEquipped(c) { // v42.4 (BUG 3): item SQK sedang dipakai bila skin-nya yang tersimpan di shopSkin()
  if (!c || !c.skin || !c.slot) return false;
  const cur = shopSkin();
  return c.slot === 'note' ? cur.note === c.skin : cur.frame === c.skin;
}
async function equipSqkItem(itemId) { // v42.4 (BUG 3): item SQK dimiliki ON-CHAIN — equip memverifikasi kepemilikan via balanceOfItem eth_call (read-only, TANPA signature/transaksi), lalu menulis skin lokal. Tanpa ini, item yang dibeli tidak pernah bisa dipakai.
  const w = currentWallet();
  if (!isAddr(w)) return sqkShopMsg(msg('sqkNeedWallet'));
  const item = sqkShopItem(itemId);
  if (!item || !item.skin || !item.slot) return sqkShopMsg(msg('sqkEquipFail'));
  try {
    const n = await sqkEthCall(CONFIG.SHOP_ADDRESS, SQK_SEL.balanceOfItem + sqkWordAddr(w) + sqkWordUint(itemId)).then(sqkUint).catch(() => null);
    if (n === null && !(sqkState.owned && sqkState.owned[itemId] > 0)) return sqkShopMsg(msg('sqkShopOffline')); // v42.5.1 (BUG 1): eth_call gagal TAPI kepemilikan sudah diketahui dari pembacaan toko sendiri (sqkState.owned) -> tetap boleh equip
    if (n === 0n) return sqkShopMsg(msgf('sqkNotOwned', { item: item.name }));
    const sqk = loadJSON('sqk41:skin-sqk', { note: null, frame: null }) || { note: null, frame: null };
    if (item.slot === 'note') sqk.note = item.skin; else if (item.slot === 'frame') sqk.frame = item.skin;
    saveSqkSkin(sqk); saveSkinLast(item.slot, 'sqk'); // v42.5.1 (BUG 1): SQK ke kuncinya sendiri — fetchShop tidak bisa menghapusnya lagi
    applyResultFrame(); // bingkai langsung terlihat di panel hasil; skin not dipakai lagu berikutnya (G.noteSkin dibaca dari shopSkin() di play())
    sqkShopMsg(msgf('sqkEquipped', { item: item.name }));
    renderSqkShop();
  } catch (_) { sqkShopMsg(msg('sqkShopOffline')); }
}
function unequipSqkItem(itemId) { // v42.5.2 (FIX 1): copot skin SQK — lokal saja (kepemilikan on-chain TIDAK disentuh: item tetap OWNED, hanya tidak dipakai). Slot dikosongkan dari kunci SQK + penanda terakhir-di-equip pindah ke 'keju' supaya skin Keju (bila ada) tampil kembali.
  const item = sqkShopItem(itemId);
  if (!item || !item.skin || !item.slot) return sqkShopMsg(msg('sqkEquipFail'));
  const sqk = loadJSON('sqk41:skin-sqk', { note: null, frame: null }) || { note: null, frame: null };
  if (item.slot === 'note') sqk.note = null; else if (item.slot === 'frame') sqk.frame = null;
  saveSqkSkin(sqk); saveSkinLast(item.slot, 'keju');
  applyResultFrame();
  sqkShopMsg(msgf('sqkUnequipped', { item: item.name }));
  renderSqkShop();
}
function renderSqkShop() {
  const deployed = sqkShopDeployed();
  const soon = $('sqkShopSoon'); if (soon) soon.classList.toggle('hidden', deployed);
  const pool = $('sqkShopPool');
  if (pool) pool.textContent = sqkState.pool === null ? '' : msgf('sqkPoolTpl', { pool: fmt(sqkState.pool, 18) });
  const season = $('sqkShopSeason');
  if (season) {
    if (sqkState.swept) season.textContent = msg('sqkSwept');
    else if (sqkState.seasonEnd) season.textContent = msgf('sqkSeasonTpl', { date: sqkDateStr(sqkState.seasonEnd) }) + (sqkState.sweepAt ? ' ' + msgf('sqkSweepTpl', { date: sqkDateStr(sqkState.sweepAt) }) : '');
    else season.textContent = '';
  }
  const bal = $('sqkShopBalance');
  if (bal) bal.textContent = sqkState.sqkBalance === null ? '' : msgf('sqkBalanceTpl', { n: fmt(sqkState.sqkBalance, 18) });
  const cat = $('sqkShopCatalog'); if (!cat) return;
  const w = currentWallet();
  cat.innerHTML = SQK_SHOP_CATALOG.map(c => {
    const owned = sqkState.owned[c.id] || 0;
    const btn = !deployed ? `<button class="btn-secondary" type="button" disabled>${msgf('sqkBuyTpl', { price: c.priceSqk })}</button>`
      : !isAddr(w) ? ''
      : owned > 0 ? (sqkIsEquipped(c) ? `<span class="msg">${msg('sqkEquippedTpl')}</span> <button class="btn-secondary" type="button" data-sqk-unequip="${c.id}">${msg('sqkUnequipBtn')}</button>` : `<button class="btn-secondary" type="button" data-sqk-equip="${c.id}">${msg('sqkEquipBtn')}</button>`) // v42.5.2 (FIX 1): UNEQUIP
      : `<button class="btn-secondary" type="button" data-sqk-buy="${c.id}">${msgf('sqkBuyTpl', { price: c.priceSqk })}</button>`;
    return `<div class="shop-item"><b>${escHtml(c.name)}</b>${skinPreviewHtml(c.skin, c.slot)}<span class="shop-meta">SQK • ${c.priceSqk} SQK${owned > 0 ? ' • ' + msgf('sqkOwnedTpl', { n: owned }) : ''}${sqkIsEquipped(c) ? ' • ' + msg('sqkEquippedTpl') : ''}</span>${btn}</div>`;
  }).join('');
  cat.querySelectorAll('[data-sqk-buy]').forEach(b => b.addEventListener('click', () => buySqkItem(Number(b.dataset.sqkBuy))));
  cat.querySelectorAll('[data-sqk-equip]').forEach(b => b.addEventListener('click', () => equipSqkItem(Number(b.dataset.sqkEquip)))); // v42.4 (BUG 3)
  cat.querySelectorAll('[data-sqk-unequip]').forEach(b => b.addEventListener('click', () => unequipSqkItem(Number(b.dataset.sqkUnequip)))); // v42.5.2 (FIX 1)
  const scp = $('sqkCapsulePreview'); if (scp) scp.innerHTML = capsulePreviewHtml(); // v42.5 (P1-5)
  const pity = $('sqkCapsulePity');
  if (pity) pity.textContent = sqkState.pity === null ? '' : msgf('sqkPityTpl', { n: sqkState.pity });
  const commit = $('sqkCommitBtn'), resolve = $('sqkResolveBtn');
  const pending = sqkPendingCapsule();
  if (commit) commit.disabled = !deployed;
  if (resolve) { resolve.disabled = !deployed; resolve.textContent = pending ? msg('sqkResolveBtn') + ' (#' + pending.pullId + ')' : msg('sqkResolveBtn'); }
}
async function fetchSqkShop() {
  renderSqkShop();
  if (!sqkShopDeployed()) return; // placeholder: honest disabled state, no RPC calls
  const w = currentWallet();
  try {
    const [pool, season, sweep, swept] = await Promise.all([
      sqkEthCall(CONFIG.SHOP_ADDRESS, SQK_SEL.prizePool).then(sqkUint),
      sqkEthCall(CONFIG.SHOP_ADDRESS, SQK_SEL.seasonEnd).then(sqkUint),
      sqkEthCall(CONFIG.SHOP_ADDRESS, SQK_SEL.sweepAvailableAt).then(sqkUint),
      sqkEthCall(CONFIG.SHOP_ADDRESS, SQK_SEL.isSwept).then(r => sqkUint(r) !== 0n),
    ]);
    sqkState.pool = pool; sqkState.seasonEnd = season ? Number(season) : null;
    sqkState.sweepAt = sweep ? Number(sweep) : null; sqkState.swept = !!swept;
    if (isAddr(w)) {
      const [bal, pity] = await Promise.all([
        sqkEthCall(CONFIG.SQK_TOKEN, SQK_SEL.balanceOf + sqkWordAddr(w)).then(sqkUint),
        sqkEthCall(CONFIG.SHOP_ADDRESS, SQK_SEL.pityCounter + sqkWordAddr(w)).then(sqkUint),
      ]);
      sqkState.sqkBalance = bal; sqkState.pity = pity === null ? null : Number(pity);
      const owned = {};
      for (const c of SQK_SHOP_CATALOG) {
        const n = await sqkEthCall(CONFIG.SHOP_ADDRESS, SQK_SEL.balanceOfItem + sqkWordAddr(w) + sqkWordUint(c.id)).then(sqkUint).catch(() => null);
        owned[c.id] = n === null ? 0 : Number(n);
      }
      sqkState.owned = owned;
    }
    renderSqkShop();
  } catch (_) {
    sqkShopMsg(msg('sqkShopOffline'));
  }
}
// One exact-amount permit (EIP-2612) + the shop call. Returns the tx hash
// or null (message already shown). Never an unlimited approval.
async function sqkPermitAndSend(wallet, valueWei, encodeFn) {
  const eth = getEth(); // v42.2: WalletConnect provider when connected via WC, else window.ethereum
  if (!eth || typeof eth.request !== 'function') { sqkShopMsg(msg('sqkNoProvider')); return null; }
  if (!(await ensureSepoliaChain(eth))) { sqkShopMsg(msg('sqkWrongChain')); return null; } // v42.2: switch/add Sepolia instead of refusing
  const deadline = Math.floor(Date.now() / 1000) + 600;
  let nonce = 0n, tokenName = 'Squeek';
  try {
    const [nres, nameRes] = await Promise.all([
      sqkEthCall(CONFIG.SQK_TOKEN, SQK_SEL.nonces + sqkWordAddr(wallet)).catch(() => null),
      sqkEthCall(CONFIG.SQK_TOKEN, SQK_SEL.name).catch(() => null),
    ]);
    if (nres) nonce = sqkUint(nres) || 0n;
    if (nameRes) tokenName = decodeStr(nameRes);
  } catch (_) {}
  const typed = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' }, { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Permit',
    domain: sqkPermitDomain(tokenName),
    message: {
      owner: wallet, spender: CONFIG.SHOP_ADDRESS,
      value: valueWei.toString(), nonce: nonce.toString(), deadline: deadline.toString(),
    },
  };
  let sig;
  try {
    sig = await eth.request({ method: 'eth_signTypedData_v4', params: [wallet, JSON.stringify(typed)] });
  } catch (e) {
    if (e && e.code === 4001) sqkShopMsg(msg('sqkPermitRejected'));
    else sqkShopMsg(msg('sqkPermitRejected'));
    return null;
  }
  const parts = sqkSplitSig(sig);
  if (!parts) { sqkShopMsg(msg('sqkPermitRejected')); return null; }
  const data = encodeFn(deadline, parts.v, parts.r, parts.s);
  let txHash;
  try {
    txHash = await eth.request({ method: 'eth_sendTransaction', params: [{ from: wallet, to: CONFIG.SHOP_ADDRESS, data, value: '0x0' }] });
  } catch (e) {
    if (e && e.code === 4001) sqkShopMsg(msg('sqkTxRejected'));
    else sqkShopMsg(msg('sqkTxRejected'));
    return null;
  }
  return txHash || null;
}
async function sqkWaitReceipt(txHash, tries) {
  const eth = getEth(); // v42.2: receipt polling through the active provider (WC or injected)
  if (!eth || typeof eth.request !== 'function') return null;
  for (let i = 0; i < (tries || 12); i++) {
    try {
      const r = await eth.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
      if (r) return r;
    } catch (_) {}
    await new Promise(res => setTimeout(res, 5000));
  }
  return null;
}
function sqkParseLogWords(log, topic0) {
  if (!log || !Array.isArray(log.topics) || !log.topics.length) return null;
  if (String(log.topics[0]).toLowerCase() !== topic0) return null;
  const data = String(log.data || '');
  if (!/^0x[0-9a-fA-F]*$/.test(data)) return null;
  const n = (data.length - 2) / 64;
  if (!Number.isInteger(n) || n < 1) return null;
  const words = [];
  for (let i = 0; i < n; i++) words.push(data.slice(2 + i * 64, 2 + (i + 1) * 64));
  return { topics: log.topics, words };
}
function sqkPullIdFromCommitLog(log, fallback) {
  // v42.5.4 (BUG KAPSUL 1): CapsuleCommitted(address indexed player,
  // uint256 indexed pullId, uint256 targetRound) — player DAN pullId
  // KEDUANYA indexed, jadi DATA log hanya berisi [targetRound]. Kode lama
  // membaca words[0] sebagai pullId dan mendapat targetRound (712),
  // menimpa nilai benar dari nextPullId (1) — resolve lalu revert
  // PullNotFound(712). pullId yang benar ada di topics[2]; bila
  // topics < 3, pakai fallback (nextPullId). Kembalikan null bila log
  // ini bukan CapsuleCommitted.
  const parsed = sqkParseLogWords(log, SQK_CAPSULE_COMMITTED_TOPIC0);
  if (!parsed) return null;
  if (parsed.topics.length >= 3) {
    try { return Number(BigInt(parsed.topics[2])); } catch (_) { return fallback; }
  }
  return fallback;
}
function sqkResultFromResolveLog(log) {
  // v42.5.4 (BUG KAPSUL 2): CapsuleResolved(address indexed player,
  // uint256 indexed pullId, uint256 targetRound, bytes32 dataHash,
  // uint8 rarity, uint256 itemId, bool duplicate, uint256 kejuCompensation)
  // — player DAN pullId indexed, jadi DATA hanya 6 kata [targetRound,
  // dataHash, rarity, itemId, duplicate, kejuCompensation]. Kode lama
  // mensyaratkan words.length >= 7 (SELALU salah -> result null -> tampil
  // sqkResolveFail walau transaksi SUKSES di chain, dan kompensasi Keju
  // duplikat tidak pernah dikirim) dan indeksnya off-by-one (words[3..6]
  // padahal benar words[2..5]). Kembalikan null bila log ini bukan
  // CapsuleResolved atau datanya < 6 kata.
  const parsed = sqkParseLogWords(log, SQK_CAPSULE_RESOLVED_TOPIC0);
  if (!parsed) return null;
  const words = parsed.words;
  if (words.length < 6) return null;
  return {
    rarity: SQK_RARITY_NAMES[Number(BigInt('0x' + words[2]))] || 'common',
    itemId: Number(BigInt('0x' + words[3])),
    duplicate: BigInt('0x' + words[4]) !== 0n,
    kejuCompensation: Number(BigInt('0x' + words[5])),
  };
}
async function buySqkItem(itemId) {
  if (!sqkShopDeployed()) return sqkShopMsg(msg('sqkShopSoon'));
  const w = txWallet(); // v42.5: transaksi pakai alamat TERHUBUNG, bukan field
  if (!isAddr(w)) return sqkShopMsg(msg('sqkNeedWallet'));
  const item = sqkShopItem(itemId);
  if (!item) return;
  const priceWei = BigInt(item.priceSqk) * (10n ** 18n);
  let bal = null;
  try { bal = await sqkEthCall(CONFIG.SQK_TOKEN, SQK_SEL.balanceOf + sqkWordAddr(w)).then(sqkUint); } catch (_) {}
  if (bal !== null && bal < priceWei) return sqkShopMsg(msg('sqkNoSqk'));
  sqkShopMsg(msg('sqkWaiting'));
  const txHash = await sqkPermitAndSend(w, priceWei, (deadline, v, r, s) => sqkEncodeBuy(itemId, deadline, v, r, s));
  if (!txHash) return;
  const receipt = await sqkWaitReceipt(txHash);
  if (!receipt) return sqkShopMsg(msg('sqkWaiting'));
  if (receipt.status !== '0x1') return sqkShopMsg(msg('sqkTxFail'));
  sqkShopMsg(msgf('sqkBought', { item: item.name }));
  await fetchSqkShop();
}
async function commitSqkCapsule() {
  if (!sqkShopDeployed()) return sqkShopMsg(msg('sqkShopSoon'));
  const w = txWallet(); // v42.5: transaksi pakai alamat TERHUBUNG, bukan field
  if (!isAddr(w)) return sqkShopMsg(msg('sqkNeedWallet'));
  await refreshChain(true);
  const settled = chainSnapshot && chainSnapshot.ok ? chainSnapshot.settled : null;
  if (settled === null || !Number.isFinite(settled)) return sqkShopMsg(msg('sqkRoundUnknown'));
  const targetRound = settled + 2; // commit now, resolve after this round settles (~20 min)
  const priceWei = BigInt(SQK_CAPSULE_PRICE) * (10n ** 18n);
  let bal = null, nextPull = null;
  try {
    bal = await sqkEthCall(CONFIG.SQK_TOKEN, SQK_SEL.balanceOf + sqkWordAddr(w)).then(sqkUint);
    nextPull = await sqkEthCall(CONFIG.SHOP_ADDRESS, SQK_SEL.nextPullId).then(sqkUint);
  } catch (_) {}
  if (bal !== null && bal < priceWei) return sqkShopMsg(msg('sqkNoSqk'));
  sqkShopMsg(msg('sqkWaiting'));
  const txHash = await sqkPermitAndSend(w, priceWei, (deadline, v, r, s) => sqkEncodeCommit(targetRound, deadline, v, r, s));
  if (!txHash) return;
  const receipt = await sqkWaitReceipt(txHash);
  if (!receipt) return sqkShopMsg(msg('sqkWaiting'));
  if (receipt.status !== '0x1') return sqkShopMsg(msg('sqkTxFail'));
  let pullId = nextPull === null ? null : Number(nextPull);
  for (const log of (receipt.logs || [])) {
    const p = sqkPullIdFromCommitLog(log, pullId); // v42.5.4: pullId dari topics[2], bukan words[0] (= targetRound)
    if (p !== null) { pullId = p; break; }
  }
  if (pullId === null) return sqkShopMsg(msg('sqkTxFail'));
  sqkSavePendingCapsule({ pullId, targetRound, txHash });
  sqkShopMsg(msgf('sqkCommitted', { pull: pullId, round: targetRound }));
  renderSqkShop();
}
async function sqkHealPendingCapsule(wallet, pending) {
  // v42.5.4 (BUG KAPSUL 3 — SELF-HEALING): verifikasi pull tersimpan
  // on-chain via getter publik pulls(uint256) -> (player, targetRound,
  // resolved) SEBELUM resolve memanggil Worker / mengirim transaksi.
  // PullId tersimpan bisa rusak (bug lama menyimpan targetRound 712
  // sebagai pullId) dan resolve dengan pullId itu pasti revert
  // PullNotFound. Bila pull tersimpan salah / milik wallet lain / sudah
  // resolved, pindai pull 1..nextPullId-1 (paling baru dulu, maks 50) dan
  // pakai pull milik wallet yang belum resolved dan targetRound-nya cocok
  // dengan yang tersimpan (fallback: pull milik wallet yang belum resolved
  // dan paling baru); simpan perbaikannya ke localStorage. Bila tidak ada
  // pull yang cocok, kembalikan null — pemanggil menampilkan sqkNoPending
  // dan TIDAK mengirim transaksi yang pasti revert. Bila pembacaan
  // on-chain gagal (RPC mati), kembalikan pending apa adanya — jalur tx
  // akan gagal dengan aman sendiri (eth_sendTransaction melempar) dan
  // user bisa coba lagi saat koneksi pulih.
  const readPull = async (id) => {
    let r;
    try { r = await sqkEthCall(CONFIG.SHOP_ADDRESS, SQK_SEL.pulls + sqkWordUint(id)); } catch (_) { return null; }
    if (!r) return null;
    const hex = String(r).replace(/^0x/, '');
    if (hex.length < 192) return null;
    try {
      return {
        player: '0x' + hex.slice(24, 64),
        targetRound: Number(BigInt('0x' + hex.slice(64, 128))),
        resolved: BigInt('0x' + hex.slice(128, 192)) !== 0n,
      };
    } catch (_) { return null; }
  };
  const w = String(wallet).toLowerCase();
  const stored = await readPull(pending.pullId);
  if (stored === null) return pending; // RPC gagal — tidak bisa verifikasi; lanjut seperti biasa
  if (stored.player.toLowerCase() === w && stored.targetRound === pending.targetRound && !stored.resolved) return pending; // pull tersimpan benar
  let next = null;
  try { next = await sqkEthCall(CONFIG.SHOP_ADDRESS, SQK_SEL.nextPullId).then(sqkUint); } catch (_) {}
  const maxId = next === null ? 0 : Number(next) - 1;
  let newest = null;
  for (let id = maxId; id >= Math.max(1, maxId - 49); id--) {
    const p = await readPull(id);
    if (!p || p.player.toLowerCase() !== w || p.resolved) continue;
    if (p.targetRound === pending.targetRound) {
      const fixed = { pullId: id, targetRound: p.targetRound, txHash: pending.txHash };
      sqkSavePendingCapsule(fixed);
      return fixed;
    }
    if (!newest) newest = { pullId: id, targetRound: p.targetRound, txHash: pending.txHash };
  }
  if (newest) { sqkSavePendingCapsule(newest); return newest; }
  return null;
}
async function resolveSqkCapsule() {
  if (!sqkShopDeployed()) return sqkShopMsg(msg('sqkShopSoon'));
  const w = txWallet(); // v42.5: transaksi pakai alamat TERHUBUNG, bukan field
  if (!isAddr(w)) return sqkShopMsg(msg('sqkNeedWallet'));
  const pending0 = sqkPendingCapsule();
  if (!pending0) return sqkShopMsg(msg('sqkNoPending'));
  // v42.5.4 (BUG KAPSUL 3): verifikasi + perbaiki pull tersimpan on-chain
  // SEBELUM memanggil Worker / mengirim transaksi — pullId rusak (712)
  // pasti revert PullNotFound. Bila tidak ada pull yang cocok, tampilkan
  // sqkNoPending dan JANGAN kirim transaksi.
  let pending = await sqkHealPendingCapsule(w, pending0);
  if (!pending) return sqkShopMsg(msg('sqkNoPending'));
  sqkShopMsg(msg('sqkWaiting'));
  let d;
  try {
    const r = await tfetch(CONFIG.LB_URL + '/capsule-resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: w, pullId: pending.pullId, targetRound: pending.targetRound }) }, 10000);
    d = await r.json().catch(() => null);
    if (!r.ok) {
      if (r.status === 409) return sqkShopMsg(msgf('sqkNotSettled', { round: pending.targetRound }));
      if (r.status === 503) return sqkShopMsg(msg('sqkShopSoon'));
      if (r.status === 429) { // v42.5 (P0-1): rate limit resolve — jam retry persis dari Worker, bukan "RESOLVE FAILED" generik
        const t = d && d.retryAfterSec ? new Date(Date.now() + d.retryAfterSec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        return sqkShopMsg(msgf('sqkRateLimited', { time: t || 'a few minutes' }));
      }
      throw new Error('HTTP_' + r.status);
    }
  } catch (_) {
    return sqkShopMsg(msg('sqkResolveFail'));
  }
  if (!d || !d.signature || !d.dataHash || !d.deadline) return sqkShopMsg(msg('sqkResolveFail'));
  const eth = getEth(); // v42.2: WalletConnect provider when connected via WC, else window.ethereum
  if (!eth || typeof eth.request !== 'function') return sqkShopMsg(msg('sqkNoProvider'));
  if (!(await ensureSepoliaChain(eth))) return sqkShopMsg(msg('sqkWrongChain')); // v42.2: switch/add Sepolia instead of refusing
  let txHash;
  try {
    txHash = await eth.request({ method: 'eth_sendTransaction', params: [{ from: w, to: CONFIG.SHOP_ADDRESS, data: sqkEncodeResolve(pending.pullId, d.dataHash, d.deadline, d.signature), value: '0x0' }] });
  } catch (e) {
    return sqkShopMsg(msg('sqkTxRejected'));
  }
  if (!txHash) return sqkShopMsg(msg('sqkTxRejected'));
  const receipt = await sqkWaitReceipt(txHash);
  if (!receipt) return sqkShopMsg(msg('sqkWaiting'));
  if (receipt.status !== '0x1') return sqkShopMsg(msg('sqkTxFail'));
  // Read the result from the CapsuleResolved log (never trust a guess).
  let result = null;
  for (const log of (receipt.logs || [])) {
    const r = sqkResultFromResolveLog(log); // v42.5.4: DATA hanya 6 kata; rarity=words[2], itemId=words[3], duplicate=words[4], keju=words[5]
    if (r) { result = r; break; }
  }
  sqkClearPendingCapsule();
  renderSqkShop();
  if (!result) { await fetchSqkShop(); return sqkShopMsg(msg('sqkResolveFail')); }
  const itemLabel = 'Kapsul #' + result.itemId + ' (' + result.rarity + ')';
  if (result.duplicate && result.kejuCompensation > 0) {
    // Credit the Keju compensation via the Worker (verified receipt).
    try {
      const r = await tfetch(CONFIG.LB_URL + '/capsule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: w, txHash }) }, 10000);
      const cd = await r.json().catch(() => null);
      if (r.ok && cd && typeof cd.compensation === 'number') {
        sqkShopMsg(msgf('sqkDupKeju', { item: itemLabel, rarity: result.rarity, n: cd.compensation }));
      } else {
        sqkShopMsg(msgf('sqkDupKeju', { item: itemLabel, rarity: result.rarity, n: result.kejuCompensation }));
      }
    } catch (_) {
      sqkShopMsg(msgf('sqkDupKeju', { item: itemLabel, rarity: result.rarity, n: result.kejuCompensation }));
    }
    await fetchShop();
  } else {
    sqkShopMsg(msgf('sqkResolved', { item: itemLabel, rarity: result.rarity }));
  }
  await fetchSqkShop();
}
// --- v41: weekly league board (GET /league, top 30, Monday 19:00 WIB) ---
let leagueWeeklyState = { week_start: '', scores: [], you: null };
function renderLeagueWeekly() {
  const el = $('leagueWeeklyList'); if (!el) return;
  const lbl = $('leagueWeekLabel');
  if (lbl) lbl.textContent = leagueWeeklyState.week_start ? ('WEEK ' + leagueWeeklyState.week_start + ' — ' + I18N[lang].leagueWeekNote) : '';
  if (!leagueWeeklyState.scores.length) { el.innerHTML = `<p class="msg">${I18N[lang].leagueWeeklyEmpty}</p>`; return; }
  const me = (currentWallet() || '').toLowerCase();
  el.innerHTML = leagueWeeklyState.scores.map(r => `<div class="league-row lb-row${r.wallet && r.wallet.toLowerCase() === me ? ' lb-me' : ''}"><span class="lb-rank">#${r.rank}</span> <b>${escHtml(r.name || 'GUEST')}</b> <span class="lb-wallet">${escHtml(truncAddr(r.wallet))}</span> <b class="lb-score">${r.best_score}</b>${r.verified ? ` <span class="lb-verified" title="${escHtml(msg('lbVerified'))}">✓</span>` : ''}</div>`).join(''); // v41.1: verified=1 league rows carry a ✓, same as the global board; verified=0 rows unchanged
  const rk = $('leagueWeeklyRank');
  if (rk) rk.textContent = (leagueWeeklyState.you && leagueWeeklyState.you.rank) ? msgf('leagueWeeklyYourRank', { rank: leagueWeeklyState.you.rank }) : '';
}
async function fetchLeagueWeekly() {
  const el = $('leagueWeeklyList'); if (!el) return;
  el.innerHTML = `<p class="msg">${msg('leagueWeeklyLoading')}</p>`;
  try {
    const w = currentWallet();
    const r = await tfetch(CONFIG.LB_URL + '/league' + (isAddr(w) ? '?wallet=' + w : ''), null, 8000);
    if (!r.ok) throw new Error('HTTP_' + r.status);
    const d = await r.json();
    if (!d || !Array.isArray(d.scores)) throw new Error('bad league');
    leagueWeeklyState = { week_start: d.week_start || '', scores: d.scores, you: d.you || null };
    renderLeagueWeekly();
  } catch (_) {
    leagueWeeklyState = { week_start: '', scores: [], you: null };
    el.innerHTML = `<p class="msg">${msg('leagueWeeklyOffline')}</p>`;
    const rk = $('leagueWeeklyRank'); if (rk) rk.textContent = '';
  }
}

// --- v42.5 GHOST Squeektoshi ---
// Pace hantu dari data NYATA: rata-rata work unit per bucket 30 menit pada
// jam siang (10:00–14:00 WIB = 03:00–07:00 UTC) selama 7 hari terakhir,
// dari /v1/measurement/stats. 1 work unit = 1 passage ≈ 0,878 m.
function ghostPaceFromStats(d) {
  if (!d || !Array.isArray(d.days)) return null;
  let work = 0, n = 0;
  for (const day of d.days) {
    if (!day || !Array.isArray(day.buckets)) continue;
    for (const b of day.buckets) {
      if (!b || typeof b.startMinuteUtc !== 'number') continue;
      if (b.startMinuteUtc < GHOST_DAY_START_MIN_UTC || b.startMinuteUtc >= GHOST_DAY_END_MIN_UTC) continue;
      if (b.coverage !== 'complete') continue;
      const w = Number(b.workUnits);
      if (!Number.isFinite(w)) continue;
      work += w; n++;
    }
  }
  if (!n) return null;
  const pace = (work / n) * GHOST_WHEEL_M_PER_PASSAGE / 1800;
  return Number.isFinite(pace) && pace > 0 ? +pace.toFixed(3) : null;
}
async function fetchGhostPace() {
  try {
    const cached = loadJSON(GHOST_PACE_CACHE_KEY, null);
    if (cached && typeof cached.pace === 'number' && cached.pace > 0 && Date.now() - (cached.at || 0) < GHOST_PACE_CACHE_MS) return cached.pace;
  } catch (_) {}
  try {
    const r = await tfetch(CONFIG.STATS_URL, null, 10000);
    if (r.ok) {
      const d = await r.json();
      const pace = ghostPaceFromStats(d);
      if (pace) { saveJSON(GHOST_PACE_CACHE_KEY, { pace, at: Date.now() }); return pace; }
    }
  } catch (_) {}
  try {
    const cached = loadJSON(GHOST_PACE_CACHE_KEY, null);
    if (cached && typeof cached.pace === 'number' && cached.pace > 0) return cached.pace;
  } catch (_) {}
  return GHOST_DEFAULT_PACE_MS; // fallback jujur: pace default dari data 7 hari Nov 2026
}
function ghostPaceDisplay() { // pace untuk label (cache/default saja, tanpa fetch)
  try {
    const cached = loadJSON(GHOST_PACE_CACHE_KEY, null);
    if (cached && typeof cached.pace === 'number' && cached.pace > 0) return cached.pace;
  } catch (_) {}
  return GHOST_DEFAULT_PACE_MS;
}
function ghostActive() { return !!(G && G.race && G.race.ghost); }

// --- LIVE RACE HUD ---
let raceTick = null;
function raceOppDist() {
  if (!G || !G.race) return 0;
  // v42.5 GHOST: hamster tidur/offline → lawan simulasi dengan pace nyata.
  // Bila hamster BANGUN di tengah lagu (RPM > 0), kembali ke live — SATU
  // ARAH saja (live tidak pernah kembali ke ghost dalam satu lagu, supaya
  // jarak lawan tidak pernah lompat mundur).
  if (G.race.ghost) {
    if (liveSnapshot && liveSnapshot.ok && liveSnapshot.rpm > 0) {
      G.race.ghost = false; G.race.wokeUp = true;
      say(msg('ghostWokeUp'), 'green');
      renderRaceBox();
    } else {
      return Math.max(0, G.race.ghostPaceMs * Math.max(0, songTime()));
    }
  }
  if (G.race.offline || !liveSnapshot || !liveSnapshot.ok) return 0;
  return Math.max(0, (liveSnapshot.dist - G.race.startDistKm) * 1000);
}
function computeZoomies() { liveZoomies = !!(liveSnapshot && liveSnapshot.ok && liveSnapshot.rpm >= ZOOMIES_RPM); }
function updateRaceHud() {
  if (!G || !G.race) return;
  const you = G.race.playerDist, opp = raceOppDist();
  const max = Math.max(50, you, opp);
  const yb = $('raceYouBar'), ob = $('raceOppBar'), yt = $('raceYouTxt'), ot = $('raceOppTxt');
  if (yb) yb.style.width = Math.min(100, you / max * 100) + '%';
  if (ob) ob.style.width = Math.min(100, opp / max * 100) + '%';
  if (yt) yt.textContent = you.toFixed(0) + ' m';
  if (ot) ot.textContent = opp.toFixed(0) + ' m' + (ghostActive() ? rl('ghostTag') : '');
  // keep the LIVE WHEEL result row honest in race mode too
  if (G.live && liveSnapshot && liveSnapshot.ok) { G.live.dist = liveSnapshot.dist; G.live.peakRpm = Math.max(G.live.peakRpm, liveSnapshot.rpm); if (liveSnapshot.rpm >= ZOOMIES_RPM) G.live.zoomiesEver = true; }
}
function startRaceTick() { stopRaceTick(); raceTick = setInterval(() => { if (G && G.mode === 'race' && !G.ended) { computeZoomies(); updateRaceHud(); } }, 500); }
function stopRaceTick() { if (raceTick) { clearInterval(raceTick); raceTick = null; } }
function renderRaceBox() {
  const box = $('raceBox'); if (!box) return;
  box.classList.toggle('hidden', playMode !== 'race');
  if (playMode !== 'race') return;
  const pl = $('petLine');
  if (pl) {
    if (!liveSnapshot) pl.textContent = msg('petWaiting');
    // v42.5 GHOST: bila balapan berikutnya melawan hantu (hamster tidur /
    // roda offline), katakan dengan jujur — jangan pernah pura-pura live.
    else if (!liveSnapshot.ok) pl.textContent = ghostActive() ? msg('ghostOffline') : msg('petOffline');
    else if (liveSnapshot.rpm > 0) pl.textContent = msgf('petRunning', { rpm: Math.round(liveSnapshot.rpm), zoom: liveSnapshot.rpm >= ZOOMIES_RPM ? msg('petZoom') : '' });
    else pl.textContent = ghostActive() ? msg('ghostNapping') : msg('petNapping');
  }
  const gl = $('raceGhostLine');
  if (gl) {
    const willGhost = ghostActive() || (liveSnapshot && (liveSnapshot.ok ? liveSnapshot.rpm <= 0 : true));
    gl.classList.toggle('hidden', !willGhost);
    if (willGhost) gl.textContent = msgf('ghostPaceTpl', { pace: ghostPaceDisplay().toFixed(2) });
  }
  const rl = $('raceLast');
  if (rl) {
    const last = loadJSON('sqk29:lastRace:' + walletKey(currentWallet()), null);
    rl.textContent = last ? msgf('raceLastTpl', { you: last.you, opp: last.opp, result: last.win ? msg('raceLastWin') : msg('raceLastLose') }) : msg('raceLastNone');
  }
}

// --- v42.5 Dream Seeds + Lullaby (Rencana §1.4, K15) ---
// Mode malam: saat hamster tidur, game tetap hidup. Dream Seed ditanam di
// malam hari (19:00–06:00 WIB) atau saat hamster tidur, disiram dengan
// memainkan Lullaby, dipanen untuk Keju (via Worker — satu kali per malam,
// reward dibatasi server). Jujur: ini mode malam, BUKAN data live; tidak
// menyentuh ekonomi SQK.
const DREAM_KEY = 'sqk42:dream';
const DREAM_NIGHT_START_H = 19, DREAM_NIGHT_END_H = 6;
function dreamState() { const d = loadJSON(DREAM_KEY, null); return (d && typeof d === 'object') ? d : null; }
function saveDreamState(d) { saveJSON(DREAM_KEY, d); }
function dreamIsNight() { const h = new Date().getHours(); return h >= DREAM_NIGHT_START_H || h < DREAM_NIGHT_END_H; } // zona waktu perangkat
function dreamHamsterAsleep() { return !!(liveSnapshot && (!liveSnapshot.ok || liveSnapshot.rpm <= 0)); }
function dreamCanPlant() { return dreamIsNight() || dreamHamsterAsleep(); }
function dreamNightKeyFor(ts) { return squeekTodayStr(ts); }
function renderDreamBox() {
  const box = $('dreamBox'); if (!box) return;
  box.classList.toggle('hidden', playMode !== 'daily');
  const d = dreamState();
  const canPlant = dreamCanPlant();
  const line = $('dreamLine');
  const plantBtn = $('dreamPlantBtn'), harvestBtn = $('dreamHarvestBtn');
  if (!d) {
    if (line) line.textContent = canPlant ? msg('dreamLineNone') : msg('dreamLineDay');
    if (plantBtn) plantBtn.classList.toggle('hidden', !canPlant);
    if (harvestBtn) harvestBtn.classList.add('hidden');
    return;
  }
  const stage = Math.min(2, d.stage || 0);
  if (line) line.textContent = msgf('dreamLineStage', { stage, night: dreamNightKeyFor(d.plantedAt) });
  if (plantBtn) plantBtn.classList.add('hidden');
  const ready = stage >= 2 && !d.harvested;
  if (harvestBtn) harvestBtn.classList.toggle('hidden', !ready);
}
function plantDream() {
  if (!dreamCanPlant()) { say(msg('dreamNotNight'), 'pink'); return; }
  const d = dreamState();
  if (d && dreamNightKeyFor(d.plantedAt) === dreamNightKeyFor(Date.now())) { say(msg('dreamAlready'), 'pink'); return; }
  saveDreamState({ plantedAt: Date.now(), stage: 0, harvested: false });
  say(msg('dreamPlanted'), 'green');
  renderDreamBox();
}
function waterDream() { // dipanggil dari finish() setelah lagu Lullaby; kembalikan tahap baru (0 = tidak disiram)
  const d = dreamState();
  if (!d || d.harvested) return 0;
  if (dreamNightKeyFor(d.plantedAt) !== dreamNightKeyFor(Date.now())) return 0;
  if ((d.stage || 0) >= 2) return 0;
  d.stage = (d.stage || 0) + 1;
  saveDreamState(d);
  return d.stage;
}
async function harvestDream() {
  const w = currentWallet();
  if (!isAddr(w)) { say(msg('dreamNeedWallet'), 'pink'); return; }
  const d = dreamState();
  if (!d || d.harvested) { say(msg('dreamNoSeed'), 'pink'); return; }
  if ((d.stage || 0) < 2) { say(msg('dreamNotReady'), 'pink'); return; }
  try {
    const r = await tfetch(CONFIG.LB_URL + '/dream/harvest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: w, plantedAt: d.plantedAt, stage: d.stage }) }, 12000);
    const res = await r.json().catch(() => null);
    if (!r.ok || !res || res.error) { say(msg('dreamHarvestFail'), 'pink'); return; }
    d.harvested = true; saveDreamState(d);
    say(msgf('dreamHarvested', { n: res.keju }), 'green');
    renderDreamBox(); fetchShop();
  } catch (_) { say(msg('dreamHarvestFail'), 'pink'); }
}
function renderLullabyBox() {
  const box = $('lullabyBox'); if (!box) return;
  box.classList.toggle('hidden', playMode !== 'lullaby');
  const info = $('lullabyInfo');
  if (info && playMode === 'lullaby') {
    info.textContent = (liveSnapshot && liveSnapshot.ok && liveSnapshot.rpm > 0) ? msg('lullabyInfoAwake') : msg('lullabyInfo');
  }
}

// --- Weekly Boss (deterministic ISO-week song, always HARD, +100 XP) ---
function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7; // Monday = 0
  t.setUTCDate(t.getUTCDate() - day + 3); // Thursday of this week
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - fday + 3);
  const week = 1 + Math.round((t - firstThu) / (7 * 86400000));
  return t.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}
function weeklyKey() { return isoWeekKey(new Date()); }
function weeklySpecFor(wk) { // v30: the same deterministic spec, but for any week key — used for the past-bosses list
  const genres = ['cyber', 'synth', 'chip'];
  return { week: wk, genre: genres[cyrb53('BOSS-GENRE-' + wk) % genres.length], name: ['THE VOID HAMSTER', 'SQUEEKTOSHI PRIME', 'THE MIDNIGHT WHEEL', 'BARON VON SQUEEK'][cyrb53('BOSS-NAME-' + wk) % 4] };
}
function weeklySpec() { return weeklySpecFor(weeklyKey()); }
function renderBossBox() {
  const el = $('bossLine'); if (!el) return;
  const bs = weeklySpec();
  el.textContent = msgf('bossLine', { name: bs.name, week: bs.week, genre: bs.genre.toUpperCase() }); // v30.1: the boss line is now translatable (it stayed English in ID mode)
  const bh = $('bossHist'); // v30: the last 3 bosses, from the same deterministic spec
  if (bh) {
    const past = [];
    const d = new Date();
    for (let i = 1; i <= 3; i++) { const t = new Date(d); t.setDate(t.getDate() - 7 * i); const s = weeklySpecFor(isoWeekKey(t)); past.push(s.week + ' ' + s.name); }
    bh.textContent = msg('pastBosses') + past.join(' • ') + '.';
  }
}
function fightBoss() {
  playMode = 'boss';
  document.querySelectorAll('#modeRow .btn-diff').forEach(x => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
  say(msgf('bossFight', { name: weeklySpec().name }), 'yellow');
  play();
}

// --- Diary + While You Were Away (summary renders once per page load only) ---
function recordDiary(entry) {
  const w = currentWallet();
  const key = 'sqk29:diary:' + walletKey(w);
  const list = loadJSON(key, []);
  list.push(entry);
  saveJSON(key, list.slice(-30));
}
function renderDiaryList() {
  const dl = $('diaryList'); if (!dl) return;
  const diary = loadJSON('sqk29:diary:' + walletKey(currentWallet()), []);
  dl.innerHTML = diary.slice(-5).reverse().map(e => `<div class="diary-line"><b>${new Date(e.at).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short' })} ${new Date(e.at).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</b> — ${e.song} • ${e.score} PTS • ${e.grade}${e.note ? ' • “' + String(e.note).replace(/</g, '&lt;') + '”' : ''}</div>`).join('');
}
let awayLastVisitCache = {}; // v32: the lastVisit shown is captured on the first renderAway of a session, so applyLang can re-render the away line without resetting it
function renderAway() {
  const w = currentWallet();
  const wk = walletKey(w);
  const al = $('awayLine'); if (!al) return;
  const hist = loadJSON('sqk24:hist:' + wk, []);
  const lastVisit = awayLastVisitCache[wk] !== undefined ? awayLastVisitCache[wk] : loadJSON('sqk29:lastVisit:' + wk, 0);
  if (awayLastVisitCache[wk] === undefined) { awayLastVisitCache[wk] = lastVisit; saveJSON('sqk29:lastVisit:' + wk, Date.now()); }
  const ach = loadJSON('sqk29:ach:' + wk, []);
  const achSeen = loadJSON('sqk29:achSeen:' + wk, 0);
  const newAch = ach.length - achSeen;
  if (!hist.length) al.textContent = msg('awayEmpty');
  else {
    const lastDate = lastVisit ? new Date(lastVisit).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short' }) : (lang === 'id' ? 'lama lalu' : 'a while ago');
    const streak = loadJSON('sqk24:streak:' + wk, { count: 0 }).count;
    // v30: what the hamster did while you were away — rounds settled since the
    // last visit (only rounds this browser recorded; never invented).
    const awayRounds = lastVisit ? loadRounds().filter(r => r.key > roundKeyFor(new Date(lastVisit))).slice(-3) : [];
    const awayTxt = awayRounds.length ? msgf('awayRoundsTpl', { list: awayRounds.map(r => msgf('awayRoundItem', { time: r.key.slice(11), label: roundLabel(r.cls), avg: r.avg })).join(' • ') }) : msg('awayNoRounds');
    al.textContent = msgf('awayTpl', { date: lastDate, n: streak, best: Math.max.apply(null, hist.map(h => h.score)), new: newAch > 0 ? newAch : msg('awayNewNone'), away: awayTxt });
  }
  saveJSON('sqk29:achSeen:' + wk, ach.length);
  renderDiaryList();
}
function addDiaryNote() {
  const inp = $('diaryNote'); if (!inp) return;
  const txt = inp.value.trim(); if (!txt) return;
  const w = currentWallet();
  const key = 'sqk29:diary:' + walletKey(w);
  const list = loadJSON(key, []);
  if (!list.length) { say(msg('diaryFirst'), 'pink'); return; }
  list[list.length - 1].note = txt.slice(0, 120);
  saveJSON(key, list);
  inp.value = '';
  renderDiaryList();
  say(msg('diarySaved'), 'green');
}

function applyLang(l) {
  lang = (l === 'id') ? 'id' : 'en';
  disarmPauseExit(); // v38: a language switch rewrites button labels — an armed EXIT must not survive it
  saveJSON('sqk29:lang', lang);
  const dict = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.dataset.i18n; if (dict[k]) el.textContent = dict[k]; });
  const lb = $('langBtn'); if (lb) lb.textContent = lang.toUpperCase();
  const dn = $('diaryNote'); if (dn && dict.diaryPh) dn.placeholder = dict.diaryPh;
  const du = $('duelOut'); if (du && dict.duelOutPh) du.placeholder = dict.duelOutPh;
  renderPredict(); renderBossBox(); renderRaceBox(); renderLullabyBox(); renderDreamBox(); renderLeague(); renderChamps(); renderRoundHist(); renderTutorial();
  preview(); renderDailyBox(); renderMastery(); renderUnlocks(); renderPracticeBtn(); updateMusicModeBtn(); renderOffsetLine(); renderLiveBox(); renderAway(); // v32: everything re-renders in the new language (renderAway reuses the first-load lastVisit, so re-rendering is safe)
  updateConnectBtn(); // v42.4: ganti bahasa menulis ulang SEMUA label data-i18n, termasuk connectBtn — kembalikan status TERHUBUNG bila ada koneksi aktif
}

// --- OBS overlay (?overlay=1): minimal live widget, transparent background ---
const overlayMode = new URLSearchParams(location.search).get('overlay') === '1';
function overlayUrl() { return location.href.split('?')[0] + '?overlay=1'; }
async function copyObsLink() {
  const url = overlayUrl();
  try { await navigator.clipboard.writeText(url); say(msg('obsCopied'), 'green'); }
  catch (e) { say(msgf('obsBlocked', { url }), 'pink'); }
}
function updateOverlay() {
  const ob = $('overlayBox'); if (!ob || ob.classList.contains('hidden')) return;
  const s = liveSnapshot;
  setText('overlayRpm', s && s.ok ? `RPM ${Math.round(s.rpm)}${s.rpm >= ZOOMIES_RPM ? msg('liveSumZoom') : ''}` : msg('ovRpmOff'));
  setText('overlayDist', s && s.ok ? (lang === 'id' ? 'JARAK ' : 'DIST ') + s.dist.toFixed(3) + ' KM' : msg('ovDistOff'));
  const cur = currentRoundKey();
  const avg = roundAvg(cur);
  const cls = avg !== null ? roundClass(avg) : (s && s.ok ? roundClass(s.rpm) : null);
  setText('overlayRound', msgf('ovRoundTpl', { cur, cls: cls ? roundLabel(cls) : '—', cd: fmtCountdown(nextRoundInMs(new Date())) }));
  setText('overlayZoom', liveZoomies ? msg('ovZoomOn') : (s && s.ok && s.rpm >= 5 ? msg('ovZoomJog') : s && s.ok ? msg('ovZoomNap') : msg('ovZoomOff')));
  setText('overlayPet', s && s.ok ? (s.rpm > 0 ? msgf('ovPetRun', { rpm: Math.round(s.rpm) }) : msg('ovPetNap')) : msg('ovPetOff'));
  setText('overlaySong', lastAnthem ? msgf('ovSong', { key: lastAnthem.key, scale: lastAnthem.scaleName, bpm: lastAnthem.bpm }) : msg('ovSongOff'));
}

// --- Practice mode (60% tempo, no XP/streak/history) ---
let practiceMode = loadJSON('sqk29:practice', false) === true;
function renderPracticeBtn() { const b = $('practiceBtn'); if (b) b.textContent = practiceMode ? msg('practiceOnBtn') : msg('practiceOffBtn'); }

// --- Menu poll: 30s wheel fetch while the menu is open (feeds predictions) ---
let menuPoll = null;
function startMenuPoll() { stopMenuPoll(); if (overlayMode) return; menuPoll = setInterval(() => { if (!G) refreshLive(); }, 30000); }
function stopMenuPoll() { if (menuPoll) { clearInterval(menuPoll); menuPoll = null; } }

// --- Shareable result card (drawn on the ID card canvas, then DOWNLOAD/SHARE) ---
let lastResultIsNew = false; // v33.1: set by finish(), read by drawResultCard()
function drawResultCard() {
  const c = $('card-canvas'); if (!c) return false;
  const ctx = c.getContext('2d'); if (!ctx) return false;
  const CW = 400, CH = 560;
  fitCanvas(c, ctx, CW, CH, 3);
  // v39: kartu dibaca dari STATE (lastResult + G), bukan dari DOM innerText
  // panel hasil. Parsing innerText rapuh: urutan baris berubah menurut mode
  // (LIVE/RACE/BOSS menambah baris) dan nilainya bisa kedaluwarsa. Semua
  // angka di sini berasal dari lastResult yang ditulis finish() dari state.
  const r = lastResult || {};
  const g = r.grade || ($('gradeVal') ? $('gradeVal').textContent : '—');
  const cnt = r.counts || { perfect: 0, great: 0, good: 0, miss: 0 };
  cardFrame(ctx, CW, CH, 'SQUEEK // RESULT CARD', (r.mode || (G && G.mode) || '').toUpperCase());

  // Grade — big, glowing, the thing you brag about.
  const gcol = g.startsWith('S') ? '#00ff88' : g === 'A' ? '#00e5ff' : g === 'B' ? '#ffe14d' : '#ff5ce1';
  ctx.textAlign = 'center'; ctx.font = '72px "Press Start 2P"';
  ctx.globalAlpha = .3; ctx.fillStyle = gcol; ctx.fillText(g, CW / 2 + 3, 133);
  ctx.globalAlpha = 1; ctx.fillStyle = gcol; ctx.fillText(g, CW / 2, 130);

  // Score, accuracy, max combo. (The score reads from G, not from the panel,
  // so the count-up animation can never leak a half-counted score into the card.)
  const dy = lastResultIsNew ? 12 : 0;
  if (lastResultIsNew) { ctx.fillStyle = '#ffd700'; ctx.font = 'bold 12px "Space Mono"'; ctx.fillText('★ NEW BEST! ★', CW / 2, 152); }
  ctx.fillStyle = '#7d8a8d'; ctx.font = '10px "Space Mono"'; ctx.fillText('SCORE', CW / 2, 168 + dy);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 30px "Space Mono"'; ctx.fillText(String(G && G.score !== undefined ? G.score : (r.score !== undefined ? r.score : 0)), CW / 2, 202 + dy);
  ctx.font = '10px "Space Mono"'; ctx.fillStyle = '#7d8a8d';
  ctx.fillText('ACCURACY', CW / 2 - 90, 232 + dy); ctx.fillText('MAX COMBO', CW / 2 + 90, 232 + dy);
  ctx.font = 'bold 16px "Space Mono"'; ctx.fillStyle = '#fff';
  ctx.fillText(r.acc !== undefined ? (+r.acc).toFixed(2) + '%' : '—', CW / 2 - 90, 254 + dy); ctx.fillText(r.maxCombo !== undefined ? String(r.maxCombo) : '—', CW / 2 + 90, 254 + dy);

  // Judgement breakdown — four mini-columns, no more a wall of text.
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(24, 274); ctx.lineTo(CW - 24, 274); ctx.stroke();
  const cols = [['PERFECT', String(cnt.perfect), '#00ff88'], ['GREAT', String(cnt.great), '#00e5ff'], ['GOOD', String(cnt.good), '#ffe14d'], ['MISS', String(cnt.miss), '#ff5ce1']];
  cols.forEach(([lbl, n, col], i) => { const x = 60 + i * 93; ctx.fillStyle = '#7d8a8d'; ctx.font = '9px "Space Mono"'; ctx.fillText(lbl, x, 296); ctx.fillStyle = col; ctx.font = 'bold 18px "Space Mono"'; ctx.fillText(n, x, 320); });

  // Details — label left, value right, every line filled, no void.
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.beginPath(); ctx.moveTo(24, 340); ctx.lineTo(CW - 24, 340); ctx.stroke();
  ctx.font = '12px "Space Mono"';
  let y = 366;
  const detail = (l, v) => { ctx.textAlign = 'left'; ctx.fillStyle = '#7d8a8d'; ctx.fillText(l, 24, y); ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText(String(v).slice(0, 40), CW - 24, y); y += 26; }; // v33.2: slice 34 -> 40 (the anthem name made values longer)
  const off = (offsetMs > 0 ? '+' : '') + offsetMs;
  detail(rl('anthem'), r.song ? `"${r.song.name}" • ${r.song.key}` : '—');
  detail(rl('setup'), `${r.lanes || 3} LANES${r.mirror ? ' • MIRROR' : ''} • OFFSET ${off} ms${r.avgOff !== null && r.avgOff !== undefined ? ' • AVG ' + (r.avgOff > 0 ? '+' : '') + r.avgOff + ' ms' : ''}${r.lullaby ? rl('lullabyTag') : r.practice ? rl('practiceTag') : ''}`);
  if (r.live && y <= 500) detail(rl('live'), r.live.offline ? rl('offline') : 'PEAK RPM ' + Math.round(r.live.peakRpm) + ' • ' + (+r.live.dist).toFixed(3) + ' KM' + (r.live.zoomiesEver ? ' • ZOOMIES ×2' : ''));
  if (r.race && y <= 500) detail(rl('race'), `YOU ${(+r.race.you).toFixed(0)} m vs SQUEEKTOSHI ${(+r.race.opp).toFixed(0)} m — ${r.race.win ? rl('raceWin') : rl('raceLose')}${r.race.ghost ? rl('ghostTag') : ''}${r.race.offline ? ' (' + rl('offline') + ')' : ''}`);
  if (r.boss && y <= 500) detail(rl('boss'), rl('bossDefeated'));

  ctx.textAlign = 'center'; ctx.fillStyle = '#5c6669'; ctx.font = '9px "Space Mono"';
  ctx.fillText('squeekpixel.web.id', CW / 2, CH - 16);
  ctx.textAlign = 'left';
  return true;
}

// --- v30 TOTAL: Tutorial (first visit) + Share result to X ---
const TUT = {
  en: [
    '1. ENTER YOUR WALLET (or play as GUEST) — your anthem is generated from it.',
    '2. PICK A GENRE, DIFFICULTY AND MODE — FREE, DAILY, LIVE or RACE.',
    '3. TAP THE LANES WHEN A BLOCK HITS THE LINE. Keyboard: ← ↓ → or A S D.',
    '4. DAILY ANTHEM + MISSIONS + XP build your streak and level up your avatar.',
    '5. LIVE and RACE follow the REAL hamster wheel — 70+ RPM is ZOOMIES (scores ×2).',
    '6. After a song, send a DUEL LINK to a friend — their result lands in your Duel League.',
  ],
  id: [
    '1. MASUKKAN WALLET (atau main sebagai GUEST) — lagumu dibuat dari alamat itu.',
    '2. PILIH GENRE, KESULITAN DAN MODE — FREE, DAILY, LIVE atau RACE.',
    '3. KETUK JALUR SAAT BLOK MENYENTUH GARIS. Keyboard: ← ↓ → atau A S D.',
    '4. LAGU HARIAN + MISI + XP membangun streak dan menaikkan level avatarmu.',
    '5. LIVE dan RACE mengikuti RODA HAMSTER ASLI — 70+ RPM adalah ZOOMIES (skor ×2).',
    '6. Setelah lagu, kirim DUEL LINK ke teman — hasil mereka masuk ke Liga Duelmu.',
  ],
};
function renderTutorial() {
  const el = $('tutorialSteps'); if (el) el.innerHTML = TUT[lang].map(s => `<p class="msg">${escHtml(s)}</p>`).join('');
  const b = $('tutorialBox'); if (b) b.classList.toggle('hidden', !!loadJSON('sqk30:tutSeen', 0));
}
function showTutorial() { if (G && !G.ended) { closeSettings(); return; } setTab('daily'); renderTutorial(); const b = $('tutorialBox'); if (b) b.classList.remove('hidden'); } // v33: the tutorial lives in the menu — opening it mid-song would abandon the song
function hideTutorial() { saveJSON('sqk30:tutSeen', 1); const b = $('tutorialBox'); if (b) b.classList.add('hidden'); }
function buildShareText() {
  const g = $('gradeVal') ? $('gradeVal').textContent : '—';
  const score = G ? G.score : 0;
  const mode = G ? G.mode.toUpperCase() : 'SQUEEKCHAIN';
  return `I scored ${score} PTS (${g}) on Squeekchain Pixel ID — ${mode} mode. Race the hamster: https://squeekpixel.web.id/`;
}
function shareToX() {
  const url = 'https://x.com/intent/tweet?text=' + encodeURIComponent(buildShareText());
  window.open(url, '_blank', 'noopener');
}

// --- v29 wiring ---
bindClick('shareXBtn', shareToX); // v30: one-tap share of the result to X
bindClick('lbRefreshBtn', () => fetchLb(lbState.mode)); // v37: reload the global board
bindClick('capsuleBtn', () => pullCapsule()); // v41: cheese capsule pull
bindClick('dreamPlantBtn', plantDream); bindClick('dreamHarvestBtn', harvestDream); // v42.5: Dream Seeds
bindClick('sqkCommitBtn', () => commitSqkCapsule()); // v42.1: golden capsule commit (permit 2 SQK)
bindClick('sqkResolveBtn', () => resolveSqkCapsule()); // v42.1: golden capsule resolve (Worker signature + tx)
bindClick('leagueWeeklyRefreshBtn', () => fetchLeagueWeekly()); // v41: reload the weekly league board
bindClick('lbSubmitBtn', submitLb); // v37: send this result to the global board
bindClick('tutorialCloseBtn', hideTutorial); // v30
bindClick('howBtn', showTutorial); // v30: re-open the tutorial
bindClick('predNapBtn', () => placePrediction('nap'));
bindClick('predJogBtn', () => placePrediction('jog'));
bindClick('predZoomiesBtn', () => placePrediction('zoomies'));
bindClick('bossBtn', fightBoss);
bindClick('practiceBtn', () => { practiceMode = !practiceMode; saveJSON('sqk29:practice', practiceMode); renderPracticeBtn(); say(practiceMode ? msg('practiceOn') : msg('practiceOff'), 'cyan'); });
bindClick('obsBtn', copyObsLink);
bindClick('langBtn', () => applyLang(lang === 'en' ? 'id' : 'en'));
bindClick('diaryNoteBtn', addDiaryNote);
bindClick('resultCardBtn', () => { if (!drawResultCard()) return say(msg('cardFail'), 'pink'); say(msg('cardReady'), 'green'); openCard(msg('cardTitleResult')); }); // v33: the result card opens on top of the result panel

try {
  const params = new URLSearchParams(location.search);
  const qw = (params.get('wallet') || '').trim();
  if (qw && isAddr(qw) && walletEl) walletEl.value = qw;
  const qg = params.get('genre'); if (qg && GENRES[qg]) { currentGenre = qg; document.querySelectorAll('#genreRow .btn-diff').forEach(x => { const on = x.dataset.genre === qg; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); }); }
  const qd = params.get('diff'); if (qd && DIFFICULTIES[qd]) { currentDiff = qd; document.querySelectorAll('#diffRow .btn-diff').forEach(x => { const on = x.dataset.diff === qd; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); }); }
  const qc = params.get('challenge'); if (qc) { challengeCode = qc; playMode = 'challenge'; const qf = params.get('from'), qs = params.get('score'); if (qf && qs && !isNaN(+qs)) pendingRival = { from: validRivalName(qf), score: +qs }; } // v29: duel links carry the challenger's score for the league
  else if (params.get('daily') === '1') playMode = 'daily';
  else if (params.get('live') === '1') playMode = 'live';
  else if (params.get('race') === '1') playMode = 'race';
  else if (params.get('lullaby') === '1') playMode = 'lullaby'; // v42.5: ?lullaby=1
  if (params.get('lanes') === '4') challengeLanes = 4; // v28: duel links carry the lane count
  if (params.get('mirror') === '1') challengeMirror = true;
  if (playMode !== 'free') document.querySelectorAll('#modeRow .btn-diff').forEach(x => { const on = x.dataset.mode === playMode || (playMode === 'challenge' && x.dataset.mode === 'free'); x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); });
  if (quality === 'hemat') setQuality('hemat'); else setQuality('ultra');
} catch (_) {}
if (playMode === 'daily') { applyDailySpec(); lockGenreDiffRows(true); }
renderDailyBox(); renderLiveBox(); renderMastery(); renderOffsetLine(); renderUnlocks();
if (playMode === 'live' || playMode === 'race') { refreshLive(); startLivePoll(10000); }
try { Object.keys(localStorage).filter(k => k.indexOf('sqk29:samples:') === 0).forEach(k => finalizeRound(k.slice('sqk29:samples:'.length))); } catch (_) {} // v30: rounds recorded while the page was closed join the history at boot
applyLang(lang); renderPredict(); renderRaceBox(); renderBossBox(); renderLeague(); renderAchievements(); renderPracticeBtn(); renderChamps(); renderTutorial(); settlePredictions(); renderAway();
renderLbModes(); const ln = $('lbName'); if (ln) { ln.value = loadJSON('sqk37:lbname', ''); ln.addEventListener('input', () => saveJSON('sqk37:lbname', ln.value.slice(0, 16))); } // v37: leaderboard name + mode buttons
const vs = $('volSlider'); if (vs) { vs.value = vol; applyVol(); vs.addEventListener('input', () => { vol = +vs.value; saveJSON('sqk30:vol', vol); applyVol(); }); } // v30: volume slider
const pvs = $('pauseVolSlider'); if (pvs) { pvs.value = vol; applyVol(); pvs.addEventListener('input', () => { vol = +pvs.value; saveJSON('sqk30:vol', vol); applyVol(); }); } // v38: the pause menu has its own volume slider, synced with the settings one
if (overlayMode) { document.body.classList.add('overlay'); const ob = $('overlayBox'); if (ob) ob.classList.remove('hidden'); hideMusicSplash(); refreshLive(); startLivePoll(5000); }
else startMenuPoll();

// --- v31 ARCADE: tab navigation (menu sections inside the cabinet) ---
// The long single-column menu is gone: PLAY / DAILY / LIVE / LEAGUE / ME.
// Tab buttons live inside #mainPanel, so they hide with the menu during play.
// Last tab is remembered per browser (sqk31:tab); game data keys stay sqk30.
const TABS = ['play', 'daily', 'live', 'league', 'shop', 'me'];
function setTab(name) {
  say(''); // v42.3: stale status/error messages (e.g. wcLoadFail) must not linger when the user switches tabs
  if (TABS.indexOf(name) < 0) name = 'play';
  TABS.forEach(t => {
    const p = $('tab-' + t); if (p) p.classList.toggle('hidden', t !== name);
    const b = document.querySelector('#tabBar [data-tab="' + t + '"]');
    if (b) { b.classList.toggle('active', t === name); b.setAttribute('aria-selected', String(t === name)); }
  });
  saveJSON('sqk31:tab', name);
  if (name === 'play') preview(); // v39 B2: tab PLAY ditampilkan -> pastikan sesi preview ada (fetch bila belum ada/kedaluwarsa), supaya lagu yang dijanjikan == lagu yang dimainkan
  if (name === 'live') refreshLive(); // v36: the CHAIN panel + Wheel Call fetch immediately when the LIVE tab opens, instead of staring at "FETCHING…" until the 30s menu poll (smoke test 2026-11-07 saw ~8s)
  if (name === 'league') { fetchLb(lbState.mode); fetchLeagueWeekly(); recheckVerifyOnLeague(); } // v37: the global board fetches when the LEAGUE tab opens; v41: + weekly league board; v42.5 (P2-3): + re-check status verifikasi terakhir
  if (name === 'shop') { analyticsEvent('shop_open'); fetchShop(); fetchSqkShop(); } // v41: the shop fetches the server balance + catalog when the SHOP tab opens; v42.1: + SQK shop (live — reads the deployed contract)
}
document.querySelectorAll('#tabBar [data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
setTab(loadJSON('sqk31:tab', 'play'));
analyticsEvent('visit'); // v42.5 (P2-5): satu kali per sesi
preview();
