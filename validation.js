const categories = ['purchases', 'sales', 'workers', 'extras'];
const emptyData = () => ({ purchases: [], sales: [], workers: [], extras: [] });

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function normalizeIdentifier(method, value) {
    if (typeof value !== 'string') throw httpError(400, 'Telefon yoki Gmail manzilini kiriting.');
    if (method === 'phone') {
        let digits = value.replace(/\D/g, '');
        if (digits.startsWith('998') && digits.length === 12) digits = digits.slice(3);
        if (!/^\d{9}$/.test(digits)) throw httpError(400, 'Telefon raqam 9 ta raqamdan iborat bo‘lishi kerak.');
        return { identifier: `p998${digits}`, label: `+998 ${digits}` };
    }
    if (method === 'mail') {
        const email = value.trim().toLowerCase();
        if (!/^[^\s@]+@gmail\.com$/.test(email) || email.length > 254) {
            throw httpError(400, 'To‘g‘ri Gmail manzilini kiriting.');
        }
        return { identifier: `m${email}`, label: email };
    }
    throw httpError(400, 'Kirish usuli noto‘g‘ri.');
}

function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateData(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw httpError(400, 'Ma’lumotlar formati noto‘g‘ri.');
    }
    if (Object.keys(input).some(key => !categories.includes(key))) {
        throw httpError(400, 'Ma’lumotlarda noma’lum bo‘lim mavjud.');
    }

    const result = emptyData();
    for (const category of categories) {
        const rows = input[category];
        if (!Array.isArray(rows) || rows.length > 10000) {
            throw httpError(400, 'Yozuvlar soni yoki formati noto‘g‘ri.');
        }
        const seenIds = new Set();
        result[category] = rows.map(row => {
            if (!row || typeof row !== 'object' || Array.isArray(row) ||
                !(typeof row.id === 'string' || (Number.isSafeInteger(row.id) && row.id >= 0)) ||
                seenIds.has(String(row.id)) || typeof row.n !== 'string' ||
                row.n.trim().length < 1 || row.n.length > 120 || !validDate(row.d)) {
                throw httpError(400, 'Yozuvning nomi, sanasi yoki identifikatori noto‘g‘ri.');
            }
            seenIds.add(String(row.id));
            const common = { id: row.id, n: row.n.trim(), d: row.d };
            if (category === 'extras') {
                if (!['in', 'out'].includes(row.t) || !Number.isFinite(row.a) || row.a <= 0 || row.a > 1e12) {
                    throw httpError(400, 'Qo‘shimcha summa yoki uning turi noto‘g‘ri.');
                }
                return { ...common, t: row.t, a: row.a };
            }
            if (!Number.isFinite(row.q) || row.q <= 0 || row.q > 1e12 ||
                !Number.isFinite(row.p) || row.p <= 0 || row.p > 1e12) {
                throw httpError(400, 'Miqdor yoki narx noto‘g‘ri.');
            }
            return { ...common, q: row.q, p: row.p };
        });
    }
    return result;
}

module.exports = { normalizeIdentifier, validateData, validDate };
