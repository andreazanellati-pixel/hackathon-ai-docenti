# Regole del progetto

Questo progetto è il **Laboratorio digitale di scienze naturali**, un sito
statico pubblicato con GitHub Pages su
https://github.com/andreazanellati-pixel/hackathon-ai-docenti

Una copia vive anche nel portale della scuola, `liceo-digitale`, nella
cartella `scienze-detective-degli-esperimenti`.

Rispetta sempre queste regole.

## Com'è fatto il sito

- `index.html` è la pagina iniziale: mostra l'elenco delle stazioni,
  raggruppate per disciplina e filtrabili per anno di corso.
- `stazioni.txt` è il registro: la pagina iniziale legge da qui.
  Per aggiungere una stazione si aggiunge un blocco, senza toccare il codice.
- `stile.css` e `comune.js` sono comuni a tutte le stazioni.
- Ogni stazione sta in `stazioni/<nome-cartella>/`, con il proprio
  `index.html`, il proprio codice e i propri file di contenuto.

## Tecnologia

- Sito statico: solo HTML, CSS e JavaScript. Nessuna libreria esterna,
  nessun passaggio di build.
- Solo percorsi relativi: deve funzionare su GitHub Pages, che non
  pubblica il sito alla radice del dominio.

## Il numero di versione

Quando si modifica un file del sito si aumenta di uno:

1. la costante `VERSIONE` in cima a `comune.js`
2. tutti i `?v=` scritti nelle pagine HTML

Senza, i browser continuano a mostrare la versione vecchia anche per
giorni, e chi ha già usato il sito non vede le correzioni.

## Contenuti

- I contenuti stanno in file di testo semplici, separati dal codice, che
  l'autore può modificare senza saper programmare.
- Ogni file di contenuto ha le istruzioni scritte in cima.
- Se una riga è scritta male il sito non si blocca: la salta e segnala
  quale riga rivedere.
- I file di testo si salvano in UTF-8 senza BOM, altrimenti gli accenti
  si rovinano.

## Le simulazioni

- Ogni simulazione contiene un modello scientifico semplificato. La
  pagina deve **dichiarare che cosa il modello trascura**: una
  simulazione che tace i propri limiti insegna cose false con
  l'autorevolezza di chi "le fa vedere".
- Prima di considerare finita una stazione la si prova davvero.

## Git

- Commit piccoli e frequenti, con messaggi in italiano che spiegano cosa
  è cambiato.
- Usa `git` da riga di comando, mai `gh` (la GitHub CLI non è installata).
- Prima di ogni `git push`, chiedi conferma.

## Modo di lavorare

- Spiega quello che fai con parole semplici: l'autore non è un programmatore.
- Istruzioni operative **un passo alla volta**, con una conferma in mezzo.

## Privacy

- Il repository è pubblico: niente dati personali reali di studenti.
- Il sito non raccoglie né trasmette dati, non usa cookie e non carica
  risorse da server esterni. Deve restare così.
