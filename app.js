(() => {
  "use strict";

  const STORAGE_KEY = "masterson.crmData.v2";
  const CATEGORIES = [
    "Movimiento de Obra",
    "Baja de Servicios",
    "Presupuestos",
    "Charlas Informativas",
    "Facturación de Agregados",
    "Facturación de Nuevos Servicios"
  ];

  const SELLERS = ["Gonzalo", "Nicolás", "Gastón"];

  const CATEGORY_FIELDS = {
    "Movimiento de Obra": [
      { key: "timestamp", label: "Marca temporal", type: "datetime-local" },
      { key: "entryDate", label: "Fecha de ingreso", type: "date" },
      { key: "requesterName", label: "Solicitante (nombre)", type: "text" },
      { key: "requesterPhone", label: "Solicitante (teléfono)", type: "text" },
      { key: "zeroCostReason", label: "Motivo costo 0", type: "text" },
      { key: "movementReason", label: "Motivo del movimiento", type: "text" },
      { key: "requestChannel", label: "Medio de solicitud", type: "text" },
      { key: "alarmType", label: "Tipo de alarma", type: "text" }
    ],
    "Baja de Servicios": [
      { key: "timestamp", label: "Marca temporal", type: "datetime-local" },
      { key: "entryDate", label: "Fecha de ingreso", type: "date" },
      { key: "cancelRequester", label: "Cliente/persona solicita baja", type: "text" },
      { key: "cancelReason", label: "Motivo de baja", type: "text" },
      { key: "internetProvider", label: "Internet utilizado", type: "text" },
      { key: "equipmentOwner", label: "Propietario equipamiento", type: "text" },
      { key: "equipmentToRemove", label: "Equipamiento a retirar", type: "text" }
    ],
    "Presupuestos": [
      { key: "budgetReason", label: "Motivo", type: "text" },
      { key: "requiredEquipment", label: "Equipamiento necesario", type: "text" }
    ],
    "Charlas Informativas": [
      { key: "meetingDate", label: "Fecha reunión", type: "date" },
      { key: "meetingTime", label: "Hora", type: "time" },
      { key: "meetingPlace", label: "Lugar", type: "text" },
      { key: "meetingContact", label: "Contacto responsable", type: "text" }
    ],
    "Facturación de Agregados": [
      { key: "entryDate", label: "Fecha de ingreso", type: "date" },
      { key: "additionalDetail", label: "Detalle adicional", type: "text" },
      { key: "serviceStartDate", label: "Fecha de alta", type: "date" }
    ],
    "Facturación de Nuevos Servicios": [
      { key: "entryDate", label: "Fecha de ingreso", type: "date" },
      { key: "mail", label: "Mail", type: "email" },
      { key: "rut", label: "RUT", type: "text" },
      { key: "companyName", label: "Razón social", type: "text" },
      { key: "monthlyAmount", label: "Importe mensual", type: "number" },
      { key: "leaseAmount", label: "Importe arrendamiento", type: "number" },
      { key: "equipmentPurchased", label: "Equipamiento comprado", type: "text" },
      { key: "negotiatedDiscount", label: "Descuentos negociados", type: "text" },
      { key: "serviceStartDate", label: "Fecha de alta", type: "date" }
    ]
  };

  const state = {
    data: { version: 2, records: [] },
    ui: { view: "dashboard", search: "", categoryFilter: "all", recordFilter: "all", deleteCandidateId: null },
    charts: {}
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const money = (v, currency = "ARS") => new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(v || 0));

  const DataProvider = {
    load() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: 2, records: [] };
      try {
        const parsed = JSON.parse(raw);
        return parsed?.records ? parsed : { version: 2, records: [] };
      } catch {
        return { version: 2, records: [] };
      }
    },
    save(payload) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    },
    // Futuro Firebase:
    // async load() => desde Firestore/Realtime DB
    // async save() => persistir snapshot o write batches
  };

  function renderSelects() {
    const global = $("#globalCategoryFilter");
    const byRecord = $("#recordCategoryFilter");
    const byForm = $("#category");

    global.innerHTML = `<option value="all">Todas las categorías</option>`;
    byRecord.innerHTML = `<option value="all">Todas las categorías</option>`;
    byForm.innerHTML = "";

    CATEGORIES.forEach((c) => {
      [global, byRecord, byForm].forEach((sel, idx) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        if (idx === 2 || idx < 2) sel.append(opt);
      });
    });

    const seller = $("#seller");
    seller.innerHTML = "";
    SELLERS.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      seller.append(opt);
    });

    byForm.value = CATEGORIES[0];
    renderDynamicFields(CATEGORIES[0]);
  }

  function renderDynamicFields(category, values = {}) {
    const holder = $("#dynamicFields");
    const tpl = $("#dynamicFieldTemplate");
    holder.innerHTML = "";

    (CATEGORY_FIELDS[category] || []).forEach((field) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const label = node.querySelector("label");
      const input = node.querySelector("input");
      const id = `extra_${field.key}`;
      label.textContent = field.label;
      label.htmlFor = id;
      input.id = id;
      input.name = `extra.${field.key}`;
      input.type = field.type || "text";
      input.value = values[field.key] || "";
      holder.append(node);
    });
  }

  function getRecords() {
    const { search, categoryFilter, recordFilter } = state.ui;
    return state.data.records.filter((r) => {
      const source = [r.serviceName, r.client, r.contact, r.address, r.category, r.seller, r.serviceType, r.observations].join(" ").toLowerCase();
      const bySearch = !search || source.includes(search.toLowerCase());
      const byGlobalCat = categoryFilter === "all" || r.category === categoryFilter;
      const byRecordCat = recordFilter === "all" || r.category === recordFilter;
      return bySearch && byGlobalCat && byRecordCat;
    });
  }

  function renderTable() {
    const tbody = $("#recordsTable tbody");
    const rows = getRecords().sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate));
    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${r.eventDate || "-"}</td>
        <td>${r.category}</td>
        <td>${r.serviceName}</td>
        <td>${r.serviceType}</td>
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
    `).join("") || `<tr><td colspan="9">Sin registros.</td></tr>`;
  }

  function metrics(rows) {
    const sold = rows.filter((r) => r.status !== "Perdido");
    return {
      totalServices: rows.length,
      newServices: rows.filter((r) => r.category === "Facturación de Nuevos Servicios").length,
      lostServices: rows.filter((r) => r.category === "Baja de Servicios" || r.status === "Perdido").length,
      totalRevenue: sold.reduce((acc, r) => acc + Number(r.amount || 0), 0),
      activeWorks: rows.filter((r) => r.category === "Movimiento de Obra" && ["Pendiente", "En Curso"].includes(r.status)).length,
      soldAddons: rows.filter((r) => r.category === "Facturación de Agregados" && r.status !== "Perdido").length
    };
  }

  function renderKpis() {
    const m = metrics(getRecords());
    $("#kpiTotalServices").textContent = m.totalServices;
    $("#kpiNewServices").textContent = m.newServices;
    $("#kpiLostServices").textContent = m.lostServices;
    $("#kpiRevenue").textContent = money(m.totalRevenue);
    $("#kpiActiveWorks").textContent = m.activeWorks;
    $("#kpiAddons").textContent = m.soldAddons;
  }

  function renderRankings() {
    const rows = getRecords();
    const soldRows = rows.filter((r) => r.status !== "Perdido");

    const salesMap = new Map();
    const lostMap = new Map();
    const bestBySeller = new Map();
    const billingByService = new Map();

    rows.forEach((r) => {
      const amount = Number(r.amount || 0);
      if (r.status !== "Perdido") {
        salesMap.set(r.seller, (salesMap.get(r.seller) || 0) + amount);
        billingByService.set(r.serviceName, (billingByService.get(r.serviceName) || 0) + amount);
        const current = bestBySeller.get(r.seller);
        if (!current || amount > current.amount) bestBySeller.set(r.seller, r);
      } else {
        lostMap.set(r.seller, (lostMap.get(r.seller) || 0) + 1);
      }
    });

    const salesRank = [...salesMap.entries()].sort((a, b) => b[1] - a[1]);
    const lostRank = [...lostMap.entries()].sort((a, b) => b[1] - a[1]);
    const topGeneral = [...soldRows].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const topServices = [...billingByService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    $("#rankingSales").innerHTML = salesRank.map(([s, v]) => `<li>${s}: ${money(v)}</li>`).join("") || "<li>Sin datos.</li>";
    $("#rankingLost").innerHTML = lostRank.map(([s, q]) => `<li>${s}: ${q} perdidos</li>`).join("") || "<li>Sin datos.</li>";
    $("#bestSaleBySeller").innerHTML = [...bestBySeller.entries()].map(([s, r]) => `<li>${s}: ${r.serviceName} (${money(r.amount, r.currency)})</li>`).join("") || "<li>Sin datos.</li>";
    $("#topGeneral").innerHTML = topGeneral.map((r) => `<li>${r.serviceName} · ${r.seller} · ${money(r.amount, r.currency)}</li>`).join("") || "<li>Sin datos.</li>";
    $("#topBillingServices").innerHTML = topServices.map(([name, total]) => `<li>${name}: ${money(total)}</li>`).join("") || "<li>Sin datos.</li>";
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

  function chart(canvasId, type, data) {
    if (state.charts[canvasId]) state.charts[canvasId].destroy();
    state.charts[canvasId] = new Chart($("#" + canvasId), {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#e7f5f5" } } },
        scales: type === "doughnut" ? {} : {
          x: { ticks: { color: "#9fb8b8" }, grid: { color: "#244041" } },
          y: { ticks: { color: "#9fb8b8" }, grid: { color: "#244041" } }
        }
      }
    });
  }

  function renderCharts() {
    const rows = getRecords();
    const byCategory = CATEGORIES.map((cat) => rows.filter((r) => r.category === cat && r.status !== "Perdido").reduce((a, b) => a + Number(b.amount || 0), 0));
    const statusLabels = ["Pendiente", "En Curso", "Ganado", "Perdido", "Facturado"];
    const statusData = statusLabels.map((s) => rows.filter((r) => r.status === s).length);
    const monthData = monthlySeries(rows);

    chart("chartCategory", "bar", {
      labels: CATEGORIES,
      datasets: [{ label: "Monto", data: byCategory, backgroundColor: ["#0ca5a7", "#0891b2", "#14b8a6", "#22c55e", "#8b5cf6", "#f59e0b"] }]
    });

    chart("chartMonthly", "line", {
      labels: monthData.map(([k]) => k),
      datasets: [{ label: "Ingresos", data: monthData.map(([, v]) => v), borderColor: "#0ca5a7", tension: .25 }]
    });

    chart("chartStatus", "doughnut", {
      labels: statusLabels,
      datasets: [{ data: statusData, backgroundColor: ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"] }]
    });
  }

  function showView(name) {
    state.ui.view = name;
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
    $$('[data-view]').forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    $("#viewTitle").textContent = ({ dashboard: "Dashboard", records: "Registros", results: "Resultados", settings: "Configuración" })[name] || "Dashboard";
  }

  function resetForm() {
    $("#recordForm").reset();
    $("#recordId").value = "";
    $("#category").value = CATEGORIES[0];
    $("#seller").value = SELLERS[0];
    $("#eventDate").valueAsDate = new Date();
    renderDynamicFields(CATEGORIES[0]);
  }

  function serialize(form) {
    const fd = new FormData(form);
    const category = fd.get("category");
    const extra = {};
    (CATEGORY_FIELDS[category] || []).forEach((f) => { extra[f.key] = fd.get(`extra.${f.key}`) || ""; });

    return {
      id: fd.get("recordId") || uid(),
      category,
      serviceName: String(fd.get("serviceName") || "").trim(),
      serviceType: String(fd.get("serviceType") || "").trim(),
      seller: String(fd.get("seller") || "").trim(),
      client: String(fd.get("client") || "").trim(),
      contact: String(fd.get("contact") || "").trim(),
      address: String(fd.get("address") || "").trim(),
      administration: String(fd.get("administration") || "").trim(),
      amount: Number(fd.get("amount")),
      currency: fd.get("currency"),
      status: fd.get("status"),
      eventDate: fd.get("eventDate"),
      observations: String(fd.get("observations") || "").trim(),
      extra,
      createdAt: new Date().toISOString()
    };
  }

  function validate(record) {
    if (!record.serviceName || !record.seller || !record.client || !record.contact || !record.address || !record.eventDate) return "Faltan campos obligatorios.";
    if (Number.isNaN(record.amount) || record.amount < 0) return "Monto inválido.";
    return "";
  }

  function saveRecord(record) {
    const idx = state.data.records.findIndex((r) => r.id === record.id);
    if (idx >= 0) state.data.records[idx] = { ...state.data.records[idx], ...record };
    else state.data.records.push(record);
    DataProvider.save(state.data);
    rerender();
  }

  function editRecord(id) {
    const r = state.data.records.find((x) => x.id === id);
    if (!r) return;
    showView("records");
    const fields = ["recordId", "category", "serviceName", "serviceType", "seller", "client", "contact", "address", "administration", "amount", "currency", "status", "eventDate", "observations"];
    fields.forEach((f) => {
      const el = $("#" + f);
      if (el) el.value = r[f] ?? "";
    });
    renderDynamicFields(r.category, r.extra || {});
  }

  function deleteRecord(id) {
    state.data.records = state.data.records.filter((r) => r.id !== id);
    DataProvider.save(state.data);
    rerender();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `masterson-crm-${new Date().toISOString().slice(0, 10)}.json`;
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
        state.data = { version: 2, records: parsed.records };
        DataProvider.save(state.data);
        rerender();
        alert("Importación exitosa");
      } catch {
        alert("JSON inválido");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function rerender() {
    renderTable();
    renderKpis();
    renderRankings();
    renderCharts();
  }

  function bindEvents() {
    $$('[data-view]').forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
    $("#category").addEventListener("change", (e) => renderDynamicFields(e.target.value));
    $("#globalSearch").addEventListener("input", (e) => { state.ui.search = e.target.value.trim(); rerender(); });
    $("#globalCategoryFilter").addEventListener("change", (e) => { state.ui.categoryFilter = e.target.value; rerender(); });
    $("#recordCategoryFilter").addEventListener("change", (e) => { state.ui.recordFilter = e.target.value; rerender(); });

    $("#recordForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const record = serialize(e.currentTarget);
      const err = validate(record);
      if (err) return alert(err);
      saveRecord(record);
      resetForm();
      showView("records");
    });

    $("#btnReset").addEventListener("click", resetForm);
    $("#btnNewRecord").addEventListener("click", () => { showView("records"); resetForm(); });

    $("#recordsTable tbody").addEventListener("click", (e) => {
      const target = e.target.closest("button[data-action]");
      if (!target) return;
      const { action, id } = target.dataset;
      if (action === "edit") editRecord(id);
      if (action === "delete") {
        state.ui.deleteCandidateId = id;
        $("#confirmDialog").showModal();
      }
    });

    $("#confirmDialog").addEventListener("close", (e) => {
      if (e.target.returnValue === "confirm" && state.ui.deleteCandidateId) {
        deleteRecord(state.ui.deleteCandidateId);
        state.ui.deleteCandidateId = null;
      }
    });

    $("#btnExport").addEventListener("click", exportJson);
    $("#importFile").addEventListener("change", importJson);
  }

  function seed() {
    if (state.data.records.length) return;
    const now = Date.now();
    const demo = [
      { category: "Facturación de Nuevos Servicios", serviceName: "PV Torre Central", serviceType: "Portería virtual", seller: "Gonzalo", client: "Consorcio Torre Central", status: "Facturado", amount: 380000 },
      { category: "Facturación de Agregados", serviceName: "Agregado CCTV Norte", serviceType: "Instalación de cámaras", seller: "Nicolás", client: "Edificio Norte", status: "Ganado", amount: 155000 },
      { category: "Movimiento de Obra", serviceName: "Recableado Obra Sur", serviceType: "Sistemas de alarma", seller: "Gastón", client: "Constructora Sur", status: "En Curso", amount: 92000 },
      { category: "Baja de Servicios", serviceName: "Baja Monitoreo Plaza", serviceType: "Monitoreo", seller: "Nicolás", client: "Plaza Offices", status: "Perdido", amount: 120000 },
      { category: "Presupuestos", serviceName: "Propuesta Control Acceso", serviceType: "Control de acceso", seller: "Gonzalo", client: "Residencial Delta", status: "Pendiente", amount: 275000 },
      { category: "Charlas Informativas", serviceName: "Charla Administración Río", serviceType: "Portería virtual", seller: "Gastón", client: "Adm. Río", status: "En Curso", amount: 50000 }
    ];

    state.data.records = demo.map((d, i) => ({
      id: uid(),
      ...d,
      contact: "contacto@cliente.com",
      address: "Av. Comercial 123",
      administration: "Administración General",
      currency: "ARS",
      eventDate: new Date(now - i * 1000 * 60 * 60 * 24 * 12).toISOString().slice(0, 10),
      observations: "Registro inicial de ejemplo",
      extra: {},
      createdAt: new Date().toISOString()
    }));

    DataProvider.save(state.data);
  }

  function init() {
    renderSelects();
    state.data = DataProvider.load();
    seed();
    bindEvents();
    resetForm();
    rerender();
    showView("dashboard");
  }

  init();
})();
