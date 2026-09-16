// Funzioni condivise dalle API della dashboard.
// I file che iniziano con "_" non diventano endpoint su Vercel.
import crypto from 'node:crypto';

const REPO = process.env.GITHUB_REPO || 'nomeasy-art/webportfolio';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const API = 'https://api.github.com';
const SESSION_HOURS = 12;

export function config() {
    return {
        repo: REPO,
        branch: BRANCH,
        token: process.env.GITHUB_TOKEN,
        password: process.env.ADMIN_PASSWORD,
    };
}

// --- Sessione: cookie firmato, così il token GitHub non arriva mai al browser ---
function sign(value, secret) {
    return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

export function createSession(password) {
    const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
    const payload = String(expires);
    return `${payload}.${sign(payload, password)}`;
}

export function isValidSession(cookieHeader, password) {
    const raw = (cookieHeader || '')
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('admin_session='));
    if (!raw) return false;
    const [payload, signature] = decodeURIComponent(raw.slice('admin_session='.length)).split('.');
    if (!payload || !signature) return false;
    const expected = sign(payload, password);
    // timingSafeEqual richiede lunghezze uguali
    if (expected.length !== signature.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return false;
    return Number(payload) > Date.now();
}

export function sessionCookie(value) {
    const maxAge = SESSION_HOURS * 3600;
    return `admin_session=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearedCookie() {
    return 'admin_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

// Blocca le richieste non autenticate. Ritorna true se ha già risposto.
export function denyIfUnauthorized(req, res) {
    const { password, token } = config();
    if (!password || !token) {
        res.status(500).json({ error: 'Variabili ADMIN_PASSWORD o GITHUB_TOKEN non configurate su Vercel.' });
        return true;
    }
    if (!isValidSession(req.headers.cookie, password)) {
        res.status(401).json({ error: 'Sessione scaduta: rientra con la password.' });
        return true;
    }
    return false;
}

// --- GitHub ---
export async function gh(path, options = {}) {
    const { token } = config();
    const res = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': 'nomeasy-dashboard',
            ...(options.headers || {}),
        },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
        const message = (data && data.message) || `GitHub ha risposto ${res.status}`;
        throw Object.assign(new Error(message), { status: res.status });
    }
    return data;
}

// Crea un solo commit con tutti i file passati: così il sito si ridistribuisce
// una volta sola e non resta mai in uno stato a metà.
// files: [{ path, sha }] per aggiungere/sostituire, { path, remove: true } per cancellare.
export async function commitFiles(files, message) {
    const ref = await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
    const headSha = ref.object.sha;
    const headCommit = await gh(`/repos/${REPO}/git/commits/${headSha}`);

    const tree = files.map(file =>
        file.remove
            ? { path: file.path, mode: '100644', type: 'blob', sha: null }
            : { path: file.path, mode: '100644', type: 'blob', sha: file.sha }
    );

    const newTree = await gh(`/repos/${REPO}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }),
    });
    const commit = await gh(`/repos/${REPO}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
    });
    await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha }),
    });
    return commit.sha;
}
