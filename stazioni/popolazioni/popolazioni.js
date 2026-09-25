/* ============================================================
   Genetica di popolazioni
   ------------------------------------------------------------
   Prima si vede la popolazione: tanti pallini, uno per allele.
   Poi si guarda che cosa succede generazione dopo generazione.

   Tre esperimenti guidati portano lo studente ai tre risultati
   che contano: nelle popolazioni piccole il caso comanda, in
   quelle grandi no, e la selezione si vede solo se e' abbastanza
   forte da battere il caso.

   Il modello e' quello standard: selezione, mutazione e
   campionamento binomiale dei gameti. E' stato verificato su
   risultati noti, fra cui il piu' severo: la probabilita' che un
   allele neutro si fissi deve valere quanto la sua frequenza di
   partenza.
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  /* ---------- stato ---------- */

  var dimensione = 25;
  var pIniziale = 0.5;
  var vantaggio = 0;
  var mutazione = 0;
  var quante = 8;
  var velocita = 5;
  var inMoto = false;
  var mostraAvanzate = false;

  var popolazioni = [];
  var generazione = 0;
  var MAX_GENERAZIONI = 120;

  var esperimento = 0;        /* quale esperimento guidato e' attivo */

  var telaPop = null, ctxPop = null, larghezzaP = 0, altezzaP = 0;
  var telaGraf = null, ctxGraf = null, larghezzaG = 0, altezzaG = 0;
  var ultimoIstante = 0, accumulato = 0;

  var BLU = "#1f5f8b";        /* allele A */
  var ARANCIO = "#c9762f";    /* allele a */

  var COLORI = ["#1f5f8b", "#9b2f24", "#1d6b45", "#8f6fd0", "#c9762f",
                "#0f6e70", "#a2447a", "#4a90c2", "#8a5a12", "#3f7d3f",
                "#b0705a", "#6b645a"];

  /* ==========================================================
     Gli esperimenti guidati
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "1 · Una popolazione piccola",
      sottotitolo: "25 individui, nessun vantaggio",
      imposta: function () { dimensione = 25; vantaggio = 0; mutazione = 0; pIniziale = 0.5; quante = 8; },
      cosaGuardare: "Le otto popolazioni partono tutte da metà e metà, e nessun allele è migliore dell'altro. " +
        "Guarda se restano insieme.",
      cosaSuccede: "Si sparpagliano subito, e quasi tutte finiscono per sbattere contro lo zero o contro l'uno. " +
        "Quando ci arrivano, non tornano più indietro: un allele è sparito per sempre. " +
        "Nessuno lo ha eliminato, è successo per caso. Questa è la deriva genetica."
    },
    {
      titolo: "2 · Una popolazione grande",
      sottotitolo: "1500 individui, nessun vantaggio",
      imposta: function () { dimensione = 1500; vantaggio = 0; mutazione = 0; pIniziale = 0.5; quante = 8; },
      cosaGuardare: "Stessa situazione di prima, ma con sessanta volte più individui. " +
        "Guarda quanto si allontanano dal valore di partenza.",
      cosaSuccede: "Restano quasi incollate a metà. Con tanti individui i gameti che formano la generazione nuova " +
        "sono un campione grande, e i campioni grandi sbagliano poco. " +
        "Questa è la situazione descritta da Hardy e Weinberg: niente cambia."
    },
    {
      titolo: "3 · Un allele vantaggioso",
      sottotitolo: "chi ha A lascia il 20% di figli in più",
      imposta: function () { dimensione = 200; vantaggio = 0.2; mutazione = 0; pIniziale = 0.1; quante = 8; },
      cosaGuardare: "L'allele A parte raro, appena il 10%, ma chi ce l'ha si riproduce meglio. " +
        "Guarda la forma della salita.",
      cosaSuccede: "Sale in tutte le popolazioni, ma piano all'inizio: quando un allele è raro, è raro anche " +
        "il vantaggio che porta. Poi accelera, e alla fine rallenta di nuovo perché resta poco da guadagnare. " +
        "La selezione spinge nella stessa direzione in tutte, il caso le scompiglia una per una."
    },
    {
      titolo: "4 · Il caso più forte della selezione",
      sottotitolo: "25 individui, vantaggio del 10%",
      imposta: function () { dimensione = 25; vantaggio = 0.1; mutazione = 0; pIniziale = 0.3; quante = 8; },
      cosaGuardare: "Qui l'allele A è avvantaggiato, ma la popolazione è minuscola. Chi vince?",
      cosaSuccede: "Qualche popolazione perde l'allele vantaggioso, nonostante il vantaggio. " +
        "In una popolazione piccola il rumore del caso è più forte del segnale della selezione: " +
        "è il motivo per cui le specie ridotte a pochi individui perdono varietà utile e diventano fragili."
    }
  ];

  /* ==========================================================
     Il modello
     ========================================================== */

  function gaussiana() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function estrai(p, dueEnne) {
    if (p <= 0) return 0;
    if (p >= 1) return dueEnne;
    if (dueEnne <= 2000) {
      var k = 0;
      for (var i = 0; i < dueEnne; i++) if (Math.random() < p) k++;
      return k;
    }
    var media = dueEnne * p;
    var scarto = Math.sqrt(dueEnne * p * (1 - p));
    return Math.max(0, Math.min(dueEnne, Math.round(media + gaussiana() * scarto)));
  }

  function dopoSelezione(p) {
    if (vantaggio === 0) return p;
    var q = 1 - p;
    var wAA = 1 + vantaggio, wAa = 1 + vantaggio / 2, waa = 1;
    var media = p * p * wAA + 2 * p * q * wAa + q * q * waa;
    if (media <= 0) return p;
    return (p * p * wAA + p * q * wAa) / media;
  }

  function dopoMutazione(p) {
    if (mutazione === 0) return p;
    return p * (1 - mutazione) + (1 - p) * mutazione;
  }

  function azzera() {
    popolazioni = [];
    for (var i = 0; i < quante; i++) popolazioni.push([pIniziale]);
    generazione = 0;
    accumulato = 0;
  }

  function unaGenerazione() {
    if (generazione >= MAX_GENERAZIONI) return;
    var dueEnne = 2 * dimensione;
    for (var i = 0; i < popolazioni.length; i++) {
      var p = popolazioni[i][popolazioni[i].length - 1];
      p = dopoSelezione(p);
      p = dopoMutazione(p);
      p = estrai(p, dueEnne) / dueEnne;
      popolazioni[i].push(p);
    }
    generazione++;
  }

  function ultimaP(i) { return popolazioni[i][popolazioni[i].length - 1]; }

  function fissate() {
    var uno = 0, zero = 0;
    for (var i = 0; i < popolazioni.length; i++) {
      var p = ultimaP(i);
      if (p >= 1) uno++; else if (p <= 0) zero++;
    }
    return { uno: uno, zero: zero, vive: popolazioni.length - uno - zero };
  }

  /* ==========================================================
     Disegno: la popolazione vista da vicino
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegnaPopolazione() {
    if (!ctxPop || larghezzaP <= 0) return;
    var c = ctxPop;
    c.clearRect(0, 0, larghezzaP, altezzaP);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaP, altezzaP);

    var p = popolazioni.length ? ultimaP(0) : pIniziale;
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var dueEnne = 2 * dimensione;

    c.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.textAlign = "left";
    c.fillStyle = tenue;

    var altezzaBarra = 34;
    var spazioPallini = altezzaP - altezzaBarra - 46;

    /* i pallini: un allele ciascuno */
    if (dueEnne <= 400) {
      var colonne = Math.ceil(Math.sqrt(dueEnne * (larghezzaP / Math.max(1, spazioPallini))));
      colonne = Math.max(10, Math.min(colonne, 40));
      var righe = Math.ceil(dueEnne / colonne);
      var passo = Math.min((larghezzaP - 20) / colonne, spazioPallini / Math.max(1, righe));
      var raggio = Math.max(2.5, passo * 0.34);
      var quantiA = Math.round(p * dueEnne);
      for (var i = 0; i < dueEnne; i++) {
        var cc = i % colonne, rr = Math.floor(i / colonne);
        var x = 12 + passo * (cc + 0.5);
        var y = 22 + passo * (rr + 0.5);
        c.fillStyle = i < quantiA ? BLU : ARANCIO;
        c.beginPath(); c.arc(x, y, raggio, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = tenue;
      c.fillText("la prima popolazione: " + dueEnne + " alleli, uno per pallino", 12, 14);
    } else {
      c.fillStyle = tenue;
      c.fillText("la prima popolazione ha " + dueEnne + " alleli: troppi per disegnarli tutti", 12, 14);
      var yBar = 40, hBar = Math.min(60, spazioPallini * 0.5);
      c.fillStyle = BLU;
      c.fillRect(12, yBar, (larghezzaP - 24) * p, hBar);
      c.fillStyle = ARANCIO;
      c.fillRect(12 + (larghezzaP - 24) * p, yBar, (larghezzaP - 24) * (1 - p), hBar);
    }

    /* la barra dei genotipi, secondo Hardy-Weinberg */
    var q = 1 - p;
    var y0 = altezzaP - altezzaBarra - 16;
    var larghezzaUtile = larghezzaP - 24;
    var quote = [
      { v: p * p, col: BLU, testo: "AA" },
      { v: 2 * p * q, col: "#7aa8c4", testo: "Aa" },
      { v: q * q, col: ARANCIO, testo: "aa" }
    ];
    var x0 = 12;
    quote.forEach(function (z) {
      var w = larghezzaUtile * z.v;
      c.fillStyle = z.col;
      c.fillRect(x0, y0, w, altezzaBarra);
      if (w > 30) {
        c.fillStyle = "#ffffff";
        c.font = "bold 12px system-ui, -apple-system, 'Segoe UI', sans-serif";
        c.textAlign = "center";
        c.fillText(z.testo + " " + Math.round(z.v * 100) + "%", x0 + w / 2, y0 + altezzaBarra / 2 + 4);
      }
      x0 += w;
    });
    c.fillStyle = tenue;
    c.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.textAlign = "left";
    c.fillText("i tre genotipi, calcolati con Hardy-Weinberg", 12, altezzaP - 4);
  }

  /* ==========================================================
     Disegno: le generazioni
     ========================================================== */

  function disegnaGrafico() {
    if (!ctxGraf || larghezzaG <= 0) return;
    var c = ctxGraf;
    c.clearRect(0, 0, larghezzaG, altezzaG);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaG, altezzaG);

    var margineS = 34, margineD = 120, margineA = 16, margineB = 30;
    var w = larghezzaG - margineS - margineD;
    var h = altezzaG - margineA - margineB;

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var bordo = coloreTema("--bordo", "#ddd6c9");

    function px(g) { return margineS + g / MAX_GENERAZIONI * w; }
    function py(p) { return margineA + h - p * h; }

    c.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

    /* le due righe che contano: sopra e sotto */
    c.strokeStyle = bordo;
    c.lineWidth = 1;
    [0, 1].forEach(function (v) {
      c.beginPath(); c.moveTo(margineS, py(v)); c.lineTo(margineS + w, py(v)); c.stroke();
    });
    c.fillStyle = tenue;
    c.textAlign = "left";
    c.fillText("resta solo A", margineS + w + 8, py(1) + 4);
    c.fillText("A è sparito", margineS + w + 8, py(0) + 4);

    /* la riga di partenza */
    c.strokeStyle = bordo;
    c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(margineS, py(pIniziale)); c.lineTo(margineS + w, py(pIniziale)); c.stroke();
    c.setLineDash([]);
    c.fillText("partenza", margineS + w + 8, py(pIniziale) + 4);

    /* assi */
    c.strokeStyle = tenue;
    c.beginPath();
    c.moveTo(margineS, margineA); c.lineTo(margineS, margineA + h); c.lineTo(margineS + w, margineA + h);
    c.stroke();
    c.textAlign = "right";
    [0, 0.5, 1].forEach(function (v) {
      c.fillText(v === 0.5 ? "0,5" : String(v), margineS - 5, py(v) + 4);
    });
    c.textAlign = "center";
    c.fillText("generazioni →", margineS + w / 2, altezzaG - 8);

    /* le popolazioni */
    for (var i = 0; i < popolazioni.length; i++) {
      var serie = popolazioni[i];
      var finita = serie[serie.length - 1] >= 1 || serie[serie.length - 1] <= 0;
      c.strokeStyle = COLORI[i % COLORI.length];
      c.lineWidth = 2;
      c.globalAlpha = finita ? 0.45 : 0.9;
      c.beginPath();
      for (var g = 0; g < serie.length; g++) {
        var x = px(g), y = py(serie[g]);
        if (g === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      /* un pallino sulla punta di ogni linea */
      c.fillStyle = COLORI[i % COLORI.length];
      c.beginPath();
      c.arc(px(serie.length - 1), py(serie[serie.length - 1]), 3.2, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
  }

  /* ==========================================================
     I testi che accompagnano
     ========================================================== */

  function raccontaOra() {
    var f = fissate();
    if (generazione === 0) return ESPERIMENTI[esperimento].cosaGuardare;

    if (f.vive === 0) {
      return "Finito: tutte le popolazioni hanno perso la variabilità. " +
        f.uno + (f.uno === 1 ? " ha" : " hanno") + " conservato solo l'allele A, " +
        f.zero + " solo l'allele a. " +
        "Da qui non si torna indietro: l'allele perduto può rientrare solo con una nuova mutazione " +
        "o con l'arrivo di individui da fuori.";
    }

    var pezzi = [];
    pezzi.push("Generazione " + generazione + ".");
    if (f.uno + f.zero > 0) {
      pezzi.push(f.uno + f.zero + " popolazioni su " + popolazioni.length +
        " hanno già perso un allele: quelle linee sono arrivate al bordo e si sono fermate.");
    }
    if (dimensione <= 60 && vantaggio === 0) {
      pezzi.push("Nessun allele è migliore dell'altro, eppure le linee si allontanano: è solo il caso.");
    } else if (dimensione >= 800 && vantaggio === 0) {
      pezzi.push("Le linee restano vicine alla partenza: con tanti individui il caso quasi non si sente.");
    } else if (vantaggio > 0) {
      pezzi.push("L'allele A è avvantaggiato e tende a salire, ma non tutte le popolazioni lo seguono alla stessa velocità.");
    }
    return pezzi.join(" ");
  }

  function aggiornaTesti() {
    var f = fissate();
    var p = popolazioni.length ? ultimaP(0) : pIniziale;

    scrivi("lettura-generazione", String(generazione));
    scrivi("lettura-p", Math.round(p * 100) + "%");
    scrivi("lettura-vive", String(f.vive));
    scrivi("lettura-perse", String(f.uno + f.zero));

    var spiega = document.getElementById("spiegazione-fase");
    if (spiega) spiega.textContent = raccontaOra();
    var riquadro = document.getElementById("riquadro-fase");
    if (riquadro) riquadro.classList.toggle("in-passaggio", fissate().vive === 0 && generazione > 0);

    var conclusione = document.getElementById("conclusione");
    if (conclusione) {
      if (generazione > 0 && (f.vive === 0 || generazione >= MAX_GENERAZIONI)) {
        conclusione.hidden = false;
        conclusione.textContent = "Che cosa è successo: " + ESPERIMENTI[esperimento].cosaSuccede;
      } else {
        conclusione.hidden = true;
      }
    }
  }

  function scrivi(id, testo) {
    var e = document.getElementById(id);
    if (e && e.textContent !== testo) e.textContent = testo;
  }

  /* ==========================================================
     Il ciclo
     ========================================================== */

  function passo(istante) {
    if (!ultimoIstante) ultimoIstante = istante;
    var dt = Math.min(0.1, (istante - ultimoIstante) / 1000);
    ultimoIstante = istante;

    if (larghezzaP <= 0 && telaPop && telaPop.parentNode.clientWidth > 0) adattaTele();

    if (inMoto) {
      accumulato += dt * velocita;
      var quanteOra = Math.floor(accumulato);
      accumulato -= quanteOra;
      for (var i = 0; i < quanteOra; i++) unaGenerazione();
      if (generazione >= MAX_GENERAZIONI || fissate().vive === 0) fermati();
    }

    disegnaPopolazione();
    disegnaGrafico();
    aggiornaTesti();
    requestAnimationFrame(passo);
  }

  /* ridisegna subito: i bottoni non devono aspettare il prossimo
     fotogramma, che in una scheda nascosta non arriva mai */
  function disegnaTutto() {
    disegnaPopolazione();
    disegnaGrafico();
    aggiornaTesti();
  }

  function fermati() {
    inMoto = false;
    var b = document.getElementById("bottone-moto");
    if (b) b.textContent = "▶  Avvia";
  }

  /* ==========================================================
     La pagina
     ========================================================== */

  function lettura(id, etichetta) {
    var box = elemento("div", "lettura");
    var v = elemento("div", "lettura-valore", "—");
    v.id = id;
    box.appendChild(v);
    box.appendChild(elemento("div", "lettura-nome", etichetta));
    return box;
  }

  function cursore(etichetta, min, max, passoV, valore, formatta, quandoCambia) {
    var riga = elemento("div", "cursore");
    var testa = elemento("div", "cursore-testa");
    testa.appendChild(elemento("span", "cursore-nome", etichetta));
    var lettura = elemento("span", "cursore-valore", formatta(valore));
    testa.appendChild(lettura);
    riga.appendChild(testa);
    var input = elemento("input");
    input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(passoV);
    input.value = String(valore);
    input.setAttribute("aria-label", etichetta);
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      lettura.textContent = formatta(v);
      quandoCambia(v);
    });
    riga.appendChild(input);
    return riga;
  }

  function scegliEsperimento(i) {
    esperimento = i;
    ESPERIMENTI[i].imposta();
    fermati();
    azzera();
    costruisci();
  }

  function costruisci() {
    svuota(contenitore);
    var e = ESPERIMENTI[esperimento];

    contenitore.appendChild(elemento("p", "guida",
      "Un gene con due versioni: l'allele A, in blu, e l'allele a, in arancione. " +
      "Otto popolazioni partono dalla stessa situazione e vengono seguite generazione dopo generazione."));

    /* gli esperimenti guidati */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Scegli un esperimento"));
    var scelte = elemento("div", "griglia-esperimenti");
    ESPERIMENTI.forEach(function (x, i) {
      var b = elemento("button", "carta-esperimento" + (i === esperimento ? " scelta" : ""));
      b.type = "button";
      b.appendChild(elemento("div", "esperimento-titolo", x.titolo));
      b.appendChild(elemento("div", "esperimento-sottotitolo", x.sottotitolo));
      b.addEventListener("click", function () { scegliEsperimento(i); });
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);

    /* che cosa guardare */
    var riquadro = elemento("div", "riquadro-fase");
    riquadro.id = "riquadro-fase";
    var spiega = elemento("p", "spiegazione-fase");
    spiega.id = "spiegazione-fase";
    spiega.setAttribute("role", "status");
    riquadro.appendChild(spiega);
    contenitore.appendChild(riquadro);

    /* i comandi, subito sotto */
    var comandi = elemento("div", "comandi");
    var riga = elemento("div", "bottoni");

    var moto = elemento("button", "bottone");
    moto.type = "button";
    moto.id = "bottone-moto";
    moto.textContent = inMoto ? "⏸  Pausa" : "▶  Avvia";
    moto.addEventListener("click", function () {
      if (generazione >= MAX_GENERAZIONI || fissate().vive === 0) azzera();
      inMoto = !inMoto;
      moto.textContent = inMoto ? "⏸  Pausa" : "▶  Avvia";
    });
    riga.appendChild(moto);

    var una = elemento("button", "bottone secondario", "+1 generazione");
    una.type = "button";
    una.addEventListener("click", function () { unaGenerazione(); disegnaTutto(); });
    riga.appendChild(una);

    var reset = elemento("button", "bottone secondario", "↺  Ricomincia");
    reset.type = "button";
    reset.addEventListener("click", function () { fermati(); azzera(); disegnaTutto(); });
    riga.appendChild(reset);
    comandi.appendChild(riga);
    contenitore.appendChild(comandi);

    /* la popolazione vista da vicino */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La popolazione, da vicino"));
    contenitore.appendChild(elemento("p", "didascalia",
      "Ogni pallino è un allele: ogni individuo ne ha due. Sotto, come si combinano nei tre genotipi."));
    var scatolaP = elemento("div", "scatola-particelle");
    telaPop = document.createElement("canvas");
    telaPop.className = "tela";
    telaPop.setAttribute("role", "img");
    telaPop.setAttribute("aria-label", "Gli alleli della prima popolazione e le proporzioni dei tre genotipi");
    scatolaP.appendChild(telaPop);
    contenitore.appendChild(scatolaP);

    /* le letture */
    var letture = elemento("div", "letture");
    letture.appendChild(lettura("lettura-generazione", "generazione"));
    letture.appendChild(lettura("lettura-p", "quanto A nella prima"));
    letture.appendChild(lettura("lettura-vive", "popolazioni ancora miste"));
    letture.appendChild(lettura("lettura-perse", "popolazioni che hanno perso un allele"));
    contenitore.appendChild(letture);

    /* il grafico */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Generazione dopo generazione"));
    contenitore.appendChild(elemento("p", "didascalia",
      "Una linea per popolazione. In alto e in basso ci sono i due bordi senza ritorno: " +
      "quando una linea li tocca, in quella popolazione è rimasto un solo allele."));
    var scatolaG = elemento("div", "scatola-grafico");
    telaGraf = document.createElement("canvas");
    telaGraf.className = "tela";
    telaGraf.setAttribute("role", "img");
    telaGraf.setAttribute("aria-label", "La frequenza dell'allele A in ogni popolazione, generazione dopo generazione");
    scatolaG.appendChild(telaGraf);
    contenitore.appendChild(scatolaG);

    /* la conclusione, che compare a esperimento finito */
    var conclusione = elemento("p", "conclusione");
    conclusione.id = "conclusione";
    conclusione.hidden = true;
    contenitore.appendChild(conclusione);

    /* le manopole, nascoste finche' non servono */
    var apri = elemento("button", "pillola pillola-altre",
      mostraAvanzate ? "− nascondi le manopole" : "+ voglio regolare io");
    apri.type = "button";
    apri.addEventListener("click", function () {
      mostraAvanzate = !mostraAvanzate;
      costruisci();
    });
    var rigaApri = elemento("div", "scelte-grandezza");
    rigaApri.appendChild(apri);
    contenitore.appendChild(rigaApri);

    if (mostraAvanzate) {
      var manopole = elemento("div", "comandi");
      manopole.appendChild(cursore("Individui per popolazione", 10, 2000, 5, dimensione,
        function (v) { return v; },
        function (v) { dimensione = v; azzera(); }));
      manopole.appendChild(cursore("Quanto A all'inizio", 0.05, 0.95, 0.05, pIniziale,
        function (v) { return Math.round(v * 100) + "%"; },
        function (v) { pIniziale = v; azzera(); }));
      manopole.appendChild(cursore("Vantaggio di A", -0.4, 0.4, 0.02, vantaggio,
        function (v) { return v === 0 ? "nessuno" : (v > 0 ? "+" : "") + Math.round(v * 100) + "%"; },
        function (v) { vantaggio = v; azzera(); }));
      manopole.appendChild(cursore("Mutazione", 0, 0.02, 0.001, mutazione,
        function (v) { return v === 0 ? "nessuna" : (v * 100).toFixed(1).replace(".", ",") + "%"; },
        function (v) { mutazione = v; azzera(); }));
      manopole.appendChild(cursore("Quante popolazioni", 1, 12, 1, quante,
        function (v) { return v; },
        function (v) { quante = v; azzera(); }));
      manopole.appendChild(cursore("Velocità", 1, 30, 1, velocita,
        function (v) { return v + " gen/s"; },
        function (v) { velocita = v; }));
      contenitore.appendChild(manopole);
    }

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "I conti sono quelli veri della genetica di popolazioni: selezione, mutazione e campionamento dei gameti. L'equilibrio di Hardy-Weinberg viene rispettato quando ci sono le sue condizioni, e la probabilità che un allele neutro si fissi risulta uguale alla sua frequenza di partenza, come dice la teoria.",
      "I pallini disegnati mostrano quanti alleli A e quanti a ci sono, ma non chi sta con chi: la barra dei genotipi è calcolata con Hardy-Weinberg, non contando coppie vere.",
      "C'è un solo gene con due alleli. Un carattere vero dipende quasi sempre da molti geni insieme.",
      "Il vantaggio è codominante: l'eterozigote sta a metà fra i due omozigoti. Con la dominanza completa un allele recessivo raro resta nascosto negli eterozigoti e la selezione fatica a eliminarlo: è il motivo per cui le malattie recessive non spariscono.",
      "Le generazioni non si sovrappongono e gli accoppiamenti sono del tutto casuali: niente gruppi isolati, niente migrazione, niente scelta del partner.",
      "Oltre i mille individui il campionamento è calcolato con un'approssimazione invece che estrazione per estrazione: con quei numeri la differenza non si vede."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    disegnaTutto();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    if (telaPop && telaPop.parentNode.clientWidth > 0) {
      larghezzaP = telaPop.parentNode.clientWidth;
      altezzaP = Math.round(Math.min(280, Math.max(210, larghezzaP * 0.42)));
      telaPop.width = larghezzaP * dpr; telaPop.height = altezzaP * dpr;
      telaPop.style.width = larghezzaP + "px"; telaPop.style.height = altezzaP + "px";
      ctxPop = telaPop.getContext("2d");
      ctxPop.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (telaGraf && telaGraf.parentNode.clientWidth > 0) {
      larghezzaG = telaGraf.parentNode.clientWidth;
      altezzaG = Math.round(Math.min(300, Math.max(220, larghezzaG * 0.5)));
      telaGraf.width = larghezzaG * dpr; telaGraf.height = altezzaG * dpr;
      telaGraf.style.width = larghezzaG + "px"; telaGraf.style.height = altezzaG + "px";
      ctxGraf = telaGraf.getContext("2d");
      ctxGraf.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  window.addEventListener("resize", function () {
    adattaTele();
    disegnaPopolazione();
    disegnaGrafico();
  });

  ESPERIMENTI[0].imposta();
  azzera();
  costruisci();
  requestAnimationFrame(passo);

})();
