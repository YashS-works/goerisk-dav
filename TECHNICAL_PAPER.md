# GeoRisk DAV: Technical Architecture & Implementation

## System Overview

GeoRisk DAV (Geopolitical Risk Data Analytics & Visualization) is a full-stack web application that models how geopolitical shocks — armed conflicts, economic sanctions, and supply disruptions — cascade across international networks through energy, trade, and food security domains. The system combines quantitative spillover modeling, graph-based network analysis, large language model (LLM) enrichment, and interactive visualization to provide decision-grade geopolitical risk intelligence.

---

## 1. Technical Stack

### 1.1 Backend

| Layer | Technology | Version |
|-------|-----------|---------|
| Web Framework | FastAPI | Latest |
| ASGI Server | Uvicorn | Latest |
| Data Processing | Pandas, NumPy | Latest |
| Graph Analysis | NetworkX | Latest |
| Async HTTP | httpx | Latest |
| LLM Orchestration | LangChain | Latest |
| LLM Providers | Mistral AI (mistral-small-latest), OpenAI (GPT-4o-mini) | Latest |
| Runtime | Python 3.10+ | 3.10 |
| Environment | python-dotenv | Latest |

### 1.2 Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | React | 19.2.4 |
| Build Tool | Vite | 8.0.4 |
| Styling | Tailwind CSS | 4.2.2 |
| Routing | React Router DOM | v7 |
| State Management | Zustand | Latest |
| Graph Visualization | D3.js | 7.9.0 |
| Chart Library | Chart.js + react-chartjs-2 | 4.5.1 |
| Map Rendering | Leaflet + react-leaflet | 1.9.4 |
| Animation | Framer Motion | 12.38.0 |
| HTTP Client | Axios | 1.15.0 |
| Icon Library | Lucide React | 1.14.0 |

### 1.3 External Data APIs

| API | Data Provided | Fallback Strategy |
|-----|--------------|-------------------|
| REST Countries API (v3) | 192 countries — name, ISO-2/3 codes, lat/lon, region, borders, population | None (required) |
| World Bank API | Energy import %, Food import %, Trade/GDP %, GDP (USD) | Last-known-value per indicator |
| U.S. EIA API v2 | Crude oil imports by country | Static fallback dictionary |
| FAO (UN Food & Agriculture) | Food dependency, wheat reliance | Static 2022 pre-compiled dataset |
| OEC World API | Bilateral trade flows (2022) for 48 countries | Empty dictionary for uncovered countries |
| ACLED | Active conflict events | 12 hardcoded April 2025 reference events |
| Mistral AI | Geo-relevance multipliers, quiz generation, insight cards, household impact narratives | Required for full AI functionality |
| OpenAI (GPT-4o-mini) | Cascade validation, real-world consequence chain generation | Graceful fallback to Mistral |

---

## 2. Backend Architecture

### 2.1 Application Entry Point

The backend is structured as a FastAPI application (`main.py`) with four modular routers: `countries`, `simulation`, `analytics`, and `quiz`. On application startup, an asynchronous three-phase data pipeline pre-fetches and caches all external data into a singleton `DataCache` object, enabling sub-second response times for subsequent API calls.

CORS middleware is configured to accept requests from the frontend development server (`localhost:5173`) and alternative port (`localhost:3000`). A `/health` endpoint exposes cache readiness status for monitoring.

### 2.2 Data Caching Pipeline

Data initialization proceeds in three parallel phases to minimize startup latency:

- **Phase 1 (parallel):** REST Countries metadata + World Bank economic indicators (4 indicators × 192 countries)
- **Phase 2 (parallel):** EIA crude oil imports + FAO food dependency data + OEC bilateral trade flows
- **Phase 3:** ACLED conflict events (with hardcoded fallback)

All data is stored in a `DataCache` singleton and reused across all request handlers, eliminating redundant external API calls during runtime.

### 2.3 API Routers

#### Countries Router (`/data`)
- `GET /data/all` — Returns metadata for all 192 countries (name, ISO codes, geographic coordinates, region, border countries, population).
- `GET /data/si/all` — Computes and returns Spillover Index (SI) scores for all countries, parameterized by `shock_type` and `intensity`.
- `GET /data/si/{code}` — Returns the full SI profile for a single country, including neighbor SI scores and nearby conflict events.
- `GET /data/conflicts` — Returns all active conflict events from ACLED (or fallback dataset).

