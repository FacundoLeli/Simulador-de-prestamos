// Simulador de préstamo

// Helper para seleccionar nodos del DOM
const $ = (selector, root = document) => root.querySelector(selector);

// Referencias a elementos de la UI
const ui = {
  nombre: $('#nombreCliente'),
  ingresos: $('#ingresosMensuales'),
  edad: $('#edadCliente'),
  monto: $('#monto'),
  plazo: $('#plazo'),
  btn: $('#btnCalcular'),
  cuota: $('#cuotaMensual'),
  total: $('#montoTotalDevolver'),
  histWrap: $('#historialLista'),
  vaciarBtn: $('#limpiarHistorial'),
  dlg: $('#confirmDialog'),
  dlgMsg: $('#confirmMessage'),
  dlgOk: $('#confirmClear'),
  dlgNo: $('#cancelClear')
};

// Contenedores de mensajes de error por campo
const uiErr = {
  nombre: $('#errorNombre'),
  ingresos: $('#errorIngresos'),
  edad: $('#errorEdad'),
  monto: $('#errorMonto'),
  plazo: $('#errorPlazo')
};

// RNG con “seed” diaria 
const rnd = (() => {
  const d = new Date();
  // combinación simple de año/mes/día como semilla
  let x = (d.getFullYear() * 1337) + (d.getMonth() + 1) * 71 + d.getDate();
  // LCG clásico
  return () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296;
})();

// Utilidades de aleatoriedad/elección
const R = {
  // Elige un elemento al azar de un array
  p: a => a[Math.floor(rnd() * a.length)],
  // True/false con probabilidad x
  c: (x = 0.5) => rnd() < x,
  // Separador visual aleatorio para textos
  pausa: () => R.p(['—', '…', ' · ', ''])
};

// Copys de UI con variaciones mínimas para no repetir siempre lo mismo
const TX = {
  okCalc: ({ monto, plazo }) => R.p([
    `Ok. ${R.pausa()} ${plazo} meses. Ajustable si hace falta.`,
    `Hecho. Cuota y total arriba.`,
    `Listo, números listos.`
  ]),
  okDel: ['Borrado.', 'Eliminado.', 'Fuera.'],
  okClear: ['Vacío.', 'Limpio.', 'En cero.'],
  errVal: ['Revisá lo marcado.', 'Falta completar.', 'Hay que corregir.'],
  qDel: ['¿Borrar este?', '¿Eliminar?', '¿Lo sacamos?'],
  qClear: ['Borra todo, ¿seguimos?', '¿Limpiar completo?', '¿Dejar en cero?']
};

// Formatea números a moneda ARS con fallback
function aMoneda(n) {
  const v = +n;
  if (!Number.isFinite(v)) return '$0';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 2
    }).format(v);
  } catch {
    // Fallback si Intl no está disponible
    return '$' + (Math.round(v * 100) / 100).toLocaleString('es-AR');
  }
}

// Muestra avisos
function avisar(txt, tipo) {
  const bg = ({ ok: '#2ecc71', err: '#e74c3c', info: '#1856a6' })[tipo] || '#1856a6';
  if (typeof Toastify === 'function') {
    Toastify({
      text: String(txt || ''),
      duration: 1100 + Math.floor(rnd() * 1500),
      gravity: R.c(0.7) ? 'top' : 'bottom',
      position: R.c(0.52) ? 'right' : 'left',
      backgroundColor: bg,
      stopOnFocus: true
    }).showToast();
  } else {
    console.log(`[${tipo || 'info'}] ${txt}`);
  }
}

// Coloca/limpia mensajes de error en pantalla y alterna visibilidad
function setErr(el, msg) {
  if (el) {
    el.textContent = msg || '';
    el.classList.toggle('visible', !!msg);
  }
}

