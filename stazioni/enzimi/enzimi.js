/* ============================================================
   Il banco degli enzimi
   ------------------------------------------------------------
   Si regolano substrato, temperatura, pH e inibitori, e si guarda
   la velocita' della reazione salire, appiattirsi o crollare.

   Come funziona, in due parole:
   - la velocita' segue l'equazione di Michaelis e Menten:
     v = Vmax * [S] / (Km + [S])
   - temperatura e pH moltiplicano la velocita' per un fattore
     fra zero e uno
   - la denaturazione e' una cosa a parte, e soprattutto NON si
     torna indietro: sopra la temperatura di rovina gli enzimi si
     sformano man mano, e raffreddando restano sformati. E' il
     motivo per cui un uovo sodo non torna crudo
   - gli inibitori agiscono nel modo giusto per il loro tipo:
     il competitivo alza il Km, il non competitivo abbassa il
     Vmax, l'incompetitivo abbassa tutti e due
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var KI = 1.0;             /* costante di inibizione, mmol/L */
  var K0 = 0.02;            /* con che rapidita' si rovina, alla temperatura di rovina */
  var LARGHEZZA_ROVINA = 2.5; /* ogni 2,5 gradi in piu', la rovina accelera di e volte */

  /* ---------- stato ---------- */

  var enzimi = [], erroriFile = [];
  var enzima = null;

  var substrato = 5;        /* mmol/L */
  var temperatura = 37;     /* gradi */
  var ph = 7;
  var tipoInibitore = "nessuno";
  var inibitore = 0;        /* mmol/L */

  var attivo = 1;           /* frazione di enzima ancora integro */
  var prodotto = 0;         /* micromoli accumulate */
  var tempo = 0;            /* secondi simulati */
  var inMoto = true;
  var graficoScelto = "substrato";
  var esperimentoScelto = 0;

  /* pezzi di pagina da aggiornare senza ricostruire tutto */
  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaG = null, ctxG = null, larghezzaG = 0, altezzaG = 0;
  var letturaV = null, letturaAttivo = null, letturaProdotto = null;
  var pastiglieEnzima = [], pastiglieInibitore = [], pastiglieGrafico = [], pastiglieEsp = [];
  var frase = null, schedaEnzima = null, bottoneMoto = null;
  var cursoreS = null, cursoreT = null, cursorePh = null, cursoreI = null;

  var particelle = [];      /* le molecole di substrato che girano */
  var sagome = [];          /* gli enzimi disegnati */

  /* ==========================================================
     1. Gli esperimenti gia' pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "La curva di Michaelis e Menten",
      sottotitolo: "Aggiungi substrato: la velocita' sale, poi si appiattisce",
      enzima: "Amilasi salivare", substrato: 0.5, temperatura: 37, ph: 6.8,
      inibitore: "nessuno", quantoInibitore: 0, grafico: "substrato"
    },
    {
      titolo: "Il caldo che rovina",
      sottotitolo: "Porta la temperatura a 55 gradi, poi riabbassala: non torna",
      enzima: "Amilasi salivare", substrato: 20, temperatura: 37, ph: 6.8,
      inibitore: "nessuno", quantoInibitore: 0, grafico: "temperatura"
    },
    {
      titolo: "Ogni enzima il suo pH",
      sottotitolo: "La pepsina lavora nell'acido dello stomaco: pH 7 la ferma",
      enzima: "Pepsina", substrato: 5, temperatura: 37, ph: 2,
      inibitore: "nessuno", quantoInibitore: 0, grafico: "ph"
    },
    {
      titolo: "L'inibitore competitivo",
      sottotitolo: "Ruba il posto al substrato, ma con tanto substrato perde",
      enzima: "Amilasi salivare", substrato: 2, temperatura: 37, ph: 6.8,
      inibitore: "competitivo", quantoInibitore: 3, grafico: "substrato"
    },
    {
      titolo: "Quello non competitivo",
      sottotitolo: "Si attacca altrove e storce l'enzima: il substrato non lo batte",
      enzima: "Amilasi salivare", substrato: 2, temperatura: 37, ph: 6.8,
      inibitore: "non competitivo", quantoInibitore: 3, grafico: "substrato"
    },
    {
      titolo: "L'enzima della sorgente bollente",
      sottotitolo: "La Taq polimerasi a 37 gradi dorme, a 72 va al massimo",
      enzima: "Taq polimerasi", substrato: 10, temperatura: 37, ph: 8.5,
      inibitore: "nessuno", quantoInibitore: 0, grafico: "temperatura"
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiEnzimi(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 9) {
        errori.push("riga " + (i + 1) + ": servono almeno nove parti separate da | .");
        return;
      }
      var numeri = [numero(p[3]), numero(p[4]), numero(p[5]), numero(p[6]), numero(p[7]), numero(p[8])];
      var manca = false;
      numeri.forEach(function (n) { if (n === null) manca = true; });
      if (manca) {
        errori.push("riga " + (i + 1) + ": dal Km in poi devono esserci sei numeri.");
        return;
      }
      if (numeri[0] <= 0 || numeri[4] <= 0) {
        errori.push("riga " + (i + 1) + ": il Km e l'ampiezza di pH devono essere maggiori di zero.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        substrato: p[1].trim(),
        prodotto: p[2].trim(),
        km: numeri[0],
        vmax: numeri[1],
        tOttimale: numeri[2],
        tRovina: numeri[3],
        phOttimale: numeri[4],
        ampiezzaPh: numeri[5],
        dove: p.length > 9 ? p[9].trim() : ""
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. La biochimica
     ========================================================== */

  /* Quanto conta la temperatura sul lavoro dell'enzima, senza
     contare la rovina: scaldando la chimica va piu' in fretta,
     ma lontano dal suo optimum l'enzima lavora peggio. */
  function fattoreTemperatura(t) {
    var scarto = t <= enzima.tOttimale ? enzima.tOttimale - t : t - enzima.tOttimale;
    return Math.pow(2, -scarto / 10);
  }

  /* Quanto conta il pH: una campana attorno al pH preferito. */
  function fattorePh(p) {
    var q = (p - enzima.phOttimale) / enzima.ampiezzaPh;
    return Math.exp(-q * q);
  }

  /* Con che rapidita' l'enzima si sta rovinando, in una frazione
     al secondo. Sotto la temperatura di rovina e' quasi zero. */
  function rapiditaRovina(t) {
    return K0 * Math.exp((t - enzima.tRovina) / LARGHEZZA_ROVINA);
  }

  /* Km e Vmax come li vede la reazione, tenendo conto
     dell'inibitore. */
  function kmEffettivo() {
    var f = 1 + inibitore / KI;
    if (tipoInibitore === "competitivo") return enzima.km * f;
    if (tipoInibitore === "incompetitivo") return enzima.km / f;
    return enzima.km;
  }

  function vmaxEffettivo() {
    var f = 1 + inibitore / KI;
    if (tipoInibitore === "non competitivo" || tipoInibitore === "incompetitivo") return enzima.vmax / f;
    return enzima.vmax;
  }

  /* La velocita' vera, adesso, con l'enzima ridotto com'e'. */
  function velocita() {
    return vmaxEffettivo() * attivo * fattoreTemperatura(temperatura) * fattorePh(ph) *
      substrato / (kmEffettivo() + substrato);
  }

  /* La velocita' che ci sarebbe con l'enzima ancora tutto intero:
     serve per disegnare le curve. */
  function velocitaTeorica(s, t, p) {
    return vmaxEffettivo() * fattoreTemperatura(t) * fattorePh(p) * s / (kmEffettivo() + s);
  }

  /* ==========================================================
     4. Il tempo che passa
     ========================================================== */

  function unPasso(dt) {
    if (dt <= 0) return;
    prodotto += velocita() * dt / 60;      /* Vmax e' in micromoli al minuto */
    tempo += dt;
    var k = rapiditaRovina(temperatura);
    attivo = attivo * Math.exp(-k * dt);
    if (attivo < 1e-6) attivo = 0;
  }

  function rimetti() {
    attivo = 1;
    prodotto = 0;
    tempo = 0;
    aggiorna();
  }

  /* ==========================================================
     5. Disegnare il banco
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function creaSagome() {
    sagome = [];
    for (var i = 0; i < 6; i++) {
      sagome.push({
        x: 0.14 + (i % 3) * 0.36,
        y: i < 3 ? 0.3 : 0.72,
        fase: Math.random() * Math.PI * 2,
        carico: 0,             /* da 0 a 1: quanto manca a liberare il prodotto */
        occupato: false
      });
    }
  }

  function creaParticelle() {
    particelle = [];
    var quante = Math.max(4, Math.min(48, Math.round(substrato * 2.2)));
    for (var i = 0; i < quante; i++) {
      particelle.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.004,
        vy: (Math.random() - 0.5) * 0.004,
        tipo: "substrato",
        eta: 0
      });
    }
  }

  function muoviScena(dt) {
    var spinta = 0.4 + temperatura / 60;   /* piu' caldo, piu' si agitano */
    particelle.forEach(function (p) {
      p.x += p.vx * spinta * dt * 60;
      p.y += p.vy * spinta * dt * 60;
      if (p.x < 0.02 || p.x > 0.98) p.vx = -p.vx;
      if (p.y < 0.05 || p.y > 0.95) p.vy = -p.vy;
      p.x = Math.min(0.98, Math.max(0.02, p.x));
      p.y = Math.min(0.95, Math.max(0.05, p.y));
      if (p.tipo === "prodotto") {
        p.eta += dt;
        if (p.eta > 2.5) { p.tipo = "substrato"; p.eta = 0; }
      }
    });

    /* quanto spesso gli enzimi afferrano: in proporzione alla velocita' */
    var quota = enzima.vmax > 0 ? velocita() / enzima.vmax : 0;
    sagome.forEach(function (s) {
      if (attivo < 0.5 && Math.random() < (0.5 - attivo) * dt * 2) s.rovinato = true;
      if (attivo > 0.9) s.rovinato = false;
      if (s.rovinato) { s.occupato = false; s.carico = 0; return; }
      if (s.occupato) {
        s.carico -= dt * 2.5;
        if (s.carico <= 0) {
          s.occupato = false;
          var libera = particelle.filter(function (p) { return p.tipo === "substrato"; })[0];
          if (libera) { libera.tipo = "prodotto"; libera.eta = 0; libera.x = s.x; libera.y = s.y; }
        }
      } else if (Math.random() < quota * dt * 3) {
        s.occupato = true;
        s.carico = 1;
      }
    });
  }

  function disegnaBanco() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);

    /* il fondo, di colore piu' caldo quando la temperatura sale */
    var caldo = Math.min(1, Math.max(0, (temperatura - 10) / 80));
    c.fillStyle = "rgb(" + Math.round(244 + caldo * 11) + "," +
      Math.round(244 - caldo * 30) + "," + Math.round(238 - caldo * 50) + ")";
    c.fillRect(0, 0, larghezza, altezza);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");

    /* le molecole */
    particelle.forEach(function (p) {
      var x = p.x * larghezza, y = p.y * altezza;
      if (p.tipo === "substrato") {
        c.fillStyle = "#4c8fbd";
        c.fillRect(x - 3.5, y - 3.5, 7, 7);
      } else {
        c.fillStyle = "#4aa06a";
        c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill();
      }
    });

    /* gli enzimi */
    sagome.forEach(function (s) {
      var x = s.x * larghezza;
      var y = s.y * altezza + Math.sin(Date.now() / 600 + s.fase) * 3;
      var r = Math.min(30, larghezza * 0.065);

      c.beginPath();
      if (s.rovinato) {
        /* un enzima rovinato non ha piu' la sua forma */
        c.moveTo(x - r, y);
        for (var a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 6) {
          var rr = r * (0.7 + 0.5 * Math.abs(Math.sin(a * 3 + s.fase)));
          c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        c.closePath();
        c.fillStyle = "#b4ada1";
        c.fill();
        c.strokeStyle = tenue; c.lineWidth = 1.5; c.stroke();
        return;
      }

      /* enzima sano: un tondo con una tacca, il sito attivo */
      c.arc(x, y, r, Math.PI * 1.75, Math.PI * 1.25, false);
      c.lineTo(x + r * 0.18, y - r * 0.32);
      c.lineTo(x - r * 0.18, y - r * 0.32);
      c.closePath();
      c.fillStyle = s.occupato ? "#e0b84a" : "#d9a441";
      c.fill();
      c.strokeStyle = bordo; c.lineWidth = 1.5; c.stroke();

      if (s.occupato) {
        c.fillStyle = "#4c8fbd";
        c.fillRect(x - 3.5, y - r * 0.5, 7, 7);
      }
    });

    /* la targhetta con la temperatura */
    c.fillStyle = tenue;
    c.font = "600 12px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText(Math.round(temperatura) + " °C, pH " + conVirgola(arrotonda(ph, 1)), 10, 18);
    c.textAlign = "right";
    c.fillText(attivo > 0.995 ? "enzima intatto"
      : (attivo < 0.01 ? "enzima rovinato" : "integro al " + Math.round(attivo * 100) + "%"),
      larghezza - 10, 18);
  }

  /* ==========================================================
     6. Disegnare il grafico
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

    var sx = 46, dx = 14, su = 14, giu = 32;
    var w = larghezzaG - sx - dx, h = altezzaG - su - giu;

    /* che cosa mettiamo sull'asse orizzontale */
    var asse;
    if (graficoScelto === "substrato") {
      asse = { da: 0, a: Math.max(20, enzima.km * 8), nome: "substrato (mmol/L)", ora: substrato };
    } else if (graficoScelto === "temperatura") {
      asse = { da: 0, a: Math.max(80, enzima.tRovina + 20), nome: "temperatura (°C)", ora: temperatura };
    } else {
      asse = { da: 0, a: 14, nome: "pH", ora: ph };
    }

    var vScala = Math.max(1, enzima.vmax * 1.05);

    function X(v) { return sx + w * (v - asse.da) / (asse.a - asse.da); }
    function Y(v) { return su + h * (1 - v / vScala); }

    function valore(x) {
      if (graficoScelto === "substrato") return velocitaTeorica(x, temperatura, ph);
      if (graficoScelto === "temperatura") return velocitaTeorica(substrato, x, ph);
      return velocitaTeorica(substrato, temperatura, x);
    }

    /* la zona in cui l'enzima si rovina */
    if (graficoScelto === "temperatura") {
      c.fillStyle = "rgba(200, 90, 60, 0.13)";
      c.fillRect(X(enzima.tRovina), su, X(asse.a) - X(enzima.tRovina), h);
      c.fillStyle = tenue;
      c.font = "10px system-ui, sans-serif";
      c.textAlign = "left";
      c.fillText("qui si rovina", X(enzima.tRovina) + 4, su + 12);
    }

    /* la griglia, con i numeri su tutti e due gli assi */
    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var i = 0; i <= 4; i++) {
      var v = vScala * i / 4;
      c.beginPath(); c.moveTo(sx, Y(v)); c.lineTo(sx + w, Y(v)); c.stroke();
      c.fillText(String(Math.round(v)), sx - 5, Y(v) + 3);
    }
    c.textAlign = "center";
    for (var j = 0; j <= 5; j++) {
      var x = asse.da + (asse.a - asse.da) * j / 5;
      c.beginPath(); c.moveTo(X(x), su); c.lineTo(X(x), su + h); c.stroke();
      c.fillText(conVirgola(arrotonda(x, 1)), X(x), su + h + 14);
    }
    c.fillText(asse.nome, sx + w / 2, altezzaG - 5);
    c.save();
    c.translate(12, su + h / 2); c.rotate(-Math.PI / 2);
    c.fillText("velocita' (µmol/min)", 0, 0);
    c.restore();

    /* la curva senza inibitore, per confronto */
    if (inibitore > 0 && tipoInibitore !== "nessuno") {
      var memoria = [tipoInibitore, inibitore];
      tipoInibitore = "nessuno"; inibitore = 0;
      c.strokeStyle = bordo; c.lineWidth = 3;
      c.beginPath();
      for (var k = 0; k <= 200; k++) {
        var xx = asse.da + (asse.a - asse.da) * k / 200;
        if (k === 0) c.moveTo(X(xx), Y(valore(xx))); else c.lineTo(X(xx), Y(valore(xx)));
      }
      c.stroke();
      tipoInibitore = memoria[0]; inibitore = memoria[1];
    }

    /* la curva di adesso */
    c.strokeStyle = accento; c.lineWidth = 2.5;
    c.beginPath();
    for (var m = 0; m <= 200; m++) {
      var x2 = asse.da + (asse.a - asse.da) * m / 200;
      if (m === 0) c.moveTo(X(x2), Y(valore(x2))); else c.lineTo(X(x2), Y(valore(x2)));
    }
    c.stroke();

    /* il Km, sul grafico del substrato */
    if (graficoScelto === "substrato") {
      var kmv = kmEffettivo();
      c.strokeStyle = tenue; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(X(kmv), su + h); c.lineTo(X(kmv), Y(valore(kmv))); c.stroke();
      c.beginPath(); c.moveTo(sx, Y(valore(kmv))); c.lineTo(X(kmv), Y(valore(kmv))); c.stroke();
      c.setLineDash([]);
      c.fillStyle = tenue; c.textAlign = "left";
      c.fillText("Km", X(kmv) + 4, su + h - 5);
    }

    /* dove siamo adesso, con l'enzima ridotto com'e' davvero */
    c.beginPath();
    c.arc(X(asse.ora), Y(velocita()), 5, 0, Math.PI * 2);
    c.fillStyle = accento; c.fill();
    if (attivo < 0.99) {
      /* dove saremmo se l'enzima fosse ancora intero */
      c.beginPath();
      c.arc(X(asse.ora), Y(valore(asse.ora)), 4, 0, Math.PI * 2);
      c.strokeStyle = tenue; c.lineWidth = 1.5; c.stroke();
    }
  }

  /* ==========================================================
     7. I numeri e le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

  function racconta() {
    var v = velocita();
    var piena = velocitaTeorica(substrato, enzima.tOttimale, enzima.phOttimale);
    var quota = piena > 0 ? v / piena : 0;

    if (attivo < 0.02) {
      return "L'enzima e' rovinato. Puoi raffreddare quanto vuoi: non torna come prima, perche' la " +
        "catena si e' sformata e non si ripiega da sola. E' lo stesso motivo per cui un uovo sodo non " +
        "torna crudo. Per ricominciare serve enzima nuovo.";
    }
    if (attivo < 0.95) {
      if (rapiditaRovina(temperatura) > 0.005) {
        return "Attenzione: a questa temperatura l'enzima si sta rovinando proprio adesso. Ne e' rimasto " +
          "integro il " + Math.round(attivo * 100) + "%, e quello perso non si recupera piu'.";
      }
      return "Adesso la temperatura non fa piu' danni, ma il danno di prima resta: e' integro solo il " +
        Math.round(attivo * 100) + "%. La velocita' e' percio' molto piu' bassa di quella segnata dalla " +
        "curva, che vale per l'enzima intero. Per tornare al massimo serve enzima nuovo.";
    }
    if (tipoInibitore === "competitivo" && inibitore > 0) {
      return "L'inibitore competitivo si infila nel sito attivo al posto del substrato. Il Km apparente " +
        "e' salito a " + conVirgola(arrotonda(kmEffettivo(), 1)) + " mmol/L, ma il Vmax e' rimasto quello: " +
        "aggiungendo tanto substrato l'enzima torna al massimo. Prova ad alzare il substrato e guarda la curva.";
    }
    if (tipoInibitore === "non competitivo" && inibitore > 0) {
      return "L'inibitore non competitivo si attacca in un altro punto e storce l'enzima. Il Km non cambia, " +
        "ma il Vmax e' sceso a " + Math.round(vmaxEffettivo()) + ": qui il substrato non puo' farci niente, " +
        "per quanto ne aggiungi.";
    }
    if (tipoInibitore === "incompetitivo" && inibitore > 0) {
      return "L'inibitore incompetitivo si attacca solo all'enzima che ha gia' preso il substrato. " +
        "Abbassa tutti e due: Km a " + conVirgola(arrotonda(kmEffettivo(), 1)) + " e Vmax a " +
        Math.round(vmaxEffettivo()) + ".";
    }
    if (fattorePh(ph) < 0.3) {
      return "A pH " + conVirgola(arrotonda(ph, 1)) + " questo enzima e' quasi fermo: lavora bene attorno " +
        "a pH " + conVirgola(enzima.phOttimale) + ". Il pH cambia le cariche elettriche degli amminoacidi, " +
        "e il sito attivo perde la forma che gli serve.";
    }
    if (Math.abs(temperatura - enzima.tOttimale) > 15) {
      return temperatura < enzima.tOttimale
        ? "Fa troppo freddo: le molecole si muovono piano e si incontrano di rado. L'enzima non e' rovinato, " +
          "solo rallentato - scaldando riparte."
        : "Siamo lontani dall'optimum, che per questo enzima e' " + conVirgola(enzima.tOttimale) + " gradi.";
    }
    if (substrato > enzima.km * 6) {
      return "Il substrato e' abbondante: tutti i siti attivi sono occupati quasi sempre, e la velocita' " +
        "e' al " + Math.round(quota * 100) + "% del massimo. Aggiungerne ancora non serve quasi a niente: " +
        "e' la saturazione, il tratto piatto della curva.";
    }
    if (substrato < enzima.km) {
      return "C'e' poco substrato: molti siti attivi restano vuoti e la velocita' cresce quasi in proporzione " +
        "a quanto ne aggiungi. Il Km di questo enzima e' " + conVirgola(enzima.km) + " mmol/L: e' la " +
        "concentrazione alla quale va a meta' velocita'.";
    }
    return "Siamo attorno al Km: la velocita' e' circa meta' del massimo, e la curva sta piegando. " +
      "Da qui in avanti aggiungere substrato rende sempre meno.";
  }

  /* ==========================================================
     8. I comandi
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
    var e = enzimi.filter(function (y) { return y.nome === x.enzima; })[0];
    if (e) enzima = e;
    substrato = x.substrato;
    temperatura = x.temperatura;
    ph = x.ph;
    tipoInibitore = x.inibitore;
    inibitore = x.quantoInibitore;
    graficoScelto = x.grafico;
    if (cursoreS) cursoreS.aggiorna(substrato);
    if (cursoreT) cursoreT.aggiorna(temperatura);
    if (cursorePh) cursorePh.aggiorna(ph);
    if (cursoreI) cursoreI.aggiorna(inibitore);
    creaParticelle();
    creaSagome();
    rimetti();
  }

  function aggiornaScheda() {
    if (!schedaEnzima) return;
    schedaEnzima.textContent = enzima.nome + ": trasforma " + enzima.substrato + " in " +
      enzima.prodotto + ". Km " + conVirgola(enzima.km) + " mmol/L, Vmax " + conVirgola(enzima.vmax) +
      " µmol/min, lavora meglio a " + conVirgola(enzima.tOttimale) + " gradi e a pH " +
      conVirgola(enzima.phOttimale) + ", e sopra " + conVirgola(enzima.tRovina) +
      " gradi comincia a rovinarsi." + (enzima.dove ? " Dove si trova: " + enzima.dove + "." : "");
  }

  function aggiorna() {
    letturaV.textContent = conVirgola(arrotonda(velocita(), 1));
    letturaAttivo.textContent = Math.round(attivo * 100) + "%";
    letturaProdotto.textContent = conVirgola(arrotonda(prodotto, 1));

    pastiglieEnzima.forEach(function (b) {
      b.className = "pillola" + (b.dato === enzima ? " attiva" : "");
    });
    pastiglieInibitore.forEach(function (b) {
      b.className = "pillola" + (b.dato === tipoInibitore ? " attiva" : "");
    });
    pastiglieGrafico.forEach(function (b) {
      b.className = "pillola" + (b.dato === graficoScelto ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    bottoneMoto.textContent = inMoto ? "Metti in pausa" : "Riprendi";
    frase.textContent = racconta();
    aggiornaScheda();

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) {
      adattaTele();
      creaParticelle();
      creaSagome();
    }
    disegnaBanco();
    disegnaGrafico();
  }

  /* il battito: fa passare il tempo e ridisegna */
  var ultimo = 0, daAggiornare = 0;
  function battito(ora) {
    var dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0;
    ultimo = ora;
    if (inMoto && enzima) {
      unPasso(dt);
      muoviScena(dt);
      disegnaBanco();
      daAggiornare += dt;
      if (daAggiornare > 0.25) { daAggiornare = 0; aggiorna(); }
    }
    requestAnimationFrame(battito);
  }

  /* ==========================================================
     9. Costruire la pagina
     ========================================================== */

  function costruisci() {
    svuota(contenitore);
    pastiglieEnzima = []; pastiglieInibitore = []; pastiglieGrafico = []; pastiglieEsp = [];

    var avvisoErrori = App.avvisoErroriFile("enzimi.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Un enzima e' una proteina che fa avvenire in fretta una reazione che da sola andrebbe lentissima. " +
      "Funziona perche' ha una tasca, il sito attivo, fatta apposta per il suo substrato: se quella tasca " +
      "perde la forma, l'enzima smette di funzionare. Qui puoi cambiare le condizioni e guardare cosa succede."));

    /* --- esperimenti pronti --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Esperimenti da provare"));
    var griglia = elemento("div", "griglia-esperimenti");
    ESPERIMENTI.forEach(function (x, i) {
      var b = elemento("button", "carta-esperimento");
      b.type = "button";
      b.appendChild(elemento("div", "esperimento-titolo", x.titolo));
      b.appendChild(elemento("div", "esperimento-sottotitolo", x.sottotitolo));
      b.addEventListener("click", function () {
        esperimentoScelto = i;
        applicaEsperimento(x);
      });
      pastiglieEsp.push(b);
      griglia.appendChild(b);
    });
    contenitore.appendChild(griglia);

    /* --- la scena --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Il banco"));
    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    contenitore.appendChild(elemento("p", "didascalia",
      "I quadrati azzurri sono il substrato, i cerchi verdi il prodotto. Le sagome gialle sono gli enzimi, " +
      "con la tacca del sito attivo. Quando un enzima si rovina perde la forma e diventa grigio."));

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("velocita' (µmol/min)", function (n) { letturaV = n; }));
    letture.appendChild(unaLettura("enzima integro", function (n) { letturaAttivo = n; }));
    letture.appendChild(unaLettura("prodotto (µmol)", function (n) { letturaProdotto = n; }));
    contenitore.appendChild(letture);

    var bottoni = elemento("div", "bottoni");
    bottoneMoto = elemento("button", "bottone", "Metti in pausa");
    bottoneMoto.type = "button";
    bottoneMoto.addEventListener("click", function () { inMoto = !inMoto; aggiorna(); });
    bottoni.appendChild(bottoneMoto);
    var nuovo = elemento("button", "bottone-testo", "Enzima nuovo");
    nuovo.type = "button";
    nuovo.addEventListener("click", function () { creaSagome(); rimetti(); });
    bottoni.appendChild(nuovo);
    contenitore.appendChild(bottoni);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    /* --- il grafico --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Il grafico"));
    var scelteG = elemento("div", "scelte-grandezza");
    [["substrato", "velocita' e substrato"], ["temperatura", "velocita' e temperatura"], ["ph", "velocita' e pH"]]
      .forEach(function (g) {
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
      "Il pallino pieno dice dove sei adesso. Se l'enzima si e' gia' rovinato in parte, compare anche un " +
      "pallino vuoto piu' in alto: e' la velocita' che avresti con l'enzima ancora intero."));

    /* --- quale enzima --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quale enzima"));
    var scelte = elemento("div", "scelte-grandezza");
    enzimi.forEach(function (e) {
      var b = elemento("button", "pillola", e.nome);
      b.type = "button"; b.dato = e;
      b.addEventListener("click", function () {
        enzima = e;
        esperimentoScelto = -1;
        creaSagome();
        rimetti();
      });
      pastiglieEnzima.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);

    schedaEnzima = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaEnzima);

    /* --- le manopole --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le manopole"));
    var comandi = elemento("div", "comandi");
    cursoreS = cursore("Substrato", 0, 40, 0.1, substrato, "mmol/L", function (v) {
      substrato = v; esperimentoScelto = -1; creaParticelle(); aggiorna();
    });
    cursoreT = cursore("Temperatura", 0, 100, 1, temperatura, "°C", function (v) {
      temperatura = v; esperimentoScelto = -1; aggiorna();
    });
    cursorePh = cursore("pH", 0, 14, 0.1, ph, "", function (v) {
      ph = v; esperimentoScelto = -1; aggiorna();
    });
    comandi.appendChild(cursoreS);
    comandi.appendChild(cursoreT);
    comandi.appendChild(cursorePh);
    contenitore.appendChild(comandi);

    /* --- gli inibitori --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "L'inibitore"));
    var scelteI = elemento("div", "scelte-grandezza");
    ["nessuno", "competitivo", "non competitivo", "incompetitivo"].forEach(function (t) {
      var b = elemento("button", "pillola", t);
      b.type = "button"; b.dato = t;
      b.addEventListener("click", function () {
        tipoInibitore = t;
        if (t !== "nessuno" && inibitore === 0) { inibitore = 2; if (cursoreI) cursoreI.aggiorna(2); }
        esperimentoScelto = -1;
        aggiorna();
      });
      pastiglieInibitore.push(b);
      scelteI.appendChild(b);
    });
    contenitore.appendChild(scelteI);

    var comandiI = elemento("div", "comandi");
    cursoreI = cursore("Quanto inibitore", 0, 10, 0.5, inibitore, "mmol/L", function (v) {
      inibitore = v; esperimentoScelto = -1; aggiorna();
    });
    comandiI.appendChild(cursoreI);
    contenitore.appendChild(comandiI);

    contenitore.appendChild(elemento("p", "nota-piccola",
      "Con un inibitore acceso il grafico mostra anche, in grigio, la curva che ci sarebbe senza: " +
      "confrontando le due si vede subito quale dei due numeri e' cambiato, il Km o il Vmax."));

    /* --- i limiti del modello --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Il substrato non si consuma mai: e' come se qualcuno continuasse a rimetterne. In una provetta vera la reazione rallenta da sola man mano che il substrato finisce.",
      "L'optimum di temperatura e la temperatura di rovina qui sono due numeri scritti nel file, presi dai libri. Nella realta' sono due effetti che si intrecciano, e l'optimum che si misura dipende anche da quanto dura la misura.",
      "La campana del pH e' simmetrica. Le curve vere spesso non lo sono, perche' dipendono da piu' amminoacidi che si caricano a pH diversi.",
      "La rovina dell'enzima e' senza ritorno, come nella realta'. Alcuni enzimi pero', se il danno e' piccolo, si ripiegano di nuovo: qui non succede mai.",
      "L'equazione di Michaelis e Menten vale per un enzima con un solo sito attivo e nessuna regolazione. Gli enzimi allosterici, come quelli che regolano le vie metaboliche, danno una curva a esse e non questa.",
      "Le molecole disegnate sono poche e grandi: servono a far vedere il meccanismo, non sono in scala. In una goccia di saliva ci sono miliardi di molecole di enzima."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    creaParticelle();
    creaSagome();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(300, Math.max(190, larghezza * 0.5)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaG = telaG.parentNode.clientWidth;
    altezzaG = Math.round(Math.min(290, Math.max(200, larghezzaG * 0.55)));
    telaG.width = larghezzaG * dpr; telaG.height = altezzaG * dpr;
    telaG.style.width = larghezzaG + "px"; telaG.style.height = altezzaG + "px";
    ctxG = telaG.getContext("2d");
    ctxG.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegnaBanco();
    disegnaGrafico();
  });

  /* ==========================================================
     10. Avvio
     ========================================================== */

  App.caricaTesto("enzimi.txt")
    .then(function (testo) {
      var esito = leggiEnzimi(testo);
      enzimi = esito.elenco;
      erroriFile = esito.errori;

      if (!enzimi.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file enzimi.txt e' stato letto ma non contiene enzimi validi."));
        contenitore.appendChild(avviso);
        return;
      }

      enzima = enzimi[0];
      costruisci();
      applicaEsperimento(ESPERIMENTI[0]);
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("enzimi.txt", errore.message));
    });

})();
