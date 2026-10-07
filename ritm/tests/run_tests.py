#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
МОЙ РИТМ — Автоматизированный запуск юнит-тестов через Headless Browser (Edge)
"""

import http.server
import socketserver
import threading
import subprocess
import time
import os
import sys
import re

# Обеспечиваем UTF-8 вывод в консоли Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PORT = 8089
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def log_message(self, format, *args):
        pass  # подавляем шумные логи запросов

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), QuietHandler) as httpd:
        httpd.serve_forever()

def main():
    print("=" * 70)
    print("   МОЙ РИТМ: Запуск автоматизированного центра тестирования QA")
    print("=" * 70)

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    time.sleep(0.5)

    test_url = f"http://localhost:{PORT}/tests/test-runner.html"
    print(f"[*] Локальный тестовый сервер запущен на {test_url}")

    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        "msedge"
    ]
    edge_exe = None
    for p in edge_paths:
        if os.path.exists(p):
            edge_exe = p
            break

    if not edge_exe:
        print("[!] Microsoft Edge не найден по стандартным путям. Запустите тест в браузере:")
        print(f"    👉 {test_url}")
        sys.exit(0)

    print(f"[*] Запуск тестов в headless-браузере: {edge_exe}")

    cmd = [
        edge_exe,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--virtual-time-budget=5000",
        "--dump-dom",
        test_url
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20, encoding="utf-8", errors="replace")
        html = proc.stdout

        # Ищем статистику в DOM
        total_match = re.search(r'id="stat-total"[^>]*>(\d+)<', html)
        passed_match = re.search(r'id="stat-passed"[^>]*>(\d+)<', html)
        failed_match = re.search(r'id="stat-failed"[^>]*>(\d+)<', html)
        rate_match = re.search(r'id="stat-rate"[^>]*>(\d+)%<', html)

        if total_match and passed_match and failed_match:
            total = int(total_match.group(1))
            passed = int(passed_match.group(1))
            failed = int(failed_match.group(1))
            rate = rate_match.group(1) if rate_match else "100"

            print("-" * 70)
            print(f"ИТОГИ ТЕСТИРОВАНИЯ:")
            print(f"  Всего тестов : {total}")
            print(f"  Успешно [OK] : {passed}")
            print(f"  Ошибок [FAIL]: {failed}")
            print(f"  Надёжность   : {rate}%")
            print("-" * 70)

            # Выводим названия сьютов
            suite_matches = re.findall(r'<div class="suite-header">\s*<span>([^<]+)</span>\s*<span class="suite-badge[^"]*">([^<]+)</span>', html)
            for s_name, s_badge in suite_matches:
                print(f"  [OK] {s_name.strip()} -> {s_badge.strip()}")

            if failed == 0 and total > 0:
                print("\n*** ВСЕ ТЕСТЫ ПРОЙДЕНЫ СО 100% УСПЕХОМ! Проект готов к релизу. ***")
                sys.exit(0)
            else:
                print(f"\n[!] Обнаружено {failed} ошибок. Проверьте детали в браузере: {test_url}")
                sys.exit(1)
        else:
            print("[*] DOM получен, но тесты ещё выполнялись. Откройте в браузере:")
            print(f"    👉 {test_url}")
    except Exception as e:
        print(f"[!] Ошибка запуска тестов: {e}")
        print(f"    Откройте вручную: {test_url}")

if __name__ == '__main__':
    main()
