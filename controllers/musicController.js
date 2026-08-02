const https = require('https');
const http = require('http');

// ─── JioSaavn API Servers (backend has no CORS, can reach these directly)
const SAAVN_SERVERS = [
  'saavn.sumit.co',
  'jiosaavn-api-ashutoshgwarkar.vercel.app',
  'nepotuneapi.vercel.app',
  'saavnapi-nine.vercel.app'
];

// ─── Helper: HTTP/HTTPS GET request returning JSON ─────────────────────────
const fetchJSON = (hostname, path) => {
  return new Promise((resolve, reject) => {
    const isHttps = true;
    const lib = isHttps ? https : http;
    
    const options = {
      hostname,
      path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 8000
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`JSON parse failed: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
};

// ─── JioSaavn Multi-Server Failover ───────────────────────────────────────
const fetchSaavn = async (pathAndQuery) => {
  for (const server of SAAVN_SERVERS) {
    try {
      console.log(`[Music] Trying ${server}${pathAndQuery}`);
      const data = await fetchJSON(server, pathAndQuery);
      if (data && data.success && data.data) {
        console.log(`[Music] Success from ${server}`);
        return data;
      }
    } catch (err) {
      console.warn(`[Music] ${server} failed: ${err.message}`);
    }
  }
  throw new Error('All JioSaavn servers unavailable');
};

// ─── Map Saavn song to clean format ────────────────────────────────────────
const mapSong = (song) => {
  // Extract stream URL - prefer 96kbps for reliable mobile streaming (320kbps can stall)
  let streamUrl = '';
  let rawStreamUrl = ''; // also store the raw CDN URL
  if (song.downloadUrl && Array.isArray(song.downloadUrl)) {
    // Try 96kbps first (most reliable on mobile), then 160, then 48
    const qualities = ['96kbps', '160kbps', '48kbps', '320kbps', '12kbps'];
    for (const q of qualities) {
      const found = song.downloadUrl.find(u => u.quality === q);
      if (found && found.url) { streamUrl = found.url; rawStreamUrl = found.url; break; }
    }
    if (!streamUrl) {
      for (const item of song.downloadUrl) {
        if (item && item.url) { streamUrl = item.url; rawStreamUrl = item.url; break; }
      }
    }
  } else if (typeof song.downloadUrl === 'string' && song.downloadUrl) {
    streamUrl = song.downloadUrl; rawStreamUrl = song.downloadUrl;
  } else if (song.url && typeof song.url === 'string') {
    streamUrl = song.url; rawStreamUrl = song.url;
  }

  // (duplicate block removed)

  // Extract image URL (highest resolution)
  let imageUrl = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop';
  if (song.image && Array.isArray(song.image)) {
    const img500 = song.image.find(i => i.quality === '500x500');
    const img150 = song.image.find(i => i.quality === '150x150');
    imageUrl = img500?.url || img150?.url || song.image[song.image.length - 1]?.url || imageUrl;
  } else if (typeof song.image === 'string') {
    imageUrl = song.image;
  }

  // Extract artist name
  let artist = 'Unknown Artist';
  if (song.artists?.primary?.length > 0) {
    artist = song.artists.primary.map(a => a.name).join(', ');
  } else if (song.primaryArtists) {
    artist = song.primaryArtists;
  } else if (song.artist) {
    artist = song.artist;
  }

  return {
    id: song.id || `song-${Date.now()}`,
    title: song.name || song.title || 'Unknown Song',
    artist,
    album: song.album?.name || song.albumName || '',
    year: song.year || '',
    language: song.language || '',
    duration: song.duration ? parseInt(song.duration) : 180,
    streamUrl,
    rawStreamUrl,   // direct CDN URL (frontend can use as fallback)
    imageUrl,
    source: 'jiosaavn'
  };
};

// ─── Extract results from various response shapes ──────────────────────────
const extractResults = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.results && Array.isArray(data.results)) return data.results;
  if (data.songs?.results && Array.isArray(data.songs.results)) return data.songs.results;
  if (data.songs && Array.isArray(data.songs)) return data.songs;
  return [];
};

// ─── CONTROLLERS ───────────────────────────────────────────────────────────

exports.searchSongs = async (req, res) => {
  const query = req.query.q || req.query.query || '';
  const limit = parseInt(req.query.limit) || 20;

  if (!query.trim()) {
    return res.status(400).json({ success: false, message: 'Query is required' });
  }

  try {
    const path = `/api/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`;
    const data = await fetchSaavn(path);
    const results = extractResults(data.data);
    const songs = results.map(mapSong).filter(s => s.streamUrl);

    res.json({
      success: true,
      count: songs.length,
      query,
      songs
    });
  } catch (err) {
    console.error('[Music] searchSongs error:', err.message);
    res.status(503).json({ success: false, message: 'Music service unavailable', songs: [] });
  }
};

exports.getTrending = async (req, res) => {
  try {
    const queries = ['trending hits 2024', 'top hits India', 'new hindi songs'];
    const allSongs = [];
    
    for (const q of queries.slice(0, 1)) {
      const path = `/api/search/songs?query=${encodeURIComponent(q)}&limit=15`;
      const data = await fetchSaavn(path);
      const results = extractResults(data.data);
      allSongs.push(...results.map(mapSong).filter(s => s.streamUrl));
    }

    res.json({ success: true, songs: allSongs.slice(0, 20) });
  } catch (err) {
    console.error('[Music] getTrending error:', err.message);
    res.status(503).json({ success: false, songs: [] });
  }
};

exports.getLanguageSongs = async (req, res) => {
  const language = req.params.language || req.query.lang || 'Telugu';
  const queries = {
    Telugu: 'Telugu hits 2024',
    Hindi: 'Hindi top songs 2024',
    Tamil: 'Tamil hits 2024',
    English: 'English pop hits 2024',
    Punjabi: 'Punjabi hits 2024',
    Kannada: 'Kannada hits 2024',
    Malayalam: 'Malayalam hits 2024'
  };
  const query = queries[language] || `${language} hits`;

  try {
    const path = `/api/search/songs?query=${encodeURIComponent(query)}&limit=20`;
    const data = await fetchSaavn(path);
    const results = extractResults(data.data);
    const songs = results.map(mapSong).filter(s => s.streamUrl);

    res.json({ success: true, language, songs });
  } catch (err) {
    console.error('[Music] getLanguageSongs error:', err.message);
    res.status(503).json({ success: false, songs: [] });
  }
};

exports.getCategory = async (req, res) => {
  const category = req.params.category || '';
  const categoryQueries = {
    mass: 'Pushpa Allu Arjun Telugu 2024',
    love: 'Tum Hi Ho Arijit Singh romantic',
    melody: 'Samajavaragamana Sid Sriram',
    party: 'Kala Chashma Bollywood dance',
    trending: 'trending India top 2024',
    retro: 'Tum Se Hi Jab We Met retro',
    devotional: 'Jai Shri Ram devotional',
    workout: 'Fitoor workout energy hits',
    chill: 'Teri Baaton Mein chill acoustic',
    sad: 'Tujhe Bhula Diya sad songs'
  };
  const query = categoryQueries[category.toLowerCase()] || `${category} songs`;

  try {
    const path = `/api/search/songs?query=${encodeURIComponent(query)}&limit=30`;
    const data = await fetchSaavn(path);
    const results = extractResults(data.data);
    let songs = results.map(mapSong).filter(s => s.streamUrl);

    // If very few results, try a broader fallback query
    if (songs.length < 5) {
      const fallbackQuery = `${category} songs hits`;
      const fallbackPath = `/api/search/songs?query=${encodeURIComponent(fallbackQuery)}&limit=20`;
      try {
        const fallbackData = await fetchSaavn(fallbackPath);
        const fallbackResults = extractResults(fallbackData.data);
        const fallbackSongs = fallbackResults.map(mapSong).filter(s => s.streamUrl);
        songs = [...songs, ...fallbackSongs].slice(0, 20);
      } catch (e) { /* ignore fallback failures */ }
    }

    res.json({ success: true, category, songs });
  } catch (err) {
    console.error('[Music] getCategory error:', err.message);
    res.status(503).json({ success: false, songs: [] });
  }
};

// ─── Audio Stream Proxy (bypasses CORS on saavncdn.com) ───────────────────
exports.streamAudio = async (req, res) => {
  const audioUrl = req.query.url;
  if (!audioUrl) return res.status(400).json({ error: 'url required' });

  try {
    const decodedUrl = decodeURIComponent(audioUrl);
    
    // Only allow trusted audio CDNs
    const allowed = ['saavncdn.com', 'akamaized.net', 'soundhelix.com', 'mixkit.co', 'freesound.org', 'pixabay.com', 'jiosaavn.com'];
    const urlObj = new URL(decodedUrl);
    const isAllowed = allowed.some(domain => urlObj.hostname.endsWith(domain));
    
    if (!isAllowed) {
      console.warn(`[Stream] Blocked domain: ${urlObj.hostname}`);
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    const doProxy = (targetUrl, redirectCount = 0) => {
      if (redirectCount > 3) {
        if (!res.headersSent) res.status(502).json({ error: 'Too many redirects' });
        return;
      }

      const urlParsed = new URL(targetUrl);
      const protocol = urlParsed.protocol === 'https:' ? https : http;
      
      const reqHeaders = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Mobile) AppleWebKit/537.36 Chrome/96.0.4664.45 Mobile Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/',
        'Accept': 'audio/mpeg, audio/*, */*',
        'Connection': 'keep-alive',
      };
      
      // Forward Range header for seek support
      if (req.headers.range) {
        reqHeaders['Range'] = req.headers.range;
      }

      const proxyReq = protocol.get(targetUrl, { headers: reqHeaders }, (proxyRes) => {
        // Handle redirects (302, 301, 307, 308)
        if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
          console.log(`[Stream] Redirect ${proxyRes.statusCode} → ${proxyRes.headers.location}`);
          proxyRes.resume(); // drain response
          doProxy(proxyRes.headers.location, redirectCount + 1);
          return;
        }

        // Set CORS & streaming headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        
        // Detect correct content-type: saavncdn serves audio/mp4, not audio/mpeg
        const upstreamType = proxyRes.headers['content-type'] || '';
        let contentType = upstreamType;
        if (!contentType || contentType === 'application/octet-stream') {
          // Detect from URL extension
          if (targetUrl.includes('.mp4') || targetUrl.includes('aac.saavncdn')) {
            contentType = 'audio/mp4';
          } else {
            contentType = 'audio/mpeg';
          }
        }
        res.setHeader('Content-Type', contentType);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        if (proxyRes.headers['content-length']) {
          res.setHeader('Content-Length', proxyRes.headers['content-length']);
        }
        if (proxyRes.headers['content-range']) {
          res.setHeader('Content-Range', proxyRes.headers['content-range']);
        }
        
        // Use correct status: 206 for partial/range, 200 otherwise
        const statusCode = proxyRes.statusCode === 206 ? 206 : 200;
        res.status(statusCode);
        
        proxyRes.pipe(res);
        
        proxyRes.on('error', (err) => {
          console.error('[Stream] Proxy response error:', err.message);
        });
      });

      proxyReq.on('error', (err) => {
        console.error('[Stream] Proxy request error:', err.message);
        if (!res.headersSent) res.status(502).json({ error: 'Stream connection error' });
      });
      
      proxyReq.setTimeout(15000, () => {
        proxyReq.destroy();
        if (!res.headersSent) res.status(504).json({ error: 'Stream timeout' });
      });
    };

    doProxy(decodedUrl);
  } catch (err) {
    console.error('[Music Stream] Error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Internal error' });
  }
};

