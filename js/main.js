// --- DECLARACIÓN DE CONSTANTES Y VARIABLES GLOBALES ---
let TASA_INTERES_ANUAL_BASE; // Se cargará del JSON
let COMISION_APERTURA;     // Se cargará del JSON

const MIN_MONTO_PRESTAMO = 10000;
const MAX_MONTO_PRESTAMO = 500000;
const MIN_PLAZO_MESES = 6;
const MAX_PLAZO_MESES = 60;
const MIN_EDAD_CLIENTE = 18;
const MAX_EDAD_CLIENTE = 99;
const MIN_INGRESOS_PARA_PRESTAMO = 100000;

// Array principal para almacenar los préstamos en memoria.
let historialPrestamos = [];

// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const inputNombre = document.getElementById('nombreCliente');
const inputIngresos = document.getElementById('ingresosMensuales');
const inputEdad = document.getElementById('edadCliente');
const inputMonto = document.getElementById('monto');
const inputPlazo = document.getElementById('plazo');

const btnCalcular = document.getElementById('btnCalcular'); 
const limpiarHistorialBtn = document.getElementById('limpiarHistorial'); 

const spanCuotaMensual = document.getElementById('cuotaMensual');
const spanMontoTotalDevolver = document.getElementById('montoTotalDevolver');
const divHistorialLista = document.getElementById('historialLista');

const errorNombre = document.getElementById('errorNombre');
const errorIngresos = document.getElementById('errorIngresos');
const errorEdad = document.getElementById('errorEdad');
const errorMonto = document.getElementById('errorMonto');
const errorPlazo = document.getElementById('errorPlazo');

const confirmDialog = document.getElementById('confirmDialog');
const confirmMessage = document.getElementById('confirmMessage');
const confirmClearBtn = document.getElementById('confirmClear');   
const cancelClearBtn = document.getElementById('cancelClear');     

let accionConfirmacionPendiente = null;
let idItemAEliminar = null;

// --- FUNCIONES DE UTILIDAD PARA EL DOM Y MENSAJES (con Toastify) ---

function mostrarErrorEnCampo(elementoError, mensaje) {
    if (elementoError) {
        elementoError.textContent = mensaje;
        elementoError.classList.add('visible');
    }
}

function ocultarErrorDeCampo(elementoError) {
    if (elementoError) {
        elementoError.textContent = '';
        elementoError.classList.remove('visible');
    }
}

function mostrarNotificacion(mensaje, tipo = 'info') {
    let backgroundColor = "#0056b3";
    if (tipo === 'success') {
        backgroundColor = "#28a745";
    } else if (tipo === 'error') {
        backgroundColor = "#dc3545";
    } else if (tipo === 'warning') {
        backgroundColor = "#ffc107";
    }

    Toastify({
        text: mensaje,
        duration: 3000,
        close: true,
        gravity: "bottom", 
        position: "right", 
        stopOnFocus: true,
        style: {
            background: backgroundColor,
        },
    }).showToast();
}

function mostrarConfirmacionEnDOM(mensaje, accion, id = null) {
    console.log(`%c[Confirmación] Mostrando diálogo para acción: ${accion}, ID: ${id}`, 'color: blue;');
    confirmMessage.textContent = mensaje;
    accionConfirmacionPendiente = accion;
    idItemAEliminar = id;
    confirmDialog.classList.add('visible');
}

function ocultarConfirmacionEnDOM() {
    console.log("%c[Confirmación] Ocultando diálogo.", 'color: blue;');
    confirmDialog.classList.remove('visible');
    accionConfirmacionPendiente = null;
    idItemAEliminar = null;
}

// --- GESTIÓN DE LOCALSTORAGE ---

