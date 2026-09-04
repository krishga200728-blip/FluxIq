# FluxIQ — Urban Flood Detection & Nowcasting

SIH-oriented prototype for location-aware urban flood risk monitoring.

## Working features
- City/district search using Open-Meteo geocoding
- Live current + hourly precipitation from Open-Meteo when internet access is available
- Built-in fallback scenario so the dashboard remains usable during a presentation
- Transparent 0–100 rainfall-driven flood-risk score
- 30–120 minute risk lead-time band
- Derived water-level signal (clearly labeled as a model estimate)
- Interactive Leaflet map with OpenStreetMap and Esri satellite imagery
- Google Maps handoff for the selected location
- Ward-priority queue and response playbook
- Responsive SIH presentation UI

## Important deployment note
For real field deployment, connect official municipal/irrigation gauge feeds and validated hydrologic/inundation models. The current water-level value is a rainfall-derived demonstration estimate and must not be represented as an official gauge reading.

## Frontend
```bash
cd frontend
npm install
npm run dev
```

## Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```
