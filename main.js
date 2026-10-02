/**
 * js/main.js - Startup, data loading, autocomplete, and event orchestration for the single-page atlas
 */

(function (window) {
  window.DrinksData = {
    breweries: [],
    cocktails: [],
    placeMatches: {},
    US_STATES: {
      "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
      "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
      "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
      "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
      "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
      "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
      "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
      "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
      "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
      "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
      "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
      "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
      "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC"
    }
  };

  window.PairingsMeta = {
    BORN_HERE: {
      "New Orleans, LA": ["Sazerac", "Ramos Gin Fizz", "Vieux Carré", "Hurricane"],
      "New York, NY": ["Manhattan"],
      "Philadelphia, PA": ["Clover Club"],
      "Boston, MA": ["Ward Eight"],
      "Washington, DC": ["Gin Rickey"],
      "Detroit, MI": ["Last Word"],
      "Louisville, KY": ["Old Fashioned"],
      "San Francisco, CA": ["Pisco Punch", "Irish Coffee"],
      "Oakland, CA": ["Mai Tai"]
    },
    BORN_HERE_STATE: {
      "Wisconsin": ["Brandy Old Fashioned"],
      "WI": ["Brandy Old Fashioned"]
    },
    STATE_SIGNATURES: {
      "GA": ["peach"], "Georgia": ["peach"],
      "FL": ["orange", "citrus"], "Florida": ["orange", "citrus"],
      "TX": ["grapefruit"], "Texas": ["grapefruit"],
      "VT": ["maple"], "Vermont": ["maple"],
      "WA": ["apple"], "Washington": ["apple"],
      "MI": ["cherry"], "Michigan": ["cherry"],
      "ME": ["blueberry"], "Maine": ["blueberry"],
      "WI": ["cranberry"], "Wisconsin": ["cranberry"],
      "MA": ["cranberry"], "Massachusetts": ["cranberry"],
      "HI": ["pineapple"], "Hawaii": ["pineapple"],
      "KY": ["bourbon", "mint"], "Kentucky": ["bourbon", "mint"],
      "NM": ["chile", "chili"], "New Mexico": ["chile", "chili"],
      "OR": ["hazelnut", "pear"], "Oregon": ["hazelnut", "pear"]
    },
    REGION_BY_STATE: {
      "WA": "Pacific Northwest", "OR": "Pacific Northwest", "ID": "Pacific Northwest", "AK": "Pacific Northwest",
      "CA": "California",
      "AZ": "Southwest", "NM": "Southwest", "NV": "Southwest", "UT": "Southwest",
      "CO": "Mountain West", "MT": "Mountain West", "WY": "Mountain West",
      "IL": "Midwest", "IN": "Midwest", "IA": "Midwest", "KS": "Midwest", "MI": "Midwest", "MN": "Midwest", "MO": "Midwest", "NE": "Midwest", "ND": "Midwest", "OH": "Midwest", "SD": "Midwest", "WI": "Midwest",
      "AL": "South", "AR": "South", "FL": "South", "GA": "South", "KY": "South", "LA": "South", "MS": "South", "NC": "South", "OK": "South", "SC": "South", "TN": "South", "TX": "South", "VA": "South", "WV": "South",
      "CT": "Northeast", "DE": "Northeast", "ME": "Northeast", "MD": "Northeast", "MA": "Northeast", "NH": "Northeast", "NJ": "Northeast", "NY": "Northeast", "PA": "Northeast", "RI": "Northeast", "VT": "Northeast", "DC": "Northeast"
    },
    REGIONAL_PROFILES: {
      "South": { base: "bourbon", flavors: ["stone fruit", "herbal"] },
      "Mountain West": { base: "rye", flavors: ["herbal", "spicy"] },
      "Northeast": { base: "gin", flavors: ["bitter", "citrus"] },
      "Southwest": { base: "tequila", flavors: ["smoky", "spicy", "citrus"] },
      "Midwest": { base: "brandy", flavors: ["sweet & syrupy", "berry"] },
      "California": { base: "rum", flavors: ["tropical", "citrus"] },
      "Pacific Northwest": { base: "any", flavors: ["coffee & chocolate", "herbal", "apple & pear"] }
    },
    FALSE_POSITIVES: {
      "george washington": "person", "martha washington": "person", "tom collins": "person",
      "john collins": "person", "alexander": "person", "bellini": "artist", "jack rose": "person",
      "rob roy": "hero", "harvey wallbanger": "person", "mary pickford": "person", "charlie chaplin": "person",
      "bloody mary": "monarch", "gibson": "person", "virgin": "non-alcoholic", "orange": "fruit",
      "reading": "verb", "mobile": "motion", "independence": "concept", "liberty": "concept",
      "green": "color", "concord": "grape", "aurora": "phenomenon", "sterling": "silver"
    }
  };

  async function init() {
    try {
      async function loadDataFile(primary, fallback) {
        try {
          const res = await fetch(primary);
          if (res.ok) return await res.json();
        } catch (e) {}
        const res2 = await fetch(fallback);
        if (res2.ok) return await res2.json();
        throw new Error(`Could not load ${primary} or ${fallback}`);
      }

      const [brewData, cockData, placeData] = await Promise.all([
        loadDataFile("data/brewery_cache.json", "brewery_cache.json"),
        loadDataFile("data/cocktail_cache.json", "cocktail_cache.json"),
        loadDataFile("data/place_matches.json", "place_matches.json")
      ]);

      window.DrinksData.breweries = brewData;
      window.DrinksData.cocktails = cockData;
      window.DrinksData.placeMatches = placeData;

      setupCitySearch();
      setupControls();

      // State listener: redraw components on change
      window.AppState.subscribe(() => {
        if (window.MapModule) window.MapModule.renderMapSection();
        if (window.MenuModule) window.MenuModule.renderMenuCard();
        if (window.CocktailsModule) window.CocktailsModule.renderBrowseSection();
      });

      // Initial render
      if (window.MapModule) window.MapModule.renderMapSection();
      if (window.MenuModule) window.MenuModule.renderMenuCard();
      if (window.CocktailsModule) window.CocktailsModule.renderBrowseSection();

    } catch (e) {
      console.error("Initialization error:", e);
    }
  }

  function setupCitySearch() {
    const input = document.getElementById("header-city-search");
    const dropdown = document.getElementById("city-search-autocomplete");
    if (!input || !dropdown) return;

    // Build unique city list
    const cityMap = new Map();
    (window.DrinksData.breweries || []).forEach(b => {
      const c = b.city.trim();
      const s = b.state.trim();
      if (!c || !s) return;
      const st = window.DrinksData.US_STATES[s] || s;
      const key = `${c}, ${st}`;
      if (!cityMap.has(key)) {
        cityMap.set(key, { city: c, state: s, stateCode: st, latSum: b.latitude, lonSum: b.longitude, count: 1 });
      } else {
        const item = cityMap.get(key);
        item.latSum += b.latitude;
        item.lonSum += b.longitude;
        item.count++;
      }
    });

    const uniqueCities = Array.from(cityMap.entries()).map(([key, data]) => ({
      label: key,
      city: data.city,
      state: data.state,
      lat: data.latSum / data.count,
      lon: data.lonSum / data.count,
      count: data.count
    })).sort((a, b) => b.count - a.count);

    input.addEventListener("input", () => {
      const val = input.value.trim().toLowerCase();
      if (val.length < 2) {
        dropdown.style.display = "none";
        dropdown.innerHTML = "";
        return;
      }

      const matches = uniqueCities.filter(c => c.label.toLowerCase().includes(val)).slice(0, 10);
      if (matches.length === 0) {
        dropdown.style.display = "none";
        return;
      }

      dropdown.innerHTML = matches.map(m => `
        <div class="autocomplete-item" data-city="${escapeHtml(m.city)}" data-state="${escapeHtml(m.state)}" data-lat="${m.lat}" data-lon="${m.lon}" data-label="${escapeHtml(m.label)}">
          ${escapeHtml(m.label)} <span style="font-size: 11px; color: var(--text-muted);">(${m.count} breweries)</span>
        </div>
      `).join("");

      dropdown.style.display = "block";
    });

    dropdown.addEventListener("click", e => {
      const item = e.target.closest(".autocomplete-item");
      if (!item) return;

      const city = item.getAttribute("data-city");
      const st = item.getAttribute("data-state");
      const lat = parseFloat(item.getAttribute("data-lat"));
      const lon = parseFloat(item.getAttribute("data-lon"));

      input.value = item.getAttribute("data-label");
      dropdown.style.display = "none";

      window.AppState.setCity(city, st, lat, lon);
    });

    document.addEventListener("click", e => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = "none";
      }
    });
  }

  function setupControls() {
    // 1. Map controls
    const typeSelect = document.getElementById("map-filter-type");
    const stateSelect = document.getElementById("map-filter-state");
    const topLimitSelect = document.getElementById("map-top-cities-limit");
    const closeMenuBtn = document.getElementById("btn-close-city-menu");

    if (typeSelect) {
      const types = new Set((window.DrinksData.breweries || []).map(b => b.brewery_type));
      Array.from(types).sort().forEach(t => {
        if (!t) return;
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        typeSelect.appendChild(opt);
      });
      typeSelect.addEventListener("change", () => {
        window.AppState.set({ breweryFilterType: typeSelect.value });
      });
    }

    if (stateSelect) {
      const states = new Set((window.DrinksData.breweries || []).map(b => b.state));
      Array.from(states).sort().forEach(s => {
        if (!s) return;
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        stateSelect.appendChild(opt);
      });
      stateSelect.addEventListener("change", () => {
        window.AppState.set({ breweryFilterState: stateSelect.value });
      });
    }

    if (topLimitSelect) {
      topLimitSelect.addEventListener("change", () => {
        window.AppState.set({ topCitiesLimit: parseInt(topLimitSelect.value, 10) });
      });
    }

    if (closeMenuBtn) {
      closeMenuBtn.addEventListener("click", () => {
        const input = document.getElementById("header-city-search");
        if (input) input.value = "";
        window.AppState.clearCity();
      });
    }

    // 2. Browse Cocktails Controls
    const browseSearch = document.getElementById("browse-search-input");
    const browseBase = document.getElementById("browse-filter-base");
    const browseFlavor = document.getElementById("browse-filter-flavor");
    const browseMinStr = document.getElementById("browse-min-str");
    const browseMaxStr = document.getElementById("browse-max-str");
    const browseIncNoStr = document.getElementById("browse-inc-no-str");
    const browseMinIng = document.getElementById("browse-min-ing");
    const browseMaxIng = document.getElementById("browse-max-ing");
    const browseHave = document.getElementById("browse-have-ings");
    const tonightFilterLink = document.getElementById("browse-tonight-filter-link");

    if (browseSearch) {
      browseSearch.addEventListener("input", () => {
        window.AppState.set({ cocktailSearch: browseSearch.value.trim() });
      });
    }

    if (browseBase) {
      const bases = new Set((window.DrinksData.cocktails || []).map(c => c.base));
      Array.from(bases).sort().forEach(b => {
        if (!b) return;
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b;
        browseBase.appendChild(opt);
      });
      browseBase.addEventListener("change", () => {
        window.AppState.set({ cocktailBase: browseBase.value });
      });
    }

    if (browseFlavor) {
      const families = [
        "citrus", "bitter", "herbal", "coffee & chocolate", "creamy",
        "tropical", "berry", "stone fruit", "apple & pear", "smoky",
        "spicy", "sparkling", "sweet & syrupy", "floral"
      ];
      families.sort().forEach(f => {
        const opt = document.createElement("option");
        opt.value = f;
        opt.textContent = f;
        browseFlavor.appendChild(opt);
      });
      browseFlavor.addEventListener("change", () => {
        window.AppState.set({ cocktailFlavor: browseFlavor.value });
      });
    }

    if (browseMinStr && browseMaxStr) {
      browseMinStr.addEventListener("change", () => {
        window.AppState.set({ minStrength: parseFloat(browseMinStr.value) || 0 });
      });
      browseMaxStr.addEventListener("change", () => {
        window.AppState.set({ maxStrength: parseFloat(browseMaxStr.value) || 80 });
      });
    }

    if (browseIncNoStr) {
      browseIncNoStr.addEventListener("change", () => {
        window.AppState.set({ includeNoStrength: browseIncNoStr.checked });
      });
    }

    if (browseMinIng && browseMaxIng) {
      browseMinIng.addEventListener("change", () => {
        window.AppState.set({ minIngCount: parseInt(browseMinIng.value, 10) || 1 });
      });
      browseMaxIng.addEventListener("change", () => {
        window.AppState.set({ maxIngCount: parseInt(browseMaxIng.value, 10) || 15 });
      });
    }

    if (browseHave) {
      browseHave.addEventListener("input", () => {
        const val = browseHave.value.trim();
        const terms = val ? val.split(",").map(t => t.trim()).filter(Boolean) : [];
        window.AppState.set({ haveIngredients: terms });
      });
    }

    if (tonightFilterLink) {
      tonightFilterLink.addEventListener("click", () => {
        const curr = window.AppState.get("onlyTonightMenu");
        window.AppState.set({ onlyTonightMenu: !curr });
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