#### Simulation Router (`/simulate`)
- `POST /simulate/run` — Core endpoint. Accepts two country codes (`countryA`, `countryB`), shock type (`war`, `sanctions`, `supply`), intensity (0.1–1.0), and domain (`all`, `energy`, `trade`, `food`). Executes dual cascade simulations (both countries as independent shock origins), merges results, applies LLM enrichment, applies geopolitical re-ranking, and returns the full cascade timeline (t0–t3), per-country impact data, bilateral SI scores, and a global SI heatmap of the top-50 most affected countries.
- `GET /simulate/timestep/{code}/{step}` — Returns SI data for a specific cascade timestep (supports timeline scrubbing in the frontend).
- `GET /simulate/country/{code}` — Returns a full country profile including bilateral cascade SI against all 192 countries.

#### Analytics Router (`/analytics`)
- `GET /analytics/network` — Returns D3-compatible force-graph data (nodes = countries, edges = trade/border dependencies), filtered to 60 nodes for rendering performance.
- `GET /analytics/bottlenecks` — Returns the top bottleneck countries ranked by a composite centrality score.
- `GET /analytics/clusters` — Returns vulnerability clusters identified through community detection.
- `GET /analytics/path/{origin}/{target}` — Returns the shortest cascade propagation path between two countries.
- `GET /analytics/trends` — Returns a simulated 12-month SI progression for the top-10 most exposed countries.
- `GET /analytics/summary` — Returns a full dashboard summary with country counts at each risk level (critical / high / moderate / low) and aggregate statistics.

#### Quiz & Insights Router (`/quiz`)
- `POST /quiz/generate` — Generates dynamic, scenario-specific quiz questions via Mistral AI based on actual cascade simulation results.
- `POST /quiz/insights` — Generates AI insight cards covering bottleneck analysis, cluster vulnerabilities, and comparative country assessments.
- `GET /quiz/leaderboard` — Returns the user leaderboard sorted by XP (experience points).
- `POST /quiz/leaderboard/update` — Updates a user's XP score.
- `DELETE /quiz/leaderboard/reset` — Resets the leaderboard (for testing).

---

## 3. Core Algorithms & Models

### 3.1 Spillover Index (SI)

The Spillover Index is the foundational quantitative metric of the system. For each country, SI measures its structural vulnerability to a given geopolitical shock across three economic domains: energy, trade, and food security.

**Formula:**

```
SI = (energy_score × w_e) + (trade_score × w_t) + (food_score × w_f)
```

Where individual domain scores are derived from World Bank indicators:

```
energy_score = min(1.0, energy_import_percentage / 100)
trade_score  = min(1.0, trade_to_gdp_ratio / 200)
food_score   = min(1.0, food_import_percentage / 100)
```

Domain weights vary by shock type, reflecting the differential transmission mechanisms of each shock:

| Shock Type | w_e (Energy) | w_t (Trade) | w_f (Food) |
|-----------|-------------|------------|------------|
| Armed Conflict (war) | 0.50 | 0.30 | 0.20 |
| Economic Sanctions | 0.35 | 0.45 | 0.20 |
| Supply Disruption | 0.25 | 0.35 | 0.40 |

The final SI is scaled by the user-specified intensity parameter (0.1–1.0) and clamped to the range [0, 1]. Countries are then classified into four risk tiers: **Critical** (SI ≥ 0.75), **High** (SI ≥ 0.50), **Moderate** (SI ≥ 0.25), and **Low** (SI < 0.25).

### 3.2 Cascade Propagation Model

The cascade engine (`services/cascade_engine.py`) implements a four-timestep multi-domain propagation model that simulates how geopolitical shocks spread from origin countries through the international network over time.

**Timestep Architecture:**

| Timestep | Domain Layer | Propagation Mechanism | Decay Rate |
|----------|-------------|----------------------|------------|
| t0 | Origin | Shock epicenter (countries A and B) | 1.0× (none) |
| t1 | Energy | Direct neighbors + high bilateral trade partners | 1.0× |
| t2 | Trade | Secondary neighbors + regional priority countries | 0.76× (energy→trade) |
| t3 | Food | Tertiary network + distant partners | 0.64× (trade→food) |

**Propagation Parameters:**

