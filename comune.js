/* ============================================================
   Parti comuni a tutto il laboratorio
   ------------------------------------------------------------
   Qui stanno le cose che servono a tutte le stazioni: il tema
   chiaro/scuro, la lettura dei file di testo e qualche funzione
   di appoggio. Questo file viene caricato da ogni pagina.
   ============================================================ */

window.App = (function () {
  "use strict";

  /* ------------------------------------------------------------
     IL NUMERO DI VERSIONE

     Ogni volta che si modifica un file del sito bisogna aumentare
     di uno questo numero, E anche i "?v=" scritti dentro le pagine
     HTML. Serve a costringere i browser a riscaricare i file:
     senza, chi ha già visitato il sito continuerebbe a vedere la
     versione vecchia anche per giorni.
     ------------------------------------------------------------ */
  var VERSIONE = "22";

  /* ---------- funzioni di appoggio ---------- */

  function elemento(tag, classe, testo) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (testo !== undefined && testo !== null) e.textContent = testo;
    return e;
  }

  function svuota(nodo) {
    while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  }

  /* memoria del browser: se non è disponibile, il sito funziona lo stesso */

  function leggi(chiave) {
    try {
      return localStorage.getItem(chiave);
    } catch (e) {
      return null;
    }
  }

  function salva(chiave, valore) {
    try {
      localStorage.setItem(chiave, valore);
    } catch (e) {
      /* niente memoria: pazienza */
    }
  }

  /* ---------- lettura dei file di testo ---------- */

  function caricaTesto(nomeFile) {
    var separatore = nomeFile.indexOf("?") >= 0 ? "&" : "?";
    return fetch(nomeFile + separatore + "v=" + VERSIONE).then(function (risposta) {
      if (!risposta.ok) throw new Error("risposta del server " + risposta.status);
      return risposta.text();
    });
  }

  function avvisoCaricamento(nomeFile, dettaglio) {
    var avviso = elemento("div", "avviso");
    avviso.appendChild(elemento("strong", null, "Non riesco a leggere il file " + nomeFile + "."));
    if (location.protocol === "file:") {
      avviso.appendChild(document.createTextNode(
        "Hai aperto la pagina facendo doppio clic sul file: in questo modo i browser, " +
        "per sicurezza, non lasciano leggere gli altri file della cartella. " +
        "Apri il sito con un server locale oppure dal suo indirizzo su GitHub Pages."));
    } else {
      avviso.appendChild(document.createTextNode(
        "Controlla che il file " + nomeFile + " si trovi nella stessa cartella della pagina. " +
        "Dettaglio tecnico: " + dettaglio));
    }
    return avviso;
  }

  /* riquadro con le righe di un file che non siamo riusciti a leggere */

  function avvisoErroriFile(nomeFile, errori) {
    if (!errori || errori.length === 0) return null;
    var avviso = elemento("div", "avviso");
    avviso.appendChild(elemento("strong", null,
      "Attenzione: alcune parti di " + nomeFile + " non sono state lette."));
    avviso.appendChild(document.createTextNode(
      "Il resto della pagina funziona normalmente. Righe da rivedere:"));
    var lista = elemento("ul");
    errori.slice(0, 12).forEach(function (testo) {
      lista.appendChild(elemento("li", null, testo));
    });
    if (errori.length > 12) {
      lista.appendChild(elemento("li", null,
        "…e altre " + (errori.length - 12) + " segnalazioni."));
    }
    avviso.appendChild(lista);
    return avviso;
  }

  /* ---------- tema chiaro / scuro ---------- */

  function scuroAttivo() {
    var scelta = document.documentElement.getAttribute("data-tema");
    if (scelta === "scuro") return true;
    if (scelta === "chiaro") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function avviaTema() {
    var bottone = document.getElementById("bottone-tema");
    var icona = document.getElementById("icona-tema");

    var salvato = leggi("laboratorio-tema");
    if (salvato === "scuro" || salvato === "chiaro") {
      document.documentElement.setAttribute("data-tema", salvato);
    }
    if (!bottone) return;

    function aggiorna() { icona.textContent = scuroAttivo() ? "☀️" : "🌙"; }
    aggiorna();

    bottone.addEventListener("click", function () {
      var nuovo = scuroAttivo() ? "chiaro" : "scuro";
      document.documentElement.setAttribute("data-tema", nuovo);
      salva("laboratorio-tema", nuovo);
      aggiorna();
    });
  }

  avviaTema();

  return {
    versione: VERSIONE,
    elemento: elemento,
    svuota: svuota,
    leggi: leggi,
    salva: salva,
    caricaTesto: caricaTesto,
    avvisoCaricamento: avvisoCaricamento,
    avvisoErroriFile: avvisoErroriFile
  };
})();
