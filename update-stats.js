const fs = require('fs');

function formatViews(num) {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

async function updateTikTokStats() {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error('RAPIDAPI_KEY belum terpasang di GitHub Secrets!');
  }

  const oldData = JSON.parse(fs.readFileSync('stats.json', 'utf8'));
  let rawViews = oldData.rawViews || 75312900;
  let rawPosts = oldData.rawPosts || 1180;

  const url = 'https://tiktok-scraper7.p.rapidapi.com/challenge/info?challenge_name=ambanimesqd&challenge_id=7469457277742366725';

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com'
    }
  });

  if (!response.ok) {
    throw new Error(`Request RapidAPI gagal dengan status ${response.status}`);
  }

  const json = await response.json();

  if (json.code === 0 && json.data) {
    const foundViews = Number(json.data.view_count) || 0;
    const foundPosts = Number(json.data.user_count) || 0;

    console.log('Data RapidAPI -> Posts:', foundPosts, '| Views:', foundViews);

    if (foundViews > 0) rawViews = foundViews;
    if (foundPosts > 0) rawPosts = foundPosts;
  } else {
    console.warn('Respon API tidak berisi data valid:', JSON.stringify(json));
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

updateTikTokStats().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});