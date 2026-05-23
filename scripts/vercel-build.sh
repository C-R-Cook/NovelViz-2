#!/bin/sh
set -e

# Production only — preview builds should not migrate the production database.
if [ "$VERCEL_ENV" = "production" ]; then
  npx prisma migrate deploy
fi

npx prisma generate
npx next build
