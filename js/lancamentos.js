(function () {
  const state = { page: 1, perPage: 10 };

  function formValue(id) {
    return document.getElementById(id).value.trim();
  }

  function numberFromCurrency(value) {
    const normalized = String(value).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    return Number(normalized);
  }

  function fillSelect(id, options, firstLabel) {
    const select = document.getElementById(id);
    select.replaceChildren();
    if (firstLabel) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = firstLabel;
      select.append(option);
    }
    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      select.append(option);
    });
  }

  function refreshFormOptions(tipo) {
    const data = Store.getState();
    fillSelect("categoria", tipo === "entrada" ? data.incomeCategories : data.expenseCategories);
    fillSelect("formaPagamento", data.paymentMethods);
    fillSelect("filterCategory", [...data.incomeCategories, ...data.expenseCategories].filter((item, index, arr) => arr.indexOf(item) === index), "Categoria");
    fillSelect("filterPayment", data.paymentMethods, "Pagamento");
  }

  function setType(tipo) {
    document.querySelectorAll("[name='tipo']").forEach((radio) => { radio.checked = radio.value === tipo; });
    document.querySelectorAll(".entrada-field").forEach((el) => el.classList.toggle("hidden", tipo !== "entrada"));
    document.querySelectorAll(".saida-field").forEach((el) => el.classList.toggle("hidden", tipo !== "saida"));
    refreshFormOptions(tipo);
  }

  function openTransaction(item, tipo = "entrada") {
    document.getElementById("transactionForm").reset();
    document.getElementById("formError").textContent = "";
    document.getElementById("transactionId").value = item ? item.id : "";
    document.getElementById("modalTitle").textContent = item ? "Editar lançamento" : "Novo lançamento";
    setType(item ? item.tipo : tipo);
    document.getElementById("data").value = item ? item.data : new Date().toISOString().slice(0, 10);
    ["cliente", "servico", "descricao", "fornecedor", "categoria", "formaPagamento", "observacoes"].forEach((id) => {
      document.getElementById(id).value = item ? (item[id] || "") : "";
    });
    document.getElementById("valor").value = item ? Finance.money(item.valor) : "";
    App.openModal("transactionModal");
  }

  function readForm() {
    const tipo = document.querySelector("[name='tipo']:checked").value;
    return {
      tipo,
      data: formValue("data"),
      cliente: formValue("cliente"),
      servico: formValue("servico"),
      descricao: formValue("descricao"),
      categoria: formValue("categoria"),
      fornecedor: formValue("fornecedor"),
      formaPagamento: formValue("formaPagamento"),
      valor: numberFromCurrency(formValue("valor")),
      observacoes: formValue("observacoes")
    };
  }

  function applyTableFilters(transactions) {
    const q = formValue("searchInput").toLowerCase();
    const date = formValue("filterDate");
    const type = formValue("filterType");
    const category = formValue("filterCategory");
    const payment = formValue("filterPayment");
    const sort = formValue("sortSelect");
    let result = transactions.filter((item) => {
      const text = [item.cliente, item.descricao, item.servico, item.categoria, item.fornecedor].join(" ").toLowerCase();
      return (!q || text.includes(q)) && (!date || item.data === date) && (!type || item.tipo === type) && (!category || item.categoria === category) && (!payment || item.formaPagamento === payment);
    });
    result = result.sort((a, b) => {
      if (sort === "date_asc") return a.data.localeCompare(b.data);
      if (sort === "value_desc") return b.valor - a.valor;
      if (sort === "value_asc") return a.valor - b.valor;
      return b.data.localeCompare(a.data);
    });
    return result;
  }

  function renderTable() {
    const data = Store.getState();
    const tbody = document.getElementById("transactionsTable");
    const filtered = applyTableFilters(data.transactions);
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.perPage));
    state.page = Math.min(state.page, totalPages);
    const pageItems = filtered.slice((state.page - 1) * state.perPage, state.page * state.perPage);
    tbody.replaceChildren(...pageItems.map((item) => {
      const tr = document.createElement("tr");
      const cells = [
        new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(Finance.parseDate(item.data)),
        item.tipo,
        item.tipo === "entrada" ? item.cliente : item.descricao,
        item.tipo === "entrada" ? item.servico : item.categoria,
        item.formaPagamento,
        `${item.tipo === "entrada" ? "+" : "-"} ${Finance.money(item.valor)}`
      ];
      cells.forEach((value, index) => {
        const td = document.createElement("td");
        if (index === 1) {
          const badge = document.createElement("span");
          badge.className = `badge ${item.tipo}`;
          badge.textContent = item.tipo === "entrada" ? "Entrada" : "Saída";
          td.append(badge);
        } else {
          td.textContent = value;
          if (index === 5) td.className = item.tipo === "entrada" ? "amount income" : "amount expense";
        }
        tr.append(td);
      });
      const actions = document.createElement("td");
      const wrap = document.createElement("div");
      wrap.className = "row-actions";
      [
        ["Ver", () => showDetails(item)],
        ["Editar", () => openTransaction(item)],
        ["Excluir", () => deleteItem(item.id)]
      ].forEach(([label, handler]) => {
        const button = document.createElement("button");
        button.className = label === "Excluir" ? "button danger" : "button ghost";
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", handler);
        wrap.append(button);
      });
      actions.append(wrap);
      tr.append(actions);
      return tr;
    }));
    if (!pageItems.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 7;
      td.textContent = "Nenhum lançamento encontrado.";
      tr.append(td);
      tbody.append(tr);
    }
    document.getElementById("pageInfo").textContent = `Página ${state.page} de ${totalPages}`;
    document.getElementById("prevPage").disabled = state.page <= 1;
    document.getElementById("nextPage").disabled = state.page >= totalPages;
  }

  function showDetails(item) {
    const rows = [
      ["Data", new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(Finance.parseDate(item.data))],
      ["Tipo", item.tipo === "entrada" ? "Entrada" : "Saída"],
      [item.tipo === "entrada" ? "Cliente" : "Descrição", item.tipo === "entrada" ? item.cliente : item.descricao],
      ["Serviço/Categoria", item.tipo === "entrada" ? item.servico : item.categoria],
      ["Categoria", item.categoria],
      ["Fornecedor", item.fornecedor || "-"],
      ["Pagamento", item.formaPagamento],
      ["Valor", Finance.money(item.valor)],
      ["Observações", item.observacoes || "-"]
    ];
    const box = document.getElementById("detailsContent");
    box.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement("div");
      const span = document.createElement("span");
      const strong = document.createElement("strong");
      span.textContent = label;
      strong.textContent = value;
      row.append(span, strong);
      return row;
    }));
    App.openModal("detailsModal");
  }

  function deleteItem(id) {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    Store.deleteTransaction(id);
    App.toast("Lançamento excluído.");
    App.refresh();
  }

  function addMassRow(values = {}) {
    const rows = document.getElementById("massRows");
    const row = document.createElement("div");
    row.className = "mass-row";
    row.innerHTML = `<label>Cliente *<input data-mass="cliente" autocomplete="off" value="${values.cliente || ""}"></label><label>Serviço<input data-mass="servico" autocomplete="off" value="${values.servico || ""}"></label><label>Valor *<input data-mass="valor" inputmode="decimal" placeholder="R$ 0,00" value="${values.valor || ""}"></label><button class="button ghost" type="button" aria-label="Remover linha">Remover</button>`;
    row.querySelector("button").addEventListener("click", () => {
      if (rows.children.length > 1) row.remove();
    });
    rows.append(row);
  }

  function openMass() {
    document.getElementById("massDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("massError").textContent = "";
    const rows = document.getElementById("massRows");
    rows.replaceChildren();
    addMassRow();
    addMassRow();
    App.openModal("massModal");
  }

  function saveMass() {
    const date = formValue("massDate");
    const rows = [...document.querySelectorAll(".mass-row")];
    const entries = rows.map((row) => ({
      tipo: "entrada",
      data: date,
      cliente: row.querySelector('[data-mass="cliente"]').value.trim(),
      servico: row.querySelector('[data-mass="servico"]').value.trim(),
      valor: numberFromCurrency(row.querySelector('[data-mass="valor"]').value),
      categoria: "Outros",
      formaPagamento: "Outros",
      observacoes: "Lançamento em massa"
    })).filter((item) => item.cliente || item.valor);
    try {
      if (!date) throw new Error("Informe a data dos atendimentos.");
      if (!entries.length) throw new Error("Adicione pelo menos um atendimento.");
      if (entries.some((item) => !item.cliente || !Number.isFinite(item.valor) || item.valor <= 0)) throw new Error("Preencha cliente e valor em todas as linhas usadas.");
      entries.forEach((item) => Store.addTransaction(item));
      App.closeModals();
      App.toast(`${entries.length} lançamentos salvos com sucesso.`);
      App.refresh();
    } catch (error) {
      document.getElementById("massError").textContent = error.message;
    }
  }

  function renderCategories() {
    const data = Store.getState();
    refreshFormOptions(document.querySelector("[name='tipo']:checked")?.value || "entrada");
    [
      ["incomeCategories", "incomeCategories"],
      ["expenseCategories", "expenseCategories"],
      ["paymentMethods", "paymentMethods"]
    ].forEach(([listName, targetId]) => {
      const target = document.getElementById(targetId);
      target.replaceChildren(...data[listName].map((item) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        const text = document.createElement("span");
        const remove = document.createElement("button");
        text.textContent = item;
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remover ${item}`);
        remove.addEventListener("click", () => {
          Store.removeListItem(listName, item);
          App.refresh();
        });
        tag.append(text, remove);
        return tag;
      }));
    });
  }

  function initTransactions() {
    document.getElementById("transactionForm").addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const id = formValue("transactionId");
        if (id) Store.updateTransaction(id, readForm());
        else Store.addTransaction(readForm());
        App.closeModals();
        App.toast("Lançamento salvo com sucesso.");
        App.refresh();
      } catch (error) {
        document.getElementById("formError").textContent = error.message;
      }
    });
    document.querySelectorAll("[name='tipo']").forEach((radio) => radio.addEventListener("change", () => setType(radio.value)));
    document.getElementById("valor").addEventListener("blur", (event) => {
      const value = numberFromCurrency(event.target.value);
      if (Number.isFinite(value) && value > 0) event.target.value = Finance.money(value);
    });
    document.getElementById("addMassRow").addEventListener("click", () => addMassRow());
    document.getElementById("saveMass").addEventListener("click", saveMass);
    ["searchInput", "filterDate", "filterType", "filterCategory", "filterPayment", "sortSelect"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => { state.page = 1; renderTable(); });
    });
    document.getElementById("prevPage").addEventListener("click", () => { state.page -= 1; renderTable(); });
    document.getElementById("nextPage").addEventListener("click", () => { state.page += 1; renderTable(); });
    document.querySelectorAll("[data-category-form]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const map = { income: "incomeCategories", expense: "expenseCategories", payment: "paymentMethods" };
        Store.addListItem(map[form.dataset.categoryForm], form.querySelector("input").value);
        form.reset();
        App.refresh();
      });
    });
  }

  window.Transactions = { initTransactions, renderTable, renderCategories, openTransaction, openMass };
})();
