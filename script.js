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

// --- UTILITY: GALLERY LAYOUT (orizzontali/verticali a pattern + reveal animato) ---
function createGalleryImage(url, extraClass) {
    const div = document.createElement('div');
    div.className = extraClass ? `large-image ${extraClass}` : 'large-image';
    if (url) {
        div.style.backgroundImage = `url('${url}')`;
        div.style.backgroundSize = 'cover';
        div.style.backgroundPosition = 'center';
    }
    return div;
}

// Pattern (ciclo di 4, 0-indexed): 0,1 = orizzontale — 2,3 = verticale (affiancate).
// Si adatta automaticamente al numero di immagini realmente disponibili, senza
// lasciare mai riquadri vuoti se un progetto ne ha meno di 10.
function buildGallery(urls, container) {
    let i = 0;
    while (i < urls.length) {
        const mod = i % 4;
        if (mod === 2 && i + 1 < urls.length) {
            const pair = document.createElement('div');
            pair.className = 'image-row-pair';
            pair.appendChild(createGalleryImage(urls[i], 'vertical'));
            pair.appendChild(createGalleryImage(urls[i + 1], 'vertical'));
            container.appendChild(pair);
            i += 2;
        } else if (mod === 2 || mod === 3) {
            // Verticale orfana (senza compagna disponibile): resa singola, centrata.
            container.appendChild(createGalleryImage(urls[i], 'vertical solo'));
            i += 1;
        } else {
            container.appendChild(createGalleryImage(urls[i], 'horizontal'));
            i += 1;
        }
    }
}

// Rivela ogni immagine con uno zoom-in smooth dal centro quando entra in vista durante lo scroll.
function setupGalleryReveal(container) {
    const items = container.querySelectorAll('.large-image');
    if (!('IntersectionObserver' in window)) {
        items.forEach(el => el.classList.add('in-view'));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            }
        });
    }, {
        root: container,
        threshold: 0.15,
        rootMargin: '0px 0px -5% 0px'
    });
    items.forEach(el => observer.observe(el));
}
// ---------------------------------------------------------------------------

// --- UTILITY: GET ALL JSON PROJECT FILES DYNAMICALLY ---
async function getProjectFiles() {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // 1. Try local directory listing if running locally
    if (isLocal) {
        try {
            const res = await fetch('projects/');
            if (res.ok) {
                const text = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, 'text/html');
                const links = Array.from(doc.querySelectorAll('a'))
                    .map(a => a.getAttribute('href'))
                    .filter(href => href && href.endsWith('.json') && !href.endsWith('projects.json'));
                if (links.length > 0) {
                    return links.map(link => link.startsWith('projects/') ? link : `projects/${link}`);
                }
            }
        } catch (e) {
            console.warn("Failed to read local directory listing, trying fallbacks...", e);
        }
    }

    // 2. Try GitHub Contents API (works on any hosting, including Vercel + custom domain).
    // This is what lets newly-added projects from the CMS show up automatically,
    // without needing to edit this file every time.
    try {
        const user = 'nomeasy-art';
        const repo = 'webportfolio';
        const apiRes = await fetch(`https://api.github.com/repos/${user}/${repo}/contents/projects`);
        if (apiRes.ok) {
            const files = await apiRes.json();
            if (Array.isArray(files)) {
                const jsonFiles = files
                    .filter(f => f.name.endsWith('.json'))
                    .map(f => f.path);
                if (jsonFiles.length > 0) return jsonFiles;
            }
        } else {
            console.warn("GitHub API request failed with status:", apiRes.status);
        }
    } catch (e) {
        console.warn("Failed to fetch from GitHub API:", e);
    }

    // 3. Fallback: Static list of projects (useful for custom domains or Netlify/Vercel)
    return [
        "projects/san-saba.json",
        "projects/youth-screen-use-survey.json",
        "projects/golopa.json",
        "projects/chiara-gratteri.json",
        "projects/macelleria-sans.json",
        "projects/borderline.json",
        "projects/business-model-canvas.json",
        "projects/terre-di-epicuro.json"
    ];
}

// --- THEME TOGGLE (DARK / LIGHT) ---
(function () {
    const root = document.documentElement;
    const toggles = document.querySelectorAll('.theme-toggle-input');

    const applyTheme = (isLight) => {
        root.classList.toggle('light-mode', isLight);
        toggles.forEach(t => { t.checked = isLight; });
        try { localStorage.setItem('theme', isLight ? 'light' : 'dark'); } catch (e) { }
    };

    // Sync checkbox state with the (possibly already-applied) theme on load
    applyTheme(root.classList.contains('light-mode'));

    toggles.forEach(toggle => {
        toggle.addEventListener('change', () => applyTheme(toggle.checked));
    });
})();
// ------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    // --- FETCH PROJECTS FROM INDIVIDUAL JSON FILES ---
    try {
        const projectPaths = await getProjectFiles();
        const projects = await Promise.all(
            projectPaths.map(async (path) => {
                const fileRes = await fetch(path);
                if (!fileRes.ok) {
                    throw new Error(`Failed to load project at path: ${path}`);
                }
                return await fileRes.json();
            })
        );

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
    // -------------------------------------------------

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
        if (e.target.closest('a, button, .project-image-placeholder, .close-detail, .theme-toggle')) {
            cursor.classList.add('is-clickable');
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.target.closest('a, button, .project-image-placeholder, .close-detail, .theme-toggle')) {
            cursor.classList.remove('is-clickable');
        }
    });
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
    const sidebarEl = document.querySelector('.sidebar');
    const closeBtns = document.querySelectorAll('.close-detail, .close-detail-mobile');

    placeholders.forEach(placeholder => {
        placeholder.addEventListener('click', () => {
            const col = placeholder.closest('.category-column');
            if (!col) return;

            // Calcola di quante posizioni deve spostarsi a sinistra
            const colIndex = allColumnsIncludingSidebar.indexOf(col);
            // La sidebar (index 0) sparisce, quindi la colonna selezionata deve
            // spostarsi fino a occupare il suo slot: spostamento = colIndex slot.
            const slotsToMove = colIndex;

            // Applica l'animazione di spostamento verso sinistra.
            // Visto che la colonna ha margin-left: -1.25rem, la sua larghezza (100%) è track + 1.25rem.
            // Per spostarsi di track + gap (2.5rem), dobbiamo sommare 1.25rem al 100% (non 2.5rem).
            col.style.transform = `translateX(calc(-${slotsToMove * 100}% - ${slotsToMove * 1.25}rem))`;
            col.classList.add('active-column');

            // Fai crollare verso il basso le altre colonne category
            allCols.forEach(c => {
                if (c !== col) {
                    c.classList.add('hidden-column');
                }
            });

            // Fai crollare verso il basso anche la sidebar (Design Gallery)
            if (sidebarEl) {
                sidebarEl.classList.add('hidden-column');
            }

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
                    buildGallery(galleryUrls, detailScroll);
                    setupGalleryReveal(detailScroll);
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

                // Ripristina la sidebar (Design Gallery)
                if (sidebarEl) {
                    sidebarEl.classList.remove('hidden-column');
                }

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
