# LotoLab — versão demonstrável

Aplicação web responsiva para consulta e análise histórica da Lotofácil, montagem e impressão de jogos. Esta versão continua em validação e **não é um serviço de produção pronto para usuários públicos**.

## Decisão técnica registrada — 17/11/2026

- **Node.js** será o runtime único do produto para API, regras de negócio e análises históricas iniciais; isso mantém uma única stack de produção.
- **MongoDB** permanece como banco de dados previsto para concursos e dados persistentes. É opcional para executar a demonstração local.
- **D3.js 7.9.0** é usado no Bar Chart Race e está incluído localmente em `public/`, então a visualização não depende de CDN quando o app é aberto sem internet.
- **Python não entra no backend de produção nesta fase.** Pode ser usado em estudos exploratórios locais se necessário; reavaliar sua inclusão no produto apenas se surgirem modelos/bibliotecas específicas ou processamento pesado medido.
- A cópia local do D3.js mantém o aviso de copyright da distribuição oficial: Mike Bostock, 2010–2023; pacote publicado no jsDelivr.

## O que está disponível

- Navegação entre Início, Resultados, Estatísticas e Meus jogos, adaptada a celular e computador, inclusive ao abrir `public/index.html` diretamente no navegador (`file://`).
- Na Visão geral, botões percorrem um resultado por vez; dezenas, frequência, ranking e médias são recalculados usando o concurso selecionado e o histórico até ele. Em caso de lacunas, a interface sinaliza e não inventa concursos.
- Histórico inicial carregado a partir da planilha XLSX enviada pelo usuário: concursos 1 a 3.829, de 29/09/2003 a 13/11/2026. A planilha declara origem CAIXA, mas não foi verificada independentemente.
- Importação manual de planilhas XLSX no formato recebido e de CSV; os dados importados pela interface ficam somente neste navegador.
- Reconhecimento das colunas `Concurso`, `Data Sorteio` e `Bola1` a `Bola15`, inclusive datas do Excel e células de texto compartilhado.
- Quando presentes, importação dos rateios e quantidade de ganhadores das faixas de 15 a 11 acertos, estimativa de prêmio, arrecadação total, acumulados de 15 acertos e do sorteio especial da Independência, cidade/UF e observação. Os valores e localidades aparecem nos detalhes do concurso.
- Consulta por concurso e período, histórico paginado em blocos de 50 resultados, indicadores, experimento retrospectivo simples de frequência e Bar Chart Race em D3.js com a contagem acumulada das 25 dezenas por concurso. A corrida usa somente concursos carregados, tem controles de reprodução, início/fim, seleção direta do concurso e duração; lacunas no histórico são informadas.
- Estatísticas sob demanda de combinações de 2 a 15 dezenas (pares a quindécetos), com contagens de frequência, combinações líderes, empates e progresso do cálculo no histórico carregado; não são previsões.
- Frequência de sequências numéricas consecutivas de 2 a 15 dezenas, com tamanho selecionável, ranking das sequências observadas, frequências e empates na liderança. Cada sequência conta no máximo uma vez por concurso; janelas sobrepostas são contadas separadamente.
- Montagem de jogos com quantidade configurável de 15 a 20 dezenas; o botão “Complete o jogo” preenche aleatoriamente somente as dezenas faltantes, preservando as já selecionadas. Salvamento local, edição, exclusão, conferência e impressão de jogos.
- Estatísticas de distribuição das dezenas nas 16 casas da borda e 9 casas centrais do tabuleiro 5 × 5, além da frequência por cada uma das cinco faixas verticais. Totais e médias do histórico carregado; análises descritivas.
- API de leitura com MongoDB e importador administrativo que aceita XLSX ou CSV.
- Identidade visual da Lotofácil em tons de roxo, magenta e amarelo-claro, inspirada no volante enviado.
- Nenhum concurso fictício é embarcado.

## Transparência e limites

- A importação do navegador registra a origem declarada pelo usuário, mas **não verifica automaticamente** se o arquivo veio da CAIXA nem se cada linha corresponde ao resultado oficial.
- O importador administrativo também registra a fonte indicada pelo operador e valida o formato dos dados; a conferência independente contra a publicação da CAIXA continua sendo responsabilidade operacional.
- A atualização automática diretamente da CAIXA ainda não foi implementada. Não se presume que exista uma API pública estável.
- Frequências, intervalos e experimentos descrevem os dados carregados; não garantem prêmio nem demonstram vantagem futura.
- Login, sincronização de jogos, seleção de outras loterias, pagamentos, backups e operação pública permanecem pendentes.