function cargarHistorialDesdeStorage() {
    console.log("%c[LocalStorage] Intentando cargar historial...", 'color: green;');
    const historialGuardado = localStorage.getItem('historialPrestamos');
    if (historialGuardado) {
        try {
            const parsedHistorial = JSON.parse(historialGuardado) || [];
            historialPrestamos = parsedHistorial.filter(item => 
                typeof item === 'object' && item !== null && typeof item.id !== 'undefined'
            ).map(item => ({ ...item, id: parseInt(item.id) || 0 }));
            
            historialPrestamos.sort((a, b) => a.id - b.id);
            console.log(`%c[LocalStorage] Historial cargado. Elementos: ${historialPrestamos.length}`, 'color: green;');

        } catch (e) {
            console.error("%c[LocalStorage ERROR] Error al parsear historial de LocalStorage, se usará historial vacío:", 'color: red;', e);
            mostrarNotificacion("Error al cargar historial guardado. Se ha reiniciado.", "error");
            historialPrestamos = [];
        }
    } else {
        historialPrestamos = [];
        console.log("%c[LocalStorage] No se encontró historial guardado. Historial vacío.", 'color: green;');
    }
    mostrarHistorialEnDOM(); 
}

function guardarHistorialEnStorage() {
    console.log(`%c[LocalStorage] Guardando historial. Elementos: ${historialPrestamos.length}`, 'color: green;');
    localStorage.setItem('historialPrestamos', JSON.stringify(historialPrestamos));
}

// --- LÓGICA DEL SIMULADOR ---

async function cargarConfiguracionInicial() {
    console.log("%c[Config] Cargando configuración desde JSON...", 'color: purple;');
    try {
        const respuesta = await fetch('./json/config.json'); // Ruta corregida para la carpeta json
        if (!respuesta.ok) {
            throw new Error(`Error HTTP: ${respuesta.status}`);
        }
        const config = await respuesta.json();
        TASA_INTERES_ANUAL_BASE = config.tasaInteresAnualBase;
        COMISION_APERTURA = config.comisionApertura;
        console.log(`%c[Config] Configuración cargada: Tasa=${TASA_INTERES_ANUAL_BASE}, Comisión=${COMISION_APERTURA}`, 'color: purple;');
        mostrarNotificacion("Configuración de tasas cargada con éxito.", "success");
    } catch (error) {
        console.error("%c[Config ERROR] Hubo un problema al cargar la configuración inicial:", 'color: red;', error);
        mostrarNotificacion("Error al cargar la configuración. Usando valores por defecto.", "error");
        TASA_INTERES_ANUAL_BASE = 0.60;
        COMISION_APERTURA = 0.02;
    }
}

function validarTodasLasEntradas(nombre, ingresos, edad, monto, plazo) {
    let esValido = true;
    if (inputNombre && nombre.trim() === '') { mostrarErrorEnCampo(errorNombre, "El nombre es obligatorio."); esValido = false; } else { ocultarErrorDeCampo(errorNombre); }
    if (inputIngresos && (isNaN(ingresos) || ingresos < MIN_INGRESOS_PARA_PRESTAMO)) { mostrarErrorEnCampo(errorIngresos, `Ingresos mínimos de $${MIN_INGRESOS_PARA_PRESTAMO.toLocaleString('es-AR')}.`); esValido = false; } else { ocultarErrorDeCampo(errorIngresos); }
    if (inputEdad && (isNaN(edad) || edad < MIN_EDAD_CLIENTE || edad > MAX_EDAD_CLIENTE)) { mostrarErrorEnCampo(errorEdad, `La edad debe estar entre ${MIN_EDAD_CLIENTE} y ${MAX_EDAD_CLIENTE} años.`); esValido = false; } else { ocultarErrorDeCampo(errorEdad); }
    if (inputMonto && (isNaN(monto) || monto < MIN_MONTO_PRESTAMO || monto > MAX_MONTO_PRESTAMO)) { mostrarErrorEnCampo(errorMonto, `Monto entre $${MIN_MONTO_PRESTAMO.toLocaleString('es-AR')} y $${MAX_MONTO_PRESTAMO.toLocaleString('es-AR')}.`); esValido = false; } else { ocultarErrorDeCampo(errorMonto); }
    if (inputPlazo && (isNaN(plazo) || plazo < MIN_PLAZO_MESES || plazo > MAX_PLAZO_MESES)) { mostrarErrorEnCampo(errorPlazo, `Plazo entre ${MIN_PLAZO_MESES} y ${MAX_PLAZO_MESES} meses.`); esValido = false; } else { ocultarErrorDeCampo(errorPlazo); }
    
    if (!esValido) {
        console.warn("%c[Validación] Errores en el formulario.", 'color: orange;');
    }
    return esValido;
}

