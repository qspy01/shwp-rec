'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const moment = require('moment');
const colors = require('colors');
const { mkdirp } = require('mkdirp');
const mv = require('mv');

const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
chromium.use(stealth());

// ─── Config ───────────────────────────────────────────────────────────────────

const config = yaml.load(fs.readFileSync(path.join(__dirname, 'config.yml'), 'utf8'));

config.captureDirectory       = config.captureDirectory       || 'captures';
config.completeDirectory      = config.completeDirectory      || 'complete';
config.modelScanInterval      = config.modelScanInterval      || 120;
config.minFileSizeMb          = config.minFileSizeMb          || 5;
config.debug                  = !!config.debug;
config.dateFormat             = config.dateFormat             || 'YYYYMMDD-HHmmss';
config.createModelDirectory   = !!config.createModelDirectory;
config.maxConcurrentRecordings = config.maxConcurrentRecordings || 50;

const captureDirectory = path.resolve(__dirname, config.captureDirectory);
const completeDirectory = path.resolve(__dirname, config.completeDirectory);
const minFileSize = config.minFileSizeMb * 1048576;

// ─── Logging ──────────────────────────────────────────────────────────────────

function printMsg(...args) {
  console.log(colors.gray(`[${moment().format('MM/DD/YYYY - HH:mm:ss')}]`), ...args);
}
const printErrorMsg = (...args) => printMsg(colors.red('[ERROR]'), ...args);
const printDebugMsg = config.debug
  ? (...args) => printMsg(colors.yellow('[DEBUG]'), ...args)
  : () => {};

// ─── State ────────────────────────────────────────────────────────────────────

// captures: [{ uid, model, filename, page, fileStream, lastChunkTime, size, checkAfter }]
let captures = [];

// Known online females from app WS: uid -> { uid, username, aliasStreamKey }
// aliasStreamKey may be null for models not in the featured list
const onlineFemales = new Map();

let browser = null;
let mainPage = null;
let nextBuildId = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mvAsync(src, dst, opts) {
  return new Promise((resolve, reject) =>
    mv(src, dst, opts, err => (err ? reject(err) : resolve())));
}

function parseNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch (_) { return null; }
}

function isAlreadyCapturing(username) {
  return captures.some(c => c.model.toLowerCase() === username.toLowerCase());
}

function getCaptureByUid(uid) {
  return captures.find(c => c.uid === uid);
}

// ─── Recording ────────────────────────────────────────────────────────────────

