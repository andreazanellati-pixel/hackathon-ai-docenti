/* ============================================================
   Mitosi e meiosi a confronto
   ------------------------------------------------------------
   Si scorre fase per fase e si guarda che cosa succede ai
   cromosomi. Accanto, il grafico della quantita' di DNA, che e'
   la cosa che confonde di piu': il DNA raddoppia in un momento e
   il numero di cromosomi cambia in un altro.

   Come funziona, in due parole:
   - le fasi, coi loro numeri e le loro descrizioni, stanno in
     fasi.txt: si possono riscrivere senza toccare il codice
   - i cromosomi sono disegnati davvero, uno per uno, coi colori
     del padre e della madre: cosi' nell'anafase I si vede che a
     separarsi sono gli omologhi interi, e nell'anafase della
     mitosi che sono i cromatidi
   - il crossing over scambia pezzi veri fra gli omologhi, e i
     quattro gameti finali risultano diversi uno dall'altro
   - il conto delle combinazioni possibili, 2 elevato al numero
     di coppie, e' scritto accanto: con 23 coppie fa piu' di otto
     milioni, e questo prima ancora del crossing over
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var PADRE = "#4c8fbd";
  var MADRE = "#d9a441";

  /* ---------- stato ---------- */

  var fasi = [], erroriFile = [];
  var processo = "mitosi";
  var indice = 0;
  var coppie = 2;           /* quante coppie di omologhi */
  var crossingOver = true;
  var inMoto = false;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaG = null, ctxG = null, larghezzaG = 0, altezzaG = 0;
  var letturaCromosomi = null, letturaDna = null, letturaCellule = null;
  var pastiglieProcesso = [], pastiglieFase = [];
  var titoloFase = null, testoFase = null, bottoneMoto = null;
  var cursoreCoppie = null, notaVarieta = null;

  /* i pezzi di cromosoma, ricalcolati quando si cambia qualcosa */
  var scambi = [];          /* per ogni coppia: dove avviene il crossing over */

  /* ==========================================================
     1. Leggere il file di contenuto
     ========================================================== */

  var DISEGNI = ["interfase", "duplicati", "appaiati", "equatore", "equatore-coppie",
    "separa-cromatidi", "separa-omologhi", "due-cellule", "due-equatore",
    "due-separa", "quattro-cellule"];

  function leggiFasi(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 7) {
        errori.push("riga " + (i + 1) + ": servono sette parti separate da | .");
        return;
      }
      var proc = p[0].trim().toLowerCase();
      if (proc !== "mitosi" && proc !== "meiosi") {
        errori.push("riga " + (i + 1) + ": il processo deve essere «mitosi» oppure «meiosi».");
        return;
      }
      var disegno = p[2].trim().toLowerCase();
      if (DISEGNI.indexOf(disegno) < 0) {
        errori.push("riga " + (i + 1) + ": «" + disegno + "» non e' un disegno che conosco. " +
          "Quelli buoni sono: " + DISEGNI.join(", ") + ".");
        return;
      }
      var dna = parseFloat(p[4].trim().replace(",", "."));
      var cellule = parseInt(p[5].trim(), 10);
      if (isNaN(dna) || isNaN(cellule) || cellule < 1) {
        errori.push("riga " + (i + 1) + ": il DNA e il numero di cellule devono essere numeri.");
        return;
      }
      elenco.push({
        processo: proc,
        nome: p[1].trim(),
        disegno: disegno,
        cromosomi: p[3].trim(),
        dna: dna,
        cellule: cellule,
        descrizione: p[6].trim()
      });
    });
    return { elenco: elenco, errori: errori };
  }

  function faseAttuali() {
    return fasi.filter(function (f) { return f.processo === processo; });
  }

  function fase() {
    var e = faseAttuali();
    return e[Math.min(indice, e.length - 1)];
  }

  /* ==========================================================
     2. I cromosomi
     ========================================================== */

  /* Dove avviene il crossing over su ogni coppia: una frazione
     lungo il braccio, estratta a caso. */
  function rimescola() {
    scambi = [];
    for (var i = 0; i < coppie; i++) {
      scambi.push({
        punto: 0.35 + Math.random() * 0.4,
        avviene: crossingOver && Math.random() < 0.85,
        /* da che parte finisce il cromosoma del padre in metafase I */
        versoDestra: Math.random() < 0.5
      });
    }
  }

  function combinazioni() {
    return Math.pow(2, coppie);
  }

  /* ==========================================================
     3. Disegnare
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  /* Disegna un cromosoma: un bastoncino, o due se e' duplicato.
     I colori dicono da chi viene ogni pezzo, cosi' il crossing
     over si vede. */
  function cromosoma(c, x, y, altezzaC, duplicato, colore, scambio, quale) {
    var largo = Math.max(5, altezzaC * 0.16);
    var stacco = duplicato ? largo * 0.85 : 0;

    for (var lato = 0; lato < (duplicato ? 2 : 1); lato++) {
      var xc = x + (duplicato ? (lato === 0 ? -stacco : stacco) : 0);

      /* il cromatide che ha subito lo scambio e' meta' e meta' */
      var scambiato = scambio && scambio.avviene && lato === (quale === "padre" ? 1 : 0);
      var punto = scambio ? scambio.punto : 0.5;

      c.fillStyle = colore;
      if (!scambiato) {
        c.fillRect(xc - largo / 2, y - altezzaC / 2, largo, altezzaC);
      } else {
        var taglio = y - altezzaC / 2 + altezzaC * punto;
        c.fillRect(xc - largo / 2, y - altezzaC / 2, largo, altezzaC * punto);
        c.fillStyle = colore === PADRE ? MADRE : PADRE;
        c.fillRect(xc - largo / 2, taglio, largo, altezzaC * (1 - punto));
      }

      /* il centromero, la strozzatura */
      c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
      c.fillRect(xc - largo / 2, y - largo * 0.22, largo, largo * 0.44);
    }

    if (duplicato) {
      /* il filo che tiene insieme i due cromatidi */
      c.strokeStyle = coloreTema("--testo-tenue", "#6b645a");
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x - stacco, y); c.lineTo(x + stacco, y);
      c.stroke();
    }
  }

  function disegnaCellula(c, cx, cy, raggioX, raggioY, contenuto) {
    c.fillStyle = "rgba(160, 195, 175, 0.16)";
    c.beginPath();
    c.ellipse(cx, cy, raggioX, raggioY, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = coloreTema("--bordo", "#ddd6c9");
    c.lineWidth = 2.5;
    c.stroke();
    if (contenuto) contenuto();
  }

  function disegna() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezza, altezza);

    var f = fase();
    if (!f) return;

    var d = f.disegno;
    var cx = larghezza / 2, cy = altezza / 2;
    var altC = Math.min(44, altezza * 0.17);
    var passo = Math.min(34, larghezza / (coppie * 2 + 3));

    /* --- una cellula sola --- */
    if (["interfase", "duplicati", "appaiati", "equatore", "equatore-coppie",
      "separa-cromatidi", "separa-omologhi"].indexOf(d) >= 0) {

      disegnaCellula(c, cx, cy, Math.min(larghezza * 0.42, 190), Math.min(altezza * 0.4, 110), function () {
        if (d === "interfase") {
          /* filamenti sottili sparsi */
          for (var i = 0; i < coppie; i++) {
            [PADRE, MADRE].forEach(function (col, k) {
              c.strokeStyle = col; c.lineWidth = 2;
              c.beginPath();
              var x0 = cx - passo * coppie + passo * (i * 2 + k) + passo * 0.5;
              c.moveTo(x0 - 10, cy - 22);
              c.bezierCurveTo(x0 + 14, cy - 8, x0 - 14, cy + 8, x0 + 10, cy + 22);
              c.stroke();
            });
          }
          return;
        }

        if (d === "duplicati") {
          for (var j = 0; j < coppie; j++) {
            var xp = cx - passo * coppie + passo * (j * 2) + passo * 0.7;
            var sfasa = (j % 2 === 0) ? -16 : 16;
            cromosoma(c, xp, cy + sfasa, altC, true, PADRE, null, "padre");
            cromosoma(c, xp + passo, cy - sfasa, altC, true, MADRE, null, "madre");
          }
          return;
        }

        if (d === "appaiati") {
          for (var a = 0; a < coppie; a++) {
            var xa = cx - passo * coppie + passo * (a * 2) + passo;
            cromosoma(c, xa - passo * 0.42, cy, altC, true, PADRE, scambi[a], "padre");
            cromosoma(c, xa + passo * 0.42, cy, altC, true, MADRE, scambi[a], "madre");
            /* il punto in cui si toccano */
            if (scambi[a] && scambi[a].avviene) {
              c.strokeStyle = "#c06a28"; c.lineWidth = 2;
              var yS = cy - altC / 2 + altC * scambi[a].punto;
              c.beginPath();
              c.moveTo(xa - passo * 0.42, yS); c.lineTo(xa + passo * 0.42, yS);
              c.stroke();
            }
          }
          return;
        }

        if (d === "equatore") {
          /* tutti in fila, singoli */
          var tutti = coppie * 2;
          for (var e = 0; e < tutti; e++) {
            var xe = cx - passo * (tutti - 1) / 2 + passo * e;
            cromosoma(c, xe, cy, altC, true, e % 2 === 0 ? PADRE : MADRE, null, "padre");
          }
          linea(c, cx, cy, altC);
          return;
        }

        if (d === "equatore-coppie") {
          /* le coppie sulla linea, una sopra e una sotto */
          for (var g = 0; g < coppie; g++) {
            var xg = cx - passo * (coppie - 1) + passo * g * 2;
            var pSopra = scambi[g] && scambi[g].versoDestra;
            cromosoma(c, xg, cy - altC * 0.62, altC, true,
              pSopra ? PADRE : MADRE, scambi[g], pSopra ? "padre" : "madre");
            cromosoma(c, xg, cy + altC * 0.62, altC, true,
              pSopra ? MADRE : PADRE, scambi[g], pSopra ? "madre" : "padre");
          }
          linea(c, cx, cy, altC * 2);
          return;
        }

        if (d === "separa-cromatidi" || d === "separa-omologhi") {
          var quanti = d === "separa-cromatidi" ? coppie * 2 : coppie;
          var doppio = (d === "separa-omologhi");
          for (var s = 0; s < quanti; s++) {
            var ys = cy - altC * 0.8 + (quanti > 1 ? altC * 1.6 * s / (quanti - 1) : 0);
            var colS = d === "separa-cromatidi"
              ? (s % 2 === 0 ? PADRE : MADRE)
              : (scambi[s] && scambi[s].versoDestra ? PADRE : MADRE);
            var colD = d === "separa-cromatidi"
              ? (s % 2 === 0 ? PADRE : MADRE)
              : (scambi[s] && scambi[s].versoDestra ? MADRE : PADRE);
            cromosoma(c, cx - larghezza * 0.2, ys, altC * 0.8, doppio, colS,
              doppio ? scambi[s] : null, "padre");
            cromosoma(c, cx + larghezza * 0.2, ys, altC * 0.8, doppio, colD,
              doppio ? scambi[s] : null, "madre");
          }
          /* le frecce che tirano */
          freccia(c, cx - 26, cy, cx - larghezza * 0.3, cy);
          freccia(c, cx + 26, cy, cx + larghezza * 0.3, cy);
          return;
        }
      });
      return;
    }

    /* --- due cellule --- */
    if (["due-cellule", "due-equatore", "due-separa"].indexOf(d) >= 0) {
      [-1, 1].forEach(function (lato, idx) {
        var xc = cx + lato * larghezza * 0.24;
        disegnaCellula(c, xc, cy, Math.min(larghezza * 0.21, 110), Math.min(altezza * 0.36, 96), function () {
          var quanti = processo === "meiosi" ? coppie : coppie * 2;
          var duplicato = (processo === "meiosi");
          for (var i = 0; i < quanti; i++) {
            var col = processo === "meiosi"
              ? (scambi[i] && scambi[i].versoDestra === (lato > 0) ? PADRE : MADRE)
              : (i % 2 === 0 ? PADRE : MADRE);
            if (d === "due-separa") {
              var yy = cy - altC * 0.5 + (quanti > 1 ? altC * 1.0 * i / (quanti - 1) : 0);
              cromosoma(c, xc - 26, yy, altC * 0.7, false, col, null, "padre");
              cromosoma(c, xc + 26, yy, altC * 0.7, false, col, null, "padre");
            } else if (d === "due-equatore") {
              var xe = xc - 16 * (quanti - 1) / 2 + 16 * i;
              cromosoma(c, xe, cy, altC * 0.8, duplicato, col, null, "padre");
              linea(c, xc, cy, altC);
            } else {
              var xd = xc - 18 * (quanti - 1) / 2 + 18 * i;
              cromosoma(c, xd, cy, altC * 0.8, duplicato, col,
                duplicato ? scambi[i] : null, "padre");
            }
          }
        });
      });
      return;
    }

    /* --- quattro cellule --- */
    if (d === "quattro-cellule") {
      for (var q = 0; q < 4; q++) {
        var xq = larghezza * (0.14 + 0.24 * q);
        disegnaCellula(c, xq, cy, Math.min(larghezza * 0.105, 60), Math.min(altezza * 0.3, 74), function () {
          for (var i = 0; i < coppie; i++) {
            /* ogni gamete prende una combinazione diversa */
            var daPadre = ((q >> i) & 1) === (scambi[i] && scambi[i].versoDestra ? 1 : 0);
            var col = daPadre ? PADRE : MADRE;
            var xg = xq - 13 * (coppie - 1) / 2 + 13 * i;
            cromosoma(c, xg, cy, altC * 0.62, false, col,
              (q % 2 === 1) ? scambi[i] : null, "padre");
          }
        });
        ctx.fillStyle = coloreTema("--testo-tenue", "#6b645a");
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("gamete " + (q + 1), xq, altezza - 8);
      }
      return;
    }
  }

  function linea(c, cx, cy, mezzaAltezza) {
    c.strokeStyle = coloreTema("--testo-tenue", "#6b645a");
    c.setLineDash([4, 4]); c.lineWidth = 1;
    c.beginPath();
    c.moveTo(cx - larghezza * 0.34, cy); c.lineTo(cx + larghezza * 0.34, cy);
    c.stroke();
    c.setLineDash([]);
  }

  function freccia(c, x1, y1, x2, y2) {
    c.strokeStyle = coloreTema("--testo-tenue", "#6b645a");
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    var verso = x2 > x1 ? 1 : -1;
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - 6 * verso, y2 - 4);
    c.lineTo(x2 - 6 * verso, y2 + 4);
    c.closePath();
    c.fillStyle = coloreTema("--testo-tenue", "#6b645a");
    c.fill();
  }

  /* ==========================================================
     4. Il grafico del DNA
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

    var elenco = faseAttuali();
    if (!elenco.length) return;

    var sx = 34, dx = 10, su = 14, giu = 36;
    var w = larghezzaG - sx - dx, h = altezzaG - su - giu;

    function X(i) { return sx + w * i / Math.max(1, elenco.length - 1); }
    function Y(v) { return su + h * (1 - v / 4.4); }

    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    [0, 1, 2, 3, 4].forEach(function (v) {
      c.beginPath(); c.moveTo(sx, Y(v)); c.lineTo(sx + w, Y(v)); c.stroke();
      c.fillText(v + "C", sx - 4, Y(v) + 3);
    });

    /* la linea del DNA per cellula */
    c.strokeStyle = accento; c.lineWidth = 2.5;
    c.beginPath();
    elenco.forEach(function (f, i) {
      if (i === 0) c.moveTo(X(i), Y(f.dna)); else c.lineTo(X(i), Y(f.dna));
    });
    c.stroke();

    /* dove siamo adesso */
    var f = fase();
    var qui = elenco.indexOf(f);
    c.beginPath();
    c.arc(X(qui), Y(f.dna), 5, 0, Math.PI * 2);
    c.fillStyle = accento; c.fill();

    c.strokeStyle = tenue; c.setLineDash([3, 3]); c.lineWidth = 1;
    c.beginPath(); c.moveTo(X(qui), su); c.lineTo(X(qui), su + h); c.stroke();
    c.setLineDash([]);

    c.fillStyle = tenue; c.font = "9px system-ui, sans-serif";
    c.textAlign = "center";
    elenco.forEach(function (f2, i) {
      c.save();
      c.translate(X(i), su + h + 6);
      c.rotate(Math.PI / 5);
      c.textAlign = "left";
      c.fillText(f2.nome.split(" ")[0], 0, 0);
      c.restore();
    });
    c.textAlign = "left";
    c.fillText("DNA in ogni cellula", sx, 10);
  }

  /* ==========================================================
     5. La pagina
     ========================================================== */

  function unaLettura(nome, registra) {
    var box = elemento("div", "lettura");
    var v = elemento("div", "lettura-valore", "—");
    box.appendChild(v);
    box.appendChild(elemento("div", "lettura-nome", nome));
    registra(v);
    return box;
  }

  function cursore(etichetta, min, max, passo, valore, unita, quandoCambia) {
    var riga = elemento("div", "cursore");
    var testa = elemento("div", "cursore-testa");
    testa.appendChild(elemento("span", "cursore-nome", etichetta));
    var lettura = elemento("span", "cursore-valore", valore + " " + unita);
    testa.appendChild(lettura);
    riga.appendChild(testa);
    var input = elemento("input");
    input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(passo);
    input.value = String(valore);
    input.setAttribute("aria-label", etichetta);
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      lettura.textContent = v + " " + unita;
      quandoCambia(v);
    });
    riga.appendChild(input);
    return riga;
  }

  function vai(quanto) {
    var elenco = faseAttuali();
    indice = Math.max(0, Math.min(elenco.length - 1, indice + quanto));
    aggiorna();
  }

  function aggiorna() {
    var f = fase();
    if (!f) return;
    var elenco = faseAttuali();

    letturaCromosomi.textContent = f.cromosomi === "2n"
      ? "2n = " + (coppie * 2) : "n = " + coppie;
    letturaDna.textContent = f.dna + "C";
    letturaCellule.textContent = String(f.cellule);

    titoloFase.textContent = f.nome;
    testoFase.textContent = f.descrizione;

    pastiglieProcesso.forEach(function (b) {
      b.className = "pillola" + (b.dato === processo ? " attiva" : "");
    });
    pastiglieFase.forEach(function (b, i) {
      b.className = "pillola" + (i === indice ? " attiva" : "");
    });

    bottoneMoto.textContent = inMoto ? "Ferma" : "Fai scorrere";

    notaVarieta.textContent = processo === "meiosi"
      ? "Con " + coppie + " copp" + (coppie === 1 ? "ia" : "ie") + " di omologhi, il solo modo in cui " +
        "si dispongono in metafase I produce " + combinazioni() + " gameti diversi. Nella specie umana " +
        "le coppie sono 23, e fanno 8.388.608 combinazioni: e questo prima ancora di contare il " +
        "crossing over, che le rende praticamente infinite."
      : "La mitosi non produce varieta': le due cellule figlie hanno gli stessi identici geni della " +
        "madre. E' quello che serve per crescere e riparare, dove una copia sbagliata sarebbe un guaio.";

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegna();
    disegnaGrafico();
  }

  var ultimo = 0, attesa = 0;
  function battito(ora) {
    var dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0;
    ultimo = ora;
    if (inMoto) {
      attesa += dt;
      if (attesa > 2.2) {
        attesa = 0;
        var elenco = faseAttuali();
        if (indice >= elenco.length - 1) { inMoto = false; }
        else indice++;
        aggiorna();
      }
    }
    requestAnimationFrame(battito);
  }

  function costruisci() {
    svuota(contenitore);
    pastiglieProcesso = []; pastiglieFase = [];

    var avvisoErrori = App.avvisoErroriFile("fasi.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Le due divisioni partono uguali e finiscono in modo opposto: la mitosi fa due copie identiche, " +
      "la meiosi quattro cellule tutte diverse e con meta' del corredo. La differenza sta tutta in un " +
      "passaggio, l'anafase I, e in una cosa che la mitosi non fa mai: appaiare gli omologhi."));

    /* --- quale processo --- */
    var scelta = elemento("div", "scelte-grandezza");
    [["mitosi", "Mitosi · due copie identiche"], ["meiosi", "Meiosi · quattro gameti diversi"]]
      .forEach(function (m) {
        var b = elemento("button", "pillola", m[1]);
        b.type = "button"; b.dato = m[0];
        b.addEventListener("click", function () {
          processo = m[0]; indice = 0; inMoto = false;
          costruisci();
        });
        pastiglieProcesso.push(b);
        scelta.appendChild(b);
      });
    contenitore.appendChild(scelta);

    /* --- la scena --- */
    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    contenitore.appendChild(elemento("p", "didascalia",
      "Azzurro i cromosomi che vengono dal padre, arancione quelli che vengono dalla madre. " +
      "Un cromosoma mezzo azzurro e mezzo arancione ha subito il crossing over."));

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("cromosomi per cellula", function (n) { letturaCromosomi = n; }));
    letture.appendChild(unaLettura("DNA per cellula", function (n) { letturaDna = n; }));
    letture.appendChild(unaLettura("quante cellule", function (n) { letturaCellule = n; }));
    contenitore.appendChild(letture);

    /* --- i comandi di scorrimento --- */
    var bottoni = elemento("div", "bottoni");
    var indietro = elemento("button", "bottone-testo", "← Indietro");
    indietro.type = "button";
    indietro.addEventListener("click", function () { inMoto = false; vai(-1); });
    bottoni.appendChild(indietro);

    bottoneMoto = elemento("button", "bottone", "Fai scorrere");
    bottoneMoto.type = "button";
    bottoneMoto.addEventListener("click", function () {
      if (!inMoto && indice >= faseAttuali().length - 1) indice = 0;
      inMoto = !inMoto; attesa = 0; aggiorna();
    });
    bottoni.appendChild(bottoneMoto);

    var avanti = elemento("button", "bottone-testo", "Avanti →");
    avanti.type = "button";
    avanti.addEventListener("click", function () { inMoto = false; vai(1); });
    bottoni.appendChild(avanti);
    contenitore.appendChild(bottoni);

    var riquadro = elemento("div", "riquadro-fase");
    titoloFase = elemento("h3", "titolo-blocco", "");
    testoFase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(titoloFase);
    riquadro.appendChild(testoFase);
    contenitore.appendChild(riquadro);

    /* --- l'elenco delle fasi --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le fasi, una per una"));
    var elenco = elemento("div", "scelte-grandezza");
    faseAttuali().forEach(function (f, i) {
      var b = elemento("button", "pillola", f.nome);
      b.type = "button";
      b.addEventListener("click", function () { inMoto = false; indice = i; aggiorna(); });
      pastiglieFase.push(b);
      elenco.appendChild(b);
    });
    contenitore.appendChild(elenco);

    /* --- il grafico --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quanto DNA c'e' in ogni cellula"));
    var scatolaG = elemento("div", "scatola-grafico");
    telaG = elemento("canvas", "tela");
    scatolaG.appendChild(telaG);
    contenitore.appendChild(scatolaG);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Questo grafico e' la cosa che alle verifiche fa piu' danni, perche' il DNA e il numero di " +
      "cromosomi non cambiano nello stesso momento. Il DNA raddoppia nella fase S, molto prima che " +
      "la cellula si divida; il numero di cromosomi resta fermo fino all'anafase. Guarda il grafico " +
      "e la lettura dei cromosomi insieme, fase per fase."));

    /* --- le manopole --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le manopole"));
    var comandi = elemento("div", "comandi");
    cursoreCoppie = cursore("Coppie di omologhi", 1, 4, 1, coppie, "", function (v) {
      coppie = v; rimescola(); aggiorna();
    });
    comandi.appendChild(cursoreCoppie);
    contenitore.appendChild(comandi);

    var rigaC = elemento("div", "bottoni");
    var bCross = elemento("button", "bottone-testo",
      crossingOver ? "Togli il crossing over" : "Rimetti il crossing over");
    bCross.type = "button";
    bCross.addEventListener("click", function () {
      crossingOver = !crossingOver;
      bCross.textContent = crossingOver ? "Togli il crossing over" : "Rimetti il crossing over";
      rimescola(); aggiorna();
    });
    rigaC.appendChild(bCross);
    var bRime = elemento("button", "bottone-testo", "Rimescola");
    bRime.type = "button";
    bRime.addEventListener("click", function () { rimescola(); aggiorna(); });
    rigaC.appendChild(bRime);
    contenitore.appendChild(rigaC);

    notaVarieta = elemento("p", "nota-piccola", "");
    contenitore.appendChild(notaVarieta);

    /* --- i limiti --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Le fasi sono disegnate come quadri fermi, una dopo l'altra. Nella cellula vera il passaggio e' continuo, e i confini fra una fase e l'altra sono decisi da noi per comodita' di studio.",
      "Ci sono al massimo quattro coppie di omologhi, per poterli vedere. Le cellule umane ne hanno ventitre, il cane trentanove, la felce anche parecchie centinaia.",
      "Il crossing over qui avviene in un punto solo per coppia. Nella realta' ne avvengono in media due o tre per coppia, e non in punti a caso: certe zone del cromosoma si scambiano molto piu' spesso di altre.",
      "Non si vedono il fuso, i centrioli e la membrana nucleare che si sfalda e si riforma: il disegno mostra solo i cromosomi, che sono la cosa che conta per capire i numeri.",
      "La meiosi e' disegnata come se andasse sempre bene. A volte non va: se due omologhi non si separano nasce un gamete con un cromosoma in piu' o in meno, ed e' l'origine di diverse sindromi.",
      "Nella femmina umana la meiosi non produce quattro gameti uguali per importanza: uno solo diventa cellula uovo, gli altri tre si riducono a corpuscoli polari e si perdono."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(300, Math.max(210, larghezza * 0.52)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaG = telaG.parentNode.clientWidth;
    altezzaG = 230;
    telaG.width = larghezzaG * dpr; telaG.height = altezzaG * dpr;
    telaG.style.width = larghezzaG + "px"; telaG.style.height = altezzaG + "px";
    ctxG = telaG.getContext("2d");
    ctxG.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegna(); disegnaGrafico();
  });

  /* ==========================================================
     6. Avvio
     ========================================================== */

  App.caricaTesto("fasi.txt")
    .then(function (testo) {
      var esito = leggiFasi(testo);
      fasi = esito.elenco;
      erroriFile = esito.errori;

      if (!fasi.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file fasi.txt e' stato letto ma non contiene fasi valide."));
        contenitore.appendChild(avviso);
        return;
      }

      rimescola();
      costruisci();
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("fasi.txt", errore.message));
    });

})();