function esPrestamoAprobado(monto, ingresos, edad) {
    console.log(`%c[Aprobación] Evaluando préstamo: Monto=${monto}, Ingresos=${ingresos}, Edad=${edad}`, 'color: teal;');
    if (edad < MIN_EDAD_CLIENTE) { mostrarNotificacion(`Préstamo RECHAZADO: El solicitante debe tener al menos ${MIN_EDAD_CLIENTE} años.`, "error"); return false; }
    if (ingresos < MIN_INGRESOS_PARA_PRESTAMO) { mostrarNotificacion(`Préstamo RECHAZADO: Ingresos mensuales insuficientes (mínimo $${MIN_INGRESOS_PARA_PRESTAMO.toLocaleString('es-AR')}).`, "error"); return false; }
    const ingresosAnuales = ingresos * 12;
    if (monto > (ingresosAnuales * 0.50)) { mostrarNotificacion("Préstamo RECHAZADO: El monto solicitado excede la capacidad de endeudamiento para sus ingresos.", "error"); return false; }
    console.log("%c[Aprobación] Préstamo aprobado para cálculo.", 'color: teal;');
    return true;
}

function calcularCuotaPrestamo(monto, plazo) {
    console.log(`%c[Cálculo] Calculando para Monto=${monto}, Plazo=${plazo}, Tasa=${TASA_INTERES_ANUAL_BASE}, Comisión=${COMISION_APERTURA}`, 'color: darkgreen;');
    let tasaMensual = TASA_INTERES_ANUAL_BASE / 12;
    if (plazo > 36) { tasaMensual += 0.005; }
    let interesTotal = monto * tasaMensual * plazo;
    let comision = monto * COMISION_APERTURA;
    let montoTotalAPagar = monto + interesTotal + comision;
    let cuotaMensual = montoTotalAPagar / plazo;
    
    console.log(`%c[Cálculo] Cuota Mensual: ${cuotaMensual.toFixed(2)}, Total a Devolver: ${montoTotalAPagar.toFixed(2)}`, 'color: darkgreen;');
    return { cuota: cuotaMensual, total: montoTotalAPagar };
}

function mostrarResultadosEnDOM(cuota, total) {
    console.log(`%c[DOM] Actualizando resultados: Cuota=$${cuota.toFixed(2)}, Total=$${total.toFixed(2)}`, 'color: brown;');
    if (spanCuotaMensual) {
        spanCuotaMensual.textContent = "$" + cuota.toFixed(2);
    }
    if (spanMontoTotalDevolver) {
        spanMontoTotalDevolver.textContent = "$" + total.toFixed(2);
    }
}

// --- ACTUALIZACIÓN DEL DOM DEL HISTORIAL (Manipulación por nodos) ---

function agregarAlHistorial(datosSolicitante, monto, plazo, cuota, total) {
    const ahora = new Date();
    const fechaFormateada = ahora.toLocaleDateString('es-AR');

    const maxId = historialPrestamos.reduce((max, prestamo) => Math.max(max, parseInt(prestamo.id) || 0), 0);
    const nuevoId = maxId + 1;

    const nuevoPrestamo = {
        id: nuevoId, 
        nombre: datosSolicitante.nombre,
        ingresos: datosSolicitante.ingresos,
        edad: datosSolicitante.edad,
        monto: monto,
        plazo: plazo,
        cuota: cuota,
        total: total,
        fecha: fechaFormateada
    };

    historialPrestamos.push(nuevoPrestamo);
    console.log(`%c[Historial] Agregado nuevo préstamo ID: ${nuevoId}. Total de elementos: ${historialPrestamos.length}`, 'color: darkblue;');
    guardarHistorialEnStorage(); 
    mostrarHistorialEnDOM(); 
    mostrarNotificacion("¡Préstamo calculado y guardado con éxito!", "success");
}

