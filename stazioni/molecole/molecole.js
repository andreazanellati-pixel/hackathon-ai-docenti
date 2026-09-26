/* ============================================================
   Il costruttore di molecole
   ------------------------------------------------------------
   Si sceglie un atomo centrale, gli si attaccano intorno altri
   atomi, e viene fuori la forma. Poi si guarda se la molecola
   nel suo insieme ha un lato più negativo dell'altro.

   Come funziona, in due parole:
   - la geometria non è presa da una tabella: le zone di
     elettroni attorno al centro si respingono, e il sito le
     dispone il più lontano possibile le une dalle altre. È
     la regola VSEPR applicata, non raccontata
   - la polarità è calcolata sommando i legami come frecce nello
     spazio, una per una. Per questo l'anidride carbonica risulta
     apolare pur avendo due legami molto polari: le due frecce
     tirano in direzioni opposte e la somma fa zero
   - le elettronegatività stanno in un file di testo, e le
     molecole in un altro. Aggiungendone una nuova, il sito
     calcola tutto anche per quella
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var PESO_COPPIA = 0.4;     /* quanto conta una coppia solitaria nella polarità:
                                tarato perché i casi classici vengano giusti,
                                SO2 compreso, dove la coppia si oppone ai legami
                                invece di sommarsi come nell'ammoniaca */

  /* ---------- stato ---------- */

  var elementi = [], molecole = [], erroriEl = [], erroriMol = [];
  var molecola = null;
  var giro = 0;
  var inMoto = true;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var letturaForma = null, letturaAngolo = null, letturaPolare = null;
  var pastiglieMol = [];
  var frase = null, tabellaLegami = null;

  /* ==========================================================
     1. Leggere i file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiElementi(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 4) {
        errori.push("riga " + (i + 1) + ": servono quattro parti separate da | .");
        return;
      }
      var en = numero(p[2]);
      if (en === null || en <= 0) {
        errori.push("riga " + (i + 1) + ": l'elettronegatività deve essere un numero maggiore di zero.");
        return;
      }
      elenco.push({
        simbolo: p[0].trim(),
        nome: p[1].trim(),
        en: en,
        colore: p[3].trim()
      });
    });
    return { elenco: elenco, errori: errori };
  }

  function elementoDi(simbolo) {
    return elementi.filter(function (e) { return e.simbolo === simbolo; })[0] || null;
  }

  function leggiMolecole(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 6) {
        errori.push("riga " + (i + 1) + ": servono sei parti separate da | .");
        return;
      }
      var centro = p[2].trim();
      var legati = p[3].split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      var coppie = parseInt(p[4].trim(), 10);

      var mancanti = [centro].concat(legati).filter(function (s) { return !elementoDi(s); });
      if (mancanti.length) {
        errori.push("riga " + (i + 1) + ": non conosco l'elemento «" + mancanti[0] +
          "». Va aggiunto in elettronegativita.txt.");
        return;
      }
      if (isNaN(coppie) || coppie < 0) {
        errori.push("riga " + (i + 1) + ": le coppie solitarie devono essere un numero, anche zero.");
        return;
      }
      if (legati.length + coppie < 2 || legati.length + coppie > 6) {
        errori.push("riga " + (i + 1) + ": le zone di elettroni attorno al centro devono essere fra due e sei. " +
          "Qui sono " + (legati.length + coppie) + ".");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        formula: p[1].trim(),
        centro: centro,
        legati: legati,
        coppie: coppie,
        nota: p[5].trim()
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     2. La geometria: le zone si respingono
     ------------------------------------------------------------
     Attorno al centro ci sono tante zone di elettroni quanti
     sono i legami più le coppie solitarie. Si respingono, e
     si sistemano il più lontano possibile le une dalle altre:
     queste sono le posizioni che ne risultano.
     ========================================================== */

  function direzioni(quante) {
    var r3 = 1 / Math.sqrt(3);
    if (quante === 2) return [[1, 0, 0], [-1, 0, 0]];
    if (quante === 3) return [
      [1, 0, 0],
      [-0.5, Math.sqrt(3) / 2, 0],
      [-0.5, -Math.sqrt(3) / 2, 0]
    ];
    if (quante === 4) return [
      [r3, r3, r3], [r3, -r3, -r3], [-r3, r3, -r3], [-r3, -r3, r3]
    ];
    if (quante === 5) return [
      /* le tre equatoriali per prime: è lì che vanno le coppie
         solitarie, perché hanno più spazio */
      [1, 0, 0],
      [-0.5, Math.sqrt(3) / 2, 0],
      [-0.5, -Math.sqrt(3) / 2, 0],
      [0, 0, 1], [0, 0, -1]
    ];
    return [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ];
  }

  /* Quale nome ha la forma della molecola. Dipende da quante
     zone ci sono E da quante di quelle sono coppie solitarie:
     le coppie occupano spazio ma non si vedono. */
  function nomeForma(legami, coppie) {
    var zone = legami + coppie;
    var tabella = {
      "2.0": "lineare",
      "3.0": "trigonale planare", "3.1": "angolare",
      "4.0": "tetraedrica", "4.1": "piramidale a base triangolare", "4.2": "angolare",
      "5.0": "bipiramidale a base triangolare", "5.1": "a forma di altalena",
      "5.2": "a forma di T", "5.3": "lineare",
      "6.0": "ottaedrica", "6.1": "piramidale a base quadrata", "6.2": "quadrata planare"
    };
    return tabella[zone + "." + coppie] || "con " + zone + " zone";
  }

  /* L'angolo fra due legami vicini, in gradi. */
  function angoloFraLegami() {
    var zone = molecola.legati.length + molecola.coppie;
    var d = direzioni(zone);
    var coppie = molecola.coppie;
    var legami = [];
    for (var i = 0; i < d.length; i++) {
      if (i < coppie) continue;
      legami.push(d[i]);
    }
    if (legami.length < 2) return null;

    /* il più piccolo angolo fra due legami */
    var minimo = 180;
    for (var a = 0; a < legami.length; a++) {
      for (var b = a + 1; b < legami.length; b++) {
        var p = legami[a][0] * legami[b][0] + legami[a][1] * legami[b][1] + legami[a][2] * legami[b][2];
        var ang = Math.acos(Math.max(-1, Math.min(1, p))) * 180 / Math.PI;
        if (ang < minimo) minimo = ang;
      }
    }
    return minimo;
  }

  /* ==========================================================
     3. La polarità: si sommano le frecce
     ========================================================== */

  /* Ogni legame è una freccia lunga quanto la differenza di
     elettronegatività e diretta verso l'atomo più avido. Le
     coppie solitarie contano anche loro. Si sommano tutte, e si
     guarda quanto resta. */
  function momento() {
    var zone = molecola.legati.length + molecola.coppie;
    var d = direzioni(zone);
    var centro = elementoDi(molecola.centro);
    var somma = [0, 0, 0];
    var dettaglio = [];

    var k = 0;
    /* prima le coppie solitarie, che occupano le posizioni più comode */
    for (var c = 0; c < molecola.coppie; c++) {
      var u = d[k++];
      somma[0] += PESO_COPPIA * u[0];
      somma[1] += PESO_COPPIA * u[1];
      somma[2] += PESO_COPPIA * u[2];
      dettaglio.push({ tipo: "coppia", direzione: u, forza: PESO_COPPIA });
    }
    /* poi i legami */
    molecola.legati.forEach(function (s) {
      var u = d[k++];
      var el = elementoDi(s);
      var forza = el.en - centro.en;
      somma[0] += forza * u[0];
      somma[1] += forza * u[1];
      somma[2] += forza * u[2];
      dettaglio.push({ tipo: "legame", simbolo: s, direzione: u, forza: forza });
    });

    var lunghezza = Math.sqrt(somma[0] * somma[0] + somma[1] * somma[1] + somma[2] * somma[2]);
    return { vettore: somma, lunghezza: lunghezza, dettaglio: dettaglio };
  }

  function polare() { return momento().lunghezza > 0.15; }

  /* ==========================================================
     4. Il disegno
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  /* Si gira lentamente la molecola attorno all'asse verticale,
     così si capisce che è una cosa a tre dimensioni. */
  function proietta(v, scala) {
    var a = giro;
    var x = v[0] * Math.cos(a) + v[2] * Math.sin(a);
    var z = -v[0] * Math.sin(a) + v[2] * Math.cos(a);
    var y = v[1];
    /* un po' di inclinazione, per non vedere tutto di taglio */
    var incl = 0.38;
    var y2 = y * Math.cos(incl) - z * Math.sin(incl);
    var z2 = y * Math.sin(incl) + z * Math.cos(incl);
    return { x: x * scala, y: -y2 * scala, z: z2 };
  }

  function disegna() {
    if (!ctx || larghezza <= 0 || !molecola) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezza, altezza);

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var cx = larghezza / 2, cy = altezza * 0.47;
    var scala = Math.min(larghezza * 0.2, altezza * 0.28);
    var centro = elementoDi(molecola.centro);
    var m = momento();

    /* si prepara l'elenco di tutto quello che va disegnato, e lo
       si ordina dal più lontano al più vicino */
    var pezzi = [];
    m.dettaglio.forEach(function (d) {
      var p = proietta(d.direzione, scala);
      pezzi.push({ z: p.z, x: p.x, y: p.y, dato: d });
    });
    pezzi.sort(function (a, b) { return a.z - b.z; });

    function raggio(z) { return 1 + z * 0.22; }

    /* i legami e gli atomi dietro */
    pezzi.forEach(function (p) {
      if (p.z > 0) return;
      disegnaPezzo(p);
    });

    /* l'atomo centrale */
    c.fillStyle = centro.colore;
    c.beginPath();
    c.arc(cx, cy, 22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = chiaro(centro.colore) ? "#20262e" : "#ffffff";
    c.font = "600 14px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText(centro.simbolo, cx, cy + 5);

    /* quelli davanti */
    pezzi.forEach(function (p) {
      if (p.z <= 0) return;
      disegnaPezzo(p);
    });

    function disegnaPezzo(p) {
      var d = p.dato;
      var x = cx + p.x, y = cy + p.y;
      var r = raggio(p.z);

      if (d.tipo === "coppia") {
        /* una coppia solitaria: due puntini, non un atomo */
        c.strokeStyle = "rgba(120, 130, 145, 0.55)";
        c.lineWidth = 2; c.setLineDash([3, 3]);
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke();
        c.setLineDash([]);
        c.fillStyle = "rgba(90, 110, 140, 0.8)";
        var perp = Math.atan2(y - cy, x - cx) + Math.PI / 2;
        [-1, 1].forEach(function (lato) {
          c.beginPath();
          c.arc(x + Math.cos(perp) * 5 * lato, y + Math.sin(perp) * 5 * lato, 3.5 * r, 0, Math.PI * 2);
          c.fill();
        });
        return;
      }

      var el = elementoDi(d.simbolo);
      /* il legame, tanto più scuro quanto più è polare */
      var intensita = Math.min(1, Math.abs(d.forza) / 1.8);
      c.strokeStyle = "rgba(60, 60, 70, " + (0.3 + intensita * 0.5).toFixed(2) + ")";
      c.lineWidth = 3 + r;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(x, y); c.stroke();

      c.fillStyle = el.colore;
      c.beginPath();
      c.arc(x, y, 16 * r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.25)"; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = chiaro(el.colore) ? "#20262e" : "#ffffff";
      c.font = "600 " + Math.round(11 * r) + "px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText(el.simbolo, x, y + 4 * r);
    }

    /* la freccia del momento totale */
    if (m.lunghezza > 0.15) {
      var p = proietta(
        [m.vettore[0] / m.lunghezza, m.vettore[1] / m.lunghezza, m.vettore[2] / m.lunghezza],
        scala * 1.35);
      c.strokeStyle = "#c06a28"; c.lineWidth = 3.5;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + p.x, cy + p.y); c.stroke();
      var ang = Math.atan2(p.y, p.x);
      c.beginPath();
      c.moveTo(cx + p.x, cy + p.y);
      c.lineTo(cx + p.x - Math.cos(ang - 0.4) * 11, cy + p.y - Math.sin(ang - 0.4) * 11);
      c.lineTo(cx + p.x - Math.cos(ang + 0.4) * 11, cy + p.y - Math.sin(ang + 0.4) * 11);
      c.closePath();
      c.fillStyle = "#c06a28"; c.fill();
      c.fillStyle = "#c06a28";
      c.font = "600 10px system-ui, sans-serif";
      c.textAlign = "center";
      c.fillText("verso il lato negativo", cx + p.x * 1.15, cy + p.y * 1.15 + 14);
    }

    c.fillStyle = tenue;
    c.font = "600 12px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText(molecola.formula + " · " + nomeForma(molecola.legati.length, molecola.coppie),
      8, 16);
    c.textAlign = "right";
    c.fillText(m.lunghezza > 0.15 ? "polare" : "apolare", larghezza - 8, 16);
  }

  /* un colore chiaro vuole scritte scure sopra */
  function chiaro(hex) {
    var s = hex.replace("#", "");
    var r = parseInt(s.slice(0, 2), 16), g = parseInt(s.slice(2, 4), 16), b = parseInt(s.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  /* ==========================================================
     5. Le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

  function racconta() {
    var m = momento();
    var centro = elementoDi(molecola.centro);
    var tuttiUguali = molecola.legati.every(function (s) { return s === molecola.legati[0]; });
    var legamiPolari = molecola.legati.some(function (s) {
      return Math.abs(elementoDi(s).en - centro.en) > 0.4;
    });

    if (m.lunghezza <= 0.15) {
      if (legamiPolari) {
        return "Ecco il punto interessante: i legami sono polari, eppure la molecola nel suo insieme " +
          "non lo è. Guarda il disegno: le frecce dei singoli legami tirano in direzioni tali da " +
          "annullarsi a vicenda, e la somma fa zero. Perché succeda servono due cose insieme: che gli " +
          "atomi attaccati siano tutti uguali, e che siano disposti in modo simmetrico. Basta rompere " +
          "una delle due condizioni e la molecola diventa polare.";
      }
      return "Qui non c'è quasi niente da annullare: gli atomi legati hanno un'elettronegatività " +
        "simile a quella del centro, quindi i legami sono già poco polari di loro. La molecola è " +
        "apolare, e lo sarebbe comunque.";
    }

    if (molecola.coppie > 0) {
      return "La molecola è polare, e una buona parte del merito è delle coppie solitarie. Una coppia " +
        "non si vede ma occupa spazio, spinge via i legami e rompe la simmetria; in più è lei stessa " +
        "una zona carica di elettroni. Prova a confrontare questa molecola con una che ha gli stessi " +
        "legami ma nessuna coppia solitaria: cambia tutto.";
    }

    if (!tuttiUguali) {
      return "La molecola è polare perché gli atomi attaccati non sono tutti uguali. La disposizione " +
        "sarebbe anche simmetrica, ma le frecce hanno lunghezze diverse e quindi non si annullano. " +
        "È il motivo per cui il cloroformio è polare e il tetracloruro di carbonio no, pur avendo " +
        "la stessa forma.";
    }

    return "La molecola è polare: la somma delle frecce dei legami dà un vettore lungo " +
      conVirgola(arrotonda(m.lunghezza, 2)) + ", e punta nella direzione segnata in arancione.";
  }

  /* ==========================================================
     6. La pagina
     ========================================================== */

  function unaLettura(nome, registra) {
    var box = elemento("div", "lettura");
    var v = elemento("div", "lettura-valore", "—");
    box.appendChild(v);
    box.appendChild(elemento("div", "lettura-nome", nome));
    registra(v);
    return box;
  }

  function aggiornaTabella() {
    svuota(tabellaLegami);
    var m = momento();
    var centro = elementoDi(molecola.centro);
    var t = elemento("table", "tabella-cifre");
    var testa = elemento("tr");
    ["", "elettronegatività", "differenza", "quanto è polare il legame"].forEach(function (h) {
      testa.appendChild(elemento("th", null, h));
    });
    t.appendChild(testa);

    var riga0 = elemento("tr");
    riga0.appendChild(elemento("td", null, centro.simbolo + " (al centro)"));
    riga0.appendChild(elemento("td", null, conVirgola(centro.en)));
    riga0.appendChild(elemento("td", null, "—"));
    riga0.appendChild(elemento("td", null, "—"));
    t.appendChild(riga0);

    var visti = {};
    molecola.legati.forEach(function (s) {
      if (visti[s]) return;
      visti[s] = true;
      var el = elementoDi(s);
      var diff = Math.abs(el.en - centro.en);
      var quanti = molecola.legati.filter(function (x) { return x === s; }).length;
      var tr = elemento("tr");
      tr.appendChild(elemento("td", null, s + (quanti > 1 ? " (×" + quanti + ")" : "")));
      tr.appendChild(elemento("td", null, conVirgola(el.en)));
      tr.appendChild(elemento("td", null, conVirgola(arrotonda(diff, 2))));
      tr.appendChild(elemento("td", null,
        diff < 0.4 ? "quasi per niente" : (diff < 1.7 ? "polare" : "così polare da essere ionico")));
      t.appendChild(tr);
    });

    if (molecola.coppie > 0) {
      var trc = elemento("tr");
      trc.appendChild(elemento("td", null, "coppie solitarie (×" + molecola.coppie + ")"));
      trc.appendChild(elemento("td", null, "—"));
      trc.appendChild(elemento("td", null, "—"));
      trc.appendChild(elemento("td", null, "spingono, e contano nella somma"));
      t.appendChild(trc);
    }

    var fine = elemento("tr");
    var c1 = elemento("td", null, "somma di tutte le frecce");
    c1.colSpan = 3;
    fine.appendChild(c1);
    fine.appendChild(elemento("td", null, conVirgola(arrotonda(m.lunghezza, 2)) +
      (m.lunghezza > 0.15 ? " → polare" : " → apolare")));
    t.appendChild(fine);

    tabellaLegami.appendChild(t);
  }

  function aggiorna() {
    letturaForma.textContent = nomeForma(molecola.legati.length, molecola.coppie);
    var ang = angoloFraLegami();
    letturaAngolo.textContent = ang === null ? "—" : Math.round(ang) + "°";
    letturaPolare.textContent = polare() ? "polare" : "apolare";

    pastiglieMol.forEach(function (b) {
      b.className = "pillola" + (b.dato === molecola ? " attiva" : "");
    });

    frase.textContent = racconta();
    aggiornaTabella();

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegna();
  }

  var ultimo = 0;
  function battito(ora) {
    var dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0;
    ultimo = ora;
    if (inMoto && molecola) { giro += dt * 0.5; disegna(); }
    requestAnimationFrame(battito);
  }

  function costruisci() {
    svuota(contenitore);
    pastiglieMol = [];

    var e1 = App.avvisoErroriFile("elettronegativita.txt", erroriEl);
    if (e1) contenitore.appendChild(e1);
    var e2 = App.avvisoErroriFile("molecole.txt", erroriMol);
    if (e2) contenitore.appendChild(e2);

    contenitore.appendChild(elemento("p", "guida",
      "Una molecola con legami polari non è per forza polare lei stessa. Dipende da come sono " +
      "disposti quei legami nello spazio: se tirano in direzioni che si annullano, il risultato è " +
      "zero. È il motivo per cui l'anidride carbonica e l'acqua si comportano in modo così diverso, " +
      "pur essendo fatte tutte e due di ossigeno legato a qualcos'altro."));

    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);
    contenitore.appendChild(elemento("p", "didascalia",
      "I puntini azzurri uniti da una linea tratteggiata sono le coppie solitarie: non sono atomi, " +
      "ma occupano spazio e piegano la molecola. La freccia arancione, quando c'è, indica da che " +
      "parte la molecola è più negativa."));

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("forma", function (n) { letturaForma = n; }));
    letture.appendChild(unaLettura("angolo fra i legami", function (n) { letturaAngolo = n; }));
    letture.appendChild(unaLettura("nel suo insieme", function (n) { letturaPolare = n; }));
    contenitore.appendChild(letture);

    var bottoni = elemento("div", "bottoni");
    var bGiro = elemento("button", "bottone-testo", "Ferma la rotazione");
    bGiro.type = "button";
    bGiro.addEventListener("click", function () {
      inMoto = !inMoto;
      bGiro.textContent = inMoto ? "Ferma la rotazione" : "Fai girare";
    });
    bottoni.appendChild(bGiro);
    contenitore.appendChild(bottoni);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Legame per legame"));
    tabellaLegami = elemento("div", "involucro-tabella");
    contenitore.appendChild(tabellaLegami);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "La differenza di elettronegatività dice quanto è polare un legame preso da solo. Sotto 0,4 " +
      "il legame si considera praticamente non polare; sopra 1,7 gli elettroni sono così sbilanciati " +
      "che si parla di legame ionico. L'ultima riga è quella che conta per la molecola intera."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quale molecola"));
    var scelte = elemento("div", "scelte-grandezza");
    molecole.forEach(function (m) {
      var b = elemento("button", "pillola", m.formula);
      b.type = "button"; b.dato = m;
      b.addEventListener("click", function () { molecola = m; aggiorna(); });
      pastiglieMol.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);

    var scheda = elemento("p", "nota-piccola", "");
    contenitore.appendChild(scheda);
    aggiornaScheda = function () {
      scheda.textContent = molecola.nome + ", " + molecola.formula + ": " + molecola.nota + ".";
    };

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Tre confronti da provare"));
    var confronti = elemento("div", "griglia-esperimenti");
    [
      ["CO2 e H2O", "Stessi atomi, forme diverse: una apolare e una polarissima", ["CO2", "H2O"]],
      ["CCl4 e CHCl3", "Stessa forma, ma basta cambiare un atomo su quattro", ["CCl4", "CHCl3"]],
      ["CO2 e SO2", "Sembrano uguali, ma una coppia solitaria cambia tutto", ["CO2", "SO2"]]
    ].forEach(function (conf) {
      var b = elemento("button", "carta-esperimento");
      b.type = "button";
      b.appendChild(elemento("div", "esperimento-titolo", conf[0]));
      b.appendChild(elemento("div", "esperimento-sottotitolo", conf[1]));
      var quale = 0;
      b.addEventListener("click", function () {
        var m = molecole.filter(function (x) { return x.formula === conf[2][quale]; })[0];
        quale = (quale + 1) % conf[2].length;
        if (m) { molecola = m; aggiorna(); aggiornaScheda(); }
      });
      confronti.appendChild(b);
    });
    contenitore.appendChild(confronti);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Ogni riquadro qui sopra mostra una delle due molecole a ogni clic: clicca due volte per " +
      "passare dall'una all'altra e guarda che cosa cambia."));

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Gli angoli sono quelli ideali della geometria pura: 109,5 gradi per il tetraedro, 120 per il triangolo. Nella realtà le coppie solitarie spingono più dei legami e li stringono un po': l'acqua sta a 104,5 gradi e non a 109,5, l'ammoniaca a 107.",
      "Le coppie solitarie contano nella somma con un peso fisso, scelto perché i casi classici vengano giusti. Non è una grandezza misurata: il contributo vero dipende dall'atomo e dalla molecola.",
      "C'è un solo atomo centrale. Le molecole vere sono quasi sempre più complicate, e per quelle bisogna sommare i contributi di ogni pezzo: l'etanolo, l'acido acetico, uno zucchero hanno più centri.",
      "Non si distingue fra legami singoli, doppi e tripli. Per la geometria non cambia niente, perché un doppio legame conta come una zona sola; per la polarità invece qualcosa cambia.",
      "Il disegno mostra la molecola come palline e bastoncini. Gli atomi veri non hanno un bordo netto, e la loro nuvola di elettroni si compenetra: è un modo di rappresentare, non una fotografia.",
      "La polarità calcolata qui è relativa, non in debye. Serve a confrontare le molecole fra loro e a dire polare o apolare, non a dare il valore che si trova sui manuali."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
    aggiornaScheda();
  }

  var aggiornaScheda = function () {};

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;
    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(330, Math.max(250, larghezza * 0.6)));
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

  Promise.all([App.caricaTesto("elettronegativita.txt"), App.caricaTesto("molecole.txt")])
    .then(function (testi) {
      var a = leggiElementi(testi[0]);
      elementi = a.elenco; erroriEl = a.errori;

      if (!elementi.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file elettronegativita.txt è stato letto ma non contiene elementi validi."));
        contenitore.appendChild(avviso);
        return;
      }

      var b = leggiMolecole(testi[1]);
      molecole = b.elenco; erroriMol = b.errori;

      if (!molecole.length) {
        svuota(contenitore);
        var avviso2 = elemento("div", "avviso");
        avviso2.appendChild(document.createTextNode(
          "Il file molecole.txt è stato letto ma non contiene molecole valide."));
        contenitore.appendChild(avviso2);
        return;
      }

      molecola = molecole[0];
      costruisci();
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("elettronegativita.txt", errore.message));
    });

})();