// Valida los campos de entrada. Devuelve un array con los nombres de campos con error.
function revisarCampos() {
  const e = [];

  // Nombre: mínimo 3 caracteres, sin números
  const nom = String(ui.nombre.value || '').trim();
  if (/^\d+\s?/.test(nom)) {
    setErr(uiErr.nombre, R.p(['Sin números al inicio.', 'Probá sin números.']));
    e.push('nombre');
  } else if (nom.length < 3) {
    setErr(uiErr.nombre, R.p(['Nombre y apellido.', 'Muy corto.']));
    e.push('nombre');
  } else if (/\d/.test(nom)) {
    setErr(uiErr.nombre, R.p(['El nombre no lleva números.', 'Quitá los números.']));
    e.push('nombre');
  } else {
    setErr(uiErr.nombre, '');
  }

  // Ingresos: número válido positivo
  const ing = +ui.ingresos.value;
  if (!Number.isFinite(ing) || ing < 1) {
    setErr(uiErr.ingresos, R.p(['Ingresos inválidos.', 'Revisá ingresos.']));
    e.push('ingresos');
  } else {
    setErr(uiErr.ingresos, '');
  }

  // Edad: rango 18–99
  const ed = +ui.edad.value;
  if (!Number.isFinite(ed) || ed < 18 || ed > 99) {
    setErr(uiErr.edad, R.p(['Edad 18–99.', 'Revisá edad.']));
    e.push('edad');
  } else {
    setErr(uiErr.edad, '');
  }

  // Monto: rango permitido
  const mon = +ui.monto.value;
  if (!Number.isFinite(mon) || mon < 10000 || mon > 500000) {
    setErr(uiErr.monto, R.p(['Monto $10.000–$500.000.', 'Revisá monto.']));
    e.push('monto');
  } else {
    setErr(uiErr.monto, '');
  }

  // Plazo: 6–60 meses
  const plz = +ui.plazo.value;
  if (!Number.isFinite(plz) || plz < 6 || plz > 60) {
    setErr(uiErr.plazo, R.p(['Plazo 6–60.', 'Revisá plazo.']));
    e.push('plazo');
  } else {
    setErr(uiErr.plazo, '');
  }

  return e;
}

// Habilita/deshabilita el botón principal según la validación
function activarBoton() {
  ui.btn.disabled = revisarCampos().length > 0;
}

// Estima una tasa mensual según el plazo y un perfil simple del usuario
function tasaPorPlazo(meses) {
  const n = +meses || 0;
  // Base por tramo de plazo
  let base = n <= 12 ? 0.035 : n <= 24 ? 0.040 : n <= 36 ? 0.045 : 0.050;

  // Ajustes muy básicos por ingresos, edad y monto
  const ing = +ui.ingresos.value || 0;
  const edad = +ui.edad.value || 0;
  const mon = +ui.monto.value || 0;
  if (ing > 800000) base -= 0.0004;
  if (edad >= 25 && edad <= 40) base -= 0.0002;
  if (edad < 23) base += 0.0004;
  if (mon >= 200000 && mon < 350000) base += 0.0002;
  else if (mon >= 350000) base += 0.0003;

  // Cota inferior y superior por seguridad
  return Math.max(0.01, Math.min(0.20, base));
}

// Calcula la cuota por sistema francés: cuota = P * i / (1 - (1+i)^-n)
function cuotaMensual(monto, i, n) {
  n = Math.max(1, +n || 0);
  const p = +monto || 0;
  if (!(i > 0)) return p / n; // sin tasa, prorratea
  const den = 1 - Math.pow(1 + i, -n);
  if (den === 0) return p / n;
  const c = (p * i) / den;
  return Number.isFinite(c) && c >= 0 ? c : p / n;
}

// Clave de localStorage para historial
const KEY = 'k.n12b';

// Fallback de memoria en caso de error con localStorage
let mem = [];

// Carga historial desde localStorage (o memoria)
function cargarHist() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return mem.slice();
  }
}

// Guarda historial
function guardarHist(a) {
  try {
    localStorage.setItem(KEY, JSON.stringify(a));
  } catch {
    mem = a.slice();
  }
}

// Agrega un ítem al inicio del historial y repinta
function pushHist(it) {
  const l = cargarHist();
  l.unshift(it);
  guardarHist(l);
  pintarHist(l);
}

// Limpia historial
function limpiarHist() {
  try {
    localStorage.removeItem(KEY);
    localStorage.setItem(KEY, '[]');
  } catch {
    mem = [];
  }
  pintarHist([]);
}

