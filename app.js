// ============================================================
// SUPABASE : les prix viennent de la base
// (noms uniques pour ne pas entrer en conflit avec supabase-config.js)
// ============================================================
const PRIX_SB = {
    url: "https://jkzcimkpwldtoxeqifwa.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpremNpbWtwd2xkdG94ZXFpZndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NzA5ODIsImV4cCI6MjEwNjM0Njk4Mn0.K9za506Upvs8FwpUDft9DF6PsbiaZj7bxvWKAtfc-GQ",  // clé anon (publique)
    table: "produits",                     // nom de ta table
    col: {                                 // noms des colonnes de ta table
        id: 'id',
        nom: 'nom',
        description: 'description',
        prix: 'prix',
        type: 'type',
        slug: 'slug'                       // optionnel : identifiant court (nature, chocolat...)
    }
};

// Valeurs de secours si Supabase ne répond pas
const CREPES = [
    { id: 'nature', n: 'Crêpe nature', d: 'Base parfaite pour ajouter votre garniture', p: 1000, t: 'sucre' },
    { id: 'chocolat', n: 'Crêpe au chocolat', d: 'Nappage chocolat, version classique', p: 2000, t: 'sucre' },
    { id: 'jambon', n: 'Crêpe jambon béchamel', d: 'Jambon & sauce béchamel', p: 3000, t: 'sale' },
    { id: 'viande', n: 'Crêpe viande hachée fromage', d: 'Viande hachée & fromage', p: 3500, t: 'sale' },
    { id: 'fourre', n: 'Crêpe fourrée au chocolat', d: 'Chocolat fondu à l’intérieur', p: 2500, t: 'sucre' },
    { id: 'cerelac', n: 'Crêpe au cerelac / chocolat', d: 'Cerelac & chocolat', p: 2500, t: 'sucre' }
];

// Applique des lignes Supabase sur la liste CREPES
const normaliser = x => String(x || '').trim().toLowerCase();

function appliquerProduits(rows) {
    if (!Array.isArray(rows)) return;

    rows.forEach(r => {
        const col = PRIX_SB.col;
        const prix = Number(r[col.prix]);
        if (!Number.isFinite(prix)) return;

        const slug = r[col.slug] ? String(r[col.slug]) : '';
        const idBase = r[col.id] != null ? String(r[col.id]) : '';
        const nom = r[col.nom] || '';

        // On retrouve le produit du site : par slug, par id, puis par nom
        const existant =
            (slug && CREPES.find(c => c.id === slug)) ||
            (idBase && CREPES.find(c => c.id === idBase)) ||
            (nom && CREPES.find(c => normaliser(c.n) === normaliser(nom)));

        if (existant) {
            existant.p = prix;
            if (nom) existant.n = nom;
            if (r[col.description]) existant.d = r[col.description];
            if (r[col.type]) existant.t = r[col.type];
        } else if (nom) {
            // Nouveau produit ajouté dans Supabase
            CREPES.push({
                id: slug || idBase,
                n: nom,
                d: r[col.description] || '',
                p: prix,
                t: r[col.type] || 'sucre'
            });
        }
    });
}

// 1) Affichage immédiat avec les derniers prix connus (visite précédente)
try {
    appliquerProduits(JSON.parse(localStorage.getItem('produitsCache')));
} catch (e) {}

// 2) Mise à jour depuis Supabase. Les pages doivent attendre "prixPrets" avant de s'afficher.
const prixPrets = (async () => {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);

        const r = await fetch(
            PRIX_SB.url + '/rest/v1/' + PRIX_SB.table + '?select=*',
            {
                headers: {
                    apikey: PRIX_SB.key,
                    Authorization: 'Bearer ' + PRIX_SB.key
                },
                signal: ctrl.signal,
                cache: 'no-store'
            }
        );
        clearTimeout(timer);

        if (!r.ok) return;

        const rows = await r.json();
        appliquerProduits(rows);

        try { localStorage.setItem('produitsCache', JSON.stringify(rows)); } catch (e) {}
    } catch (e) {
        // Pas de réseau ou Supabase indisponible : on garde les prix de secours
    }
})();

// Tarifs de livraison en FCFA
const tarifsLivraison = {
    "Bingerville": 2500,
    "Cocody": 1500,
    "Yopougon": 1500,
    "Marcory": 2000,
    "Autres": 2500
};

const $ = s => document.querySelector(s);

const fmt = n =>
    n.toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ') + ' F CFA';

