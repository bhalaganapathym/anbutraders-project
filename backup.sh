#!/bin/bash
# PostgreSQL Backup Script
# Usage: ./backup.sh

BACKUP_DIR="./backups"
DB_NAME="anbu_traders"
DB_USER="postgres"
DATE=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p $BACKUP_DIR

docker exec -t project-db-1 pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

echo "Backup completed: $BACKUP_DIR/db_backup_$DATE.sql.gz"

# Optional: Delete backups older than 7 days
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +7 -delete
