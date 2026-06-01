# SIM-PKH

Sistem Informasi Manajemen PKH berbasis Next.js, Tailwind CSS, dan MySQL.

## Menjalankan

1. Salin `.env.example` menjadi `.env.local`.
2. Buat database dari `database/schema.sql` di MySQL.
3. Jalankan:

```bash
npm run dev
```

## Akun Demo UI

- Admin Kabupaten: `admin / admin123`
- Pendamping: `pendamping / pkh123`

Import file SQL wilayah Indonesia dari Anda bisa dimasukkan ke tabel `reg_provinces`, `reg_regencies`, `reg_districts`, dan `reg_villages`.
