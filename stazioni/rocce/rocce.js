/* ============================================================
   Il ciclo delle rocce
   ------------------------------------------------------------
   Si prende una roccia e la si accompagna in giro, scegliendo
   a ogni passo che cosa le succede. Il viaggio resta scritto.

   Come funziona, in due parole:
   - gli stati e i processi stanno in due file di testo, e da
     quelli il sito costruisce da solo la rete dei collegamenti.
     Aggiungendo una riga a processi.txt compare una strada nuova
   - non c'è nessun percorso obbligato: a ogni passo il sito
     mostra TUTTE le strade che partono da dove ti trovi, e sono
     quasi sempre più d'una. È il punto della stazione, perché
     la figura del cerchio che sta sui libri fa credere il
     contrario
   - il diagramma con temperatura e profondità mostra dove
     avviene ogni processo: si vede che il metamorfismo sta
     sempre sotto la linea della fusione, perché se fondesse
     non sarebbe più metamorfismo
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  /* ---------- stato ---------- */

  var stati = [], processi = [], erroriStati = [], erroriProc = [];
  var dove = null;           /* lo stato in cui si trova la roccia */
  var viaggio = [];          /* {stato, processo} */
  var ultimoProcesso = null;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var letturaDove = null, letturaPassi = null, letturaStrade = null;
  var titoloStato = null, testoStato = null, elencoStrade = null, diario = null;
  var pastiglieStato = [];

  var COLORI = {
    magma: "#e8622a",
    intrusiva: "#b07a4a",
    effusiva: "#5a5f66",
    sedimento: "#d9c48a",
    sedimentaria: "#c9a96a",
    metamorfica: "#7a8fa0"
  };

  /* ==========================================================
     1. Leggere i file di contenuto
     ========================================================== */

  function leggiStati(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 4) {
        errori.push("riga " + (i + 1) + ": servono quattro parti separate da | .");
        return;
      }
      elenco.push({
        sigla: p[0].trim(),
        nome: p[1].trim(),
        esempi: p[2].split(",").map(function (x) { return x.trim(); }).filter(Boolean),
        descrizione: p[3].trim()
      });
    });
    return { elenco: elenco, errori: errori };
  }

  function leggiProcessi(testo, sigleValide) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 6) {
        errori.push("riga " + (i + 1) + ": servono sei parti separate da | .");
        return;
      }
      var da = p[1].split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      var a = p[2].trim();
      var sconosciute = da.concat([a]).filter(function (s) { return sigleValide.indexOf(s) < 0; });
      if (sconosciute.length) {
        errori.push("riga " + (i + 1) + ": non conosco «" + sconosciute[0] +
          "». Le sigle buone sono quelle scritte in stati.txt: " + sigleValide.join(", ") + ".");
        return;
      }
      var t = parseFloat(p[3].trim().replace(",", "."));
      var prof = parseFloat(p[4].trim().replace(",", "."));
      if (isNaN(t) || isNaN(prof)) {
        errori.push("riga " + (i + 1) + ": temperatura e profondità devono essere numeri.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        da: da, a: a,
        temperatura: t, profondita: prof,
        descrizione: p[5].trim()
      });
    });
    return { elenco: elenco, errori: errori };
  }

  function statoDi(sigla) {
    return stati.filter(function (s) { return s.sigla === sigla; })[0] || null;
  }

  /* Tutte le strade che partono da dove siamo adesso. */
  function stradeDa(sigla) {
    return processi.filter(function (p) { return p.da.indexOf(sigla) >= 0; });
  }

  /* ==========================================================
     2. Il disegno della rete
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  /* Gli stati vengono messi in cerchio: così si vede a colpo
     d'occhio quante frecce partono da ognuno. */
  function posizioni() {
    var cx = larghezza / 2, cy = altezza / 2;
    var raggio = Math.min(larghezza * 0.33, altezza * 0.34);
    var mappa = {};
    stati.forEach(function (s, i) {
      var a = -Math.PI / 2 + Math.PI * 2 * i / stati.length;
      mappa[s.sigla] = [cx + Math.cos(a) * raggio, cy + Math.sin(a) * raggio];
    });
    return mappa;
  }

  function disegna() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezza, altezza);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var pos = posizioni();
    var raggioNodo = Math.min(34, larghezza * 0.075);

    /* tutte le frecce fra gli stati */
    processi.forEach(function (p) {
      p.da.forEach(function (d) {
        if (d === p.a) return;
        var da = pos[d], a = pos[p.a];
        if (!da || !a) return;
        var partePossibile = (d === dove);
        var dx = a[0] - da[0], dy = a[1] - da[1];
        var lung = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / lung, uy = dy / lung;
        var x0 = da[0] + ux * raggioNodo, y0 = da[1] + uy * raggioNodo;
        var x1 = a[0] - ux * raggioNodo, y1 = a[1] - uy * raggioNodo;

        c.strokeStyle = partePossibile ? "#c06a28" : bordo;
        c.lineWidth = partePossibile ? 2.2 : 1;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();

        /* la punta */
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x1 - ux * 9 - uy * 4, y1 - uy * 9 + ux * 4);
        c.lineTo(x1 - ux * 9 + uy * 4, y1 - uy * 9 - ux * 4);
        c.closePath();
        c.fillStyle = partePossibile ? "#c06a28" : bordo;
        c.fill();
      });
    });

    /* i nodi */
    stati.forEach(function (s) {
      var q = pos[s.sigla];
      var qui = (s.sigla === dove);
      c.beginPath();
      c.arc(q[0], q[1], raggioNodo, 0, Math.PI * 2);
      c.fillStyle = COLORI[s.sigla] || "#9aa0a6";
      c.fill();
      c.strokeStyle = qui ? "#20262e" : "rgba(255,255,255,0.5)";
      c.lineWidth = qui ? 3.5 : 1.5;
      c.stroke();

      /* il nome, spezzato su più righe */
      c.fillStyle = "#ffffff";
      c.font = (qui ? "600 " : "") + "10px system-ui, sans-serif";
      c.textAlign = "center";
      var parole = s.nome.split(" ");
      var righe = [];
      var corrente = "";
      parole.forEach(function (w) {
        if ((corrente + " " + w).trim().length > 11) { righe.push(corrente.trim()); corrente = w; }
        else corrente += " " + w;
      });
      if (corrente.trim()) righe.push(corrente.trim());
      righe.forEach(function (r, k) {
        c.fillText(r, q[0], q[1] + 3 + (k - (righe.length - 1) / 2) * 11);
      });
    });

    /* dove siamo */
    c.fillStyle = tenue;
    c.font = "600 11px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillText("la roccia è qui, cerchiata di scuro", 8, 16);
    c.fillText("in arancione le strade che puoi prendere adesso", 8, 30);
  }

  /* ==========================================================
     3. Il diagramma temperatura-profondità
     ========================================================== */

  function disegnaCondizioni(tela2) {
    var c = tela2.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var w = tela2.width / dpr, h = tela2.height / dpr;

    c.clearRect(0, 0, w, h);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, w, h);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");

    var sx = 40, dx = 14, su = 16, giu = 32;
    var gw = w - sx - dx, gh = h - su - giu;

    function X(t) { return sx + gw * t / 1200; }
    function Y(p) { return su + gh * p / 50; }

    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var k = 0; k <= 5; k++) {
      c.beginPath(); c.moveTo(sx, Y(k * 10)); c.lineTo(sx + gw, Y(k * 10)); c.stroke();
      c.fillText(k * 10 + " km", sx - 4, Y(k * 10) + 3);
    }
    c.textAlign = "center";
    for (var j = 0; j <= 4; j++) {
      c.beginPath(); c.moveTo(X(j * 300), su); c.lineTo(X(j * 300), su + gh); c.stroke();
      c.fillText(j * 300 + "°", X(j * 300), su + gh + 14);
    }
    c.fillText("temperatura", sx + gw / 2, h - 4);
    c.save();
    c.translate(11, su + gh / 2); c.rotate(-Math.PI / 2);
    c.fillText("profondità", 0, 0);
    c.restore();

    /* ogni processo al suo posto */
    processi.forEach(function (p) {
      var attivo = p.da.indexOf(dove) >= 0;
      c.fillStyle = attivo ? "#c06a28" : "rgba(150,142,130,0.7)";
      c.beginPath();
      c.arc(X(p.temperatura), Y(p.profondita), attivo ? 6 : 4, 0, Math.PI * 2);
      c.fill();
      c.font = (attivo ? "600 " : "") + "9px system-ui, sans-serif";
      c.textAlign = X(p.temperatura) > sx + gw * 0.6 ? "right" : "left";
      var scostamento = X(p.temperatura) > sx + gw * 0.6 ? -9 : 9;
      c.fillText(p.nome.split(" ")[0], X(p.temperatura) + scostamento, Y(p.profondita) + 3);
    });
  }

  /* ==========================================================
     4. La pagina
     ========================================================== */

  function unaLettura(nome, registra) {
    var box = elemento("div", "lettura");
    var v = elemento("div", "lettura-valore", "—");
    box.appendChild(v);
    box.appendChild(elemento("div", "lettura-nome", nome));
    registra(v);
    return box;
  }

  function vai(processo) {
    viaggio.push({ da: dove, processo: processo.nome, a: processo.a });
    dove = processo.a;
    ultimoProcesso = processo;
    aggiorna();
  }

  function ricomincia(sigla) {
    dove = sigla;
    viaggio = [];
    ultimoProcesso = null;
    aggiorna();
  }

  function aggiornaStrade() {
    svuota(elencoStrade);
    var strade = stradeDa(dove);
    strade.forEach(function (p) {
      var b = elemento("button", "carta-esperimento");
      b.type = "button";
      var arrivo = statoDi(p.a);
      b.appendChild(elemento("div", "esperimento-titolo", p.nome));
      b.appendChild(elemento("div", "esperimento-sottotitolo",
        "diventa " + (arrivo ? arrivo.nome.toLowerCase() : p.a) +
        " · attorno a " + p.temperatura + " gradi, " +
        (p.profondita === 0 ? "in superficie" : "a " + p.profondita + " km di profondità")));
      b.addEventListener("click", function () { vai(p); });
      elencoStrade.appendChild(b);
    });
  }

  function aggiornaDiario() {
    svuota(diario);
    if (!viaggio.length) {
      diario.appendChild(elemento("p", "nota-piccola",
        "Il viaggio comincia adesso: scegli una delle strade qui sopra."));
      return;
    }
    var t = elemento("table", "tabella-cifre");
    var testa = elemento("tr");
    ["", "era", "è successo", "è diventata"].forEach(function (h) {
      testa.appendChild(elemento("th", null, h));
    });
    t.appendChild(testa);
    viaggio.forEach(function (v, i) {
      var tr = elemento("tr");
      tr.appendChild(elemento("td", null, String(i + 1)));
      var da = statoDi(v.da), a = statoDi(v.a);
      tr.appendChild(elemento("td", null, da ? da.nome : v.da));
      tr.appendChild(elemento("td", null, v.processo));
      tr.appendChild(elemento("td", null, a ? a.nome : v.a));
      t.appendChild(tr);
    });
    diario.appendChild(t);

    /* si è già tornati da qualche parte? */
    /* si parte segnando anche il punto di partenza, altrimenti un
       giro completo che torna lì non verrebbe riconosciuto */
    var visti = {};
    visti[viaggio[0].da] = true;
    var ripassato = null;
    viaggio.forEach(function (v) {
      if (visti[v.a]) ripassato = v.a;
      visti[v.a] = true;
    });
    if (ripassato) {
      var s = statoDi(ripassato);
      diario.appendChild(elemento("p", "nota-piccola",
        "Sei ripassato da «" + (s ? s.nome.toLowerCase() : ripassato) + "»: il giro si è chiuso. " +
        "Nota però che il percorso che hai fatto non è l'unico possibile, e quasi sicuramente non " +
        "è nemmeno quello più corto. Prova a rifarlo scegliendo strade diverse."));
    }
  }

  function aggiorna() {
    var s = statoDi(dove);
    var strade = stradeDa(dove);

    letturaDove.textContent = s ? s.nome : dove;
    letturaPassi.textContent = String(viaggio.length);
    letturaStrade.textContent = String(strade.length);

    titoloStato.textContent = s ? s.nome : dove;
    testoStato.textContent = (s ? s.descrizione.charAt(0).toUpperCase() + s.descrizione.slice(1) + "." : "") +
      (s && s.esempi.length ? " Per esempio: " + s.esempi.join(", ") + "." : "") +
      (ultimoProcesso ? " Ci sei arrivato per " + ultimoProcesso.nome.toLowerCase() + ": " +
        ultimoProcesso.descrizione + "." : "");

    pastiglieStato.forEach(function (b) {
      b.className = "pillola" + (b.dato === dove ? " attiva" : "");
    });

    aggiornaStrade();
    aggiornaDiario();

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegna();
    if (telaCondizioni) disegnaCondizioni(telaCondizioni);
  }

  var telaCondizioni = null;

  function costruisci() {
    svuota(contenitore);
    pastiglieStato = [];

    var e1 = App.avvisoErroriFile("stati.txt", erroriStati);
    if (e1) contenitore.appendChild(e1);
    var e2 = App.avvisoErroriFile("processi.txt", erroriProc);
    if (e2) contenitore.appendChild(e2);

    contenitore.appendChild(elemento("p", "guida",
      "La figura del ciclo delle rocce che sta sui libri è un cerchio, e fa credere che ci sia un " +
      "ordine obbligato. Non è così: da quasi ogni punto partono più strade. Qui puoi prendere una " +
      "roccia e accompagnarla in giro scegliendo tu, passo per passo, che cosa le capita."));

    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("adesso è", function (n) { letturaDove = n; }));
    letture.appendChild(unaLettura("passi fatti", function (n) { letturaPassi = n; }));
    letture.appendChild(unaLettura("strade che partono da qui", function (n) { letturaStrade = n; }));
    contenitore.appendChild(letture);

    var riquadro = elemento("div", "riquadro-fase");
    titoloStato = elemento("h3", "titolo-blocco", "");
    testoStato = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(titoloStato);
    riquadro.appendChild(testoStato);
    contenitore.appendChild(riquadro);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Che cosa le può succedere adesso"));
    elencoStrade = elemento("div", "griglia-esperimenti");
    contenitore.appendChild(elencoStrade);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Il viaggio fatto finora"));
    diario = elemento("div", "involucro-tabella");
    contenitore.appendChild(diario);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Dove avviene ogni processo"));
    var scatolaC = elemento("div", "scatola-grafico");
    telaCondizioni = elemento("canvas", "tela");
    scatolaC.appendChild(telaCondizioni);
    contenitore.appendChild(scatolaC);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Guarda dove cade il metamorfismo: profondo e caldo, ma sempre meno caldo della fusione. È la " +
      "sua definizione: se la roccia fondesse non sarebbe più metamorfismo, sarebbe magma. " +
      "L'erosione invece sta nell'angolo in alto a sinistra, cioè in superficie e a temperatura " +
      "normale: è l'unico processo che avviene dove viviamo noi, e infatti è l'unico che possiamo " +
      "vedere con i nostri occhi."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Ricomincia da un'altra parte"));
    var scelte = elemento("div", "scelte-grandezza");
    stati.forEach(function (s) {
      var b = elemento("button", "pillola", s.nome);
      b.type = "button"; b.dato = s.sigla;
      b.addEventListener("click", function () { ricomincia(s.sigla); });
      pastiglieStato.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Gli stati sono sei e i processi sei. Nella realtà le famiglie di rocce si dividono in decine di tipi, e ogni processo ha molte varianti: il metamorfismo di contatto vicino a un magma è un'altra cosa rispetto a quello di una catena montuosa.",
      "Manca il tempo. Qui un passo è un clic, ma un granito ci mette milioni di anni a raffreddarsi, e altri milioni ad arrivare in superficie. L'erosione di una montagna è lentissima, un'eruzione dura poche ore.",
      "Le temperature e le profondità scritte sono valori indicativi, buoni per farsi un'idea. Le condizioni vere dipendono dal tipo di roccia, dall'acqua presente e da quanto in fretta le cose cambiano.",
      "Non c'è la fusione parziale: quando una roccia comincia a fondere, non fonde tutta insieme, e il liquido che se ne va ha una composizione diversa da quella della roccia rimasta. È il motivo per cui dal mantello basaltico si arriva, dopo molti giri, ai graniti.",
      "Il giro è disegnato come una rete chiusa, ma la materia entra ed esce: gli organismi tolgono carbonio dall'acqua per fare i gusci, e le placche riportano sedimenti giù nel mantello."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(360, Math.max(280, larghezza * 0.68)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (telaCondizioni) {
      var l = telaCondizioni.parentNode.clientWidth;
      var a = Math.round(Math.min(260, Math.max(200, l * 0.5)));
      telaCondizioni.width = l * dpr; telaCondizioni.height = a * dpr;
      telaCondizioni.style.width = l + "px"; telaCondizioni.style.height = a + "px";
      telaCondizioni.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegna();
    if (telaCondizioni) disegnaCondizioni(telaCondizioni);
  });

  /* ==========================================================
     5. Avvio
     ========================================================== */

  Promise.all([App.caricaTesto("stati.txt"), App.caricaTesto("processi.txt")])
    .then(function (testi) {
      var a = leggiStati(testi[0]);
      stati = a.elenco; erroriStati = a.errori;

      if (!stati.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file stati.txt è stato letto ma non contiene stati validi."));
        contenitore.appendChild(avviso);
        return;
      }

      var sigle = stati.map(function (s) { return s.sigla; });
      var b = leggiProcessi(testi[1], sigle);
      processi = b.elenco; erroriProc = b.errori;

      dove = stati[0].sigla;
      costruisci();
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("stati.txt", errore.message));
    });

})();
