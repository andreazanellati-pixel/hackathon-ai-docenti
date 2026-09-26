/* ============================================================
   Dentro la Terra con le onde
   ------------------------------------------------------------
   Un terremoto in superficie, e i raggi sismici che attraversano
   il pianeta. Dove arrivano e dove non arrivano dice com'è
   fatta la Terra dentro.

   Come funziona, in due parole:
   - i raggi non sono disegnati a mano: sono calcolati. Dentro
     una Terra a gusci il parametro del raggio si conserva, e da
     quello si ricava sia la curva che la distanza a cui il
     raggio riemerge. È la legge di Snell applicata a una sfera
   - la zona d'ombra non è scritta da nessuna parte: nasce dal
     calcolo. Con questi strati viene fra i 98 e i 140 gradi per
     le onde P, contro i 103-143 misurati sulla Terra vera: un
     buon risultato per un modello di sette strati
   - il nucleo esterno ha velocità S scritta zero perché è
     liquido. Basta cambiare quel numero nel file strati.txt e
     l'ombra delle onde S sparisce: è il ragionamento con cui
     nel 1926 si capì che il nucleo era liquido
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var RAGGIO_TERRA = 6371;   /* km */

  /* ---------- stato ---------- */

  var strati = [], erroriFile = [];
  var onda = "P";
  var distanzaScelta = 60;   /* gradi dall'epicentro */
  var mostraTutti = true;
  var esperimentoScelto = 0;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var letturaArrivo = null, letturaOmbra = null, letturaTempo = null;
  var pastiglieOnda = [], pastiglieEsp = [];
  var frase = null, tabellaOmbre = null;
  var cursoreD = null;

  var raggi = [];            /* i raggi calcolati, per il disegno */
  var ombre = { P: null, Ptutti: null, S: null };

  /* ==========================================================
     1. Gli esperimenti già pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "Una stazione vicina",
      sottotitolo: "A 40 gradi arrivano tutte e due: P ed S",
      onda: "P", distanza: 40
    },
    {
      titolo: "Dentro l'ombra delle P",
      sottotitolo: "A 108 gradi non arriva proprio niente. Perché?",
      onda: "P", distanza: 108
    },
    {
      titolo: "L'onda che non doveva esserci",
      sottotitolo: "A 125 gradi qualcosa arriva: passa dal nucleo interno",
      onda: "P", distanza: 125
    },
    {
      titolo: "Dall'altra parte del mondo",
      sottotitolo: "A 160 gradi le P tornano, ma passando dal nucleo",
      onda: "P", distanza: 160
    },
    {
      titolo: "L'ombra delle onde S",
      sottotitolo: "Oltre 98 gradi le S non arrivano più, e non tornano mai",
      onda: "S", distanza: 130
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiStrati(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 7) {
        errori.push("riga " + (i + 1) + ": servono almeno sette parti separate da | .");
        return;
      }
      var n = [numero(p[1]), numero(p[2]), numero(p[3]), numero(p[4]), numero(p[5]), numero(p[6])];
      var manca = false;
      n.forEach(function (v) { if (v === null) manca = true; });
      if (manca) {
        errori.push("riga " + (i + 1) + ": le profondità e le velocità devono essere numeri.");
        return;
      }
      if (n[1] <= n[0]) {
        errori.push("riga " + (i + 1) + ": la profondità del fondo deve essere maggiore di quella del tetto.");
        return;
      }
      if (n[2] <= 0 || n[3] <= 0) {
        errori.push("riga " + (i + 1) + ": la velocità delle onde P deve essere maggiore di zero.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        tetto: n[0], fondo: n[1],
        pSopra: n[2], pSotto: n[3],
        sSopra: n[4], sSotto: n[5],
        nota: p.length > 7 ? p[7].trim() : ""
      });
    });
    elenco.sort(function (a, b) { return a.tetto - b.tetto; });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. La velocità a ogni profondità
     ========================================================== */

  /* La velocità dell'onda scelta a una data distanza dal centro.
     Dentro ogni strato varia un po' alla volta fra il valore al
     tetto e quello al fondo. */
  function velocita(r, tipo) {
    var prof = RAGGIO_TERRA - r;
    for (var i = 0; i < strati.length; i++) {
      var s = strati[i];
      if (prof >= s.tetto && prof <= s.fondo) {
        var q = (prof - s.tetto) / (s.fondo - s.tetto);
        return tipo === "P"
          ? s.pSopra + (s.pSotto - s.pSopra) * q
          : s.sSopra + (s.sSotto - s.sSopra) * q;
      }
    }
    var ultimo = strati[strati.length - 1];
    return tipo === "P" ? ultimo.pSotto : ultimo.sSotto;
  }

  /* ==========================================================
     4. Il percorso di un raggio
     ------------------------------------------------------------
     Dentro una Terra fatta a gusci sferici, per ogni raggio si
     conserva il parametro p = r sin(i) / v. Da lì si ricava
     l'inclinazione a ogni profondità, e quindi il cammino.
     È la legge di Snell, scritta per una sfera.
     ========================================================== */

  function tracciaRaggio(angoloPartenza, tipo) {
    var v0 = velocita(RAGGIO_TERRA - 1, tipo);
    if (!(v0 > 0)) return null;
    var p = RAGGIO_TERRA * Math.sin(angoloPartenza) / v0;

    /* Si avanza a piccoli passi di ANGOLO, non di profondità.
       Facendo il contrario, nel punto più profondo del raggio -
       dove il cammino diventa orizzontale - il conto esplode.
       Così invece il passo in profondità si riduce da solo fino
       a zero, che è proprio quello che il raggio fa. */
    var punti = [{ r: RAGGIO_TERRA, delta: 0 }];
    var r = RAGGIO_TERRA - 0.5;
    var delta = 0;
    var tempo = 0;
    var dDelta = 0.0015;       /* radianti per passo */
    var scendendo = true;
    var fermato = false;
    var rimbalzi = 0;
    var ultimoPasso = 2;
    var piuProfondo = r;

    for (var k = 0; k < 4000; k++) {
      var v = velocita(r, tipo);
      if (!(v > 0)) { fermato = true; break; }   /* onde S in un liquido */

      var seno = p * v / r;
      if (seno >= 1) {
        /* Il raggio è arrivato al suo punto più profondo e
           risale. Bisogna scavalcarlo a mano rifacendo all'indietro
           l'ultimo passo: proprio lì il cammino è orizzontale e
           il passo in profondità vale zero, quindi il raggio
           resterebbe fermo per sempre. */
        scendendo = !scendendo;
        rimbalzi++;
        if (rimbalzi > 6) break;
        r += (scendendo ? -1 : 1) * Math.max(1, Math.abs(ultimoPasso));
        delta += dDelta;
        punti.push({ r: r, delta: delta });
        continue;
      }
      var coseno = Math.sqrt(Math.max(0, 1 - seno * seno));

      var dr = (scendendo ? -1 : 1) * r * coseno / seno * dDelta;
      ultimoPasso = dr;
      delta += dDelta;
      tempo += r * dDelta / (seno * v);
      r += dr;
      if (r < piuProfondo) piuProfondo = r;

      if (r >= RAGGIO_TERRA) { r = RAGGIO_TERRA; punti.push({ r: r, delta: delta }); break; }
      if (r <= 30) break;
      punti.push({ r: r, delta: delta });
    }

    if (fermato) return null;
    if (r < RAGGIO_TERRA - 1) return null;       /* non è riemerso */
    return {
      punti: punti,
      delta: delta * 180 / Math.PI,
      tempo: tempo,
      p: p,
      profondita: RAGGIO_TERRA - piuProfondo
    };
  }

  /* Tutte le distanze a cui riemerge almeno un raggio. */
  function calcolaRaggi(tipo) {
    var esito = [];
    for (var g = 1; g <= 89; g += 0.25) {
      var r = tracciaRaggio(g * Math.PI / 180, tipo);
      if (r && r.delta > 0.5 && r.delta <= 180) esito.push(r);
    }
    return esito;
  }

  /* La zona d'ombra: gli intervalli di distanza in cui non
     arriva nessun raggio. Non è scritta da nessuna parte: si
     guarda dove i raggi calcolati non arrivano. */
  /* A che profondità comincia l'ultimo strato: serve a
     distinguere i raggi che attraversano il nucleo interno. */
  function tettoNucleoInterno() {
    return strati.length ? strati[strati.length - 1].tetto : 5150;
  }

  function calcolaOmbra(tipo, senzaNucleoInterno) {
    var tetto = tettoNucleoInterno();
    var arrivi = calcolaRaggi(tipo)
      .filter(function (r) {
        return !senzaNucleoInterno || r.profondita <= tetto;
      })
      .map(function (r) { return r.delta; });
    if (!arrivi.length) return { da: 0, a: 180, nessuno: true };

    var coperto = [];
    for (var g = 0; g <= 180; g++) {
      var trovato = false;
      for (var i = 0; i < arrivi.length; i++) {
        if (Math.abs(arrivi[i] - g) <= 2.5) { trovato = true; break; }
      }
      coperto.push(trovato);
    }

    /* il buco più largo */
    var migliore = null, inizio = -1;
    for (var h = 0; h <= 180; h++) {
      if (!coperto[h]) {
        if (inizio < 0) inizio = h;
      } else if (inizio >= 0) {
        if (!migliore || h - inizio > migliore.a - migliore.da) migliore = { da: inizio, a: h };
        inizio = -1;
      }
    }
    if (inizio >= 0 && (!migliore || 180 - inizio > migliore.a - migliore.da)) {
      migliore = { da: inizio, a: 180 };
    }
    return migliore || { da: 0, a: 0 };
  }

  /* A che profondità comincia l'ultimo strato: serve a
     distinguere i raggi che attraversano il nucleo interno. */
  function tettoNucleoInterno() {
    return strati.length ? strati[strati.length - 1].tetto : 5150;
  }

  function arriva(distanza, tipo) {
    var arrivi = calcolaRaggi(tipo);
    var vicino = null;
    arrivi.forEach(function (r) {
      if (Math.abs(r.delta - distanza) <= 3 &&
        (!vicino || Math.abs(r.delta - distanza) < Math.abs(vicino.delta - distanza))) vicino = r;
    });
    return vicino;
  }

  /* ==========================================================
     5. Il disegno
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  var COLORI_STRATO = ["#c9b79a", "#b9a488", "#a08b6f", "#d9a441", "#e8c96a"];

  function disegna() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);
    c.fillStyle = "#12161f";
    c.fillRect(0, 0, larghezza, altezza);

    var cx = larghezza / 2, cy = altezza / 2;
    var R = Math.min(larghezza, altezza) * 0.44;
    var scala = R / RAGGIO_TERRA;

    /* gli strati, dal più profondo al più esterno */
    for (var i = strati.length - 1; i >= 0; i--) {
      var s = strati[i];
      c.fillStyle = COLORI_STRATO[i % COLORI_STRATO.length];
      c.beginPath();
      c.arc(cx, cy, (RAGGIO_TERRA - s.tetto) * scala, 0, Math.PI * 2);
      c.fill();
    }

    /* i confini */
    c.strokeStyle = "rgba(20,22,30,0.55)"; c.lineWidth = 1;
    strati.forEach(function (s) {
      c.beginPath();
      c.arc(cx, cy, (RAGGIO_TERRA - s.tetto) * scala, 0, Math.PI * 2);
      c.stroke();
    });

    /* il terremoto, in cima */
    function posizione(r, delta) {
      var a = -Math.PI / 2 + delta;
      return [cx + Math.cos(a) * r * scala, cy + Math.sin(a) * r * scala];
    }

    /* i raggi */
    if (mostraTutti) {
      c.strokeStyle = "rgba(240, 235, 210, 0.3)";
      c.lineWidth = 1;
      raggi.forEach(function (raggio) {
        c.beginPath();
        raggio.punti.forEach(function (pt, k) {
          var q = posizione(pt.r, pt.delta);
          if (k === 0) c.moveTo(q[0], q[1]); else c.lineTo(q[0], q[1]);
        });
        c.stroke();
      });
    }

    /* il raggio che arriva proprio alla stazione scelta */
    var scelto = arriva(distanzaScelta, onda);
    if (scelto) {
      c.strokeStyle = onda === "P" ? "#ff9e4a" : "#7fd0ff";
      c.lineWidth = 2.6;
      c.beginPath();
      scelto.punti.forEach(function (pt, k) {
        var q = posizione(pt.r, pt.delta);
        if (k === 0) c.moveTo(q[0], q[1]); else c.lineTo(q[0], q[1]);
      });
      c.stroke();
    }

    /* la zona d'ombra, segnata sulla superficie */
    var omb = ombre[onda];
    if (omb && omb.a > omb.da) {
      c.strokeStyle = "rgba(220, 80, 70, 0.75)";
      c.lineWidth = 6;
      [1, -1].forEach(function (verso) {
        c.beginPath();
        c.arc(cx, cy, R + 5, -Math.PI / 2 + verso * omb.da * Math.PI / 180,
          -Math.PI / 2 + verso * omb.a * Math.PI / 180, verso < 0);
        c.stroke();
      });
    }

    /* il terremoto */
    var e = posizione(RAGGIO_TERRA, 0);
    c.fillStyle = "#ffd76a";
    c.beginPath(); c.arc(e[0], e[1], 6, 0, Math.PI * 2); c.fill();

    /* la stazione scelta */
    [1, -1].forEach(function (verso) {
      var st = posizione(RAGGIO_TERRA, verso * distanzaScelta * Math.PI / 180);
      c.fillStyle = scelto ? "#8fe08f" : "#e06a5a";
      c.beginPath(); c.arc(st[0], st[1], 5, 0, Math.PI * 2); c.fill();
    });

    /* le scritte */
    c.fillStyle = "#e8e4d8";
    c.font = "600 11px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText("onde " + onda + " · stazione a " + Math.round(distanzaScelta) + "°", 8, 16);
    c.textAlign = "right";
    if (omb && omb.a > omb.da) {
      c.fillStyle = "#ffb0a4";
      c.fillText("ombra fra " + omb.da + "° e " + omb.a + "°", larghezza - 8, 16);
    }

    /* i nomi degli strati */
    c.font = "9px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillStyle = "rgba(255,255,255,0.75)";
    strati.forEach(function (s, k) {
      var rr = (RAGGIO_TERRA - (s.tetto + s.fondo) / 2) * scala;
      c.fillText(s.nome, cx + 6, cy + rr - 3);
    });
  }

  /* ==========================================================
     6. Le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", "."); }

  function racconta() {
    var scelto = arriva(distanzaScelta, onda);
    var omb = ombre[onda];
    var dentro = omb && distanzaScelta >= omb.da && distanzaScelta <= omb.a;

    if (scelto) {
      var profonda = RAGGIO_TERRA - Math.min.apply(null, scelto.punti.map(function (p) { return p.r; }));
      return "A " + Math.round(distanzaScelta) + " gradi le onde " + onda + " arrivano. Il raggio è " +
        "sceso fino a " + Math.round(profonda) + " chilometri di profondità e poi è risalito: non " +
        "perché abbia rimbalzato, ma perché più si scende più la roccia è veloce, e il raggio si " +
        "incurva verso l'alto un po' alla volta. Ci ha messo circa " + Math.round(scelto.tempo / 60) +
        " minuti.";
    }

    if (dentro) {
      if (onda === "S") {
        return "A " + Math.round(distanzaScelta) + " gradi le onde S non arrivano, e non arriveranno " +
          "nemmeno più in là: da " + omb.da + " gradi in poi c'è il silenzio, fino all'altra parte " +
          "del mondo. Il motivo è che le onde S sono onde di taglio, e un liquido non si può " +
          "tagliare. Per andare oltre dovrebbero attraversare il nucleo esterno, e lì si fermano. " +
          "Questa mancanza è la prova che il nucleo esterno è liquido: si capì così, nel 1926.";
      }
      return "A " + Math.round(distanzaScelta) + " gradi le onde P non arrivano: siamo dentro la zona " +
        "d'ombra, fra " + omb.da + " e " + omb.a + " gradi. I raggi che restano nel mantello si " +
        "fermano prima; quelli che entrano nel nucleo trovano di colpo una roccia molto più lenta, " +
        "vengono deviati bruscamente verso il basso e riemergono molto più in là. In mezzo non " +
        "arriva niente. Quel salto di velocità è il confine del nucleo, e il calcolo lo mette a " +
        "circa 2900 chilometri di profondità.";
    }

    return "A " + Math.round(distanzaScelta) + " gradi non arriva nessun raggio calcolato, ma non " +
      "siamo nella zona d'ombra principale: dipende da come sono stati scelti gli angoli di partenza. " +
      "Prova a spostare la stazione di qualche grado.";
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

  function ricalcola() {
    raggi = calcolaRaggi(onda);
    ombre.P = calcolaOmbra("P", true);
    ombre.Ptutti = calcolaOmbra("P", false);
    ombre.S = calcolaOmbra("S", true);
  }

  function aggiorna() {
    var scelto = arriva(distanzaScelta, onda);
    var omb = ombre[onda];

    letturaArrivo.textContent = scelto ? "sì" : "no";
    letturaOmbra.textContent = omb && omb.a > omb.da ? omb.da + "° – " + omb.a + "°" : "nessuna";
    letturaTempo.textContent = scelto ? Math.round(scelto.tempo / 60) + " min" : "—";

    pastiglieOnda.forEach(function (b) {
      b.className = "pillola" + (b.dato === onda ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    frase.textContent = racconta();
    disegnaTabella();

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegna();
  }

  function disegnaTabella() {
    svuota(tabellaOmbre);
    var t = elemento("table", "tabella-cifre");
    var testa = elemento("tr");
    ["", "dove non arrivano", "che cosa vuol dire"].forEach(function (h) {
      testa.appendChild(elemento("th", null, h));
    });
    t.appendChild(testa);

    var righe = [
      ["onde P", ombre.P, "il salto di velocità al confine del nucleo devia i raggi lontano"],
      ["onde P, contando anche quelle che passano dal nucleo interno", ombre.Ptutti,
        "l'ombra si accorcia: qualcosa arriva lo stesso, ed è così che si scoprì il nucleo interno"],
      ["onde S", ombre.S, null]
    ];

    righe.forEach(function (riga) {
      var tr = elemento("tr");
      tr.appendChild(elemento("td", null, riga[0]));
      var o = riga[1];
      tr.appendChild(elemento("td", null,
        o && o.a > o.da ? "fra " + o.da + "° e " + o.a + "°" : "arrivano dappertutto"));
      tr.appendChild(elemento("td", null, riga[2] !== null ? riga[2]
        : (o && o.a >= 175 ? "non attraversano il nucleo esterno: è liquido"
          : "attraversano tutto: allora il nucleo sarebbe solido")));
      t.appendChild(tr);
    });
    tabellaOmbre.appendChild(t);
  }

  function costruisci() {
    svuota(contenitore);
    pastiglieOnda = []; pastiglieEsp = [];

    var avvisoErrori = App.avvisoErroriFile("strati.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Nessuno è mai sceso sotto i dodici chilometri. Sappiamo com'è fatta la Terra dentro perché " +
      "le onde dei terremoti la attraversano, e dove arrivano - o dove non arrivano - racconta che " +
      "cosa hanno incontrato per strada."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Esperimenti da provare"));
    var griglia = elemento("div", "griglia-esperimenti");
    ESPERIMENTI.forEach(function (x, i) {
      var b = elemento("button", "carta-esperimento");
      b.type = "button";
      b.appendChild(elemento("div", "esperimento-titolo", x.titolo));
      b.appendChild(elemento("div", "esperimento-sottotitolo", x.sottotitolo));
      b.addEventListener("click", function () {
        esperimentoScelto = i;
        onda = x.onda; distanzaScelta = x.distanza;
        if (cursoreD) cursoreD.aggiorna(distanzaScelta);
        ricalcola(); aggiorna();
      });
      pastiglieEsp.push(b);
      griglia.appendChild(b);
    });
    contenitore.appendChild(griglia);

    var scelteO = elemento("div", "scelte-grandezza");
    [["P", "Onde P · passano nei liquidi"], ["S", "Onde S · nei liquidi si fermano"]]
      .forEach(function (o) {
        var b = elemento("button", "pillola", o[1]);
        b.type = "button"; b.dato = o[0];
        b.addEventListener("click", function () {
          onda = o[0]; esperimentoScelto = -1; ricalcola(); aggiorna();
        });
        pastiglieOnda.push(b);
        scelteO.appendChild(b);
      });
    contenitore.appendChild(scelteO);

    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);
    contenitore.appendChild(elemento("p", "didascalia",
      "Il puntino giallo in cima è il terremoto. Il tratto rosso sul bordo è la zona d'ombra, cioè " +
      "dove quel tipo di onda non arriva. Il puntino verde o rosso è la stazione che hai scelto."));

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("l'onda arriva?", function (n) { letturaArrivo = n; }));
    letture.appendChild(unaLettura("zona d'ombra", function (n) { letturaOmbra = n; }));
    letture.appendChild(unaLettura("quanto ci mette", function (n) { letturaTempo = n; }));
    contenitore.appendChild(letture);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Dove si smette di sentire"));
    tabellaOmbre = elemento("div", "involucro-tabella");
    contenitore.appendChild(tabellaOmbre);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Questi intervalli non sono scritti nel programma: vengono fuori dal calcolo dei raggi, uno per " +
      "uno. Sulla Terra vera l'ombra delle onde P è misurata fra 103 e 143 gradi: con sette strati " +
      "soltanto il conto ne azzecca la posizione a cinque gradi di distanza. Se cambi le velocità in " +
      "strati.txt, l'ombra si sposta."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Dove mettere la stazione"));
    var comandi = elemento("div", "comandi");
    cursoreD = cursore("Distanza dall'epicentro", 5, 180, 1, distanzaScelta, "gradi", function (v) {
      distanzaScelta = v; esperimentoScelto = -1; aggiorna();
    });
    comandi.appendChild(cursoreD);
    contenitore.appendChild(comandi);

    var rigaB = elemento("div", "bottoni");
    var bTutti = elemento("button", "bottone-testo", mostraTutti ? "Nascondi gli altri raggi" : "Mostra tutti i raggi");
    bTutti.type = "button";
    bTutti.addEventListener("click", function () {
      mostraTutti = !mostraTutti;
      bTutti.textContent = mostraTutti ? "Nascondi gli altri raggi" : "Mostra tutti i raggi";
      disegna();
    });
    rigaB.appendChild(bTutti);
    contenitore.appendChild(rigaB);

    contenitore.appendChild(elemento("p", "nota-piccola",
      "Per capire perché il nucleo esterno è liquido, apri strati.txt e scrivi un numero qualsiasi " +
      "al posto dello zero nelle due velocità S del nucleo esterno, come se fosse solido. Ricarica la " +
      "pagina: l'ombra delle onde S sparisce. Siccome nella realtà quell'ombra c'è, il nucleo " +
      "esterno non può essere solido. È esattamente il ragionamento che fece Inge Lehmann."));

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "La Terra è considerata perfettamente sferica e fatta a gusci uguali dappertutto. Non è vero: sotto gli oceani e sotto i continenti le velocità sono diverse, e ci sono zone anomale grandi quanto un continente al confine col nucleo.",
      "Il terremoto è in superficie. Molti terremoti sono profondi anche centinaia di chilometri, e questo cambia i tempi di arrivo.",
      "Sono calcolati solo i raggi che vanno dritti per la loro strada. Mancano le onde riflesse sui confini e quelle convertite da P a S e viceversa, che in un sismogramma vero si vedono benissimo e servono anzi a misurare le profondità.",
      "Dentro la zona d'ombra delle onde P, nella realtà, qualcosa arriva lo stesso: onde deboli diffratte dal bordo del nucleo. Fu proprio studiando quei segnali deboli che nel 1936 Inge Lehmann capì che dentro il nucleo liquido c'era un nucleo interno solido.",
      "Le velocità del file sono valori medi. I modelli veri, come PREM, hanno decine di strati e tengono conto anche della densità e della pressione."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    ricalcola();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;
    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(420, Math.max(280, larghezza * 0.82)));
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
     8. Avvio
     ========================================================== */

  App.caricaTesto("strati.txt")
    .then(function (testo) {
      var esito = leggiStrati(testo);
      strati = esito.elenco;
      erroriFile = esito.errori;

      if (!strati.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file strati.txt è stato letto ma non contiene strati validi."));
        contenitore.appendChild(avviso);
        return;
      }

      costruisci();
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("strati.txt", errore.message));
    });

})();
