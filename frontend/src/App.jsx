import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

const CITIES = [
  ["Delhi", "India", 28.6139, 77.2090], ["Kolkata", "India", 22.5726, 88.3639],
  ["Mumbai", "India", 19.0760, 72.8777], ["Chennai", "India", 13.0827, 80.2707],
  ["Bengaluru", "India", 12.9716, 77.5946], ["Hyderabad", "India", 17.3850, 78.4867],
  ["Ahmedabad", "India", 23.0225, 72.5714], ["Patna", "India", 25.5941, 85.1376],
  ["Guwahati", "India", 26.1445, 91.7362], ["Bhubaneswar", "India", 20.2961, 85.8245],
  ["Lucknow", "India", 26.8467, 80.9462], ["Jaipur", "India", 26.9124, 75.7873],
];

const DEFAULT_LOCATION = { name: "Delhi", country: "India", latitude: 28.6139, longitude: 77.2090 };

const DEMO_WEATHER = {
  current: { temperature_2m: 29, relative_humidity_2m: 78, precipitation: 6.2, rain: 5.8 },
  hourly: {
    time: Array.from({ length: 24 }, (_, i) => `2026-09-04T${String((16 + i) % 24).padStart(2, "0")}:00`),
    precipitation: [6.2, 8.4, 10.1, 7.8, 5.5, 3.4, 2.8, 1.9, 1.2, .8, .4, .2, .1, .1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
};

function classifyRisk(r3, r24) {
  const score = Math.min(99, Math.round(20 + r3 * 1.25 + r24 * 0.34));
  if (score >= 78) return { level: "CRITICAL", score, tone: "critical", label: "Inundation conditions likely", lead: "30–60 min" };
  if (score >= 58) return { level: "HIGH", score, tone: "high", label: "Flood risk rising rapidly", lead: "60–90 min" };
  if (score >= 38) return { level: "MODERATE", score, tone: "moderate", label: "Drainage stress possible", lead: "90–120 min" };
  return { level: "LOW", score, tone: "low", label: "No immediate flood signal", lead: "120+ min" };
}

function nowLabel() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function hourLabel(iso) { return new Date(iso).toLocaleTimeString([], { hour: "numeric" }); }

function Metric({ icon, label, value, unit, note }) {
  return <div className="metric"><span className="metric-label">{icon} {label}</span><strong>{value}<small>{unit}</small></strong><p>{note}</p></div>;
}

function RiskBadge({ level }) { return <span className={`risk-badge ${level.toLowerCase()}`}><i />{level}</span>; }

function MapPanel({ location, risk, rainfall }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { zoomControl: false, attributionControl: true }).setView([location.latitude, location.longitude], 11);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" });
    const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Tiles © Esri" });
    street.addTo(map);
    const base = { "Street map": street, "Satellite imagery": satellite };
    L.control.layers(base, null, { position: "topright" }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([location.latitude, location.longitude], 11, { animate: true });
    if (layersRef.current) layersRef.current.clearLayers();
    const group = L.layerGroup().addTo(map);
    layersRef.current = group;
    const riskColors = risk.level === "CRITICAL" ? ["#d34b3d", "#ee6d5c", "#f5a08f"] : risk.level === "HIGH" ? ["#d47b2d", "#e99b4c", "#f1bd7b"] : ["#268d7a", "#4aab98", "#8ac8b9"];
    const offsets = [[0.018, -0.025, .012], [-0.008, 0.032, .018], [0.026, 0.028, .009]];
    offsets.forEach(([lat, lng, rad], i) => {
      L.circle([location.latitude + lat, location.longitude + lng], { radius: rad * 1000, color: riskColors[i], fillColor: riskColors[i], fillOpacity: .20, weight: 2 }).bindTooltip(`${["Drainage corridor", "Low-lying ward", "Transport hotspot"][i]} · ${risk.level}`).addTo(group);
    });
    L.marker([location.latitude, location.longitude]).addTo(group).bindPopup(`<b>${location.name}</b><br/>FluxIQ risk: ${risk.level}<br/>3h rainfall: ${rainfall.next3h.toFixed(1)} mm`).openPopup();
    return () => group.clearLayers();
  }, [location, risk, rainfall.next3h]);

  return <div className="map-wrap"><div ref={ref} className="real-map" /><div className="map-overlay"><b>GIS + satellite view</b><span>Switch layers with the map control</span></div></div>;
}

