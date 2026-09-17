#!/bin/bash
set -e

echo "======================================================"
echo "    MEMULAI DEPLOYMENT OTOMATIS GABAH DI SERVER       "
echo "======================================================"

# 1. Pastikan Docker dan Docker Compose tersedia
if ! command -v docker &> /dev/null; then
    echo "Docker belum terinstall. Menginstall Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# 2. Matikan container lama jika ada yang error
echo "Menonaktifkan container lama (jika ada)..."
docker compose down --remove-orphans || true

# 3. Jalankan container baru di background
echo "Membangun dan menjalankan sistem GABAH..."
docker compose up -d --build

echo "======================================================"
echo "  BERHASIL! GABAH TELAH AKTIF DI SERVER ANDA!         "
echo "  Silakan buka di browser: http://IP-SERVER-ANDA     "
echo "======================================================"
