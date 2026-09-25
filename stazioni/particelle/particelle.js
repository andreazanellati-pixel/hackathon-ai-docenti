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
   - la temperatura di ebollizione dipende dalla pressione, con
     la relazione di Clausius-Clapeyron
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

  var R = 8.314;            /* costante dei gas, J/(mol·K) */

  /* ---------- stato ---------- */

  var sostanze = [];
  var erroriFile = [];
  var sostanza = null;

  var massa = 0.1;          /* kg */
  var potenza = 200;        /* watt, negativa raffredda */
  var pressione = 1;        /* atmosfere */
  var velocita = 20;        /* quante volte piu' veloce del tempo reale */
  var inMoto = false;

  var energia = 0;          /* joule forniti finora, puo' essere negativa */
  var storia = [];          /* punti { e, t } per il grafico */

  var particelle = [];
  var numeroParticelle = 150;

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
    "massa molare": "massaMolare",
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
     ========================================================== */

  /* La temperatura di ebollizione dipende dalla pressione. La
     relazione e' quella di Clausius-Clapeyron: serve la massa
     molare, ed e' per questo che sta in sostanze.txt. Se manca,
     la pressione non ha effetto. */
  function ebollizione() {
    var s = sostanza;
    if (typeof s.massaMolare !== "number" || s.massaMolare <= 0) return s.ebollizione;
    if (pressione === 1) return s.ebollizione;

    var t0 = s.ebollizione + 273.15;
    var molare = s.massaMolare / 1000;                   /* da g/mol a kg/mol */
    var inverso = 1 / t0 - (R / (s.lVaporizzazione * molare)) * Math.log(pressione);
    if (inverso <= 0) return s.ebollizione;
    var t = 1 / inverso - 273.15;

    /* sotto la fusione l'ebollizione non ha piu' senso: la sostanza
       sublimerebbe, cioe' passerebbe direttamente da solido a gas */
    if (t < s.fusione + 1) t = s.fusione + 1;
    return t;
  }

  function soglie() {
    var s = sostanza;
    var te = ebollizione();
    var s1 = massa * s.cSolido * (s.fusione - s.partenza);
    var s2 = s1 + massa * s.lFusione;
    var s3 = s2 + massa * s.cLiquido * (te - s.fusione);
    var s4 = s3 + massa * s.lVaporizzazione;
    return { s1: s1, s2: s2, s3: s3, s4: s4 };
  }

  function energiaMassima() {
    var g = soglie();
    return g.s4 + massa * sostanza.cGas * Math.max(40, ebollizione() - sostanza.fusione) * 0.6;
  }

  function energiaMinima() {
    /* non si scende sotto lo zero assoluto */
    return -massa * sostanza.cSolido * (sostanza.partenza + 273.15);
  }

  function situazione(e) {
    var s = sostanza;
    var g = soglie();
    var te = ebollizione();

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
      return { temperatura: te, fase: "ebollizione", frazione: (e - g.s3) / (g.s4 - g.s3) };
    }
    return { temperatura: te + (e - g.s4) / (massa * s.cGas), fase: "gas", frazione: 1 };
  }

  var NOMI_FASE = {
    solido: "solido",
    fusione: "sta fondendo",
    liquido: "liquido",
    ebollizione: "sta bollendo",
    gas: "gas"
  };

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

  /* Quante particelle disegnare: piu' massa, piu' particelle. Cosi'
     il cursore della massa si vede anche nel contenitore, non solo
     nei numeri del grafico. */
  function quanteParticelle() {
    var frazione = (massa - 0.02) / (0.5 - 0.02);
    return Math.round(60 + Math.max(0, Math.min(1, frazione)) * 130);
  }

  function creaParticelle() {
    numeroParticelle = quanteParticelle();
    particelle = [];
    var colonne = Math.ceil(Math.sqrt(numeroParticelle * 1.8));
    var righe = Math.ceil(numeroParticelle / colonne);
    var altezzaCumulo = Math.min(0.58, 0.10 + righe * 0.030);
    for (var i = 0; i < numeroParticelle; i++) {
      var c = i % colonne;
      var r = Math.floor(i / colonne);
      particelle.push({
        rx: 0.16 + 0.68 * (colonne === 1 ? 0.5 : c / (colonne - 1)),
        ry: 0.97 - altezzaCumulo * (righe === 1 ? 0 : r / (righe - 1)),
        x: 0, y: 0, vx: 0, vy: 0,
        stato: "solido",
        seme: Math.random() * Math.PI * 2
      });
    }
    particelle.forEach(function (p) { p.x = p.rx * larghezza; p.y = p.ry * altezza; });
  }

  function raggioParticella() {
    return numeroParticelle > 140 ? 4.2 : 5;
  }

  function assegnaStati(sit) {
    var nGas = Math.round(quotaGas(sit) * numeroParticelle);
    var nLiquide = Math.round(quotaLiquida(sit) * numeroParticelle) - nGas;
    if (nLiquide < 0) nLiquide = 0;
    for (var i = 0; i < numeroParticelle; i++) {
      /* le particelle piu' in alto passano di stato per prime:
         cosi' si vede il fronte di fusione salire */
      if (i >= numeroParticelle - nGas) particelle[i].stato = "gas";
      else if (i >= numeroParticelle - nGas - nLiquide) particelle[i].stato = "liquido";
      else particelle[i].stato = "solido";
    }
  }

  function aggiornaParticelle(dt, sit) {
    var kelvin = Math.max(1, sit.temperatura + 273.15);
    var kelvinFusione = Math.max(1, sostanza.fusione + 273.15);
    var agitazione = Math.sqrt(kelvin / kelvinFusione);
    var raggio = raggioParticella();

    for (var i = 0; i < numeroParticelle; i++) {
      var p = particelle[i];

      if (p.stato === "solido") {
        var ampiezza = Math.min(6, 1.4 * agitazione * agitazione);
        p.seme += dt * 9 * agitazione;
        p.x = p.rx * larghezza + Math.cos(p.seme * 1.7) * ampiezza;
        p.y = p.ry * altezza + Math.sin(p.seme * 2.3) * ampiezza;
        p.vx = 0; p.vy = 0;

      } else if (p.stato === "liquido") {
        p.vy += 260 * dt;
        p.vx += (Math.random() - 0.5) * 120 * agitazione * dt;
        p.vy += (Math.random() - 0.5) * 120 * agitazione * dt;
        p.vx *= 0.93; p.vy *= 0.93;
        muovi(p, dt, raggio);

      } else {
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
    for (var a = 0; a < numeroParticelle; a++) {
      var pa = particelle[a];
      if (pa.stato === "solido") continue;
      for (var b = a + 1; b < numeroParticelle; b++) {
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

  function coloreTema(nome, ripiego) {
    var stile = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return stile || ripiego;
  }

  function disegnaContenitore() {
    ctx.clearRect(0, 0, larghezza, altezza);
    ctx.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    ctx.fillRect(0, 0, larghezza, altezza);

    var raggio = raggioParticella();
    for (var i = 0; i < numeroParticelle; i++) {
      var p = particelle[i];
      ctx.globalAlpha = p.stato === "gas" ? 0.75 : 1;
      ctx.fillStyle = sostanza.colore;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.stato === "gas" ? raggio * 0.8 : raggio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    /* il riscaldatore in basso: arancione se scalda, azzurro se raffredda */
    if (potenza !== 0) {
      ctx.fillStyle = potenza > 0 ? "rgba(214,120,40,.85)" : "rgba(80,150,210,.85)";
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

  /* sceglie un passo "tondo" per le tacche dell'asse */
  function passoTacche(intervallo) {
    var candidati = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    for (var i = 0; i < candidati.length; i++) {
      if (intervallo / candidati[i] <= 6) return candidati[i];
    }
    return candidati[candidati.length - 1];
  }

  function disegnaGrafico(sit) {
    var c = ctxGrafico;
    c.clearRect(0, 0, larghezzaG, altezzaG);

    var margineS = 48, margineD = 14, margineA = 12, margineB = 42;
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

    var te = ebollizione();
    var tMin = Math.min(sostanza.partenza, tMinVisto) - 15;
    var tMax = Math.max(te + (te - sostanza.fusione) * 0.5, tMaxVisto) + 15;

    function px(e) { return margineS + (e - eMin) / (eMax - eMin) * w; }
    function py(t) { return margineA + h - (t - tMin) / (tMax - tMin) * h; }

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var bordo = coloreTema("--bordo", "#ddd6c9");
    var accento = coloreTema("--accento", "#1f5f8b");

    c.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.lineWidth = 1;

    /* le tacche dell'energia, in kilojoule: e' qui che si vede
       l'effetto della massa, perche' i numeri raddoppiano */
    var passoKJ = passoTacche((eMax - eMin) / 1000);
    c.strokeStyle = bordo;
    c.fillStyle = tenue;
    c.textAlign = "center";
    var primo = Math.ceil(eMin / 1000 / passoKJ) * passoKJ;
    for (var kj = primo; kj * 1000 <= eMax; kj += passoKJ) {
      var x = px(kj * 1000);
      c.beginPath();
      c.moveTo(x, margineA + h); c.lineTo(x, margineA + h + 4);
      c.stroke();
      c.fillText(String(kj), x, margineA + h + 16);
    }

    /* le due temperature notevoli */
    c.strokeStyle = bordo;
    c.setLineDash([4, 4]);
    [sostanza.fusione, te].forEach(function (t) {
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
    c.textAlign = "right";
    c.fillText(Math.round(sostanza.fusione) + "°", margineS - 5, py(sostanza.fusione) + 4);
    c.fillText(Math.round(te) + "°", margineS - 5, py(te) + 4);
    c.textAlign = "center";
    c.fillText("energia fornita (kJ)", margineS + w / 2, altezzaG - 8);

    /* la curva percorsa finora */
    if (storia.length > 1) {
      c.strokeStyle = accento;
      c.lineWidth = 2.5;
      c.beginPath();
      for (var i = 0; i < storia.length; i++) {
        var xx = px(storia[i].e), yy = py(storia[i].t);
        if (i === 0) c.moveTo(xx, yy); else c.lineTo(xx, yy);
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

    /* se la pagina era nascosta quando e' stata costruita, le misure
       erano zero: appena si puo', si rifanno */
    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) {
      adattaTele();
      creaParticelle();
    }

    if (inMoto) {
      var nuova = energia + potenza * velocita * dt;
      var tetto = energiaMassima(), pavimento = energiaMinima();
      if (nuova > tetto) { nuova = tetto; fermati(); }
      if (nuova < pavimento) { nuova = pavimento; fermati(); }
      energia = nuova;

      var ultimo = storia[storia.length - 1];
      if (!ultimo || Math.abs(energia - ultimo.e) > (tetto - pavimento) / 500) {
        storia.push({ e: energia, t: situazione(energia).temperatura });
        if (storia.length > 4000) storia.shift();
      }
    }

    unFotogramma(dt);
    requestAnimationFrame(passo);
  }

  /* Disegna un fotogramma. Sta in una funzione a parte perche' serve
     anche subito dopo il caricamento e ogni volta che si tocca un
     comando: cosi' la pagina e' corretta anche a simulazione ferma. */
  function unFotogramma(dt) {
    var sit = situazione(energia);
    assegnaStati(sit);
    aggiornaParticelle(dt, sit);
    disegnaContenitore();
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
    scrivi("lettura-fusione", arrotonda(sostanza.fusione, 0) + " °C");
    scrivi("lettura-ebollizione", arrotonda(ebollizione(), 0) + " °C");

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

  function cursore(etichetta, min, max, passoV, valore, unita, formatta, quandoCambia) {
    var riga = elemento("div", "cursore");
    var testa = elemento("div", "cursore-testa");
    testa.appendChild(elemento("span", "cursore-nome", etichetta));
    var lettura = elemento("span", "cursore-valore", formatta(valore) + " " + unita);
    testa.appendChild(lettura);
    riga.appendChild(testa);

    var input = elemento("input");
    input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(passoV);
    input.value = String(valore);
    input.setAttribute("aria-label", etichetta);
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      lettura.textContent = formatta(v) + " " + unita;
      quandoCambia(v);
    });
    riga.appendChild(input);
    riga.aggiorna = function (v) {
      input.value = String(v);
      lettura.textContent = formatta(v) + " " + unita;
    };
    return riga;
  }

  function comeSta(v) { return String(v); }
  function conVirgola(v) { return String(v).replace(".", ","); }

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
    letture.appendChild(lettura("lettura-fusione", "fonde a"));
    letture.appendChild(lettura("lettura-ebollizione", "bolle a"));
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
      unFotogramma(0);
    });
    riga.appendChild(reset);
    comandi.appendChild(riga);

    comandi.appendChild(cursore("Riscaldatore", -600, 1000, 20, potenza, "W", comeSta,
      function (v) { potenza = v; unFotogramma(0); }));
    comandi.appendChild(elemento("p", "nota-piccola",
      "Con il riscaldatore a valori negativi la sostanza viene raffreddata, e la curva torna indietro."));

    comandi.appendChild(cursore("Massa", 20, 500, 10, Math.round(massa * 1000), "g", comeSta,
      function (v) { massa = v / 1000; azzera(); unFotogramma(0); }));
    comandi.appendChild(elemento("p", "nota-piccola",
      "Con più massa servono più kilojoule per ogni tappa: guarda i numeri sotto il grafico, " +
      "e le particelle nel contenitore, che aumentano."));

    var cursorePressione = cursore("Pressione", 0.2, 5, 0.1, pressione, "atm", conVirgola,
      function (v) { pressione = v; azzera(); unFotogramma(0); });
    comandi.appendChild(cursorePressione);

    var preset = elemento("div", "preset");
    preset.appendChild(elemento("span", "esempi-etichetta", "prova con:"));
    [
      ["cima dell'Everest", 0.3],
      ["livello del mare", 1],
      ["pentola a pressione", 2]
    ].forEach(function (p) {
      var b = elemento("button", "bottone-esempio", p[0]);
      b.type = "button";
      b.addEventListener("click", function () {
        pressione = p[1];
        cursorePressione.aggiorna(p[1]);
        azzera();
        unFotogramma(0);
      });
      preset.appendChild(b);
    });
    comandi.appendChild(preset);
    comandi.appendChild(elemento("p", "nota-piccola",
      "La pressione sposta la temperatura di ebollizione, non quella di fusione. " +
      "Cambiandola l'esperimento riparte da capo, così le due curve si possono confrontare."));

    comandi.appendChild(cursore("Velocità della simulazione", 1, 60, 1, velocita, "×", comeSta,
      function (v) { velocita = v; }));
    contenitore.appendChild(comandi);

    /* il grafico */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La curva di riscaldamento"));
    contenitore.appendChild(elemento("p", "didascalia",
      "In verticale la temperatura, in orizzontale l'energia fornita in kilojoule. Le due righe " +
      "tratteggiate sono la temperatura di fusione e quella di ebollizione."));
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
    var voci = [
      ["fonde a", sostanza.fusione + " °C"],
      ["bolle a, a 1 atm", sostanza.ebollizione + " °C"],
      ["calore specifico, solido", sostanza.cSolido + " J/(kg·K)"],
      ["calore specifico, liquido", sostanza.cLiquido + " J/(kg·K)"],
      ["calore specifico, gas", sostanza.cGas + " J/(kg·K)"],
      ["calore latente di fusione", Math.round(sostanza.lFusione / 1000) + " kJ/kg"],
      ["calore latente di vaporizzazione", Math.round(sostanza.lVaporizzazione / 1000) + " kJ/kg"]
    ];
    if (typeof sostanza.massaMolare === "number") {
      voci.push(["massa molare", arrotonda(sostanza.massaMolare, 1) + " g/mol"]);
    }
    voci.forEach(function (v) {
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
      "L'effetto della pressione sull'ebollizione usa la relazione di Clausius-Clapeyron, che suppone il calore latente costante al variare della temperatura. In realtà cala un poco, quindi lontano da un'atmosfera il valore è approssimato: per l'acqua l'errore resta sotto il grado fra 0,5 e 2 atmosfere, e cresce agli estremi.",
      "La pressione non sposta la temperatura di fusione. È una semplificazione quasi sempre lecita: per l'acqua servono più di cento atmosfere per abbassarla di un solo grado.",
      "Sotto una certa pressione una sostanza sublima, cioè passa direttamente da solido a gas senza diventare liquida. Questo modello non lo rappresenta: tiene l'ebollizione appena sopra la fusione.",
      "Le particelle sul disegno non producono i passaggi di stato: li rappresentano. In una simulazione costruita a partire dalle forze fra le particelle, i passaggi emergerebbero da soli e sarebbero molto meno puliti.",
      "Le particelle sono qualche centinaio invece che miliardi di miliardi, e si muovono in due dimensioni invece che in tre.",
      "Il riscaldamento è uniforme e istantaneo in tutta la sostanza: non ci sono punti più caldi di altri, e non si perde calore verso l'esterno."
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
    altezzaG = Math.round(Math.min(280, Math.max(190, larghezzaG * 0.48)));
    telaGrafico.width = larghezzaG * dpr; telaGrafico.height = altezzaG * dpr;
    telaGrafico.style.width = larghezzaG + "px"; telaGrafico.style.height = altezzaG + "px";
    ctxGrafico = telaGrafico.getContext("2d");
    ctxGrafico.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    creaParticelle();
    unFotogramma(0);
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