const get = (k, d) => {
    try {
        return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch (e) {
        return d;
    }
};

const put = (k, v) => {
    try {
        localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
};

const find = id => CREPES.find(c => c.id === id);
const cart = () => get('cart', {});

function setQty(id, q) {
    const c = cart();

    if (q > 0) c[id] = q;
    else delete c[id];

    put('cart', c);
}

const toLines = o =>
    Object.entries(o)
        .map(([id, q]) => ({ ...find(id), q }))
        .filter(l => l.n);

const lines = () => toLines(cart());
const count = () => lines().reduce((s, l) => s + l.q, 0);
const sub = () => lines().reduce((s, l) => s + l.p * l.q, 0);


const mode = () => get('mode', 'livraison');

const lieuLivraison = () => get('lieuLivraison', '');

// Retourne le tarif de la commune choisie.
// Retourne null si aucune commune n'est sélectionnée.
const FEE = () => {
    const lieu = lieuLivraison();

    if (!lieu || !(lieu in tarifsLivraison)) {
        return null;
    }

    return tarifsLivraison[lieu];
};

const total = () => {
    if (mode() !== 'livraison') {
        return sub();
    }

    const frais = FEE();

    return sub() + (frais === null ? 0 : frais);
};

const img = (c, k = '') =>
    `<span class="ph ${k}">
        <img src="images/${c.id}.jpg" alt="${c.n}"
        onerror="this.style.visibility='hidden'">
    </span>`;

const head = (t, r = '') =>
    `<header class="bar">
        <button class="back" onclick="history.back()" aria-label="Retour">←</button>
        <b>${t}</b>
        <span>${r}</span>
    </header>`;

const list = ls =>
    ls.map(l =>
        `<div class="row">
            <span>${l.q} × ${l.n}</span>
            <b>${fmt(l.p * l.q)}</b>
        </div>`
    ).join('');

const orderId = () => {
    let o = get('oid', null);

    if (!o) {
        o = 'M-' + (1000 + Math.floor(Math.random() * 9000));
        put('oid', o);
    }

    return o;
};

const empty = (t, a = 'panier') =>
    `${head(t)}
    <h1 class="t">Rien ici pour l’instant.</h1>
    <p class="mut">Choisissez une crêpe à la carte pour commencer.</p>
    <a class="btn full" href="index.html">Voir la carte</a>`;


// ============================================================
// APPLICATION INSTALLABLE (PWA)
// ============================================================
(function () {
    if (!document.querySelector('link[rel="manifest"]')) {
        const l = document.createElement('link');
        l.rel = 'manifest';
        l.href = 'manifest.webmanifest';
        document.head.appendChild(l);
    }
    if (!document.querySelector('meta[name="theme-color"]')) {
        const m = document.createElement('meta');
        m.name = 'theme-color';
        m.content = '#D97A1E';
        document.head.appendChild(m);
    }
    // iPhone : icône de l'écran d'accueil et mode plein écran
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
        const a = document.createElement('link');
        a.rel = 'apple-touch-icon';
        a.href = 'icons/apple-touch-icon.png';
        document.head.appendChild(a);

        const cap = document.createElement('meta');
        cap.name = 'apple-mobile-web-app-capable';
        cap.content = 'yes';
        document.head.appendChild(cap);

        const titre = document.createElement('meta');
        titre.name = 'apple-mobile-web-app-title';
        titre.content = 'CHEZSEPHO';
        document.head.appendChild(titre);
    }
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        });
    }
})();


// ============================================================
// BOUTON « INSTALLER L'APPLI » (page d'accueil uniquement)
// ============================================================
(function () {
    const dejaInstallee =
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        navigator.standalone === true;
    const accueil = /(^\/$|index\.html$)/.test(location.pathname);
    if (dejaInstallee || !accueil) return;

    try { if (localStorage.getItem('installMasque') === '1') return; } catch (e) {}

    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const iosAutreNavigateur = ios && /crios|fxios|edgios|instagram|fban|fbav|whatsapp/i.test(ua);
    let evt = null;

    function retirer() {
        const b = document.getElementById('installBanniere');
        if (b) b.remove();
    }

    function masquer() {
        try { localStorage.setItem('installMasque', '1'); } catch (e) {}
        retirer();
    }

    function banniere() {
        if (document.getElementById('installBanniere')) return;

        const b = document.createElement('div');
        b.id = 'installBanniere';
        b.setAttribute('style',
            'position:fixed;left:12px;right:12px;bottom:76px;z-index:50;' +
            'background:#fff;color:#2b2118;border:1px solid #eadfce;border-radius:14px;' +
            'box-shadow:0 6px 24px rgba(0,0,0,.15);padding:12px 14px;' +
            'display:flex;align-items:center;gap:10px;font:500 14px Inter,system-ui,sans-serif;');

        b.innerHTML =
            '<div id="installTexte" style="flex:1;line-height:1.35">' +
                '<b>Installer l’appli CHEZSEPHO.</b><br>' +
                '<span style="font-weight:400;color:#6b5d4d">Commandez plus vite depuis votre écran d’accueil.</span>' +
            '</div>' +
            '<button id="installBtn" style="background:#D97A1E;color:#fff;border:0;border-radius:10px;' +
                'padding:9px 14px;font:600 14px Inter,system-ui,sans-serif;cursor:pointer">Installer</button>' +
            '<button id="installFermer" aria-label="Fermer" style="background:none;border:0;' +
                'font-size:22px;line-height:1;color:#8a7a68;cursor:pointer;padding:0 2px">×</button>';

        document.body.appendChild(b);

        document.getElementById('installFermer').onclick = masquer;

        document.getElementById('installBtn').onclick = async () => {
            if (evt) {
                evt.prompt();
                try { await evt.userChoice; } catch (e) {}
                evt = null;
                retirer();
            } else if (ios) {
                document.getElementById('installTexte').innerHTML = iosAutreNavigateur
                    ? '<b>Ouvrez ce site dans Safari</b><br><span style="font-weight:400;color:#6b5d4d">' +
                      'Sur iPhone, l’installation se fait uniquement depuis Safari. Copiez le lien et ouvrez-le dans Safari.</span>'
                    : '<b>Sur iPhone :</b><br><span style="font-weight:400;color:#6b5d4d">' +
                      'appuyez sur le bouton Partager (carré avec une flèche), puis sur « Sur l’écran d’accueil ».</span>';
                document.getElementById('installBtn').style.display = 'none';
            }
        };
    }

    // Android / Chrome : le navigateur signale que l'installation est possible
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        evt = e;
        banniere();
    });

    // iPhone : pas d'évènement, on affiche les consignes
    if (ios) banniere();

    window.addEventListener('appinstalled', retirer);
})();
