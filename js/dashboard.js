(function () {
  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const DATE = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
  const charts = {};

  function money(value) { return BRL.format(value || 0); }
  function parseDate(value) { return new Date(`${value}T00:00:00`); }
  function iso(date) { return date.toISOString().slice(0, 10); }
  function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d;
  }
  function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function periodRange(kind, customStart, customEnd, base = new Date()) {
    const start = new Date(base);
    const end = new Date(base);
    if (kind === "today") return { start, end, label: "Hoje" };
    if (kind === "week") return { start: startOfWeek(base), end, label: "Esta semana" };
    if (kind === "year") return { start: new Date(base.getFullYear(), 0, 1), end, label: "Este ano" };
    if (kind === "custom" && customStart && customEnd) return { start: parseDate(customStart), end: parseDate(customEnd), label: `${DATE.format(parseDate(customStart))} a ${DATE.format(parseDate(customEnd))}` };
    return { start: new Date(base.getFullYear(), base.getMonth(), 1), end, label: "Este mês" };
  }

  function previousRange(range) {
    const days = Math.max(1, Math.round((endOfDay(range.end) - range.start) / 86400000) + 1);
    const end = new Date(range.start);
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - days + 1);
    return { start, end };
  }

  function filterByRange(transactions, range) {
    const start = parseDate(iso(range.start));
    const end = endOfDay(range.end);
    return transactions.filter((item) => {
      const date = parseDate(item.data);
      return date >= start && date <= end;
    });
  }

  function totals(transactions) {
    const entradas = transactions.filter((item) => item.tipo === "entrada");
    const saidas = transactions.filter((item) => item.tipo === "saida");
    const totalEntradas = entradas.reduce((sum, item) => sum + Number(item.valor), 0);
    const totalSaidas = saidas.reduce((sum, item) => sum + Number(item.valor), 0);
    const atendimentos = entradas.length;
    return {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      atendimentos,
      ticketMedio: atendimentos ? totalEntradas / atendimentos : 0,
      entradas,
      saidas
    };
  }

  function groupSum(items, key) {
    return items.reduce((acc, item) => {
      const label = item[key] || "Não informado";
      acc[label] = (acc[label] || 0) + Number(item.valor);
      return acc;
    }, {});
  }

  function topKey(map) {
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return entries[0] ? entries[0][0] : "Sem dados";
  }

  function trend(current, previous) {
    if (!previous && !current) return "0%";
    if (!previous) return "+100%";
    const diff = ((current - previous) / previous) * 100;
    return `${diff >= 0 ? "+" : ""}${diff.toFixed(1).replace(".", ",")}%`;
  }

  function byDateSeries(transactions) {
    const days = {};
    transactions.forEach((item) => {
      if (!days[item.data]) days[item.data] = { entrada: 0, saida: 0 };
      days[item.data][item.tipo] += Number(item.valor);
    });
    const labels = Object.keys(days).sort();
    let balance = 0;
    return {
      labels: labels.map((label) => DATE.format(parseDate(label))),
      entradas: labels.map((label) => days[label].entrada),
      saidas: labels.map((label) => days[label].saida),
      saldo: labels.map((label) => {
        balance += days[label].entrada - days[label].saida;
        return balance;
      })
    };
  }

  function chart(id, type, data, options = {}) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (!window.Chart) {
      drawNativeChart(canvas, type, data);
      return;
    }
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(canvas, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { font: { family: "Montserrat" } } } },
        scales: type === "doughnut" ? undefined : { y: { beginAtZero: true } },
        ...options
      }
    });
  }

  function drawNativeChart(canvas, type, data) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width || canvas.parentElement.clientWidth || 520));
    const height = 280;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, width, height);
    ctx.font = "12px Montserrat, Arial, sans-serif";
    ctx.fillStyle = "#766b64";
    const colors = ["#615249", "#cab3a2", "#28765a", "#a4423f", "#b17a2f", "#8b7d76", "#d8c8bd"];
    if (type === "doughnut") {
      const values = data.datasets[0].data;
      const total = values.reduce((a, b) => a + b, 0);
      if (!total) {
        ctx.fillText("Sem dados no período", 22, 35);
        return;
      }
      let angle = -Math.PI / 2;
      values.forEach((value, index) => {
        const slice = (value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(105, 120);
        ctx.arc(105, 120, 78, angle, angle + slice);
        ctx.fillStyle = colors[index % colors.length];
        ctx.fill();
        angle += slice;
      });
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(105, 120, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      data.labels.forEach((label, index) => {
        const y = 42 + index * 22;
        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(220, y - 10, 12, 12);
        ctx.fillStyle = "#2f2926";
        ctx.fillText(`${label}: ${money(values[index])}`, 240, y);
      });
      return;
    }
    const datasets = data.datasets;
    const max = Math.max(1, ...datasets.flatMap((dataset) => dataset.data));
    ctx.strokeStyle = "#e8ddd6";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = 230 - i * 45;
      ctx.beginPath();
      ctx.moveTo(42, y);
      ctx.lineTo(width - 20, y);
      ctx.stroke();
    }
    if (type === "line") {
      const values = datasets[0].data;
      const step = values.length > 1 ? (width - 80) / (values.length - 1) : 0;
      ctx.strokeStyle = datasets[0].borderColor || "#615249";
      ctx.fillStyle = "rgba(202,179,162,.22)";
      ctx.beginPath();
      values.forEach((value, index) => {
        const x = 46 + index * step;
        const y = 230 - (value / max) * 180;
        if (index) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      values.forEach((value, index) => {
        const x = 46 + index * step;
        const y = 230 - (value / max) * 180;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#615249";
        ctx.fill();
      });
    } else {
      const labels = data.labels.length || 1;
      const groupWidth = (width - 80) / labels;
      datasets.forEach((dataset, datasetIndex) => {
        dataset.data.forEach((value, index) => {
          const barWidth = Math.max(12, groupWidth / (datasets.length + 1));
          const x = 48 + index * groupWidth + datasetIndex * barWidth;
          const h = (value / max) * 180;
          ctx.fillStyle = dataset.backgroundColor || colors[datasetIndex];
          ctx.fillRect(x, 230 - h, barWidth - 4, h);
        });
      });
    }
    data.labels.slice(0, 8).forEach((label, index) => {
      const x = 48 + index * ((width - 80) / Math.max(1, data.labels.length));
      ctx.fillStyle = "#766b64";
      ctx.fillText(label.slice(0, 10), x, 252);
    });
    datasets.forEach((dataset, index) => {
      ctx.fillStyle = dataset.backgroundColor || dataset.borderColor || colors[index];
      ctx.fillRect(42 + index * 120, 18, 12, 12);
      ctx.fillStyle = "#2f2926";
      ctx.fillText(dataset.label, 60 + index * 120, 29);
    });
  }

  function renderDashboard(transactions, range) {
    const filtered = filterByRange(transactions, range);
    const current = totals(filtered);
    const prev = totals(filterByRange(transactions, previousRange(range)));
    const set = (id, value) => { document.getElementById(id).textContent = value; };
    set("kpiEntradas", money(current.totalEntradas));
    set("kpiSaidas", money(current.totalSaidas));
    set("kpiSaldo", money(current.saldo));
    set("kpiAtendimentos", current.atendimentos);
    set("kpiTicket", money(current.ticketMedio));
    [
      ["trendEntradas", current.totalEntradas, prev.totalEntradas],
      ["trendSaidas", current.totalSaidas, prev.totalSaidas],
      ["trendSaldo", current.saldo, prev.saldo],
      ["trendAtendimentos", current.atendimentos, prev.atendimentos]
    ].forEach(([id, now, before]) => {
      const el = document.getElementById(id);
      const text = trend(now, before);
      el.textContent = text;
      el.className = text.startsWith("-") ? "down" : "up";
    });

    const serviceMap = groupSum(current.entradas, "servico");
    const incomeCategory = groupSum(current.entradas, "categoria");
    const expenseCategory = groupSum(current.saidas, "categoria");
    const payments = groupSum(current.entradas, "formaPagamento");
    const biggestIncome = current.entradas.slice().sort((a, b) => b.valor - a.valor)[0];
    const biggestExpense = current.saidas.slice().sort((a, b) => b.valor - a.valor)[0];
    const summary = [
      ["Total de entradas", money(current.totalEntradas)],
      ["Total de saídas", money(current.totalSaidas)],
      ["Saldo", money(current.saldo)],
      ["Número de atendimentos", current.atendimentos],
      ["Ticket médio", money(current.ticketMedio)],
      ["Maior entrada", biggestIncome ? `${biggestIncome.servico} (${money(biggestIncome.valor)})` : "Sem dados"],
      ["Maior despesa", biggestExpense ? `${biggestExpense.descricao} (${money(biggestExpense.valor)})` : "Sem dados"],
      ["Serviço mais vendido", topKey(groupSum(current.entradas, "servico"))],
      ["Categoria que mais faturou", topKey(incomeCategory)],
      ["Categoria que mais gerou despesas", topKey(expenseCategory)],
      ["Pagamento mais utilizado", topKey(payments)]
    ];
    const summaryList = document.getElementById("summaryList");
    summaryList.replaceChildren(...summary.map(([label, value]) => {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      row.append(dt, dd);
      return row;
    }));

    const recentList = document.getElementById("recentList");
    recentList.replaceChildren(...filtered.slice().sort((a, b) => b.data.localeCompare(a.data)).slice(0, 6).map((item) => {
      const row = document.createElement("div");
      row.className = "compact-row";
      const left = document.createElement("div");
      const right = document.createElement("strong");
      left.innerHTML = "";
      const title = document.createElement("strong");
      const subtitle = document.createElement("span");
      title.textContent = item.tipo === "entrada" ? item.cliente : item.descricao;
      subtitle.textContent = `${DATE.format(parseDate(item.data))} · ${item.categoria}`;
      left.append(title, document.createElement("br"), subtitle);
      right.textContent = `${item.tipo === "entrada" ? "+" : "-"} ${money(item.valor)}`;
      right.className = item.tipo === "entrada" ? "amount income" : "amount expense";
      row.append(left, right);
      return row;
    }));

    const series = byDateSeries(filtered);
    const colors = ["#615249", "#cab3a2", "#28765a", "#a4423f", "#b17a2f", "#8b7d76", "#d8c8bd"];
    chart("cashFlowChart", "bar", { labels: series.labels, datasets: [{ label: "Entradas", data: series.entradas, backgroundColor: "#28765a" }, { label: "Saídas", data: series.saidas, backgroundColor: "#a4423f" }] });
    chart("incomeCategoryChart", "doughnut", { labels: Object.keys(incomeCategory), datasets: [{ data: Object.values(incomeCategory), backgroundColor: colors }] });
    chart("expenseCategoryChart", "doughnut", { labels: Object.keys(expenseCategory), datasets: [{ data: Object.values(expenseCategory), backgroundColor: colors.slice().reverse() }] });
    chart("paymentChart", "doughnut", { labels: Object.keys(payments), datasets: [{ data: Object.values(payments), backgroundColor: colors }] });
    chart("balanceChart", "line", { labels: series.labels, datasets: [{ label: "Saldo", data: series.saldo, borderColor: "#615249", backgroundColor: "rgba(202,179,162,.26)", fill: true, tension: .35 }] });
  }

  window.Finance = { money, parseDate, iso, periodRange, previousRange, filterByRange, totals, groupSum, topKey, renderDashboard };
})();
