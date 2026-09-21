/* ============================================================
   La scala delle unità di misura
   ------------------------------------------------------------
   Legge le grandezze dal file unita.txt e costruisce due cose:
   1. la scala, dove si vede la virgola che si sposta
   2. l'allenamento, con esercizi generati a caso
   Per cambiare le unità non serve toccare questo file: basta
   modificare unita.txt.
   ============================================================ */

(function () {
  "use strict";

  var elemento = App.elemento;
  var svuota = App.svuota;

  var contenitore = document.getElementById("unita-contenuto");
  var grandezze = [];
  var erroriFile = [];

  /* lo stato della scala */
  var grandezzaScelta = null;
  var unitaPartenza = null;
  var unitaArrivo = null;
  var testoValore = "1";
  var mostraAvanzate = false;

  /* lo stato dell'allenamento */
  var livello = "facile";
  var esercizio = null;
  var giuste = 0;
  var fatti = 0;
  var serie = 0;

  var schedaAperta = "scala";

  /* Oltre questa larghezza la tabella delle cifre diventa illeggibile e
     mostriamo soltanto la striscia dei gradini. Il limite è generoso
     perché la tabella scorre da sola fino alla colonna della virgola:
     anche una scala lunga resta usabile. */
  var LIMITE_COLONNE = 30;

  /* ==========================================================
     1. Numeri scritti come cifre e potenza di dieci
     ----------------------------------------------------------
     Un numero è tenuto come { cifre: "345", esp: -2 }, che vuol
     dire 345 x 10^-2 = 3,45. Lavorare così invece che con i
     numeri del computer permette di spostare la virgola senza
     mai introdurre errori di arrotondamento: ed è esattamente
     quello che succede in una conversione.
     ========================================================== */

  function leggiNumero(testo) {
    var t = String(testo).trim().replace(/\s/g, "").replace(/\./g, ",");
    if (t === "" || t === ",") return null;
    if (!/^\d*(,\d*)?$/.test(t)) return null;
    var parti = t.split(",");
    var interi = parti[0] || "";
    var decimali = parti.length > 1 ? parti[1] : "";
    if (interi === "" && decimali === "") return null;
    var cifre = (interi + decimali).replace(/^0+/, "");
    if (cifre === "") cifre = "0";
    return { cifre: cifre, esp: -decimali.length };
  }

  function scriviNumero(n) {
    var cifre = n.cifre.replace(/^0+/, "");
    if (cifre === "") return "0";
    var esp = n.esp;
    if (esp >= 0) return cifre + ripeti("0", esp);
    var d = -esp;
    var interi, decimali;
    if (cifre.length > d) {
      interi = cifre.slice(0, cifre.length - d);
      decimali = cifre.slice(cifre.length - d);
    } else {
      interi = "0";
      decimali = ripeti("0", d - cifre.length) + cifre;
    }
    decimali = decimali.replace(/0+$/, "");
    return decimali === "" ? interi : interi + "," + decimali;
  }

  /* in Italia i decimali si scrivono con la virgola */
  function conVirgola(numero) {
    return String(numero).replace(".", ",");
  }

  function ripeti(c, n) {
    var s = "";
    for (var i = 0; i < n; i++) s += c;
    return s;
  }

  /* la cifra che sta nella colonna della potenza j */
  function cifraInColonna(n, j) {
    var posizione = j - n.esp;
    var indice = n.cifre.length - 1 - posizione;
    if (indice < 0 || indice >= n.cifre.length) return "0";
    return n.cifre.charAt(indice);
  }

  function significativa(n, j) {
    return j >= n.esp && j <= n.esp + n.cifre.length - 1;
  }

  /* conversione esatta fra unità che sono potenze di dieci */
  function converti(n, da, a) {
    return { cifre: n.cifre, esp: n.esp + da.esp - a.esp };
  }

  /* conversione approssimata, per le grandezze senza potenze di dieci */
  function convertiNumerico(testo, da, a) {
    var valore = parseFloat(String(testo).replace(",", "."));
    if (isNaN(valore)) return null;
    var risultato = valore * da.fattore / a.fattore;
    var s = risultato.toPrecision(10).replace(/0+$/, "").replace(/\.$/, "");
    if (s.indexOf("e") >= 0) s = risultato.toString();
    return s.replace(".", ",");
  }

  /* ==========================================================
     2. Lettura del file unita.txt
     ========================================================== */

  var CHIAVI = ["nome", "icona", "nota", "scala", "avanzata"];

  function leggiGrandezze(testo) {
    var elenco = [];
    var errori = [];
    var righe = testo.split(/\r?\n/);
    var g = null;
    var ultimaChiave = null;

    for (var i = 0; i < righe.length; i++) {
      var numeroRiga = i + 1;
      var riga = righe[i].trim();
      if (riga === "" || riga.charAt(0) === "#") continue;

      if (riga.toUpperCase() === "[GRANDEZZA]") {
        g = { nome: "", icona: "📐", nota: "", scala: true, avanzata: false, unita: [] };
        elenco.push(g);
        ultimaChiave = null;
        continue;
      }

      var duePunti = riga.indexOf(":");
      if (duePunti > 0) {
        var chiave = riga.substring(0, duePunti).trim().toLowerCase();
        var valore = riga.substring(duePunti + 1).trim();

        if (chiave === "unita" || chiave === "unità") {
          if (!g) {
            errori.push("riga " + numeroRiga + ": un'unità si trova prima di [GRANDEZZA].");
            continue;
          }
          var pezzi = valore.split("|");
          if (pezzi.length < 3) {
            errori.push("riga " + numeroRiga + ": servono tre parti separate da | (simbolo, nome, valore).");
            continue;
          }
          var fattore = leggiFattore(pezzi[2].trim());
          if (fattore === null) {
            errori.push("riga " + numeroRiga + ": non capisco il valore \"" + pezzi[2].trim() + "\".");
            continue;
          }
          g.unita.push({
            simbolo: pezzi[0].trim(),
            nome: pezzi[1].trim(),
            fattore: fattore.numero,
            esp: fattore.esp
          });
          ultimaChiave = null;
          continue;
        }

        if (CHIAVI.indexOf(chiave) >= 0) {
          if (!g) {
            errori.push("riga " + numeroRiga + ": \"" + chiave + "\" si trova prima di [GRANDEZZA].");
            continue;
          }
          if (chiave === "scala") {
            g.scala = !/^(no|n)$/i.test(valore);
            ultimaChiave = null;
          } else if (chiave === "avanzata") {
            g.avanzata = /^(s|si|sì|y|yes)$/i.test(valore);
            ultimaChiave = null;
          } else {
            g[chiave] = valore;
            ultimaChiave = chiave;
          }
          continue;
        }
      }

      if (g && ultimaChiave) {
        g[ultimaChiave] = (g[ultimaChiave] + " " + riga).trim();
        continue;
      }
      errori.push("riga " + numeroRiga + ": non ho capito \"" + riga.slice(0, 40) + "\". La salto.");
    }

    var buone = [];
    elenco.forEach(function (gr) {
      if (!gr.nome) {
        errori.push("Una grandezza è senza nome: l'ho saltata.");
        return;
      }
      if (gr.unita.length < 2) {
        errori.push("« " + gr.nome + " » ha meno di due unità: l'ho saltata.");
        return;
      }
      gr.unita.sort(function (a, b) { return b.fattore - a.fattore; });
      if (gr.scala) {
        gr.scala = gr.unita.every(function (u) { return u.esp !== null; });
      }
      calcolaColonne(gr);
      buone.push(gr);
    });

    return { grandezze: buone, errori: errori };
  }

  /* accetta 10^3, 10^-2, 1000, 0,001 */
  function leggiFattore(testo) {
    var m = /^10\s*\^\s*(-?\d+)$/.exec(testo);
    if (m) {
      var e = parseInt(m[1], 10);
      return { numero: Math.pow(10, e), esp: e };
    }
    var numero = parseFloat(testo.replace(",", "."));
    if (isNaN(numero) || numero <= 0) return null;
    var log = Math.log(numero) / Math.LN10;
    var arrotondato = Math.round(log);
    var potenza = Math.abs(Math.pow(10, arrotondato) - numero) < numero * 1e-9;
    return { numero: numero, esp: potenza ? arrotondato : null };
  }

  /* quante caselle di cifre occupa ogni unità nella tabella */
  function calcolaColonne(g) {
    if (!g.scala) return;
    var u = g.unita;
    for (var i = 0; i < u.length; i++) {
      var passo;
      if (i > 0) passo = u[i - 1].esp - u[i].esp;
      else if (u.length > 1) passo = u[0].esp - u[1].esp;
      else passo = 1;
      u[i].caselle = Math.max(1, passo);
    }
    g.colonnaMax = u[0].esp + u[0].caselle - 1;
    g.colonnaMin = u[u.length - 1].esp;
    g.numeroColonne = g.colonnaMax - g.colonnaMin + 1 + 2;
  }

  /* l'unità da cui conviene partire: quella che vale 1 */
  function unitaDiRiferimento(g) {
    for (var i = 0; i < g.unita.length; i++) {
      if (g.unita[i].fattore === 1) return g.unita[i];
    }
    return g.unita[Math.floor(g.unita.length / 2)];
  }

  /* Si parte dalla conversione più familiare: se c'è un'unità che vale
     mille (il chilo), si parte da quella e si arriva all'unità di
     riferimento; altrimenti si parte dal riferimento e si scende di uno. */
  function apriGrandezza(g) {
    grandezzaScelta = g;
    var riferimento = unitaDiRiferimento(g);
    var posizione = g.unita.indexOf(riferimento);
    var mille = null;
    g.unita.forEach(function (u) { if (u.esp === 3) mille = u; });

    if (mille && mille !== riferimento) {
      unitaPartenza = mille;
      unitaArrivo = riferimento;
    } else {
      unitaPartenza = riferimento;
      unitaArrivo = g.unita[Math.min(g.unita.length - 1, posizione + 1)];
      if (unitaArrivo === unitaPartenza) unitaArrivo = g.unita[Math.max(0, posizione - 1)];
    }
  }

  /* ==========================================================
     3. La scala
     ========================================================== */

  function disegnaScala() {
    var g = grandezzaScelta;
    var zona = elemento("div");

    zona.appendChild(elemento("p", "guida",
      "Scrivi un numero, scegli le due unità e guarda dove finisce la virgola."));

    /* le grandezze */
    var scelte = elemento("div", "scelte-grandezza");
    grandezze.forEach(function (gr) {
      if (gr.avanzata && !mostraAvanzate) return;
      var b = elemento("button", "pillola" + (gr === g ? " attiva" : ""));
      b.type = "button";
      b.textContent = (gr.icona || "") + " " + gr.nome;
      b.addEventListener("click", function () {
        apriGrandezza(gr);
        mostra();
      });
      scelte.appendChild(b);
    });

    if (grandezze.some(function (gr) { return gr.avanzata; })) {
      var altre = elemento("button", "pillola pillola-altre");
      altre.type = "button";
      altre.textContent = mostraAvanzate ? "− meno grandezze" : "+ altre grandezze";
      altre.addEventListener("click", function () {
        mostraAvanzate = !mostraAvanzate;
        mostra();
      });
      scelte.appendChild(altre);
    }
    zona.appendChild(scelte);

    /* la domanda, scritta come una frase */
    var frase = elemento("div", "frase");
    frase.appendChild(elemento("span", "frase-parola", "Quanto fa"));

    var campo = elemento("input", "campo-valore");
    campo.type = "text";
    campo.inputMode = "decimal";
    campo.value = testoValore;
    campo.setAttribute("aria-label", "numero da convertire");
    campo.addEventListener("input", function () {
      testoValore = campo.value;
      aggiornaRisultato();
    });
    frase.appendChild(campo);

    frase.appendChild(selettoreUnita(g, unitaPartenza, function (u) {
      unitaPartenza = u;
      mostra();
    }));

    frase.appendChild(elemento("span", "frase-parola", "in"));

    frase.appendChild(selettoreUnita(g, unitaArrivo, function (u) {
      unitaArrivo = u;
      mostra();
    }));

    frase.appendChild(elemento("span", "frase-parola", "?"));
    zona.appendChild(frase);

    /* numeri pronti, per non dover scrivere */
    var esempi = elemento("div", "esempi");
    esempi.appendChild(elemento("span", "esempi-etichetta", "prova con:"));
    ["1", "2,5", "0,045", "350"].forEach(function (v) {
      var b = elemento("button", "bottone-esempio", v);
      b.type = "button";
      b.addEventListener("click", function () {
        testoValore = v;
        mostra();
      });
      esempi.appendChild(b);
    });
    zona.appendChild(esempi);

    /* il risultato */
    var risultato = elemento("div", "risultato-grande");
    risultato.id = "risultato-grande";
    risultato.setAttribute("role", "status");
    risultato.setAttribute("aria-live", "polite");
    zona.appendChild(risultato);

    /* i due bottoni per muoversi di un gradino */
    var passi = elemento("div", "passi-gradino");
    var indice = g.unita.indexOf(unitaArrivo);

    var sinistra = elemento("button", "bottone-passo", "◀  un gradino più grande");
    sinistra.type = "button";
    sinistra.disabled = indice <= 0;
    sinistra.addEventListener("click", function () {
      unitaArrivo = g.unita[indice - 1];
      mostra();
    });
    passi.appendChild(sinistra);

    var destra = elemento("button", "bottone-passo", "un gradino più piccolo  ▶");
    destra.type = "button";
    destra.disabled = indice >= g.unita.length - 1;
    destra.addEventListener("click", function () {
      unitaArrivo = g.unita[indice + 1];
      mostra();
    });
    passi.appendChild(destra);
    zona.appendChild(passi);

    var spiegazione = elemento("p", "spiegazione-scala");
    spiegazione.id = "spiegazione-scala";
    zona.appendChild(spiegazione);

    /* la striscia dei gradini */
    zona.appendChild(elemento("p", "suggerimento",
      "Tocca un gradino per cambiare l'unità di arrivo."));
    zona.appendChild(disegnaGradini(g));

    /* la tabella delle cifre */
    if (g.scala && g.numeroColonne <= LIMITE_COLONNE) {
      zona.appendChild(elemento("h3", "titolo-blocco", "Dove finisce la virgola"));
      zona.appendChild(elemento("p", "didascalia",
        "Ogni casella è una cifra. Le cifre colorate sono quelle del tuo numero: " +
        "restano sempre le stesse, si muove solo la virgola."));
      var involucro = elemento("div", "involucro-tabella");
      involucro.id = "involucro-tabella";
      zona.appendChild(involucro);
    } else if (g.scala) {
      zona.appendChild(elemento("p", "nota-piccola",
        "Qui ogni gradino vale mille: la tabella delle cifre sarebbe larga più di venti caselle, " +
        "quindi ti mostro solo la scala dei gradini."));
    }

    /* lo stesso valore in tutte le unità, richiudibile */
    var dettagli = elemento("details", "tutte-unita");
    dettagli.appendChild(elemento("summary", null, "Lo stesso valore in tutte le unità"));
    var lista = elemento("div", "elenco-valori");
    lista.id = "elenco-valori";
    dettagli.appendChild(lista);
    zona.appendChild(dettagli);

    if (g.nota) zona.appendChild(elemento("p", "nota-grandezza", g.nota));

    return zona;
  }

  /* porta un elemento al centro del suo contenitore scorrevole */
  function centraSu(involucro, bersaglio) {
    if (!involucro || !bersaglio || !involucro.getBoundingClientRect) return;
    var fuori = involucro.getBoundingClientRect();
    var dentro = bersaglio.getBoundingClientRect();
    involucro.scrollLeft += (dentro.left - fuori.left) - (fuori.width - dentro.width) / 2;
  }

  function selettoreUnita(g, scelta, quandoCambia) {
    var s = elemento("select", "scelta-unita");
    s.setAttribute("aria-label", "unità di misura");
    g.unita.forEach(function (u, i) {
      var o = elemento("option", null, u.simbolo + " — " + u.nome);
      o.value = String(i);
      if (u === scelta) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener("change", function () {
      quandoCambia(g.unita[parseInt(s.value, 10)]);
    });
    return s;
  }

  function disegnaGradini(g) {
    var striscia = elemento("div", "gradini");
    g.unita.forEach(function (u, i) {
      if (i > 0) {
        var salto = Math.round(g.unita[i - 1].fattore / u.fattore);
        striscia.appendChild(elemento("span", "salto", "×" + salto));
      }
      var cella = elemento("button", "gradino");
      cella.type = "button";
      if (u === unitaPartenza) cella.classList.add("partenza");
      if (u === unitaArrivo) cella.classList.add("arrivo");
      if (u === unitaPartenza) cella.appendChild(elemento("span", "targhetta", "da"));
      if (u === unitaArrivo) cella.appendChild(elemento("span", "targhetta", "a"));
      cella.appendChild(elemento("span", "gradino-simbolo", u.simbolo));
      cella.appendChild(elemento("span", "gradino-nome", u.nome));
      cella.setAttribute("aria-label", "porta il risultato in " + u.nome);
      cella.addEventListener("click", function () {
        unitaArrivo = u;
        mostra();
      });
      striscia.appendChild(cella);
    });
    var involucro = elemento("div", "involucro-gradini");
    involucro.appendChild(striscia);
    return involucro;
  }

  function aggiornaRisultato() {
    var g = grandezzaScelta;
    var risultato = document.getElementById("risultato-grande");
    var spiegazione = document.getElementById("spiegazione-scala");
    var tabella = document.getElementById("involucro-tabella");
    var lista = document.getElementById("elenco-valori");
    if (!risultato) return;

    svuota(risultato);
    svuota(spiegazione);
    if (tabella) svuota(tabella);
    if (lista) svuota(lista);

    var n = leggiNumero(testoValore);

    if (n === null) {
      risultato.appendChild(elemento("span", "risultato-vuoto",
        "Scrivi un numero, per esempio 3,5"));
      return;
    }

    var testoRisultato = g.scala
      ? scriviNumero(converti(n, unitaPartenza, unitaArrivo))
      : convertiNumerico(testoValore, unitaPartenza, unitaArrivo);

    var partenza = elemento("div", "risultato-partenza");
    partenza.appendChild(elemento("span", "risultato-numero-piccolo", scriviNumero(n)));
    partenza.appendChild(elemento("span", "risultato-simbolo-piccolo", " " + unitaPartenza.simbolo));
    risultato.appendChild(partenza);

    risultato.appendChild(elemento("div", "risultato-uguale", "="));

    var arrivo = elemento("div", "risultato-arrivo");
    arrivo.appendChild(elemento("span", "risultato-valore", testoRisultato));
    arrivo.appendChild(elemento("span", "risultato-unita", " " + unitaArrivo.simbolo));
    risultato.appendChild(arrivo);
    risultato.appendChild(elemento("div", "risultato-nome", unitaArrivo.nome));

    /* la spiegazione */
    if (g.scala) {
      var posti = unitaPartenza.esp - unitaArrivo.esp;
      if (posti === 0) {
        spiegazione.textContent = "Stessa unità: il numero non cambia.";
      } else {
        var quanti = Math.abs(posti);
        var verso = posti > 0 ? "destra" : "sinistra";
        spiegazione.textContent =
          "La virgola si sposta di " + quanti + (quanti === 1 ? " posto" : " posti") +
          " verso " + verso + ", cioè si " + (posti > 0 ? "moltiplica" : "divide") +
          " per 1" + ripeti("0", quanti) + ".";
      }
    } else {
      var rapporto = unitaPartenza.fattore / unitaArrivo.fattore;
      spiegazione.textContent = rapporto === 1
        ? "Stessa unità: il numero non cambia."
        : "Qui non basta spostare la virgola: bisogna " +
          (rapporto >= 1 ? "moltiplicare per " + conVirgola(rapporto)
                         : "dividere per " + conVirgola(1 / rapporto)) + ".";
    }

    if (tabella) {
      tabella.appendChild(disegnaTabella(g, n, unitaPartenza, unitaArrivo));
      /* con scale lunghe la tabella non ci sta: la facciamo scorrere
         da sola fino alla colonna dove finisce la virgola */
      centraSu(tabella, tabella.querySelector(".cifra-virgola"));
    }

    if (lista) {
      g.unita.forEach(function (u) {
        var voce = elemento("div", "valore-unita" + (u === unitaArrivo ? " evidenziato" : ""));
        var v = g.scala ? scriviNumero(converti(n, unitaPartenza, u))
                        : convertiNumerico(testoValore, unitaPartenza, u);
        voce.appendChild(elemento("span", "valore-numero", v));
        voce.appendChild(elemento("span", "valore-simbolo", " " + u.simbolo));
        lista.appendChild(voce);
      });
    }
  }

  /* La tabella con una casella per ogni potenza di dieci.
     Il numero arriva espresso nell'unità di partenza: per capire in
     quale casella vanno le sue cifre bisogna prima riportarlo alla
     scala assoluta, cioè sommare l'esponente dell'unità di partenza. */
  function disegnaTabella(g, n, daUnita, aUnita) {
    var assoluto = { cifre: n.cifre, esp: n.esp + daUnita.esp };
    var tabella = elemento("table", "tabella-cifre");
    var extra = 2;
    var colonne = [];
    for (var j = g.colonnaMax; j >= g.colonnaMin - extra; j--) colonne.push(j);

    var intestazione = elemento("tr");
    g.unita.forEach(function (u) {
      var cella = elemento("th", null, u.simbolo);
      cella.colSpan = u.caselle;
      if (u === aUnita) cella.className = "colonna-arrivo";
      else if (u === daUnita) cella.className = "colonna-partenza";
      intestazione.appendChild(cella);
    });
    var vuota = elemento("th", "colonna-extra", "");
    vuota.colSpan = extra;
    intestazione.appendChild(vuota);
    tabella.appendChild(intestazione);

    var rigaCifre = elemento("tr");
    colonne.forEach(function (j) {
      var cella = elemento("td", "cifra", cifraInColonna(assoluto, j));
      if (significativa(assoluto, j)) cella.classList.add("cifra-viva");
      else cella.classList.add("cifra-zero");
      if (j === aUnita.esp) cella.classList.add("cifra-virgola");
      rigaCifre.appendChild(cella);
    });
    tabella.appendChild(rigaCifre);

    return tabella;
  }

  /* ==========================================================
     4. L'allenamento
     ========================================================== */

  var LIVELLI = {
    facile: { distanzaMax: 1, nomi: ["Lunghezza", "Massa", "Capacità"] },
    medio: { distanzaMax: 3, nomi: ["Lunghezza", "Massa", "Capacità"] },
    difficile: { distanzaMax: 99, nomi: null }
  };

  function grandezzeAllenabili(nomi) {
    return grandezze.filter(function (g) {
      if (!g.scala) return false;
      if (!nomi) return true;
      return nomi.indexOf(g.nome) >= 0;
    });
  }

  function nuovoEsercizio() {
    var impostazioni = LIVELLI[livello];
    var candidate = grandezzeAllenabili(impostazioni.nomi);
    if (candidate.length === 0) candidate = grandezzeAllenabili(null);
    if (candidate.length === 0) return null;

    var g = candidate[Math.floor(Math.random() * candidate.length)];
    var i = Math.floor(Math.random() * g.unita.length);
    var distanza = 1 + Math.floor(Math.random() * Math.min(impostazioni.distanzaMax, g.unita.length - 1));
    var j = Math.random() < 0.5 ? i - distanza : i + distanza;
    if (j < 0) j = i + distanza;
    if (j >= g.unita.length) j = i - distanza;
    if (j < 0 || j === i) { j = i === 0 ? 1 : i - 1; }

    var quante = 1 + Math.floor(Math.random() * 3);
    var cifre = String(1 + Math.floor(Math.random() * 9));
    for (var k = 1; k < quante; k++) cifre += String(Math.floor(Math.random() * 10));
    cifre = cifre.replace(/0+$/, "");
    if (cifre === "") cifre = "5";
    var esp = -Math.floor(Math.random() * 3);

    return {
      grandezza: g,
      da: g.unita[i],
      a: g.unita[j],
      numero: { cifre: cifre, esp: esp }
    };
  }

  function scriviPunteggio(dove) {
    svuota(dove);
    dove.appendChild(elemento("span", null, "Esercizi: " + fatti));
    dove.appendChild(elemento("span", null, "Giusti: " + giuste));
    dove.appendChild(elemento("span", null, "Serie: " + serie));
  }

  function aggiornaPunteggio() {
    var dove = document.getElementById("punteggio-allenamento");
    if (dove) scriviPunteggio(dove);
  }

  function disegnaAllenamento() {
    var zona = elemento("div");

    zona.appendChild(elemento("p", "guida",
      "Gli esercizi sono generati a caso: puoi farne quanti vuoi, non finiscono mai."));

    var scelte = elemento("div", "scelte-grandezza");
    ["facile", "medio", "difficile"].forEach(function (l) {
      var b = elemento("button", "pillola" + (l === livello ? " attiva" : ""));
      b.type = "button";
      b.textContent = l.charAt(0).toUpperCase() + l.slice(1);
      b.addEventListener("click", function () {
        livello = l;
        esercizio = nuovoEsercizio();
        mostra();
      });
      scelte.appendChild(b);
    });
    zona.appendChild(scelte);

    zona.appendChild(elemento("p", "nota-piccola",
      livello === "facile" ? "Un solo gradino per volta, fra lunghezze, masse e capacità."
        : livello === "medio" ? "Fino a tre gradini di distanza."
        : "Qualunque distanza, comprese superfici, volumi e prefissi."));

    var punteggio = elemento("div", "punteggio-allenamento");
    punteggio.id = "punteggio-allenamento";
    zona.appendChild(punteggio);
    scriviPunteggio(punteggio);

    if (!esercizio) esercizio = nuovoEsercizio();
    if (!esercizio) {
      zona.appendChild(elemento("p", "nota-piccola",
        "Non ci sono grandezze adatte all'allenamento in unita.txt."));
      return zona;
    }

    var scheda = elemento("div", "scheda-esercizio");
    scheda.appendChild(elemento("div", "etichetta-passo", esercizio.grandezza.nome));

    var domanda = elemento("p", "domanda-esercizio");
    domanda.appendChild(document.createTextNode("Quanto fa "));
    domanda.appendChild(elemento("strong", null,
      scriviNumero(esercizio.numero) + " " + esercizio.da.simbolo));
    domanda.appendChild(document.createTextNode(" in " + esercizio.a.nome + "?"));
    scheda.appendChild(domanda);

    var riga = elemento("form", "riga-risposta");
    var campo = elemento("input", "campo-valore");
    campo.type = "text";
    campo.inputMode = "decimal";
    campo.autocomplete = "off";
    campo.setAttribute("aria-label", "la tua risposta");
    campo.placeholder = "…";
    riga.appendChild(campo);
    riga.appendChild(elemento("span", "unita-risposta", esercizio.a.simbolo));
    var controlla = elemento("button", "bottone", "Controlla");
    controlla.type = "submit";
    riga.appendChild(controlla);
    scheda.appendChild(riga);

    var esito = elemento("div");
    esito.setAttribute("role", "status");
    esito.setAttribute("aria-live", "polite");
    scheda.appendChild(esito);

    function controllaRisposta(ev) {
      ev.preventDefault();
      if (esercizio.risposto) return;
      valuta(campo.value, esito, campo, controlla);
    }

    riga.addEventListener("submit", controllaRisposta);
    /* alcuni browser non fanno partire il modulo con il tasto Invio: lo gestiamo a mano */
    campo.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") controllaRisposta(ev);
    });

    zona.appendChild(scheda);
    setTimeout(function () { campo.focus(); }, 0);
    return zona;
  }

  function valuta(risposta, esito, campo, controlla) {
    var attesa = converti(esercizio.numero, esercizio.da, esercizio.a);
    var testoAtteso = scriviNumero(attesa);
    var data = leggiNumero(risposta);

    esercizio.risposto = true;
    campo.disabled = true;
    controlla.disabled = true;
    fatti++;

    var corretta = data !== null && scriviNumero(data) === testoAtteso;
    if (corretta) { giuste++; serie++; } else { serie = 0; }

    var messaggio = elemento("p", "esito " + (corretta ? "bene" : "male"));
    messaggio.textContent = corretta
      ? "Giusto: " + testoAtteso + " " + esercizio.a.simbolo
      : (data === null ? "Non ho capito il numero. " : "Non è questa. ") +
        "La risposta giusta è " + testoAtteso + " " + esercizio.a.simbolo + ".";
    esito.appendChild(messaggio);

    var posti = esercizio.da.esp - esercizio.a.esp;
    var quanti = Math.abs(posti);
    var verso = posti > 0 ? "destra" : "sinistra";
    esito.appendChild(elemento("p", "spiegazione-scala",
      "Da " + esercizio.da.simbolo + " a " + esercizio.a.simbolo +
      (quanti === 1 ? " c'è un solo posto" : " ci sono " + quanti + " posti") +
      " di virgola verso " + verso +
      ": le cifre non cambiano, cambia solo dove sta la virgola."));

    aggiornaPunteggio();

    if (esercizio.grandezza.scala && esercizio.grandezza.numeroColonne <= LIMITE_COLONNE) {
      var involucro = elemento("div", "involucro-tabella");
      involucro.appendChild(disegnaTabella(
        esercizio.grandezza, esercizio.numero, esercizio.da, esercizio.a));
      esito.appendChild(involucro);
    }

    var riga = elemento("div", "bottoni");
    var avanti = elemento("button", "bottone", "Prossimo esercizio →");
    avanti.type = "button";
    avanti.addEventListener("click", function () {
      esercizio = nuovoEsercizio();
      mostra();
    });
    riga.appendChild(avanti);
    esito.appendChild(riga);
    avanti.focus();
  }

  /* ==========================================================
     5. Montaggio della sezione
     ========================================================== */

  function mostra() {
    svuota(contenitore);

    var avvisoErrori = App.avvisoErroriFile("unita.txt", erroriFile);
    if (avvisoErrori) contenitore.appendChild(avvisoErrori);

    var schede = elemento("div", "schede-interne");
    [["scala", "La scala"], ["allenamento", "Allenamento"]].forEach(function (s) {
      var b = elemento("button", "scheda-interna" + (schedaAperta === s[0] ? " attiva" : ""));
      b.type = "button";
      b.textContent = s[1];
      b.addEventListener("click", function () {
        schedaAperta = s[0];
        mostra();
      });
      schede.appendChild(b);
    });
    contenitore.appendChild(schede);

    if (schedaAperta === "scala") {
      contenitore.appendChild(disegnaScala());
      aggiornaRisultato();
      var strisciaGradini = contenitore.querySelector(".involucro-gradini");
      if (strisciaGradini) centraSu(strisciaGradini, strisciaGradini.querySelector(".gradino.arrivo"));
    } else {
      contenitore.appendChild(disegnaAllenamento());
    }
  }

  App.caricaTesto("unita.txt")
    .then(function (testo) {
      var esito = leggiGrandezze(testo);
      grandezze = esito.grandezze;
      erroriFile = esito.errori;
      if (grandezze.length === 0) {
        svuota(contenitore);
        var avviso = elemento("div", "avviso");
        avviso.appendChild(elemento("strong", null, "Nessuna grandezza da mostrare."));
        avviso.appendChild(document.createTextNode(
          "Il file unita.txt è stato letto ma non contiene grandezze valide."));
        contenitore.appendChild(avviso);
        return;
      }
      apriGrandezza(grandezze[0]);
      mostra();
    })
    .catch(function (errore) {
      svuota(contenitore);
      contenitore.appendChild(App.avvisoCaricamento("unita.txt", errore.message));
    });

})();
