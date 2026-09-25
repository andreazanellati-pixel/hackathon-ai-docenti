/* ============================================================
   Epidemia e vaccinazione
   ------------------------------------------------------------
   Si sceglie una malattia, si decide quanta gente vaccinare e si
   guarda l'epidemia partire, salire, e spegnersi. Oppure non
   partire affatto.

   Come funziona, in due parole:
   - il modello e' quello classico a tre scomparti: sani che
     possono ammalarsi, malati contagiosi, guariti immuni.
     Si integra passo passo, non c'e' nessuna formula finale
     scritta a mano
   - la popolazione disegnata non e' una decorazione: i pallini
     di ogni colore sono tanti quanti dice il modello in quel
     momento
   - accanto al numero R0 c'e' sempre R effettivo, cioe' quanti
     ne contagia un malato ADESSO, con la gente che e' rimasta
     sana. L'epidemia cresce finche' quello sta sopra 1, e si
     spegne appena scende sotto: e' tutta li' l'immunita' di
     gregge
   - la soglia di gregge non e' una regola imparata a memoria:
     e' 1 meno 1 diviso R0, e il sito la calcola e la mostra
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  var SANI = "#6fa8c9";
  var MALATI = "#c05a4a";
  var GUARITI = "#7aa37f";
  var VACCINATI = "#d9a441";

  /* ---------- stato ---------- */

  var malattie = [], erroriFile = [];
  var malattia = null;
  var vaccinati = 0;          /* percentuale */
  var popolazione = 10000;
  var esperimentoScelto = 0;
  var inMoto = false;

  /* lo stato del modello, in frazioni della popolazione */
  var S = 0, I = 0, Rg = 0, V = 0;
  var giorni = 0;
  var storia = [];
  var piccoRaggiunto = 0, giornoPicco = 0;

  var tela = null, ctx = null, larghezza = 0, altezza = 0;
  var telaG = null, ctxG = null, larghezzaG = 0, altezzaG = 0;
  var letturaReff = null, letturaMalati = null, letturaTotale = null;
  var pastiglieMalattia = [], pastiglieEsp = [];
  var frase = null, schedaSoglia = null, bottoneMoto = null;
  var cursoreVacc = null;

  var pallini = [];

  /* ==========================================================
     1. Gli esperimenti gia' pronti
     ========================================================== */

  var ESPERIMENTI = [
    {
      titolo: "Nessuno vaccinato",
      sottotitolo: "Il morbillo in una popolazione tutta sana",
      malattia: "Morbillo", vaccinati: 0
    },
    {
      titolo: "Appena sotto la soglia",
      sottotitolo: "Vaccinati nove su dieci: sembra tanto, ma non basta",
      malattia: "Morbillo", vaccinati: 90
    },
    {
      titolo: "Appena sopra la soglia",
      sottotitolo: "Ne bastano tre in piu' ogni cento, e l'epidemia non parte",
      malattia: "Morbillo", vaccinati: 95
    },
    {
      titolo: "Un R0 basso",
      sottotitolo: "L'influenza si ferma vaccinando molte meno persone",
      malattia: "Influenza stagionale", vaccinati: 0
    },
    {
      titolo: "Proteggere chi non si puo' vaccinare",
      sottotitolo: "La pertosse, e i neonati troppo piccoli per il vaccino",
      malattia: "Pertosse", vaccinati: 92
    }
  ];

  /* ==========================================================
     2. Leggere il file di contenuto
     ========================================================== */

  function numero(testo) {
    var v = parseFloat(String(testo).trim().replace(",", "."));
    return isNaN(v) ? null : v;
  }

  function leggiMalattie(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (grezza, i) {
      var riga = grezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var p = riga.split("|");
      if (p.length < 3) {
        errori.push("riga " + (i + 1) + ": servono almeno tre parti separate da | .");
        return;
      }
      var r0 = numero(p[1]), gg = numero(p[2]);
      if (r0 === null || gg === null) {
        errori.push("riga " + (i + 1) + ": R0 e i giorni contagiosi devono essere numeri.");
        return;
      }
      if (r0 <= 0 || gg <= 0) {
        errori.push("riga " + (i + 1) + ": R0 e i giorni contagiosi devono essere maggiori di zero.");
        return;
      }
      elenco.push({
        nome: p[0].trim(),
        r0: r0,
        giorni: gg,
        nota: p.length > 3 ? p[3].trim() : ""
      });
    });
    return { elenco: elenco, errori: errori };
  }

  /* ==========================================================
     3. Il modello
     ========================================================== */

  /* quanti ne contagia un malato in un giorno */
  function beta() { return malattia.r0 / malattia.giorni; }
  /* con che ritmo si guarisce */
  function gamma() { return 1 / malattia.giorni; }

  /* La soglia di gregge: la frazione di popolazione che deve
     essere immune perche' l'epidemia non parta. */
  function soglia() {
    return malattia.r0 <= 1 ? 0 : 1 - 1 / malattia.r0;
  }

  /* R effettivo: quanti ne contagia un malato ADESSO, tenuto
     conto di quanta gente e' rimasta contagiabile. */
  function rEffettivo() {
    return malattia.r0 * S;
  }

  function ricomincia() {
    V = vaccinati / 100;
    I = 1 / popolazione;          /* un malato solo, per cominciare */
    S = Math.max(0, 1 - V - I);
    Rg = 0;
    giorni = 0;
    storia = [];
    piccoRaggiunto = 0;
    giornoPicco = 0;
    registra();
    creaPallini();
    aggiorna();
  }

  function registra() {
    storia.push({ g: giorni, s: S, i: I, r: Rg });
    if (storia.length > 4000) storia.shift();
    if (I > piccoRaggiunto) { piccoRaggiunto = I; giornoPicco = giorni; }
  }

  function unGiorno(dt) {
    /* si avanza a passetti piccoli, cosi' il conto e' preciso */
    var sotto = 20;
    for (var k = 0; k < sotto; k++) {
      var h = dt / sotto;
      var nuoviMalati = beta() * S * I * h;
      var nuoviGuariti = gamma() * I * h;
      S -= nuoviMalati;
      I += nuoviMalati - nuoviGuariti;
      Rg += nuoviGuariti;
      if (S < 0) S = 0;
      if (I < 0) I = 0;
    }
    giorni += dt;
    registra();
  }

  function finita() {
    return I * popolazione < 0.5 && giorni > 1;
  }

  /* Quanta gente si ammalera' in tutto, alla fine. Si ricava
     risolvendo per tentativi l'equazione del contagio totale:
     serve a controllare che la simulazione arrivi dove deve. */
  function contagiatiAllaFine() {
    var s0 = Math.max(0, 1 - vaccinati / 100);
    if (malattia.r0 * s0 <= 1) return 0;
    var r = 0.5;
    for (var k = 0; k < 200; k++) {
      r = s0 * (1 - Math.exp(-malattia.r0 * r));
    }
    return r;
  }

  /* ==========================================================
     4. La popolazione disegnata
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function creaPallini() {
    pallini = [];
    var quanti = 260;
    for (var i = 0; i < quanti; i++) pallini.push(0);
  }

  /* Ogni pallino prende un colore in proporzione a quanti ce ne
     sono di quello stato. I vaccinati stanno sempre in fondo,
     cosi' si vede il blocco che non si ammala mai. */
  function coloraPallini() {
    var n = pallini.length;
    var nV = Math.round(V * n);
    var nI = Math.round(I * n);
    var nR = Math.round(Rg * n);
    for (var i = 0; i < n; i++) {
      if (i >= n - nV) pallini[i] = 3;
      else if (i < nI) pallini[i] = 1;
      else if (i < nI + nR) pallini[i] = 2;
      else pallini[i] = 0;
    }
  }

  function disegnaPopolazione() {
    if (!ctx || larghezza <= 0) return;
    var c = ctx;
    c.clearRect(0, 0, larghezza, altezza);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezza, altezza);

    coloraPallini();

    var colonne = Math.ceil(Math.sqrt(pallini.length * larghezza / Math.max(1, altezza - 28)));
    var righe = Math.ceil(pallini.length / colonne);
    var passoX = larghezza / colonne;
    var passoY = (altezza - 30) / righe;
    var raggio = Math.max(2.5, Math.min(passoX, passoY) * 0.32);
    var colori = [SANI, MALATI, GUARITI, VACCINATI];

    for (var i = 0; i < pallini.length; i++) {
      var cx = (i % colonne + 0.5) * passoX;
      var cy = (Math.floor(i / colonne) + 0.5) * passoY + 4;
      c.fillStyle = colori[pallini[i]];
      c.beginPath();
      c.arc(cx, cy, raggio, 0, Math.PI * 2);
      c.fill();
    }

    /* la legenda */
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var etichette = ["sani", "malati", "guariti", "vaccinati"];
    c.font = "10px system-ui, sans-serif";
    c.textAlign = "left";
    var x = 6;
    for (var k = 0; k < 4; k++) {
      c.fillStyle = colori[k];
      c.beginPath(); c.arc(x + 4, altezza - 10, 4, 0, Math.PI * 2); c.fill();
      c.fillStyle = tenue;
      c.fillText(etichette[k], x + 12, altezza - 6);
      x += 14 + c.measureText(etichette[k]).width + 10;
    }
  }

  /* ==========================================================
     5. Il grafico
     ========================================================== */

  function disegnaGrafico() {
    if (!ctxG || larghezzaG <= 0) return;
    var c = ctxG;
    c.clearRect(0, 0, larghezzaG, altezzaG);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaG, altezzaG);

    var bordo = coloreTema("--bordo", "#ddd6c9");
    var tenue = coloreTema("--testo-tenue", "#6b645a");

    var sx = 44, dx = 12, su = 14, giu = 32;
    var w = larghezzaG - sx - dx, h = altezzaG - su - giu;

    var gMax = Math.max(60, Math.ceil(giorni / 30) * 30);

    function X(g) { return sx + w * g / gMax; }
    function Y(v) { return su + h * (1 - v); }

    /* griglia coi numeri */
    c.strokeStyle = bordo; c.lineWidth = 1;
    c.fillStyle = tenue; c.font = "10px system-ui, sans-serif";
    c.textAlign = "right";
    for (var p = 0; p <= 100; p += 25) {
      c.beginPath(); c.moveTo(sx, Y(p / 100)); c.lineTo(sx + w, Y(p / 100)); c.stroke();
      c.fillText(p + "%", sx - 5, Y(p / 100) + 3);
    }
    c.textAlign = "center";
    for (var j = 0; j <= 4; j++) {
      var g = gMax * j / 4;
      c.beginPath(); c.moveTo(X(g), su); c.lineTo(X(g), su + h); c.stroke();
      c.fillText(String(Math.round(g)), X(g), su + h + 14);
    }
    c.fillText("giorni", sx + w / 2, altezzaG - 4);

    /* la soglia di gregge */
    var sog = soglia();
    if (sog > 0) {
      c.strokeStyle = tenue; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(sx, Y(sog)); c.lineTo(sx + w, Y(sog)); c.stroke();
      c.setLineDash([]);
      c.fillStyle = tenue; c.textAlign = "left"; c.font = "9px system-ui, sans-serif";
      c.fillText("soglia di gregge " + Math.round(sog * 100) + "%", sx + 4, Y(sog) - 3);
    }

    /* le tre curve */
    [["s", SANI], ["i", MALATI], ["r", GUARITI]].forEach(function (linea) {
      c.strokeStyle = linea[1]; c.lineWidth = 2.4;
      c.beginPath();
      storia.forEach(function (p, i) {
        if (i === 0) c.moveTo(X(p.g), Y(p[linea[0]])); else c.lineTo(X(p.g), Y(p[linea[0]]));
      });
      c.stroke();
    });

    c.font = "10px system-ui, sans-serif";
    c.textAlign = "left";
    c.fillStyle = tenue;
    c.fillText("azzurro sani · rosso malati · verde guariti", sx, 10);
  }

  /* ==========================================================
     6. Le parole
     ========================================================== */

  function arrotonda(v, cifre) {
    var f = Math.pow(10, cifre);
    return Math.round(v * f) / f;
  }

  function conVirgola(v) { return String(v).replace(".", ","); }

  function quanti(frazione) {
    return Math.round(frazione * popolazione).toLocaleString("it-IT");
  }

  function racconta() {
    var reff = rEffettivo();
    var sog = soglia();

    if (giorni === 0) {
      if (vaccinati / 100 >= sog && sog > 0) {
        return "Hai vaccinato piu' della soglia, e infatti R effettivo di partenza vale " +
          conVirgola(arrotonda(reff, 2)) + ", cioe' meno di 1: ogni malato ne contagia in media meno di " +
          "uno, e il contagio si spegne da solo. Nota bene: non serve vaccinare tutti, e chi non puo' " +
          "farlo - i neonati, chi e' in cura per un tumore - viene protetto lo stesso. E' questo che " +
          "si chiama immunita' di gregge. Premi «Fai partire».";
      }
      return "Si comincia con un malato solo. R effettivo vale " + conVirgola(arrotonda(reff, 2)) +
        ": sopra 1, quindi l'epidemia partira'. Premi «Fai partire» e guarda che succede.";
    }

    if (finita()) {
      var colpiti = Rg;
      if (colpiti * popolazione < popolazione * 0.01) {
        return "Finita quasi subito: si sono ammalate " + quanti(colpiti) + " persone su " +
          popolazione.toLocaleString("it-IT") + ". Con cosi' tanti immuni il malato di partenza non ha " +
          "trovato abbastanza gente da contagiare, e la catena si e' interrotta.";
      }
      return "L'epidemia e' finita. Si sono ammalate in tutto " + quanti(colpiti) + " persone su " +
        popolazione.toLocaleString("it-IT") + ", cioe' il " + Math.round(colpiti * 100) + "%. " +
        "Il giorno peggiore e' stato il " + Math.round(giornoPicco) + ", con " + quanti(piccoRaggiunto) +
        " malati tutti insieme. Attenzione a una cosa: si e' fermata da sola, ma non perche' non ci " +
        "fosse piu' nessuno da contagiare. Sono rimasti " + quanti(S) + " sani mai ammalati: si e' " +
        "fermata perche' gli immuni erano diventati tanti da far scendere R effettivo sotto 1.";
    }

    if (reff < 1) {
      return "R effettivo e' sceso a " + conVirgola(arrotonda(reff, 2)) + ", sotto 1: da adesso ogni " +
        "malato ne contagia meno di uno e i casi calano. Il picco e' passato. Fai attenzione pero': " +
        "i malati ancora in giro sono " + quanti(I) + ", e continueranno a contagiare ancora per un po'.";
    }

    return "Siamo in piena crescita: R effettivo vale " + conVirgola(arrotonda(reff, 2)) + ", sopra 1, " +
      "quindi ogni malato ne contagia piu' di uno e i casi raddoppiano di continuo. Adesso ci sono " +
      quanti(I) + " malati. R effettivo scendera' sotto 1 quando gli immuni arriveranno al " +
      Math.round(soglia() * 100) + "%, cioe' alla soglia di gregge.";
  }

  /* ==========================================================
     7. I comandi
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

  function applicaEsperimento(x) {
    var m = malattie.filter(function (y) { return y.nome === x.malattia; })[0];
    if (m) malattia = m;
    vaccinati = x.vaccinati;
    if (cursoreVacc) cursoreVacc.aggiorna(vaccinati);
    inMoto = false;
    ricomincia();
  }

  function aggiorna() {
    letturaReff.textContent = conVirgola(arrotonda(rEffettivo(), 2));
    letturaMalati.textContent = quanti(I);
    letturaTotale.textContent = quanti(Rg);

    pastiglieMalattia.forEach(function (b) {
      b.className = "pillola" + (b.dato === malattia ? " attiva" : "");
    });
    pastiglieEsp.forEach(function (b, i) {
      b.className = "carta-esperimento" + (esperimentoScelto === i ? " scelta" : "");
    });

    bottoneMoto.textContent = inMoto ? "Metti in pausa" : (giorni > 0 ? "Riprendi" : "Fai partire");

    frase.textContent = racconta();

    var sog = soglia();
    schedaSoglia.textContent = malattia.nome + ", R0 = " + conVirgola(malattia.r0) + ", contagiosi per " +
      conVirgola(malattia.giorni) + " giorni. " +
      (sog > 0
        ? "La soglia di gregge vale 1 meno 1 diviso " + conVirgola(malattia.r0) + ", cioe' il " +
          Math.round(sog * 100) + "%: sotto quella percentuale di immuni l'epidemia parte, sopra no. " +
          "Se non si vaccina nessuno, alla fine si ammalera' circa il " +
          Math.round(contagiatiAllaFine() * 100) + "% della popolazione."
        : "Con R0 minore o uguale a 1 l'epidemia non si propaga da sola: non serve nessuna soglia.") +
      (malattia.nota ? " " + malattia.nota.charAt(0).toUpperCase() + malattia.nota.slice(1) + "." : "");

    if (larghezza <= 0 && tela && tela.parentNode.clientWidth > 0) adattaTele();
    disegnaPopolazione();
    disegnaGrafico();
  }

  var ultimo = 0, daAggiornare = 0;
  function battito(ora) {
    var dt = ultimo ? Math.min(0.1, (ora - ultimo) / 1000) : 0;
    ultimo = ora;
    if (inMoto && malattia) {
      unGiorno(dt * 12);       /* dodici giorni simulati ogni secondo */
      if (finita() || giorni > 720) { inMoto = false; aggiorna(); }
      else {
        disegnaPopolazione();
        daAggiornare += dt;
        if (daAggiornare > 0.2) { daAggiornare = 0; aggiorna(); }
      }
    }
    requestAnimationFrame(battito);
  }

  /* ==========================================================
     8. Costruire la pagina
     ========================================================== */

  function costruisci() {
    svuota(contenitore);
    pastiglieMalattia = []; pastiglieEsp = [];

    var avvisoErrori = App.avvisoErroriFile("malattie.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Un'epidemia non si ferma quando finiscono le persone da contagiare: si ferma molto prima, " +
      "appena gli immuni diventano tanti da far si' che ogni malato ne contagi in media meno di uno. " +
      "Da questa frase sola discende tutto il resto, vaccinazioni comprese."));

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

    /* --- la popolazione --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La popolazione"));
    var scatola = elemento("div", "scatola-particelle");
    tela = elemento("canvas", "tela");
    scatola.appendChild(tela);
    contenitore.appendChild(scatola);
    contenitore.appendChild(elemento("p", "didascalia",
      "Ogni pallino sta per un gruppo di persone, e i pallini di ogni colore sono sempre tanti quanti " +
      "ne dice il modello in quel momento."));

    var letture = elemento("div", "letture");
    letture.appendChild(unaLettura("R effettivo, adesso", function (n) { letturaReff = n; }));
    letture.appendChild(unaLettura("malati adesso", function (n) { letturaMalati = n; }));
    letture.appendChild(unaLettura("gia' passati dalla malattia", function (n) { letturaTotale = n; }));
    contenitore.appendChild(letture);

    var bottoni = elemento("div", "bottoni");
    bottoneMoto = elemento("button", "bottone", "Fai partire");
    bottoneMoto.type = "button";
    bottoneMoto.addEventListener("click", function () { inMoto = !inMoto; aggiorna(); });
    bottoni.appendChild(bottoneMoto);
    var azzera = elemento("button", "bottone-testo", "Ricomincia");
    azzera.type = "button";
    azzera.addEventListener("click", function () { inMoto = false; ricomincia(); });
    bottoni.appendChild(azzera);
    contenitore.appendChild(bottoni);

    var riquadro = elemento("div", "riquadro-fase");
    frase = elemento("p", "spiegazione-fase", "");
    riquadro.appendChild(frase);
    contenitore.appendChild(riquadro);

    /* --- il grafico --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Come vanno le cose nel tempo"));
    var scatolaG = elemento("div", "scatola-grafico");
    telaG = elemento("canvas", "tela");
    scatolaG.appendChild(telaG);
    contenitore.appendChild(scatolaG);

    /* --- le manopole --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quanta gente vaccinare"));
    var comandi = elemento("div", "comandi");
    cursoreVacc = cursore("Vaccinati prima che arrivi la malattia", 0, 100, 1, vaccinati, "%", function (v) {
      vaccinati = v;
      esperimentoScelto = -1;
      inMoto = false;
      ricomincia();
    });
    comandi.appendChild(cursoreVacc);
    contenitore.appendChild(comandi);

    /* --- quale malattia --- */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "Quale malattia"));
    var scelte = elemento("div", "scelte-grandezza");
    malattie.forEach(function (m) {
      var b = elemento("button", "pillola", m.nome);
      b.type = "button"; b.dato = m;
      b.addEventListener("click", function () {
        malattia = m;
        esperimentoScelto = -1;
        inMoto = false;
        ricomincia();
      });
      pastiglieMalattia.push(b);
      scelte.appendChild(b);
    });
    contenitore.appendChild(scelte);

    schedaSoglia = elemento("p", "nota-piccola", "");
    contenitore.appendChild(schedaSoglia);

    /* --- i limiti --- */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Si suppone che tutti incontrino tutti allo stesso modo. Nella realta' non e' cosi': si incontrano soprattutto i familiari, i compagni di classe, i colleghi. Con i contatti raggruppati l'epidemia viaggia diversa, e possono restare sacche di persone non raggiunte anche quando la media direbbe di no.",
      "Chi guarisce resta immune per sempre. Per il morbillo e' quasi vero, per l'influenza e per il raffreddore no: li' ci si riammala, e il modello a tre scomparti non basta piu'.",
      "Il vaccino e' considerato efficace al cento per cento. I vaccini veri proteggono molto ma non tutti: per questo la soglia da raggiungere, nella pratica, e' piu' alta di quella calcolata qui.",
      "R0 e' un numero fisso. Nella realta' cambia con le stagioni, con quanta gente si incontra, con le mascherine, con le scuole aperte o chiuse. Era esattamente il senso delle chiusure: abbassare R0 senza aspettare i vaccini.",
      "Nessuno nasce e nessuno muore durante l'epidemia, e non c'e' nessuno che arriva da fuori. Su poche settimane va bene, su anni no.",
      "Il modello non dice quanta gente sta male davvero o rischia la vita: dice solo quanti si contagiano. Sono due cose diverse, e l'Ebola ne e' l'esempio: R0 basso, ma pericolosissima."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
    ricomincia();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    larghezza = tela.parentNode.clientWidth;
    altezza = Math.round(Math.min(260, Math.max(180, larghezza * 0.42)));
    tela.width = larghezza * dpr; tela.height = altezza * dpr;
    tela.style.width = larghezza + "px"; tela.style.height = altezza + "px";
    ctx = tela.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    larghezzaG = telaG.parentNode.clientWidth;
    altezzaG = Math.round(Math.min(280, Math.max(200, larghezzaG * 0.52)));
    telaG.width = larghezzaG * dpr; telaG.height = altezzaG * dpr;
    telaG.style.width = larghezzaG + "px"; telaG.style.height = altezzaG + "px";
    ctxG = telaG.getContext("2d");
    ctxG.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  window.addEventListener("resize", function () {
    if (!tela) return;
    adattaTele();
    disegnaPopolazione(); disegnaGrafico();
  });

  /* ==========================================================
     9. Avvio
     ========================================================== */

  App.caricaTesto("malattie.txt")
    .then(function (testo) {
      var esito = leggiMalattie(testo);
      malattie = esito.elenco;
      erroriFile = esito.errori;

      if (!malattie.length) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(document.createTextNode(
          "Il file malattie.txt e' stato letto ma non contiene malattie valide."));
        contenitore.appendChild(avviso);
        return;
      }

      malattia = malattie[0];
      costruisci();
      applicaEsperimento(ESPERIMENTI[0]);
      requestAnimationFrame(battito);
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("malattie.txt", errore.message));
    });

})();
