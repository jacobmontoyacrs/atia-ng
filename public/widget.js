/**
 * widget.js — Cargador embebible del agente IVA (Chatbase) con identidad firmada.
 *
 * Cómo insertarlo en CUALQUIER página web (tu dashboard):
 *
 *   <script>
 *     window.ivaUser = {
 *       userId:      "12345678",
 *       userName:    "Jacob",
 *       userSurname: "Rodriguez",
 *       userEmail:   "jrodriguez@atio.com.mx",
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

  var AGENT_ID = "zIaQd27t1krcc7WjQNkha";
  var CAMPOS = ["userId", "userName", "userSurname", "userEmail", "account", "location", "language", "error"];

  // Reúne los datos del usuario: primero window.ivaUser, si no, los query params
  function obtenerDatos() {
    var cfg = window.ivaUser || {};
    var qs = new URLSearchParams(window.location.search);
    var datos = {};
    CAMPOS.forEach(function (k) {
      var v = cfg[k] != null ? cfg[k] : qs.get(k);
      if (v != null && v !== "" && v !== "null") datos[k] = v;
    });
    return datos;
  }

  function debeAbrirSolo() {
    return !window.ivaUser || window.ivaUser.autoOpen !== false;
  }

  async function init() {
    try {
      var datos = obtenerDatos();
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
      // Si falla la firma, cargamos el widget igual (sin identidad verificada)
      console.error("[IVA] No se pudo firmar la identidad del usuario:", e);
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