function eliminarPrestamo(idAEliminar) {
    console.log(`%c[Historial] Intentando eliminar préstamo con ID: ${idAEliminar}`, 'color: darkblue;');
    const idNumerico = parseInt(idAEliminar); 
    if (isNaN(idNumerico)) {
        console.error("%c[Historial ERROR] El ID a eliminar no es un número válido.", 'color: red;', idAEliminar);
        mostrarNotificacion("Error al intentar eliminar el préstamo. ID inválido.", "error");
        return;
    }

    const indiceAEliminar = historialPrestamos.findIndex(prestamo => prestamo.id === idNumerico);
    if (indiceAEliminar > -1) {
        const eliminado = historialPrestamos.splice(indiceAEliminar, 1); 
        console.log(`%c[Historial] Préstamo ID ${idNumerico} eliminado. Nuevo total: ${historialPrestamos.length}`, 'color: darkblue;', eliminado);
    } else {
        console.warn(`%c[Historial] No se encontró préstamo con ID: ${idNumerico} para eliminar.`, 'color: orange;');
    }
    
    guardarHistorialEnStorage(); 
    mostrarHistorialEnDOM(); 
    mostrarNotificacion("Préstamo eliminado del historial.", "success");
}

function limpiarTodoElHistorial() {
    console.log("%c[Historial] Iniciando limpieza de todo el historial.", 'color: darkred; font-weight: bold;');
    historialPrestamos = []; // Vacía el array en memoria
    localStorage.removeItem('historialPrestamos'); // Borra la clave del LocalStorage
    console.log("%c[Historial] Historial vaciado en memoria y LocalStorage. (Verificar pestaña Application > Local Storage)", 'color: darkred; font-weight: bold;');
    mostrarHistorialEnDOM(); // Refresca el DOM para mostrarlo vacío
    mostrarNotificacion("¡Todo el historial fue limpiado!", "warning");
}

function mostrarHistorialEnDOM() {
    console.log(`%c[DOM Historial] Actualizando lista del historial. Elementos a mostrar: ${historialPrestamos.length}`, 'color: brown;');
    // Elimina todos los hijos existentes del divHistorialLista
    while (divHistorialLista.firstChild) {
        divHistorialLista.removeChild(divHistorialLista.firstChild);
    }

    if (historialPrestamos.length === 0) {
        const noHistoryMsg = document.createElement('p');
        noHistoryMsg.classList.add('no-history-msg');
        noHistoryMsg.textContent = 'Aún no hay cálculos en el historial. ¡Hacé el primero!'; 
        divHistorialLista.appendChild(noHistoryMsg);
        console.log("%c[DOM Historial] Mostrando mensaje de historial vacío.", 'color: brown;');
        return;
    }

    const fragment = document.createDocumentFragment();
    historialPrestamos.forEach(prestamo => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('history-item');
        itemDiv.setAttribute('data-id', prestamo.id); 

        itemDiv.innerHTML = `
            <div>
                <strong>ID #${prestamo.id} - Fecha: ${prestamo.fecha}</strong><br>
                <strong>Cliente:</strong> ${prestamo.nombre} (Edad: ${prestamo.edad} años, Ingresos: $${prestamo.ingresos.toFixed(2)})<br>
                <strong>Monto:</strong> $${prestamo.monto.toFixed(2)} - <strong>Plazo:</strong> ${prestamo.plazo} meses<br>
                <strong>Cuota:</strong> $${prestamo.cuota.toFixed(2)} - <strong>Total:</strong> $${prestamo.total.toFixed(2)}
                <span style="font-size: 0.8em; color: #666; display: block; margin-top: 5px;">Click para eliminar o limpiar todo.</span>
            </div>
            <button class="delete-btn" data-id="${prestamo.id}">Eliminar</button>
        `;
        fragment.appendChild(itemDiv);
    });
    divHistorialLista.appendChild(fragment);
    console.log("%c[DOM Historial] Historial renderizado con elementos.", 'color: brown;');
}

