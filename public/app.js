/* =========================================================
   APP DE ACORDES - JavaScript puro (sin frameworks)
   Funciones:
   - Crear/guardar/eliminar canciones (localStorage)
   - Buscar
   - Visualizar con acordes alineados (monospace)
   - Transponer acordes (+/- semitono)
   - Cambiar tono base directamente
   - Auto-scroll, copiar, modo oscuro
   ========================================================= */

// ============== CONSTANTES MUSICALES ==============

// Las 12 notas de la escala cromática (usamos sostenidos como base interna)
const NOTAS_SOSTENIDOS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// Equivalencias en bemoles (para soportar entrada en bemoles)
const BEMOL_A_SOSTENIDO = {
  "Db":"C#", "Eb":"D#", "Gb":"F#", "Ab":"G#", "Bb":"A#"
};

// Para mostrar al usuario lista de tonos disponibles
const TONOS_DISPONIBLES = NOTAS_SOSTENIDOS;

// Clave usada en localStorage
const STORAGE_KEY = "canciones_acordes_v1";
const TEMA_KEY = "tema_acordes";

// ============== ESTADO GLOBAL ==============

let canciones = [];        // Array de canciones cargadas desde localStorage
let cancionActual = null;  // Canción que se está visualizando
let tonoActual = "C";      // Tono actual del visor (puede cambiar al transponer)
let scrollInterval = null; // Identificador del auto-scroll

// ============== UTILIDADES ==============

/**
 * Carga canciones desde localStorage.
 */
function cargarCanciones() {
  const data = localStorage.getItem(STORAGE_KEY);
  canciones = data ? JSON.parse(data) : [];
}

/**
 * Guarda el array de canciones en localStorage.
 */
function guardarEnStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(canciones));
}

/**
 * Muestra una notificación temporal en pantalla.
 */
function toast(mensaje) {
  const t = document.getElementById("toast");
  t.textContent = mensaje;
  t.classList.add("visible");
  setTimeout(() => t.classList.remove("visible"), 2000);
}

/**
 * Cambia entre vistas (lista, nueva, visor, ayuda).
 */
function mostrarVista(nombre) {
  document.querySelectorAll(".vista").forEach(v => v.classList.remove("activa"));
  document.getElementById("vista-" + nombre).classList.add("activa");

  // Actualizar pestañas activas (solo para las que existen como tab)
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === nombre);
  });
}

// ============== LÓGICA DE ACORDES ==============

/**
 * Convierte una nota a su forma con sostenido (normaliza bemoles).
 * Ej: "Bb" -> "A#"
 */
function normalizarNota(nota) {
  return BEMOL_A_SOSTENIDO[nota] || nota;
}

/**
 * Devuelve el índice (0-11) de una nota en la escala cromática.
 */
function indiceNota(nota) {
  return NOTAS_SOSTENIDOS.indexOf(normalizarNota(nota));
}

/**
 * Transpone UN acorde por una cantidad de semitonos.
 * Acepta acordes como: C, Am, G7, F#m, Bbmaj7, D/F#, etc.
 * Conserva el sufijo (m, 7, maj7, sus4, etc.) y el bajo (/X).
 */
function transponerAcorde(acorde, semitonos) {
  // Regex: captura raíz (A-G + opcional # o b), sufijo (m, 7, maj, etc.) y bajo opcional (/X)
  const regex = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;
  const m = acorde.match(regex);
  if (!m) return acorde; // si no es un acorde válido, no lo cambiamos

  const [, raiz, sufijo, bajo] = m;

  // Transponer la raíz
  const idxRaiz = indiceNota(raiz);
  if (idxRaiz === -1) return acorde;
  const nuevaRaiz = NOTAS_SOSTENIDOS[(idxRaiz + semitonos + 1200) % 12];

  // Transponer el bajo si existe
  let nuevoBajo = "";
  if (bajo) {
    const idxBajo = indiceNota(bajo);
    if (idxBajo !== -1) {
      nuevoBajo = "/" + NOTAS_SOSTENIDOS[(idxBajo + semitonos + 1200) % 12];
    }
  }

  return nuevaRaiz + sufijo + nuevoBajo;
}

/**
 * Detecta si una línea de texto es una "línea de acordes".
 * Una línea es de acordes si todas sus palabras (ignorando espacios) parecen acordes.
 */
