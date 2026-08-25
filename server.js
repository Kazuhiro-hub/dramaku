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
const UPSTREAM_TIMEOUT = Number(process.env.UPSTREAM_TIMEOUT || 15000);

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/tmdb/*', async (req, res) => {
    if (!TMDB_API_KEY) return res.status(500).json({ error: 'TMDB API key not configured' });
    const tmdbPath = req.params[0];
    const query = new URLSearchParams(req.query);
    query.set('api_key', TMDB_API_KEY);
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/${tmdbPath}?${query.toString()}`, { timeout: UPSTREAM_TIMEOUT });
        res.json(response.data);
    } catch (error) {
        console.error('TMDB proxy error:', error.code || error.message);
        const status = error.code === 'ECONNABORTED' ? 504 : 502;
        res.status(status).json({ error: 'TMDB upstream request failed', timeout: error.code === 'ECONNABORTED' });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/sounds', async (req, res) => {
    try {
        const response = await axios.get(`${NOICE_API_BASE}/v1/sounds`, { timeout: UPSTREAM_TIMEOUT });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching sounds dari TryNoice API:', error.message);
        res.json([
            { id: 'ambient-rain', title: 'Hujan Deras', stream_url: '/api/stream/ambient-rain' },
            { id: 'campfire', title: 'Api Unggun', stream_url: '/api/stream/campfire' }
        ]);
    }
});

app.get('/api/stream/:trackId', async (req, res) => {
    try {
        const response = await axios({ method: 'get', url: `${NOICE_API_BASE}/v1/sounds/${req.params.trackId}/file`, responseType: 'stream', timeout: UPSTREAM_TIMEOUT });
        res.set('Content-Type', response.headers['content-type'] || 'audio/mpeg');
        res.set('Accept-Ranges', 'bytes');
        response.data.pipe(res);
    } catch (error) {
        console.error(`Error mengambil track ${req.params.trackId}:`, error.code || error.message);
        if (!res.headersSent) res.status(502).json({ error: 'Gagal memuat stream audio dari server utama.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server Proxy berjalan di http://localhost:${PORT}`);
    console.log(`Akses Web Player: http://localhost:${PORT}/index.html`);
});
