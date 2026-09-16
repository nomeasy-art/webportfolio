// Carica un singolo file su GitHub come "blob" e ne restituisce lo sha.
// Un file per richiesta: così non si supera il limite di dimensione delle
// funzioni serverless anche caricando molte foto insieme.
import { config, denyIfUnauthorized, gh } from './_lib.mjs';

export const maxDuration = 30;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
    if (denyIfUnauthorized(req, res)) return;

    const { content } = req.body || {};
    if (!content) return res.status(400).json({ error: 'Contenuto mancante' });

    try {
        const { repo } = config();
        const blob = await gh(`/repos/${repo}/git/blobs`, {
            method: 'POST',
            body: JSON.stringify({ content, encoding: 'base64' }),
        });
        return res.status(200).json({ sha: blob.sha });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}