// --- MANEJADORES DE EVENTOS ---

function handleCalcularClick() {
    console.log("%c[Evento] Click en Calcular Préstamo.", 'color: #333;');
    const nombre = inputNombre ? inputNombre.value : '';
    const ingresos = inputIngresos ? parseFloat(inputIngresos.value) : NaN;
    const edad = inputEdad ? parseInt(inputEdad.value) : NaN;
    const monto = inputMonto ? parseFloat(inputMonto.value) : NaN;
    const plazo = inputPlazo ? parseInt(inputPlazo.value) : NaN;

    if (!validarTodasLasEntradas(nombre, ingresos, edad, monto, plazo)) {
        mostrarNotificacion("¡Ojo! Hay datos que no están bien. Revisá el formulario.", "error");
        return;
    }
    if (!esPrestamoAprobado(monto, ingresos, edad)) {
        return;
    }

    const resultadosCalculo = calcularCuotaPrestamo(monto, plazo);
    mostrarResultadosEnDOM(resultadosCalculo.cuota, resultadosCalculo.total);

    const datosSolicitante = {
        nombre: nombre,
        ingresos: ingresos,
        edad: edad
    };
    agregarAlHistorial(datosSolicitante, monto, plazo, resultadosCalculo.cuota, resultadosCalculo.total);
}

function handleLimpiarTodoHistorialClick() {
    console.log("%c[Evento] Click en Limpiar Todo el Historial.", 'color: #333;');
    mostrarConfirmacionEnDOM("¿Estás seguro de que querés borrar todo el historial?", "limpiarTodo");
}

function handleEliminarItemClick(event) {
    if (event.target.classList.contains('delete-btn')) {
        const idDelPrestamo = parseInt(event.target.dataset.id);
        console.log(`%c[Evento] Click en Eliminar ITEM con ID: ${idDelPrestamo}`, 'color: #333;');
        mostrarConfirmacionEnDOM("¿De verdad querés eliminar este préstamo del historial?", "eliminarItem", idDelPrestamo);
    }
}

function handleConfirmResponse(event) {
    console.log(`%c[Evento] Click en botón de confirmación: ${event.target.id}`, 'color: #333;');
    console.log(`%c[Confirmación Debug] Valor de accionConfirmacionPendiente (ANTES): ${accionConfirmacionPendiente}`, 'color: #FF00FF;'); 
    console.log(`%c[Confirmación Debug] ID del target del evento: ${event.target.id}`, 'color: #FF00FF;'); 
    console.log(`%c[Confirmación Debug] ID del confirmClearBtn: ${confirmClearBtn ? confirmClearBtn.id : 'N/A'}`, 'color: #FF00FF;'); 
    console.log(`%c[Confirmación Debug] ID del cancelClearBtn: ${cancelClearBtn ? cancelClearBtn.id : 'N/A'}`, 'color: #FF00FF;'); 

    

    if (event.target.id === 'confirmClear') { 
        console.log("%c[Confirmación Debug] Target ID coincide con 'confirmClear'.", 'color: #00AA00;'); 
        if (accionConfirmacionPendiente === 'limpiarTodo') {
            console.log("%c[Confirmación Debug] Entrando en el bloque de 'limpiarTodo'.", 'color: #FF00FF;'); 
            console.log("%c[Confirmación] EJECUTANDO: limpiarTodoElHistorial().", 'background: #222; color: #bada55; font-size: 1.1em;');
            limpiarTodoElHistorial(); 
        } else if (accionConfirmacionPendiente === 'eliminarItem' && idItemAEliminar !== null) {
            console.log(`%c[Confirmación Debug] Entrando en el bloque de 'eliminarItem' para ID: ${idItemAEliminar}.`, 'color: #FF00FF;'); 
            console.log(`%c[Confirmación] EJECUTANDO: eliminarPrestamo(${idItemAEliminar}).`, 'background: #222; color: #bada55; font-size: 1.1em;');
            eliminarPrestamo(idItemAEliminar); 
        }
    } else if (event.target.id === 'cancelClear') { 
        console.log("%c[Confirmación Debug] Target ID coincide con 'cancelClear'.", 'color: #00AA00;'); 
        console.log("%c[Confirmación] Acción cancelada por el usuario.", 'color: gray;');
    } else {
        console.warn("%c[Confirmación Debug] Click en un elemento inesperado dentro del diálogo.", 'color: orange;'); 
    }
    
    // Se oculta el diálogo y se resetea el estado una vez que la acción fue procesada.
    console.log(`%c[Confirmación Debug] Valor de accionConfirmacionPendiente (DESPUÉS): ${accionConfirmacionPendiente}`, 'color: #FF00FF;'); 
    ocultarConfirmacionEnDOM(); 
}

