#!/usr/bin/env bash
# Render Build Command：./build.sh
set -o errexit

# 1) 前端：打包 React → dist/
npm ci
npm run build

# 2) 後端：安裝套件、收集靜態檔、建表、匯入範例活動、建立管理員
pip install -r backend/requirements.txt
cd backend
python manage.py collectstatic --noinput
python manage.py migrate --noinput
python manage.py seed_events
python manage.py create_admin
