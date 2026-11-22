/* ============================================================
   scheduler.js — Motor de agenda
   ------------------------------------------------------------
   MODO DEMONSTRAÇÃO: a disponibilidade é simulada de forma
   determinística (mesma data + horário + especialidade sempre
   dão o mesmo resultado) e as reservas ficam no localStorage.
   Em produção, troque getSlots() e book() por chamadas à API
   do seu sistema de agenda; o resto do site não muda.
   ============================================================ */
(function (g) {
  'use strict';
  const NS = (g.Clinica = g.Clinica || {});

  const KEY = 'mv_appointments_v1';
  const WEEKDAY_SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
  const SATURDAY_SLOTS = ['08:00', '09:00', '10:00', '11:00'];
  const MIN_LEAD_MINUTES = 60; // não oferece horário que começa em menos de 1h
  const DAYS_AHEAD = 14;
  const DEMO_BUSY_PERCENT = 35; // % de horários "já ocupados" na simulação

  const statusOf = (a) => a.status || 'confirmado';
  let memoryStore = []; // fallback quando localStorage não está disponível

  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return memoryStore; }
  }
  function save(list) {
    memoryStore = list;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* sem storage: usa memória */ }
  }

  /** Horários de um dia para uma especialidade. */
  function getSlots(dateISO, specialtyId, now = new Date()) {
    const d = fromISO(dateISO);
    const dow = d.getDay();
    const base = dow === 0 ? [] : dow === 6 ? SATURDAY_SLOTS : WEEKDAY_SLOTS;
    const mine = new Set(
      load().filter((a) => a.date === dateISO && a.specialtyId === specialtyId && statusOf(a) !== 'cancelado').map((a) => a.time)
    );
    return base.map((time) => {
      const [h, m] = time.split(':').map(Number);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
      const tooSoon = start.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60000;
      const busy = hash(`${dateISO}|${time}|${specialtyId}`) % 100 < DEMO_BUSY_PERCENT;
      return { time, available: !tooSoon && !busy && !mine.has(time) };
    });
  }

  /** Próximos dias com atendimento (domingo fica de fora). */
  function getDays(specialtyId, now = new Date()) {
    const out = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      if (d.getDay() === 0) continue;
      const iso = toISO(d);
      const slots = getSlots(iso, specialtyId, now);
      out.push({
        iso,
        weekday: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d).replace('.', ''),
        day: pad(d.getDate()),
        month: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).replace('.', ''),
        short: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
        available: slots.filter((s) => s.available).length,
      });
    }
    return out;
  }

  function nextAvailable(specialtyId, now = new Date()) {
    for (const day of getDays(specialtyId, now)) {
      const slot = getSlots(day.iso, specialtyId, now).find((s) => s.available);
      if (slot) return { date: day.iso, time: slot.time };
    }
    return null;
  }

  function formatLong(iso) {
    const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(fromISO(iso));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
  const validName = (s) => /^[A-Za-zÀ-ÿ'’.\- ]{3,}$/.test(String(s || '').trim()) && String(s).trim().split(/\s+/).length >= 2;
  const validPhone = (s) => { const d = onlyDigits(s); return d.length === 10 || d.length === 11; };
  function formatPhone(s) {
    const d = onlyDigits(s);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return s;
  }

  /** Reserva um horário. Reconfere a disponibilidade no momento de gravar. */
  function book(data, now = new Date()) {
    const { specialtyId, date, time } = data;
    if (!validName(data.name)) return { ok: false, error: 'Informe nome e sobrenome.' };
    if (!validPhone(data.phone)) return { ok: false, error: 'Informe um telefone com DDD (10 ou 11 dígitos).' };
    const slot = getSlots(date, specialtyId, now).find((s) => s.time === time);
    if (!slot || !slot.available) return { ok: false, error: 'Esse horário acabou de ser preenchido. Escolha outro, por favor.' };
    const appointment = {
      protocol: 'SV-' + Date.now().toString(36).toUpperCase().slice(-6),
      treatmentId: data.treatmentId || null,
      reason: data.reason || 'Consulta geral',
      specialtyId, date, time,
      mode: data.mode || 'presencial',
      name: String(data.name).trim(),
      phone: formatPhone(data.phone),
      email: data.email || '',
      createdAt: new Date().toISOString(),
      status: 'confirmado',
      syncedAs: null,
    };
    save([...load(), appointment]);
    syncAppt('appointment.created', appointment);
    return { ok: true, appointment };
  }

  /** Conteúdo .ics para "Adicionar ao calendário" (horário local, 1h de duração). */
  function toICS(a) {
    const d = fromISO(a.date);
    const [h, m] = a.time.split(':').map(Number);
    const fmt = (dt) => `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    const end = new Date(start.getTime() + 60 * 60000);
    const spec = NS.byId.specialty(a.specialtyId);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sara Vitalis//Agenda//PT-BR', 'BEGIN:VEVENT',
      `UID:${a.protocol}@saravitalis.example`, `DTSTAMP:${stamp}`,
      `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
      `SUMMARY:Consulta — ${spec.name} (Sara Vitalis)`,
      `DESCRIPTION:Protocolo ${a.protocol}. Motivo: ${a.reason}. Modalidade: ${a.mode}.`,
      `LOCATION:${a.mode === 'teleconsulta' ? 'Teleconsulta' : NS.CLINIC.address}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
  }

  function downloadICS(a) {
    const blob = new Blob([toICS(a)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `consulta-${a.protocol}.ics`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }


  /* ---------- cancelamento, histórico e sincronização ---------- */
  function startOf(a) {
    const d = fromISO(a.date);
    const [h, m] = a.time.split(':').map(Number);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
  }
  function patch(protocol, p) {
    const list = load().map((a) => (a.protocol === protocol ? Object.assign({}, a, p) : a));
    save(list);
    return list.find((a) => a.protocol === protocol);
  }
  const withStatus = (a) => Object.assign({}, a, { status: statusOf(a) });

  /** Envia o evento ao servidor (só no modo "site oficial"). */
  function syncAppt(event, a) {
    if (!NS.Config || !NS.Config.isOfficial()) return Promise.resolve(false);
    return NS.Config.post({ event, appointment: withStatus(a), sentAt: new Date().toISOString() }).then((r) => {
      if (r.ok) patch(a.protocol, { syncedAs: statusOf(a) });
      return r.ok;
    });
  }
  /** Reenvia o que ficou pendente (sem internet, servidor fora do ar ou site ainda em demonstração). */
  function retryUnsynced() {
    if (!NS.Config || !NS.Config.isOfficial()) return;
    load().filter((a) => a.syncedAs !== statusOf(a)).forEach((a) =>
      syncAppt(statusOf(a) === 'cancelado' ? 'appointment.canceled' : 'appointment.created', a));
  }

  function cancel(protocol, now = new Date()) {
    const a = load().find((x) => x.protocol === protocol);
    if (!a) return { ok: false, error: 'Agendamento não encontrado.' };
    if (statusOf(a) === 'cancelado') return { ok: false, error: 'Este agendamento já foi cancelado.' };
    if (startOf(a) < now) return { ok: false, error: 'Esta consulta já passou e não pode ser cancelada.' };
    const updated = patch(protocol, { status: 'cancelado', canceledAt: new Date().toISOString() });
    syncAppt('appointment.canceled', updated);
    return { ok: true, appointment: withStatus(updated) };
  }

  const isActive = (a, now) => statusOf(a) !== 'cancelado' && startOf(a) >= now;
  const active = (now = new Date()) => load().filter((a) => isActive(a, now)).sort((x, y) => startOf(x) - startOf(y)).map(withStatus);
  const history = (now = new Date()) => load().filter((a) => !isActive(a, now)).sort((x, y) => startOf(y) - startOf(x)).map(withStatus);
  const list = () => load().map(withStatus);

  /** Apaga cancelados e consultas passadas deste navegador (mantém o que ainda não foi enviado ao servidor). */
  function clearHistory(now = new Date()) {
    const before = load();
    const official = !!(NS.Config && NS.Config.isOfficial());
    const kept = before.filter((a) => isActive(a, now) || (official && a.syncedAs !== statusOf(a)));
    save(kept);
    return before.length - kept.length;
  }
  function clearAll() { const n = load().length; save([]); return n; }

  NS.Scheduler = {
    getSlots, getDays, nextAvailable, formatLong, book, toICS, downloadICS,
    validName, validPhone, formatPhone, toISO,
    cancel, active, history, list, clearHistory, clearAll, retryUnsynced,
  };
})(typeof window !== 'undefined' ? window : globalThis);
