# Controle Financeiro - Rayssa Studio da Beleza

Aplicação web em HTML, CSS e JavaScript para controle financeiro local de salão de beleza.

## Como usar

Abra `index.html` no navegador. A aplicação salva os dados no `localStorage`, então os lançamentos permanecem após atualizar a página no mesmo navegador.

## Deploy no Vercel

O projeto já inclui `vercel.json` para publicação estática. No Vercel, use **Framework Preset: Other** e faça o deploy da pasta completa do projeto ou diretamente desta pasta. Não envie apenas os arquivos HTML: as pastas `assets`, `css` e `js` também são necessárias.

## Recursos

- Cadastro, edição, visualização e exclusão de entradas e saídas.
- Lançamentos em massa para registrar vários atendimentos do mesmo dia.
- Exclusão de todos os lançamentos com confirmação de segurança.
- Identidade visual Rayssa Studio da Beleza aplicada na navegação e nos relatórios.
- Filtros por hoje, semana, mês, ano e período personalizado.
- Dashboard com entradas, saídas, saldo, atendimentos e ticket médio.
- Gráficos em Canvas, sem dependência externa obrigatória.
- Relatórios semanal, mensal, anual e personalizado em PDF gerado localmente, com logo, cartões de resumo, indicadores e rodapé paginado.
- Página HTML de resumo por período, com indicadores, tabela detalhada, impressão e download autônomo.
- Categorias e formas de pagamento editáveis.
- Exportação e importação de backup em JSON.
- Dados fictícios de demonstração.

## Bibliotecas externas

A interface usa `font-family: Montserrat`, com fallback para fontes do sistema caso a fonte não esteja instalada. A versão entregue não depende de CDN para funcionar localmente.

## Estrutura

```text
/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── storage.js
│   ├── dashboard.js
│   ├── lancamentos.js
│   ├── relatorios.js
│   └── pdf.js
├── assets/
└── README.md
```

## Expansão futura

A separação dos módulos facilita evoluir para backend, Supabase/Firebase, autenticação, multiusuário, agenda, clientes, estoque, comissões e contas a pagar/receber.