// Renderiza el historial en la UI
function pintarHist(lista) {
  const w = ui.histWrap;
  w.innerHTML = '';

  // Mensaje vacío
  if (!lista || !lista.length) {
    const p = document.createElement('p');
    p.className = 'historial__vacio';
    p.textContent = R.p([
      'Acá guardamos lo que vas probando.',
      'Tus cálculos quedan acá.',
      'Lo que calcules aparece acá.'
    ]);
    return w.appendChild(p);
  }

  // Ítems del historial
  lista.forEach((it, i) => {
    const fila = document.createElement('div');
    fila.className = 'hist-item';
    fila.dataset.index = String(i);

    const info = document.createElement('div');
    info.className = 'info';
    info.textContent = R.p([
      `Monto ${aMoneda(it?.monto)} · ${it?.plazo} meses · Cuota ${aMoneda(it?.cuota)}`,
      `${aMoneda(it?.monto)} a ${it?.plazo} meses ${R.pausa()} cuota ${aMoneda(it?.cuota)}`
    ]);

    const acciones = document.createElement('div');
    acciones.className = 'acciones';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-sec';
    b.textContent = R.p(['Borrar', 'Eliminar']);

    // Borrado con confirmación
    b.addEventListener('click', e => {
      const idx = Number(e.currentTarget.closest('.hist-item')?.dataset.index);
      if (!Number.isInteger(idx)) return;
      abrirConfirm(R.p(TX.qDel), () => {
        const cur = cargarHist();
        if (idx >= 0 && idx < cur.length) {
          cur.splice(idx, 1);
          guardarHist(cur);
          pintarHist(cur);
          avisar(R.p(TX.okDel), 'ok');
        }
      });
    });

    acciones.appendChild(b);
    fila.appendChild(info);
    fila.appendChild(acciones);
    w.appendChild(fila);
  });
}

// Abre el modal de confirmación con mensaje y callback onOk
function abrirConfirm(msj, onOk) {
  ui.dlgMsg.textContent = msj || '¿Confirmás?';
  ui.dlg.hidden = false;
  // requestAnimationFrame para permitir transición CSS
  requestAnimationFrame(() => ui.dlg.classList.add('visible'));

  const ok = () => { cerrar(); onOk && onOk(); };
  const no = () => { cerrar(); };

  function cerrar() {
    ui.dlg.classList.remove('visible');
    ui.dlg.hidden = true;
    ui.dlgOk.removeEventListener('click', ok);
    ui.dlgNo.removeEventListener('click', no);
  }

  ui.dlgOk.addEventListener('click', ok);
  ui.dlgNo.addEventListener('click', no);
}

// Cerrar modal clickeando afuera
ui.dlg.addEventListener('click', e => {
  if (e.target === ui.dlg) {
    ui.dlg.classList.remove('visible');
    ui.dlg.hidden = true;
  }
});

// Cerrar modal con Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !ui.dlg.hidden) {
    ui.dlg.classList.remove('visible');
    ui.dlg.hidden = true;
  }
});

// Acción principal de cálculo: valida, calcula, muestra y guarda en historial
function accionCalculo() {
  const prob = revisarCampos();
  activarBoton();
  if (prob.length) return avisar(R.p(TX.errVal), 'err');

  const monto = +ui.monto.value;
  const meses = +ui.plazo.value;

  const tasa = tasaPorPlazo(meses);
  const cuota = cuotaMensual(monto, tasa, meses);
  const total = cuota * meses;

  if (!Number.isFinite(cuota) || !Number.isFinite(total)) return;

  ui.cuota.textContent = aMoneda(cuota);
  ui.total.textContent = aMoneda(total);

  pushHist({ monto, plazo: meses, cuota, total, ts: Date.now() });
  avisar(TX.okCalc({ monto, plazo: meses }), 'ok');
}

// Limpia campos y resultados y deshabilita botón
function limpiarTodo() {
  ui.cuota.textContent = R.c(0.5) ? '-' : '—';
  ui.total.textContent = R.c(0.5) ? '-' : '—';
  ui.nombre.value = ui.ingresos.value = ui.edad.value = ui.monto.value = ui.plazo.value = '';
  setErr(uiErr.nombre, '');
  setErr(uiErr.ingresos, '');
  setErr(uiErr.edad, '');
  setErr(uiErr.monto, '');
  setErr(uiErr.plazo, '');
  ui.btn.disabled = true;
}

// Arranque y eventos
document.addEventListener('DOMContentLoaded', () => {
  // Cargar y pintar historial al inicio
  pintarHist(cargarHist());
});

// Validación reactiva sobre inputs
['input', 'blur'].forEach(evt => {
  [ui.nombre, ui.ingresos, ui.edad, ui.monto, ui.plazo].forEach(el => {
    el.addEventListener(evt, () => {
      revisarCampos();
      activarBoton();
    });
  });
});

// Click en “Calcular”
ui.btn.addEventListener('click', () => {
  if (revisarCampos().length) {
    avisar(R.p(TX.errVal), 'err');
    return;
  }
  accionCalculo();
});

// Click en “Limpiar historial”
ui.vaciarBtn.addEventListener('click', () => {
  abrirConfirm(R.p(TX.qClear), () => {
    limpiarHist();
    limpiarTodo();
    avisar(R.p(TX.okClear), 'ok');
  });
});