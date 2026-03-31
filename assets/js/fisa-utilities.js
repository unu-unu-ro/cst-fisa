const USER_NAME_KEY = "fisa-nume";
const STORAGE_KEY = "fisa-form-data";

/**
 * CST Steps
 */
const STEPS = [
  {
    number: 1,
    title: "În ce fel a structurat autorul acest pasaj? <span class='note'>Te rugăm:</span>",
    questions: [
      {
        label: "a) să arăți structura sub formă de <i>secțiuni</i>, alături de versetele aferente.",
        field: "structura-sectiuni",
        placeholder: "Ex: I. Introducere (v. 1-3)\nII. Dezvoltarea principală (v. 4-10)\netc.",
        required: true,
        cls: "large"
      },
      {
        label: "b) să explici <i>strategiile</i> pe care le-ai folosit pentru a identifica această structură.",
        field: "structura-strategii",
        placeholder: "Ex: Cuvinte cheie repetate, conjuncții, schimbări de ton, etc.",
        required: true
      },
      {
        label: "c) ce <i>accent</i> ai dedus din această structură?",
        field: "structura-accent",
        placeholder: "Explică tema principală evidențiată prin structura identificată",
        required: true
      }
    ]
  },
  {
    number: 2,
    title: "Cum contribuie contextul la înțelegerea acestui pasaj?",
    hint: "Indicație: Te rugăm să incluzi doar ceea ce este relevant pentru înțelesul pasajului.",
    questions: [
      {
        label: "a) Contextul literar",
        field: "context-literar",
        hint: "pasajele dinainte și după",
        placeholder: "Descriere a contextului literar relevant pentru înțelegerea pasajului"
      },
      {
        label: "b) Contextul istoric",
        field: "context-istoric",
        hint: "împrejurările destinatarilor",
        placeholder: "Împrejurările istorice relevante pentru destinatarii originali"
      },
      {
        label: "c) Contextul cultural",
        field: "context-cultural",
        hint: "detalii despre viața oamenilor din acea vreme",
        placeholder: "Aspecte culturale care ajută la înțelegerea textului"
      },
      {
        label: "d) Contextul biblic",
        field: "context-biblic",
        hint: "citate, aluzii sau legături cu alte cărți din Biblie",
        placeholder: "Legături cu alte texte biblice, citate sau aluzii"
      }
    ]
  },
  {
    number: 3,
    title: "Care este ideea centrală pe care o argumentează autorul înaintea <i>ascultătorilor săi?</i>",
    questions: [
      {
        label: "într-o singură propoziție scurtă",
        field: "ideea-autorului",
        placeholder: "Formulează într-o propoziție clară și concisă ideea centrală a autorului",
        required: true
      }
    ]
  },
  {
    number: 4,
    title: "Care este legătura dintre acest pasaj și Evanghelia Domnului Isus Cristos?",
    questions: [
      {
        label:
          "Cum se raportează această legătură cu Evanghelia la ideea centrală a autorului? De ce este importantă această legătură cu Evanghelia pentru ascultătorii tăi?",
        field: "legatura-evanghelia",
        placeholder:
          "Explică cum se conectează pasajul cu Evanghelia și ce aspect specific al Evangheliei este evidențiat",
        required: true,
        cls: "large"
      }
    ]
  },
  {
    number: 5,
    title: "Care este ideea centrală pe care tu o vei argumenta înaintea <i>ascultătorilor tăi?</i>",
    questions: [
      {
        label: "într-o singură propoziție scurtă",
        field: "ideea-mea",
        placeholder: "Formulează ideea centrală pe care o vei predica, bazată pe înțelegerea pasajului",
        required: true
      }
    ]
  },
  {
    number: 6,
    title: "Ce titlul și schiță de predică vei folosi pentru a-ți argumenta ideea centrală?",
    questions: [
      {
        label: "Care este titlul predicii tale?",
        field: "titlu-predica",
        placeholder: "Un titlu clar și captivant pentru predica ta",
        required: true
        //type: "text"
      },
      {
        label: "Cum arată schița mesajului?",
        field: "schita-mesaj",
        placeholder: "I. Introducere\nII. Punctul principal 1\nIII. Punctul principal 2\nIV. Concluzie",
        required: true,
        cls: "large"
      }
    ]
  },
  {
    number: 7,
    title: "Cum îți vei aplica ideea centrală spre binele ascultătorilor tăi?",
    hint: "Gândește-te deopotrivă la cei mântuiți și la cei nemântuiți. Indică unde anume vei include aceste aplicații în predica ta.",
    questions: [
      {
        label: "Aplicații pentru cei mântuiți",
        field: "aplicatii-mantuiti",
        placeholder: "Aplicații practice și spirituale pentru creștini",
        required: true,
        cls: "large"
      },
      {
        label: "Aplicații pentru cei nemântuiți",
        field: "aplicatii-nemantuiti",
        placeholder: "Aplicații și îndemnuri pentru cei care nu sunt încă creștini",
        required: true,
        cls: "large"
      }
    ]
  }
];

// TODO auto calculate based on STEPS (all except type: "text")
const RICH_FIELDS = STEPS.reduce((fields, step) => {
  step.questions.forEach(q => {
    if (q.type === "text") return;
    fields.push(q.field);
  });
  return fields;
}, []);

function getPageTitle(nume, text) {
  nume = nume || "";
  text = text || "";
  text = text.replaceAll(":", ".").trim();

  let title = "Formular Fișă de lucru – 7 Pași";

  if (nume && text) {
    title = `${nume} - ${text}`;
  } else if (nume) {
    title = `${nume} - Fișă de lucru`;
  } else if (text) {
    title = `Fișă de lucru - ${text}`;
  }
  return title;
}

function migrateToV2(data) {
  if (!data || data.version >= 2) return data;
  RICH_FIELDS.forEach(field => {
    if (data[field] && typeof data[field] === "string") {
      data[field] = window.DOMPurify.sanitize(window.marked.parse(data[field]));
    }
  });
  data.version = 2;
  return data;
}

function getPersistedData() {
  const savedData = localStorage.getItem(STORAGE_KEY);
  if (savedData) {
    try {
      return migrateToV2(JSON.parse(savedData));
    } catch (e) {
      console.error("Error parsing saved form data:", e);
      return {};
    }
  }
  return {};
}

function parseMarkdown(text) {
  if (!text) return "";
  text = text.replace(/(\n)/g, "$1$1"); // Preserve line breaks (in case there is only one newline, which is ignored by markdown)
  text = text.replaceAll("  ", " &nbsp;"); // replace double spaces with non-breaking space
  const html = window.marked.parse(text);
  return window.DOMPurify.sanitize(html);
}

function renderContent(value) {
  if (!value) return "";
  // v2: already HTML — sanitize and render directly
  if (/<[a-z][\s\S]*>/i.test(value)) {
    return window.DOMPurify.sanitize(value);
  }
  // v1 legacy: plain markdown text
  return parseMarkdown(value);
}
