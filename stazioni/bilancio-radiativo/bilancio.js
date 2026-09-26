/* ============================================================
   Il bilancio radiativo
   ------------------------------------------------------------
   Perché un pianeta ha la temperatura che ha. Si regolano la
   luce che riceve, quanta ne rimanda indietro e quanto la sua
   atmosfera trattiene il calore, e la temperatura viene fuori
   da sola.

   Come funziona, in due parole:
   - la temperatura non è scritta da nessuna parte: è quella
     alla quale l'energia che entra e quella che esce si
     pareggiano. Si ricava dalla legge di Stefan e Boltzmann
   - l'atmosfera è trattata come un certo numero di coperte che
     rimandano indietro il calore. È il modello a strati, il
     più semplice che dia i numeri giusti: con zero coperte la
     Terra fa meno 18 gradi, con quelle che ha fa più 15
   - accanto al risultato del conto c'è sempre la temperatura
     misurata davvero, così si vede quanto il modello ci prende
   - l'albedo si può cambiare a mano e si vede il circolo
     vizioso del ghiaccio: più ghiaccio, più luce rimandata
     indietro, più freddo, ancora più ghiaccio
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var SIGMA = 5.670374e-8;   /* costante di Stefan e Boltzmann, W/(m2 K4) */

  /* ---------- stato ---------- */

  var corpi = [], erroriFile = [];
  var corpo = null;
  var luce = 1361;
  var albedo = 0.30;
  var coperte = 0.64;
  var esperimentoScelto = 0;
  var graficoScelto = "albedo";

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaG = null, ctxG = null, larghezzaG = 0, altezzaG = 0;
  var letturaTemp = null, letturaSenza = null, letturaVera = null;
  var pastiglieCorpo = [], pastiglieEsp = [], pastiglieGrafico = [];
  var frase = null, schedaCorpo = null;
  var cursoreL = null, cursoreA = null, cursoreC = null;

  /* ==========================================================
     1. Gli esperimenti già pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "La Terra senza atmosfera",
      sottotitolo: "Stessa luce, stesso albedo, ma niente che trattenga: meno 18 gradi",
      corpo: "Terra senza atmosfera"
    },
    {
      titolo: "La Terra com'è",
      sottotitolo: "Le stesse condizioni più l'effetto serra: più 15",
      corpo: "Terra"
    },
    {
      titolo: "Il circolo del ghiaccio",
      sottotitolo: "Più ghiaccio rimanda indietro più luce, e fa ancora più freddo",
      corpo: "Terra tutta ghiacciata"
    },
    {
      titolo: "Venere, il caso estremo",
      sottotitolo: "Rimanda indietro tre quarti della luce ed è il pianeta più caldo",
      corpo: "Venere"
    },
    {
      titolo: "La Luna, stessa distanza",
      sottotitolo: "Riceve la nostra identica luce: senza aria, non basta",
      corpo: "Luna"
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiCorpi(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 5) {
        errori.push("riga " + (i + 1) + ": servono almeno cinque parti separate da | .");
        return;
      }
      var l = numero(p[1]), a = numero(p[2]), c = numero(p[3]), t = numero(p[4]);
      if (l === null || a === null || c === null || t === null) {
        errori.push("riga " + (i + 1) + ": luce, albedo, coperte e temperatura devono essere numeri.");
        return;
      }
      if (l <= 0) {
        errori.push("riga " + (i + 1) + ": la luce ricevuta deve essere maggiore di zero.");
        return;
      }
      if (a < 0 || a >= 1) {
        errori.push("riga " + (i + 1) + ": l'albedo deve stare fra 0 e 1.");
        return;
      }
      if (c < 0) {
        errori.push("riga " + (i + 1) + ": le coperte non possono essere meno di zero.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        luce: l, albedo: a, coperte: c, vera: t,
        nota: p.length > 5 ? p[5].trim() : ""
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. La fisica
     ========================================================== */

  /* Quanta energia il pianeta assorbe davvero, su ogni metro
     quadro della sua superficie. Si divide per quattro perché
     la luce colpisce un disco ma il pianeta è una sfera, e la
     superficie di una sfera è quattro volte quella del suo
     disco. */
  function assorbita(l, a) {
    return l * (1 - a) / 4;
  }

  /* La temperatura a cui un corpo deve stare per riemettere
     esattamente quello che assorbe: è la legge di Stefan e
     Boltzmann girata al contrario. In kelvin. */
  function temperaturaSenzaAtmosfera(l, a) {
    return Math.pow(assorbita(l, a) / SIGMA, 0.25);
  }

  /* Con l'atmosfera: ogni coperta rimanda indietro il calore, e
     il suolo deve scaldarsi di più per far uscire lo stesso. */
  function temperaturaSuolo(l, a, c) {
    return temperaturaSenzaAtmosfera(l, a) * Math.pow(1 + c, 0.25);
  }

  function inGradi(k) { return k - 273.15; }

  function tempOra() { return temperaturaSuolo(luce, albedo, coperte); }
  function tempSenza() { return temperaturaSenzaAtmosfera(luce, albedo); }
  function effettoSerra() { return tempOra() - tempSenza(); }

  /* Quanto scalda raddoppiare l'anidride carbonica: si somma il
     pezzo di coperta che corrisponde, e si guarda di quanto sale
     la temperatura. */
  function raddoppioCo2() {
    var prima = temperaturaSuolo(luce, albedo, coperte);
    var dopo = temperaturaSuolo(luce, albedo, coperte + 0.033);
    return dopo - prima;
  }

  /* ==========================================================
     4. Il disegno
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegnaPianeta() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);
    c.fillStyle = "#151b2a";
    c.fillRect(0, 0, larghezza, altezza);

    var tenue = "#9aa3b5";
    var cx = larghezza / 2, cy = altezza * 0.62;
    var raggio = Math.min(larghezza * 0.2, altezza * 0.34);

    /* le frecce: quanta luce arriva, quanta torna indietro,
       quanta esce come calore. Lo spessore segue i numeri. */
    var arriva = luce / 4;
    var riflessa = arriva * albedo;
    var entra = arriva * (1 - albedo);
    var scala = 26 / Math.max(1, arriva);

    function fascio(x0, y0, x1, y1, spessore, colore, etichetta, valore) {
      if (spessore < 0.6) return;
      c.strokeStyle = colore;
      c.lineWidth = Math.max(1, spessore);
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      c.fillStyle = colore;
      c.font = "10px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(etichetta + " " + Math.round(valore), (x0 + x1) / 2, (y0 + y1) / 2 - 6);
    }

    /* luce in arrivo, da sinistra in alto */
    fascio(14, 22, cx - raggio * 0.6, cy - raggio * 0.6,
      arriva * scala, "#e8c33a", "arriva", arriva);
    /* luce rimandata indietro */
    fascio(cx - raggio * 0.4, cy - raggio * 0.8, cx - raggio * 0.1, 16,
      riflessa * scala, "#cfe0ee", "rimandata", riflessa);
    /* calore che esce, a destra */
    fascio(cx + raggio * 0.5, cy - raggio * 0.7, larghezza - 20, 20,
      entra * scala, "#d97a4a", "esce come calore", entra);

    /* l'atmosfera, tanto più spessa quante più coperte */
    if (coperte > 0) {
      var spessore = Math.min(raggio * 0.75, 4 + Math.log(1 + coperte) * 12);
      var g = c.createRadialGradient(cx, cy, raggio, cx, cy, raggio + spessore);
      g.addColorStop(0, "rgba(220, 140, 90, 0.55)");
      g.addColorStop(1, "rgba(220, 140, 90, 0)");
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, raggio + spessore, 0, Math.PI * 2); c.fill();
    }

    /* il pianeta: il colore dice la temperatura */
    var t = inGradi(tempOra());
    var caldo = Math.max(0, Math.min(1, (t + 80) / 200));
    c.fillStyle = "rgb(" + Math.round(40 + caldo * 190) + "," +
      Math.round(70 + caldo * 60) + "," + Math.round(140 - caldo * 100) + ")";
    c.beginPath(); c.arc(cx, cy, raggio, 0, Math.PI * 2); c.fill();

    /* la calotta di ghiaccio, tanto più grande quanto più albedo */
    if (albedo > 0.2) {
      var quota = Math.min(1, (albedo - 0.2) / 0.5);
      c.fillStyle = "rgba(240, 248, 255, 0.85)";
      c.beginPath();
      c.arc(cx, cy, raggio, Math.PI * (1 + 0.5 - quota * 0.5), Math.PI * (1.5 + quota * 0.5));
      c.closePath(); c.fill();
      c.beginPath();
      c.arc(cx, cy, raggio, Math.PI * (0.5 - quota * 0.5), Math.PI * (0.5 + quota * 0.5));
      c.closePath(); c.fill();
    }

    c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy, raggio, 0, Math.PI * 2); c.stroke();

    /* la temperatura, grande */
    c.fillStyle = "#f4f2ea";
    c.font = "600 17px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText((t > 0 ? "+" : "") + conVirgola(arrotonda(t, 1)) + " °C", cx, cy + 5);

    c.fillStyle = tenue;
    c.font = "10px system-ui, sans-serif";
    c.fillText(corpo.nome, cx, cy + raggio + 16);
    c.textAlign = "left";
    c.fillText("tutti i numeri sono watt per metro quadro", 8, altezza - 8);
  }

  /* ==========================================================
     5. Il grafico
     ========================================================== */

  function disegnaGrafico() {
    if (!ctxG || larghezzaG <= 0) return;
    var c = ctxG;
    c.clearRect(0, 0, larghezzaG, altezzaG);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaG, altezzaG);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var accento = coloreTema("--accento", "#1f5f8b");

    var sx = 48, dx = 14, su = 14, giu = 34;
    var w = larghezzaG - sx - dx, h = altezzaG - su - giu;

    var asse;
    if (graficoScelto === "albedo") {
      asse = { da: 0, a: 0.9, nome: "albedo, cioè quanta luce viene rimandata indietro", ora: albedo };
    } else if (graficoScelto === "coperte") {
      asse = { da: 0, a: 3, nome: "quante coperte, cioè quanto trattiene l'atmosfera", ora: coperte };
    } else {
      asse = { da: 100, a: 3000, nome: "luce ricevuta (watt al metro quadro)", ora: luce };
    }

    function valore(x) {
      if (graficoScelto === "albedo") return inGradi(temperaturaSuolo(luce, x, coperte));
      if (graficoScelto === "coperte") return inGradi(temperaturaSuolo(luce, albedo, x));
      return inGradi(temperaturaSuolo(x, albedo, coperte));
    }

    var vals = [];
    for (var s = 0; s <= 60; s++) vals.push(valore(asse.da + (asse.a - asse.da) * s / 60));
    var alto = Math.max.apply(null, vals) + 12;
    var basso = Math.min.apply(null, vals) - 12;

    function X(v) { return sx + w * (v - asse.da) / (asse.a - asse.da); }
    function Y(v) { return su + h * (alto - v) / (alto - basso); }

    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var k = 0; k <= 4; k++) {
      var v = basso + (alto - basso) * k / 4;
      c.beginPath(); c.moveTo(sx, Y(v)); c.lineTo(sx + w, Y(v)); c.stroke();
      c.fillText(Math.round(v) + "°", sx - 5, Y(v) + 3);
    }
    c.textAlign = "center";
    for (var j = 0; j <= 4; j++) {
      var x = asse.da + (asse.a - asse.da) * j / 4;
      c.beginPath(); c.moveTo(X(x), su); c.lineTo(X(x), su + h); c.stroke();
      c.fillText(conVirgola(arrotonda(x, asse.a <= 3 ? 2 : 0)), X(x), su + h + 14);
    }
    c.fillText(asse.nome, sx + w / 2, altezzaG - 4);

    /* la riga dello zero, cioè il gelo */
    if (basso < 0 && alto > 0) {
      c.strokeStyle = "#6fa8c9"; c.setLineDash([4, 4]); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(sx, Y(0)); c.lineTo(sx + w, Y(0)); c.stroke();
      c.setLineDash([]);
      c.fillStyle = "#6fa8c9"; c.textAlign = "left"; c.font = "9px system-ui, sans-serif";
      c.fillText("l'acqua gela", sx + 4, Y(0) - 3);
    }

    c.strokeStyle = accento; c.lineWidth = 2.8;
    c.beginPath();
    for (var i = 0; i <= 200; i++) {
      var xx = asse.da + (asse.a - asse.da) * i / 200;
      if (i === 0) c.moveTo(X(xx), Y(valore(xx))); else c.lineTo(X(xx), Y(valore(xx)));
    }
    c.stroke();

    c.beginPath();
    c.arc(X(asse.ora), Y(valore(asse.ora)), 5, 0, Math.PI * 2);
    c.fillStyle = accento; c.fill();
  }

  /* ==========================================================
     6. Le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

  function racconta() {
    var t = inGradi(tempOra());
    var senza = inGradi(tempSenza());
    var serra = effettoSerra();

    if (coperte <= 0.001) {
      return "Senza atmosfera il conto è semplice: il pianeta si scalda finché il calore che emette " +
        "pareggia la luce che assorbe, e si ferma a " + conVirgola(arrotonda(t, 1)) + " gradi. " +
        "Nient'altro. È quello che succede sulla Luna, che riceve la nostra stessa luce.";
    }

    var frase = "L'atmosfera trattiene parte del calore che il suolo emette e glielo rimanda indietro. " +
      "Per riuscire a far uscire comunque tutta l'energia che entra, il suolo deve scaldarsi di più: " +
      "da " + conVirgola(arrotonda(senza, 1)) + " gradi passa a " + conVirgola(arrotonda(t, 1)) +
      ", cioè " + conVirgola(arrotonda(serra, 1)) + " gradi in più. Questo è l'effetto serra, e " +
      "senza di lui la Terra sarebbe un deserto ghiacciato.";

    if (serra > 200) {
      frase += " Su Venere però la stessa cosa è andata fuori controllo: l'acqua è evaporata tutta, " +
        "il vapore ha trattenuto ancora più calore, e alla fine anche le rocce hanno ceduto la loro " +
        "anidride carbonica. Oggi laggiù il piombo fonderebbe.";
    } else if (t > 0 && senza < 0) {
      frase += " Nota una cosa: senza l'effetto serra qui l'acqua sarebbe ghiacciata, con l'effetto " +
        "serra è liquida. Tutta la differenza fra un pianeta vivo e una palla di ghiaccio sta in " +
        "quei gradi.";
    }
    return frase;
  }

  /* ==========================================================
     7. I comandi
     ========================================================== */

  function cursore(etichetta, min, max, passo, valore, unita, formatta, quandoCambia) {
    var riga = elemento("div", "cursore");
    var testa = elemento("div", "cursore-testa");
    testa.appendChild(elemento("span", "cursore-nome", etichetta));
    var lettura = elemento("span", "cursore-valore", formatta(valore) + " " + unita);
    testa.appendChild(lettura);
    riga.appendChild(testa);
    var input = elemento("input");
    input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(passo);
    input.value = String(valore);
    input.setAttribute("aria-label", etichetta);
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      lettura.textContent = formatta(v) + " " + unita;
      quandoCambia(v);
    });
    riga.appendChild(input);
    riga.aggiorna = function (v) {
      input.value = String(v);
      lettura.textContent = formatta(v) + " " + unita;
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

  function applicaCorpo(c) {
    corpo = c;
    luce = c.luce; albedo = c.albedo; coperte = c.coperte;
    if (cursoreL) cursoreL.aggiorna(luce);
    if (cursoreA) cursoreA.aggiorna(albedo);
    if (cursoreC) cursoreC.aggiorna(coperte);
    aggiorna();
  }

  function aggiorna() {
    letturaTemp.textContent = conVirgola(arrotonda(inGradi(tempOra()), 1)) + " °C";
    letturaSenza.textContent = conVirgola(arrotonda(inGradi(tempSenza()), 1)) + " °C";
    letturaVera.textContent = conVirgola(corpo.vera) + " °C";

    pastiglieCorpo.forEach(function (b) {
      b.className = "pillola" + (b.dato === corpo ? " attiva" : "");
    });
    pastiglieGrafico.forEach(function (b) {
      b.className = "pillola" + (b.dato === graficoScelto ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    frase.textContent = racconta();

    var scarto = inGradi(tempOra()) - corpo.vera;
    schedaCorpo.textContent = corpo.nome + ": il conto dà " +
      conVirgola(arrotonda(inGradi(tempOra()), 1)) + " gradi, la misura vera dice " +
      conVirgola(corpo.vera) + ". " +
      (Math.abs(scarto) < 2
        ? "Uno scarto di meno di due gradi, con un modello così semplice: è il motivo per cui questo " +
          "conto si studia ancora."
        : "Lo scarto è di " + conVirgola(arrotonda(Math.abs(scarto), 1)) + " gradi: il modello è " +
          "grossolano, e per corpi con giorni lunghissimi o atmosfere strane non basta.") +
      (corpo.nota ? " " + corpo.nota.charAt(0).toUpperCase() + corpo.nota.slice(1) + "." : "");

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegnaPianeta();
    disegnaGrafico();
  }

  /* ==========================================================
     8. Costruire la pagina
     ========================================================== */

  function costruisci() {
    svuota(contenitore);
    pastiglieCorpo = []; pastiglieEsp = []; pastiglieGrafico = [];

    var avvisoErrori = App.avvisoErroriFile("corpi.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Un pianeta si scalda finché il calore che emette pareggia la luce che assorbe. La temperatura " +
      "non è una sua proprietà: è il punto in cui i conti tornano. Cambia una sola delle cose in " +
      "gioco, e quel punto si sposta."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Esperimenti da provare"));
    var griglia = elemento("div", "griglia-esperimenti");
    ESPERIMENTI.forEach(function (x, i) {
      var b = elemento("button", "carta-esperimento");
      b.type = "button";
      b.appendChild(elemento("div", "esperimento-titolo", x.titolo));
      b.appendChild(elemento("div", "esperimento-sottotitolo", x.sottotitolo));
      b.addEventListener("click", function () {
        esperimentoScelto = i;
        var c = corpi.filter(function (y) { return y.nome === x.corpo; })[0];
        if (c) applicaCorpo(c);
      });
      pastiglieEsp.push(b);
      griglia.appendChild(b);
    });
    contenitore.appendChild(griglia);

    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("il conto dà", function (n) { letturaTemp = n; }));
    letture.appendChild(unaLettura("senza atmosfera sarebbe", function (n) { letturaSenza = n; }));
    letture.appendChild(unaLettura("misurata davvero", function (n) { letturaVera = n; }));
    contenitore.appendChild(letture);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    /* --- il grafico --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Il grafico"));
    var scelteG = elemento("div", "scelte-grandezza");
    [["albedo", "al variare dell'albedo"], ["coperte", "al variare dell'effetto serra"],
     ["luce", "al variare della distanza dal Sole"]].forEach(function (g) {
      var b = elemento("button", "pillola", g[1]);
      b.type = "button"; b.dato = g[0];
      b.addEventListener("click", function () { graficoScelto = g[0]; aggiorna(); });
      pastiglieGrafico.push(b);
      scelteG.appendChild(b);
    });
    contenitore.appendChild(scelteG);

    var scatolaG = elemento("div", "scatola-grafico");
    telaG = elemento("canvas", "tela");
    scatolaG.appendChild(telaG);
    contenitore.appendChild(scatolaG);

    /* --- le manopole --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le manopole"));
    var comandi = elemento("div", "comandi");
    cursoreL = cursore("Luce ricevuta", 20, 3000, 10, luce, "W/m²",
      function (v) { return String(Math.round(v)); }, function (v) {
        luce = v; esperimentoScelto = -1; aggiorna();
      });
    cursoreA = cursore("Albedo", 0, 0.9, 0.01, albedo, "",
      function (v) { return conVirgola(arrotonda(v, 2)); }, function (v) {
        albedo = v; esperimentoScelto = -1; aggiorna();
      });
    cursoreC = cursore("Quante coperte", 0, 5, 0.01, Math.min(5, coperte), "",
      function (v) { return conVirgola(arrotonda(v, 2)); }, function (v) {
        coperte = v; esperimentoScelto = -1; aggiorna();
      });
    comandi.appendChild(cursoreL);
    comandi.appendChild(cursoreA);
    comandi.appendChild(cursoreC);
    contenitore.appendChild(comandi);

    contenitore.appendChild(elemento("p", "nota-piccola",
      "Con l'albedo si vede il circolo del ghiaccio: alzalo, la temperatura scende, e nella realtà " +
      "il freddo formerebbe altro ghiaccio, che alzerebbe ancora l'albedo. È un meccanismo che si " +
      "rinforza da solo, e per questo le glaciazioni arrivano e se ne vanno in fretta."));

    /* --- i corpi --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quale corpo celeste"));
    var scelte = elemento("div", "scelte-grandezza");
    corpi.forEach(function (cc) {
      var b = elemento("button", "pillola", cc.nome);
      b.type = "button"; b.dato = cc;
      b.addEventListener("click", function () { esperimentoScelto = -1; applicaCorpo(cc); });
      pastiglieCorpo.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);
    schedaCorpo = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaCorpo);

    /* --- i limiti --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpoL = elemento("div", "limiti-corpo");
    [
      "Tutto il pianeta ha una temperatura sola. Nella realtà l'equatore e i poli, il giorno e la notte, sono mondi diversi: sulla Luna si passa da 120 gradi a meno 170 nello stesso posto.",
      "L'atmosfera è trattata come un certo numero di coperte che rimandano indietro il calore. È il modello più semplice che dia i numeri giusti, ma non distingue l'anidride carbonica dal vapore acqueo, e non tiene conto di quanto le nuvole complichino le cose: schermano la luce e trattengono il calore, tutte e due insieme.",
      "L'albedo è un numero fisso che si regola a mano. Nella realtà dipende dalla temperatura stessa - ghiaccio, nuvole, vegetazione - e questo crea proprio quei circoli che si rinforzano da soli.",
      "Non c'è il tempo: il pianeta è sempre all'equilibrio. Gli oceani veri ci mettono decenni a scaldarsi, ed è il motivo per cui il clima risponde alle nostre emissioni con molto ritardo.",
      "Non c'è calore che venga da dentro il pianeta. Per la Terra è trascurabile, per Giove no: lui ne emette più di quanto ne riceva dal Sole.",
      "I numeri dei corpi celesti sono valori medi da manuale. Il valore delle «coperte» in particolare non si misura: è ricavato all'indietro dalla temperatura vera, quindi per quei corpi il confronto fra conto e misura non è una verifica indipendente. Lo è invece quando si cambiano le manopole a mano."
    ].forEach(function (t) { corpoL.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpoL);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(300, Math.max(220, larghezza * 0.5)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaG = telaG.parentNode.clientWidth;
    altezzaG = Math.round(Math.min(280, Math.max(200, larghezzaG * 0.52)));
    telaG.width = larghezzaG * dpr; telaG.height = altezzaG * dpr;
    telaG.style.width = larghezzaG + "px"; telaG.style.height = altezzaG + "px";
    ctxG = telaG.getContext("2d");
    ctxG.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegnaPianeta(); disegnaGrafico();
  });

  /* ==========================================================
     9. Avvio
     ========================================================== */

  App.caricaTesto("corpi.txt")
    .then(function (testo) {
      var esito = leggiCorpi(testo);
      corpi = esito.elenco;
      erroriFile = esito.errori;

      if (!corpi.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file corpi.txt è stato letto ma non contiene corpi validi."));
        contenitore.appendChild(avviso);
        return;
      }

      corpo = corpi[0];
      luce = corpo.luce; albedo = corpo.albedo; coperte = corpo.coperte;
      costruisci();
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("corpi.txt", errore.message));
    });

})();
