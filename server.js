require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_IMG_URL = process.env.TMDB_IMG_URL || 'https://image.tmdb.org/t/p/w500';
const NOICE_API_BASE = 'http://localhost:8080';
const VIDEO_SOURCE_API_URL = process.env.VIDEO_SOURCE_API_URL || '';
const VIDEO_SOURCE_MANIFEST = process.env.VIDEO_SOURCE_MANIFEST || '';
const VIDEO_SOURCE_MANIFEST_PATH = process.env.VIDEO_SOURCE_MANIFEST_PATH
    ? path.resolve(process.env.VIDEO_SOURCE_MANIFEST_PATH)
    : path.join(__dirname, 'video-sources.json');

app.use(cors());
app.use('/vendor/hls.js', express.static(path.join(__dirname, 'node_modules', 'hls.js', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

function sendIndex(req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
}

function isHttpUrl(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

function inferSourceType(source) {
    const explicitType = String(source.type || '').toLowerCase();
    if (['hls', 'mp4', 'webm'].includes(explicitType)) return explicitType;

    try {
        const pathname = new URL(source.url).pathname.toLowerCase();
        if (pathname.endsWith('.m3u8')) return 'hls';
        if (pathname.endsWith('.webm')) return 'webm';
    } catch (error) {}

    return 'mp4';
}

function normalizeSubtitle(track) {
    if (!track || !isHttpUrl(track.url)) return null;

    return {
        label: track.label || track.srclang || 'Subtitle',
        srclang: track.srclang || 'id',
        url: track.url,
        default: Boolean(track.default)
    };
}

function normalizeVideoSource(source, index) {
    if (!source || !isHttpUrl(source.url)) return null;

    const type = inferSourceType(source);
    const subtitles = Array.isArray(source.subtitles)
        ? source.subtitles.map(normalizeSubtitle).filter(Boolean)
        : [];

    return {
        id: source.id || `source-${index + 1}`,
        label: source.label || source.quality || `Server ${index + 1}`,
        type,
        mimeType: source.mimeType || (type === 'hls' ? 'application/vnd.apple.mpegurl' : `video/${type}`),
        url: source.url,
        subtitles
    };
}

function loadVideoSourceManifest() {
    let rawManifest = VIDEO_SOURCE_MANIFEST.trim();

    if (!rawManifest) {
        try {
            if (!fs.existsSync(VIDEO_SOURCE_MANIFEST_PATH)) return {};
            rawManifest = fs.readFileSync(VIDEO_SOURCE_MANIFEST_PATH, 'utf8');
        } catch (error) {
            console.error('Video source manifest read error:', error.message);
            return {};
        }
    }

    try {
        return JSON.parse(rawManifest);
    } catch (error) {
        console.error('Video source manifest parse error:', error.message);
        return {};
    }
}

function getManifestMovieSources(tmdbId) {
    const manifest = loadVideoSourceManifest();
    const movieMap = manifest.movies || manifest.movie || {};
    const movieEntry = movieMap[String(tmdbId)];
    const sources = Array.isArray(movieEntry)
        ? movieEntry
        : Array.isArray(movieEntry?.sources)
            ? movieEntry.sources
            : [];

    return sources.map(normalizeVideoSource).filter(Boolean);
}

async function getRemoteMovieSources(tmdbId) {
    if (!VIDEO_SOURCE_API_URL) return [];

    const baseUrl = VIDEO_SOURCE_API_URL.replace(/\/+$/, '');
    const endpoint = VIDEO_SOURCE_API_URL.includes('{tmdbId}')
        ? VIDEO_SOURCE_API_URL.replaceAll('{tmdbId}', encodeURIComponent(tmdbId))
        : `${baseUrl}/movie/${encodeURIComponent(tmdbId)}`;

    try {
        const response = await axios.get(endpoint, { timeout: 8000 });
        const payloadSources = Array.isArray(response.data)
            ? response.data
            : Array.isArray(response.data?.sources)
                ? response.data.sources
                : [];

        return payloadSources.map(normalizeVideoSource).filter(Boolean);
    } catch (error) {
        console.error('Video source API error:', error.message);
        return [];
    }
}

app.get('/api/sources/movie/:tmdbId', async (req, res) => {
    const tmdbId = req.params.tmdbId;
    const remoteSources = await getRemoteMovieSources(tmdbId);
    const sources = remoteSources.length ? remoteSources : getManifestMovieSources(tmdbId);

    res.set('Cache-Control', 'no-store');

    if (!sources.length) {
        return res.status(404).json({
            error: 'Belum ada source video legal untuk film ini.',
            sources: []
        });
    }

    res.json({ tmdbId, sources });
});

app.get('/api/tmdb/*tmdbPath', async (req, res) => {
    if (!TMDB_API_KEY) {
        return res.status(500).json({ error: 'TMDB API key not configured' });
    }

    const tmdbPathParam = req.params.tmdbPath;
    const tmdbPath = Array.isArray(tmdbPathParam) ? tmdbPathParam.join('/') : tmdbPathParam;
    const query = new URLSearchParams(req.query);
    query.set('api_key', TMDB_API_KEY);

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/${tmdbPath}?${query.toString()}`);
        res.json(response.data);
    } catch (error) {
        console.error('TMDB proxy error:', error.message);
        res.status(500).json({ error: 'TMDB proxy error' });
    }
});

app.get('/', sendIndex);
app.get('/index.html', sendIndex);

app.get('/api/sounds', async (req, res) => {
    try {
        const response = await axios.get(`${NOICE_API_BASE}/v1/sounds`);
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching sounds dari TryNoice API:', error.message);
        res.json([
            { id: "ambient-rain", title: "Hujan Deras", stream_url: "/api/stream/ambient-rain" },
            { id: "campfire", title: "Api Unggun", stream_url: "/api/stream/campfire" }
        ]);
    }
});
app.get('/api/stream/:trackId', async (req, res) => {
    const trackId = req.params.trackId;
    try {
        const targetUrl = `${NOICE_API_BASE}/v1/sounds/${trackId}/file`;
        
        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'stream'
        });
        
        res.set('Content-Type', response.headers['content-type'] || 'audio/mpeg');
        res.set('Accept-Ranges', 'bytes');
        response.data.pipe(res);
    } catch (error) {
        console.error(`Error mengambil track ${trackId}:`, error.message);
        res.status(500).json({ error: 'Gagal memuat stream audio dari server utama.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server Proxy berjalan di http://localhost:${PORT}`);
    console.log(`Akses Web Player: http://localhost:${PORT}/ atau http://localhost:${PORT}/index.html`);
});
