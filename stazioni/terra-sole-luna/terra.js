/* ============================================================
   Terra, Sole e Luna
   ------------------------------------------------------------
   Si sceglie l'inclinazione dell'asse terrestre, la latitudine e
   il giorno dell'anno, e si guardano la durata del dì e l'altezza
   del Sole a mezzogiorno.

   Il punto della stazione: portare l'inclinazione a zero e vedere
   le stagioni sparire. Non è la distanza dal Sole a farle: è
   l'asse inclinato.

   La matematica è quella standard dell'astronomia di posizione:
     declinazione   d = arcsen( sen(e) * sen(L) )
                    con L longitudine eclittica del Sole
     angolo orario  cos(H) = -tan(lat) * tan(d)
     durata del dì = 2H/15 ore
     altezza a mezzogiorno = 90 - |lat - d|
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  /* ---------- stato ---------- */

  var inclinazione = 23.44;   /* gradi */
  var latitudine = 45.5;      /* gradi, positiva a nord */
  var giorno = 172;           /* giorno dell'anno, 1-365 */
  var inMoto = false;

  var luoghi = [];
  var erroriFile = [];

  var telaOrbita = null, ctxOrbita = null, larghezzaO = 0, altezzaO = 0;
  var telaGlobo = null, ctxGlobo = null, larghezzaG = 0, altezzaG = 0;
  var telaGrafico = null, ctxGrafico = null, larghezzaC = 0, altezzaC = 0;
  var ultimoIstante = 0;
  var cursoreGiorno = null, cursoreLatitudine = null;

  var GRADI = Math.PI / 180;

  /* ==========================================================
     1. I luoghi
     ========================================================== */

  function leggiLuoghi(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (rigaGrezza, i) {
      var riga = rigaGrezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var pezzi = riga.split("|");
      if (pezzi.length < 2) {
        errori.push("riga " + (i + 1) + ": manca la barra verticale fra nome e latitudine.");
        return;
      }
      var lat = parseFloat(pezzi[1].trim().replace(",", "."));
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errori.push("riga " + (i + 1) + ": \"" + pezzi[1].trim() + "\" non è una latitudine fra -90 e 90.");
        return;
      }
      elenco.push({ nome: pezzi[0].trim(), lat: lat });
    });
    return { luoghi: elenco, errori: errori };
  }

  /* ==========================================================
     2. L'astronomia
     ========================================================== */

  /* La declinazione del Sole: di quanti gradi sopra o sotto
     l'equatore celeste si trova, nel giorno scelto. Dipende
     dall'inclinazione dell'asse: se l'asse fosse dritto, sarebbe
     sempre zero, e non ci sarebbero stagioni. */
  function declinazione(g) {
    /* longitudine del Sole sull'eclittica, contata dall'equinozio
       di primavera che cade intorno al 20 marzo, cioè il giorno 80 */
    var longitudine = 360 / 365.24 * (g - 80);
    return Math.asin(Math.sin(inclinazione * GRADI) * Math.sin(longitudine * GRADI)) / GRADI;
  }

  /* Durata del dì in ore. Restituisce 24 quando il Sole non
     tramonta mai e 0 quando non sorge mai. */
  function durataDelDi(g) {
    var d = declinazione(g);
    var coseno = -Math.tan(latitudine * GRADI) * Math.tan(d * GRADI);
    if (coseno <= -1) return 24;
    if (coseno >= 1) return 0;
    return 2 * Math.acos(coseno) / GRADI / 15;
  }

  /* Altezza del Sole sull'orizzonte a mezzogiorno, in gradi.
     Negativa quando a mezzogiorno il Sole resta sotto l'orizzonte. */
  function altezzaMezzogiorno(g) {
    return 90 - Math.abs(latitudine - declinazione(g));
  }

  function nomeStagione(g) {
    /* stagioni astronomiche dell'emisfero in cui ci si trova */
    var nord = latitudine >= 0;
    var s;
    if (g < 80) s = nord ? "inverno" : "estate";
    else if (g < 172) s = nord ? "primavera" : "autunno";
    else if (g < 266) s = nord ? "estate" : "inverno";
    else if (g < 355) s = nord ? "autunno" : "primavera";
    else s = nord ? "inverno" : "estate";
    return s;
  }

  var MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
              "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  var GIORNI_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function dataDelGiorno(g) {
    var resto = Math.max(1, Math.min(365, Math.round(g)));
    for (var m = 0; m < 12; m++) {
      if (resto <= GIORNI_MESE[m]) return resto + " " + MESI[m];
      resto -= GIORNI_MESE[m];
    }
    return "31 dicembre";
  }

  function oreMinuti(ore) {
    var o = Math.floor(ore);
    var m = Math.round((ore - o) * 60);
    if (m === 60) { o++; m = 0; }
    return o + " h " + (m < 10 ? "0" + m : m) + " min";
  }

  /* ==========================================================
     3. Disegno: l'orbita vista dall'alto
     ========================================================== */

  function coloreTema(nome, ripiego) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    return v || ripiego;
  }

  function disegnaOrbita() {
    var c = ctxOrbita;
    c.clearRect(0, 0, larghezzaO, altezzaO);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaO, altezzaO);

    var cx = larghezzaO / 2, cy = altezzaO / 2;
    var raggioX = larghezzaO * 0.36, raggioY = altezzaO * 0.34;
    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var bordo = coloreTema("--bordo-forte", "#c4bbaa");

    /* l'orbita */
    c.strokeStyle = bordo;
    c.lineWidth = 1;
    c.setLineDash([3, 4]);
    c.beginPath();
    c.ellipse(cx, cy, raggioX, raggioY, 0, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);

    /* il Sole */
    c.fillStyle = "#e0a02a";
    c.beginPath();
    c.arc(cx, cy, 14, 0, Math.PI * 2);
    c.fill();

    /* le quattro tappe dell'anno */
    c.font = "10px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillStyle = tenue;
    c.textAlign = "center";
    [[80, "equinozio\ndi primavera"], [172, "solstizio\nd'estate"],
     [266, "equinozio\nd'autunno"], [355, "solstizio\nd'inverno"]].forEach(function (t) {
      var p = posizioneOrbita(t[0], cx, cy, raggioX, raggioY);
      c.fillStyle = bordo;
      c.beginPath(); c.arc(p.x, p.y, 2.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = tenue;
      var righe = t[1].split("\n");
      var fuoriX = cx + (p.x - cx) * 1.30;
      var fuoriY = cy + (p.y - cy) * 1.34;
      righe.forEach(function (r, i) { c.fillText(r, fuoriX, fuoriY + i * 11); });
    });

    /* la Terra, con il suo asse */
    var pos = posizioneOrbita(giorno, cx, cy, raggioX, raggioY);
    var raggioTerra = 11;

    /* met√† illuminata: quella rivolta al Sole */
    var versoSole = Math.atan2(cy - pos.y, cx - pos.x);
    c.save();
    c.translate(pos.x, pos.y);
    c.fillStyle = "#2b3a4a";
    c.beginPath(); c.arc(0, 0, raggioTerra, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#4a90c2";
    c.beginPath();
    c.arc(0, 0, raggioTerra, versoSole - Math.PI / 2, versoSole + Math.PI / 2);
    c.fill();
    c.restore();

    /* l'asse: punta sempre nella stessa direzione nello spazio.
       È questo che fa le stagioni. */
    c.save();
    c.translate(pos.x, pos.y);
    c.strokeStyle = coloreTema("--accento", "#1f5f8b");
    c.lineWidth = 2;
    var pendenza = inclinazione * GRADI;
    var lunghezza = raggioTerra + 8;
    c.beginPath();
    c.moveTo(-Math.sin(pendenza) * lunghezza, -Math.cos(pendenza) * lunghezza);
    c.lineTo(Math.sin(pendenza) * lunghezza, Math.cos(pendenza) * lunghezza);
    c.stroke();
    c.restore();
  }

  /* il giorno 355, solstizio d'inverno boreale, lo mettiamo a sinistra */
  function posizioneOrbita(g, cx, cy, rx, ry) {
    var angolo = (g - 355) / 365.24 * Math.PI * 2 + Math.PI;
    return { x: cx + Math.cos(angolo) * rx, y: cy + Math.sin(angolo) * ry };
  }

  /* ==========================================================
     4. Disegno: il globo con il parallelo illuminato
     ========================================================== */

  function disegnaGlobo() {
    var c = ctxGlobo;
    c.clearRect(0, 0, larghezzaG, altezzaG);
    c.fillStyle = coloreTema("--superficie-alt", "#faf8f4");
    c.fillRect(0, 0, larghezzaG, altezzaG);

    var cx = larghezzaG * 0.52, cy = altezzaG / 2;
    var raggio = Math.min(larghezzaG, altezzaG) * 0.34;
    var d = declinazione(giorno);
    var tenue = coloreTema("--testo-tenue", "#6b645a");

    /* i raggi del Sole arrivano da sinistra, orizzontali */
    c.strokeStyle = "#e0a02a";
    c.lineWidth = 1.5;
    for (var i = -3; i <= 3; i++) {
      var y = cy + i * raggio * 0.36;
      c.beginPath();
      c.moveTo(6, y);
      c.lineTo(cx - raggio - 10, y);
      c.stroke();
    }
    c.fillStyle = "#e0a02a";
    c.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.textAlign = "left";
    c.fillText("Sole", 6, cy - raggio * 1.25);

    c.save();
    c.translate(cx, cy);

    /* la Terra inclinata: l'asse ruotato della declinazione, così
       si vede quale emisfero è esposto al Sole */
    c.rotate(-d * GRADI);

    /* notte a destra, dì a sinistra (il Sole sta a sinistra) */
    c.save();
    c.rotate(d * GRADI);
    c.fillStyle = "#2b3a4a";
    c.beginPath(); c.arc(0, 0, raggio, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#4a90c2";
    c.beginPath(); c.arc(0, 0, raggio, Math.PI / 2, Math.PI * 1.5); c.fill();
    c.restore();

    /* l'asse di rotazione */
    c.strokeStyle = coloreTema("--accento", "#1f5f8b");
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -raggio - 12); c.lineTo(0, raggio + 12);
    c.stroke();

    /* l'equatore */
    c.strokeStyle = "rgba(255,255,255,.5)";
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(0, 0, raggio, raggio * 0.16, 0, 0, Math.PI * 2);
    c.stroke();

    /* il parallelo scelto */
    var y = -Math.sin(latitudine * GRADI) * raggio;
    var rParallelo = Math.cos(latitudine * GRADI) * raggio;
    c.strokeStyle = "#f0d060";
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(0, y, rParallelo, rParallelo * 0.16, 0, 0, Math.PI * 2);
    c.stroke();

    c.restore();

    /* il pallino dell'osservatore, sul parallelo */
    c.save();
    c.translate(cx, cy);
    c.rotate(-d * GRADI);
    c.fillStyle = "#f0d060";
    c.beginPath();
    c.arc(-Math.cos(latitudine * GRADI) * raggio * 0.72,
          -Math.sin(latitudine * GRADI) * raggio, 3.5, 0, Math.PI * 2);
    c.fill();
    c.restore();

    /* etichetta */
    c.fillStyle = tenue;
    c.textAlign = "center";
    c.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";
    c.fillText("la parte gialla del parallelo è la porzione illuminata",
      larghezzaG / 2, altezzaG - 8);
  }

  /* ==========================================================
     5. Disegno: la durata del dì lungo l'anno
     ========================================================== */

  function disegnaGrafico() {
    var c = ctxGrafico;
    c.clearRect(0, 0, larghezzaC, altezzaC);

    var margineS = 40, margineD = 12, margineA = 12, margineB = 34;
    var w = larghezzaC - margineS - margineD;
    var h = altezzaC - margineA - margineB;

    var tenue = coloreTema("--testo-tenue", "#6b645a");
    var bordo = coloreTema("--bordo", "#ddd6c9");
    var accento = coloreTema("--accento", "#1f5f8b");

    function px(g) { return margineS + (g - 1) / 364 * w; }
    function py(ore) { return margineA + h - ore / 24 * h; }

    c.font = "11px system-ui, -apple-system, 'Segoe UI', sans-serif";

    /* la riga delle 12 ore: quella da cui ci si scosta */
    c.strokeStyle = bordo;
    c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(margineS, py(12)); c.lineTo(margineS + w, py(12)); c.stroke();
    c.setLineDash([]);

    /* assi */
    c.strokeStyle = tenue;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(margineS, margineA); c.lineTo(margineS, margineA + h); c.lineTo(margineS + w, margineA + h);
    c.stroke();

    c.fillStyle = tenue;
    c.textAlign = "right";
    [0, 6, 12, 18, 24].forEach(function (o) {
      c.fillText(o + "h", margineS - 5, py(o) + 4);
    });
    c.textAlign = "center";
    [[1, "gen"], [91, "apr"], [182, "lug"], [274, "ott"]].forEach(function (t) {
      c.fillText(t[1], px(t[0]), margineA + h + 15);
    });
    c.fillText("giorno dell'anno", margineS + w / 2, altezzaC - 6);

    /* la curva della durata del dì */
    c.strokeStyle = accento;
    c.lineWidth = 2.5;
    c.beginPath();
    for (var g = 1; g <= 365; g += 2) {
      var x = px(g), y = py(durataDelDi(g));
      if (g === 1) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();

    /* il giorno scelto */
    c.strokeStyle = bordo;
    c.beginPath();
    c.moveTo(px(giorno), margineA); c.lineTo(px(giorno), margineA + h);
    c.stroke();
    c.fillStyle = accento;
    c.beginPath();
    c.arc(px(giorno), py(durataDelDi(giorno)), 4.5, 0, Math.PI * 2);
    c.fill();
  }

  /* ==========================================================
     6. Letture e testi
     ========================================================== */

  function aggiornaLetture() {
    var ore = durataDelDi(giorno);
    var altezza = altezzaMezzogiorno(giorno);
    var d = declinazione(giorno);

    scrivi("lettura-data", dataDelGiorno(giorno));
    scrivi("lettura-durata", ore >= 23.99 ? "24 h" : (ore <= 0.01 ? "0 h" : oreMinuti(ore)));
    scrivi("lettura-altezza", (altezza > 0 ? Math.round(altezza) : 0) + "°");
    scrivi("lettura-declinazione", (d >= 0 ? "+" : "") + d.toFixed(1).replace(".", ",") + "°");
    scrivi("lettura-stagione", nomeStagione(giorno));
    scrivi("lettura-latitudine", latitudine.toFixed(1).replace(".", ",") + "°");

    var spiega = document.getElementById("spiegazione-fase");
    var riquadro = document.getElementById("riquadro-fase");
    if (!spiega) return;

    if (inclinazione < 0.5) {
      spiega.textContent = "Con l'asse dritto il Sole resta sempre sull'equatore: dodici ore di luce e dodici di buio, " +
        "ogni giorno dell'anno e a ogni latitudine. Le stagioni spariscono. Guarda il grafico: è una linea piatta.";
      if (riquadro) riquadro.classList.add("in-passaggio");
      return;
    }
    if (riquadro) riquadro.classList.remove("in-passaggio");

    if (ore >= 23.99) {
      spiega.textContent = "Qui il Sole non tramonta: è il sole di mezzanotte. Succede oltre il circolo polare, " +
        "quando quell'emisfero è inclinato verso il Sole.";
    } else if (ore <= 0.01) {
      spiega.textContent = "Qui il Sole non sorge affatto: è la notte polare. Lo stesso fenomeno del sole di mezzanotte, " +
        "sei mesi dopo.";
    } else if (Math.abs(d) < 0.6) {
      spiega.textContent = "Siamo a un equinozio: il Sole è sopra l'equatore, e in tutto il mondo il dì dura dodici ore. " +
        "È l'unico momento in cui la latitudine non conta.";
    } else {
      var emisferoEsposto = d > 0 ? "nord" : "sud";
      var qui = latitudine >= 0 ? "nord" : "sud";
      spiega.textContent = "L'emisfero " + emisferoEsposto + " è inclinato verso il Sole, quindi lì il dì è più lungo della notte" +
        (emisferoEsposto === qui ? ": è il tuo caso." : ", mentre dove ti trovi accade il contrario.") +
        " Nota che la Terra non è più vicina al Sole: è solo girata diversamente.";
    }
  }

  function scrivi(id, testo) {
    var e = document.getElementById(id);
    if (e && e.textContent !== testo) e.textContent = testo;
  }

  /* ==========================================================
     7. La pagina
     ========================================================== */

  function cursore(etichetta, min, max, passo, valore, unita, formatta, quandoCambia) {
    var riga = elemento("div", "cursore");
    var testa = elemento("div", "cursore-testa");
    testa.appendChild(elemento("span", "cursore-nome", etichetta));
    var lettura = elemento("span", "cursore-valore", formatta(valore) + unita);
    testa.appendChild(lettura);
    riga.appendChild(testa);

    var input = elemento("input");
    input.type = "range";
    input.min = String(min); input.max = String(max); input.step = String(passo);
    input.value = String(valore);
    input.setAttribute("aria-label", etichetta);
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      lettura.textContent = formatta(v) + unita;
      quandoCambia(v);
    });
    riga.appendChild(input);
    riga.aggiorna = function (v) {
      input.value = String(v);
      lettura.textContent = formatta(v) + unita;
    };
    return riga;
  }

  function lettura(id, etichetta) {
    var box = elemento("div", "lettura");
    var v = elemento("div", "lettura-valore", "—");
    v.id = id;
    box.appendChild(v);
    box.appendChild(elemento("div", "lettura-nome", etichetta));
    return box;
  }

  function tutto() {
    disegnaOrbita();
    disegnaGlobo();
    disegnaGrafico();
    aggiornaLetture();
  }

  function costruisci() {
    svuota(contenitore);

    var avvisoErrori = App.avvisoErroriFile("luoghi.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Sposta il giorno dell'anno e guarda la durata del dì. Poi prova la cosa che conta: " +
      "porta l'inclinazione dell'asse a zero gradi."));

    /* le due viste */
    var scatolaO = elemento("div", "scatola-particelle");
    telaOrbita = document.createElement("canvas");
    telaOrbita.className = "tela";
    telaOrbita.setAttribute("role", "img");
    telaOrbita.setAttribute("aria-label", "L'orbita della Terra intorno al Sole vista dall'alto");
    scatolaO.appendChild(telaOrbita);
    contenitore.appendChild(scatolaO);

    var scatolaG = elemento("div", "scatola-particelle");
    telaGlobo = document.createElement("canvas");
    telaGlobo.className = "tela";
    telaGlobo.setAttribute("role", "img");
    telaGlobo.setAttribute("aria-label", "La Terra illuminata dal Sole, con il parallelo scelto");
    scatolaG.appendChild(telaGlobo);
    contenitore.appendChild(scatolaG);

    /* le letture */
    var letture = elemento("div", "letture");
    letture.appendChild(lettura("lettura-data", "giorno"));
    letture.appendChild(lettura("lettura-durata", "durata del dì"));
    letture.appendChild(lettura("lettura-altezza", "Sole a mezzogiorno"));
    letture.appendChild(lettura("lettura-declinazione", "declinazione del Sole"));
    letture.appendChild(lettura("lettura-latitudine", "latitudine"));
    letture.appendChild(lettura("lettura-stagione", "stagione"));
    contenitore.appendChild(letture);

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
    moto.textContent = inMoto ? "⏸  Ferma l'anno" : "▶  Scorri l'anno";
    moto.addEventListener("click", function () {
      inMoto = !inMoto;
      moto.textContent = inMoto ? "⏸  Ferma l'anno" : "▶  Scorri l'anno";
    });
    riga.appendChild(moto);
    comandi.appendChild(riga);

    cursoreGiorno = cursore("Giorno dell'anno", 1, 365, 1, giorno, "",
      function (v) { return dataDelGiorno(v); },
      function (v) { giorno = v; tutto(); });
    comandi.appendChild(cursoreGiorno);

    var presetGiorni = elemento("div", "preset");
    presetGiorni.appendChild(elemento("span", "esempi-etichetta", "vai a:"));
    [["equinozio di primavera", 80], ["solstizio d'estate", 172],
     ["equinozio d'autunno", 266], ["solstizio d'inverno", 355]].forEach(function (p) {
      var b = elemento("button", "bottone-esempio", p[0]);
      b.type = "button";
      b.addEventListener("click", function () {
        giorno = p[1];
        cursoreGiorno.aggiorna(p[1]);
        tutto();
      });
      presetGiorni.appendChild(b);
    });
    comandi.appendChild(presetGiorni);

    cursoreLatitudine = cursore("Latitudine", -90, 90, 0.5, latitudine, "°",
      function (v) { return String(v).replace(".", ","); },
      function (v) { latitudine = v; tutto(); });
    comandi.appendChild(cursoreLatitudine);

    if (luoghi.length > 0) {
      var presetLuoghi = elemento("div", "preset");
      presetLuoghi.appendChild(elemento("span", "esempi-etichetta", "vai a:"));
      luoghi.forEach(function (l) {
        var b = elemento("button", "bottone-esempio", l.nome);
        b.type = "button";
        b.addEventListener("click", function () {
          latitudine = l.lat;
          cursoreLatitudine.aggiorna(l.lat);
          tutto();
        });
        presetLuoghi.appendChild(b);
      });
      comandi.appendChild(presetLuoghi);
    }

    var cursoreAsse = cursore("Inclinazione dell'asse", 0, 45, 0.5, inclinazione, "°",
      function (v) { return String(v).replace(".", ","); },
      function (v) { inclinazione = v; tutto(); });
    comandi.appendChild(cursoreAsse);

    var presetAsse = elemento("div", "preset");
    presetAsse.appendChild(elemento("span", "esempi-etichetta", "prova con:"));
    [["asse dritto: 0°", 0], ["la Terra vera: 23,44°", 23.44], ["molto inclinato: 40°", 40]].forEach(function (p) {
      var b = elemento("button", "bottone-esempio", p[0]);
      b.type = "button";
      b.addEventListener("click", function () {
        inclinazione = p[1];
        cursoreAsse.aggiorna(p[1]);
        tutto();
      });
      presetAsse.appendChild(b);
    });
    comandi.appendChild(presetAsse);
    contenitore.appendChild(comandi);

    /* il grafico */
    contenitore.appendChild(elemento("h3", "titolo-blocco", "La durata del dì lungo l'anno"));
    contenitore.appendChild(elemento("p", "didascalia",
      "Per la latitudine scelta. La riga tratteggiata segna le dodici ore: " +
      "quanto la curva se ne scosta, tanto sono marcate le stagioni."));
    var scatolaC = elemento("div", "scatola-grafico");
    telaGrafico = document.createElement("canvas");
    telaGrafico.className = "tela";
    telaGrafico.setAttribute("role", "img");
    telaGrafico.setAttribute("aria-label", "La durata del dì lungo l'anno alla latitudine scelta");
    scatolaC.appendChild(telaGrafico);
    contenitore.appendChild(scatolaC);

    /* i limiti */
    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "La durata del dì e l'altezza del Sole sono calcolate con le formule vere dell'astronomia di posizione. Quella parte è corretta.",
      "L'orbita è disegnata come un cerchio, mentre in realtà è un'ellisse. La differenza è minima - la Terra è più vicina al Sole a gennaio, non a luglio - e proprio per questo il disegno non la mostra: sarebbe la scorciatoia sbagliata da suggerire.",
      "Non si tiene conto della rifrazione atmosferica né della dimensione del disco solare, che allungano il dì di qualche minuto: all'alba il Sole si vede già quando è ancora sotto l'orizzonte.",
      "L'anno è di 365 giorni tondi e gli equinozi cadono sempre allo stesso giorno. In realtà scivolano di qualche ora ogni anno, ed è per questo che esistono gli anni bisestili.",
      "Le stagioni indicate sono quelle astronomiche, che cominciano agli equinozi e ai solstizi, non quelle meteorologiche."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);

    adattaTele();
  }

  function adattaTele() {
    var dpr = window.devicePixelRatio || 1;

    function prepara(tela, altezzaVoluta) {
      var l = tela.parentNode.clientWidth;
      var a = Math.round(altezzaVoluta(l));
      tela.width = l * dpr; tela.height = a * dpr;
      tela.style.width = l + "px"; tela.style.height = a + "px";
      var c = tela.getContext("2d");
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { c: c, l: l, a: a };
    }

    var o = prepara(telaOrbita, function (l) { return Math.min(300, Math.max(210, l * 0.52)); });
    ctxOrbita = o.c; larghezzaO = o.l; altezzaO = o.a;

    var g = prepara(telaGlobo, function (l) { return Math.min(260, Math.max(190, l * 0.45)); });
    ctxGlobo = g.c; larghezzaG = g.l; altezzaG = g.a;

    var c = prepara(telaGrafico, function (l) { return Math.min(250, Math.max(175, l * 0.42)); });
    ctxGrafico = c.c; larghezzaC = c.l; altezzaC = c.a;
  }

  window.addEventListener("resize", function () {
    if (!telaOrbita) return;
    adattaTele();
    tutto();
  });

  /* ==========================================================
     8. Il ciclo dell'animazione
     ========================================================== */

  function passo(istante) {
    if (!ultimoIstante) ultimoIstante = istante;
    var dt = Math.min(0.05, (istante - ultimoIstante) / 1000);
    ultimoIstante = istante;

    /* se la pagina era nascosta quando è stata costruita, le misure
       erano zero: appena si può, si rifanno */
    if (larghezzaO <= 0 && telaOrbita && telaOrbita.parentNode.clientWidth > 0) {
      adattaTele();
      tutto();
    }

    if (inMoto) {
      giorno += dt * 30;              /* circa dodici secondi per un anno */
      if (giorno > 365) giorno -= 365;
      if (cursoreGiorno) cursoreGiorno.aggiorna(Math.round(giorno));
      tutto();
    }
    requestAnimationFrame(passo);
  }

  /* ==========================================================
     9. Avvio
     ========================================================== */

  App.caricaTesto("luoghi.txt")
    .then(function (testo) {
      var esito = leggiLuoghi(testo);
      luoghi = esito.luoghi;
      erroriFile = esito.errori;
    })
    .catch(function () {
      /* senza il file dei luoghi la stazione funziona lo stesso:
         restano il cursore della latitudine e tutto il resto */
      luoghi = [];
    })
    .then(function () {
      costruisci();
      tutto();
      requestAnimationFrame(passo);
    });

})();
