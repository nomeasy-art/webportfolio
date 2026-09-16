// Dashboard: modifica i progetti e li salva committando sul repository.
// Le foto vengono convertite in WebP qui nel browser, così restano leggere
// e non serve più passare dagli script a mano.

const CATEGORIE = [
    ['', 'seleziona categoria'],
    ['editorial', 'editorial'],
    ['packaging', 'packaging'],
    ['book-cover', 'book cover'],
    ['user-interface', 'brand identity'],
];

const MAX_LATO = 2400;       // px: oltre non serve, sono foto da sito
const QUALITA_WEBP = 0.9;
const LIMITE_FILE_NON_IMMAGINE = 3.5 * 1024 * 1024;

const elementi = {
    login: document.getElementById('login'),
    loginForm: document.getElementById('login-form'),
    loginPassword: document.getElementById('login-password'),
    loginError: document.getElementById('login-error'),
    dashboard: document.getElementById('dashboard'),
    rows: document.getElementById('rows'),
    loading: document.getElementById('loading'),
    save: document.getElementById('save'),
    saveState: document.getElementById('save-state'),
    logout: document.getElementById('logout'),
    fileInput: document.getElementById('file-input'),
};

let progetti = [];      // progetti già sul sito
let nuovo = progettoVuoto();
let lqip = {};          // mappa anteprime sfocate, da riscrivere al salvataggio
let contestoFile = null;

// ---------------------------------------------------------------- utilità

function progettoVuoto() {
    return {
        path: null,
        nuovo: true,
        modificato: false,
        dati: {
            title: '', slug: '', collaborator: '', year: '', description: '',
            category: '', tags: [], mainImageUrl: '', gallery: [],
            externalLink: '', featured: false, active: true, order: null,
        },
        media: [],      // galleria: { url, bytes?, lqip?, tipo }
        preview: null,  // { url, bytes?, lqip?, tipo }
    };
}

// Stesso schema del sito: due orizzontali, due verticali, e così via.
function orientamento(indice) {
    const resto = indice % 4;
    return resto === 0 || resto === 1 ? 'horizontal' : 'vertical';
}

// Sul sito la descrizione è "inglese, riga vuota, italiano". In dashboard si
// vede e si scrive solo l'italiano: l'inglese lo genera il salvataggio.
function italianoDa(dati) {
    if (typeof dati.descriptionIt === 'string') return dati.descriptionIt;
    const intero = dati.description || '';
    const separatore = intero.search(/\n\s*\n/);
    if (separatore === -1) return intero;
    return intero.slice(separatore).replace(/^\s+/, '');
}

