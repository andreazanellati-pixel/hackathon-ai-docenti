/* ============================================================
   Dal DNA alla proteina
   ------------------------------------------------------------
   Un gene da trascrivere e tradurre, e poi da rovinare.

   Si clicca su una base per cambiarla, oppure la si toglie o se
   ne aggiunge una. Il sito rifà la trascrizione e la traduzione
   e dice che tipo di mutazione è venuta fuori.

   Il punto della stazione: cambiare una lettera spesso non fa
   niente, ma toglierne una sposta la cornice di lettura e da lì
   in poi la proteina è un'altra. Le mutazioni non si misurano
   da quanto è grande il cambiamento nel DNA.
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  /* ---------- stato ---------- */

  var codice = {};          /* tripletta -> { sigla, nome } */
  var erroriFile = [];

  var ORIGINALE = "ATGTTCGGCAAAGCTTCTGACCGTATTGAGTCTTAA";
  var sequenza = ORIGINALE;
  var selezionata = -1;     /* quale base è stata toccata per ultima */

  var BASI = ["A", "T", "G", "C"];
  var COMPLEMENTO = { A: "T", T: "A", G: "C", C: "G" };

  /* ==========================================================
     1. Lettura del codice genetico
     ========================================================== */

  function leggiCodice(testo) {
    var tabella = {}, errori = [], quante = 0;
    testo.split(/\r?\n/).forEach(function (rigaGrezza, i) {
      var riga = rigaGrezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var pezzi = riga.split("|");
      if (pezzi.length < 3) {
        errori.push("riga " + (i + 1) + ": servono tre parti separate da | (tripletta, sigla, nome).");
        return;
      }
      var tripletta = pezzi[0].trim().toUpperCase();
      if (!/^[ACGU]{3}$/.test(tripletta)) {
        errori.push("riga " + (i + 1) + ": \"" + tripletta + "\" non è una tripletta di A, C, G, U.");
        return;
      }
      tabella[tripletta] = { sigla: pezzi[1].trim(), nome: pezzi[2].trim() };
      quante++;
    });
    if (quante > 0 && quante < 64) {
      errori.push("Il codice genetico ha " + quante + " triplette invece di 64: qualcuna manca.");
    }
    return { codice: tabella, errori: errori };
  }

  /* ==========================================================
     2. Trascrizione e traduzione
     ========================================================== */

  function filamentoStampo(dna) {
    var s = "";
    for (var i = 0; i < dna.length; i++) s += COMPLEMENTO[dna.charAt(i)] || "?";
    return s;
  }

  /* l'RNA messaggero ha la stessa sequenza del filamento
     codificante, con l'uracile al posto della timina */
  function trascrivi(dna) {
    return dna.replace(/T/g, "U");
  }

  function traduci(rna) {
    var inizio = rna.indexOf("AUG");
    if (inizio < 0) return { inizio: -1, catena: [], fine: "nessun AUG" };

    var catena = [];
    var fine = "sequenza finita";
    for (var i = inizio; i + 2 < rna.length; i += 3) {
      var tripletta = rna.substr(i, 3);
      var voce = codice[tripletta];
      if (!voce) { fine = "tripletta sconosciuta"; break; }
      if (voce.sigla === "STOP") { fine = "segnale di fine"; break; }
      catena.push({ tripletta: tripletta, sigla: voce.sigla, nome: voce.nome, posizione: i });
    }
    return { inizio: inizio, catena: catena, fine: fine };
  }

  /* che tipo di mutazione è venuta fuori, confrontando con l'originale */
  function confronta() {
    var vecchia = traduci(trascrivi(ORIGINALE)).catena;
    var nuova = traduci(trascrivi(sequenza)).catena;

    if (sequenza === ORIGINALE) {
      return { tipo: "nessuna", testo: "Questo è il gene di partenza, non ancora toccato." };
    }
    if (sequenza.length !== ORIGINALE.length) {
      var quanti = 0;
      var minimo = Math.min(vecchia.length, nuova.length);
      for (var k = 0; k < minimo; k++) if (vecchia[k].sigla !== nuova[k].sigla) quanti++;
      var differenza = sequenza.length - ORIGINALE.length;
      if (Math.abs(differenza) % 3 === 0) {
        var attesa = vecchia.length + differenza / 3;
        if (nuova.length < attesa) {
          return {
            tipo: "segnale di fine comparso",
            testo: "Hai " + (differenza > 0 ? "aggiunto" : "tolto") + " " + Math.abs(differenza) +
              " basi, un multiplo di tre, quindi la cornice di lettura regge. Ma le lettere nuove hanno " +
              "formato per caso un segnale di fine: la catena si ferma al " + nuova.length +
              "° amminoacido invece che al " + attesa + "°. Capita: tre triplette su sessantaquattro dicono «fermati»."
          };
        }
        if (nuova.length > attesa) {
          return {
            tipo: "segnale di fine perduto",
            testo: "La cornice di lettura regge, ma il segnale di fine è saltato: la traduzione prosegue oltre, " +
              "e la catena arriva a " + nuova.length + " amminoacidi invece di " + attesa + "."
          };
        }
        return {
          tipo: "inserzione o delezione in blocco",
          testo: "Hai " + (differenza > 0 ? "aggiunto" : "tolto") + " " + Math.abs(differenza) +
            " basi, un multiplo di tre: la cornice di lettura regge, e la proteina cambia solo per gli " +
            "amminoacidi in più o in meno. È il motivo per cui certe malattie genetiche sono molto più " +
            "lievi di altre, pur nascendo da una delezione."
        };
      }
      return {
        tipo: "scivolamento della cornice di lettura",
        testo: "Hai " + (differenza > 0 ? "aggiunto" : "tolto") + " una base, e da quel punto in poi " +
          "le triplette si leggono spostate. Da lì la proteina è un'altra: " + quanti +
          " amminoacidi diversi su " + minimo + " confrontabili, e la catena è lunga " +
          nuova.length + " invece di " + vecchia.length + ". Una sola lettera, e il gene non funziona più."
      };
    }

    /* stessa lunghezza: sostituzione */
    var diversi = [];
    var lunghezzaMin = Math.min(vecchia.length, nuova.length);
    for (var i = 0; i < lunghezzaMin; i++) {
      if (vecchia[i].sigla !== nuova[i].sigla) diversi.push(i + 1);
    }
    if (nuova.length < vecchia.length) {
      return {
        tipo: "mutazione non senso",
        testo: "La sostituzione ha creato un segnale di fine dove non c'era: la catena si interrompe al " +
          (nuova.length + 1) + "° amminoacido invece di arrivare a " + vecchia.length +
          ". Una proteina troncata quasi sempre non funziona."
      };
    }
    if (nuova.length > vecchia.length) {
      return {
        tipo: "segnale di fine perduto",
        testo: "La sostituzione ha distrutto il segnale di fine: la traduzione tira dritto oltre la fine prevista, " +
          "e la catena diventa più lunga del dovuto."
      };
    }
    if (diversi.length === 0) {
      return {
        tipo: "mutazione silenziosa",
        testo: "Il DNA è cambiato ma la proteina no. Succede spesso, perché quasi sempre a cambiare è la terza " +
          "lettera della tripletta, e triplette diverse portano lo stesso amminoacido. Guarda il codice genetico."
      };
    }
    return {
      tipo: "mutazione di senso",
      testo: "È cambiato un amminoacido, il " + diversi.join(" e il ") + "°. " +
        "Può non contare nulla, oppure rovinare tutto: dipende da dove si trova e da quanto è diverso il nuovo. " +
        "L'anemia falciforme nasce da un cambiamento così, uno solo."
    };
  }

  /* ==========================================================
     3. La pagina
     ========================================================== */

  function disegnaSequenze() {
    var zona = document.getElementById("zona-sequenze");
    if (!zona) return;
    svuota(zona);

    var stampo = filamentoStampo(sequenza);
    var rna = trascrivi(sequenza);
    var proteina = traduci(rna);

    /* il filamento codificante, cliccabile */
    zona.appendChild(etichettaFilamento("DNA, filamento codificante",
      "clicca una base per cambiarla"));
    var riga = elemento("div", "filamento");
    for (var i = 0; i < sequenza.length; i++) {
      (function (indice) {
        var b = elemento("button", "base base-" + sequenza.charAt(indice) +
          (indice === selezionata ? " scelta" : ""));
        b.type = "button";
        b.textContent = sequenza.charAt(indice);
        b.setAttribute("aria-label", "base " + (indice + 1) + ", " + sequenza.charAt(indice) + ", clicca per cambiarla");
        b.addEventListener("click", function () {
          var attuale = BASI.indexOf(sequenza.charAt(indice));
          var nuovaBase = BASI[(attuale + 1) % 4];
          sequenza = sequenza.substring(0, indice) + nuovaBase + sequenza.substring(indice + 1);
          selezionata = indice;
          disegnaTutto();
        });
        riga.appendChild(b);
      })(i);
    }
    zona.appendChild(riga);

    /* il filamento stampo */
    zona.appendChild(etichettaFilamento("DNA, filamento stampo", "ogni base è la complementare"));
    var rigaS = elemento("div", "filamento");
    for (var j = 0; j < stampo.length; j++) {
      rigaS.appendChild(elemento("span", "base base-spenta", stampo.charAt(j)));
    }
    zona.appendChild(rigaS);

    /* l'RNA messaggero, raggruppato in triplette dal primo AUG */
    zona.appendChild(etichettaFilamento("RNA messaggero", "la timina diventa uracile"));
    var rigaR = elemento("div", "filamento");
    for (var k = 0; k < rna.length; k++) {
      var dentro = proteina.inizio >= 0 && k >= proteina.inizio &&
        (k - proteina.inizio) < (proteina.catena.length + 1) * 3;
      var classi = "base base-rna";
      if (dentro && Math.floor((k - proteina.inizio) / 3) % 2 === 1) classi += " tripletta-alterna";
      if (!dentro) classi += " base-spenta";
      rigaR.appendChild(elemento("span", classi, rna.charAt(k)));
    }
    zona.appendChild(rigaR);

    /* la proteina */
    zona.appendChild(etichettaFilamento("Proteina",
      proteina.catena.length + (proteina.catena.length === 1 ? " amminoacido" : " amminoacidi") +
      " · si è fermata al " + proteina.fine));
    var rigaP = elemento("div", "catena");
    if (proteina.inizio < 0) {
      rigaP.appendChild(elemento("p", "nota-piccola",
        "Non c'è nessun AUG: senza segnale di inizio la traduzione non parte nemmeno."));
    } else {
      proteina.catena.forEach(function (a, indice) {
        var pezzo = elemento("span", "amminoacido");
        pezzo.appendChild(elemento("span", "amminoacido-sigla", a.sigla));
        pezzo.appendChild(elemento("span", "amminoacido-nome", a.nome));
        pezzo.title = a.tripletta + " → " + a.nome;
        if (indice === 0) pezzo.classList.add("inizio");
        rigaP.appendChild(pezzo);
      });
    }
    zona.appendChild(rigaP);
  }

  function etichettaFilamento(titolo, nota) {
    var e = elemento("div", "etichetta-filamento");
    e.appendChild(elemento("span", "etichetta-nome", titolo));
    if (nota) e.appendChild(elemento("span", "etichetta-nota", nota));
    return e;
  }

  function aggiornaEsito() {
    var esito = confronta();
    var riquadro = document.getElementById("riquadro-fase");
    var spiega = document.getElementById("spiegazione-fase");
    var titolo = document.getElementById("tipo-mutazione");
    if (titolo) titolo.textContent = esito.tipo;
    if (spiega) spiega.textContent = esito.testo;
    if (riquadro) {
      riquadro.classList.toggle("in-passaggio",
        esito.tipo !== "nessuna" && esito.tipo !== "mutazione silenziosa");
    }
  }

  function disegnaTutto() {
    disegnaSequenze();
    aggiornaEsito();
  }

  function costruisci() {
    svuota(contenitore);

    var avvisoErrori = App.avvisoErroriFile("codice-genetico.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Questo è un gene. Sotto, quello che il gene produce. Clicca su una base del filamento " +
      "codificante per cambiarla, e guarda che cosa succede alla proteina."));

    var zona = elemento("div", "zona-sequenze");
    zona.id = "zona-sequenze";
    contenitore.appendChild(zona);

    var riquadro = elemento("div", "riquadro-fase");
    riquadro.id = "riquadro-fase";
    var titolo = elemento("div", "etichetta-passo");
    titolo.id = "tipo-mutazione";
    riquadro.appendChild(titolo);
    var spiega = elemento("p", "spiegazione-fase");
    spiega.id = "spiegazione-fase";
    spiega.setAttribute("role", "status");
    riquadro.appendChild(spiega);
    contenitore.appendChild(riquadro);

    var comandi = elemento("div", "comandi");
    var riga = elemento("div", "bottoni");

    var togli = elemento("button", "bottone", "Togli una base");
    togli.type = "button";
    togli.addEventListener("click", function () {
      var dove = selezionata >= 0 ? selezionata : 12;
      if (sequenza.length <= 6) return;
      sequenza = sequenza.substring(0, dove) + sequenza.substring(dove + 1);
      if (selezionata >= sequenza.length) selezionata = sequenza.length - 1;
      disegnaTutto();
    });
    riga.appendChild(togli);

    var aggiungi = elemento("button", "bottone", "Aggiungi una base");
    aggiungi.type = "button";
    aggiungi.addEventListener("click", function () {
      var dove = selezionata >= 0 ? selezionata : 12;
      sequenza = sequenza.substring(0, dove) + "A" + sequenza.substring(dove);
      disegnaTutto();
    });
    riga.appendChild(aggiungi);

    var reset = elemento("button", "bottone secondario", "↺  Gene di partenza");
    reset.type = "button";
    reset.addEventListener("click", function () {
      sequenza = ORIGINALE;
      selezionata = -1;
      disegnaTutto();
    });
    riga.appendChild(reset);
    comandi.appendChild(riga);

    comandi.appendChild(elemento("p", "nota-piccola",
      "Togliere e aggiungere agiscono sulla base che hai toccato per ultima. " +
      "Prova a togliere una base vicino all'inizio: è il caso più istruttivo."));
    contenitore.appendChild(comandi);

    /* il codice genetico, richiudibile */
    var dettagli = elemento("details", "tutte-unita");
    dettagli.appendChild(elemento("summary", null, "Il codice genetico, tutte e 64 le triplette"));
    var griglia = elemento("div", "griglia-codice");
    Object.keys(codice).sort().forEach(function (t) {
      var voce = elemento("div", "voce-codice" + (codice[t].sigla === "STOP" ? " fine" : ""));
      voce.appendChild(elemento("span", "voce-tripletta", t));
      voce.appendChild(elemento("span", "voce-sigla", codice[t].sigla));
      griglia.appendChild(voce);
    });
    dettagli.appendChild(griglia);
    contenitore.appendChild(dettagli);

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Il codice genetico è quello vero, tutte e 64 le triplette, e la traduzione parte dal primo AUG e si ferma al primo segnale di fine. Quella parte è corretta.",
      "Manca tutto ciò che sta in mezzo: negli eucarioti il gene contiene introni che vengono tagliati via prima della traduzione, e l'RNA riceve un cappuccio all'inizio e una coda di adenine alla fine.",
      "Il gene qui è lungo poche decine di basi. Un gene umano ne ha in media qualche decina di migliaia.",
      "La traduzione parte dal primo AUG che incontra. Nella cellula la scelta è più complicata, e dipende anche da che cosa c'è intorno.",
      "Che una proteina funzioni o no non dipende solo dalla sequenza: dipende da come si ripiega. Qui la forma non c'è, quindi il sito non può dire se una mutazione di senso sia grave o innocua.",
      "Non ci sono i meccanismi di riparazione del DNA, che nella cellula vera correggono la grande maggioranza degli errori prima che diventino mutazioni."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    disegnaTutto();
  }

  /* ==========================================================
     4. Avvio
     ========================================================== */

  App.caricaTesto("codice-genetico.txt")
    .then(function (testo) {
      var esito = leggiCodice(testo);
      codice = esito.codice;
      erroriFile = esito.errori;
      if (Object.keys(codice).length === 0) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(elemento("strong", null, "Manca il codice genetico."));
        avviso.appendChild(document.createTextNode(
          "Il file codice-genetico.txt è stato letto ma non contiene triplette valide."));
        contenitore.appendChild(avviso);
        return;
      }
      costruisci();
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("codice-genetico.txt", errore.message));
    });

})();
