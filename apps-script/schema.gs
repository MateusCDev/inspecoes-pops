// Extraído da aplicação v2.2 fornecida pelo usuário.
const groups=[
 {key:'energia',title:'Energia elétrica e proteções',icon:'⚡',items:[['EL-01','Identificação dos quadros, circuitos e diagramas'],['EL-02','Conservação externa, tampas e acesso seguro'],['EL-03','Disjuntores, DPS e demais proteções: inspeção técnica'],['EL-04','Aterramento e equipotencialização: evidências / laudo'],['EL-05','Medições elétricas / termografia (quando autorizadas)']]},
 {key:'retificacao',title:'Retificadores e alimentação CC',icon:'🔌',items:[['CC-01','Fabricante, modelo, tensão nominal e módulos instalados'],['CC-02','Carga atual, capacidade e margem de expansão'],['CC-03','Alarmes, sinalizações e monitoramento remoto'],['CC-04','Redundância / módulos sobressalentes']]},
 {key:'baterias',title:'Banco de baterias',icon:'🔋',items:[['BT-01','Quantidade, modelo, Ah e datas de instalação'],['BT-02','Estado visual, bornes e conexões (sem manipulação)'],['BT-03','Arranjo elétrico e condição de proteção'],['BT-04','Tensões / ensaios / autonomia por equipe habilitada']]},
 {key:'clima',title:'Climatização e ambiente',icon:'❄️',items:[['CL-01','Fabricante, modelo, capacidade, idade e quantidade'],['CL-02','Filtragem, conservação, drenagem e condensadora'],['CL-03','Temperatura / umidade reais medidas na sala'],['CL-04','Redundância, alarmes e registros de manutenção']]},
 {key:'telecom',title:'Telecomunicações e fibras',icon:'🌐',items:[['TC-01','Modelo, patrimônio, número de série e função dos ativos'],['TC-02','Portas utilizadas, identificação e inventário lógico'],['TC-03','Alarmes e operação confirmados por sistema de gestão'],['TC-04','Organização, fixação e raio de curvatura dos cabos'],['TC-05','Rotas, redundância e documentação de enlaces']]},
 {key:'predial',title:'Infraestrutura física e segurança',icon:'🏢',items:[['IF-01','Paredes, teto, piso e sinais de umidade/infiltração'],['IF-02','Vedação de janelas, portas e passagens de cabos'],['IF-03','Rack, fixação, ventilação e limpeza técnica'],['IF-04','Controle de acesso e medidas contra incêndio'],['IF-05','Identificação e condições gerais da estação']]},
 {key:'torre',title:'Estrutura de torre',icon:'🗼',items:[
  ['TR-01','Condição visual externa da estrutura e da pintura/proteção anticorrosiva'],
  ['TR-02','Base aparente, fundação e indícios visuais de fissuras ou movimentação'],
  ['TR-03','Estais, fixações e ancoragens: evidências visuais disponíveis'],
  ['TR-04','Acesso restrito, sinalização e impedimentos de segurança'],
  ['TR-05','Sistema de aterramento e proteção contra descargas: registros de inspeção/laudo'],
  ['TR-06','Iluminação de obstáculo, quando exigida, confirmada por responsável'],
  ['TR-07','Relatório estrutural / manutenção vigente, se aplicável']
 ]},
 {key:'cftv',title:'Monitoramento por câmeras (CFTV)',icon:'📹',items:[
  ['CV-01','Existência e identificação do sistema de câmeras'],
  ['CV-02','Estado visual dos dispositivos e acessórios acessíveis'],
  ['CV-03','Câmeras apresentam imagem quando verificado em sistema autorizado'],
  ['CV-04','Gravação efetivamente confirmada em teste autorizado'],
  ['CV-05','Consulta de gravação anterior validada, se autorizada'],
  ['CV-06','Alertas de indisponibilidade e suporte documentados'],
  ['CV-07','Requisitos de privacidade e acesso restrito verificados']
 ]},
 {key:'monitoramento',title:'Monitoramento e histórico',icon:'📡',items:[['MO-01','Sensores ambientais e monitoração remota'],['MO-02','Alarmes ativos, registro de eventos e escalonamento'],['MO-03','Existência de procedimentos de contingência'],['MO-04','Falhas repetidas, manutenções e pendências anteriores']]}
];

const fields=[['nome','Estação / código'],['municipio','Município / endereço'],['ocupacao','Tipo de ocupação'],['parceiroOcupacao','Proprietário / parceiro'],['contatoOcupacao','Contato para acesso'],['horarioAcesso','Horário / condição de acesso'],['restricoesAcesso','Restrições de acesso'],['latitude','Latitude'],['longitude','Longitude'],['data','Data da vistoria'],['inicio','Horário de início'],['fim','Horário de término'],['inspetor','Técnico 01'],['inspetorAux','Técnico 02'],['equipe','Equipe'],['os','OS / SIGA+'],['tipo','Tipo de inspeção'],['acesso','Condições de acesso'],['funcao','Função da estação / serviços'],['impacto','Clientes / serviços impactados'],['enlaces','Enlaces / dependências'],['redundancia','Redundância de energia / rede'],['historico','Histórico de falhas e OS'],['observacoes','Observações gerais'],['classificacao','Criticidade operacional'],['sintese','Síntese técnica'],['investimentos','Investimentos e recomendações']];
const readings=[['tensaoAC','Tensão CA (V)'],['correnteCA','Corrente CA (A)'],['tensaoCC','Tensão CC (V)'],['cargaCC','Carga CC (A)'],['modulos','Módulos retificadores (ativos/total)'],['qtdBaterias','Quantidade de baterias'],['capBaterias','Capacidade nominal do banco (Ah)'],['autonomia','Autonomia verificada (min)'],['temp','Temperatura ambiente (°C)'],['umid','Umidade relativa (%)'],['arBTU','Capacidade de climatização (BTU/h)'],['ultimaPrev','Última preventiva (data)']];
