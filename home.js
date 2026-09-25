/* ============================================================
   La pagina iniziale del laboratorio
   ------------------------------------------------------------
   Legge l'elenco delle stazioni da stazioni.txt e costruisce la
   pagina: le raggruppa per disciplina e permette di filtrarle
   per anno di corso. Per aggiungere una stazione non serve
   toccare questo file: basta modificare stazioni.txt.
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("elenco-stazioni");
  if (!contenitore) return;

  var stazioni = [];
  var discipline = [];   /* nell'ordine in cui compaiono nel file */
  var erroriFile = [];
  var annoScelto = App.leggi("anno-scelto") || "tutti";

  /* ==========================================================
     1. Lettura di stazioni.txt
     ========================================================== */

  var CHIAVI = ["titolo", "icona", "disciplina", "anni", "cartella", "stato", "descrizione"];

  function leggiStazioni(testo) {
    var elenco = [];
    var errori = [];
    var righe = testo.split(/\r?\n/);
    var s = null;
    var ultimaChiave = null;

    for (var i = 0; i < righe.length; i++) {
      var numeroRiga = i + 1;
      var riga = righe[i].trim();
      if (riga === "" || riga.charAt(0) === "#") continue;

      if (riga.toUpperCase() === "[STAZIONE]") {
        s = { titolo: "", icona: "🧪", disciplina: "", anni: "", cartella: "", stato: "in arrivo", descrizione: "" };
        elenco.push(s);
        ultimaChiave = null;
        continue;
      }

      var duePunti = riga.indexOf(":");
      if (duePunti > 0) {
        var chiave = riga.substring(0, duePunti).trim().toLowerCase();
        if (CHIAVI.indexOf(chiave) >= 0) {
          if (!s) {
            errori.push("riga " + numeroRiga + ": \"" + chiave + "\" si trova prima di [STAZIONE].");
            continue;
          }
          s[chiave] = riga.substring(duePunti + 1).trim();
          ultimaChiave = chiave;
          continue;
        }
      }

      if (s && ultimaChiave) {
        s[ultimaChiave] = (s[ultimaChiave] + " " + riga).trim();
        continue;
      }
      errori.push("riga " + numeroRiga + ": non ho capito \"" + riga.slice(0, 40) + "\". La salto.");
    }

    var buone = [];
    elenco.forEach(function (st) {
      if (!st.titolo) {
        errori.push("Una stazione è senza titolo: l'ho saltata.");
        return;
      }
      st.pronta = /^pront/i.test(st.stato);
      if (st.pronta && !st.cartella) {
        errori.push("« " + st.titolo + " » è segnata come pronta ma non ha una cartella: la mostro come in arrivo.");
        st.pronta = false;
      }
      st.listaAnni = st.anni.split(/[\s,]+/).filter(function (a) { return a !== ""; });
      if (!st.disciplina) st.disciplina = "Altro";
      buone.push(st);
    });

    return { stazioni: buone, errori: errori };
  }

  /* ==========================================================
     2. Costruzione della pagina
     ========================================================== */

  function anniPresenti() {
    var trovati = {};
    stazioni.forEach(function (s) {
      s.listaAnni.forEach(function (a) { trovati[a] = true; });
    });
    return Object.keys(trovati).sort();
  }

  function visibile(s) {
    if (annoScelto === "tutti") return true;
    return s.listaAnni.indexOf(annoScelto) >= 0;
  }

  function disegnaFiltro() {
    var zona = elemento("div", "filtro-anni");
    zona.appendChild(elemento("span", "filtro-etichetta", "Anno di corso:"));

    var voci = [["tutti", "tutti"]];
    anniPresenti().forEach(function (a) { voci.push([a, a + "ª"]); });

    voci.forEach(function (v) {
      var b = elemento("button", "pillola" + (annoScelto === v[0] ? " attiva" : ""), v[1]);
      b.type = "button";
      b.addEventListener("click", function () {
        annoScelto = v[0];
        App.salva("anno-scelto", annoScelto);
        mostra();
      });
      zona.appendChild(b);
    });
    return zona;
  }

  function disegnaCarta(s) {
    var carta = elemento(s.pronta ? "a" : "div", "carta-stazione" + (s.pronta ? "" : " in-arrivo"));
    if (s.pronta) carta.href = "stazioni/" + s.cartella + "/";

    var testata = elemento("div", "carta-stazione-testata");
    testata.appendChild(elemento("span", "carta-stazione-icona", s.icona || "🧪"));
    var titoli = elemento("div", "carta-stazione-titoli");
    titoli.appendChild(elemento("div", "carta-stazione-titolo", s.titolo));
    if (s.listaAnni.length > 0) {
      titoli.appendChild(elemento("div", "carta-stazione-anni",
        s.listaAnni.map(function (a) { return a + "ª"; }).join(" · ")));
    }
    testata.appendChild(titoli);
    if (!s.pronta) testata.appendChild(elemento("span", "targa-arrivo", "in arrivo"));
    carta.appendChild(testata);

    if (s.descrizione) carta.appendChild(elemento("p", "carta-stazione-testo", s.descrizione));
    return carta;
  }

  function mostra() {
    svuota(contenitore);

    var avvisoErrori = App.avvisoErroriFile("stazioni.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(disegnaFiltro());

    var mostrate = 0;
    discipline.forEach(function (d) {
      var dentro = stazioni.filter(function (s) { return s.disciplina === d && visibile(s); });
      if (dentro.length === 0) return;
      mostrate += dentro.length;

      contenitore.appendChild(elemento("h2", "titolo-disciplina", d));
      var griglia = elemento("div", "griglia-stazioni");
      dentro.forEach(function (s) { griglia.appendChild(disegnaCarta(s)); });
      contenitore.appendChild(griglia);
    });

    if (mostrate === 0) {
      contenitore.appendChild(elemento("p", "nota-piccola",
        "Nessuna stazione per questo anno. Prova a scegliere « tutti »."));
    }

    var pronte = stazioni.filter(function (s) { return s.pronta; }).length;
    contenitore.appendChild(elemento("p", "conto-stazioni",
      pronte + (pronte === 1 ? " stazione pronta" : " stazioni pronte") +
      " su " + stazioni.length + ". Le altre sono in costruzione."));
  }

  /* ==========================================================
     3. Avvio
     ========================================================== */

  App.caricaTesto("stazioni.txt")
    .then(function (testo) {
      var esito = leggiStazioni(testo);
      stazioni = esito.stazioni;
      erroriFile = esito.errori;

      /* le discipline nell'ordine in cui compaiono nel file */
      stazioni.forEach(function (s) {
        if (discipline.indexOf(s.disciplina) < 0) discipline.push(s.disciplina);
      });

      if (stazioni.length === 0) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(elemento("strong", null, "Nessuna stazione da mostrare."));
        avviso.appendChild(document.createTextNode(
          "Il file stazioni.txt è stato letto ma non contiene stazioni valide."));
        contenitore.appendChild(avviso);
        return;
      }
      mostra();
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("stazioni.txt", errore.message));
    });

})();
