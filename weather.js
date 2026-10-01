/**
 * js/weather.js - Open-Meteo live weather calls, WMO interpretation, and city caching
 */

(function (window) {
  const weatherCache = {};

  const WMO_DESCRIPTIONS = {
    0: "clear",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "depositing rime fog",
    51: "light drizzle",
    53: "moderate drizzle",
    55: "dense drizzle",
    56: "light freezing drizzle",
    57: "dense freezing drizzle",
    61: "light rain",
    63: "moderate rain",
    65: "heavy rain",
    66: "light freezing rain",
    67: "heavy freezing rain",
    71: "slight snow",
    73: "moderate snow",
    75: "heavy snow",
    77: "snow grains",
    80: "slight rain showers",
    81: "moderate rain showers",
    82: "violent rain showers",
    85: "slight snow showers",
    86: "heavy snow showers",
    95: "thunderstorm",
    96: "thunderstorm with slight hail",
    99: "thunderstorm with heavy hail"
  };

  function cToF(c) {
    return (c * 9) / 5 + 32;
  }

  function formatTempDual(c) {
    if (c === null || c === undefined || isNaN(c)) return "--";
    const f = Math.round(cToF(c));
    const roundC = Math.round(c);
    return `${f}°F (${roundC}°C)`;
  }

  function formatCondition(code) {
    return WMO_DESCRIPTIONS[code] || "clear";
  }

  async function fetchCityWeather(city, stateName, lat, lon) {
    const cityLabel = window.AppState.get("selectedCityLabel") || `${city}, ${stateName}`;

    // Return cached if already fetched
    if (weatherCache[cityLabel]) {
      const cached = weatherCache[cityLabel];
      window.AppState.set({
        liveWeather: cached,
        weatherStatus: cached.isLive ? "ready" : "error"
      });
      return;
    }

    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&timezone=auto`;

    try {
      const resp = await fetch(forecastUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const current = data.current || {};
      const tempC = current.temperature_2m;
      const appTempC = current.apparent_temperature;
      const windSpeedMph = Math.round((current.wind_speed_10m || 0) * 0.621371);
      const condition = formatCondition(current.weather_code);

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();

      const weatherObj = {
        cityLabel,
        isLive: true,
        temp_c: tempC,
        temp_f: cToF(tempC),
        feelslike_c: appTempC,
        feelslike_f: cToF(appTempC),
        humidity: current.relative_humidity_2m,
        wind_mph: windSpeedMph,
        condition: condition,
        weatherCode: current.weather_code,
        isDay: current.is_day,
        updateTime: timeStr
      };

      weatherCache[cityLabel] = weatherObj;
      window.AppState.set({
        liveWeather: weatherObj,
        weatherStatus: "ready"
      });
    } catch (err) {
      console.warn("Live weather call failed; matching on location only:", err);
      const fallbackObj = {
        cityLabel,
        isLive: false,
        errorNote: "Live weather unavailable",
        temp_c: null,
        temp_f: null,
        feelslike_c: null,
        feelslike_f: null,
        humidity: null,
        wind_mph: null,
        condition: "unavailable",
        updateTime: ""
      };
      weatherCache[cityLabel] = fallbackObj;
      window.AppState.set({
        liveWeather: fallbackObj,
        weatherStatus: "error"
      });
    }
  }

  window.WeatherModule = {
    fetchCityWeather,
    cToF,
    formatTempDual
  };
})(window);
