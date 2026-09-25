/* ============================================================
   Pile ed elettrolisi
   ------------------------------------------------------------
   Due elettrodi, un ponte salino, un voltmetro. Si sceglie la
   coppia e si vede chi cede elettroni e chi li prende, quanto
   vale la forza elettromotrice, e che cosa cambia se si cambia
   la concentrazione.

   Come funziona, in due parole:
   - chi ha il potenziale standard piu' alto fa il catodo e si
     riduce, l'altro fa l'anodo e si ossida. Non e' una regola
     da imparare: e' la definizione di potenziale
   - la forza elettromotrice e' la differenza fra i due
     potenziali, e i potenziali si correggono con l'equazione di
     Nernst quando le concentrazioni non sono 1 mol/L
   - il delta G viene da -nFE, quindi una pila che funziona e'
     esattamente una reazione spontanea
   - in elettrolisi si spinge al contrario con un generatore, e
     quanta sostanza si deposita lo dice la legge di Faraday
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var R = 8.314;            /* J/(mol K) */
  var F = 96485;            /* costante di Faraday, C/mol */

  /* ---------- stato ---------- */

  var elettrodi = [], erroriFile = [];
  var sinistro = null, destro = null;
  var concSinistra = 1, concDestra = 1;   /* mol/L */
  var temperatura = 25;
  var modo = "pila";        /* oppure "elettrolisi" */
  var corrente = 1;         /* ampere, in elettrolisi */
  var minuti = 30;
  var esperimentoScelto = 0;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaS = null, ctxS = null, larghezzaS = 0, altezzaS = 0;
  var letturaFem = null, letturaVerso = null, letturaExtra = null;
  var pastiglieS = [], pastiglieD = [], pastiglieEsp = [], pastiglieModo = [];
  var frase = null, tabella = null;
  var cursoreCS = null, cursoreCD = null, cursoreT = null, cursoreI = null, cursoreM = null;

  var faseElettroni = 0;

  /* ==========================================================
     1. Gli esperimenti gia' pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "La pila Daniell",
      sottotitolo: "Zinco e rame: la pila di tutti i libri, 1,10 volt",
      sinistro: "Zinco", destro: "Rame", cs: 1, cd: 1, modo: "pila"
    },
    {
      titolo: "Chi ossida chi",
      sottotitolo: "Rame e argento: stavolta il rame fa l'anodo",
      sinistro: "Rame", destro: "Argento", cs: 1, cd: 1, modo: "pila"
    },
    {
      titolo: "La coppia piu' potente",
      sottotitolo: "Litio contro oro: quasi quattro volt e mezzo",
      sinistro: "Litio", destro: "Oro", cs: 1, cd: 1, modo: "pila"
    },
    {
      titolo: "La concentrazione sposta i volt",
      sottotitolo: "Stessa pila Daniell, ma con gli ioni rame diluiti",
      sinistro: "Zinco", destro: "Rame", cs: 1, cd: 0.001, modo: "pila"
    },
    {
      titolo: "Recuperare il rame",
      sottotitolo: "Elettrolisi: si spinge al contrario e il rame torna solido",
      sinistro: "Rame", destro: "Argento", cs: 1, cd: 1, modo: "elettrolisi"
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiElettrodi(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 6) {
        errori.push("riga " + (i + 1) + ": servono almeno sei parti separate da | .");
        return;
      }
      var e0 = numero(p[2]), n = numero(p[3]), molare = numero(p[4]), ioni = numero(p[5]);
      if (e0 === null || n === null || molare === null || ioni === null) {
        errori.push("riga " + (i + 1) + ": il potenziale, gli elettroni, la massa molare e il numero di ioni devono essere numeri.");
        return;
      }
      if (n <= 0 || molare <= 0 || ioni <= 0) {
        errori.push("riga " + (i + 1) + ": elettroni, massa molare e numero di ioni devono essere maggiori di zero.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        semireazione: p[1].trim(),
        e0: e0,
        elettroni: n,
        molare: molare,
        ioni: ioni,
        nota: p.length > 6 ? p[6].trim() : ""
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. L'elettrochimica
     ========================================================== */

  function kelvin() { return temperatura + 273.15; }

  /* Il potenziale vero di un elettrodo, corretto per la
     concentrazione con l'equazione di Nernst. A un mol/L torna
     il potenziale standard. */
  function potenziale(el, conc) {
    if (!(conc > 0)) conc = 1e-9;
    return el.e0 + (R * kelvin() / (el.elettroni * F)) * Math.log(Math.pow(conc, el.ioni));
  }

  function potSinistro() { return potenziale(sinistro, concSinistra); }
  function potDestro() { return potenziale(destro, concDestra); }

  /* Il catodo e' quello col potenziale piu' alto: si riduce.
     L'altro fa l'anodo e si ossida. */
  function catodo() { return potDestro() >= potSinistro() ? destro : sinistro; }
  function anodo() { return potDestro() >= potSinistro() ? sinistro : destro; }
  function potCatodo() { return Math.max(potSinistro(), potDestro()); }
  function potAnodo() { return Math.min(potSinistro(), potDestro()); }

  function fem() { return potCatodo() - potAnodo(); }

  /* Quanti elettroni si scambiano in tutto: il minimo comune
     multiplo fra i due, come quando si bilancia una redox. */
  function mcm(a, b) {
    function mcd(x, y) { return y === 0 ? x : mcd(y, x % y); }
    return a * b / mcd(a, b);
  }

  function elettroniScambiati() {
    return mcm(Math.round(sinistro.elettroni), Math.round(destro.elettroni));
  }

  function deltaG() {
    /* in kJ/mol */
    return -elettroniScambiati() * F * fem() / 1000;
  }

  /* Legge di Faraday: la carica che passa diviso il numero di
     elettroni dice quante moli si trasformano. */
  function caricaPassata() {
    return corrente * minuti * 60;      /* coulomb */
  }

  function moliDepositate(el) {
    return caricaPassata() / (el.elettroni * F);
  }

  function massaDepositata(el) {
    return moliDepositate(el) * el.molare;
  }

  /* Per far andare la reazione al contrario serve almeno la
     tensione della pila, col segno cambiato. */
  function tensioneMinima() { return fem(); }

  /* ==========================================================
     4. Il disegno della cella
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegnaCella() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezza, altezza);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var accento = coloreTema("--accento", "#1f5f8b");

    var margine = 16;
    var largoV = Math.min(140, (larghezza - margine * 3) / 2);
    var yFondo = altezza - 26;
    var altoV = Math.min(92, altezza * 0.42);
    var yAlto = yFondo - altoV;

    var xS = margine, xD = larghezza - margine - largoV;

    /* i due becher */
    [[xS, sinistro, concSinistra], [xD, destro, concDestra]].forEach(function (b) {
      c.fillStyle = "rgba(120, 165, 200, 0.28)";
      c.fillRect(b[0], yAlto + 14, largoV, altoV - 14);
      c.strokeStyle = bordo; c.lineWidth = 2;
      c.beginPath();
      c.moveTo(b[0], yAlto); c.lineTo(b[0], yFondo);
      c.lineTo(b[0] + largoV, yFondo); c.lineTo(b[0] + largoV, yAlto);
      c.stroke();
    });

    /* gli elettrodi immersi */
    var xEs = xS + largoV * 0.5, xEd = xD + largoV * 0.5;
    var yFilo = Math.max(16, yAlto - 40);
    [[xEs, sinistro], [xEd, destro]].forEach(function (e) {
      var eCatodo = e[1] === catodo();
      c.fillStyle = eCatodo ? "#c08a3e" : "#9aa0a6";
      c.fillRect(e[0] - 7, yAlto - 18, 14, altoV * 0.72);
      c.strokeStyle = bordo; c.lineWidth = 1.5;
      c.strokeRect(e[0] - 7, yAlto - 18, 14, altoV * 0.72);
    });

    /* il filo e lo strumento */
    c.strokeStyle = tenue; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(xEs, yAlto - 18); c.lineTo(xEs, yFilo);
    c.lineTo(xEd, yFilo); c.lineTo(xEd, yAlto - 18);
    c.stroke();

    var xStr = (xEs + xEd) / 2;
    c.fillStyle = coloreTema("--superficie", "#fffdf8");
    c.fillRect(xStr - 34, yFilo - 15, 68, 30);
    c.strokeStyle = bordo; c.lineWidth = 2;
    c.strokeRect(xStr - 34, yFilo - 15, 68, 30);
    c.fillStyle = modo === "pila" ? accento : "#c06a28";
    c.font = "600 13px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText(conVirgola(arrotonda(fem(), 2)) + " V", xStr, yFilo + 5);
    c.fillStyle = tenue;
    c.font = "9px system-ui, sans-serif";
    c.fillText(modo === "pila" ? "voltmetro" : "generatore", xStr, yFilo - 19);

    /* gli elettroni che scorrono nel filo */
    var versoDestra = (catodo() === destro);
    if (modo === "elettrolisi") versoDestra = !versoDestra;
    for (var k = 0; k < 7; k++) {
      var q = ((faseElettroni + k / 7) % 1);
      var t = versoDestra ? q : 1 - q;
      var x = xEs + (xEd - xEs) * t;
      c.beginPath();
      c.arc(x, yFilo, 3, 0, Math.PI * 2);
      c.fillStyle = "#3f7fb0";
      c.fill();
    }
    c.fillStyle = tenue;
    c.font = "9px system-ui, sans-serif";
    c.fillText("elettroni " + (versoDestra ? "→" : "←"), xStr, yFilo + 26);

    /* il ponte salino */
    var yPonte = yAlto + 22;
    c.strokeStyle = bordo; c.lineWidth = 9;
    c.beginPath();
    c.moveTo(xS + largoV - 4, yPonte);
    c.lineTo(xD + 4, yPonte);
    c.stroke();
    c.strokeStyle = "rgba(150, 190, 215, 0.75)"; c.lineWidth = 5;
    c.beginPath();
    c.moveTo(xS + largoV - 4, yPonte);
    c.lineTo(xD + 4, yPonte);
    c.stroke();
    c.fillStyle = tenue; c.font = "9px system-ui, sans-serif";
    c.fillText("ponte salino", (xS + largoV + xD) / 2, yPonte - 9);

    /* le targhette */
    c.font = "600 11px system-ui, sans-serif";
    [[xEs, sinistro, concSinistra, potSinistro()], [xEd, destro, concDestra, potDestro()]].forEach(function (e) {
      var eCatodo = e[1] === catodo();
      c.fillStyle = tenue;
      c.textAlign = "center";
      c.fillText(e[1].nome, e[0], yFondo + 13);
      c.font = "9px system-ui, sans-serif";
      var ruolo = modo === "pila"
        ? (eCatodo ? "catodo, si riduce" : "anodo, si ossida")
        : (eCatodo ? "qui si ossida" : "qui si deposita");
      c.fillText(ruolo + " · " + conVirgola(arrotonda(e[3], 3)) + " V", e[0], yFondo + 24);
      c.font = "600 11px system-ui, sans-serif";
    });
  }

  /* ==========================================================
     5. La scala dei potenziali
     ========================================================== */

  function disegnaScala() {
    if (!ctxS || larghezzaS <= 0) return;
    var c = ctxS;
    c.clearRect(0, 0, larghezzaS, altezzaS);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaS, altezzaS);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var accento = coloreTema("--accento", "#1f5f8b");

    var su = 16, giu = 22, sx = 40;
    var h = altezzaS - su - giu;
    var w = larghezzaS - sx - 12;

    var min = -3.2, max = 1.7;
    function Y(v) { return su + h * (max - v) / (max - min); }

    /* la riga dello zero, cioe' l'idrogeno */
    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var v = -3; v <= 1.5; v += 0.5) {
      c.beginPath(); c.moveTo(sx, Y(v)); c.lineTo(sx + w, Y(v)); c.stroke();
      c.fillText(conVirgola(arrotonda(v, 1)), sx - 5, Y(v) + 3);
    }
    c.save();
    c.translate(11, su + h / 2); c.rotate(-Math.PI / 2);
    c.textAlign = "center";
    c.fillText("potenziale standard (V)", 0, 0);
    c.restore();

    /* ogni elettrodo al suo posto */
    c.textAlign = "left";
    var usati = [sinistro, destro];
    elettrodi.forEach(function (el) {
      var y = Y(el.e0);
      var scelto = usati.indexOf(el) >= 0;
      c.strokeStyle = scelto ? accento : bordo;
      c.lineWidth = scelto ? 2.5 : 1.5;
      c.beginPath(); c.moveTo(sx + 2, y); c.lineTo(sx + 26, y); c.stroke();
      c.fillStyle = scelto ? accento : tenue;
      c.font = scelto ? "600 10px system-ui, sans-serif" : "10px system-ui, sans-serif";
      c.fillText(el.nome, sx + 30, y + 3);
    });

    /* la distanza fra i due, che e' la forza elettromotrice */
    var yA = Y(anodo().e0), yC = Y(catodo().e0);
    var xFreccia = sx + w - 16;
    c.strokeStyle = "#c06a28"; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(xFreccia, yA); c.lineTo(xFreccia, yC);
    c.stroke();
    [[yA, 1], [yC, -1]].forEach(function (p) {
      c.beginPath();
      c.moveTo(xFreccia - 4, p[0] - 5 * p[1]);
      c.lineTo(xFreccia, p[0]);
      c.lineTo(xFreccia + 4, p[0] - 5 * p[1]);
      c.stroke();
    });
    c.fillStyle = "#c06a28";
    c.font = "600 10px system-ui, sans-serif";
    c.textAlign = "right";
    c.fillText(conVirgola(arrotonda(catodo().e0 - anodo().e0, 2)) + " V",
      xFreccia - 6, (yA + yC) / 2 + 3);
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
    var cat = catodo(), an = anodo();

    if (sinistro === destro) {
      return "Hai scelto due volte lo stesso metallo. Con le concentrazioni uguali non succede niente: " +
        "i due potenziali sono identici e la pila da' zero volt. Prova pero' a cambiare una delle due " +
        "concentrazioni: nasce lo stesso una tensione, piccola. Si chiama pila a concentrazione, e la " +
        "spinta non viene dalla chimica ma dalla voglia del sistema di pareggiare le concentrazioni.";
    }

    if (modo === "elettrolisi") {
      return "In elettrolisi comandi tu. Il generatore spinge gli elettroni al contrario di come " +
        "andrebbero da soli, e per riuscirci deve superare almeno " +
        conVirgola(arrotonda(tensioneMinima(), 2)) + " V. Cosi' avviene una reazione che da sola non " +
        "avverrebbe mai: e' il modo in cui si ricava l'alluminio, si argentano le posate e si ricarica " +
        "una batteria. In " + conVirgola(minuti) + " minuti a " + conVirgola(corrente) + " ampere " +
        "passano " + conVirgola(arrotonda(caricaPassata(), 0)) + " coulomb.";
    }

    return an.nome + " ha il potenziale piu' basso (" + conVirgola(arrotonda(potAnodo(), 3)) +
      " V), quindi tiene gli elettroni piu' debolmente: li cede e si ossida, facendo da anodo. " +
      cat.nome + " ce l'ha piu' alto (" + conVirgola(arrotonda(potCatodo(), 3)) +
      " V): li prende e si riduce, facendo da catodo. Gli elettroni vanno sempre dall'anodo al catodo " +
      "passando per il filo, mai attraverso la soluzione. Il ponte salino serve solo a non far " +
      "accumulare carica nei due becher: senza di lui la pila si ferma dopo un istante.";
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

  function semplice(v) { return conVirgola(v); }

  /* il cursore delle concentrazioni lavora in potenze di dieci,
     cosi' si arriva fino a un millesimo di mole per litro */
  function daEsponente(e) { return Math.pow(10, e); }
  function mostraConc(e) {
    var v = daEsponente(e);
    if (v >= 1) return conVirgola(arrotonda(v, 2));
    return "10^" + conVirgola(arrotonda(e, 1));
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
    var s = elettrodi.filter(function (y) { return y.nome === x.sinistro; })[0];
    var d = elettrodi.filter(function (y) { return y.nome === x.destro; })[0];
    if (s) sinistro = s;
    if (d) destro = d;
    concSinistra = x.cs;
    concDestra = x.cd;
    modo = x.modo;
    costruisci();
  }

  function disegnaTabella() {
    svuota(tabella);
    var t = elemento("table", "tabella-cifre");
    var testa = elemento("tr");
    ["", "semireazione", "E° (V)", "E vero (V)"].forEach(function (h) {
      testa.appendChild(elemento("th", null, h));
    });
    t.appendChild(testa);

    [[sinistro, concSinistra, potSinistro()], [destro, concDestra, potDestro()]].forEach(function (e) {
      var riga = elemento("tr");
      riga.appendChild(elemento("td", null, e[0] === catodo() ? "catodo" : "anodo"));
      riga.appendChild(elemento("td", null, e[0].semireazione));
      riga.appendChild(elemento("td", null, conVirgola(arrotonda(e[0].e0, 2))));
      riga.appendChild(elemento("td", null, conVirgola(arrotonda(e[2], 3))));
      t.appendChild(riga);
    });

    var fine = elemento("tr");
    var c1 = elemento("td", null, "differenza");
    c1.colSpan = 3;
    fine.appendChild(c1);
    fine.appendChild(elemento("td", null, conVirgola(arrotonda(fem(), 3))));
    t.appendChild(fine);

    tabella.appendChild(t);
  }

  function aggiorna() {
    letturaFem.textContent = conVirgola(arrotonda(fem(), 3)) + " V";

    if (modo === "pila") {
      letturaVerso.textContent = anodo().nome + " → " + catodo().nome;
      letturaExtra.textContent = conVirgola(arrotonda(deltaG(), 0)) + " kJ/mol";
    } else {
      letturaVerso.textContent = "servono " + conVirgola(arrotonda(tensioneMinima(), 2)) + " V";
      /* forzando la reazione al contrario, a depositarsi e' il metallo
         che da solo si sarebbe sciolto: cioe' l'anodo della pila */
      var dep = anodo();
      letturaExtra.textContent = conVirgola(arrotonda(massaDepositata(dep), 3)) + " g di " + dep.nome.toLowerCase();
    }

    pastiglieS.forEach(function (b) { b.className = "pillola" + (b.dato === sinistro ? " attiva" : ""); });
    pastiglieD.forEach(function (b) { b.className = "pillola" + (b.dato === destro ? " attiva" : ""); });
    pastiglieModo.forEach(function (b) { b.className = "pillola" + (b.dato === modo ? " attiva" : ""); });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    frase.textContent = racconta();
    disegnaTabella();

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegnaCella();
    disegnaScala();
  }

  var ultimo = 0;
  function battito(ora) {
    var dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0;
    ultimo = ora;
    if (sinistro && destro) {
      faseElettroni = (faseElettroni + dt * 0.5) % 1;
      disegnaCella();
    }
    requestAnimationFrame(battito);
  }

  /* ==========================================================
     8. Costruire la pagina
     ========================================================== */

  function costruisci() {
    svuota(contenitore);
    pastiglieS = []; pastiglieD = []; pastiglieEsp = []; pastiglieModo = [];

    var avvisoErrori = App.avvisoErroriFile("elettrodi.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Una pila e' una reazione chimica a cui e' stato tolto il contatto diretto: i due pezzi stanno " +
      "in becher separati, e gli elettroni per passare da uno all'altro devono fare il giro attraverso " +
      "un filo. Quel passaggio e' la corrente."));

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

    /* --- modo --- */
    var modi = elemento("div", "scelte-grandezza");
    [["pila", "Pila · va da sola"], ["elettrolisi", "Elettrolisi · la spingo io"]].forEach(function (m) {
      var b = elemento("button", "pillola", m[1]);
      b.type = "button"; b.dato = m[0];
      b.addEventListener("click", function () { modo = m[0]; esperimentoScelto = -1; costruisci(); });
      pastiglieModo.push(b);
      modi.appendChild(b);
    });
    contenitore.appendChild(modi);

    /* --- la cella --- */
    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("forza elettromotrice", function (n) { letturaFem = n; }));
    letture.appendChild(unaLettura(modo === "pila" ? "gli elettroni vanno" : "per farla andare",
      function (n) { letturaVerso = n; }));
    letture.appendChild(unaLettura(modo === "pila" ? "delta G" : "sostanza depositata",
      function (n) { letturaExtra = n; }));
    contenitore.appendChild(letture);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    /* --- la tabella --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "I due elettrodi"));
    tabella = elemento("div", "involucro-tabella");
    contenitore.appendChild(tabella);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "La colonna E° e' il valore da tabella, valido a 1 mol/L e 25 gradi. La colonna E vero tiene " +
      "conto della concentrazione che hai scelto, con l'equazione di Nernst: sono la stessa cosa solo " +
      "quando la concentrazione e' esattamente 1 mol/L."));

    /* --- la scala --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La scala dei potenziali"));
    var scatolaS = elemento("div", "scatola-grafico");
    telaS = elemento("canvas", "tela");
    scatolaS.appendChild(telaS);
    contenitore.appendChild(scatolaS);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Tutti gli elettrodi messi in fila per potenziale. Chi sta in basso cede elettroni a chiunque " +
      "stia piu' in alto: e' il motivo per cui il ferro arrugginisce e l'oro no. La distanza fra i due " +
      "scelti, segnata in arancione, e' proprio la tensione della pila."));

    /* --- le manopole --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le manopole"));
    var comandi = elemento("div", "comandi");
    cursoreCS = cursore("Concentrazione a sinistra", -3, 0.7, 0.1,
      Math.log(concSinistra) / Math.LN10, "mol/L", mostraConc, function (v) {
        concSinistra = daEsponente(v); esperimentoScelto = -1; aggiorna();
      });
    cursoreCD = cursore("Concentrazione a destra", -3, 0.7, 0.1,
      Math.log(concDestra) / Math.LN10, "mol/L", mostraConc, function (v) {
        concDestra = daEsponente(v); esperimentoScelto = -1; aggiorna();
      });
    cursoreT = cursore("Temperatura", 0, 100, 1, temperatura, "°C", semplice, function (v) {
      temperatura = v; esperimentoScelto = -1; aggiorna();
    });
    comandi.appendChild(cursoreCS);
    comandi.appendChild(cursoreCD);
    comandi.appendChild(cursoreT);

    if (modo === "elettrolisi") {
      cursoreI = cursore("Corrente", 0.1, 10, 0.1, corrente, "A", semplice, function (v) {
        corrente = v; esperimentoScelto = -1; aggiorna();
      });
      cursoreM = cursore("Per quanto tempo", 1, 240, 1, minuti, "minuti", semplice, function (v) {
        minuti = v; esperimentoScelto = -1; aggiorna();
      });
      comandi.appendChild(cursoreI);
      comandi.appendChild(cursoreM);
    }
    contenitore.appendChild(comandi);

    /* --- gli elettrodi --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "L'elettrodo di sinistra"));
    var sceltaS = elemento("div", "scelte-grandezza");
    elettrodi.forEach(function (el) {
      var b = elemento("button", "pillola", el.nome);
      b.type = "button"; b.dato = el;
      b.addEventListener("click", function () { sinistro = el; esperimentoScelto = -1; aggiorna(); });
      pastiglieS.push(b);
      sceltaS.appendChild(b);
    });
    contenitore.appendChild(sceltaS);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "L'elettrodo di destra"));
    var sceltaD = elemento("div", "scelte-grandezza");
    elettrodi.forEach(function (el) {
      var b = elemento("button", "pillola", el.nome);
      b.type = "button"; b.dato = el;
      b.addEventListener("click", function () { destro = el; esperimentoScelto = -1; aggiorna(); });
      pastiglieD.push(b);
      sceltaD.appendChild(b);
    });
    contenitore.appendChild(sceltaD);

    /* --- i limiti --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Ci sono solo elettrodi fatti da un metallo immerso nei propri ioni, piu' quello a idrogeno. Gli elettrodi a gas come il cloro, o quelli in cui tutte e due le forme sono sciolte, seguono la stessa equazione di Nernst ma con concentrazioni ai due lati, e qui non ci sono.",
      "Si usano le concentrazioni al posto delle attivita'. Sopra circa 0,1 mol/L la tensione vera comincia a scostarsi da quella calcolata.",
      "La tensione mostrata e' quella a circuito aperto, cioe' senza corrente che scorre. Appena una pila vera eroga corrente la tensione cala, per via della resistenza interna e di altri effetti che qui non ci sono.",
      "In elettrolisi la tensione minima calcolata e' solo quella termodinamica. In pratica ne serve sempre un po' di piu', e a volte molta di piu': si chiama sovratensione.",
      "Si suppone che all'elettrodo si scarichi solo la sostanza scelta. In una soluzione vera c'e' anche l'acqua, che spesso si scarica per prima e cambia tutto il risultato.",
      "Le concentrazioni restano ferme mentre la pila lavora. In una pila vera si consumano, e la tensione cala fino a zero: e' quello che succede quando una batteria si scarica."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(280, Math.max(220, larghezza * 0.5)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaS = telaS.parentNode.clientWidth;
    altezzaS = 330;
    telaS.width = larghezzaS * dpr; telaS.height = altezzaS * dpr;
    telaS.style.width = larghezzaS + "px"; telaS.style.height = altezzaS + "px";
    ctxS = telaS.getContext("2d");
    ctxS.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegnaCella(); disegnaScala();
  });

  /* ==========================================================
     9. Avvio
     ========================================================== */

  App.caricaTesto("elettrodi.txt")
    .then(function (testo) {
      var esito = leggiElettrodi(testo);
      elettrodi = esito.elenco;
      erroriFile = esito.errori;

      if (elettrodi.length < 2) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file elettrodi.txt deve contenere almeno due elettrodi validi."));
        contenitore.appendChild(avviso);
        return;
      }

      sinistro = elettrodi[0];
      destro = elettrodi[elettrodi.length - 1];
      costruisci();
      applicaEsperimento(ESPERIMENTI[0]);
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("elettrodi.txt", errore.message));
    });

})();
