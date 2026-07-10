// Projects are loaded locally from projects.json

// --- UTILITY: PREMIUM SMOOTH SCROLL (INERTIAL LERP) ---
function setupSmoothScroll(element, speed = 0.6, lerp = 0.08) {
    if (!element) return null;

    let targetScroll = element.scrollTop;
    let currentScroll = targetScroll;
    let isAnimating = false;

    const onWheel = (e) => {
        // Skip smooth scrolling on mobile (screen <= 768px)
        if (window.innerWidth <= 768) return;
        if (element.scrollHeight <= element.clientHeight) return;

        e.preventDefault();

        targetScroll += e.deltaY * speed;
        const maxScroll = element.scrollHeight - element.clientHeight;
        targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

        if (!isAnimating) {
            isAnimating = true;
            requestAnimationFrame(updateScroll);
        }
    };

    element.addEventListener('wheel', onWheel, { passive: false });

    function updateScroll() {
        if (window.innerWidth <= 768) {
            isAnimating = false;
            return;
        }

        currentScroll += (targetScroll - currentScroll) * lerp;
        element.scrollTop = currentScroll;

        if (Math.abs(targetScroll - currentScroll) > 0.5) {
            requestAnimationFrame(updateScroll);
        } else {
            currentScroll = targetScroll;
            element.scrollTop = currentScroll;
            isAnimating = false;
        }
    }

    const instance = {
        reset: () => {
            targetScroll = element.scrollTop;
            currentScroll = element.scrollTop;
            isAnimating = false;
        },
        destroy: () => {
            element.removeEventListener('wheel', onWheel);
        }
    };

    element.smoothScrollInstance = instance;

    // Synchronize scroll parameters if the container is scrolled via keypress, search, or code
    element.addEventListener('scroll', () => {
        if (!isAnimating) {
            targetScroll = element.scrollTop;
            currentScroll = element.scrollTop;
        }
    });

    return instance;
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- FETCH PROJECTS FROM LOCAL JSON ---
    try {
        const response = await fetch('projects.json');
        if (!response.ok) {
            throw new Error(`Failed to load projects: ${response.statusText}`);
        }
        const projects = await response.json();

        // Sort projects by order (smaller numbers first, nulls/undefined at the end)
        projects.sort((a, b) => {
            const orderA = a.order !== null && a.order !== undefined ? a.order : 9999;
            const orderB = b.order !== null && b.order !== undefined ? b.order : 9999;
            return orderA - orderB;
        });

        projects.forEach(project => {
            const category = project.category || 'editorial';
            const wrapper = document.getElementById(`${category}-wrapper`);
            if (!wrapper) return;

            const projectEl = document.createElement('div');
            projectEl.className = 'project';

            // Store data for detail view
            projectEl.dataset.description = project.description || '';
            projectEl.dataset.gallery = JSON.stringify(project.gallery || []);

            projectEl.innerHTML = `
                <div class="info-row top-border">${project.title || 'NOME DEL PROGETTO'}</div>
                <div class="info-row">${project.collaborator || ''}</div>
                <div class="info-row">${project.year || ''}</div>
                <div class="project-image-placeholder" ${project.mainImageUrl ? `style="background-image: url('${project.mainImageUrl}'); background-size: cover; background-position: center;"` : ''}></div>
            `;
            wrapper.appendChild(projectEl);
        });
    } catch (err) {
        console.error("Error fetching local projects:", err);
    }
    // --------------------------------------

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

    // --- SETUP STATIC SMOOTH SCROLLS ---
    const detailsSection = document.querySelector('.details-section');
    if (detailsSection) {
        setupSmoothScroll(detailsSection, 0.7, 0.08);
    }

    const detailScroll = document.querySelector('.detail-scroll');
    if (detailScroll) {
        setupSmoothScroll(detailScroll, 0.7, 0.08);
    }
    // ------------------------------------

    // --- DYNAMIC MOBILE FOOTER SPACING ---
    function adjustMobileFooterSpacing() {
        // Run only on mobile
        if (window.innerWidth > 768) {
            const footer = document.querySelector('.mobile-footer');
            if (footer) footer.style.paddingBottom = '';
            return;
        }

        // Do not calculate if a project is actively open
        if (document.body.classList.contains('detail-active')) return;

        const cols = document.querySelectorAll('.category-column');
        if (cols.length === 0) return;
        const lastCol = cols[cols.length - 1];
        const footer = document.querySelector('.mobile-footer');
        if (!footer) return;

        // Reset to CSS defined padding to measure natural height
        footer.style.paddingBottom = '';

        // Force synchronous layout recalculation
        const lastColRect = lastCol.getBoundingClientRect();
        const lastColTop = lastColRect.top + window.pageYOffset;
        const currentDocHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

        // Calculate the minimum document height required to allow scrolling lastCol to the top
        const requiredDocHeight = lastColTop + window.innerHeight;

        if (requiredDocHeight > currentDocHeight) {
            const currentPadding = parseFloat(window.getComputedStyle(footer).paddingBottom) || 0;
            const extraSpace = requiredDocHeight - currentDocHeight;
            footer.style.paddingBottom = (currentPadding + extraSpace) + 'px';
        }
    }

    // Call initially and on layout changes
    adjustMobileFooterSpacing();
    window.addEventListener('load', adjustMobileFooterSpacing);
    window.addEventListener('resize', adjustMobileFooterSpacing);
    // ---------------------------

    const scrollWrappers = document.querySelectorAll('.scroll-wrapper');

    scrollWrappers.forEach(wrapper => {
        // Skip infinite scroll for tablet where layout is full height
        if (window.innerWidth <= 1200 && window.innerWidth > 768) {
            return;
        }

        // Skip infinite scroll for detail-scroll on mobile
        if (window.innerWidth <= 768 && wrapper.classList.contains('detail-scroll')) {
            return;
        }

        const isHorizontal = window.innerWidth <= 768;
        const originalChildren = Array.from(wrapper.children);

        const originalSize = isHorizontal ? wrapper.scrollWidth : wrapper.scrollHeight;
        const viewportSize = isHorizontal ? window.innerWidth : window.innerHeight;

        let copiesPerSet = 1;
        if (originalSize > 0 && originalSize < viewportSize) {
            copiesPerSet = Math.ceil(viewportSize / originalSize);
        }

        const NUM_SETS = isHorizontal ? 20 : 3;
        const MIDDLE_SET = Math.floor(NUM_SETS / 2);
        const itemsPerSet = originalChildren.length * copiesPerSet;

        wrapper.innerHTML = '';
        for (let set = 0; set < NUM_SETS; set++) {
            for (let c = 0; c < copiesPerSet; c++) {
                originalChildren.forEach(child => wrapper.appendChild(child.cloneNode(true)));
            }
        }

        // Calcola la dimensione esatta di un set misurando la distanza fisica tra gli elementi
        // Questo evita errori causati dal padding globale del wrapper su mobile!
        let setSize = 0;
        if (wrapper.children.length >= itemsPerSet + 1) {
            const first = wrapper.children[0];
            const next = wrapper.children[itemsPerSet];
            setSize = isHorizontal ? (next.offsetLeft - first.offsetLeft) : (next.offsetTop - first.offsetTop);
        } else {
            setSize = (isHorizontal ? wrapper.scrollWidth : wrapper.scrollHeight) / NUM_SETS;
        }

        if (isHorizontal) {
            wrapper.style.scrollSnapType = 'none';
            wrapper.scrollLeft = setSize * MIDDLE_SET;
            requestAnimationFrame(() => {
                wrapper.style.scrollSnapType = '';
            });
        } else {
            wrapper.scrollTop = setSize * MIDDLE_SET;
        }

        let targetScroll = isHorizontal ? wrapper.scrollLeft : wrapper.scrollTop;
        let currentScroll = targetScroll;
        let isAnimating = false;

        // Parametri per una fluidità eccellente
        const scrollSpeed = 0.8;
        const lerpFactor = 0.08;

        if (!isHorizontal) {
            wrapper.addEventListener('wheel', (e) => {
                if (wrapper.scrollHeight <= wrapper.clientHeight) return;
                e.preventDefault();

                targetScroll += e.deltaY * scrollSpeed;
                const maxScroll = wrapper.scrollHeight - wrapper.clientHeight;
                targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));

                if (!isAnimating) {
                    isAnimating = true;
                    requestAnimationFrame(updateScroll);
                }
            }, { passive: false });
        }

        function updateScroll() {
            currentScroll += (targetScroll - currentScroll) * lerpFactor;

            // Loop infinito in perfetta sincronia con i frame di animazione
            if (!isHorizontal && setSize > 0) {
                if (currentScroll >= setSize * (MIDDLE_SET + 1)) {
                    currentScroll -= setSize;
                    targetScroll -= setSize;
                } else if (currentScroll <= setSize * (MIDDLE_SET - 1)) {
                    currentScroll += setSize;
                    targetScroll += setSize;
                }
            }

            if (!isHorizontal) {
                wrapper.scrollTop = currentScroll;
            }

            if (Math.abs(targetScroll - currentScroll) > 0.5) {
                requestAnimationFrame(updateScroll);
            } else {
                currentScroll = targetScroll;
                if (!isHorizontal) wrapper.scrollTop = currentScroll;
                isAnimating = false;
            }
        }

        let scrollTimeout;

        wrapper.addEventListener('scroll', () => {
            if (setSize <= 0) return;

            if (isHorizontal) {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const currentPos = wrapper.scrollLeft;
                    const currentSet = Math.floor(currentPos / setSize);

                    if (currentSet !== MIDDLE_SET) {
                        const relativePos = currentPos - (currentSet * setSize);

                        wrapper.style.scrollSnapType = 'none';
                        wrapper.scrollLeft = (setSize * MIDDLE_SET) + relativePos;

                        requestAnimationFrame(() => {
                            wrapper.style.scrollSnapType = '';
                        });
                    }
                }, 100);
            } else {
                // Per interazioni non-mouse (es. tastiera) su desktop
                if (!isAnimating) {
                    const currentPos = wrapper.scrollTop;
                    const currentSet = Math.floor(currentPos / setSize);
                    if (currentSet !== MIDDLE_SET) {
                        const relativePos = currentPos - (currentSet * setSize);
                        wrapper.scrollTop = (setSize * MIDDLE_SET) + relativePos;
                        currentScroll = wrapper.scrollTop;
                        targetScroll = wrapper.scrollTop;
                    }
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
    const closeBtns = document.querySelectorAll('.close-detail, .close-detail-mobile');

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

            const stickyInfo = document.createElement('div');
            stickyInfo.className = 'sticky-info-mobile';

            // Clona le righe info
            const infoRows = project.querySelectorAll('.info-row');
            infoRows.forEach(row => stickyInfo.appendChild(row.cloneNode(true)));

            projectWrapper.appendChild(stickyInfo);

            // Clona l'immagine
            const imgClone = placeholder.cloneNode(true);
            projectWrapper.appendChild(imgClone);

            // Aggiungi la descrizione
            const desc = document.createElement('p');
            desc.className = 'project-description';
            // Usa la descrizione da Sanity, mantenendo le newline come <br>
            const rawDesc = project.dataset.description || '';
            desc.innerHTML = rawDesc.replace(/\n/g, '<br>');
            projectWrapper.appendChild(desc);

            infoContainer.appendChild(projectWrapper);

            // --- GENERAZIONE GALLERIA IMMAGINI ---
            const detailScroll = document.querySelector('.detail-scroll');
            if (detailScroll) {
                detailScroll.innerHTML = ''; // Svuota la galleria precedente
                try {
                    const galleryUrls = JSON.parse(project.dataset.gallery || '[]');
                    galleryUrls.forEach(url => {
                        const imgDiv = document.createElement('div');
                        imgDiv.className = 'large-image';
                        imgDiv.style.backgroundImage = `url('${url}')`;
                        imgDiv.style.backgroundSize = 'cover';
                        imgDiv.style.backgroundPosition = 'center';
                        detailScroll.appendChild(imgDiv);
                    });
                    if (galleryUrls.length === 0) {
                        // fallback if no gallery
                        const imgDiv = document.createElement('div');
                        imgDiv.className = 'large-image';
                        detailScroll.appendChild(imgDiv);
                    }
                } catch (e) {
                    console.error("Error parsing gallery images", e);
                }
            }

            // Aggiungila alla colonna
            col.appendChild(infoContainer);

            // Applica il smooth scroll anche alla colonna info dinamica
            setupSmoothScroll(infoContainer, 0.7, 0.08);

            // Su mobile, fai scorrere la pagina verso l'alto per mostrare l'inizio del progetto
            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }, 50); // Piccolo delay per assicurarsi che il DOM sia renderizzato
            }
        });
    });

    if (closeBtns.length > 0) {
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const activeCol = document.querySelector('.category-column.active-column');

                // Aggiungi la classe di chiusura per innescare l'animazione di uscita
                document.body.classList.add('detail-closing');

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

                // Ripristina lo scroll su mobile allineando la colonna sincronicamente per evitare flash visivi
                if (window.innerWidth <= 768 && activeCol) {
                    const rect = activeCol.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const targetScroll = rect.top + scrollTop;
                    window.scrollTo(0, targetScroll);
                }

                // Aspetta che l'animazione di uscita (0.8s) sia completata
                setTimeout(() => {
                    document.body.classList.remove('detail-active');
                    document.body.classList.remove('detail-closing');

                    // Ripristina lo scorrimento della galleria immagini all'inizio
                    const detailScroll = document.querySelector('.detail-scroll');
                    if (detailScroll) {
                        detailScroll.scrollTop = 0;
                        detailScroll.scrollLeft = 0;
                        if (detailScroll.smoothScrollInstance) {
                            detailScroll.smoothScrollInstance.reset();
                        }
                    }
                }, 800);
            });
        });
    }
});
