# Inspeções POPs — aplicação, painel central e PDFs

O GitHub Pages hospeda `public/`. O Apps Script recebe os pedidos, valida as credenciais e consulta/grava as inspeções no Sheets. O Drive guarda PDFs e cópias JSON. O Looker Studio é opcional: o próprio aplicativo tem um painel central.

## Estado da integração

O site está conectado ao serviço Google. A versão v2 acrescenta processamento em fila, envio de fotos separado, resumo do painel, consolidação de ativos e administração de operadores pelo próprio aplicativo. O cliente negocia esses recursos com o servidor: enquanto o Apps Script não for atualizado, continua usando o fluxo anterior e mostra o aviso de atualização pendente à Gestão. Publicar no GitHub não atualiza o Apps Script. Os testes automatizados usam serviços simulados; homologar uma inspeção com fotos e inventário conferido após publicar a nova versão do serviço.

## Frota Infra

O portal oferece as abas **Inspeções POPs** e **Frota**. Cada módulo usa sua URL de implantação do Apps Script, configurada em `public/config.js`. A Frota usa as chaves individuais de Gestão já emitidas quando as duas implantações pertencem ao mesmo projeto Apps Script. Nesta versão, só o perfil **Gestão** pode consultar ou gravar o acervo de Frota. A chave é informada uma vez por sessão no portal. As duas abas preservam as telas abertas enquanto o portal estiver aberto. A opção **Sair do portal** encerra os dois acessos. Ao recarregar ou fechar a página, a chave em memória é descartada.

A aba **Frota** do arquivo **DADOS CENTRALIZADOS (INFRA)** recebe a lista operacional de veículos, checklists, avarias e devoluções. A descrição nessa lista é padronizada. O acervo completo, inclusive os cadastros de condutores, fotos, documentos e histórico de gravações, é guardado no Drive restrito. A aba é atualizada pelo aplicativo. Edições manuais nos registros da Frota podem ser substituídas na próxima gravação. O compartilhamento já configurado da planilha permite acesso direto à lista operacional.

### Ativar no Apps Script

1. No projeto Apps Script já usado para Inspeções POPs, copie o conteúdo gerado de [`apps-script/Bd.gs`](apps-script/Bd.gs) para o arquivo único da integração. Preserve a implantação atual e suas propriedades. A Frota faz parte desse mesmo arquivo.
2. Com a conta que executa a implantação, execute **`prepararFrota`**. Ela confere os cabeçalhos da guia **Frota** e cria uma pasta de Drive dedicada, de acesso geral restrito. A propriedade privada `FLEET_FOLDER_ID` identifica a pasta. Restrinja também os convites diretos à pasta.
3. Crie uma nova versão da implantação Web usada pela Frota, preservando sua URL `/exec`. Em homologação, entre com uma chave de Gestão, grave um veículo fictício e confira a linha na guia Frota. Confirme também a recusa de uma chave do perfil Operação. Publique a interface pelo fluxo habitual do GitHub Pages depois que o serviço estiver disponível.

É possível importar um backup da Frota Infra V2.3 pela tela de configurações na primeira revisão. A integração mantém até 12 MB de acervo por gravação, incluindo imagens e PDFs. Use imagens reduzidas e acompanhe o volume em homologação. Rascunhos de checklist permanecem na sessão atual. Duas pessoas podem consultar o acervo ao mesmo tempo. Em caso de gravações conflitantes, atualize a tela antes de refazer a alteração.

## Consultas de inspeções e ativos

- **Dashboard Gerencial** mostra indicadores consolidados. **Inspeções Recebidas** lista os envios da equipe e **Cronograma** mostra a próxima data por POP.
- O perfil **Operação** consulta seus próprios envios, de acordo com a autoria verificada no Apps Script. A lista local de cada perfil continua mostrando as inspeções preenchidas ou importadas com aquela conta e navegador.
- **Gestão de Ativos** mostra o resultado da consolidação por inspeção. Depois de implantar o `Bd.gs` atualizado, **Ver equipamentos** consulta o inventário arquivado de cada vistoria, inclusive os itens que precisam de conferência antes de entrar na planilha central.
- **Baixar resumo PDF** gera uma página com indicadores da base central. **PDF arquivado** abre o relatório associado ao envio.

## Relatório de inspeção