Maximum hops per timestep are shock-type dependent, reflecting the speed and reach of different shock mechanisms:
- Armed conflict: 4 hops (rapid, broad geographic impact)
- Sanctions: 3 hops (economic contagion propagates through trade networks)
- Supply disruption: 2 hops (more localized, commodity-specific impact)

**Dual-Origin Cascade Merging:**

For a given simulation involving countries A and B, the engine runs two independent cascades — one with A as origin and one with B as origin — and merges them by taking the maximum SI at each geographic node. This models the compounded vulnerability that arises when two major parties are simultaneously involved in a geopolitical event.

**Regional Priority Lists:**

The engine encodes geopolitical domain knowledge through hardcoded regional priority lists for known conflict dyads. For example:
- India–Pakistan scenarios prioritize: Nepal, Bangladesh, Sri Lanka, Afghanistan
- Russia–China scenarios prioritize: Mongolia, Kazakhstan, Kyrgyzstan
- USA–Allies scenarios prioritize: EU member states, Japan, South Korea
- Iran–Gulf scenarios prioritize: Saudi Arabia, UAE, Iraq, Kuwait

**Pair-Specific Layer Priors:**

Certain country pair configurations have predefined cascade layer priors that encode known geopolitical supply chain structures (e.g., energy corridor dependencies, alliance-based trade preferences).

### 3.3 Deterministic Geopolitical Re-Ranking

A post-hoc geopolitical re-ranking layer (`services/geo_ranker.py`) applies multiplicative corrections to raw SI scores to prevent structurally-open but geopolitically-peripheral economies from dominating rankings.

**Multiplier Rules:**

