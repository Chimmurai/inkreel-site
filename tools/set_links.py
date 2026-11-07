#!/usr/bin/env python3
"""Підставляє справжні посилання замість заглушок у сторінках сайту.

Приклади:
    python tools/set_links.py --repo raimex/inkreel --store 9NXXXXXXXXXX
    python tools/set_links.py --check          # показати, що ще лишилось

OWNER/REPO: GitHub-репозиторій із релізами застосунку (у релізі має лежати файл InkReel-Setup.exe,
            інакше пряме посилання /releases/latest/download/InkReel-Setup.exe не спрацює).
STORE_ID:   ідентифікатор застосунку зі сторінки Product identity у Partner Center.
"""
import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLACEHOLDERS = {'repo': 'OWNER/REPO', 'store': 'STORE_ID'}
CHECKS = {
    'repo': re.compile(r'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
    'store': re.compile(r'^[A-Za-z0-9]{6,20}$'),
}


def pages():
    return sorted(ROOT.rglob('*.html'))


def count_left():
    left = {}
    for key, token in PLACEHOLDERS.items():
        left[key] = sum(p.read_text(encoding='utf-8').count(token) for p in pages())
    return left


def main():
    ap = argparse.ArgumentParser(description='Підставити посилання на GitHub Releases і Microsoft Store.')
    ap.add_argument('--repo', help='власник/репозиторій, напр. raimex/inkreel')
    ap.add_argument('--store', help='Store ID, напр. 9NXXXXXXXXXX')
    ap.add_argument('--check', action='store_true', help='лише перевірити, що заглушок не лишилось')
    args = ap.parse_args()

    if not args.check:
        values = {'repo': args.repo, 'store': args.store}
        if not any(values.values()):
            ap.error('вкажіть --repo і/або --store (або --check)')
        for key, value in values.items():
            if not value:
                continue
            if not CHECKS[key].match(value):
                ap.error('некоректне значення для --%s: %r' % (key, value))
            for page in pages():
                text = page.read_text(encoding='utf-8')
                if PLACEHOLDERS[key] in text:
                    page.write_text(text.replace(PLACEHOLDERS[key], value), encoding='utf-8')
                    print('%s: %s → %s' % (page.relative_to(ROOT), PLACEHOLDERS[key], value))

    left = count_left()
    for key, n in left.items():
        print('%s: заглушок лишилось %d' % (PLACEHOLDERS[key], n))
    if args.check and any(left.values()):
        sys.exit(1)


if __name__ == '__main__':
    main()
