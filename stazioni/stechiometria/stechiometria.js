/* ============================================================
   Il banco di stechiometria
   ------------------------------------------------------------
   Si mettono sul banco certe quantita' di reagenti e si guarda
   che cosa esce: quanto prodotto, che cosa avanza, e soprattutto
   quale reagente finisce per primo.

   Come funziona, in due parole:
   - le moli si ricavano dalla massa e dalla massa molare, e da
     li' in poi si ragiona sempre in moli, mai in grammi: e' il
     punto che di solito non passa
   - il reagente limitante e' quello con il rapporto moli diviso
     coefficiente piu' piccolo. Il sito lo trova cosi' e lo dice
   - la massa totale prima e dopo viene sempre ricalcolata e
     messa a confronto: se il conto non torna c'e' un errore,
     e la legge di Lavoisier serve proprio a questo
   - la resa si puo' abbassare sotto il 100%: quello che manca
     non sparisce, resta reagente non trasformato
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  /* ---------- stato ---------- */

  var reazioni = [], erroriFile = [];
  var reazione = null;
  var masse = [];           /* grammi messi sul banco, uno per reagente */
  var resa = 100;           /* percentuale */
  var esperimentoScelto = 0;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var letturaLimitante = null, letturaProdotto = null, letturaAvanzo = null;
  var pastiglieReazione = [], pastiglieEsp = [];
  var frase = null, schedaNota = null, tabella = null, bilancio = null;
  var cursori = [], cursoreResa = null;

  var COLORI = ["#4c8fbd", "#d9a441", "#4aa06a", "#b5615f", "#7a6fb0", "#5aa0a0"];

  /* ==========================================================
     1. Gli esperimenti gia' pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "Le proporzioni giuste",
      sottotitolo: "Nessuno dei due avanza: tutto si trasforma",
      reazione: "Sintesi dell'acqua", masse: [4, 32], resa: 100
    },
    {
      titolo: "Il reagente limitante",
      sottotitolo: "Idrogeno in abbondanza, ma l'ossigeno finisce subito",
      reazione: "Sintesi dell'acqua", masse: [20, 16], resa: 100
    },
    {
      titolo: "Lavoisier",
      sottotitolo: "Pesa prima e dopo: il totale non cambia mai",
      reazione: "Nastro di magnesio che brucia", masse: [24.3, 40], resa: 100
    },
    {
      titolo: "La resa che non arriva a cento",
      sottotitolo: "In laboratorio non si raccoglie mai tutto il prodotto",
      reazione: "Sintesi dell'ammoniaca", masse: [28, 6], resa: 65
    },
    {
      titolo: "L'altoforno",
      sottotitolo: "Quanto ferro esce da un chilo di minerale?",
      reazione: "Ferro dall'altoforno", masse: [160, 90], resa: 100
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  /* Trasforma "N2 [28,0] + 3 H2 [2,0]" nell'elenco delle sostanze,
     ciascuna col suo coefficiente e la sua massa molare. */
  function leggiLato(testo) {
    var pezzi = String(testo).split("+");
    var elenco = [];
    for (var i = 0; i < pezzi.length; i++) {
      var p = pezzi[i].trim();
      if (p === "") return null;
      var m = p.match(/^(\d+(?:[.,]\d+)?)?\s*([^\[\]]+?)\s*\[\s*([\d.,]+)\s*\]$/);
      if (!m) return null;
      var coeff = m[1] ? numero(m[1]) : 1;
      var molare = numero(m[3]);
      if (coeff === null || coeff <= 0 || molare === null || molare <= 0) return null;
      elenco.push({ nome: m[2].trim(), coeff: coeff, molare: molare });
    }
    return elenco;
  }

  function leggiReazioni(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 3) {
        errori.push("riga " + (i + 1) + ": servono almeno tre parti separate da | .");
        return;
      }
      var reagenti = leggiLato(p[1]);
      var prodotti = leggiLato(p[2]);
      if (!reagenti || !prodotti) {
        errori.push("riga " + (i + 1) + ": formule scritte male. Esempio giusto: N2 [28,0] + 3 H2 [2,0]");
        return;
      }

      /* controllo che l'equazione sia bilanciata: la massa dei
         reagenti deve essere uguale a quella dei prodotti */
      var massaSinistra = 0, massaDestra = 0;
      reagenti.forEach(function (s) { massaSinistra += s.coeff * s.molare; });
      prodotti.forEach(function (s) { massaDestra += s.coeff * s.molare; });
      var scarto = Math.abs(massaSinistra - massaDestra) / massaSinistra;
      if (scarto > 0.01) {
        errori.push("riga " + (i + 1) + ": l'equazione non e' bilanciata. A sinistra " +
          arrotonda(massaSinistra, 1) + " g/mol, a destra " + arrotonda(massaDestra, 1) +
          " g/mol. Controlla i coefficienti o le masse molari.");
        return;
      }

      elenco.push({
        nome: p[0].trim(),
        reagenti: reagenti,
        prodotti: prodotti,
        equazione: p[1].trim().replace(/\s*\[[^\]]*\]/g, "") + " → " +
          p[2].trim().replace(/\s*\[[^\]]*\]/g, ""),
        nota: p.length > 3 ? p[3].trim() : ""
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. I conti
     ========================================================== */

  function moliDi(i) {
    return masse[i] / reazione.reagenti[i].molare;
  }

  /* Quante volte si riesce a fare la reazione per intero: e' il
     piu' piccolo fra i rapporti moli diviso coefficiente. */
  function quanteVolte() {
    var minimo = Infinity;
    reazione.reagenti.forEach(function (s, i) {
      var volte = moliDi(i) / s.coeff;
      if (volte < minimo) minimo = volte;
    });
    return isFinite(minimo) ? minimo * (resa / 100) : 0;
  }

  function indiceLimitante() {
    var minimo = Infinity, quale = 0;
    reazione.reagenti.forEach(function (s, i) {
      var volte = moliDi(i) / s.coeff;
      if (volte < minimo) { minimo = volte; quale = i; }
    });
    return quale;
  }

  /* Se tutti i rapporti sono uguali, nessuno e' davvero
     limitante: le proporzioni sono quelle giuste. */
  function proporzioniGiuste() {
    var primo = null, giuste = true;
    reazione.reagenti.forEach(function (s, i) {
      var volte = moliDi(i) / s.coeff;
      if (primo === null) primo = volte;
      else if (primo <= 0 || Math.abs(volte - primo) / primo > 0.005) giuste = false;
    });
    return giuste && primo > 0;
  }

  function moliProdotto(j) {
    return quanteVolte() * reazione.prodotti[j].coeff;
  }

  function massaProdotto(j) {
    return moliProdotto(j) * reazione.prodotti[j].molare;
  }

  function moliAvanzate(i) {
    return moliDi(i) - quanteVolte() * reazione.reagenti[i].coeff;
  }

  function massaAvanzata(i) {
    return moliAvanzate(i) * reazione.reagenti[i].molare;
  }

  function massaPrima() {
    var t = 0;
    masse.forEach(function (m) { t += m; });
    return t;
  }

  function massaDopo() {
    var t = 0;
    reazione.prodotti.forEach(function (s, j) { t += massaProdotto(j); });
    reazione.reagenti.forEach(function (s, i) { t += massaAvanzata(i); });
    return t;
  }

  /* ==========================================================
     4. Il disegno: le confezioni che si montano
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegnaBanco() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezza, altezza);

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var bordo = coloreTema("--bordo", "#ddd6c9");

    /* Si disegna una riga per reagente. Ogni riga ha tanti
       quadretti quante moli ce ne sono, in scala. I quadretti
       che entrano nella reazione sono pieni, quelli che avanzano
       sono vuoti. */
    var righe = reazione.reagenti.length;
    var altoRiga = Math.min(46, (altezza - 34) / righe);
    var sx = 54;
    var w = larghezza - sx - 14;

    /* la scala: il reagente che ha piu' moli riempie la riga */
    var maxMoli = 0;
    reazione.reagenti.forEach(function (s, i) {
      if (moliDi(i) > maxMoli) maxMoli = moliDi(i);
    });
    if (maxMoli <= 0) maxMoli = 1;

    var volte = quanteVolte();

    c.font = "11px system-ui, sans-serif";
    reazione.reagenti.forEach(function (s, i) {
      var y = 24 + i * altoRiga;
      var n = moliDi(i);
      var usate = Math.min(n, volte * s.coeff);

      c.fillStyle = tenue;
      c.textAlign = "right";
      c.fillText(s.nome, sx - 8, y + 12);

      var larghTot = w * (n / maxMoli);
      var larghUsata = maxMoli > 0 ? w * (usate / maxMoli) : 0;

      /* quello che avanza: contorno vuoto */
      c.fillStyle = coloreTema("--superficie", "#fffdf8");
      c.fillRect(sx, y, larghTot, altoRiga * 0.6);
      c.strokeStyle = bordo; c.lineWidth = 1.5;
      c.strokeRect(sx, y, larghTot, altoRiga * 0.6);

      /* quello che reagisce davvero: pieno */
      c.fillStyle = COLORI[i % COLORI.length];
      c.fillRect(sx, y, larghUsata, altoRiga * 0.6);

      /* la tacca dove finisce la parte che reagisce */
      if (larghTot - larghUsata > 2) {
        c.strokeStyle = "#c06a28"; c.lineWidth = 2;
        c.beginPath();
        c.moveTo(sx + larghUsata, y - 3);
        c.lineTo(sx + larghUsata, y + altoRiga * 0.6 + 3);
        c.stroke();
      }

      c.fillStyle = tenue;
      c.textAlign = "left";
      var testo = conVirgola(arrotonda(n, 3)) + " mol";
      if (larghTot - larghUsata > 2) {
        testo += " · ne avanzano " + conVirgola(arrotonda(moliAvanzate(i), 3));
      }
      c.fillText(testo, sx + 4, y + altoRiga * 0.6 + 14);
    });

    c.textAlign = "left";
    c.fillStyle = tenue;
    c.font = "600 11px system-ui, sans-serif";
    c.fillText("quanto ce n'e', in moli · la parte piena e' quella che reagisce", 6, 14);
  }

  /* ==========================================================
     5. Le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

  function racconta() {
    var volte = quanteVolte();
    if (volte <= 0) {
      return "Manca qualcosa: se uno dei reagenti e' a zero la reazione non parte nemmeno. " +
        "Prova a metterne un po' di tutti.";
    }

    var lim = indiceLimitante();
    var s = reazione.reagenti[lim];

    if (proporzioniGiuste()) {
      return "Qui le proporzioni sono esattamente quelle dell'equazione: nessun reagente avanza, " +
        "finiscono insieme. E' la situazione che in laboratorio si cerca apposta, perche' non si " +
        "spreca niente." + (resa < 100
          ? " Con la resa al " + conVirgola(resa) + "% pero' una parte non si trasforma, e la ritrovi " +
            "fra gli avanzi."
          : "");
    }

    return "Il reagente limitante e' " + s.nome + ": e' quello che finisce per primo, e decide quanto " +
      "prodotto si forma. Non e' quello che pesa di meno ne' quello che ha meno moli in assoluto: e' " +
      "quello con il rapporto piu' piccolo fra le moli che hai e il suo coefficiente nell'equazione. " +
      "Gli altri avanzano, e restano li' senza fare niente.";
  }

  /* ==========================================================
     6. I comandi
     ========================================================== */

  function cursore(etichetta, min, max, passo, valore, unita, quandoCambia) {
    var riga = elemento("div", "cursore");
    var testa = elemento("div", "cursore-testa");
    testa.appendChild(elemento("span", "cursore-nome", etichetta));
    var lettura = elemento("span", "cursore-valore", conVirgola(valore) + " " + unita);
    testa.appendChild(lettura);
    riga.appendChild(testa);
    var input = elemento("input");
    input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(passo);
    input.value = String(valore);
    input.setAttribute("aria-label", etichetta);
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      lettura.textContent = conVirgola(v) + " " + unita;
      quandoCambia(v);
    });
    riga.appendChild(input);
    riga.aggiorna = function (v) {
      input.value = String(v);
      lettura.textContent = conVirgola(v) + " " + unita;
    };
    return riga;
  }

  function unaLettura(nome, registra) {
    var box = elemento("div", "lettura");
    var v = elemento("div", "lettura-valore", "—");
    box.appendChild(v);
    box.appendChild(elemento("div", "lettura-nome", nome));
    registra(v);
    return box;
  }

  function applicaEsperimento(x) {
    var r = reazioni.filter(function (y) { return y.nome === x.reazione; })[0];
    if (r) reazione = r;
    masse = reazione.reagenti.map(function (s, i) {
      return x.masse && x.masse[i] !== undefined ? x.masse[i] : s.coeff * s.molare;
    });
    resa = x.resa;
    costruisci();
  }

  function disegnaTabella() {
    svuota(tabella);
    var t = elemento("table", "tabella-cifre");

    var testa = elemento("tr");
    ["sostanza", "massa molare", "grammi", "moli"].forEach(function (h) {
      testa.appendChild(elemento("th", null, h));
    });
    t.appendChild(testa);

    var lim = indiceLimitante();
    var giuste = proporzioniGiuste();

    reazione.reagenti.forEach(function (s, i) {
      var riga = elemento("tr");
      var nome = elemento("td");
      var pallino = elemento("span", "chip-simbolo", "●");
      pallino.style.color = COLORI[i % COLORI.length];
      nome.appendChild(pallino);
      nome.appendChild(document.createTextNode(" " + s.coeff + " " + s.nome +
        (!giuste && i === lim && quanteVolte() > 0 ? "  (limitante)" : "")));
      riga.appendChild(nome);
      riga.appendChild(elemento("td", null, conVirgola(s.molare)));
      riga.appendChild(elemento("td", null, conVirgola(arrotonda(masse[i], 2))));
      riga.appendChild(elemento("td", null, conVirgola(arrotonda(moliDi(i), 3))));
      t.appendChild(riga);
    });

    var separa = elemento("tr");
    var cella = elemento("td", null, "si formano");
    cella.colSpan = 4;
    separa.appendChild(cella);
    t.appendChild(separa);

    reazione.prodotti.forEach(function (s, j) {
      var riga = elemento("tr");
      riga.appendChild(elemento("td", null, "→ " + s.coeff + " " + s.nome));
      riga.appendChild(elemento("td", null, conVirgola(s.molare)));
      riga.appendChild(elemento("td", null, conVirgola(arrotonda(massaProdotto(j), 2))));
      riga.appendChild(elemento("td", null, conVirgola(arrotonda(moliProdotto(j), 3))));
      t.appendChild(riga);
    });

    var avanzi = reazione.reagenti.filter(function (s, i) { return massaAvanzata(i) > 0.005; });
    if (avanzi.length) {
      var testaA = elemento("tr");
      var cellaA = elemento("td", null, "avanzano senza reagire");
      cellaA.colSpan = 4;
      testaA.appendChild(cellaA);
      t.appendChild(testaA);

      reazione.reagenti.forEach(function (s, i) {
        if (massaAvanzata(i) <= 0.005) return;
        var riga = elemento("tr");
        riga.appendChild(elemento("td", null, s.nome));
        riga.appendChild(elemento("td", null, conVirgola(s.molare)));
        riga.appendChild(elemento("td", null, conVirgola(arrotonda(massaAvanzata(i), 2))));
        riga.appendChild(elemento("td", null, conVirgola(arrotonda(moliAvanzate(i), 3))));
        t.appendChild(riga);
      });
    }

    tabella.appendChild(t);
  }

  function disegnaBilancio() {
    svuota(bilancio);
    var prima = massaPrima(), dopo = massaDopo();
    var torna = prima <= 0 || Math.abs(prima - dopo) / prima < 0.005;

    var scritto = arrotonda(prima, 2), scrittoDopo = arrotonda(dopo, 2);
    bilancio.appendChild(elemento("p", "formula",
      conVirgola(scritto) + " g prima   =   " + conVirgola(scrittoDopo) + " g dopo"));

    var testo;
    if (!torna) {
      testo = "Attenzione: il conto non torna. Se succede, l'equazione scritta nel file non e' bilanciata.";
    } else {
      testo = "Il conto torna, e non e' un caso: gli atomi non si creano e non si distruggono, cambiano " +
        "solo compagnia. E' la legge di Lavoisier. Vale anche quando la resa non arriva al 100%, perche' " +
        "quello che non si trasforma resta fra gli avanzi e pesa lo stesso.";
      if (scritto !== scrittoDopo) {
        /* capita quando le masse molari nel file sono arrotondate:
           vale la pena dirlo, perche' altrimenti sembra un errore */
        testo += " I due numeri qui sopra differiscono di " +
          conVirgola(arrotonda(Math.abs(prima - dopo), 2)) + " g, ma non e' materia sparita: e' solo " +
          "l'arrotondamento delle masse molari scritte nel file, che hanno poche cifre dopo la virgola.";
      }
    }
    bilancio.appendChild(elemento("p", "nota-piccola", testo));
  }

  function aggiorna() {
    var volte = quanteVolte();
    var lim = indiceLimitante();

    letturaLimitante.textContent = volte <= 0 ? "—"
      : (proporzioniGiuste() ? "nessuno" : reazione.reagenti[lim].nome);
    letturaProdotto.textContent = conVirgola(arrotonda(massaProdotto(0), 2)) + " g";
    var totaleAvanzo = 0;
    reazione.reagenti.forEach(function (s, i) { totaleAvanzo += Math.max(0, massaAvanzata(i)); });
    letturaAvanzo.textContent = conVirgola(arrotonda(totaleAvanzo, 2)) + " g";

    pastiglieReazione.forEach(function (b) {
      b.className = "pillola" + (b.dato === reazione ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    frase.textContent = racconta();
    disegnaTabella();
    disegnaBilancio();

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegnaBanco();
  }

  /* ==========================================================
     7. Costruire la pagina
     ========================================================== */

  function costruisci() {
    svuota(contenitore);
    pastiglieReazione = []; pastiglieEsp = []; cursori = [];

    var avvisoErrori = App.avvisoErroriFile("reazioni-stechiometria.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Un'equazione chimica non parla di grammi: parla di quante particelle servono. Per usarla bisogna " +
      "prima passare dai grammi alle moli, fare i conti li', e solo alla fine tornare ai grammi. " +
      "Qui si vede succedere, passaggio per passaggio."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Esperimenti da provare"));
    var griglia = elemento("div", "griglia-esperimenti");
    ESPERIMENTI.forEach(function (x, i) {
      var b = elemento("button", "carta-esperimento");
      b.type = "button";
      b.appendChild(elemento("div", "esperimento-titolo", x.titolo));
      b.appendChild(elemento("div", "esperimento-sottotitolo", x.sottotitolo));
      b.addEventListener("click", function () { esperimentoScelto = i; applicaEsperimento(x); });
      pastiglieEsp.push(b);
      griglia.appendChild(b);
    });
    contenitore.appendChild(griglia);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "La reazione"));
    var eq = elemento("p", "formula", reazione.equazione);
    contenitore.appendChild(eq);

    /* --- il banco --- */
    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);
    contenitore.appendChild(elemento("p", "didascalia",
      "La barra piena e' la parte di reagente che riesce a reagire, quella vuota oltre la tacca " +
      "arancione e' quello che avanza. Il reagente limitante e' l'unico la cui barra e' piena fino " +
      "in fondo."));

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("reagente limitante", function (n) { letturaLimitante = n; }));
    letture.appendChild(unaLettura("prodotto principale", function (n) { letturaProdotto = n; }));
    letture.appendChild(unaLettura("reagenti avanzati", function (n) { letturaAvanzo = n; }));
    contenitore.appendChild(letture);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    /* --- quanto ne metto --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quanto ne metto sul banco"));
    var comandi = elemento("div", "comandi");
    reazione.reagenti.forEach(function (s, i) {
      var massimo = Math.max(20, Math.ceil(s.coeff * s.molare * 4 / 10) * 10);
      var c = cursore(s.nome, 0, massimo, massimo / 200, arrotonda(masse[i], 2), "g", function (v) {
        masse[i] = v;
        esperimentoScelto = -1;
        aggiorna();
      });
      cursori.push(c);
      comandi.appendChild(c);
    });
    cursoreResa = cursore("Resa", 5, 100, 1, resa, "%", function (v) {
      resa = v; esperimentoScelto = -1; aggiorna();
    });
    comandi.appendChild(cursoreResa);
    contenitore.appendChild(comandi);

    var pareggia = elemento("button", "bottone", "Metti le proporzioni giuste");
    pareggia.type = "button";
    pareggia.addEventListener("click", function () {
      /* si tiene fermo il primo reagente e si adeguano gli altri */
      var volte = moliDi(0) / reazione.reagenti[0].coeff;
      if (!(volte > 0)) volte = 1;
      reazione.reagenti.forEach(function (s, i) {
        masse[i] = arrotonda(volte * s.coeff * s.molare, 2);
        if (cursori[i]) cursori[i].aggiorna(masse[i]);
      });
      esperimentoScelto = -1;
      aggiorna();
    });
    var rigaB = elemento("div", "bottoni");
    rigaB.appendChild(pareggia);
    contenitore.appendChild(rigaB);

    /* --- la tabella --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Il conto, passaggio per passaggio"));
    tabella = elemento("div", "involucro-tabella");
    contenitore.appendChild(tabella);

    /* --- Lavoisier --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La bilancia"));
    bilancio = elemento("div");
    contenitore.appendChild(bilancio);

    /* --- quale reazione --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quale reazione"));
    var scelte = elemento("div", "scelte-grandezza");
    reazioni.forEach(function (r) {
      var b = elemento("button", "pillola", r.nome);
      b.type = "button"; b.dato = r;
      b.addEventListener("click", function () {
        reazione = r;
        esperimentoScelto = -1;
        masse = r.reagenti.map(function (s) { return arrotonda(s.coeff * s.molare, 2); });
        resa = 100;
        costruisci();
      });
      pastiglieReazione.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);
    schedaNota = elemento("p", "nota-piccola", reazione.nota
      ? reazione.nota.charAt(0).toUpperCase() + reazione.nota.slice(1) + "." : "");
    contenitore.appendChild(schedaNota);

    /* --- i limiti --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Le reazioni sono considerate complete, cioe' vanno fino in fondo in un verso solo. Moltissime reazioni vere invece si fermano a un equilibrio: per quelle serve la stazione dell'equilibrio chimico.",
      "La resa si sceglie a mano. In laboratorio non si sceglie: dipende da reazioni secondarie, da prodotto che resta attaccato alla vetreria, da passaggi di travaso. Qui serve solo a far vedere che cosa comporta.",
      "Le masse molari sono quelle scritte nel file, arrotondate. Con i valori a piu' cifre i risultati cambiano nei decimali.",
      "Non si tiene conto della purezza dei reagenti: si suppone che quello che si pesa sia tutto sostanza utile. Un minerale vero di ferro non e' ossido di ferro puro.",
      "Lo stato fisico delle sostanze non compare, e non compaiono nemmeno le condizioni: temperatura, pressione, solvente. Per la stechiometria non servono, ma per fare davvero la reazione si'."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;
    larghezza = tela.parentNode.clientWidth;
    var righe = reazione.reagenti.length;
    altezza = Math.round(Math.max(120, 34 + righe * 46));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegnaBanco();
  });

  /* ==========================================================
     8. Avvio
     ========================================================== */

  App.caricaTesto("reazioni-stechiometria.txt")
    .then(function (testo) {
      var esito = leggiReazioni(testo);
      reazioni = esito.elenco;
      erroriFile = esito.errori;

      if (!reazioni.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file reazioni-stechiometria.txt e' stato letto ma non contiene reazioni valide."));
        contenitore.appendChild(avviso);
        return;
      }

      reazione = reazioni[0];
      masse = reazione.reagenti.map(function (s) { return arrotonda(s.coeff * s.molare, 2); });
      costruisci();
      applicaEsperimento(ESPERIMENTI[0]);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("reazioni-stechiometria.txt", errore.message));
    });

})();
