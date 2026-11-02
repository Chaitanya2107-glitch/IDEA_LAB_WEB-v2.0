#!/usr/bin/env bash
# Backs up the MongoDB database and the uploaded files, keeps 14 days locally and
# optionally copies each backup to an S3 bucket.
#
#   sudo crontab -e   ->   30 2 * * * /srv/idea-lab/deploy/backup.sh >> /var/log/idealab-backup.log 2>&1
#
# Optional: BACKUP_S3_URI=s3://my-bucket/idealab (needs the AWS CLI and an instance role
# with s3:PutObject on that bucket).
set -euo pipefail

cd "$(dirname "$0")/.."
STAMP=$(date +%Y%m%d-%H%M%S)
DEST=${BACKUP_DIR:-/var/backups/idealab}
mkdir -p "$DEST"
chmod 700 "$DEST"

echo "[$(date -Is)] backup $STAMP"

# Database: consistent dump streamed out of the mongo container.
docker compose exec -T mongo sh -c \
  'mongodump --quiet --archive --gzip --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' \
  > "$DEST/mongo-$STAMP.archive.gz"

# Uploaded files (site media and student 3D models).
docker compose exec -T app tar czf - -C /data/uploads . > "$DEST/uploads-$STAMP.tgz"

find "$DEST" -type f -mtime +14 -delete

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp --only-show-errors "$DEST/mongo-$STAMP.archive.gz" "$BACKUP_S3_URI/"
  aws s3 cp --only-show-errors "$DEST/uploads-$STAMP.tgz" "$BACKUP_S3_URI/"
fi

echo "[$(date -Is)] done: $(du -sh "$DEST/mongo-$STAMP.archive.gz" | cut -f1) database, $(du -sh "$DEST/uploads-$STAMP.tgz" | cut -f1) files"
