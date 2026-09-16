// Login della dashboard: verifica la password e apre la sessione.
import { config, createSession, sessionCookie, clearedCookie, isValidSession } from './_lib.mjs';

export default function handler(req, res) {
    const { password, token } = config();

    if (req.method === 'GET') {
        // Serve alla pagina per sapere se è già autenticata.
        return res.status(200).json({
            configurato: Boolean(password && token),
            autenticato: Boolean(password) && isValidSession(req.headers.cookie, password),
        });
    }

    if (req.method === 'DELETE') {
        res.setHeader('Set-Cookie', clearedCookie());
        return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    if (!password || !token) {
        return res.status(500).json({
            error: 'Mancano le variabili ADMIN_PASSWORD e GITHUB_TOKEN nelle impostazioni Vercel.',
        });
    }

    const inviata = (req.body && req.body.password) || '';
    if (inviata !== password) {
        return res.status(401).json({ error: 'Password errata' });
    }

    res.setHeader('Set-Cookie', sessionCookie(createSession(password)));
    return res.status(200).json({ ok: true });
}
