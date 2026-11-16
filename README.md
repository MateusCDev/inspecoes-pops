# Inspeções POPs — GitHub Pages, Sheets e Drive

Aplicação baseada no pacote v2.2 enviado pelo usuário. O frontend é publicado a partir de `public/`. O código em `apps-script/` roda no Google, não no Pages.

## Estado da entrega

- O formulário, checklist, inventário e evidências da aplicação original foram preservados.
- Finalizar salva localmente e tenta enviar a inspeção completa.
- Sem internet/configuração/chave, o registro permanece pendente.
- O servidor cria um PDF e uma cópia JSON dos dados (sem os bytes das fotos), depois grava uma linha na aba `Inspecoes_POPs`.
- O PDF inclui as fotos disponíveis. A cópia JSON no Drive não substitui o backup portátil original, que também inclui os arquivos das fotos.
- Reenvio idêntico devolve a confirmação anterior; revisão mais nova atualiza a mesma linha. PDFs de revisões anteriores são mantidos como histórico.
- Nenhuma aba de inspeções histórica é sobrescrita. O script cria apenas a nova aba e valida o cabeçalho antes de escrever.
- A integração permanece INATIVA enquanto `public/config.js` não contiver a URL de uma implantação autorizada do Google Apps Script.

## Ativar o serviço Google (proprietário da planilha)

1. Na planilha fornecida, abra **Extensões → Apps Script**.
2. Crie os arquivos `Code.gs` e `schema.gs` e copie os conteúdos de `apps-script/`. O primeiro já aponta para a planilha e para a pasta criada para os PDFs.
3. Em Configurações do projeto, habilite a exibição de `appsscript.json` e substitua pelo manifesto deste pacote. Os escopos permitem operar a planilha e criar o documento temporário/PDF no Drive.
4. Execute `setup` no editor e autorize o acesso. Isso cria o cabeçalho da nova aba. Execute também `createOperatorKey` uma vez para cada pessoa autorizada. Cada execução mostra uma chave individual no log: entregue-a diretamente ao operador, nunca pelo repositório ou pela planilha. Limpe o log após entregá-la.
5. As chaves são credenciais de envio, NÃO senhas Google ou login corporativo. O servidor armazena apenas hashes SHA-256 em `TOKEN_HASHES` nas propriedades do script. Para revogar, remova o hash correspondente. Para nomear operadores, substitua o rótulo gerado automaticamente pelo nome desejado nas propriedades.
6. **Implantar → Nova implantação → Aplicativo da Web**. Executar como proprietário; acesso **Qualquer pessoa**, se a política do Workspace permitir. A URL é acessível, mas todo envio exige chave válida; não existe endpoint público de leitura dos registros. Caso a política da empresa proíba esse modo, usar uma API corporativa autenticada no lugar desta implantação, sem enfraquecer a configuração do Workspace.
7. Copie a URL que termina em `/exec` e coloque em `public/config.js`, em `google.endpoint`. Atualize o repositório. Modificações futuras no código do Apps Script exigem uma nova versão da implantação.
8. A pasta dos PDFs herda a política de compartilhamento do Drive. Conceda acesso apenas à equipe que precisa abrir os relatórios. A chave de envio não concede permissão para consultar a planilha ou os PDFs.

## Homologar antes do uso pela equipe

Crie uma inspeção fictícia pelo site, informe a chave no painel da aba Resumo e finalize. Confirme: uma linha na nova aba, um PDF legível com todas as fotos e link funcional. Reenvie sem alterações e confirme que não duplica. Edite, finalize e confira a atualização. Teste sem internet e reconexão; simule uma chave inválida e confirme que não grava nada. A integração precisa ser testada na origem real do Pages para confirmar redirecionamentos e CORS do Apps Script. Nunca usar `mode: no-cors`, pois isso impediria confirmar o recebimento.

Limites desta versão: 15 MB por envio, até 100 fotos, limites de execução e conversão do Apps Script. Uma falha mantém o registro pendente; não trate como sucesso antes de aparecer a confirmação. Conversões de imagens não suportadas pelo Google Docs devem ser corrigidas no cadastro e reenviadas. Os testes locais usam serviços simulados e não substituem a homologação no Google.

## Publicar no GitHub Pages

No repositório: **Settings → Pages → Source: GitHub Actions**. O workflow `.github/workflows/pages.yml` publica apenas `public/`. O backend não precisa ser copiado ao diretório público. O site não contém dados reais, chaves, senhas nem credenciais Google; o código do formulário é público.

Cada navegador guarda seus próprios dados; um novo endereço/origem/caminho pode exigir importar os backups JSON das inspeções antigas. O novo site não acessa o armazenamento da instalação anterior. A chave digitada fica só em memória e precisa ser informada novamente ao reabrir a página. Com a página aberta e a chave informada, a reconexão tenta reenviar pendências.

## Looker Studio

Conecte o Google Sheets à aba `Inspecoes_POPs`. Use `COUNT_DISTINCT(id_inspecao)` para inspeções. A taxa consolidada é `SUM(itens_conformes)/(SUM(itens_conformes)+SUM(itens_nao_conformes))`, com divisão por zero tratada como nulo. `NA` e `NV` são separados. Configure `data`, `scheduleBaseDate` e `scheduleDueDate` como datas `YYYY-MM-DD` (ou use `PARSE_DATE("%Y-%m-%d", campo)`). Os horários de recebimento/finalização são ISO UTC. As leituras preservam o texto original, inclusive unidades e valores como módulos ativos/total; converta só os campos estritamente numéricos que precisar nos gráficos.

Há uma coluna de situação e outra de observação por item do checklist. Pendências e inventário completos ficam em JSON; análises individuais por equipamento/pendência exigem tabelas auxiliares em uma evolução futura. Não somar a quantidade de equipamentos de todas as inspeções como se fosse o inventário atual. O código do POP é informado no Resumo para relacionar ao cadastro existente.

## Testes locais

`node --test tests/*.test.cjs`

Cobertura: cabeçalhos e alinhamento, validação de fotos e dados obrigatórios, neutralização de fórmulas, autorização antes da escrita, idempotência, atualização, conflitos, falha na geração do PDF, confirmação do frontend e preservação de alterações durante envio.
