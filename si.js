/* ============================================================
   Il Sistema Internazionale
   ------------------------------------------------------------
   Legge il file si.txt e costruisce due cose:
   1. la mappa delle sette unità fondamentali, in alto
   2. le schede delle grandezze, fondamentali e derivate
   Quando si sceglie una grandezza derivata, la sua formula viene
   disegnata come frazione e nella mappa si accendono le unità
   fondamentali che la compongono.
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("si-contenuto");
  if (!contenitore) return;

  var basi = [];
  var derivate = [];
  var erroriFile = [];
  var selezionata = null;

  /* ==========================================================
     1. Lettura del file si.txt
     ========================================================== */

  var CHIAVI = ["grandezza", "unita", "unità", "simbolo", "icona",
                "misura", "definizione", "composizione"];

  function leggiSchede(testo) {
    var elenco = [];
    var errori = [];
    var righe = testo.split(/\r?\n/);
    var scheda = null;
    var ultimaChiave = null;

    for (var i = 0; i < righe.length; i++) {
      var numeroRiga = i + 1;
      var riga = righe[i].trim();
      if (riga === "" || riga.charAt(0) === "#") continue;

      var apertura = riga.toUpperCase();
      if (apertura === "[BASE]" || apertura === "[DERIVATA]") {
        scheda = {
          tipo: apertura === "[BASE]" ? "base" : "derivata",
          grandezza: "", unita: "", simbolo: "", icona: "",
          misura: "", definizione: "", composizione: "", esempi: []
        };
        elenco.push(scheda);
        ultimaChiave = null;
        continue;
      }

      var duePunti = riga.indexOf(":");
      if (duePunti > 0) {
        var chiave = riga.substring(0, duePunti).trim().toLowerCase();
        var valore = riga.substring(duePunti + 1).trim();

        if (chiave === "esempio") {
          if (!scheda) {
            errori.push("riga " + numeroRiga + ": un esempio si trova prima di [BASE] o [DERIVATA].");
            continue;
          }
          if (valore === "") {
            errori.push("riga " + numeroRiga + ": l'esempio è vuoto.");
            continue;
          }
          scheda.esempi.push(valore);
          ultimaChiave = "esempio";
          continue;
        }

        if (CHIAVI.indexOf(chiave) >= 0) {
          if (!scheda) {
            errori.push("riga " + numeroRiga + ": \"" + chiave + "\" si trova prima di [BASE] o [DERIVATA].");
            continue;
          }
          if (chiave === "unità") chiave = "unita";
          scheda[chiave] = valore;
          ultimaChiave = chiave;
          continue;
        }
      }

      /* riga di testo semplice: continua quella precedente */
      if (scheda && ultimaChiave === "esempio" && scheda.esempi.length > 0) {
        scheda.esempi[scheda.esempi.length - 1] += " " + riga;
        continue;
      }
      if (scheda && ultimaChiave) {
        scheda[ultimaChiave] = (scheda[ultimaChiave] + " " + riga).trim();
        continue;
      }
      errori.push("riga " + numeroRiga + ": non ho capito \"" + riga.slice(0, 40) + "\". La salto.");
    }

    var buone = [];
    elenco.forEach(function (s) {
      if (!s.grandezza || !s.simbolo) {
        errori.push("Una scheda è senza grandezza o senza simbolo: l'ho saltata.");
        return;
      }
      buone.push(s);
    });

    return { schede: buone, errori: errori };
  }

  /* "kg m^2 s^-2" diventa [{simbolo:"kg", esponente:1}, ...] */
  function leggiComposizione(testo) {
    var pezzi = String(testo).trim().split(/\s+/);
    var elenco = [];
    pezzi.forEach(function (p) {
      if (p === "") return;
      var m = /^([A-Za-zµΩ]+)(?:\^(-?\d+))?$/.exec(p);
      if (!m) return;
      elenco.push({ simbolo: m[1], esponente: m[2] ? parseInt(m[2], 10) : 1 });
    });
    return elenco;
  }

  function indiceBase(simbolo) {
    for (var i = 0; i < basi.length; i++) {
      if (basi[i].simbolo === simbolo) return i;
    }
    return -1;
  }

  /* ==========================================================
     2. Pezzi grafici
     ========================================================== */

  var ESPONENTI = { "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶" };

  /* dentro la frazione il segno è già dato dalla posizione:
     sopra la linea o sotto. Qui serve solo il numero. */
  function esponenteScritto(n) {
    var a = Math.abs(n);
    if (a === 1) return "";
    return ESPONENTI[String(a)] || ("^" + a);
  }

  /* nella mappa invece la frazione non c'è, quindi il segno va scritto */
  function esponenteFirmato(n) {
    if (n === 1) return "";
    var corpo = ESPONENTI[String(Math.abs(n))] || ("^" + Math.abs(n));
    return (n < 0 ? "⁻" : "") + corpo;
  }

  /* un mattoncino colorato con il simbolo di un'unità fondamentale */
  function mattoncino(simbolo, esponente, classeExtra) {
    var i = indiceBase(simbolo);
    var chip = elemento("span", "chip-base colore-" + (i >= 0 ? i + 1 : 0) +
      (classeExtra ? " " + classeExtra : ""));
    chip.appendChild(elemento("span", "chip-simbolo", simbolo));
    if (esponente !== undefined && Math.abs(esponente) !== 1) {
      chip.appendChild(elemento("span", "chip-esponente", esponenteScritto(esponente)));
    }
    return chip;
  }

  /* la formula disegnata come frazione: sopra gli esponenti positivi,
     sotto quelli negativi. È il modo in cui la scrivono sul quaderno. */
  function disegnaFormula(composizione) {
    var sopra = composizione.filter(function (p) { return p.esponente > 0; });
    var sotto = composizione.filter(function (p) { return p.esponente < 0; });

    var formula = elemento("div", "formula");

    if (sotto.length === 0) {
      sopra.forEach(function (p, i) {
        if (i > 0) formula.appendChild(elemento("span", "punto", "·"));
        formula.appendChild(mattoncino(p.simbolo, p.esponente));
      });
      return formula;
    }

    var frazione = elemento("div", "frazione");

    var righeSopra = elemento("div", "frazione-sopra");
    if (sopra.length === 0) {
      righeSopra.appendChild(elemento("span", "uno", "1"));
    } else {
      sopra.forEach(function (p, i) {
        if (i > 0) righeSopra.appendChild(elemento("span", "punto", "·"));
        righeSopra.appendChild(mattoncino(p.simbolo, p.esponente));
      });
    }
    frazione.appendChild(righeSopra);
    frazione.appendChild(elemento("div", "frazione-linea"));

    var righeSotto = elemento("div", "frazione-sotto");
    sotto.forEach(function (p, i) {
      if (i > 0) righeSotto.appendChild(elemento("span", "punto", "·"));
      righeSotto.appendChild(mattoncino(p.simbolo, p.esponente));
    });
    frazione.appendChild(righeSotto);

    formula.appendChild(frazione);
    return formula;
  }

  /* la riga delle sette unità fondamentali, in alto */
  function disegnaMappa() {
    var zona = elemento("div", "mappa");

    var titolo = elemento("p", "didascalia");
    titolo.id = "didascalia-mappa";
    zona.appendChild(titolo);

    var riga = elemento("div", "mappa-base");
    basi.forEach(function (b, i) {
      var chip = elemento("button", "chip-base grande colore-" + (i + 1));
      chip.type = "button";
      chip.appendChild(elemento("span", "chip-icona", b.icona || ""));
      chip.appendChild(elemento("span", "chip-simbolo", b.simbolo));
      chip.appendChild(elemento("span", "chip-nome", b.grandezza));
      chip.setAttribute("data-simbolo", b.simbolo);
      chip.setAttribute("aria-label", b.grandezza + ", si misura in " + b.unita);
      chip.addEventListener("click", function () { seleziona(b); });
      riga.appendChild(chip);
    });
    zona.appendChild(riga);
    return zona;
  }

  function aggiornaMappa() {
    var didascalia = document.getElementById("didascalia-mappa");
    var coinvolte = {};

    if (selezionata && selezionata.tipo === "derivata") {
      leggiComposizione(selezionata.composizione).forEach(function (p) {
        coinvolte[p.simbolo] = p.esponente;
      });
    } else if (selezionata) {
      coinvolte[selezionata.simbolo] = 1;
    }

    var accese = Object.keys(coinvolte);
    if (didascalia) {
      if (!selezionata) {
        didascalia.textContent =
          "Tutto si misura a partire da queste sette. Tocca una grandezza qui sotto per vedere da quali nasce.";
      } else if (selezionata.tipo === "base") {
        didascalia.textContent = "« " + selezionata.grandezza + " » è una delle sette unità fondamentali.";
      } else {
        didascalia.textContent = "« " + selezionata.grandezza + " » nasce da " +
          (accese.length === 1 ? "una sola unità fondamentale: " : accese.length + " unità fondamentali: ") +
          accese.join(", ") + ".";
      }
    }

    [].slice.call(document.querySelectorAll(".mappa-base .chip-base")).forEach(function (chip) {
      var simbolo = chip.getAttribute("data-simbolo");
      var dentro = Object.prototype.hasOwnProperty.call(coinvolte, simbolo);
      chip.classList.toggle("acceso", dentro);
      chip.classList.toggle("spento", selezionata !== null && !dentro);
      var vecchio = chip.querySelector(".chip-esponente");
      if (vecchio) vecchio.remove();
      if (dentro && coinvolte[simbolo] !== 1) {
        chip.appendChild(elemento("span", "chip-esponente", esponenteFirmato(coinvolte[simbolo])));
      }
    });
  }

  /* ==========================================================
     3. Le schede
     ========================================================== */

  function disegnaScheda(s, indice) {
    var carta = elemento("button", "carta-si" + (s === selezionata ? " selezionata" : ""));
    carta.type = "button";
    if (s.tipo === "base") carta.classList.add("colore-" + (indice + 1));

    var testata = elemento("div", "carta-si-testata");
    testata.appendChild(elemento("span", "carta-si-icona", s.icona || ""));
    var titoli = elemento("div");
    titoli.appendChild(elemento("div", "carta-si-grandezza", s.grandezza));
    titoli.appendChild(elemento("div", "carta-si-nome", s.unita));
    testata.appendChild(titoli);
    testata.appendChild(elemento("span", "carta-si-simbolo", s.simbolo));
    carta.appendChild(testata);

    if (s.misura) carta.appendChild(elemento("p", "carta-si-misura", "Misura " + s.misura + "."));

    if (s.tipo === "derivata" && s.composizione) {
      carta.appendChild(disegnaFormula(leggiComposizione(s.composizione)));
    }

    if (s === selezionata) {
      if (s.esempi.length > 0) {
        var lista = elemento("ul", "esempi-lista");
        s.esempi.forEach(function (e) { lista.appendChild(elemento("li", null, e)); });
        carta.appendChild(lista);
      }
      if (s.definizione) carta.appendChild(elemento("p", "definizione", s.definizione));
    } else if (s.esempi.length > 0) {
      carta.appendChild(elemento("p", "carta-si-assaggio", s.esempi[0]));
    }

    carta.addEventListener("click", function () { seleziona(s); });
    return carta;
  }

  function seleziona(s) {
    selezionata = (selezionata === s) ? null : s;
    mostra();
    if (selezionata) {
      var mappa = document.querySelector(".mappa");
      if (mappa && mappa.scrollIntoView) mappa.scrollIntoView({ block: "start" });
    }
  }

  /* ==========================================================
     4. Montaggio
     ========================================================== */

  function mostra() {
    svuota(contenitore);

    var avvisoErrori = App.avvisoErroriFile("si.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Sette unità bastano a misurare tutto: ogni altra grandezza si costruisce moltiplicandole e dividendole fra loro."));

    contenitore.appendChild(disegnaMappa());

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le sette unità fondamentali"));
    var grigliaBasi = elemento("div", "griglia-si");
    basi.forEach(function (b, i) { grigliaBasi.appendChild(disegnaScheda(b, i)); });
    contenitore.appendChild(grigliaBasi);

    if (derivate.length > 0) {
      contenitore.appendChild(elemento("h3", "titolo-blocco", "Le grandezze derivate"));
      contenitore.appendChild(elemento("p", "didascalia",
        "Sotto ogni nome c'è la formula: i mattoncini colorati dicono da quali unità fondamentali è fatta."));
      var grigliaDerivate = elemento("div", "griglia-si");
      derivate.forEach(function (d) { grigliaDerivate.appendChild(disegnaScheda(d, -1)); });
      contenitore.appendChild(grigliaDerivate);
    }

    aggiornaMappa();
  }

  App.caricaTesto("si.txt")
    .then(function (testo) {
      var esito = leggiSchede(testo);
      erroriFile = esito.errori;
      basi = esito.schede.filter(function (s) { return s.tipo === "base"; });
      derivate = esito.schede.filter(function (s) { return s.tipo === "derivata"; });
      if (basi.length === 0 && derivate.length === 0) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(elemento("strong", null, "Nessuna grandezza da mostrare."));
        avviso.appendChild(document.createTextNode(
          "Il file si.txt è stato letto ma non contiene schede valide."));
        contenitore.appendChild(avviso);
        return;
      }
      mostra();
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("si.txt", errore.message));
    });

})();
