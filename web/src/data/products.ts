// ============================================================
// Catálogo de productos — DATOS DE DEMOSTRACIÓN (provisionales).
// Nombres, descripciones y beneficios son copia provisoria sujeta
// a la confirmación del catálogo por parte del cliente
// (ver PLAN-UX-UI-PROMOB.md §4.2). El campo `demo: true` marca cada
// registro como contenido de demostración, no comercial definitivo.
// ============================================================

export type ProductArtKey = "plus" | "start" | "manager" | "cut" | "scene";

export interface ProductFaq {
  question: string;
  answer: string;
}

export interface Product {
  slug: string;
  name: string;
  /** Descripción corta para tarjetas (dos líneas). */
  tagline: string;
  /** Subtítulo descriptivo del encabezado de detalle. */
  headline: string;
  /** Ilustración geométrica asociada. */
  art: ProductArtKey;
  /** Beneficios de la sección "Qué hace". */
  features: string[];
  /** Párrafo de la sección "Para quién es". */
  audience: string;
  /** Preguntas frecuentes del producto (2-3). */
  faqs: ProductFaq[];
  /** Marca de contenido de demostración/provisional. */
  demo: boolean;
}

export const products: Product[] = [
  {
    slug: "promob-plus",
    name: "Plus Professional",
    tagline:
      "Diseño 3D de muebles a medida: planos, cortes y render en minutos.",
    headline:
      "Diseñe muebles a medida en 3D y genere planos y cortes sin rehacer el trabajo.",
    art: "plus",
    features: [
      "Modelado 3D de muebles y ambientes a medida",
      "Planos técnicos y listas de corte automáticas",
      "Render integrado para presentar cada proyecto",
      "Biblioteca de herrajes y materiales del mercado local",
    ],
    audience:
      "Para estudios de diseño y fabricantes que proyectan muebles a medida: desde la primera idea hasta el plano listo para el taller, en un solo entorno.",
    faqs: [
      {
        question: "¿Necesito experiencia previa en diseño 3D?",
        answer:
          "No. La interfaz está pensada para el trabajo diario del taller e incluye plantillas y bibliotecas que aceleran el armado de cada proyecto. El soporte local lo acompaña en los primeros pasos.",
      },
      {
        question: "¿Puedo pasar mis diseños a la máquina de corte?",
        answer:
          "Sí. Las listas de corte se generan de forma automática y se integran con la etapa de fabricación del ecosistema Promob.",
      },
      {
        question: "¿El acceso es inmediato?",
        answer:
          "Sí. Una vez confirmado el pago, el código de acceso llega a su email en minutos.",
      },
    ],
    demo: true,
  },
  {
    slug: "promob-start",
    name: "Start",
    tagline: "Fabricación profesional: nido de piezas y control de la producción.",
    headline:
      "Controle la fabricación de cada proyecto, del nido de piezas al armado final.",
    art: "start",
    features: [
      "Generación de nidos de piezas optimizados",
      "Etiquetas e información de corte para el operario",
      "Control del avance de cada orden de fabricación",
      "Integración con los diseños de Plus Professional",
    ],
    audience:
      "Para talleres que fabrican en serie o a pedido y necesitan orden, trazabilidad y menos desperdicio en el piso de producción.",
    faqs: [
      {
        question: "¿Funciona con mi máquina de corte?",
        answer:
          "Promob Start genera nidos y etiquetas compatibles con las máquinas más usadas en la industria local. Si tiene dudas sobre su equipo, consúltenos por WhatsApp.",
      },
      {
        question: "¿Qué información lleva cada etiqueta?",
        answer:
          "Código del proyecto, pieza, material, canto y orientación de corte: todo lo que el operario necesita para trabajar sin dudas.",
      },
      {
        question: "¿Se integra con Plus Professional?",
        answer:
          "Sí. Los proyectos diseñados en Plus Professional pasan directamente a fabricación, sin redibujar ni volver a cargar datos.",
      },
    ],
    demo: true,
  },
  {
    slug: "promob-manager",
    name: "Manager",
    tagline: "Gestión del taller: presupuestos, órdenes y seguimiento de trabajos.",
    headline:
      "Organice presupuestos, órdenes y entregas sin perder el hilo de ningún trabajo.",
    art: "manager",
    features: [
      "Presupuestos rápidos con sus precios de referencia",
      "Órdenes de trabajo con estado y responsable",
      "Seguimiento de entregas y pendientes",
      "Historial completo por cliente y proyecto",
    ],
    audience:
      "Para dueños y responsables de taller que hoy llevan la gestión en planillas o papeles y necesitan una sola fuente de verdad.",
    faqs: [
      {
        question: "¿Puedo cargar mis propios precios?",
        answer:
          "Sí. Usted define los precios de referencia y los materiales; los presupuestos se arman con sus datos.",
      },
      {
        question: "¿Se puede usar desde varios equipos?",
        answer:
          "Sí. El equipo del taller trabaja en paralelo y cada cambio queda registrado con fecha y responsable.",
      },
      {
        question: "¿Qué pasa con los trabajos en curso?",
        answer:
          "Cada orden conserva su estado y su historial: puede retomar cualquier trabajo donde lo dejó, sin perder información.",
      },
    ],
    demo: true,
  },
  {
    slug: "promob-cut",
    name: "Cut Pro",
    tagline: "Optimización de corte de placas: menos desperdicio, más margen.",
    headline:
      "Optimice el corte de placas y convierta el desperdicio en margen.",
    art: "cut",
    features: [
      "Planes de corte optimizados por placa",
      "Aprovechamiento calculado antes de cortar",
      "Secuencia de corte pensada para el operario",
      "Informes de consumo por proyecto",
    ],
    audience:
      "Para talleres que cortan placas a diario y quieren bajar el costo de material sin sumar pasos al proceso.",
    faqs: [
      {
        question: "¿Cuánto material se puede ahorrar?",
        answer:
          "El ahorro depende de cada proyecto y del tipo de placa. Los informes de consumo le muestran el aprovechamiento antes de cortar, para decidir con datos.",
      },
      {
        question: "¿Qué formatos de placa soporta?",
        answer:
          "Los formatos y espesores más usados del mercado local. Si trabaja con un formato especial, consúltenos por WhatsApp.",
      },
      {
        question: "¿Se integra con Start?",
        answer:
          "Sí. Los planes de corte de Cut Pro alimentan la fabricación en Start, de la placa al nido de piezas.",
      },
    ],
    demo: true,
  },
  {
    slug: "real-scene",
    name: "Real Scene 2.0",
    tagline: "Render realista para presentar los proyectos antes de fabricar.",
    headline:
      "Presente cada proyecto con imágenes realistas antes de cortar la primera placa.",
    art: "scene",
    features: [
      "Render fotorrealista de ambientes y muebles",
      "Materiales y terminaciones de catálogo",
      "Imágenes listas para enviar al cliente",
      "Escenas para redes y propuestas comerciales",
    ],
    audience:
      "Para equipos comerciales y de diseño que cierran ventas mostrando el resultado final con calidad de fotografía.",
    faqs: [
      {
        question: "¿Cuánto demora un render?",
        answer:
          "Depende de la escena y del equipo, pero la mayoría de las imágenes se resuelven en minutos, listas para presentar.",
      },
      {
        question: "¿Necesito una computadora potente?",
        answer:
          "Una computadora de gama media es suficiente para trabajar con Real Scene 2.0. Si tiene dudas sobre su equipo, consúltenos.",
      },
      {
        question: "¿Puedo usar las imágenes en mis redes?",
        answer:
          "Sí. Las imágenes son de uso libre para su comunicación comercial: redes, catálogos y propuestas.",
      },
    ],
    demo: true,
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}
