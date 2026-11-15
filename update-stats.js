const fs = require('fs');

function formatViews(num) {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

async function updateTikTokStats() {
  const url = 'https://www.tiktok.com/tag/ambanimesqd';

  const oldData = JSON.parse(fs.readFileSync('stats.json', 'utf8'));
  // Set nilai default views ke 74.4M agar selalu sinkron dengan aplikasi TikTok
  let rawViews = oldData.rawViews || 74400000;
  let rawPosts = oldData.rawPosts || 1160;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const html = await res.text();

    const viewMatch = html.match(/"viewCount"\s*:\s*"?(\d+)"?/) || html.match(/"stats":\s*\{[^}]*"viewCount":\s*(\d+)/);
    const postMatch = html.match(/"videoCount"\s*:\s*"?(\d+)"?/) || html.match(/"stats":\s*\{[^}]*"videoCount":\s*(\d+)/);

    if (viewMatch && parseInt(viewMatch[1], 10) > 0) {
      rawViews = parseInt(viewMatch[1], 10);
    }
    
    // Memastikan rawPosts otomatis terupdate dari TikTok
    if (postMatch && parseInt(postMatch[1], 10) > 0) {
      rawPosts = parseInt(postMatch[1], 10);
    }

  } catch (err) {
    console.error('Gagal mengambil data otomatis, menggunakan data terakhir:', err.message);
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
  console.log('Berhasil sinkronisasi otomatis:', newData);
}

updateTikTokStats();