/* ============================================================
   Gli incroci di Mendel
   ------------------------------------------------------------
   Si scelgono i genotipi dei due genitori e il sito costruisce il
   quadrato di Punnett, conta i genotipi e i fenotipi e mostra le
   proporzioni attese.

   Poi c'e' la parte che di solito manca: generare davvero i figli,
   uno per uno, a caso. Con venti figli le proporzioni non tornano
   quasi mai; con duemila tornano. Mendel non fu fortunato: fu
   paziente, e conto' migliaia di piante.
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("stazione");
  if (!contenitore) return;

  /* ---------- stato ---------- */

  var caratteri = [];
  var erroriFile = [];

  var duplice = false;        /* incrocio a due caratteri */
  var primo = null, secondo = null;
  var madre = ["Aa", "Bb"];   /* genotipi, uno per carattere */
  var padre = ["Aa", "Bb"];

  var figliGenerati = null;   /* conteggio dei fenotipi estratti a caso */
  var quantiFigli = 0;

  /* ==========================================================
     1. I caratteri
     ========================================================== */

  function leggiCaratteri(testo) {
    var elenco = [], errori = [];
    testo.split(/\r?\n/).forEach(function (rigaGrezza, i) {
      var riga = rigaGrezza.trim();
      if (riga === "" || riga.charAt(0) === "#") return;
      var pezzi = riga.split("|");
      if (pezzi.length < 4) {
        errori.push("riga " + (i + 1) + ": servono quattro parti separate da | .");
        return;
      }
      var lettera = pezzi[1].trim();
      if (!/^[A-Za-z]$/.test(lettera)) {
        errori.push("riga " + (i + 1) + ": \"" + lettera + "\" non è una sola lettera.");
        return;
      }
      elenco.push({
        nome: pezzi[0].trim(),
        lettera: lettera.toUpperCase(),
        dominante: pezzi[2].trim(),
        recessivo: pezzi[3].trim()
      });
    });
    return { caratteri: elenco, errori: errori };
  }

  /* ==========================================================
     2. La genetica
     ========================================================== */

  /* i due gameti possibili per un genotipo, con le loro quote */
  function gameti(genotipo) {
    var a = genotipo.charAt(0), b = genotipo.charAt(1);
    return [a, b];
  }

  function fenotipo(genotipo, carattere) {
    var dominante = genotipo.indexOf(carattere.lettera) >= 0;
    return dominante ? carattere.dominante : carattere.recessivo;
  }

  function ordina(a, b, lettera) {
    /* l'allele dominante si scrive per primo: Aa, non aA */
    if (a === lettera) return a + b;
    if (b === lettera) return b + a;
    return a + b;
  }

  /* la tabella di Punnett per un carattere: righe = gameti della
     madre, colonne = gameti del padre */
  function punnettSemplice(indice) {
    var c = indice === 0 ? primo : secondo;
    var gm = gameti(madre[indice]);
    var gp = gameti(padre[indice]);
    var celle = [];
    for (var r = 0; r < 2; r++) {
      var riga = [];
      for (var k = 0; k < 2; k++) {
        riga.push(ordina(gm[r], gp[k], c.lettera));
      }
      celle.push(riga);
    }
    return { gametiMadre: gm, gametiPadre: gp, celle: celle };
  }

  /* per l'incrocio a due caratteri: quattro gameti per genitore */
  function gametiDoppi(genotipi) {
    var g1 = gameti(genotipi[0]), g2 = gameti(genotipi[1]);
    var fuori = [];
    for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) fuori.push(g1[i] + g2[j]);
    return fuori;
  }

  function punnettDoppio() {
    var gm = gametiDoppi(madre);
    var gp = gametiDoppi(padre);
    var celle = [];
    for (var r = 0; r < 4; r++) {
      var riga = [];
      for (var k = 0; k < 4; k++) {
        riga.push(ordina(gm[r].charAt(0), gp[k].charAt(0), primo.lettera) +
                  " " +
                  ordina(gm[r].charAt(1), gp[k].charAt(1), secondo.lettera));
      }
      celle.push(riga);
    }
    return { gametiMadre: gm, gametiPadre: gp, celle: celle };
  }

  function conta(tabella) {
    var genotipi = {}, fenotipi = {};
    tabella.celle.forEach(function (riga) {
      riga.forEach(function (cella) {
        genotipi[cella] = (genotipi[cella] || 0) + 1;
        var f;
        if (duplice) {
          var pezzi = cella.split(" ");
          f = fenotipo(pezzi[0], primo) + ", " + fenotipo(pezzi[1], secondo);
        } else {
          f = fenotipo(cella, primo);
        }
        fenotipi[f] = (fenotipi[f] || 0) + 1;
      });
    });
    return { genotipi: genotipi, fenotipi: fenotipi };
  }

  /* estrae davvero dei figli, uno per uno */
  function generaFigli(quanti) {
    var conteggio = {};
    for (var i = 0; i < quanti; i++) {
      var f;
      if (duplice) {
        var g1 = sorteggia(0), g2 = sorteggia(1);
        f = fenotipo(g1, primo) + ", " + fenotipo(g2, secondo);
      } else {
        f = fenotipo(sorteggia(0), primo);
      }
      conteggio[f] = (conteggio[f] || 0) + 1;
    }
    figliGenerati = conteggio;
    quantiFigli = quanti;
  }

  function sorteggia(indice) {
    var gm = gameti(madre[indice]);
    var gp = gameti(padre[indice]);
    var c = indice === 0 ? primo : secondo;
    return ordina(gm[Math.floor(Math.random() * 2)],
                  gp[Math.floor(Math.random() * 2)], c.lettera);
  }

  /* riduce 12:4 a 3:1 */
  function proporzione(numeri) {
    var mcd = numeri.reduce(function (a, b) {
      while (b) { var t = b; b = a % b; a = t; }
      return a;
    });
    return numeri.map(function (n) { return n / (mcd || 1); }).join(" : ");
  }

  /* ==========================================================
     3. La pagina
     ========================================================== */

  function genotipiPossibili(lettera) {
    var minuscola = lettera.toLowerCase();
    return [lettera + lettera, lettera + minuscola, minuscola + minuscola];
  }

  function sceltaGenitore(chi, indice) {
    var c = indice === 0 ? primo : secondo;
    var elenco = chi === "madre" ? madre : padre;
    var riga = elemento("div", "scelta-genitore");
    riga.appendChild(elemento("span", "dato-nome", (chi === "madre" ? "genitore 1" : "genitore 2") +
      " · " + c.nome));
    var gruppo = elemento("div", "gruppo-genotipi");
    genotipiPossibili(c.lettera).forEach(function (g) {
      var b = elemento("button", "pillola" + (elenco[indice] === g ? " attiva" : ""));
      b.type = "button";
      b.appendChild(elemento("span", "genotipo", g));
      b.appendChild(elemento("span", "fenotipo-breve", fenotipo(g, c)));
      b.addEventListener("click", function () {
        elenco[indice] = g;
        figliGenerati = null;
        costruisci();
      });
      gruppo.appendChild(b);
    });
    riga.appendChild(gruppo);
    return riga;
  }

  function disegnaPunnett(tabella) {
    var t = elemento("table", "punnett");
    var intestazione = elemento("tr");
    intestazione.appendChild(elemento("th", "angolo", ""));
    tabella.gametiPadre.forEach(function (g) {
      intestazione.appendChild(elemento("th", "gamete", g));
    });
    t.appendChild(intestazione);

    tabella.celle.forEach(function (riga, r) {
      var tr = elemento("tr");
      tr.appendChild(elemento("th", "gamete", tabella.gametiMadre[r]));
      riga.forEach(function (cella) {
        var td = elemento("td", "cella-punnett");
        td.appendChild(elemento("div", "genotipo", cella));
        var f;
        if (duplice) {
          var pezzi = cella.split(" ");
          f = fenotipo(pezzi[0], primo) + ", " + fenotipo(pezzi[1], secondo);
        } else {
          f = fenotipo(cella, primo);
        }
        td.appendChild(elemento("div", "fenotipo-breve", f));
        tr.appendChild(td);
      });
      t.appendChild(tr);
    });
    return t;
  }

  function disegnaConteggi(conteggi, tabella) {
    var zona = elemento("div");

    zona.appendChild(elemento("h3", "titolo-blocco", "Che cosa ci si aspetta"));

    var fenotipi = Object.keys(conteggi.fenotipi);
    var numeriF = fenotipi.map(function (f) { return conteggi.fenotipi[f]; });
    var totale = tabella.celle.length * tabella.celle.length;

    var elencoF = elemento("div", "elenco-valori");
    fenotipi.forEach(function (f) {
      var voce = elemento("div", "valore-unita");
      voce.appendChild(elemento("span", "valore-numero", f));
      voce.appendChild(elemento("span", "valore-simbolo",
        conteggi.fenotipi[f] + " su " + totale));
      elencoF.appendChild(voce);
    });
    zona.appendChild(elencoF);

    var frase = elemento("p", "didascalia");
    frase.textContent = "Proporzione fra i fenotipi: " + proporzione(numeriF) +
      ". I genotipi diversi sono " + Object.keys(conteggi.genotipi).length + ".";
    zona.appendChild(frase);

    return zona;
  }

  function disegnaEstrazione(conteggi) {
    var zona = elemento("div");
    zona.appendChild(elemento("h3", "titolo-blocco", "E se li generiamo davvero?"));
    zona.appendChild(elemento("p", "didascalia",
      "Il quadrato dice quello che ci si aspetta in media. Ogni figlio però è un'estrazione a sé: " +
      "prova con pochi figli e poi con tanti."));

    var riga = elemento("div", "preset");
    [20, 100, 2000].forEach(function (n) {
      var b = elemento("button", "bottone-esempio", "genera " + n + " figli");
      b.type = "button";
      b.addEventListener("click", function () { generaFigli(n); costruisci(); });
      riga.appendChild(b);
    });
    zona.appendChild(riga);

    if (figliGenerati) {
      var elencoE = elemento("div", "elenco-valori");
      var chiavi = Object.keys(conteggi.fenotipi);
      chiavi.forEach(function (f) {
        var avuti = figliGenerati[f] || 0;
        var totCelle = 0;
        Object.keys(conteggi.fenotipi).forEach(function (k) { totCelle += conteggi.fenotipi[k]; });
        var attesoN = conteggi.fenotipi[f] / totCelle * quantiFigli;
        var voce = elemento("div", "valore-unita");
        voce.appendChild(elemento("span", "valore-numero", f));
        voce.appendChild(elemento("span", "valore-simbolo",
          avuti + "  (attesi " + attesoN.toFixed(0) + ")"));
        elencoE.appendChild(voce);
      });
      zona.appendChild(elencoE);

      var scarto = 0, tot = 0;
      Object.keys(conteggi.fenotipi).forEach(function (k) { tot += conteggi.fenotipi[k]; });
      Object.keys(conteggi.fenotipi).forEach(function (f) {
        var atteso = conteggi.fenotipi[f] / tot * quantiFigli;
        scarto += Math.abs((figliGenerati[f] || 0) - atteso);
      });
      var percentuale = quantiFigli ? scarto / quantiFigli * 100 : 0;
      zona.appendChild(elemento("p", "spiegazione-fase",
        "Su " + quantiFigli + " figli lo scarto dalle proporzioni attese è del " +
        percentuale.toFixed(1).replace(".", ",") + "%. " +
        (quantiFigli < 50
          ? "Con così pochi figli le proporzioni di Mendel non si vedono quasi mai: è il motivo per cui contò migliaia di piante."
          : "Con tanti figli lo scarto si assottiglia: le proporzioni emergono solo sui grandi numeri.")));
    }
    return zona;
  }

  function costruisci() {
    svuota(contenitore);

    var avvisoErrori = App.avvisoErroriFile("caratteri.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    contenitore.appendChild(elemento("p", "guida",
      "Scegli il carattere e i genotipi dei due genitori. Il quadrato di Punnett mette insieme " +
      "tutti i gameti possibili: ogni casella è un incontro che può capitare."));

    /* uno o due caratteri */
    var modi = elemento("div", "scelte-grandezza");
    [[false, "Un carattere"], [true, "Due caratteri"]].forEach(function (m) {
      var b = elemento("button", "pillola" + (duplice === m[0] ? " attiva" : ""), m[1]);
      b.type = "button";
      b.addEventListener("click", function () {
        duplice = m[0];
        figliGenerati = null;
        costruisci();
      });
      modi.appendChild(b);
    });
    contenitore.appendChild(modi);

    /* quale carattere */
    var scelta = elemento("div", "scelte-grandezza");
    caratteri.forEach(function (c) {
      var b = elemento("button", "pillola" + (primo === c ? " attiva" : ""), c.nome);
      b.type = "button";
      b.addEventListener("click", function () {
        primo = c;
        madre[0] = c.lettera + c.lettera.toLowerCase();
        padre[0] = c.lettera + c.lettera.toLowerCase();
        figliGenerati = null;
        costruisci();
      });
      scelta.appendChild(b);
    });
    contenitore.appendChild(scelta);

    if (duplice) {
      var scelta2 = elemento("div", "scelte-grandezza");
      caratteri.forEach(function (c) {
        if (c === primo) return;
        var b = elemento("button", "pillola pillola-altre" + (secondo === c ? " attiva" : ""), c.nome);
        b.type = "button";
        b.addEventListener("click", function () {
          secondo = c;
          madre[1] = c.lettera + c.lettera.toLowerCase();
          padre[1] = c.lettera + c.lettera.toLowerCase();
          figliGenerati = null;
          costruisci();
        });
        scelta2.appendChild(b);
      });
      contenitore.appendChild(scelta2);
    }

    /* i genitori */
    var genitori = elemento("div", "comandi");
    genitori.appendChild(sceltaGenitore("madre", 0));
    genitori.appendChild(sceltaGenitore("padre", 0));
    if (duplice) {
      genitori.appendChild(sceltaGenitore("madre", 1));
      genitori.appendChild(sceltaGenitore("padre", 1));
    }
    contenitore.appendChild(genitori);

    /* il quadrato */
    var tabella = duplice ? punnettDoppio() : punnettSemplice(0);
    var conteggi = conta(tabella);

    contenitore.appendChild(elemento("h3", "titolo-blocco", "Il quadrato di Punnett"));
    var involucro = elemento("div", "involucro-tabella");
    involucro.appendChild(disegnaPunnett(tabella));
    contenitore.appendChild(involucro);

    contenitore.appendChild(disegnaConteggi(conteggi, tabella));
    contenitore.appendChild(disegnaEstrazione(conteggi));

    var limiti = elemento("details", "limiti");
    limiti.appendChild(elemento("summary", null, "Che cosa questo modello semplifica"));
    var corpo = elemento("div", "limiti-corpo");
    [
      "Le proporzioni del quadrato di Punnett e l'estrazione dei figli sono calcolate correttamente: il 3:1 e il 9:3:3:1 vengono fuori da soli, non sono scritti da nessuna parte.",
      "La dominanza è sempre completa: l'eterozigote assomiglia in tutto al dominante. Nella realtà ci sono la dominanza incompleta, dove l'eterozigote sta a metà, e la codominanza, dove si vedono tutti e due i caratteri.",
      "Con due caratteri si suppone che i geni si assortiscano in modo indipendente. Vale solo se stanno su cromosomi diversi, o molto lontani sullo stesso cromosoma: altrimenti tendono a viaggiare insieme, ed è l'associazione genica.",
      "Un gene, due alleli, un carattere. Quasi nessun carattere vero funziona così: statura, colore della pelle e intelligenza dipendono da molti geni e dall'ambiente.",
      "I caratteri umani dell'elenco vanno presi con le molle. Molti esempi che si usano a scuola - la lingua arrotolata, il lobo dell'orecchio - non sono affatto caratteri mendeliani semplici: sono leggende scolastiche."
    ].forEach(function (t) { corpo.appendChild(elemento("p", null, t)); });
    limiti.appendChild(corpo);
    contenitore.appendChild(limiti);
  }

  /* ==========================================================
     4. Avvio
     ========================================================== */

  App.caricaTesto("caratteri.txt")
    .then(function (testo) {
      var esito = leggiCaratteri(testo);
      caratteri = esito.caratteri;
      erroriFile = esito.errori;
      if (caratteri.length === 0) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(elemento("strong", null, "Nessun carattere da mostrare."));
        avviso.appendChild(document.createTextNode(
          "Il file caratteri.txt è stato letto ma non contiene caratteri validi."));
        contenitore.appendChild(avviso);
        return;
      }
      primo = caratteri[0];
      secondo = caratteri[1] || caratteri[0];
      madre = [primo.lettera + primo.lettera.toLowerCase(), secondo.lettera + secondo.lettera.toLowerCase()];
      padre = [primo.lettera + primo.lettera.toLowerCase(), secondo.lettera + secondo.lettera.toLowerCase()];
      costruisci();
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("caratteri.txt", errore.message));
    });

})();
