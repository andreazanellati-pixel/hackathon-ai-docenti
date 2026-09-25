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
| 🧊 Le particelle e gli stati della materia | 1ª, 3ª | Un contenitore di particelle da scaldare e raffreddare: i tre stati, i passaggi di stato e la curva di riscaldamento con i suoi plateau. Si regola anche la pressione, e la temperatura di ebollizione si sposta |
| 🌍 Terra, Sole e Luna | 1ª | Inclinazione dell'asse, latitudine e giorno dell'anno: durata del dì, altezza del Sole e stagioni. Portando l'asse a zero le stagioni spariscono |
| 📈 Trovare l'epicentro | 3ª, 4ª | Tre sismogrammi, il ritardo fra onde S e P, la dromocrona: si triangola come fanno i sismologi |
| 📊 Genetica di popolazioni | 4ª | Quattro esperimenti guidati sulla deriva genetica e la selezione, con la popolazione disegnata allele per allele e una spiegazione che accompagna passo passo |
| 🧬 Dal DNA alla proteina | 3ª, 5ª | Trascrizione, codice genetico e traduzione. Si cambia una base e il sito dice che tipo di mutazione è venuta fuori |
| 🌱 Gli incroci di Mendel | 3ª | Quadrati di Punnett a uno e due caratteri, e figli generati davvero a caso: le proporzioni emergono solo sui grandi numeri |

**In costruzione:** diffusione e osmosi,
stechiometria, molecole, teoria degli urti, equilibrio chimico,
titolazione, pile, enzimi, mitosi e meiosi, potenziale d'azione,
epidemie, fotosintesi, elettroforesi, vulcani, rocce, interno della
Terra, tettonica, bilancio radiativo.

## Per chi insegna: modificare i contenuti

Tutto sta in file di testo, che si aprono con il Blocco note e hanno le
istruzioni scritte in cima:

| File | Contiene |
|---|---|
| `stazioni.txt` | l'elenco delle stazioni della pagina iniziale |
| `stazioni/detective/casi.txt` | i casi del detective |
| `stazioni/sistema-internazionale/si.txt` | unità fondamentali, derivate, prefissi |
| `stazioni/convertire/unita.txt` | le scale di conversione |
| `stazioni/particelle/sostanze.txt` | le sostanze con calori specifici e latenti |
| `stazioni/terra-sole-luna/luoghi.txt` | i luoghi con la loro latitudine |
| `stazioni/dna-proteina/codice-genetico.txt` | le 64 triplette del codice genetico |
| `stazioni/mendel/caratteri.txt` | i caratteri degli incroci |

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
