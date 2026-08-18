(function () {
  const KEY = "rayssaFinanceiro.v1";
  const DEFAULTS = {
    incomeCategories: ["Cabelo", "Manicure", "Pedicure", "Alongamento de unhas", "Sobrancelhas", "Maquiagem", "Estética", "Tratamentos", "Outros"],
    expenseCategories: ["Produtos", "Materiais", "Salários", "Comissões", "Aluguel", "Energia", "Água", "Internet", "Marketing", "Manutenção", "Equipamentos", "Impostos", "Serviços terceirizados", "Outros"],
    paymentMethods: ["Dinheiro", "Pix", "Débito", "Crédito", "Transferência", "Outros"],
    transactions: [],
    demoLoaded: false
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULTS);
      const data = JSON.parse(raw);
      return { ...clone(DEFAULTS), ...data };
    } catch {
      return clone(DEFAULTS);
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function uid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function validateTransaction(item) {
    const errors = [];
    if (!["entrada", "saida"].includes(item.tipo)) errors.push("Tipo inválido.");
    if (!item.data || Number.isNaN(new Date(`${item.data}T00:00:00`).getTime())) errors.push("Data inválida.");
    if (!Number.isFinite(item.valor) || item.valor <= 0) errors.push("Valor obrigatório e maior que zero.");
    if (item.tipo === "entrada" && !item.cliente) errors.push("Cliente é obrigatório para entradas.");
    return errors;
  }

  function getDemoTransactions() {
    const today = new Date();
    const iso = (offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    return [
      { tipo: "entrada", data: iso(-1), cliente: "Maria Silva", servico: "Corte + Escova", categoria: "Cabelo", formaPagamento: "Pix", valor: 180, observacoes: "Cliente recorrente" },
      { tipo: "entrada", data: iso(-2), cliente: "Juliana Rocha", servico: "Manicure gel", categoria: "Manicure", formaPagamento: "Crédito", valor: 95, observacoes: "Demonstração" },
      { tipo: "entrada", data: iso(-4), cliente: "Ana Paula", servico: "Design de sobrancelhas", categoria: "Sobrancelhas", formaPagamento: "Dinheiro", valor: 70, observacoes: "Demonstração" },
      { tipo: "entrada", data: iso(-8), cliente: "Bianca Costa", servico: "Maquiagem social", categoria: "Maquiagem", formaPagamento: "Pix", valor: 220, observacoes: "Demonstração" },
      { tipo: "entrada", data: iso(-16), cliente: "Carla Lima", servico: "Tratamento capilar", categoria: "Tratamentos", formaPagamento: "Débito", valor: 260, observacoes: "Demonstração" },
      { tipo: "saida", data: iso(-1), descricao: "Reposição de esmaltes", categoria: "Produtos", fornecedor: "Beauty Supply", formaPagamento: "Pix", valor: 140, observacoes: "Demonstração" },
      { tipo: "saida", data: iso(-3), descricao: "Impulsionamento Instagram", categoria: "Marketing", fornecedor: "Meta", formaPagamento: "Crédito", valor: 80, observacoes: "Demonstração" },
      { tipo: "saida", data: iso(-10), descricao: "Conta de energia", categoria: "Energia", fornecedor: "Concessionária", formaPagamento: "Transferência", valor: 210, observacoes: "Demonstração" },
      { tipo: "saida", data: iso(-22), descricao: "Materiais descartáveis", categoria: "Materiais", fornecedor: "Distribuidora Bella", formaPagamento: "Débito", valor: 120, observacoes: "Demonstração" }
    ].map((item) => ({ id: uid(), demo: true, ...item }));
  }

  window.Store = {
    getState: load,
    setState: save,
    reset() { save(clone(DEFAULTS)); },
    addTransaction(item) {
      const data = load();
      const transaction = { id: uid(), observacoes: "", fornecedor: "", cliente: "", servico: "", descricao: "", categoria: "Outros", formaPagamento: "Outros", ...item };
      const errors = validateTransaction(transaction);
      if (errors.length) throw new Error(errors.join(" "));
      data.transactions.unshift(transaction);
      save(data);
      return transaction;
    },
    updateTransaction(id, patch) {
      const data = load();
      const index = data.transactions.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("Lançamento não encontrado.");
      const updated = { ...data.transactions[index], ...patch };
      const errors = validateTransaction(updated);
      if (errors.length) throw new Error(errors.join(" "));
      data.transactions[index] = updated;
      save(data);
      return updated;
    },
    deleteTransaction(id) {
      const data = load();
      data.transactions = data.transactions.filter((item) => item.id !== id);
      save(data);
    },
    clearTransactions() {
      const data = load();
      data.transactions = [];
      data.demoLoaded = false;
      save(data);
    },
    addListItem(listName, value) {
      const data = load();
      const text = String(value || "").trim();
      if (!text) throw new Error("Informe um nome.");
      if (!data[listName].some((item) => item.toLowerCase() === text.toLowerCase())) data[listName].push(text);
      save(data);
    },
    removeListItem(listName, value) {
      const data = load();
      data[listName] = data[listName].filter((item) => item !== value);
      save(data);
    },
    loadDemo() {
      const data = load();
      data.transactions = data.transactions.filter((item) => !item.demo).concat(getDemoTransactions());
      data.demoLoaded = true;
      save(data);
    },
    clearDemo() {
      const data = load();
      data.transactions = data.transactions.filter((item) => !item.demo);
      data.demoLoaded = false;
      save(data);
    },
    exportJson() {
      return JSON.stringify(load(), null, 2);
    },
    importJson(json) {
      const imported = JSON.parse(json);
      if (!imported || !Array.isArray(imported.transactions)) throw new Error("Arquivo inválido.");
      const data = {
        ...clone(DEFAULTS),
        ...imported,
        transactions: imported.transactions.map((item) => ({ ...item, id: item.id || uid(), valor: Number(item.valor) }))
      };
      data.transactions.forEach((item) => {
        const errors = validateTransaction(item);
        if (errors.length) throw new Error(`Registro inválido: ${errors.join(" ")}`);
      });
      save(data);
    }
  };
})();
