/* ============================================================
   Genetica di popolazioni
   ------------------------------------------------------------
   Piu' popolazioni identiche partono con la stessa frequenza
   allelica e vengono seguite generazione dopo generazione.

   Ogni generazione fa tre cose, nell'ordine:
     1. selezione   i genotipi non lasciano tutti la stessa
                    discendenza: p cambia in modo prevedibile
     2. mutazione   una piccola quota di alleli si trasforma
     3. deriva      i gameti che formano la generazione nuova
                    sono un campione a caso: piu' la popolazione
                    e' piccola, piu' il campione sbaglia

   Il punto della stazione: con poche decine di individui le linee
   si sparpagliano e finiscono per sbattere contro lo zero o
   contro l'uno, anche senza nessun vantaggio. Con migliaia di
   individui restano incollate al valore di partenza. La deriva
   non e' una forza: e' l'errore di campionamento.

   L'equilibrio di Hardy-Weinberg e' il caso in cui non succede
   niente di tutto questo: popolazione infinita, nessuna selezione,
   nessuna mutazione. Serve da metro di paragone.
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  /* ---------- stato ---------- */

  var dimensione = 50;        /* individui per popolazione */
  var pIniziale = 0.5;
  var vantaggio = 0;          /* quanto conviene avere l'allele A, da -0.5 a 0.5 */
  var mutazione = 0;          /* quota di alleli che muta per generazione */
  var quante = 8;             /* popolazioni seguite in parallelo */
  var velocita = 6;           /* generazioni al secondo */
  var inMoto = false;

  var popolazioni = [];       /* ognuna e' un elenco di p, una per generazione */
  var generazione = 0;
  var MAX_GENERAZIONI = 200;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var ultimoIstante = 0, accumulato = 0;

  var COLORI = ["#1f5f8b", "#9b2f24", "#1d6b45", "#8f6fd0", "#c9762f",
                "#0f6e70", "#a2447a", "#6b645a", "#4a90c2", "#8a5a12",
                "#3f7d3f", "#b0705a"];

  /* ==========================================================
     1. Il modello
     ========================================================== */

  /* un numero a caso con distribuzione normale, media 0 e
     scarto 1: serve per approssimare il campionamento quando la
     popolazione e' grande */
  function gaussiana() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* quanti alleli A finiscono nella generazione successiva:
     e' un'estrazione a caso di 2N alleli con probabilita' p */
  function estrai(p, dueEnne) {
    if (p <= 0) return 0;
    if (p >= 1) return dueEnne;
    if (dueEnne <= 2000) {
      var k = 0;
      for (var i = 0; i < dueEnne; i++) if (Math.random() < p) k++;
      return k;
    }
    /* per popolazioni grandi l'estrazione esatta costerebbe troppo:
       si usa l'approssimazione normale, che con questi numeri e'
       indistinguibile */
    var media = dueEnne * p;
    var scarto = Math.sqrt(dueEnne * p * (1 - p));
    var k2 = Math.round(media + gaussiana() * scarto);
    return Math.max(0, Math.min(dueEnne, k2));
  }

  /* la selezione: i tre genotipi lasciano discendenze diverse.
     Qui il vantaggio e' codominante: l'eterozigote sta a meta'. */
  function dopoSelezione(p) {
    if (vantaggio === 0) return p;
    var q = 1 - p;
    var wAA = 1 + vantaggio;
    var wAa = 1 + vantaggio / 2;
    var waa = 1;
    var media = p * p * wAA + 2 * p * q * wAa + q * q * waa;
    if (media <= 0) return p;
    return (p * p * wAA + p * q * wAa) / media;
  }

  function dopoMutazione(p) {
    if (mutazione === 0) return p;
    /* muta in entrambi i versi con la stessa probabilita' */
    return p * (1 - mutazione) + (1 - p) * mutazione;
  }

  function azzera() {
    popolazioni = [];
    for (var i = 0; i < quante; i++) popolazioni.push([pIniziale]);
    generazione = 0;
    accumulato = 0;
  }

  function unaGenerazione() {
    if (generazione >= MAX_GENERAZIONI) { inMoto = false; return; }
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

  /* ==========================================================
     2. Le misure
     ========================================================== */

  function ultimaP(i) { return popolazioni[i][popolazioni[i].length - 1]; }

  function mediaP() {
    var s = 0;
    for (var i = 0; i < popolazioni.length; i++) s += ultimaP(i);
    return popolazioni.length ? s / popolazioni.length : 0;
  }

  function fissate() {
    var a = 0, zero = 0;
    for (var i = 0; i < popolazioni.length; i++) {
      var p = ultimaP(i);
      if (p >= 1) a++;
      else if (p <= 0) zero++;
    }
    return { uno: a, zero: zero };
  }

  function sparpagliamento() {
    var m = mediaP(), s = 0;
    for (var i = 0; i < popolazioni.length; i++) {
      var d = ultimaP(i) - m;
      s += d * d;
    }
    return popolazioni.length > 1 ? Math.sqrt(s / popolazioni.length) : 0;
  }

  /* ==========================================================
     3. Disegno
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegna() {
    if (!ctx || larghezza <= 0) return;
    ctx.clearRect(0, 0, larghezza, altezza);
    ctx.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    ctx.fillRect(0, 0, larghezza, altezza);

    var margineS = 40, margineD = 12, margineA = 12, margineB = 30;
    var w = larghezza - margineS - margineD;
    var h = altezza - margineA - margineB;

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var bordo = coloreTema("--bordo", "#ddd6c9");

    function px(g) { return margineS + g / MAX_GENERAZIONI * w; }
    function py(p) { return margineA + h - p * h; }

    /* la riga della frequenza di partenza */
    ctx.strokeStyle = bordo;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margineS, py(pIniziale)); ctx.lineTo(margineS + w, py(pIniziale));
    ctx.stroke();
    ctx.setLineDash([]);

    /* assi */
    ctx.strokeStyle = tenue;
    ctx.beginPath();
    ctx.moveTo(margineS, margineA); ctx.lineTo(margineS, margineA + h); ctx.lineTo(margineS + w, margineA + h);
    ctx.stroke();

    ctx.fillStyle = tenue;
    ctx.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
    ctx.textAlign = "right";
    [0, 0.5, 1].forEach(function (v) {
      ctx.fillText(v === 0 ? "0" : (v === 1 ? "1" : "0,5"), margineS - 5, py(v) + 4);
    });
    ctx.textAlign = "center";
    ctx.fillText("generazioni", margineS + w / 2, altezza - 8);

    /* le popolazioni */
    for (var i = 0; i < popolazioni.length; i++) {
      var serie = popolazioni[i];
      ctx.strokeStyle = COLORI[i % COLORI.length];
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (var g = 0; g < serie.length; g++) {
        var x = px(g), y = py(serie[g]);
        if (g === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /* ==========================================================
     4. Letture
     ========================================================== */

  function aggiornaLetture() {
    var f = fissate();
    var m = mediaP();
    scrivi("lettura-generazione", String(generazione));
    scrivi("lettura-media", m.toFixed(3).replace(".", ","));
    scrivi("lettura-sparpagliamento", sparpagliamento().toFixed(3).replace(".", ","));
    scrivi("lettura-fissate", f.uno + " / " + f.zero);

    /* le proporzioni di Hardy-Weinberg calcolate sulla media */
    var q = 1 - m;
    scrivi("lettura-hw", (m * m * 100).toFixed(0) + " · " + (2 * m * q * 100).toFixed(0) + " · " + (q * q * 100).toFixed(0));

    var spiega = document.getElementById("spiegazione-fase");
    var riquadro = document.getElementById("riquadro-fase");
    if (!spiega) return;

    var perse = f.uno + f.zero;
    if (generazione === 0) {
      spiega.textContent = "Tutte le popolazioni partono da qui. Premi Avvia e guarda se restano insieme o si sparpagliano.";
      if (riquadro) riquadro.classList.remove("in-passaggio");
      return;
    }
    if (perse === popolazioni.length) {
      spiega.textContent = "Tutte le popolazioni hanno perso la variabilità: in ognuna è rimasto un solo allele. " +
        "Da qui non si torna indietro, se non con una nuova mutazione o con l'arrivo di individui da fuori.";
      if (riquadro) riquadro.classList.add("in-passaggio");
      return;
    }
    if (riquadro) riquadro.classList.remove("in-passaggio");

    if (dimensione <= 60 && vantaggio === 0) {
      spiega.textContent = "Nessun allele è avvantaggiato, eppure le linee si allontanano: è la deriva genetica. " +
        "Con pochi individui i gameti che formano la generazione nuova sono un campione piccolo, e i campioni piccoli sbagliano.";
    } else if (dimensione > 500 && vantaggio === 0) {
      spiega.textContent = "Le linee restano incollate al valore di partenza: con tanti individui il campionamento quasi non sbaglia. " +
        "È la situazione che Hardy e Weinberg descrivono per una popolazione infinita.";
    } else if (vantaggio > 0) {
      spiega.textContent = "L'allele A è avvantaggiato e sale in tutte le popolazioni, ma non tutte alla stessa velocità: " +
        "la selezione spinge nella stessa direzione, il caso scompiglia.";
    } else if (vantaggio < 0) {
      spiega.textContent = "L'allele A è svantaggiato e scende. Nota però che sparisce lentamente quando è già raro: " +
        "negli eterozigoti resta nascosto, e la selezione non lo vede.";
    } else {
      spiega.textContent = "Le linee si muovono per puro caso: nessun allele è migliore dell'altro.";
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
    var dt = Math.min(0.1, (istante - ultimoIstante) / 1000);
    ultimoIstante = istante;

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTela();

    if (inMoto) {
      accumulato += dt * velocita;
      var quanteOra = Math.floor(accumulato);
      accumulato -= quanteOra;
      for (var i = 0; i < quanteOra && generazione < MAX_GENERAZIONI; i++) unaGenerazione();
      if (generazione >= MAX_GENERAZIONI) {
        inMoto = false;
        var b = document.getElementById("bottone-moto");
        if (b) b.textContent = "▶  Avvia";
      }
    }

    disegna();
    aggiornaLetture();
    requestAnimationFrame(passo);
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

  function cursore(etichetta, min, max, passo, valore, formatta, quandoCambia) {
    var riga = elemento("div", "cursore");
    var testa = elemento("div", "cursore-testa");
    testa.appendChild(elemento("span", "cursore-nome", etichetta));
    var lettura = elemento("span", "cursore-valore", formatta(valore));
    testa.appendChild(lettura);
    riga.appendChild(testa);
    var input = elemento("input");
    input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(passo);
    input.value = String(valore);
    input.setAttribute("aria-label", etichetta);
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      lettura.textContent = formatta(v);
      quandoCambia(v);
    });
    riga.appendChild(input);
    riga.aggiorna = function (v) {
      input.value = String(v);
      lettura.textContent = formatta(v);
    };
    return riga;
  }

  function costruisci() {
    svuota(contenitore);

    contenitore.appendChild(elemento("p", "guida",
      "Otto popolazioni identiche partono dalla stessa frequenza dell'allele A. " +
      "Nessuna è avvantaggiata: se si allontanano, è solo per caso."));

    var scatola = elemento("div", "scatola-grafico");
    tela = document.createElement("canvas");
    tela.className = "tela";
    tela.setAttribute("role", "img");
    tela.setAttribute("aria-label", "La frequenza dell'allele A in ogni popolazione, generazione dopo generazione");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    var letture = elemento("div", "letture");
    letture.appendChild(lettura("lettura-generazione", "generazione"));
    letture.appendChild(lettura("lettura-media", "frequenza media di A"));
    letture.appendChild(lettura("lettura-sparpagliamento", "quanto sono sparpagliate"));
    letture.appendChild(lettura("lettura-fissate", "fissate ad A / ad a"));
    letture.appendChild(lettura("lettura-hw", "AA · Aa · aa attesi (%)"));
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
    moto.id = "bottone-moto";
    moto.textContent = inMoto ? "⏸  Pausa" : "▶  Avvia";
    moto.addEventListener("click", function () {
      inMoto = !inMoto;
      moto.textContent = inMoto ? "⏸  Pausa" : "▶  Avvia";
    });
    riga.appendChild(moto);

    var unaSola = elemento("button", "bottone secondario", "+1 generazione");
    unaSola.type = "button";
    unaSola.addEventListener("click", function () { unaGenerazione(); disegna(); aggiornaLetture(); });
    riga.appendChild(unaSola);

    var reset = elemento("button", "bottone secondario", "↺  Ricomincia");
    reset.type = "button";
    reset.addEventListener("click", function () {
      inMoto = false;
      document.getElementById("bottone-moto").textContent = "▶  Avvia";
      azzera(); disegna(); aggiornaLetture();
    });
    riga.appendChild(reset);
    comandi.appendChild(riga);

    var cDimensione = cursore("Individui per popolazione", 10, 2000, 10, dimensione,
      function (v) { return v; },
      function (v) { dimensione = v; azzera(); });
    comandi.appendChild(cDimensione);

    var preset = elemento("div", "preset");
    preset.appendChild(elemento("span", "esempi-etichetta", "prova con:"));
    [["20, una popolazione minuscola", 20], ["50", 50], ["500", 500], ["2000, una popolazione grande", 2000]]
      .forEach(function (p) {
        var b = elemento("button", "bottone-esempio", p[0]);
        b.type = "button";
        b.addEventListener("click", function () {
          dimensione = p[1];
          cDimensione.aggiorna(p[1]);
          azzera();
        });
        preset.appendChild(b);
      });
    comandi.appendChild(preset);

    comandi.appendChild(cursore("Frequenza iniziale di A", 0.05, 0.95, 0.05, pIniziale,
      function (v) { return String(v).replace(".", ","); },
      function (v) { pIniziale = v; azzera(); }));

    comandi.appendChild(cursore("Vantaggio dell'allele A", -0.4, 0.4, 0.02, vantaggio,
      function (v) { return v === 0 ? "nessuno" : (v > 0 ? "+" : "") + Math.round(v * 100) + "%"; },
      function (v) { vantaggio = v; azzera(); }));

    comandi.appendChild(cursore("Mutazione per generazione", 0, 0.02, 0.001, mutazione,
      function (v) { return v === 0 ? "nessuna" : (v * 100).toFixed(1).replace(".", ",") + "%"; },
      function (v) { mutazione = v; azzera(); }));

    comandi.appendChild(cursore("Quante popolazioni", 1, 12, 1, quante,
      function (v) { return v; },
      function (v) { quante = v; azzera(); }));

    comandi.appendChild(cursore("Velocità", 1, 30, 1, velocita,
      function (v) { return v + " gen/s"; },
      function (v) { velocita = v; }));

    contenitore.appendChild(comandi);

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "I conti sono quelli veri della genetica di popolazioni: selezione, mutazione e campionamento binomiale dei gameti. Anche l'equilibrio di Hardy-Weinberg viene rispettato quando ci sono le sue condizioni.",
      "C'è un solo gene con due alleli. Un carattere vero dipende quasi sempre da molti geni insieme, e ogni gene può avere più di due alleli.",
      "Il vantaggio è codominante: l'eterozigote sta esattamente a metà fra i due omozigoti. Con la dominanza completa l'allele recessivo, quando è raro, resta nascosto negli eterozigoti e la selezione fatica a eliminarlo: è il motivo per cui le malattie recessive non spariscono.",
      "Le generazioni non si sovrappongono: tutti nascono, si riproducono e muoiono insieme. Nella realtà quasi mai.",
      "Gli accoppiamenti sono casuali e la popolazione non ha struttura: niente gruppi isolati, niente migrazione, niente scelta del partner.",
      "Oltre i mille individui il campionamento è calcolato con un'approssimazione invece che estrazione per estrazione: con quei numeri la differenza non si vede, ma è bene saperlo."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTela();
  }

  function adattaTela() {
    if (!tela || tela.parentNode.clientWidth <= 0) return;
    var dpr = window.devicePixelRatio || 1;
    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(330, Math.max(230, larghezza * 0.55)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () { adattaTela(); disegna(); });

  azzera();
  costruisci();
  disegna();
  aggiornaLetture();
  requestAnimationFrame(passo);

})();
