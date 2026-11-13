#!/usr/bin/env bash
set -e

# Переход в директорию скрипта
cd "$(dirname "$0")"

# Активация виртуального окружения, если оно существует
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "======================================================"
echo " Запуск новостного портала на Python (FastAPI)"
echo " Адрес: http://127.0.0.1:8000"
echo " Документация API: http://127.0.0.1:8000/docs"
echo " Учетная запись администратора: admin / password"
echo "======================================================"

python3 main.py
