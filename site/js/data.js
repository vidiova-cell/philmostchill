/*
 * philmostchill – Inhalte (Kategorien, Texte, Über Phil)
 * Wird über die Admin-Oberfläche (/admin/) gepflegt. Format: reines JSON
 * nach "window.PMC = " – bitte beim Bearbeiten von Hand gültiges JSON lassen.
 *
 * pos / posNarrow = Position des Sterns (0–1) auf breiten bzw. Hochkant-Bildschirmen
 * coords          = fiktive Himmelskoordinaten, nur Deko
 */
window.PMC = {
  "site": {
    "name": "philmostchill",
    "tagline": "Fotografie zwischen Licht und Schatten."
  },
  "categories": [
    {
      "id": "natur",
      "name": "Natur",
      "color": "#8fe8b8",
      "description": "Wälder, Wasser, Licht. Alles, was ohne uns schon schön war.",
      "coords": "RA 03h 47m · DEK +24°",
      "pos": {
        "x": 0.14,
        "y": 0.23
      },
      "posNarrow": {
        "x": 0.2,
        "y": 0.2
      }
    },
    {
      "id": "stadt",
      "name": "Stadt",
      "color": "#ffb980",
      "description": "Beton, Glas und die kleinen Geschichten zwischen den Häusern.",
      "coords": "RA 10h 08m · DEK +11°",
      "pos": {
        "x": 0.45,
        "y": 0.15
      },
      "posNarrow": {
        "x": 0.72,
        "y": 0.15
      }
    },
    {
      "id": "nacht",
      "name": "Nacht",
      "color": "#a5b8ff",
      "description": "Wenn das Licht knapp wird, wird es erst richtig interessant.",
      "coords": "RA 18h 36m · DEK +38°",
      "pos": {
        "x": 0.83,
        "y": 0.24
      },
      "posNarrow": {
        "x": 0.78,
        "y": 0.69
      }
    },
    {
      "id": "menschen",
      "name": "Menschen",
      "color": "#ff9fc8",
      "description": "Gesichter, Gesten, Momente. Meistens ungestellt.",
      "coords": "RA 05h 55m · DEK +07°",
      "pos": {
        "x": 0.62,
        "y": 0.87
      },
      "posNarrow": {
        "x": 0.22,
        "y": 0.72
      }
    },
    {
      "id": "unterwegs",
      "name": "Unterwegs",
      "color": "#ffe08a",
      "description": "Irgendwo zwischen Abfahrt und Ankommen.",
      "coords": "RA 06h 45m · DEK −16°",
      "pos": {
        "x": 0.2,
        "y": 0.79
      },
      "posNarrow": {
        "x": 0.36,
        "y": 0.87
      }
    }
  ],
  "about": {
    "pos": {
      "x": 0.88,
      "y": 0.79
    },
    "posNarrow": {
      "x": 0.8,
      "y": 0.855
    },
    "title": "Hi, ich bin Phil.",
    "text": [
      "Tagsüber ganz normal unterwegs, aber irgendwie immer mit einem Auge auf dem Licht. Fast alles hier ist mit dem Handy entstanden – ohne großes Equipment, dafür mit viel Geduld.",
      "Waage, also immer auf der Suche nach Balance: zwischen Licht und Schatten, Ruhe und Bewegung, Plan und Zufall."
    ],
    "contact": []
  },
  "legal": {
    "name": "[Vorname Nachname]",
    "street": "[Straße Hausnummer]",
    "city": "[PLZ Ort]",
    "email": "[E-Mail-Adresse]",
    "phone": ""
  }
};
