(function () {
  function rangeForReport(type) {
    const now = new Date();
    if (type === "weekly") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { start, end: now, label: "Relatório semanal" };
    }
    if (type === "yearly") return { start: new Date(now.getFullYear(), 0, 1), end: now, label: "Relatório anual" };
    if (type === "custom") return App.currentRange();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, label: "Relatório mensal" };
  }

  function variationRows(transactions, range) {
    const current = Finance.totals(Finance.filterByRange(transactions, range));
    const previous = Finance.totals(Finance.filterByRange(transactions, Finance.previousRange(range)));
    const pct = (now, before) => {
      if (!before && !now) return "0%";
      if (!before) return "+100%";
      const value = ((now - before) / before) * 100;
      return `${value >= 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}%`;
    };
    return [
      ["Variação do faturamento", pct(current.totalEntradas, previous.totalEntradas)],
      ["Variação das despesas", pct(current.totalSaidas, previous.totalSaidas)],
      ["Variação do saldo", pct(current.saldo, previous.saldo)],
      ["Variação dos atendimentos", pct(current.atendimentos, previous.atendimentos)]
    ];
  }

  function reportData(type, customRange) {
    const transactions = Store.getState().transactions;
    const range = customRange || rangeForReport(type);
    const items = Finance.filterByRange(transactions, range);
    const totals = Finance.totals(items);
    const incomeByCategory = Finance.groupSum(totals.entradas, "categoria");
    const expenseByCategory = Finance.groupSum(totals.saidas, "categoria");
    const byPayment = Finance.groupSum(totals.entradas, "formaPagamento");
    const byService = Finance.groupSum(totals.entradas, "servico");
    return { type, range, items, totals, incomeByCategory, expenseByCategory, byPayment, byService, variations: variationRows(transactions, range) };
  }

  function renderReportPreview(type = "monthly") {
    const data = reportData(type);
    const box = document.getElementById("reportPreview");
    const rows = [
      ["Entradas", Finance.money(data.totals.totalEntradas)],
      ["Saídas", Finance.money(data.totals.totalSaidas)],
      ["Saldo", Finance.money(data.totals.saldo)],
      ["Atendimentos", data.totals.atendimentos],
      ["Ticket médio", Finance.money(data.totals.ticketMedio)],
      ["Serviço mais vendido", Finance.topKey(data.byService)],
      ["Categoria que mais faturou", Finance.topKey(data.incomeByCategory)],
      ["Categoria que mais gerou despesas", Finance.topKey(data.expenseByCategory)],
      ["Forma de pagamento mais utilizada", Finance.topKey(data.byPayment)],
      ...data.variations
    ];
    const panel = document.createElement("div");
    panel.className = "summary-list";
    panel.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      row.append(dt, dd);
      return row;
    }));
    box.replaceChildren(panel);
  }

  function initReports() {
    document.querySelectorAll("[data-report]").forEach((button) => {
      button.addEventListener("click", () => {
        const type = button.dataset.report;
        renderReportPreview(type);
        if (button.closest("#dashboardView")) PDF.generate(type);
        else if (button.classList.contains("report-card")) PDF.generate(type);
      });
    });
  }

  window.Reports = { rangeForReport, reportData, renderReportPreview, initReports };
})();
