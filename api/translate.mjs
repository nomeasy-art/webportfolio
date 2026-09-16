// Traduce in inglese la descrizione scritta in italiano nella dashboard.
// Usa DeepL se è impostata DEEPL_API_KEY (qualità migliore), altrimenti
// MyMemory, che non richiede alcuna chiave.
import { denyIfUnauthorized } from './_lib.mjs';

export const maxDuration = 30;

async function conDeepL(testo, chiave) {
    const gratuita = chiave.endsWith(':fx');
    const host = gratuita ? 'api-free.deepl.com' : 'api.deepl.com';
    const risposta = await fetch(`https://${host}/v2/translate`, {
        method: 'POST',
        headers: {
            Authorization: `DeepL-Auth-Key ${chiave}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: [testo], source_lang: 'IT', target_lang: 'EN' }),
    });
    if (!risposta.ok) throw new Error(`DeepL ha risposto ${risposta.status}`);
    const dati = await risposta.json();
    return dati.translations[0].text;
}

// Senza chiave: un paragrafo per volta, perché il servizio tronca i testi lunghi.
async function conMyMemory(testo) {
    const paragrafi = testo.split(/\n\s*\n/);
    const tradotti = [];
    for (const paragrafo of paragrafi) {
        if (!paragrafo.trim()) {
            tradotti.push('');
            continue;
        }
        const url = 'https://api.mymemory.translated.net/get?langpair=it|en&q='
            + encodeURIComponent(paragrafo);
        const risposta = await fetch(url);
        if (!risposta.ok) throw new Error(`Servizio di traduzione: errore ${risposta.status}`);
        const dati = await risposta.json();
        const risultato = dati && dati.responseData && dati.responseData.translatedText;
        if (!risultato) throw new Error('Il servizio di traduzione non ha risposto.');
        tradotti.push(risultato);
    }
    return tradotti.join('\n\n');
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
    if (denyIfUnauthorized(req, res)) return;

    const testo = (req.body && req.body.testo) || '';
    if (!testo.trim()) return res.status(200).json({ testo: '' });

    try {
        const chiave = process.env.DEEPL_API_KEY;
        const tradotto = chiave ? await conDeepL(testo, chiave) : await conMyMemory(testo);
        return res.status(200).json({ testo: tradotto.trim() });
    } catch (err) {
        return res.status(502).json({ error: `Traduzione non riuscita: ${err.message}` });
    }
}
