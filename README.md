# Estoque App

Sistema de controle de estoque industrial com catálogo estilo McMaster-Carr, filtros facetados, hierarquia de itens e gestão de variações.

## Tecnologias

- **Vue.js 3** (Composition API, `<script setup>`)
- **Vite** (build tool)
- **Tailwind CSS v4** (estilização)
- **localStorage** (persistência de dados)

## Funcionalidades

- **Catálogo** — Navegação por grupos com filtros facetados na sidebar, busca por nome/categoria/subcategoria, visualização de variações e estoque
- **Cadastro** — Criação de itens com hierarquia (Grupo → Categoria → Subcategoria), atributos dinâmicos e variações
- **Editar Hierarquia** — Renomear/excluir grupos, categorias e subcategorias, editar atributos dos itens
- **Itens** — Tabela completa com filtros laterais, status de estoque (OK/Baixo/Zero), expansão de variações inline
- **Tema** — Claro/escuro com toggle
- **Dados de teste** — Gerador de ~100 itens e ~400 variações para testes

## Pré-requisitos

- [Node.js](https://nodejs.org/) v18 ou superior
- [Git](https://git-scm.com/)

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/Darasukan/estoque-main.git

# Entrar na pasta
cd estoque-main

# Instalar dependências
npm install
```

## Como rodar

```bash
# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:5173` no navegador.

## Build para produção

```bash
# Gerar build otimizada
npm run build

# Pré-visualizar build
npm run preview
```

Os arquivos prontos ficam na pasta `dist/`.

## Estrutura do projeto

```
src/
├── App.vue                     # Layout principal com abas e sidebar
├── main.js                     # Entry point
├── style.css                   # Tema Tailwind e variáveis
├── composables/
│   ├── useItems.js             # Estado central (itens, variações, filtros)
│   ├── useTheme.js             # Tema claro/escuro
│   └── useToast.js             # Notificações toast
├── services/
│   └── storageService.js       # Persistência localStorage
├── data/
│   └── seedData.js             # Gerador de dados de teste
├── utils/
│   └── id.js                   # Gerador de IDs únicos
├── views/
│   ├── CatalogView.vue         # Catálogo com cards e tabela
│   ├── CadastroView.vue        # Formulário de cadastro
│   ├── EditHierarchyView.vue   # Editor de hierarquia e atributos
│   └── ManageView.vue          # Tabela de itens com filtros
└── components/
    ├── ui/
    │   ├── AppSidebar.vue      # Sidebar de navegação/filtros
    │   └── ToastContainer.vue  # Container de notificações
    └── catalog/
        ├── CategorySection.vue
        ├── ItemCard.vue
        └── SubcategorySection.vue
```
