# Prompt pronti — Hackathon AI per Docenti

Progetto: scienze naturali, prima liceo scientifico
Repository: https://github.com/andreazanellati-pixel/hackathon-ai-docenti
Cartella di lavoro: Desktop / hackathon-ai-docenti

---

## Prima di tutto: due cose da sistemare

1. **Git non è installato** su questo computer. Serve per collegare la cartella
   al repository e pubblicare il sito. Si scarica da gitforwindows.org
   (avanti-avanti-fine), oppure si può installare con winget.
2. **GitHub Pages** si attiva *dopo* il primo push: nel repository vai su
   Settings → Pages, sotto "Branch" scegli `main` e cartella `/ (root)`, poi Save.
   Dopo un paio di minuti il sito è su
   https://andreazanellati-pixel.github.io/hackathon-ai-docenti

⚠️ Il repository è pubblico: niente nomi reali di studenti, niente chiavi API.

---

## Prompt 0 · Setup (sempre, per primo — già compilato)

```
Questa cartella diventerà un piccolo sito pubblicato con GitHub Pages.
Il mio repository (pubblico, già creato dal sito di GitHub) è:
https://github.com/andreazanellati-pixel/hackathon-ai-docenti

Per prima cosa:
1. Collega questa cartella al repository usando solo git da riga di comando.
   Non usare gh (la GitHub CLI): non è installata.
2. Se git non ha ancora nome ed email configurati, chiedimeli e configurali.
3. Crea un file CLAUDE.md con queste regole di progetto e rispettale sempre:
   - sito statico: solo HTML, CSS e JavaScript, nessuna libreria esterna,
     nessun passaggio di build
   - index.html nella cartella principale e solo percorsi relativi
     (deve funzionare su GitHub Pages)
   - i contenuti stanno in file di testo semplici, separati dal codice,
     che io posso modificare senza saper programmare
   - commit piccoli e frequenti, con messaggi in italiano che spiegano
     cosa è cambiato
   - usa git, mai gh; prima di ogni git push chiedimi conferma
   - spiegami quello che fai con parole semplici: non sono un programmatore
   - il repository è pubblico: niente dati personali reali di studenti
4. Fai il primo commit e il primo push.
```

---

## Prompt A · Far nascere l'idea

```
Sono un docente di scienze naturali in una prima di liceo scientifico.
Devo costruire un artefatto didattico interattivo: un sito statico,
solo HTML/CSS/JavaScript, nessuna libreria, che funzioni su GitHub Pages.

Non ho ancora deciso cosa fare. Aiutami a trovare l'idea giusta:
intervistami prima di proporre, una domanda alla volta, al massimo sei.
Chiedimi che argomento sto affrontando in classe, quale concetto i miei
studenti capiscono meno, se lo userò io alla LIM o loro da soli, quanto
tempo ho in aula e cosa mi piacerebbe che gli studenti facessero.

Poi propormi tre idee diverse tra loro — non tre varianti di un quiz.
Per ognuna dimmi: cosa fa lo studente concretamente, quale concetto
diventa visibile che sul libro resta astratto, e quale file di testo
conterrà i contenuti che potrò modificare da solo.
Sconsigliami le idee che non reggono in un sito statico.
```

---

## Prompt B · Kickstart (compila le [PARENTESI QUADRE])

```
Segui le regole in CLAUDE.md (git sì, gh no).

Crea un artefatto didattico di scienze naturali per una prima di liceo
scientifico, su [ARGOMENTO].

Cosa deve fare: [DESCRIVI IN DUE O TRE RIGHE COSA FA LO STUDENTE:
cosa vede, cosa può toccare o muovere, cosa succede di conseguenza].

Il concetto che deve diventare chiaro è: [IL PUNTO CHE SUL LIBRO
RESTA ASTRATTO E QUI DEVE DIVENTARE VISIBILE].

- I contenuti stanno in [NOME-FILE].txt, una riga per elemento, nel formato:
  [CAMPO1 | CAMPO2 | CAMPO3]
  Le righe che iniziano con # sono commenti. Scrivi in cima al file le
  istruzioni per aggiungerne di nuovi.
- Riempilo con [QUANTI] elementi accurati. Se non sei sicuro di un dato
  scientifico, dimmelo invece di inventarlo.
- Se una riga è scritta male non bloccare tutto: saltala e segnala quale.
- Grafica curata e leggibile anche da telefono, tema chiaro/scuro.
- Prima di scrivere codice, se qualcosa non ti è chiaro chiedimelo.

Quando hai finito avvia un server locale, dimmi l'indirizzo da aprire nel
browser per provarlo, poi fai commit e, con la mia conferma, push.
```

---

## Quattro idee già ragionate, se servono da spunto

**1 · Laboratorio degli stati della materia**
Particelle disegnate in un contenitore; un cursore scalda e raffredda, le
particelle cambiano comportamento e intanto si disegna la curva di
riscaldamento. Rende visibile perché la temperatura resta ferma durante la
fusione. → `sostanze.txt`: nome | fusione | ebollizione | colore

**2 · Sistema solare e stagioni**
Orbite con interruttore "scala leggibile / scala reale", più modello
Terra-Sole con inclinazione dell'asse regolabile: durata del dì e altezza
del Sole per latitudine e stagione. Smonta l'idea che d'estate faccia caldo
perché siamo più vicini al Sole. → `pianeti.txt`

**3 · Chiave dicotomica dei minerali**
Lo studente identifica un campione rispondendo a domande da mineralogista
(durezza, sfaldatura, lucentezza, striscio). Insegna il metodo della
classificazione. → `chiave.txt` + `schede.txt`

**4 · La storia della Terra in scala**
4,6 miliardi di anni navigabili con zoom, fino a vedere quanto è sottile la
riga della nostra specie. Con modalità quiz a trascinamento.
→ `eventi.txt`: anni fa | titolo | descrizione | categoria

---

## Il percorso completo

| # | Passo | Chi |
|---|-------|-----|
| 0 | Cartella sul Desktop | fatto |
| 1 | Repository vuoto su GitHub | fatto |
| 2 | Installare Git for Windows | da fare |
| 3 | Prompt 0: collega, CLAUDE.md, primo commit e push | Claude |
| 4 | Scegliere l'idea e lanciare il Prompt B | tu |
| 5 | Provare in locale nel browser | tu |
| 6 | Commit + push, poi Settings → Pages | Claude + tu |
| 7 | (facoltativo) Aprire una issue e farla risolvere | tu + Claude |
