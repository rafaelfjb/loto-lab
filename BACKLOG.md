# LotoLab — acompanhamento das entregas

Estados: **Implementado** = disponível nesta versão; **Validar com Rafael** = precisa de aceite funcional; **Pendente** = ainda não entregue. Uma entrega só passa a aprovada depois de percorrer os critérios e registrar o resultado.

| Etapa | Entrega | Estado nesta versão | Critérios para validação |
|---|---|---|---|
| 0 | Base responsiva e navegação | Implementado · validar com Rafael | Testar Início, Resultados, Estatísticas e Meus jogos abrindo `public/index.html` diretamente e em celular/desktop; revisar as cores roxo, magenta e amarelo-claro da Lotofácil. A execução foi corrigida para não depender de importação de módulos bloqueada em `file://`. |
| 0.1 | Decisão de arquitetura e stack | Decisão registrada · aplicar nas próximas entregas | Aplicação em Node.js como runtime único do produto, MongoDB como banco, D3.js local para visualização; Python adiado até existir necessidade medida de análise avançada ou processamento pesado. O protótipo segue navegável sem MongoDB. |
| 0.2 | Navegação de concursos na visão geral | Implementado · validar com Rafael | Usar Voltar/Avançar para percorrer os resultados disponíveis; conferir que dezenas, data, frequências, rankings e médias refletem o concurso atual e somente os registros até ele; testar limites do histórico e lacunas. |
| 1 | Resultados CAIXA / importação | Parcial · validar com Rafael | O XLSX enviado foi lido em teste: 3.829 concursos consecutivos (1–3.829), de 29/09/2003 a 13/11/2026, sem dezenas inválidas ou duplicidades conflitantes; o histórico acompanha o aplicativo como conjunto inicial. Conferir na interface número, data, 15 bolas e metadados; comparar manualmente com a fonte oficial. A origem foi declarada como CAIXA, mas não houve verificação independente nem atualização automática. |
| 2 | Histórico e consulta | Implementado · validar | Filtrar por concurso e período; abrir detalhes; verificar estado vazio e metadados de premiação, se disponíveis. |
| 3 | Estatísticas históricas | Implementado · validar | Conferir frequência, pares/ímpares, soma, repetição e faixas com concursos oficiais conferidos. |
| 3.2 | Ajuste responsivo do gráfico Soma por concurso | Implementado nesta revisão · validar com Rafael | Conferir que as barras e rótulos dos concursos recentes permanecem dentro do cartão em desktop, tablet e celular; validar que cada barra mantém seu número e soma acessíveis no título. |
| 3.3 | Frequências de combinações de 2 a 15 dezenas | Implementado · validar com Rafael | Selecionar pares a quindécetos; conferir combinações líderes e contagens em um conjunto pequeno conhecido; verificar mensagens de empate, progresso, período dos dados e comportamento em celular. |
| 3.4 | Frequências de sequências consecutivas de 2 a 15 dezenas | Implementado nesta revisão · validar com Rafael | Selecionar tamanhos de 2 a 15; confirmar que apenas trechos numericamente consecutivos são contados, cada trecho no máximo uma vez por concurso; conferir sobreposições, empates, ausência de ocorrência e layout responsivo. |
| 3.1 | Corrida histórica das dezenas | Implementado · validar com Rafael | Reproduzir a contagem acumulada concurso a concurso; testar início/fim, pausa, controle de duração e seleção pelo controle deslizante; conferir total final de ocorrências com a soma das dezenas de todos os concursos carregados. |
| 4 | Análise experimental de padrões | Implementado em forma inicial · validar | Revisar método e teste retrospectivo fora da amostra; confirmar que a comunicação não sugere vantagem futura comprovada. |
| 5 | Montagem e impressão | Implementado nesta revisão · validar com Rafael | Definir de 15 a 20 dezenas por jogo; completar aleatoriamente apenas as dezenas faltantes sem alterar as selecionadas; salvar/editar/excluir e testar a impressão como folha de referência. |
| 6 | Conferência dos jogos | Implementado · validar | Comparar um jogo salvo com concurso oficial conferido e verificar as dezenas coincidentes. |
| 7 | Publicação e operação segura | Pendente | HTTPS, domínio, ambientes, logs/alertas, backups e teste de recuperação antes de expor ao público. |
| 8 | Login e sincronização | Pendente | Contas, jogos por usuário, recuperação de acesso, exportação e exclusão de dados. |
| 9 | Outras loterias | Pendente | Definir e validar regras independentes de cada modalidade e seu tema visual próprio. |
| 10 | Pagamentos | Pendente | Definir valor/recursos pagos e só então integrar um provedor com confirmação segura no servidor. |

