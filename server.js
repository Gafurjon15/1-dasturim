require('dotenv').config();

const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const { rateLimit } = require('express-rate-limit');
const { Pool } = require('pg');
const { normalizeIdentifier, validateData } = require('./validation');

let pool;
function getPool() {
    if (pool) return pool;
    if (!process.env.DATABASE_URL) {
        const error = new Error('Netlify environment variables ichida DATABASE_URL sozlanmagan.');
        error.status = 503;
        throw error;
    }

    let databaseUrl;
    try {
        databaseUrl = new URL(process.env.DATABASE_URL);
    } catch (cause) {
        const error = new Error('DATABASE_URL manzili noto‘g‘ri formatda.');
        error.status = 503;
        throw error;
    }
    const sslMode = databaseUrl.searchParams.get('sslmode');
    databaseUrl.searchParams.delete('sslmode');
    const useDatabaseSsl = process.env.NODE_ENV === 'production' ||
        process.env.DATABASE_SSL === 'true' || Boolean(sslMode && sslMode !== 'disable');
    pool = new Pool({
        connectionString: databaseUrl.toString(),
        ssl: useDatabaseSsl ? { rejectUnauthorized: true } : false,
        max: 3,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000
    });
    return pool;
}
const app = express();
const port = Number(process.env.PORT || 3000);
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const emptyData = () => ({ purchases: [], sales: [], workers: [], extras: [] });

app.disable('x-powered-by');
app.set('trust proxy', process.env.NETLIFY === 'true' ? 1 : false);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb', strict: true }));
app.use((req, res, next) => {
    const functionPrefix = '/.netlify/functions/api';
    if (req.url === functionPrefix || req.url.startsWith(`${functionPrefix}/`)) {
        req.url = req.url.slice(functionPrefix.length) || '/';
    }
    next();
});

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function sessionTokenFromRequest(req) {
    const cookie = req.headers.cookie?.split(';').map(part => part.trim())
        .find(part => part.startsWith('app_session='));
    return cookie ? cookie.slice('app_session='.length) : null;
}

function tokenHash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function setSessionCookie(res, token) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `app_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionLifetimeMs / 1000}${secure}`);
}

