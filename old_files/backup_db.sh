#!/bin/bash

# Directorio donde está la app (ajusta si es diferente)
APP_DIR="/home/oscar_alanis/rifa"
BACKUP_DIR="$APP_DIR/backups"
DB_FILE="$APP_DIR/raffle.db"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

# Crear carpeta de backups si no existe
mkdir -p "$BACKUP_DIR"

# Copiar la base de datos
cp "$DB_FILE" "$BACKUP_DIR/raffle_$TIMESTAMP.db"

# (Opcional) Borrar backups de más de 7 días para no llenar el disco
find "$BACKUP_DIR" -type f -name "*.db" -mtime +7 -delete

echo "Respaldo creado: raffle_$TIMESTAMP.db"
