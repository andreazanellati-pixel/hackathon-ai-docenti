# Laboratorio digitale di scienze naturali

Simulazioni e strumenti per il liceo scientifico delle scienze applicate.
Ogni stazione è un piccolo esperimento da fare sullo schermo: si muovono
le manopole e si guarda che cosa succede. Funziona da computer e da
telefono, non richiede installazioni né registrazioni.

👉 **[Apri il laboratorio](https://andreazanellati-pixel.github.io/hackathon-ai-docenti)**

## Le stazioni

La pagina iniziale le raggruppa per disciplina e si possono filtrare per
anno di corso. Quelle ancora da costruire compaiono nell'elenco, spente,
così si vede il piano di lavoro.

**Pronte**

| Stazione | Anni | Che cosa si fa |
|---|---|---|
| 🔍 Il detective degli esperimenti | 1ª–5ª | Quattordici casi in cui progettare l'esperimento che scopre chi ha ragione: ipotesi, variabili, gruppo di controllo, conclusione |
| 🧭 Il Sistema Internazionale | 1ª | Le sette unità fondamentali, le grandezze derivate con la loro formula e i prefissi da tera a femto, con esempi concreti |
| 📐 Convertire le unità | 1ª | La scala dove si vede la virgola spostarsi casella per casella, e un allenamento con esercizi generati a caso |

**In costruzione:** particelle e stati della materia, diffusione e osmosi,
stechiometria, molecole, teoria degli urti, equilibrio chimico,
titolazione, pile, enzimi, mitosi e meiosi, incroci di Mendel, dal DNA
alla proteina, genetica di popolazioni, potenziale d'azione, epidemie,
fotosintesi, elettroforesi, Terra-Sole-Luna, vulcani, rocce, epicentro,
interno della Terra, tettonica, bilancio radiativo.

## Per chi insegna: modificare i contenuti

Tutto sta in file di testo, che si aprono con il Blocco note e hanno le
istruzioni scritte in cima:

| File | Contiene |
|---|---|
| `stazioni.txt` | l'elenco delle stazioni della pagina iniziale |
| `stazioni/detective/casi.txt` | i casi del detective |
| `stazioni/sistema-internazionale/si.txt` | unità fondamentali, derivate, prefissi |
| `stazioni/convertire/unita.txt` | le scale di conversione |

Si modifica il testo, si salva **in UTF-8**, si ricarica la pagina. Non
serve toccare il codice. Se una riga viene scritta male il sito non si
blocca: la salta e segnala quale riga rivedere.

## Per chi pubblica il sito

Sito statico: solo HTML, CSS e JavaScript. Nessuna libreria esterna,
nessun database, nessun linguaggio lato server, nessuna compilazione.

Si carica **l'intera cartella mantenendo la struttura**, sottocartelle
comprese. Il punto d'ingresso è `index.html` nella cartella principale.

**Va servito da un server web.** Aprendo `index.html` con un doppio clic
dal disco il sito resta vuoto: per sicurezza i browser impediscono a una
pagina aperta così di leggere gli altri file della cartella.

**Privacy:** il sito non invia dati da nessuna parte, non usa cookie, non
carica risorse esterne e non contiene dati personali. Punteggi e
preferenze restano nel browser di chi lo usa.

## Licenza d'uso

Materiale didattico liberamente utilizzabile e modificabile.