function clearSessionCookie(res) {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `app_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
}

async function requireUser(req, res, next) {
    try {
        const token = sessionTokenFromRequest(req);
        if (!token || token.length > 100) throw httpError(401, 'Avval hisobingizga kiring.');
        const result = await getPool().query(
            `SELECT u.id, u.name, u.label
             FROM app_sessions s
             JOIN app_users u ON u.id = s.user_id
             WHERE s.token_hash = $1 AND s.expires_at > now()`,
            [tokenHash(token)]
        );
        if (!result.rowCount) throw httpError(401, 'Seans muddati tugagan. Qayta kiring.');
        req.user = result.rows[0];
        next();
    } catch (error) {
        next(error);
    }
}

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.' }
});

app.post('/api/auth/register', authLimiter, async (req, res, next) => {
    try {
        const { method, value, password, name } = req.body || {};
        if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
            throw httpError(400, 'Parol kamida 8 ta belgidan iborat bo‘lishi kerak.');
        }
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
            throw httpError(400, 'Ismni kiriting (ko‘pi bilan 80 ta belgi).');
        }
        const { identifier, label } = normalizeIdentifier(method, value);
        const id = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(password, 12);
        await getPool().query(
            'INSERT INTO app_users (id, identifier, label, name, password_hash) VALUES ($1, $2, $3, $4, $5)',
            [id, identifier, label, name.trim(), passwordHash]
        );
        const token = await createSession(id);
        setSessionCookie(res, token);
        res.status(201).json({ user: { id, label, name: name.trim() } });
    } catch (error) {
        if (error.code === '23505') return next(httpError(409, 'Bu telefon yoki Gmail manzili bilan hisob mavjud.'));
        next(error);
    }
});

app.post('/api/auth/login', authLimiter, async (req, res, next) => {
    try {
        const { method, value, password } = req.body || {};
        if (typeof password !== 'string' || password.length > 128) {
            throw httpError(400, 'Telefon/Gmail va parolni kiriting.');
        }
        const { identifier } = normalizeIdentifier(method, value);
        const result = await getPool().query(
            'SELECT id, label, name, password_hash FROM app_users WHERE identifier = $1',
            [identifier]
        );
        const account = result.rows[0];
        if (!account || !(await bcrypt.compare(password, account.password_hash))) {
            throw httpError(401, 'Telefon/Gmail yoki parol noto‘g‘ri.');
        }
        const token = await createSession(account.id);
        setSessionCookie(res, token);
        res.json({ user: { id: account.id, label: account.label, name: account.name } });
    } catch (error) {
        next(error);
    }
});

async function createSession(userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    await getPool().query('DELETE FROM app_sessions WHERE expires_at <= now()');
    await getPool().query(
        'INSERT INTO app_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval \'30 days\')',
        [tokenHash(token), userId]
    );
    return token;
}

app.get('/api/session', async (req, res, next) => {
    try {
        const token = sessionTokenFromRequest(req);
        if (!token || token.length > 100) return res.json({ user: null });
        const result = await getPool().query(
            `SELECT u.id, u.name, u.label
             FROM app_sessions s
             JOIN app_users u ON u.id = s.user_id
             WHERE s.token_hash = $1 AND s.expires_at > now()`,
            [tokenHash(token)]
        );
        res.json({ user: result.rows[0] || null });
    } catch (error) {
        next(error);
    }
});

app.post('/api/auth/logout', async (req, res, next) => {
    try {
        const token = sessionTokenFromRequest(req);
        if (token && token.length <= 100) {
            await getPool().query('DELETE FROM app_sessions WHERE token_hash = $1', [tokenHash(token)]);
        }
        clearSessionCookie(res);
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

app.get('/api/data', requireUser, async (req, res, next) => {
    try {
        const result = await getPool().query('SELECT data FROM app_user_data WHERE user_id = $1', [req.user.id]);
        res.json({ data: result.rows[0]?.data || emptyData() });
    } catch (error) {
        next(error);
    }
});

app.put('/api/data', requireUser, async (req, res, next) => {
    try {
        const data = validateData(req.body?.data);
        await getPool().query(
            `INSERT INTO app_user_data (user_id, data, updated_at)
             VALUES ($1, $2::jsonb, now())
             ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
            [req.user.id, JSON.stringify(data)]
        );
        res.json({ data });
    } catch (error) {
        next(error);
    }
});

app.patch('/api/profile', requireUser, async (req, res, next) => {
    try {
        const name = req.body?.name;
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
            throw httpError(400, 'Ismni kiriting (ko‘pi bilan 80 ta belgi).');
        }
        const result = await getPool().query(
            'UPDATE app_users SET name = $1 WHERE id = $2 RETURNING id, label, name',
            [name.trim(), req.user.id]
        );
        res.json({ user: result.rows[0] });
    } catch (error) {
        next(error);
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    res.status(status).json({
        error: status >= 500 ? 'Serverda xatolik yuz berdi.' : error.message
    });
});

let schemaReady;
function initializeDatabase() {
    if (!schemaReady) schemaReady = getPool().query(`
        CREATE TABLE IF NOT EXISTS app_users (
            id text PRIMARY KEY,
            identifier text NOT NULL UNIQUE,
            label text NOT NULL,
            name text NOT NULL,
            password_hash text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS app_sessions (
            token_hash text PRIMARY KEY,
            user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
            expires_at timestamptz NOT NULL
        );
        CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions (expires_at);
        CREATE TABLE IF NOT EXISTS app_user_data (
            user_id text PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
            data jsonb NOT NULL DEFAULT '{"purchases":[],"sales":[],"workers":[],"extras":[]}'::jsonb,
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        DELETE FROM app_sessions WHERE expires_at <= now();
    `).catch(error => {
        schemaReady = null;
        throw error;
    });
    return schemaReady;
}

async function start() {
    await initializeDatabase();
    const server = app.listen(port, () => console.log(`Buxgalter server is running on port ${port}`));
    const shutdown = () => server.close(async () => {
        if (pool) await pool.end();
        process.exit(0);
    });
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

if (require.main === module) {
    start().catch(error => {
        console.error('Backend ishga tushmadi:', error);
        process.exitCode = 1;
    });
}

module.exports = { app, initializeDatabase, getPool };
