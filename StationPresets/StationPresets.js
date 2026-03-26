/**
 * https://github.com/R100DX/StationPresets
 * Station Presets Plugin
 * Inspired by: FM-DX-Webserver-Plugin-Button-Presets by AmateurAudioDude
 */


'use strict';

(() => {

// ============================================================
// CONFIG
// ============================================================

const BANK_NAME         = 'Bank';
const SHOW_LOGOS        = false;   // logo inside button
const SHOW_HOVER_LOGO   = true;   // logo in hover popup (works even if SHOW_LOGOS = false)
const SHOW_HOVER_LABEL  = true;   // station name in hover popup
const SHOW_BANK_BUTTONS = true;   // bank selector row
const EXTRA_DROPDOWN    = 'ant';  // 'none' | 'ims' | 'bw' | 'ant'

const LOGO_BASE  = 'https://tef.noobish.eu/logos';
const LOGO_TTL   = 7 * 24 * 60 * 60 * 1000; // 7 days

// Station format: 'COUNTRY/PICODE/FREQ/NAME/ant''
//   COUNTRY — folder on tef.noobish.eu (POL, DEU, CZE…) or 'local' → /logos/
//   PICODE  — RDS PI hex; leave empty to skip logo
//   ant''   — antenna index 0-3; ant'' = keep current
const BANKS = {
    A: { stations: [
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
    ]},
    B: { stations: [
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
    ]},
    C: { stations: [
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
    ]},
    D: { stations: [
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
        "Country/PI Code/87.5/Station Name/ant''",
    ]},
};

// ============================================================
// PARSE
// ============================================================

function parseStation(str) {
    const antMatch = str.match(/\/ant'([^']*)'\s*$/);
    const antenna  = antMatch ? antMatch[1] : '';
    const core     = str.replace(/\/ant'[^']*'\s*$/, '');
    const parts    = core.split('/');
    return {
        country: parts[0] || '',
        picode:  parts[1] || '',
        freq:    parseFloat(parts[2]) || 87.5,
        name:    parts.slice(3).join('/') || '',
        antenna,
    };
}

const bankKeys = Object.keys(BANKS);

function getStations(key) {
    return (BANKS[key]?.stations || []).map(parseStation);
}

// ============================================================
// STATE
// ============================================================

let currentBank  = bankKeys[0];
let currentIndex = 0;

// ============================================================
// LOGO CACHE
// Two layers:
//   1. In-flight dedup  — Promise map, prevents parallel fetches for same key
//   2. Resolved cache   — localStorage with 7-day TTL, survives page reloads
//   3. Directory index  — per-country file list, kept in memory for the session
// No code or logic is copied from other plugins — this is an independent
// implementation using standard Web APIs (fetch, DOMParser, localStorage).
// ============================================================

const dirIndex    = new Map(); // country → string[] (session)
const inflight    = new Map(); // cacheKey → Promise<string|null>

function storedLogo(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return undefined;
        const obj = JSON.parse(raw);
        if (Date.now() - obj.t > LOGO_TTL) { localStorage.removeItem(key); return undefined; }
        return obj.u; // string url or null (confirmed missing)
    } catch { return undefined; }
}

function storeLogo(key, url) {
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), u: url })); } catch {}
}

