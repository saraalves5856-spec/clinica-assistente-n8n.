# Sara Vitalis — site de clínica com a assistente Helena

## Estrutura
- `index.html` / `css/styles.css` — layout e identidade visual
- `js/data.js` — tratamentos, especialidades, telefone e endereço (edite aqui)
- `js/config.js` — chave de ativação e endereço do webhook (modo oficial)
- `js/scheduler.js` — agenda, cancelamento, histórico e sincronização
- `js/persona.js` — persona e prompt de sistema da Helena
- `js/chatbot.js` — chat, proteções, histórico e fluxo de agendamento
- `js/app.js` — interações do site, "Meus agendamentos" e "Configurações"

## Modo demonstração x Site oficial
- Sem endereço + chave: agendamentos e conversa ficam só no navegador de cada visitante.
- Com endereço (https) + chave (8+ caracteres): o site envia eventos ao seu servidor/n8n.
  Eventos (POST JSON, cabeçalho `X-API-Key`): `ping`, `appointment.created`, `appointment.canceled`, `chat.message`.
  Use o protocolo (`appointment.protocol`) como identificador único (upsert) no seu banco/planilha.
  No n8n, libere o CORS do seu domínio no nó Webhook.
- Para ativar: rodapé > Configurações (ou `index.html#admin`). Vale só para aquele navegador.
  Para valer para todos, cole o trecho gerado no topo de `js/config.js`.
- A chave fica visível no navegador. Segredos reais (OpenAI, banco) ficam só dentro do n8n.

## Memória
- Agendamentos e cancelamentos: guardados no navegador (localStorage) e, no modo oficial, também no servidor.
  Pendências (sem internet) são reenviadas automaticamente.
- Conversa da Helena: guardada por até 24h sem uso. Botão "Limpar" no chat apaga na hora.
