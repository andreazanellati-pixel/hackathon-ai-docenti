# Il detective degli esperimenti

Un sito didattico per una prima di liceo scientifico, su **metodo
scientifico e misure**. Funziona da computer e da telefono, non
richiede installazioni né registrazioni.

👉 **[Apri il sito](https://andreazanellati-pixel.github.io/hackathon-ai-docenti)**

## Che cosa contiene

**🔍 I casi** — quattordici casi in cui qualcuno sostiene qualcosa e
qualcun altro non ci crede. Lo studente non deve indovinare chi ha
ragione: deve progettare l'esperimento che lo scopre, passo per passo
— ipotesi, variabile da cambiare, variabile da misurare, variabili da
tenere costanti, gruppo di controllo, conclusione. Ogni risposta,
giusta o sbagliata, spiega il perché. Alla fine compare il riepilogo
dell'esperimento corretto.

I casi coprono trappole metodologiche diverse: la causa nascosta, il
dato anomalo, l'assegnazione a sorte, il placebo e il doppio cieco,
l'errore di misura, la correlazione che non è causa, l'errore
sistematico, la guarigione spontanea, il campione non rappresentativo,
la relazione dose-effetto, il confronto equo, la riproducibilità,
l'effetto apprendimento.

**🧭 Il Sistema Internazionale** — le sette unità fondamentali, tredici
grandezze derivate e tredici prefissi da tera a femto, ognuno con
esempi concreti. La formula di ogni grandezza derivata è disegnata
come frazione: toccandola si accendono, nella mappa in alto, le unità
fondamentali che la compongono.

**📐 Convertire** — la scala delle unità, dove si vede la virgola
spostarsi casella per casella, e un allenamento con esercizi generati
a caso su tre livelli.

## Per chi insegna: modificare i contenuti

Tutti i contenuti stanno in tre file di testo, che si aprono con il
Blocco note e hanno le istruzioni scritte in cima:

| File | Contiene |
|------|----------|
| `casi.txt` | i casi del detective |
| `si.txt` | unità fondamentali, grandezze derivate, prefissi |
| `unita.txt` | le scale di conversione |

Si modifica il testo, si salva, si ricarica la pagina. Non serve
toccare il codice. Se una riga viene scritta male il sito non si
blocca: la salta e segnala quale riga rivedere.

## Per chi pubblica il sito

Sito statico: solo HTML, CSS e JavaScript. Nessuna libreria esterna,
nessun passaggio di compilazione, nessun database, nessun linguaggio
lato server.

Vanno caricati **tutti insieme nella stessa cartella**, senza
rinominarli, questi nove file:

```
index.html   stile.css
comune.js    detective.js   unita.js   si.js
casi.txt     unita.txt      si.txt
```

Il punto d'ingresso è `index.html`.

**Va servito da un server web.** Aprendo `index.html` con un doppio
clic dal disco il sito resta vuoto: per sicurezza i browser impediscono
a una pagina aperta così di leggere gli altri file della cartella.
Caricato su un qualsiasi sito, funziona.

**Privacy:** il sito non invia dati da nessuna parte, non usa cookie,
non carica risorse esterne e non contiene dati personali. I punteggi
restano nel browser di chi lo usa.

## Licenza d'uso

Materiale didattico liberamente utilizzabile e modificabile.
