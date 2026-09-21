/* ============================================================
   Parti comuni ai due strumenti del sito
   ------------------------------------------------------------
   Qui stanno le cose che servono sia al detective dei casi sia
   alla scala delle unità: il tema chiaro/scuro, il passaggio da
   una sezione all'altra, e qualche funzione di appoggio.
   ============================================================ */

window.App = (function () {
  "use strict";

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
    return fetch(nomeFile).then(function (risposta) {
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
        "Controlla che il file " + nomeFile + " si trovi nella stessa cartella di index.html. " +
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
      "Il resto del sito funziona normalmente. Righe da rivedere:"));
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
    if (!bottone) return;

    function aggiorna() { icona.textContent = scuroAttivo() ? "☀️" : "🌙"; }

    var salvato = leggi("detective-tema");
    if (salvato === "scuro" || salvato === "chiaro") {
      document.documentElement.setAttribute("data-tema", salvato);
    }
    aggiorna();

    bottone.addEventListener("click", function () {
      var nuovo = scuroAttivo() ? "chiaro" : "scuro";
      document.documentElement.setAttribute("data-tema", nuovo);
      salva("detective-tema", nuovo);
      aggiorna();
    });
  }

  /* ---------- passaggio da una sezione all'altra ---------- */

  function avviaNavigazione() {
    var bottoni = [].slice.call(document.querySelectorAll("[data-sezione]"));
    if (bottoni.length === 0) return;

    function mostra(nome) {
      bottoni.forEach(function (b) {
        var suo = b.getAttribute("data-sezione");
        var attivo = suo === nome;
        b.classList.toggle("attivo", attivo);
        b.setAttribute("aria-selected", attivo ? "true" : "false");
        var sezione = document.getElementById("sezione-" + suo);
        if (sezione) sezione.hidden = !attivo;
      });
      salva("sezione-aperta", nome);
    }

    bottoni.forEach(function (b) {
      b.addEventListener("click", function () {
        mostra(b.getAttribute("data-sezione"));
        window.scrollTo(0, 0);
      });
    });

    var ultima = leggi("sezione-aperta");
    var esiste = bottoni.some(function (b) { return b.getAttribute("data-sezione") === ultima; });
    mostra(esiste ? ultima : bottoni[0].getAttribute("data-sezione"));
  }

  avviaTema();
  avviaNavigazione();

  return {
    elemento: elemento,
    svuota: svuota,
    leggi: leggi,
    salva: salva,
    caricaTesto: caricaTesto,
    avvisoCaricamento: avvisoCaricamento,
    avvisoErroriFile: avvisoErroriFile
  };
})();
