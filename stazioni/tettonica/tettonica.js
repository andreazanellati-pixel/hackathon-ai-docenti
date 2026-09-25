/* ============================================================
   La tettonica delle placche
   ------------------------------------------------------------
   Cinque modi di incontrarsi, e da ognuno viene fuori un pezzo
   diverso di mondo. Accanto al disegno c'e' il conto del tempo:
   a due centimetri all'anno, quanto ci vuole a fare un oceano?

   Come funziona, in due parole:
   - le velocita' sono quelle misurate davvero col GPS, e stanno
     in margini.txt
   - il conto del tempo non e' un elenco di date imparate a
     memoria: si moltiplica una velocita' per un tempo, e viene
     fuori che il tempo geologico non e' un'astrazione ma una
     conseguenza dell'aritmetica
   - l'eta' del fondale oceanico cresce in modo regolare
     allontanandosi dalla dorsale, e da quella regolarita' si
     ricava la velocita' di apertura: e' cosi' che si e'
     dimostrata l'espansione dei fondali
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var TIPI = ["divergente", "oceano-continente", "oceano-oceano", "continenti", "trasforme"];

  /* ---------- stato ---------- */

  var margini = [], erroriFile = [];
  var margine = null;
  var anni = 1000000;        /* per il conto del tempo */
  var fase = 0;
  var inMoto = true;
  var esperimentoScelto = 0;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var letturaSpostamento = null, letturaProfondita = null, letturaTipo = null;
  var pastiglieMargine = [], pastiglieEsp = [];
  var frase = null, schedaMargine = null, contoTempo = null;
  var cursoreAnni = null;

  /* ==========================================================
     1. Gli esperimenti gia' pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "Un oceano che si apre",
      sottotitolo: "L'Atlantico, due centimetri e mezzo all'anno",
      margine: "Dorsale medio-atlantica", anni: 1000000
    },
    {
      titolo: "Una placca che sprofonda",
      sottotitolo: "Le Ande: terremoti fino a 600 chilometri di profondita'",
      margine: "Ande, Cile", anni: 1000000
    },
    {
      titolo: "Due continenti che si scontrano",
      sottotitolo: "L'Himalaya: nessuno dei due sprofonda, e la crosta si alza",
      margine: "Himalaya", anni: 50000000
    },
    {
      titolo: "Scorrere di fianco",
      sottotitolo: "Sant'Andrea: niente vulcani, ma terremoti forti",
      margine: "Faglia di Sant'Andrea", anni: 10000000
    },
    {
      titolo: "Un continente che si spacca",
      sottotitolo: "Il rift africano: un oceano che deve ancora nascere",
      margine: "Rift dell'Africa orientale", anni: 10000000
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiMargini(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 5) {
        errori.push("riga " + (i + 1) + ": servono cinque parti separate da | .");
        return;
      }
      var tipo = p[1].trim().toLowerCase();
      if (TIPI.indexOf(tipo) < 0) {
        errori.push("riga " + (i + 1) + ": «" + tipo + "» non e' un tipo che conosco. " +
          "Quelli buoni sono: " + TIPI.join(", ") + ".");
        return;
      }
      var vel = numero(p[2]), prof = numero(p[3]);
      if (vel === null || prof === null) {
        errori.push("riga " + (i + 1) + ": la velocita' e la profondita' devono essere numeri.");
        return;
      }
      if (vel <= 0) {
        errori.push("riga " + (i + 1) + ": la velocita' deve essere maggiore di zero.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        tipo: tipo,
        velocita: vel,
        profondita: prof,
        descrizione: p[4].trim()
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. I conti
     ========================================================== */

  /* Quanti chilometri in tutto quel tempo. Un centimetro
     all'anno fa dieci chilometri ogni milione di anni: e' la
     conversione che rende il tempo geologico maneggevole. */
  function spostamento(annate) {
    return margine.velocita * annate / 100000;    /* km */
  }

  function tempoPer(km) {
    return km * 100000 / margine.velocita;        /* anni */
  }

  /* L'eta' del fondale a una certa distanza dalla dorsale: la
     crosta nasce al centro e si allontana, quindi piu' e'
     lontana piu' e' vecchia. */
  function etaFondale(km) {
    return tempoPer(km / 2);
  }

  /* ==========================================================
     4. Il disegno
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  var CIELO = "#cfe2ee";
  var MARE = "#6d9fc4";
  var CROSTA_OCEANICA = "#4a5560";
  var CROSTA_CONTINENTALE = "#b59b74";
  var MANTELLO = "#c26a4a";
  var MAGMA = "#e8622a";

  function disegna() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);

    var t = margine.tipo;
    var cx = larghezza / 2;
    var yMare = altezza * 0.34;
    var ySuolo = altezza * 0.42;

    /* cielo e mantello */
    c.fillStyle = CIELO;
    c.fillRect(0, 0, larghezza, ySuolo);
    c.fillStyle = MANTELLO;
    c.fillRect(0, ySuolo, larghezza, altezza - ySuolo);

    /* il movimento: le frecce si spostano avanti e indietro */
    var respiro = Math.sin(fase * 1.4) * 4;

    function freccia(x, y, verso, testo) {
      c.strokeStyle = "#20262e"; c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(x, y); c.lineTo(x + verso * 26, y);
      c.stroke();
      c.beginPath();
      c.moveTo(x + verso * 26, y);
      c.lineTo(x + verso * 18, y - 5);
      c.lineTo(x + verso * 18, y + 5);
      c.closePath();
      c.fillStyle = "#20262e"; c.fill();
      if (testo) {
        c.font = "9px system-ui, sans-serif"; c.textAlign = "center";
        c.fillText(testo, x + verso * 13, y - 9);
      }
    }

    function terremoti(punti) {
      punti.forEach(function (p) {
        c.fillStyle = "#e8b53a";
        c.beginPath();
        c.arc(p[0], p[1], 3.2, 0, Math.PI * 2);
        c.fill();
      });
    }

    function etichetta(x, y, testo, colore) {
      c.fillStyle = colore || "#20262e";
      c.font = "600 10px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(testo, x, y);
    }

    if (t === "divergente") {
      var oceano = margine.nome.indexOf("Rift") < 0;
      /* le due placche che si allontanano */
      c.fillStyle = oceano ? CROSTA_OCEANICA : CROSTA_CONTINENTALE;
      c.fillRect(0, ySuolo, cx - 30 - respiro, altezza * 0.13);
      c.fillRect(cx + 30 + respiro, ySuolo, larghezza, altezza * 0.13);

      /* il magma che sale in mezzo */
      c.fillStyle = MAGMA;
      c.beginPath();
      c.moveTo(cx - 30 - respiro, ySuolo);
      c.lineTo(cx + 30 + respiro, ySuolo);
      c.lineTo(cx + 14, altezza);
      c.lineTo(cx - 14, altezza);
      c.closePath(); c.fill();

      if (oceano) {
        c.fillStyle = MARE;
        c.fillRect(0, yMare, larghezza, ySuolo - yMare);
        /* la dorsale sporge */
        c.fillStyle = CROSTA_OCEANICA;
        c.beginPath();
        c.moveTo(cx - 90, ySuolo); c.lineTo(cx, ySuolo - 22); c.lineTo(cx + 90, ySuolo);
        c.closePath(); c.fill();
        c.fillStyle = MAGMA;
        c.fillRect(cx - 5 - respiro / 3, ySuolo - 20, 10 + respiro / 1.5, 24);
      }

      freccia(cx - 50, ySuolo - 34, -1, conVirgola(arrotonda(margine.velocita / 2, 2)) + " cm/anno");
      freccia(cx + 50, ySuolo - 34, 1, conVirgola(arrotonda(margine.velocita / 2, 2)) + " cm/anno");
      etichetta(cx, ySuolo - 46, oceano ? "dorsale oceanica" : "rift continentale");
      terremoti([[cx - 12, ySuolo + 10], [cx + 10, ySuolo + 16], [cx, ySuolo + 6]]);
      etichetta(cx, altezza - 8, "qui nasce crosta nuova", "#ffe9d8");

    } else if (t === "oceano-continente" || t === "oceano-oceano") {
      var continente = (t === "oceano-continente");
      c.fillStyle = MARE;
      c.fillRect(0, yMare, larghezza, ySuolo - yMare);

      /* la placca che sprofonda, da sinistra */
      c.fillStyle = CROSTA_OCEANICA;
      c.beginPath();
      c.moveTo(0, ySuolo);
      c.lineTo(cx - 20, ySuolo);
      c.lineTo(larghezza * 0.78, altezza);
      c.lineTo(larghezza * 0.62, altezza);
      c.lineTo(cx - 20, ySuolo + altezza * 0.11);
      c.lineTo(0, ySuolo + altezza * 0.11);
      c.closePath(); c.fill();

      /* la placca che sta sopra */
      if (continente) {
        c.fillStyle = CROSTA_CONTINENTALE;
        c.beginPath();
        c.moveTo(cx - 10, ySuolo);
        c.lineTo(cx + 40, ySuolo - 34);          /* la catena montuosa */
        c.lineTo(cx + 80, ySuolo - 20);
        c.lineTo(larghezza, ySuolo - 14);
        c.lineTo(larghezza, ySuolo + altezza * 0.15);
        c.lineTo(cx - 10, ySuolo + altezza * 0.1);
        c.closePath(); c.fill();
        etichetta(cx + 50, ySuolo - 42, "catena montuosa");
      } else {
        c.fillStyle = CROSTA_OCEANICA;
        c.beginPath();
        c.moveTo(cx - 10, ySuolo);
        c.lineTo(larghezza, ySuolo);
        c.lineTo(larghezza, ySuolo + altezza * 0.11);
        c.lineTo(cx - 10, ySuolo + altezza * 0.11);
        c.closePath(); c.fill();
        /* le isole vulcaniche */
        c.fillStyle = "#6b5a48";
        [cx + 40, cx + 78].forEach(function (x) {
          c.beginPath();
          c.moveTo(x - 16, ySuolo); c.lineTo(x, yMare - 14); c.lineTo(x + 16, ySuolo);
          c.closePath(); c.fill();
        });
        etichetta(cx + 60, yMare - 22, "arco di isole");
      }

      /* la fossa */
      c.fillStyle = MARE;
      c.beginPath();
      c.moveTo(cx - 34, ySuolo - 1);
      c.lineTo(cx - 20, ySuolo + 16);
      c.lineTo(cx - 8, ySuolo - 1);
      c.closePath(); c.fill();
      etichetta(cx - 30, yMare - 6, "fossa");

      /* il magma che risale dalla placca che sprofonda */
      c.fillStyle = MAGMA;
      [[cx + 34, 0.62], [cx + 58, 0.7]].forEach(function (m) {
        c.beginPath();
        c.moveTo(m[0] - 5, ySuolo);
        c.lineTo(m[0] + 5, ySuolo);
        c.lineTo(m[0] + 16, altezza * m[1]);
        c.lineTo(m[0] + 6, altezza * m[1]);
        c.closePath(); c.fill();
      });

      freccia(cx - 70, ySuolo - 24, 1, conVirgola(margine.velocita) + " cm/anno");
      /* i terremoti seguono la placca che scende: e' il piano di Benioff */
      var elenco = [];
      for (var k = 0; k <= 8; k++) {
        var q = k / 8;
        elenco.push([cx - 20 + (larghezza * 0.70 - cx + 20) * q, ySuolo + (altezza - ySuolo) * q]);
      }
      terremoti(elenco);
      etichetta(larghezza * 0.72, altezza - 8, "i terremoti seguono la placca, fino a " +
        margine.profondita + " km", "#ffe9d8");

    } else if (t === "continenti") {
      c.fillStyle = CROSTA_CONTINENTALE;
      c.beginPath();
      c.moveTo(0, ySuolo);
      c.lineTo(cx - 60, ySuolo - 10);
      c.lineTo(cx, ySuolo - 52 - respiro);       /* la montagna che cresce */
      c.lineTo(cx + 60, ySuolo - 10);
      c.lineTo(larghezza, ySuolo);
      c.lineTo(larghezza, ySuolo + altezza * 0.1);
      /* la radice profonda sotto la catena */
      c.lineTo(cx + 40, ySuolo + altezza * 0.1);
      c.lineTo(cx, ySuolo + altezza * 0.3);
      c.lineTo(cx - 40, ySuolo + altezza * 0.1);
      c.lineTo(0, ySuolo + altezza * 0.1);
      c.closePath(); c.fill();

      /* le pieghe */
      c.strokeStyle = "rgba(60,45,30,0.4)"; c.lineWidth = 1.5;
      for (var j = -2; j <= 2; j++) {
        c.beginPath();
        c.moveTo(cx + j * 26 - 14, ySuolo + 6);
        c.quadraticCurveTo(cx + j * 26, ySuolo - 28, cx + j * 26 + 14, ySuolo + 6);
        c.stroke();
      }

      freccia(cx - 90, ySuolo - 20, 1, conVirgola(margine.velocita) + " cm/anno");
      freccia(cx + 90, ySuolo - 20, -1, "");
      etichetta(cx, ySuolo - 62 - respiro, "catena montuosa");
      etichetta(cx, ySuolo + altezza * 0.34, "radice profonda", "#ffe9d8");
      terremoti([[cx - 30, ySuolo + 20], [cx + 25, ySuolo + 34], [cx, ySuolo + 50]]);

    } else {
      /* trasforme: le due placche scorrono di fianco.
         Si guarda dall'alto, non di lato. */
      c.fillStyle = CIELO;
      c.fillRect(0, 0, larghezza, altezza);
      c.fillStyle = CROSTA_CONTINENTALE;
      c.fillRect(0, 0, larghezza, altezza);

      /* la faglia, in diagonale */
      c.strokeStyle = "#20262e"; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(larghezza * 0.15, altezza);
      c.lineTo(larghezza * 0.85, 0);
      c.stroke();

      /* i due blocchi che scorrono in versi opposti */
      c.save();
      c.beginPath();
      c.moveTo(0, 0); c.lineTo(larghezza * 0.85, 0);
      c.lineTo(larghezza * 0.15, altezza); c.lineTo(0, altezza);
      c.closePath(); c.clip();
      c.fillStyle = "rgba(255,255,255,0.14)";
      c.fillRect(0, 0, larghezza, altezza);
      /* i segni del terreno, spostati */
      c.strokeStyle = "rgba(60,45,30,0.45)"; c.lineWidth = 2;
      for (var s = 0; s < 5; s++) {
        var y = altezza * (0.15 + s * 0.18) + respiro * 2;
        c.beginPath(); c.moveTo(0, y); c.lineTo(larghezza, y); c.stroke();
      }
      c.restore();

      c.save();
      c.beginPath();
      c.moveTo(larghezza * 0.85, 0); c.lineTo(larghezza, 0);
      c.lineTo(larghezza, altezza); c.lineTo(larghezza * 0.15, altezza);
      c.closePath(); c.clip();
      c.strokeStyle = "rgba(60,45,30,0.45)"; c.lineWidth = 2;
      for (var s2 = 0; s2 < 5; s2++) {
        var y2 = altezza * (0.15 + s2 * 0.18) - respiro * 2;
        c.beginPath(); c.moveTo(0, y2); c.lineTo(larghezza, y2); c.stroke();
      }
      c.restore();

      freccia(larghezza * 0.3, altezza * 0.3, -1, conVirgola(margine.velocita) + " cm/anno");
      freccia(larghezza * 0.7, altezza * 0.7, 1, "");
      etichetta(larghezza * 0.5, 16, "visto dall'alto");
      terremoti([[larghezza * 0.42, altezza * 0.55], [larghezza * 0.55, altezza * 0.38],
        [larghezza * 0.3, altezza * 0.74]]);
      etichetta(larghezza * 0.5, altezza - 8, "niente vulcani: non si crea ne' si distrugge crosta");
    }

    /* la linea del mare, per i margini sott'acqua */
    if (t !== "continenti" && t !== "trasforme") {
      c.strokeStyle = "rgba(255,255,255,0.5)"; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, yMare); c.lineTo(larghezza, yMare); c.stroke();
    }

    c.fillStyle = "#20262e";
    c.font = "600 11px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText(margine.nome, 8, 14);
  }

  /* ==========================================================
     5. Le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

  function tanti(n) { return Math.round(n).toLocaleString("it-IT"); }

  function annoBello(a) {
    if (a >= 1e6) return conVirgola(arrotonda(a / 1e6, 1)) + " milioni di anni";
    if (a >= 1000) return tanti(a) + " anni";
    return tanti(a) + " anni";
  }

  var SPIEGAZIONI = {
    "divergente": "Le due placche si allontanano, e dalla spaccatura sale mantello caldo che si " +
      "raffredda e diventa crosta nuova. E' l'unico posto dove la crosta si fabbrica. I terremoti ci " +
      "sono ma restano superficiali, perche' non c'e' nessuna placca che sprofonda; i vulcani sono " +
      "tanti e tranquilli, con lava fluida che cola invece di esplodere.",
    "oceano-continente": "La placca oceanica e' piu' densa e sprofonda sotto quella continentale. " +
      "Scendendo si scalda e libera acqua, che fa fondere il mantello sopra di lei: il magma risale e " +
      "costruisce una catena di vulcani sul continente. I terremoti seguono la placca mentre scende, " +
      "e si sentono fino a centinaia di chilometri di profondita'.",
    "oceano-oceano": "Fra due placche oceaniche sprofonda la piu' vecchia, che essendosi raffreddata " +
      "di piu' e' anche piu' pesante. Dove si piega si apre una fossa, la parte piu' profonda degli " +
      "oceani; il magma che risale costruisce un arco di isole vulcaniche.",
    "continenti": "Qui nessuna delle due placche riesce a sprofondare: la crosta continentale e' " +
      "troppo leggera per affondare nel mantello, come un pezzo di sughero nell'acqua. Allora si " +
      "accartoccia, si ripiega e si ispessisce verso l'alto e verso il basso. I vulcani sono pochi o " +
      "nessuno, perche' non c'e' nessuna placca che scenda a produrre magma.",
    "trasforme": "Le due placche scorrono una accanto all'altra, quindi qui non si crea e non si " +
      "distrugge crosta. Per questo non ci sono vulcani. Ci sono pero' terremoti forti, perche' le due " +
      "placche non scivolano lisce: si incastrano, accumulano spinta per decenni e poi si liberano di " +
      "colpo."
  };

  function racconta() {
    return SPIEGAZIONI[margine.tipo];
  }

  /* ==========================================================
     6. La pagina
     ========================================================== */

  function cursore(etichetta, min, max, passo, valore, quandoCambia) {
    var riga = elemento("div", "cursore");
    var testa = elemento("div", "cursore-testa");
    testa.appendChild(elemento("span", "cursore-nome", etichetta));
    var lettura = elemento("span", "cursore-valore", annoBello(valore));
    testa.appendChild(lettura);
    riga.appendChild(testa);
    var input = elemento("input");
    input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(passo);
    input.value = String(valore);
    input.setAttribute("aria-label", etichetta);
    input.addEventListener("input", function () {
      var v = Math.pow(10, parseFloat(input.value));
      lettura.textContent = annoBello(v);
      quandoCambia(v);
    });
    riga.appendChild(input);
    riga.aggiorna = function (v) {
      input.value = String(Math.log(v) / Math.LN10);
      lettura.textContent = annoBello(v);
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

  function aggiornaConto() {
    svuota(contoTempo);
    var t = elemento("table", "tabella-cifre");
    var testa = elemento("tr");
    ["quanto", "quanto tempo ci vuole"].forEach(function (h) {
      testa.appendChild(elemento("th", null, h));
    });
    t.appendChild(testa);

    [["1 metro", 0.001], ["1 chilometro", 1], ["100 chilometri", 100],
     ["1000 chilometri", 1000], ["la larghezza dell'Atlantico, 5000 km", 5000]]
      .forEach(function (riga) {
        var tr = elemento("tr");
        tr.appendChild(elemento("td", null, riga[0]));
        tr.appendChild(elemento("td", null, annoBello(tempoPer(riga[1]))));
        t.appendChild(tr);
      });
    contoTempo.appendChild(t);
  }

  function aggiorna() {
    letturaSpostamento.textContent = spostamento(anni) < 1
      ? conVirgola(arrotonda(spostamento(anni) * 1000, 0)) + " m"
      : tanti(spostamento(anni)) + " km";
    letturaProfondita.textContent = margine.profondita + " km";
    letturaTipo.textContent = conVirgola(margine.velocita) + " cm/anno";

    pastiglieMargine.forEach(function (b) {
      b.className = "pillola" + (b.dato === margine ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    frase.textContent = racconta();
    schedaMargine.textContent = margine.descrizione.charAt(0).toUpperCase() +
      margine.descrizione.slice(1) + ".";
    aggiornaConto();

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegna();
  }

  var ultimo = 0;
  function battito(ora) {
    var dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0;
    ultimo = ora;
    if (inMoto && margine) { fase += dt; disegna(); }
    requestAnimationFrame(battito);
  }

  function costruisci() {
    svuota(contenitore);
    pastiglieMargine = []; pastiglieEsp = [];

    var avvisoErrori = App.avvisoErroriFile("margini.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Le placche si muovono alla velocita' con cui crescono le unghie. Sembra niente, ma il tempo a " +
      "disposizione e' enorme: ed e' per questo che da quel movimento lentissimo vengono fuori gli " +
      "oceani, le montagne e i terremoti."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Esempi da guardare"));
    var griglia = elemento("div", "griglia-esperimenti");
    ESPERIMENTI.forEach(function (x, i) {
      var b = elemento("button", "carta-esperimento");
      b.type = "button";
      b.appendChild(elemento("div", "esperimento-titolo", x.titolo));
      b.appendChild(elemento("div", "esperimento-sottotitolo", x.sottotitolo));
      b.addEventListener("click", function () {
        esperimentoScelto = i;
        var m = margini.filter(function (y) { return y.nome === x.margine; })[0];
        if (m) margine = m;
        anni = x.anni;
        if (cursoreAnni) cursoreAnni.aggiorna(anni);
        aggiorna();
      });
      pastiglieEsp.push(b);
      griglia.appendChild(b);
    });
    contenitore.appendChild(griglia);

    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);
    contenitore.appendChild(elemento("p", "didascalia",
      "I pallini gialli sono i terremoti. Guarda dove stanno: e' la cosa che rivela meglio che cosa " +
      "sta succedendo sotto."));

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("quanto si e' spostata", function (n) { letturaSpostamento = n; }));
    letture.appendChild(unaLettura("velocita' misurata oggi", function (n) { letturaTipo = n; }));
    letture.appendChild(unaLettura("terremoti fino a", function (n) { letturaProfondita = n; }));
    contenitore.appendChild(letture);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quanto tempo e' passato"));
    var comandi = elemento("div", "comandi");
    cursoreAnni = cursore("Lascia passare il tempo", 3, 8.3, 0.05, anni, function (v) {
      anni = v; esperimentoScelto = -1; aggiorna();
    });
    comandi.appendChild(cursoreAnni);
    contenitore.appendChild(comandi);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Il conto del tempo"));
    contoTempo = elemento("div", "involucro-tabella");
    contenitore.appendChild(contoTempo);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Un centimetro all'anno fa dieci chilometri ogni milione di anni: e' la conversione che rende " +
      "maneggevole il tempo geologico. Guarda l'ultima riga: alla velocita' di oggi, per aprire un " +
      "Atlantico largo cinquemila chilometri ci vogliono duecento milioni di anni. Le rocce dicono che " +
      "l'Atlantico ha cominciato ad aprirsi centottanta milioni di anni fa. Due strade indipendenti " +
      "che portano allo stesso numero: e' una delle conferme piu' belle della tettonica. Prova poi a " +
      "cambiare margine: con la dorsale del Pacifico ci vuole un sesto del tempo."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quale posto del mondo"));
    var scelte = elemento("div", "scelte-grandezza");
    margini.forEach(function (m) {
      var b = elemento("button", "pillola", m.nome);
      b.type = "button"; b.dato = m;
      b.addEventListener("click", function () { margine = m; esperimentoScelto = -1; aggiorna(); });
      pastiglieMargine.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);
    schedaMargine = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaMargine);

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "I disegni sono sezioni schematiche, non in scala: la crosta e' disegnata molto piu' spessa di com'e'. Se fosse in scala, la crosta oceanica sarebbe un tratto di matita su un foglio alto mezzo metro.",
      "Le velocita' sono quelle di oggi, misurate col GPS, e vengono usate come se fossero sempre state cosi'. Non e' vero: l'India, per esempio, correva a quindici centimetri all'anno prima di sbattere contro l'Asia, e poi ha rallentato.",
      "I margini veri non sono linee dritte ne' sempre dello stesso tipo: lungo il Mediterraneo si passa da subduzione a collisione a scorrimento in poche centinaia di chilometri.",
      "Non c'e' il motore: qui si vede che cosa succede ai margini, non perche' le placche si muovano. Le correnti nel mantello, il peso della placca che sprofonda e la spinta della dorsale sono tutte cose che questa stazione non mostra.",
      "Il conto del tempo suppone una velocita' costante e un movimento in linea retta. Le placche invece ruotano attorno a un punto, e la velocita' cambia lungo il margine: vicino al polo di rotazione e' quasi zero."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;
    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(300, Math.max(220, larghezza * 0.52)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegna();
  });

  /* ==========================================================
     7. Avvio
     ========================================================== */

  App.caricaTesto("margini.txt")
    .then(function (testo) {
      var esito = leggiMargini(testo);
      margini = esito.elenco;
      erroriFile = esito.errori;

      if (!margini.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file margini.txt e' stato letto ma non contiene margini validi."));
        contenitore.appendChild(avviso);
        return;
      }

      margine = margini[0];
      costruisci();
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("margini.txt", errore.message));
    });

})();
