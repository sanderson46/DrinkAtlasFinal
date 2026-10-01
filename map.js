/**
 * js/map.js - Brewery scatter map, top cities bar chart, and summary sentence
 */

(function (window) {
  // Restrained muted blues, teals, and warm grays; dim for closed/planning
  const TYPE_PALETTE = {
    micro: { color: "#3fd0c9", label: "Micro" },
    nano: { color: "#3fd0c9", label: "Nano" },
    brewpub: { color: "#4a78c2", label: "Brewpub" },
    taproom: { color: "#5ea3db", label: "Taproom" },
    bar: { color: "#5ea3db", label: "Bar" },
    regional: { color: "#c99a5e", label: "Regional" },
    large: { color: "#c99a5e", label: "Large" },
    contract: { color: "#789ea8", label: "Contract" },
    proprietor: { color: "#789ea8", label: "Proprietor" },
    planning: { color: "rgba(100, 116, 139, 0.35)", label: "Planning" },
    closed: { color: "rgba(71, 85, 105, 0.3)", label: "Closed" },
    location: { color: "rgba(100, 116, 139, 0.35)", label: "Location" },
    other: { color: "rgba(100, 116, 139, 0.35)", label: "Other" }
  };

  function getTypeColor(t) {
    const clean = (t || "").toLowerCase();
    return (TYPE_PALETTE[clean] || TYPE_PALETTE.other).color;
  }

  function renderMapSection() {
    if (!window.DrinksData || !window.DrinksData.breweries) return;
    const breweries = window.DrinksData.breweries;
    const state = window.AppState.get();

    // 1. Filter breweries by type and state
    const filtered = breweries.filter(b => {
      if (state.breweryFilterType !== "all" && b.brewery_type !== state.breweryFilterType) {
        return false;
      }
      if (state.breweryFilterState !== "all" && b.state !== state.breweryFilterState) {
        return false;
      }
      return true;
    });

    // 2. Update summary sentence
    updateSummarySentence(filtered, state);

    // 3. Render Brewery Map
    renderBreweryScatter(filtered, state);

    // 4. Render Top Cities Chart
    renderTopCitiesChart(filtered, state);
  }

  function updateSummarySentence(filtered, state) {
    const wrap = document.getElementById("atlas-summary-sentence");
    if (!wrap) return;

    const totalBreweries = filtered.length;
    const distinctCities = new Set(filtered.map(b => `${b.city}, ${b.state}`)).size;

    // Leading state calculation
    const stateCounts = {};
    filtered.forEach(b => {
      stateCounts[b.state] = (stateCounts[b.state] || 0) + 1;
    });
    let topState = "";
    let maxCount = 0;
    for (const [st, c] of Object.entries(stateCounts)) {
      if (c > maxCount) {
        maxCount = c;
        topState = st;
      }
    }

    let sentence = `${totalBreweries.toLocaleString()} breweries in ${distinctCities.toLocaleString()} cities.`;
    if (topState && maxCount > 0) {
      sentence += ` ${topState} leads with ${maxCount.toLocaleString()}.`;
    }

    if (state.selectedCity) {
      const countInCity = filtered.filter(b => {
        return b.city === state.selectedCity && (!state.selectedState || b.state === state.selectedState);
      }).length;
      sentence += ` <span class="selected-city-stat">${escapeHtml(state.selectedCityLabel)} has ${countInCity}.</span>`;
    }

    wrap.innerHTML = sentence;
  }

  function renderBreweryScatter(filtered, state) {
    const plotDiv = document.getElementById("brewery-map-plot");
    if (!plotDiv) return;

    // Group into traces by color family
    const tracesByColor = {};
    filtered.forEach(b => {
      const color = getTypeColor(b.brewery_type);
      if (!tracesByColor[color]) {
        tracesByColor[color] = { x: [], y: [], text: [], customdata: [] };
      }
      tracesByColor[color].x.push(b.longitude);
      tracesByColor[color].y.push(b.latitude);
      tracesByColor[color].text.push(`<b>${escapeHtml(b.name)}</b><br>${escapeHtml(b.city)}, ${escapeHtml(b.state)}<br>${escapeHtml(b.brewery_type)}`);
      tracesByColor[color].customdata.push({ city: b.city, state: b.state, lat: b.latitude, lon: b.longitude });
    });

    const traces = Object.entries(tracesByColor).map(([color, data]) => ({
      x: data.x,
      y: data.y,
      text: data.text,
      customdata: data.customdata,
      mode: "markers",
      type: "scatter",
      marker: { size: 4, color: color, symbol: "circle" },
      hoverinfo: "text",
      showlegend: false
    }));

    const annotations = [];

    // Mark selected city with small turquoise ring and its name
    if (state.cityCoordinates && state.selectedCity) {
      const { lat, lon } = state.cityCoordinates;

      // Small turquoise ring marker
      traces.push({
        x: [lon],
        y: [lat],
        mode: "markers",
        type: "scatter",
        marker: {
          size: 13,
          color: "rgba(0,0,0,0)",
          line: { color: "#3fd0c9", width: 1.5 },
          symbol: "circle"
        },
        hoverinfo: "none",
        showlegend: false
      });

      // City name label directly on map
      annotations.push({
        x: lon,
        y: lat,
        text: state.selectedCityLabel,
        showarrow: true,
        arrowhead: 0,
        arrowcolor: "#3fd0c9",
        arrowwidth: 1,
        ax: 20,
        ay: -22,
        font: { family: "Newsreader, Georgia, serif", size: 13, color: "#3fd0c9" },
        bgcolor: "#0b1620",
        bordercolor: "rgba(63, 208, 201, 0.4)",
        borderwidth: 1
      });
    }

    // Default US bounds or zoomed to selected state
    let xRange = [-125.5, -66.5];
    let yRange = [24.0, 50.0];

    if (state.breweryFilterState !== "all" && filtered.length > 0) {
      const lons = filtered.map(b => b.longitude);
      const lats = filtered.map(b => b.latitude);
      const minX = Math.min(...lons), maxX = Math.max(...lons);
      const minY = Math.min(...lats), maxY = Math.max(...lats);
      const padX = Math.max((maxX - minX) * 0.15, 0.8);
      const padY = Math.max((maxY - minY) * 0.15, 0.8);
      xRange = [minX - padX, maxX + padX];
      yRange = [minY - padY, maxY + padY];
    }

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 20, r: 20, t: 10, b: 20 },
      dragmode: "pan",
      annotations: annotations,
      hoverlabel: {
        bgcolor: "#0b1620",
        bordercolor: "rgba(235, 230, 218, 0.4)",
        font: { family: "Work Sans, sans-serif", size: 12, color: "#ebe6da" }
      },
      xaxis: {
        range: xRange,
        showgrid: true,
        gridcolor: "rgba(235, 230, 218, 0.04)",
        gridwidth: 1,
        zeroline: false,
        showline: false,
        showticklabels: false,
        scaleanchor: "y",
        scaleratio: 1.25
      },
      yaxis: {
        range: yRange,
        showgrid: true,
        gridcolor: "rgba(235, 230, 218, 0.04)",
        gridwidth: 1,
        zeroline: false,
        showline: false,
        showticklabels: false
      }
    };

    const config = {
      displayModeBar: false,
      responsive: true,
      scrollZoom: true
    };

    Plotly.react(plotDiv, traces, layout, config).then(() => {
      if (!plotDiv._hasClickListener) {
        plotDiv.on("plotly_click", function (data) {
          if (data && data.points && data.points[0] && data.points[0].customdata) {
            const pt = data.points[0].customdata;
            window.AppState.setCity(pt.city, pt.state, pt.lat, pt.lon);
          }
        });
        plotDiv._hasClickListener = true;
      }
    });
  }

  function renderTopCitiesChart(filtered, state) {
    const barDiv = document.getElementById("top-cities-plot");
    if (!barDiv) return;

    const cityGroups = {};
    filtered.forEach(b => {
      const st = (window.DrinksData.US_STATES && window.DrinksData.US_STATES[b.state]) || b.state;
      const key = `${b.city}, ${st}`;
      if (!cityGroups[key]) {
        cityGroups[key] = { count: 0, city: b.city, state: b.state, latSum: 0, lonSum: 0, key };
      }
      cityGroups[key].count++;
      cityGroups[key].latSum += b.latitude;
      cityGroups[key].lonSum += b.longitude;
    });

    const sortedCities = Object.values(cityGroups).sort((a, b) => b.count - a.count);
    const limit = state.topCitiesLimit || 15;
    const topSlice = sortedCities.slice(0, limit).reverse();

    const yLabels = topSlice.map(c => c.key);
    const xCounts = topSlice.map(c => c.count);
    const colors = topSlice.map(c => {
      return (state.selectedCityLabel === c.key || state.selectedCity === c.city) ? "#3fd0c9" : "#264875";
    });

    const customdata = topSlice.map(c => ({
      city: c.city,
      state: c.state,
      lat: c.latSum / c.count,
      lon: c.lonSum / c.count,
      label: c.key
    }));

    const trace = {
      type: "bar",
      orientation: "h",
      x: xCounts,
      y: yLabels,
      customdata: customdata,
      marker: {
        color: colors,
        line: { color: "rgba(235, 230, 218, 0.15)", width: 1 }
      },
      text: xCounts.map(n => ` ${n}`),
      textposition: "outside",
      textfont: { family: "Work Sans, sans-serif", size: 11, color: "#9aa8b3" },
      hoverinfo: "text",
      hovertext: topSlice.map(c => `<b>${c.key}</b>: ${c.count} breweries`),
      hoverlabel: {
        bgcolor: "#0b1620",
        bordercolor: "rgba(235, 230, 218, 0.4)",
        font: { family: "Work Sans, sans-serif", size: 12, color: "#ebe6da" }
      }
    };

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 110, r: 35, t: 10, b: 25 },
      xaxis: {
        showgrid: true,
        gridcolor: "rgba(235, 230, 218, 0.04)",
        gridwidth: 1,
        zeroline: false,
        showline: false,
        tickfont: { family: "Work Sans, sans-serif", size: 10, color: "#9aa8b3" }
      },
      yaxis: {
        showgrid: false,
        zeroline: false,
        showline: false,
        tickfont: { family: "Work Sans, sans-serif", size: 11, color: "#ebe6da" }
      }
    };

    const config = {
      displayModeBar: false,
      responsive: true
    };

    Plotly.react(barDiv, [trace], layout, config).then(() => {
      if (!barDiv._hasClickListener) {
        barDiv.on("plotly_click", function (data) {
          if (data && data.points && data.points[0] && data.points[0].customdata) {
            const cd = data.points[0].customdata;
            window.AppState.setCity(cd.city, cd.state, cd.lat, cd.lon);
          }
        });
        barDiv._hasClickListener = true;
      }
    });
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.MapModule = {
    renderMapSection
  };
})(window);
