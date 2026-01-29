import { createElement, onDestroy } from "../../lib/skeleton/index.js";
import { loadCSS } from "../../helpers/loader.js";
import { createModal } from "../../components/modal.js";
import { BlobReader, BlobWriter, ZipReader, HttpRangeReader } from "./lib/zip/index.js";

let modal;

// ========= i18n variables =========
const lang = (((navigator.languages && navigator.languages[0]) || navigator.language || "en") + "").toLowerCase();
const isFr = lang.startsWith("fr");

const fr = {
    LOADING: "Chargement…",
    DOWNLOAD_ARCHIVE: "Télécharger l’archive",
    COLUMN_PATH: "Nom",
    COLUMN_SIZE: "Taille",
    COLUMN_ACTIONS: "Actions",
    PAGER_PREV: "← Précédent",
    PAGER_NEXT: "Suivant →",
    PAGEINFO: ({ current, total }) => `Page ${current} / ${total}`,
    META_PREFIX: ({ count }) => `${count} ${count > 1 ? "entrées" : "entrée"} — `,
    META_PREFIX_COMPACT: ({ count }) => `${count} ${count > 1 ? "entrées" : "entrée"} `,
    BULK_EXTRACT: "Extraire la sélection",
    SELECT_ALL: "Tout sélectionner",
    SELECTED: ({ n }) => `x${n}`,
    PREVIEW: "Aperçu",
    EXTRACT: "Extraire",
    BACK: "← Retour",
    BROWSE: "Naviguer",
    PREVIEW_TRUNCATED: ({ kb }) => `Aperçu tronqué : affichage limité à ${kb} KB.`,
    PREVIEW_NOT_AVAILABLE: ({ ext }) => `Aperçu non disponible pour .${ext}`,
    ERR_READ_ARCHIVE: ({ msg }) => `Impossible de lire l’archive: ${msg}`,
    ERR_GENERIC: ({ msg }) => `Erreur: ${msg}`,
    DOWNLOAD_FALLBACK_NAME: "téléchargement",
};

const en = {
    LOADING: "Loading…",
    DOWNLOAD_ARCHIVE: "Download archive",
    COLUMN_PATH: "Name",
    COLUMN_SIZE: "Size",
    COLUMN_ACTIONS: "Actions",
    PAGER_PREV: "← Previous",
    PAGER_NEXT: "Next →",
    PAGEINFO: ({ current, total }) => `Page ${current} / ${total}`,
    META_PREFIX: ({ count }) => `${count} ${count === 1 ? "entry" : "entries"} — `,
    META_PREFIX_COMPACT: ({ count }) => `${count} ${count === 1 ? "entry" : "entries"} `,
    BULK_EXTRACT: "Extract selection",
    SELECT_ALL: "Select all",
    SELECTED: ({ n }) => `x${n}`,
    PREVIEW: "Preview",
    EXTRACT: "Extract",
    BACK: "← Back",
    BROWSE: "Browse",
    PREVIEW_TRUNCATED: ({ kb }) => `Preview truncated: display limited to ${kb} KB.`,
    PREVIEW_NOT_AVAILABLE: ({ ext }) => `Preview not available for .${ext}`,
    ERR_READ_ARCHIVE: ({ msg }) => `Unable to read archive: ${msg}`,
    ERR_GENERIC: ({ msg }) => `Error: ${msg}`,
    DOWNLOAD_FALLBACK_NAME: "download",
};

let t = (key, vars = {}) => {
    const dict = isFr ? fr : en;
    const v = dict[key];
    return typeof v === "function" ? v(vars) : (v ?? key);
};


// modifie la création de la cellule select

// Met un label + une icône dans le bouton/lien.
// CSS gèrera: desktop => texte visible, mobile => icône visible.
function setResponsiveIconLabel(el, label, iconClass) {
    el.setAttribute("aria-label", label); // accessible name quand le texte est masqué

    const icon = document.createElement("span");
    icon.className = `btn-icon ${iconClass}`;
    icon.setAttribute("aria-hidden", "true"); // image décorative

    const span = document.createElement("span");
    span.className = "btn-label";
    span.textContent = label;

    el.textContent = ""; // nettoie
    el.appendChild(icon);
    el.appendChild(span);
}

// ====== Path truncation helpers (middle "...") ======
function normalizeAbsPath(p) {
    let s = String(p || "/").replace(/\\/g, "/");
    s = s.replace(/\/+/g, "/");
    if (!s.startsWith("/")) s = "/" + s;
    if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
    return s;
}

function ellipsizeMiddle(str, keepStart, keepEnd, ell = "...") {
    const s = String(str);
    if (s.length <= keepStart + keepEnd + ell.length) return s;
    return s.slice(0, keepStart) + ell + s.slice(s.length - keepEnd);
}

function createTextMeasurer(referenceEl) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const cs = getComputedStyle(referenceEl);
    const font = cs.font && cs.font !== ""
        ? cs.font
        : `${cs.fontStyle} ${cs.fontVariant} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`;
    ctx.font = font;

    const letterSpacing = parseFloat(cs.letterSpacing || "0") || 0;

    return (text) => {
        const t = String(text);
        const w = ctx.measureText(t).width;
        return letterSpacing ? w + letterSpacing * Math.max(0, t.length - 1) : w;
    };
}