async function finalizeCapture(capture) {
  captures = captures.filter(c => c !== capture);

  try { await capture.page.close(); } catch (_) {}

  const src = path.join(captureDirectory, capture.filename);
  const dst = config.createModelDirectory
    ? path.join(completeDirectory, capture.model, capture.filename)
    : path.join(completeDirectory, capture.filename);

  await new Promise(resolve => capture.fileStream.end(resolve));

  try {
    const stats = fs.statSync(src);
    if (stats.size <= minFileSize) {
      fs.unlinkSync(src);
      printDebugMsg(`[${capture.model}]`, 'file too small, deleted');
    } else {
      await mvAsync(src, dst, { mkdirp: true });
      printMsg(colors.green(capture.model), `recording saved (${(stats.size / 1048576).toFixed(1)} MB)`);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') printErrorMsg(`[${capture.model}]`, err.toString());
  }
}

async function startRecording({ uid, username, aliasStreamKey }) {
  if (isAlreadyCapturing(username)) return;
  if (captures.length >= config.maxConcurrentRecordings) {
    printDebugMsg('Max concurrent recordings reached, skipping', username);
    return;
  }

  printMsg(colors.green(username), 'is online, starting recording');

  const filename = `${username}_${moment().format(config.dateFormat)}.mp4`;
  const outPath = path.join(captureDirectory, filename);
  const fileStream = fs.createWriteStream(outPath);

  const page = await browser.newPage();

  const capture = {
    uid,
    model: username,
    filename,
    page,
    fileStream,
    lastChunkTime: moment().unix(),
    size: 0,
    checkAfter: moment().unix() + 60,
  };
  captures.push(capture);

  // Intercept Storm WebSocket binary frames → write fMP4 to file
  page.on('websocket', ws => {
    if (!ws.url().includes('storm')) return;
    printDebugMsg(colors.green(username), 'Storm WS:', ws.url());

    ws.on('framereceived', frame => {
      const payload = frame.payload;
      if (typeof payload === 'string') return;
      const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
      fileStream.write(buf);
      capture.lastChunkTime = moment().unix();
      capture.size += buf.length;
    });
  });

  try {
    await page.goto(`https://showup.tv/${encodeURIComponent(username)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    // Dismiss rules overlay so the player starts
    try {
      await page.click('button:has-text("Wchodzę")', { timeout: 2000 });
    } catch (_) {}
  } catch (err) {
    printErrorMsg(`[${username}]`, 'page navigation failed:', err.message);
    await finalizeCapture(capture);
  }
}

// ─── Health check ─────────────────────────────────────────────────────────────

async function checkCapture(capture) {
  if (capture.checkAfter > moment().unix()) return;

  const timeSinceLastChunk = moment().unix() - capture.lastChunkTime;

  if (timeSinceLastChunk > 90) {
    printMsg(colors.green(capture.model), 'stopped streaming (no data)');
    await finalizeCapture(capture);
  } else {
    printDebugMsg(colors.green(capture.model),
      `OK — ${(capture.size >> 10)} KB, last chunk ${timeSinceLastChunk}s ago`);
    capture.checkAfter = moment().unix() + 600;
  }
}

// ─── App WebSocket listener ───────────────────────────────────────────────────

function attachAppWsListener(page) {
  page.on('websocket', ws => {
    if (!ws.url().includes('/app')) return;
    printDebugMsg('App WS connected:', ws.url());

    ws.on('framereceived', frame => {
      if (typeof frame.payload !== 'string') return;
      let msg;
      try { msg = JSON.parse(frame.payload); } catch (_) { return; }

      const { packetType, homeListElement, hostUid } = msg;
      const host = homeListElement?.host;
      const broadcast = homeListElement?.broadcast;

      if (packetType === 'PUB_BROADCAST_STARTED') {
        if (host?.gender !== 'FEMALE') return;
        const entry = { uid: host.id, username: host.username, aliasStreamKey: broadcast?.aliasStreamKey || null };
        onlineFemales.set(host.id, entry);
        printDebugMsg(colors.green(host.username), 'started broadcasting');

        if (!isAlreadyCapturing(host.username)) {
          startRecording(entry).catch(e => printErrorMsg(`[${host.username}]`, e.message));
        }

      } else if (packetType === 'PUB_BROADCAST_FINISHED') {
        const existing = [...onlineFemales.values()].find(m => m.uid === hostUid);
        if (existing) {
          printDebugMsg(colors.green(existing.username), 'finished broadcasting');
          onlineFemales.delete(hostUid);
        }
        // Note: finalizeCapture happens via health check (90s no data) or we detect here
        const cap = getCaptureByUid(hostUid);
        if (cap) {
          // Give 10s grace period in case of brief reconnect
          setTimeout(() => {
            const stillCapturing = getCaptureByUid(hostUid);
            if (stillCapturing && moment().unix() - stillCapturing.lastChunkTime > 15) {
              printMsg(colors.green(stillCapturing.model), 'finished (FINISHED event)');
              finalizeCapture(stillCapturing).catch(() => {});
            }
          }, 10000);
        }

      } else if (packetType === 'PUB_BROADCAST_UPDATED') {
        if (host?.gender !== 'FEMALE') return;
        // Keep track of all online females (aliasStreamKey may be null)
        const existing = onlineFemales.get(host.id);
        onlineFemales.set(host.id, {
          uid: host.id,
          username: host.username,
          aliasStreamKey: broadcast?.aliasStreamKey || existing?.aliasStreamKey || null,
        });
      }
    });
  });
}

// ─── Browser management ───────────────────────────────────────────────────────

async function ensureBrowser() {
  if (!browser || !browser.isConnected()) {
    printMsg('Relaunching browser...');
    browser = await chromium.launch({ headless: true });
    mainPage = null;
  }
  if (!mainPage || mainPage.isClosed()) {
    mainPage = await browser.newPage();
    attachAppWsListener(mainPage);
    await refreshMainPage();
  }
}

async function refreshMainPage() {
  try {
    await mainPage.goto('https://showup.tv', { waitUntil: 'domcontentloaded', timeout: 45000 });
    try {
      await mainPage.click('button:has-text("Wchodzę")', { timeout: 2000 });
      await mainPage.waitForTimeout(800);
    } catch (_) {}

    const data = parseNextData(await mainPage.content());
    if (data?.buildId) nextBuildId = data.buildId;

    // Seed onlineFemales from the SSR featured list (these have aliasStreamKey)
    const list = data?.props?.pageProps?.homeListData?.list || [];
    for (const item of list) {
      if (item.host?.gender === 'FEMALE') {
        onlineFemales.set(item.host.id, {
          uid: item.host.id,
          username: item.host.username,
          aliasStreamKey: item.broadcast?.aliasStreamKey || null,
        });
      }
    }
    printDebugMsg(`Main page loaded. Featured females: ${list.filter(i => i.host?.gender === 'FEMALE').length}`);
  } catch (err) {
    printErrorMsg('Failed to load main page:', err.message);
  }
}

// ─── Check model page for aliasStreamKey ──────────────────────────────────────

async function fetchAliasKey(username) {
  const page = await browser.newPage();
  try {
    await page.goto(`https://showup.tv/${encodeURIComponent(username)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
    const data = parseNextData(await page.content());
    if (data?.buildId) nextBuildId = data.buildId;
    const bd = data?.props?.pageProps?.broadcastData;
    if (bd?.broadcast?.loadBehaviour === 'ONLINE') {
      return bd.broadcast.aliasStreamKey || null;
    }
    return null; // offline
  } catch (_) {
    return null;
  } finally {
    await page.close();
  }
}

// ─── Main loop (periodic full scan) ───────────────────────────────────────────

async function mainLoop() {
  printDebugMsg(`Periodic scan. Capturing: ${captures.length}`);

  await ensureBrowser();

  // Reset list each scan — prevents infinite accumulation of stale entries
  onlineFemales.clear();
  await refreshMainPage();

  // Wait for WS burst after page reload
  printMsg('Collecting online model list from app WS (10s)...');
  await new Promise(r => setTimeout(r, 10000));
  printDebugMsg(`Online females after WS burst: ${onlineFemales.size}`);

  // Find females we know are online but aren't recording yet
  const toRecord = [...onlineFemales.values()].filter(m => !isAlreadyCapturing(m.username));

  // For those with aliasStreamKey: start immediately
  // For those without: fetch profile page first (batches of 5)
  const withKey = toRecord.filter(m => m.aliasStreamKey);
  const withoutKey = toRecord.filter(m => !m.aliasStreamKey);

  // Start recordings for those with keys
  for (const m of withKey) {
    if (!isAlreadyCapturing(m.username) && captures.length < config.maxConcurrentRecordings) {
      await startRecording(m).catch(e => printErrorMsg(`[${m.username}]`, e.message));
    }
  }

  // Fetch profile pages in batches for those without keys
  const BATCH = 5;
  for (let i = 0; i < withoutKey.length; i += BATCH) {
    const batch = withoutKey.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async m => {
        const key = await fetchAliasKey(m.username);
        if (key) {
          // Update stored entry
          const stored = onlineFemales.get(m.uid);
          if (stored) stored.aliasStreamKey = key;
          return { ...m, aliasStreamKey: key };
        }
        return null; // offline or no key
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        const m = result.value;
        if (!isAlreadyCapturing(m.username) && captures.length < config.maxConcurrentRecordings) {
          await startRecording(m).catch(e => printErrorMsg(`[${m.username}]`, e.message));
        }
      }
    }
  }

  // Health-check running captures
  await Promise.allSettled(captures.map(checkCapture));

  if (config.debug) {
    captures.forEach(c => {
      printDebugMsg(
        colors.grey(c.model.padEnd(20)),
        colors.grey(`${(c.size >> 10)} KB`),
        colors.grey(`last: ${moment().unix() - c.lastChunkTime}s ago`)
      );
    });
  }

  printMsg(`Capturing ${captures.length} model(s). Next scan in ${config.modelScanInterval}s.`);
  setTimeout(mainLoop, config.modelScanInterval * 1000);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main() {
  await mkdirp(captureDirectory);
  await mkdirp(completeDirectory);

  printMsg('Launching stealth browser...');
  browser = await chromium.launch({ headless: true });
  mainPage = await browser.newPage();
  attachAppWsListener(mainPage);
  await refreshMainPage();
  printMsg('Browser ready. Starting scan loop...');

  await mainLoop();
}

process.on('SIGINT', async () => {
  printMsg(`Stopping — finalizing ${captures.length} recording(s)...`);
  await Promise.allSettled(captures.map(finalizeCapture));
  process.exit(0);
});

main().catch(err => {
  printErrorMsg(err.toString());
  process.exit(1);
});
