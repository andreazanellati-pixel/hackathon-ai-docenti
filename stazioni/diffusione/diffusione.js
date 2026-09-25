/* ============================================================
   Diffusione e osmosi
   ------------------------------------------------------------
   Due scomparti separati da una membrana. Le particelle si
   muovono a caso; la membrana lascia passare l'acqua sempre e il
   soluto solo se e' permeabile.

   Qui, a differenza della stazione sulle particelle, il fenomeno
   non e' rappresentato ma emerge davvero: nessuno dice all'acqua
   di andare verso la parte piu' concentrata. Ci va perche' ogni
   particella si muove a caso, e da quella parte trova piu' posto
   libero. E' il senso profondo dell'osmosi, ed e' anche il motivo
   per cui il livello smette di salire a un certo punto.
   ============================================================ */

/* ------------------------------------------------------------
   COME CI SI E' ARRIVATI

   Il primo modello mandava l'acqua nel verso sbagliato: la
   repulsione per volume escluso la spingeva FUORI dalla parte
   concentrata, cioe' il contrario dell'osmosi.

   Il meccanismo giusto e' l'ostruzione del varco: il soluto che
   sta davanti al passaggio impedisce all'acqua di uscire da
   quella parte. Dove c'e' piu' soluto l'acqua esce meno, e quindi
   si accumula.

   Quello da solo pero' non bastava: mancava la contropressione.
   Senza di lei l'acqua continuava a passare all'infinito, e a
   concentrazioni uguali si vedeva una deriva casuale che con
   l'osmosi non c'entra. Adesso il dislivello ricaccia indietro
   l'acqua, e il sistema si ferma dove le due spinte si pareggiano:
   che e' esattamente la definizione di pressione osmotica.
   ------------------------------------------------------------ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  /* ---------- stato ---------- */

  var solutoSinistra = 10;
  var solutoDestra = 40;
  var membrana = "semipermeabile";   /* oppure "permeabile" */
  var temperatura = 50;              /* 0-100, governa la velocita' */
  var inMoto = true;

  var acqua = [];
  var soluto = [];
  var ACQUA_TOTALE = 260;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaGrafico = null, ctxGrafico = null, larghezzaG = 0, altezzaG = 0;
  var ultimoIstante = 0;
  var tempo = 0;
  var storia = [];

  var PORO = 0.5;         /* quanto è alto il varco nella membrana, in frazione */
  var BLOCCO = 40;        /* entro quanti pixel dal varco il soluto lo ostruisce */
  var SPINTA_INDIETRO = 2.2;  /* quanto il dislivello ricaccia indietro l'acqua */

  /* ==========================================================
     1. Le particelle
     ========================================================== */

  function nuova(sinistra, raggio) {
    var margine = raggio + 2;
    var meta = larghezza / 2;
    return {
      x: sinistra ? margine + Math.random() * (meta - margine * 2)
                  : meta + margine + Math.random() * (meta - margine * 2),
      y: margine + Math.random() * (altezza - margine * 2),
      vx: (Math.random() - 0.5),
      vy: (Math.random() - 0.5),
      raggio: raggio
    };
  }

  function popola() {
    acqua = [];
    soluto = [];
    var meta = Math.round(ACQUA_TOTALE / 2);
    for (var i = 0; i < ACQUA_TOTALE; i++) acqua.push(nuova(i < meta, 2.6));
    for (var a = 0; a < solutoSinistra; a++) soluto.push(nuova(true, 5.2));
    for (var b = 0; b < solutoDestra; b++) soluto.push(nuova(false, 5.2));
    tempo = 0;
    storia = [];
    registra();
  }

  function aSinistra(p) { return p.x < larghezza / 2; }

  function contaAcqua() {
    var s = 0;
    for (var i = 0; i < acqua.length; i++) if (aSinistra(acqua[i])) s++;
    return { sinistra: s, destra: acqua.length - s };
  }

  function contaSoluto() {
    var s = 0;
    for (var i = 0; i < soluto.length; i++) if (aSinistra(soluto[i])) s++;
    return { sinistra: s, destra: soluto.length - s };
  }

  /* la concentrazione: particelle di soluto ogni cento di acqua */
  function concentrazioni() {
    var a = contaAcqua(), s = contaSoluto();
    return {
      sinistra: a.sinistra > 0 ? s.sinistra / a.sinistra * 100 : 0,
      destra: a.destra > 0 ? s.destra / a.destra * 100 : 0
    };
  }

  function registra() {
    var c = concentrazioni();
    var a = contaAcqua();
    storia.push({ t: tempo, cs: c.sinistra, cd: c.destra, as: a.sinistra });
    if (storia.length > 900) storia.shift();
  }

  /* ==========================================================
     2. Il movimento
     ========================================================== */

  /* Quanto l'acqua accumulata da una parte spinge indietro.
     Man mano che il livello sale, quel peso in piu' ricaccia
     l'acqua verso l'altra parte: e' la contropressione
     idrostatica. Senza di lei l'acqua passerebbe per sempre, e
     a concentrazioni uguali si vedrebbe una deriva casuale che
     con l'osmosi non c'entra niente.

     Il valore e' calcolato una volta per fotogramma e messo qui,
     perche' contare l'acqua per ogni particella sarebbe lento. */
  var squilibrio = 0;      /* (destra - sinistra) diviso il totale */

  function aggiornaSquilibrio() {
    var a = contaAcqua();
    squilibrio = (a.destra - a.sinistra) / Math.max(1, acqua.length);
  }

  function contropressione(veniamoDaSinistra) {
    /* andare verso la parte gia' piena costa, tornare indietro no */
    var controcorrente = veniamoDaSinistra ? squilibrio : -squilibrio;
    var p = Math.exp(-SPINTA_INDIETRO * controcorrente);
    return p > 1 ? 1 : p;
  }

  function muovi(elenco, dt, passaLaMembrana) {
    var velocita = 60 + temperatura * 1.4;
    var meta = larghezza / 2;
    var aperturaAlta = altezza * (0.5 - PORO / 2);
    var aperturaBassa = altezza * (0.5 + PORO / 2);

    for (var i = 0; i < elenco.length; i++) {
      var p = elenco[i];

      /* moto browniano: la direzione cambia in continuazione */
      p.vx += (Math.random() - 0.5) * 6 * dt * 60;
      p.vy += (Math.random() - 0.5) * 6 * dt * 60;
      var modulo = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
      p.vx = p.vx / modulo; p.vy = p.vy / modulo;

      var nuovoX = p.x + p.vx * velocita * dt;
      var nuovoY = p.y + p.vy * velocita * dt;

      /* la membrana */
      var attraversa = (p.x - meta) * (nuovoX - meta) < 0;
      if (attraversa) {
        var passaggioConsentito = passaLaMembrana &&
          nuovoY > aperturaAlta && nuovoY < aperturaBassa;
        /* l'acqua deve anche trovare il varco sgombro dal soluto */
        if (passaggioConsentito && elenco === acqua) {
          passaggioConsentito = varcoLibero(p, nuovoY) &&
            Math.random() < contropressione(p.x < meta);
        }
        if (!passaggioConsentito) {
          nuovoX = p.x;            /* rimbalza sulla membrana */
          p.vx = -p.vx;
        }
      }

      p.x = nuovoX; p.y = nuovoY;

      /* le pareti */
      if (p.x < p.raggio) { p.x = p.raggio; p.vx = Math.abs(p.vx); }
      if (p.x > larghezza - p.raggio) { p.x = larghezza - p.raggio; p.vx = -Math.abs(p.vx); }
      if (p.y < p.raggio) { p.y = p.raggio; p.vy = Math.abs(p.vy); }
      if (p.y > altezza - p.raggio) { p.y = altezza - p.raggio; p.vy = -Math.abs(p.vy); }
    }
  }

  /* Il soluto che sta davanti al varco impedisce all'acqua di
     uscire da quella parte. E' questo, e non la repulsione fra
     particelle, a produrre l'osmosi nel verso giusto: dove c'e'
     piu' soluto l'acqua esce meno spesso, e quindi si accumula. */
  function varcoLibero(p, nuovaY) {
    var meta = larghezza / 2;
    for (var i = 0; i < soluto.length; i++) {
      var s = soluto[i];
      if ((s.x < meta) !== (p.x < meta)) continue;   /* solo dalla sua parte */
      var dx = s.x - meta, dy = s.y - nuovaY;
      if (dx * dx + dy * dy < BLOCCO * BLOCCO) return false;
    }
    return true;
  }

  /* ==========================================================
     3. Disegno
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegna() {
    ctx.clearRect(0, 0, larghezza, altezza);

    var a = contaAcqua();
    var meta = larghezza / 2;

    /* il liquido: l'altezza di ogni parte dipende da quanta acqua
       contiene, cosi' si vede il livello salire da una parte */
    var livelloS = altezza * (1 - 0.82 * a.sinistra / (ACQUA_TOTALE * 0.62));
    var livelloD = altezza * (1 - 0.82 * a.destra / (ACQUA_TOTALE * 0.62));
    livelloS = Math.max(6, Math.min(altezza - 6, livelloS));
    livelloD = Math.max(6, Math.min(altezza - 6, livelloD));

    ctx.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    ctx.fillRect(0, 0, larghezza, altezza);
    ctx.fillStyle = "rgba(90,160,210,.16)";
    ctx.fillRect(0, livelloS, meta, altezza - livelloS);
    ctx.fillRect(meta, livelloD, meta, altezza - livelloD);

    /* la membrana, con il varco */
    var aperturaAlta = altezza * (0.5 - PORO / 2);
    var aperturaBassa = altezza * (0.5 + PORO / 2);
    ctx.strokeStyle = coloreTema("--testo-tenue", "#6b645a");
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(meta, 0); ctx.lineTo(meta, aperturaAlta);
    ctx.moveTo(meta, aperturaBassa); ctx.lineTo(meta, altezza);
    ctx.stroke();

    /* l'acqua */
    ctx.fillStyle = "#4a90c2";
    for (var i = 0; i < acqua.length; i++) {
      var p = acqua[i];
      ctx.beginPath(); ctx.arc(p.x, p.y, p.raggio, 0, Math.PI * 2); ctx.fill();
    }

    /* il soluto */
    ctx.fillStyle = "#c9762f";
    for (var j = 0; j < soluto.length; j++) {
      var s = soluto[j];
      ctx.beginPath(); ctx.arc(s.x, s.y, s.raggio, 0, Math.PI * 2); ctx.fill();
    }

    /* etichette */
    ctx.fillStyle = coloreTema("--testo-tenue", "#6b645a");
    ctx.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("sinistra", meta / 2, 14);
    ctx.fillText("destra", meta + meta / 2, 14);
  }

  function disegnaGrafico() {
    var c = ctxGrafico;
    c.clearRect(0, 0, larghezzaG, altezzaG);

    var margineS = 40, margineD = 12, margineA = 12, margineB = 32;
    var w = larghezzaG - margineS - margineD;
    var h = altezzaG - margineA - margineB;

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var bordo = coloreTema("--bordo", "#ddd6c9");

    var cMax = 1;
    for (var k = 0; k < storia.length; k++) {
      if (storia[k].cs > cMax) cMax = storia[k].cs;
      if (storia[k].cd > cMax) cMax = storia[k].cd;
    }
    cMax = cMax * 1.15;
    var tMax = Math.max(20, tempo);

    function px(t) { return margineS + t / tMax * w; }
    function py(v) { return margineA + h - v / cMax * h; }

    c.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.strokeStyle = tenue;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(margineS, margineA); c.lineTo(margineS, margineA + h); c.lineTo(margineS + w, margineA + h);
    c.stroke();

    c.fillStyle = tenue;
    c.textAlign = "right";
    c.fillText(Math.round(cMax) + "%", margineS - 5, margineA + 10);
    c.fillText("0", margineS - 5, margineA + h + 4);
    c.textAlign = "center";
    c.fillText("tempo →", margineS + w / 2, altezzaG - 6);

    if (storia.length > 1) {
      [["cs", "#c9762f"], ["cd", "#1f5f8b"]].forEach(function (serie) {
        c.strokeStyle = serie[1];
        c.lineWidth = 2.5;
        c.beginPath();
        for (var i = 0; i < storia.length; i++) {
          var x = px(storia[i].t), y = py(storia[i][serie[0]]);
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
      });
    }

    /* legenda */
    c.textAlign = "left";
    c.fillStyle = "#c9762f";
    c.fillText("■ concentrazione a sinistra", margineS + 6, margineA + 12);
    c.fillStyle = "#1f5f8b";
    c.fillText("■ concentrazione a destra", margineS + 6, margineA + 26);
  }

  /* ==========================================================
     4. Letture
     ========================================================== */

  function aggiornaLetture() {
    var c = concentrazioni();
    var a = contaAcqua();
    var s = contaSoluto();

    scrivi("lettura-cs", c.sinistra.toFixed(1).replace(".", ",") + "%");
    scrivi("lettura-cd", c.destra.toFixed(1).replace(".", ",") + "%");
    scrivi("lettura-as", String(a.sinistra));
    scrivi("lettura-ad", String(a.destra));
    scrivi("lettura-ss", String(s.sinistra));
    scrivi("lettura-sd", String(s.destra));

    var spiega = document.getElementById("spiegazione-fase");
    var riquadro = document.getElementById("riquadro-fase");
    if (!spiega) return;

    var differenza = Math.abs(c.sinistra - c.destra);
    var piuConcentrato = c.sinistra > c.destra ? "sinistra" : "destra";

    if (membrana === "permeabile") {
      if (differenza < 1.5) {
        spiega.textContent = "Le due parti hanno ormai la stessa concentrazione. Le particelle continuano a muoversi e ad attraversare, " +
          "ma in numero uguale nei due versi: il bilancio è zero. Questo è l'equilibrio, non l'immobilità.";
        if (riquadro) riquadro.classList.add("in-passaggio");
      } else {
        spiega.textContent = "La membrana lascia passare tutto. Il soluto si sposta verso la parte meno concentrata, non perché " +
          "sia attirato, ma perché di là ce n'è meno e quindi ne torna indietro di meno. È la diffusione.";
        if (riquadro) riquadro.classList.remove("in-passaggio");
      }
      return;
    }

    if (differenza < 1.5) {
      spiega.textContent = "Le concentrazioni si sono pareggiate. Il soluto non è passato: si è spostata l'acqua, " +
        "e infatti il livello da una parte è più alto. Questa è l'osmosi.";
      if (riquadro) riquadro.classList.add("in-passaggio");
    } else {
      spiega.textContent = "La membrana ferma il soluto e lascia passare solo l'acqua. Il soluto non può diluirsi spostandosi, " +
        "quindi è l'acqua ad andare verso " + piuConcentrato + ", dove la concentrazione è più alta. Guarda il livello.";
      if (riquadro) riquadro.classList.remove("in-passaggio");
    }
  }

  function scrivi(id, testo) {
    var e = document.getElementById(id);
    if (e && e.textContent !== testo) e.textContent = testo;
  }

  /* ==========================================================
     5. Il ciclo
     ========================================================== */

  function passo(istante) {
    if (!ultimoIstante) ultimoIstante = istante;
    var dt = Math.min(0.05, (istante - ultimoIstante) / 1000);
    ultimoIstante = istante;

    /* Se la pagina e' stata costruita mentre era nascosta, le misure
       erano zero: appena il contenitore ha una larghezza vera, si
       rifanno i conti. Succede aprendo il sito in una scheda di sfondo. */
    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) {
      adattaTele();
      popola();
    }

    if (inMoto && larghezza > 0) {
      aggiornaSquilibrio();
      muovi(acqua, dt, true);
      muovi(soluto, dt, membrana === "permeabile");
      tempo += dt;
      if (storia.length === 0 || tempo - storia[storia.length - 1].t > 0.25) registra();
    }

    disegnaTutto();
    requestAnimationFrame(passo);
  }

  /* Disegna un fotogramma. Serve anche subito dopo il caricamento:
     cosi' la pagina e' gia' corretta prima che parta l'animazione. */
  function disegnaTutto() {
    if (larghezza <= 0) return;
    disegna();
    disegnaGrafico();
    aggiornaLetture();
  }

  /* ==========================================================
     6. La pagina
     ========================================================== */

  function lettura(id, etichetta) {
    var box = elemento("div", "lettura");
    var v = elemento("div", "lettura-valore", "—");
    v.id = id;
    box.appendChild(v);
    box.appendChild(elemento("div", "lettura-nome", etichetta));
    return box;
  }

  function cursore(etichetta, min, max, passo, valore, unita, quandoCambia) {
    var riga = elemento("div", "cursore");
    var testa = elemento("div", "cursore-testa");
    testa.appendChild(elemento("span", "cursore-nome", etichetta));
    var lettura = elemento("span", "cursore-valore", valore + unita);
    testa.appendChild(lettura);
    riga.appendChild(testa);
    var input = elemento("input");
    input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(passo);
    input.value = String(valore);
    input.setAttribute("aria-label", etichetta);
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      lettura.textContent = v + unita;
      quandoCambia(v);
    });
    riga.appendChild(input);
    return riga;
  }

  function costruisci() {
    svuota(contenitore);

    contenitore.appendChild(elemento("p", "guida",
      "Metti più soluto da una parte e guarda che cosa si muove. Con la membrana semipermeabile " +
      "il soluto non può passare: si sposta l'acqua, e il livello cambia."));

    /* tipo di membrana */
    var scelte = elemento("div", "scelte-grandezza");
    [["semipermeabile", "Membrana semipermeabile"], ["permeabile", "Membrana permeabile"]].forEach(function (m) {
      var b = elemento("button", "pillola" + (membrana === m[0] ? " attiva" : ""), m[1]);
      b.type = "button";
      b.addEventListener("click", function () {
        membrana = m[0];
        popola();
        costruisci();
      });
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);
    contenitore.appendChild(elemento("p", "nota-piccola",
      membrana === "semipermeabile"
        ? "Solo l'acqua, le pallline azzurre piccole, può attraversare il varco. Il soluto arancione resta dov'è."
        : "Passano tutti: acqua e soluto. Il varco non fa selezione."));

    var scatola = elemento("div", "scatola-particelle");
    tela = document.createElement("canvas");
    tela.className = "tela";
    tela.setAttribute("role", "img");
    tela.setAttribute("aria-label", "Due scomparti separati da una membrana, con acqua e soluto");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    var letture = elemento("div", "letture");
    letture.appendChild(lettura("lettura-cs", "concentrazione a sinistra"));
    letture.appendChild(lettura("lettura-cd", "concentrazione a destra"));
    letture.appendChild(lettura("lettura-as", "acqua a sinistra"));
    letture.appendChild(lettura("lettura-ad", "acqua a destra"));
    letture.appendChild(lettura("lettura-ss", "soluto a sinistra"));
    letture.appendChild(lettura("lettura-sd", "soluto a destra"));
    contenitore.appendChild(letture);

    var riquadro = elemento("div", "riquadro-fase");
    riquadro.id = "riquadro-fase";
    var spiega = elemento("p", "spiegazione-fase");
    spiega.id = "spiegazione-fase";
    spiega.setAttribute("role", "status");
    riquadro.appendChild(spiega);
    contenitore.appendChild(riquadro);

    var comandi = elemento("div", "comandi");
    var riga = elemento("div", "bottoni");
    var moto = elemento("button", "bottone");
    moto.type = "button";
    moto.textContent = inMoto ? "⏸  Pausa" : "▶  Avvia";
    moto.addEventListener("click", function () {
      inMoto = !inMoto;
      moto.textContent = inMoto ? "⏸  Pausa" : "▶  Avvia";
    });
    riga.appendChild(moto);
    var reset = elemento("button", "bottone secondario", "↺  Ricomincia");
    reset.type = "button";
    reset.addEventListener("click", popola);
    riga.appendChild(reset);
    comandi.appendChild(riga);

    comandi.appendChild(cursore("Soluto a sinistra", 0, 60, 1, solutoSinistra, "",
      function (v) { solutoSinistra = v; popola(); }));
    comandi.appendChild(cursore("Soluto a destra", 0, 60, 1, solutoDestra, "",
      function (v) { solutoDestra = v; popola(); }));
    comandi.appendChild(cursore("Temperatura", 0, 100, 1, temperatura, "",
      function (v) { temperatura = v; }));
    comandi.appendChild(elemento("p", "nota-piccola",
      "La temperatura non cambia dove va l'acqua: cambia solo quanto in fretta ci arriva."));
    contenitore.appendChild(comandi);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Le concentrazioni nel tempo"));
    contenitore.appendChild(elemento("p", "didascalia",
      "Le due curve si avvicinano fino a incontrarsi. Quando si toccano, il movimento non si ferma: " +
      "si pareggiano gli scambi nei due versi."));
    var scatolaG = elemento("div", "scatola-grafico");
    telaGrafico = document.createElement("canvas");
    telaGrafico.className = "tela";
    telaGrafico.setAttribute("role", "img");
    telaGrafico.setAttribute("aria-label", "Le concentrazioni nei due scomparti nel tempo");
    scatolaG.appendChild(telaGrafico);
    contenitore.appendChild(scatolaG);

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Qui il fenomeno non è rappresentato ma succede davvero: nessuno dice all'acqua di andare verso la parte più concentrata. Ogni particella si muove a caso, e il risultato d'insieme emerge da quello.",
      "Le particelle sono poche centinaia invece che miliardi di miliardi, e si muovono in due dimensioni. Con numeri così piccoli le fluttuazioni si vedono a occhio: le concentrazioni ballano anche all'equilibrio. Nella realtà accade lo stesso, ma su numeri tanto grandi che non ce ne accorgiamo.",
      "Il dislivello che si forma spinge indietro l'acqua, e il flusso si ferma quando le due spinte si pareggiano: è la pressione osmotica, ed è il motivo per cui il livello smette di salire. Qui però la contropressione è una regola di comodo tarata perché la cosa si veda accadere, non la formula di van 't Hoff: il livello finale cresce con la concentrazione, ma non in proporzione esatta.",
      "Il soluto che ostruisce il varco è il meccanismo scelto per far nascere l'osmosi dal basso, senza dirla. Nella realtà il motivo è più sottile e riguarda l'acqua che, circondata da soluto, è un po' meno libera di andarsene.",
      "La membrana è un semplice varco che lascia passare le particelle piccole. Le membrane biologiche sono molto più selettive: scelgono in base alla forma, alla carica elettrica, e hanno canali e pompe.",
      "Non c'è il trasporto attivo: qui niente consuma energia per spostare sostanze contro il loro gradiente."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    popola();
    disegnaTutto();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(340, Math.max(220, larghezza * 0.55)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaG = telaGrafico.parentNode.clientWidth;
    altezzaG = Math.round(Math.min(240, Math.max(170, larghezzaG * 0.4)));
    telaGrafico.width = larghezzaG * dpr; telaGrafico.height = altezzaG * dpr;
    telaGrafico.style.width = larghezzaG + "px"; telaGrafico.style.height = altezzaG + "px";
    ctxGrafico = telaGrafico.getContext("2d");
    ctxGrafico.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    popola();
  });

  costruisci();
  requestAnimationFrame(passo);

})();