## Versionar com Git (pasta local, GitHub ou GitLab)

Este projeto está organizado para virar um repositório Git. O pacote não contém credenciais nem um repositório remoto configurado; assim, você pode manter apenas localmente ou enviar para um repositório criado por você no GitHub ou GitLab.

1. Instale o Git e extraia a pasta do projeto.
2. No terminal, entre na pasta `lotolab` e execute:

```bash
git init -b main
git add .
git status
git commit -m "chore: versão inicial do LotoLab"
```

Se quiser somente versionamento local, pare após o commit. Para sincronizar com GitHub ou GitLab, crie um repositório vazio na plataforma e conecte-o (substitua a URL pela URL HTTPS ou SSH exibida pela plataforma):

```bash
git remote add origin <URL-do-repositório>
git push -u origin main
```

O `.gitignore` exclui `.env`, dependências instaladas, logs e dados locais de banco; `.env.example` permanece versionado como modelo. Antes de tornar o repositório público, revise direitos e condições de uso dos dados incluídos e não envie credenciais, backups, jogos pessoais ou arquivos de configuração reais.

## Abrir sem servidor

Extraia a pasta do projeto e abra `public/index.html` diretamente em um navegador. Os scripts de navegação e a planilha inicial são locais; não é necessário configurar MongoDB para testar a interface. Arquivos importados pela página e jogos ficam no armazenamento local do navegador.

## Executar com servidor

Requisitos: Node.js 20 ou superior; MongoDB é opcional para resultados compartilhados. Na pasta do projeto:

```bash
npm install
cp .env.example .env
```

Edite `.env` com a URI e o nome do banco; mantenha as credenciais fora do repositório. Inicie com:

```bash
node --env-file=.env server.mjs
```

Abra `http://localhost:3000`. Sem `MONGODB_URI`, o histórico inicial incluído continua disponível; concursos importados pela página ficam apenas no navegador atual.

## Importar resultados diretamente no navegador

1. Baixe a planilha XLSX na fonte oficial da CAIXA.
2. Em **Resultados**, escolha **Importar XLSX / CSV** e selecione a planilha. Também é aceito CSV com cabeçalhos `Concurso`, `Data Sorteio` e `Bola1` a `Bola15`, ou o modelo CSV com `concurso,data,dezenas`.
3. Informe a origem declarada. A página valida a estrutura e as regras da Lotofácil, mas avisa que não compara o conteúdo automaticamente com a CAIXA.

O navegador não envia o arquivo ao servidor. Para sincronizar resultados entre usuários, use o processo administrativo abaixo.

## Carregar concursos no MongoDB

A equipe deve obter e conferir o arquivo diretamente na fonte CAIXA e usar uma origem HTTPS do domínio `caixa.gov.br`:

```bash
node --env-file=.env scripts/import-draws.mjs ./resultados.xlsx --source-name="CAIXA" --source-url="https://loterias.caixa.gov.br/..."
```

O importador aceita `.xlsx` ou `.csv`. Para XLSX, a primeira aba da pasta de trabalho deve conter os cabeçalhos `Concurso`, `Data Sorteio` e `Bola1` a `Bola15`; colunas adicionais de rateio, estimativa e observação são preservadas quando reconhecidas. Para CSV, use a mesma estrutura por colunas ou `concurso,data,dezenas` com 15 dezenas separadas por espaços.

A coleção é `draws`, com índice único por modalidade e número do concurso. A validação checa data, quantidade e intervalo das dezenas e duplicidades conflitantes; ela não confirma independentemente que o concurso e as premiações correspondem à publicação oficial.

## Antes de publicar na internet

- Hospedar atrás de proxy ou plataforma com HTTPS, domínio próprio, logs, monitoramento e proteção contra abuso; o servidor Node não termina TLS.
- Restringir a rede do MongoDB, usar usuário de banco com privilégios mínimos e guardar segredos no gerenciador de credenciais do provedor.
- Configurar cópias de segurança e testar restauração; definir processo de atualização e conferência dos resultados oficiais.
- Revisar segurança, privacidade/LGPD, acessibilidade, desempenho, recuperação de falhas e testes de aceitação antes da publicação.
- Não habilitar escrita pública de resultados. A API é somente leitura; a carga deve permanecer em processo administrativo protegido.

## Contrato de dados básico

Cada resultado contém `lotteryId`, `numero`, `data`, `iso`, `dezenas`, procedência declarada e data de atualização. O formato também preserva, quando disponível, metadados da premiação. A chave de modalidade é explícita para permitir regras independentes no futuro; as validações atuais se aplicam somente à Lotofácil.