| Condition | Multiplier |
|----------|-----------|
| Country is a direct conflict participant | 3.0× |
| Country borders both conflict parties | 2.5× |
| Country borders one conflict party | 2.0× |
| High bilateral trade (≥8% of a party's exports) | 1.3–2.5× |
| Small structurally-open economy with no conflict link | 0.25× |
| Default (no special condition) | 1.0× |

Examples of economies subject to the small-economy dampening (0.25×): Malta, Luxembourg, Singapore, Estonia, Cyprus, Bahrain. This correction ensures that re-export hubs with high structural trade openness do not artificially rank above countries with direct geopolitical exposure.

### 3.4 Network Centrality Analysis

The network analysis service (`services/network_analyzer.py`) builds a directed dependency graph using NetworkX, where nodes represent countries and edges represent trade flows and border adjacencies. A composite centrality score is computed for each country using weighted contributions from four standard graph metrics:

```
Composite Score = 0.35 × betweenness + 0.25 × (PageRank × 100) + 0.25 × closeness + 0.15 × in_degree_normalized
```

This composite score identifies **bottleneck countries** — nodes whose removal would most significantly disrupt the international risk propagation network. Community detection algorithms identify **vulnerability clusters** of countries that share similar exposure profiles.

---

## 4. AI & LLM Integration

### 4.1 Architecture Overview

The system uses a two-stage hybrid LLM pipeline (`services/langchain_orchestrator.py`) that separates geopolitical intelligence generation (Mistral AI) from cascade validation and consequence chain generation (OpenAI GPT-4o-mini). LangChain provides the orchestration layer for prompt templating, structured output parsing, and runnable chain composition.

### 4.2 Stage 1: Mistral AI — Geopolitical Enrichment

**Model:** `mistral-small-latest` | Temperature: 0.15 | Max tokens: 2,500

**Sub-task 1a — Sector & Household Impact Generation:**
For the top-8 most affected countries in a simulation, Mistral generates:
- Affected economic sectors (energy, manufacturing, agriculture, etc.)
- Household-level impact narratives (cost of living, employment, supply scarcity)

**Sub-task 1b — Geo-Multiplier Assignment:**
For the top-40 countries plus all border countries of the conflict parties, Mistral assigns geopolitical relevance multipliers (range 0.25–3.0) considering:
- Border relationships and geographic proximity
- Alliance memberships (NATO, CSTO, SCO, ASEAN)
- Energy supply corridors and pipeline dependencies
- Critical commodity supply chains
- Bilateral trade significance

A shared reasoning instruction ensures consistent evaluation criteria across all Mistral calls.

**Mistral Country Context** (`services/mistral_country_context.py`):
For individual country deep-dives, Mistral generates structured narratives covering:
military consequences, regional spillovers, energy market impacts, supply chain disruptions, food security implications, trade flow changes, alliance response patterns, currency/market effects.

### 4.3 Stage 2: OpenAI GPT-4o-mini — Cascade Validation

**Model:** `gpt-4o-mini` | Temperature: 0.20 | Max tokens: 3,500

GPT-4o-mini validates the cascade rankings generated by the quantitative model and adds real-world consequence chains — contextualizing model outputs against historical precedent and current geopolitical context. If the OpenAI API is unavailable, the system gracefully falls back to Mistral for this stage, ensuring simulation completion.

### 4.4 Quiz & Insight Generation

**Quiz Generation** (`services/quiz_generator.py`):
Mistral generates 5 scenario-specific multiple-choice quiz questions grounded in the actual simulation results, testing users' understanding of the cascade dynamics, affected countries, and transmission mechanisms.

**Insight Card Generation** (`services/insight_generator.py`):
Mistral generates structured insight cards covering: bottleneck identification, cluster vulnerability analysis, cross-country comparisons, and resilience assessments.

---

## 5. Frontend Architecture

### 5.1 Application Structure

The frontend is a single-page application (SPA) built with React 19 and Vite, organized into 7 pages, 4 Zustand state stores, 4 API client modules, 12+ components, and several utility modules.

The Vite development server runs on port 5173 and proxies all `/api` requests to the FastAPI backend at `localhost:8000`, enabling seamless local development without CORS issues. The production build outputs to `frontend/dist/` as a static SPA.

### 5.2 State Management (Zustand)

The application uses four domain-specific Zustand stores:

**useDataStore** — Global data store:
- Holds: all countries, SI scores, active conflicts, analytics summary, bottlenecks, clusters, trends, network graph data
- Per-category loading flags for granular UI loading states
- Accessor methods: `getCountry(code)`, `getSI(code)`

**useSimStore** — Simulation state:
- Inputs: `selA`, `selB` (selected countries), `shockType`, `intensity`, `domain`
- Outputs: `isRunning`, `hasRun`, `result`, `cascadeStep`, `error`
- Guard: `canFire()` validates that both countries are selected and no simulation is in progress

**useBrushStore** — Cross-component interaction:
- Maintains `hoveredCountry` for synchronized highlighting across map, network graph, and vulnerability list

**useXPStore** — Gamification:
- XP points, level, badge collection, correct answer count
- Quiz state: questions array, current question index, answers array, completion flag

### 5.3 Pages

| Route | Page | Function |
|-------|------|----------|
| `/` | MapPage | Interactive world map with conflict picker and shock configuration |
| `/cascade` | CascadePage | Tectonic plate visualization of 3-domain shock propagation (t0–t3) |
| `/analytics` | AnalyticsPage | Multi-panel analytics dashboard (network, bottlenecks, clusters, trends) |
| `/network` | NetworkPage | D3 force-directed graph of country dependency network |
| `/vulnerability` | VulnerabilityPage | Ranked vulnerability list with exposure breakdowns |
| `/quiz` | QuizPage | AI-generated interactive quiz with XP rewards and leaderboard |
| `/insights` | InsightsPage | AI-generated insight cards with typewriter animation |

### 5.4 Key Components

**WorldMap.jsx** — SVG-based interactive world map rendering all 192 country zones. Features:
- SI-score-driven choropleth coloring using a five-tier color scale (red/orange/yellow/cyan/gray)
- Click-to-select interaction for choosing conflict parties
- Animated border markers at active conflict locations
- Real-time re-coloring when shock parameters change

**TectonicScene.jsx** — The primary simulation visualization. Renders three stacked "tectonic plate" layers (energy / trade / food) representing the three cascade domains. A shock bolt animation propagates through the layers at each timestep (t0→t1→t2→t3), with each affected country node appearing with an animated glow proportional to its SI score.

**NetworkGraph.jsx** — D3 force-directed graph with:
- Nodes sized and colored by SI score
- Edge thickness weighted by trade volume or border adjacency strength
- Hover interaction synchronized with `useBrushStore`
- Filtered to 60 nodes for rendering performance

**AnalyticsDashboard.jsx** — Multi-panel dashboard combining Chart.js time-series charts (SI trends), ranked bar charts (bottlenecks), cluster group cards, and a global risk heatmap.

**QuizPanel.jsx** — Multiple-choice quiz interface with animated transitions between questions, correct/incorrect feedback, XP award animation, and leaderboard submission form.

**AIInsights.jsx** — Displays Mistral-generated insight cards with typewriter-style text animation using Framer Motion.

### 5.5 Visualization Color Scale

The `utils/colorScale.js` module maps SI scores to a consistent five-tier color system used across all visualizations:

| Risk Level | SI Range | Color | Hex |
|-----------|---------|-------|-----|
| Critical | ≥ 0.75 | Red | `#ff2d55` |
| High | ≥ 0.50 | Orange | `#ff9f1c` |
| Moderate | ≥ 0.25 | Yellow | `#ffd60a` |
| Low | < 0.25 | Cyan | `#00d5ff` |
| None | 0 | Gray | `#64748b` |

Domain-specific colors are also defined: energy (cyan), trade (green), food (yellow), combined (red).

### 5.6 API Client Layer

All backend communication is handled through a structured Axios-based client layer (`src/api/`), organized by domain:

- **client.js** — Axios instance with base URL, 30-second timeout, request/response interceptors for logging
- **countries.js** — Country metadata and SI score endpoints
- **simulation.js** — Cascade simulation and country profile endpoints
- **analytics.js** — Network, bottleneck, cluster, path, trend, and summary endpoints
- **quiz.js** — Quiz generation, insight generation, and leaderboard endpoints

### 5.7 Utility Modules

**scenarioAnalytics.js** — Client-side analytics utilities:
- `flattenScenarioCountries(result)` — Extracts and sorts all affected countries from cascade output
- `topScenarioCountriesByDomain(result, limit)` — Top-N countries ranked by domain-specific SI
- `summarizeScenario(result)` — Aggregates risk-tier counts and domain averages
- `buildScenarioNetwork(result)` — Converts cascade data to D3-compatible graph format
- `buildScenarioBottlenecks(result, limit)` — Computes centrality from cascade data
- `buildScenarioClusters(result)` — Groups countries by exposure type

**formatter.js** — Number and percentage formatting helpers for consistent UI display.

---

## 6. Data Flow

### 6.1 Application Initialization

On mount, `App.jsx` calls `loadInitialData()`, which dispatches parallel requests for: all country metadata, active conflicts, baseline SI scores (shock_type=war, intensity=0.7), analytics summary, bottlenecks, and vulnerability clusters. Results are stored in `useDataStore` and the application renders with pre-loaded data.

### 6.2 Simulation Flow

1. User selects two countries on the interactive world map (MapPage) → stored in `useSimStore` as `selA`, `selB`
2. User configures shock parameters (type and intensity) via ShockControls
3. User triggers simulation → frontend calls `POST /simulate/run`
4. Backend executes:
   a. Dual cascade simulation (A as origin, B as origin)
   b. Cascade merging (max SI per country)
   c. LLM enrichment (Mistral geo-multipliers + sector/household impacts)
   d. OpenAI cascade validation (or Mistral fallback)
   e. Deterministic geopolitical re-ranking
5. Backend returns: cascade timeline (t0–t3), country_impacts (top-50), bilateral SI scores, global SI heatmap
6. Frontend stores result in `useSimStore` → CascadePage renders TectonicScene animation
7. User can scrub through timesteps (t0→t3) via timeline control
8. Clicking an affected country loads its bilateral profile via `GET /simulate/country/{code}`
9. Quiz generation: `POST /quiz/generate` with simulation context → QuizPage renders questions
10. Insight generation: `POST /quiz/insights` with simulation context → InsightsPage renders cards

### 6.3 Analytics Flow

AnalyticsPage fires all analytics endpoints in parallel on mount, populating the dashboard with network topology, centrality rankings, community clusters, and 12-month SI trend projections for the top-10 most exposed economies.

### 6.4 Gamification Flow

Users earn XP for each correctly answered quiz question. XP accumulates across sessions and triggers level-up events at defined thresholds. Badges are awarded for milestones. Final XP scores are submitted to a server-side leaderboard sorted by XP descending, enabling competitive engagement.

---

## 7. Architectural Patterns & Design Decisions

**Graceful Degradation:** The system operates at reduced capability rather than failing when external APIs are unavailable. All data sources have at least one fallback, and the AI pipeline functions with either Mistral alone or the full Mistral + OpenAI stack.

**Async-First Backend:** FastAPI's async support is leveraged for all I/O-bound operations (external API calls, LLM requests). CPU-bound calculations (NumPy, NetworkX) run synchronously within async endpoints.

**Separation of Quantitative and Qualitative Intelligence:** The deterministic cascade model provides a reproducible, explainable baseline SI score. LLM enrichment layers add geopolitical context and narrative quality without replacing the quantitative foundation, preserving auditability.

**Domain-Encoded Geopolitical Knowledge:** Rather than relying purely on data-driven inference, the cascade engine encodes expert domain knowledge through regional priority lists, pair-specific layer priors, and alliance membership rules. This hybrid approach combines statistical modeling with structured geopolitical reasoning.

**Multi-Store Zustand Architecture:** The frontend uses four purpose-specific stores rather than a single monolithic store, reducing re-render scope and making state transitions easier to trace for complex simulation and gamification flows.

**Tectonic Plate Metaphor:** The choice of a "tectonic plates" visual metaphor for the cascade visualization serves a pedagogical purpose — it communicates the concept of slow-building pressure across interconnected domains leading to sudden, cascading ruptures, which mirrors the actual dynamics of geopolitical shock propagation.

---

## 8. System Architecture Diagram (Textual)

```
┌──────────────────────────────────────────────────────────────┐
│                      FRONTEND (React + Vite)                  │
│                                                              │
│  Pages: Map | Cascade | Analytics | Network | Quiz | Insights │
│  State: useDataStore | useSimStore | useBrushStore | useXPStore│
│  Viz:   WorldMap (SVG) | TectonicScene | NetworkGraph (D3)    │
│  API:   Axios client → /api proxy → localhost:8000           │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP (JSON REST)
┌────────────────────────▼─────────────────────────────────────┐
│                   BACKEND (FastAPI + Uvicorn)                 │
│                                                              │
│  Routers: /data | /simulate | /analytics | /quiz             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Core Services                                        │    │
│  │  si_calculator → Spillover Index formula             │    │
│  │  cascade_engine → 4-timestep propagation model       │    │
│  │  geo_ranker → Deterministic geopolitical multipliers │    │
│  │  network_analyzer → Graph centrality + clustering    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ AI Services (LangChain Orchestration)                │    │
│  │  Mistral API → geo-multipliers, quiz, insights       │    │
│  │  OpenAI GPT-4o-mini → cascade validation             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Data Cache (singleton, async 3-phase init)           │    │
│  │  REST Countries | World Bank | EIA | FAO | OEC | ACLED│   │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Key Implementation Files

| File | Role |
|------|------|
| `backend/main.py` | FastAPI app entry point, CORS, router registration, startup cache init |
| `backend/services/si_calculator.py` | Spillover Index formula with shock-type weighting |
| `backend/services/cascade_engine.py` | 4-timestep multi-domain cascade propagation |
| `backend/services/geo_ranker.py` | Deterministic geopolitical re-ranking multipliers |
| `backend/services/network_analyzer.py` | Graph construction, centrality, community detection |
| `backend/services/langchain_orchestrator.py` | Mistral + OpenAI hybrid LLM pipeline |
| `backend/services/mistral_geo_relevance.py` | Mistral geo-multiplier generation |
| `backend/services/quiz_generator.py` | Mistral quiz question generation |
| `backend/services/insight_generator.py` | Mistral insight card generation |
| `backend/utils/cache.py` | Async data cache with 3-phase initialization |
| `backend/routers/simulation.py` | Simulation endpoint with full enrichment pipeline |
| `frontend/src/App.jsx` | SPA root, router, initial data loading |
| `frontend/src/store/useSimStore.js` | Simulation state management |
| `frontend/src/store/useDataStore.js` | Global data state management |
| `frontend/src/components/WorldMap.jsx` | SVG world map with SI choropleth |
| `frontend/src/components/TectonicScene.jsx` | Cascade tectonic plate visualization |
| `frontend/src/components/NetworkGraph.jsx` | D3 force-directed network graph |
| `frontend/src/utils/colorScale.js` | SI → color mapping utilities |
| `frontend/src/utils/scenarioAnalytics.js` | Client-side scenario aggregation |