// --- INICIALIZACIÓN DE LA APLICACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("%c[App Init] DOM completamente cargado. Inicializando...", 'color: #00008b; font-weight: bold;');
    
    cargarConfiguracionInicial();
    cargarHistorialDesdeStorage(); 
    
    // Asocia event listeners solo si los elementos existen
    if (btnCalcular) {
        btnCalcular.addEventListener('click', handleCalcularClick);
        console.log("%c[App Init] Event listener para 'btnCalcular' asociado.", 'color: #00008b;');
    } else {
        console.error("%c[App Init ERROR] Botón 'btnCalcular' no encontrado.", 'color: red;');
    }
    
    if (limpiarHistorialBtn) { 
        limpiarHistorialBtn.addEventListener('click', handleLimpiarTodoHistorialClick);
        console.log("%c[App Init] Event listener para 'limpiarHistorial' asociado.", 'color: #00008b;');
    } else {
        console.error("%c[App Init ERROR] Botón 'limpiarHistorial' no encontrado.", 'color: red;');
    }

    if (divHistorialLista) { 
        divHistorialLista.addEventListener('click', handleEliminarItemClick); 
        console.log("%c[App Init] Event listener para 'divHistorialLista' (delegación) asociado.", 'color: #00008b;');
    } else {
        console.error("%c[App Init ERROR] Contenedor 'historialLista' no encontrado.", 'color: red;');
    }

    if (confirmClearBtn) {
        confirmClearBtn.addEventListener('click', handleConfirmResponse);
        console.log("%c[App Init] Event listener para 'confirmClearBtn' asociado.", 'color: #00008b;');
    } else {
        console.error("%c[App Init ERROR] Botón 'confirmClearBtn' no encontrado.", 'color: red;');
    }
    if (cancelClearBtn) {
        cancelClearBtn.addEventListener('click', handleConfirmResponse);
        console.log("%c[App Init] Event listener para 'cancelClearBtn' asociado.", 'color: #00008b;');
    } else {
        console.error("%c[App Init ERROR] Botón 'cancelClearBtn' no encontrado.", 'color: red;');
    }
    if (confirmDialog) {
        confirmDialog.addEventListener('click', (e) => {
            if (e.target === confirmDialog) {
                ocultarConfirmacionEnDOM(); // También oculta si se hace clic fuera del contenido del diálogo
                console.log("%c[Evento] Click fuera del diálogo de confirmación. Ocultando.", 'color: gray;');
            }
        });
        console.log("%c[App Init] Event listener para 'confirmDialog' (clic exterior) asociado.", 'color: #00008b;');
    } else {
        console.error("%c[App Init ERROR] Diálogo de confirmación 'confirmDialog' no encontrado.", 'color: red;');
    }
});