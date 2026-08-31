require('dotenv').config();
const axios = require('axios');

const TMDB_BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

module.exports = async function handler(req, res) {
    if (!TMDB_API_KEY) {
        return res.status(500).json({ error: 'TMDB API key not configured' });
    }

    const tmdbPath = String(req.query.path || '').replace(/^\/+/, '');
    if (!/^[\w/-]+$/.test(tmdbPath) || tmdbPath.includes('..')) {
        return res.status(400).json({ error: 'Invalid TMDB path' });
    }

    const query = new URLSearchParams();
    Object.entries(req.query).forEach(([key, value]) => {
        if (key === 'path') return;
        if (Array.isArray(value)) {
            value.forEach(item => query.append(key, item));
        } else if (value !== undefined) {
            query.set(key, value);
        }
    });
    query.set('api_key', TMDB_API_KEY);

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/${tmdbPath}?${query.toString()}`);
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
        res.status(200).json(response.data);
    } catch (error) {
        console.error('TMDB proxy error:', error.message);
        res.status(500).json({ error: 'TMDB proxy error' });
    }
};
