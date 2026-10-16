# Buxgalter

Ilovani GitHub Pages yoki Netlify’da joylashtirish mumkin. GitHub Pages varianti
statik rejimda ishlaydi: hisob va yozuvlar shu brauzerda saqlanadi. Netlify
varianti backend Function va PostgreSQL orqali qurilmalararo saqlashni qo‘llaydi.

## Netlify’ga joylashtirish

1. Neon yoki Supabase kabi xizmatda PostgreSQL baza yarating. U bergan
   PostgreSQL ulanish manzilini oling. Provider serverless ilova uchun pooler
   manzilini tavsiya qilsa, shuni ishlating.
2. Loyihani GitHub’ga yuklab, Netlify’da **Add new site → Import an existing
   project** orqali repository’ni ulang. `netlify.toml` publish papkasini
   (`public`), backend Function manzilini (`netlify/functions`) hamda `/api/*`
   so‘rovlarini backend function’ga yo‘naltirishni sozlaydi.
3. Netlify’dagi **Site configuration → Environment variables** bo‘limida:
   - `DATABASE_URL` — 1-qadamdagi PostgreSQL ulanish manzili;
   - `NODE_ENV` — `production`
   
   qiymatlarini qo‘shing. `DATABASE_URL` maxfiy: uni kodga, GitHub’ga yoki
   chatga joylamang.
4. Saytni qayta deploy qiling. Backend jadvallarni bazada avtomatik yaratadi.
   Netlify bergan sayt manzilini ochib, ro‘yxatdan o‘ting.

Frontend va API bir xil Netlify sayt manzilida ishlashi kerak. `public/index.html` ni
File Explorer’dan bevosita ochmang — ro‘yxatdan o‘tish uchun backend ham
ishlayotgan bo‘lishi shart.

## GitHub Pages’ga joylashtirish

1. O‘zgarishlarni GitHub’dagi repository’ning `main` branch’iga push qiling.
2. GitHub’da **Settings → Pages → Build and deployment → Source** bo‘limidan
   **GitHub Actions** ni tanlang.
3. `Deploy GitHub Pages` workflow `public` papkasini avtomatik joylaydi.
   **Actions** bo‘limida deploy tugagach, **Settings → Pages** dagi sayt
   manzilini oching.

GitHub Pages statik bo‘lgani uchun backend yoki server ishlatmaydi. Kirish
ma’lumotlari brauzerda saqlanadi va tekshiriladi; hisob yozuvlari faqat shu
brauzerda qoladi, boshqa qurilmalarga sinxronlanmaydi. Serverda haqiqiy
autentifikatsiya va qurilmalar orasida sinxronlash kerak bo‘lsa, Netlify +
PostgreSQL sozlamasidan foydalaning.

## Lokal ishga tushirish

1. PostgreSQL baza yarating va ulanish manzilini oling.
2. `.env.example` faylidan `.env` nusxa yarating va `DATABASE_URL` ga ulanish
   manzilini yozing. `.env` ni GitHub’ga yuklamang.
3. Terminalda `npm install`, keyin `npm start` buyrug‘ini bajaring.
4. Brauzerda `http://localhost:3000` manzilini oching.

## Hisoblar va ma’lumotlar

Ro'yxatdan o'tishda +998 telefon raqami yoki Gmail manzili va kamida 8 belgili
parol kiritiladi. Telefon/email tasdiqlash kodi yuborilmaydi; ushbu manzil
hisob identifikatori sifatida ishlatiladi. Parollar hash ko‘rinishida saqlanadi,
har bir foydalanuvchi ma’lumoti alohida ajratiladi. Eski brauzer yozuvlari shu
telefon yoki Gmail bilan kirilganda serverga import qilinadi.
