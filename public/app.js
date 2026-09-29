const state = {
  tab: 'semana',
  usuario: null,
  necesitaSetup: false,
  authMode: 'login',
  authInfo: { registroAbierto: true, codigoRequerido: false },
  diners: [],
  plans: [],
  plan: null,
  config: null,
  conversacionId: null,
  messages: [],
  lastPlan: null,
  diagnostico: null,
};

const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);

async function rawJson(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function api(path, { method = 'GET', body } = {}) {
  const { status, data } = await rawJson(path, { method, body });
  if (status === 401) {
    state.usuario = null;
    showAuth({ necesitaSetup: false });
    throw new Error('La sesión ha caducado; vuelve a entrar');
  }
  if (status >= 400) throw new Error(data.message || `Error ${status}`);
  return data;
}

let toastTimer;
function toast(message, isError = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = `toast${isError ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.add('hidden'), 3500);
}

/* ---------- Autenticación ---------- */

function showAuth({ necesitaSetup = false, registroAbierto = true, codigoRequerido = false } = {}) {
  state.necesitaSetup = necesitaSetup;
  state.authInfo = { registroAbierto, codigoRequerido };
  if (necesitaSetup) state.authMode = 'register';
  $('#nav-tabs').classList.add('hidden');
  $('#btn-logout').classList.add('hidden');
  for (const name of ['semana', 'compra', 'chat', 'ajustes']) {
    $(`#view-${name}`).classList.add('hidden');
  }
  $('#view-auth').classList.remove('hidden');
  renderAuth();
}

function renderAuth() {
  const setup = state.necesitaSetup;
  const register = setup || state.authMode === 'register';
  const puedeRegistrar = state.authInfo.registroAbierto;
  const titulo = setup ? 'Crea tu usuario' : register ? 'Crear cuenta' : 'Entra';
  const ayuda = setup
    ? 'Primera vez: elige un usuario y una contraseña de al menos 6 caracteres. Serás el administrador.'
    : register
      ? 'Crea una cuenta; tendrás tu propio hogar, separado del resto.'
      : 'Introduce tus credenciales para ver tus menús.';
  const toggle =
    !setup && puedeRegistrar
      ? `<button class="tab" id="btn-auth-toggle">${register ? 'Ya tengo cuenta' : 'Crear una cuenta'}</button>`
      : '';
  $('#view-auth').innerHTML = `
    <div class="card" style="max-width:420px;margin:40px auto">
      <h2>${titulo}</h2>
      <p class="muted">${ayuda}</p>
      <label class="field">Usuario<input id="auth-nombre" autocomplete="username" /></label>
      <label class="field">Contraseña<input id="auth-password" type="password" autocomplete="${
        register ? 'new-password' : 'current-password'
      }" /></label>
      ${
        register
          ? '<label class="field">Repite la contraseña<input id="auth-password2" type="password" autocomplete="new-password" /></label>'
          : ''
      }
      ${register ? '<label class="field">Nombre del hogar (opcional)<input id="auth-hogar" /></label>' : ''}
      ${
        register && state.authInfo.codigoRequerido
          ? '<label class="field">Código de invitación<input id="auth-codigo" /></label>'
          : ''
      }
      <div class="row" style="margin-top:12px">
        <button class="primary" id="btn-auth">${setup ? 'Crear y entrar' : register ? 'Crear cuenta' : 'Entrar'}</button>
        ${toggle}
      </div>
    </div>`;
}

async function submitAuth() {
  const nombre = $('#auth-nombre').value.trim();
  const password = $('#auth-password').value;
  if (!nombre || !password) throw new Error('Rellena usuario y contraseña');

  const registro = state.necesitaSetup || state.authMode === 'register';
  if (registro) {
    if (password !== $('#auth-password2').value) throw new Error('Las contraseñas no coinciden');
    const body = { nombre, password, hogarNombre: $('#auth-hogar')?.value };
    if ($('#auth-codigo')) body.codigo = $('#auth-codigo').value;
    const path = state.necesitaSetup ? '/auth/setup' : '/auth/register';
    const { status, data } = await rawJson(path, { method: 'POST', body });
    if (status !== 200) throw new Error(data.message || 'No se pudo crear la cuenta');
  } else {
    const { status, data } = await rawJson('/auth/login', {
      method: 'POST',
      body: { nombre, password },
    });
    if (status !== 200) throw new Error(data.message || 'Usuario o contraseña incorrectos');
  }
  await enterApp();
}

