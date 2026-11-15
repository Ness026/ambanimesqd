const fs = require('fs');

function formatViews(num) {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

async function updateTikTokStats() {
  const urls = [
    'https://vt.tiktok.com/ZS9fbh8UC5DnS-LqdZ5/',
    'https://www.tiktok.com/tag/ambanimesqd'
  ];

  const oldData = JSON.parse(fs.readFileSync('stats.json', 'utf8'));
  let rawViews = oldData.rawViews || 74200000;
  let rawPosts = oldData.rawPosts || 1155;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8'
        }
      });

      const html = await res.text();
      const viewMatch = html.match(/"viewCount"\s*:\s*"?(\d+)"?/);
      const postMatch = html.match(/"videoCount"\s*:\s*"?(\d+)"?/);

      if (viewMatch && parseInt(viewMatch[1], 10) > 0) rawViews = parseInt(viewMatch[1], 10);
      if (postMatch && parseInt(postMatch[1], 10) > 0) rawPosts = parseInt(postMatch[1], 10);
      if (viewMatch && postMatch) break;
    } catch (err) {
      console.error('Mencoba jalur cadangan...', err.message);
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
  console.log('Berhasil sinkronisasi:', newData);
}

updateTikTokStats();