'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getBrowser } = require('./ahmia');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const META_FILE = path.join(SCREENSHOTS_DIR, 'metadata.json');

function ensureDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(META_FILE)) {
    fs.writeFileSync(META_FILE, JSON.stringify([]));
  }
}

function getUrlHash(url) {
  return crypto.createHash('sha256').update(url.trim()).digest('hex').slice(0, 16);
}

function getMetadata() {
  ensureDir();
  try {
    const raw = fs.readFileSync(META_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

function saveMetadata(list) {
  ensureDir();
  fs.writeFileSync(META_FILE, JSON.stringify(list, null, 2), 'utf8');
}

/**
 * captureScreenshot(url, options)
 * Captures a visual snapshot of an .onion service using Playwright Chromium over Tor.
 *
 * @param {string} url
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<{ success: boolean, screenshotUrl?: string, title?: string, error?: string }>}
 */
async function captureScreenshot(url, options = {}) {
  ensureDir();
  const timeoutMs = (options.timeout ?? 30) * 1000;
  const hash = getUrlHash(url);
  const filename = `onion_${hash}.jpg`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  let browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    return { success: false, url, error: `Browser error: ${err.message}` };
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
    ignoreHTTPSErrors: true,
  });

  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    // allow brief render window
    await page.waitForTimeout(800).catch(() => {});

    await page.screenshot({
      path: filepath,
      type: 'jpeg',
      quality: 75,
      fullPage: false,
    });

    const pageTitle = (await page.title().catch(() => '')) || url;
    const httpStatus = res ? res.status() : 200;

    const item = {
      id: hash,
      url,
      title: pageTitle.trim() || 'Untitled Hidden Service',
      status: httpStatus,
      filename,
      screenshotUrl: `/screenshots/${filename}`,
      capturedAt: new Date().toISOString(),
    };

    // Store in metadata file
    const list = getMetadata().filter(m => m.url !== url && m.id !== hash);
    list.unshift(item);
    saveMetadata(list);

    return {
      success: true,
      ...item,
    };
  } catch (err) {
    return {
      success: false,
      url,
      error: err.message,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

function listScreenshots() {
  return getMetadata();
}

function deleteScreenshot(id) {
  const list = getMetadata();
  const item = list.find(m => m.id === id || m.filename === id);
  if (item) {
    const filepath = path.join(SCREENSHOTS_DIR, item.filename);
    if (fs.existsSync(filepath)) {
      try { fs.unlinkSync(filepath); } catch (_) {}
    }
    const updated = list.filter(m => m.id !== item.id);
    saveMetadata(updated);
    return true;
  }
  return false;
}

module.exports = {
  captureScreenshot,
  listScreenshots,
  deleteScreenshot,
  getUrlHash,
  SCREENSHOTS_DIR,
};
