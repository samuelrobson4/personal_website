import { writeFileSync } from 'fs';
import { resolve } from 'path';
import https from 'https';
import { XMLParser } from 'fast-xml-parser';

const FEED = 'https://newthoughts.substack.com/feed';

function fetch(url) {
  return new Promise((resolveP, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolveP({ status: res.statusCode, body: data }));
      })
      .on('error', reject);
  });
}

async function run() {
  try {
    const res = await fetch(FEED);
    if (res.status !== 200) throw new Error('Failed to fetch feed: ' + res.status);
    const parser = new XMLParser({ ignoreAttributes: false });
    const json = parser.parse(res.body);
    const items = json.rss?.channel?.item || [];
    const posts = items.slice(0, 20).map((it) => ({
      id: it.guid?.['#text'] || it.link,
      title: it.title,
      url: it.link,
      date: it.pubDate,
      excerpt: (it.description || '').replace(/<[^>]+>/g, '').slice(0, 180)
    }));
    const out = resolve(process.cwd(), 'dist', 'substack.json');
    writeFileSync(out, JSON.stringify(posts, null, 2));
    console.log('Saved Substack feed to', out, '(' + posts.length + ' posts)');
  } catch (e) {
    console.warn('Substack sync skipped:', e.message);
  }
}

run();