export default function App() {
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [query, setQuery] = useState("Delhi");
  const [weather, setWeather] = useState(DEMO_WEATHER);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Demo hydrology model active · live weather available");
  const [liveWeather, setLiveWeather] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(nowLabel());
  const [tab, setTab] = useState("overview");
  const [backendRisk, setBackendRisk] = useState(null);

  const rainfall = useMemo(() => {
    const values = weather?.hourly?.precipitation || [];
    return { next3h: values.slice(0, 3).reduce((a, b) => a + Number(b || 0), 0), next6h: values.slice(0, 6).reduce((a, b) => a + Number(b || 0), 0), next24h: values.slice(0, 24).reduce((a, b) => a + Number(b || 0), 0) };
  }, [weather]);
  const clientRisk = useMemo(() => classifyRisk(rainfall.next3h, rainfall.next24h), [rainfall]);
  const risk = backendRisk || clientRisk;
  const current = weather?.current || DEMO_WEATHER.current;
  const waterLevel = useMemo(() => Math.max(1.8, 2.15 + rainfall.next3h * .035 + rainfall.next24h * .004), [rainfall]);
  const waterTrend = rainfall.next3h > 20 ? "RISING FAST" : rainfall.next3h > 8 ? "RISING" : "STABLE";
  const forecast = (weather?.hourly?.precipitation || []).slice(0, 8);
  const peak = Math.max(...forecast, 0);
  const peakIndex = Math.max(0, forecast.indexOf(peak));

  async function fetchWeather(lat, lon, label) {
    const params = new URLSearchParams({ latitude: lat, longitude: lon, current: "temperature_2m,relative_humidity_2m,precipitation,rain,showers", hourly: "precipitation,rain,showers", forecast_days: "2", timezone: "auto" });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error("Weather service unavailable");
    const data = await response.json();
    setWeather(data); setLiveWeather(true); setLastUpdate(nowLabel());
    if (API_URL) {
      try {
        const model = await fetch(`${API_URL}/api/flood/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rainfall_3h_mm: (data.hourly?.precipitation || []).slice(0,3).reduce((a,b)=>a+Number(b||0),0), rainfall_24h_mm: (data.hourly?.precipitation || []).slice(0,24).reduce((a,b)=>a+Number(b||0),0) }) });
        if (model.ok) { const result = await model.json(); setBackendRisk({ level: result.level, score: result.score, tone: result.level.toLowerCase(), label: result.label, lead: `${result.lead_time_minutes} min` }); }
      } catch { setBackendRisk(null); }
    }
    setStatus(`Live weather updated for ${label} · flood model recalculated`);
  }

  async function loadCity(name) {
    setBackendRisk(null);
    const clean = name.trim(); if (clean.length < 2) return;
    setLoading(true); setStatus(`Analyzing ${clean}…`);
    try {
      const known = CITIES.find(c => c[0].toLowerCase() === clean.toLowerCase());
      let result = known ? { name: known[0], country: known[1], latitude: known[2], longitude: known[3] } : null;
      if (!result) {
        const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=1&language=en&format=json`);
        if (!geoResponse.ok) throw new Error("Location search failed");
        const geo = await geoResponse.json(); result = geo.results?.[0] && { name: geo.results[0].name, country: geo.results[0].country || "", latitude: geo.results[0].latitude, longitude: geo.results[0].longitude };
      }
      if (!result) throw new Error("Location not found");
      setLocation(result); await fetchWeather(result.latitude, result.longitude, result.name);
      setQuery(result.name);
    } catch (e) { setLiveWeather(false); setStatus(`${e.message} · fallback hydrology model retained`); }
    finally { setLoading(false); }
  }

  function locateMe() {
    setBackendRisk(null);
    if (!navigator.geolocation) return setStatus("Browser location unavailable · search a city instead");
    setLoading(true); setStatus("Getting your location…");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try { const result = { name: "Your location", country: "", latitude: coords.latitude, longitude: coords.longitude }; setLocation(result); await fetchWeather(coords.latitude, coords.longitude, "your location"); }
      catch (e) { setStatus(`${e.message} · fallback model retained`); } finally { setLoading(false); }
    }, () => { setLoading(false); setStatus("Location permission denied · search a city instead"); });
  }

  const alerts = risk.level === "CRITICAL" ? ["Issue public flood warning", "Close exposed underpasses", "Dispatch pumps / response teams"] : risk.level === "HIGH" ? ["Put response teams on standby", "Inspect drainage choke points", "Prepare public advisory"] : ["Continue monitoring", "Keep drainage crews on watch", "No public warning indicated"];
  const wards = [
    ["Central drainage corridor", risk.level, Math.min(99, risk.score + 4)],
    ["Low-lying residential belt", risk.level === "LOW" ? "MODERATE" : risk.level, Math.min(96, risk.score + 1)],
    ["Transit / underpass cluster", risk.level === "CRITICAL" ? "CRITICAL" : risk.level === "HIGH" ? "HIGH" : "MODERATE", Math.min(94, risk.score - 3 + (risk.level === "LOW" ? 20 : 0))],
  ];

  return <main>
    <nav><a className="brand" href="#top">flux<span>i</span>q</a><div className="nav-links"><a href="#dashboard">Dashboard</a><a href="#map">GIS map</a><a href="#response">Response</a><a href="#how">Model</a></div><div className="nav-status"><i /> SYSTEM ONLINE</div></nav>

    <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow">SIH 2026 · URBAN FLOOD DETECTION & NOWCASTING</p><h1>Know where water <em>will rise next.</em></h1><p className="lede">FluxIQ turns rainfall, forecast accumulation and location context into a transparent short-horizon flood-risk signal for urban response teams.</p><div className="hero-actions"><a href="#dashboard" className="primary-link">Open command dashboard <span>↓</span></a><button className="ghost-button" onClick={locateMe}>◎ Use my location</button></div></div><div className="hero-stat"><span>NOWCAST LEAD TIME</span><strong>{risk.lead}</strong><small>risk horizon</small><div className="orbit"><i /><i /><i /></div></div></section>

    <section className="dashboard" id="dashboard">
      <div className="dashboard-top"><div><p className="eyebrow dark">Operational view</p><h2>Flood command dashboard</h2></div><form className="search" onSubmit={e => { e.preventDefault(); loadCity(query); }}><span>⌕</span><input list="city-list" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search any city or district" /><datalist id="city-list">{CITIES.map(c => <option key={c[0]} value={c[0]} />)}</datalist><button disabled={loading}>{loading ? "Analyzing…" : "Analyze"}</button></form></div>
      <div className="location-row"><div><span className="pin">●</span> {location.name}{location.country ? `, ${location.country}` : ""}</div><span>{location.latitude.toFixed(3)}°, {location.longitude.toFixed(3)}°</span><span className={`data-badge ${liveWeather ? "live" : "model"}`}>{liveWeather ? "LIVE WEATHER" : "MODEL FALLBACK"}</span><span className="update">Updated {lastUpdate}</span></div>

      <div className="risk-grid"><article className={`risk-card ${risk.tone}`}><div className="risk-card-head"><span>Composite flood signal</span><RiskBadge level={risk.level} /></div><div className="risk-number">{risk.score}<small>/100</small></div><h3>{risk.label}</h3><p>Model combines near-term rainfall intensity and forecast accumulation. Water level shown below is a derived hydrology estimate unless an official gauge feed is configured.</p><div className="risk-bar"><i style={{ width: `${risk.score}%` }} /></div><div className="risk-foot"><span>Confidence <b>{liveWeather ? "Weather-fed" : "Demo scenario"}</b></span><span>Lead <b>{risk.lead}</b></span></div></article>
      <div className="metric-grid"><Metric icon="🌧" label="Rain now" value={Number(current.precipitation || 0).toFixed(1)} unit=" mm" note="Current precipitation" /><Metric icon="☔" label="Next 3 hours" value={rainfall.next3h.toFixed(1)} unit=" mm" note="Accumulated forecast" /><Metric icon="💧" label="Water level" value={waterLevel.toFixed(2)} unit=" m" note={`${waterTrend} · model estimate`} /><Metric icon="🌡" label="Temperature" value={Math.round(current.temperature_2m || 0)} unit="°C" note={`${Math.round(current.relative_humidity_2m || 0)}% humidity`} /></div></div>

      <div className="tabs"><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Overview</button><button className={tab === "wards" ? "active" : ""} onClick={() => setTab("wards")}>Ward priorities</button><button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>Data & model</button></div>

      {tab === "overview" && <div className="lower-grid"><article className="map-card" id="map"><div className="card-head"><div><span>Geospatial intelligence</span><h3>Flood-risk & satellite map</h3></div><a href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer" className="map-link">Open Google Maps ↗</a></div><MapPanel location={location} risk={risk} rainfall={rainfall} /><div className="map-legend"><span><i className="critical-dot" />Critical</span><span><i className="high-dot" />High</span><span><i className="moderate-dot" />Moderate</span><span><i className="low-dot" />Low</span><span className="legend-note">Satellite + street layers · Esri / OpenStreetMap</span></div></article>
      <article className="forecast-card"><div className="card-head"><div><span>Nowcasting window</span><h3>Rainfall trajectory</h3></div><strong>Peak {peak.toFixed(1)} mm/h</strong></div><div className="forecast-bars">{forecast.map((value, index) => <div className="bar-wrap" key={index}><div className="bar-track"><i style={{ height: `${Math.max(5, Math.min(100, Number(value) * 7))}%` }} /></div><span>{hourLabel(weather?.hourly?.time?.[index] || new Date())}</span></div>)}</div><div className="forecast-callout"><b>{peak >= 10 ? "⚠ Heavy rainfall window" : "✓ No extreme rainfall peak"}</b><span>{peakIndex < 4 ? "Strongest signal is near current time." : `Peak expected around ${hourLabel(weather?.hourly?.time?.[peakIndex])}.`}</span></div><div className="mini-table"><div><span>24h accumulation</span><b>{rainfall.next24h.toFixed(1)} mm</b></div><div><span>Risk threshold</span><b>{risk.score >= 58 ? "Exceeded" : "Within range"}</b></div></div></article></div>}

      {tab === "wards" && <section className="priority-panel"><div className="section-title"><div><span>Decision queue</span><h3>Priority areas for response</h3></div><RiskBadge level={risk.level} /></div>{wards.map(([name, level, score]) => <div className="ward-row" key={name}><div className="ward-name"><b>{name}</b><small>Derived exposure zone · {location.name}</small></div><RiskBadge level={level} /><div className="ward-score"><i style={{ width: `${score}%` }} /><span>{score}/100</span></div><button onClick={() => setStatus(`${name} added to response watchlist`)}>Watch</button></div>)}</section>}

      {tab === "data" && <section className="data-panel"><div className="data-card"><span>Weather feed</span><b>{liveWeather ? "Open-Meteo live" : "Built-in demo scenario"}</b><small>Current + hourly precipitation</small></div><div className="data-card"><span>Water level</span><b>Hydrology-derived</b><small>Estimated from rainfall signal; replace with official gauge API for field deployment</small></div><div className="data-card"><span>GIS / satellite</span><b>Working map layers</b><small>Esri World Imagery + OpenStreetMap</small></div><div className="data-card"><span>Risk engine</span><b>Transparent score</b><small>Rainfall intensity + accumulation → risk band</small></div></section>}

      <section className="signals-row" id="response"><div><span>💧 WATER LEVEL</span><b>{waterLevel.toFixed(2)} m · {waterTrend}</b><small>Derived hydrology signal</small></div><div><span>🛰 GIS / SATELLITE</span><b>CONNECTED</b><small>Interactive imagery layer</small></div><div><span>🤖 NOWCAST</span><b>{risk.lead} LEAD</b><small>Rainfall-driven forecast</small></div><div><span>🚨 RESPONSE</span><b>{risk.level === "CRITICAL" ? "ISSUE WARNING" : risk.level === "HIGH" ? "STANDBY TEAMS" : "MONITOR"}</b><small>Recommended action</small></div></section>
      <p className="status" aria-live="polite">● {status}</p>
    </section>

    <section className="response" id="response"><div className="response-head"><div><p className="eyebrow">Response playbook</p><h2>From signal to action.</h2></div><div className="alert-box"><span>Current recommendation</span><strong>{risk.level === "CRITICAL" ? "Issue public warning" : risk.level === "HIGH" ? "Stand by response teams" : "Continue monitoring"}</strong></div></div><div className="action-grid">{alerts.map((a, i) => <div key={a}><b>0{i + 1}</b><h3>{a}</h3><p>Recommended operational step when the current flood-risk signal reaches the {risk.level.toLowerCase()} band.</p></div>)}</div></section>

    <section className="how" id="how"><div><p className="eyebrow">Model architecture</p><h2>Evidence → prediction → response.</h2></div><div className="steps"><div><b>01 · SENSE</b><h3>Rain + location</h3><p>Live weather and geocoding provide a location-aware precipitation signal.</p></div><div><b>02 · NOWCAST</b><h3>Risk engine</h3><p>A transparent rainfall accumulation model produces a 0–100 flood-risk score and lead-time band.</p></div><div><b>03 · RESPOND</b><h3>GIS + action</h3><p>Risk zones, priority areas and response recommendations give teams an operational next step.</p></div></div></section>
    <footer><span>FluxIQ · Urban Flood Detection & Nowcasting</span><span>SIH 2026 prototype · Emergency decisions must use official authority alerts and gauge data.</span></footer>
  </main>;
}