function slugifica(testo) {
    return (testo || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'progetto';
}

function isVideo(nomeOTipo) {
    return /\.(mp4|webm)$/i.test(nomeOTipo || '') || /^video\//.test(nomeOTipo || '');
}

function chiaveLqip(url) {
    return (url || '').split('?')[0].replace(/^\/+/, '');
}

function icona(nome) {
    if (nome === 'campo') {
        return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>`;
    }
    return `<svg class="placeholder-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.4"><rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/><path d="M19 3v6M22 6h-6"/></svg>`;
}

// ------------------------------------------------------- lavorazione foto

async function elaboraFile(file, cartella, progressivo) {
    const nomeBase = `${Date.now()}-${progressivo}`;

    if (isVideo(file.type) || isVideo(file.name)) {
        if (file.size > LIMITE_FILE_NON_IMMAGINE) {
            throw new Error(`"${file.name}" è troppo pesante: i video devono stare sotto i 3,5 MB.`);
        }
        const estensione = /\.webm$/i.test(file.name) ? 'webm' : 'mp4';
        return {
            url: `images/projects/${cartella}/${nomeBase}.${estensione}`,
            bytes: await base64Da(file),
            lqip: null,
            tipo: 'video',
        };
    }

    const bitmap = await createImageBitmap(file);
    const scala = Math.min(1, MAX_LATO / Math.max(bitmap.width, bitmap.height));
    const larghezza = Math.round(bitmap.width * scala);
    const altezza = Math.round(bitmap.height * scala);

    const canvas = document.createElement('canvas');
    canvas.width = larghezza;
    canvas.height = altezza;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, larghezza, altezza);
    const blob = await new Promise(ok => canvas.toBlob(ok, 'image/webp', QUALITA_WEBP));

    // Anteprima minuscola per l'effetto sfocato nelle gallerie
    const mini = document.createElement('canvas');
    mini.width = 16;
    mini.height = Math.max(1, Math.round(16 * bitmap.height / bitmap.width));
    mini.getContext('2d').drawImage(bitmap, 0, 0, mini.width, mini.height);
    bitmap.close && bitmap.close();

    return {
        url: `images/projects/${cartella}/${nomeBase}.webp`,
        bytes: await base64Da(blob),
        lqip: mini.toDataURL('image/jpeg', 0.4),
        tipo: 'immagine',
    };
}

function base64Da(blob) {
    return new Promise((ok, ko) => {
        const lettore = new FileReader();
        lettore.onload = () => ok(String(lettore.result).split(',')[1]);
        lettore.onerror = ko;
        lettore.readAsDataURL(blob);
    });
}

function urlVisibile(media) {
    if (!media) return null;
    if (media.bytes) {
        const tipo = media.tipo === 'video' ? 'video/mp4' : 'image/webp';
        return `data:${tipo};base64,${media.bytes}`;
    }
    return '/' + chiaveLqip(media.url);
}

// ------------------------------------------------------------- interfaccia

function render() {
    elementi.rows.innerHTML = '';
    elementi.rows.appendChild(creaRiga(nuovo, true));
    progetti.forEach(p => elementi.rows.appendChild(creaRiga(p, false)));
}

function creaRiga(progetto, isNuovo) {
    const riga = document.createElement('article');
    riga.className = 'row' + (isNuovo ? ' is-new' : '');

    const opzioni = CATEGORIE
        .map(([valore, etichetta]) =>
            `<option value="${valore}"${progetto.dati.category === valore ? ' selected' : ''}>${etichetta}</option>`)
        .join('');

    riga.innerHTML = `
        <div class="project-editor">
            <div class="row-identity">
                <button type="button" class="slot preview-slot" data-ruolo="preview" aria-label="Carica immagine di copertina"></button>
                <div class="row-fields">
                    <div class="col-title"><select class="category-select" aria-label="Categoria progetto">${opzioni}</select></div>
                    <label class="field">${icona('campo')}<input data-campo="title" placeholder="NOME PROGETTO" /></label>
                    <label class="field">${icona('campo')}<input data-campo="collaborator" placeholder="CLIENTE PROGETTO" /></label>
                    <label class="field">${icona('campo')}<input data-campo="year" placeholder="W/ COLLABORATORI" /></label>
                </div>
            </div>
            <div class="row-description">
                <div class="description-label">Descrizione:</div>
                <textarea class="description" placeholder="${isNuovo ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' : 'DESCRIZIONE'}"></textarea>
            </div>
        </div>
        <div class="gallery"></div>
        <div class="project-actions${isNuovo ? ' is-draft-actions' : ''}">
            <div class="visibility-toggle" role="group" aria-label="Visibilità del progetto">
                <button type="button" class="visibility-choice" data-active="true">ATTIVO</button>
                <button type="button" class="visibility-choice" data-active="false">DISATTIVO</button>
            </div>
            <button type="button" class="hold-delete" aria-label="Tieni premuto per eliminare il progetto"><span>ELIMINA</span></button>
        </div>
    `;

    riga.querySelector('[data-campo="title"]').value = progetto.dati.title || '';
    riga.querySelector('[data-campo="collaborator"]').value = progetto.dati.collaborator || '';
    riga.querySelector('[data-campo="year"]').value = progetto.dati.year || '';
    riga.querySelector('.description').value = italianoDa(progetto.dati);

    riga.querySelectorAll('[data-campo]').forEach(campo => {
        campo.addEventListener('input', () => {
            progetto.dati[campo.dataset.campo] = campo.value;
            progetto.modificato = true;
        });
    });
    // La descrizione cresce con il testo: niente blocchi tagliati a metà.
    riga.querySelector('.description').addEventListener('input', e => {
        progetto.dati.descriptionIt = e.target.value;
        progetto.modificato = true;
    });
    riga.querySelector('.category-select').addEventListener('change', e => {
        progetto.dati.category = e.target.value;
        progetto.modificato = true;
    });

    aggiornaVisibilita(riga, progetto);
    riga.querySelectorAll('[data-active]').forEach(bottone => {
        bottone.addEventListener('click', () => {
            progetto.dati.active = bottone.dataset.active === 'true';
            progetto.modificato = true;
            aggiornaVisibilita(riga, progetto);
        });
    });

    const elimina = riga.querySelector('.hold-delete');
    if (elimina) attivaEliminazione(elimina, progetto);

    const preview = riga.querySelector('.preview-slot');
    disegnaSlot(preview, progetto.preview, null, progetto);
    preview.addEventListener('click', () => apriSelettore(progetto, 'preview', 0));

    disegnaGalleria(riga.querySelector('.gallery'), progetto);
    return riga;
}

function disegnaGalleria(contenitore, progetto) {
    contenitore.innerHTML = '';
    const totale = 12;
    for (let i = 0; i < totale; i++) {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'slot';
        slot.setAttribute('aria-label', `Foto progetto ${i + 1}${progetto.media[i] ? '' : ', vuota'}`);
        disegnaSlot(slot, progetto.media[i], i, progetto);
        slot.addEventListener('click', e => {
            if (e.target.closest('.slot-actions')) return;
            apriSelettore(progetto, 'gallery', i);
        });
        contenitore.appendChild(slot);
    }
}

function aggiornaVisibilita(riga, progetto) {
    const attivo = progetto.dati.active !== false;
    riga.querySelectorAll('[data-active]').forEach(bottone => {
        const selezionato = (bottone.dataset.active === 'true') === attivo;
        bottone.classList.toggle('is-selected', selezionato);
        bottone.setAttribute('aria-pressed', String(selezionato));
    });
}

function attivaEliminazione(bottone, progetto) {
    // Il riempimento lo disegna il CSS (2,6s); qui serve solo il timer che
    // decide quando la corsa è arrivata in fondo.
    const DURATA = 2600;
    let timer = 0;
    let eliminato = false;

    const annulla = () => {
        if (eliminato) return;
        clearTimeout(timer);
        timer = 0;
        bottone.classList.remove('is-holding');
    };

    bottone.addEventListener('pointerdown', e => {
        if (eliminato || e.button !== 0 || timer) return;
        e.preventDefault();
        if (Number.isInteger(e.pointerId)) bottone.setPointerCapture?.(e.pointerId);
        bottone.classList.add('is-holding');
        timer = setTimeout(() => {
            eliminato = true;
            timer = 0;
            bottone.classList.remove('is-holding');
            bottone.classList.add('is-complete');
            bottone.disabled = true;
            eliminaProgetto(progetto);
        }, DURATA);
    });

    ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach(evento =>
        bottone.addEventListener(evento, annulla));
}

function disegnaSlot(slot, media, indice, progetto) {
    slot.innerHTML = icona('foto');
    slot.classList.toggle('filled', Boolean(media));
    if (!media) return;

    const src = urlVisibile(media);
    slot.insertAdjacentHTML('beforeend', media.tipo === 'video'
        ? `<video src="${src}" muted autoplay loop playsinline></video>`
        : `<img src="${src}" alt="" />`);

    const azioni = document.createElement('div');
    azioni.className = 'slot-actions';
    if (indice !== null) {
        azioni.innerHTML = `
            <button type="button" data-azione="sinistra" title="Sposta a sinistra">‹</button>
            <button type="button" data-azione="destra" title="Sposta a destra">›</button>
            <button type="button" data-azione="togli" class="remove" title="Togli">×</button>`;
    } else {
        azioni.innerHTML = `<button type="button" data-azione="togli" class="remove" title="Togli">×</button>`;
    }
    slot.appendChild(azioni);

    azioni.addEventListener('click', e => {
        const azione = e.target.dataset.azione;
        if (!azione) return;
        e.stopPropagation();
        if (indice === null) {
            progetto.preview = null;
        } else if (azione === 'togli') {
            progetto.media.splice(indice, 1);
        } else {
            const destinazione = azione === 'sinistra' ? indice - 1 : indice + 1;
            if (destinazione < 0 || destinazione >= progetto.media.length) return;
            const [spostato] = progetto.media.splice(indice, 1);
            progetto.media.splice(destinazione, 0, spostato);
        }
        progetto.modificato = true;
        render();
    });
}

// --------------------------------------------------------- scelta dei file

function apriSelettore(progetto, ruolo, indice) {
    contestoFile = { progetto, ruolo, indice };
    // Sulla preview un file basta; in galleria la selezione multipla è il punto.
    elementi.fileInput.multiple = ruolo === 'gallery';
    elementi.fileInput.value = '';
    elementi.fileInput.click();
}

elementi.fileInput.addEventListener('change', async () => {
    const files = Array.from(elementi.fileInput.files || []);
    if (!files.length || !contestoFile) return;
    const { progetto, ruolo, indice } = contestoFile;
    const cartella = slugifica(progetto.dati.slug || progetto.dati.title || 'nuovo-progetto');

    stato(`Preparo ${files.length} file…`);
    try {
        const lavorati = [];
        for (let i = 0; i < files.length; i++) {
            lavorati.push(await elaboraFile(files[i], cartella, i));
            stato(`Preparo ${i + 1} di ${files.length}…`);
        }
        if (ruolo === 'preview') {
            progetto.preview = lavorati[0];
        } else {
            // Riempie dallo slot cliccato in avanti, uno dopo l'altro.
            for (let i = 0; i < lavorati.length && indice + i < 12; i++) {
                progetto.media[indice + i] = lavorati[i];
            }
            // Eventuali buchi (slot saltati) vengono compattati
            progetto.media = progetto.media.filter(Boolean).slice(0, 12);
        }
        progetto.modificato = true;
        render();
        stato(`${files.length} file pronti: premi SALVA MODIFICHE.`);
    } catch (err) {
        stato(err.message, true);
    }
});

// ------------------------------------------------------------ salvataggio

function stato(messaggio, errore = false) {
    elementi.saveState.textContent = messaggio || '';
    elementi.saveState.style.color = errore ? '#a33' : '';
}

async function chiamata(url, opzioni = {}) {
    const risposta = await fetch(url, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        ...opzioni,
    });
    const dati = await risposta.json().catch(() => ({}));
    if (!risposta.ok) throw new Error(dati.error || `Errore ${risposta.status}`);
    return dati;
}

async function eliminaProgetto(progetto) {
    if (progetto.nuovo) {
        nuovo = progettoVuoto();
        render();
        stato('Bozza eliminata.');
        return;
    }

    stato(`Elimino "${progetto.dati.title || 'progetto'}"…`);
    try {
        await chiamata('/api/commit', {
            method: 'POST',
            body: JSON.stringify({
                files: [{ path: progetto.path, remove: true }],
                message: `Dashboard: elimina ${progetto.dati.title || 'progetto'}`,
            }),
        });
        progetti = progetti.filter(p => p !== progetto);
        render();
        stato('Progetto eliminato. Il sito si aggiorna in un minuto.');
    } catch (err) {
        stato(err.message, true);
        // Un errore non deve lasciare un pulsante visivamente "riempito".
        render();
    }
}

async function salva() {
    const daSalvare = progetti.filter(p => p.modificato);
    if (nuovo.modificato && (nuovo.dati.title || '').trim()) daSalvare.push(nuovo);

    if (!daSalvare.length) return stato('Niente da salvare.');
    const senzaTitolo = daSalvare.find(p => !(p.dati.title || '').trim());
    if (senzaTitolo) return stato('Ogni progetto deve avere un nome.', true);
    const senzaCategoria = daSalvare.find(p => !(p.dati.category || '').trim());
    if (senzaCategoria) return stato('Seleziona una categoria per ogni progetto.', true);

    elementi.save.disabled = true;
    try {
        const files = [];
        const nuoviMedia = [];
        const erroriTraduzione = [];

        for (const progetto of daSalvare) {
            const slug = slugifica(progetto.dati.slug || progetto.dati.title);
            progetto.dati.slug = slug;
            progetto.dati.gallery = progetto.media.map(m => '/' + chiaveLqip(m.url));
            progetto.dati.mainImageUrl = progetto.preview ? chiaveLqip(progetto.preview.url) : '';

            // Il sito mostra inglese + riga vuota + italiano: l'inglese lo
            // genera la traduzione automatica dall'italiano scritto qui.
            const italiano = italianoDa(progetto.dati).trim();
            progetto.dati.descriptionIt = italiano;
            if (italiano) {
                stato(`Traduco "${progetto.dati.title}"…`);
                try {
                    const { testo } = await chiamata('/api/translate', {
                        method: 'POST',
                        body: JSON.stringify({ testo: italiano }),
                    });
                    progetto.dati.description = testo ? `${testo}\n\n${italiano}` : italiano;
                } catch (err) {
                    // Meglio salvare il resto che bloccare tutto: si tiene
                    // l'inglese precedente, se c'era.
                    const precedente = (progetto.dati.description || '').split(/\n\s*\n/)[0];
                    const inglesePrecedente = precedente && precedente !== italiano ? precedente : '';
                    progetto.dati.description = inglesePrecedente
                        ? `${inglesePrecedente}\n\n${italiano}`
                        : italiano;
                    erroriTraduzione.push(progetto.dati.title);
                }
            } else {
                progetto.dati.description = '';
            }

            const testo = JSON.stringify(progetto.dati, null, 2) + '\n';
            // Rete di sicurezza: se il contenuto è identico a com'era, il file
            // non entra nel commit (niente modifiche inutili al repository).
            if (!progetto.nuovo && testo === progetto.originale) continue;

            [...progetto.media, progetto.preview].forEach(m => {
                if (m && m.bytes) nuoviMedia.push(m);
            });
            files.push({ path: progetto.path || `projects/${slug}.json`, text: testo });
        }

        if (!files.length) {
            elementi.save.disabled = false;
            return stato('Niente da salvare.');
        }

        // Le foto salgono una per richiesta: nessun limite di dimensione.
        for (let i = 0; i < nuoviMedia.length; i++) {
            stato(`Carico foto ${i + 1} di ${nuoviMedia.length}…`);
            const { sha } = await chiamata('/api/blob', {
                method: 'POST',
                body: JSON.stringify({ content: nuoviMedia[i].bytes }),
            });
            files.push({ path: chiaveLqip(nuoviMedia[i].url), sha });
            if (nuoviMedia[i].lqip) lqip[chiaveLqip(nuoviMedia[i].url)] = nuoviMedia[i].lqip;
        }

        files.push({ path: 'lqip.json', text: JSON.stringify(lqip) });

        stato('Pubblico…');
        await chiamata('/api/commit', {
            method: 'POST',
            body: JSON.stringify({
                files,
                message: `Dashboard: aggiorna ${daSalvare.map(p => p.dati.title).join(', ')}`,
            }),
        });

        stato(erroriTraduzione.length
            ? `Salvato, ma la traduzione non è riuscita per: ${erroriTraduzione.join(', ')}.`
            : 'Salvato. Il sito si aggiorna in un minuto.', erroriTraduzione.length > 0);
        nuovo = progettoVuoto();
        await caricaProgetti();
    } catch (err) {
        stato(err.message, true);
    } finally {
        elementi.save.disabled = false;
    }
}

// ----------------------------------------------------------------- avvio

async function caricaProgetti() {
    const { progetti: elenco } = await chiamata('/api/projects');
    progetti = elenco.filter(p => p.dati).map(p => ({
        path: p.path,
        nuovo: false,
        modificato: false,
        originale: JSON.stringify(p.dati, null, 2) + '\n',
        dati: p.dati,
        media: (p.dati.gallery || []).slice(0, 12).map(url => ({
            url, tipo: isVideo(url) ? 'video' : 'immagine',
        })),
        preview: p.dati.mainImageUrl
            ? { url: p.dati.mainImageUrl, tipo: isVideo(p.dati.mainImageUrl) ? 'video' : 'immagine' }
            : null,
    }));
    elementi.loading?.remove();
    render();
}

async function mostraDashboard() {
    elementi.login.hidden = true;
    elementi.dashboard.hidden = false;
    try {
        lqip = await fetch('/lqip.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
        await caricaProgetti();
    } catch (err) {
        stato(err.message, true);
    }
}

elementi.loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    elementi.loginError.hidden = true;
    try {
        await chiamata('/api/auth', {
            method: 'POST',
            body: JSON.stringify({ password: elementi.loginPassword.value }),
        });
        await mostraDashboard();
    } catch (err) {
        elementi.loginError.textContent = err.message;
        elementi.loginError.hidden = false;
    }
});

elementi.logout.addEventListener('click', async () => {
    await fetch('/api/auth', { method: 'DELETE', credentials: 'same-origin' });
    location.reload();
});

elementi.save.addEventListener('click', salva);

(async function avvio() {
    try {
        const sessione = await chiamata('/api/auth');
        if (sessione.autenticato) return mostraDashboard();
        elementi.login.hidden = false;
        if (!sessione.configurato) {
            elementi.loginError.textContent =
                'Mancano ADMIN_PASSWORD e GITHUB_TOKEN nelle impostazioni del sito su Vercel.';
            elementi.loginError.hidden = false;
        }
    } catch (err) {
        elementi.login.hidden = false;
        elementi.loginError.textContent =
            'Le funzioni del server non rispondono (in locale è normale: funzionano una volta pubblicato).';
        elementi.loginError.hidden = false;
    }
})();
