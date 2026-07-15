/**
 * widget.js — Cargador embebible del agente IVA (Chatbase) con identidad firmada.
 *
 * Cómo insertarlo en CUALQUIER página web (el dashboard del cliente):
 *
 *   <script>
 *     window.ivaUser = {
 *       userId:      "12345678",
 *       userName:    "Jacob",
 *       userSurname: "Rodriguez",
 *       userEmail:   "jrodriguez@atio.com.mx",
 *       phoneNumber: "+52 55 1234 5678",
 *       account:     "D00002",
 *       location:    "Dashboard Inicial",
 *       language:    "es-EN"
 *       // autoOpen: false   // (opcional) no abrir el chat automáticamente
 *     };
 *   </script>
 *   <script src="https://agente-ia-ng.onrender.com/widget.js" defer></script>
 *
 * Si no defines window.ivaUser, el script lee los datos de los parámetros
 * de la URL (?userId=...&userName=...), igual que la página standalone.
 *
 * El secreto HMAC NUNCA está aquí: este script pide la firma a /sign en el
 * mismo servidor desde el que se cargó (Render), que es quien tiene el secreto.
 */
(function () {
  // De dónde se cargó este script → base para llamar a /sign
  var thisScript = document.currentScript;
  var base = thisScript ? new URL(".", thisScript.src).origin : window.location.origin;

  var AGENT_ID = "qOqKnTJHXP8l4RkmHbn3Z";
  var CAMPOS = [
    "userId", "userName", "userSurname", "userEmail", "phoneNumber",
    "account", "location", "language", "error"
  ];

  // Cola oficial de Chatbase: permite llamar a chatbase(...) antes de que
  // el embed termine de cargar; las llamadas se encolan y se reproducen.
  if (!window.chatbase || window.chatbase("getState") !== "initialized") {
    window.chatbase = function () {
      if (!window.chatbase.q) window.chatbase.q = [];
      window.chatbase.q.push(arguments);
    };
    window.chatbase = new Proxy(window.chatbase, {
      get: function (target, prop) {
        if (prop === "q") return target.q;
        return function () {
          return target.apply(null, [prop].concat(Array.prototype.slice.call(arguments)));
        };
      }
    });
  }

  // Reúne los datos del usuario: primero window.ivaUser, si no, los query params
  function obtenerDatos() {
    var cfg = window.ivaUser || {};
    var qs = new URLSearchParams(window.location.search);
    var datos = {};
    CAMPOS.forEach(function (k) {
      var v = cfg[k] != null ? cfg[k] : qs.get(k);
      if (v != null && v !== "" && v !== "null") datos[k] = String(v);
    });
    return datos;
  }

  function debeAbrirSolo() {
    return !window.ivaUser || window.ivaUser.autoOpen !== false;
  }

  /**
   * Al cambiar de usuario, Chatbase puede conservar la sesión del anterior en
   * almacenamiento local y mostrarle sus conversaciones. Guardamos qué usuario
   * cargó la última vez y, si cambió, limpiamos el estado de Chatbase.
   */
  function limpiarSiCambioDeUsuario(userId) {
    var CLAVE = "iva:lastUserId";
    var anterior = null;
    try {
      anterior = window.localStorage.getItem(CLAVE);
    } catch (e) {
      return; // Sin acceso a localStorage no hay estado previo que limpiar
    }

    if (anterior && anterior !== userId) {
      try {
        Object.keys(window.localStorage)
          .filter(function (k) { return k.toLowerCase().indexOf("chatbase") !== -1; })
          .forEach(function (k) { window.localStorage.removeItem(k); });
        Object.keys(window.sessionStorage)
          .filter(function (k) { return k.toLowerCase().indexOf("chatbase") !== -1; })
          .forEach(function (k) { window.sessionStorage.removeItem(k); });
      } catch (e) {
        console.warn("[IVA] No se pudo limpiar la sesión anterior:", e);
      }
    }

    try {
      window.localStorage.setItem(CLAVE, userId);
    } catch (e) { /* no crítico */ }
  }

  async function init() {
    var datos = obtenerDatos();

    if (!datos.userId) {
      console.error(
        "[IVA] Falta userId. Define window.ivaUser = { userId: \"...\", ... } " +
        "antes de cargar widget.js, o pasa ?userId=... en la URL. " +
        "El widget no se carga sin identidad para no mezclar conversaciones."
      );
      return;
    }

    limpiarSiCambioDeUsuario(datos.userId);

    try {
      var params = new URLSearchParams(datos).toString();
      var res = await fetch(base + "/sign?" + params);
      if (!res.ok) throw new Error("respuesta /sign: " + res.status);
      var firmado = await res.json();

      window.chatbaseUserConfig = {
        user_id: firmado.user_id,
        user_hash: firmado.user_hash,
        user_metadata: firmado.user_metadata
      };
    } catch (e) {
      // Sin identidad firmada Chatbase entra en modo anónimo y comparte las
      // conversaciones entre usuarios: preferimos no cargar el widget.
      console.error("[IVA] No se pudo firmar la identidad del usuario:", e);
      return;
    }

    var script = document.createElement("script");
    script.src = "https://iva.crsglobal.net/embed.min.js";
    script.id = AGENT_ID;
    script.domain = "iva.crsglobal.net";

    if (debeAbrirSolo()) {
      script.onload = function () {
        var t0 = Date.now();
        var timer = setInterval(function () {
          if (window.chatbase && window.chatbase.open) {
            clearInterval(timer);
            window.chatbase.open();
          }
          if (Date.now() - t0 > 5000) clearInterval(timer); // corte de seguridad
        }, 50);
      };
    }

    document.body.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