function esLineaDeAcordes(linea) {
  const palabras = linea.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return false;

  // Regex de un acorde válido: A-G, opcional #/b, opcional sufijo, opcional /bajo
  const regexAcorde = /^[A-G][#b]?[a-zA-Z0-9]*(?:\/[A-G][#b]?)?$/;
  return palabras.every(p => regexAcorde.test(p));
}

/**
 * Transpone una línea completa de acordes manteniendo las posiciones (espacios)
 * para que sigan alineados con la letra de abajo.
 */
function transponerLineaAcordes(linea, semitonos) {
  // Recorremos carácter a carácter agrupando "palabras" y respetando espacios.
  let resultado = "";
  let i = 0;
  while (i < linea.length) {
    if (linea[i] === " ") {
      resultado += " ";
      i++;
    } else {
      // Leer la palabra hasta el siguiente espacio
      let palabra = "";
      while (i < linea.length && linea[i] !== " ") {
        palabra += linea[i];
        i++;
      }
      const transpuesto = transponerAcorde(palabra, semitonos);

      // Para mantener alineación: si el nuevo acorde es más corto, rellenamos
      // con espacios; si es más largo, lo dejamos pasar (puede desalinear ligeramente).
      resultado += transpuesto;
      const diff = palabra.length - transpuesto.length;
      if (diff > 0) resultado += " ".repeat(diff);
    }
  }
  return resultado;
}

/**
 * Renderiza la letra completa con sus acordes ya transpuestos.
 * Devuelve HTML donde las líneas de acordes tienen una clase para colorearlas.
 */
function renderizarLetra(letra, semitonos) {
  const lineas = letra.split("\n");
  return lineas.map(linea => {
    if (esLineaDeAcordes(linea)) {
      const transpuesta = transponerLineaAcordes(linea, semitonos);
      // Escapamos HTML por seguridad
      return `<span class="linea-acordes">${escapeHtml(transpuesta)}</span>`;
    }
    return escapeHtml(linea);
  }).join("\n");
}

/**
 * Escapa caracteres HTML básicos.
 */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

// ============== LISTA DE CANCIONES ==============

/**
 * Renderiza la lista de canciones, aplicando el filtro del buscador.
 */
function renderizarLista() {
  const filtro = document.getElementById("buscador").value.toLowerCase().trim();
  const cont = document.getElementById("listaCanciones");

  // Filtrar por título, artista o contenido (letra)
  const filtradas = canciones.filter(c => {
    if (!filtro) return true;
    return c.titulo.toLowerCase().includes(filtro) ||
           (c.artista || "").toLowerCase().includes(filtro) ||
           c.letra.toLowerCase().includes(filtro);
  });

  if (filtradas.length === 0) {
    cont.innerHTML = `<div class="vacio">
      ${canciones.length === 0
        ? "Aún no hay canciones. Crea la primera desde la pestaña ➕ Nueva."
        : "No se encontraron canciones con ese término."}
    </div>`;
    return;
  }

  cont.innerHTML = filtradas.map(c => `
    <div class="cancion-item">
      <div class="cancion-item-info">
        <h3>${escapeHtml(c.titulo)}</h3>
        <p>${escapeHtml(c.artista || "Sin artista")} · Tono: ${escapeHtml(c.tono)}</p>
      </div>
      <div class="cancion-item-acciones">
        <button class="btn btn-primario" onclick="verCancion('${c.id}')">Ver</button>
        <button class="btn btn-eliminar" onclick="eliminarCancion('${c.id}')">Eliminar</button>
      </div>
    </div>
  `).join("");
}

// ============== ACCIONES ==============

/**
 * Guarda una nueva canción desde el formulario.
 */
function guardarCancion() {
  const titulo = document.getElementById("inpTitulo").value.trim();
  const artista = document.getElementById("inpArtista").value.trim();
  const tono = document.getElementById("inpTono").value;
  const letra = document.getElementById("inpLetra").value;

  if (!titulo) { toast("Falta el título"); return; }
  if (!letra.trim()) { toast("Falta la letra"); return; }

  const nueva = {
    id: Date.now().toString(),
    titulo,
    artista,
    tono,
    letra
  };
  canciones.push(nueva);
  guardarEnStorage();
  toast("Canción guardada ✓");
  limpiarFormulario();
  renderizarLista();
  mostrarVista("lista");
}

/**
 * Limpia los campos del formulario.
 */
function limpiarFormulario() {
  document.getElementById("inpTitulo").value = "";
  document.getElementById("inpArtista").value = "";
  document.getElementById("inpLetra").value = "";
  document.getElementById("inpTono").value = "C";
}

/**
 * Elimina una canción tras confirmación.
 */
function eliminarCancion(id) {
  const c = canciones.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`¿Eliminar "${c.titulo}"? Esta acción no se puede deshacer.`)) return;
  canciones = canciones.filter(x => x.id !== id);
  guardarEnStorage();
  renderizarLista();
  toast("Canción eliminada");
}

/**
 * Muestra el visor con la canción seleccionada.
 */
function verCancion(id) {
  const c = canciones.find(x => x.id === id);
  if (!c) return;
  cancionActual = c;
  tonoActual = c.tono;
  document.getElementById("visorTitulo").textContent = c.titulo;
  document.getElementById("visorArtista").textContent = c.artista || "";
  pintarVisor();
  mostrarVista("visor");
}

