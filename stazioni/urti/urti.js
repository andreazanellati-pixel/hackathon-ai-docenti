/* ============================================================
   La teoria degli urti
   ------------------------------------------------------------
   Perche' una reazione va veloce o lenta. Si regolano temperatura,
   concentrazione e catalizzatore, e si guarda quanti urti finiscono
   in reazione.

   Come funziona, in due parole:
   - la curva di Maxwell e Boltzmann e' quella vera in tre
     dimensioni, la stessa dei libri
   - la frazione di molecole abbastanza energetiche NON e' presa
     da una formuletta a parte: e' l'area sotto quella curva
     oltre l'energia di attivazione, calcolata sommando le
     striscioline. Cosi' il numero scritto e' esattamente l'area
     colorata che si vede
   - la velocita' e' il prodotto di tre cose: quanti urti
     avvengono, quanti sono abbastanza forti, quanti sono girati
     nel verso giusto
   - il catalizzatore abbassa la collina nei DUE versi, quindi
     accelera senza spostare l'equilibrio
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var R = 8.314;            /* J/(mol K) */

  /* ---------- stato ---------- */

  var reazioni = [], erroriFile = [];
  var reazione = null;

  var temperatura = 25;     /* gradi */
  var concentrazione = 1;   /* unita' di comodo, da 0,2 a 3 */
  var catalizzatore = false;
  var esperimentoScelto = 0;
  var inMoto = true;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaC = null, ctxC = null, larghezzaC = 0, altezzaC = 0;
  var telaE = null, ctxE = null, larghezzaE = 0, altezzaE = 0;
  var letturaFrazione = null, letturaUrti = null, letturaVelocita = null;
  var pastiglieReazione = [], pastiglieEsp = [];
  var frase = null, schedaNota = null, bottoneCat = null, bottoneMoto = null;
  var cursoreT = null, cursoreC = null;

  var molecole = [];
  var lampi = [];           /* gli urti utili appena avvenuti, da disegnare */
  var contaUrti = 0, contaUtili = 0;

  /* ==========================================================
     1. Gli esperimenti gia' pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "Dieci gradi in piu'",
      sottotitolo: "La vecchia regola dice che raddoppia. Controlla se e' vero",
      reazione: "Marmo e acido cloridrico", temperatura: 25, concentrazione: 1, catalizzatore: false
    },
    {
      titolo: "Metti il catalizzatore",
      sottotitolo: "La collina si abbassa e la reazione parte all'istante",
      reazione: "Acqua ossigenata che si decompone", temperatura: 25, concentrazione: 1, catalizzatore: false
    },
    {
      titolo: "Raddoppia la concentrazione",
      sottotitolo: "Piu' molecole vuol dire piu' urti, ma non urti piu' forti",
      reazione: "Marmo e acido cloridrico", temperatura: 25, concentrazione: 1, catalizzatore: false
    },
    {
      titolo: "Una collina altissima",
      sottotitolo: "Il metano brucia e libera moltissimo, ma da solo non parte",
      reazione: "Metano che brucia", temperatura: 25, concentrazione: 1, catalizzatore: false
    },
    {
      titolo: "L'orientamento conta",
      sottotitolo: "Qui solo 5 urti forti su 100 sono girati nel verso giusto",
      reazione: "Ammoniaca dal suo azoto", temperatura: 400, concentrazione: 1, catalizzatore: false
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiReazioni(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 6) {
        errori.push("riga " + (i + 1) + ": servono almeno sei parti separate da | .");
        return;
      }
      var ea = numero(p[2]), eaCat = numero(p[3]), dh = numero(p[4]), orient = numero(p[5]);
      if (ea === null || eaCat === null || dh === null || orient === null) {
        errori.push("riga " + (i + 1) + ": le energie, il delta H e l'orientamento devono essere numeri.");
        return;
      }
      if (ea <= 0) {
        errori.push("riga " + (i + 1) + ": l'energia di attivazione deve essere maggiore di zero.");
        return;
      }
      if (eaCat > ea) {
        errori.push("riga " + (i + 1) + ": con il catalizzatore l'energia di attivazione non puo' essere piu' alta.");
        return;
      }
      if (orient <= 0 || orient > 1) {
        errori.push("riga " + (i + 1) + ": l'orientamento deve stare fra 0 e 1.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        equazione: p[1].trim(),
        ea: ea, eaCat: eaCat,
        deltaH: dh,
        orientamento: orient,
        nota: p.length > 6 ? p[6].trim() : ""
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. La fisica
     ========================================================== */

  function kelvin() { return temperatura + 273.15; }

  function collina() {
    return (catalizzatore ? reazione.eaCat : reazione.ea) * 1000;   /* J/mol */
  }

  /* La distribuzione di Maxwell e Boltzmann delle energie, in tre
     dimensioni: quella disegnata nei libri. Non e' normalizzata
     qui dentro, ci pensa l'integrale. */
  function maxwell(e, rt) {
    return Math.sqrt(e) * Math.exp(-e / rt);
  }

  /* La frazione di molecole con energia oltre la collina.
     Si somma l'area sotto la curva a striscioline, cosi' il
     numero e' esattamente l'area che si vede colorata. */
  function frazioneUtile() {
    var rt = R * kelvin();
    var eMax = Math.max(collina() * 1.6, rt * 22);
    var passi = 3000;
    var dE = eMax / passi;
    var tutta = 0, oltre = 0;
    for (var i = 0; i < passi; i++) {
      var e = (i + 0.5) * dE;
      var y = maxwell(e, rt) * dE;
      tutta += y;
      if (e >= collina()) oltre += y;
    }
    if (tutta <= 0) return 0;
    return oltre / tutta;
  }

  /* Quanti urti avvengono, in unita' di comodo: crescono col
     quadrato della concentrazione e con la radice della
     temperatura, perche' piu' caldo vuol dire piu' veloci. */
  function urtiAlSecondo() {
    return 1000 * concentrazione * concentrazione * Math.sqrt(kelvin() / 298.15);
  }

  function velocitaReazione() {
    return urtiAlSecondo() * frazioneUtile() * reazione.orientamento;
  }

  /* Di quante volte crescerebbe la velocita' scaldando di dieci
     gradi. La vecchia regola di scuola dice «il doppio», ma il
     doppio vale solo per certe colline: qui il numero si calcola,
     e si vede che dipende da quanto e' alta. */
  function rapportoDieciGradi() {
    var prima = velocitaReazione();
    temperatura += 10;
    var dopo = velocitaReazione();
    temperatura -= 10;
    return prima > 0 ? dopo / prima : 0;
  }

  /* ==========================================================
     4. Il recipiente con le molecole
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function creaMolecole() {
    molecole = [];
    var quante = Math.round(10 + concentrazione * 26);
    for (var i = 0; i < quante; i++) {
      molecole.push({
        x: 0.05 + Math.random() * 0.9,
        y: 0.05 + Math.random() * 0.9,
        dir: Math.random() * Math.PI * 2,
        /* la velocita' e' estratta a caso, non uguale per tutti:
           e' questo che fa la coda della curva */
        v: velocitaCasuale()
      });
    }
    lampi = [];
    contaUrti = 0; contaUtili = 0;
  }

  /* Una velocita' pescata dalla distribuzione, col metodo del
     rifiuto: si tira a caso finche' il punto non cade sotto la
     curva. */
  function velocitaCasuale() {
    for (var tentativi = 0; tentativi < 60; tentativi++) {
      var v = Math.random() * 3;
      var p = v * v * Math.exp(-v * v * 1.5);
      if (Math.random() * 0.35 < p) return 0.15 + v * 0.5;
    }
    return 0.5;
  }

  function muoviMolecole(dt) {
    var spinta = 0.16 * Math.sqrt(kelvin() / 298.15);
    molecole.forEach(function (m) {
      m.x += Math.cos(m.dir) * m.v * spinta * dt;
      m.y += Math.sin(m.dir) * m.v * spinta * dt;
      if (m.x < 0.03) { m.x = 0.03; m.dir = Math.PI - m.dir; }
      if (m.x > 0.97) { m.x = 0.97; m.dir = Math.PI - m.dir; }
      if (m.y < 0.03) { m.y = 0.03; m.dir = -m.dir; }
      if (m.y > 0.97) { m.y = 0.97; m.dir = -m.dir; }
    });

    /* gli urti: due molecole vicine si scontrano */
    var f = frazioneUtile();
    for (var i = 0; i < molecole.length; i++) {
      for (var j = i + 1; j < molecole.length; j++) {
        var a = molecole[i], b = molecole[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy > 0.0016) continue;
        if (a.appenaUrtato || b.appenaUrtato) continue;
        a.appenaUrtato = 6; b.appenaUrtato = 6;
        contaUrti++;
        a.dir += Math.PI * (0.6 + Math.random() * 0.8);
        b.dir += Math.PI * (0.6 + Math.random() * 0.8);
        /* l'urto e' utile se e' abbastanza energetico e se le due
           molecole sono girate nel verso giusto */
        if (Math.random() < f && Math.random() < reazione.orientamento) {
          contaUtili++;
          lampi.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, eta: 0 });
          a.v = velocitaCasuale(); b.v = velocitaCasuale();
        }
      }
    }
    molecole.forEach(function (m) { if (m.appenaUrtato) m.appenaUrtato--; });
    lampi.forEach(function (l) { l.eta += dt; });
    lampi = lampi.filter(function (l) { return l.eta < 0.6; });
    if (lampi.length > 40) lampi = lampi.slice(-40);
  }

  function disegnaRecipiente() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);

    var caldo = Math.min(1, Math.max(0, (temperatura + 50) / 700));
    c.fillStyle = "rgb(" + Math.round(244 + caldo * 11) + "," +
      Math.round(244 - caldo * 26) + "," + Math.round(238 - caldo * 44) + ")";
    c.fillRect(0, 0, larghezza, altezza);

    var tenue = coloreTema("--testo-tenue", "#6b645a");

    molecole.forEach(function (m) {
      c.fillStyle = m.appenaUrtato ? "#d9a441" : "#4c8fbd";
      c.beginPath();
      c.arc(m.x * larghezza, m.y * altezza, 5, 0, Math.PI * 2);
      c.fill();
    });

    lampi.forEach(function (l) {
      var q = 1 - l.eta / 0.6;
      c.strokeStyle = "rgba(200, 120, 40, " + q.toFixed(2) + ")";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(l.x * larghezza, l.y * altezza, 6 + (1 - q) * 14, 0, Math.PI * 2);
      c.stroke();
    });

    c.fillStyle = tenue;
    c.font = "600 12px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText(Math.round(temperatura) + " °C" + (catalizzatore ? " · col catalizzatore" : ""), 10, 18);
    c.textAlign = "right";
    var quota = contaUrti > 0 ? Math.round(contaUtili / contaUrti * 100) : 0;
    c.fillText(contaUtili + " urti utili su " + contaUrti + " (" + quota + "%)", larghezza - 10, 18);
  }

  /* ==========================================================
     5. La curva di Maxwell e Boltzmann
     ========================================================== */

  function disegnaCurva() {
    if (!ctxC || larghezzaC <= 0) return;
    var c = ctxC;
    c.clearRect(0, 0, larghezzaC, altezzaC);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaC, altezzaC);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var accento = coloreTema("--accento", "#1f5f8b");

    var sx = 42, dx = 12, su = 16, giu = 32;
    var w = larghezzaC - sx - dx, h = altezzaC - su - giu;

    var rt = R * kelvin();
    /* l'asse arriva sempre oltre la collina, cosi' la si vede */
    var eMax = Math.max(collina() * 1.5, R * (Math.max(temperatura, 25) + 273.15) * 14);

    /* si cerca il massimo della curva alla temperatura piu' bassa
       fra quelle interessanti, per tenere la scala ferma */
    var yMax = 0;
    for (var s = 0; s <= 300; s++) {
      var ee = eMax * s / 300;
      var yy = maxwell(ee, rt);
      if (yy > yMax) yMax = yy;
    }
    if (yMax <= 0) yMax = 1;

    function X(e) { return sx + w * e / eMax; }
    function Y(y) { return su + h * (1 - y / (yMax * 1.1)); }

    /* la griglia coi numeri */
    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "center";
    for (var g = 0; g <= 5; g++) {
      var e = eMax * g / 5;
      c.beginPath(); c.moveTo(X(e), su); c.lineTo(X(e), su + h); c.stroke();
      c.fillText(String(Math.round(e / 1000)), X(e), su + h + 14);
    }
    c.fillText("energia delle molecole (kJ/mol)", sx + w / 2, altezzaC - 4);
    c.save();
    c.translate(11, su + h / 2); c.rotate(-Math.PI / 2);
    c.fillText("quante molecole", 0, 0);
    c.restore();

    /* l'area oltre la collina, che e' il numero scritto sopra */
    var ea = collina();
    if (ea < eMax) {
      c.beginPath();
      c.moveTo(X(ea), su + h);
      for (var i = 0; i <= 200; i++) {
        var ei = ea + (eMax - ea) * i / 200;
        c.lineTo(X(ei), Y(maxwell(ei, rt)));
      }
      c.lineTo(X(eMax), su + h);
      c.closePath();
      c.fillStyle = "rgba(200, 120, 40, 0.38)";
      c.fill();
    }

    /* la curva */
    c.strokeStyle = accento; c.lineWidth = 2.5;
    c.beginPath();
    for (var j = 0; j <= 300; j++) {
      var ej = eMax * j / 300;
      if (j === 0) c.moveTo(X(ej), Y(maxwell(ej, rt))); else c.lineTo(X(ej), Y(maxwell(ej, rt)));
    }
    c.stroke();

    /* la riga della collina */
    if (ea < eMax) {
      c.strokeStyle = "#c06a28"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(X(ea), su); c.lineTo(X(ea), su + h); c.stroke();
      c.fillStyle = "#c06a28"; c.textAlign = "left";
      c.font = "600 10px system-ui, sans-serif";
      c.fillText("Ea = " + conVirgola(arrotonda(ea / 1000, 0)) + " kJ/mol", X(ea) + 4, su + 10);
    }
  }

  /* ==========================================================
     6. Il profilo di energia
     ========================================================== */

  function disegnaProfilo() {
    if (!ctxE || larghezzaE <= 0) return;
    var c = ctxE;
    c.clearRect(0, 0, larghezzaE, altezzaE);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaE, altezzaE);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var accento = coloreTema("--accento", "#1f5f8b");

    var sx = 46, dx = 14, su = 18, giu = 28;
    var w = larghezzaE - sx - dx, h = altezzaE - su - giu;

    var dh = reazione.deltaH;
    var cima = reazione.ea;
    var alto = Math.max(cima, cima + dh, 10) * 1.15;
    var basso = Math.min(0, dh) - Math.abs(dh) * 0.15 - 5;

    function X(q) { return sx + w * q; }
    function Y(e) { return su + h * (1 - (e - basso) / (alto - basso)); }

    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var i = 0; i <= 4; i++) {
      var e = basso + (alto - basso) * i / 4;
      c.beginPath(); c.moveTo(sx, Y(e)); c.lineTo(sx + w, Y(e)); c.stroke();
      c.fillText(String(Math.round(e)), sx - 5, Y(e) + 3);
    }
    c.textAlign = "center";
    c.fillText("come procede la reazione", sx + w / 2, altezzaE - 4);
    c.save();
    c.translate(12, su + h / 2); c.rotate(-Math.PI / 2);
    c.fillText("energia (kJ/mol)", 0, 0);
    c.restore();

    /* una collina per ogni cammino: senza e con catalizzatore */
    function cammino(picco, colore, spesso, tratteggio) {
      c.strokeStyle = colore; c.lineWidth = spesso;
      if (tratteggio) c.setLineDash([5, 4]); else c.setLineDash([]);
      c.beginPath();
      for (var q = 0; q <= 240; q++) {
        var t = q / 240;
        var base = dh * (t < 0.5 ? 0 : 1);
        var lisc = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, (t - 0.2) / 0.6)));
        base = dh * lisc;
        var gobba = picco * Math.exp(-Math.pow((t - 0.5) / 0.17, 2));
        var e = base + gobba;
        if (q === 0) c.moveTo(X(t), Y(e)); else c.lineTo(X(t), Y(e));
      }
      c.stroke();
      c.setLineDash([]);
    }

    cammino(reazione.ea, catalizzatore ? bordo : accento, catalizzatore ? 2 : 3, catalizzatore);
    if (reazione.eaCat < reazione.ea) {
      cammino(reazione.eaCat, catalizzatore ? "#c06a28" : bordo, catalizzatore ? 3 : 2, !catalizzatore);
    }

    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText("reagenti", sx + 2, Y(0) - 6);
    c.textAlign = "right";
    c.fillText("prodotti", sx + w - 2, Y(dh) - 6);
    c.textAlign = "center";
    c.fillText("delta H = " + (dh > 0 ? "+" : "") + conVirgola(dh) + " kJ/mol", sx + w / 2, altezzaE - 16);
  }

  /* ==========================================================
     7. Le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

  function bello(v) {
    if (!isFinite(v)) return "—";
    if (v === 0) return "0";
    var a = Math.abs(v);
    if (a < 1e-4) {
      var esp = Math.floor(Math.log(a) / Math.LN10);
      return conVirgola(arrotonda(v / Math.pow(10, esp), 1)) + " · 10^" + esp;
    }
    if (a >= 1e6) {
      var e2 = Math.floor(Math.log(a) / Math.LN10);
      return conVirgola(arrotonda(v / Math.pow(10, e2), 1)) + " · 10^" + e2;
    }
    if (a >= 1000) return conVirgola(arrotonda(v, 0));
    if (a >= 10) return conVirgola(arrotonda(v, 1));
    if (a >= 1) return conVirgola(arrotonda(v, 2));
    return conVirgola(arrotonda(v, 5));
  }

  function racconta() {
    var f = frazioneUtile();
    var suQuante = f > 0 ? Math.round(1 / f) : 0;

    if (f < 1e-9) {
      return "A questa temperatura la collina e' troppo alta: praticamente nessuna molecola ce la fa, " +
        "e la reazione non parte. " + (reazione.eaCat < reazione.ea
          ? "Prova ad accendere il catalizzatore, oppure a scaldare."
          : "Qui non c'e' catalizzatore che tenga: bisogna scaldare, e parecchio.");
    }
    if (f < 1e-4) {
      return "Solo una molecola su " + bello(1 / f) + " ha abbastanza energia. La reazione c'e', " +
        "ma e' lentissima: guarda com'e' sottile la coda colorata a destra della riga arancione.";
    }
    if (catalizzatore) {
      return "Con il catalizzatore la collina e' scesa da " + conVirgola(reazione.ea) + " a " +
        conVirgola(reazione.eaCat) + " kJ/mol, e adesso ce la fa una molecola su " + suQuante +
        ". Attenzione a una cosa: il catalizzatore abbassa la collina in tutti e due i versi, quindi " +
        "accelera anche la reazione contraria. Per questo fa arrivare prima all'equilibrio, ma non " +
        "sposta l'equilibrio di un millimetro, e il delta H resta lo stesso.";
    }
    return "Ce la fa una molecola su " + suQuante + ". La velocita' e' il prodotto di tre cose: quanti " +
      "urti avvengono, quanti sono abbastanza forti, e quanti sono girati nel verso giusto. Qui " +
      "l'orientamento giusto capita " + Math.round(reazione.orientamento * 100) + " volte su 100.";
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
    var r = reazioni.filter(function (y) { return y.nome === x.reazione; })[0];
    if (r) reazione = r;
    temperatura = x.temperatura;
    concentrazione = x.concentrazione;
    catalizzatore = x.catalizzatore;
    if (cursoreT) cursoreT.aggiorna(temperatura);
    if (cursoreC) cursoreC.aggiorna(concentrazione);
    creaMolecole();
    aggiorna();
  }

  function aggiorna() {
    var f = frazioneUtile();
    letturaFrazione.textContent = f > 0 ? "1 su " + bello(1 / f) : "nessuna";
    letturaUrti.textContent = bello(urtiAlSecondo());
    letturaVelocita.textContent = bello(velocitaReazione());

    pastiglieReazione.forEach(function (b) {
      b.className = "pillola" + (b.dato === reazione ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    bottoneCat.textContent = catalizzatore ? "Togli il catalizzatore" : "Metti il catalizzatore";
    bottoneCat.disabled = reazione.eaCat >= reazione.ea;
    bottoneMoto.textContent = inMoto ? "Metti in pausa" : "Riprendi";

    /* La regola dei dieci gradi va sempre in fondo, qualunque sia
       la situazione: e' il confronto piu' istruttivo fra reazioni
       con colline diverse. */
    var salto = rapportoDieciGradi();
    frase.textContent = racconta() + (f > 0 && salto > 0
      ? " Da qui, dieci gradi in piu' farebbero diventare la velocita' " +
        conVirgola(arrotonda(salto, 2)) + " volte quella di adesso."
      : "");
    schedaNota.textContent = reazione.equazione + ". " +
      (reazione.nota ? reazione.nota.charAt(0).toUpperCase() + reazione.nota.slice(1) + "." : "");

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegnaRecipiente();
    disegnaCurva();
    disegnaProfilo();
  }

  var ultimo = 0, daAggiornare = 0;
  function battito(ora) {
    var dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0;
    ultimo = ora;
    if (inMoto && reazione) {
      muoviMolecole(dt * 60);
      disegnaRecipiente();
      daAggiornare += dt;
      if (daAggiornare > 0.4) { daAggiornare = 0; aggiorna(); }
    }
    requestAnimationFrame(battito);
  }

  /* ==========================================================
     9. Costruire la pagina
     ========================================================== */

  function costruisci() {
    svuota(contenitore);
    pastiglieReazione = []; pastiglieEsp = [];

    var avvisoErrori = App.avvisoErroriFile("reazioni-urti.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Perche' certe reazioni sono fulminee e altre non partono mai? Perche' due molecole reagiscano " +
      "non basta che si incontrino: devono urtarsi abbastanza forte da rompere i legami che hanno, e " +
      "devono essere girate nel verso giusto. Tutto il resto viene da qui."));

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

    /* --- il recipiente --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le molecole che si urtano"));
    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);
    contenitore.appendChild(elemento("p", "didascalia",
      "Ogni cerchietto arancione e' una molecola che ha appena urtato. L'anello che si allarga segna " +
      "un urto andato a buon fine: abbastanza forte e girato nel verso giusto."));

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("molecole abbastanza energetiche", function (n) { letturaFrazione = n; }));
    letture.appendChild(unaLettura("urti al secondo", function (n) { letturaUrti = n; }));
    letture.appendChild(unaLettura("velocita' della reazione", function (n) { letturaVelocita = n; }));
    contenitore.appendChild(letture);

    var bottoni = elemento("div", "bottoni");
    bottoneCat = elemento("button", "bottone", "Metti il catalizzatore");
    bottoneCat.type = "button";
    bottoneCat.addEventListener("click", function () {
      catalizzatore = !catalizzatore;
      esperimentoScelto = -1;
      contaUrti = 0; contaUtili = 0;
      aggiorna();
    });
    bottoni.appendChild(bottoneCat);

    bottoneMoto = elemento("button", "bottone-testo", "Metti in pausa");
    bottoneMoto.type = "button";
    bottoneMoto.addEventListener("click", function () { inMoto = !inMoto; aggiorna(); });
    bottoni.appendChild(bottoneMoto);

    var azzera = elemento("button", "bottone-testo", "Rimescola");
    azzera.type = "button";
    azzera.addEventListener("click", function () { creaMolecole(); aggiorna(); });
    bottoni.appendChild(azzera);
    contenitore.appendChild(bottoni);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    /* --- la curva --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Chi ce la fa e chi no"));
    var scatolaC = elemento("div", "scatola-grafico");
    telaC = elemento("canvas", "tela");
    scatolaC.appendChild(telaC);
    contenitore.appendChild(scatolaC);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Questa e' la curva di Maxwell e Boltzmann: dice quante molecole hanno ciascuna energia. " +
      "Non hanno tutte la stessa: alcune sono lente, poche sono velocissime. La riga arancione e' la " +
      "collina da scavalcare, e la zona colorata a destra sono le molecole che ce la fanno. " +
      "Scaldando la curva si appiattisce verso destra, e quella zona cresce moltissimo anche per " +
      "pochi gradi: e' tutto qui il motivo per cui il caldo accelera le reazioni."));

    /* --- il profilo --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La collina da scavalcare"));
    var scatolaE = elemento("div", "scatola-grafico");
    telaE = elemento("canvas", "tela");
    scatolaE.appendChild(telaE);
    contenitore.appendChild(scatolaE);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Il cammino tratteggiato e' l'altra strada, quella che non stai usando. Il catalizzatore " +
      "abbassa la collina ma lascia i prodotti dove sono: il dislivello fra partenza e arrivo, il " +
      "delta H, non cambia. Per questo un catalizzatore fa arrivare prima all'equilibrio senza " +
      "spostarlo, e per questo non si consuma."));

    /* --- le manopole --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le manopole"));
    var comandi = elemento("div", "comandi");
    cursoreT = cursore("Temperatura", -50, 800, 5, temperatura, "°C", function (v) {
      temperatura = v; esperimentoScelto = -1; contaUrti = 0; contaUtili = 0; aggiorna();
    });
    cursoreC = cursore("Concentrazione", 0.2, 3, 0.1, concentrazione, "volte", function (v) {
      concentrazione = v; esperimentoScelto = -1; creaMolecole(); aggiorna();
    });
    comandi.appendChild(cursoreT);
    comandi.appendChild(cursoreC);
    contenitore.appendChild(comandi);

    /* --- quale reazione --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quale reazione"));
    var scelte = elemento("div", "scelte-grandezza");
    reazioni.forEach(function (r) {
      var b = elemento("button", "pillola", r.nome);
      b.type = "button"; b.dato = r;
      b.addEventListener("click", function () {
        reazione = r;
        esperimentoScelto = -1;
        catalizzatore = false;
        creaMolecole();
        aggiorna();
      });
      pastiglieReazione.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);
    schedaNota = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaNota);

    /* --- i limiti --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Il disegno delle molecole e' in due dimensioni e con poche palline: serve a far vedere il meccanismo. La curva di Maxwell e Boltzmann invece e' quella vera a tre dimensioni, e la frazione scritta e' l'area colorata sotto di essa, calcolata sommando le striscioline.",
      "La percentuale di urti utili contata nel disegno e' tirata a sorte con la probabilita' giusta, quindi balla un po' da un momento all'altro. Il numero da guardare e' quello calcolato sopra, non quello contato sul disegno.",
      "Gli urti al secondo sono in unita' di comodo, non in urti veri al secondo: servono per confrontare fra loro le situazioni, non per dare un valore assoluto.",
      "L'energia di attivazione e' considerata la stessa a ogni temperatura. Nella realta' cambia un poco.",
      "La reazione e' trattata come se avvenisse in un urto solo. Quasi tutte procedono invece per passaggi, e quello piu' lento fa da collo di bottiglia.",
      "Il fattore di orientamento e' un numero unico. Nella realta' dipende da come le due molecole si avvicinano, e certi angoli vanno molto meglio di altri."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    function prepara(t, rapporto, massimo) {
      var l = t.parentNode.clientWidth;
      var a = Math.round(Math.min(massimo, Math.max(190, l * rapporto)));
      t.width = l * dpr; t.height = a * dpr;
      t.style.width = l + "px"; t.style.height = a + "px";
      var c = t.getContext("2d");
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { c: c, l: l, a: a };
    }

    var uno = prepara(tela, 0.55, 300);
    ctx = uno.c; larghezza = uno.l; altezza = uno.a;
    var due = prepara(telaC, 0.55, 290);
    ctxC = due.c; larghezzaC = due.l; altezzaC = due.a;
    var tre = prepara(telaE, 0.5, 260);
    ctxE = tre.c; larghezzaE = tre.l; altezzaE = tre.a;
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegnaRecipiente(); disegnaCurva(); disegnaProfilo();
  });

  /* ==========================================================
     10. Avvio
     ========================================================== */

  App.caricaTesto("reazioni-urti.txt")
    .then(function (testo) {
      var esito = leggiReazioni(testo);
      reazioni = esito.elenco;
      erroriFile = esito.errori;

      if (!reazioni.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file reazioni-urti.txt e' stato letto ma non contiene reazioni valide."));
        contenitore.appendChild(avviso);
        return;
      }

      reazione = reazioni[0];
      costruisci();
      applicaEsperimento(ESPERIMENTI[0]);
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("reazioni-urti.txt", errore.message));
    });

})();