function sanitizeName(name) {
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function fetchDirIndex(country) {
    if (dirIndex.has(country)) return dirIndex.get(country);
    try {
        const res = await fetch(`${LOGO_BASE}/${country}/`);
        if (!res.ok) { dirIndex.set(country, []); return []; }
        const doc   = new DOMParser().parseFromString(await res.text(), 'text/html');
        const files = [...doc.querySelectorAll('a[href]')]
            .map(a => decodeURIComponent(a.getAttribute('href').split('/').pop().split('?')[0]).trim())
            .filter(f => /\.(png|svg|webp)$/i.test(f));
        dirIndex.set(country, files);
        return files;
    } catch { dirIndex.set(country, []); return []; }
}

async function findLocalLogo(pi, name) {
    const n = sanitizeName(name);
    const candidates = [
        `/logos/${pi}_${n}.svg`, `/logos/${pi}_${n}.png`,
        `/logos/${pi}.svg`,      `/logos/${pi}.png`,
    ];
    for (const path of candidates) {
        try { if ((await fetch(path, { method: 'HEAD' })).ok) return path; } catch {}
    }
    return null;
}

async function findRemoteLogo(country, pi, name) {
    const n     = sanitizeName(name);
    const files = await fetchDirIndex(country);
    const want  = [
        `${pi}_${n}.svg`, `${pi}_${n}.png`,
        `${pi}.svg`,      `${pi}.png`,
    ];
    for (const w of want) {
        const hit = files.find(f => f.toLowerCase() === w.toLowerCase());
        if (hit) return `${LOGO_BASE}/${country}/${hit}`;
    }
    return null;
}

// Single entry point — call as many times as needed, only one fetch per station
function getLogo(country, picode, name) {
    if (!picode) return Promise.resolve(null);

    const pi  = picode.toUpperCase();
    const key = `sp2_${country}_${pi}_${sanitizeName(name)}`;

    // Already resolved and stored
    const stored = storedLogo(key);
    if (stored !== undefined) return Promise.resolve(stored);

    // Deduplicate concurrent calls for the same station
    if (inflight.has(key)) return inflight.get(key);

    const promise = (async () => {
        const url = country.toLowerCase() === 'local'
            ? await findLocalLogo(pi, name)
            : await findRemoteLogo(country, pi, name);
        storeLogo(key, url);
        inflight.delete(key);
        return url;
    })();

    inflight.set(key, promise);
    return promise;
}

// ============================================================
// CSS
// ============================================================

const style = document.createElement('style');
style.textContent = `
#station-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 20px 10px;
}
#station-presets button {
    flex: 1 1 0;
    min-width: 50px;
    height: 48px;
    position: relative;
    overflow: visible;
    background: var(--color-1-transparent);
    backdrop-filter: blur(5px);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.3s;
}
#station-presets button:hover { background: var(--color-4-transparent); }
#station-presets button.active {
    background: var(--color-2-transparent) !important;
    outline: 2px solid var(--color-5-transparent) !important;
    box-shadow: 0 0 10px var(--color-3-transparent);
}
#station-presets .sp-clip {
    position: absolute;
    inset: 0;
    border-radius: 4px;
    overflow: hidden;
    pointer-events: none;
}
#station-presets .sp-logo {
    position: absolute;
    inset: 5px;
    width: calc(100% - 10px);
    height: calc(100% - 10px);
    object-fit: contain;
    pointer-events: none;
    transition: opacity 0.2s;
}
#station-presets .sp-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(2px);
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
}
#station-presets button:hover .sp-overlay { opacity: 1; }
#station-presets button:hover .sp-logo    { opacity: 0.2; }
#station-presets .sp-freq {
    display: block;
    font-size: 14px;
    color: var(--color-text);
}
#station-presets .sp-name {
    display: block;
    font-size: 11px;
    font-weight: bold;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    margin-top: 2px;
    max-width: 100%;
}
#station-presets .sp-overlay .sp-freq,
#station-presets .sp-overlay .sp-name { color: #fff; }
#station-presets .sp-popup {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: var(--color-3-transparent);
    border: 1px solid var(--color-3);
    border-radius: 10px;
    backdrop-filter: blur(4px);
    pointer-events: none;
    z-index: 30;
    white-space: nowrap;
    opacity: 0;
    transition: opacity 0.15s ease;
}
#station-presets button:hover .sp-popup { opacity: 1; }
#station-presets .sp-popup img {
    width: 80px;
    height: 40px;
    object-fit: contain;
}
#station-presets .sp-popup .sp-popup-name {
    font-size: 13px;
    color: var(--color-text);
}
@media (max-width: 728px) {
    #station-presets { display: flex !important; flex-wrap: wrap; padding: 0; }
    #station-presets button { flex: 1 1 0 !important; min-width: 55px; overflow: visible; }
}
@media (max-width: 480px) { #station-presets { margin-bottom: 40px; } }
`;
document.head.appendChild(style);

// ============================================================
// HELPERS
// ============================================================

function formatFreq(f) {
    if (f <= 27)           return f.toFixed(4).replace(/\.?0+$/, '');
    if (f > 27 && f < 76) return f.toFixed(3).replace(/\.?0+$/, '');
    return f.toFixed(2).replace(/0$/, '');
}

function activeAntenna() {
    const inp = document.querySelector('.data-ant input');
    if (!inp) return '0';
    const txt = inp.value || inp.placeholder;
    for (const o of document.querySelectorAll('.data-ant li.option')) {
        if (o.textContent.trim() === txt.trim()) return o.getAttribute('data-value') || '0';
    }
    return '0';
}

function tune(freq, antenna) {
    if (typeof socket === 'undefined' || socket.readyState !== WebSocket.OPEN) return;
    socket.send('T' + Math.round(parseFloat(freq).toFixed(3) * 1000));
    if (antenna !== '' && antenna !== activeAntenna()) socket.send('Z' + antenna);
}

// ============================================================
// HIGHLIGHT
// ============================================================

function highlight() {
    const el = document.getElementById('data-frequency');
    if (!el) return;
    const cur = parseFloat(el.textContent) || 0;
    document.querySelectorAll('#station-presets button').forEach(btn =>
        btn.classList.toggle('active', Math.abs(cur - (parseFloat(btn.dataset.freq) || 0)) < 0.001)
    );
}

function watchFreq() {
    const el = document.getElementById('data-frequency');
    if (!el) { setTimeout(watchFreq, 1000); return; }
    new MutationObserver(highlight).observe(el, { childList: true, subtree: true, characterData: true });
    highlight();
}

// ============================================================
// BUILD BUTTONS
// ============================================================

const container = document.createElement('div');
container.id = 'station-presets';

function buildButtons() {
    container.innerHTML = '';

    getStations(currentBank).forEach((s, i) => {
        const btn = document.createElement('button');
        btn.dataset.freq = s.freq;

        // Resolve logo once per station — result shared between button and popup
        const logoPromise = (SHOW_LOGOS || SHOW_HOVER_LOGO) && s.picode
            ? getLogo(s.country, s.picode, s.name)
            : Promise.resolve(null);

        if (SHOW_LOGOS && s.picode) {
            const clip    = document.createElement('div');
            clip.className = 'sp-clip';
            const img     = document.createElement('img');
            img.className  = 'sp-logo';
            img.alt        = s.name;
            const overlay  = document.createElement('div');
            overlay.className = 'sp-overlay';
            overlay.innerHTML = `<span class="sp-freq">${formatFreq(s.freq)}</span><span class="sp-name">${s.name}</span>`;
            clip.appendChild(img);
            clip.appendChild(overlay);
            btn.appendChild(clip);

            logoPromise.then(url => {
                if (url) { img.src = url; img.onerror = () => { img.style.display = 'none'; overlay.style.opacity = '1'; }; }
                else     { img.style.display = 'none'; overlay.style.opacity = '1'; }
            });
        } else {
            const fq = document.createElement('span'); fq.className = 'sp-freq'; fq.textContent = formatFreq(s.freq);
            const nm = document.createElement('span'); nm.className = 'sp-name'; nm.textContent = s.name;
            btn.appendChild(fq);
            btn.appendChild(nm);
        }

        // Hover popup
        if (SHOW_HOVER_LOGO || SHOW_HOVER_LABEL) {
            const popup = document.createElement('div');
            popup.className = 'sp-popup';

            if (SHOW_HOVER_LOGO && s.picode) {
                const popImg = document.createElement('img');
                popImg.alt   = s.name;
                logoPromise.then(url => {
                    if (url) { popImg.src = url; popImg.onerror = () => popImg.remove(); popup.prepend(popImg); }
                });
            }

            if (SHOW_HOVER_LABEL) {
                const lbl = document.createElement('span');
                lbl.className   = 'sp-popup-name';
                lbl.textContent = s.name;
                popup.appendChild(lbl);
            }

            btn.appendChild(popup);
        }

        btn.addEventListener('click', () => {
            currentIndex = i;
            tune(s.freq, s.antenna);
            setTimeout(highlight, 200);
        });

        container.appendChild(btn);
    });

    setTimeout(highlight, 100);
}

// ============================================================
// BANK SELECTOR
// ============================================================

function buildBankSelector() {
    document.addEventListener('DOMContentLoaded', () => {

        if (SHOW_BANK_BUTTONS) {
            const anchor = document.querySelector('#dashboard-panel-description .flex-container .flex-center #preset1');
            if (anchor) {
                const origRow = anchor.parentNode;
                const row     = document.createElement('div');
                row.classList.add('flex-center', 'flex-phone');
                row.style.cssText = `display:flex;flex-wrap:wrap;max-width:${origRow.style.width || '100%'}`;
                origRow.parentNode.insertBefore(row, origRow.nextSibling);

                bankKeys.forEach((key, idx) => {
                    const src = document.querySelector(`#preset${idx + 1}.no-bg.color-4.hover-brighten`);
                    if (!src) return;
                    const btn  = src.cloneNode(true);
                    btn.id     = `sp-bank-${key}`;
                    btn.style.height = '64px';
                    btn.style.filter = 'hue-rotate(45deg)';
                    const lbl  = btn.querySelector(`#preset${idx + 1}-text`);
                    if (lbl) { lbl.id = `sp-bank-${key}-text`; lbl.textContent = `${BANK_NAME} ${key}`; }
                    btn.addEventListener('click', e => {
                        e.preventDefault(); e.stopPropagation();
                        currentBank = key;
                        row.querySelectorAll('button').forEach(b => b.style.filter = 'hue-rotate(45deg)');
                        btn.style.filter = 'hue-rotate(45deg) brightness(1.4)';
                        buildButtons();
                    }, true);
                    row.appendChild(btn);
                });
            }
        }

        const dropdownAnchors = {
            ims: '.panel-50.no-bg.br-0.h-100.m-0.button-ims',
            bw:  '#data-bw.panel-50',
            ant: '#data-ant.panel-50',
        };
        if (EXTRA_DROPDOWN !== 'none') {
            const anchor = document.querySelector(dropdownAnchors[EXTRA_DROPDOWN]);
            if (anchor) {
                const dd = buildDropdown();
                if (EXTRA_DROPDOWN === 'ims') dd.style.setProperty('margin-left',  '15px', 'important');
                if (EXTRA_DROPDOWN === 'ant') dd.style.setProperty('margin-right', '15px', 'important');
                anchor.parentNode.insertBefore(dd, anchor.nextSibling);
            }
        }
    });
}

// ============================================================
// EXTRA DROPDOWN
// ============================================================

const dropdownInputs = [];

function buildDropdown() {
    const wrap = document.createElement('div');
    wrap.classList.add('panel-50', 'no-bg', 'h-100', 'm-0', 'dropdown', 'dropdown-up', 'hide-phone');
    wrap.style.minWidth   = '50px';
    wrap.style.marginLeft = '15px';

    const inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = `${BANK_NAME} ${bankKeys[0]}`; inp.readOnly = true; inp.tabIndex = 0;
    dropdownInputs.push(inp);
    wrap.appendChild(inp);

    const ul = document.createElement('ul');
    ul.classList.add('options', 'open-top'); ul.tabIndex = -1;
    bankKeys.forEach(k => {
        const li = document.createElement('li');
        li.classList.add('option'); li.dataset.value = k; li.tabIndex = 0;
        li.textContent = `${BANK_NAME} ${k}`;
        ul.appendChild(li);
    });
    wrap.appendChild(ul);

    inp.addEventListener('click', () => ul.classList.toggle('opened'));
    ul.addEventListener('click', e => {
        if (!e.target.matches('li.option')) return;
        currentBank = e.target.dataset.value;
        ul.classList.remove('opened');
        dropdownInputs.forEach(i => { i.value = `${BANK_NAME} ${currentBank}`; });
        buildButtons();
    });
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) ul.classList.remove('opened'); });
    return wrap;
}

// ============================================================
// KEYBOARD [ ]
// ============================================================

const held = new Set();
document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    const stations = getStations(currentBank);
    if (e.key === ']' && !held.has(']')) {
        held.add(']'); e.preventDefault();
        currentIndex = (currentIndex + 1) % stations.length;
        const s = stations[currentIndex]; tune(s.freq, s.antenna); setTimeout(highlight, 200);
    } else if (e.key === '[' && !held.has('[')) {
        held.add('['); e.preventDefault();
        currentIndex = (currentIndex - 1 + stations.length) % stations.length;
        const s = stations[currentIndex]; tune(s.freq, s.antenna); setTimeout(highlight, 200);
    }
});
document.addEventListener('keyup', e => held.delete(e.key));

// ============================================================
// INIT
// ============================================================

const wrapper = document.querySelector('.wrapper-outer #wrapper .flex-container');
if (wrapper && document.getElementById('rt-container')) {
    wrapper.parentNode.insertBefore(container, wrapper.nextSibling);
}

buildButtons();
watchFreq();
buildBankSelector();

})();