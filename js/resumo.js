(function () {
  const DATE = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

  function qs(id) { return document.getElementById(id); }

  function text(id, value) { qs(id).textContent = value; }

  function getRange() {
    const params = new URLSearchParams(location.search);
    const startValue = params.get("start");
    const endValue = params.get("end");
    const now = new Date();
    const start = startValue ? Finance.parseDate(startValue) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endValue ? Finance.parseDate(endValue) : now;
    return { start, end, label: params.get("label") || `${DATE.format(start)} a ${DATE.format(end)}` };
  }

  function addCell(row, value, className = "") {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (className) cell.className = className;
    row.append(cell);
  }

  function renderTable(items) {
    const tbody = qs("summaryTable");
    tbody.replaceChildren();
    items.slice().sort((a, b) => b.data.localeCompare(a.data)).forEach((item) => {
      const row = document.createElement("tr");
      addCell(row, DATE.format(Finance.parseDate(item.data)));
      const typeCell = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = `type ${item.tipo}`;
      badge.textContent = item.tipo === "entrada" ? "Entrada" : "Saída";
      typeCell.append(badge);
      row.append(typeCell);
      addCell(row, item.tipo === "entrada" ? item.cliente : (item.descricao || "-"));
      addCell(row, item.tipo === "entrada" ? (item.servico || item.categoria || "-") : (item.categoria || "-"));
      addCell(row, item.formaPagamento || "-");
      addCell(row, `${item.tipo === "entrada" ? "+" : "-"} ${Finance.money(item.valor)}`, `amount ${item.tipo}`);
      tbody.append(row);
    });
    if (!items.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.className = "empty";
      cell.textContent = "Nenhum lançamento encontrado neste período.";
      row.append(cell);
      tbody.append(row);
    }
  }

  function render() {
    const range = getRange();
    const items = Finance.filterByRange(Store.getState().transactions, range);
    const totals = Finance.totals(items);
    const incomeCategories = Finance.groupSum(totals.entradas, "categoria");
    const expenseCategories = Finance.groupSum(totals.saidas, "categoria");
    const payments = Finance.groupSum(totals.entradas, "formaPagamento");
    const services = Finance.groupSum(totals.entradas, "servico");
    text("summaryPeriod", `${range.label} · ${DATE.format(range.start)} a ${DATE.format(range.end)}`);
    text("generatedAt", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date()));
    text("summaryIncome", Finance.money(totals.totalEntradas));
    text("summaryExpense", Finance.money(totals.totalSaidas));
    text("summaryBalance", Finance.money(totals.saldo));
    text("summaryAppointments", totals.atendimentos);
    text("summaryTicket", Finance.money(totals.ticketMedio));
    text("recordCount", `${items.length} ${items.length === 1 ? "registro" : "registros"}`);
    const insights = [
      ["Serviço mais vendido", Finance.topKey(services)],
      ["Categoria com maior faturamento", Finance.topKey(incomeCategories)],
      ["Categoria com maior despesa", Finance.topKey(expenseCategories)],
      ["Pagamento mais utilizado", Finance.topKey(payments)]
    ];
    qs("insightGrid").replaceChildren(...insights.map(([label, value]) => {
      const item = document.createElement("article");
      item.className = "insight";
      const span = document.createElement("span");
      const strong = document.createElement("strong");
      span.textContent = label;
      strong.textContent = value;
      item.append(span, strong);
      return item;
    }));
    renderTable(items);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function loadCssText() {
    if (location.protocol === "file:") {
      const stylesheet = document.querySelector("link[rel='stylesheet']");
      return stylesheet?.href ? `@import url("${stylesheet.href}");` : "body{font-family:Arial,sans-serif;color:#2f2926;margin:24px}";
    }
    try {
      const response = await fetch("css/resumo.css");
      if (!response.ok) throw new Error("CSS indisponível");
      return response.text();
    } catch {
      const inlineRules = [...document.styleSheets].flatMap((sheet) => {
        try { return [...sheet.cssRules].map((rule) => rule.cssText); }
        catch { return []; }
      }).join("\n");
      if (inlineRules) return inlineRules;
      const stylesheet = document.querySelector("link[rel='stylesheet']");
      if (stylesheet?.href) return `@import url("${stylesheet.href}");`;
      return "body{font-family:Arial,sans-serif;color:#2f2926;margin:24px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #e8ddd6;text-align:left}.header-actions{display:none}";
    }
  }

  async function loadAsset(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error("Imagem indisponível");
      return blobToDataUrl(await response.blob());
    } catch {
      return new URL(path, location.href).href;
    }
  }

  let htmlDownloadUrl = "";

  async function prepareHtmlDownload() {
    const link = qs("downloadHtml");
    try {
      const [cssText, logoData, backgroundData] = await Promise.all([
        loadCssText(),
        loadAsset("assets/logo-branca.png"),
        loadAsset("assets/fundo-aplicacao.jpg")
      ]);
      if (!cssText) throw new Error("Não foi possível carregar o estilo do resumo.");
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll("script, link[rel='stylesheet'], .header-actions").forEach((element) => element.remove());
      clone.querySelector(".header-inner img").src = logoData;
      const style = document.createElement("style");
      style.textContent = cssText.replace("../assets/fundo-aplicacao.jpg", backgroundData);
      clone.querySelector("head").append(style);
      const html = `<!doctype html>\n${clone.outerHTML}`;
      htmlDownloadUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const range = getRange();
      link.href = htmlDownloadUrl;
      link.download = `resumo-financeiro-${Finance.iso(range.start)}-a-${Finance.iso(range.end)}.html`;
      link.removeAttribute("aria-disabled");
      link.textContent = "Baixar HTML";
    } catch (error) {
      link.textContent = "HTML indisponível";
      link.title = error.message;
    }
  }

  qs("printSummary").addEventListener("click", () => window.print());
  qs("downloadHtml").addEventListener("click", (event) => {
    if (event.currentTarget.getAttribute("aria-disabled") === "true") event.preventDefault();
  });
  window.addEventListener("beforeunload", () => { if (htmlDownloadUrl) URL.revokeObjectURL(htmlDownloadUrl); });
  render();
  prepareHtmlDownload();
})();
