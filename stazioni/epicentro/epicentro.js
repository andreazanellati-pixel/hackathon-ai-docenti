/* ============================================================
   Trovare l'epicentro
   ------------------------------------------------------------
   Tre stazioni sismiche registrano lo stesso terremoto. Da ogni
   sismogramma si legge il ritardo fra l'arrivo delle onde S e
   quello delle onde P; con la dromocrona quel ritardo diventa una
   distanza; tre distanze danno tre circonferenze, e le tre
   circonferenze si incontrano nell'epicentro.

   E' il metodo vero: quello che si usa davvero per localizzare un
   terremoto. Qui e' in due dimensioni e con velocita' costanti,
   ma il procedimento e' identico.

     onde P   6,5 km/s   arrivano per prime (P come "prime")
     onde S   3,7 km/s   arrivano dopo      (S come "seconde")

     ritardo = d * (1/vs - 1/vp)  ->  d = ritardo / 0,1164
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var VP = 6.5;     /* km/s */
  var VS = 3.7;     /* km/s */
  var FATTORE = 1 / VS - 1 / VP;      /* secondi di ritardo per ogni km */

  var LATO = 400;   /* il territorio e' un quadrato di 400 km di lato */

  /* ---------- stato ---------- */

  var stazioni = [];
  var epicentro = null;
  var stime = [0, 0, 0];      /* distanze stimate dallo studente, in km */
  var tentativo = null;       /* dove ha cliccato */
  var soluzioneMostrata = false;

  var telaMappa = null, ctxMappa = null, larghezzaM = 0, altezzaM = 0;
  var teleSismo = [], ctxSismo = [], larghezzaS = 0, altezzaS = 0;

  var NOMI = ["A", "B", "C"];

  /* ==========================================================
     1. Generare un terremoto
     ========================================================== */

  function distanza(a, b) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  }

  function nuovoTerremoto() {
    /* tre stazioni ben distanziate: se fossero allineate, le
       circonferenze non basterebbero a decidere da che parte sta
       l'epicentro */
    stazioni = [
      { nome: "A", x: 60 + Math.random() * 60, y: 60 + Math.random() * 60 },
      { nome: "B", x: LATO - 120 + Math.random() * 60, y: 70 + Math.random() * 60 },
      { nome: "C", x: LATO / 2 - 40 + Math.random() * 80, y: LATO - 110 + Math.random() * 60 }
    ];

    /* l'epicentro sta dentro il territorio, non troppo vicino ai bordi */
    epicentro = {
      x: 70 + Math.random() * (LATO - 140),
      y: 70 + Math.random() * (LATO - 140)
    };

    stazioni.forEach(function (s) {
      s.distanza = distanza(s, epicentro);
      s.ritardo = s.distanza * FATTORE;
      s.arrivoP = s.distanza / VP;
      s.arrivoS = s.distanza / VS;
      s.traccia = generaTraccia(s);
    });

    stime = [0, 0, 0];
    tentativo = null;
    soluzioneMostrata = false;
  }

  /* il sismogramma: rumore, poi le onde P, poi le onde S piu' ampie */
  function generaTraccia(s) {
    var durata = 90;                 /* secondi mostrati */
    var punti = 900;
    var traccia = [];
    for (var i = 0; i < punti; i++) {
      var t = i / punti * durata;
      var v = (Math.random() - 0.5) * 0.10;        /* rumore di fondo */
      if (t >= s.arrivoP) {
        var dopoP = t - s.arrivoP;
        v += Math.sin(dopoP * 9) * 0.42 * Math.exp(-dopoP / 14) * (0.7 + Math.random() * 0.6);
      }
      if (t >= s.arrivoS) {
        var dopoS = t - s.arrivoS;
        v += Math.sin(dopoS * 5.5) * 1.0 * Math.exp(-dopoS / 20) * (0.7 + Math.random() * 0.6);
      }
      traccia.push(v);
    }
    return { durata: durata, punti: traccia };
  }

  /* ==========================================================
     2. Disegno dei sismogrammi
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegnaSismogramma(indice) {
    var c = ctxSismo[indice];
    if (!c) return;
    var s = stazioni[indice];
    var w = larghezzaS, h = altezzaS;

    c.clearRect(0, 0, w, h);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, w, h);

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var bordo = coloreTema("--bordo", "#ddd6c9");
    var margineS = 26, margineD = 8, margineB = 18;
    var larghezzaUtile = w - margineS - margineD;
    var meta = (h - margineB) / 2;

    /* la scala dei tempi */
    c.strokeStyle = bordo;
    c.fillStyle = tenue;
    c.font = "9px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.textAlign = "center";
    c.lineWidth = 1;
    for (var t = 0; t <= s.traccia.durata; t += 15) {
      var x = margineS + t / s.traccia.durata * larghezzaUtile;
      c.beginPath();
      c.moveTo(x, h - margineB); c.lineTo(x, h - margineB + 3);
      c.stroke();
      c.fillText(t + "s", x, h - 5);
    }

    /* la traccia */
    c.strokeStyle = coloreTema("--testo", "#1e1b16");
    c.lineWidth = 1;
    c.beginPath();
    for (var i = 0; i < s.traccia.punti.length; i++) {
      var xx = margineS + i / s.traccia.punti.length * larghezzaUtile;
      var yy = meta - s.traccia.punti[i] * meta * 0.78;
      if (i === 0) c.moveTo(xx, yy); else c.lineTo(xx, yy);
    }
    c.stroke();

    /* gli arrivi di P e di S */
    [[s.arrivoP, "P", "#1f5f8b"], [s.arrivoS, "S", "#9b2f24"]].forEach(function (a) {
      var x = margineS + a[0] / s.traccia.durata * larghezzaUtile;
      c.strokeStyle = a[2];
      c.lineWidth = 1.5;
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(x, 4); c.lineTo(x, h - margineB);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = a[2];
      c.font = "bold 12px system-ui, -apple-system, 'Segoe UI', sans-serif";
      c.textAlign = "left";
      c.fillText(a[1], x + 3, 13);
    });

    /* il nome della stazione */
    c.fillStyle = tenue;
    c.font = "bold 12px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.textAlign = "left";
    c.fillText("stazione " + s.nome, 4, 13);
  }

  /* ==========================================================
     3. Disegno della mappa
     ========================================================== */

  function versoSchermo(p) {
    return { x: p.x / LATO * larghezzaM, y: p.y / LATO * altezzaM };
  }

  function versoTerritorio(x, y) {
    return { x: x / larghezzaM * LATO, y: y / altezzaM * LATO };
  }

  function disegnaMappa() {
    var c = ctxMappa;
    if (!c) return;
    c.clearRect(0, 0, larghezzaM, altezzaM);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaM, altezzaM);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var accento = coloreTema("--accento", "#1f5f8b");

    /* la griglia, ogni 50 km */
    c.strokeStyle = bordo;
    c.lineWidth = 1;
    for (var k = 50; k < LATO; k += 50) {
      var p = versoSchermo({ x: k, y: k });
      c.beginPath(); c.moveTo(p.x, 0); c.lineTo(p.x, altezzaM); c.stroke();
      c.beginPath(); c.moveTo(0, p.y); c.lineTo(larghezzaM, p.y); c.stroke();
    }

    /* la scala */
    var cento = versoSchermo({ x: 100, y: 0 }).x;
    c.strokeStyle = tenue;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(12, altezzaM - 14); c.lineTo(12 + cento, altezzaM - 14);
    c.stroke();
    c.fillStyle = tenue;
    c.font = "10px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.textAlign = "left";
    c.fillText("100 km", 12, altezzaM - 18);

    /* le circonferenze delle distanze stimate */
    stazioni.forEach(function (s, i) {
      if (!stime[i] || stime[i] <= 0) return;
      var centro = versoSchermo(s);
      var raggio = stime[i] / LATO * larghezzaM;
      c.strokeStyle = accento;
      c.globalAlpha = 0.65;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(centro.x, centro.y, raggio, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
    });

    /* le stazioni */
    stazioni.forEach(function (s) {
      var p = versoSchermo(s);
      c.fillStyle = coloreTema("--testo", "#1e1b16");
      c.beginPath();
      c.moveTo(p.x, p.y - 8); c.lineTo(p.x + 7, p.y + 5); c.lineTo(p.x - 7, p.y + 5);
      c.closePath(); c.fill();
      c.font = "bold 12px system-ui, -apple-system, 'Segoe UI', sans-serif";
      c.textAlign = "center";
      c.fillText(s.nome, p.x, p.y + 19);
    });

    /* il tentativo dello studente */
    if (tentativo) {
      var t = versoSchermo(tentativo);
      c.strokeStyle = "#c9762f";
      c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(t.x - 8, t.y - 8); c.lineTo(t.x + 8, t.y + 8);
      c.moveTo(t.x + 8, t.y - 8); c.lineTo(t.x - 8, t.y + 8);
      c.stroke();
    }

    /* la soluzione */
    if (soluzioneMostrata && epicentro) {
      var e = versoSchermo(epicentro);
      c.fillStyle = "#9b2f24";
      c.beginPath(); c.arc(e.x, e.y, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#9b2f24";
      c.lineWidth = 2;
      c.beginPath(); c.arc(e.x, e.y, 14, 0, Math.PI * 2); c.stroke();
    }
  }

  /* ==========================================================
     4. La dromocrona
     ========================================================== */

  function disegnaDromocrona() {
    var tela = document.getElementById("tela-dromocrona");
    if (!tela) return;
    var c = tela.getContext("2d");
    var w = tela.clientWidth, h = tela.clientHeight;
    var dpr = window.devicePixelRatio || 1;
    tela.width = w * dpr; tela.height = h * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    c.clearRect(0, 0, w, h);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, w, h);

    var margineS = 42, margineD = 12, margineA = 12, margineB = 32;
    var lu = w - margineS - margineD, hu = h - margineA - margineB;
    var dMax = 500, tMax = dMax * FATTORE;

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var bordo = coloreTema("--bordo", "#ddd6c9");
    var accento = coloreTema("--accento", "#1f5f8b");

    function px(d) { return margineS + d / dMax * lu; }
    function py(t) { return margineA + hu - t / tMax * hu; }

    c.strokeStyle = bordo;
    c.lineWidth = 1;
    c.font = "10px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillStyle = tenue;
    c.textAlign = "center";
    for (var d = 100; d <= dMax; d += 100) {
      c.beginPath(); c.moveTo(px(d), margineA); c.lineTo(px(d), margineA + hu); c.stroke();
      c.fillText(d, px(d), margineA + hu + 14);
    }
    c.textAlign = "right";
    for (var t = 10; t <= tMax; t += 10) {
      c.beginPath(); c.moveTo(margineS, py(t)); c.lineTo(margineS + lu, py(t)); c.stroke();
      c.fillText(t + "s", margineS - 4, py(t) + 3);
    }

    c.strokeStyle = tenue;
    c.beginPath();
    c.moveTo(margineS, margineA); c.lineTo(margineS, margineA + hu); c.lineTo(margineS + lu, margineA + hu);
    c.stroke();

    c.textAlign = "center";
    c.fillText("distanza dall'epicentro (km)", margineS + lu / 2, h - 6);

    /* la retta del ritardo */
    c.strokeStyle = accento;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(px(0), py(0)); c.lineTo(px(dMax), py(dMax * FATTORE));
    c.stroke();

    /* i tre ritardi letti dai sismogrammi */
    stazioni.forEach(function (s, i) {
      var y = py(s.ritardo);
      c.strokeStyle = "#c9762f";
      c.setLineDash([3, 3]);
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(margineS, y); c.lineTo(px(s.distanza), y); c.lineTo(px(s.distanza), margineA + hu);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = "#c9762f";
      c.font = "bold 10px system-ui, -apple-system, 'Segoe UI', sans-serif";
      c.textAlign = "left";
      c.fillText(s.nome, margineS + 3, y - 3);
    });
  }

  /* ==========================================================
     5. La pagina
     ========================================================== */

  function aggiornaEsito() {
    var esito = document.getElementById("spiegazione-fase");
    var riquadro = document.getElementById("riquadro-fase");
    if (!esito) return;

    if (!tentativo) {
      esito.textContent = "Leggi il ritardo fra S e P su ogni sismogramma, ricava le tre distanze e scrivile qui sotto. " +
        "Poi clicca sulla mappa dove pensi che sia l'epicentro.";
      if (riquadro) riquadro.classList.remove("in-passaggio");
      return;
    }

    var errore = distanza(tentativo, epicentro);
    var giudizio;
    if (errore < 15) giudizio = "Centrato. Da sismologo.";
    else if (errore < 35) giudizio = "Molto vicino: con misure fatte a mano è un ottimo risultato.";
    else if (errore < 70) giudizio = "Ci siamo quasi. Controlla le distanze: basta sbagliare di poco un ritardo.";
    else giudizio = "Lontano. Rileggi i ritardi sui sismogrammi: forse hai scambiato l'arrivo di S con quello di P.";

    esito.textContent = "Hai sbagliato di " + Math.round(errore) + " km. " + giudizio;
    if (riquadro) riquadro.classList.toggle("in-passaggio", errore < 35);
  }

  function rigaStazione(i) {
    var s = stazioni[i];
    var riga = elemento("div", "riga-sismica");

    var scatola = elemento("div", "scatola-sismogramma");
    var tela = document.createElement("canvas");
    tela.className = "tela";
    tela.setAttribute("role", "img");
    tela.setAttribute("aria-label", "Sismogramma della stazione " + s.nome);
    scatola.appendChild(tela);
    teleSismo[i] = tela;
    riga.appendChild(scatola);

    var sotto = elemento("div", "sotto-sismogramma");

    var ritardo = elemento("div", "dato-sismico");
    ritardo.appendChild(elemento("span", "dato-nome", "ritardo S − P"));
    ritardo.appendChild(elemento("span", "dato-valore", s.ritardo.toFixed(1).replace(".", ",") + " s"));
    sotto.appendChild(ritardo);

    var campo = elemento("div", "campo-distanza");
    campo.appendChild(elemento("label", "dato-nome", "la tua distanza"));
    var input = elemento("input", "campo-valore");
    input.type = "number";
    input.min = "0"; input.max = "600"; input.step = "5";
    input.value = stime[i] ? String(Math.round(stime[i])) : "";
    input.placeholder = "km";
    input.setAttribute("aria-label", "distanza stimata per la stazione " + s.nome);
    input.addEventListener("input", function () {
      stime[i] = parseFloat(input.value) || 0;
      disegnaMappa();
    });
    campo.appendChild(input);
    campo.appendChild(elemento("span", "unita-risposta", "km"));
    sotto.appendChild(campo);

    riga.appendChild(sotto);
    return riga;
  }

  function costruisci() {
    svuota(contenitore);

    contenitore.appendChild(elemento("p", "guida",
      "Tre stazioni hanno registrato lo stesso terremoto. Le onde P corrono a 6,5 km/s, le S a 3,7: " +
      "più una stazione è lontana, più le due arrivano distanziate. Da quel ritardo si risale alla distanza."));

    /* i tre sismogrammi */
    var zona = elemento("div", "sismogrammi");
    for (var i = 0; i < 3; i++) zona.appendChild(rigaStazione(i));
    contenitore.appendChild(zona);

    /* la dromocrona */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La dromocrona"));
    contenitore.appendChild(elemento("p", "didascalia",
      "Converte il ritardo in distanza: si entra da sinistra con i secondi e si scende sulla distanza. " +
      "Le righe arancioni sono i ritardi delle tre stazioni. A occhio: distanza ≈ ritardo × 8,6."));
    var scatolaD = elemento("div", "scatola-grafico");
    var telaD = document.createElement("canvas");
    telaD.className = "tela";
    telaD.id = "tela-dromocrona";
    telaD.style.height = "220px";
    telaD.setAttribute("role", "img");
    telaD.setAttribute("aria-label", "La dromocrona: ritardo fra S e P in funzione della distanza");
    scatolaD.appendChild(telaD);
    contenitore.appendChild(scatolaD);

    /* la mappa */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La mappa"));
    contenitore.appendChild(elemento("p", "didascalia",
      "Scrivi le distanze qui sopra e compariranno le circonferenze. Poi clicca dove si incontrano."));
    var scatolaM = elemento("div", "scatola-particelle");
    telaMappa = document.createElement("canvas");
    telaMappa.className = "tela";
    telaMappa.setAttribute("role", "img");
    telaMappa.setAttribute("aria-label", "La mappa con le tre stazioni sismiche");
    scatolaM.appendChild(telaMappa);
    contenitore.appendChild(scatolaM);

    telaMappa.addEventListener("click", function (ev) {
      var r = telaMappa.getBoundingClientRect();
      tentativo = versoTerritorio(ev.clientX - r.left, ev.clientY - r.top);
      disegnaMappa();
      aggiornaEsito();
    });

    var riquadro = elemento("div", "riquadro-fase");
    riquadro.id = "riquadro-fase";
    var spiega = elemento("p", "spiegazione-fase");
    spiega.id = "spiegazione-fase";
    spiega.setAttribute("role", "status");
    riquadro.appendChild(spiega);
    contenitore.appendChild(riquadro);

    var comandi = elemento("div", "comandi");
    var riga = elemento("div", "bottoni");

    var mostra = elemento("button", "bottone", "Mostra la soluzione");
    mostra.type = "button";
    mostra.addEventListener("click", function () {
      soluzioneMostrata = true;
      disegnaMappa();
      var esito = document.getElementById("spiegazione-fase");
      if (esito) {
        esito.textContent = "Le distanze vere erano " +
          stazioni.map(function (s) { return s.nome + " " + Math.round(s.distanza) + " km"; }).join(", ") +
          ". Il pallino rosso è l'epicentro.";
      }
    });
    riga.appendChild(mostra);

    var nuovo = elemento("button", "bottone secondario", "↺  Nuovo terremoto");
    nuovo.type = "button";
    nuovo.addEventListener("click", function () {
      nuovoTerremoto();
      costruisci();
      disegnaTutto();
    });
    riga.appendChild(nuovo);
    comandi.appendChild(riga);

    var aiuto = elemento("button", "bottone-esempio", "riempi tu le distanze, voglio solo la mappa");
    aiuto.type = "button";
    aiuto.addEventListener("click", function () {
      stazioni.forEach(function (s, i) { stime[i] = s.ritardo / FATTORE; });
      costruisci();
      disegnaTutto();
    });
    var rigaAiuto = elemento("div", "preset");
    rigaAiuto.appendChild(aiuto);
    comandi.appendChild(rigaAiuto);

    contenitore.appendChild(comandi);

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Il procedimento è quello vero: ritardo fra S e P, dromocrona, triangolazione. Anche i valori delle velocità sono realistici per la crosta terrestre.",
      "Le velocità sono però costanti, mentre nella Terra vera crescono con la profondità: le onde si incurvano, e le dromocrone reali non sono rette ma curve.",
      "Il terremoto è in superficie e tutto è in due dimensioni. Un terremoto vero ha anche una profondità, che è l'ipocentro: l'epicentro è solo il punto sopra di esso. Con la profondità servono quattro stazioni, e le circonferenze diventano sfere.",
      "I sismogrammi sono disegnati in modo verosimile ma non riproducono le fasi successive né le onde superficiali, che nei terremoti veri sono le più distruttive e le più evidenti sul tracciato.",
      "Gli arrivi di P e di S sono segnati sul grafico. Su un sismogramma vero riconoscerli è la parte difficile del lavoro, e i sismologi non sempre sono d'accordo.",
      "La magnitudo non si calcola: servirebbe l'ampiezza massima e una correzione che dipende dalla distanza."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    if (telaMappa && telaMappa.parentNode.clientWidth > 0) {
      larghezzaM = telaMappa.parentNode.clientWidth;
      altezzaM = larghezzaM;
      telaMappa.width = larghezzaM * dpr; telaMappa.height = altezzaM * dpr;
      telaMappa.style.width = larghezzaM + "px"; telaMappa.style.height = altezzaM + "px";
      ctxMappa = telaMappa.getContext("2d");
      ctxMappa.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctxSismo = [];
    for (var i = 0; i < teleSismo.length; i++) {
      var tela = teleSismo[i];
      if (!tela || tela.parentNode.clientWidth <= 0) continue;
      larghezzaS = tela.parentNode.clientWidth;
      altezzaS = 96;
      tela.width = larghezzaS * dpr; tela.height = altezzaS * dpr;
      tela.style.width = larghezzaS + "px"; tela.style.height = altezzaS + "px";
      var c = tela.getContext("2d");
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxSismo[i] = c;
    }
  }

  function disegnaTutto() {
    if (larghezzaM <= 0 || !ctxSismo[0]) adattaTele();
    if (larghezzaM <= 0) return;
    for (var i = 0; i < 3; i++) disegnaSismogramma(i);
    disegnaDromocrona();
    disegnaMappa();
    aggiornaEsito();
  }

  window.addEventListener("resize", function () {
    adattaTele();
    disegnaTutto();
  });

  /* se la pagina e' stata costruita mentre era nascosta, le misure
     valevano zero: si riprova finche' non ci sono larghezze vere */
  function controlla() {
    if (larghezzaM <= 0) {
      adattaTele();
      if (larghezzaM > 0) disegnaTutto();
    }
    requestAnimationFrame(controlla);
  }

  nuovoTerremoto();
  costruisci();
  disegnaTutto();
  requestAnimationFrame(controlla);

})();
