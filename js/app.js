(function () {
  const appState = { period: "month" };

  function qs(id) { return document.getElementById(id); }

  function openModal(id) {
    qs(id).classList.add("open");
    qs(id).setAttribute("aria-hidden", "false");
  }

  function closeModals() {
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    });
  }

  function toast(message) {
    const el = qs("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function currentRange() {
    return Finance.periodRange(appState.period, qs("startDate").value, qs("endDate").value);
  }

  function setView(view) {
    document.querySelectorAll(".view").forEach((el) => el.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
    qs(`${view}View`).classList.add("active");
    qs("viewTitle").textContent = { dashboard: "Dashboard", lancamentos: "Lançamentos", relatorios: "Relatórios", categorias: "Categorias", configuracoes: "Configurações" }[view];
    qs("sidebar").classList.remove("open");
  }

  function download(filename, content, type = "application/json") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function refresh() {
    const data = Store.getState();
    const range = currentRange();
    qs("periodLabel").textContent = range.label;
    Finance.renderDashboard(data.transactions, range);
    Transactions.renderTable();
    Transactions.renderCategories();
    Reports.renderReportPreview("monthly");
    qs("demoStatus").textContent = data.demoLoaded ? "Dados de demonstração ativos. Eles ficam marcados internamente para remoção rápida." : "Carregue exemplos para testar gráficos e relatórios.";
  }

  function setupPeriod() {
    document.querySelectorAll("#periodButtons button").forEach((button) => {
      button.addEventListener("click", () => {
        appState.period = button.dataset.period;
        document.querySelectorAll("#periodButtons button").forEach((item) => item.classList.toggle("active", item === button));
        qs("customPeriod").classList.toggle("active", appState.period === "custom");
        if (appState.period === "custom" && (!qs("startDate").value || !qs("endDate").value)) {
          const now = new Date();
          qs("startDate").value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
          qs("endDate").value = now.toISOString().slice(0, 10);
        }
        refresh();
      });
    });
    ["startDate", "endDate"].forEach((id) => qs(id).addEventListener("input", refresh));
  }

  function setupBackup() {
    const exportAction = () => {
      download(`rayssa-studio-backup-${new Date().toISOString().slice(0, 10)}.json`, Store.exportJson());
      toast("Backup exportado.");
    };
    qs("exportData").addEventListener("click", exportAction);
    qs("quickExport").addEventListener("click", exportAction);
    qs("importData").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      if (!confirm("Importar este arquivo substituirá os dados atuais. Deseja continuar?")) {
        event.target.value = "";
        return;
      }
      try {
        Store.importJson(await file.text());
        toast("Dados importados com sucesso.");
        refresh();
      } catch (error) {
        alert(error.message);
      } finally {
        event.target.value = "";
      }
    });
  }

  function setupPdf() {
    qs("openPdfModal").addEventListener("click", () => {
      const range = currentRange();
      qs("pdfStart").value = Finance.iso(range.start);
      qs("pdfEnd").value = Finance.iso(range.end);
      openModal("pdfModal");
    });
    qs("generatePdf").addEventListener("click", () => {
      const type = qs("pdfType").value;
      const custom = { start: Finance.parseDate(qs("pdfStart").value), end: Finance.parseDate(qs("pdfEnd").value), label: "Personalizado" };
      PDF.generate(type, type === "custom" ? custom : undefined);
      closeModals();
    });
  }

  function openHtmlSummary() {
    const range = currentRange();
    const params = new URLSearchParams({ start: Finance.iso(range.start), end: Finance.iso(range.end), label: range.label });
    window.open(`resumo.html?${params.toString()}`, "_blank", "noopener");
  }

  function deleteAllTransactions() {
    const count = Store.getState().transactions.length;
    if (!count) {
      toast("Não há lançamentos para excluir.");
      return;
    }
    if (!confirm(`Excluir permanentemente todos os ${count} lançamentos? Esta ação não pode ser desfeita.`)) return;
    Store.clearTransactions();
    toast("Todos os lançamentos foram excluídos.");
    refresh();
  }

  function init() {
    document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
    qs("menuToggle").addEventListener("click", () => qs("sidebar").classList.toggle("open"));
    document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModals));
    document.querySelectorAll(".modal").forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) closeModals(); }));
    qs("addEntryBtn").addEventListener("click", () => Transactions.openTransaction(null, "entrada"));
    qs("newTransactionBtn").addEventListener("click", () => Transactions.openTransaction(null, "entrada"));
    qs("openMassModal").addEventListener("click", () => Transactions.openMass());
    qs("massTransactionBtn").addEventListener("click", () => Transactions.openMass());
    qs("quickMass").addEventListener("click", () => Transactions.openMass());
    qs("openHtmlSummary").addEventListener("click", openHtmlSummary);
    qs("deleteAllTransactions").addEventListener("click", deleteAllTransactions);
    document.querySelectorAll("[data-quick]").forEach((button) => button.addEventListener("click", () => Transactions.openTransaction(null, button.dataset.quick)));
    qs("loadDemo").addEventListener("click", () => { Store.loadDemo(); toast("Dados de demonstração carregados."); refresh(); });
    qs("clearDemo").addEventListener("click", () => {
      if (!confirm("Apagar todos os dados de demonstração?")) return;
      Store.clearDemo();
      toast("Dados de demonstração apagados.");
      refresh();
    });
    setupPeriod();
    setupBackup();
    setupPdf();
    Transactions.initTransactions();
    Reports.initReports();
    refresh();
  }

  window.App = { openModal, closeModals, toast, refresh, currentRange };
  document.addEventListener("DOMContentLoaded", init);
})();