function fitGenericMiddle(text, maxWidth, measure, ell = "...") {
    const s = String(text);
    if (maxWidth <= 0) return "";
    if (measure(s) <= maxWidth) return s;

    if (measure(ell) > maxWidth) return ".";

    let lo = 0;
    let hi = s.length;
    let best = ell;

    while (lo <= hi) {
        const keep = Math.floor((lo + hi) / 2);
        const keepStart = Math.ceil(keep / 2);
        const keepEnd = keep - keepStart;
        const cand = ellipsizeMiddle(s, keepStart, keepEnd, ell);

        if (measure(cand) <= maxWidth) {
            best = cand;
            lo = keep + 1;
        } else {
            hi = keep - 1;
        }
    }
    return best;
}

function truncSegment(str, keepTotal, bias, ell = "...") {
    const s = String(str);
    if (keepTotal >= s.length) return s;
    if (s.length <= ell.length + 2) return s;

    keepTotal = Math.max(2, Math.min(keepTotal, s.length - ell.length));

    let keepStart;
    if (bias === "start") keepStart = Math.max(1, Math.ceil(keepTotal * 0.7));
    else if (bias === "end") keepStart = Math.max(1, Math.floor(keepTotal * 0.3));
    else keepStart = Math.max(1, Math.ceil(keepTotal / 2));

    let keepEnd = keepTotal - keepStart;
    if (keepEnd < 1) { keepEnd = 1; keepStart = keepTotal - 1; }

    return ellipsizeMiddle(s, keepStart, keepEnd, ell);
}

function bestTruncateSegmentToFit(original, maxWidth, measure, buildCandidate, bias) {
    const s = String(original);
    if (measure(buildCandidate(s)) <= maxWidth) return s;
    if (s.length <= 3) return s;

    let lo = 2;
    let hi = s.length;
    let best = null;

    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const t = truncSegment(s, mid, bias, "...");
        const cand = buildCandidate(t);

        if (measure(cand) <= maxWidth) {
            best = t;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    return best ?? truncSegment(s, 2, bias, "...");
}

function fitPathForWidth(fullPath, maxWidth, measure) {
    const p = normalizeAbsPath(fullPath);
    if (maxWidth <= 0) return "";
    if (measure(p) <= maxWidth) return p;

    const segs = p.split("/").filter(Boolean);
    if (segs.length === 0) return "/";

    if (segs.length === 1) return fitGenericMiddle(p, maxWidth, measure, "...");

    const first = segs[0];
    const last = segs[segs.length - 1];

    // Si possible, on garde 2 segments de fin: /first/.../parent/current
    if (segs.length >= 3) {
        const last2 = segs.slice(-2).join("/");
        const cand2 = `/${first}/.../${last2}`;
        if (measure(cand2) <= maxWidth) return cand2;
    }

    // Sinon: /first/.../current
    let cand = `/${first}/.../${last}`;
    if (measure(cand) <= maxWidth) return cand;

    // Dernier recours: tronquer d'abord le début, puis la fin
    const firstFit = bestTruncateSegmentToFit(
        first,
        maxWidth,
        measure,
        (f) => `/${f}/.../${last}`,
        "start"
    );
    cand = `/${firstFit}/.../${last}`;
    if (measure(cand) <= maxWidth) return cand;

    const lastFit = bestTruncateSegmentToFit(
        last,
        maxWidth,
        measure,
        (l) => `/${firstFit}/.../${l}`,
        "end"
    );
    cand = `/${firstFit}/.../${lastFit}`;
    if (measure(cand) <= maxWidth) return cand;

    return fitGenericMiddle(p, maxWidth, measure, "...");
}

function extOf(filename = "") {
    const base = filename.split("/").pop() || filename;
    const i = base.lastIndexOf(".");
    if (i <= 0) return "";
    return base.slice(i + 1).toLowerCase();
}

function baseNameFromPath(p = "") {
    // normalise et enlève un éventuel "/" final (cas des dossiers)
    const s = String(p).replace(/\\/g, "/").replace(/\/+$/g, "");
    const parts = s.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "/";
}

function humanSize(bytes) {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return "";

    const thresh = 1000; // 1000 B = 1 KB (comme tu le décris)
    const units = ["KB", "MB", "GB", "TB", "PB", "EB"];

    // En dessous de 1000 => on reste simple et court
    if (Math.abs(bytes) < thresh) return `${Math.round(bytes)} B`;

    let u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);

    // Anti-cas-limite: 999.95 KB -> "1000.0 KB" (ça ferait 4 chiffres)
    // => on promeut à l’unité supérieure si l’arrondi dépasse 1000.0
    let out = bytes.toFixed(1);
    while (Number(out) >= thresh && u < units.length - 1) {
        bytes /= thresh;
        ++u;
        out = bytes.toFixed(1);
    }

    return `${out} ${units[u]}`;
}

function isDir(entry) {
    // zip.js uses `directory` boolean on entries; fallback to filename ending with "/"
    return Boolean(entry.directory) || (typeof entry.filename === "string" && entry.filename.endsWith("/"));
}

function isImageExt(ext) {
    return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext);
}

function isTextExt(ext) {
    return ["txt", "md", "json", "csv", "log", "xml", "yaml", "yml", "ini", "conf", "js", "ts", "css", "html", "diff", "patch"].includes(ext);
}

const MAX_TEXT_PREVIEW = 512 * 1024; // 512KB

