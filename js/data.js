/* ============================================================
   data.js — Conteúdo da clínica (edite aqui, não no HTML)
   Nomes dos médicos e da clínica são FICTÍCIOS. O endereço é um exemplo: confirme o número real.
   ============================================================ */
(function (g) {
  'use strict';
  const NS = (g.Clinica = g.Clinica || {});

  NS.CLINIC = {
    name: 'Sara Vitalis',
    phone: '(11) 96640-0597',
    whatsapp: '5511966400597',
    address: 'Alameda Rio Negro, 500 · Centro Comercial de Alphaville — Barueri/SP',
    hours: ['Segunda a sexta: 8h às 18h', 'Sábado: 8h às 12h', 'Domingo: fechado'],
  };

  NS.SPECIALTIES = [
    { id: 'clinico', name: 'Clínica Geral', doctor: 'Dra. Beatriz Montenegro' },
    { id: 'infecto', name: 'Infectologia', doctor: 'Dr. Rafael Albuquerque' },
    { id: 'pediatria', name: 'Pediatria', doctor: 'Dra. Camila Veloso' },
    { id: 'cardio', name: 'Cardiologia', doctor: 'Dr. Henrique Sabóia' },
    { id: 'endocrino', name: 'Endocrinologia', doctor: 'Dra. Marina Falcão' },
    { id: 'gastro', name: 'Gastroenterologia', doctor: 'Dr. Tiago Brandão' },
    { id: 'alergo', name: 'Alergologia', doctor: 'Dra. Larissa Prado' },
    { id: 'saudemental', name: 'Saúde Mental', doctor: 'Dr. Eduardo Villar' },
  ];

  // category: usada no filtro da seção de tratamentos
  NS.TREATMENTS = [
    {
      id: 'gripe', name: 'Gripe e Resfriado', category: 'infeccoes', specialty: 'clinico',
      blurb: 'Febre, tosse, coriza e dor no corpo: avaliação e alívio com segurança.',
      symptoms: ['Febre e calafrios', 'Tosse e coriza', 'Dor de garganta', 'Dor no corpo e cansaço'],
      care: ['Hidratação frequente', 'Repouso', 'Lavar as mãos e ventilar os ambientes', 'Evitar sair de casa enquanto houver febre'],
      alert: ['Falta de ar ou dor no peito', 'Febre por mais de 3 dias', 'Confusão mental ou muita sonolência', 'Piora depois de uma melhora'],
      clinic: 'Avaliação clínica, testes rápidos de influenza e COVID-19 e vacinação anual.',
    },
    {
      id: 'covid', name: 'COVID-19', category: 'infeccoes', specialty: 'infecto',
      blurb: 'Testagem, orientação de isolamento e acompanhamento, inclusive pós-covid.',
      symptoms: ['Febre e tosse', 'Perda de olfato ou paladar', 'Dor de garganta', 'Cansaço intenso'],
      care: ['Fazer o teste para confirmar', 'Seguir a orientação de isolamento', 'Usar máscara perto de pessoas vulneráveis', 'Manter hidratação e repouso'],
      alert: ['Falta de ar', 'Lábios ou dedos arroxeados', 'Dor persistente no peito', 'Confusão mental'],
      clinic: 'Testagem, avaliação de risco, atualização vacinal e acompanhamento de sintomas persistentes.',
    },
    {
      id: 'dengue', name: 'Dengue', category: 'infeccoes', specialty: 'infecto',
      blurb: 'Febre alta com dor atrás dos olhos? Avaliação rápida e acompanhamento de perto.',
      symptoms: ['Febre alta de início súbito', 'Dor atrás dos olhos', 'Dores no corpo e nas articulações', 'Manchas vermelhas na pele'],
      care: ['Procurar avaliação logo no início, sem esperar', 'Beber bastante líquido', 'Repouso', 'NÃO usar aspirina (AAS) nem anti-inflamatórios sem orientação médica'],
      alert: ['Dor forte na barriga', 'Vômitos que não param', 'Sangramento no nariz ou na gengiva', 'Sonolência, tontura ou irritação intensa', 'A febre cai e a pessoa piora'],
      clinic: 'Avaliação clínica, exames de sangue, plano de hidratação e retorno de acompanhamento.',
    },
    {
      id: 'alergias', name: 'Alergias e Rinite', category: 'infeccoes', specialty: 'alergo',
      blurb: 'Espirros, coceira e nariz entupido: identificamos os gatilhos e cuidamos da causa.',
      symptoms: ['Espirros em sequência', 'Coceira no nariz, olhos ou pele', 'Coriza clara', 'Tosse seca'],
      care: ['Evitar poeira, mofo e pelos', 'Lavagem nasal com soro fisiológico', 'Manter ambientes arejados e limpos'],
      alert: ['Inchaço de lábios, língua ou rosto', 'Dificuldade para respirar', 'Chiado forte no peito'],
      clinic: 'Avaliação alergológica, investigação de gatilhos e plano de controle individual.',
    },
    {
      id: 'hipertensao', name: 'Hipertensão', category: 'cronicas', specialty: 'cardio',
      blurb: 'A pressão alta costuma ser silenciosa. Acompanhamento próximo protege o coração.',
      symptoms: ['Muitas vezes nenhum sintoma', 'Dor de cabeça ocasional', 'Tontura', 'Zumbido no ouvido'],
      care: ['Medir a pressão com regularidade', 'Reduzir o sal', 'Praticar atividade física', 'Nunca suspender remédio sem orientação médica'],
      alert: ['Dor ou aperto no peito', 'Falta de ar', 'Fraqueza de um lado do corpo', 'Fala enrolada'],
      clinic: 'Consulta cardiológica, monitorização ambulatorial e plano de cuidado personalizado.',
    },
    {
      id: 'diabetes', name: 'Diabetes', category: 'cronicas', specialty: 'endocrino',
      blurb: 'Controle da glicemia com ciência, escuta e plano alimentar realista.',
      symptoms: ['Muita sede e vontade de urinar', 'Cansaço', 'Visão embaçada', 'Perda de peso sem causa aparente'],
      care: ['Checar a glicemia conforme orientação', 'Alimentação equilibrada', 'Atividade física regular', 'Consultas e exames em dia'],
      alert: ['Confusão mental', 'Vômitos com respiração acelerada', 'Suor frio, tremores e fraqueza intensa'],
      clinic: 'Endocrinologia, nutrição e acompanhamento contínuo de exames.',
    },
    {
      id: 'digestivo', name: 'Saúde Digestiva', category: 'bemestar', specialty: 'gastro',
      blurb: 'Azia, refluxo, enjoo e desconforto abdominal: investigação cuidadosa e tratamento.',
      symptoms: ['Azia e queimação', 'Enjoo', 'Barriga inchada', 'Diarreia ou prisão de ventre'],
      care: ['Refeições menores e mais frequentes', 'Evitar álcool e alimentos que pioram o quadro', 'Manter hidratação'],
      alert: ['Sangue nas fezes ou no vômito', 'Dor abdominal intensa', 'Sinais de desidratação', 'Perda de peso sem explicação'],
      clinic: 'Gastroenterologia, exames de investigação e orientação nutricional.',
    },
    {
      id: 'saudemental', name: 'Saúde Mental', category: 'bemestar', specialty: 'saudemental',
      blurb: 'Ansiedade, insônia e esgotamento merecem acolhimento sigiloso e sem pressa.',
      symptoms: ['Preocupação constante', 'Dificuldade para dormir', 'Irritabilidade', 'Tristeza ou desânimo persistentes'],
      care: ['Rotina de sono regular', 'Atividade física', 'Conversar com alguém de confiança', 'Reduzir cafeína à noite'],
      alert: ['Pensamentos de se machucar: ligue 188 (CVV, 24h) ou 192 (SAMU)', 'Crise de pânico muito intensa'],
      clinic: 'Psiquiatria e psicologia, com atendimento sigiloso e plano de cuidado individual.',
    },
    {
      id: 'checkup', name: 'Check-up Preventivo', category: 'bemestar', specialty: 'clinico',
      blurb: 'Uma visão completa da sua saúde hoje para você se antecipar ao amanhã.',
      symptoms: ['Indicado mesmo sem sintomas', 'Histórico familiar de doenças', 'Mudança de hábitos ou de rotina'],
      care: ['Levar exames anteriores', 'Listar medicamentos em uso', 'Anotar dúvidas antes da consulta'],
      alert: ['Sintomas novos ou persistentes merecem avaliação sem esperar o check-up'],
      clinic: 'Avaliação clínica completa, exames laboratoriais e plano preventivo.',
    },
    {
      id: 'pediatria', name: 'Pediatria', category: 'bemestar', specialty: 'pediatria',
      blurb: 'Cuidado atencioso do bebê ao adolescente, com vacinas e acompanhamento do crescimento.',
      symptoms: ['Febre', 'Tosse e coriza', 'Vômitos ou diarreia', 'Recusa de alimentos'],
      care: ['Oferecer líquidos com frequência', 'Observar a disposição da criança', 'Manter a vacinação em dia'],
      alert: ['Febre em bebê com menos de 3 meses', 'Dificuldade para respirar', 'Muita sonolência ou convulsão', 'Sinais de desidratação (sem urinar por muitas horas, choro sem lágrimas)'],
      clinic: 'Puericultura, vacinação e atendimento de queixas agudas.',
    },
  ];

  NS.CATEGORIES = [
    { id: 'todos', name: 'Todos' },
    { id: 'infeccoes', name: 'Infecções e alergias' },
    { id: 'cronicas', name: 'Doenças crônicas' },
    { id: 'bemestar', name: 'Bem-estar e prevenção' },
  ];

  NS.byId = {
    treatment: (id) => NS.TREATMENTS.find((t) => t.id === id) || null,
    specialty: (id) => NS.SPECIALTIES.find((s) => s.id === id) || NS.SPECIALTIES[0],
  };
})(typeof window !== 'undefined' ? window : globalThis);
