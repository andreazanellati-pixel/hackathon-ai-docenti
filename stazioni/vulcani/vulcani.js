/* ============================================================
   Dal magma al vulcano
   ------------------------------------------------------------
   Perche' certi vulcani colano tranquilli per anni e altri
   saltano per aria in un pomeriggio. Non dipende da quanto sono
   grandi: dipende dal magma che hanno dentro.

   Come funziona, in due parole:
   - la vischiosita' e' calcolata dalla percentuale di silice e
     dalla temperatura. La formula e' una approssimazione tarata
     sui valori da manuale, e lo dice fra i limiti
   - il tipo di eruzione non e' una scelta a tavolino: esce dal
     confronto fra quanto il gas spinge e quanto il magma lo
     trattiene. E' l'incontro fra le due cose a decidere
   - la forma del vulcano e' disegnata di conseguenza: lo scudo
     largo e basso dove la lava cola, il cono ripido dove si
     alternano lava e ceneri, la caldera dove la montagna e'
     saltata via
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  /* ---------- stato ---------- */

  var magmi = [], erroriFile = [];
  var magma = null;
  var silice = 50, temperatura = 1200, gas = 0.5;
  var esperimentoScelto = 0;
  var fase = 0;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaG = null, ctxG = null, larghezzaG = 0, altezzaG = 0;
  var letturaVisco = null, letturaTipo = null, letturaAltezza = null;
  var pastiglieMagma = [], pastiglieEsp = [];
  var frase = null, schedaMagma = null;
  var cursoreS = null, cursoreT = null, cursoreG = null;

  /* ==========================================================
     1. Gli esperimenti gia' pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "Una lava che cola",
      sottotitolo: "Il Kilauea: fluido, poco gas, nessuna esplosione",
      magma: "Basaltico"
    },
    {
      titolo: "Le fontane dell'Etna",
      sottotitolo: "Stesso magma fluido, ma con cinque volte piu' gas",
      magma: "Basaltico ricco di gas"
    },
    {
      titolo: "Il Vesuvio",
      sottotitolo: "Magma denso e pieno d'acqua: qui si comincia a fare sul serio",
      magma: "Andesitico"
    },
    {
      titolo: "Quando salta la montagna",
      sottotitolo: "Yellowstone: cosi' denso che il gas non riesce proprio a uscire",
      magma: "Riolitico"
    },
    {
      titolo: "Lo stesso magma, ma freddo",
      sottotitolo: "Prendi il basalto e raffreddalo di trecento gradi",
      magma: "Basaltico", temperatura: 900
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiMagmi(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 5) {
        errori.push("riga " + (i + 1) + ": servono almeno cinque parti separate da | .");
        return;
      }
      var s = numero(p[1]), t = numero(p[2]), g = numero(p[3]);
      if (s === null || t === null || g === null) {
        errori.push("riga " + (i + 1) + ": silice, temperatura e gas devono essere numeri.");
        return;
      }
      if (s < 30 || s > 85) {
        errori.push("riga " + (i + 1) + ": la silice deve stare fra 30 e 85 per cento.");
        return;
      }
      if (t < 500 || t > 1500) {
        errori.push("riga " + (i + 1) + ": la temperatura deve stare fra 500 e 1500 gradi.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        silice: s, temperatura: t, gas: g,
        esempio: p[4].trim(),
        nota: p.length > 5 ? p[5].trim() : ""
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. Il modello
     ========================================================== */

  /* Quanto il magma e' denso e appiccicoso. Si scrive come
     potenza di dieci perche' fra un magma e l'altro cambia di
     miliardi di volte: fra il basalto fluido e la riolite
     fredda ci sono otto zeri di differenza. */
  function logVischiosita() {
    return 0.5 + 0.22 * (silice - 45) + 0.006 * (1200 - temperatura);
  }

  function vischiosita() {
    return Math.pow(10, logVischiosita());
  }

  /* Quanto il gas riesce a scappare. In un magma fluido esce
     quasi tutto; in uno denso resta intrappolato. */
  function gasChiuso() {
    var lv = logVischiosita();
    return Math.max(0, Math.min(1, (lv - 1) / 6));
  }

  /* La spinta dell'esplosione: il gas che c'e' per la parte di
     gas che non riesce a uscire. Una cosa sola delle due non
     basta mai. */
  function forza() {
    return gas * gasChiuso();
  }

  function tipoEruzione() {
    var f = forza();
    if (f < 0.12) return "effusiva";
    if (f < 0.9) return "stromboliana";
    if (f < 2.2) return "vulcaniana";
    if (f < 5.2) return "pliniana";
    return "catastrofica";
  }

  /* Che forma prende la montagna, dopo tante eruzioni come
     questa. */
  function forma() {
    var t = tipoEruzione();
    if (t === "effusiva") return "scudo";
    if (t === "catastrofica") return "caldera";
    return "cono";
  }

  /* Quanto in alto arriva la colonna di cenere. */
  function altezzaColonna() {
    var f = forza();
    if (f < 0.12) return 0;
    return Math.min(45, Math.pow(f, 0.8) * 11);
  }

  /* Quanto lontano cola la lava, se cola. */
  function quantoCola() {
    var lv = logVischiosita();
    if (lv > 6) return 0;
    return Math.max(0, 30 * Math.pow(10, -(lv - 1.5) / 2.2));
  }

  /* ==========================================================
     4. Il disegno del vulcano
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegna() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);

    var f = forza();
    var cielo = Math.min(1, f / 4);
    c.fillStyle = "rgb(" + Math.round(206 - cielo * 90) + "," + Math.round(226 - cielo * 100) +
      "," + Math.round(238 - cielo * 110) + ")";
    c.fillRect(0, 0, larghezza, altezza);

    var cx = larghezza / 2;
    var suolo = altezza * 0.82;
    var tipo = forma();

    /* la montagna */
    c.fillStyle = "#6b5a48";
    c.beginPath();
    if (tipo === "scudo") {
      /* larga e bassissima */
      c.moveTo(0, suolo);
      c.bezierCurveTo(cx * 0.6, suolo - altezza * 0.1, cx * 0.9, suolo - altezza * 0.15,
        cx, suolo - altezza * 0.16);
      c.bezierCurveTo(cx * 1.1, suolo - altezza * 0.15, larghezza - cx * 0.6, suolo - altezza * 0.1,
        larghezza, suolo);
    } else if (tipo === "caldera") {
      /* la cima e' saltata via: resta un catino */
      var mezzo = Math.min(larghezza * 0.3, 130);
      c.moveTo(0, suolo);
      c.lineTo(cx - mezzo - 40, suolo - altezza * 0.16);
      c.lineTo(cx - mezzo, suolo - altezza * 0.1);
      c.lineTo(cx + mezzo, suolo - altezza * 0.1);
      c.lineTo(cx + mezzo + 40, suolo - altezza * 0.16);
      c.lineTo(larghezza, suolo);
    } else {
      /* il cono, tanto piu' ripido quanto piu' e' vischioso */
      var pendenza = 0.26 + Math.min(0.24, logVischiosita() / 28);
      var mezzaBase = Math.min(larghezza * 0.42, altezza * pendenza * 3.1);
      c.moveTo(cx - mezzaBase, suolo);
      c.lineTo(cx - 16, suolo - altezza * pendenza * 1.5);
      c.lineTo(cx + 16, suolo - altezza * pendenza * 1.5);
      c.lineTo(cx + mezzaBase, suolo);
    }
    c.closePath();
    c.fill();

    var cima = tipo === "scudo" ? suolo - altezza * 0.16
      : (tipo === "caldera" ? suolo - altezza * 0.1
        : suolo - altezza * (0.26 + Math.min(0.24, logVischiosita() / 28)) * 1.5);

    /* il camino e la camera magmatica */
    c.fillStyle = "#e8622a";
    c.fillRect(cx - 7, cima, 14, suolo - cima + altezza * 0.12);
    c.beginPath();
    c.ellipse(cx, suolo + altezza * 0.13, Math.min(70, larghezza * 0.2), altezza * 0.05, 0, 0, Math.PI * 2);
    c.fill();

    /* la lava che cola, se cola */
    var cola = quantoCola();
    if (cola > 0.5) {
      var lungo = Math.min(larghezza * 0.46, cola * larghezza * 0.016);
      c.strokeStyle = "#ff7a33";
      c.lineWidth = 5 + Math.min(6, cola / 5);
      [1, -1].forEach(function (verso) {
        c.beginPath();
        c.moveTo(cx, cima + 4);
        c.quadraticCurveTo(cx + verso * lungo * 0.5, cima + (suolo - cima) * 0.7,
          cx + verso * lungo, suolo);
        c.stroke();
      });
      c.fillStyle = "#20262e";
      c.font = "9px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText("la lava cola per " + Math.round(cola) + " km", cx, suolo + 14);
    }

    /* la colonna di cenere */
    var h = altezzaColonna();
    if (h > 0.5) {
      var altoCol = Math.min(cima - 6, (h / 45) * (cima - 4));
      var largoCol = 12 + h * 1.4;
      c.fillStyle = "rgba(90, 84, 78, 0.78)";
      c.beginPath();
      c.moveTo(cx - 10, cima);
      c.bezierCurveTo(cx - largoCol * 0.35, cima - (cima - altoCol) * 0.6,
        cx - largoCol * 0.5, cima - (cima - altoCol) * 0.85, cx - largoCol * 0.5, altoCol);
      /* il cappello che si allarga in cima */
      c.bezierCurveTo(cx - largoCol, altoCol - 10, cx + largoCol, altoCol - 10,
        cx + largoCol * 0.5, altoCol);
      c.bezierCurveTo(cx + largoCol * 0.5, cima - (cima - altoCol) * 0.85,
        cx + largoCol * 0.35, cima - (cima - altoCol) * 0.6, cx + 10, cima);
      c.closePath();
      c.fill();

      /* i lapilli che ricadono */
      for (var k = 0; k < Math.round(h / 3); k++) {
        var q = ((fase * 0.5 + k / 12) % 1);
        var xx = cx + (k % 2 === 0 ? 1 : -1) * (14 + (k * 13) % (largoCol + 18));
        c.fillStyle = "rgba(50,45,42,0.7)";
        c.beginPath();
        c.arc(xx, altoCol + (suolo - altoCol) * q, 2, 0, Math.PI * 2);
        c.fill();
      }

      c.fillStyle = "#20262e";
      c.font = "600 10px system-ui, sans-serif";
      c.textAlign = "left";
      c.fillText("colonna alta " + Math.round(h) + " km", 8, Math.max(14, altoCol));
    }

    c.fillStyle = "#20262e";
    c.font = "600 11px system-ui, sans-serif";
    c.textAlign = "right";
    c.fillText("eruzione " + tipoEruzione() + " · " + forma(), larghezza - 8, altezza - 8);
  }

  /* ==========================================================
     5. Il grafico: chi e' fluido e chi no
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

    var sx = 46, dx = 14, su = 16, giu = 34;
    var w = larghezzaG - sx - dx, h = altezzaG - su - giu;

    function X(s) { return sx + w * (s - 45) / 32; }
    function Y(lv) { return su + h * (1 - Math.max(0, Math.min(1, lv / 12))); }

    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var k = 0; k <= 6; k++) {
      var lv = k * 2;
      c.beginPath(); c.moveTo(sx, Y(lv)); c.lineTo(sx + w, Y(lv)); c.stroke();
      c.fillText("10^" + lv, sx - 4, Y(lv) + 3);
    }
    c.textAlign = "center";
    for (var j = 45; j <= 77; j += 8) {
      c.beginPath(); c.moveTo(X(j), su); c.lineTo(X(j), su + h); c.stroke();
      c.fillText(j + "%", X(j), su + h + 14);
    }
    c.fillText("quanta silice c'e' nel magma", sx + w / 2, altezzaG - 4);
    c.save();
    c.translate(12, su + h / 2); c.rotate(-Math.PI / 2);
    c.fillText("vischiosita'", 0, 0);
    c.restore();

    /* la curva alla temperatura di adesso */
    var memoria = silice;
    c.strokeStyle = accento; c.lineWidth = 2.8;
    c.beginPath();
    for (var i = 0; i <= 100; i++) {
      var s = 45 + 32 * i / 100;
      silice = s;
      var y = Y(logVischiosita());
      if (i === 0) c.moveTo(X(s), y); else c.lineTo(X(s), y);
    }
    c.stroke();
    silice = memoria;

    /* dove stanno i magmi del file */
    magmi.forEach(function (m) {
      var memS = silice, memT = temperatura;
      silice = m.silice; temperatura = m.temperatura;
      var lv = logVischiosita();
      silice = memS; temperatura = memT;
      c.fillStyle = m === magma ? accento : "rgba(140,130,118,0.75)";
      c.beginPath();
      c.arc(X(m.silice), Y(lv), m === magma ? 6 : 3.5, 0, Math.PI * 2);
      c.fill();
    });

    c.fillStyle = tenue; c.font = "9px system-ui, sans-serif"; c.textAlign = "left";
    c.fillText("la linea vale a " + Math.round(temperatura) + " gradi · i pallini sono i magmi del file",
      sx, 10);
  }

  /* ==========================================================
     6. Le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

  function vischiositaBella() {
    var lv = logVischiosita();
    return "10^" + conVirgola(arrotonda(lv, 1)) + " Pa·s";
  }

  function confronto() {
    var lv = logVischiosita();
    if (lv < 2) return "come l'olio caldo";
    if (lv < 3.5) return "come il miele";
    if (lv < 5.5) return "come il dentifricio";
    if (lv < 8) return "come il mastice";
    return "quasi solido: fatica perfino a scorrere";
  }

  var RACCONTI = {
    "effusiva": "Il magma e' abbastanza fluido da lasciare uscire il gas man mano che risale, senza " +
      "accumulare pressione. Cosi' la lava esce e cola, e si puo' stare a guardarla da vicino. Vulcani " +
      "come questo non costruiscono montagne ripide: fanno scudi larghi e bassi, perche' la lava scorre " +
      "lontano prima di fermarsi. Le Hawaii sono fatte cosi'.",
    "stromboliana": "Il gas riesce ancora a uscire, ma non del tutto liscio: si raccoglie in bolle " +
      "grandi che scoppiano a intervalli regolari, sparando in aria brandelli di lava. Sono le fontane " +
      "e i botti dello Stromboli e dell'Etna: spettacolari, rumorosi, e quasi sempre innocui per chi " +
      "sta a distanza.",
    "vulcaniana": "Adesso il magma e' abbastanza denso da tappare il condotto fra un'eruzione e " +
      "l'altra. La pressione si accumula sotto il tappo finche' non lo fa saltare, e ogni tanto parte " +
      "un'esplosione che lancia in alto una colonna di cenere. Alla lunga si costruisce un cono ripido, " +
      "fatto a strati alterni di lava e di cenere.",
    "pliniana": "Il magma e' cosi' denso che il gas non riesce proprio a uscire: resta dentro in " +
      "bollicine sotto pressione enorme, finche' il magma non si frantuma tutto insieme. Viene fuori " +
      "una colonna che arriva nella stratosfera e poi, quando non regge piu', ricade lungo i fianchi " +
      "come una valanga di cenere rovente. E' quello che successe a Pompei nel 79, ed e' il tipo di " +
      "eruzione che ha ucciso piu' gente nella storia.",
    "catastrofica": "Qui non si costruisce nessuna montagna: la si distrugge. Il magma vischioso e " +
      "gonfio di gas sta sotto una crosta che a un certo punto cede tutta insieme, e il terreno " +
      "sprofonda formando un catino largo decine di chilometri. Eruzioni di questa taglia ne avvengono " +
      "poche ogni centomila anni, e cambiano il clima di tutto il pianeta per qualche anno."
  };

  function racconta() {
    return RACCONTI[tipoEruzione()];
  }

  /* ==========================================================
     7. La pagina
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

  function applicaMagma(m, tempPersonale) {
    magma = m;
    silice = m.silice;
    temperatura = tempPersonale !== undefined ? tempPersonale : m.temperatura;
    gas = m.gas;
    if (cursoreS) cursoreS.aggiorna(silice);
    if (cursoreT) cursoreT.aggiorna(temperatura);
    if (cursoreG) cursoreG.aggiorna(gas);
    aggiorna();
  }

  function aggiorna() {
    letturaVisco.textContent = vischiositaBella();
    letturaTipo.textContent = tipoEruzione();
    letturaAltezza.textContent = altezzaColonna() < 0.5 ? "niente colonna"
      : Math.round(altezzaColonna()) + " km";

    pastiglieMagma.forEach(function (b) {
      b.className = "pillola" + (b.dato === magma ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    frase.textContent = racconta();
    schedaMagma.textContent = magma.esempio.charAt(0).toUpperCase() + magma.esempio.slice(1) + ". " +
      "Vischioso " + confronto() + ", e di gas ne ha " + conVirgola(gas) + " per cento, di cui il " +
      Math.round(gasChiuso() * 100) + " per cento non riesce a uscire." +
      (magma.nota ? " " + magma.nota.charAt(0).toUpperCase() + magma.nota.slice(1) + "." : "");

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegna();
    disegnaGrafico();
  }

  var ultimo = 0;
  function battito(ora) {
    var dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0;
    ultimo = ora;
    if (magma) { fase += dt; disegna(); }
    requestAnimationFrame(battito);
  }

  function costruisci() {
    svuota(contenitore);
    pastiglieMagma = []; pastiglieEsp = [];

    var avvisoErrori = App.avvisoErroriFile("magmi.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Non tutti i vulcani esplodono. Alcuni colano lava per anni e ci si puo' camminare accanto, " +
      "altri fanno saltare per aria mezza montagna in un pomeriggio. La differenza non sta nella " +
      "grandezza del vulcano, ma in due numeri del magma che ha dentro."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Esempi da guardare"));
    var griglia = elemento("div", "griglia-esperimenti");
    ESPERIMENTI.forEach(function (x, i) {
      var b = elemento("button", "carta-esperimento");
      b.type = "button";
      b.appendChild(elemento("div", "esperimento-titolo", x.titolo));
      b.appendChild(elemento("div", "esperimento-sottotitolo", x.sottotitolo));
      b.addEventListener("click", function () {
        esperimentoScelto = i;
        var m = magmi.filter(function (y) { return y.nome === x.magma; })[0];
        if (m) applicaMagma(m, x.temperatura);
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
    letture.appendChild(unaLettura("quanto e' denso il magma", function (n) { letturaVisco = n; }));
    letture.appendChild(unaLettura("tipo di eruzione", function (n) { letturaTipo = n; }));
    letture.appendChild(unaLettura("colonna di cenere", function (n) { letturaAltezza = n; }));
    contenitore.appendChild(letture);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le manopole"));
    var comandi = elemento("div", "comandi");
    cursoreS = cursore("Silice", 45, 77, 0.5, silice, "%", function (v) {
      silice = v; esperimentoScelto = -1; aggiorna();
    });
    cursoreT = cursore("Temperatura", 700, 1300, 10, temperatura, "°C", function (v) {
      temperatura = v; esperimentoScelto = -1; aggiorna();
    });
    cursoreG = cursore("Gas disciolti", 0, 8, 0.1, gas, "%", function (v) {
      gas = v; esperimentoScelto = -1; aggiorna();
    });
    comandi.appendChild(cursoreS);
    comandi.appendChild(cursoreT);
    comandi.appendChild(cursoreG);
    contenitore.appendChild(comandi);

    contenitore.appendChild(elemento("p", "nota-piccola",
      "Prova questo: tieni la silice al minimo e porta il gas al massimo. Non succede quasi niente, " +
      "perche' da un magma fluido il gas esce e basta. Poi rimetti il gas a meta' e alza la silice: " +
      "adesso salta tutto. Non e' il gas a fare l'esplosione, e' il gas che non riesce a uscire."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "La silice comanda"));
    var scatolaG = elemento("div", "scatola-grafico");
    telaG = elemento("canvas", "tela");
    scatolaG.appendChild(telaG);
    contenitore.appendChild(scatolaG);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Guarda la scala di sinistra: ogni tacca vale dieci volte. Fra il basalto delle Hawaii e la " +
      "riolite di Yellowstone non c'e' il doppio o il triplo di differenza: ci sono otto zeri."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quale magma"));
    var scelte = elemento("div", "scelte-grandezza");
    magmi.forEach(function (m) {
      var b = elemento("button", "pillola", m.nome);
      b.type = "button"; b.dato = m;
      b.addEventListener("click", function () { esperimentoScelto = -1; applicaMagma(m); });
      pastiglieMagma.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);
    schedaMagma = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaMagma);

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "La formula della vischiosita' e' una approssimazione tarata sui valori da manuale: basalto a 1200 gradi attorno a cento, andesite attorno a centomila, riolite fredda attorno a un miliardo. I modelli veri usati dai vulcanologi tengono conto di tutti gli ossidi presenti, non della sola silice.",
      "Manca l'acqua sciolta nel magma, che oltre a essere il gas principale rende il magma piu' fluido. Un magma riolitico ricco d'acqua e' molto meno vischioso di quanto dica questo conto.",
      "Mancano i cristalli. Un magma che si raffredda comincia a cristallizzare, e i cristalli sospesi lo rendono vischioso molto piu' in fretta di quanto direbbe la sola temperatura.",
      "Il tipo di eruzione qui dipende solo dal magma. Nella realta' contano anche la forma del condotto, quanto magma c'e' in tutto, e se c'e' acqua esterna: una falda o il mare che entrano in contatto col magma fanno esplodere anche un basalto fluidissimo.",
      "Le forme dei vulcani sono schematiche e non in scala. Un vulcano a scudo hawaiano e' largo centinaia di chilometri e alto pochi: disegnato in scala sembrerebbe una pianura.",
      "Il conto dice come sarebbe un'eruzione con quel magma, non prevede quando avverra'. Prevedere le eruzioni e' un'altra cosa, e si fa sorvegliando terremoti, deformazioni del suolo e gas emessi."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(320, Math.max(240, larghezza * 0.56)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaG = telaG.parentNode.clientWidth;
    altezzaG = Math.round(Math.min(270, Math.max(200, larghezzaG * 0.5)));
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
     8. Avvio
     ========================================================== */

  App.caricaTesto("magmi.txt")
    .then(function (testo) {
      var esito = leggiMagmi(testo);
      magmi = esito.elenco;
      erroriFile = esito.errori;

      if (!magmi.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file magmi.txt e' stato letto ma non contiene magmi validi."));
        contenitore.appendChild(avviso);
        return;
      }

      magma = magmi[0];
      silice = magma.silice; temperatura = magma.temperatura; gas = magma.gas;
      costruisci();
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("magmi.txt", errore.message));
    });

})();
