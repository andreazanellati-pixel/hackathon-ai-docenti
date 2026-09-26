/* ============================================================
   Il potenziale d'azione
   ------------------------------------------------------------
   Si dà una scossa al neurone e si guarda che cosa risponde.
   Sotto una certa soglia non succede niente; sopra, parte un
   impulso sempre identico a se stesso.

   Come funziona, in due parole:
   - il modello è quello vero di Hodgkin e Huxley del 1952,
     quello del premio Nobel: quattro equazioni che descrivono
     come si aprono e si chiudono i canali del sodio e del
     potassio. Non è una curva disegnata a mano
   - per questo il tutto-o-niente, la soglia e il periodo
     refrattario non sono programmati da nessuna parte: vengono
     fuori dalle equazioni, come vennero fuori a Hodgkin e
     Huxley
   - i quattro numeri dei canali stanno in condizioni.txt, e
     cambiandoli si riproducono l'anestetico del dentista, il
     veleno del pesce palla e il potassio alto nel sangue
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var CM = 1.0;              /* capacità della membrana, uF/cm2 */
  var GL = 0.3, EL = -54.387;
  var PASSO = 0.005;         /* millisecondi per passo di calcolo */
  var DURATA = 35;           /* millisecondi mostrati */

  /* ---------- stato ---------- */

  var condizioni = [], erroriFile = [];
  var condizione = null;
  var stimolo = 10;          /* microampere per cm2 */
  var durataStimolo = 0.5;   /* millisecondi */
  var secondoStimolo = 0;    /* dopo quanti ms arriva la seconda scossa, 0 = nessuna */
  var esperimentoScelto = 0;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaC = null, ctxC = null, larghezzaC = 0, altezzaC = 0;
  var letturaPicco = null, letturaSoglia = null, letturaEsito = null;
  var pastiglieCond = [], pastiglieEsp = [];
  var frase = null, schedaCond = null;
  var cursoreI = null, cursoreD = null, cursoreS = null;

  var traccia = null;        /* il risultato dell'ultima simulazione */

  /* ==========================================================
     1. Gli esperimenti già pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "Sotto la soglia",
      sottotitolo: "Una scossa debole: la membrana si muove appena e torna giù",
      condizione: "Neurone normale", stimolo: 11, durata: 0.5, secondo: 0
    },
    {
      titolo: "Sopra la soglia",
      sottotitolo: "Un pochino più forte, e parte tutto l'impulso",
      condizione: "Neurone normale", stimolo: 15, durata: 0.5, secondo: 0
    },
    {
      titolo: "Molto più forte",
      sottotitolo: "Sei volte la soglia: l'impulso è quasi identico a prima",
      condizione: "Neurone normale", stimolo: 80, durata: 0.5, secondo: 0
    },
    {
      titolo: "Due scosse ravvicinate",
      sottotitolo: "La seconda è fortissima e arriva dopo 5 ms: non serve lo stesso",
      condizione: "Neurone normale", stimolo: 80, durata: 0.5, secondo: 5
    },
    {
      titolo: "Quanto bisogna aspettare",
      sottotitolo: "Con una scossa da 20 servono 15 ms; con una da 40 ne bastano 12",
      condizione: "Neurone normale", stimolo: 20, durata: 0.5, secondo: 15
    },
    {
      titolo: "Dal dentista",
      sottotitolo: "Con l'anestetico non parte più niente, per quanto forte",
      condizione: "Anestetico locale", stimolo: 80, durata: 0.5, secondo: 0
    },
    {
      titolo: "Potassio alto nel sangue",
      sottotitolo: "La membrana parte già depolarizzata: il cuore rischia",
      condizione: "Potassio alto nel sangue", stimolo: 15, durata: 0.5, secondo: 0
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiCondizioni(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 6) {
        errori.push("riga " + (i + 1) + ": servono sei parti separate da | .");
        return;
      }
      var n = [numero(p[1]), numero(p[2]), numero(p[3]), numero(p[4])];
      var manca = false;
      n.forEach(function (v) { if (v === null) manca = true; });
      if (manca) {
        errori.push("riga " + (i + 1) + ": gNa, gK, ENa ed EK devono essere numeri.");
        return;
      }
      if (n[0] < 0 || n[1] < 0) {
        errori.push("riga " + (i + 1) + ": le conducibilità non possono essere negative.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        gNa: n[0], gK: n[1], eNa: n[2], eK: n[3],
        descrizione: p[5].trim()
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. Le equazioni di Hodgkin e Huxley
     ------------------------------------------------------------
     Tre "cancelli" regolano i canali: m e h quelli del sodio, n
     quelli del potassio. Ognuno si apre e si chiude con una sua
     rapidità, che dipende dal voltaggio del momento. Tutto il
     comportamento del neurone viene da qui.
     ========================================================== */

  /* una divisione che regge anche quando sopra e sotto vanno a
     zero insieme */
  function sicuro(sopra, sotto) {
    if (Math.abs(sotto) < 1e-7) return 1;
    return sopra / sotto;
  }

  function alfaN(v) { return 0.01 * sicuro(v + 55, 1 - Math.exp(-(v + 55) / 10)); }
  function betaN(v) { return 0.125 * Math.exp(-(v + 65) / 80); }
  function alfaM(v) { return 0.1 * sicuro(v + 40, 1 - Math.exp(-(v + 40) / 10)); }
  function betaM(v) { return 4 * Math.exp(-(v + 65) / 18); }
  function alfaH(v) { return 0.07 * Math.exp(-(v + 65) / 20); }
  function betaH(v) { return 1 / (1 + Math.exp(-(v + 35) / 10)); }

  /* Il punto di riposo: il voltaggio a cui la membrana si ferma
     quando non succede niente. Si trova lasciandola in pace. */
  function riposo() {
    var v = -65;
    var n = alfaN(v) / (alfaN(v) + betaN(v));
    var m = alfaM(v) / (alfaM(v) + betaM(v));
    var h = alfaH(v) / (alfaH(v) + betaH(v));
    for (var k = 0; k < 40000; k++) {
      var esito = unPasso(v, n, m, h, 0, PASSO);
      v = esito[0]; n = esito[1]; m = esito[2]; h = esito[3];
    }
    return { v: v, n: n, m: m, h: h };
  }

  function unPasso(v, n, m, h, corrente, dt) {
    var iNa = condizione.gNa * m * m * m * h * (v - condizione.eNa);
    var iK = condizione.gK * n * n * n * n * (v - condizione.eK);
    var iL = GL * (v - EL);
    var dv = (corrente - iNa - iK - iL) / CM;

    var nuovoV = v + dv * dt;
    var nuovoN = n + (alfaN(v) * (1 - n) - betaN(v) * n) * dt;
    var nuovoM = m + (alfaM(v) * (1 - m) - betaM(v) * m) * dt;
    var nuovoH = h + (alfaH(v) * (1 - h) - betaH(v) * h) * dt;

    return [nuovoV, Math.max(0, Math.min(1, nuovoN)),
      Math.max(0, Math.min(1, nuovoM)), Math.max(0, Math.min(1, nuovoH)), iNa, iK];
  }

  /* Fa correre la simulazione e restituisce tutto il tracciato. */
  function simula() {
    var partenza = riposo();
    var v = partenza.v, n = partenza.n, m = partenza.m, h = partenza.h;
    var punti = [];
    var correnti = [];
    var picco = v, minimo = v;
    var tempoPicco = 0;
    var piccoLibero = -200;
    var t = 0;

    while (t <= DURATA) {
      var corrente = 0;
      if (t >= 2 && t < 2 + durataStimolo) corrente = stimolo;
      if (secondoStimolo > 0 && t >= 2 + secondoStimolo && t < 2 + secondoStimolo + durataStimolo) {
        corrente = stimolo;
      }

      var esito = unPasso(v, n, m, h, corrente, PASSO);
      v = esito[0]; n = esito[1]; m = esito[2]; h = esito[3];
      if (!isFinite(v)) { v = partenza.v; break; }

      if (v > picco) { picco = v; tempoPicco = t; }
      if (v < minimo) minimo = v;

      /* Il voltaggio più alto raggiunto quando NESSUNA corrente
         sta spingendo, e dopo che la scossa è finita da un pezzo.
         È questo che distingue un impulso vero, che si alimenta
         da solo, da una membrana alzata di forza dalla corrente. */
      if (corrente === 0 && t > 2 + durataStimolo + 0.5 && v > piccoLibero) piccoLibero = v;

      /* si registra un punto ogni 0,05 ms: basta e avanza */
      if (punti.length === 0 || t - punti[punti.length - 1].t >= 0.05) {
        punti.push({ t: t, v: v, n: n, m: m, h: h, iNa: esito[4], iK: esito[5], stim: corrente });
      }
      t += PASSO;
    }

    /* Un impulso vero si riconosce perché si alimenta da solo:
       il voltaggio continua a salire DOPO che la scossa è finita,
       e supera lo zero. Senza questo controllo, una corrente
       enorme che alza la membrana di forza sembrerebbe un impulso
       anche con i canali del sodio bloccati - e non lo è. */
    return {
      punti: punti, picco: picco, minimo: minimo,
      tempoPicco: tempoPicco,
      riposo: partenza.v,
      partito: piccoLibero > 0
    };
  }

  /* La soglia: la corrente più piccola che fa partire l'impulso.
     Si cerca dimezzando l'intervallo, non è scritta da nessuna
     parte. */
  function cercaSoglia() {
    var memoriaI = stimolo, memoriaS = secondoStimolo;
    secondoStimolo = 0;
    stimolo = 200;
    if (!simula().partito) {
      stimolo = memoriaI; secondoStimolo = memoriaS;
      return null;
    }
    var basso = 0, alto = 200;
    for (var k = 0; k < 16; k++) {
      stimolo = (basso + alto) / 2;
      if (simula().partito) alto = stimolo; else basso = stimolo;
    }
    var soglia = alto;
    stimolo = memoriaI; secondoStimolo = memoriaS;
    return soglia;
  }

  /* ==========================================================
     4. Il grafico del voltaggio
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegnaTraccia() {
    if (!ctx || larghezza <= 0 || !traccia) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezza, altezza);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var accento = coloreTema("--accento", "#1f5f8b");

    var sx = 46, dx = 14, su = 14, giu = 32;
    var w = larghezza - sx - dx, h = altezza - su - giu;

    function X(t) { return sx + w * t / DURATA; }
    function Y(v) { return su + h * (60 - v) / 160; }

    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var v = -100; v <= 60; v += 40) {
      c.beginPath(); c.moveTo(sx, Y(v)); c.lineTo(sx + w, Y(v)); c.stroke();
      c.fillText(v + " mV", sx - 4, Y(v) + 3);
    }
    c.textAlign = "center";
    for (var t = 0; t <= DURATA; t += 5) {
      c.beginPath(); c.moveTo(X(t), su); c.lineTo(X(t), su + h); c.stroke();
      c.fillText(String(t), X(t), su + h + 14);
    }
    c.fillText("millisecondi", sx + w / 2, altezza - 4);

    /* la riga del riposo */
    c.strokeStyle = tenue; c.setLineDash([4, 4]); c.lineWidth = 1;
    c.beginPath(); c.moveTo(sx, Y(traccia.riposo)); c.lineTo(sx + w, Y(traccia.riposo)); c.stroke();
    c.setLineDash([]);
    c.fillStyle = tenue; c.textAlign = "left"; c.font = "9px system-ui, sans-serif";
    c.fillText("riposo " + Math.round(traccia.riposo) + " mV", sx + 4, Y(traccia.riposo) - 3);

    /* quando arriva la scossa */
    c.fillStyle = "rgba(220, 170, 60, 0.35)";
    c.fillRect(X(2), su, Math.max(1.5, X(2 + durataStimolo) - X(2)), h);
    if (secondoStimolo > 0) {
      c.fillRect(X(2 + secondoStimolo), su,
        Math.max(1.5, X(durataStimolo) - X(0)), h);
    }

    /* il tracciato */
    c.strokeStyle = accento; c.lineWidth = 2.6;
    c.beginPath();
    traccia.punti.forEach(function (p, i) {
      if (i === 0) c.moveTo(X(p.t), Y(p.v)); else c.lineTo(X(p.t), Y(p.v));
    });
    c.stroke();

    /* il picco */
    if (traccia.partito) {
      c.fillStyle = "#c06a28";
      c.font = "600 10px system-ui, sans-serif";
      c.textAlign = "left";
      c.fillText("picco " + Math.round(traccia.picco) + " mV", sx + 6, su + 12);
    }
  }

  /* ==========================================================
     5. Il grafico dei canali
     ========================================================== */

  function disegnaCanali() {
    if (!ctxC || larghezzaC <= 0 || !traccia) return;
    var c = ctxC;
    c.clearRect(0, 0, larghezzaC, altezzaC);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaC, altezzaC);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");

    var sx = 40, dx = 14, su = 14, giu = 32;
    var w = larghezzaC - sx - dx, h = altezzaC - su - giu;

    function X(t) { return sx + w * t / DURATA; }
    function Y(q) { return su + h * (1 - q); }

    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var q = 0; q <= 1; q += 0.25) {
      c.beginPath(); c.moveTo(sx, Y(q)); c.lineTo(sx + w, Y(q)); c.stroke();
      c.fillText(Math.round(q * 100) + "%", sx - 4, Y(q) + 3);
    }
    c.textAlign = "center";
    for (var t = 0; t <= DURATA; t += 5) {
      c.beginPath(); c.moveTo(X(t), su); c.lineTo(X(t), su + h); c.stroke();
      c.fillText(String(t), X(t), su + h + 14);
    }
    c.fillText("millisecondi", sx + w / 2, altezzaC - 4);

    [["m", "#c04a3a", "sodio: apre"], ["h", "#7a6fb0", "sodio: chiude"], ["n", "#3f8f5f", "potassio: apre"]]
      .forEach(function (canale, k) {
        c.strokeStyle = canale[1]; c.lineWidth = 2.2;
        c.beginPath();
        traccia.punti.forEach(function (p, i) {
          if (i === 0) c.moveTo(X(p.t), Y(p[canale[0]])); else c.lineTo(X(p.t), Y(p[canale[0]]));
        });
        c.stroke();
        c.fillStyle = canale[1];
        c.font = "600 9px system-ui, sans-serif";
        c.textAlign = "left";
        c.fillText(canale[2], sx + 4 + k * 78, 10);
      });
  }

  /* ==========================================================
     6. Le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

  function racconta(soglia) {
    if (soglia === null) {
      return "Qui non parte niente, per quanto forte sia la scossa. Con i canali del sodio bloccati " +
        "la membrana non ha modo di innescare la reazione a catena: ogni stimolo la sposta un po' e " +
        "poi si spegne. È esattamente quello che fa l'anestetico del dentista, e in modo totale il " +
        "veleno del pesce palla.";
    }

    if (secondoStimolo > 0) {
      return "Due scosse identiche, la seconda dopo " + conVirgola(secondoStimolo) + " millisecondi. " +
        "Guarda se parte un secondo impulso oppure no. Subito dopo il primo, per qualche millisecondo, " +
        "non parte proprio niente per quanto si insista: i cancelli che chiudono il sodio sono ancora " +
        "abbassati e finché non si rialzano non c'è scossa che tenga. Poi viene un periodo in cui " +
        "riparte, ma solo con uno stimolo più forte del solito. È il periodo refrattario, ed è il " +
        "motivo per cui un neurone non può sparare all'infinito. Prova questo: con la scossa a 20 " +
        "servono quindici millisecondi, con la scossa a 40 ne bastano dodici. La soglia non è fissa: " +
        "si rialza dopo ogni impulso e poi torna giù piano.";
    }

    if (soglia < 0.05) {
      return "Attenzione: qui la membrana parte da sola, senza che nessuno la stimoli. Sta già a " +
        Math.round(traccia.riposo) + " millivolt invece dei soliti meno 65, cioè è già oltre la " +
        "soglia. È quello che succede quando nel sangue il potassio si alza troppo, e non è una " +
        "buona notizia: le cellule del cuore cominciano a contrarsi quando non dovrebbero. " +
        "L'iperpotassiemia grave è una delle emergenze più serie che ci siano.";
    }

    if (!traccia.partito) {
      return "La scossa è troppo debole: la membrana si solleva un poco e poi ricade da sola. Sotto " +
        "la soglia i canali del sodio che si aprono sono troppo pochi, e il potassio che esce fa in " +
        "tempo a rimettere tutto a posto. Con questa membrana la soglia sta a " +
        conVirgola(arrotonda(soglia, 1)) + ": provala.";
    }

    return "Sopra la soglia parte la reazione a catena: il sodio che entra depolarizza, e la " +
      "depolarizzazione apre altri canali del sodio, che fanno entrare altro sodio. In un millisecondo " +
      "si arriva a " + Math.round(traccia.picco) + " millivolt. Poi il sodio si chiude da solo e il " +
      "potassio esce, riportando tutto giù e anche un po' sotto. " +
      "Adesso guarda la cosa importante. Fra una scossa appena sotto la soglia e una appena sopra la " +
      "differenza è di pochi per cento, ma la risposta passa da niente a un salto di più di cento " +
      "millivolt. Se invece la scossa la rendi sei volte più forte, il picco sale sì e no di qualche " +
      "millivolt. È il tutto-o-niente, e non è una regola imparata a memoria: viene fuori da solo " +
      "dalle equazioni, come venne fuori a Hodgkin e Huxley.";
  }

  /* ==========================================================
     7. La pagina
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
      lettura.textContent = (v === 0 && unita === "ms dopo" ? "nessuna" : conVirgola(v) + " " + unita);
      quandoCambia(v);
    });
    riga.appendChild(input);
    riga.aggiorna = function (v) {
      input.value = String(v);
      lettura.textContent = (v === 0 && unita === "ms dopo" ? "nessuna" : conVirgola(v) + " " + unita);
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

  function aggiorna() {
    traccia = simula();
    var soglia = cercaSoglia();

    letturaPicco.textContent = traccia.partito ? Math.round(traccia.picco) + " mV" : "niente impulso";
    letturaSoglia.textContent = soglia === null ? "non parte mai"
      : (soglia < 0.05 ? "parte da sola" : conVirgola(arrotonda(soglia, 1)) + " µA/cm²");
    letturaEsito.textContent = Math.round(traccia.riposo) + " mV";

    pastiglieCond.forEach(function (b) {
      b.className = "pillola" + (b.dato === condizione ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    frase.textContent = racconta(soglia);
    schedaCond.textContent = condizione.descrizione.charAt(0).toUpperCase() +
      condizione.descrizione.slice(1) + ". Sodio " + conVirgola(condizione.gNa) + ", potassio " +
      conVirgola(condizione.gK) + "; equilibrio del sodio " + conVirgola(condizione.eNa) +
      " mV, del potassio " + conVirgola(condizione.eK) + " mV.";

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegnaTraccia();
    disegnaCanali();
  }

  function applicaEsperimento(x) {
    var c = condizioni.filter(function (y) { return y.nome === x.condizione; })[0];
    if (c) condizione = c;
    stimolo = x.stimolo;
    durataStimolo = x.durata;
    secondoStimolo = x.secondo;
    if (cursoreI) cursoreI.aggiorna(stimolo);
    if (cursoreD) cursoreD.aggiorna(durataStimolo);
    if (cursoreS) cursoreS.aggiorna(secondoStimolo);
    aggiorna();
  }

  function costruisci() {
    svuota(contenitore);
    pastiglieCond = []; pastiglieEsp = [];

    var avvisoErrori = App.avvisoErroriFile("condizioni.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Un neurone non manda segnali più forti quando la notizia è importante: manda sempre lo stesso " +
      "identico impulso, o non lo manda affatto. Quello che cambia è quanti ne manda al secondo. " +
      "Qui puoi dargli scosse di forza diversa e verificarlo."));

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

    var scatola = elemento("div", "scatola-grafico");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("il picco arriva a", function (n) { letturaPicco = n; }));
    letture.appendChild(unaLettura("soglia di questa membrana", function (n) { letturaSoglia = n; }));
    letture.appendChild(unaLettura("a riposo sta a", function (n) { letturaEsito = n; }));
    contenitore.appendChild(letture);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Che cosa fanno i canali"));
    var scatolaC = elemento("div", "scatola-grafico");
    telaC = elemento("canvas", "tela");
    scatolaC.appendChild(telaC);
    contenitore.appendChild(scatolaC);
    contenitore.appendChild(elemento("p", "nota-piccola",
      "Ogni canale del sodio ha due cancelli: uno che apre in fretta, in rosso, e uno che chiude " +
      "piano, in viola. All'inizio apre il primo e il sodio entra; poi il secondo si abbassa e lo " +
      "ferma, anche se il primo è ancora aperto. Intanto il potassio, in verde, si è svegliato e " +
      "riporta tutto giù. Il periodo refrattario è il tempo che serve al cancello viola per " +
      "rialzarsi: guarda quanto ci mette a tornare in alto."));

    contenitore.appendChild(elemento("h3", "titolo-blocco", "La scossa"));
    var comandi = elemento("div", "comandi");
    cursoreI = cursore("Quanto forte", 0, 80, 0.5, stimolo, "µA/cm²", function (v) {
      stimolo = v; esperimentoScelto = -1; aggiorna();
    });
    cursoreD = cursore("Per quanto tempo", 0.1, 3, 0.1, durataStimolo, "ms", function (v) {
      durataStimolo = v; esperimentoScelto = -1; aggiorna();
    });
    cursoreS = cursore("Una seconda scossa", 0, 20, 0.5, secondoStimolo, "ms dopo", function (v) {
      secondoStimolo = v; esperimentoScelto = -1; aggiorna();
    });
    comandi.appendChild(cursoreI);
    comandi.appendChild(cursoreD);
    comandi.appendChild(cursoreS);
    contenitore.appendChild(comandi);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "In che condizioni è la membrana"));
    var scelte = elemento("div", "scelte-grandezza");
    condizioni.forEach(function (c) {
      var b = elemento("button", "pillola", c.nome);
      b.type = "button"; b.dato = c;
      b.addEventListener("click", function () { condizione = c; esperimentoScelto = -1; aggiorna(); });
      pastiglieCond.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);
    schedaCond = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaCond);

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Le equazioni sono quelle originali di Hodgkin e Huxley, ricavate nel 1952 misurando l'assone gigante del calamaro a 6 gradi. Un neurone umano a 37 gradi ha impulsi più rapidi, e canali di più tipi.",
      "Si guarda un pezzetto di membrana fermo, non un assone intero: qui l'impulso non viaggia. Nella realtà si propaga, e la guaina mielinica lo fa saltare da un nodo all'altro moltiplicando la velocità per cinquanta.",
      "La pompa sodio-potassio non compare. È lei che mantiene le concentrazioni ai due lati, consumando una fetta enorme dell'energia del corpo, ma su tempi di millisecondi il suo effetto diretto è piccolo.",
      "Ci sono solo due tipi di canale, sodio e potassio, più una perdita generica. I neuroni veri ne hanno decine di tipi diversi, ed è per quello che si comportano in modi così diversi fra loro.",
      "Le condizioni alterate del file - anestetico, veleno, potassio alto - sono rese cambiando un solo numero. Nella realtà un farmaco agisce in modo più complicato, per esempio solo sui canali già aperti.",
      "Il modello dice come risponde la membrana, non che cosa significhi il segnale. L'informazione sta nel ritmo degli impulsi e in quali neuroni li mandano, e questo è un altro discorso."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    aggiorna();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(300, Math.max(220, larghezza * 0.55)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaC = telaC.parentNode.clientWidth;
    altezzaC = Math.round(Math.min(240, Math.max(180, larghezzaC * 0.44)));
    telaC.width = larghezzaC * dpr; telaC.height = altezzaC * dpr;
    telaC.style.width = larghezzaC + "px"; telaC.style.height = altezzaC + "px";
    ctxC = telaC.getContext("2d");
    ctxC.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegnaTraccia(); disegnaCanali();
  });

  /* ==========================================================
     8. Avvio
     ========================================================== */

  App.caricaTesto("condizioni.txt")
    .then(function (testo) {
      var esito = leggiCondizioni(testo);
      condizioni = esito.elenco;
      erroriFile = esito.errori;

      if (!condizioni.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file condizioni.txt è stato letto ma non contiene condizioni valide."));
        contenitore.appendChild(avviso);
        return;
      }

      condizione = condizioni[0];
      costruisci();
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("condizioni.txt", errore.message));
    });

})();