async function logout() {
  await rawJson('/auth/logout', { method: 'POST' });
  state.usuario = null;
  state.plan = null;
  state.plans = [];
  state.diners = [];
  state.messages = [];
  state.conversacionId = null;
  showAuth({ necesitaSetup: false });
}

/* ---------- Vistas ---------- */

function showTab(tab) {
  if (!state.usuario) return;
  state.tab = tab;
  document.querySelectorAll('.tab[data-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
  for (const name of ['semana', 'compra', 'chat', 'ajustes']) {
    $(`#view-${name}`).classList.toggle('hidden', name !== tab);
  }
  render();
}

function render() {
  if (state.tab === 'semana') renderSemana();
  else if (state.tab === 'compra') renderCompra();
  else if (state.tab === 'chat') renderChat();
  else renderAjustes();
}

function renderSemana() {
  const plan = state.plan;
  const options = state.plans
    .map(
      (p) =>
        `<option value="${p.id}" ${plan && p.id === plan.id ? 'selected' : ''}>` +
        `${esc(p.fechaInicio)} → ${esc(p.fechaFin)} · ${esc(p.estado)}</option>`,
    )
    .join('');
  $('#view-semana').innerHTML = `
    <div class="card">
      <div class="row">
        <label class="field">Semana abierta
          <select id="plan-select">${options || '<option value="">— sin semanas —</option>'}</select>
        </label>
        <label class="field">Inicio<input type="date" id="nuevo-inicio"></label>
        <label class="field">Fin<input type="date" id="nuevo-fin"></label>
        <button class="primary" id="btn-nuevo-plan">Nueva semana</button>
      </div>
    </div>
    ${plan ? planCard(plan) : '<div class="card muted">No hay ninguna semana. Crea una y pídesela al asistente en el Chat.</div>'}
  `;
}

function planCard(plan) {
  const nombre = (id) => state.diners.find((d) => d.id === id)?.nombre ?? id;
  const asignaciones = plan.dias.flatMap((d) => d.comidas.flatMap((c) => c.comensales));
  const pendientes = asignaciones.filter((a) => !a.verificado).length;
  const dias = plan.dias
    .map(
      (dia) => `
    <div class="day">
      <h4>${esc(dia.fecha)}</h4>
      ${dia.comidas
        .map(
          (comida) => `
        <div class="meal">
          <div class="meal-head">${esc(comida.tipo)} · ${esc(comida.receta?.nombre ?? '')}</div>
          <div class="checks">
            ${
              comida.comensales
                .map(
                  (a) => `
              <label class="check ${a.verificado ? 'ok' : ''}">
                <input type="checkbox" data-meal="${comida.id}" data-diner="${a.comensalId}" ${a.verificado ? 'checked' : ''}>
                ${esc(nombre(a.comensalId))} · ${esc(a.raciones)} ración(es)
              </label>`,
                )
                .join('') || '<span class="muted">Sin comensales asignados</span>'
            }
          </div>
          ${recetaDetalle(comida.receta)}
        </div>`,
        )
        .join('')}
    </div>`,
    )
    .join('');
  return `
    <div class="card">
      <div class="row">
        <span class="badge ${esc(plan.estado)}">${esc(plan.estado)}</span>
        <span class="muted">${plan.dias.length} días · ${pendientes} verificaciones pendientes</span>
        <button id="btn-cerrar" ${plan.estado === 'cerrada' ? 'disabled' : ''}>Cerrar semana y generar la compra</button>
      </div>
      ${plan.dias.length ? dias : '<p class="muted">Esta semana todavía no tiene comidas.</p>'}
    </div>`;
}

function recetaDetalle(receta) {
  if (!receta) return '';
  const ingredientes = (receta.ingredientes ?? [])
    .map(
      (i) =>
        `<li>${esc(i.nombre)} — ${esc(i.cantidad)} ${esc(i.unidad)}${i.opcional ? ' (opcional)' : ''}</li>`,
    )
    .join('');
  const pasos = (receta.pasos ?? []).map((p) => `<li>${esc(p)}</li>`).join('');
  const utensilios = (receta.utensilios ?? []).join(', ');
  return `<details><summary>Receta</summary>
    <p>${esc(receta.tiempoMin ?? 0)} min · ${esc(receta.racionesBase ?? '')} raciones base${utensilios ? ' · ' + esc(utensilios) : ''}</p>
    <ul>${ingredientes}</ul>
    ${pasos ? `<ol>${pasos}</ol>` : ''}
  </details>`;
}

function renderCompra() {
  const plan = state.plan;
  if (!plan || !(plan.listaCompra ?? []).length) {
    $('#view-compra').innerHTML =
      '<div class="card muted">Todavía no hay lista de la compra. Cierra una semana para generarla.</div>';
    return;
  }
  const items = plan.listaCompra
    .map(
      (item) => `
    <div class="shop-item">
      <div>${esc(item.nombre)} — ${esc(item.cantidad)} ${esc(item.unidad)}
        <span class="state">· ${esc(item.estado)}</span>
      </div>
      <div class="shop-buttons">
        <button data-shop="${item.id}" data-estado="comprado">Comprado</button>
        <button data-shop="${item.id}" data-estado="enCasa">Ya lo tengo</button>
        <button data-shop="${item.id}" data-estado="pendiente">Pendiente</button>
      </div>
    </div>`,
    )
    .join('');
  $('#view-compra').innerHTML = `<div class="card"><h3>Lista de la compra</h3>${items}</div>`;
}

function renderChat() {
  const mensajes = state.messages
    .map(
      (m) =>
        `<div class="msg ${m.rol === 'usuario' ? 'user' : 'assistant'}">${esc(m.contenido)}</div>`,
    )
    .join('');
  const apply = state.lastPlan
    ? '<div class="row"><button class="primary" id="btn-aplicar">Aplicar plan a la semana</button></div>'
    : '';
  $('#view-chat').innerHTML = `
    <div class="card">
      <div class="chat-log" id="chat-log">${mensajes || '<p class="muted">Pídele al asistente que planifique la semana.</p>'}</div>
      <div class="row">
        <input id="chat-input" placeholder="Escribe al asistente…" style="flex:1" />
        <button class="primary" id="btn-chat-send">Enviar</button>
      </div>
      ${apply}
    </div>`;
  const log = $('#chat-log');
  log.scrollTop = log.scrollHeight;
}

function renderAjustes() {
  const config = state.config ?? {};
  const diners = state.diners
    .map((d) => `<li>${esc(d.nombre)}${d.dieta ? ' · ' + esc(d.dieta) : ''}</li>`)
    .join('');
  $('#view-ajustes').innerHTML = `
    <div class="card">
      <h3>Comensales</h3>
      <ul>${diners || '<li class="muted">Sin comensales</li>'}</ul>
      <div class="row">
        <input id="diner-nombre" placeholder="Nombre" />
        <input id="diner-dieta" placeholder="Dieta (opcional)" />
        <button id="btn-add-diner">Añadir</button>
      </div>
    </div>
    <div class="card">
      <h3>Asistente de IA</h3>
      <div class="grid2">
        <label class="field">Proveedor
          <select id="cfg-proveedor">
            ${['echo', 'openai', 'anthropic', 'gemini']
              .map((p) => `<option ${config.proveedor === p ? 'selected' : ''}>${p}</option>`)
              .join('')}
          </select>
        </label>
        <label class="field">Modelo<input id="cfg-modelo" value="${esc(config.modelo ?? '')}" placeholder="gpt-4o-mini" /></label>
        <label class="field">URL base (compatible OpenAI)<input id="cfg-baseurl" value="${esc(config.parametros?.baseUrl ?? '')}" placeholder="https://api.openai.com/v1" /></label>
        <label class="field">Token<input id="cfg-token" type="password" placeholder="${config.tieneToken ? '•••••• (guardado)' : 'Pega tu token'}" /></label>
      </div>
      <div class="row">
        <button class="primary" id="btn-guardar-config">Guardar</button>
        <button id="btn-probar-modelos">Probar modelos</button>
        <span class="muted">El token se guarda cifrado y no se devuelve.</span>
      </div>
    </div>
    ${diagnosticoHtml()}`;
}

function diagnosticoHtml() {
  const diag = state.diagnostico;
  if (!diag) return '';
  const filas = (diag.results ?? [])
    .map(
      (r) =>
        `<li>${r.ok ? '✅' : '❌'} ${esc(r.model)}${r.error ? ' — ' + esc(r.error) : ''}</li>`,
    )
    .join('');
  return `
    <div class="card">
      <h3>Prueba de modelos</h3>
      <p>${
        diag.modelo
          ? `Modelo elegido: <strong>${esc(diag.modelo)}</strong>`
          : 'Ningún modelo ha respondido.'
      }</p>
      ${filas ? `<ul>${filas}</ul>` : ''}
    </div>`;
}

/* ---------- Acciones ---------- */

async function loadAll() {
  const [diners, plans, config] = await Promise.all([api('/diners'), api('/plans'), api('/config/ai')]);
  state.diners = diners;
  state.plans = plans;
  state.config = config;
  state.plan = plans.length ? plans[plans.length - 1] : null;
}

async function loadPlans() {
  state.plans = await api('/plans');
}

async function loadDiners() {
  state.diners = await api('/diners');
}

async function crearPlan() {
  const fechaInicio = $('#nuevo-inicio').value;
  const fechaFin = $('#nuevo-fin').value;
  if (!fechaInicio || !fechaFin) throw new Error('Indica el inicio y el fin de la semana');
  state.plan = await api('/plans', { method: 'POST', body: { fechaInicio, fechaFin } });
  await loadPlans();
  render();
}

async function abrirPlan(id) {
  state.plan = await api(`/plans/${id}`);
  render();
}

async function cerrarPlan() {
  if (!state.plan) return;
  state.plan = await api(`/plans/${state.plan.id}/close`, { method: 'POST', body: { homeNames: [] } });
  await loadPlans();
  toast('Semana cerrada y compra generada');
  render();
}

async function setCompra(itemId, estado) {
  state.plan = await api(`/plans/${state.plan.id}/shopping-items/${itemId}`, {
    method: 'PATCH',
    body: { estado },
  });
  render();
}

async function enviarChat() {
  const input = $('#chat-input');
  const text = input?.value.trim();
  if (!text) return;
  state.messages.push({ rol: 'usuario', contenido: text });
  state.lastPlan = null;
  renderChat();
  const response = await api('/chat/messages', {
    method: 'POST',
    body: { text, conversacionId: state.conversacionId },
  });
  state.conversacionId = response.conversacionId;
  state.messages.push({ rol: 'asistente', contenido: response.reply });
  state.lastPlan = response.plan ?? null;
  renderChat();
}

async function aplicarPlan() {
  if (!state.lastPlan) return;
  let plan = state.plan;
  if (!plan) {
    plan = await api('/plans', {
      method: 'POST',
      body: { fechaInicio: state.lastPlan.fechaInicio, fechaFin: state.lastPlan.fechaFin },
    });
  }
  state.plan = await api(`/plans/${plan.id}/apply`, { method: 'POST', body: { plan: state.lastPlan } });
  state.lastPlan = null;
  await loadPlans();
  showTab('semana');
  toast('Plan aplicado a la semana');
}

async function guardarConfig() {
  const body = {
    proveedor: $('#cfg-proveedor').value,
    modelo: $('#cfg-modelo').value,
    parametros: { baseUrl: $('#cfg-baseurl').value || undefined },
    activo: true,
  };
  const token = $('#cfg-token').value;
  if (token) body.token = token;
  state.config = await api('/config/ai', { method: 'PUT', body });
  toast('Configuración guardada');
  render();
}

async function probarModelos() {
  toast('Probando modelos, puede tardar…');
  state.diagnostico = await api('/config/ai/test', { method: 'POST', body: {} });
  if (state.diagnostico.modelo) {
    state.config = await api('/config/ai');
    toast(`Modelo que responde: ${state.diagnostico.modelo}`);
  } else {
    toast('Ningún modelo ha respondido', true);
  }
  render();
}

async function addDiner() {
  const nombre = $('#diner-nombre').value.trim();
  if (!nombre) throw new Error('El comensal necesita un nombre');
  await api('/diners', { method: 'POST', body: { nombre, dieta: $('#diner-dieta').value } });
  await loadDiners();
  render();
}

/* ---------- Eventos ---------- */

document.addEventListener('click', async (event) => {
  const tab = event.target.closest('.tab[data-tab]');
  if (tab) {
    showTab(tab.dataset.tab);
    return;
  }
  const button = event.target.closest('button');
  if (!button) return;
  try {
    if (button.id === 'btn-auth') await submitAuth();
    else if (button.id === 'btn-auth-toggle') {
      state.authMode = state.authMode === 'register' ? 'login' : 'register';
      renderAuth();
    }
    else if (button.id === 'btn-logout') await logout();
    else if (button.id === 'btn-nuevo-plan') await crearPlan();
    else if (button.id === 'btn-cerrar') await cerrarPlan();
    else if (button.id === 'btn-chat-send') await enviarChat();
    else if (button.id === 'btn-aplicar') await aplicarPlan();
    else if (button.id === 'btn-guardar-config') await guardarConfig();
    else if (button.id === 'btn-probar-modelos') await probarModelos();
    else if (button.id === 'btn-add-diner') await addDiner();
    else if (button.dataset.shop) await setCompra(button.dataset.shop, button.dataset.estado);
  } catch (error) {
    toast(error.message, true);
  }
});

document.addEventListener('change', async (event) => {
  try {
    const select = event.target.closest('#plan-select');
    if (select && select.value) {
      await abrirPlan(select.value);
      return;
    }
    const check = event.target.closest('input[data-meal]');
    if (check && state.plan) {
      state.plan = await api(`/plans/${state.plan.id}/verify`, {
        method: 'POST',
        body: {
          mealId: check.dataset.meal,
          comensalId: check.dataset.diner,
          verificado: check.checked,
        },
      });
      render();
    }
  } catch (error) {
    toast(error.message, true);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  if (event.target.id === 'chat-input') {
    event.preventDefault();
    enviarChat().catch((error) => toast(error.message, true));
  }
  if (['auth-nombre', 'auth-password', 'auth-password2'].includes(event.target.id)) {
    event.preventDefault();
    submitAuth().catch((error) => toast(error.message, true));
  }
});

/* ---------- Arranque ---------- */

async function enterApp() {
  const me = await rawJson('/auth/me');
  state.usuario = me.data?.usuario ?? null;
  await loadAll();
  $('#nav-tabs').classList.remove('hidden');
  $('#btn-logout').classList.remove('hidden');
  $('#view-auth').classList.add('hidden');
  showTab('semana');
}

async function init() {
  try {
    const me = await rawJson('/auth/me');
    if (me.status === 200) {
      state.usuario = me.data.usuario;
      await loadAll();
      $('#nav-tabs').classList.remove('hidden');
      $('#btn-logout').classList.remove('hidden');
      $('#view-auth').classList.add('hidden');
      showTab('semana');
      return;
    }
    showAuth({
      necesitaSetup: Boolean(me.data?.necesitaSetup),
      registroAbierto: me.data?.registroAbierto !== false,
      codigoRequerido: Boolean(me.data?.codigoRequerido),
    });
  } catch (error) {
    toast(error.message, true);
  }
}

init();