/**
 * Calcula los semitonos entre el tono original y el actual,
 * y renderiza la canción transpuesta.
 */
function pintarVisor() {
  if (!cancionActual) return;
  const idxOrig = indiceNota(cancionActual.tono);
  const idxAct = indiceNota(tonoActual);
  const semitonos = idxAct - idxOrig;

  document.getElementById("tonoActual").textContent = tonoActual;
  document.getElementById("selectorTono").value = tonoActual;
  document.getElementById("visorLetra").innerHTML = renderizarLetra(cancionActual.letra, semitonos);
}

/**
 * Sube/baja el tono actual N semitonos.
 */
function transponer(semitonos) {
  const idx = indiceNota(tonoActual);
  tonoActual = NOTAS_SOSTENIDOS[(idx + semitonos + 12) % 12];
  pintarVisor();
}

/**
 * Activa/desactiva el auto-scroll.
 */
function toggleAutoScroll() {
  const btn = document.getElementById("btnScroll");
  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
    btn.textContent = "▶ Auto-scroll";
  } else {
    scrollInterval = setInterval(() => {
      window.scrollBy({ top: 1, behavior: "auto" });
      // Si llegamos al final, paramos
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 2) {
        clearInterval(scrollInterval);
        scrollInterval = null;
        btn.textContent = "▶ Auto-scroll";
      }
    }, 80);
    btn.textContent = "⏸ Detener";
  }
}

/**
 * Copia la canción (texto plano transpuesto) al portapapeles.
 */
function copiarCancion() {
  if (!cancionActual) return;
  const idxOrig = indiceNota(cancionActual.tono);
  const idxAct = indiceNota(tonoActual);
  const semitonos = idxAct - idxOrig;

  // Generamos versión texto plano (sin HTML)
  const texto = cancionActual.letra.split("\n").map(linea => {
    if (esLineaDeAcordes(linea)) return transponerLineaAcordes(linea, semitonos);
    return linea;
  }).join("\n");

  const completo = `${cancionActual.titulo}${cancionActual.artista ? " - " + cancionActual.artista : ""}\nTono: ${tonoActual}\n\n${texto}`;

  navigator.clipboard.writeText(completo)
    .then(() => toast("Copiado al portapapeles ✓"))
    .catch(() => toast("No se pudo copiar"));
}

/**
 * Alterna modo oscuro y guarda preferencia.
 */
function toggleTema() {
  document.body.classList.toggle("oscuro");
  const oscuro = document.body.classList.contains("oscuro");
  localStorage.setItem(TEMA_KEY, oscuro ? "oscuro" : "claro");
  document.getElementById("btnTema").textContent = oscuro ? "☀️" : "🌙";
}

// ============== INICIALIZACIÓN ==============

/**
 * Llena el <select> de tonos con las 12 notas.
 */
function llenarSelectoresTono() {
  const opciones = TONOS_DISPONIBLES.map(t => `<option value="${t}">${t}</option>`).join("");
  document.getElementById("inpTono").innerHTML = opciones;
  document.getElementById("selectorTono").innerHTML = opciones;
}

/**
 * Punto de entrada: registra eventos, carga datos y pinta la lista.
 */
function init() {
  // Cargar datos
  cargarCanciones();
  llenarSelectoresTono();

  // Cargar tema guardado
  if (localStorage.getItem(TEMA_KEY) === "oscuro") {
    document.body.classList.add("oscuro");
    document.getElementById("btnTema").textContent = "☀️";
  }

  // Eventos de pestañas
  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => mostrarVista(t.dataset.tab));
  });

  // Eventos del formulario
  document.getElementById("btnGuardar").addEventListener("click", guardarCancion);
  document.getElementById("btnCancelar").addEventListener("click", () => {
    limpiarFormulario();
    mostrarVista("lista");
  });

  // Buscador en tiempo real
  document.getElementById("buscador").addEventListener("input", renderizarLista);

  // Visor
  document.getElementById("btnVolver").addEventListener("click", () => {
    if (scrollInterval) toggleAutoScroll(); // detener scroll si estaba activo
    mostrarVista("lista");
  });
  document.getElementById("btnSubir").addEventListener("click", () => transponer(1));
  document.getElementById("btnBajar").addEventListener("click", () => transponer(-1));
  document.getElementById("selectorTono").addEventListener("change", e => {
    tonoActual = e.target.value;
    pintarVisor();
  });
  document.getElementById("btnScroll").addEventListener("click", toggleAutoScroll);
  document.getElementById("btnCopiar").addEventListener("click", copiarCancion);

  // Tema
  document.getElementById("btnTema").addEventListener("click", toggleTema);

  // Render inicial
  renderizarLista();
}

// Exponer funciones usadas desde HTML inline (onclick)
window.verCancion = verCancion;
window.eliminarCancion = eliminarCancion;

// Iniciar al cargar el DOM
document.addEventListener("DOMContentLoaded", init);