function looksLikeText(u8) {
    // NUL byte => quasi toujours binaire
    for (let i = 0; i < u8.length; i++) if (u8[i] === 0) return false;

    let bad = 0;
    for (let i = 0; i < u8.length; i++) {
        const c = u8[i];
        const ok =
            c === 9 || c === 10 || c === 13 ||       // \t \n \r
            (c >= 32 && c <= 126) ||                 // ASCII imprimable
            c >= 128;                                // UTF-8 multibyte (approx)
        if (!ok) bad++;
    }
    return (bad / Math.max(1, u8.length)) < 0.2;
}

async function getTextPreviewChunk(entry) {
    // zip.js: on récupère un Blob, puis on ne lit que le début
    const blob = await entry.getData(new BlobWriter());
    const truncated = blob.size > MAX_TEXT_PREVIEW;

    // Blob.slice() pour ne lire que les premiers octets
    const buf = await blob.slice(0, MAX_TEXT_PREVIEW).arrayBuffer();
    const u8 = new Uint8Array(buf);

    if (!looksLikeText(u8)) return { text: null, truncated: false };

    // TextDecoder est l’API standard navigateur
    const decoder = new TextDecoder("utf-8", { fatal: false });
    return { text: decoder.decode(u8), truncated };
}

let __archiveScrollLock = null;

function lockDocumentScrollForArchiveModal() {
    if (__archiveScrollLock) return;

    const docEl = document.documentElement;
    const body = document.body;

    __archiveScrollLock = {
        htmlOverflow: docEl.style.overflow,
        bodyOverflow: body.style.overflow,
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyWidth: body.style.width,
        scrollY: window.scrollY || docEl.scrollTop || 0,
    };

    // Bloque le scroll “page” derrière le modal
    docEl.style.overflow = "hidden";
    body.style.overflow = "hidden";

    // iOS/Safari: overflow hidden seul est parfois insuffisant => position fixed
    body.style.position = "fixed";
    body.style.top = `-${__archiveScrollLock.scrollY}px`;
    body.style.width = "100%";
}

function unlockDocumentScrollForArchiveModal() {
    if (!__archiveScrollLock) return;

    const docEl = document.documentElement;
    const body = document.body;
    const s = __archiveScrollLock;
    __archiveScrollLock = null;

    docEl.style.overflow = s.htmlOverflow;
    body.style.overflow = s.bodyOverflow;
    body.style.position = s.bodyPosition;
    body.style.top = s.bodyTop;
    body.style.width = s.bodyWidth;

    window.scrollTo(0, s.scrollY);
}

function styleArchiveModal(contentNode, { onClose } = {}) {
    let tries = 0;

    const apply = () => {
        tries += 1;

        const box = document.getElementById("modal-box");
        const popup = box && box.querySelector(".component_popup");
        const msg = box && box.querySelector(".modal-message");

        // On attend que le contenu soit réellement injecté dans le modal
        if (box && popup && msg && msg.contains(contentNode)) {
            box.classList.add("archive_viewer_modal");
            lockDocumentScrollForArchiveModal();

            // Délock automatique quand le modal se ferme (la classe disparaît / modal-box change)
            const obs = new MutationObserver(() => {
                const b = document.getElementById("modal-box");
                if (!b || !b.classList.contains("archive_viewer_modal")) {
                    obs.disconnect();
                    unlockDocumentScrollForArchiveModal();
                    if (typeof onClose === "function") onClose();
                }
            });
            obs.observe(document.body, { subtree: true, attributes: true, childList: true });

            return;
        }
        if (tries < 20) requestAnimationFrame(apply);
    };

    requestAnimationFrame(apply);
}

async function previewEntry(entry) {
    const ext = extOf(entry.filename);

    // Images: on garde ton comportement actuel (sinon une image "coupée" ne s’affichera pas)
    if (isImageExt(ext)) {
        const mime = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
        const blob = await entry.getData(new BlobWriter(mime));
        const url = URL.createObjectURL(blob);
        const revoke = () => URL.revokeObjectURL(url);

        // sécurité si le viewer est détruit pendant qu'un modal est ouvert
        onDestroy(revoke);
        const wrap = document.createElement("div");
        wrap.className = "archive_modal_body";

        const img = document.createElement("img");
        img.src = url;
        img.alt = baseNameFromPath(entry.filename);

        wrap.appendChild(img);
        modal(wrap);
        styleArchiveModal(wrap, { onClose: revoke });

        return;
    }

    // Texte: toujours chunké (même si extension connue)
    const { text, truncated } = await getTextPreviewChunk(entry);
    if (text != null) {
        const wrap = document.createElement("div");
        wrap.className = "archive_modal_body";

        if (truncated) {
            const notice = document.createElement("div");
            notice.className = "archive_modal_notice";
            notice.textContent = t("PREVIEW_TRUNCATED", { kb: Math.round(MAX_TEXT_PREVIEW / 1024) });
            wrap.appendChild(notice);
        }

        const pre = document.createElement("pre");
        pre.textContent = text; // safe
        wrap.appendChild(pre);

        modal(wrap);
        styleArchiveModal(wrap);

        return;
    }

    const node = document.createElement("div");
    node.style.padding = "10px";
    node.textContent = t("PREVIEW_NOT_AVAILABLE", { ext: ext || "?" });
    modal(node);
    styleArchiveModal(node);
    return;
}