O resumo gerencial de uma página está disponível no histórico da Gestão. O PDF técnico arquivado traz identificação, diagnóstico e não conformidades, seguidos de ações, medições e até quatro evidências quando disponíveis. O nome do arquivo começa pela estação e pela data da vistoria. O envio original conserva todos os dados e fotos.

Depois de atualizar o `Bd.gs` e implantar nova versão no endereço usado por **Inspeções POPs**, a Gestão pode usar **Gerar PDF atualizado** no histórico do **Painel central da equipe**. A função reutiliza o envio arquivado no Drive, atualiza o link da inspeção, preserva o PDF anterior e não repete a consolidação dos ativos. Inspeções novas já usam o layout atualizado.

## Cadastro de operadores pela interface

Depois de atualizar o serviço, qualquer um dos cinco gestores pode abrir **Gerenciar acessos** na tela inicial. Basta informar o e-mail e clicar em **Cadastrar e gerar chave**. A chave aparece para cópia e entrega privada, sem acessar a planilha ou o Apps Script. A tela também permite reemitir chaves de operadores e desativar acessos; o histórico das inspeções permanece intacto. Reemissão invalida a chave anterior. A chave recém-gerada fica somente na memória da tela e é removida ao sair ou trocar de usuário, sem ser salva no navegador ou no histórico.

Somente o servidor pode autorizar essas operações. Operadores não podem listar usuários, gerar chaves ou promover alguém a gestor. Os cinco gestores são exibidos como administrados pelo responsável; esta interface não altera nem cria perfis gerenciais. As ações ficam registradas sem chaves em `Historico_Acessos_POPs`, no arquivo privado de administração.

## Configuração atualizada em projeto separado

1. No projeto **Inspeções POPs** do Apps Script, substitua somente o código da integração pelo conteúdo completo de [`apps-script/Bd.gs`](apps-script/Bd.gs). Este arquivo já inclui todos os módulos. Não cole os outros arquivos `.gs` separadamente no mesmo projeto: são os fontes do arquivo único. Mantenha as outras automações em seu projeto original.
2. Salve e execute **`prepararInspecoesPOPs`**. Autorize a conta que consegue editar a planilha central e acessar a lista privada de usuários e a pasta dos PDFs. As referências já constam no código. A preparação valida as colunas cadastrais, cria o histórico privado de alterações e instala um único acionador de `processarFilaInspecoesPOPs` a cada minuto. Autorize a nova permissão de acionadores. As chaves existentes são preservadas; não é necessário reemiti-las por causa desta atualização.
3. Use **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar** no aplicativo Web existente. Mantenha a mesma URL `/exec`, execução como **Eu** e configuração de acesso existente. Todo pedido de dados é autenticado no código. Não execute `criarChaveInspecoesPOPs` para atualizar o serviço: as chaves atuais continuam válidas.
4. Entre no site com sua chave gerencial. A opção **Gerenciar acessos** deve aparecer na tela inicial. Novos operadores podem ser cadastrados por essa tela, sem editar a lista de usuários nem executar funções no Apps Script.
5. Homologue uma inspeção de teste com fotos e inventário conferido. Confirme a linha na planilha, o PDF, a consolidação dos ativos e a consulta pelo autor e pela gestão. Confirme que outro operador não consulta nem altera esse registro. Teste falha de rede e reenvio sem duplicação.

