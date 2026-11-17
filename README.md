# Inspeções POPs — aplicação, painel central e PDFs

O GitHub Pages hospeda `public/`. O Apps Script recebe os pedidos, valida as credenciais e consulta/grava as inspeções no Sheets. O Drive guarda PDFs e cópias JSON. O Looker Studio é opcional: o próprio aplicativo tem um painel central.

## Estado da integração

O site está configurado com a URL `/exec` da implantação fornecida pelo responsável. O serviço respondeu em JSON e rejeitou consultas de sessão e de inspeções com chave inválida. Os testes de perfis, gravação, PDF e prazos usam serviços simulados; a entrada com chave válida e o envio de uma inspeção real devem ser homologados pela equipe. Ao atualizar o servidor, publique uma nova versão no Apps Script, pois o GitHub não altera essa implantação.

## Configuração atualizada em projeto separado

1. No projeto **Inspeções POPs** do Apps Script, substitua somente o código da integração pelo conteúdo completo de [`apps-script/Bd.gs`](apps-script/Bd.gs). Este arquivo já inclui campos, acesso, prazos e recebimento. Não cole também `Code.gs`, `schema.gs`, `access.gs` ou `scheduling.gs` no mesmo projeto: são os fontes do arquivo único. Mantenha as outras automações em seu projeto original.
2. Salve e execute **`prepararInspecoesPOPs`**. Autorize a conta que consegue editar a planilha central e acessar a lista privada de usuários e a pasta dos PDFs. As referências já constam no código.
3. A [lista privada de acessos](https://docs.google.com/spreadsheets/d/1IRXgtRt8_oS1I5MuKD29MUrWv9xUNRibbuT_szs34j4/edit) tem as colunas `email`, `perfil`, `ativo` e `emitir_chave`. Os cinco gestores solicitados estão cadastrados. Para cada operador, adicione uma linha com e-mail, perfil **OPERACAO**, `ativo` marcado e `emitir_chave` marcado. Mantenha esse arquivo restrito à administração.
4. Execute **`criarChaveInspecoesPOPs`**. O registro de execução exibirá uma chave por pessoa marcada em `emitir_chave`, e a marca será desfeita após a emissão. Entregue cada chave individualmente à pessoa correspondente; nunca grave chaves na planilha, no repositório ou no chat. As chaves anônimas da versão anterior não funcionam nesta versão.
5. **Implantar → Nova implantação → Aplicativo da Web**. Executar como **Eu** e acesso **Qualquer pessoa**, se permitido pelo Workspace. Todo pedido de dados é autenticado no código; o acesso público à URL não libera as inspeções. Copie a URL terminada em `/exec` para `google.endpoint` em `public/config.js`. Se o aplicativo Web já existir, use **Gerenciar implantações → Editar → Nova versão** para manter a URL e atualizar o código.
6. Entre no site com uma chave gerencial e uma de operador. Faça uma inspeção fictícia com fotos. Confirme a linha na planilha, o PDF e a consulta pelo autor e pela gestão. Confirme que outro operador não consulta nem altera esse registro. Teste falha de rede e reenvio sem duplicação.

Não é necessário adicionar bibliotecas. O arquivo separado `appsscript.json` é uma referência para projeto dedicado; os serviços usados normalmente são identificados pelo Apps Script. Se o projeto tiver escopos OAuth explícitos, preserve os existentes e inclua Sheets, Drive e Documents conforme o manifesto de referência.

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

Finalizar salva o registro local e tenta enviar dados e fotos. O servidor cria o PDF e uma cópia JSON sem os bytes das fotos; depois grava uma linha na aba `Inspecoes_POPs`. Só então o aplicativo confirma o envio. Uma falha mantém o registro pendente.

Reenvio idêntico devolve a confirmação anterior. Uma revisão posterior atualiza a mesma linha e mantém os arquivos das revisões antigas como histórico. Versões antigas ou conflitantes são rejeitadas. O painel central consulta todas as páginas acessíveis ao usuário quando aberto, ao clicar em **Atualizar dados** e a cada minuto enquanto estiver visível. O Sheets não envia notificações em tempo real ao navegador.

Os indicadores centrais mostram o histórico de inspeções consultadas, e as não conformidades por POP são acumuladas nesse histórico. A taxa é C ÷ (C + NC); NA e NV não entram no denominador. Os indicadores locais de inventário/cronograma continuam baseados nos registros do usuário naquele navegador. A lista de inspeções central e o download de PDFs não exigem Looker.

## Regra de próximas inspeções

O cadastro `POPs` da planilha central define a criticidade de cada POP. O aplicativo exige escolher um POP cadastrado. O servidor recalcula a próxima inspeção a cada nova vistoria, em dias corridos contados da data da vistoria: **ALTA/CRÍTICA = 45 dias**; **MÉDIA = 90 dias**. A criticidade operacional observada durante a vistoria é um campo independente e não substitui a classificação do cadastro. Classes sem regra não recebem um prazo inventado; o envio solicita definição pela gestão.

O painel central mostra a programação da última vistoria de cada POP, preservando o histórico das anteriores, com a data prevista e dias restantes/vencidos. São alertas visuais no aplicativo, sem envio de e-mail. O prazo e a criticidade usados no cálculo são preservados no PDF/backup; a tabela central mantém `schedulePeriod`, `scheduleBaseDate` e `scheduleDueDate`.

Por orientação do responsável, **POP Cordebras (PCAM.021)** foi retirado da programação e da seleção para novas inspeções, sem apagar registros antigos nem alterar a planilha de cadastro. O **POP 46 Base Nova**, que possui o mesmo código no cadastro, permanece selecionável; a verificação de duplicidade considera somente os POPs ativos na programação.

## Limites e publicação

Limites atuais: 15 MB por envio, até 100 fotos, limites de execução e conversão do Apps Script. Chaves e autoria usam as propriedades do script, sujeitas às cotas do Google; o Sheets atende este piloto e não substitui um banco transacional para grandes volumes. A cópia JSON do Drive não substitui o backup portátil original, que inclui os arquivos das fotos.

O workflow `.github/workflows/pages.yml` publica somente `public/` a partir de `main`. Antes de publicar, `tools/prepare-pages.cjs` inclui o identificador do commit nas URLs da configuração e do aplicativo para impedir a reutilização da configuração HTTP antiga. O service worker busca os arquivos sem reutilizar o cache HTTP e mantém uma cópia para indisponibilidade de rede, sem apagar registros/fotos. O código público não contém chaves individuais nem a lista de e-mails. A lista de usuários fica no arquivo privado do Drive. O endereço/origem mudou em relação à aplicação anterior; backups antigos precisam ser importados pelo próprio autor na sessão correta, pois não há migração automática entre dispositivos/usuários.

Após alterar os fontes do servidor, gere o arquivo único novamente com `node tools/build-bd.cjs`. Verifique com `node --test tests/*.test.cjs` e atualize a implantação do Google para que as mudanças de servidor tenham efeito. Publicar no GitHub não atualiza o Apps Script automaticamente.
