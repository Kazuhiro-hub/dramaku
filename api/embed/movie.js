require('dotenv').config();

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
    const requestUrl = new URL(req.url, 'http://localhost');
    const tmdbId = String(requestUrl.searchParams.get('tmdbId') || '').trim();
    const providerKey = String(requestUrl.searchParams.get('provider') || 'vidsrc').toLowerCase();

    if (!/^\d+$/.test(tmdbId)) {
        return res.status(400).send('Invalid TMDB id');
    }

    const provider = getEmbedProvider(providerKey);
    const targetUrl = provider.url(tmdbId);
    const targetOrigin = new URL(targetUrl).origin;
    const sandboxAttr = EMBED_SANDBOX
        ? 'sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"'
        : '';

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
        ${sandboxAttr}
        referrerpolicy="origin-when-cross-origin"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowfullscreen>
    </iframe>
</body>
</html>`);
};
