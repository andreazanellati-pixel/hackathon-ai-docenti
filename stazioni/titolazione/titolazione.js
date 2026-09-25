/* ============================================================
   La titolazione acido-base
   ------------------------------------------------------------
   Una buretta che gocciola in una beuta. Il pH viene ricalcolato
   goccia dopo goccia e la curva si disegna da sola.

   Come funziona, in due parole:
   - il pH non e' approssimato con le formulette dei casi
     particolari: si risolve ogni volta il bilancio delle cariche
     della soluzione, per bisezione. Cosi' la curva resta corretta
     anche vicino al punto equivalente, dove le formulette
     sbagliano
   - le sostanze e i loro pKa stanno in soluzioni.txt
   - gli indicatori, con il loro intervallo di viraggio, stanno
     in indicatori.txt
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var KW = 1e-14;           /* prodotto ionico dell'acqua a 25 gradi */
  var FORTE = 1e9;          /* una costante enorme: vale "dissociato del tutto" */
  var CAPIENZA = 50;        /* la buretta contiene 50 mL */

  /* ---------- stato ---------- */

  var sostanze = [], indicatori = [];
  var erroriSost = [], erroriInd = [];

  var analita = null;
  var indicatore = null;
  var concAnalita = 0.1;      /* mol/L */
  var volumeAnalita = 25;     /* mL */
  var concTitolante = 0.1;    /* mol/L */

  var volumeAggiunto = 0;     /* mL versati finora */
  var punti = [];             /* la curva percorsa: {v, ph} */
  var mostraCurva = false;
  var versando = false;
  var esperimentoScelto = 0;

  /* i pezzi di pagina che si aggiornano senza ricostruire tutto */
  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaCurva = null, ctxCurva = null, larghezzaC = 0, altezzaC = 0;
  var letturaVolume = null, letturaPh = null, letturaResto = null;
  var pastiglieSostanza = [], pastiglieIndicatore = [], pastiglieEsperimento = [];
  var frase = null, bottoneVersa = null, schedaSost = null;
  var cursoreConc = null, cursoreVol = null, cursoreConcT = null;

  /* ==========================================================
     1. Gli esperimenti gia' pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "Forte contro forte",
      sottotitolo: "HCl con NaOH e fenolftaleina: il salto piu' netto",
      sostanza: "Acido cloridrico", indicatore: "Fenolftaleina",
      conc: 0.1, volume: 25, concT: 0.1
    },
    {
      titolo: "Debole contro forte",
      sottotitolo: "Acido acetico: al punto equivalente il pH non e' 7",
      sostanza: "Acido acetico", indicatore: "Fenolftaleina",
      conc: 0.1, volume: 25, concT: 0.1
    },
    {
      titolo: "L'indicatore sbagliato",
      sottotitolo: "Lo stesso aceto con il metilarancio: vira troppo presto",
      sostanza: "Acido acetico", indicatore: "Metilarancio",
      conc: 0.1, volume: 25, concT: 0.1
    },
    {
      titolo: "Una base debole",
      sottotitolo: "Ammoniaca con HCl: qui il metilarancio e' quello giusto",
      sostanza: "Ammoniaca", indicatore: "Metilarancio",
      conc: 0.1, volume: 25, concT: 0.1
    }
  ];

  /* ==========================================================
     2. Leggere i file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiSostanze(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 4) {
        errori.push("riga " + (i + 1) + ": servono almeno quattro parti separate da | .");
        return;
      }
      var tipo = p[2].trim().toLowerCase();
      if (tipo !== "acido" && tipo !== "base") {
        errori.push("riga " + (i + 1) + ": il tipo deve essere «acido» oppure «base».");
        return;
      }
      var forte = p[3].trim().toLowerCase() === "forte";
      var pK = forte ? null : numero(p[3]);
      if (!forte && pK === null) {
        errori.push("riga " + (i + 1) + ": la forza deve essere «forte» oppure un numero, il pKa o il pKb.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        formula: p[1].trim(),
        tipo: tipo,
        forte: forte,
        pK: pK,
        K: forte ? FORTE : Math.pow(10, -pK),
        dove: p.length > 4 ? p[4].trim() : ""
      });
    });
    return { elenco: elenco, errori: errori };
  }

  function leggiIndicatori(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 5) {
        errori.push("riga " + (i + 1) + ": servono cinque parti separate da | .");
        return;
      }
      var da = numero(p[1]), a = numero(p[2]);
      if (da === null || a === null) {
        errori.push("riga " + (i + 1) + ": i due pH di viraggio devono essere numeri.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        da: da, a: a,
        coloreAcido: p[3].trim(),
        coloreBasico: p[4].trim(),
        muto: da === 0 && a === 0
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. La chimica
     ------------------------------------------------------------
     Si cerca la concentrazione di ioni H+ che manda a zero il
     bilancio delle cariche: le cariche positive devono essere
     tante quante le negative. Quella funzione cresce sempre al
     crescere di [H+], quindi basta dimezzare l'intervallo finche'
     non si stringe sul valore giusto.
     ========================================================== */

  function sbilancio(h, ca, ct) {
    if (analita.tipo === "acido") {
      /* positive: Na+ del titolante e H+ - negative: A- dell'acido e OH- */
      return ct + h - ca * analita.K / (analita.K + h) - KW / h;
    }
    /* base: positive BH+ e H+ - negative Cl- del titolante e OH- */
    var kaConiugato = KW / analita.K;
    return ca * h / (h + kaConiugato) + h - ct - KW / h;
  }

  function phDopo(mLversati) {
    var vTot = volumeAnalita + mLversati;
    var ca = concAnalita * volumeAnalita / vTot;
    var ct = concTitolante * mLversati / vTot;

    var basso = -15, alto = 1;     /* estremi, in log10 di [H+] */
    for (var i = 0; i < 90; i++) {
      var mezzo = (basso + alto) / 2;
      if (sbilancio(Math.pow(10, mezzo), ca, ct) < 0) basso = mezzo;
      else alto = mezzo;
    }
    return -(basso + alto) / 2;
  }

  function volumeEquivalente() {
    return concAnalita * volumeAnalita / concTitolante;
  }

  function volumeMassimo() {
    return volumeEquivalente() * 2.4;
  }

  function nomeTitolante() {
    return analita.tipo === "acido" ? "NaOH" : "HCl";
  }

  /* ==========================================================
     4. Il colore della soluzione
     ========================================================== */

  function aPezzi(hex) {
    var s = hex.replace("#", "");
    if (s.length === 3) s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }

  function coloreSoluzione(ph) {
    if (!indicatore) return "#dfe8ee";
    if (indicatore.muto) return indicatore.coloreAcido;
    var q = (ph - indicatore.da) / (indicatore.a - indicatore.da);
    if (q < 0) q = 0;
    if (q > 1) q = 1;
    var a = aPezzi(indicatore.coloreAcido), b = aPezzi(indicatore.coloreBasico);
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * q) + "," +
      Math.round(a[1] + (b[1] - a[1]) * q) + "," +
      Math.round(a[2] + (b[2] - a[2]) * q) + ")";
  }

  function haVirato(ph) {
    if (!indicatore || indicatore.muto) return false;
    return analita.tipo === "acido" ? ph >= indicatore.a : ph <= indicatore.da;
  }

  /* ==========================================================
     5. Disegnare
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

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var ph = phDopo(volumeAggiunto);
    var colore = coloreSoluzione(ph);
    var centro = larghezza / 2;

    /* --- la buretta --- */
    var larghB = 26;
    var altB = altezza * 0.42;
    var xB = centro - larghB / 2;
    var yB = 8;

    var residuo = CAPIENZA - (volumeAggiunto % CAPIENZA);
    if (volumeAggiunto === 0) residuo = CAPIENZA;

    c.fillStyle = coloreTema("--superficie", "#fffdf8");
    c.fillRect(xB, yB, larghB, altB);
    c.fillStyle = "rgba(90, 150, 200, 0.55)";
    var quota = residuo / CAPIENZA;
    c.fillRect(xB + 2, yB + altB * (1 - quota) + 1, larghB - 4, altB * quota - 2);
    c.strokeStyle = bordo;
    c.lineWidth = 2;
    c.strokeRect(xB, yB, larghB, altB);

    /* le tacche */
    c.strokeStyle = tenue;
    c.lineWidth = 1;
    c.font = "10px system-ui, sans-serif";
    c.fillStyle = tenue;
    c.textAlign = "right";
    for (var t = 0; t <= 5; t++) {
      var yt = yB + altB * t / 5;
      c.beginPath();
      c.moveTo(xB, yt); c.lineTo(xB - 5, yt); c.stroke();
      c.fillText(String(t * 10), xB - 7, yt + 3);
    }

    /* rubinetto e beccuccio */
    c.fillStyle = tenue;
    c.fillRect(centro - 9, yB + altB, 18, 6);
    c.beginPath();
    c.moveTo(centro - 3, yB + altB + 6);
    c.lineTo(centro + 3, yB + altB + 6);
    c.lineTo(centro + 1, yB + altB + 18);
    c.lineTo(centro - 1, yB + altB + 18);
    c.closePath();
    c.fill();

    /* --- la beuta --- */
    var yBeuta = altezza - 22;
    var altBeuta = altezza * 0.34;
    var mezzaBase = Math.min(70, larghezza * 0.24);
    var mezzoCollo = 13;
    var yCollo = yBeuta - altBeuta;

    var vTot = volumeAnalita + volumeAggiunto;
    /* il livello non e' in scala con i millilitri veri: serve solo a far
       vedere che versando la beuta si riempie */
    var pieno = 0.3 + 0.7 * Math.min(1, vTot / 90);
    var yLiquido = yBeuta - altBeuta * 0.75 * pieno - 2;

    function mezzaLarghezza(y) {
      var q = (yBeuta - y) / altBeuta;
      if (q < 0) q = 0;
      if (q > 1) q = 1;
      return mezzaBase + (mezzoCollo - mezzaBase) * Math.min(1, q / 0.78);
    }

    c.beginPath();
    c.moveTo(centro - mezzaBase, yBeuta);
    c.lineTo(centro + mezzaBase, yBeuta);
    c.lineTo(centro + mezzaLarghezza(yLiquido), yLiquido);
    c.lineTo(centro - mezzaLarghezza(yLiquido), yLiquido);
    c.closePath();
    c.fillStyle = colore;
    c.fill();

    c.beginPath();
    c.moveTo(centro - mezzoCollo, yCollo);
    c.lineTo(centro - mezzaBase, yBeuta);
    c.lineTo(centro + mezzaBase, yBeuta);
    c.lineTo(centro + mezzoCollo, yCollo);
    c.strokeStyle = bordo;
    c.lineWidth = 2.5;
    c.stroke();

    /* la goccia che scende */
    if (versando) {
      var y0 = yB + altB + 18;
      var avanzamento = (Date.now() % 420) / 420;
      c.beginPath();
      c.ellipse(centro, y0 + (yLiquido - y0) * avanzamento, 3.5, 5, 0, 0, Math.PI * 2);
      c.fillStyle = "rgba(90, 150, 200, 0.85)";
      c.fill();
    }

    /* le scritte */
    c.textAlign = "center";
    c.font = "600 12px system-ui, sans-serif";
    c.fillStyle = tenue;
    c.fillText(nomeTitolante() + " " + conVirgola(concTitolante) + " mol/L", centro, yB + altB + 32);
    c.fillText(analita.formula + " " + conVirgola(concAnalita) + " mol/L", centro, yBeuta + 16);
  }

  function disegnaCurva() {
    if (!ctxCurva || larghezzaC <= 0) return;
    var c = ctxCurva;
    c.clearRect(0, 0, larghezzaC, altezzaC);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaC, altezzaC);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var accento = coloreTema("--accento", "#1f5f8b");

    var sx = 42, dx = 12, su = 14, giu = 32;
    var w = larghezzaC - sx - dx, h = altezzaC - su - giu;
    var vMax = Math.max(volumeMassimo(), 10);

    function X(v) { return sx + w * v / vMax; }
    function Y(p) { return su + h * (14 - p) / 14; }

    /* la fascia di viraggio dell'indicatore */
    if (indicatore && !indicatore.muto) {
      c.fillStyle = "rgba(150, 150, 150, 0.2)";
      c.fillRect(sx, Y(indicatore.a), w, Y(indicatore.da) - Y(indicatore.a));
      c.fillStyle = tenue;
      c.font = "10px system-ui, sans-serif";
      c.textAlign = "left";
      c.fillText("viraggio", sx + 4, Y(indicatore.a) - 3);
    }

    /* la griglia, con i numeri su tutti e due gli assi */
    c.strokeStyle = bordo;
    c.lineWidth = 1;
    c.fillStyle = tenue;
    c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var p = 0; p <= 14; p += 2) {
      c.beginPath(); c.moveTo(sx, Y(p)); c.lineTo(sx + w, Y(p)); c.stroke();
      c.fillText(String(p), sx - 5, Y(p) + 3);
    }
    c.textAlign = "center";
    var passoV = vMax <= 12 ? 2 : (vMax <= 30 ? 5 : 10);
    for (var v = 0; v <= vMax + 0.001; v += passoV) {
      c.beginPath(); c.moveTo(X(v), su); c.lineTo(X(v), su + h); c.stroke();
      c.fillText(conVirgola(arrotonda(v, 1)), X(v), su + h + 14);
    }

    c.fillText("mL di " + nomeTitolante() + " versati", sx + w / 2, altezzaC - 5);
    c.save();
    c.translate(11, su + h / 2);
    c.rotate(-Math.PI / 2);
    c.fillText("pH", 0, 0);
    c.restore();

    /* il punto equivalente */
    var veq = volumeEquivalente();
    c.strokeStyle = tenue;
    c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(X(veq), su); c.lineTo(X(veq), su + h); c.stroke();
    c.setLineDash([]);

    /* la curva teorica intera, se e' stata chiesta */
    if (mostraCurva) {
      c.strokeStyle = bordo;
      c.lineWidth = 3;
      c.beginPath();
      for (var i = 0; i <= 400; i++) {
        var vv = vMax * i / 400;
        var pp = phDopo(vv);
        if (i === 0) c.moveTo(X(vv), Y(pp)); else c.lineTo(X(vv), Y(pp));
      }
      c.stroke();
    }

    /* la curva percorsa davvero, goccia dopo goccia */
    if (punti.length > 1) {
      c.strokeStyle = accento;
      c.lineWidth = 2.5;
      c.beginPath();
      punti.forEach(function (pt, i) {
        if (i === 0) c.moveTo(X(pt.v), Y(pt.ph)); else c.lineTo(X(pt.v), Y(pt.ph));
      });
      c.stroke();
    }

    /* dove siamo adesso */
    var ora = phDopo(volumeAggiunto);
    c.beginPath();
    c.arc(X(volumeAggiunto), Y(ora), 5, 0, Math.PI * 2);
    c.fillStyle = coloreSoluzione(ora);
    c.fill();
    c.strokeStyle = accento;
    c.lineWidth = 2;
    c.stroke();
  }

  /* ==========================================================
     6. I numeri sotto gli occhi
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

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

  /* ==========================================================
     7. Versare
     ========================================================== */

  function ricomincia() {
    volumeAggiunto = 0;
    punti = [{ v: 0, ph: phDopo(0) }];
    versando = false;
    aggiorna();
  }

  function versa(quanto) {
    var tetto = volumeMassimo();
    if (volumeAggiunto >= tetto) {
      versando = false;
      aggiorna();
      return;
    }
    /* si calcola prima dove si deve arrivare, poi si riempie il tratto:
       cosi' cinque millilitri sono cinque millilitri esatti, e i
       centesimi non si perdono per strada */
    var partenza = volumeAggiunto;
    var bersaglio = Math.min(tetto, partenza + quanto);
    var passi = Math.max(1, Math.min(60, Math.round((bersaglio - partenza) / 0.05)));
    for (var i = 1; i <= passi; i++) {
      volumeAggiunto = arrotonda(partenza + (bersaglio - partenza) * i / passi, 4);
      punti.push({ v: volumeAggiunto, ph: phDopo(volumeAggiunto) });
    }
    aggiorna();
  }

  function applicaEsperimento(x) {
    var s = sostanze.filter(function (y) { return y.nome === x.sostanza; })[0];
    var ind = indicatori.filter(function (y) { return y.nome === x.indicatore; })[0];
    if (s) analita = s;
    if (ind) indicatore = ind;
    concAnalita = x.conc;
    volumeAnalita = x.volume;
    concTitolante = x.concT;
    if (cursoreConc) cursoreConc.aggiorna(concAnalita);
    if (cursoreVol) cursoreVol.aggiorna(volumeAnalita);
    if (cursoreConcT) cursoreConcT.aggiorna(concTitolante);
    ricomincia();
  }

  function aggiornaScheda() {
    if (!schedaSost) return;
    schedaSost.textContent = analita.nome + " (" + analita.formula + "): " +
      (analita.forte
        ? "un " + analita.tipo + " forte, in acqua si dissocia tutto."
        : "un " + analita.tipo + " debole, p" + (analita.tipo === "acido" ? "Ka" : "Kb") +
          " = " + conVirgola(analita.pK) + ".") +
      (analita.dove ? " Dove si trova: " + analita.dove + "." : "") +
      " Si titola con " + nomeTitolante() + ", che e' " +
      (analita.tipo === "acido" ? "una base forte." : "un acido forte.");
  }

  function aggiorna() {
    var ph = phDopo(volumeAggiunto);
    var veq = volumeEquivalente();

    letturaVolume.textContent = conVirgola(arrotonda(volumeAggiunto, 2)) + " mL";
    letturaPh.textContent = conVirgola(arrotonda(ph, 2));

    var manca = veq - volumeAggiunto;
    if (Math.abs(manca) < 0.03) letturaResto.textContent = "ci siamo";
    else if (manca > 0) letturaResto.textContent = "mancano " + conVirgola(arrotonda(manca, 2)) + " mL";
    else letturaResto.textContent = "superato di " + conVirgola(arrotonda(-manca, 2)) + " mL";

    pastiglieSostanza.forEach(function (b) {
      b.className = "pillola" + (b.dato === analita ? " attiva" : "");
    });
    pastiglieIndicatore.forEach(function (b) {
      b.className = "pillola" + (b.dato === indicatore ? " attiva" : "");
    });
    pastiglieEsperimento.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    bottoneVersa.textContent = versando ? "Chiudi il rubinetto" : "Apri il rubinetto";
    frase.textContent = raccontaDove(ph, veq);
    aggiornaScheda();

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegnaBanco();
    disegnaCurva();
  }

  function raccontaDove(ph, veq) {
    var acido = analita.tipo === "acido";
    var virato = haVirato(ph);
    var manca = veq - volumeAggiunto;

    if (volumeAggiunto === 0) {
      return "Nella beuta per ora c'e' solo " + analita.nome.toLowerCase() + ": il pH di partenza e' " +
        conVirgola(arrotonda(ph, 2)) + ". Apri il rubinetto e guarda che cosa succede.";
    }
    if (Math.abs(manca) < 0.03) {
      return "Siamo al punto equivalente: le moli di " + nomeTitolante() + " versate sono esattamente " +
        "quante quelle di " + analita.formula + " di partenza. Il pH vale " + conVirgola(arrotonda(ph, 2)) +
        (analita.forte
          ? ", cioe' 7: in beuta restano acqua e un sale che il pH non lo tocca."
          : (acido
            ? ", e non 7: in beuta e' rimasta la base coniugata dell'acido, che rende la soluzione un po' basica."
            : ", e non 7: in beuta e' rimasto l'acido coniugato della base, che rende la soluzione un po' acida."));
    }
    if (manca > 0) {
      if (!analita.forte && volumeAggiunto > veq * 0.15 && volumeAggiunto < veq * 0.85) {
        var aMeta = Math.abs(volumeAggiunto - veq / 2) < 0.06;
        return "Questa e' la zona tampone: una parte della sostanza e' ancora intera e una parte e' gia' " +
          "trasformata, e il pH sale pianissimo." +
          (aMeta
            ? " Proprio a meta' strada le due meta' si pareggiano e il pH vale " + conVirgola(arrotonda(ph, 2)) +
              ", cioe' il pKa della coppia: e' il modo piu' rapido per misurarlo."
            : "");
      }
      return "Mancano ancora " + conVirgola(arrotonda(manca, 2)) + " mL. " +
        (virato
          ? "Attenzione pero': l'indicatore e' gia' virato, quindi ti direbbe di fermarti troppo presto."
          : "L'indicatore non e' ancora cambiato.");
    }
    return "Hai superato il punto equivalente di " + conVirgola(arrotonda(-manca, 2)) + " mL: adesso comanda " +
      "il " + nomeTitolante() + " in eccesso e il pH torna ad appiattirsi. " +
      (virato ? "L'indicatore e' virato." : "L'indicatore non e' virato nemmeno adesso: con questa coppia non serve a niente.");
  }

  /* il ciclo dell'animazione: una goccia ogni tanto, finche' il
     rubinetto resta aperto */
  var ultimo = 0;
  function battito(ora) {
    if (versando) {
      if (!ultimo) ultimo = ora;
      if (ora - ultimo > 90) {
        ultimo = ora;
        if (volumeAggiunto >= volumeMassimo()) { versando = false; aggiorna(); }
        else versa(0.05);
      } else {
        disegnaBanco();
      }
    } else {
      ultimo = 0;
    }
    requestAnimationFrame(battito);
  }

  /* ==========================================================
     8. Costruire la pagina
     ========================================================== */

  function costruisci() {
    svuota(contenitore);
    pastiglieSostanza = []; pastiglieIndicatore = []; pastiglieEsperimento = [];

    var e1 = App.avvisoErroriFile("soluzioni.txt", erroriSost);
    if (e1) contenitore.appendChild(e1);
    var e2 = App.avvisoErroriFile("indicatori.txt", erroriInd);
    if (e2) contenitore.appendChild(e2);

    contenitore.appendChild(elemento("p", "guida",
      "Titolare vuol dire aggiungere goccia a goccia una soluzione di concentrazione nota, finche' " +
      "non ha reagito tutta la sostanza che sta nella beuta. Il momento in cui finisce si chiama punto " +
      "equivalente: da quel volume si risale alla concentrazione di partenza."));

    /* --- gli esperimenti pronti --- */
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
      pastiglieEsperimento.push(b);
      griglia.appendChild(b);
    });
    contenitore.appendChild(griglia);

    /* --- il banco --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Il banco"));
    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("versati", function (n) { letturaVolume = n; }));
    letture.appendChild(unaLettura("pH", function (n) { letturaPh = n; }));
    letture.appendChild(unaLettura("al punto equivalente", function (n) { letturaResto = n; }));
    contenitore.appendChild(letture);

    var bottoni = elemento("div", "bottoni");
    bottoneVersa = elemento("button", "bottone", "Apri il rubinetto");
    bottoneVersa.type = "button";
    bottoneVersa.addEventListener("click", function () {
      versando = !versando;
      aggiorna();
    });
    bottoni.appendChild(bottoneVersa);

    [["Una goccia", 0.05], ["1 mL", 1], ["5 mL", 5]].forEach(function (coppia) {
      var bo = elemento("button", "bottone-testo", coppia[0]);
      bo.type = "button";
      bo.addEventListener("click", function () { versa(coppia[1]); });
      bottoni.appendChild(bo);
    });

    var azzera = elemento("button", "bottone-testo", "Ricomincia");
    azzera.type = "button";
    azzera.addEventListener("click", ricomincia);
    bottoni.appendChild(azzera);
    contenitore.appendChild(bottoni);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    /* --- la curva --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La curva di titolazione"));
    var scatolaC = elemento("div", "scatola-grafico");
    telaCurva = elemento("canvas", "tela");
    scatolaC.appendChild(telaCurva);
    contenitore.appendChild(scatolaC);

    var rigaMostra = elemento("div", "bottoni");
    var mostra = elemento("button", "bottone-testo", "Mostra la curva intera");
    mostra.type = "button";
    mostra.addEventListener("click", function () {
      mostraCurva = !mostraCurva;
      mostra.textContent = mostraCurva ? "Nascondi la curva intera" : "Mostra la curva intera";
      disegnaCurva();
    });
    rigaMostra.appendChild(mostra);
    contenitore.appendChild(rigaMostra);

    contenitore.appendChild(elemento("p", "nota-piccola",
      "La linea blu e' la strada che hai percorso tu, goccia dopo goccia. La riga tratteggiata verticale " +
      "segna il punto equivalente calcolato: serve per controllare se ti sei fermato nel posto giusto."));

    /* --- che cosa c'e' nella beuta --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Che cosa c'e' nella beuta"));
    var scelte = elemento("div", "scelte-grandezza");
    sostanze.forEach(function (s) {
      var b = elemento("button", "pillola", s.nome);
      b.type = "button";
      b.dato = s;
      b.addEventListener("click", function () {
        analita = s;
        esperimentoScelto = -1;
        ricomincia();
      });
      pastiglieSostanza.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);

    schedaSost = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaSost);

    /* --- l'indicatore --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "L'indicatore"));
    var scelteI = elemento("div", "scelte-grandezza");
    indicatori.forEach(function (ind) {
      var b = elemento("button", "pillola", ind.nome);
      b.type = "button";
      b.dato = ind;
      b.addEventListener("click", function () {
        indicatore = ind;
        esperimentoScelto = -1;
        aggiorna();
      });
      pastiglieIndicatore.push(b);
      scelteI.appendChild(b);
    });
    contenitore.appendChild(scelteI);

    contenitore.appendChild(elemento("p", "nota-piccola",
      "Un indicatore va bene se il suo viraggio cade dentro il tratto ripido della curva. La fascia grigia " +
      "sul grafico mostra dove vira quello scelto: se resta fuori dal salto, l'indicatore ti fa sbagliare."));

    /* --- le manopole --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le manopole"));
    var comandi = elemento("div", "comandi");
    cursoreConc = cursore("Concentrazione nella beuta", 0.01, 0.5, 0.01, concAnalita, "mol/L", function (v) {
      concAnalita = v; esperimentoScelto = -1; ricomincia();
    });
    cursoreVol = cursore("Volume nella beuta", 5, 50, 1, volumeAnalita, "mL", function (v) {
      volumeAnalita = v; esperimentoScelto = -1; ricomincia();
    });
    cursoreConcT = cursore("Concentrazione nella buretta", 0.01, 0.5, 0.01, concTitolante, "mol/L", function (v) {
      concTitolante = v; esperimentoScelto = -1; ricomincia();
    });
    comandi.appendChild(cursoreConc);
    comandi.appendChild(cursoreVol);
    comandi.appendChild(cursoreConcT);
    contenitore.appendChild(comandi);

    /* --- i limiti del modello --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Tutto avviene a 25 gradi: il prodotto ionico dell'acqua vale 10 alla meno 14 e non cambia mai.",
      "Le soluzioni sono considerate diluite, quindi al posto delle attivita' si usano le concentrazioni. Sopra circa 0,1 mol/L la curva vera si scosta un poco da questa.",
      "Le sostanze sono tutte monoprotiche: cedono o prendono un solo ione H+. L'acido solforico o l'acido fosforico avrebbero piu' salti, non uno solo.",
      "Il colore cambia in modo continuo fra i due estremi del viraggio. Dal vero l'occhio non lo vede cosi' graduale.",
      "Non si tiene conto dell'anidride carbonica che entra dall'aria e che, in una titolazione lenta con la soda, sposta un po' il risultato.",
      "La buretta non si svuota mai per davvero: quando arriva a zero si considera riempita di nuovo."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(360, Math.max(240, larghezza * 0.66)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaC = telaCurva.parentNode.clientWidth;
    altezzaC = Math.round(Math.min(300, Math.max(200, larghezzaC * 0.55)));
    telaCurva.width = larghezzaC * dpr; telaCurva.height = altezzaC * dpr;
    telaCurva.style.width = larghezzaC + "px"; telaCurva.style.height = altezzaC + "px";
    ctxCurva = telaCurva.getContext("2d");
    ctxCurva.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegnaBanco();
    disegnaCurva();
  });

  /* ==========================================================
     9. Avvio
     ========================================================== */

  Promise.all([App.caricaTesto("soluzioni.txt"), App.caricaTesto("indicatori.txt")])
    .then(function (testi) {
      var a = leggiSostanze(testi[0]);
      var b = leggiIndicatori(testi[1]);
      sostanze = a.elenco; erroriSost = a.errori;
      indicatori = b.elenco; erroriInd = b.errori;

      if (!sostanze.length || !indicatori.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "I file di contenuto sono stati letti ma non contengono righe valide."));
        contenitore.appendChild(avviso);
        return;
      }

      analita = sostanze.filter(function (s) { return s.tipo === "acido"; })[0] || sostanze[0];
      indicatore = indicatori[0];
      costruisci();
      applicaEsperimento(ESPERIMENTI[0]);
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("soluzioni.txt", errore.message));
    });

})();
