(function () {
  function escapePdf(text) {
    return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[()\\]/g, "\\$&");
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function simplePdf(lines, filename) {
    const pageLines = [];
    for (let i = 0; i < lines.length; i += 38) pageLines.push(lines.slice(i, i + 38));
    const objects = [];
    const pages = [];
    const add = (body) => {
      objects.push(body);
      return objects.length;
    };
    const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    pageLines.forEach((chunk, pageIndex) => {
      let stream = "BT\n/F1 11 Tf\n50 790 Td\n";
      chunk.forEach((lineText, index) => {
        if (index) stream += "0 -18 Td\n";
        stream += `(${escapePdf(lineText)}) Tj\n`;
      });
      stream += `0 -28 Td\n/F1 9 Tf\n(Pagina ${pageIndex + 1} de ${pageLines.length}) Tj\nET`;
      const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      pages.push(add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    });
    const pagesId = objects.length + 1;
    pages.forEach((pageId) => {
      objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
    });
    add(`<< /Type /Pages /Kids [${pages.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((body, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
    downloadBlob(filename, bytes, "application/pdf");
  }

  function ascii(value) {
    return new TextEncoder().encode(value);
  }

  function joinBytes(parts) {
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    parts.forEach((part) => { output.set(part, offset); offset += part.length; });
    return output;
  }

  async function brandedPdf(type, data, filename) {
    let image = null;
    try {
      const response = await fetch("assets/logo-pdf.jpg");
      if (response.ok) image = new Uint8Array(await response.arrayBuffer());
    } catch { /* relatório continua disponível mesmo sem o logo */ }
    const titles = { weekly: "Relatório semanal", monthly: "Relatório mensal", yearly: "Relatório anual", custom: "Relatório personalizado" };
    const summary = [
      ["Entradas", Finance.money(data.totals.totalEntradas)],
      ["Saídas", Finance.money(data.totals.totalSaidas)],
      ["Saldo", Finance.money(data.totals.saldo)],
      ["Atendimentos", String(data.totals.atendimentos)],
      ["Ticket médio", Finance.money(data.totals.ticketMedio)]
    ];
    const lines = [
      titles[type] || "Relatório financeiro",
      `Período: ${labelRange(data.range)}`,
      `Gerado em: ${new Intl.DateTimeFormat("pt-BR").format(new Date())}`,
      "",
      "INDICADORES",
      `Serviço mais vendido: ${Finance.topKey(data.byService)}`,
      `Categoria que mais faturou: ${Finance.topKey(data.incomeByCategory)}`,
      `Categoria que mais gerou despesas: ${Finance.topKey(data.expenseByCategory)}`,
      `Pagamento mais utilizado: ${Finance.topKey(data.byPayment)}`,
      ...data.variations.map(([name, value]) => `${name}: ${value}`),
      "",
      "ENTRADAS"
    ];
    data.totals.entradas.forEach((item) => lines.push(`${item.data} | ${item.cliente} | ${item.servico || "-"} | ${Finance.money(item.valor)}`));
    lines.push("", "SAÍDAS");
    data.totals.saidas.forEach((item) => lines.push(`${item.data} | ${item.descricao || "-"} | ${item.categoria || "-"} | ${Finance.money(item.valor)}`));
    const chunks = [];
    for (let i = 0; i < lines.length; i += 35) chunks.push(lines.slice(i, i + 35));
    const objects = [];
    const add = (body) => { objects.push(body); return objects.length; };
    const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    let imageId = null;
    if (image) imageId = add({ dict: `<< /Type /XObject /Subtype /Image /Width 1290 /Height 707 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>`, bytes: image });
    const pageIds = [];
    const pagesId = objects.length + (chunks.length * 2) + 1;
    chunks.forEach((chunk, pageIndex) => {
      let stream = "q\n0.38 0.32 0.29 rg\n0 790 595 52 re f\n";
      if (imageId) stream += "q\n182 0 0 42 14 795 cm\n/Logo Do\nQ\n";
      stream += "BT\n/F1 11 Tf\n0.18 0.16 0.15 rg\n50 752 Td\n";
      if (pageIndex === 0) {
        stream += `(${escapePdf(titles[type] || "Relatório financeiro")}) Tj\n0 -18 Td\n/F1 9 Tf\n(${escapePdf(`Período: ${labelRange(data.range)}`)}) Tj\nET\n`;
        summary.forEach((card, index) => {
          const x = 50 + (index % 3) * 170;
          const y = 684 - Math.floor(index / 3) * 58;
          stream += `0.95 0.92 0.90 rg\n${x} ${y} 155 42 re f\n0.18 0.16 0.15 rg\nBT\n/F1 8 Tf\n${x + 8} ${y + 27} Td\n(${escapePdf(card[0])}) Tj\n0 -14 Td\n/F1 12 Tf\n(${escapePdf(card[1])}) Tj\nET\n`;
        });
        stream += "BT\n/F1 10 Tf\n50 560 Td\n";
        chunk.slice(4).forEach((line, index) => { if (index) stream += "0 -17 Td\n"; stream += `(${escapePdf(line)}) Tj\n`; });
        stream += "ET\n";
      } else {
        chunk.forEach((line, index) => { if (index) stream += "0 -17 Td\n"; stream += `(${escapePdf(line)}) Tj\n`; });
        stream += "ET\n";
      }
      stream += `0.8 0.7 0.64 RG\n50 32 m 545 32 l S\nBT\n/F1 8 Tf\n0.46 0.42 0.39 rg\n50 20 Td\n(${escapePdf(`Rayssa Studio da Beleza · Página ${pageIndex + 1} de ${chunks.length}`)}) Tj\nET\n`;
      const contentId = add({ dict: `<< /Length ${new TextEncoder().encode(stream).length} >>`, bytes: ascii(stream) });
      const resources = imageId ? `/Resources << /Font << /F1 ${fontId} 0 R >> /XObject << /Logo ${imageId} 0 R >> >>` : `/Resources << /Font << /F1 ${fontId} 0 R >> >>`;
      pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] ${resources} /Contents ${contentId} 0 R >>`));
    });
    add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    const parts = [ascii("%PDF-1.4\n")];
    const offsets = [0];
    let total = parts[0].length;
    objects.forEach((object, index) => {
      offsets.push(total);
      const body = typeof object === "string" ? ascii(object) : joinBytes([ascii(object.dict + "\nstream\n"), object.bytes, ascii("\nendstream")]);
      const part = joinBytes([ascii(`${index + 1} 0 obj\n`), body, ascii("\nendobj\n")]);
      parts.push(part); total += part.length;
    });
    const xrefOffset = total;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => { xref += `${String(offset).padStart(10, "0")} 00000 n \n`; });
    xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    parts.push(ascii(xref));
    downloadBlob(filename, joinBytes(parts), "application/pdf");
  }

  function generateNativePdf(type, data) {
    const titles = { weekly: "Relatorio semanal", monthly: "Relatorio mensal", yearly: "Relatorio anual", custom: "Relatorio personalizado" };
    brandedPdf(type, data, `rayssa-studio-${type}-${Date.now()}.pdf`);
  }

  function labelRange(range) {
    const fmt = new Intl.DateTimeFormat("pt-BR");
    return `${fmt.format(range.start)} a ${fmt.format(range.end)}`;
  }

  function line(doc, y) {
    doc.setDrawColor(202, 179, 162);
    doc.line(14, y, 196, y);
  }

  function ensurePage(doc, y) {
    if (y < 278) return y;
    footer(doc);
    doc.addPage();
    header(doc, "Controle Financeiro", "");
    return 40;
  }

  function header(doc, title, period) {
    doc.setFillColor(97, 82, 73);
    doc.rect(0, 0, 210, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Rayssa Studio da Beleza", 14, 13);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(title, 14, 21);
    doc.text(period, 140, 21, { align: "left" });
    doc.setTextColor(47, 41, 38);
  }

  function footer(doc) {
    const page = doc.internal.getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(118, 107, 100);
    line(doc, 286);
    doc.text(`Gerado em ${new Intl.DateTimeFormat("pt-BR").format(new Date())}`, 14, 292);
    doc.text(`Página ${page}`, 196, 292, { align: "right" });
  }

  function sectionTitle(doc, title, y) {
    y = ensurePage(doc, y + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(97, 82, 73);
    doc.text(title, 14, y);
    line(doc, y + 3);
    return y + 10;
  }

  function table(doc, columns, rows, y) {
    doc.setFontSize(8);
    doc.setTextColor(47, 41, 38);
    const widths = columns.map((col) => col.width);
    const total = widths.reduce((a, b) => a + b, 0);
    const scale = 182 / total;
    const scaled = widths.map((w) => w * scale);
    y = ensurePage(doc, y);
    doc.setFillColor(243, 235, 230);
    doc.rect(14, y - 5, 182, 8, "F");
    let x = 16;
    columns.forEach((col, index) => {
      doc.setFont("helvetica", "bold");
      doc.text(col.label, x, y);
      x += scaled[index];
    });
    y += 8;
    rows.forEach((row) => {
      y = ensurePage(doc, y);
      x = 16;
      columns.forEach((col, index) => {
        doc.setFont("helvetica", "normal");
        const text = doc.splitTextToSize(String(row[col.key] || "-"), scaled[index] - 4);
        doc.text(text.slice(0, 2), x, y);
        x += scaled[index];
      });
      y += 9;
    });
    return y;
  }

  function summaryGrid(doc, data, y) {
    const cards = [
      ["Entradas", Finance.money(data.totals.totalEntradas)],
      ["Saídas", Finance.money(data.totals.totalSaidas)],
      ["Saldo", Finance.money(data.totals.saldo)],
      ["Atendimentos", data.totals.atendimentos],
      ["Ticket médio", Finance.money(data.totals.ticketMedio)]
    ];
    cards.forEach((card, index) => {
      const x = 14 + (index % 2) * 92;
      const yy = y + Math.floor(index / 2) * 22;
      doc.setDrawColor(232, 221, 214);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, yy, 86, 16, 2, 2, "FD");
      doc.setFontSize(8);
      doc.setTextColor(118, 107, 100);
      doc.text(card[0], x + 4, yy + 6);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(47, 41, 38);
      doc.text(String(card[1]), x + 4, yy + 12);
      doc.setFont("helvetica", "normal");
    });
    return y + 58;
  }

  function keyValueTable(doc, title, map, y) {
    y = sectionTitle(doc, title, y);
    const rows = Object.entries(map).map(([nome, valor]) => ({ nome, valor: Finance.money(valor) }));
    return table(doc, [{ label: "Item", key: "nome", width: 130 }, { label: "Valor", key: "valor", width: 52 }], rows.length ? rows : [{ nome: "Sem dados", valor: "-" }], y);
  }

  function generate(type = "monthly", customRange) {
    const data = Reports.reportData(type, customRange);
    if (!window.jspdf) {
      generateNativePdf(type, data);
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const titles = { weekly: "Relatório semanal", monthly: "Relatório mensal", yearly: "Relatório anual", custom: "Relatório personalizado" };
    header(doc, titles[type] || "Relatório financeiro", labelRange(data.range));
    let y = 42;
    doc.setFontSize(10);
    doc.setTextColor(118, 107, 100);
    doc.text(`Período analisado: ${labelRange(data.range)}`, 14, y);
    y = summaryGrid(doc, data, y + 8);

    y = sectionTitle(doc, "Indicadores", y);
    y = table(doc, [{ label: "Indicador", key: "name", width: 120 }, { label: "Resultado", key: "value", width: 62 }], [
      { name: "Serviço mais vendido", value: Finance.topKey(data.byService) },
      { name: "Categoria que mais faturou", value: Finance.topKey(data.incomeByCategory) },
      { name: "Categoria que mais gerou despesas", value: Finance.topKey(data.expenseByCategory) },
      { name: "Forma de pagamento mais utilizada", value: Finance.topKey(data.byPayment) },
      ...data.variations.map(([name, value]) => ({ name, value }))
    ], y);

    y = sectionTitle(doc, "Entradas", y);
    y = table(doc, [
      { label: "Data", key: "data", width: 24 },
      { label: "Cliente", key: "cliente", width: 42 },
      { label: "Serviço", key: "servico", width: 48 },
      { label: "Categoria", key: "categoria", width: 32 },
      { label: "Pagamento", key: "formaPagamento", width: 28 },
      { label: "Valor", key: "valorText", width: 24 }
    ], data.totals.entradas.map((item) => ({ ...item, data: new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(Finance.parseDate(item.data)), valorText: Finance.money(item.valor) })), y);

    y = sectionTitle(doc, "Saídas", y);
    y = table(doc, [
      { label: "Data", key: "data", width: 24 },
      { label: "Descrição", key: "descricao", width: 52 },
      { label: "Categoria", key: "categoria", width: 34 },
      { label: "Fornecedor", key: "fornecedor", width: 36 },
      { label: "Pagamento", key: "formaPagamento", width: 28 },
      { label: "Valor", key: "valorText", width: 24 }
    ], data.totals.saidas.map((item) => ({ ...item, data: new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(Finance.parseDate(item.data)), valorText: Finance.money(item.valor) })), y);

    y = keyValueTable(doc, "Resumo por categoria de entrada", data.incomeByCategory, y);
    y = keyValueTable(doc, "Resumo por categoria de saída", data.expenseByCategory, y);
    keyValueTable(doc, "Resumo por forma de pagamento", data.byPayment, y);

    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i += 1) {
      doc.setPage(i);
      footer(doc);
    }
    doc.save(`rayssa-studio-${type}-${Date.now()}.pdf`);
  }

  window.PDF = { generate };
})();
