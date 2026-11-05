"""Real HTTP checks against the isolated database created by Verify.ps1."""
import concurrent.futures
import datetime as dt
import os
import uuid

import httpx

BASE = os.environ.get('ATLAS_TEST_API', 'http://127.0.0.1:5181')
checks = 0


def check(condition, description):
    global checks
    assert condition, description
    checks += 1
    print(f'PASS {description}')


def request(method, path, expected=200, token=None, **kwargs):
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    response = httpx.request(method, BASE + path, headers=headers, timeout=30, **kwargs)
    check(response.status_code == expected, f'{method} {path} -> {expected} (actual {response.status_code}: {response.text[:120] if response.status_code != expected else "ok"})')
    return response


def main():
    health = request('GET', '/api/health').json()
    request('GET', '/api/bookings', 401)
    request('GET', '/api/admin/dashboard', 401)
    admin = request('POST', '/api/auth/login', json={'email': 'admin@atlasdrive.ma', 'password': 'AtlasAdmin2026!'}).json()
    check(admin['user']['role'] == 'Admin', 'admin role preserved')
    token = admin['token']
    request('POST', '/api/auth/login', 401, json={'email': 'admin@atlasdrive.ma', 'password': 'incorrect-password'})
    suffix = uuid.uuid4().hex[:10]
    customer = request('POST', '/api/auth/register', json={'fullName': 'Integration Customer', 'email': f'integration-{suffix}@example.test', 'phone': '0600000000', 'password': 'Integration2026!'}).json()
    own = customer['token']
    check(customer['user']['role'] == 'Customer', 'registration cannot grant admin')
    request('GET', '/api/auth/me', token=own)
    request('GET', '/api/admin/dashboard', 403, own)
    stranger = request('POST', '/api/auth/register', json={'fullName': 'Other Customer', 'email': f'other-{suffix}@example.test', 'phone': '', 'password': 'Integration2026!'}).json()['token']
    fleet = request('GET', '/api/vehicles').json()
    check(len(fleet) >= 8, 'demonstration fleet seeded')
    equipped = request('GET', '/api/vehicles?search=Bluetooth').json()
    check(len(equipped) >= 1, 'PostgreSQL full-text searches equipment')
    filtered = request('GET', '/api/vehicles?city=Casablanca&category=Citadine&maxPrice=400').json()
    check(all(v['city'] == 'Casablanca' and v['category'] == 'Citadine' and v['dailyRate'] <= 400 for v in filtered) and bool(filtered), 'combined fleet filters applied')
    agencies = request('GET', '/api/locations').json()
    check(len(agencies) >= 4, 'agencies seeded')
    vehicle_input = {'brand': 'Integration', 'model': suffix, 'year': 2026, 'category': 'SUV', 'transmission': 'Automatique', 'fuel': 'Diesel', 'seats': 5, 'dailyRate': 500, 'deposit': 4000, 'imageUrl': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800', 'city': 'Casablanca', 'description': 'Isolated integration test vehicle', 'features': ['Climatisation', 'Bluetooth'], 'status': 'Available'}
    vehicle = request('POST', '/api/admin/vehicles', expected=201, token=token, json=vehicle_input).json()
    vehicle_id = vehicle['id']
    request('POST', '/api/admin/vehicles', 403, own, json=vehicle_input)
    today = dt.date.fromisoformat(health['today'])
    start = today + dt.timedelta(days=12)
    end = start + dt.timedelta(days=3)
    quote_input = {'vehicleId': vehicle_id, 'startDate': start.isoformat(), 'endDate': end.isoformat(), 'insurance': 'premium', 'childSeat': True, 'additionalDriver': True}
    quote = request('POST', '/api/quotes', json=quote_input).json()
    check(quote['days'] == 3 and quote['total'] == 2025, 'three-day total includes premium + both extras exactly')
    check(quote['deposit'] == 4000, 'deposit reported separately')
    request('POST', '/api/quotes', 400, json={**quote_input, 'endDate': start.isoformat()})
    request('POST', '/api/quotes', 400, json={**quote_input, 'insurance': 'unknown'})
    body = {**quote_input, 'pickupLocationId': agencies[0]['id'], 'returnLocationId': agencies[1]['id'], 'notes': 'Integration test', 'total': 1}
    # Two truly simultaneous HTTP requests must not create overlapping bookings.
    def book():
        return httpx.post(BASE + '/api/bookings', json=body, headers={'Authorization': f'Bearer {own}'}, timeout=30)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _: book(), range(2)))
    check(sorted(r.status_code for r in responses) == [201, 409], 'concurrent double booking yields exactly one success')
    booking = next(r.json() for r in responses if r.status_code == 201)
    booking_id = booking['id']
    check(booking['total'] == 2025, 'untrusted client total ignored')
    unavailable = request('GET', f'/api/vehicles?startDate={start.isoformat()}&endDate={end.isoformat()}').json()
    check(vehicle_id not in [v['id'] for v in unavailable], 'availability filter excludes overlapping reservation')
    contract = request('GET', f'/api/bookings/{booking_id}/contract', token=own)
    check('text/html' in contract.headers['content-type'] and booking['reference'] in contract.text, 'printable contract contains reference')
    denied = httpx.get(BASE + f'/api/bookings/{booking_id}/contract', headers={'Authorization': f'Bearer {stranger}'}, timeout=10)
    check(denied.status_code in [403, 404], 'other customer cannot read contract')
    denied_cancel = httpx.post(BASE + f'/api/bookings/{booking_id}/cancel', headers={'Authorization': f'Bearer {stranger}'}, timeout=10)
    check(denied_cancel.status_code in [403, 404], 'other customer cannot cancel reservation')
    cancelled = request('POST', f'/api/bookings/{booking_id}/cancel', token=own).json()
    check(cancelled['status'] == 'Cancelled', 'cancellation updates persisted status')
    request('POST', f'/api/admin/bookings/{booking_id}/checkout', 409, token, json={'odometer': 1000})
    available = request('GET', f'/api/vehicles?startDate={start.isoformat()}&endDate={end.isoformat()}').json()
    check(vehicle_id in [v['id'] for v in available], 'cancellation releases availability')
    current_body = {**body, 'startDate': today.isoformat(), 'endDate': (today + dt.timedelta(days=2)).isoformat(), 'insurance': 'basic', 'childSeat': False, 'additionalDriver': False}
    current = request('POST', '/api/bookings', 201, own, json=current_body).json()
    current_id = current['id']
    request('POST', f'/api/admin/bookings/{current_id}/return', 409, token, json={'odometer': 1100, 'notes': '', 'damageFee': 0})
    active = request('POST', f'/api/admin/bookings/{current_id}/checkout', token=token, json={'odometer': 1000}).json()
    check(active['status'] == 'Active', 'checkout activates rental')
    request('POST', f'/api/bookings/{current_id}/cancel', 409, own)
    request('POST', f'/api/admin/bookings/{current_id}/return', 400, token, json={'odometer': 999, 'notes': '', 'damageFee': 0})
    completed = request('POST', f'/api/admin/bookings/{current_id}/return', token=token, json={'odometer': 1250, 'notes': 'Rendu propre', 'damageFee': 75}).json()
    check(completed['status'] == 'Completed' and completed['returnedAt'], 'return closes rental and timestamps it')
    check(completed['damageFee'] == 75 and completed['returnNotes'] == 'Rendu propre', 'return inspection persisted')
    request('POST', f'/api/admin/bookings/{current_id}/return', 409, token, json={'odometer': 1251, 'notes': '', 'damageFee': 0})
    request('DELETE', f'/api/admin/vehicles/{vehicle_id}', expected=204, token=token)
    historic = request('GET', '/api/bookings', token=own).json()
    check(current_id in [b['id'] for b in historic], 'archiving preserves booking history')
    request('GET', f'/api/bookings/{current_id}/contract', token=own)
    dashboard = request('GET', '/api/admin/dashboard', token=token).json()
    check(dashboard['totalBookings'] >= 2 and len(dashboard['monthlyRevenue']) > 0, 'dashboard aggregates persisted records')
    notifications = request('GET', '/api/admin/notifications', token=token).json()
    check(len(notifications) >= 2, 'booking notifications persisted')
    recommended = request('POST', '/api/recommendations', json={'budget': 1000, 'passengers': 5}).json()
    check(isinstance(recommended['vehicleIds'], list) and bool(recommended['explanation']), 'AI recommendations respond using fleet')
    chat = request('POST', '/api/chat', json={'message': 'Comment fonctionne la caution ?'}).json()
    check(bool(chat['reply']) and chat['source'] in ['local', 'openai', 'local-fallback'], 'assistant returns declared answer source')
    print(f'\n{checks} integration checks passed against isolated test database.')


if __name__ == '__main__':
    main()
