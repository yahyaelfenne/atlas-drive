"""Refresh real model photographs and Commons attribution; no generated imagery."""
import concurrent.futures
import html
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
CARS = [
    ('Renault', 'Clio', 'Renault_Clio', 'Citadine', 290, 'Casablanca'),
    ('Dacia', 'Duster', 'Dacia_Duster', 'SUV', 450, 'Marrakech'),
    ('Volkswagen', 'Golf 8', 'Volkswagen_Golf_Mk8', 'Berline', 550, 'Casablanca'),
    ('Mercedes-Benz', 'Classe C', 'Mercedes-Benz_C-Class_(W206)', 'Premium', 1100, 'Casablanca'),
    ('Hyundai', 'Tucson', 'Hyundai_Tucson', 'SUV', 650, 'Agadir'),
    ('Peugeot', '208', 'Peugeot_208', 'Citadine', 320, 'Rabat'),
    ('BMW', 'Série 3', 'BMW_3_Series_(G20)', 'Premium', 1050, 'Marrakech'),
    ('Toyota', 'Corolla', 'Toyota_Corolla_(E210)', 'Berline', 490, 'Rabat'),
    ('Dacia', 'Sandero', 'Dacia_Sandero', 'Citadine', 280, 'Casablanca'),
    ('Renault', 'Captur', 'Renault_Captur', 'SUV', 480, 'Rabat'),
    ('Peugeot', '3008', 'Peugeot_3008', 'SUV', 700, 'Marrakech'),
    ('Kia', 'Sportage', 'Kia_Sportage', 'SUV', 680, 'Agadir'),
    ('Fiat', '500', 'Fiat_500_(2007)', 'Citadine', 350, 'Casablanca'),
    ('Hyundai', 'i10', 'Hyundai_i10', 'Citadine', 260, 'Rabat'),
]

def get(url):
    import time
    import hashlib
    import urllib.error
    cache = ROOT / '.local/photo-cache'
    cache.mkdir(exist_ok=True)
    filename = cache / (hashlib.sha256(url.encode()).hexdigest() + '.json')
    if filename.exists():
        return json.loads(filename.read_text(encoding='utf-8'))
    request = urllib.request.Request(url, headers={'User-Agent': 'LocationEnnour/1.0 (photo credits importer)'})
    for attempt in range(4):
        time.sleep(3 * (attempt + 1))
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                data = json.load(response)
            filename.write_text(json.dumps(data), encoding='utf-8')
            return data
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 3:
                raise

def photo(car):
    brand, model, page, category, rate, city = car
    summary = get('https://en.wikipedia.org/api/rest_v1/page/summary/' + page)
    url = summary['thumbnail']['source'].split('?')[0]
    import re
    url = re.sub(r'/\d+px-', '/960px-', url)
    filename = urllib.parse.unquote(url.split('/thumb/')[1].split('/')[2])
    metadata = get('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode({
        'action': 'query', 'format': 'json', 'prop': 'imageinfo',
        'iiprop': 'extmetadata', 'titles': 'File:' + filename}))
    info = next(iter(metadata['query']['pages'].values()))['imageinfo'][0]['extmetadata']
    import re
    clean = lambda key: re.sub('<[^>]+>', '', html.unescape(info.get(key, {}).get('value', '')))
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'LocationEnnour/1.0'}), timeout=35) as response:
        assert response.headers['Content-Type'].startswith('image/')
    print(brand, model, 'OK', flush=True)
    return dict(brand=brand, model=model, category=category, dailyRate=rate, city=city,
                imageUrl=url, author=clean('Artist'), license=clean('LicenseShortName'),
                licenseUrl=clean('LicenseUrl'), source='https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(filename))

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        rows = list(pool.map(photo, CARS))
    path = ROOT / 'backend/Data/fleet.json'
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
    credits = '<!doctype html><html lang="fr"><meta charset="utf-8"><title>Location Ennour — Crédits photos</title><body style="font:16px/1.7 system-ui;max-width:900px;margin:auto;padding:24px"><h1>Crédits photos — Location Ennour</h1><p>Photographies réelles des modèles, illustratives : elles ne représentent pas les véhicules physiques de notre agence. Le millésime, la finition et la couleur peuvent différer. Photos redimensionnées par Wikimedia.</p>'
    for row in rows:
        credits += '<p><strong>' + html.escape(row['brand'] + ' ' + row['model']) + '</strong> — ' + html.escape(row['author']) + ' · <a href="' + html.escape(row['source']) + '">Source</a> · <a href="' + html.escape(row['licenseUrl']) + '">' + html.escape(row['license']) + '</a></p>'
    (ROOT / 'frontend/public/photo-credits.html').write_text(credits + '</body></html>', encoding='utf-8')
    (ROOT / 'backend/Data/photo-credits.html').write_text(credits + '</body></html>', encoding='utf-8')