A [lista privada de acessos](https://docs.google.com/spreadsheets/d/1IRXgtRt8_oS1I5MuKD29MUrWv9xUNRibbuT_szs34j4/edit) mantém as colunas `email`, `perfil`, `ativo` e `emitir_chave`. Os cinco gestores solicitados já estão cadastrados. Para a configuração inicial ou recuperação administrativa, o responsável pode marcar uma pessoa ativa em `emitir_chave` e executar `criarChaveInspecoesPOPs`: a função emite somente as chaves marcadas e revoga as anteriores dessas pessoas. Esse procedimento não é necessário na atualização nem no cadastro cotidiano de operadores. Mantenha o arquivo restrito à administração e entregue cada chave individualmente.

Não é necessário adicionar bibliotecas. O arquivo separado `appsscript.json` é uma referência para projeto dedicado; os serviços usados normalmente são identificados pelo Apps Script. Se o projeto tiver escopos OAuth explícitos, preserve os existentes e inclua Sheets, Drive, Documents e `https://www.googleapis.com/auth/script.scriptapp` conforme o manifesto de referência.

## Perfis e credenciais

- **GESTAO:** consulta todas as inspeções recebidas, indicadores e PDFs.
- **OPERACAO:** cria/envia inspeções e consulta somente as próprias inspeções e PDFs.
- A chave é uma credencial individual vinculada ao e-mail pelo administrador. Isso não é login Google/OAuth nem prova automática de posse da caixa de e-mail. Quem possui a chave assume o acesso da pessoa; por isso, a entrega deve ser privada.
- O servidor resolve o perfil na lista privada a cada pedido. Alterar e-mail, perfil ou seletor no navegador não concede acesso. Desmarcar `ativo` revoga os pedidos seguintes; a reemissão revoga a chave anterior da pessoa.
- A autoria de cada ID é armazenada nas propriedades privadas do script. Modificar `operador_envio` na planilha pública não transfere a autoria dentro do aplicativo. Registros antigos sem vínculo de autoria aparecem apenas para Gestão; a atribuição exige uma migração administrativa.
- Os registros e as fotos locais ficam separados por usuário. Sair limpa a sessão em memória, sem apagar os rascunhos individuais. A chave não é persistida. É necessário conectar-se para entrar novamente após recarregar a página; durante uma sessão já validada, é possível preencher sem conexão e reenviar quando ela voltar.

### Compartilhamento da planilha central

Por solicitação do responsável, o compartilhamento existente da planilha central foi mantido. A restrição por operador se aplica às consultas e alterações pelo aplicativo. Quem tiver acesso direto à planilha continua sujeito às permissões do próprio Google Sheets e pode ver/editar os dados diretamente. A divisão de perfis do aplicativo não restringe esse caminho.

A lista de usuários e a pasta dos PDFs exigem acesso geral **Restrito**. Não compartilhe a lista de acessos com operadores, pois ela determina os perfis. Os PDFs são baixados pelo aplicativo mediante a mesma verificação de autoria, sem precisar publicar os arquivos no Drive. Administradores do script e da base mantêm acesso administrativo.

## Como os dados são atualizados

Finalizar salva o registro local e envia as fotos individualmente. Cada fotografia recebe uma referência assinada, vinculada ao autor e à inspeção. Isso evita montar um único corpo JSON com todas as imagens em memória. O limite continua sendo 100 fotos e 15 MB para o conjunto equivalente de fotos/dados; reenvios reutilizam fotos inalteradas.

O serviço confirma primeiro **Recebida / em processamento** e guarda uma cópia privada para a fila. A geração do PDF ocorre fora do bloqueio global de gravação. A página tenta adiantar o processamento; o acionador do Google continua o trabalho se ela for fechada. Somente após gravar a inspeção, o PDF e o resultado da tentativa de consolidação dos ativos, o estado muda para **Sincronizada**. Pendências de cadastro dos ativos aparecem separadamente; não significam que todos os ativos foram alterados.

Reenvio idêntico devolve a confirmação anterior; revisões mais novas atualizam a mesma inspeção. O painel pede um resumo consolidado, carrega inicialmente 50 linhas do histórico e oferece **Carregar mais**. Os indicadores e o cronograma consideram todo o histórico autorizado, mesmo quando somente a primeira página é exibida. Há cache de 45 segundos separado pelo escopo de acesso (Gestão ou usuário de Operação), invalidado a cada gravação. A consulta automática continua a cada minuto enquanto o painel estiver visível.

Os campos locais são gravados após 400 ms sem nova alteração e imediatamente na finalização, navegação, saída da conta ou ocultação da página. Fotos permanecem no IndexedDB. O logo embutido foi unificado para reduzir o HTML, preservando o relatório portátil.

## Atualização automática dos cadastros

A consolidação usa as abas existentes e seus cabeçalhos, sem mudar as posições das colunas originais:

| Aba | Atualização |
| --- | --- |
| Ativos | Equipamentos de rede, retificadoras, climatizadores, DIOs, transceivers e baterias identificados |
| Climatização_Voanet | Cadastro e medições do aparelho; série, fabricante, modelo, capacidade e instalação informada |
| Retificadores | Cadastro, módulos e verificações da retificadora |
| Controle_Baterias | Banco completo, identificado e conferido; composição, tecnologia e capacidades explicitamente informadas |

A aba **Inspecao_Climatizacao** continua exclusiva do AppSheet. As datas de manutenção e testes não são alteradas por uma simples inspeção visual. Fórmulas existentes de manutenção, vida útil, capacidade e status são preservadas; novos registros recebem a estrutura e as fórmulas relativas da tabela de destino.

`Nº Série` e `Patrimônio` são os campos canônicos. A integração não cria cópias quando esses campos já existem. Os campos técnicos adicionais são `ID_Ativo`, `Codigo_POP`, `ID_Ultima_Inspecao` e `Versao_Inspecao`. A data da vistoria usa `Data_Ultima_Inspecao` nas abas que não têm um campo equivalente; em Retificadores, reutiliza `Data de Verficação`. Nenhuma dessas datas substitui manutenção ou teste. A preparação e a consolidação bloqueiam cabeçalhos redundantes/ambíguos.

Somente grupos marcados como conferidos/atualizados e identificações confirmadas podem alimentar os cadastros. Para baterias, confirme cada unidade e marque **Conferi todas as baterias deste banco; o cadastro está completo**. Isso impede que uma conferência parcial reduza indevidamente a quantidade do banco.

A identificação usa ID já cadastrado, série/patrimônio ou correspondência única de POP, fabricante e modelo para um cadastro existente. Novos ativos exigem série ou patrimônio. Mais de uma correspondência, divergência de fabricante/série, movimentação entre POPs, valor não aceito pela validação ou inspeção anterior à última atualização geram pendência. Campos vazios não apagam informações; ausência de um equipamento no formulário não o exclui do cadastro.

O histórico detalhado fica na aba privada `Historico_Ativos_POPs`, com inspeção, ativo, ação, motivo e valores anteriores/novos. O painel mostra quantos cadastros foram criados/atualizados e quantas pendências existem, com opção de reprocessar após uma correção de validação ou cadastro. Inspeções anteriores à v2 precisam ser reenviadas a partir da cópia local para adquirir a cópia de processamento necessária à consolidação.

## Regra de próximas inspeções

O cadastro `POPs` da planilha central define a criticidade de cada POP. O aplicativo exige escolher um POP cadastrado. O servidor recalcula a próxima inspeção a cada nova vistoria, em dias corridos contados da data da vistoria: **ALTA/CRÍTICA = 45 dias**; **MÉDIA = 90 dias**. A criticidade operacional observada durante a vistoria é um campo independente e não substitui a classificação do cadastro. Classes sem regra não recebem um prazo inventado; o envio solicita definição pela gestão.

O painel central mostra a programação da última vistoria de cada POP, preservando o histórico das anteriores, com a data prevista e dias restantes/vencidos. São alertas visuais no aplicativo, sem envio de e-mail. O prazo e a criticidade usados no cálculo são preservados no PDF/backup; a tabela central mantém `schedulePeriod`, `scheduleBaseDate` e `scheduleDueDate`.

Por orientação do responsável, **POP Cordebras (PCAM.021)** foi retirado da programação e da seleção para novas inspeções, sem apagar registros antigos nem alterar a planilha de cadastro. O **POP 46 Base Nova**, que possui o mesmo código no cadastro, permanece selecionável; a verificação de duplicidade considera somente os POPs ativos na programação.

## Limites e publicação

Limites atuais: 15 MB por envio, até 100 fotos, limites de execução e conversão do Apps Script. Chaves e autoria usam as propriedades do script, sujeitas às cotas do Google; o Sheets atende este piloto e não substitui um banco transacional para grandes volumes. A cópia JSON do Drive não substitui o backup portátil original, que inclui os arquivos das fotos.

O workflow `.github/workflows/pages.yml` publica somente `public/` a partir de `main`. Antes de publicar, `tools/prepare-pages.cjs` inclui o identificador do commit nas URLs da configuração e do aplicativo para impedir a reutilização da configuração HTTP antiga. O service worker busca os arquivos sem reutilizar o cache HTTP e mantém uma cópia para indisponibilidade de rede, sem apagar registros/fotos. O código público não contém chaves individuais nem a lista de e-mails. A lista de usuários fica no arquivo privado do Drive. O endereço/origem mudou em relação à aplicação anterior; backups antigos precisam ser importados pelo próprio autor na sessão correta, pois não há migração automática entre dispositivos/usuários.

Após alterar os fontes do servidor, gere o arquivo único novamente com `node tools/build-bd.cjs`. Verifique com `node --test tests/*.test.cjs` e atualize a implantação do Google para que as mudanças de servidor tenham efeito. Publicar no GitHub não atualiza o Apps Script automaticamente.
