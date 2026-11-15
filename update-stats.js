const fs = require('fs');

function formatViews(num) {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

function parseShorthand(str) {
  const clean = str.toUpperCase().replace(/,/g, '').trim();
  const num = parseFloat(clean);
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

  // Daftar User-Agent khusus (Bot & App) agar TikTok memunculkan viewCount asli
  const targets = [
    {
      url: 'https://www.tiktok.com/api/challenge/detail/?challengeName=ambanimesqd',
      ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    },
    {
      url: 'https://www.tiktok.com/tag/ambanimesqd',
      ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
    },
    {
      url: 'https://www.tiktok.com/tag/ambanimesqd',
      ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
    }
  ];

  for (const t of targets) {
    try {
      const res = await fetch(t.url, {
        redirect: 'follow',
        headers: {
          'User-Agent': t.ua,
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      const text = await res.text();

      // 1. Cari dari JSON API / Script Internal TikTok (viewCount / viewCountStr)
      const vMatches = [...text.matchAll(/"viewCount(?:Str)?"\s*:\s*"?(\d+)"?/g)];
      for (const m of vMatches) {
        const val = parseInt(m[1], 10);
        if (val > 1000000) foundViews = Math.max(foundViews, val);
      }

      // 2. Cari dari Meta Deskripsi Bot (contoh: "74.4M views")
      const metaViewMatch = text.match(/([\d.]+[KMB])\s*(?:views|tayangan|penayangan)/i);
      if (metaViewMatch && foundViews === 0) {
        foundViews = parseShorthand(metaViewMatch[1]);
      }

      // 3. Cari jumlah postingan (videoCount / postCount)
      const pMatches = [...text.matchAll(/"(?:videoCount|postCount|publishCnt)"\s*:\s*"?(\d+)"?/g)];
      for (const m of pMatches) {
        const val = parseInt(m[1], 10);
        if (val > 100) foundPosts = Math.max(foundPosts, val);
      }

      if (foundViews > 0 && foundPosts > 0) break;
    } catch (e) {
      console.error('Mencoba jalur berikutnya...', e.message);
    }
  }

  if (foundPosts > 0) rawPosts = foundPosts;

  if (foundViews > 0) {
    rawViews = foundViews;
    console.log('Berhasil menarik Views asli dari TikTok:', rawViews);
  } else {
    console.log('TikTok menyembunyikan viewCount di jalur web, menghitung estimasi proporsional...');
    // Jika suatu saat API TikTok dikunci, views otomatis ikut naik proporsional setiap ada postingan baru
    if (rawPosts > (oldData.rawPosts || 1160)) {
      const selisihPost = rawPosts - (oldData.rawPosts || 1160);
      rawViews = Math.max(rawViews, 74400000) + (selisihPost * 64000);
    } else {
      rawViews = Math.max(rawViews, 74400000);
    }
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
  console.log('Hasil Sinkronisasi:', newData);
}

updateTikTokStats();