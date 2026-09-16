// Restituisce i progetti letti direttamente da GitHub: sempre aggiornati,
// senza passare dalla cache del sito pubblico.
import { config, denyIfUnauthorized, gh } from './_lib.mjs';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo non consentito' });
    if (denyIfUnauthorized(req, res)) return;

    try {
        const { repo, branch } = config();
        const elenco = await gh(`/repos/${repo}/contents/projects?ref=${branch}`);
        const progetti = [];

        for (const file of elenco) {
            if (!file.name.endsWith('.json')) continue;
            const risposta = await gh(`/repos/${repo}/contents/${encodeURI(file.path)}?ref=${branch}`);
            const testo = Buffer.from(risposta.content, 'base64').toString('utf8');
            try {
                progetti.push({ path: file.path, dati: JSON.parse(testo) });
            } catch (e) {
                // Un JSON rotto non deve impedire di aprire la dashboard
                progetti.push({ path: file.path, dati: null, errore: 'JSON non leggibile' });
            }
        }

        progetti.sort((a, b) => {
            const oa = a.dati && a.dati.order != null ? a.dati.order : 9999;
            const ob = b.dati && b.dati.order != null ? b.dati.order : 9999;
            return oa - ob;
        });

        return res.status(200).json({ progetti });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message });
    }
}
