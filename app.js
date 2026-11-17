// ============================================================
// SUPABASE : les prix viennent de la base
// (noms uniques pour ne pas entrer en conflit avec supabase-config.js)
// ============================================================
const PRIX_SB = {
    url: "https://XXXXXXXX.supabase.co",   // à remplacer
    key: "TA_CLE_ANON",                    // clé "anon / public" uniquement
    table: "produits",                     // nom de ta table
    col: {                                 // noms des colonnes de ta table
        id: 'id',
        nom: 'nom',
        description: 'description',
        prix: 'prix',
        type: 'type'
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
function appliquerProduits(rows) {
    if (!Array.isArray(rows)) return;

    rows.forEach(r => {
        const id = String(r[PRIX_SB.col.id]);
        const prix = Number(r[PRIX_SB.col.prix]);
        if (!id || !Number.isFinite(prix)) return;

        const existant = CREPES.find(c => c.id === id);

        if (existant) {
            existant.p = prix;
            if (r[PRIX_SB.col.nom]) existant.n = r[PRIX_SB.col.nom];
            if (r[PRIX_SB.col.description]) existant.d = r[PRIX_SB.col.description];
            if (r[PRIX_SB.col.type]) existant.t = r[PRIX_SB.col.type];
        } else if (r[PRIX_SB.col.nom]) {
            // Nouveau produit ajouté dans Supabase
            CREPES.push({
                id: id,
                n: r[PRIX_SB.col.nom],
                d: r[PRIX_SB.col.description] || '',
                p: prix,
                t: r[PRIX_SB.col.type] || 'sucre'
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