# Sistema de interface

## Direcao

Interface operacional de estoque: densa, direta e legivel para pessoas com pouca familiaridade com computadores. O foco de cada tela e a proxima acao concreta; controles secundarios nao competem com ela.

Identidade unica: Industrial, em claro e escuro. Tons de oficina e estoque, navegacao grafite e ambar reservado para atencao. Estilos de referencia nao aparecem como preferencias na operacao.

Assinatura do produto: ficha de circulacao que conecta material, saldo, local ou destino, ultima movimentacao e manutencao relacionada.

## Estrutura visual

- Base de espacamento: 4 px.
- Densidade: controles com 8-12 px internos; paineis com 16-20 px.
- Raios: 6 px em controles, 8-12 px em paineis e 12 px em modais.
- Profundidade: bordas e mudancas sutis de superficie; sombras apenas em elementos elevados.
- Tipografia: 14 px no corpo, 11-12 px em metadados, 600 para titulos, selecoes e acoes principais.
- Numeros dinamicos usam algarismos tabulares.

## Hierarquia

1. Visitante ve `Consultar materiais`; operador ve `Registrar movimentacao`; admin ve `Resolver prioridades`.
2. Navegacao e filtros ativos devem ser reconheciveis sem depender apenas de cor.
3. Metadados e tags ficam em superficies discretas, mas sempre legiveis.
4. Relatorios e detalhes avancados permanecem recolhidos ate serem solicitados.

## Contraste e temas

- Nunca combinar `bg-primary-*` com `text-white` assumindo que a escala primaria e escura.
- Usar `--ds-primary-text` sobre fundos primarios; nunca presumir texto branco.
- Estados ativos usam `--ds-active-bg` com `--ds-active-text`.
- Tags de atributos usam `.ds-attribute-tag`: `--ds-surface`, `--ds-border` e `--ds-text-soft`.
- No Industrial escuro: grafite no canvas, superficies proximas, bordas discretas e texto claro sem branco puro.
- Texto normal deve atingir contraste WCAG AA; estados interativos nao podem depender apenas da borda.

## Padroes reutilizaveis

- Botoes: `xs/sm` com 36 px, `md` com 40 px, `lg` com 44 px e icone com 40 px; primario reservado a acao principal e perigo solido apenas para confirmacao destrutiva.
- Abas: navegacao principal, contexto e controle segmentado sao camadas distintas; segmentado usa recipiente discreto e aba ativa elevada sobre a superficie.
- Tabelas: cabecalho fixo, linhas de 44 px, numeros tabulares, acoes na ultima coluna e rolagem horizontal quando necessario.
- Selecao em listas: fundo ativo, texto contrastante, icone e contador herdando a cor do estado.
- Tag de atributo: compacta, borda discreta, chave com peso 600 e valor com peso regular.
- Filtros laterais: busca no topo, hierarquia progressiva e uma unica selecao evidente.
- Acao flutuante `Movimentar`: alto contraste, rotulo explicito e alvo de toque minimo de 44 px.
- Todos os acessos de entrada e saida abrem o mesmo fluxo de movimentacao rapida.
- `Ctrl+K`: acoes frequentes primeiro quando vazio; resultados equilibrados por dominio e registros recentes.
- Falha de sincronizacao: aviso persistente com fontes afetadas e acao `Tentar novamente`.
- Fechamento mensal: sempre passa por previa com periodo, movimentos, alertas e indicacao de substituicao.
- Ficha de circulacao: saldo, local, destinos, ultima movimentacao e OS relacionadas; cada OS abre diretamente no modulo de manutencao.

## Referencias

Referencias externas servem apenas para criterios de acabamento: bordas silenciosas, superficies proximas e estados ativos de contraste forte. A interface final continua industrial e nao copia identidades de outros produtos.
