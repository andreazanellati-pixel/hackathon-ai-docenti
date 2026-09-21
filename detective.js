/* ============================================================
   Il detective degli esperimenti
   ------------------------------------------------------------
   Il sito legge i contenuti dal file casi.txt e costruisce da
   solo tutte le schermate. Per cambiare i casi non serve
   toccare questo file: basta modificare casi.txt.
   ============================================================ */

(function () {
  "use strict";

  var applicazione = document.getElementById("applicazione");

  /* funzioni di appoggio, definite una volta sola in comune.js */
  var elemento = App.elemento;
  var svuota = App.svuota;

  /* Stato dell'applicazione: che cosa sta guardando lo studente */
  var casi = [];            /* tutti i casi letti da casi.txt */
  var erroriFile = [];      /* righe del file che non siamo riusciti a leggere */
  var casoAperto = null;    /* il caso su cui si sta lavorando */
  var indicePasso = 0;      /* a che passo siamo dentro il caso */
  var esiti = [];           /* per ogni passo: true se risposto giusto */
  var selezioni = [];       /* risposte scelte nel passo in corso (domande a risposta multipla) */
  var passoConcluso = false;

  /* ==========================================================
     1. Lettura del file casi.txt
     ========================================================== */

  var CHIAVI = ["titolo", "icona", "storia", "domanda", "premessa", "tipo"];

  function leggiCasi(testo) {
    var elenco = [];
    var errori = [];
    var righe = testo.split(/\r?\n/);
    var caso = null;
    var passo = null;
    var bersaglio = null;   /* l'oggetto a cui assegnare le chiavi: caso o passo */
    var ultimaChiave = null;

    for (var i = 0; i < righe.length; i++) {
      var numeroRiga = i + 1;
      var riga = righe[i].trim();

      if (riga === "" || riga.charAt(0) === "#") continue;

      /* inizio di un nuovo caso */
      if (riga.toUpperCase() === "[CASO]") {
        caso = { titolo: "", icona: "🧪", storia: "", passi: [] };
        elenco.push(caso);
        passo = null;
        bersaglio = caso;
        ultimaChiave = null;
        continue;
      }

      /* inizio di un nuovo passo */
      if (riga.toUpperCase() === "[PASSO]") {
        if (!caso) {
          errori.push("riga " + numeroRiga + ": c'è un [PASSO] prima di qualsiasi [CASO].");
          continue;
        }
        passo = { titolo: "", premessa: "", domanda: "", tipo: "singola", opzioni: [] };
        caso.passi.push(passo);
        bersaglio = passo;
        ultimaChiave = null;
        continue;
      }

      /* una risposta: comincia con + (giusta) oppure - (sbagliata) */
      var primoCarattere = riga.charAt(0);
      if (primoCarattere === "+" || primoCarattere === "-") {
        if (!passo) {
          errori.push("riga " + numeroRiga + ": una risposta si trova fuori da un [PASSO].");
          continue;
        }
        var corpo = riga.substring(1).trim();
        var barra = corpo.indexOf("|");
        var testoRisposta = barra >= 0 ? corpo.substring(0, barra).trim() : corpo;
        var spiegazione = barra >= 0 ? corpo.substring(barra + 1).trim() : "";
        if (testoRisposta === "") {
          errori.push("riga " + numeroRiga + ": la risposta è vuota.");
          continue;
        }
        passo.opzioni.push({
          testo: testoRisposta,
          spiegazione: spiegazione,
          giusta: primoCarattere === "+"
        });
        ultimaChiave = null;
        continue;
      }

      /* una chiave del tipo   nome: valore   */
      var duePunti = riga.indexOf(":");
      if (duePunti > 0) {
        var nome = riga.substring(0, duePunti).trim().toLowerCase();
        if (CHIAVI.indexOf(nome) >= 0) {
          if (!bersaglio) {
            errori.push("riga " + numeroRiga + ": \"" + nome + "\" si trova prima di qualsiasi [CASO].");
            continue;
          }
          var valore = riga.substring(duePunti + 1).trim();
          if (nome === "tipo") {
            bersaglio.tipo = valore.toLowerCase().indexOf("multipl") >= 0 ? "multipla" : "singola";
          } else {
            bersaglio[nome] = valore;
          }
          ultimaChiave = nome === "tipo" ? null : nome;
          continue;
        }
      }

      /* riga di testo semplice: continua la chiave precedente */
      if (bersaglio && ultimaChiave) {
        bersaglio[ultimaChiave] = (bersaglio[ultimaChiave] + " " + riga).trim();
        continue;
      }

      errori.push("riga " + numeroRiga + ": non ho capito \"" + accorcia(riga, 45) + "\". La salto.");
    }

    /* controlli finali: scartiamo ciò che non sta in piedi */
    var buoni = [];
    for (var c = 0; c < elenco.length; c++) {
      var unCaso = elenco[c];
      var nomeCaso = unCaso.titolo || "caso senza titolo";

      var passiBuoni = [];
      for (var p = 0; p < unCaso.passi.length; p++) {
        var unPasso = unCaso.passi[p];
        var giuste = contaGiuste(unPasso.opzioni);
        if (!unPasso.domanda) {
          errori.push("« " + nomeCaso + " », passo " + (p + 1) + ": manca la domanda. Passo saltato.");
        } else if (unPasso.opzioni.length < 2) {
          errori.push("« " + nomeCaso + " », passo " + (p + 1) + ": servono almeno due risposte. Passo saltato.");
        } else if (giuste === 0) {
          errori.push("« " + nomeCaso + " », passo " + (p + 1) + ": nessuna risposta è segnata con +. Passo saltato.");
        } else if (giuste === unPasso.opzioni.length) {
          errori.push("« " + nomeCaso + " », passo " + (p + 1) + ": tutte le risposte sono segnate con +. Passo saltato.");
        } else {
          if (!unPasso.titolo) unPasso.titolo = "Passo " + (p + 1);
          if (giuste > 1) unPasso.tipo = "multipla";
          passiBuoni.push(unPasso);
        }
      }
      unCaso.passi = passiBuoni;

      if (!unCaso.titolo) {
        errori.push("Un caso è senza titolo: l'ho saltato.");
      } else if (unCaso.passi.length === 0) {
        errori.push("« " + nomeCaso + " » non ha nessun passo valido: l'ho saltato.");
      } else {
        buoni.push(unCaso);
      }
    }

    return { casi: buoni, errori: errori };
  }

  function contaGiuste(opzioni) {
    var n = 0;
    for (var i = 0; i < opzioni.length; i++) if (opzioni[i].giusta) n++;
    return n;
  }

  function accorcia(testo, lunghezza) {
    return testo.length > lunghezza ? testo.substring(0, lunghezza) + "…" : testo;
  }

  /* ==========================================================
     2. Il ricordo dei casi già affrontati
     ========================================================== */

  function leggiRisultati() {
    try {
      return JSON.parse(App.leggi("detective-risultati") || "{}");
    } catch (e) {
      return {};
    }
  }

  function salvaRisultato(titolo, giuste, totale) {
    var tutti = leggiRisultati();
    var prima = tutti[titolo];
    if (!prima || giuste > prima.giuste) {
      tutti[titolo] = { giuste: giuste, totale: totale };
      App.salva("detective-risultati", JSON.stringify(tutti));
    }
  }

  /* ==========================================================
     3. Schermata con l'elenco dei casi
     ========================================================== */

  function mostraElencoCasi() {
    casoAperto = null;
    svuota(applicazione);
    mostraAvvisi();

    var intro = elemento("section", "introduzione");
    intro.appendChild(elemento("h2", null, "Scegli un caso"));
    intro.appendChild(elemento("p", null,
      "In ogni caso qualcuno sostiene qualcosa e qualcun altro non ci crede. " +
      "Il tuo compito non è indovinare chi ha ragione: è progettare l'esperimento che permette di scoprirlo."));
    var p2 = elemento("p");
    p2.appendChild(document.createTextNode("Passo dopo passo sceglierai l'"));
    p2.appendChild(elemento("strong", null, "ipotesi"));
    p2.appendChild(document.createTextNode(", che cosa "));
    p2.appendChild(elemento("strong", null, "cambiare"));
    p2.appendChild(document.createTextNode(", che cosa "));
    p2.appendChild(elemento("strong", null, "misurare"));
    p2.appendChild(document.createTextNode(", che cosa tenere "));
    p2.appendChild(elemento("strong", null, "uguale"));
    p2.appendChild(document.createTextNode(" e come costruire il "));
    p2.appendChild(elemento("strong", null, "gruppo di controllo"));
    p2.appendChild(document.createTextNode(". Ogni risposta, giusta o sbagliata, ti spiega il perché."));
    intro.appendChild(p2);
    applicazione.appendChild(intro);

    var risultati = leggiRisultati();
    var griglia = elemento("div", "griglia-casi");

    casi.forEach(function (caso, indice) {
      var carta = elemento("button", "carta-caso");
      carta.type = "button";
      carta.appendChild(elemento("span", "carta-icona", caso.icona || "🧪"));
      carta.appendChild(elemento("div", "carta-titolo", caso.titolo));
      carta.appendChild(elemento("div", "carta-riassunto", caso.storia));

      var fatto = risultati[caso.titolo];
      if (fatto) {
        carta.appendChild(elemento("div", "carta-stato",
          "✓ già affrontato — miglior risultato " + fatto.giuste + " su " + fatto.totale));
      } else {
        carta.appendChild(elemento("div", "carta-passi",
          caso.passi.length + (caso.passi.length === 1 ? " passo" : " passi")));
      }

      carta.addEventListener("click", function () { apriCaso(indice); });
      griglia.appendChild(carta);
    });

    applicazione.appendChild(griglia);
    window.scrollTo(0, 0);
  }

  function mostraAvvisi() {
    var avviso = App.avvisoErroriFile("casi.txt", erroriFile);
    if (avviso) applicazione.appendChild(avviso);
  }

  /* ==========================================================
     4. Schermata di un passo
     ========================================================== */

  function apriCaso(indice) {
    casoAperto = casi[indice];
    indicePasso = 0;
    esiti = [];
    mostraPasso();
  }

  function mostraPasso() {
    var passo = casoAperto.passi[indicePasso];
    selezioni = [];
    passoConcluso = false;

    svuota(applicazione);

    /* barra in alto: uscita e contatore */
    var barra = elemento("div", "barra-alta");
    var indietro = elemento("button", "bottone-testo", "‹ tutti i casi");
    indietro.type = "button";
    indietro.addEventListener("click", mostraElencoCasi);
    barra.appendChild(indietro);
    barra.appendChild(elemento("span", "contatore",
      "Passo " + (indicePasso + 1) + " di " + casoAperto.passi.length));
    applicazione.appendChild(barra);

    /* avanzamento */
    var avanzamento = elemento("div", "avanzamento");
    avanzamento.setAttribute("aria-hidden", "true");
    for (var i = 0; i < casoAperto.passi.length; i++) {
      var segmento = elemento("span");
      if (i < indicePasso) segmento.className = "fatto";
      else if (i === indicePasso) segmento.className = "attuale";
      avanzamento.appendChild(segmento);
    }
    applicazione.appendChild(avanzamento);

    /* il caso, richiudibile: aperto al primo passo, chiuso dopo */
    var riquadro = elemento("details", "riquadro-caso");
    if (indicePasso === 0) riquadro.open = true;
    var titoloCaso = elemento("summary", null, casoAperto.titolo);
    riquadro.appendChild(titoloCaso);
    riquadro.appendChild(elemento("p", "storia", casoAperto.storia));
    applicazione.appendChild(riquadro);

    /* la scheda con la domanda */
    var scheda = elemento("section", "scheda-passo");
    scheda.appendChild(elemento("div", "etichetta-passo", passo.titolo));
    if (passo.premessa) scheda.appendChild(elemento("p", "premessa", passo.premessa));
    scheda.appendChild(elemento("p", "domanda", passo.domanda));
    if (passo.tipo === "multipla") {
      scheda.appendChild(elemento("p", "nota-multipla",
        "Scegli tutte le risposte giuste, poi premi « Controlla »."));
    }

    var contenitore = elemento("div", "risposte");
    var bottoniRisposta = [];

    passo.opzioni.forEach(function (opzione, indice) {
      var bottone = elemento("button", "risposta");
      bottone.type = "button";
      var segno = elemento("span", "segno", passo.tipo === "multipla" ? "" : String.fromCharCode(65 + indice));
      bottone.appendChild(segno);
      var corpo = elemento("div");
      corpo.appendChild(elemento("div", null, opzione.testo));
      bottone.appendChild(corpo);
      /* il nome parlato del bottone, per chi usa un lettore di schermo */
      bottone.setAttribute("aria-label", opzione.testo);
      if (passo.tipo === "multipla") bottone.setAttribute("aria-pressed", "false");

      bottone.addEventListener("click", function () {
        if (passoConcluso) return;
        if (passo.tipo === "multipla") {
          var posizione = selezioni.indexOf(indice);
          if (posizione >= 0) {
            selezioni.splice(posizione, 1);
            bottone.setAttribute("aria-pressed", "false");
            segno.textContent = "";
          } else {
            selezioni.push(indice);
            bottone.setAttribute("aria-pressed", "true");
            segno.textContent = "✓";
          }
          bottoneControlla.disabled = selezioni.length === 0;
        } else {
          selezioni = [indice];
          concludiPasso(passo, bottoniRisposta, scheda);
        }
      });

      bottoniRisposta.push(bottone);
      contenitore.appendChild(bottone);
    });

    scheda.appendChild(contenitore);

    var bottoneControlla = null;
    if (passo.tipo === "multipla") {
      var riga = elemento("div", "bottoni");
      bottoneControlla = elemento("button", "bottone", "Controlla");
      bottoneControlla.type = "button";
      bottoneControlla.disabled = true;
      bottoneControlla.addEventListener("click", function () {
        riga.remove();
        concludiPasso(passo, bottoniRisposta, scheda);
      });
      riga.appendChild(bottoneControlla);
      scheda.appendChild(riga);
    }

    applicazione.appendChild(scheda);
    window.scrollTo(0, 0);
  }

  /* Rivela le risposte, spiega e prepara il passaggio successivo */
  function concludiPasso(passo, bottoniRisposta, scheda) {
    passoConcluso = true;

    var tuttoGiusto = true;
    passo.opzioni.forEach(function (opzione, indice) {
      var scelta = selezioni.indexOf(indice) >= 0;
      var bottone = bottoniRisposta[indice];
      bottone.disabled = true;

      if (scelta && !opzione.giusta) tuttoGiusto = false;
      if (!scelta && opzione.giusta && passo.tipo === "multipla") tuttoGiusto = false;

      if (opzione.giusta) {
        bottone.classList.add("giusta");
        bottone.querySelector(".segno").textContent = "✓";
        if (!scelta) bottone.classList.add("spenta");
      } else if (scelta) {
        bottone.classList.add("sbagliata");
        bottone.querySelector(".segno").textContent = "✕";
      } else {
        bottone.classList.add("spenta");
      }

      /* la spiegazione compare per ciò che lo studente ha scelto e per le risposte giuste */
      if ((scelta || opzione.giusta) && opzione.spiegazione) {
        bottone.querySelector("div").appendChild(
          elemento("div", "spiegazione", opzione.spiegazione));
      }
    });

    esiti[indicePasso] = tuttoGiusto;

    var esito = elemento("p", "esito " + (tuttoGiusto ? "bene" : "male"));
    esito.setAttribute("role", "status");
    if (tuttoGiusto) {
      esito.textContent = passo.tipo === "multipla"
        ? "Giusto: le hai individuate tutte."
        : "Giusto.";
    } else {
      esito.textContent = passo.tipo === "multipla"
        ? "Non del tutto: guarda qui sotto quali erano le risposte giuste e perché."
        : "Non è questa. Leggi la spiegazione della risposta giusta, qui sopra in verde.";
    }
    scheda.appendChild(esito);

    var riga = elemento("div", "bottoni");
    var ultimo = indicePasso === casoAperto.passi.length - 1;
    var avanti = elemento("button", "bottone", ultimo ? "Vedi il tuo esperimento →" : "Avanti →");
    avanti.type = "button";
    avanti.addEventListener("click", function () {
      if (ultimo) {
        mostraFine();
      } else {
        indicePasso++;
        mostraPasso();
      }
    });
    riga.appendChild(avanti);
    scheda.appendChild(riga);
    avanti.focus();
  }

  /* ==========================================================
     5. Schermata finale
     ========================================================== */

  function mostraFine() {
    var totale = casoAperto.passi.length;
    var giuste = 0;
    for (var i = 0; i < totale; i++) if (esiti[i]) giuste++;
    salvaRisultato(casoAperto.titolo, giuste, totale);

    svuota(applicazione);

    var barra = elemento("div", "barra-alta");
    var indietro = elemento("button", "bottone-testo", "‹ tutti i casi");
    indietro.type = "button";
    indietro.addEventListener("click", mostraElencoCasi);
    barra.appendChild(indietro);
    barra.appendChild(elemento("span", "contatore", casoAperto.titolo));
    applicazione.appendChild(barra);

    var punteggio = elemento("div", "punteggio");
    punteggio.appendChild(elemento("div", "punteggio-numero", giuste + " / " + totale));
    punteggio.appendChild(elemento("div", "punteggio-commento", commento(giuste, totale)));
    applicazione.appendChild(punteggio);

    var riepilogo = elemento("section", "riepilogo");
    riepilogo.appendChild(elemento("h3", null, "Il tuo esperimento"));
    riepilogo.appendChild(elemento("p", "riepilogo-nota",
      "Ecco l'esperimento corretto, passo per passo. Il segno a sinistra dice come era andata la tua risposta."));

    casoAperto.passi.forEach(function (passo, indice) {
      var giusteTesto = passo.opzioni
        .filter(function (o) { return o.giusta; })
        .map(function (o) { return o.testo; })
        .join(" · ");

      var voce = elemento("div", "voce-riepilogo");
      voce.appendChild(elemento("div", "voce-esito", esiti[indice] ? "✓" : "✕"));
      var corpo = elemento("div");
      corpo.appendChild(elemento("div", "voce-titolo", passo.titolo));
      corpo.appendChild(elemento("div", "voce-testo", giusteTesto));
      voce.appendChild(corpo);
      riepilogo.appendChild(voce);
    });

    var riga = elemento("div", "bottoni");
    var rifai = elemento("button", "bottone", "Rifai questo caso");
    rifai.type = "button";
    rifai.addEventListener("click", function () {
      indicePasso = 0;
      esiti = [];
      mostraPasso();
    });
    var altri = elemento("button", "bottone secondario", "Scegli un altro caso");
    altri.type = "button";
    altri.addEventListener("click", mostraElencoCasi);
    riga.appendChild(rifai);
    riga.appendChild(altri);
    riepilogo.appendChild(riga);

    applicazione.appendChild(riepilogo);
    window.scrollTo(0, 0);
  }

  function commento(giuste, totale) {
    if (giuste === totale) return "Esperimento impeccabile: nessuna variabile fuori posto.";
    if (giuste >= totale - 1) return "Quasi tutto a posto: rileggi il passo segnato e sei a cavallo.";
    if (giuste >= totale / 2) return "Buon impianto, ma qualche variabile è ancora sfuggita di mano.";
    return "Questo esperimento non reggerebbe: rifallo leggendo bene le spiegazioni.";
  }

  /* ==========================================================
     6. Avvio
     ========================================================== */

  App.caricaTesto("casi.txt")
    .then(function (testo) {
      var risultato = leggiCasi(testo);
      casi = risultato.casi;
      erroriFile = risultato.errori;
      if (casi.length === 0) {
        svuota(applicazione);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(elemento("strong", null, "Nessun caso da mostrare."));
        avviso.appendChild(document.createTextNode(
          "Il file casi.txt è stato letto, ma non contiene nessun caso valido. " +
          "Controlla che ci sia almeno un blocco [CASO] con i suoi [PASSO]."));
        applicazione.appendChild(avviso);
        erroriFile.forEach(function (e) {
          applicazione.appendChild(elemento("p", "contatore", e));
        });
        return;
      }
      mostraElencoCasi();
    })
    .catch(function (errore) {
      svuota(applicazione);
      applicazione.appendChild(App.avvisoCaricamento("casi.txt", errore.message));
    });

})();