### Registro desta revisão — 22/11/2026

- **Meus jogos:** removido o botão “Sugestão exploratória”. O usuário define a quantidade de dezenas do jogo (15–20); “Complete o jogo” adiciona aleatoriamente apenas as dezenas faltantes, preservando as já escolhidas. O salvamento exige a quantidade exata definida; jogos existentes podem ser editados mantendo seu tamanho.
- **Estatísticas — borda e centro:** adicionado painel com totais, média por concurso e participação das casas do perímetro (16 posições) e das 9 casas internas do tabuleiro 5 × 5.
- **Estatísticas — faixas verticais:** adicionado painel para as cinco colunas do volante, com totais, média por concurso e dezenas de cada faixa. Indicadores descritivos, sem valor preditivo. Aceite funcional com Rafael pendente.

### Registro desta revisão — 21/11/2026

- **Sequências consecutivas:** adicionada em Estatísticas a frequência das sequências numéricas consecutivas de 2 a 15 dezenas. São mostradas as sequências observadas, frequências, período e empates na liderança. Cada sequência conta no máximo uma vez por concurso; sequências sobrepostas são contadas separadamente. Análise descritiva, sem inferência preditiva. Aceite funcional com Rafael pendente.

- **Estatísticas de combinações:** adicionada análise sob demanda dos grupos de 2 a 15 dezenas — pares, ternos, quadras, quinas, senas e quindécetos — com frequência por concurso, combinações líderes, contagem de empates no topo e indicação do período carregado. O cálculo é progressivo e usa o histórico disponível; não implica previsão nem aumento de probabilidade. Aceite funcional com Rafael pendente.

### Registro desta revisão — 20/11/2026

- **Correção visual em Estatísticas:** o gráfico “Soma por concurso” agora distribui as barras em colunas de largura flexível, mantém os últimos concursos dentro do cartão e adapta os rótulos em telas estreitas. Cada barra preserva o número e a soma em seu rótulo acessível. Aceite funcional com Rafael pendente.

### Registro desta revisão — 17/11/2026

- **Decisão aprovada por Rafael:** manter Node.js como linguagem/runtime único do produto, MongoDB como banco previsto e D3.js para o Bar Chart Race. Python fica fora da produção por enquanto; reconsiderar somente diante de necessidade comprovada de bibliotecas especializadas ou carga de processamento.
- **Implementação nesta revisão:** corrida histórica das dezenas migrada para D3.js 7.9.0 incluído localmente no projeto, sem depender de CDN em tempo de execução. Aceite funcional ainda pendente.
- **Navegação da visão geral:** incluídos controles para voltar ao concurso anterior disponível e avançar ao próximo; os indicadores do painel são recalculados somente com os concursos até o selecionado. Se houver lacunas, a interface informa e navega entre registros existentes, sem fabricar resultados. Validação com Rafael pendente.

### Registro desta revisão — 16/11/2026

- **Nova visualização:** corrida animada acumulando as ocorrências das dezenas 01–25 por concurso, com seleção de período, reprodução e duração ajustável. Validação funcional com Rafael pendente.
- **Interpretação dos dados:** conta apenas concursos presentes no histórico carregado; concursos ausentes são indicados e não são inventados nem estimados.

## Registro de validação

Para cada entrega, registrar data, responsável, ambiente testado, resultado dos critérios, evidências e pendências. Não marcar como aprovada sem validação do usuário.

### Registro desta revisão — 15/11/2026

- **Correção técnica:** removida a dependência de módulo importado que impedia a navegação ao abrir o HTML diretamente em `file://`.
- **Histórico incluído:** planilha XLSX enviada por Rafael, com concursos 1–3.829; origem declarada CAIXA, sem conferência independente.
- **Aceite do usuário:** pendente. Rafael deve testar as quatro seções e conferir alguns concursos e rateios com a fonte oficial.
