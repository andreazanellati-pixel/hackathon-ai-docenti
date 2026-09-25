/* ============================================================
   L'equilibrio chimico
   ------------------------------------------------------------
   Una reazione che va avanti e indietro dentro un recipiente col
   pistone. Si cambia una cosa e si guarda il sistema rimescolarsi
   fino a ritrovare l'equilibrio.

   Come funziona, in due parole:
   - la reazione non salta all'equilibrio: si integra passo passo
     la velocita' netta, avanti meno indietro, cosi' il riassetto
     si vede accadere invece di comparire gia' fatto
   - il rapporto fra la costante diretta e quella inversa e'
     tenuto uguale a K: e' il legame fra cinetica e termodinamica
   - K cambia con la temperatura secondo l'equazione di van 't
     Hoff, quindi scaldare sposta davvero l'equilibrio, e lo
     sposta nel verso giusto a seconda del segno del delta H
   - il quoziente di reazione Q e' sempre scritto accanto a K:
     Le Chatelier smette di essere una filastrocca quando si
     vede Q allontanarsi da K e poi tornarci
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var R = 8.314;            /* J/(mol K) */
  var COLORI = ["#4c8fbd", "#d9a441", "#4aa06a", "#b5615f", "#7a6fb0", "#5aa0a0"];

  /* ---------- stato ---------- */

  var reazioni = [], erroriFile = [];
  var reazione = null;

  var moli = [];            /* moli di ogni specie */
  var volume = 10;          /* litri */
  var temperatura = 450;    /* gradi */
  var inMoto = true;
  var storia = [];          /* {t, conc: [], q: n} */
  var tempo = 0;
  var segni = [];           /* i momenti in cui abbiamo disturbato: {t, testo} */
  var esperimentoScelto = 0;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaG = null, ctxG = null, larghezzaG = 0, altezzaG = 0;
  var letturaQ = null, letturaK = null, letturaStato = null;
  var pastiglieReazione = [], pastiglieEsp = [];
  var frase = null, bottoneMoto = null, tabella = null;
  var cursoreV = null, cursoreT = null;

  var granelli = [];        /* i pallini disegnati nel recipiente */

  /* ==========================================================
     1. Gli esperimenti gia' pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "Aggiungi un reagente",
      sottotitolo: "Metti altro azoto: il sistema consuma anche l'idrogeno",
      reazione: "Sintesi dell'ammoniaca", volume: 10, temperatura: 450
    },
    {
      titolo: "Stringi il pistone",
      sottotitolo: "Qui 4 moli diventano 2: comprimendo, l'ammoniaca aumenta",
      reazione: "Sintesi dell'ammoniaca", volume: 10, temperatura: 450
    },
    {
      titolo: "Il volume che non conta",
      sottotitolo: "2 moli danno 2 moli: comprimi quanto vuoi, non cambia niente",
      reazione: "Acido iodidrico", volume: 10, temperatura: 450
    },
    {
      titolo: "Scalda una reazione che scalda",
      sottotitolo: "Se la reazione libera calore, scaldare la manda indietro",
      reazione: "Sintesi dell'ammoniaca", volume: 10, temperatura: 350
    },
    {
      titolo: "Il tubo che cambia colore",
      sottotitolo: "Bruno o incolore: qui l'equilibrio si vede a occhio nudo",
      reazione: "Il tubo che cambia colore", volume: 10, temperatura: 25
    },
    {
      titolo: "Una reazione che assorbe calore",
      sottotitolo: "Delta H positivo: scaldando, stavolta, si va avanti",
      reazione: "Dissociazione dell'acido fluoridrico", volume: 10, temperatura: 25
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  /* Trasforma "N2 + 3 H2" nell'elenco delle specie col loro
     coefficiente. */
  function leggiLato(testo) {
    var pezzi = String(testo).split("+");
    var specie = [];
    for (var i = 0; i < pezzi.length; i++) {
      var p = pezzi[i].trim();
      if (p === "") return null;
      var m = p.match(/^(\d+(?:[.,]\d+)?)?\s*(.+)$/);
      if (!m) return null;
      var coeff = m[1] ? numero(m[1]) : 1;
      if (coeff === null || coeff <= 0) return null;
      specie.push({ nome: m[2].trim(), coeff: coeff });
    }
    return specie;
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
      var sinistra = leggiLato(p[1]);
      var destra = leggiLato(p[2]);
      if (!sinistra || !destra) {
        errori.push("riga " + (i + 1) + ": reagenti o prodotti scritti male. Esempio giusto: N2 + 3 H2");
        return;
      }
      var k = numero(p[3]), tRif = numero(p[4]), dh = numero(p[5]);
      if (k === null || tRif === null || dh === null) {
        errori.push("riga " + (i + 1) + ": K, temperatura di riferimento e delta H devono essere numeri.");
        return;
      }
      if (k <= 0) {
        errori.push("riga " + (i + 1) + ": la costante K deve essere maggiore di zero.");
        return;
      }

      /* una sola lista di specie, con il coefficiente negativo per
         i reagenti e positivo per i prodotti */
      var specie = [];
      sinistra.forEach(function (s) { specie.push({ nome: s.nome, coeff: -s.coeff }); });
      destra.forEach(function (s) { specie.push({ nome: s.nome, coeff: s.coeff }); });

      var deltaN = 0;
      specie.forEach(function (s) { deltaN += s.coeff; });

      /* i colori sono facoltativi: se mancano si usa la tavolozza
         di casa. Servono a reazioni come quella del biossido di
         azoto, dove il colore vero e' il bello della faccenda. */
      var colori = null;
      if (p.length > 7 && p[7].trim() !== "") {
        colori = p[7].split(",").map(function (c) { return c.trim(); });
        if (colori.length !== specie.length) {
          errori.push("riga " + (i + 1) + ": i colori sono " + colori.length +
            " ma le sostanze sono " + specie.length + ". Li ignoro.");
          colori = null;
        }
      }

      elenco.push({
        nome: p[0].trim(),
        equazione: p[1].trim() + " ⇌ " + p[2].trim(),
        specie: specie,
        kRif: k,
        tRif: tRif,
        deltaH: dh * 1000,     /* da kJ/mol a J/mol */
        deltaN: deltaN,
        nota: p.length > 6 ? p[6].trim() : "",
        colori: colori,
        scalaVelocita: 1
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. La chimica
     ========================================================== */

  /* La costante di equilibrio alla temperatura di adesso.
     Equazione di van 't Hoff: scaldando, una reazione esotermica
     ha K piu' piccolo, una endotermica K piu' grande. */
  function costante() {
    var t = temperatura + 273.15;
    var tr = reazione.tRif + 273.15;
    var lnK = Math.log(reazione.kRif) - (reazione.deltaH / R) * (1 / t - 1 / tr);
    return Math.exp(Math.max(-60, Math.min(60, lnK)));
  }

  function concentrazione(i) {
    return moli[i] / volume;
  }

  /* Il quoziente di reazione: la stessa formula di K, ma con le
     concentrazioni che ci sono adesso, in equilibrio o no. */
  function quoziente() {
    var sopra = 1, sotto = 1;
    reazione.specie.forEach(function (s, i) {
      var c = concentrazione(i);
      if (c <= 0) c = 1e-12;
      if (s.coeff > 0) sopra *= Math.pow(c, s.coeff);
      else sotto *= Math.pow(c, -s.coeff);
    });
    return sopra / sotto;
  }

  /* La velocita' netta: quanto va avanti meno quanto torna
     indietro. Le due costanti stanno fra loro come K, che e'
     il legame fra cinetica e termodinamica. */
  function velocitaNetta() {
    var k = costante();
    var kDiretta = reazione.scalaVelocita;
    var kInversa = kDiretta / k;
    var avanti = kDiretta, indietro = kInversa;
    reazione.specie.forEach(function (s, i) {
      var c = Math.max(0, concentrazione(i));
      if (s.coeff < 0) avanti *= Math.pow(c, -s.coeff);
      else indietro *= Math.pow(c, s.coeff);
    });
    /* scaldare fa andare piu' in fretta tutte e due i versi */
    var spinta = Math.exp((temperatura - reazione.tRif) / 120);
    return (avanti - indietro) * spinta;
  }

  function unPasso(dt) {
    /* Si avanza a passetti piccoli, cosi' non si scavalca
       l'equilibrio. In piu' ogni passetto viene accorciato quando
       sarebbe troppo grosso rispetto a quello che c'e' in giro:
       serve alle reazioni con la costante molto lontana da uno,
       dove la spinta di ritorno e' violenta e senza freno il
       calcolo si metterebbe a ballare. */
    var sottoPassi = 12;
    for (var n = 0; n < sottoPassi; n++) {
      var d = velocitaNetta() * (dt / sottoPassi) * volume;
      if (d === 0) continue;

      var freno = 1;
      reazione.specie.forEach(function (s, i) {
        var variazione = Math.abs(s.coeff * d);
        if (variazione <= 0) return;
        var disponibile = Math.max(moli[i], 1e-7);
        freno = Math.min(freno, 0.12 * disponibile / variazione);
      });
      if (freno < 1) d = d * freno;

      reazione.specie.forEach(function (s, i) {
        moli[i] += s.coeff * d;
        if (moli[i] < 1e-9) moli[i] = 1e-9;
      });
    }
    tempo += dt;
  }

  function allEquilibrio() {
    var k = costante(), q = quoziente();
    if (k <= 0) return false;
    var rapporto = q / k;
    return rapporto > 0.97 && rapporto < 1.03;
  }

  /* ==========================================================
     4. Disturbi
     ========================================================== */

  function segna(testo) {
    segni.push({ t: tempo, testo: testo });
    if (segni.length > 6) segni.shift();
  }

  function aggiungi(i, quanto) {
    moli[i] += quanto;
    segna((quanto > 0 ? "aggiunto " : "tolto ") + reazione.specie[i].nome);
    aggiorna();
  }

  function cambiaVolume(fattore) {
    volume = Math.max(1, Math.min(50, volume * fattore));
    if (cursoreV) cursoreV.aggiorna(arrotonda(volume, 1));
    segna(fattore < 1 ? "volume ridotto" : "volume aumentato");
    aggiorna();
  }

  function rimetti() {
    moli = [];
    /* si parte sempre coi soli reagenti, cosi' si vede la reazione
       incamminarsi verso l'equilibrio */
    reazione.specie.forEach(function (s) {
      moli.push(s.coeff < 0 ? -s.coeff * 2 : 1e-9);
    });
    tempo = 0;
    storia = [];
    segni = [];
    aggiorna();
  }

  /* ==========================================================
     5. Il recipiente
     ========================================================== */

  /* Il colore di una sostanza: quello scritto nel file, se c'e',
     altrimenti uno preso dalla tavolozza. */
  function coloreSpecie(i) {
    if (reazione.colori && reazione.colori[i]) return reazione.colori[i];
    return COLORI[i % COLORI.length];
  }

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function creaGranelli() {
    granelli = [];
    for (var i = 0; i < 90; i++) {
      granelli.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.006,
        vy: (Math.random() - 0.5) * 0.006,
        specie: 0
      });
    }
    ridistribuisci();
  }

  /* Ogni granello prende il colore di una specie, in proporzione
     a quante moli ce ne sono. */
  function ridistribuisci() {
    var totale = 0;
    moli.forEach(function (m) { totale += m; });
    if (totale <= 0) return;
    var soglie = [], somma = 0;
    moli.forEach(function (m) { somma += m / totale; soglie.push(somma); });
    granelli.forEach(function (g, i) {
      var q = (i + 0.5) / granelli.length;
      for (var j = 0; j < soglie.length; j++) {
        if (q <= soglie[j]) { g.specie = j; return; }
      }
      g.specie = soglie.length - 1;
    });
  }

  function muoviGranelli(dt) {
    var spinta = 0.5 + (temperatura + 273) / 700;
    granelli.forEach(function (g) {
      g.x += g.vx * spinta * dt * 60;
      g.y += g.vy * spinta * dt * 60;
      if (g.x < 0.03 || g.x > 0.97) { g.vx = -g.vx; g.x = Math.min(0.97, Math.max(0.03, g.x)); }
      if (g.y < 0.03 || g.y > 0.97) { g.vy = -g.vy; g.y = Math.min(0.97, Math.max(0.03, g.y)); }
    });
  }

  function disegnaRecipiente() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezza, altezza);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");

    /* il cilindro: largo fisso, alto in proporzione al volume */
    var margine = 30;
    var largoC = Math.min(200, larghezza * 0.42);
    var x0 = margine;
    var altoMax = altezza - 46;
    var quota = Math.max(0.16, Math.min(1, volume / 25));
    var altoC = altoMax * quota;
    var y0 = altezza - 22 - altoC;

    /* il gas dentro, con il colore medio delle specie presenti */
    c.fillStyle = coloreGas();
    c.fillRect(x0, y0, largoC, altoC);

    /* i granelli */
    granelli.forEach(function (g) {
      c.fillStyle = coloreSpecie(g.specie);
      c.beginPath();
      c.arc(x0 + g.x * largoC, y0 + g.y * altoC, 3, 0, Math.PI * 2);
      c.fill();
    });

    /* le pareti e il pistone */
    c.strokeStyle = bordo; c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(x0, y0); c.lineTo(x0, altezza - 22);
    c.lineTo(x0 + largoC, altezza - 22); c.lineTo(x0 + largoC, y0);
    c.stroke();
    c.fillStyle = tenue;
    c.fillRect(x0 - 4, y0 - 9, largoC + 8, 9);
    c.fillRect(x0 + largoC / 2 - 4, Math.max(2, y0 - 26), 8, 18);

    c.fillStyle = tenue;
    c.font = "600 12px system-ui, sans-serif";
    c.textAlign = "center";
    c.fillText(conVirgola(arrotonda(volume, 1)) + " L, " + Math.round(temperatura) + " °C",
      x0 + largoC / 2, altezza - 6);

    /* la legenda, a destra */
    var xl = x0 + largoC + 18;
    c.textAlign = "left";
    c.font = "11px system-ui, sans-serif";
    reazione.specie.forEach(function (s, i) {
      var y = 24 + i * 20;
      if (y > altezza - 20) return;
      c.fillStyle = coloreSpecie(i);
      c.beginPath(); c.arc(xl + 5, y - 4, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = tenue;
      c.fillText(s.nome + "  " + conVirgola(arrotonda(concentrazione(i), 3)) + " mol/L", xl + 16, y);
    });
  }

  /* Il colore del gas: una media dei colori delle specie, pesata
     su quante ce ne sono. Serve soprattutto al biossido di azoto,
     che e' bruno mentre il suo dimero e' incolore. */
  function coloreGas() {
    var totale = 0;
    moli.forEach(function (m) { totale += m; });
    if (totale <= 0) return "rgba(255,255,255,0)";
    var r = 250, g = 249, b = 244, peso = 0;
    reazione.specie.forEach(function (s, i) {
      var quota = moli[i] / totale;
      var col = coloreSpecie(i);
      var rr = parseInt(col.slice(1, 3), 16), gg = parseInt(col.slice(3, 5), 16), bb = parseInt(col.slice(5, 7), 16);
      r += (rr - 250) * quota * 0.35;
      g += (gg - 249) * quota * 0.35;
      b += (bb - 244) * quota * 0.35;
      peso += quota;
    });
    return "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(b) + ")";
  }

  /* ==========================================================
     6. Il grafico delle concentrazioni
     ========================================================== */

  function disegnaGrafico() {
    if (!ctxG || larghezzaG <= 0) return;
    var c = ctxG;
    c.clearRect(0, 0, larghezzaG, altezzaG);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaG, altezzaG);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");

    var sx = 46, dx = 12, su = 14, giu = 30;
    var w = larghezzaG - sx - dx, h = altezzaG - su - giu;

    var finestra = 30;              /* gli ultimi 30 secondi */
    var t1 = Math.max(finestra, tempo);
    var t0 = t1 - finestra;

    var cMax = 0.05;
    storia.forEach(function (p) {
      if (p.t < t0) return;
      p.conc.forEach(function (v) { if (v > cMax) cMax = v; });
    });
    cMax = cMax * 1.15;

    function X(t) { return sx + w * (t - t0) / finestra; }
    function Y(v) { return su + h * (1 - v / cMax); }

    /* griglia con i numeri */
    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var i = 0; i <= 4; i++) {
      var v = cMax * i / 4;
      c.beginPath(); c.moveTo(sx, Y(v)); c.lineTo(sx + w, Y(v)); c.stroke();
      c.fillText(conVirgola(arrotonda(v, 2)), sx - 5, Y(v) + 3);
    }
    c.textAlign = "center";
    for (var j = 0; j <= 5; j++) {
      var t = t0 + finestra * j / 5;
      c.beginPath(); c.moveTo(X(t), su); c.lineTo(X(t), su + h); c.stroke();
      c.fillText(String(Math.round(t)), X(t), su + h + 14);
    }
    c.fillText("secondi", sx + w / 2, altezzaG - 4);
    c.save();
    c.translate(11, su + h / 2); c.rotate(-Math.PI / 2);
    c.fillText("concentrazione (mol/L)", 0, 0);
    c.restore();

    /* i momenti in cui abbiamo disturbato */
    segni.forEach(function (s) {
      if (s.t < t0) return;
      c.strokeStyle = tenue; c.setLineDash([3, 3]);
      c.beginPath(); c.moveTo(X(s.t), su); c.lineTo(X(s.t), su + h); c.stroke();
      c.setLineDash([]);
      c.save();
      c.translate(X(s.t) + 4, su + 6); c.rotate(Math.PI / 2);
      c.fillStyle = tenue; c.textAlign = "left"; c.font = "9px system-ui, sans-serif";
      c.fillText(s.testo, 0, 0);
      c.restore();
    });

    /* una linea per specie */
    reazione.specie.forEach(function (s, i) {
      c.strokeStyle = coloreSpecie(i);
      c.lineWidth = 2.2;
      c.beginPath();
      var primo = true;
      storia.forEach(function (p) {
        if (p.t < t0) return;
        if (primo) { c.moveTo(X(p.t), Y(p.conc[i])); primo = false; }
        else c.lineTo(X(p.t), Y(p.conc[i]));
      });
      c.stroke();
    });
  }

  /* ==========================================================
     7. I numeri e le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

  /* Un numero leggibile anche quando e' piccolissimo o enorme. */
  function bello(v) {
    if (!isFinite(v)) return "—";
    if (v === 0) return "0";
    var a = Math.abs(v);
    if (a >= 1e5 || a < 1e-3) {
      var esp = Math.floor(Math.log(a) / Math.LN10);
      var mant = v / Math.pow(10, esp);
      return conVirgola(arrotonda(mant, 1)) + " · 10^" + esp;
    }
    if (a >= 100) return conVirgola(arrotonda(v, 0));
    if (a >= 1) return conVirgola(arrotonda(v, 2));
    return conVirgola(arrotonda(v, 4));
  }

  function racconta() {
    var k = costante(), q = quoziente();
    var verso = q < k ? "avanti" : "indietro";

    if (allEquilibrio()) {
      return "Siamo all'equilibrio: Q vale quanto K, e le concentrazioni non cambiano piu'. " +
        "Attenzione pero': la reazione non si e' fermata. Continua ad andare avanti e indietro alla " +
        "stessa velocita', e quello che si consuma da una parte si riforma dall'altra. " +
        "Prova a disturbare il sistema con uno dei tasti qui sotto.";
    }
    if (q < k) {
      return "Q vale " + bello(q) + " ed e' piu' piccolo di K, che vale " + bello(k) + ". " +
        "Ci sono troppi reagenti rispetto all'equilibrio, quindi la reazione va " + verso +
        ": consuma reagenti e forma prodotti, finche' Q non arriva a K. Guarda le linee del grafico.";
    }
    return "Q vale " + bello(q) + " ed e' piu' grande di K, che vale " + bello(k) + ". " +
      "Ci sono troppi prodotti, quindi la reazione va " + verso + ": i prodotti si riconvertono in " +
      "reagenti finche' Q non ritorna a K.";
  }

  function spiegaVolume() {
    if (reazione.deltaN === 0) {
      return "In questa reazione il numero di molecole di gas non cambia: " +
        "a sinistra e a destra sono le stesse. Stringere o allargare il pistone cambia tutte le " +
        "concentrazioni nella stessa misura, Q resta uguale a K, e l'equilibrio non si sposta di niente. " +
        "E' il controllo che serve per capire che non e' la pressione in se' a spostare le cose.";
    }
    if (reazione.deltaN < 0) {
      return "Andando avanti, questa reazione passa da piu' molecole di gas a meno (" +
        Math.abs(reazione.deltaN) + " in meno). Comprimendo, il sistema si difende dallo schiacciamento " +
        "andando dalla parte che occupa meno posto: quindi verso i prodotti.";
    }
    return "Andando avanti, questa reazione fa piu' molecole di gas (" + reazione.deltaN +
      " in piu'). Comprimendo, il sistema si sposta indietro, verso la parte che occupa meno posto.";
  }

  function spiegaCalore() {
    var kj = arrotonda(reazione.deltaH / 1000, 1);
    if (reazione.deltaH < 0) {
      return "Questa reazione, andando avanti, libera calore: delta H vale " + conVirgola(kj) +
        " kJ/mol. Il calore si puo' pensare come un prodotto. Se scaldi ne aggiungi, e il sistema lo " +
        "smaltisce andando indietro: K diventa piu' piccolo e i prodotti calano. E' il guaio del " +
        "processo Haber: per andare veloce servirebbe caldo, ma il caldo riduce la resa.";
    }
    return "Questa reazione, andando avanti, assorbe calore: delta H vale +" + conVirgola(kj) +
      " kJ/mol. Il calore si puo' pensare come un reagente. Se scaldi ne aggiungi, e il sistema lo " +
      "consuma andando avanti: K diventa piu' grande e i prodotti aumentano.";
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
    volume = x.volume;
    temperatura = x.temperatura;
    if (cursoreV) cursoreV.aggiorna(volume);
    if (cursoreT) cursoreT.aggiorna(temperatura);
    rimetti();
    creaGranelli();
  }

  function disegnaTabella() {
    svuota(tabella);
    var t = elemento("table", "tabella-cifre");
    var intestazione = elemento("tr");
    ["specie", "mol/L", "aggiungi", "togli"].forEach(function (h) {
      intestazione.appendChild(elemento("th", null, h));
    });
    t.appendChild(intestazione);

    reazione.specie.forEach(function (s, i) {
      var riga = elemento("tr");
      var nome = elemento("td");
      var pallino = elemento("span", "chip-simbolo", "●");
      pallino.style.color = coloreSpecie(i);
      nome.appendChild(pallino);
      nome.appendChild(document.createTextNode(" " + s.nome));
      riga.appendChild(nome);
      riga.appendChild(elemento("td", null, conVirgola(arrotonda(concentrazione(i), 3))));

      var piu = elemento("td");
      var bPiu = elemento("button", "bottone-testo", "+");
      bPiu.type = "button";
      bPiu.addEventListener("click", function () { aggiungi(i, volume * 0.1); });
      piu.appendChild(bPiu);
      riga.appendChild(piu);

      var meno = elemento("td");
      var bMeno = elemento("button", "bottone-testo", "−");
      bMeno.type = "button";
      bMeno.addEventListener("click", function () {
        aggiungi(i, -Math.min(moli[i] * 0.5, volume * 0.1));
      });
      meno.appendChild(bMeno);
      riga.appendChild(meno);

      t.appendChild(riga);
    });
    tabella.appendChild(t);
  }

  function aggiorna() {
    var k = costante(), q = quoziente();
    letturaQ.textContent = bello(q);
    letturaK.textContent = bello(k);
    letturaStato.textContent = allEquilibrio() ? "all'equilibrio"
      : (q < k ? "va avanti →" : "← va indietro");

    pastiglieReazione.forEach(function (b) {
      b.className = "pillola" + (b.dato === reazione ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    bottoneMoto.textContent = inMoto ? "Metti in pausa" : "Riprendi";
    frase.textContent = racconta();
    disegnaTabella();
    ridistribuisci();

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegnaRecipiente();
    disegnaGrafico();
  }

  /* il battito */
  var ultimo = 0, daAggiornare = 0, daRegistrare = 0;
  function battito(ora) {
    var dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0;
    ultimo = ora;
    if (inMoto && reazione) {
      unPasso(dt);
      muoviGranelli(dt);
      disegnaRecipiente();

      daRegistrare += dt;
      if (daRegistrare > 0.1) {
        daRegistrare = 0;
        var conc = reazione.specie.map(function (s, i) { return concentrazione(i); });
        storia.push({ t: tempo, conc: conc });
        if (storia.length > 900) storia.shift();
      }
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
    pastiglieReazione = []; pastiglieEsp = [];

    var avvisoErrori = App.avvisoErroriFile("reazioni.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Una reazione reversibile non finisce mai: va avanti e indietro finche' i due versi non si " +
      "pareggiano. Da li' in poi le concentrazioni restano ferme, ma le molecole continuano a " +
      "trasformarsi. Qui puoi disturbare il sistema e guardarlo rimettersi a posto."));

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

    /* --- il recipiente --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Il recipiente"));
    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("Q, come sta adesso", function (n) { letturaQ = n; }));
    letture.appendChild(unaLettura("K, dove deve arrivare", function (n) { letturaK = n; }));
    letture.appendChild(unaLettura("da che parte va", function (n) { letturaStato = n; }));
    contenitore.appendChild(letture);

    contenitore.appendChild(elemento("p", "didascalia",
      "Q e' fatto con la stessa formula di K, ma con le concentrazioni di adesso. Quando Q e K " +
      "coincidono siamo all'equilibrio: tutto Le Chatelier sta in questo confronto."));

    var bottoni = elemento("div", "bottoni");
    bottoneMoto = elemento("button", "bottone", "Metti in pausa");
    bottoneMoto.type = "button";
    bottoneMoto.addEventListener("click", function () { inMoto = !inMoto; aggiorna(); });
    bottoni.appendChild(bottoneMoto);

    var stringi = elemento("button", "bottone-testo", "Dimezza il volume");
    stringi.type = "button";
    stringi.addEventListener("click", function () { cambiaVolume(0.5); });
    bottoni.appendChild(stringi);

    var allarga = elemento("button", "bottone-testo", "Raddoppia il volume");
    allarga.type = "button";
    allarga.addEventListener("click", function () { cambiaVolume(2); });
    bottoni.appendChild(allarga);

    var azzera = elemento("button", "bottone-testo", "Ricomincia");
    azzera.type = "button";
    azzera.addEventListener("click", function () { rimetti(); creaGranelli(); });
    bottoni.appendChild(azzera);
    contenitore.appendChild(bottoni);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    /* --- la tabella delle specie --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le sostanze, una per una"));
    tabella = elemento("div", "involucro-tabella");
    contenitore.appendChild(tabella);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Con + e − aggiungi o togli una sostanza sola, e guardi che cosa succede a tutte le altre. " +
      "Aggiungendo un reagente si consuma anche l'altro reagente: e' il modo piu' rapido per capire " +
      "che il sistema risponde nel suo insieme."));

    /* --- il grafico --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le concentrazioni nel tempo"));
    var scatolaG = elemento("div", "scatola-grafico");
    telaG = elemento("canvas", "tela");
    scatolaG.appendChild(telaG);
    contenitore.appendChild(scatolaG);

    /* --- le manopole --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le manopole"));
    var comandi = elemento("div", "comandi");
    cursoreV = cursore("Volume", 1, 50, 0.5, volume, "L", function (v) {
      volume = v; esperimentoScelto = -1; segna("volume"); aggiorna();
    });
    cursoreT = cursore("Temperatura", 0, 900, 5, temperatura, "°C", function (v) {
      temperatura = v; esperimentoScelto = -1; segna("temperatura"); aggiorna();
    });
    comandi.appendChild(cursoreV);
    comandi.appendChild(cursoreT);
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
        volume = 10;
        temperatura = r.tRif;
        if (cursoreV) cursoreV.aggiorna(volume);
        if (cursoreT) cursoreT.aggiorna(temperatura);
        rimetti();
        creaGranelli();
        aggiornaSchede();
      });
      pastiglieReazione.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);

    schedaEquazione = elemento("p", "formula", "");
    contenitore.appendChild(schedaEquazione);
    schedaNota = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaNota);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Perche' il volume conta, o non conta"));
    schedaVolume = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaVolume);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Perche' la temperatura e' diversa"));
    schedaCalore = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaCalore);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "La temperatura e' l'unica cosa che cambia K davvero. Aggiungere sostanze o stringere il pistone " +
      "sposta la composizione, ma K resta quello: cambia solo il punto in cui il sistema si ferma."));

    /* --- i limiti del modello --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "La reazione e' trattata come se avvenisse in un urto solo fra le molecole scritte nell'equazione. Quasi nessuna reazione vera funziona cosi': procede per passaggi intermedi. L'equilibrio finale pero' e' quello giusto, perche' dipende solo da K.",
      "I gas sono considerati ideali e le soluzioni diluite: si usano le concentrazioni al posto delle attivita'.",
      "Il delta H e' considerato costante al variare della temperatura. Su intervalli di centinaia di gradi non e' proprio vero, e la K calcolata si scosta un po' da quella misurata.",
      "Il tempo che ci mette il sistema a rimettersi a posto e' scelto per essere guardabile, non e' quello vero: certe reazioni impiegano ore, altre microsecondi.",
      "Il volume si cambia e il sistema resta alla stessa temperatura. In un pistone vero, comprimere in fretta scalda il gas.",
      "I pallini colorati dicono le proporzioni fra le sostanze, non sono molecole in scala: in un litro di gas ce ne sono miliardi di miliardi."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiornaSchede();
  }

  var schedaEquazione = null, schedaNota = null, schedaVolume = null, schedaCalore = null;

  function aggiornaSchede() {
    if (!schedaEquazione) return;
    schedaEquazione.textContent = reazione.equazione;
    schedaNota.textContent = (reazione.nota ? reazione.nota.charAt(0).toUpperCase() + reazione.nota.slice(1) + ". " : "") +
      "K vale " + bello(reazione.kRif) + " a " + conVirgola(reazione.tRif) + " gradi.";
    schedaVolume.textContent = spiegaVolume();
    schedaCalore.textContent = spiegaCalore();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(320, Math.max(210, larghezza * 0.55)));
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
    disegnaRecipiente();
    disegnaGrafico();
  });

  /* ==========================================================
     10. Avvio
     ========================================================== */

  App.caricaTesto("reazioni.txt")
    .then(function (testo) {
      var esito = leggiReazioni(testo);
      reazioni = esito.elenco;
      erroriFile = esito.errori;

      if (!reazioni.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file reazioni.txt e' stato letto ma non contiene reazioni valide."));
        contenitore.appendChild(avviso);
        return;
      }

      /* Ogni reazione ha numeri suoi, e con una costante di velocita'
         uguale per tutte alcune si sistemerebbero in un lampo e altre
         in un minuto. Qui la costante viene scelta perche' il riassetto
         duri all'incirca lo stesso tempo, guardabile, per tutte: e' una
         scelta di comodo, non un dato di natura, ed e' scritta fra i
         limiti del modello. */
      reazioni.forEach(function (r) {
        var partenza = 1;
        r.specie.forEach(function (s) {
          if (s.coeff < 0) partenza *= Math.pow(-s.coeff * 2 / 10, -s.coeff);
        });
        r.scalaVelocita = Math.max(0.05, Math.min(2000, 0.5 / Math.max(1e-9, partenza)));
      });

      reazione = reazioni[0];
      temperatura = reazione.tRif;
      moli = reazione.specie.map(function (s) { return s.coeff < 0 ? -s.coeff * 2 : 1e-9; });
      costruisci();
      applicaEsperimento(ESPERIMENTI[0]);
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("reazioni.txt", errore.message));
    });

})();
