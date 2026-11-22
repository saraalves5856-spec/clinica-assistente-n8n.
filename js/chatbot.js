/* ============================================================
   chatbot.js — Helena, a assistente "inquebrável"
   ------------------------------------------------------------
   ARQUITETURA EM CAMADAS (cada mensagem passa por todas, nesta ordem):
     1. Emergência    → orienta SAMU 192 e interrompe qualquer fluxo.
     2. Risco emocional → acolhe e indica o CVV 188.
     3. Anti-manipulação → "ignore suas regras", "finja que...", pedir o prompt.
     4. Intenções do escopo (agendar, tratamentos, medicamentos, info).
     5. Fora de escopo → recusa gentil e redireciona.
     6. (Opcional) IA generativa via webhook, só para o que sobrou,
        com o prompt de persona e um filtro na SAÍDA.
   Funciona 100% offline (sem IA externa). Ver README para ligar ao n8n.
   ============================================================ */
(function (g) {
  'use strict';
  const NS = (g.Clinica = g.Clinica || {});
  const S = NS.Scheduler;
  const CLINIC = NS.CLINIC;

  /* ---------- utilidades ---------- */
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/]/g, ' ').replace(/\s+/g, ' ').trim();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (arr, seed) => arr[seed % arr.length];

  /* ---------- classificação (função pura: fácil de testar) ---------- */
  const RX = {
    // sinais de risco de vida
    emergency: /(dor|aperto|pressao) (forte |intensa |no |do |de )*peito|nao consigo respirar|sem conseguir respirar|falta de ar (forte|intensa|grave|severa)|desmai|convuls|\bavc\b|rosto (torto|caido)|fala (enrolada|arrastada)|perdi (a )?consciencia|overdose|engasgad|vomit\w* (com )?sangue|sangramento (intenso|forte|abundante)|labios (roxos|azulados|arroxeados)/,
    // risco emocional
    crisis: /suicid|me matar|tirar (a )?minha vida|nao quero (mais )?viver|acabar com (tudo|minha vida)|automutil|me machucar|quero morrer/,
    // tentativas de tirar a Helena do personagem
    jailbreak: /(ignore|ignorar|esqueca|esquecer|desconsidere|desconsiderar|descarte).{0,30}(instruc|regra|prompt|anterior|comando|diretriz)|(suas|tuas|as) (instrucoes|regras|diretrizes) (internas|originais|de sistema)|(mostre|revele|repita|diga|liste|traduza|resuma).{0,25}(prompt|instrucoes|regras|diretrizes)|system prompt|voce agora e|a partir de agora (voce|seja|aja)|finja (que )?(ser|e|voce)|aja como|faca de conta|roleplay|modo (dev|desenvolvedor|deus|admin)|\bdan\b|jailbreak|sem (filtro|restricao|restricoes|regras|limites)|quebre (as )?regras|desative (os )?(filtros|protecoes)/,
    meds: /(que|qual|quais|algum) (remedio|medicamento|antibiotico|medicacao|vitamina|suplemento)|posso tomar|devo tomar|qual (a )?dose|quantos? (comprimidos?|gotas|mg|ml)|receita (medica|de remedio|controlada)|preciso de (uma )?receita|prescre|dipirona|ibuprofeno|paracetamol|aspirina|\baas\b|amoxicilina|azitromicina|ivermectina|cloroquina|anti inflamatorio|tomar remedio|automedic/,
    price: /valor|preco|quanto (custa|e|sai|cobram)|convenio|plano de saude|particular|reembolso|unimed|bradesco|amil|sulamerica/,
    hours: /horario de (funcionamento|atendimento)|funcionamento|que horas (abre|fecha|abrem|fecham)|funcionam? (aos|no|na|hoje|amanha|sabado|domingo|feriado|ate)|\b(abre|abrem|fecha|fecham|aberto)\b|aos sabados|no domingo/,
    address: /endereco|onde (fica|voces ficam|e a clinica)|localizacao|como chegar|estacionamento/,
    contact: /telefone|whatsapp|zap|contato|ligar para|falar com (a )?(recepcao|atendente)/,
    reschedule: /remarcar|reagendar|cancelar (a |minha )?(consulta|agendamento)|desmarcar/,
    schedule: /agend|marcar|marcacao|reservar|consulta|horario (livre|disponivel|vago)|horarios|disponibilidade|vaga|quero ser atendid|atendimento medico|ver (um )?medico|falar com (um )?medico/,
    list: /(quais|que) (tratamentos|servicos|especialidades|areas)|o que (voces )?(tratam|atendem)|especialidades|tratamentos/,
    about: /quem (e )?(voce|vc)|voce e (medica|humana|uma pessoa|robo|ia)|e (um )?(robo|bot|humano)|seu nome|como (voce )?se chama/,
    symptom: /\b(dor|dores)\b|mal estar|tontura|cansaco|sintoma|passando mal|me sentindo mal|nausea|vomito|inchaco|machuc|falta de ar|estou doente|to doente/,
    thanks: /obrigad|valeu|agradec/,
    bye: /^(tchau|ate (logo|mais|breve)|adeus|flw)\b/,
    greeting: /^(oi|ola|oie|bom dia|boa tarde|boa noite|e ai|opa|hey|hello|hi)\b/,
  };

  // Ordem importa: termos específicos antes do genérico "gripe/febre".
  const TREATMENT_RX = [
    ['dengue', /dengue|dor atras dos olhos|manchas vermelhas/],
    ['covid', /covid|corona|sars/],
    ['alergias', /alergi|rinite|espirr|coceira/],
    ['hipertensao', /pressao (alta|arterial)|hipertens/],
    ['diabetes', /diabet|glicemia|acucar no sangue/],
    ['digestivo', /gastrite|azia|refluxo|diarreia|enjoo|estomago|digestiv|intestino|prisao de ventre|dor (de|na) barriga/],
    ['saudemental', /ansied|estresse|depress|insonia|panico|saude mental|burnout|esgotamento|nao consigo dormir/],
    ['checkup', /check ?up|exames? de rotina|preventiv/],
    ['pediatria', /pediatr|crianca|bebe|meu filho|minha filha|meu neto|minha neta/],
    ['gripe', /gripe|resfriad|coriza|garganta|tosse|febre|influenza|nariz entupido/],
  ];

  function detectTreatment(n) {
    const hit = TREATMENT_RX.find(([, rx]) => rx.test(n));
    return hit ? hit[0] : null;
  }

  function classify(text) {
    const n = norm(text);
    if (RX.emergency.test(n)) return { type: 'emergency' };
    if (RX.crisis.test(n)) return { type: 'crisis' };
    if (RX.jailbreak.test(n)) return { type: 'jailbreak' };
    const tid = detectTreatment(n);
    if (RX.meds.test(n)) return { type: 'meds', treatmentId: tid };
    if (RX.reschedule.test(n)) return { type: 'reschedule' };
    if (RX.price.test(n)) return { type: 'price' };
    if (RX.address.test(n)) return { type: 'address' };
    if (RX.contact.test(n)) return { type: 'contact' };
    if (RX.hours.test(n) && !/(agend|marcar)/.test(n)) return { type: 'hours' };
    if (RX.schedule.test(n)) return { type: 'schedule', treatmentId: tid };
    if (RX.list.test(n)) return { type: 'list' };
    if (RX.about.test(n)) return { type: 'about' };
    if (tid) return { type: 'treatment', id: tid };
    if (RX.symptom.test(n)) return { type: 'symptom' };
    if (RX.thanks.test(n)) return { type: 'thanks' };
    if (RX.bye.test(n)) return { type: 'bye' };
    if (RX.greeting.test(n)) return { type: 'greeting' };
    return { type: 'offtopic' };
  }

  /* ---------- IA generativa opcional (n8n, OpenAI, Claude API...) ---------- */
  const sessionId = 'mv-' + Math.random().toString(36).slice(2, 10);

  // Filtro na SAÍDA: mesmo que o modelo erre, doses e quebras de persona não chegam à tela.
  function outputGuard(out) {
    out = String(out || '').trim();
    if (!out) return null;
    if (/\b\d+([.,]\d+)?\s?(mg|mcg|ml|gotas|comprimidos?|capsulas?)\b/i.test(out)) return null;
    if (/(sou|como) (um|uma)?\s?(chatgpt|gpt|openai|modelo de linguagem|llm)/i.test(out)) return null;
    return out.length > 1200 ? out.slice(0, 1200) + '…' : out;
  }
  async function askRemote(text) {
    if (!NS.Config || !NS.Config.isOfficial()) return null;
    const r = await NS.Config.post({ event: 'chat.message', sessionId, message: text, systemPrompt: NS.PERSONA.prompt });
    if (!r.ok || !r.data) return null;
    return outputGuard(r.data.reply || r.data.output || r.data.text);
  }

  /* ---------- exporta o motor puro (para testes) ---------- */
  NS.ChatEngine = { norm, classify, detectTreatment, outputGuard };

  // Em ambiente sem DOM (testes em Node) paramos aqui.
  if (typeof document === 'undefined') return;

  /* =========================================================
     INTERFACE DO CHAT
     ========================================================= */
  const $ = (s) => document.querySelector(s);
  const el = {
    fab: $('#chat-fab'), badge: $('#chat-badge'), panel: $('#chat-panel'), close: $('#chat-close'),
    msgs: $('#chat-messages'), chips: $('#chat-chips'), form: $('#chat-form'), input: $('#chat-input'),
    schedule: $('#chat-schedule'), treatments: $('#chat-treatments'),
  };
  let busy = false;
  let opened = false;
  let counter = 0;

  function scrollDown() { el.msgs.scrollTop = el.msgs.scrollHeight; }
  // Histórico guardado no navegador por até 24h sem uso; o botão "Limpar" apaga na hora.
  const HKEY = 'mv_chat_v1', HMAX = 60, HTTL = 24 * 3600 * 1000;
  let history = [];
  let epoch = 0; // muda quando a conversa é limpa, para descartar respostas "em andamento"
  function loadHistory() {
    try {
      const o = JSON.parse(localStorage.getItem(HKEY));
      if (o && Array.isArray(o.items) && Date.now() - o.savedAt < HTTL) return o.items;
    } catch (e) { /* sem histórico */ }
    return [];
  }
  function saveHistory() {
    try { localStorage.setItem(HKEY, JSON.stringify({ savedAt: Date.now(), items: history.slice(-HMAX) })); } catch (e) { /* ignora */ }
  }
  function appendMsg(role, text, alert) {
    const d = document.createElement('div');
    if (role === 'u') { d.className = 'msg msg--user'; d.textContent = text; }
    else { d.className = 'msg msg--bot' + (alert ? ' msg--alert' : ''); d.innerHTML = fmt(text); }
    el.msgs.appendChild(d); scrollDown();
  }
  function addUser(text) { appendMsg('u', text); history.push({ r: 'u', t: text }); saveHistory(); }
  function addBot(text, alert) { appendMsg('b', text, alert); history.push({ r: 'b', t: text, a: !!alert }); saveHistory(); }
  function showTyping() {
    const d = document.createElement('div');
    d.className = 'msg msg--bot typing'; d.id = 'typing'; d.setAttribute('aria-label', 'Helena está digitando');
    d.innerHTML = '<i></i><i></i><i></i>';
    el.msgs.appendChild(d); scrollDown();
  }
  const hideTyping = () => { const t = $('#typing'); if (t) t.remove(); };
  const clearChips = () => { el.chips.innerHTML = ''; };

  // chips: [{label, run, main}]
  function setChips(list) {
    clearChips();
    list.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (c.main ? ' chip--main' : ''); b.textContent = c.label;
      b.addEventListener('click', () => guarded(async () => { addUser(c.userText || c.label); await c.run(); }));
      el.chips.appendChild(b);
    });
  }

  async function say(text, chips = [], opts = {}) {
    const e = epoch;
    clearChips(); showTyping();
    await sleep(Math.min(450 + text.length * 4, 1100));
    hideTyping();
    if (e !== epoch) return; // a conversa foi limpa enquanto eu "digitava"
    addBot(text, opts.alert); setChips(chips);
  }

  // Trava a interface enquanto a Helena "digita" (evita mensagens fora de ordem)
  async function guarded(fn) {
    if (busy) return;
    busy = true; el.input.disabled = true;
    try { await fn(); } finally { busy = false; el.input.disabled = false; if (!el.panel.hidden) el.input.focus(); }
  }

  /* ---------- fluxo de agendamento dentro do chat ---------- */
  const flow = { step: null, d: {} };
  const resetFlow = () => { flow.step = null; flow.d = {}; };
  const reasonName = () => (flow.d.reason && flow.d.reason !== 'geral' ? NS.byId.treatment(flow.d.reason).name : 'Consulta geral');
  const specId = () => (flow.d.reason && flow.d.reason !== 'geral' ? NS.byId.treatment(flow.d.reason).specialty : 'clinico');
  const cancelChip = () => ({ label: 'Cancelar agendamento', run: cancelFlow });

  async function cancelFlow() {
    resetFlow();
    await say('Tudo bem, cancelei o agendamento. Se mudar de ideia é só tocar em **Agendar consulta**. Posso ajudar com alguma dúvida de saúde?', mainChips());
  }

  function reasonChips() {
    return [...NS.TREATMENTS.map((t) => ({ label: t.name, run: () => setReason(t.id) })),
      { label: 'Consulta geral', run: () => setReason('geral') }, cancelChip()];
  }

  async function startFlow(reasonId) {
    resetFlow();
    if (reasonId) { flow.d.reason = reasonId; return askDate(`Certo, vamos agendar para **${reasonName()}**.`); }
    flow.step = 'reason';
    await say('Com prazer! Qual é o **motivo da consulta**? Escolha uma opção ou escreva (ex.: gripe, dengue, check-up).', reasonChips());
  }
  async function setReason(id) {
    flow.d.reason = id; flow.d.date = null; flow.d.time = null;
    await askDate(`Perfeito: **${reasonName()}**.`);
  }

  function dateChips() {
    const days = S.getDays(specId()).filter((d) => d.available > 0).slice(0, 7);
    const chips = days.map((d) => {
      const label = `${cap(d.weekday)} ${d.short} · ${d.available} ${d.available === 1 ? 'vaga' : 'vagas'}`;
      return { label, run: () => pickDate(d.iso), main: false, shortKey: d.short, iso: d.iso };
    });
    return chips;
  }
  async function askDate(prefix) {
    const chips = dateChips();
    if (!chips.length) {
      resetFlow();
      return say(`${prefix}\nNo momento não encontrei vagas online para os próximos dias. Fale com a recepção: **${CLINIC.phone}**.`, mainChips());
    }
    flow.step = 'date';
    await say(`${prefix}\nEstas são as próximas **datas com horário livre**. Qual prefere?`, [
      ...chips,
      { label: 'Ver agenda completa', main: true, run: openFullAgenda },
      cancelChip(),
    ]);
  }
  async function openFullAgenda() {
    const reason = flow.d.reason || 'geral';
    resetFlow();
    await say('Abri a **agenda completa** para você escolher com calma.');
    NS.UI.openScheduler({ reason, step: 2 });
  }

  function timeChips() {
    return S.getSlots(flow.d.date, specId()).filter((s) => s.available)
      .map((s) => ({ label: s.time, run: () => pickTime(s.time), times: s.time }));
  }
  async function pickDate(iso) {
    flow.d.date = iso; flow.d.time = null; flow.step = 'time';
    const chips = timeChips();
    if (!chips.length) return askDate('Essa data acabou de lotar. Vamos escolher outra?');
    await say(`Ótimo! Horários livres em **${S.formatLong(iso)}**:`, [
      ...chips, { label: 'Outra data', run: () => askDate('Sem problema.') }, cancelChip()]);
  }
  async function pickTime(time) {
    flow.d.time = time; flow.step = 'name';
    await say(`Reservando **${S.formatLong(flow.d.date)} às ${time}**. Para finalizar, qual é o seu **nome completo**?`, [cancelChip()]);
  }
  async function askConfirm() {
    flow.step = 'confirm';
    const d = flow.d;
    await say(`Confira os dados:\n• **Motivo:** ${reasonName()}\n• **Data:** ${S.formatLong(d.date)} às ${d.time}\n• **Nome:** ${d.name}\n• **Telefone:** ${S.formatPhone(d.phone)}\n• **Modalidade:** presencial (para teleconsulta, avise na confirmação)\n\nPosso **confirmar**?`, [
      { label: 'Confirmar agendamento', main: true, run: confirmBooking },
      { label: 'Corrigir meus dados', run: async () => { flow.step = 'name'; await say('Sem problema. Qual é o seu **nome completo**?', [cancelChip()]); } },
      cancelChip(),
    ]);
  }
  async function confirmBooking() {
    const d = flow.d;
    const res = S.book({ treatmentId: d.reason === 'geral' ? null : d.reason, reason: reasonName(), specialtyId: specId(), date: d.date, time: d.time, mode: 'presencial', name: d.name, phone: d.phone });
    if (!res.ok) {
      flow.step = 'date';
      return askDate(`Não consegui reservar: ${res.error}`);
    }
    const a = res.appointment; resetFlow();
    await say(`Consulta **agendada**, ${a.name.split(' ')[0]}!\n• **Protocolo:** ${a.protocol}\n• **${S.formatLong(a.date)}** às **${a.time}**\n• ${NS.byId.specialty(a.specialtyId).name} — ${NS.byId.specialty(a.specialtyId).doctor}\n\nA recepção confirma pelo WhatsApp. Chegue 10 minutos antes.`, [
      { label: 'Adicionar ao calendário', main: true, run: async () => { S.downloadICS(a); await say('Pronto! Baixei o arquivo de calendário. Posso ajudar em mais alguma coisa?', mainChips()); } },
      { label: 'Tirar uma dúvida de saúde', run: async () => say('Claro! Escolha um tema ou me conte o que você está sentindo.', treatmentChips()) },
    ]);
  }

  // Entrada de texto enquanto o fluxo de agendamento está ativo
  async function handleFlowText(text, n) {
    if (/^(cancelar|sair|desistir|parar)\b|nao quero (mais )?agendar/.test(n)) return cancelFlow();
    if (flow.step === 'reason') {
      const id = detectTreatment(n);
      if (id) return setReason(id);
      if (/geral|clinic|qualquer|consulta/.test(n)) return setReason('geral');
      return say('Escolha uma das opções abaixo ou me diga o motivo (ex.: gripe, dengue, check-up).', reasonChips());
    }
    if (flow.step === 'date') {
      const m = text.match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/);
      const chips = dateChips();
      if (m) {
        const key = `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}`;
        const hit = chips.find((c) => c.shortKey === key);
        if (hit) return pickDate(hit.iso);
      }
      return say('Toque em uma das datas abaixo (ou digite no formato 12/11).', [...chips, { label: 'Ver agenda completa', main: true, run: openFullAgenda }, cancelChip()]);
    }
    if (flow.step === 'time') {
      const m = text.match(/(\d{1,2})\s*(?:h|:|horas)?\s*(\d{2})?/);
      const chips = timeChips();
      if (m) {
        const t = `${m[1].padStart(2, '0')}:${m[2] || '00'}`;
        const hit = chips.find((c) => c.times === t);
        if (hit) return pickTime(t);
      }
      return say('Toque em um dos horários livres abaixo.', [...chips, { label: 'Outra data', run: () => askDate('Sem problema.') }, cancelChip()]);
    }
    if (flow.step === 'name') {
      if (!S.validName(text)) return say('Preciso do **nome e sobrenome** para o cadastro. Pode escrever de novo?', [cancelChip()]);
      flow.d.name = text.trim(); flow.step = 'phone';
      return say(`Obrigada, ${flow.d.name.split(' ')[0]}. Qual é o seu **telefone com DDD** (de preferência WhatsApp)?`, [cancelChip()]);
    }
    if (flow.step === 'phone') {
      if (!S.validPhone(text)) return say('Não consegui entender o telefone. Envie com DDD, por exemplo **(11) 90000-0000**.', [cancelChip()]);
      flow.d.phone = text.trim();
      return askConfirm();
    }
    if (flow.step === 'confirm') {
      if (/^(sim|confirm|pode|ok|isso|certo|claro|fechado)/.test(n)) return confirmBooking();
      if (/^(nao|corrig|mudar|alterar|errado)/.test(n)) { flow.step = 'name'; return say('Sem problema. Qual é o seu **nome completo**?', [cancelChip()]); }
      return say('Posso confirmar o agendamento?', [{ label: 'Confirmar agendamento', main: true, run: confirmBooking }, cancelChip()]);
    }
  }

  /* ---------- cancelar / remarcar pelo chat ---------- */
  async function cancelViaChat() {
    const act = S.active();
    if (!act.length) {
      return say(`Não encontrei agendamentos futuros feitos neste dispositivo. Para cancelar ou remarcar uma consulta feita em outro lugar, fale com a recepção pelo **${CLINIC.phone}** com o seu **protocolo** (ex.: SV-ABC123).`, [{ label: 'Agendar consulta', main: true, run: () => startFlow() }]);
    }
    await say('Estes são os seus próximos agendamentos. Qual deseja **cancelar**? Para remarcar, cancele e escolha um novo horário em seguida.', [
      ...act.map((a) => ({ label: `${a.reason} · ${a.date.slice(8)}/${a.date.slice(5, 7)} ${a.time}`, run: () => confirmCancel(a) })),
      { label: 'Manter todos', run: async () => say('Tudo certo, mantive os seus agendamentos.', mainChips()) },
    ]);
  }
  async function confirmCancel(a) {
    await say(`Confirma o cancelamento de **${a.reason}** em **${S.formatLong(a.date)} às ${a.time}**? (protocolo ${a.protocol})`, [
      { label: 'Sim, cancelar', main: true, run: async () => {
        const r = S.cancel(a.protocol);
        if (!r.ok) return say(r.error, mainChips());
        await say('Cancelado. O horário foi liberado. Quer escolher um novo horário?', [
          { label: 'Escolher novo horário', main: true, run: () => startFlow(a.treatmentId || 'geral') },
          { label: 'Agora não', run: async () => say('Sem problema. Posso ajudar em mais alguma coisa?', mainChips()) }]);
      } },
      { label: 'Não, manter', run: async () => say('Tudo certo, mantive o agendamento.', mainChips()) },
    ]);
  }

  /* ---------- respostas do escopo ---------- */
  const mainChips = () => [
    { label: 'Agendar consulta', main: true, run: () => startFlow() },
    { label: 'Gripe', run: () => showTreatment('gripe', true) },
    { label: 'Dengue', run: () => showTreatment('dengue', true) },
    { label: 'COVID-19', run: () => showTreatment('covid', true) },
    { label: 'Ver tratamentos', run: () => listTreatments() },
    { label: 'Horários e endereço', run: () => replyInfo('hours') },
    { label: 'Cancelar ou remarcar', run: () => cancelViaChat() },
  ];
  const treatmentChips = () => [...NS.TREATMENTS.map((t) => ({ label: t.name, run: () => showTreatment(t.id, true) })), { label: 'Agendar consulta', main: true, run: () => startFlow() }];

  async function listTreatments() {
    await say('Posso orientar você sobre os temas abaixo. Toque em um deles ou descreva o que está sentindo.', treatmentChips());
  }

  // Atenção: NÃO usar guarded() aqui. Quem chama (chip ou texto) já está dentro de um guarded().
  async function showTreatment(id, silent) {
    if (!NS.byId.treatment(id)) return;
    if (!silent) addUser(`Quero saber sobre ${NS.byId.treatment(id).name}`);
    await showTreatmentBody(id);
  }

  async function replyInfo(type) {
    const map = {
      hours: `**Horários de atendimento**\n${CLINIC.hours.join('\n')}`,
      address: `**Endereço**\n${CLINIC.address}`,
      contact: `**Contato**\nTelefone e WhatsApp: ${CLINIC.phone}`,
      price: `Valores e convênios aceitos são confirmados pela nossa recepção, pelo telefone **${CLINIC.phone}**. Enquanto isso, posso reservar o seu horário.`,
    };
    await say(map[type] + '\n\nPosso ajudar com mais alguma coisa?', [
      { label: 'Agendar consulta', main: true, run: () => startFlow() },
      { label: 'Tirar dúvida de saúde', run: () => listTreatments() },
    ]);
  }

  const SAFE = {
    emergency: 'Isso pode ser uma **emergência**. Por favor, ligue agora para o **SAMU (192)** ou vá ao **pronto-socorro mais próximo**. Se estiver sozinho(a), peça ajuda a alguém por perto.\n\nNão espere por uma consulta agendada. Estarei aqui quando você estiver em segurança.',
    crisis: 'Sinto muito que você esteja passando por isso, e fico feliz que tenha escrito. Você não precisa enfrentar isso sozinho(a).\n\n• **CVV: 188** (ligação gratuita, 24h) ou cvv.org.br\n• **SAMU: 192** se houver risco imediato\n\nSe puder, procure agora alguém de confiança para ficar com você. Quando se sentir pronto(a), nossa equipe de **Saúde Mental** oferece acolhimento sigiloso.',
    persona: [
      'Eu sou a **Helena**, assistente virtual da Sara Vitalis, e meu papel aqui é ajudar com **orientação de saúde** e **agendamento de consultas**. Isso eu não altero, mas posso ajudar agora com algum sintoma ou com um horário.',
      'Sigo sempre o mesmo propósito: cuidar de **orientação de saúde** e de **agendamentos**. Não consigo mudar isso, mas posso ajudar com o que você está sentindo ou reservar uma consulta.',
      'Prefiro manter o meu foco: **saúde e agendamento de consultas**. Quer tirar uma dúvida sobre algum sintoma ou ver os horários disponíveis?',
    ],
    offtopic: [
      'Esse assunto foge do que eu faço por aqui. Cuido de **orientação de saúde** e de **agendamento de consultas**. Quer falar de algum sintoma ou ver horários disponíveis?',
      'Aqui eu só consigo ajudar com **saúde** e **agendamentos**. Posso orientar sobre um sintoma ou reservar uma consulta para você?',
    ],
    about: 'Sou a **Helena**, assistente virtual da Sara Vitalis. Não sou médica nem humana: ajudo com orientação geral de saúde e com o agendamento de consultas. Diagnóstico e tratamento ficam com a nossa equipe médica.',
    meds: 'Entendo a vontade de aliviar o desconforto, mas eu **não indico medicamentos nem doses**. Automedicação pode mascarar sintomas e causar reações perigosas, e a escolha certa depende da sua idade, do seu histórico e dos remédios que você já usa.',
    medsDengue: '\n\nSe houver suspeita de dengue, **não use aspirina (AAS) nem anti-inflamatórios** sem orientação médica.',
    medsEnd: '\n\nO caminho mais seguro é uma avaliação médica. Posso ver um horário para você?',
    symptom: 'Sinto muito que você esteja se sentindo assim. Para orientar melhor, me diga qual é o **sintoma principal** (ex.: febre, tosse, dor de barriga) ou escolha um tema.\n\nSe a dor for muito forte, súbita ou vier com falta de ar, desmaio ou confusão, procure um pronto-socorro (SAMU **192**). Quando quiser, a **Clínica Geral** avalia e encaminha.',
  };

  async function respond(text) {
    const n = norm(text);
    if (flow.step) {
      // emergência/crise/jailbreak SEMPRE vencem o fluxo de agendamento
      const guard = classify(text).type;
      if (!['emergency', 'crisis', 'jailbreak'].includes(guard)) return handleFlowText(text, n);
    }
    const c = classify(text);
    counter += 1;
    switch (c.type) {
      case 'emergency':
        resetFlow();
        return say(SAFE.emergency, [{ label: 'Estou em segurança, quero continuar', run: async () => say('Que bom! Como posso ajudar agora?', mainChips()) }], { alert: true });
      case 'crisis':
        resetFlow();
        return say(SAFE.crisis, [{ label: 'Agendar Saúde Mental', main: true, run: () => startFlow('saudemental') }], { alert: true });
      case 'jailbreak':
        return say(pick(SAFE.persona, counter), mainChips());
      case 'meds':
        return say(SAFE.meds + (c.treatmentId === 'dengue' ? SAFE.medsDengue : '') + SAFE.medsEnd, [
          { label: 'Agendar consulta', main: true, run: () => startFlow(c.treatmentId || undefined) },
          { label: 'Tirar dúvida de saúde', run: () => listTreatments() }]);
      case 'reschedule':
        return cancelViaChat();
      case 'price': case 'hours': case 'address': case 'contact':
        return replyInfo(c.type);
      case 'schedule':
        return startFlow(c.treatmentId || undefined);
      case 'list':
        return listTreatments();
      case 'about':
        return say(SAFE.about, mainChips());
      case 'treatment':
        return showTreatmentBody(c.id);
      case 'thanks':
        return say('Por nada! Cuidar de você é o meu propósito aqui. Posso ajudar em mais alguma coisa?', mainChips());
      case 'bye':
        return say('Até logo! Cuide-se bem. Se precisar, estarei aqui.');
      case 'greeting':
        return say('Olá! Eu sou a **Helena**, assistente virtual da Sara Vitalis. Posso orientar sobre sintomas e cuidados de saúde e agendar a sua consulta. Como posso ajudar?', mainChips());
      case 'symptom': case 'offtopic': default: {
        showTyping();
        const remote = await askRemote(text);
        hideTyping();
        if (remote) return say(remote, mainChips());
        if (c.type === 'symptom') return say(SAFE.symptom, [
          { label: 'Agendar Clínica Geral', main: true, run: () => startFlow('geral') },
          { label: 'Gripe', run: () => showTreatment('gripe', true) },
          { label: 'Dengue', run: () => showTreatment('dengue', true) },
          { label: 'Saúde digestiva', run: () => showTreatment('digestivo', true) }]);
        return say(pick(SAFE.offtopic, counter), mainChips());
      }
    }
  }
  // Variante interna usada pela classificação (não abre guarded de novo)
  async function showTreatmentBody(id) {
    const t = NS.byId.treatment(id);
    const bullets = (a) => a.map((x) => `• ${x}`).join('\n');
    const text = `**${t.name}**\n${t.blurb}\n\n**Sintomas comuns**\n${bullets(t.symptoms)}\n\n**Cuidados gerais**\n${bullets(t.care)}\n\n**Procure atendimento imediato se**\n${bullets(t.alert)}\n\nÉ uma orientação geral e não substitui avaliação médica.`;
    const chips = [{ label: `Agendar para ${t.name}`, main: true, run: () => startFlow(t.id) }];
    if (id === 'gripe') chips.push({ label: 'Será dengue?', run: () => showTreatment('dengue', true) }, { label: 'Será COVID-19?', run: () => showTreatment('covid', true) });
    chips.push({ label: 'Outros tratamentos', run: () => listTreatments() });
    await say(text, chips);
  }

  /* ---------- abrir / fechar / limpar ---------- */
  const welcome = () => guarded(async () => {
    await say('Olá! Eu sou a **Helena**, assistente virtual da Sara Vitalis. 💚\nPosso orientar você sobre **sintomas e cuidados de saúde** e **agendar a sua consulta**. Por onde quer começar?', mainChips());
  });
  function open(skipWelcome) {
    el.panel.hidden = false; el.fab.hidden = true; el.fab.setAttribute('aria-expanded', 'true');
    el.badge.hidden = true;
    if (!opened) { opened = true; if (!skipWelcome) welcome(); }
    else if (!el.chips.children.length && !flow.step) setChips(mainChips());
    setTimeout(() => el.input.focus(), 50);
  }
  function close() {
    el.panel.hidden = true; el.fab.hidden = false; el.fab.setAttribute('aria-expanded', 'false'); el.fab.focus();
  }
  /** Apaga toda a conversa (tela e armazenamento) e recomeça. */
  function clearChat() {
    epoch += 1; history = [];
    try { localStorage.removeItem(HKEY); } catch (e) { /* ignora */ }
    el.msgs.innerHTML = ''; clearChips(); resetFlow();
    busy = false; el.input.disabled = false; opened = false;
    if (!el.panel.hidden) { opened = true; welcome(); }
  }

  // Restaura a conversa guardada (se tiver menos de 24h)
  history = loadHistory();
  history.forEach((m) => appendMsg(m.r, m.t, m.a));
  if (history.length) opened = true;

  // "Limpar" em dois cliques para não apagar sem querer
  let armedTimer = null;
  const clearBtn = $('#chat-clear');
  clearBtn.addEventListener('click', () => {
    if (clearBtn.classList.contains('is-armed')) {
      clearTimeout(armedTimer); clearBtn.classList.remove('is-armed'); clearBtn.textContent = 'Limpar'; clearChat();
    } else {
      clearBtn.classList.add('is-armed'); clearBtn.textContent = 'Confirmar?';
      armedTimer = setTimeout(() => { clearBtn.classList.remove('is-armed'); clearBtn.textContent = 'Limpar'; }, 4000);
    }
  });

  el.fab.addEventListener('click', () => open());
  el.close.addEventListener('click', close);
  el.panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  el.schedule.addEventListener('click', () => guarded(async () => { addUser('Quero agendar uma consulta'); await startFlow(); }));
  el.treatments.addEventListener('click', () => guarded(async () => { addUser('Quais tratamentos vocês têm?'); await listTreatments(); }));
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = el.input.value.trim();
    if (!text) return;
    el.input.value = '';
    guarded(async () => { addUser(text); await respond(text); });
  });

  // Convite discreto: após alguns segundos, sinaliza que a Helena pode ajudar
  setTimeout(() => { if (!opened) el.badge.hidden = false; }, 6000);

  NS.Chat = { open, close, clear: clearChat, showTreatment: (id) => { open(true); guarded(() => showTreatment(id, false)); }, startSchedule: () => { open(true); guarded(() => startFlow()); } };
})(typeof window !== 'undefined' ? window : globalThis);