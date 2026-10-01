# Drinks Atlas

Drinks Atlas unifies a United States brewery map and a curated cocktail explorer into a single-page interactive atlas. When a user selects any brewery city, the atlas pulls live atmospheric weather from Open-Meteo, calculates a localized cocktail menu combining geography, origin claims, and temperature conditions, and displays the city's craft breweries alongside its drinks.

Tagline: *Beer by place, cocktails by weather.*

---

## The Three Data Sources

The project integrates three free, public data APIs:

1. **Open Brewery DB** (`api.openbrewerydb.org`)
   - Provides craft brewery locations, types, cities, and states across the United States.
   - Breweries are mapped individually by coordinate without external map tiles.

2. **24cocktails.com** (`24cocktails.com`)
   - Bulk recipe catalogue containing over 7,200 tested cocktail recipes.
   - Includes base spirits, ABV strengths, glassware, methods, ingredient measures, and preparation steps.
   - Every recipe links directly to its canonical page on 24cocktails.com in compliance with terms of service.

3. **Open-Meteo** (`open-meteo.com`)
   - **Forecast API**: Live hourly temperatures, apparent temperatures, relative humidity, wind speed, and WMO weather codes for selected cities.

---

## How They Connect: City → Weather → Drinks

1. **City Selection**: A user selects any US brewery city via dot selection on the map, clicking top urban brewery clusters, or searching by name.
2. **Atmospheric Reading**: The browser calls Open-Meteo for the city's current conditions (temperature, humidity, wind, and sky condition).
3. **Scoring Engine**: Every cocktail receives a score combining:
   - **Location Points**: Claimed birthplaces, place name matches, state agricultural signature ingredients, and regional taste profiles.
   - **Weather Points**: Real-time atmospheric conditions (temperatures below 50°F favor warm/stirred drinks; 50–80°F favor shaken sours and citrus; above 80°F favor cold, frozen, long, and sparkling drinks; humidity and precipitation favor comforting or effervescent drinks).
4. **City Menu Card**: A slide-in bar menu presents the top 6 drinks, each with dotted leaders, strength percentage, and a concise reason line from the highest-contributing rule, accompanied by local brewery statistics.

---

## Matches: Data vs. Curation

* **Location Curation**:
  - **Born Here**: Claimed birthplaces only (e.g. Sazerac, Ramos Gin Fizz, Hurricane in New Orleans; Manhattan in New York; Clover Club in Philadelphia; Ward Eight in Boston; Gin Rickey in Washington DC; Last Word in Detroit; Old Fashioned in Louisville; Pisco Punch & Irish Coffee in San Francisco; Mai Tai in Oakland; Brandy Old Fashioned in Wisconsin).
  - **State Signature Ingredients**: Curated state agricultural pairings (Georgia peach, Florida orange/citrus, Texas grapefruit, Vermont maple, Washington apple, Michigan cherry, Maine blueberry, Wisconsin/Massachusetts cranberry, Hawaii pineapple, Kentucky bourbon/mint, New Mexico chile, Oregon hazelnut/pear).
  - **Regional Profiles**: Seven US regional traditions mapping base spirits and flavor notes (South, Mountain West, Northeast, Southwest, Midwest, California, Pacific Northwest).
* **Location & Weather Data**:
  - **Named After Here (Data)**: Automated scanning of recipe titles for US states, brewery cities, and famous place names (Manhattan, Brooklyn, Bronx, Hollywood, Harlem), with explicit removal of false positives (such as historical persons like George Washington).
  - **Live Weather (Data)**: Real-time temperature bands, humidity, and precipitation fetched directly from Open-Meteo.

> **Note**: Birthplaces, state signatures, and regional favorites are our picks. Weather and names come from the data.

---

## Caching and `--refresh`

To ensure fast load times and minimize external API calls:
- `data/brewery_cache.json`: Stores all validated US breweries with coordinates. On subsequent runs, `fetch_data.py` reuses this cache.
- `data/cocktail_cache.json`: Stores 7,215 processed cocktail recipes with calculated derived fields (`strength`, `serving_temp_c`, `flavor_families`, `style`, `is_long`).
- `data/place_matches.json`: Precomputed name matches and false-positive filter log.
- **`--refresh` Option**: Running `python3 fetch_data.py --refresh` forces a fresh download of all data from both Open Brewery DB and 24cocktails.com.
- **In-Browser Session Cache**: Live weather calls are cached in memory for the duration of the browser session.

---

## How to Run

### 1. Requirements
Ensure Python 3.9+ is installed with `requests` and `plotly`:
```bash
pip install requests plotly
```

### 2. Fetch Data
Run `fetch_data.py` from the `DrinksAtlas2` folder:
```bash
python3 fetch_data.py
```
To force a fresh download of both Open Brewery DB and 24cocktails:
```bash
python3 fetch_data.py --refresh
```

### 3. Start the Local Server
Launch the Python HTTP server on port 8003:
```bash
python3 -m http.server 8003
```
Then open your web browser to:
[http://localhost:8003](http://localhost:8003)
