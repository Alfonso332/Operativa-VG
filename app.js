(() => {
  "use strict";

  /**
   * Configuración principal y constantes de categorías.
   * Estructura lista para conectar con Firebase en el futuro mediante DataProvider.
   */
  const STORAGE_KEY = "operativaVG.crmData.v1";
  const CATEGORIES = [
    "Nuevos Servicios",
    "Novaciones",
    "Agregados",
    "Movimientos de Obra",
    "Bajas de Servicios",
    "Presupuestos",
    "Charlas Informativas",
    "Facturación de Agregados",
    "Facturación de Nuevos Servicios"
  ];

  const CATEGORY_FIELDS = {
    "Nuevos Servicios": ["tipoServicio", "plazoImplementacion", "origenLead"],
    "Novaciones": ["tipoNovacion", "vigenciaAnterior", "vigenciaNueva"],
    "Agregados": ["servicioBase", "tipoAgregado", "impactoMensual"],
    "Movimientos de Obra": ["faseObra", "responsableTecnico", "fechaEntrega"],
    "Bajas de Servicios": ["motivoBaja", "competencia", "fechaBajaEfectiva"],
    "Presupuestos": ["nroPresupuesto", "validezDias", "probabilidadCierre"],
    "Charlas Informativas": ["tipoCharla", "asistentes", "seguimientoComercial"],
    "Facturación de Agregados": ["nroFactura", "fechaFacturacion", "estadoCobranza"],
    "Facturación de Nuevos Servicios": ["nroFacturaAlta", "periodoFacturado", "estadoCobranzaAlta"]
  };

  const state = {
    data: { version: 1, records: [] },
    ui: {
      view: "dashboard",
      search: "",
      categoryFilter: "all",
      recordFilter: "all",
      deleteCandidateId: null
    },
    charts: {}
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const money = (v, currency = "ARS") =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(v || 0));

  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.records)) state.data = parsed;
    } catch {
      console.warn("No se pudo cargar almacenamiento local");
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function renderCategoryOptions() {
    const categorySelects = [$("#category"), $("#recordCategoryFilter"), $("#globalCategoryFilter")];
    categorySelects.forEach((select, idx) => {
      const includeAll = idx > 0;
      select.innerHTML = includeAll ? `<option value="all">Todas</option>` : "";
      CATEGORIES.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        select.append(opt);
      });
    });
    $("#category").value = CATEGORIES[0];
    renderDynamicFields(CATEGORIES[0]);
  }

  function renderDynamicFields(category, values = {}) {
    const container = $("#dynamicFields");
    const template = $("#dynamicFieldTemplate");
    const fields = CATEGORY_FIELDS[category] || [];
    container.innerHTML = "";

    fields.forEach((name) => {
      const node = template.content.firstElementChild.cloneNode(true);
      const label = node.querySelector("label");
      const input = node.querySelector("input");
      const id = `extra_${name}`;

      label.textContent = prettifyField(name);
      label.htmlFor = id;
      input.id = id;
      input.name = `extra.${name}`;
      input.value = values[name] || "";
      node.classList.add("field");
      container.append(node);
    });
  }

  function prettifyField(name) {
    return name
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (m) => m.toUpperCase())
      .trim();
  }

  function getFilteredRecords() {
    const { search, categoryFilter, recordFilter } = state.ui;
    return state.data.records.filter((r) => {
      const source = [r.serviceName, r.seller, r.client, r.address, r.observations, r.category].join(" ").toLowerCase();
      const bySearch = !search || source.includes(search.toLowerCase());
      const byTopFilter = categoryFilter === "all" || r.category === categoryFilter;
      const byRecordFilter = recordFilter === "all" || r.category === recordFilter;
      return bySearch && byTopFilter && byRecordFilter;
    });
  }

  function renderTable() {
    const tbody = $("#recordsTable tbody");
    const rows = getFilteredRecords()
      .sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))
      .map((r) => {
        return `
          <tr>
            <td>${r.eventDate || "-"}</td>
            <td>${r.category}</td>
            <td>${r.serviceName}</td>
            <td>${r.seller}</td>
            <td>${r.client}</td>
            <td>${r.status}</td>
            <td>${money(r.amount, r.currency)}</td>
            <td>
              <div class="table-actions">
                <button class="icon-btn" data-action="edit" data-id="${r.id}">✏️</button>
                <button class="icon-btn" data-action="delete" data-id="${r.id}">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
    tbody.innerHTML = rows || `<tr><td colspan="8">Sin resultados.</td></tr>`;
  }

  function renderKpis() {
    const rows = getFilteredRecords();
    const total = rows.length;
    const newServices = rows.filter((r) => r.category === "Nuevos Servicios").length;
    const lost = rows.filter((r) => r.status === "Perdido").length;
    const revenue = rows.filter((r) => r.status !== "Perdido").reduce((acc, r) => acc + Number(r.amount || 0), 0);

    $("#kpiTotalServices").textContent = total;
    $("#kpiNewServices").textContent = newServices;
    $("#kpiLostServices").textContent = lost;
    $("#kpiRevenue").textContent = money(revenue);
  }

  function renderRankings() {
    const rows = getFilteredRecords();
    const salesBySeller = new Map();
    const lostBySeller = new Map();
    const bestBySeller = new Map();

    rows.forEach((r) => {
      const amount = Number(r.amount || 0);
      if (r.status !== "Perdido") {
        salesBySeller.set(r.seller, (salesBySeller.get(r.seller) || 0) + amount);
        const currentBest = bestBySeller.get(r.seller);
        if (!currentBest || amount > currentBest.amount) bestBySeller.set(r.seller, r);
      } else {
        lostBySeller.set(r.seller, (lostBySeller.get(r.seller) || 0) + 1);
      }
    });

    const sortedSales = [...salesBySeller.entries()].sort((a, b) => b[1] - a[1]);
    const sortedLost = [...lostBySeller.entries()].sort((a, b) => b[1] - a[1]);
    const topGeneral = rows
      .filter((r) => r.status !== "Perdido")
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 5);

    $("#rankingSales").innerHTML = sortedSales.map(([seller, total]) => `<li>${seller}: ${money(total)}</li>`).join("") || "<li>Sin datos.</li>";
    $("#rankingLost").innerHTML = sortedLost.map(([seller, qty]) => `<li>${seller}: ${qty} perdidos</li>`).join("") || "<li>Sin datos.</li>";
    $("#bestSaleBySeller").innerHTML = [...bestBySeller.entries()]
      .map(([seller, rec]) => `<li>${seller}: ${rec.serviceName} (${money(rec.amount, rec.currency)})</li>`)
      .join("") || "<li>Sin datos.</li>";
    $("#topGeneral").innerHTML = topGeneral
      .map((r) => `<li>${r.serviceName} · ${r.seller} · ${money(r.amount, r.currency)}</li>`)
      .join("") || "<li>Sin datos.</li>";
  }

  function monthlySeries(rows) {
    const map = new Map();
    rows.forEach((r) => {
      const d = r.eventDate ? new Date(r.eventDate) : new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + Number(r.amount || 0));
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }

  function renderCharts() {
    const rows = getFilteredRecords();
    const salesByCategory = CATEGORIES.map((cat) =>
      rows.filter((r) => r.category === cat && r.status !== "Perdido").reduce((acc, r) => acc + Number(r.amount || 0), 0)
    );
    const statusNames = ["Pendiente", "En Curso", "Ganado", "Perdido", "Facturado"];
    const statusData = statusNames.map((status) => rows.filter((r) => r.status === status).length);
    const monthData = monthlySeries(rows);

    createOrUpdateChart("chartCategory", "bar", {
      labels: CATEGORIES,
      datasets: [{ label: "Monto", data: salesByCategory, backgroundColor: "#0c8384" }]
    });

    createOrUpdateChart("chartMonthly", "line", {
      labels: monthData.map(([k]) => k),
      datasets: [{ label: "Ingresos", data: monthData.map(([, v]) => v), borderColor: "#17a2a4", tension: 0.25 }]
    });

    createOrUpdateChart("chartStatus", "doughnut", {
      labels: statusNames,
      datasets: [{ data: statusData, backgroundColor: ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"] }]
    });
  }

  function createOrUpdateChart(canvasId, type, data) {
    if (state.charts[canvasId]) state.charts[canvasId].destroy();
    state.charts[canvasId] = new Chart($("#" + canvasId), {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#e6f1f1" } } },
        scales: type === "doughnut" ? {} : {
          x: { ticks: { color: "#9fb6b6" }, grid: { color: "#253638" } },
          y: { ticks: { color: "#9fb6b6" }, grid: { color: "#253638" } }
        }
      }
    });
  }

  function resetForm() {
    $("#recordForm").reset();
    $("#recordId").value = "";
    $("#category").value = CATEGORIES[0];
    renderDynamicFields(CATEGORIES[0]);
    $("#eventDate").valueAsDate = new Date();
  }

  function serializeForm(form) {
    const f = new FormData(form);
    const category = f.get("category");
    const extra = {};
    (CATEGORY_FIELDS[category] || []).forEach((key) => {
      extra[key] = f.get(`extra.${key}`) || "";
    });
    return {
      id: f.get("recordId") || uid(),
      category,
      serviceName: f.get("serviceName")?.trim(),
      seller: f.get("seller")?.trim(),
      client: f.get("client")?.trim(),
      contact: f.get("contact")?.trim(),
      address: f.get("address")?.trim(),
      administration: f.get("administration")?.trim(),
      amount: Number(f.get("amount")),
      currency: f.get("currency"),
      status: f.get("status"),
      eventDate: f.get("eventDate"),
      observations: f.get("observations")?.trim(),
      extra,
      createdAt: new Date().toISOString()
    };
  }

  function validateRecord(r) {
    if (!r.serviceName || !r.seller || !r.client || !r.contact || !r.address || !r.eventDate) {
      return "Completa todos los campos obligatorios.";
    }
    if (Number.isNaN(r.amount) || r.amount < 0) return "Monto inválido.";
    return "";
  }

  function upsertRecord(record) {
    const idx = state.data.records.findIndex((r) => r.id === record.id);
    if (idx > -1) state.data.records[idx] = { ...state.data.records[idx], ...record };
    else state.data.records.push(record);
    saveData();
    rerenderAll();
  }

  function requestDeleteRecord(id) {
    state.ui.deleteCandidateId = id;
    const dialog = $("#confirmDialog");
    dialog.showModal();
  }

  function confirmDeleteRecord() {
    const id = state.ui.deleteCandidateId;
    if (!id) return;
    state.data.records = state.data.records.filter((r) => r.id !== id);
    saveData();
    state.ui.deleteCandidateId = null;
    rerenderAll();
  }

  function editRecord(id) {
    const r = state.data.records.find((row) => row.id === id);
    if (!r) return;
    showView("records");
    const map = {
      recordId: r.id,
      category: r.category,
      serviceName: r.serviceName,
      seller: r.seller,
      client: r.client,
      contact: r.contact,
      address: r.address,
      administration: r.administration,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      eventDate: r.eventDate,
      observations: r.observations
    };
    Object.entries(map).forEach(([idField, value]) => {
      const el = $("#" + idField);
      if (el) el.value = value ?? "";
    });
    renderDynamicFields(r.category, r.extra || {});
  }

  function bindEvents() {
    $$("[data-view]").forEach((btn) => btn.addEventListener("click", () => showView(btn.dataset.view)));

    $("#category").addEventListener("change", (e) => renderDynamicFields(e.target.value));
    $("#globalSearch").addEventListener("input", (e) => {
      state.ui.search = e.target.value.trim();
      rerenderAll();
    });

    $("#globalCategoryFilter").addEventListener("change", (e) => {
      state.ui.categoryFilter = e.target.value;
      rerenderAll();
    });

    $("#recordCategoryFilter").addEventListener("change", (e) => {
      state.ui.recordFilter = e.target.value;
      rerenderAll();
    });

    $("#recordsTable tbody").addEventListener("click", (e) => {
      const target = e.target.closest("button[data-action]");
      if (!target) return;
      const { action, id } = target.dataset;
      if (action === "edit") editRecord(id);
      if (action === "delete") requestDeleteRecord(id);
    });

    $("#recordForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const record = serializeForm(e.currentTarget);
      const error = validateRecord(record);
      if (error) return alert(error);
      upsertRecord(record);
      resetForm();
      showView("records");
    });

    $("#btnReset").addEventListener("click", resetForm);
    $("#btnNewRecord").addEventListener("click", () => {
      showView("records");
      resetForm();
    });

    $("#confirmDialog").addEventListener("close", (e) => {
      if (e.target.returnValue === "confirm") confirmDeleteRecord();
    });

    $("#btnExport").addEventListener("click", exportJson);
    $("#importFile").addEventListener("change", importJson);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `operativa-vg-crm-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.records)) throw new Error("invalid");
        state.data = { version: 1, records: parsed.records };
        saveData();
        rerenderAll();
        alert("Importación exitosa.");
      } catch {
        alert("JSON inválido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function showView(viewName) {
    state.ui.view = viewName;
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${viewName}`));
    $$("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === viewName));
    $("#viewTitle").textContent = viewName === "records" ? "Registros" : viewName === "results" ? "Resultados" : viewName === "settings" ? "Configuración" : "Dashboard";
  }

  function rerenderAll() {
    renderTable();
    renderKpis();
    renderRankings();
    renderCharts();
  }

  function seedData() {
    if (state.data.records.length > 0) return;
    const demo = [
      ["Nuevos Servicios", "Instalación Fibra 300MB", "Lucía Pérez", "Consorcio Norte", "Ganado", 320000],
      ["Agregados", "IP Fija Empresarial", "Martín Rojas", "Logística Sur", "Facturado", 90000],
      ["Presupuestos", "Enlace Dedicado", "Lucía Pérez", "Hospital Central", "Pendiente", 540000],
      ["Bajas de Servicios", "Baja Telefonía", "Pedro Vera", "Retail Centro", "Perdido", 120000],
      ["Novaciones", "Renovación contrato anual", "Marina Sol", "Colegio Federal", "Ganado", 210000]
    ];

    state.data.records = demo.map(([category, serviceName, seller, client, status, amount], i) => ({
      id: uid(),
      category,
      serviceName,
      seller,
      client,
      contact: "contacto@cliente.com",
      address: "Av. Principal 123",
      administration: "Administración central",
      amount,
      currency: "ARS",
      status,
      eventDate: new Date(Date.now() - i * 86400000 * 15).toISOString().slice(0, 10),
      observations: "Registro de ejemplo",
      extra: {},
      createdAt: new Date().toISOString()
    }));
    saveData();
  }

  function init() {
    renderCategoryOptions();
    loadData();
    seedData();
    bindEvents();
    resetForm();
    rerenderAll();
    showView("dashboard");

    // Roadmap Firebase:
    // 1) Reemplazar loadData/saveData por adaptador Firestore.
    // 2) Integrar autenticación Firebase Auth (email/password y Google).
    // 3) Agregar notificaciones (Cloud Messaging) y auditoría por usuario.
  }

  init();
})();
