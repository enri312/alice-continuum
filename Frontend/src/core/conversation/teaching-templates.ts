export type TeachingMemoryType = "semantic" | "procedural" | "preference" | "episodic";

export type TeachingTemplate = {
  id: "profile" | "faculty" | "project" | "preference" | "people" | "rules";
  code: string;
  label: string;
  description: string;
  memoryType: TeachingMemoryType;
  importance: number;
  titlePlaceholder: string;
  contentPlaceholder: string;
};

export const teachingTemplates: TeachingTemplate[] = [
  {
    id: "profile",
    code: "01",
    label: "Sobre mí",
    description: "Datos personales que querés que Alice pueda recuperar.",
    memoryType: "semantic",
    importance: 4,
    titlePlaceholder: "Ej.: Un dato personal que Alice debe recordar",
    contentPlaceholder: "Escribí el dato exacto, con el contexto necesario y sin información que no quieras guardar…",
  },
  {
    id: "faculty",
    code: "02",
    label: "Facultad",
    description: "Materias, horarios, objetivos académicos o formas de estudiar.",
    memoryType: "semantic",
    importance: 4,
    titlePlaceholder: "Ej.: Una materia, horario u objetivo académico",
    contentPlaceholder: "Explicá qué debería recordar Alice y cómo puede ayudarte con este tema…",
  },
  {
    id: "project",
    code: "03",
    label: "Proyectos",
    description: "Decisiones, tecnologías y próximos pasos de tus proyectos.",
    memoryType: "procedural",
    importance: 4,
    titlePlaceholder: "Ej.: Una decisión importante de un proyecto",
    contentPlaceholder: "Describí la decisión, su motivo y cualquier límite que Alice deba respetar…",
  },
  {
    id: "preference",
    code: "04",
    label: "Preferencias",
    description: "Cómo preferís trabajar, aprender, conversar o recibir ayuda.",
    memoryType: "preference",
    importance: 3,
    titlePlaceholder: "Ej.: Cómo prefiero recibir explicaciones",
    contentPlaceholder: "Contale a Alice qué preferís y en qué situaciones debería aplicarlo…",
  },
  {
    id: "people",
    code: "05",
    label: "Personas",
    description: "Relaciones importantes, guardadas solamente con tu permiso.",
    memoryType: "episodic",
    importance: 4,
    titlePlaceholder: "Ej.: Una persona importante y su relación conmigo",
    contentPlaceholder: "Incluí solo la información necesaria que tengas permiso y voluntad de conservar…",
  },
  {
    id: "rules",
    code: "06",
    label: "Reglas para Alice",
    description: "Límites y comportamientos que Alice debe tener en cuenta.",
    memoryType: "procedural",
    importance: 5,
    titlePlaceholder: "Ej.: Una regla que Alice debe respetar",
    contentPlaceholder: "Definí la regla de manera concreta, cuándo se aplica y qué debería hacer Alice…",
  },
];
