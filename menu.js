/**
 * js/menu.js - City menu card (Printed bar menu styling, drink scoring, expansion, local breweries)
 */

(function (window) {
  let expandedMenuSlugs = new Set();

  function renderMenuCard() {
    const state = window.AppState.get();
    const menuCard = document.getElementById("city-menu-card");
    const quietPrompt = document.getElementById("quiet-city-prompt");
    const mapGrid = document.getElementById("map-layout-grid");

    if (!menuCard || !quietPrompt || !mapGrid) return;

    if (!state.selectedCity) {
      menuCard.classList.remove("visible");
      menuCard.style.display = "none";
      quietPrompt.style.display = "block";
      mapGrid.classList.remove("with-menu");
      return;
    }

    // City is selected: show menu card
    quietPrompt.style.display = "none";
    mapGrid.classList.add("with-menu");
    menuCard.style.display = "block";
    // Trigger transition
    requestAnimationFrame(() => menuCard.classList.add("visible"));

    // 1. Header (City Name, Tonight's Weather, Close Button)
    renderMenuHeader(state);

    // 2. Score and pick Top 6 drinks
    const top6 = matchDrinksForCity(
      window.DrinksData.cocktails || [],
      state.selectedCity,
      state.selectedState,
      state.liveWeather
    );

    // Save to AppState so browse section can filter to them if requested
    window.AppState.set({ tonightMenuDrinks: top6 }, false);

    // 3. Render 6 matched drinks
    renderDrinksList(top6);

    // 4. Render Local Breweries breakdown
    renderLocalBreweries(state);
  }

  function renderMenuHeader(state) {
    const cityNameElem = document.getElementById("menu-city-name");
    const weatherLineElem = document.getElementById("menu-weather-line");
    if (cityNameElem) cityNameElem.textContent = state.selectedCityLabel;

    if (!weatherLineElem) return;

    const w = state.liveWeather;
    if (!w) {
      weatherLineElem.innerHTML = `<span style="font-style: italic;">Reading current atmospheric conditions...</span>`;
      return;
    }

    if (!w.isLive) {
      weatherLineElem.textContent = "Tonight: Live weather unavailable (matching on location only).";
      return;
    }

    const tempF = Math.round(w.temp_f);
    const tempC = Math.round(w.temp_c);
    const cond = w.condition || "fair";
    const hum = w.humidity !== null ? `${w.humidity}% humidity` : "";
    const wind = w.wind_mph !== null ? `wind ${w.wind_mph} mph` : "";
    const timeNote = w.updateTime ? `<span style="font-size: 11px; margin-left: 6px; color: #768896;">updated ${w.updateTime}</span>` : "";

    weatherLineElem.innerHTML = `Tonight: ${tempF}°F (${tempC}°C), ${cond}, ${hum}, ${wind}. ${timeNote}`;
  }

  function renderDrinksList(top6) {
    const container = document.getElementById("menu-drinks-list");
    if (!container) return;

    if (!top6 || top6.length === 0) {
      container.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); padding: 12px 0;">No matching drinks found for this place.</div>`;
      return;
    }

    let html = "";
    top6.forEach(item => {
      const d = item.drink;
      const isExpanded = expandedMenuSlugs.has(d.slug);

      html += `
        <div class="menu-drink-item" data-slug="${d.slug}">
          <img class="menu-drink-thumb" src="${d.photo}" alt="${escapeHtml(d.name)}" loading="lazy" onerror="this.src='https://24cocktails.com/photo_web/negroni.jpg';">
          <div class="menu-drink-main">
            <div class="menu-drink-row">
              <span class="menu-drink-name">${escapeHtml(d.name)}</span>
              <span class="menu-leader-dots"></span>
              <span class="menu-drink-str">${d.strength}</span>
            </div>
            <div class="menu-drink-reason">${escapeHtml(item.reason)}</div>

            <div class="menu-drink-expanded ${isExpanded ? 'open' : ''}" id="expanded-${d.slug}">
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Ingredients:</div>
              <ul>
                ${d.ingredients.map(i => `<li><strong>${escapeHtml(i.amount)}</strong> ${escapeHtml(i.name)}</li>`).join("")}
              </ul>
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Preparation:</div>
              <ol>
                ${d.steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
              </ol>
              <div style="margin-top: 6px;">
                <a href="${escapeHtml(d.url)}" target="_blank" rel="noopener noreferrer" style="font-size: 11px;">
                  View on 24cocktails →
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach click to expand
    container.querySelectorAll(".menu-drink-item").forEach(itemElem => {
      itemElem.addEventListener("click", e => {
        // If clicking external link, don't collapse
        if (e.target.tagName.toLowerCase() === "a") return;

        const slug = itemElem.getAttribute("data-slug");
        if (expandedMenuSlugs.has(slug)) {
          expandedMenuSlugs.delete(slug);
        } else {
          expandedMenuSlugs.add(slug);
        }
        const exp = document.getElementById(`expanded-${slug}`);
        if (exp) exp.classList.toggle("open");
      });
    });
  }

  function renderLocalBreweries(state) {
    const summaryElem = document.getElementById("menu-breweries-summary");
    const namesElem = document.getElementById("menu-breweries-names");
    if (!summaryElem || !namesElem || !window.DrinksData.breweries) return;

    const city = state.selectedCity || "";
    const stateName = state.selectedState || "";

    const localBreweries = window.DrinksData.breweries.filter(b => {
      return b.city.toLowerCase() === city.toLowerCase() &&
             (!stateName || b.state.toLowerCase() === stateName.toLowerCase());
    });

    if (localBreweries.length === 0) {
      summaryElem.textContent = "No breweries recorded in this city.";
      namesElem.textContent = "";
      return;
    }

    // Counts by type in one line e.g. "12 micro, 6 brewpubs, 2 regional"
    const typeCounts = {};
    localBreweries.forEach(b => {
      const t = b.brewery_type || "other";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    const summaryParts = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([t, count]) => `${count} ${t}`);

    summaryElem.textContent = summaryParts.join(", ");

    // Short list of brewery names (first 10)
    const displayNames = localBreweries.slice(0, 10).map(b => b.name);
    let namesText = displayNames.join(", ");
    if (localBreweries.length > 10) {
      namesText += `, and ${localBreweries.length - 10} more`;
    }
    namesElem.textContent = namesText;
  }

  // Scoring and matching engine matching pairings.py
  function matchDrinksForCity(cocktails, city, stateName, weather) {
    const meta = window.PairingsMeta || {};
    const stCode = (window.DrinksData.US_STATES && window.DrinksData.US_STATES[stateName]) || stateName;
    const cityLabel = `${city}, ${stCode}`;

    const WEIGHTS = {
      born_here: 55,
      named_after: 40,
      state_signature: 30,
      regional_profile: 12,
      weather_cold_hot: 32,
      weather_cold_stirred: 22,
      weather_mild_sour: 25,
      weather_hot_frozen: 32,
      weather_hot_long_sparkling: 25,
      weather_rain_snow: 26,
      weather_humidity_long: 20
    };

    const scored = [];
    const seenNames = new Set();

    cocktails.forEach(d => {
      const dName = d.name;
      const dNameLower = dName.toLowerCase();
      const dSlug = d.slug;
      const dBase = (d.base || "").toLowerCase();
      const dMethod = (d.method || "").toLowerCase();
      const dStyle = (d.style || "").toLowerCase();
      const dTemp = d.serving_temp_c !== undefined ? d.serving_temp_c : 10.0;
      const dAbv = d.abv || 0;
      const dFlavors = new Set(d.flavor_families || []);
      const dIsLong = !!d.is_long;
      const dCats = new Set((d.categories || []).map(c => c.toLowerCase()));

      const rules = [];

      // 1. Born here (claimed birthplaces only)
      const bornHere = (meta.BORN_HERE && meta.BORN_HERE[cityLabel]) || [];
      const stateBorn = (meta.BORN_HERE_STATE && (meta.BORN_HERE_STATE[stateName] || meta.BORN_HERE_STATE[stCode])) || [];
      if (bornHere.some(b => b.toLowerCase() === dNameLower || b.toLowerCase().replace(/\s+/g, "_") === dSlug)) {
        rules.push({ score: WEIGHTS.born_here, reason: `Claimed to be born in ${city}.`, isLoc: true, isWth: false });
      } else if (stateBorn.some(b => b.toLowerCase() === dNameLower || b.toLowerCase().replace(/\s+/g, "_") === dSlug)) {
        rules.push({ score: WEIGHTS.born_here, reason: `Claimed to be born in ${stateName}.`, isLoc: true, isWth: false });
      }

      // 2. Named after here
      const falsePositives = meta.FALSE_POSITIVES || {};
      const isFp = Object.keys(falsePositives).some(fp => new RegExp(`\\b${fp}\\b`, 'i').test(dNameLower));
      if (!isFp) {
        if (city.length > 3 && new RegExp(`\\b${city}\\b`, 'i').test(dNameLower)) {
          rules.push({ score: WEIGHTS.named_after, reason: `Named for ${city}.`, isLoc: true, isWth: false });
        } else if (stateName.length > 3 && new RegExp(`\\b${stateName}\\b`, 'i').test(dNameLower)) {
          rules.push({ score: WEIGHTS.named_after, reason: `Named for ${stateName}.`, isLoc: true, isWth: false });
        } else {
          for (const pw of ["Manhattan", "Brooklyn", "Bronx", "Hollywood", "Harlem"]) {
            if (new RegExp(`\\b${pw}\\b`, 'i').test(dNameLower)) {
              if ((["Manhattan", "Brooklyn", "Bronx", "Harlem"].includes(pw) && ["New York", "Brooklyn"].includes(city)) ||
                  (pw === "Hollywood" && ["Los Angeles", "Hollywood"].includes(city))) {
                rules.push({ score: WEIGHTS.named_after, reason: `Named for ${pw}.`, isLoc: true, isWth: false });
                break;
              }
            }
          }
        }
      }

      // 3. State signature ingredient
      const stateSigs = (meta.STATE_SIGNATURES && (meta.STATE_SIGNATURES[stCode] || meta.STATE_SIGNATURES[stateName])) || [];
      if (stateSigs.length > 0) {
        const ingText = d.ingredients.map(i => `${i.name} ${i.key}`).join(" ").toLowerCase();
        let matchedSig = null;
        for (const sig of stateSigs) {
          if (new RegExp(`\\b${sig}\\b`, 'i').test(ingText)) {
            matchedSig = sig;
            break;
          }
        }
        if (matchedSig) {
          rules.push({ score: WEIGHTS.state_signature, reason: `Made with ${stateName}'s ${matchedSig}.`, isLoc: true, isWth: false });
        }
      }

      // 4. Regional profile (smallest location weight)
      const regionName = meta.REGION_BY_STATE && (meta.REGION_BY_STATE[stCode] || meta.REGION_BY_STATE[stateName]);
      if (regionName && meta.REGIONAL_PROFILES && meta.REGIONAL_PROFILES[regionName]) {
        const prof = meta.REGIONAL_PROFILES[regionName];
        const baseMatch = prof.base === "any" || dBase.includes(prof.base) || (prof.base === "bourbon" && dBase.includes("whiskey")) || (prof.base === "rye" && dBase.includes("whiskey"));
        const flavorMatch = prof.flavors.some(f => dFlavors.has(f));
        if (baseMatch && flavorMatch) {
          rules.push({ score: WEIGHTS.regional_profile, reason: `A ${regionName} favorite.`, isLoc: true, isWth: false });
        }
      }

      // 5. Weather rules
      if (weather && weather.temp_f !== null && weather.temp_f !== undefined && !isNaN(weather.temp_f)) {
        const tempF = weather.temp_f;
        const cond = (weather.condition || "").toLowerCase();
        const hum = weather.humidity || 50;
        const tempRound = Math.round(tempF);

        const isRain = cond.includes("rain") || cond.includes("drizzle") || cond.includes("shower") || cond.includes("thunderstorm");
        const isSnow = cond.includes("snow") || cond.includes("blizzard") || cond.includes("sleet") || cond.includes("ice");

        if (isRain && (dMethod === "stirred" || dTemp > 30.0 || dCats.has("hot"))) {
          rules.push({ score: WEIGHTS.weather_rain_snow, reason: `Rainy and ${tempRound}°F.`, isLoc: false, isWth: true });
        } else if (isSnow && (dMethod === "stirred" || dTemp > 30.0 || dCats.has("hot"))) {
          rules.push({ score: WEIGHTS.weather_rain_snow, reason: `Snowy and ${tempRound}°F.`, isLoc: false, isWth: true });
        }

        if (tempF < 50.0) {
          if (dTemp > 30.0 || dCats.has("hot")) {
            rules.push({ score: WEIGHTS.weather_cold_hot, reason: `It's ${tempRound}°F in ${city}. Something warm.`, isLoc: false, isWth: true });
          } else if (dMethod === "stirred" && dAbv >= 18) {
            rules.push({ score: WEIGHTS.weather_cold_stirred, reason: `It's ${tempRound}°F in ${city}. Something warm.`, isLoc: false, isWth: true });
          }
        } else if (tempF <= 80.0) {
          if (dStyle.includes("sour") || (dMethod === "shaken" && dFlavors.has("citrus"))) {
            rules.push({ score: WEIGHTS.weather_mild_sour, reason: `A mild ${tempRound}°F night.`, isLoc: false, isWth: true });
          }
        } else { // tempF > 80
          if (dMethod === "blended" || dTemp <= -3.0) {
            rules.push({ score: WEIGHTS.weather_hot_frozen, reason: `It's ${tempRound}°F. Something cold and long.`, isLoc: false, isWth: true });
          } else if (dIsLong || dFlavors.has("sparkling") || dFlavors.has("citrus")) {
            rules.push({ score: WEIGHTS.weather_hot_long_sparkling, reason: `It's ${tempRound}°F. Something cold and long.`, isLoc: false, isWth: true });
          }
        }

        if (hum > 70.0 && (dIsLong || dFlavors.has("sparkling"))) {
          rules.push({ score: WEIGHTS.weather_humidity_long, reason: `Humid and ${tempRound}°F.`, isLoc: false, isWth: true });
        }
      }

      const totalScore = rules.reduce((acc, r) => acc + r.score, 0);

      if (rules.length > 0) {
        // Whichever rule added the most to its score determines its reason
        const bestRule = rules.reduce((prev, curr) => curr.score > prev.score ? curr : prev, rules[0]);
        scored.append_entry = {
          drink: d,
          score: totalScore,
          reason: bestRule.reason,
          isLocReason: bestRule.isLoc,
          isWthReason: bestRule.isWth
        };
        scored.push(scored.append_entry);
      }
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const hasLoc = scored.some(s => s.isLocReason);
    const hasWth = scored.some(s => s.isWthReason);
    const chosen = [];

    // 1. Guaranteed location match
    if (hasLoc) {
      for (const s of scored) {
        if (s.isLocReason && !seenNames.has(s.drink.name)) {
          chosen.push(s);
          seenNames.add(s.drink.name);
          break;
        }
      }
    }

    // 2. Guaranteed weather match
    if (hasWth) {
      for (const s of scored) {
        if (s.isWthReason && !seenNames.has(s.drink.name)) {
          chosen.push(s);
          seenNames.add(s.drink.name);
          break;
        }
      }
    }

    // 3. Fill remaining slots up to 6
    for (const s of scored) {
      if (chosen.length >= 6) break;
      if (!seenNames.has(s.drink.name)) {
        chosen.push(s);
        seenNames.add(s.drink.name);
      }
    }

    return chosen;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.MenuModule = {
    renderMenuCard,
    matchDrinksForCity
  };
})(window);
