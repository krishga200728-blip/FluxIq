from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    r = client.get('/health')
    assert r.status_code == 200
    assert r.json()['status'] == 'ok'

def test_demo_flood():
    r = client.get('/api/flood/demo')
    assert r.status_code == 200
    body = r.json()
    assert 0 <= body['score'] <= 99
    assert body['level'] in {'LOW','MODERATE','HIGH','CRITICAL'}
    assert body['water_level_m'] > 0

def test_flood_analyze():
    r = client.post('/api/flood/analyze', json={'rainfall_3h_mm': 55, 'rainfall_24h_mm': 180})
    assert r.status_code == 200
    assert r.json()['level'] in {'HIGH','CRITICAL'}
