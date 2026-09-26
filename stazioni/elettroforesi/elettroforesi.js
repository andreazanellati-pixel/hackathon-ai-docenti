/* ============================================================
   Elettroforesi e PCR
   ------------------------------------------------------------
   Prima si moltiplica il DNA con la PCR, poi lo si fa correre
   nel gel e si guarda dove si ferma. Alla fine si confrontano
   le bande e si risponde a una domanda.

   Come funziona, in due parole:
   - la PCR raddoppia a ogni ciclo, e il conto e' proprio due
     elevato al numero di cicli. Trenta cicli da una molecola
     sola fanno piu' di un miliardo di copie: il numero e'
     calcolato, non scritto
   - nel gel un pezzo di DNA corre tanto piu' lontano quanto
     piu' e' corto, e la distanza segue il logaritmo della
     lunghezza. E' per questo che la scala di riferimento ha le
     bande fitte in basso e larghe in alto
   - le lunghezze dei campioni stanno in campioni.txt: cambiando
     quelle si prepara un caso nuovo, che gli studenti non
     possono avere gia' visto
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var LUNGO = 10000, CORTO = 100;   /* estremi del gel, in paia di basi */

  /* ---------- stato ---------- */

  var campioni = [], erroriFile = [];
  var cicli = 25;
  var molecoleIniziali = 10;
  var minuti = 45;           /* quanto si lascia correre il gel */
  var volt = 100;
  var risposta = null;       /* il campione indicato dall'utente */
  var scoperto = false;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaP = null, ctxP = null, larghezzaP = 0, altezzaP = 0;
  var letturaCopie = null, letturaCorsa = null, letturaEsito = null;
  var pastiglieRisposta = [];
  var frase = null, tabellaScala = null;
  var cursoreC = null, cursoreMol = null, cursoreMin = null, cursoreV = null;

  /* ==========================================================
     1. Leggere il file di contenuto
     ========================================================== */

  function leggiCampioni(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 4) {
        errori.push("riga " + (i + 1) + ": servono quattro parti separate da | .");
        return;
      }
      var tipo = p[1].trim().toLowerCase();
      if (["scala", "traccia", "campione"].indexOf(tipo) < 0) {
        errori.push("riga " + (i + 1) + ": il tipo deve essere «scala», «traccia» oppure «campione».");
        return;
      }
      var pezzi = p[2].split(",").map(function (x) {
        return parseFloat(x.trim().replace(",", "."));
      });
      var cattivo = pezzi.filter(function (x) { return isNaN(x) || x <= 0; });
      if (!pezzi.length || cattivo.length) {
        errori.push("riga " + (i + 1) + ": le lunghezze devono essere numeri maggiori di zero, separati da virgole.");
        return;
      }
      pezzi.sort(function (a, b) { return b - a; });
      elenco.push({
        nome: p[0].trim(),
        tipo: tipo,
        pezzi: pezzi,
        descrizione: p[3].trim()
      });
    });
    return { elenco: elenco, errori: errori };
  }

  function laScala() { return campioni.filter(function (c) { return c.tipo === "scala"; })[0] || null; }
  function laTraccia() { return campioni.filter(function (c) { return c.tipo === "traccia"; })[0] || null; }
  function iCampioni() { return campioni.filter(function (c) { return c.tipo === "campione"; }); }

  /* Chi combacia con la traccia: si confrontano le lunghezze,
     non i nomi. */
  function chiCombacia() {
    var t = laTraccia();
    if (!t) return null;
    var trovato = null;
    iCampioni().forEach(function (c) {
      if (c.pezzi.length !== t.pezzi.length) return;
      var uguali = true;
      c.pezzi.forEach(function (x, i) { if (Math.abs(x - t.pezzi[i]) > 0.5) uguali = false; });
      if (uguali) trovato = c;
    });
    return trovato;
  }

  /* ==========================================================
     2. La PCR
     ========================================================== */

  function copie() {
    return molecoleIniziali * Math.pow(2, cicli);
  }

  function copieBelle() {
    var n = copie();
    if (n < 1e4) return Math.round(n).toLocaleString("it-IT");
    var esp = Math.floor(Math.log(n) / Math.LN10);
    var mant = n / Math.pow(10, esp);
    return conVirgola(arrotonda(mant, 1)) + " · 10^" + esp;
  }

  /* ==========================================================
     3. La corsa nel gel
     ------------------------------------------------------------
     Un pezzo di DNA si infila fra le maglie del gel: piu' e'
     corto, piu' passa agevolmente e piu' va lontano. La distanza
     segue il logaritmo della lunghezza, e per questo le bande
     corte stanno fitte in fondo.
     ========================================================== */

  function quantoCorre(lunghezza) {
    var l = Math.max(CORTO * 0.35, Math.min(LUNGO * 1.6, lunghezza));
    var q = (Math.log(LUNGO) - Math.log(l)) / (Math.log(LUNGO) - Math.log(CORTO));
    /* quanto tempo e quanta tensione: spostano tutto insieme,
       senza cambiare l'ordine */
    var spinta = (minuti / 45) * (volt / 100);
    return Math.max(0, Math.min(1.08, q * spinta));
  }

  /* ==========================================================
     4. Il disegno del gel
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function corsie() {
    var elenco = [];
    var s = laScala(), t = laTraccia();
    if (s) elenco.push(s);
    if (t) elenco.push(t);
    iCampioni().forEach(function (c) { elenco.push(c); });
    return elenco;
  }

  function disegnaGel() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);

    /* il gel, illuminato dall'ultravioletto */
    c.fillStyle = "#101c16";
    c.fillRect(0, 0, larghezza, altezza);

    var elenco = corsie();
    if (!elenco.length) return;

    var su = 34, giu = 26;
    var h = altezza - su - giu;
    var largoCorsia = larghezza / (elenco.length + 0.5);
    var largoBanda = largoCorsia * 0.62;

    elenco.forEach(function (campione, k) {
      var cx = largoCorsia * (k + 0.75);

      /* il pozzetto dove e' stato caricato */
      c.fillStyle = "#050a08";
      c.fillRect(cx - largoBanda / 2, su - 10, largoBanda, 8);

      /* il nome della corsia */
      c.fillStyle = "#b9c9bf";
      c.font = "9px system-ui, sans-serif";
      c.textAlign = "center";
      var nomeBreve = campione.nome.replace("Scala di riferimento", "scala")
        .replace("Traccia trovata", "traccia").replace("Campione ", "camp. ");
      c.fillText(nomeBreve, cx, su - 15);

      /* le bande */
      campione.pezzi.forEach(function (lung) {
        var y = su + h * quantoCorre(lung);
        if (y > su + h) return;          /* uscita dal gel */
        var luminosita = campione.tipo === "scala" ? 0.55 : 0.92;
        var g = c.createLinearGradient(0, y - 4, 0, y + 4);
        g.addColorStop(0, "rgba(140, 240, 180, 0)");
        g.addColorStop(0.5, "rgba(170, 255, 200, " + luminosita + ")");
        g.addColorStop(1, "rgba(140, 240, 180, 0)");
        c.fillStyle = g;
        c.fillRect(cx - largoBanda / 2, y - 4, largoBanda, 8);
      });

      /* i numeri della scala, solo sulla prima corsia */
      if (campione.tipo === "scala") {
        c.fillStyle = "rgba(200, 220, 210, 0.85)";
        c.font = "8px system-ui, sans-serif";
        c.textAlign = "right";
        campione.pezzi.forEach(function (lung) {
          var y = su + h * quantoCorre(lung);
          if (y > su + h) return;
          c.fillText(String(lung), cx - largoBanda / 2 - 3, y + 3);
        });
      }
    });

    /* i poli */
    c.fillStyle = "#c9d6cf";
    c.font = "600 10px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText("−  qui si carica", 6, 12);
    c.textAlign = "right";
    c.fillText("+  il DNA corre in questa direzione", larghezza - 6, altezza - 8);

    /* la freccia del verso */
    c.strokeStyle = "rgba(200,220,210,0.5)"; c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(larghezza - 14, su); c.lineTo(larghezza - 14, su + h);
    c.stroke();
    c.beginPath();
    c.moveTo(larghezza - 14, su + h);
    c.lineTo(larghezza - 18, su + h - 6);
    c.lineTo(larghezza - 10, su + h - 6);
    c.closePath();
    c.fillStyle = "rgba(200,220,210,0.5)"; c.fill();
  }

  /* ==========================================================
     5. Il grafico della PCR
     ========================================================== */

  function disegnaPcr() {
    if (!ctxP || larghezzaP <= 0) return;
    var c = ctxP;
    c.clearRect(0, 0, larghezzaP, altezzaP);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaP, altezzaP);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var accento = coloreTema("--accento", "#1f5f8b");

    var sx = 48, dx = 14, su = 16, giu = 32;
    var w = larghezzaP - sx - dx, h = altezzaP - su - giu;

    var maxEsp = 14;
    function X(n) { return sx + w * n / 40; }
    function Y(esp) { return su + h * (1 - esp / maxEsp); }

    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var e = 0; e <= maxEsp; e += 2) {
      c.beginPath(); c.moveTo(sx, Y(e)); c.lineTo(sx + w, Y(e)); c.stroke();
      c.fillText("10^" + e, sx - 4, Y(e) + 3);
    }
    c.textAlign = "center";
    for (var j = 0; j <= 40; j += 10) {
      c.beginPath(); c.moveTo(X(j), su); c.lineTo(X(j), su + h); c.stroke();
      c.fillText(String(j), X(j), su + h + 14);
    }
    c.fillText("cicli di PCR", sx + w / 2, altezzaP - 4);
    c.save();
    c.translate(12, su + h / 2); c.rotate(-Math.PI / 2);
    c.fillText("quante copie", 0, 0);
    c.restore();

    /* la curva: su scala logaritmica il raddoppio e' una retta */
    c.strokeStyle = accento; c.lineWidth = 2.6;
    c.beginPath();
    for (var n = 0; n <= 40; n++) {
      var esp = Math.log(molecoleIniziali * Math.pow(2, n)) / Math.LN10;
      if (n === 0) c.moveTo(X(n), Y(esp)); else c.lineTo(X(n), Y(esp));
    }
    c.stroke();

    var espOra = Math.log(copie()) / Math.LN10;
    c.beginPath();
    c.arc(X(cicli), Y(Math.min(maxEsp, espOra)), 5, 0, Math.PI * 2);
    c.fillStyle = accento; c.fill();

    c.fillStyle = tenue; c.font = "9px system-ui, sans-serif"; c.textAlign = "left";
    c.fillText("su questa scala ogni tacca vale dieci volte: il raddoppio diventa una retta", sx, 10);
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
    var giusto = chiCombacia();

    if (scoperto) {
      if (risposta === giusto) {
        return "Esatto. " + (giusto ? giusto.nome : "") + " ha le bande nelle stesse identiche " +
          "posizioni della traccia, tutte e cinque. Nota che non hai dovuto misurare niente: e' bastato " +
          "guardare se le righe erano allineate. E' cosi' che si fa davvero, e la scala serve solo " +
          "quando bisogna scrivere un numero in un referto.";
      }
      return "Non era quello. Il campione che combacia e' " + (giusto ? giusto.nome : "nessuno") +
        ". Guarda meglio: due campioni possono avere quasi tutte le bande uguali e differire per una " +
        "sola, ed e' proprio quella a fare la differenza. Prova a coprire con un dito le bande che " +
        "combaciano e a confrontare solo quelle che restano.";
    }

    if (copie() < 1e6) {
      return "Attenzione: con " + cicli + " cicli hai ottenuto " + copieBelle() + " copie, e sono " +
        "poche. Sul gel le bande si vedono appena. Serve abbastanza DNA perche' il colorante si " +
        "accumuli e la banda diventi visibile: prova ad aumentare i cicli e guarda le bande " +
        "illuminarsi.";
    }

    return "Il gel e' pronto. In prima corsia c'e' la scala di riferimento, con i pezzi di lunghezza " +
      "nota: serve da righello. Poi c'e' la traccia, e poi i campioni da confrontare. " +
      "Guarda le posizioni delle bande e dimmi quale campione corrisponde alla traccia.";
  }

  /* ==========================================================
     7. La pagina
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

  function aggiornaTabella() {
    svuota(tabellaScala);
    if (!scoperto) {
      tabellaScala.appendChild(elemento("p", "nota-piccola",
        "Le lunghezze dei campioni compaiono qui dopo che hai dato la tua risposta. " +
        "Prima si guarda il gel: e' cosi' che si lavora davvero."));
      return;
    }
    var t = elemento("table", "tabella-cifre");
    var testa = elemento("tr");
    ["corsia", "lunghezze dei pezzi, in paia di basi"].forEach(function (h) {
      testa.appendChild(elemento("th", null, h));
    });
    t.appendChild(testa);
    corsie().forEach(function (c) {
      var tr = elemento("tr");
      tr.appendChild(elemento("td", null, c.nome));
      tr.appendChild(elemento("td", null, c.pezzi.join(", ")));
      t.appendChild(tr);
    });
    tabellaScala.appendChild(t);
  }

  function aggiorna() {
    letturaCopie.textContent = copieBelle();
    letturaCorsa.textContent = minuti + " min a " + volt + " V";
    var giusto = chiCombacia();
    letturaEsito.textContent = !scoperto ? "da stabilire"
      : (risposta === giusto ? "giusto" : "sbagliato");

    pastiglieRisposta.forEach(function (b) {
      b.className = "pillola" + (b.dato === risposta ? " attiva" : "");
    });

    frase.textContent = racconta();
    aggiornaTabella();

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegnaGel();
    disegnaPcr();
  }

  function costruisci() {
    svuota(contenitore);
    pastiglieRisposta = [];

    var avvisoErrori = App.avvisoErroriFile("campioni.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Il DNA di una traccia e' quasi sempre pochissimo: prima bisogna moltiplicarlo, e lo si fa con " +
      "la PCR. Poi lo si taglia a pezzi e lo si fa correre in un gel, dove i pezzi corti vanno piu' " +
      "lontano dei lunghi. Il disegno di bande che ne esce si confronta a occhio con quello degli " +
      "altri campioni."));

    /* --- PCR --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Primo: moltiplicare il DNA"));
    var comandi = elemento("div", "comandi");
    cursoreC = cursore("Cicli di PCR", 0, 40, 1, cicli, "cicli", function (v) {
      cicli = v; aggiorna();
    });
    cursoreMol = cursore("Molecole di partenza", 1, 1000, 1, molecoleIniziali, "", function (v) {
      molecoleIniziali = v; aggiorna();
    });
    comandi.appendChild(cursoreC);
    comandi.appendChild(cursoreMol);
    contenitore.appendChild(comandi);

    var scatolaP = elemento("div", "scatola-grafico");
    telaP = elemento("canvas", "tela");
    scatolaP.appendChild(telaP);
    contenitore.appendChild(scatolaP);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Ogni ciclo dura circa due minuti e ha tre passaggi: si scalda a 95 gradi per separare i due " +
      "filamenti, si raffredda a 55 perche' gli inneschi si attacchino, si porta a 72 perche' la " +
      "Taq polimerasi costruisca il filamento nuovo. Poi si ricomincia. E' per far sopravvivere la " +
      "polimerasi ai 95 gradi che si usa quella di un batterio delle sorgenti bollenti."));

    /* --- il gel --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Secondo: farlo correre nel gel"));
    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("copie ottenute", function (n) { letturaCopie = n; }));
    letture.appendChild(unaLettura("corsa", function (n) { letturaCorsa = n; }));
    letture.appendChild(unaLettura("la tua risposta", function (n) { letturaEsito = n; }));
    contenitore.appendChild(letture);

    var comandi2 = elemento("div", "comandi");
    cursoreMin = cursore("Quanto lo fai correre", 10, 90, 5, minuti, "minuti", function (v) {
      minuti = v; aggiorna();
    });
    cursoreV = cursore("Tensione", 40, 160, 10, volt, "V", function (v) {
      volt = v; aggiorna();
    });
    comandi2.appendChild(cursoreMin);
    comandi2.appendChild(cursoreV);
    contenitore.appendChild(comandi2);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Tempo e tensione spostano tutte le bande insieme, ma non cambiano il loro ordine ne' le " +
      "distanze relative. Se corri troppo a lungo i pezzi piu' corti escono dal gel e si perdono: " +
      "prova a portare i minuti al massimo e guarda sparire le bande in fondo."));

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    /* --- la domanda --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Terzo: quale campione corrisponde?"));
    var scelte = elemento("div", "scelte-grandezza");
    iCampioni().forEach(function (c) {
      var b = elemento("button", "pillola", c.nome);
      b.type = "button"; b.dato = c;
      b.addEventListener("click", function () {
        risposta = c; scoperto = true; aggiorna();
      });
      pastiglieRisposta.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);

    var rigaB = elemento("div", "bottoni");
    var b2 = elemento("button", "bottone-testo", "Ricomincia senza sapere la risposta");
    b2.type = "button";
    b2.addEventListener("click", function () { risposta = null; scoperto = false; aggiorna(); });
    rigaB.appendChild(b2);
    contenitore.appendChild(rigaB);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le lunghezze vere"));
    tabellaScala = elemento("div", "involucro-tabella");
    contenitore.appendChild(tabellaScala);

    /* --- i limiti --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "La PCR qui raddoppia sempre, a ogni ciclo, all'infinito. Nella realta' dopo una trentina di cicli finiscono i nucleotidi e gli inneschi, la polimerasi si stanca, e la curva si appiattisce: si chiama fase di plateau, e per questo non ha senso fare cinquanta cicli.",
      "Non compaiono gli errori di copiatura. La Taq polimerasi sbaglia circa una base ogni diecimila, e dopo trenta cicli una parte delle copie non e' piu' identica all'originale. Per il lavoro fine si usano polimerasi piu' precise.",
      "Nella realta' un gel puo' contaminarsi, le bande possono essere sbavate o doppie, e un campione degradato da' bande deboli e incomplete. Qui le bande sono sempre nitide.",
      "La relazione fra lunghezza e distanza percorsa e' il logaritmo puro. Quella vera si discosta agli estremi: i pezzi molto lunghi si comportano tutti allo stesso modo e restano ammassati in cima, e sotto una certa lunghezza la curva cambia forma.",
      "Il confronto fra due campioni qui e' un si' o un no. Nella pratica forense e nei test di parentela si usano decine di punti del DNA e si calcola una probabilita': non si dice mai «e' lui», si dice quanto sarebbe improbabile che fosse un altro.",
      "Il DNA e' gia' tagliato: non si vede il lavoro degli enzimi di restrizione, che tagliano solo dove trovano la loro sequenza. E' da li' che nascono le lunghezze diverse fra una persona e l'altra."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(380, Math.max(280, larghezza * 0.72)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaP = telaP.parentNode.clientWidth;
    altezzaP = Math.round(Math.min(250, Math.max(190, larghezzaP * 0.46)));
    telaP.width = larghezzaP * dpr; telaP.height = altezzaP * dpr;
    telaP.style.width = larghezzaP + "px"; telaP.style.height = altezzaP + "px";
    ctxP = telaP.getContext("2d");
    ctxP.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegnaGel(); disegnaPcr();
  });

  /* ==========================================================
     8. Avvio
     ========================================================== */

  App.caricaTesto("campioni.txt")
    .then(function (testo) {
      var esito = leggiCampioni(testo);
      campioni = esito.elenco;
      erroriFile = esito.errori;

      if (!laTraccia() || !iCampioni().length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file campioni.txt deve contenere almeno una traccia e un campione da confrontare."));
        contenitore.appendChild(avviso);
        return;
      }

      costruisci();
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("campioni.txt", errore.message));
    });

})();
