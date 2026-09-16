// Chiude il salvataggio: raccoglie i file (blob già caricati e testi) in un
// unico commit, così il sito viene ripubblicato una volta sola.
import { config, denyIfUnauthorized, gh, commitFiles } from './_lib.mjs';

export const maxDuration = 30;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
    if (denyIfUnauthorized(req, res)) return;

    const { files, message } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'Nessun file da salvare' });
    }

    try {
        const { repo } = config();
        const preparati = [];

        for (const file of files) {
            if (!file || !file.path) continue;
            if (file.remove) {
                preparati.push({ path: file.path, remove: true });
                continue;
            }
            if (file.sha) {
                preparati.push({ path: file.path, sha: file.sha });
                continue;
            }
            // File di testo (JSON dei progetti, lqip.json): creo il blob al volo.
            const blob = await gh(`/repos/${repo}/git/blobs`, {
                method: 'POST',
                body: JSON.stringify({
                    content: Buffer.from(file.text ?? '', 'utf8').toString('base64'),
                    encoding: 'base64',
                }),
            });
            preparati.push({ path: file.path, sha: blob.sha });
        }

        const sha = await commitFiles(preparati, message || 'Aggiornamento dalla dashboard');
        return res.status(200).json({ ok: true, commit: sha });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}
