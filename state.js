/**
 * js/state.js - Shared reactive state store for DrinksAtlas2
 */

(function (window) {
  const listeners = [];

  const state = {
    selectedCity: null,        // e.g. "Portland"
    selectedState: null,       // e.g. "Oregon"
    selectedCityLabel: null,   // e.g. "Portland, OR"
    cityCoordinates: null,     // { lat, lon }
    liveWeather: null,         // { temp_f, temp_c, condition, humidity, wind_mph, updateTime, isLive }
    weatherStatus: "idle",     // "idle", "loading", "ready", "error"

    // Brewery filters
    breweryFilterType: "all",
    breweryFilterState: "all",
    topCitiesLimit: 15,

    // Browse cocktails filters
    cocktailSearch: "",
    minStrength: 0,
    maxStrength: 80,
    includeNoStrength: true,
    minIngCount: 1,
    maxIngCount: 15,
    cocktailFlavor: "all",
    cocktailBase: "all",
    haveIngredients: [],
    onlyTonightMenu: false,

    // Tonight's 6 menu drinks
    tonightMenuDrinks: []
  };

  const AppState = {
    get(key) {
      return key ? state[key] : { ...state };
    },

    set(updates, notify = true) {
      Object.assign(state, updates);
      if (notify) {
        listeners.forEach(fn => fn(state, updates));
      }
    },

    subscribe(fn) {
      listeners.push(fn);
      return () => {
        const idx = listeners.indexOf(fn);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },

    setCity(city, stateName, lat, lon) {
      let stCode = stateName;
      if (window.DrinksData && window.DrinksData.US_STATES) {
        stCode = window.DrinksData.US_STATES[stateName] || stateName;
      }
      const label = `${city}, ${stCode}`;

      this.set({
        selectedCity: city,
        selectedState: stateName,
        selectedCityLabel: label,
        cityCoordinates: { lat, lon },
        weatherStatus: "loading"
      });

      // Call weather fetcher
      if (window.WeatherModule && window.WeatherModule.fetchCityWeather) {
        window.WeatherModule.fetchCityWeather(city, stateName, lat, lon);
      }
    },

    clearCity() {
      this.set({
        selectedCity: null,
        selectedState: null,
        selectedCityLabel: null,
        cityCoordinates: null,
        liveWeather: null,
        weatherStatus: "idle",
        onlyTonightMenu: false,
        tonightMenuDrinks: []
      });
    }
  };

  window.AppState = AppState;
})(window);
