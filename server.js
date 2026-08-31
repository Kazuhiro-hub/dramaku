require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_IMG_URL = process.env.TMDB_IMG_URL || 'https://image.tmdb.org/t/p/w500';
const NOICE_API_BASE = 'http://localhost:8080';
const VIDSRC_BASE_URL = (process.env.VIDSRC_BASE_URL || 'https://vidsrcme.ru').replace(/\/+$/, '');
const EMBED_SANDBOX = process.env.EMBED_SANDBOX === 'true';

function vidsrcUrl(domain, tmdbId) {
    return `https://${domain}/embed/movie?tmdb=${encodeURIComponent(tmdbId)}`;
}

const EMBED_PROVIDERS = {
    vidsrc: {
        label: 'vidsrcme.ru',
        url: tmdbId => `${VIDSRC_BASE_URL}/embed/movie?tmdb=${encodeURIComponent(tmdbId)}`
    },
    vidsrcme_su: {
        label: 'vidsrcme.su',
        url: tmdbId => vidsrcUrl('vidsrcme.su', tmdbId)
    },
    vidsrc_me_ru: {
        label: 'vidsrc-me.ru',
        url: tmdbId => vidsrcUrl('vidsrc-me.ru', tmdbId)
    },
    vidsrc_embed_ru: {
        label: 'vidsrc-embed.ru',
        url: tmdbId => vidsrcUrl('vidsrc-embed.ru', tmdbId)
    },
    vidsrc_embed_su: {
        label: 'vidsrc-embed.su',
        url: tmdbId => vidsrcUrl('vidsrc-embed.su', tmdbId)
    },
    vsrc_su: {
        label: 'vsrc.su',
        url: tmdbId => vidsrcUrl('vsrc.su', tmdbId)
    },
    vidsrc2_ru: {
        label: 'vidsrc2.ru',
        url: tmdbId => vidsrcUrl('vidsrc2.ru', tmdbId)
    }
};

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

function sendIndex(req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getEmbedProvider(providerKey) {
    return EMBED_PROVIDERS[providerKey] || EMBED_PROVIDERS.vidsrc;
}

function handleEmbedMovie(req, res) {
    const tmdbId = String(req.params.tmdbId || req.query.tmdbId || '').trim();
    const providerKey = String(req.query.provider || 'vidsrc').toLowerCase();

    if (!/^\d+$/.test(tmdbId)) {
        return res.status(400).send('Invalid TMDB id');
    }

    const provider = getEmbedProvider(providerKey);
    const targetUrl = provider.url(tmdbId);
    const targetOrigin = new URL(targetUrl).origin;
    const sandboxAttr = EMBED_SANDBOX
        ? 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"'
        : '';

    res.set({
        'Cache-Control': 'no-store',
        'Content-Security-Policy': [
            "default-src 'self'",
            `frame-src ${targetOrigin}`,
            "img-src 'self' data:",
            "style-src 'unsafe-inline'",
            "script-src 'unsafe-inline'",
            "connect-src 'none'",
            "base-uri 'none'",
            "form-action 'none'",
            "frame-ancestors 'self'"
        ].join('; '),
        'Referrer-Policy': 'origin-when-cross-origin'
    });

    res.type('html').send(`<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(provider.label)} Player</title>
    <style>
        html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
        iframe { width: 100%; height: 100%; border: 0; background: #000; }
    </style>
</head>
<body>
    <iframe
        src="${escapeHtml(targetUrl)}"
        title="${escapeHtml(provider.label)}"
        ${sandboxAttr}
        referrerpolicy="origin-when-cross-origin"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowfullscreen>
    </iframe>
</body>
</html>`);
}

app.get('/embed/movie/:tmdbId', handleEmbedMovie);
app.get('/api/embed/movie/:tmdbId', handleEmbedMovie);
app.get('/api/embed/movie', handleEmbedMovie);

async function handleTmdbProxy(req, res) {
    if (!TMDB_API_KEY) {
        return res.status(500).json({ error: 'TMDB API key not configured' });
    }

    const tmdbPathParam = req.params.tmdbPath || req.query.path;
    const tmdbPath = Array.isArray(tmdbPathParam) ? tmdbPathParam.join('/') : String(tmdbPathParam || '');

    if (!/^[\w/-]+$/.test(tmdbPath) || tmdbPath.includes('..')) {
        return res.status(400).json({ error: 'Invalid TMDB path' });
    }

    const query = new URLSearchParams(req.query);
    query.delete('path');
    query.delete('tmdbPath');
    query.set('api_key', TMDB_API_KEY);

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/${tmdbPath}?${query.toString()}`);
        res.json(response.data);
    } catch (error) {
        console.error('TMDB proxy error:', error.message);
        res.status(500).json({ error: 'TMDB proxy error' });
    }
}

app.get('/api/tmdb', handleTmdbProxy);
app.get('/api/tmdb/*tmdbPath', handleTmdbProxy);

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
