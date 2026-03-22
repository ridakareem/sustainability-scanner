import { buildScoreRing, buildBreakdownBars, buildConfidenceBadge } from "./ui.js";
import { fetchAlternatives } from "./api.js";

export function renderProductCard(product, container) {
  const s = product.sustainability || {};
  const score = s.score ?? 0;
  const grade = s.grade ?? "?";
  container.innerHTML = `
    <div class="product-card" data-barcode="${product.barcode || ""}">
      <div class="product-hero">
        ${product.image_url
          ? `<img class="product-img" src="${product.image_url}" alt="${product.name}" loading="lazy"/>`
          : `<div class="product-img-placeholder"><span>📦</span></div>`}
        <div class="product-meta">
          <h2 class="product-name">${product.name || "Unknown product"}</h2>
          ${product.brands ? `<p class="product-brand">${product.brands}</p>` : ""}
          ${product.quantity ? `<p class="product-qty">${product.quantity}</p>` : ""}
          ${buildConfidenceBadge(product)}
          <p class="product-source">Source: ${product.source || "unknown"}</p>
        </div>
      </div>
      <div class="score-section">
        <div class="score-ring-wrap">${buildScoreRing(score, grade)}</div>
        <div class="breakdown-wrap">
          <h3 class="breakdown-title">Score Breakdown</h3>
          ${buildBreakdownBars(s.factors || {})}
        </div>
      </div>
      <div id="alternatives-section" class="alternatives-section">
        <p class="alts-loading">Loading greener alternatives…</p>
      </div>
    </div>`;

  requestAnimationFrame(() => {
    container.querySelectorAll(".factor-bar-fill").forEach((bar) => {
      bar.style.transition = "width 0.6s cubic-bezier(.4,0,.2,1)";
    });
  });

  if (product.barcode) {
    loadAlternatives(product.barcode, container.querySelector("#alternatives-section"));
  }
}

async function loadAlternatives(barcode, section) {
  try {
    const alts = await fetchAlternatives(barcode);
    if (!Array.isArray(alts) || alts.length === 0) { section.innerHTML = ""; return; }
    section.innerHTML = `
      <h3 class="alts-title">🌿 Greener Alternatives</h3>
      <div class="alts-list">${alts.map(renderAltCard).join("")}</div>`;
  } catch { section.innerHTML = ""; }
}

function renderAltCard(product) {
  const s = product.sustainability || {};
  const gradeColors = { A: "#22c55e", B: "#84cc16", C: "#eab308", D: "#f97316", E: "#ef4444" };
  const color = gradeColors[s.grade] || "#6b7280";
  return `
    <div class="alt-card" data-barcode="${product.barcode || ""}" role="button" tabindex="0">
      ${product.image_url
        ? `<img class="alt-img" src="${product.image_url}" alt="${product.name}" loading="lazy"/>`
        : `<div class="alt-img-placeholder">📦</div>`}
      <div class="alt-info">
        <p class="alt-name">${product.name || "—"}</p>
        <p class="alt-brand">${product.brands || ""}</p>
      </div>
      <span class="alt-grade" style="background:${color}">${s.grade || "?"}</span>
    </div>`;
}

export function renderSearchResults(products, container, onSelect) {
  if (!products || products.length === 0) {
    container.innerHTML = `<p class="no-results">No products found.</p>`;
    return;
  }
  container.innerHTML = `
    <ul class="search-results-list">
      ${products.map((p, i) => {
        const s = p.sustainability || {};
        const gradeColors = { A: "#22c55e", B: "#84cc16", C: "#eab308", D: "#f97316", E: "#ef4444" };
        const color = gradeColors[s.grade] || "#6b7280";
        return `
          <li class="search-result-item" data-index="${i}" role="button" tabindex="0">
            ${p.image_url
              ? `<img class="sr-img" src="${p.image_url}" alt="${p.name}" loading="lazy"/>`
              : `<span class="sr-img-placeholder">📦</span>`}
            <div class="sr-info">
              <p class="sr-name">${p.name || "—"}</p>
              <p class="sr-brand">${p.brands || ""}</p>
            </div>
            <span class="sr-grade" style="background:${color}">${s.grade || "?"}</span>
          </li>`;
      }).join("")}
    </ul>`;

  container.querySelectorAll(".search-result-item").forEach((item) => {
    const handler = () => onSelect(products[parseInt(item.dataset.index, 10)]);
    item.addEventListener("click", handler);
    item.addEventListener("keydown", (e) => e.key === "Enter" && handler());
  });
}
