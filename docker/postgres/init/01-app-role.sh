#!/bin/sh
# Runs once, on the first start of an empty data volume (postgres image
# convention). Creates the role the app connects as; the migrations grant it
# its privileges. The password arrives through psql's variable quoting, never
# through string concatenation.
set -eu

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE aqar_app LOGIN PASSWORD :'app_password';
SQL
