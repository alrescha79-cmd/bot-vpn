# 🐳 Panduan Build & Push Docker Image

Panduan untuk melakukan build image Docker dari source code dan melakukan push ke registry publik (seperti **Docker Hub** atau **GitHub Container Registry / GHCR**).

---

## 1. Push ke Docker Hub

### Langkah 1: Login ke Docker Hub
```bash
docker login -u USERNAME_DOCKERHUB
```
*(Masukkan password atau Personal Access Token Docker Hub Anda)*

### Langkah 2: Build Image dengan Tag
Format penamaan: `username/repository:tag`

```bash
# Build versi spesifik dan tag latest
docker build -t USERNAME_DOCKERHUB/bot-vpn:v3.2.0 .
docker tag USERNAME_DOCKERHUB/bot-vpn:v3.2.0 USERNAME_DOCKERHUB/bot-vpn:latest
```

### Langkah 3: Push Image ke Docker Hub
```bash
docker push USERNAME_DOCKERHUB/bot-vpn:v3.2.0
docker push USERNAME_DOCKERHUB/bot-vpn:latest
```

---

## 2. Push ke GitHub Container Registry (GHCR)

### Langkah 1: Login ke GHCR
Buat Personal Access Token (classic) di GitHub dengan scope `write:packages`.

```bash
echo $CR_PAT | docker login ghcr.io -u USERNAME_GITHUB --password-stdin
```

### Langkah 2: Build & Tag Image
```bash
docker build -t ghcr.io/USERNAME_GITHUB/bot-vpn:v3.2.0 .
docker tag ghcr.io/USERNAME_GITHUB/bot-vpn:v3.2.0 ghcr.io/USERNAME_GITHUB/bot-vpn:latest
```

### Langkah 3: Push Image
```bash
docker push ghcr.io/USERNAME_GITHUB/bot-vpn:v3.2.0
docker push ghcr.io/USERNAME_GITHUB/bot-vpn:latest
```

---

## 3. Build Multi-Platform (x86_64 / amd64 & ARM64)

Jika Anda ingin image dapat dijalankan di VPS Intel/AMD sekaligus VPS ARM (seperti Oracle ARM Ampere / Apple Silicon):

```bash
# Buat builder instance jika belum ada
docker buildx create --name vpn-builder --use
docker buildx inspect --bootstrap

# Build dan push multi-arch sekaligus
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t USERNAME_DOCKERHUB/bot-vpn:v3.2.0 \
  -t USERNAME_DOCKERHUB/bot-vpn:latest \
  --push .
```

---

## 4. Menjalankan Image Hasil Push di VPS

Di VPS klien/server, cukup buat `docker-compose.yml` tanpa perlu clone source code:

```yaml
version: '3.8'

services:
  bot-vpn:
    image: USERNAME_DOCKERHUB/bot-vpn:latest
    container_name: bot-vpn
    restart: unless-stopped
    ports:
      - "50123:50123"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
```

Lalu jalankan:
```bash
docker compose up -d
```
