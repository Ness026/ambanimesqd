const fs = require('fs');
const { chromium } = require('playwright');

function formatViews(num) {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

function parseShorthand(str) {
  const clean = str.toUpperCase().replace(/,/g, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  if (clean.endsWith('B')) return Math.round(num * 1_000_000_000);
  if (clean.endsWith('M')) return Math.round(num * 1_000_000);
  if (clean.endsWith('K')) return Math.round(num * 1_000);
  return Math.round(num);
}

async function updateTikTokStats() {
  const oldData = JSON.parse(fs.readFileSync('stats.json', 'utf8'));
  let rawViews = oldData.rawViews || 74400000;
  let rawPosts = oldData.rawPosts || 1160;

  let foundViews = 0;
  let foundPosts = 0;

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1366, height: 768 }
    });

    const page = await context.newPage();

    // Tangkap data API internal TikTok jika termuat di balik layar
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('challenge/detail') || url.includes('challenge/item_list')) {
        try {
          const json = await response.json();
          const stats = json?.challengeInfo?.stats || json?.challengeInfo?.statsV2;
          if (stats) {
            const v = parseInt(stats.viewCount, 10);
            const p = parseInt(stats.videoCount, 10);
            if (v > 0) foundViews = Math.max(foundViews, v);
            if (p > 0) foundPosts = Math.max(foundPosts, p);
          }
        } catch (_) {}
      }
    });

    await page.goto('https://www.tiktok.com/tag/ambanimesqd', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    // Tunggu JavaScript TikTok selesai memuat data halaman
    await page.waitForTimeout(6000);

    const title = await page.title();
    console.log('Judul halaman TikTok:', title);

    // 1. Cek JSON internal __UNIVERSAL_DATA_FOR_REHYDRATION__
    const rehydrationData = await page.evaluate(() => {
      const el = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
      return el ? el.textContent : '';
    });

    if (rehydrationData) {
      const vMatches = [...rehydrationData.matchAll(/"viewCount"\s*:\s*"?(\d+)"?/g)];
      for (const m of vMatches) {
        const val = parseInt(m[1], 10);
        if (val > 1000000) foundViews = Math.max(foundViews, val);
      }

      const pMatches = [...rehydrationData.matchAll(/"videoCount"\s*:\s*"?(\d+)"?/g)];
      for (const m of pMatches) {
        const val = parseInt(m[1], 10);
        if (val > 100) foundPosts = Math.max(foundPosts, val);
      }
    }

    // 2. Cek teks langsung yang tampil di layar browser
    const bodyText = await page.evaluate(() => document.body.innerText || '');
    if (foundViews === 0) {
      const vText = bodyText.match(/([\d.,]+[KMB]?)\s*(?:views|tayangan|penayangan)/i);
      if (vText) foundViews = parseShorthand(vText[1]);
    }
    if (foundPosts === 0) {
      const pText = bodyText.match(/([\d.,]+[KMB]?)\s*(?:posts|videos|postingan|video)/i);
      if (pText) foundPosts = parseShorthand(pText[1]);
    }

    console.log('Data terbaca -> Posts:', foundPosts, '| Views:', foundViews);
  } catch (err) {
    console.error('Error saat membuka TikTok:', err.message);
  } finally {
    await browser.close();
  }

  if (foundPosts > 0) {
    const selisihPost = foundPosts - rawPosts;
    rawPosts = foundPosts;
    // Jika views asli terbaca, pakai views asli; jika disembunyikan TikTok web, naikkan proporsional
    if (foundViews > 0) {
      rawViews = foundViews;
    } else if (selisihPost > 0) {
      rawViews = rawViews + (selisihPost * 64000);
    }
  } else if (foundViews > 0) {
    rawViews = foundViews;
  } else {
    console.warn('PERINGATAN: TikTok memblokir akses atau memunculkan CAPTCHA di server ini.');
  }

  const newData = {
    hashtag: '#ambanimesqd',
    formattedViews: formatViews(rawViews),
    formattedPosts: rawPosts.toString(),
    rawViews: rawViews,
    rawPosts: rawPosts,
    lastUpdated: new Date().toISOString()
  };

  fs.writeFileSync('stats.json', JSON.stringify(newData, null, 2));
  console.log('Hasil akhir stats.json:', newData);
}

updateTikTokStats();