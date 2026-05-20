document.addEventListener('DOMContentLoaded', () => {
    // --- CUSTOM CURSOR LOGIC ---
    const cursor = document.createElement('div');
    cursor.className = 'custom-cursor';
    cursor.innerHTML = `
        <img src="cursore%20base.svg" class="cursor-img cursor-base" alt="">
        <img src="cursore%20click.svg" class="cursor-img cursor-click" alt="">
    `;
    document.body.appendChild(cursor);

    // Track mouse position
    document.addEventListener('mousemove', (e) => {
        // Use translate3d for hardware acceleration and smooth movement
        cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    });

    // Detect hover on clickable elements
    document.addEventListener('mouseover', (e) => {
        if (e.target.closest('a, button, .project-image-placeholder, .close-detail, .bio-toggle')) {
            cursor.classList.add('is-clickable');
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('a, button, .project-image-placeholder, .close-detail, .bio-toggle')) {
            cursor.classList.remove('is-clickable');
        }
    });

    // Bio toggle logic
    const bioToggle = document.querySelector('.bio-toggle');
    const bioContent = document.querySelector('.bio-content');
    if (bioToggle && bioContent) {
        bioToggle.addEventListener('click', () => {
            bioToggle.classList.toggle('active');
            bioContent.classList.toggle('open');
            const icon = bioToggle.querySelector('.bio-toggle-icon');
            if (icon) {
                icon.textContent = bioToggle.classList.contains('active') ? '—' : '+';
            }
        });
    }
    // ---------------------------

    const scrollWrappers = document.querySelectorAll('.scroll-wrapper');

    scrollWrappers.forEach(wrapper => {
        const originalChildren = Array.from(wrapper.children);

        // Se l'altezza dei contenuti originali è minore dello schermo, lo scroll infinito si blocca.
        // Dobbiamo assicurarci che un "singolo set" riempia sempre abbondantemente lo schermo!
        const originalHeight = wrapper.scrollHeight;
        let copiesPerSet = 1;

        // Se il contenuto è poco, calcoliamo quante copie servono per superare l'altezza dello schermo
        if (originalHeight > 0 && originalHeight < window.innerHeight) {
            copiesPerSet = Math.ceil(window.innerHeight / originalHeight);
        }

        // Puliamo il contenitore e generiamo 3 set massicci
        wrapper.innerHTML = '';
        for (let set = 0; set < 3; set++) {
            for (let c = 0; c < copiesPerSet; c++) {
                originalChildren.forEach(child => wrapper.appendChild(child.cloneNode(true)));
            }
        }

        const getSetHeight = () => wrapper.scrollHeight / 3;

        // Inizializza lo scroll a metà per permettere lo scorrimento bidirezionale
        wrapper.scrollTop = getSetHeight();

        // Variabili per l'inerzia (smooth scroll personalizzato)
        let targetScroll = wrapper.scrollTop;
        let currentScroll = wrapper.scrollTop;
        let isAnimating = false;

        // Impostazioni per il feeling "premium"
        const scrollSpeed = 0.5; // Moltiplicatore velocità
        const lerpFactor = 0.08; // Inerzia (scroll più burroso)

        // Intercettiamo lo scroll della rotellina / trackpad
        wrapper.addEventListener('wheel', (e) => {
            // Se non è scrollabile, ignoriamo l'intercetto custom
            if (wrapper.scrollHeight <= wrapper.clientHeight) return;

            e.preventDefault(); // Blocca lo scroll di default

            targetScroll += e.deltaY * scrollSpeed;

            // CLAMP FONDAMENTALE: impedisce a targetScroll di accumulare valori infiniti se l'utente scrosta i bordi fisici
            const maxScroll = wrapper.scrollHeight - wrapper.clientHeight;
            targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

            // Avvia il loop di animazione se non è già in corso
            if (!isAnimating) {
                isAnimating = true;
                requestAnimationFrame(updateScroll);
            }
        }, { passive: false });

        function updateScroll() {
            // Interpolazione lineare per ammorbidire il movimento
            currentScroll += (targetScroll - currentScroll) * lerpFactor;

            // Applicando la posizione scateniamo l'evento 'scroll'
            wrapper.scrollTop = currentScroll;

            // Continua ad animare finché non arriviamo molto vicini al target
            if (Math.abs(targetScroll - currentScroll) > 0.5) {
                requestAnimationFrame(updateScroll);
            } else {
                isAnimating = false;
            }
        }

        // Evento scroll nativo (scatenato sia dal nostro updateScroll, sia da touch mobile)
        wrapper.addEventListener('scroll', () => {
            const setHeight = getSetHeight();

            // Se l'utente sta usando il touch (non animato da wheel), teniamo le variabili sincronizzate
            if (!isAnimating) {
                currentScroll = wrapper.scrollTop;
                targetScroll = wrapper.scrollTop;
            }

            // Controllo limiti loop infinito
            if (wrapper.scrollTop >= setHeight * 2) {
                wrapper.scrollTop -= setHeight;
                if (!isAnimating) {
                    currentScroll = wrapper.scrollTop;
                    targetScroll = wrapper.scrollTop;
                } else {
                    currentScroll -= setHeight;
                    targetScroll -= setHeight;
                }
            }
            else if (wrapper.scrollTop <= 0) {
                wrapper.scrollTop += setHeight;
                if (!isAnimating) {
                    currentScroll = wrapper.scrollTop;
                    targetScroll = wrapper.scrollTop;
                } else {
                    currentScroll += setHeight;
                    targetScroll += setHeight;
                }
            }
        });
    });

    // -----------------------------------------
    // Animazione Dettaglio Progetto
    // -----------------------------------------
    const placeholders = document.querySelectorAll('.project-image-placeholder');
    const allCols = document.querySelectorAll('.category-column');
    const allColumnsIncludingSidebar = Array.from(document.querySelectorAll('.column'));
    const closeBtn = document.querySelector('.close-detail');

    placeholders.forEach(placeholder => {
        placeholder.addEventListener('click', () => {
            const col = placeholder.closest('.category-column');
            if (!col) return;

            // Calcola di quante posizioni deve spostarsi a sinistra
            const colIndex = allColumnsIncludingSidebar.indexOf(col);
            // La sidebar è index 0. La colonna 2 è index 1 (spostamento = 0 slot).
            const slotsToMove = colIndex - 1;

            // Applica l'animazione di spostamento verso sinistra. 
            // Visto che la colonna ha margin-left: -1.25rem, la sua larghezza (100%) è track + 1.25rem.
            // Per spostarsi di track + gap (2.5rem), dobbiamo sommare 1.25rem al 100% (non 2.5rem).
            col.style.transform = `translateX(calc(-${slotsToMove * 100}% - ${slotsToMove * 1.25}rem))`;
            col.classList.add('active-column');

            // Fai crollare verso il basso le altre colonne (tranne la sidebar che non è in allCols)
            allCols.forEach(c => {
                if (c !== col) {
                    c.classList.add('hidden-column');
                }
            });

            // Mostra la visualizzazione dettaglio coi riquadri grandi
            document.body.classList.add('detail-active');

            // --- GENERAZIONE CONTENUTO INFORMATIVO ---
            // Rimuovi eventuali info vecchie se presenti
            const oldInfo = col.querySelector('.active-project-info');
            if (oldInfo) oldInfo.remove();

            const project = placeholder.closest('.project');
            const infoContainer = document.createElement('div');
            infoContainer.className = 'active-project-info';

            // Creiamo un wrapper .project per mantenere la stessa identica struttura DOM e css
            const projectWrapper = document.createElement('div');
            projectWrapper.className = 'project';
            projectWrapper.style.marginBottom = '0'; // Rimuoviamo il margine inferiore enorme

            // Clona le righe info
            const infoRows = project.querySelectorAll('.info-row');
            infoRows.forEach(row => projectWrapper.appendChild(row.cloneNode(true)));

            // Clona l'immagine
            const imgClone = placeholder.cloneNode(true);
            projectWrapper.appendChild(imgClone);

            // Aggiungi la descrizione
            const desc = document.createElement('p');
            desc.className = 'project-description';
            desc.innerHTML = `Questo progetto esplora le intersezioni tra design editoriale e interfacce digitali.<br><br>L'obiettivo principale è stato quello di creare un'esperienza fluida, riducendo al minimo la frizione visiva e valorizzando i contenuti centrali.<br><br>Attraverso un attento studio tipografico e una palette colori minimale, l'occhio del lettore viene guidato in modo naturale e intuitivo lungo tutta la pagina.<br><br>Ogni singolo elemento, dalle spaziature millimetriche alle animazioni impercettibili, è stato concepito per garantire la massima leggibilità.`;
            projectWrapper.appendChild(desc);

            infoContainer.appendChild(projectWrapper);

            // Aggiungila alla colonna
            col.appendChild(infoContainer);
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            // Aggiungi la classe di chiusura per innescare l'animazione di uscita
            document.body.classList.add('detail-closing');

            // Aspetta che l'animazione di uscita (0.8s) sia completata
            setTimeout(() => {
                document.body.classList.remove('detail-active');
                document.body.classList.remove('detail-closing');
            }, 800);

            // Ripristina tutte le colonne alla loro posizione originale
            allCols.forEach(c => {
                c.classList.remove('hidden-column');
                c.classList.remove('active-column');
                c.style.transform = ''; // Annulla il translateX

                // Rimuovi il blocco info
                const oldInfo = c.querySelector('.active-project-info');
                if (oldInfo) {
                    oldInfo.style.animation = 'fadeOut 0.3s ease forwards';
                    setTimeout(() => oldInfo.remove(), 300);
                }
            });
        });
    }
});
