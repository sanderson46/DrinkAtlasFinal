/**
 * js/cocktails.js - Browse cocktails section (strength scattergl, recipe list, inline text filters, expand details)
 */

(function (window) {
  let currentPage = 1;
  const PAGE_SIZE = 50;
  let expandedBrowseSlugs = new Set();

  function renderBrowseSection() {
    if (!window.DrinksData || !window.DrinksData.cocktails) return;
    const allCocktails = window.DrinksData.cocktails;
    const state = window.AppState.get();

    // 1. Determine candidate pool (all vs tonight's menu picks)
    let candidatePool = allCocktails;
    const tonightLinkWrap = document.getElementById("browse-tonight-filter-link");

    if (state.selectedCity) {
      if (tonightLinkWrap) {
        tonightLinkWrap.style.display = "inline";
        tonightLinkWrap.textContent = state.onlyTonightMenu
          ? `Show all cocktails`
          : `Show only tonight's menu for ${state.selectedCityLabel}`;
      }
      if (state.onlyTonightMenu && state.tonightMenuDrinks.length > 0) {
        const menuSlugs = new Set(state.tonightMenuDrinks.map(m => m.drink.slug));
        candidatePool = allCocktails.filter(c => menuSlugs.has(c.slug));
      }
    } else {
      if (tonightLinkWrap) tonightLinkWrap.style.display = "none";
    }

    // 2. Filter cocktails by inline controls
    const filtered = candidatePool.filter(c => {
      // Search
      if (state.cocktailSearch) {
        const q = state.cocktailSearch.toLowerCase();
        const mName = c.name.toLowerCase().includes(q);
        const mBase = c.base.toLowerCase().includes(q);
        const mIng = c.ingredients.some(i => i.name.toLowerCase().includes(q));
        if (!mName && !mBase && !mIng) return false;
      }

      // Base
      if (state.cocktailBase !== "all" && c.base !== state.cocktailBase) {
        return false;
      }

      // Flavor family
      if (state.cocktailFlavor !== "all" && !(c.flavor_families || []).includes(state.cocktailFlavor)) {
        return false;
      }

      // Strength range
      const isNa = c.strength === "n/a";
      if (isNa) {
        if (!state.includeNoStrength) return false;
      } else {
        const abvVal = c.abv !== null ? c.abv : 0;
        if (abvVal < state.minStrength || abvVal > state.maxStrength) return false;
      }

      // Ingredient count
      if (c.ingredient_count < state.minIngCount || c.ingredient_count > state.maxIngCount) {
        return false;
      }

      // Ingredients I have
      if (state.haveIngredients && state.haveIngredients.length > 0) {
        const ingKeys = new Set(c.ingredients.map(i => i.key));
        const ingNames = c.ingredients.map(i => i.name.toLowerCase()).join(" ");
        const match = state.haveIngredients.some(term => {
          const clean = term.toLowerCase().trim();
          return ingKeys.has(clean) || ingNames.includes(clean);
        });
        if (!match) return false;
      }

      return true;
    });

    // 3. Render Strength vs Ingredient Scatter (Plotly scattergl)
    renderStrengthScatter(candidatePool, filtered);

    // 4. Render Recipe List Table
    renderRecipeTable(filtered);
  }

  function renderStrengthScatter(candidatePool, filtered) {
    const plotDiv = document.getElementById("fig4-browse-strength-plot");
    if (!plotDiv) return;

    const filteredSet = new Set(filtered.map(c => c.slug));

    const activePts = { x: [], y: [], text: [], customdata: [] };
    const dimPts = { x: [], y: [], text: [], customdata: [] };

    candidatePool.forEach(c => {
      const isNa = c.strength === "n/a";
      const xVal = isNa ? -4.0 : (c.abv !== null ? c.abv : 0);
      const yVal = c.ingredient_count;
      const hover = `<b>${escapeHtml(c.name)}</b><br>Strength: ${c.strength}<br>Ingredients: ${c.ingredient_count}<br>Style: ${escapeHtml(c.style)}`;

      if (filteredSet.has(c.slug)) {
        activePts.x.push(xVal);
        activePts.y.push(yVal);
        activePts.text.push(hover);
        activePts.customdata.push(c.slug);
      } else {
        dimPts.x.push(xVal);
        dimPts.y.push(yVal);
        dimPts.text.push(hover);
        dimPts.customdata.push(c.slug);
      }
    });

    const traces = [
      {
        name: "Filtered out",
        x: dimPts.x,
        y: dimPts.y,
        text: dimPts.text,
        type: "scattergl",
        mode: "markers",
        marker: { size: 4, color: "rgba(100, 116, 139, 0.25)", symbol: "circle" },
        hoverinfo: "text",
        showlegend: false
      },
      {
        name: "Matching",
        x: activePts.x,
        y: activePts.y,
        text: activePts.text,
        customdata: activePts.customdata,
        type: "scattergl",
        mode: "markers",
        marker: { size: 5, color: "#3fd0c9", symbol: "circle", line: { color: "#0b1620", width: 0.5 } },
        hoverinfo: "text",
        showlegend: false
      }
    ];

    const layout = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      margin: { l: 45, r: 20, t: 15, b: 35 },
      hoverlabel: {
        bgcolor: "#0b1620",
        bordercolor: "rgba(235, 230, 218, 0.4)",
        font: { family: "Work Sans, sans-serif", size: 11, color: "#ebe6da" }
      },
      xaxis: {
        title: "Strength (ABV %)",
        titlefont: { size: 11, color: "#9aa8b3" },
        showgrid: true,
        gridcolor: "rgba(235, 230, 218, 0.04)",
        zeroline: false,
        showline: false,
        tickvals: [-4, 0, 10, 20, 30, 40, 50, 60],
        ticktext: ["n/a", "0%", "10%", "20%", "30%", "40%", "50%", "60%"],
        tickfont: { family: "Work Sans, sans-serif", size: 10, color: "#9aa8b3" }
      },
      yaxis: {
        title: "Ingredient count",
        titlefont: { size: 11, color: "#9aa8b3" },
        showgrid: true,
        gridcolor: "rgba(235, 230, 218, 0.04)",
        zeroline: false,
        showline: false,
        dtick: 2,
        tickfont: { family: "Work Sans, sans-serif", size: 10, color: "#9aa8b3" }
      }
    };

    const config = { displayModeBar: false, responsive: true };
    Plotly.react(plotDiv, traces, layout, config).then(() => {
      if (!plotDiv._hasClickListener) {
        plotDiv.on("plotly_click", function (data) {
          if (data && data.points && data.points[0] && data.points[0].customdata) {
            const slug = data.points[0].customdata;
            expandedBrowseSlugs.add(slug);
            renderBrowseSection();
            const row = document.getElementById(`browse-row-${slug}`);
            if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });
        plotDiv._hasClickListener = true;
      }
    });
  }

  function renderRecipeTable(cocktails) {
    const tbody = document.getElementById("browse-recipe-tbody");
    const countNote = document.getElementById("browse-count-note");
    if (!tbody) return;

    if (countNote) {
      countNote.textContent = `${cocktails.length.toLocaleString()} matching recipes`;
    }

    const totalPages = Math.ceil(cocktails.length / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = 1;

    const paged = cocktails.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    if (paged.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--text-muted);">No cocktails match the current filters.</td></tr>`;
      renderPagination(cocktails.length, totalPages);
      return;
    }

    let rowsHtml = "";
    paged.forEach(drink => {
      const isExpanded = expandedBrowseSlugs.has(drink.slug);

      rowsHtml += `
        <tr class="recipe-row" id="browse-row-${drink.slug}" data-slug="${drink.slug}">
          <td style="width: 44px;">
            <img src="${drink.photo}" alt="${escapeHtml(drink.name)}" loading="lazy" style="width: 36px; height: 36px; object-fit: cover; border: 1px solid var(--rule-hairline);" onerror="this.src='https://24cocktails.com/photo_web/negroni.jpg';">
          </td>
          <td style="font-family: var(--font-serif); font-size: 15px; color: var(--text-main); font-weight: 500;">
            ${escapeHtml(drink.name)}
          </td>
          <td style="color: var(--text-muted); text-transform: capitalize;">${escapeHtml(drink.style || drink.base)}</td>
          <td>${drink.strength}</td>
          <td>${drink.serving_temp_c}°C</td>
          <td>${drink.prep_minutes}m</td>
        </tr>
      `;

      if (isExpanded) {
        rowsHtml += `
          <tr class="recipe-expanded-row">
            <td colspan="6">
              <div class="expanded-recipe-grid">
                <div>
                  <div style="font-family: var(--font-serif); font-size: 14px; margin-bottom: 6px;">Ingredients (${drink.ingredient_count})</div>
                  <ul style="padding-left: 18px; font-size: 13px;">
                    ${drink.ingredients.map(i => `<li><strong>${escapeHtml(i.amount)}</strong> ${escapeHtml(i.name)}</li>`).join("")}
                  </ul>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">
                    Glass: ${escapeHtml(drink.glass)} | Ice: ${escapeHtml(drink.ice)} | Method: ${escapeHtml(drink.method)}
                  </div>
                </div>
                <div>
                  <div style="font-family: var(--font-serif); font-size: 14px; margin-bottom: 6px;">Preparation</div>
                  <ol style="padding-left: 18px; font-size: 13px;">
                    ${drink.steps.map(s => `<li>${escapeHtml(s)}</li>`).join("")}
                  </ol>
                  <div style="margin-top: 12px;">
                    <a href="${escapeHtml(drink.url)}" target="_blank" rel="noopener noreferrer">
                      View on 24cocktails →
                    </a>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        `;
      }
    });

    tbody.innerHTML = rowsHtml;

    // Attach row toggle listeners
    tbody.querySelectorAll("tr.recipe-row").forEach(row => {
      row.addEventListener("click", () => {
        const slug = row.getAttribute("data-slug");
        if (expandedBrowseSlugs.has(slug)) {
          expandedBrowseSlugs.delete(slug);
        } else {
          expandedBrowseSlugs.add(slug);
        }
        renderBrowseSection();
      });
    });

    renderPagination(cocktails.length, totalPages);
  }

  function renderPagination(totalCount, totalPages) {
    const pagDiv = document.getElementById("browse-pagination-controls");
    if (!pagDiv) return;

    pagDiv.innerHTML = `
      <span>Page ${currentPage} of ${totalPages}</span>
      <div style="display: flex; gap: 12px;">
        <button class="text-btn" id="browse-prev-page" ${currentPage <= 1 ? 'disabled' : ''}>← Previous</button>
        <button class="text-btn" id="browse-next-page" ${currentPage >= totalPages ? 'disabled' : ''}>Next →</button>
      </div>
    `;

    const prev = document.getElementById("browse-prev-page");
    const next = document.getElementById("browse-next-page");

    if (prev && currentPage > 1) {
      prev.onclick = () => {
        currentPage--;
        renderBrowseSection();
      };
    }
    if (next && currentPage < totalPages) {
      next.onclick = () => {
        currentPage++;
        renderBrowseSection();
      };
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

  window.CocktailsModule = {
    renderBrowseSection
  };
})(window);
