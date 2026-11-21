const fs = require('fs');
const { chromium } = require('playwright');

function formatViews(num) {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

function parseNumberValue(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Math.round(val);
  const clean = String(val).toUpperCase().replace(/,/g, '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  if (clean.endsWith('B')) return Math.round(num * 1_000_000_000);
  if (clean.endsWith('M')) return Math.round(num * 1_000_000);
  if (clean.endsWith('K')) return Math.round(num * 1_000);
  return Math.round(num);
}

function extractStats(obj) {
  if (!obj || typeof obj !== 'object') return { views: 0, posts: 0 };
  const views = parseNumberValue(obj.viewCount ?? obj.viewCountStr ?? obj.vv);
  const posts = parseNumberValue(obj.videoCount ?? obj.postCount ?? obj.publishCnt ?? obj.itemCount);
  return { views, posts };
}

async function updateTikTokStats() {
  const oldData = JSON.parse(fs.readFileSync('stats.json', 'utf8'));
  let rawViews = oldData.rawViews || 75300000;
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

    // 1. Tangkap respons API internal TikTok jika otomatis terpanggil
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('challenge/detail') || url.includes('challenge/item_list')) {
        try {
          const json = await response.json();
          const info = json?.challengeInfo;
          if (info) {
            const s1 = extractStats(info.stats);
            const s2 = extractStats(info.statsV2);
            foundViews = Math.max(foundViews, s1.views, s2.views);
            foundPosts = Math.max(foundPosts, s1.posts, s2.posts);
          }
        } catch (_) {}
      }
    });

    await page.goto('https://www.tiktok.com/tag/ambanimesqd', {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });

    await page.waitForTimeout(6000);
    console.log('Judul halaman TikTok:', await page.title());

    // 2. Baca JSON internal __UNIVERSAL_DATA_FOR_REHYDRATION__ secara langsung
    const pageInfo = await page.evaluate(() => {
      const result = { stats: null, statsV2: null, metaDesc: '', headerTexts: [] };

      const scriptEl = document.querySelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (scriptEl && scriptEl.textContent) {
        try {
          const data = JSON.parse(scriptEl.textContent);
          const scope = data?.__DEFAULT_SCOPE__ || {};
          const detail = scope['webapp.challenge-detail'] || {};
          const info = detail.challengeInfo || {};
          result.stats = info.stats || null;
          result.statsV2 = info.statsV2 || null;
        } catch (_) {}
      }

      const meta = document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]');
      result.metaDesc = meta ? meta.getAttribute('content') || '' : '';

      result.headerTexts = [...document.querySelectorAll('h1, h2, [data-e2e*="challenge"]')]
        .map(el => el.innerText.trim())
        .filter(Boolean)
        .slice(0, 6);

      return result;
    });

    console.log('Debug stats:', JSON.stringify(pageInfo.stats));
    console.log('Debug statsV2:', JSON.stringify(pageInfo.statsV2));
    console.log('Debug metaDesc:', pageInfo.metaDesc);
    console.log('Debug headerTexts:', JSON.stringify(pageInfo.headerTexts));

    const s1 = extractStats(pageInfo.stats);
    const s2 = extractStats(pageInfo.statsV2);
    foundViews = Math.max(foundViews, s1.views, s2.views);
    foundPosts = Math.max(foundPosts, s1.posts, s2.posts);

    // 3. Jika posts masih 0, tembak API detail TikTok dari dalam sesi browser yang sudah lolos verifikasi
    if (foundPosts === 0) {
      const apiData = await page.evaluate(async () => {
        try {
          const res = await fetch('/api/challenge/detail/?challengeName=ambanimesqd');
          const json = await res.json();
          return {
            stats: json?.challengeInfo?.stats || null,
            statsV2: json?.challengeInfo?.statsV2 || null
          };
        } catch (e) {
          return { error: e.message };
        }
      });

      console.log('Debug API internal:', JSON.stringify(apiData));
      const a1 = extractStats(apiData.stats);
      const a2 = extractStats(apiData.statsV2);
      foundViews = Math.max(foundViews, a1.views, a2.views);
      foundPosts = Math.max(foundPosts, a1.posts, a2.posts);
    }

    // 4. Fallback baca dari teks halaman & meta deskripsi
    const combinedText = `${pageInfo.metaDesc} ${pageInfo.headerTexts.join(' ')}`;
    if (foundViews === 0) {
      const vMatch = combinedText.match(/([\d.,]+\s*[KMB]?)\s*(?:views|tayangan|penayangan)/i);
      if (vMatch) foundViews = parseNumberValue(vMatch[1]);
    }
    if (foundPosts === 0) {
      const pMatch = combinedText.match(/([\d.,]+\s*[KMB]?)\s*(?:posts|videos|postingan|video)/i);
      if (pMatch) foundPosts = parseNumberValue(pMatch[1]);
    }

    console.log('Data terbaca -> Posts:', foundPosts, '| Views:', foundViews);
  } catch (err) {
    console.error('Error saat membuka TikTok:', err.message);
  } finally {
    await browser.close();
  }

  if (foundViews > 0) rawViews = foundViews;
  if (foundPosts > 0) rawPosts = foundPosts;

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