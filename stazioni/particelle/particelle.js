/* ============================================================
   Le particelle e gli stati della materia
   ------------------------------------------------------------
   Un contenitore di particelle da scaldare e raffreddare.
   Mentre il riscaldatore lavora, la temperatura sale e si ferma
   durante i passaggi di stato: la curva di riscaldamento si
   disegna da sola, con i suoi plateau.

   Come funziona, in due parole:
   - la parte termodinamica e' calcolata con i numeri veri della
     sostanza, letti da sostanze.txt (calori specifici e latenti)
   - le particelle sul canvas mostrano lo stato corrispondente:
     vibrano al loro posto nel solido, scorrono nel liquido,
     volano libere nel gas
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  /* ---------- stato ---------- */

  var sostanze = [];
  var erroriFile = [];
  var sostanza = null;

  var massa = 0.1;          /* kg */
  var potenza = 200;        /* watt, negativa raffredda */
  var velocita = 20;        /* quante volte piu' veloce del tempo reale */
  var inMoto = false;

  var energia = 0;          /* joule forniti finora, puo' essere negativa */
  var storia = [];          /* punti { e, t } per il grafico */

  var particelle = [];
  var NUMERO = 150;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaGrafico = null, ctxGrafico = null, larghezzaG = 0, altezzaG = 0;
  var ultimoIstante = 0;

  /* ==========================================================
     1. Lettura di sostanze.txt
     ========================================================== */

  var NUMERICHE = {
    "fusione": "fusione",
    "ebollizione": "ebollizione",
    "partenza": "partenza",
    "calore solido": "cSolido",
    "calore liquido": "cLiquido",
    "calore gas": "cGas",
    "latente fusione": "lFusione",
    "latente vaporizzazione": "lVaporizzazione"
  };
  var TESTUALI = { "nome": "nome", "formula": "formula", "colore": "colore", "nota": "nota" };

  function leggiSostanze(testo) {
    var elenco = [];
    var errori = [];
    var righe = testo.split(/\r?\n/);
    var s = null;
    var ultimaChiave = null;

    for (var i = 0; i < righe.length; i++) {
      var numeroRiga = i + 1;
      var riga = righe[i].trim();
      if (riga === "" || riga.charAt(0) === "#") continue;

      if (riga.toUpperCase() === "[SOSTANZA]") {
        s = { nome: "", formula: "", colore: "#3f8fd0", nota: "" };
        elenco.push(s);
        ultimaChiave = null;
        continue;
      }

      var duePunti = riga.indexOf(":");
      if (duePunti > 0) {
        var chiave = riga.substring(0, duePunti).trim().toLowerCase();
        var valore = riga.substring(duePunti + 1).trim();

        if (NUMERICHE[chiave]) {
          if (!s) { errori.push("riga " + numeroRiga + ": valore prima di [SOSTANZA]."); continue; }
          var n = parseFloat(valore.replace(",", "."));
          if (isNaN(n)) {
            errori.push("riga " + numeroRiga + ": \"" + valore + "\" non è un numero.");
            continue;
          }
          s[NUMERICHE[chiave]] = n;
          ultimaChiave = null;
          continue;
        }
        if (TESTUALI[chiave]) {
          if (!s) { errori.push("riga " + numeroRiga + ": valore prima di [SOSTANZA]."); continue; }
          s[TESTUALI[chiave]] = valore;
          ultimaChiave = TESTUALI[chiave];
          continue;
        }
      }

      if (s && ultimaChiave) { s[ultimaChiave] = (s[ultimaChiave] + " " + riga).trim(); continue; }
      errori.push("riga " + numeroRiga + ": non ho capito \"" + riga.slice(0, 40) + "\". La salto.");
    }

    var buone = [];
    elenco.forEach(function (x) {
      var mancanti = [];
      ["fusione", "ebollizione", "cSolido", "cLiquido", "cGas", "lFusione", "lVaporizzazione"]
        .forEach(function (k) { if (typeof x[k] !== "number") mancanti.push(k); });
      if (!x.nome) { errori.push("Una sostanza è senza nome: l'ho saltata."); return; }
      if (mancanti.length > 0) {
        errori.push("« " + x.nome + " » non ha tutti i dati necessari: l'ho saltata.");
        return;
      }
      if (x.ebollizione <= x.fusione) {
        errori.push("« " + x.nome + " » ha l'ebollizione sotto la fusione: l'ho saltata.");
        return;
      }
      if (typeof x.partenza !== "number") x.partenza = x.fusione - 30;
      buone.push(x);
    });

    return { sostanze: buone, errori: errori };
  }

  /* ==========================================================
     2. La termodinamica
     ----------------------------------------------------------
     Dall'energia fornita si ricava la temperatura. Le soglie
     sono le energie necessarie per arrivare a ogni tappa:
       s1  fine riscaldamento del solido (si arriva alla fusione)
       s2  fine della fusione (tutto liquido)
       s3  fine riscaldamento del liquido (si arriva all'ebollizione)
       s4  fine dell'ebollizione (tutto gas)
     ========================================================== */

  function soglie() {
    var s = sostanza;
    var s1 = massa * s.cSolido * (s.fusione - s.partenza);
    var s2 = s1 + massa * s.lFusione;
    var s3 = s2 + massa * s.cLiquido * (s.ebollizione - s.fusione);
    var s4 = s3 + massa * s.lVaporizzazione;
    return { s1: s1, s2: s2, s3: s3, s4: s4 };
  }

  /* quanta energia si puo' ancora fornire prima di fermarsi */
  function energiaMassima() {
    var g = soglie();
    return g.s4 + massa * sostanza.cGas * (sostanza.ebollizione - sostanza.fusione) * 0.6;
  }

  function energiaMinima() {
    /* non si scende sotto lo zero assoluto */
    return -massa * sostanza.cSolido * (sostanza.partenza + 273.15);
  }

  function situazione(e) {
    var s = sostanza;
    var g = soglie();

    if (e < 0) {
      return { temperatura: s.partenza + e / (massa * s.cSolido), fase: "solido", frazione: 0 };
    }
    if (e < g.s1) {
      return { temperatura: s.partenza + e / (massa * s.cSolido), fase: "solido", frazione: 0 };
    }
    if (e < g.s2) {
      return { temperatura: s.fusione, fase: "fusione", frazione: (e - g.s1) / (g.s2 - g.s1) };
    }
    if (e < g.s3) {
      return { temperatura: s.fusione + (e - g.s2) / (massa * s.cLiquido), fase: "liquido", frazione: 0 };
    }
    if (e < g.s4) {
      return { temperatura: s.ebollizione, fase: "ebollizione", frazione: (e - g.s3) / (g.s4 - g.s3) };
    }
    return { temperatura: s.ebollizione + (e - g.s4) / (massa * s.cGas), fase: "gas", frazione: 1 };
  }

  var NOMI_FASE = {
    solido: "solido",
    fusione: "sta fondendo",
    liquido: "liquido",
    ebollizione: "sta bollendo",
    gas: "gas"
  };

  /* quanta parte della sostanza si comporta da liquido/gas, da 0 a 1 */
  function quotaLiquida(sit) {
    if (sit.fase === "solido") return 0;
    if (sit.fase === "fusione") return sit.frazione;
    return 1;
  }
  function quotaGas(sit) {
    if (sit.fase === "gas") return 1;
    if (sit.fase === "ebollizione") return sit.frazione;
    return 0;
  }

  /* ==========================================================
     3. Le particelle
     ========================================================== */

  function creaParticelle() {
    particelle = [];
    var colonne = Math.ceil(Math.sqrt(NUMERO * 1.6));
    var righe = Math.ceil(NUMERO / colonne);
    for (var i = 0; i < NUMERO; i++) {
      var c = i % colonne;
      var r = Math.floor(i / colonne);
      particelle.push({
        /* posizione a riposo nel reticolo del solido, in frazioni del contenitore */
        rx: 0.18 + 0.64 * (colonne === 1 ? 0.5 : c / (colonne - 1)),
        ry: 0.97 - 0.30 * (righe === 1 ? 0 : r / (righe - 1)),
        x: 0, y: 0, vx: 0, vy: 0,
        stato: "solido",
        seme: Math.random() * Math.PI * 2
      });
    }
    /* posizione iniziale: tutte al loro posto nel reticolo */
    particelle.forEach(function (p) { p.x = p.rx * larghezza; p.y = p.ry * altezza; });
  }

  /* decide quante particelle sono liquide e quante gassose */
  function assegnaStati(sit) {
    var nGas = Math.round(quotaGas(sit) * NUMERO);
    var nLiquide = Math.round(quotaLiquida(sit) * NUMERO) - nGas;
    if (nLiquide < 0) nLiquide = 0;
    for (var i = 0; i < NUMERO; i++) {
      /* le particelle piu' in alto passano di stato per prime:
         e' cosi' che si vede il fronte di fusione salire */
      if (i >= NUMERO - nGas) particelle[i].stato = "gas";
      else if (i >= NUMERO - nGas - nLiquide) particelle[i].stato = "liquido";
      else particelle[i].stato = "solido";
    }
  }

  function aggiornaParticelle(dt, sit) {
    var kelvin = Math.max(1, sit.temperatura + 273.15);
    var kelvinFusione = Math.max(1, sostanza.fusione + 273.15);
    var agitazione = Math.sqrt(kelvin / kelvinFusione);   /* quanto sono veloci */
    var raggio = 5;

    for (var i = 0; i < NUMERO; i++) {
      var p = particelle[i];

      if (p.stato === "solido") {
        /* vibra intorno al suo posto: piu' e' caldo, piu' l'oscillazione e' ampia */
        var ampiezza = Math.min(6, 1.4 * agitazione * agitazione);
        p.seme += dt * 9 * agitazione;
        p.x = p.rx * larghezza + Math.cos(p.seme * 1.7) * ampiezza;
        p.y = p.ry * altezza + Math.sin(p.seme * 2.3) * ampiezza;
        p.vx = 0; p.vy = 0;

      } else if (p.stato === "liquido") {
        /* cade, si respinge dalle vicine e perde energia: si accumula sul fondo */
        p.vy += 260 * dt;
        p.vx += (Math.random() - 0.5) * 120 * agitazione * dt;
        p.vy += (Math.random() - 0.5) * 120 * agitazione * dt;
        p.vx *= 0.93; p.vy *= 0.93;
        muovi(p, dt, raggio);

      } else {
        /* vola libera: la velocita' cresce come la radice della temperatura */
        var velocitaTipica = 26 * Math.sqrt(kelvin / kelvinFusione);
        var modulo = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (modulo < 1) {
          var angolo = Math.random() * Math.PI * 2;
          p.vx = Math.cos(angolo) * velocitaTipica * 8;
          p.vy = Math.sin(angolo) * velocitaTipica * 8;
        } else {
          var obiettivo = velocitaTipica * 8;
          var correzione = 1 + (obiettivo - modulo) / modulo * Math.min(1, dt * 2);
          p.vx *= correzione; p.vy *= correzione;
        }
        muovi(p, dt, raggio);
      }
    }

    /* repulsione morbida fra particelle vicine, cosi' non si sovrappongono */
    for (var a = 0; a < NUMERO; a++) {
      var pa = particelle[a];
      if (pa.stato === "solido") continue;
      for (var b = a + 1; b < NUMERO; b++) {
        var pb = particelle[b];
        if (pb.stato === "solido") continue;
        var dx = pb.x - pa.x, dy = pb.y - pa.y;
        var d2 = dx * dx + dy * dy;
        var minimo = raggio * 2.2;
        if (d2 > 0.01 && d2 < minimo * minimo) {
          var d = Math.sqrt(d2);
          var spinta = (minimo - d) / 2;
          var ux = dx / d, uy = dy / d;
          pa.x -= ux * spinta; pa.y -= uy * spinta;
          pb.x += ux * spinta; pb.y += uy * spinta;
        }
      }
    }
  }

  function muovi(p, dt, raggio) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < raggio) { p.x = raggio; p.vx = Math.abs(p.vx); }
    if (p.x > larghezza - raggio) { p.x = larghezza - raggio; p.vx = -Math.abs(p.vx); }
    if (p.y < raggio) { p.y = raggio; p.vy = Math.abs(p.vy); }
    if (p.y > altezza - raggio) { p.y = altezza - raggio; p.vy = -Math.abs(p.vy) * 0.7; }
  }

  /* ==========================================================
     4. Disegno
     ========================================================== */

  function coloreTema(nome, chiaro, scuro) {
    var stile = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return stile || chiaro || scuro;
  }

  function disegnaContenitore(sit) {
    ctx.clearRect(0, 0, larghezza, altezza);

    /* il fondo del contenitore */
    ctx.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    ctx.fillRect(0, 0, larghezza, altezza);

    /* le particelle */
    for (var i = 0; i < NUMERO; i++) {
      var p = particelle[i];
      var raggio = p.stato === "gas" ? 3.6 : 5;
      ctx.globalAlpha = p.stato === "gas" ? 0.75 : 1;
      ctx.fillStyle = sostanza.colore;
      ctx.beginPath();
      ctx.arc(p.x, p.y, raggio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* la fiamma o il ghiaccio del riscaldatore, in basso */
    if (potenza !== 0) {
      var caldo = potenza > 0;
      ctx.fillStyle = caldo ? "rgba(214,120,40,.85)" : "rgba(80,150,210,.85)";
      var quanti = Math.min(9, 2 + Math.round(Math.abs(potenza) / 120));
      for (var f = 0; f < quanti; f++) {
        var fx = larghezza * (f + 0.5) / quanti;
        ctx.beginPath();
        ctx.moveTo(fx - 7, altezza);
        ctx.lineTo(fx, altezza - 9 - Math.random() * 7);
        ctx.lineTo(fx + 7, altezza);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function disegnaGrafico(sit) {
    var c = ctxGrafico;
    c.clearRect(0, 0, larghezzaG, altezzaG);

    var margineS = 46, margineD = 12, margineA = 12, margineB = 30;
    var w = larghezzaG - margineS - margineD;
    var h = altezzaG - margineA - margineB;

    /* Gli assi si adattano a quello che si e' davvero percorso: se
       partissero sempre dallo zero assoluto, la curva finirebbe
       schiacciata in un angolo del grafico. */
    var eMin = 0, eMax = energiaMassima();
    var tMinVisto = sostanza.partenza, tMaxVisto = sostanza.partenza;
    for (var k = 0; k < storia.length; k++) {
      if (storia[k].e < eMin) eMin = storia[k].e;
      if (storia[k].t < tMinVisto) tMinVisto = storia[k].t;
      if (storia[k].t > tMaxVisto) tMaxVisto = storia[k].t;
    }
    if (energia < eMin) eMin = energia;
    if (sit.temperatura < tMinVisto) tMinVisto = sit.temperatura;
    if (sit.temperatura > tMaxVisto) tMaxVisto = sit.temperatura;

    var tMin = Math.min(sostanza.partenza, tMinVisto) - 15;
    var tMax = Math.max(
      sostanza.ebollizione + (sostanza.ebollizione - sostanza.fusione) * 0.5,
      tMaxVisto
    ) + 15;
    function px(e) { return margineS + (e - eMin) / (eMax - eMin) * w; }
    function py(t) { return margineA + h - (t - tMin) / (tMax - tMin) * h; }

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var bordo = coloreTema("--bordo", "#ddd6c9");
    var accento = coloreTema("--accento", "#1f5f8b");

    /* le due temperature notevoli */
    c.strokeStyle = bordo;
    c.setLineDash([4, 4]);
    c.lineWidth = 1;
    [sostanza.fusione, sostanza.ebollizione].forEach(function (t) {
      c.beginPath(); c.moveTo(margineS, py(t)); c.lineTo(margineS + w, py(t)); c.stroke();
    });
    c.setLineDash([]);

    /* assi */
    c.strokeStyle = tenue;
    c.beginPath();
    c.moveTo(margineS, margineA); c.lineTo(margineS, margineA + h); c.lineTo(margineS + w, margineA + h);
    c.stroke();

    /* etichette */
    c.fillStyle = tenue;
    c.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.textAlign = "right";
    c.fillText(Math.round(sostanza.fusione) + "°", margineS - 5, py(sostanza.fusione) + 4);
    c.fillText(Math.round(sostanza.ebollizione) + "°", margineS - 5, py(sostanza.ebollizione) + 4);
    c.textAlign = "center";
    c.fillText("energia fornita →", margineS + w / 2, altezzaG - 8);

    /* la curva percorsa finora */
    if (storia.length > 1) {
      c.strokeStyle = accento;
      c.lineWidth = 2.5;
      c.beginPath();
      for (var i = 0; i < storia.length; i++) {
        var x = px(storia[i].e), y = py(storia[i].t);
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }

    /* il punto in cui siamo adesso */
    c.fillStyle = accento;
    c.beginPath();
    c.arc(px(energia), py(sit.temperatura), 4.5, 0, Math.PI * 2);
    c.fill();
  }

  /* ==========================================================
     5. Il ciclo dell'animazione
     ========================================================== */

  function passo(istante) {
    if (!ultimoIstante) ultimoIstante = istante;
    var dt = Math.min(0.05, (istante - ultimoIstante) / 1000);
    ultimoIstante = istante;

    if (inMoto) {
      var nuova = energia + potenza * velocita * dt;
      var tetto = energiaMassima(), pavimento = energiaMinima();
      if (nuova > tetto) { nuova = tetto; fermati(); }
      if (nuova < pavimento) { nuova = pavimento; fermati(); }
      energia = nuova;

      var ultimo = storia[storia.length - 1];
      if (!ultimo || Math.abs(energia - ultimo.e) > (tetto - pavimento) / 400) {
        storia.push({ e: energia, t: situazione(energia).temperatura });
        if (storia.length > 3000) storia.shift();
      }
    }

    unFotogramma(dt);

    requestAnimationFrame(passo);
  }

  /* Disegna un fotogramma. Sta in una funzione a parte perche' serve
     anche subito dopo il caricamento e a ogni cambio di sostanza: cosi'
     la pagina e' gia' corretta prima che parta l'animazione. */
  function unFotogramma(dt) {
    var sit = situazione(energia);
    assegnaStati(sit);
    aggiornaParticelle(dt, sit);
    disegnaContenitore(sit);
    disegnaGrafico(sit);
    aggiornaLetture(sit);
  }

  function fermati() {
    inMoto = false;
    var b = document.getElementById("bottone-moto");
    if (b) b.textContent = "▶  Avvia";
  }

  /* ==========================================================
     6. La pagina
     ========================================================== */

  function aggiornaLetture(sit) {
    scrivi("lettura-temperatura", arrotonda(sit.temperatura, 1) + " °C");
    scrivi("lettura-kelvin", arrotonda(sit.temperatura + 273.15, 1) + " K");
    scrivi("lettura-fase", NOMI_FASE[sit.fase]);
    scrivi("lettura-energia", arrotonda(energia / 1000, 1) + " kJ");

    var riquadro = document.getElementById("riquadro-fase");
    if (riquadro) {
      var inPassaggio = sit.fase === "fusione" || sit.fase === "ebollizione";
      riquadro.classList.toggle("in-passaggio", inPassaggio);
    }
    var spiega = document.getElementById("spiegazione-fase");
    if (spiega) {
      if (sit.fase === "fusione") {
        spiega.textContent = "L'energia che arriva non alza la temperatura: serve tutta a slegare le particelle. Ecco il primo plateau, al " +
          Math.round(sit.frazione * 100) + "% della fusione.";
      } else if (sit.fase === "ebollizione") {
        spiega.textContent = "Di nuovo la temperatura è ferma: l'energia sta staccando le particelle una dall'altra. Ecco il secondo plateau, al " +
          Math.round(sit.frazione * 100) + "% dell'ebollizione.";
      } else if (sit.fase === "solido") {
        spiega.textContent = "Le particelle vibrano intorno alla loro posizione, senza cambiarla. Tutta l'energia che arriva alza la temperatura.";
      } else if (sit.fase === "liquido") {
        spiega.textContent = "Le particelle scorrono le une sulle altre e si accumulano sul fondo: hanno un volume proprio ma non una forma propria.";
      } else {
        spiega.textContent = "Le particelle volano libere e riempiono tutto il contenitore: né forma né volume propri.";
      }
    }
  }

  function scrivi(id, testo) {
    var e = document.getElementById(id);
    if (e && e.textContent !== testo) e.textContent = testo;
  }

  function arrotonda(n, cifre) {
    var f = Math.pow(10, cifre);
    return String(Math.round(n * f) / f).replace(".", ",");
  }

  function azzera() {
    energia = 0;
    storia = [{ e: 0, t: sostanza.partenza }];
    creaParticelle();
  }

  function cursore(etichetta, min, max, passoV, valore, unita, quandoCambia) {
    var riga = elemento("div", "cursore");
    var testa = elemento("div", "cursore-testa");
    testa.appendChild(elemento("span", "cursore-nome", etichetta));
    var lettura = elemento("span", "cursore-valore", valore + " " + unita);
    testa.appendChild(lettura);
    riga.appendChild(testa);

    var input = elemento("input");
    input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(passoV);
    input.value = String(valore);
    input.setAttribute("aria-label", etichetta);
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      lettura.textContent = v + " " + unita;
      quandoCambia(v);
    });
    riga.appendChild(input);
    return riga;
  }

  function costruisci() {
    svuota(contenitore);

    var avvisoErrori = App.avvisoErroriFile("sostanze.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Accendi il riscaldatore e guarda che cosa succede alle particelle e alla temperatura. " +
      "Il momento interessante è quando la temperatura smette di salire pur continuando a scaldare."));

    /* scelta della sostanza */
    var scelte = elemento("div", "scelte-grandezza");
    sostanze.forEach(function (s) {
      var b = elemento("button", "pillola" + (s === sostanza ? " attiva" : ""));
      b.type = "button";
      b.textContent = s.nome;
      b.addEventListener("click", function () {
        sostanza = s;
        azzera();
        costruisci();
        unFotogramma(0);
      });
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);

    /* il contenitore con le particelle */
    var scatola = elemento("div", "scatola-particelle");
    tela = document.createElement("canvas");
    tela.className = "tela";
    tela.setAttribute("role", "img");
    tela.setAttribute("aria-label", "Le particelle della sostanza nel contenitore");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);

    /* le letture */
    var letture = elemento("div", "letture");
    letture.appendChild(lettura("lettura-temperatura", "temperatura"));
    letture.appendChild(lettura("lettura-kelvin", "in kelvin"));
    letture.appendChild(lettura("lettura-fase", "stato"));
    letture.appendChild(lettura("lettura-energia", "energia fornita"));
    contenitore.appendChild(letture);

    /* che cosa sta succedendo */
    var riquadro = elemento("div", "riquadro-fase");
    riquadro.id = "riquadro-fase";
    var spiega = elemento("p", "spiegazione-fase");
    spiega.id = "spiegazione-fase";
    spiega.setAttribute("role", "status");
    riquadro.appendChild(spiega);
    contenitore.appendChild(riquadro);

    /* i comandi */
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

    var reset = elemento("button", "bottone secondario", "↺  Ricomincia");
    reset.type = "button";
    reset.addEventListener("click", function () {
      fermati();
      azzera();
      document.getElementById("bottone-moto").textContent = "▶  Avvia";
    });
    riga.appendChild(reset);
    comandi.appendChild(riga);

    comandi.appendChild(cursore("Riscaldatore", -600, 1000, 20, potenza, "W", function (v) {
      potenza = v;
    }));
    comandi.appendChild(elemento("p", "nota-piccola",
      "Con il riscaldatore a valori negativi la sostanza viene raffreddata, e la curva torna indietro."));

    comandi.appendChild(cursore("Massa", 20, 500, 10, Math.round(massa * 1000), "g", function (v) {
      massa = v / 1000;
      azzera();
    }));
    comandi.appendChild(cursore("Velocità della simulazione", 1, 60, 1, velocita, "×", function (v) {
      velocita = v;
    }));
    contenitore.appendChild(comandi);

    /* il grafico */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La curva di riscaldamento"));
    contenitore.appendChild(elemento("p", "didascalia",
      "In verticale la temperatura, in orizzontale l'energia fornita. Le due righe tratteggiate sono " +
      "la temperatura di fusione e quella di ebollizione."));
    var scatolaG = elemento("div", "scatola-grafico");
    telaGrafico = document.createElement("canvas");
    telaGrafico.className = "tela";
    telaGrafico.setAttribute("role", "img");
    telaGrafico.setAttribute("aria-label", "La curva di riscaldamento della sostanza");
    scatolaG.appendChild(telaGrafico);
    contenitore.appendChild(scatolaG);

    /* i dati della sostanza */
    var dettagli = elemento("details", "tutte-unita");
    dettagli.appendChild(elemento("summary", null, "I numeri di questa sostanza"));
    var elenco = elemento("div", "elenco-valori");
    [
      ["fonde a", sostanza.fusione + " °C"],
      ["bolle a", sostanza.ebollizione + " °C"],
      ["calore specifico, solido", sostanza.cSolido + " J/(kg·K)"],
      ["calore specifico, liquido", sostanza.cLiquido + " J/(kg·K)"],
      ["calore specifico, gas", sostanza.cGas + " J/(kg·K)"],
      ["calore latente di fusione", Math.round(sostanza.lFusione / 1000) + " kJ/kg"],
      ["calore latente di vaporizzazione", Math.round(sostanza.lVaporizzazione / 1000) + " kJ/kg"]
    ].forEach(function (v) {
      var voce = elemento("div", "valore-unita");
      voce.appendChild(elemento("span", "valore-numero", v[0]));
      voce.appendChild(elemento("span", "valore-simbolo", v[1]));
      elenco.appendChild(voce);
    });
    dettagli.appendChild(elenco);
    contenitore.appendChild(dettagli);

    if (sostanza.nota) contenitore.appendChild(elemento("p", "nota-grandezza", sostanza.nota));

    /* i limiti del modello: vanno dichiarati sempre */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "La temperatura è calcolata con i valori reali della sostanza: calori specifici e calori latenti presi da tabella. Quella parte è corretta.",
      "Le particelle sul disegno, invece, non producono i passaggi di stato: li rappresentano. In una simulazione vera, i passaggi di stato emergerebbero dalle forze fra le particelle, e sarebbero molto meno puliti.",
      "Le particelle sono duecento invece che miliardi di miliardi, e si muovono in due dimensioni invece che in tre.",
      "Il riscaldamento è uniforme e istantaneo in tutta la sostanza: non ci sono punti più caldi di altri, e non si perde calore verso l'esterno.",
      "La pressione è sempre quella atmosferica. Cambiandola, le temperature di fusione ed ebollizione cambierebbero: in montagna l'acqua bolle sotto i 100 gradi."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    creaParticelle();
  }

  function lettura(id, etichetta) {
    var box = elemento("div", "lettura");
    var v = elemento("div", "lettura-valore", "—");
    v.id = id;
    box.appendChild(v);
    box.appendChild(elemento("div", "lettura-nome", etichetta));
    return box;
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(320, Math.max(200, larghezza * 0.5)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaG = telaGrafico.parentNode.clientWidth;
    altezzaG = Math.round(Math.min(260, Math.max(180, larghezzaG * 0.45)));
    telaGrafico.width = larghezzaG * dpr; telaGrafico.height = altezzaG * dpr;
    telaGrafico.style.width = larghezzaG + "px"; telaGrafico.style.height = altezzaG + "px";
    ctxGrafico = telaGrafico.getContext("2d");
    ctxGrafico.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    creaParticelle();
  });

  /* ==========================================================
     7. Avvio
     ========================================================== */

  App.caricaTesto("sostanze.txt")
    .then(function (testo) {
      var esito = leggiSostanze(testo);
      sostanze = esito.sostanze;
      erroriFile = esito.errori;
      if (sostanze.length === 0) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(elemento("strong", null, "Nessuna sostanza da mostrare."));
        avviso.appendChild(document.createTextNode(
          "Il file sostanze.txt è stato letto ma non contiene sostanze valide."));
        contenitore.appendChild(avviso);
        return;
      }
      sostanza = sostanze[0];
      costruisci();
      azzera();
      unFotogramma(0);
      requestAnimationFrame(passo);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("sostanze.txt", errore.message));
    });

})();
