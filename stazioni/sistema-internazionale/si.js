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
  var prefissi = [];
  var erroriFile = [];
  var selezionata = null;
  var prefissoScelto = null;

  /* ==========================================================
     1. Lettura del file si.txt
     ========================================================== */

  var CHIAVI = ["grandezza", "unita", "unità", "simbolo", "icona",
                "misura", "definizione", "composizione", "nome", "fattore"];

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
      if (apertura === "[BASE]" || apertura === "[DERIVATA]" || apertura === "[PREFISSO]") {
        scheda = {
          tipo: apertura === "[BASE]" ? "base" : (apertura === "[DERIVATA]" ? "derivata" : "prefisso"),
          grandezza: "", unita: "", simbolo: "", icona: "", nome: "", fattore: "",
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
            errori.push("riga " + numeroRiga + ": un esempio si trova prima di un blocco fra parentesi quadre.");
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
            errori.push("riga " + numeroRiga + ": \"" + chiave + "\" si trova prima di un blocco fra parentesi quadre.");
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
      if (s.tipo === "prefisso") {
        if (!s.nome || !s.simbolo) {
          errori.push("Un prefisso è senza nome o senza simbolo: l'ho saltato.");
          return;
        }
        s.esponente = leggiEsponente(s.fattore);
        if (s.esponente === null) {
          errori.push("Il prefisso « " + s.nome + " » ha un fattore che non capisco: l'ho saltato.");
          return;
        }
      } else if (!s.grandezza || !s.simbolo) {
        errori.push("Una scheda è senza grandezza o senza simbolo: l'ho saltata.");
        return;
      }
      buone.push(s);
    });

    return { schede: buone, errori: errori };
  }

  /* "10^-9" diventa -9 */
  function leggiEsponente(testo) {
    var m = /^10\s*\^\s*(-?\d+)$/.exec(String(testo).trim());
    return m ? parseInt(m[1], 10) : null;
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

  var CIFRE_APICE = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"
  };

  /* scrive un numero in piccolo, in alto: 12 diventa ¹², -9 diventa ⁻⁹ */
  function apice(n) {
    var cifre = String(Math.abs(n)).split("").map(function (c) {
      return CIFRE_APICE[c] || c;
    }).join("");
    return (n < 0 ? "⁻" : "") + cifre;
  }

  /* dentro la frazione il segno è già dato dalla posizione:
     sopra la linea o sotto. Qui serve solo il numero. */
  function esponenteScritto(n) {
    var a = Math.abs(n);
    return a === 1 ? "" : apice(a);
  }

  /* nella mappa invece la frazione non c'è, quindi il segno va scritto */
  function esponenteFirmato(n) {
    return n === 1 ? "" : apice(n);
  }

  /* 10^3 scritto per esteso: 1 000. Oltre certe potenze non ha senso. */
  function numeroPerEsteso(esponente) {
    if (Math.abs(esponente) > 9) return null;
    var zeri = "";
    var i;
    if (esponente > 0) {
      for (i = 0; i < esponente; i++) zeri += "0";
      return raggruppa("1" + zeri);
    }
    for (i = 0; i < -esponente - 1; i++) zeri += "0";
    return "0," + zeri + "1";
  }

  /* 1000000 diventa 1 000 000, con spazi ogni tre cifre */
  function raggruppa(testo) {
    var pezzi = [];
    for (var i = testo.length; i > 0; i -= 3) {
      pezzi.unshift(testo.slice(Math.max(0, i - 3), i));
    }
    return pezzi.join(" ");
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
     4. I multipli e i sottomultipli
     ========================================================== */

  function disegnaPrefissi() {
    var zona = elemento("div");

    zona.appendChild(elemento("h3", "titolo-blocco", "Multipli e sottomultipli"));
    zona.appendChild(elemento("p", "didascalia",
      "Gli stessi prefissi si attaccano davanti a qualunque unità. " +
      "Tocca un prefisso per vederne il valore e un esempio."));

    var striscia = elemento("div", "scala-prefissi");
    var precedente = null;

    prefissi.forEach(function (p) {
      /* fra i multipli e i sottomultipli si passa dall'unità di riferimento */
      if (precedente !== null && precedente > 0 && p.esponente < 0) {
        var divisore = elemento("div", "divisore-unita");
        divisore.appendChild(elemento("span", "divisore-linea", ""));
        divisore.appendChild(elemento("span", "divisore-testo", "unità"));
        divisore.appendChild(elemento("span", "divisore-linea", ""));
        striscia.appendChild(divisore);
      }
      precedente = p.esponente;

      var chip = elemento("button", "chip-prefisso " +
        (p.esponente > 0 ? "multiplo" : "sottomultiplo") +
        (p === prefissoScelto ? " scelto" : ""));
      chip.type = "button";
      chip.appendChild(elemento("span", "prefisso-simbolo", p.simbolo));
      chip.appendChild(elemento("span", "prefisso-nome", p.nome));
      chip.appendChild(elemento("span", "prefisso-potenza", "10" + apice(p.esponente)));
      chip.setAttribute("aria-label", p.nome + ", dieci alla " + p.esponente);
      chip.addEventListener("click", function () {
        prefissoScelto = (prefissoScelto === p) ? null : p;
        mostra();
      });
      striscia.appendChild(chip);
    });

    var involucro = elemento("div", "involucro-prefissi");
    involucro.appendChild(striscia);
    zona.appendChild(involucro);

    var scheda = elemento("div", "scheda-prefisso");
    if (!prefissoScelto) {
      scheda.appendChild(elemento("p", "nota-piccola",
        "Da tera a femto ci sono ventisette potenze di dieci: dai mille miliardi al milionesimo di miliardesimo."));
    } else {
      var p = prefissoScelto;
      var testata = elemento("div", "prefisso-testata");
      testata.appendChild(elemento("span", "prefisso-grande", p.simbolo));
      var titoli = elemento("div");
      titoli.appendChild(elemento("div", "prefisso-titolo", p.nome));
      var esteso = numeroPerEsteso(p.esponente);
      titoli.appendChild(elemento("div", "prefisso-valore",
        "10" + apice(p.esponente) + (esteso ? "  =  " + esteso : "") + " volte l'unità"));
      testata.appendChild(titoli);
      scheda.appendChild(testata);

      if (p.esempi.length > 0) {
        var lista = elemento("ul", "esempi-lista");
        p.esempi.forEach(function (e) { lista.appendChild(elemento("li", null, e)); });
        scheda.appendChild(lista);
      }
    }
    zona.appendChild(scheda);

    return zona;
  }

  /* ==========================================================
     5. Montaggio
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

    if (prefissi.length > 0) contenitore.appendChild(disegnaPrefissi());

    aggiornaMappa();
  }

  App.caricaTesto("si.txt")
    .then(function (testo) {
      var esito = leggiSchede(testo);
      erroriFile = esito.errori;
      basi = esito.schede.filter(function (s) { return s.tipo === "base"; });
      derivate = esito.schede.filter(function (s) { return s.tipo === "derivata"; });
      prefissi = esito.schede.filter(function (s) { return s.tipo === "prefisso"; });
      prefissi.sort(function (a, b) { return b.esponente - a.esponente; });
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
