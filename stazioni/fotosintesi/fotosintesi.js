/* ============================================================
   La fotosintesi
   ------------------------------------------------------------
   Si regolano luce, anidride carbonica e temperatura, e si
   guarda la fotosintesi salire, appiattirsi, o non bastare
   nemmeno a pagare la respirazione.

   Come funziona, in due parole:
   - la fotosintesi lorda segue la curva di risposta alla luce,
     con il tetto che dipende da anidride carbonica e temperatura
   - la respirazione non si ferma mai e cresce col caldo piu' in
     fretta della fotosintesi: per questo oltre una certa
     temperatura la pianta perde, e il guadagno netto cala
   - il fattore limitante non e' deciso a tavolino: il sito prova
     ad aumentare del dieci per cento ciascuna delle tre cose e
     guarda quale fa salire di piu' il guadagno netto. E' la
     definizione stessa di fattore limitante, messa in pratica
   - il punto di compensazione, cioe' la luce alla quale la
     pianta va in pari, e' trovato per bisezione sulla stessa
     curva che si vede disegnata
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var LARGHEZZA_T = 12;     /* quanto e' larga la campana della temperatura */

  /* ---------- stato ---------- */

  var piante = [], erroriFile = [];
  var pianta = null;
  var luce = 600;           /* micromoli di fotoni al metro quadro al secondo */
  var co2 = 420;            /* parti per milione */
  var temperatura = 22;     /* gradi */
  var esperimentoScelto = 0;
  var graficoScelto = "luce";

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaG = null, ctxG = null, larghezzaG = 0, altezzaG = 0;
  var letturaNetta = null, letturaLimite = null, letturaCompenso = null;
  var pastigliePianta = [], pastiglieEsp = [], pastiglieGrafico = [];
  var frase = null, schedaPianta = null;
  var cursoreL = null, cursoreC = null, cursoreT = null;

  var fase = 0;

  /* ==========================================================
     1. Gli esperimenti gia' pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "Alza la luce",
      sottotitolo: "All'inizio serve, poi non serve piu': qualcos'altro la frena",
      pianta: "Spinacio", luce: 100, co2: 420, temperatura: 22, grafico: "luce"
    },
    {
      titolo: "Chi la sta frenando",
      sottotitolo: "Luce a volonta': adesso il fattore limitante e' un altro",
      pianta: "Spinacio", luce: 1600, co2: 420, temperatura: 22, grafico: "co2"
    },
    {
      titolo: "Il buio e il punto di pareggio",
      sottotitolo: "Con poca luce la pianta consuma piu' di quanto produce",
      pianta: "Spinacio", luce: 20, co2: 420, temperatura: 22, grafico: "luce"
    },
    {
      titolo: "Troppo caldo",
      sottotitolo: "La respirazione sale piu' in fretta della fotosintesi",
      pianta: "Grano", luce: 1200, co2: 420, temperatura: 20, grafico: "temperatura"
    },
    {
      titolo: "C3 contro C4",
      sottotitolo: "Il mais lavora gia' al massimo con l'aria di tutti i giorni",
      pianta: "Mais", luce: 1600, co2: 420, temperatura: 32, grafico: "co2"
    },
    {
      titolo: "La foglia del sottobosco",
      sottotitolo: "Si accontenta di poco, ma con tanta luce non sa che farsene",
      pianta: "Faggio, foglia d'ombra", luce: 150, co2: 420, temperatura: 20, grafico: "luce"
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiPiante(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 7) {
        errori.push("riga " + (i + 1) + ": servono almeno sette parti separate da | .");
        return;
      }
      var tipo = p[1].trim().toUpperCase();
      if (tipo !== "C3" && tipo !== "C4") {
        errori.push("riga " + (i + 1) + ": il tipo deve essere C3 oppure C4.");
        return;
      }
      var n = [numero(p[2]), numero(p[3]), numero(p[4]), numero(p[5]), numero(p[6])];
      var manca = false;
      n.forEach(function (v) { if (v === null) manca = true; });
      if (manca) {
        errori.push("riga " + (i + 1) + ": dal Pmax in poi devono esserci cinque numeri.");
        return;
      }
      if (n[0] <= 0 || n[1] <= 0 || n[2] <= 0) {
        errori.push("riga " + (i + 1) + ": Pmax, efficienza e K devono essere maggiori di zero.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        tipo: tipo,
        pmax: n[0],
        efficienza: n[1],
        kCo2: n[2],
        respirazione: n[3],
        tOttimale: n[4],
        nota: p.length > 7 ? p[7].trim() : ""
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. La fisiologia
     ========================================================== */

  /* Quanto conta l'anidride carbonica: una curva che sale e poi
     si appiattisce, come per gli enzimi. */
  function fattoreCo2(c) {
    return c / (pianta.kCo2 + c);
  }

  /* Quanto conta la temperatura sulla fotosintesi: una campana
     attorno all'optimum della pianta. */
  function fattoreT(t) {
    var q = (t - pianta.tOttimale) / LARGHEZZA_T;
    return Math.exp(-q * q);
  }

  /* Il tetto a cui la fotosintesi puo' arrivare in queste
     condizioni. */
  function tetto(c, t) {
    return pianta.pmax * fattoreCo2(c) * fattoreT(t);
  }

  /* La fotosintesi lorda: con poca luce sale quasi dritta, poi
     si piega e si appoggia al tetto. */
  function lorda(i, c, t) {
    var p = tetto(c, t);
    if (p <= 0) return 0;
    return p * (1 - Math.exp(-pianta.efficienza * i / p));
  }

  /* La respirazione non si ferma mai, e raddoppia ogni dieci
     gradi: e' questo che rovina il bilancio quando fa caldo. */
  function respirazione(t) {
    return pianta.respirazione * Math.pow(2, (t - 25) / 10);
  }

  /* Il guadagno netto: quello che la pianta si mette da parte. */
  function netta(i, c, t) {
    return lorda(i, c, t) - respirazione(t);
  }

  function nettaOra() { return netta(luce, co2, temperatura); }

  /* La luce alla quale la pianta va esattamente in pari. */
  function puntoDiCompensazione() {
    if (netta(3000, co2, temperatura) <= 0) return null;
    var basso = 0, alto = 3000;
    for (var k = 0; k < 60; k++) {
      var mezzo = (basso + alto) / 2;
      if (netta(mezzo, co2, temperatura) < 0) basso = mezzo; else alto = mezzo;
    }
    return (basso + alto) / 2;
  }

  /* Il fattore limitante: si prova ad aumentare del dieci per
     cento ciascuna delle tre cose e si guarda quale fa salire di
     piu' il guadagno netto. E' la definizione stessa di fattore
     limitante, applicata invece che raccontata. */
  function fattoreLimitante() {
    var ora = nettaOra();
    var prove = [
      { nome: "la luce", guadagno: netta(luce * 1.1, co2, temperatura) - ora },
      { nome: "l'anidride carbonica", guadagno: netta(luce, co2 * 1.1, temperatura) - ora },
      { nome: "la temperatura", guadagno: Math.max(
          netta(luce, co2, temperatura + 2) - ora,
          netta(luce, co2, temperatura - 2) - ora) }
    ];
    prove.sort(function (a, b) { return b.guadagno - a.guadagno; });
    return prove[0];
  }

  /* ==========================================================
     4. La foglia
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegnaFoglia() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);

    /* il fondo si schiarisce con la luce */
    var q = Math.min(1, luce / 1800);
    c.fillStyle = "rgb(" + Math.round(228 + q * 26) + "," + Math.round(230 + q * 24) + "," +
      Math.round(214 + q * 26) + ")";
    c.fillRect(0, 0, larghezza, altezza);

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var cx = larghezza / 2, cy = altezza * 0.56;
    var largoF = Math.min(larghezza * 0.42, 170);
    var altoF = Math.min(altezza * 0.5, 96);

    /* i raggi di luce */
    var raggi = Math.round(2 + q * 10);
    c.strokeStyle = "rgba(220, 175, 60, " + (0.25 + q * 0.6).toFixed(2) + ")";
    c.lineWidth = 2;
    for (var r = 0; r < raggi; r++) {
      var x = larghezza * (0.12 + 0.76 * r / Math.max(1, raggi - 1));
      var off = (fase * 30 + r * 17) % 26;
      c.beginPath();
      c.moveTo(x, 6 + off);
      c.lineTo(x - 4, 20 + off);
      c.stroke();
    }

    /* la foglia */
    var verde = 70 + Math.round(fattoreT(temperatura) * 60);
    c.fillStyle = "rgb(" + Math.round(90 - fattoreT(temperatura) * 20) + "," + verde + ",70)";
    c.beginPath();
    c.moveTo(cx - largoF, cy);
    c.bezierCurveTo(cx - largoF * 0.5, cy - altoF, cx + largoF * 0.5, cy - altoF, cx + largoF, cy);
    c.bezierCurveTo(cx + largoF * 0.5, cy + altoF, cx - largoF * 0.5, cy + altoF, cx - largoF, cy);
    c.closePath();
    c.fill();

    /* la nervatura */
    c.strokeStyle = "rgba(255,255,255,0.45)"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(cx - largoF, cy); c.lineTo(cx + largoF, cy); c.stroke();

    /* le frecce: anidride carbonica che entra, ossigeno che esce.
       La grandezza segue la fotosintesi lorda. */
    var intensita = Math.min(1, lorda(luce, co2, temperatura) / Math.max(1, pianta.pmax));
    c.font = "11px system-ui, sans-serif";
    c.textAlign = "center";

    var quante = Math.max(1, Math.round(intensita * 6));
    for (var k = 0; k < quante; k++) {
      var t = ((fase * 0.4 + k / quante) % 1);
      var yv = cy + altoF * 0.5 + 26 - t * 22;
      c.fillStyle = "rgba(120, 120, 130, 0.85)";
      c.fillText("CO₂", cx - largoF * 0.45 + (k % 2) * 14, yv);
      c.fillStyle = "rgba(90, 150, 200, 0.9)";
      c.fillText("O₂", cx + largoF * 0.45 - (k % 2) * 14, cy - altoF * 0.5 - 8 - t * 22);
    }

    /* la respirazione, che non si ferma mai */
    var qResp = Math.min(1, respirazione(temperatura) / 8);
    for (var j = 0; j < Math.max(1, Math.round(qResp * 4)); j++) {
      var t2 = ((fase * 0.3 + j / 4) % 1);
      c.fillStyle = "rgba(190, 100, 80, 0.8)";
      c.fillText("CO₂", cx + largoF * 0.1 + j * 10, cy + altoF * 0.5 + 12 + t2 * 20);
    }

    c.fillStyle = tenue;
    c.font = "600 11px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText(Math.round(luce) + " di luce · " + Math.round(co2) + " ppm · " +
      Math.round(temperatura) + " °C", 8, altezza - 8);
    c.textAlign = "right";
    c.fillText(pianta.nome + " (" + pianta.tipo + ")", larghezza - 8, altezza - 8);
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

    var sx = 46, dx = 14, su = 14, giu = 34;
    var w = larghezzaG - sx - dx, h = altezzaG - su - giu;

    var asse;
    if (graficoScelto === "luce") {
      asse = { da: 0, a: 2000, nome: "luce (µmol fotoni m⁻² s⁻¹)", ora: luce };
    } else if (graficoScelto === "co2") {
      asse = { da: 0, a: 1200, nome: "anidride carbonica (ppm)", ora: co2 };
    } else {
      asse = { da: 0, a: 50, nome: "temperatura (°C)", ora: temperatura };
    }

    function valore(x) {
      if (graficoScelto === "luce") return netta(x, co2, temperatura);
      if (graficoScelto === "co2") return netta(luce, x, temperatura);
      return netta(luce, co2, x);
    }
    function valoreLordo(x) {
      if (graficoScelto === "luce") return lorda(x, co2, temperatura);
      if (graficoScelto === "co2") return lorda(luce, x, temperatura);
      return lorda(luce, co2, x);
    }

    var alto = Math.max(5, pianta.pmax * 1.1);
    var basso = -Math.max(4, respirazione(45));

    function X(v) { return sx + w * (v - asse.da) / (asse.a - asse.da); }
    function Y(v) { return su + h * (alto - v) / (alto - basso); }

    /* la griglia coi numeri */
    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var k = 0; k <= 5; k++) {
      var v = basso + (alto - basso) * k / 5;
      c.beginPath(); c.moveTo(sx, Y(v)); c.lineTo(sx + w, Y(v)); c.stroke();
      c.fillText(String(Math.round(v)), sx - 5, Y(v) + 3);
    }
    c.textAlign = "center";
    for (var j = 0; j <= 4; j++) {
      var x = asse.da + (asse.a - asse.da) * j / 4;
      c.beginPath(); c.moveTo(X(x), su); c.lineTo(X(x), su + h); c.stroke();
      c.fillText(String(Math.round(x)), X(x), su + h + 14);
    }
    c.fillText(asse.nome, sx + w / 2, altezzaG - 4);
    c.save();
    c.translate(12, su + h / 2); c.rotate(-Math.PI / 2);
    c.fillText("CO₂ assorbita", 0, 0);
    c.restore();

    /* la riga dello zero: sopra la pianta guadagna, sotto perde */
    c.strokeStyle = tenue; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(sx, Y(0)); c.lineTo(sx + w, Y(0)); c.stroke();

    /* la fotosintesi lorda, in grigio */
    c.strokeStyle = bordo; c.lineWidth = 2.5;
    c.beginPath();
    for (var i = 0; i <= 200; i++) {
      var xx = asse.da + (asse.a - asse.da) * i / 200;
      if (i === 0) c.moveTo(X(xx), Y(valoreLordo(xx))); else c.lineTo(X(xx), Y(valoreLordo(xx)));
    }
    c.stroke();

    /* il guadagno netto, in evidenza */
    c.strokeStyle = accento; c.lineWidth = 2.8;
    c.beginPath();
    for (var m = 0; m <= 200; m++) {
      var x2 = asse.da + (asse.a - asse.da) * m / 200;
      if (m === 0) c.moveTo(X(x2), Y(valore(x2))); else c.lineTo(X(x2), Y(valore(x2)));
    }
    c.stroke();

    /* il punto di compensazione, solo sul grafico della luce */
    if (graficoScelto === "luce") {
      var comp = puntoDiCompensazione();
      if (comp !== null && comp < asse.a) {
        c.strokeStyle = "#c06a28"; c.setLineDash([4, 4]); c.lineWidth = 2;
        c.beginPath(); c.moveTo(X(comp), su); c.lineTo(X(comp), su + h); c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#c06a28"; c.textAlign = "left";
        c.font = "600 10px system-ui, sans-serif";
        c.fillText("pareggio", X(comp) + 4, su + 11);
      }
    }

    /* dove siamo adesso */
    c.beginPath();
    c.arc(X(asse.ora), Y(valore(asse.ora)), 5, 0, Math.PI * 2);
    c.fillStyle = accento; c.fill();

    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif"; c.textAlign = "left";
    c.fillText("grigio: quanta ne fa · blu: quanta gliene resta", sx, 10);
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
    var n = nettaOra();
    var lim = fattoreLimitante();
    var comp = puntoDiCompensazione();

    if (n <= 0) {
      return "Attenzione al segno: la pianta sta perdendo. Respirando consuma " +
        conVirgola(arrotonda(respirazione(temperatura), 1)) + " e con la fotosintesi ne recupera solo " +
        conVirgola(arrotonda(lorda(luce, co2, temperatura), 1)) + ". " +
        (comp !== null
          ? "Per andare in pari le servirebbe una luce di circa " + Math.round(comp) +
            ": sotto quel valore, che si chiama punto di compensazione, la pianta consuma le sue riserve. " +
            "E' quello che succede a ogni pianta tutte le notti."
          : "In queste condizioni non va in pari nemmeno con il sole pieno: il caldo o la mancanza di " +
            "anidride carbonica le impediscono di recuperare.");
    }

    var parte = "Il fattore limitante adesso e' " + lim.nome + ": e' quello che, se lo aumenti, fa " +
      "salire di piu' il guadagno. ";

    if (lim.nome === "la luce") {
      return parte + "Sei nel tratto in cui la curva sale ancora: ogni raggio in piu' viene usato. " +
        "Continua ad alzarla e a un certo punto la curva si appiattira': da li' in avanti sara' " +
        "qualcos'altro a frenare.";
    }
    if (lim.nome === "l'anidride carbonica") {
      return parte + "La luce c'e' gia' abbastanza: aggiungerne non serve quasi a niente, perche' la " +
        "pianta non riesce a procurarsi abbastanza anidride carbonica da usarla. " +
        (pianta.tipo === "C4"
          ? "Nota pero' che questa e' una C4, e con l'aria normale e' gia' quasi al massimo: per lei " +
            "questo freno conta molto meno."
          : "E' il motivo per cui nelle serre si arricchisce l'aria di anidride carbonica.");
    }
    return parte + "La temperatura non e' quella giusta per questa pianta, che lavora meglio attorno " +
      "ai " + conVirgola(pianta.tOttimale) + " gradi. Ricorda che il caldo fa due cose opposte: aiuta " +
      "gli enzimi fino a un certo punto, ma fa crescere la respirazione senza fermarsi mai.";
  }

  /* ==========================================================
     7. I comandi
     ========================================================== */

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
    riga.aggiorna = function (v) {
      input.value = String(v);
      lettura.textContent = v + " " + unita;
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
    var p = piante.filter(function (y) { return y.nome === x.pianta; })[0];
    if (p) pianta = p;
    luce = x.luce; co2 = x.co2; temperatura = x.temperatura;
    graficoScelto = x.grafico;
    if (cursoreL) cursoreL.aggiorna(luce);
    if (cursoreC) cursoreC.aggiorna(co2);
    if (cursoreT) cursoreT.aggiorna(temperatura);
    aggiorna();
  }

  function aggiorna() {
    var n = nettaOra();
    letturaNetta.textContent = (n > 0 ? "+" : "") + conVirgola(arrotonda(n, 1));
    letturaLimite.textContent = fattoreLimitante().nome;
    var comp = puntoDiCompensazione();
    letturaCompenso.textContent = comp === null ? "non ci arriva" : String(Math.round(comp));

    pastigliePianta.forEach(function (b) {
      b.className = "pillola" + (b.dato === pianta ? " attiva" : "");
    });
    pastiglieGrafico.forEach(function (b) {
      b.className = "pillola" + (b.dato === graficoScelto ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    frase.textContent = racconta();
    schedaPianta.textContent = pianta.nome + ", una " + pianta.tipo + ". Al massimo arriva a " +
      conVirgola(pianta.pmax) + ", lavora meglio a " + conVirgola(pianta.tOttimale) + " gradi, e va a " +
      "meta' velocita' con " + conVirgola(pianta.kCo2) + " ppm di anidride carbonica" +
      (pianta.kCo2 < 100 ? ", cioe' molto meno di quella che c'e' nell'aria: e' il vantaggio delle C4."
        : ", cioe' meno di quella che c'e' nell'aria ma non di molto.") +
      (pianta.nota ? " " + pianta.nota.charAt(0).toUpperCase() + pianta.nota.slice(1) + "." : "");

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegnaFoglia();
    disegnaGrafico();
  }

  var ultimo = 0;
  function battito(ora) {
    var dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0;
    ultimo = ora;
    if (pianta) { fase += dt; disegnaFoglia(); }
    requestAnimationFrame(battito);
  }

  /* ==========================================================
     8. Costruire la pagina
     ========================================================== */

  function costruisci() {
    svuota(contenitore);
    pastigliePianta = []; pastiglieEsp = []; pastiglieGrafico = [];

    var avvisoErrori = App.avvisoErroriFile("piante.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Una pianta non guadagna tutto quello che produce: mentre fa la fotosintesi respira anche, e la " +
      "respirazione non si ferma mai, nemmeno di notte. Quello che conta e' la differenza. Qui ci sono " +
      "tutte e due le curve: quanta ne fa, e quanta gliene resta."));

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

    /* --- la foglia --- */
    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);
    contenitore.appendChild(elemento("p", "didascalia",
      "Le scritte grigie che entrano sono l'anidride carbonica assorbita, quelle azzurre che escono " +
      "l'ossigeno prodotto. Le rosse che escono dal basso sono l'anidride carbonica della respirazione: " +
      "ci sono sempre, e aumentano col caldo."));

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("guadagno netto", function (n) { letturaNetta = n; }));
    letture.appendChild(unaLettura("che cosa la frena", function (n) { letturaLimite = n; }));
    letture.appendChild(unaLettura("luce per andare in pari", function (n) { letturaCompenso = n; }));
    contenitore.appendChild(letture);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    /* --- il grafico --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Il grafico"));
    var scelteG = elemento("div", "scelte-grandezza");
    [["luce", "al variare della luce"], ["co2", "al variare della CO₂"],
     ["temperatura", "al variare della temperatura"]].forEach(function (g) {
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
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Dove la curva blu passa sotto la riga dello zero la pianta sta consumando le sue riserve. " +
      "Il punto in cui la taglia, sul grafico della luce, e' il punto di compensazione."));

    /* --- le manopole --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le manopole"));
    var comandi = elemento("div", "comandi");
    cursoreL = cursore("Luce", 0, 2000, 10, luce, "", function (v) {
      luce = v; esperimentoScelto = -1; aggiorna();
    });
    cursoreC = cursore("Anidride carbonica", 0, 1200, 10, co2, "ppm", function (v) {
      co2 = v; esperimentoScelto = -1; aggiorna();
    });
    cursoreT = cursore("Temperatura", 0, 50, 1, temperatura, "°C", function (v) {
      temperatura = v; esperimentoScelto = -1; aggiorna();
    });
    comandi.appendChild(cursoreL);
    comandi.appendChild(cursoreC);
    comandi.appendChild(cursoreT);
    contenitore.appendChild(comandi);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Nell'aria di oggi ci sono circa 420 ppm di anidride carbonica. Prima dell'industrializzazione " +
      "erano 280. In una giornata di sole pieno la luce arriva attorno a 2000, in una stanza " +
      "illuminata sta sotto 50."));

    /* --- quale pianta --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quale pianta"));
    var scelte = elemento("div", "scelte-grandezza");
    piante.forEach(function (p) {
      var b = elemento("button", "pillola", p.nome);
      b.type = "button"; b.dato = p;
      b.addEventListener("click", function () { pianta = p; esperimentoScelto = -1; aggiorna(); });
      pastigliePianta.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);
    schedaPianta = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaPianta);

    /* --- i limiti --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "I tre fattori si moltiplicano fra loro secondo curve semplici. Nella pianta vera si intrecciano: la temperatura cambia anche quanto bene la pianta cattura l'anidride carbonica, e l'acqua che manca chiude gli stomi e blocca tutto.",
      "Manca l'acqua, che nella realta' e' spesso il fattore limitante piu' importante di tutti. Una pianta assetata chiude gli stomi e smette di prendere anidride carbonica, anche con luce e temperatura perfette.",
      "La fotorespirazione, che nelle C3 spreca una parte del lavoro e cresce col caldo, qui non e' calcolata a parte: e' inglobata nei numeri delle piante. La differenza fra C3 e C4 c'e', ma resa in modo semplificato.",
      "La campana della temperatura e' simmetrica e la pianta non si rovina mai. Sopra i 45 gradi una foglia vera si danneggia davvero, e non si riprende.",
      "Si guarda una foglia sola, in condizioni costanti. Una pianta intera ha foglie al sole e foglie all'ombra, e nell'arco della giornata tutto cambia di continuo.",
      "I numeri delle piante sono valori tipici da manuale. La stessa specie, coltivata in due posti diversi, da' misure diverse."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(260, Math.max(190, larghezza * 0.45)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaG = telaG.parentNode.clientWidth;
    altezzaG = Math.round(Math.min(290, Math.max(210, larghezzaG * 0.55)));
    telaG.width = larghezzaG * dpr; telaG.height = altezzaG * dpr;
    telaG.style.width = larghezzaG + "px"; telaG.style.height = altezzaG + "px";
    ctxG = telaG.getContext("2d");
    ctxG.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegnaFoglia(); disegnaGrafico();
  });

  /* ==========================================================
     9. Avvio
     ========================================================== */

  App.caricaTesto("piante.txt")
    .then(function (testo) {
      var esito = leggiPiante(testo);
      piante = esito.elenco;
      erroriFile = esito.errori;

      if (!piante.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file piante.txt e' stato letto ma non contiene piante valide."));
        contenitore.appendChild(avviso);
        return;
      }

      pianta = piante[0];
      costruisci();
      applicaEsperimento(ESPERIMENTI[0]);
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("piante.txt", errore.message));
    });

})();
