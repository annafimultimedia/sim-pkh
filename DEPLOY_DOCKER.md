# Deploy Docker SIM-PKH

## Build dan push manual

Login ke GitHub Container Registry memakai Personal Access Token dengan izin
write:packages.

    docker login ghcr.io -u USERNAME
    docker build -t ghcr.io/USERNAME/sim-pkh:latest .
    docker push ghcr.io/USERNAME/sim-pkh:latest

GitHub Actions pada .github/workflows/docker-image.yml melakukan langkah yang
sama secara otomatis setiap ada push ke branch main.

## Auto-deploy dari GitHub ke VPS

Tambahkan repository variable AUTO_DEPLOY dengan nilai true melalui Settings,
Secrets and variables, Actions, Variables.

Tambahkan Actions secrets berikut:

- VPS_HOST: IP VPS
- VPS_PORT: port SSH, biasanya 22
- VPS_USER: user SSH yang dapat menjalankan Docker
- VPS_SSH_KEY: private key SSH lengkap

Public key pasang pada ~/.ssh/authorized_keys milik user VPS. Siapkan folder
/opt/sim-pkh dan jalankan docker login ghcr.io satu kali jika image private.
Setelah itu setiap push ke main akan build, push image, lalu menjalankan
docker compose pull dan up di VPS.

## Persiapan VPS

Pasang Docker Engine, Docker Compose plugin, dan Nginx. Salin
compose.prod.yml dan .env.docker.example ke /opt/sim-pkh, lalu jalankan:

    cd /opt/sim-pkh
    cp .env.docker.example .env.production
    nano .env.production
    docker login ghcr.io
    docker compose -f compose.prod.yml pull
    docker compose -f compose.prod.yml up -d

Ganti OWNER pada IMAGE dengan username atau organisasi GitHub. Untuk package
GHCR private, login memakai token dengan izin read:packages.

## Import database

Salin backup SQL ke VPS. Impor tanpa menaruh password di command history:

    docker compose -f compose.prod.yml exec database mariadb -u root -p sim_pkh

Setelah prompt MariaDB muncul, gunakan perintah source dengan lokasi backup
yang sudah disalin ke container, atau pipe backup melalui shell VPS.

## Nginx

Arahkan virtual host sim.peduakadua.com ke http://127.0.0.1:3000. Header proxy
yang diperlukan adalah Host, X-Real-IP, X-Forwarded-For, dan
X-Forwarded-Proto. Pasang SSL dengan Certbot setelah DNS mengarah ke IP VPS.

## Update aplikasi

Setelah image baru tersedia:

    cd /opt/sim-pkh
    docker compose -f compose.prod.yml pull app
    docker compose -f compose.prod.yml up -d app
    docker image prune -f

Database dan file tidak hilang saat container diperbarui karena menggunakan
named volumes.
