# Estoque Webapp

Sistema web com foco em gerenciamento operacional de estoque, possui ferramentas para dar movimentações, ordens de serviço, motores, Controle de EPIs, destinos e fechamento mensal.

O projeto usa um frontend em Vue 3 com Vite e uma API Express com SQLite. O foco é uso interno/industrial: cadastro de materiais, busca por hierarquia, entradas, saídas, histórico, controle por destino e gestão de OS.

## Tecnologias

- Vue 3
- Vite
- Tailwind CSS
- Express
- SQLite com `better-sqlite3`
- Autenticação por sessão com cookie `httpOnly`

## Bancos separados

O projeto usa arquivos `.env` para separar banco de desenvolvimento e produção.

- `.env.dev`: banco de desenvolvimento.
- `.env.prod`: banco de produção.
- `.env.example`: modelo versionado.

Scripts úteis:

```powershell
# Popular banco dev com seed
npm run db:seed:dev

# Limpar banco prod
npm run db:reset:prod
```

## Instalação

```powershell
git clone https://github.com/Darasukan/estoque-webapp.git
cd estoque-webapp
npm install
```

Crie seus arquivos de ambiente a partir do exemplo:

```powershell
copy .env.example .env.dev
copy .env.example .env.prod
```

Ajuste `DB_PATH` em cada arquivo para apontar para bancos diferentes.

## Rodando o sistema

### Desenvolvimento com Vite

Use dois terminais:

```powershell
# Terminal 1: API usando banco dev
npm run server:dev

# Terminal 2: frontend Vite
npm run dev
```

Acesse:

```text
http://localhost:5173
```

### Produção/local estável

```powershell
npm start master
```

Também existem aliases:

```powershell
npm run start:master
npm run start:prod
npm run start:dev
```

Observação: `npm start master` faz build e inicia o servidor usando `.env.prod`. `npm start dev` faz build e inicia usando `.env.dev`.

## Autenticação e permissões

- Usuário não logado pode visualizar áreas públicas.
- Usuário não logado não pode criar, editar, excluir, movimentar, ajustar estoque ou fechar período.
- Login usa sessão persistente por cookie `httpOnly`.
- Admin pode criar operadores.
- Admin mestre pode alterar senha de qualquer usuário.
- Usuário logado pode alterar a própria senha.
- Admin comum não pode excluir outro admin.

Login padrão em banco novo:

```text
admin / admin123
```

## Funcionalidades principais

- Dashboard operacional com alertas e atalhos.
- Catálogo por grupos, categorias, subcategorias, itens e variações.
- Cadastro e edição de hierarquia.
- Inventário com tabela, filtros, estoque mínimo, ajustes e ficha operacional da variação.
- Entrada e saída de materiais com lote de movimentações.
- Histórico de movimentações com busca única e filtros.
- Resumo por destino em blocos hierárquicos.
- Fechamento mensal de estoque com exportação CSV.
- Ordens de serviço comuns e ordens de serviço de motor.
- Exportação CSV de OS individual, filtrada ou completa.
- Motores com eventos, histórico, OS vinculadas e materiais previstos/usados.
- Cadastros auxiliares: pessoas, cargos, destinos, locais, fornecedores, usuários e EPIs.
- Controle de EPIs por cargo, periodicidade e pessoa.
- Atalhos de teclado e popup de ajuda com `?`.

## Seed e ferramentas de teste

Botões de `Popular` e `Limpar` aparecem somente quando:

```text
VITE_ENABLE_SEED_TOOLS=true
```

Isso deve ficar ligado no ambiente dev e desligado no ambiente master.

Mesmo se a branch `dev` for mesclada na `master`, a exibição desses botões depende do `.env` usado no build.

## Estrutura

```text
server/
  index.js                  API Express
  db.js                     schema SQLite, migrações e conexão
  backup.js                 rotina de backup
  middleware/
    auth.js                 proteção por sessão/role
  routes/
    auth.js                 login, logout e usuários
    items.js                itens e variações
    movements.js            entradas, saídas e histórico
    destinations.js         destinos
    locations.js            locais
    people.js               pessoas
    suppliers.js            fornecedores
    roles.js                cargos
    epis.js                 EPIs
    motors.js               motores
    workOrders.js           ordens de serviço
    closings.js             fechamento
    seed.js                 seed e ordem de exibição
  scripts/
    start.js                start por ambiente
    seedDatabase.js         seed/reset por ambiente

src/
  App.vue                   layout principal e navegação
  main.js                   entrada Vue
  style.css                 tema e estilos globais
  services/
    api.js                  cliente HTTP
  composables/              estados e regras por domínio
  components/
    ui/                     componentes comuns
    cadastros/              abas de cadastros
    inventario/             abas e painéis do inventário
    movements/              painéis de movimentações
  views/
    DashboardView.vue
    CatalogView.vue
    EditHierarchyView.vue
    InventarioView.vue
    MovimentacoesView.vue
    OrdensServicoView.vue
    MotoresView.vue
    CadastrosView.vue
```

## Scripts

```powershell
npm run dev             # Vite em modo dev
npm run build           # build frontend
npm run server          # API usando .env
npm run server:dev      # API usando .env.dev
npm run server:prod     # API usando .env.prod
npm start dev           # build + servidor dev
npm start master        # build + servidor prod/master
npm run db:seed:dev     # popula banco dev com seed
npm run db:reset:prod   # limpa banco prod
npm test                # testes node:test
```