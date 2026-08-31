require('dotenv').config();

const VIDSRC_BASE_URL = (process.env.VIDSRC_BASE_URL || 'https://vidsrc.me').replace(/\/+$/, '');

const EMBED_PROVIDERS = {
    vidsrc: {
        label: 'VidSrc',
        url: tmdbId => `${VIDSRC_BASE_URL}/embed/movie?tmdb=${encodeURIComponent(tmdbId)}`
    },
    embedsu: {
        label: 'EmbedSU',
        url: tmdbId => `https://embed.su/embed/movie/${encodeURIComponent(tmdbId)}`
    },
    vidsrcpro: {
        label: 'VidSrc Pro',
        url: tmdbId => `https://vidsrc.pro/embed/movie/${encodeURIComponent(tmdbId)}`
    }
};

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

module.exports = function handler(req, res) {
    const tmdbId = String(req.query.tmdbId || '').trim();
    const providerKey = String(req.query.provider || 'vidsrc').toLowerCase();

    if (!/^\d+$/.test(tmdbId)) {
        return res.status(400).send('Invalid TMDB id');
    }

    const provider = getEmbedProvider(providerKey);
    const targetUrl = provider.url(tmdbId);
    const targetOrigin = new URL(targetUrl).origin;

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        `frame-src ${targetOrigin}`,
        "img-src 'self' data:",
        "style-src 'unsafe-inline'",
        "script-src 'unsafe-inline'",
        "connect-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'self'"
    ].join('; '));
    res.setHeader('Referrer-Policy', 'origin-when-cross-origin');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    res.status(200).send(`<!doctype html>
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
        sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
        referrerpolicy="origin-when-cross-origin"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowfullscreen>
    </iframe>
</body>
</html>`);
};
