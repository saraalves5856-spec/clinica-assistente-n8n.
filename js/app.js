/* ============================================================
   app.js — Interações do site (hero, tratamentos, modais,
   assistente de agendamento). O chat fica em js/chatbot.js.
   ============================================================ */
(function (g) {
  'use strict';
  const NS = g.Clinica;
  const { TREATMENTS, CATEGORIES, CLINIC, SPECIALTIES } = NS;
  const S = NS.Scheduler;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const li = (arr) => arr.map((x) => `<li>${esc(x)}</li>`).join('');

  /* ---------- cabeçalho, menu e animações de entrada ---------- */
  const header = $('#header');
  const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('#burger');
  const nav = $('#nav');
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }
  });

  // Revelar ao rolar (IntersectionObserver é leve e não trava a rolagem)
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach((el) => io.observe(el));
  } else { revealEls.forEach((el) => el.classList.add('is-in')); }

  // Contadores do hero
  $$('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min((t - t0) / 1400, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  /* ---------- contato ---------- */
  $('#contact-list').innerHTML = `
    <div><dt>Endereço</dt><dd>${esc(CLINIC.address)}</dd></div>
    <div><dt>Telefone e WhatsApp</dt><dd><a class="link" href="https://wa.me/${CLINIC.whatsapp}" target="_blank" rel="noopener">${esc(CLINIC.phone)}</a></dd></div>
    <div><dt>Horários</dt><dd>${CLINIC.hours.map(esc).join('<br>')}</dd></div>`;

  /* ---------- próximo horário no hero ---------- */
  const nextSlot = S.nextAvailable('clinico');
  $('#next-slot').innerHTML = nextSlot
    ? `${esc(S.formatLong(nextSlot.date))}<small>às ${nextSlot.time} · Clínica Geral</small>`
    : `Agenda em atualização<small>Fale com a recepção: ${esc(CLINIC.phone)}</small>`;
  if (!nextSlot) $('#next-slot-btn').disabled = true;

  /* ---------- tratamentos: filtro + cartões ---------- */
  let activeCat = 'todos';
  function renderFilters() {
    $('#filters').innerHTML = CATEGORIES.map((c) =>
      `<button class="pill" data-cat="${c.id}" aria-pressed="${c.id === activeCat}">${esc(c.name)}</button>`).join('');
  }
  function renderGrid() {
    const list = TREATMENTS.filter((t) => activeCat === 'todos' || t.category === activeCat);
    $('#treatment-grid').innerHTML = list.map((t) => {
      const n = String(TREATMENTS.indexOf(t) + 1).padStart(2, '0');
      return `<button class="tcard" data-treatment="${t.id}" aria-label="Ver detalhes de ${esc(t.name)}">
        <span class="tcard__n">Nº ${n}</span><h3>${esc(t.name)}</h3><p>${esc(t.blurb)}</p>
        <span class="tcard__more">Saiba mais →</span></button>`;
    }).join('');
  }
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    activeCat = b.dataset.cat; renderFilters(); renderGrid();
  });
  $('#treatment-grid').addEventListener('click', (e) => {
    const c = e.target.closest('[data-treatment]');
    if (c) openTreatment(c.dataset.treatment);
  });
  renderFilters(); renderGrid();

  /* ---------- infraestrutura de modal ---------- */
  const root = $('#modal-root');
  let lastFocus = null;

  function openModal() {
    if (root.hidden) lastFocus = document.activeElement;
    root.hidden = false;
    document.body.style.overflow = 'hidden';
    root.innerHTML = '<div class="modal" role="dialog" aria-modal="true" tabindex="-1"><button class="modal__x" data-close aria-label="Fechar">×</button><div class="modal__body"></div></div>';
    const modal = $('.modal', root);
    modal.focus();
    return $('.modal__body', root);
  }
  function closeModal() {
    root.hidden = true; root.innerHTML = '';
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  root.addEventListener('click', (e) => { if (e.target === root || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) closeModal(); });

  /* ---------- modal de tratamento ---------- */
  function openTreatment(id) {
    const t = NS.byId.treatment(id);
    if (!t) return;
    const spec = NS.byId.specialty(t.specialty);
    const body = openModal();
    body.innerHTML = `
      <p class="eyebrow eyebrow--dark">${esc(spec.name)}</p>
      <h2>${esc(t.name)}</h2>
      <p class="modal__lead">${esc(t.blurb)}</p>
      <div class="cols">
        <div><h4>Sintomas comuns</h4><ul class="list">${li(t.symptoms)}</ul></div>
        <div><h4>Cuidados gerais</h4><ul class="list">${li(t.care)}</ul></div>
      </div>
      <div class="box box--alert"><h4>Procure atendimento imediato se</h4><ul class="list">${li(t.alert)}</ul></div>
      <div class="box"><h4>Como a Sara Vitalis cuida</h4><p>${esc(t.clinic)}</p></div>
      <div class="modal__actions">
        <button class="btn btn--gold" data-act="schedule">Agendar para ${esc(t.name)}</button>
        <button class="btn btn--ghost-dark" data-act="chat">Tirar dúvidas com a Helena</button>
      </div>
      <p class="disclaimer">Informação geral e educativa. Não substitui avaliação médica. Em emergência, ligue 192 (SAMU).</p>`;
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'schedule') openScheduler({ reason: t.id, step: 2 });
      if (b.dataset.act === 'chat') { closeModal(); if (NS.Chat) NS.Chat.showTreatment(t.id); }
    });
  }

  /* ---------- assistente de agendamento (4 etapas) ---------- */
  const REASONS = [...TREATMENTS.map((t) => ({ id: t.id, name: t.name })), { id: 'geral', name: 'Consulta geral' }];
  const STEP_LABELS = ['Atendimento', 'Data e horário', 'Seus dados'];

  function openScheduler(opts = {}) {
    const w = {
      step: opts.step || 1, reason: opts.reason || null, mode: 'presencial',
      date: opts.date || null, time: opts.time || null,
      name: '', phone: '', email: '', consent: false, error: '', done: null,
    };
    if (!w.reason) w.step = 1;
    const body = openModal();

    const reasonName = () => (REASONS.find((r) => r.id === w.reason) || {}).name || '';
    const specialtyId = () => (w.reason && w.reason !== 'geral' ? NS.byId.treatment(w.reason).specialty : 'clinico');
    const modeName = () => (w.mode === 'teleconsulta' ? 'Teleconsulta' : 'Presencial');

    const stepper = () => `<ol class="wizard__steps" aria-label="Etapas">${STEP_LABELS.map((l, i) =>
      `<li class="${i + 1 < w.step ? 'is-done' : i + 1 === w.step ? 'is-now' : ''}">${i + 1}. ${l}</li>`).join('')}</ol>`;

    const summary = () => {
      const spec = NS.byId.specialty(specialtyId());
      let s = `<strong>${esc(reasonName())}</strong> · ${esc(spec.name)} com ${esc(spec.doctor)} · ${modeName()}`;
      if (w.date && w.time) s += `<br>${esc(S.formatLong(w.date))} às <strong>${w.time}</strong>`;
      return `<div class="summary">${s}</div>`;
    };

    function render() {
      if (w.done) return renderDone();
      if (w.step === 1) {
        body.innerHTML = `<h2>Agendar consulta</h2>${stepper()}
          <span class="label">Qual o motivo da consulta?</span>
          <div class="opts">${REASONS.map((r) => `<button class="opt" data-act="reason" data-id="${r.id}" aria-pressed="${w.reason === r.id}">${esc(r.name)}</button>`).join('')}</div>
          <span class="label">Modalidade</span>
          <div class="opts">
            <button class="opt" data-act="mode" data-id="presencial" aria-pressed="${w.mode === 'presencial'}">Presencial</button>
            <button class="opt" data-act="mode" data-id="teleconsulta" aria-pressed="${w.mode === 'teleconsulta'}">Teleconsulta</button>
          </div>
          ${w.reason ? summary() : ''}
          <div class="wizard__nav"><span></span><button class="btn btn--emerald" data-act="next" ${w.reason ? '' : 'disabled'}>Escolher data →</button></div>`;
      } else if (w.step === 2) {
        const sid = specialtyId();
        const days = S.getDays(sid);
        const slots = w.date ? S.getSlots(w.date, sid) : [];
        body.innerHTML = `<h2>Data e horário</h2>${stepper()}${summary()}
          <span class="label">Datas disponíveis</span>
          <div class="dates" role="group" aria-label="Datas">${days.map((d) => `
            <button class="date" data-act="date" data-id="${d.iso}" aria-pressed="${w.date === d.iso}" ${d.available ? '' : 'disabled'}>
              <small>${esc(d.weekday)}</small><b>${d.day}</b><small>${esc(d.month)}</small>
              <i>${d.available ? d.available + (d.available === 1 ? ' vaga' : ' vagas') : 'lotado'}</i></button>`).join('')}</div>
          ${w.date ? `<span class="label">Horários em ${esc(S.formatLong(w.date))}</span>
            <div class="times" role="group" aria-label="Horários">${slots.map((s) => `
              <button class="opt" data-act="time" data-id="${s.time}" aria-pressed="${w.time === s.time}" ${s.available ? '' : 'disabled'}>${s.time}</button>`).join('')}</div>` : '<p class="disclaimer">Escolha uma data para ver os horários.</p>'}
          <div class="wizard__nav"><button class="btn btn--ghost-dark" data-act="back">← Voltar</button>
            <button class="btn btn--emerald" data-act="next" ${w.date && w.time ? '' : 'disabled'}>Continuar →</button></div>`;
        const sel = $('.date[aria-pressed="true"]', body);
        if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest' });
      } else {
        body.innerHTML = `<h2>Seus dados</h2>${stepper()}${summary()}
          <label class="field"><span>Nome completo</span><input id="f-name" value="${esc(w.name)}" autocomplete="name" placeholder="Ex.: Maria da Silva" /></label>
          <label class="field"><span>Telefone com DDD (WhatsApp)</span><input id="f-phone" value="${esc(w.phone)}" inputmode="tel" autocomplete="tel" placeholder="(11) 90000-0000" /></label>
          <label class="field"><span>E-mail (opcional)</span><input id="f-email" type="email" value="${esc(w.email)}" autocomplete="email" placeholder="voce@email.com" /></label>
          <label class="check"><input type="checkbox" id="f-consent" ${w.consent ? 'checked' : ''} /> Concordo em ser contatado para confirmar esta consulta e com o tratamento dos meus dados conforme a LGPD.</label>
          <p class="error" id="f-error" role="alert">${esc(w.error)}</p>
          <div class="wizard__nav"><button class="btn btn--ghost-dark" data-act="back">← Voltar</button>
            <button class="btn btn--gold" data-act="confirm">Confirmar agendamento</button></div>`;
        const first = $('#f-name', body); if (first) first.focus();
      }
    }

    function renderDone() {
      const a = w.done;
      const spec = NS.byId.specialty(a.specialtyId);
      body.innerHTML = `<div class="success"><div class="success__seal" aria-hidden="true">✓</div>
        <h2>Consulta agendada</h2><p class="modal__lead">Guardamos o seu horário, ${esc(a.name.split(' ')[0])}. Nossa recepção confirma pelo WhatsApp.</p></div>
        <div class="ticket">
          <div><span>Protocolo</span><strong>${esc(a.protocol)}</strong></div>
          <div><span>Motivo</span><strong>${esc(a.reason)}</strong></div>
          <div><span>Profissional</span><strong>${esc(spec.doctor)}</strong></div>
          <div><span>Data</span><strong>${esc(S.formatLong(a.date))}</strong></div>
          <div><span>Horário</span><strong>${a.time}</strong></div>
          <div><span>Modalidade</span><strong>${a.mode === 'teleconsulta' ? 'Teleconsulta' : 'Presencial'}</strong></div>
        </div>
        <div class="modal__actions" style="justify-content:center">
          <button class="btn btn--gold" data-act="ics">Adicionar ao calendário</button>
          <button class="btn btn--ghost-dark" data-close>Fechar</button>
        </div>
        <p class="disclaimer" style="text-align:center">Chegue 10 minutos antes e leve exames anteriores, se tiver.</p>`;
    }

    // Os campos de texto atualizam o estado sem re-renderizar (senão o cursor some)
    body.addEventListener('input', (e) => {
      if (e.target.id === 'f-name') w.name = e.target.value;
      if (e.target.id === 'f-phone') w.phone = e.target.value;
      if (e.target.id === 'f-email') w.email = e.target.value;
      if (e.target.id === 'f-consent') w.consent = e.target.checked;
    });

    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'reason') { if (w.reason !== b.dataset.id) { w.reason = b.dataset.id; w.date = null; w.time = null; } render(); }
      else if (act === 'mode') { w.mode = b.dataset.id; render(); }
      else if (act === 'date') { w.date = b.dataset.id; w.time = null; render(); }
      else if (act === 'time') { w.time = b.dataset.id; render(); }
      else if (act === 'next') { w.step += 1; render(); }
      else if (act === 'back') { w.step -= 1; w.error = ''; render(); }
      else if (act === 'ics') { S.downloadICS(w.done); }
      else if (act === 'confirm') {
        if (!w.consent) { w.error = 'Para continuar, marque a autorização de contato.'; $('#f-error', body).textContent = w.error; return; }
        const res = S.book({
          treatmentId: w.reason === 'geral' ? null : w.reason, reason: reasonName(),
          specialtyId: specialtyId(), date: w.date, time: w.time, mode: w.mode,
          name: w.name, phone: w.phone, email: w.email,
        });
        if (!res.ok) { w.error = res.error; $('#f-error', body).textContent = res.error; return; }
        w.done = res.appointment; render();
      }
    });

    render();
  }


  /* ---------- selo de modo (demonstração x oficial) ---------- */
  function renderMode() {
    const b = $('#mode-badge');
    if (!b) return;
    const official = NS.Config.isOfficial();
    b.textContent = official ? 'Site oficial · conectado' : 'Modo demonstração';
    b.classList.toggle('is-official', official);
  }
  document.addEventListener('clinica:config', () => { renderMode(); S.retryUnsynced(); });
  renderMode();
  S.retryUnsynced();

  /* ---------- confirmação em dois cliques (evita apagar sem querer) ---------- */
  function twoClick(btn, armedLabel, action) {
    if (btn.dataset.armed === '1') { btn.dataset.armed = ''; return action(); }
    const original = btn.textContent;
    btn.dataset.armed = '1'; btn.textContent = armedLabel;
    setTimeout(() => { if (btn.isConnected && btn.dataset.armed === '1') { btn.dataset.armed = ''; btn.textContent = original; } }, 4000);
  }

  /* ---------- modal: meus agendamentos ---------- */
  function openMine() {
    const body = openModal();
    const card = (a) => {
      const spec = NS.byId.specialty(a.specialtyId);
      const canceled = a.status === 'cancelado';
      const isNext = !canceled && S.active().some((x) => x.protocol === a.protocol);
      const tag = canceled ? '<span class="tag tag--off">Cancelada</span>' : isNext ? '<span class="tag tag--ok">Confirmada</span>' : '<span class="tag">Passada</span>';
      return `<div class="appt ${canceled ? 'is-off' : ''}">
        <div><strong>${esc(a.reason)}</strong>
          <span class="meta">${esc(S.formatLong(a.date))} às ${a.time} · ${esc(spec.name)}</span>
          <small>Protocolo ${esc(a.protocol)} · ${a.mode === 'teleconsulta' ? 'Teleconsulta' : 'Presencial'}</small></div>
        <div class="appt__side">${tag}
          ${isNext ? `<button class="btn btn--ghost-dark btn--sm" data-act="ics" data-id="${a.protocol}">Calendário</button>
          <button class="btn btn--ghost-dark btn--sm" data-act="cancel" data-id="${a.protocol}">Cancelar</button>` : ''}</div></div>`;
    };
    const render = (msg = '', kind = '') => {
      const act = S.active(), hist = S.history();
      body.innerHTML = `<h2>Meus agendamentos</h2>
        <p class="modal__lead">Agendamentos feitos neste dispositivo${NS.Config.isOfficial() ? ' (também registrados na clínica)' : ''}.</p>
        ${msg ? `<p class="notice notice--${kind}" role="status">${esc(msg)}</p>` : ''}
        <span class="label">Próximas consultas</span>
        ${act.length ? act.map(card).join('') : '<p class="disclaimer">Você não tem consultas futuras.</p>'}
        ${hist.length ? `<span class="label">Histórico</span>${hist.map(card).join('')}
          <div class="modal__actions"><button class="btn btn--ghost-dark btn--sm" data-act="clear-history">Limpar histórico</button></div>` : ''}
        <div class="modal__actions"><button class="btn btn--gold" data-act="new">Agendar nova consulta</button></div>`;
    };
    body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.act === 'new') return openScheduler();
      if (b.dataset.act === 'ics') return S.downloadICS(S.list().find((a) => a.protocol === id));
      if (b.dataset.act === 'cancel') return twoClick(b, 'Confirmar cancelamento', () => {
        const r = S.cancel(id); render(r.ok ? 'Consulta cancelada. O horário foi liberado.' : r.error, r.ok ? 'ok' : 'err');
      });
      if (b.dataset.act === 'clear-history') return twoClick(b, 'Confirmar limpeza', () => {
        const n = S.clearHistory(); render(`${n} registro(s) removido(s) deste dispositivo.`, 'ok');
      });
    });
    render();
  }

  /* ---------- modal: configurações (chave de ativação) ---------- */
  function openAdmin() {
    const body = openModal();
    const render = (msg = '', kind = '') => {
      const c = NS.Config.get(), official = NS.Config.isOfficial();
      body.innerHTML = `<p class="eyebrow eyebrow--dark">Área da clínica</p>
        <h2>Configurações do site</h2>
        <p class="modal__lead">Estado atual: <span class="tag ${official ? 'tag--ok' : 'tag--off'}">${official ? 'Site oficial · conectado' : 'Modo demonstração'}</span></p>
        ${msg ? `<p class="notice notice--${kind}" role="status">${esc(msg)}</p>` : ''}
        <label class="field"><span>Endereço do webhook (n8n ou seu servidor)</span>
          <input id="a-url" value="${esc(c.webhookUrl)}" placeholder="https://seu-n8n.com/webhook/clinica" autocomplete="off" spellcheck="false" /></label>
        <label class="field"><span>Chave de ativação</span>
          <div class="keyrow"><input id="a-key" type="password" value="${esc(c.apiKey)}" placeholder="Cole aqui a sua chave" autocomplete="off" spellcheck="false" />
          <button type="button" class="opt" data-act="toggle">Mostrar</button></div></label>
        <div class="modal__actions">
          <button class="btn btn--gold" data-act="save">Ativar site oficial</button>
          <button class="btn btn--ghost-dark" data-act="test">Testar conexão</button>
          <button class="btn btn--ghost-dark" data-act="disconnect">Desconectar</button></div>
        <div class="box"><h4>Importante sobre a chave</h4>
          <p>Qualquer pessoa que abrir as ferramentas do navegador consegue ver a chave deste site. Use aqui uma <strong>chave própria do site</strong>, que o seu servidor valida e pode trocar a qualquer momento. Senhas de serviços (OpenAI, banco de dados etc.) ficam <strong>somente dentro do n8n</strong>, nunca aqui.</p></div>
        <div class="box"><h4>Valer para todos os visitantes</h4>
          <p>O que você salvou acima vale só para este navegador. Para o site publicado, copie o trecho abaixo e cole no começo de <code>js/config.js</code>, substituindo o bloco <code>SITE_CONFIG</code>.</p>
          <textarea class="code" id="a-snippet" readonly rows="5">${esc(NS.Config.snippet())}</textarea>
          <button class="btn btn--ghost-dark btn--sm" data-act="copy">Copiar trecho</button></div>
        <div class="box"><h4>Dados guardados neste navegador</h4>
          <p>${S.list().length} agendamento(s) registrado(s). Ao ativar o site oficial, o que ainda não foi enviado é enviado ao servidor.</p>
          <div class="modal__actions">
            <button class="btn btn--ghost-dark btn--sm" data-act="wipe-appts">Apagar agendamentos locais</button>
            <button class="btn btn--ghost-dark btn--sm" data-act="wipe-chat">Apagar conversa da Helena</button></div></div>`;
    };
    const read = () => ({ webhookUrl: $('#a-url', body).value.trim(), apiKey: $('#a-key', body).value.trim() });
    const check = (v) => {
      if (!NS.Config.validUrl(v.webhookUrl)) return 'Endereço inválido. Use um link que comece com https://';
      if (!NS.Config.validKey(v.apiKey)) return 'A chave precisa ter pelo menos 8 caracteres.';
      return '';
    };
    body.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'toggle') {
        const k = $('#a-key', body); const show = k.type === 'password';
        k.type = show ? 'text' : 'password'; b.textContent = show ? 'Ocultar' : 'Mostrar';
      } else if (act === 'save') {
        const v = read(), err = check(v);
        if (err) return render(err, 'err');
        NS.Config.save(v); render('Site oficial ativado neste navegador. Use "Testar conexão" para confirmar.', 'ok');
      } else if (act === 'test') {
        const v = read(), err = check(v);
        if (err) return render(err, 'err');
        NS.Config.save(v); b.disabled = true; b.textContent = 'Testando…';
        const r = await NS.Config.post({ event: 'ping', sentAt: new Date().toISOString() });
        if (!body.isConnected) return;
        render(r.ok ? 'Conexão funcionando: o servidor respondeu.' : `Falhou: ${r.error || 'o servidor respondeu com erro ' + r.status}. Confira o endereço, a chave e a liberação de CORS no n8n.`, r.ok ? 'ok' : 'err');
      } else if (act === 'disconnect') {
        NS.Config.save({ webhookUrl: '', apiKey: '' }); render('Desconectado. Este navegador voltou ao modo demonstração.', 'ok');
      } else if (act === 'copy') {
        const ta = $('#a-snippet', body);
        try { await navigator.clipboard.writeText(ta.value); b.textContent = 'Copiado ✓'; }
        catch (err) { ta.select(); document.execCommand('copy'); b.textContent = 'Copiado ✓'; }
      } else if (act === 'wipe-appts') {
        twoClick(b, 'Confirmar exclusão', () => { const n = S.clearAll(); render(`${n} agendamento(s) apagado(s) deste navegador.`, 'ok'); });
      } else if (act === 'wipe-chat') {
        twoClick(b, 'Confirmar exclusão', () => { if (NS.Chat) NS.Chat.clear(); render('Conversa da Helena apagada.', 'ok'); });
      }
    });
    render();
  }

  if (location.hash === '#admin') openAdmin();
  window.addEventListener('hashchange', () => { if (location.hash === '#admin') openAdmin(); });

  /* ---------- gatilhos globais ---------- */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-mine]')) { e.preventDefault(); nav.classList.remove('is-open'); openMine(); return; }
    if (e.target.closest('[data-open-admin]')) { e.preventDefault(); openAdmin(); return; }
    const sched = e.target.closest('[data-open-scheduler]');
    if (sched) {
      if (sched.id === 'next-slot-btn' && nextSlot) openScheduler({ reason: 'geral', date: nextSlot.date, time: nextSlot.time, step: 2 });
      else openScheduler();
      return;
    }
    if (e.target.closest('[data-open-chat]') && NS.Chat) NS.Chat.open();
  });

  NS.UI = { openScheduler, openTreatment, openMine, openAdmin, closeModal };
})(typeof window !== 'undefined' ? window : globalThis);