async function downloadEntry(entry) {
    const ext = extOf(entry.filename);
    const mime = isImageExt(ext)
        ? (ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`)
        : "application/octet-stream";

    const blob = await entry.getData(new BlobWriter(mime));
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = entry.filename.split("/").pop() || t("DOWNLOAD_FALLBACK_NAME");

    // (petit +) meilleure compat : click sur un <a> dans le DOM
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Laisse le navigateur démarrer le téléchargement puis libère la mémoire
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default async function (render, { getDownloadUrl, getFilename, $menubar }) {
    await loadCSS(import.meta.url, "./loader_archive.css");
    modal = createModal({ withButtonsLeft: null, withButtonsRight: null });




    const $page = createElement(`
        <div class="component_archive_viewer">
            <div class="archive_header">
                <div class="archive_topline">
                    <div class="muted archive_meta" data-bind="meta"></div>
                    <a class="btn-primary btn-download" data-bind="downloadArchive"></a>
                </div>
            </div>
            <div class="archive_status" data-bind="status"></div>
            <div class="archive_bulkbar" data-bind="bulkbar" style="display:none;">
                <div class="bulk-left">
                    <button type="button" class="btn-primary" data-bind="bulkExtract" disabled></button>
                    <button type="button" class="btn-back" data-bind="btnBack"></button>
                </div>
                <span class="muted" data-bind="bulkInfo"></span>
            </div>
            <div class="archive_tablewrap" data-bind="tablewrap" style="display:none; overflow-x:auto;" tabindex="0">
            <table data-bind="table">
                <colgroup>
                <col class="col-select" />
                <col class="col-path" />
                <col class="col-size" />
                <col class="col-actions" />
                </colgroup>
                <thead>
                <tr>
                    <th class="th-select">
                    <input id="archive_selectall" name="archive_selectall" type="checkbox" data-bind="selectall" />
                    </th>
                    <th data-bind="thPath"></th>
                    <th class="th-size" data-bind="thSize"></th>
                    <th class="th-actions" data-bind="thActions"></th>
                </tr>
                </thead>
                <tbody data-bind="tbody"></tbody>
            </table>
            </div>
            <div class="archive_pager" data-bind="pager" style="display:none;">
                <button type="button" class="btn-primary btn-pager" data-bind="prev"></button>
                <span class="muted" data-bind="pageinfo"></span>
                <button type="button" class="btn-primary btn-pager" data-bind="next"></button>
            </div>
        </div>
    `);

    render($page);

    const $status = $page.querySelector('[data-bind="status"]');
    const $meta = $page.querySelector('[data-bind="meta"]');
    const $tableWrap = $page.querySelector('[data-bind="tablewrap"]');
    const $table = $page.querySelector('[data-bind="table"]');
    const $tbody = $page.querySelector('[data-bind="tbody"]');
    const $pager = $page.querySelector('[data-bind="pager"]');
    const $btnPrev = $page.querySelector('[data-bind="prev"]');
    const $btnNext = $page.querySelector('[data-bind="next"]');
    const $btnBack = $page.querySelector('[data-bind="btnBack"]');
    const $pageInfo = $page.querySelector('[data-bind="pageinfo"]');
    const $bulkbar = $page.querySelector('[data-bind="bulkbar"]');
    const $bulkExtract = $page.querySelector('[data-bind="bulkExtract"]');
    const $bulkInfo = $page.querySelector('[data-bind="bulkInfo"]');
    const $selectAll = $page.querySelector('[data-bind="selectall"]');
    const $downloadArchive = $page.querySelector('[data-bind="downloadArchive"]');
    const $thPath = $page.querySelector('[data-bind="thPath"]');
    const $thSize = $page.querySelector('[data-bind="thSize"]');
    const $thActions = $page.querySelector('[data-bind="thActions"]');

    // Textes visibles init (avant le fetch)
    $status.textContent = t("LOADING");
    if ($thPath) $thPath.textContent = t("COLUMN_PATH");
    if ($thSize) $thSize.textContent = t("COLUMN_SIZE");
    if ($thActions) $thActions.textContent = t("COLUMN_ACTIONS");

    $btnPrev.textContent = t("PAGER_PREV");
    $btnNext.textContent = t("PAGER_NEXT");

    // Accessibilité (utile car tes labels peuvent être masqués en mobile)
    $selectAll.setAttribute("aria-label", t("SELECT_ALL")); // aria-label = nom accessible

    // --- Column autosizing (Actions column shrinks/grows with its buttons) ---
    const $colSelect = $table.querySelector("col.col-select");
    const $colSize = $table.querySelector("col.col-size");
    const $colActions = $table.querySelector("col.col-actions");

    const mq = window.matchMedia("(max-width: 768px)");

    // NEW: petit écran + tactile (smartphone/tablette)
    // - pointer:coarse = dispositif principal "doigt"
    // - any-pointer:coarse = au moins un dispositif "doigt"
    const mqTouchSmall = window.matchMedia("(max-width: 768px) and (pointer: coarse)");
    const mqAnyTouchSmall = window.matchMedia("(max-width: 768px) and (any-pointer: coarse)");

    const isTouchSmall = () =>
        mqTouchSmall.matches ||
        mqAnyTouchSmall.matches ||
        (mq.matches && (navigator.maxTouchPoints || 0) > 0);

    let _syncScheduled = false;
    const scheduleSyncColumns = () => {
        if (_syncScheduled) return;
        _syncScheduled = true;
        requestAnimationFrame(() => {
            _syncScheduled = false;
            syncColumnsNow();
        });
    };

    function syncColumnsNow() {
        if (!$table) return;

        const isMobile = mq.matches;
        const isCoarse =
            window.matchMedia("(pointer: coarse)").matches ||
            window.matchMedia("(any-pointer: coarse)").matches;

        // IMPORTANT: condition alignée avec ton CSS:
        // @media (max-width: 768px) and (pointer: coarse)
        const touchSmall = isMobile && isCoarse;

        // Largeurs DÉTERMINISTES (doivent matcher le CSS colgroup)
        const selectW = touchSmall ? "0px" : "38px";

        // Taille: "xxx.x XX" (= 8 chars) + padding horizontal (6px + 6px)
        const sizeW = "calc(8ch + 12px)";

        // Actions: géré plus bas (mobile vs desktop)
        const actionsW = isMobile ? "90px" : "260px";

        if ($colActions) $colActions.style.width = actionsW;
        if ($colSize) $colSize.style.width = sizeW;
        if ($colSelect) $colSelect.style.width = selectW;
    }




    // La meta est maintenant sur la “top line” (à gauche)
    $meta.textContent = "";

    $downloadArchive.href = getDownloadUrl();
    setResponsiveIconLabel($downloadArchive, t("DOWNLOAD_ARCHIVE"), "icon-download");
    $downloadArchive.setAttribute("download", getFilename());

    try {
        const url = getDownloadUrl();

        let zipReader;

        // 1) Probe Range: si 206 => on lit en Range (rapide, pas de download complet)
        // Si le serveur ignore Range, il peut répondre 200 + TOUT le fichier (donc on réutilise la réponse)
        const controller = new AbortController();
        onDestroy(() => controller.abort());

        const probe = await fetch(url, {
            headers: { Range: "bytes=0-0" },
            signal: controller.signal,
        });

        if (probe.status === 206) {
            // Range supporté => lecture HTTP "à la demande"
            probe.body?.cancel?.(); // on n'a besoin que du status
            zipReader = new ZipReader(new HttpRangeReader(url), { signal: controller.signal });
        } else if (probe.ok) {
            // Range non supporté ou ignoré => probe contient potentiellement le fichier complet
            const buf = await probe.arrayBuffer();
            const blob = new Blob([buf], { type: "application/zip" });
            zipReader = new ZipReader(new BlobReader(blob), { signal: controller.signal });
        } else {
            throw new Error(`HTTP ${probe.status}`);
        }

        // IMPORTANT: ne pas fermer ici (sinon preview/extract fera des fetch Range plus tard)
        onDestroy(() => zipReader.close());

        const entries = await zipReader.getEntries();

        // --- Responsive rows per page (PAGE_SIZE dynamique) ---
        // Valeurs garde-fou (évite 0 ligne sur petites hauteurs / évite des pages énormes)
        let pageSize = 15;      // fallback
        const PAGE_MIN = 4;
        const PAGE_MAX = 30;

        let currentPage = 1;
        let totalPages = 1;     // recalculé dans renderPage()

        let _pageSizeScheduled = false;

        // Mesure de la hauteur d’une ligne (sinon fallback ~ ta hauteur CSS)
        const measureRowHeight = () => {
            const tr = $tbody.querySelector("tr");
            const h = tr ? tr.getBoundingClientRect().height : 0; // DOMRect via getBoundingClientRect()
            return h > 0 ? h : 48.67; // fallback (correspond à ton CSS)
        };

        // Calcule combien de lignes tiennent dans la fenêtre en gardant le pager visible
        const computePageSize = () => {
            // Tant que table/pager sont cachés (display:none), on ne recalcule pas
            if ($tableWrap.style.display === "none" || $pager.style.display === "none") return pageSize;

            const viewportH = window.innerHeight; // hauteur intérieure de la fenêtre
            const wrapTop = Math.max(0, $tableWrap.getBoundingClientRect().top); // pos relative viewport
            const pagerH = $pager.getBoundingClientRect().height || 0;
            const thead = $table.querySelector("thead");
            const theadH = thead ? thead.getBoundingClientRect().height : 0;

            // marge “sécurité” pour éviter que les boutons touchent le bord bas
            const safety = 16;

            const availableForRows = viewportH - wrapTop - pagerH - theadH - safety;
            const rows = Math.floor(availableForRows / measureRowHeight());

            return Math.max(PAGE_MIN, Math.min(PAGE_MAX, rows));
        };

        const applyResponsivePageSize = () => {
            const nextSize = computePageSize();
            if (!Number.isFinite(nextSize) || nextSize <= 0) return;
            if (nextSize === pageSize) return;

            // On conserve l’index du 1er élément affiché pour éviter de “sauter” ailleurs
            const firstIndex = (currentPage - 1) * pageSize;
            pageSize = nextSize;

            const nextPage = Math.floor(firstIndex / pageSize) + 1;
            renderPage(nextPage);
        };

        const scheduleResponsivePageSize = () => {
            if (_pageSizeScheduled) return;
            _pageSizeScheduled = true;
            requestAnimationFrame(() => {
                _pageSizeScheduled = false;
                applyResponsivePageSize();
            });
        };

        function parentDir(dir) {
            if (!dir) return "";
            const parts = dir.split("/").filter(Boolean);
            parts.pop();
            return parts.join("/");
        }

        // Construit un index: dir -> { dirs:Set(fullDir), files:Array(entriesZip) }
        function buildDirIndex(entries) {
            const idx = new Map();
            const ensure = (d) => {
                if (!idx.has(d)) idx.set(d, { dirs: new Set(), files: [] });
                if (d !== "") {
                    const p = parentDir(d);
                    if (!idx.has(p)) idx.set(p, { dirs: new Set(), files: [] });
                    idx.get(p).dirs.add(d);
                }
            };

            ensure(""); // root

            for (const e of entries) {
                const fn = e && e.filename ? e.filename : "";
                if (!fn) continue;

                if (isDir(e)) {
                    const d = fn.replace(/\/+$/, "");
                    ensure(d);
                } else {
                    const parts = fn.split("/").filter(Boolean);
                    parts.pop();
                    const dir = parts.join("/");
                    // Crée tous les parents (lib, lib/zip, etc.)
                    let acc = "";
                    for (const p of parts) {
                        acc = acc ? acc + "/" + p : p;
                        ensure(acc);
                    }
                    ensure(dir);
                    idx.get(dir).files.push(e);
                }
            }
            return idx;
        }

        const dirIndex = buildDirIndex(entries);
        let currentDir = ""; // "" = racine

        function listCurrentEntries() {
            const node = dirIndex.get(currentDir) || { dirs: new Set(), files: [] };

            // dossiers (pseudo entries)
            const dirs = [...node.dirs]
                .map((d) => ({
                    directory: true,
                    filename: d + "/",
                    _display: baseNameFromPath(d),
                    _fullDir: d,
                }))
                .sort((a, b) => a._display.localeCompare(b._display, undefined, { sensitivity: "base" }));

            // fichiers (entries zip natives, SANS copie)
            const files = [...node.files].sort((a, b) =>
                baseNameFromPath(a.filename).localeCompare(baseNameFromPath(b.filename), undefined, { sensitivity: "base" })
            );

            return [...dirs, ...files];
        }

        function updateBackUI() {
            $btnBack.textContent = t("BACK");
            $btnBack.disabled = !currentDir;
        }

        // --- Meta (compteur + chemin) : rendu avec troncature au milieu ---
        let _metaCount = 0;
        let _metaFullPath = "/";
        let _metaMeasurer = null;
        let _metaScheduled = false;

        const scheduleMetaRender = () => {
            if (_metaScheduled) return;
            _metaScheduled = true;

            requestAnimationFrame(() => {
                _metaScheduled = false;

                if (!_metaMeasurer) _metaMeasurer = createTextMeasurer($meta);
                const measure = _metaMeasurer || ((t) => String(t).length * 8);

                const maxW = $meta.clientWidth || 0;

                let prefix = t("META_PREFIX", { count: _metaCount });

                // si trop serré: on garde le mot ("entrées"/"entries") mais on retire le "—"
                if (measure(prefix) > maxW) prefix = t("META_PREFIX_COMPACT", { count: _metaCount });

                // dernier recours si vraiment ultra étroit
                if (measure(prefix) > maxW) prefix = `${_metaCount} `;

                const pathBudget = Math.max(0, maxW - measure(prefix));
                const displayPath = fitPathForWidth(_metaFullPath, pathBudget, measure);

                $meta.textContent = prefix + displayPath;
                $meta.title = _metaFullPath; // tooltip = chemin complet
            });
        };

        function updateMeta(viewEntries) {
            _metaCount = viewEntries.length;

            const where = "/" + (currentDir || "");
            _metaFullPath = (where === "/" ? "/" : where);

            scheduleMetaRender();
        }

        function navigateTo(dir) {
            currentDir = dir || "";
            selected.clear();               // simple et clair quand on change de dossier
            renderPage(1);
        }

        const selected = new Set(); // filenames sélectionnés
        const byName = new Map(entries.map(e => [e.filename, e]));

        // NEW: mode sélection (utile en mobile tactile sans checkbox visibles)
        let selectionMode = false;
        const setSelectionMode = (on) => {
            selectionMode = on;
            $page.classList.toggle("is-selection-mode", on);
        };

        // ignore les taps sur éléments interactifs (boutons, checkbox, liens…)
        const isInteractiveTarget = (el) =>
            !!(el && el.closest && el.closest("button, a, input, label"));

        // centralise la synchro Set <-> checkbox <-> style ligne
        const setRowSelected = (ctx, on) => {
            const { path, tr, cb, slice } = ctx;

            if (on) selected.add(path);
            else selected.delete(path);

            if (cb) cb.checked = on;
            if (tr) tr.classList.toggle("is-selected", on);

            updateSelectAllState(slice);
            refreshBulkUI();
            scheduleSyncColumns();
        };

        const toggleRowSelected = (ctx) => setRowSelected(ctx, !selected.has(ctx.path));

        // Appui long (tactile) : sélectionne + entre en mode sélection
        const bindTouchSelection = (tr, entry, ctx) => {
            if (!isTouchSmall() || isDir(entry)) return; // dossiers jamais sélectionnables

            const LONGPRESS_MS = 450;
            const MOVE_TOL = 10;

            let timer = null;
            let startX = 0;
            let startY = 0;
            let suppressClick = false;

            const clear = () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            };

            tr.addEventListener("pointerdown", (e) => {
                if (!isTouchSmall()) return;
                if (e.pointerType && e.pointerType !== "touch") return;
                if (e.button !== undefined && e.button !== 0) return;
                if (isInteractiveTarget(e.target)) return;

                suppressClick = false;
                startX = e.clientX;
                startY = e.clientY;

                clear();
                timer = setTimeout(() => {
                    timer = null;
                    suppressClick = true;     // évite le click qui suit le long-press
                    toggleRowSelected(ctx);   // entre en mode sélection
                }, LONGPRESS_MS);
            }, { passive: true });

            tr.addEventListener("pointermove", (e) => {
                if (!timer) return;
                if (
                    Math.abs(e.clientX - startX) > MOVE_TOL ||
                    Math.abs(e.clientY - startY) > MOVE_TOL
                ) {
                    clear(); // scroll / mouvement => pas un long-press
                }
            }, { passive: true });

            tr.addEventListener("pointerup", clear, { passive: true });
            tr.addEventListener("pointercancel", clear, { passive: true });

            // Tap simple: toggle SEULEMENT si on est déjà en mode sélection
            tr.addEventListener("click", (e) => {
                if (!isTouchSmall()) return;
                if (isInteractiveTarget(e.target)) return;
                if (suppressClick) { suppressClick = false; return; }
                if (!selectionMode) return;
                toggleRowSelected(ctx);
            });

            // Optionnel: évite le menu contextuel au long-press (Chrome/Android)
            tr.addEventListener("contextmenu", (e) => {
                if (isTouchSmall()) e.preventDefault();
            });
        };

        $bulkExtract.textContent = t("BULK_EXTRACT");
        $selectAll.setAttribute("aria-label", t("SELECT_ALL"));

        function refreshBulkUI() {
            const n = selected.size;
            setSelectionMode(n > 0);
            $bulkbar.style.display = "";
            $bulkExtract.disabled = n === 0;
            $bulkInfo.textContent = n ? t("SELECTED", { n }) : "";
        }

        function updateSelectAllState(slice) {
            const files = slice.filter(e => !isDir(e));
            const checked = files.filter(e => selected.has(e.filename)).length;
            $selectAll.checked = files.length > 0 && checked === files.length;
            $selectAll.indeterminate = checked > 0 && checked < files.length;
        }

        $bulkExtract.addEventListener("click", async () => {
            const list = [...selected]
                .map(name => byName.get(name))
                .filter(e => e && !isDir(e));

            // petit délai pour éviter certains blocages de downloads multiples
            for (const e of list) {
                downloadEntry(e);
                await new Promise(r => setTimeout(r, 250));
            }
        });

        function renderPage(page) {
            const viewEntries = listCurrentEntries();
            totalPages = Math.max(1, Math.ceil(viewEntries.length / pageSize));
            currentPage = Math.min(Math.max(1, page), totalPages);

            // Clear
            $tbody.innerHTML = "";

            const start = (currentPage - 1) * pageSize;
            const end = Math.min(viewEntries.length, start + pageSize);
            const slice = viewEntries.slice(start, end);

            for (const entry of slice) {
                const tr = document.createElement("tr");
                const path = entry.filename;
                const size = entry.uncompressedSize ?? entry.compressedSize ?? "";
                const is_directory = isDir(entry);
                if (is_directory) tr.classList.add("is-dir-row");
                const ctx = { path, tr, cb: null, slice };

                // 1) select (checkbox uniquement pour les fichiers, icône pour les dossiers)
                const tdSel = document.createElement("td");
                tdSel.className = "cell-select";

                if (is_directory) {
                    const icon = document.createElement("span");
                    icon.className = "folder-icon icon-folder";
                    icon.setAttribute("aria-hidden", "true");
                    tdSel.appendChild(icon);
                } else {
                    const cb = document.createElement("input");
                    cb.type = "checkbox";
                    cb.setAttribute("aria-label", baseNameFromPath(path));
                    cb.className = "row-select";
                    cb.checked = selected.has(path);
                    ctx.cb = cb;

                    // NEW: centralise la logique (Set + UI + mode sélection)
                    cb.addEventListener("change", () => setRowSelected(ctx, cb.checked));

                    tdSel.appendChild(cb);

                    // NEW: permet de voir la sélection même si la checkbox est cachée
                    tr.classList.toggle("is-selected", cb.checked);
                }

                // 2) chemin
                const tdPath = document.createElement("td");
                tdPath.className = "cell-path";
                tdPath.title = path;

                // NEW: wrapper block => ellipsis fiable
                const pathSpan = document.createElement("span");
                pathSpan.className = "path-ellipsis";
                pathSpan.textContent = baseNameFromPath(path);
                tdPath.appendChild(pathSpan);

                if (is_directory) tdPath.classList.add("is-dir");

                // 3) taille
                const tdSize = document.createElement("td");
                tdSize.className = "cell-size";
                tdSize.textContent = is_directory ? "" : humanSize(size);

                // 4) actions (wrapper toujours présent => folders ne cassent plus)
                const tdActions = document.createElement("td");
                tdActions.className = "cell-actions";

                const actionsWrap = document.createElement("div");
                actionsWrap.className = "actions-wrap";
                tdActions.appendChild(actionsWrap);

                if (!is_directory) {
                    const btnPreview = document.createElement("button");
                    btnPreview.className = "btn-action";
                    setResponsiveIconLabel(btnPreview, t("PREVIEW"), "icon-preview")
                    btnPreview.addEventListener("click", () => previewEntry(entry));

                    const btnDl = document.createElement("button");
                    btnDl.className = "btn-action";
                    setResponsiveIconLabel(btnDl, t("EXTRACT"), "icon-extract");
                    btnDl.addEventListener("click", () => downloadEntry(entry));

                    actionsWrap.appendChild(btnPreview);
                    actionsWrap.appendChild(btnDl);
                } else {
                    const btnBrowse = document.createElement("button");
                    btnBrowse.className = "btn-action btn-browse";
                    setResponsiveIconLabel(btnBrowse, t("BROWSE"), "icon-browse");
                    btnBrowse.addEventListener("click", () => {
                        navigateTo(entry._fullDir || entry.filename.replace(/\/+$/, ""));
                    });

                    // placeholder pour garder "Browse" à l’emplacement du bouton Aperçu
                    const placeholder = document.createElement("button");
                    placeholder.type = "button";
                    placeholder.className = "btn-action action-placeholder";
                    placeholder.disabled = true;
                    placeholder.tabIndex = -1;
                    placeholder.setAttribute("aria-hidden", "true");
                    // occupe exactement la même place qu’un vrai bouton, mais invisible
                    placeholder.style.visibility = "hidden";
                    placeholder.style.pointerEvents = "none";

                    actionsWrap.appendChild(btnBrowse);
                    actionsWrap.appendChild(placeholder);
                }

                if (is_directory) {
                    tdPath.style.cursor = "pointer";
                    tdPath.setAttribute("role", "button");
                    tdPath.tabIndex = 0;
                    tdPath.addEventListener("keydown", (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigateTo(entry._fullDir);
                        }
                    });
                    tdPath.addEventListener("click", () => {
                        navigateTo(entry._fullDir || entry.filename.replace(/\/+$/, ""));
                    });
                }

                tr.appendChild(tdSel);
                tr.appendChild(tdPath);
                tr.appendChild(tdSize);
                tr.appendChild(tdActions);
                $tbody.appendChild(tr);
                // NEW: mobile tactile => appui long pour entrer en sélection + tap en mode sélection
                bindTouchSelection(tr, entry, ctx);
            }

            // Ajoute des lignes vides pour garder la hauteur constante (pageSize)
            for (let i = slice.length; i < pageSize; i++) {
                const tr = document.createElement("tr");
                tr.className = "row-filler";

                for (let k = 0; k < 4; k++) {
                    const td = document.createElement("td");
                    td.textContent = "\u00A0";
                    tr.appendChild(td);
                }
                $tbody.appendChild(tr);
            }

            // Pager UI
            $pageInfo.textContent = t("PAGEINFO", { current: currentPage, total: totalPages });
            updateMeta(viewEntries);
            updateBackUI();
            $btnPrev.disabled = currentPage <= 1;
            $btnNext.disabled = currentPage >= totalPages;

            updateSelectAllState(slice);
            refreshBulkUI();
            scheduleSyncColumns();
        }

        $selectAll.addEventListener("change", () => {
            const viewEntries = listCurrentEntries();
            const start = (currentPage - 1) * pageSize;
            const end = Math.min(viewEntries.length, start + pageSize);
            const pageEntries = viewEntries.slice(start, end).filter(e => !isDir(e));

            if ($selectAll.checked) pageEntries.forEach(e => selected.add(e.filename));
            else pageEntries.forEach(e => selected.delete(e.filename));

            renderPage(currentPage);
        });

        $status.style.display = "none";
        $tableWrap.style.display = "";
        $pager.style.display = "";
        $bulkbar.style.display = "";
        scheduleSyncColumns();
        refreshBulkUI();
        updateBackUI();
        $btnBack.addEventListener("click", () => {
            if (!currentDir) return;
            currentDir = parentDir(currentDir);
            selected.clear();
            renderPage(1);

            // NEW: si la hauteur dispo a changé (ex: meta/header), recalc rows/page
            scheduleResponsivePageSize();
        });

        $btnPrev.addEventListener("click", () => renderPage(currentPage - 1));
        $btnNext.addEventListener("click", () => renderPage(currentPage + 1));

        renderPage(1);

        // NEW: 1er recalcul après le 1er rendu (mesures fiables)
        scheduleResponsivePageSize();

        // NEW: recalcul à chaque resize/orientation change
        const onViewerResize = () => {
            scheduleResponsivePageSize();
            scheduleMetaRender();
            scheduleSyncColumns();
        };
        window.addEventListener("resize", onViewerResize, { passive: true });
        window.addEventListener("orientationchange", onViewerResize, { passive: true });

        // NEW: si le container change de taille sans resize window (layout interne, modal, etc.)
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(onViewerResize);
            ro.observe($page); // ou $tableWrap si c’est lui qui scroll
            onDestroy(() => ro.disconnect());
        }

        // NEW: nettoyage quand le viewer/modal est détruit (si il y a onDestroy)
        onDestroy(() => {
            window.removeEventListener("resize", onViewerResize); // removeEventListener doit matcher la même fn
            window.removeEventListener("orientationchange", onViewerResize);
        });

    } catch (err) {
        console.error(err);
        const msg = (err && err.message) ? err.message : String(err);

        $status.textContent = t("ERR_READ_ARCHIVE", { msg });

        const errNode = createElement(`<div class="archive_modal_body"></div>`);
        errNode.textContent = t("ERR_GENERIC", { msg });

        modal(errNode);
        styleArchiveModal(errNode);
    }
}
