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
| 🧪 La titolazione acido-base | 4ª | Una buretta che gocciola, il pH ricalcolato goccia dopo goccia e la curva che nasce sotto gli occhi. Si sceglie l'indicatore e si scopre quando mente |
| 🔬 Il banco degli enzimi | 2ª, 5ª | Substrato, temperatura, pH e inibitori da regolare. La denaturazione si vede accadere, e non si torna indietro: raffreddando l'enzima resta rovinato |
| ⚖️ L'equilibrio chimico | 4ª | Una reazione reversibile in un recipiente col pistone. Q e K sono sempre scritti uno accanto all'altro: si disturba il sistema, si vede Q allontanarsi e poi tornare |
| 💥 La teoria degli urti | 4ª | Energia di attivazione, temperatura, concentrazione e catalizzatori. La curva di Maxwell e Boltzmann con l'area colorata oltre la collina, e la regola dei dieci gradi messa alla prova |
| ⚗️ Il banco di stechiometria | 1ª, 2ª | Si mettono i reagenti sul banco e si vede quale finisce per primo. Il conto passaggio per passaggio, dai grammi alle moli e ritorno, con la bilancia di Lavoisier che deve sempre tornare |
| 🔋 Pile ed elettrolisi | 4ª | Si scelgono i due elettrodi e si legge la tensione. La scala dei potenziali mette tutti i metalli in fila: chi sta in basso cede elettroni a chi sta in alto, ed e' per questo che il ferro arrugginisce e l'oro no |
| 💧 Diffusione e osmosi | 1ª, 2ª | Due scomparti e una membrana. L'osmosi non e' rappresentata: emerge dal moto a caso delle particelle, e si ferma da sola quando il dislivello fa da contrappeso |
| 🧫 Mitosi e meiosi a confronto | 2ª, 3ª | Le fasi una per una, coi cromosomi del padre e della madre disegnati a colori diversi, e il grafico della quantita di DNA accanto al numero di cromosomi: si vede che non cambiano nello stesso momento |
| 🦠 Epidemia e vaccinazione | 2ª, 5ª | R0, R effettivo e soglia di gregge. Si vede perche' vaccinare il 95% ferma il morbillo e il 90% no, e perche' un'epidemia si spegne molto prima di aver contagiato tutti |
| 🌿 La fotosintesi | 2ª, 5ª | Luce, anidride carbonica e temperatura. Il fattore limitante non e' raccontato: il sito prova ad aumentare ognuna delle tre cose e dice quale fa salire di piu' il guadagno |
| 🌡️ Il bilancio radiativo | 1ª, 5ª | Luce ricevuta, albedo ed effetto serra. La Terra senza atmosfera fa meno 18 gradi, con l'atmosfera piu' 15: quei 33 gradi si vedono comparire |
| 🌐 Dentro la Terra con le onde | 3ª, 4ª | I raggi sismici sono calcolati uno per uno con la legge di Snell su una sfera. La zona d'ombra non e' disegnata: esce dal conto, e viene fra 98 e 140 gradi contro i 103-143 misurati |
| 🌍 Terra, Sole e Luna | 1ª | Inclinazione dell'asse, latitudine e giorno dell'anno: durata del dì, altezza del Sole e stagioni. Portando l'asse a zero le stagioni spariscono |
| 📈 Trovare l'epicentro | 3ª, 4ª | Tre sismogrammi, il ritardo fra onde S e P, la dromocrona: si triangola come fanno i sismologi |
| 📊 Genetica di popolazioni | 4ª | Quattro esperimenti guidati sulla deriva genetica e la selezione, con la popolazione disegnata allele per allele e una spiegazione che accompagna passo passo |
| 🧬 Dal DNA alla proteina | 3ª, 5ª | Trascrizione, codice genetico e traduzione. Si cambia una base e il sito dice che tipo di mutazione è venuta fuori |
| 🌱 Gli incroci di Mendel | 3ª | Quadrati di Punnett a uno e due caratteri, e figli generati davvero a caso: le proporzioni emergono solo sui grandi numeri |

**In costruzione:** molecole, potenziale d'azione,
elettroforesi, vulcani, rocce, tettonica.

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
| `stazioni/titolazione/soluzioni.txt` | gli acidi e le basi da titolare, con i loro pKa |
| `stazioni/titolazione/indicatori.txt` | gli indicatori con l'intervallo di viraggio e i colori |
| `stazioni/enzimi/enzimi.txt` | gli enzimi con Km, Vmax, temperature e pH |
| `stazioni/equilibrio/reazioni.txt` | le reazioni reversibili con K, temperatura e delta H |
| `stazioni/urti/reazioni-urti.txt` | le reazioni con energia di attivazione e catalizzatore |
| `stazioni/stechiometria/reazioni-stechiometria.txt` | le reazioni bilanciate con le masse molari |
| `stazioni/pile/elettrodi.txt` | gli elettrodi con i potenziali standard |
| `stazioni/divisione-cellulare/fasi.txt` | le fasi della divisione, coi loro testi e i loro numeri |
| `stazioni/epidemia/malattie.txt` | le malattie con il loro R0 e i giorni contagiosi |
| `stazioni/fotosintesi/piante.txt` | le piante con Pmax, K per la CO2 e respirazione |
| `stazioni/bilancio-radiativo/corpi.txt` | i pianeti con luce ricevuta, albedo ed effetto serra |
| `stazioni/interno-terra/strati.txt` | gli strati della Terra con le velocita' sismiche |

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
