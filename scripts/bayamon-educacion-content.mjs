// Content of the Bayamón Educación Municipal site, reshaped for Nexus.
//
// Source of truth: https://www.municipiodebayamon.com/servicios-municipales/educacion/
// Pulled from the municipality's own WordPress REST API, then hand-reshaped:
// the Gutenberg cover blocks and the grey "contact" boxes became real markdown,
// and cross-references between department pages became [[wiki links]].
//
// Nothing is invented here. Every fact, phone number, address, figure and link
// comes from the pages listed in SOURCE. Where the site itself is vague, the
// page says so rather than guessing.

export const SOURCE_ROOT = "https://www.municipiodebayamon.com/servicios-municipales/educacion"

/** A provenance footer, so anyone editing a page can get back to the original. */
const from = (path) => `\n---\n\n_Fuente: [municipiodebayamon.com](${SOURCE_ROOT}${path})_`

export const SPACE = {
  name: "Educación Municipal",
  icon: "🎓",
  description: "Departamento de Educación Municipal de la Ciudad de Bayamón: programas, servicios al estudiante y mantenimiento.",
}

export const PAGES = [
  {
    key: "educacion-municipal",
    title: "Educación Municipal",
    icon: "🏛️",
    content: `> Brinda servicios a la comunidad escolar los cuales se complementan con los que ofrece el Gobierno Central, proveyendo beneficios que redunden en un mejor bienestar para los estudiantes de la Ciudad de Bayamón.

El Departamento de Educación Municipal administra los programas y servicios educativos para la comunidad estudiantil de Bayamón.

## Visión

Ser modelo de administración pública efectiva en el ejercicio de forjar profesionales.

## Misión

Ofrecer servicios y gratificar a la comunidad escolar de la ciudad de Bayamón. Facilitándoles propiciar un ambiente en pro de continuar estudios universitarios.

## Valores

- **Compromiso:** Servir a toda la comunidad estudiantil.
- **Integridad:** Los recursos disponibles al alcance del estudiantado de Bayamón.
- **Sensibilidad:** Mantenemos los afectos de compasión, humanidad y ternura.
- **Justicia:** Respetar y amar la naturaleza.
- **Excelencia:** Estamos a la vanguardia en la tecnología.

## Dirección

Carretera #2
Antiguo Hospital Ruiz Soler
Frente a Urb. Jardines de Caparra
Bayamón, Puerto Rico

- **Teléfono:** (787) 781-6655
- **Fax:** (787) 783-4785

## Programas y servicios

El departamento se administra a través de tres programas —[[Programa Dirección]], [[Programa de Servicios al Estudiante]] y [[Programa de Mantenimiento]]— y da servicios a través de:

- [[Taller de Arte]]
- [[Proyecto Nacer]]
- [[Biblioteca Municipal Dra. Pilar Barbosa]]
- [[Programa Head Start]]
- [[Programa Puedes]]

Todos los teléfonos y direcciones están reunidos en [[Directorio de Contactos]].

## Operación diaria

- [[Inventario de materiales]] — el catálogo del almacén en Krates, las categorías y el número de parte.
- [[Fotos de los artículos]] — cómo se toma una foto útil y qué artículos todavía no tienen una.
- [[Cuentas de acceso del personal]] — cómo se nombra una cuenta y qué falta resolver.${from("/educacion-municipal/")}`,
  },
  {
    key: "programas",
    title: "Programas",
    icon: "📋",
    content: `El Departamento de Educación Municipal administra los siguientes programas y servicios:

- [[Programa Dirección]] — dirige, supervisa y coordina con las agencias de Gobierno Central.
- [[Programa de Servicios al Estudiante]] — transportación escolar, becas, ayudas económicas y donaciones.
- [[Programa de Mantenimiento]] — mantenimiento de los edificios de los programas y de 46 escuelas en convenio con la OMEP.

Los programas dan servicio a la comunidad a través de [[Taller de Arte]], [[Proyecto Nacer]], [[Biblioteca Municipal Dra. Pilar Barbosa]], [[Programa Head Start]] y [[Programa Puedes]].

## Dirección del departamento

- Carretera #2, Antiguo Hospital Ruiz Soler, Frente a Urb. Jardines de Caparra, Bayamón, Puerto Rico
- **Teléfono:** (787) 781-6655
- **Fax:** (787) 783-4785

Véase también [[Educación Municipal]] y [[Directorio de Contactos]].${from("/educacion-municipal/programas/")}`,
  },
  {
    key: "programa-direccion",
    title: "Programa Dirección",
    icon: "🧭",
    content: `Dirige y supervisa los programas que están bajo el Departamento de Educación Municipal.

Coordina con las agencias de Gobierno Central de forma eficiente para el beneficio de toda la comunidad escolar y los servicios que ofrecen los diferentes programas.

- **Teléfonos:** 787-781-6655, 787-782-4685
- **Fax:** 787-783-4785

Parte de [[Programas]] del [[Educación Municipal]].${from("/educacion-municipal/programas/")}`,
  },
  {
    key: "programa-servicios-al-estudiante",
    title: "Programa de Servicios al Estudiante",
    icon: "🎒",
    content: `## Transportación escolar

Se ofrecen servicios de transportación para actividades recreativas, educativas y culturales.

## Becas y ayudas económicas

Se ofrecen becas a estudiantes de ingresos bajos con un índice académico de 2.50 en adelante. Esta ayuda se ofrece según disponibilidad de fondos.

## Donaciones

Donativo de $500.00 dólares y $1,000.00 respectivamente a clases graduandas de 8vo. y 4to. año para gastos de graduación. Esta ayuda se ofrece según disponibilidad de fondos.

- **Teléfono:** 787-781-6655 ext. 3403

Parte de [[Programas]] del [[Educación Municipal]].${from("/educacion-municipal/programas/")}`,
  },
  {
    key: "programa-mantenimiento",
    title: "Programa de Mantenimiento",
    icon: "🔧",
    content: `Contamos con una brigada que ofrece mantenimiento a los edificios de los programas bajo este departamento:

- Oficinas Administrativas
- [[Biblioteca Municipal Dra. Pilar Barbosa]]
- Centros Cibernéticos del Barrio Dajaos, La Morenita y Barrio Nuevo
- La Escuela de Bellas Artes

En convenio con la Oficina de Mejoramiento a Escuelas Públicas (OMEP), se les brinda los servicios de plomería, electricidad, vaciado de pozo séptico, carpintería y albañilería a **46 escuelas** del Municipio de Bayamón.

- **Teléfonos:** 787-781-6655 ext. 3405, 3406

Parte de [[Programas]] del [[Educación Municipal]].${from("/educacion-municipal/programas/")}`,
  },

  {
    key: "taller-de-arte",
    title: "Taller de Arte",
    icon: "🎨",
    content: `Este programa brinda servicios a niños, jóvenes y adultos de escasos recursos económicos, que no poseen los medios necesarios para adiestrarse en las Artes Plásticas.

Te invitamos a formar parte de nuestra matrícula y comenzar tu carrera en una de las áreas más bonitas de las bellas artes… las artes plásticas.

Ofrecemos clases de dibujo y pintura al óleo o acrílico. Se incluyen los materiales de arte para que puedas realizar las prácticas en el salón de clases.

## Meta

Lograr la autosuficiencia, el desarrollo y competencia social de los participantes del programa.

## Propósito

- *Adiestrar* a personas con gran interés en las artes plásticas de modo que puedan auto emplearse a través de la venta de sus obras de arte o realizando tareas relacionadas a los conocimientos adquiridos en las artes plásticas.
- *Reforzar* valores, autoestima y disciplina de los participantes.
- *Formar* individuos independientes, capaces de integrarse a la fuerza laboral del país.
- *Prevenir* la ociosidad, deserción escolar y delincuencia.
- *Promover* la unidad familiar.
- *Dirigir* a los participantes de modo que logren convertirse en individuos independientes.

## Requisitos

- Ser residente de la Ciudad de Bayamón
- Estar en desventaja económica, según la tabla de pobreza aplicable a Puerto Rico y proveer los documentos requeridos
- Tener 9 años o más (tenemos grupos de adultos y de personas de edad avanzada)
- Tener interés y talento en artes

## Horarios flexibles

- **Niños:** 3:30 pm a 6:00 pm
- **Adultos:** 9:30 am a 12:30 pm, o 3:30 pm a 6:00 pm

Para facilitar el que puedas asistir a clase, los profesores hacen otros arreglos de horario.

**Horario de oficina:** lunes a viernes de 8:00 am – 6:00 pm.

## Dirección

Nuestras instalaciones están ubicadas anexo al Terminal de Transportación Guadarrama, el cual se encuentra al lado de la Casa Alcaldía de Bayamón.

- **Teléfonos:** (787) 798-5787, 269-2694, 780-5552 Ext. 2060

Programa del [[Educación Municipal]].${from("/taller-de-arte/")}`,
  },
  {
    key: "proyecto-nacer",
    title: "Proyecto Nacer",
    icon: "👶",
    content: `El Proyecto Nacer ofrece servicios a los padres adolescentes que estudien o trabajen, adolescentes embarazadas desde el inicio del embarazo hasta los 19 años y 11 meses de edad y al niño por nacer hasta 3 años y 11 meses.

Contamos con dos centros en la Ciudad de Bayamón, en Juan Sánchez y Van Scoy.

Para más información, visitar [proyectonacer.com](http://proyectonacer.com/).

## Proyecto Nacer — Sección Van Scoy

- **Teléfono:** (787) 730-2575
- **Dirección:** Carretera 167, Km 14.8, Bo. Buena Vista, Sector Van Scoy, Antiguo CDT Bayamón

## Proyecto Nacer — Bo. Juan Sánchez

- **Teléfono:** (787) 785-2223
- **Dirección:** Calle #2, Esquina Calle #6, Barrio Juan Sánchez, Bayamón

Programa del [[Educación Municipal]].${from("/proyecto-nacer/")}`,
  },
  {
    key: "biblioteca",
    title: "Biblioteca Municipal Dra. Pilar Barbosa",
    icon: "📚",
    content: `![Logo Universidad Ana G. Méndez](https://www.municipiodebayamon.com/wp-content/uploads/2019/10/4920971922306134636174018817045341556703232n-3ff59ea27d6734ff920c43d9008b30f0-900x600-500x333.jpg)

La Biblioteca Municipal Dra. Pilar Barbosa, por medio de un Acuerdo de Colaboración, es administrada por la **Universidad Ana G. Méndez**. Esta alianza nos permite desarrollar aún más los recursos de información existentes, a la altura de las mejores bibliotecas del país.

Ofrece servicios a la comunidad de Bayamón y a todos aquellos ciudadanos que soliciten servicios bibliotecarios y de información. Nuestra Biblioteca reúne los materiales impresos, audiovisuales y electrónicos necesarios para dirigir actividades individuales y de grupos de la comunidad.

## Proyectos y actividades fijas

- Campanas de Renacer
- Sala Infantil
- Lectura y dramatización de cuentos a solicitud de las escuelas, ofrecido por el personal bibliotecario de la Sala y estudiantes de práctica
- Charlas motivadoras
- Charlas y conferencias de índole educativa y cultural
- Exposiciones de arte

> Municipio de Bayamón y la Universidad Ana G. Méndez: al servicio de la Educación.

## Dirección

Paseo del Parque, Esquina Calle Betances, Bayamón, Puerto Rico 00961

**Horario**

- Lunes a viernes: 7:00 a.m. – 8:00 p.m.
- Sábado: 8:00 a.m. – 5:00 p.m.

**Teléfono:** (787) 288-1100 Ext. 1366 o 1367

Programa del [[Educación Municipal]]. Su edificio es uno de los que atiende el [[Programa de Mantenimiento]].${from("/biblioteca-dra-pilar-barbosa/")}`,
  },
  {
    key: "head-start",
    title: "Programa Head Start",
    icon: "👦",
    content: `> Esta institución ofrece igualdad de oportunidades ([Notificación de No Discriminación](https://www.municipiodebayamon.com/wp-content/uploads/2026/04/Declaracion-de-No-Discrimen-de-USDA_forma-larga-ingles.pdf)). Oprima [aquí](https://www.municipiodebayamon.com/wp-content/uploads/2026/04/Aviso-al-Beneficiario-y-posible-beneficiario-marzo-2026.pdf) para descargar el Aviso al Beneficiario y Posible Beneficiario.

**Head Start** es un programa federal que provee servicios a niños de edad preescolar de familias cuyos ingresos se ajustan a la guía de pobreza federal. Un mínimo de un 10% de la matrícula deben ser niños con discapacidades, incluyendo la población de Autismo, y hasta un 10% pueden ser de familias de alto ingreso si estas presentan alguna situación social, según establecido en los criterios de selección.

Este programa se inició en Puerto Rico en el 1965 con el propósito de ofrecer servicios en áreas de Educación, Salud, Salud Mental, Nutrición, Servicios a Niños con Discapacidades, Servicios Sociales y Participación de Padres. Hoy día estos servicios son más amplios y abarcadores con un enfoque centrado en la preparación escolar, la familia y comunidad.

En la actualidad se ofrecen servicios a una matrícula de **1,128 niños** y a sus familias en los municipios de Bayamón, Naranjito y Comerío.

En el 1998 se estableció el Programa Early Head Start, el cual responde a la creciente necesidad de servicios a infantes, andarines y a mujeres embarazadas. Actualmente sirve a una matrícula de **88 niños**.

## Programa de Alimentos (PACNA / CACFP)

El Programa Head Start les anuncia a los padres la participación de sus centros en el Programa de Alimentos para el Cuidado de Niños y Adultos (PACNA o CACFP por sus siglas en inglés, *Child and Adult Care Food Program* del Departamento de Agricultura Federal, USDA).

El PACNA es un programa federal que proporciona fondos que permiten a los operadores de centros de cuido diurnos ofrecer comidas y meriendas nutritivas a los participantes matriculados en el Programa. El PACNA contribuye al bienestar, crecimiento saludable y el desarrollo de niños, jóvenes y adultos en los Estados Unidos y sus territorios.

Las comidas están disponibles para todos los participantes y a todos los participantes se les sirven las mismas comidas independientemente de su raza, color, origen nacional, sexo, edad o discapacidad, y no hay discriminación en el curso del servicio de alimentos sobre la base de las clases protegidas.

Se les anuncia que la institución tiene la obligación de otorgar acomodo razonable del lenguaje y modificación de alimentos que respondan a alguna discapacidad:

- Las personas con dominio limitado del inglés tienen derecho a servicios gratuitos de asistencia lingüística en un idioma que puedan entender (por ejemplo, servicios de traducción e interpretación).
- Las personas con discapacidades tienen derecho a adaptaciones gratuitas en un idioma o formato alternativo que puedan entender (ej., ayudas y servicios auxiliares y modificaciones razonables).
- Los participantes del Programa con una discapacidad que requieran modificación de la comida tienen derecho a modificación de los alimentos de manera gratuita para cubrir la discapacidad que impide consumir las comidas regulares servidas.

La **Agencia Estatal de Servicios de Alimentos y Nutrición (AESAN)** del Departamento de Educación es la agencia que administra los fondos federales de PACNA en Puerto Rico, y como responsable de la operación general de los siguientes programas:

- Head Start
- Early Head Start
- Programa Cuido y Desarrollo del Niño
- Programa de Alimentos para Niños (U.S.D.A)

## Pre-matrícula y documentos

Para ver, guardar e imprimir los siguientes documentos es necesaria la versión más reciente de [Adobe Acrobat Reader](https://get.adobe.com/reader/otherversions/).

- [Guía de pasos para llenar el formulario de pre-matrícula en línea de Head Start & Early Head Start](https://www.municipiodebayamon.com/wp-content/uploads/2020/07/Guía-de-pasos-para-acceder-a-pre-matrícula-en-línea_Head-Start.pdf)
- [Formulario de pre-matrícula en línea de Head Start & Early Head Start](https://www.municipiodebayamon.com/servicios-municipales/educacion/programa-head-start/pre-solicitud-head-start/)
- [Guía de pasos para descargar los documentos de matrícula](https://www.municipiodebayamon.com/wp-content/uploads/2020/07/Guia-de-pasos-para-descarga-de-documentos_Head-Start.pdf)
- [Boleta de Informática de Documentos Requeridos](https://www.municipiodebayamon.com/wp-content/uploads/2020/01/Boleta-de-promocion-de-documentos-requeridos-HSBAY-ERSEA-OR-33-cropped.pdf)
- [Autorización visita a colaterales para validación de información](https://www.municipiodebayamon.com/wp-content/uploads/2020/07/Autorizacion-visita-a-colaterales-pra-validacion-de-informacion-HSBAYERSEA.OR-27.pdf)
- [Certificación de No Fraude](https://www.municipiodebayamon.com/wp-content/uploads/2020/07/Certificacion-de-no-fraude-HSBAYERSEA.OR-57.pdf)
- [Certificación de Residencia](https://www.municipiodebayamon.com/wp-content/uploads/2020/07/Certificacion-de-residencia-HSBAYERSEA.OR-31.pdf)

### Formularios digitales

Para beneficio de aquellos que no tienen la facilidad de imprimir los documentos, los mismos están disponibles en modo Formulario Digital. Para llenar los siguientes documentos desde tu celular o tableta puede que sea necesaria la aplicación de Microsoft Word ([Apple](https://apps.apple.com/us/app/microsoft-word/id586447913) | [Android](https://play.google.com/store/apps/details?id=com.microsoft.office.word&hl=en)).

- [Autorización visita a colateral para validación de información (DOCX)](https://www.municipiodebayamon.com/wp-content/uploads/2020/07/Autorizacion-visita-a-colaterales-pra-validacion-de-informacion-HSBAYERSEA.OR-27.docx)
- [Certificación de No Fraude (DOCX)](https://www.municipiodebayamon.com/wp-content/uploads/2020/07/Certificacion-de-no-fraude-HSBAYERSEA.OR-57.docx)
- [Certificación de Residencia (DOCX)](https://www.municipiodebayamon.com/wp-content/uploads/2020/07/Certificacion-de-residencia-HSBAYERSEA.OR-31.docx)

## Informes de logros

- 2016-2017: [Informe de Logros 2016-17](https://www.municipiodebayamon.com/wp-content/uploads/2014/10/INFORME-DE-LOGROS2016-17.pdf)
- 2015-2016: [Informe de Logros 2015-16](https://www.municipiodebayamon.com/wp-content/uploads/2014/10/Informe-de-Logros-Head-Start-2015-2016-low.pdf)
- 2014-2015: [Informe de Logros 2014-15](https://www.municipiodebayamon.com/wp-content/uploads/2014/10/Informe-de-Logros-2014-2015-WEB.pdf)

## Dirección

Calle Maceo #19, Frente a la Plaza de Recreo, Bayamón, Puerto Rico 00961

**Teléfono:** (787) 798-7002

Programa del [[Educación Municipal]]. Detalle en [[Misión Head Start]], [[Requisitos Head Start]], [[Programas Head Start]] y [[Lista de Centros Head Start]].${from("/programa-head-start/")}`,
  },
  {
    key: "head-start-mision",
    title: "Misión Head Start",
    icon: "🎯",
    content: `## Misión

El Programa Head Start / Early de la Ciudad de Bayamón está comprometido a proveer servicios efectivos y de calidad en todas las disciplinas a niños entre las edades de 0 a 4 años con 11 meses, a través de un equipo de empleados especializados y bien entrenados, que apoyarán y fortalecerán las familias para promover su autosuficiencia.

Desarrollar la creatividad en nuestros niños a través de la educación individualizada y darle destrezas necesarias a sus familias para fortalecer y desarrollar el trabajo comunitario.

> "Trabajando juntos por una niñez feliz"

## Participación de Padres

Además de ser un programa enfocado en el niñ@, los servicios Head Start / Early proveen oportunidad para la participación de los padres:

- Realza el rol del padre/madre como la influencia principal en la educación de sus hij@s.
- Colabora con éstos para desarrollar sus fortalezas para lograr objetivos personales y familiares.
- Involucra a los padres en la toma de decisiones a través de la organización de comités de padres y el Consejo Normativo.

## Dirección

Calle Maceo #19, Frente a la Plaza de Recreo, Bayamón, Puerto Rico 00961

**Teléfono:** (787) 798-7002

Parte de [[Programa Head Start]].${from("/programa-head-start/mision/")}`,
  },
  {
    key: "head-start-requisitos",
    title: "Requisitos Head Start",
    icon: "📋",
    content: `## Head Start

- Niñ@s entre las edades de 3 años a 4 años con 11 meses.

## Early Head Start

- Niñ@s recién nacidos hasta 2 años con 11 meses, adolescentes embarazadas.

## Ambos programas

- Residentes de Bayamón, Naranjito, Comerío.
- Vacunación iniciada o al día.
- Ingresos familiares según lo establecido en la guía de pobreza federal.
- En los casos de niños con discapacidades, evaluaciones de la condición del menor.
- Acta de nacimiento.
- Seguro Social, del menor y jefe de familia.

## Prioridades de selección de matrícula

- Familias de bajos recursos económicos
- Niños de cuatro años cumplidos en agosto (Head Start)
- Familias y niñ@s en ambientes de alto riesgo (violencia, maltrato, drogas)
- Familias participantes de TANF, PAN, Foster Care, WIA, WIC
- Familias "Homeless"
- Familias residentes de las comunidades servidas

## Programa Early Head Start

- Adolescentes embarazadas
- Niñ@s recién nacidos a 2 años con 11 meses

## Documentos requeridos

- Original y copia del Certificado de Nacimiento (actualizado)
- Original y copia del Certificado de Vacunas
- Copia de la Tarjeta WIC
- Copia del Plan Médico del niño/a
- Certificado de Ingreso (W-2 o Planilla Certificada)
- Información sobre tratamiento o evaluaciones que se le han hecho al niño con necesidad especial
- Certificación de Asistencia Económica y/o Nutricional
- Verificación de Residencia (talonario de agua o luz)

> Pueden solicitar otros documentos que sean requeridos.

## Dirección

Calle Maceo #19, Frente a la Plaza de Recreo, Bayamón, Puerto Rico 00961

**Teléfono:** (787) 798-7002

Parte de [[Programa Head Start]]. Los centros donde se solicita están en [[Lista de Centros Head Start]].${from("/programa-head-start/requisitos/")}`,
  },
  {
    key: "head-start-programas",
    title: "Programas Head Start",
    icon: "🧩",
    content: `## Programa Cuido y Desarrollo del Niño (Child Care)

- Recibe fondos del "Child Care Block Grant" a través de ACUDEN.
- Ofrece servicios a niños desde 2 meses hasta 3 años de padres que estudien, trabajen o participen en un programa de rehabilitación y que sus ingresos no sobrepasen la mediana de ingreso de Puerto Rico.
- Ofrece servicio de horario extendido a niños en Centros del Programa Head Start.

## Proyecto de Autismo Infantil

Ofrece servicios educativos a niños con autismo. El mismo es un esfuerzo de colaboración con el Departamento de Educación donde se provee educación especial, servicios relacionados y la oportunidad de inclusión o integración en el centro regular del Programa Head Start. Está localizado en las facilidades de la Ciudad del Niño.

## Programa de Alimentos (USDA)

- Ofrece los servicios de comidas balanceadas y nutritivas a todos los niños participantes.
- Opera con fondos del Departamento de Agricultura Federal a través del Departamento de Educación.

## Dirección

Calle Maceo #19, Frente a la Plaza de Recreo, Bayamón, Puerto Rico 00961

**Teléfono:** (787) 798-7002

Parte de [[Programa Head Start]]. La [[Misión Head Start]] y los [[Requisitos Head Start]] complementan esta página.${from("/programa-head-start/programas/")}`,
  },
  {
    key: "head-start-centros",
    title: "Lista de Centros Head Start",
    icon: "📍",
    content: `Para información adicional y localización de los Centros Head Start en la Ciudad de Bayamón, pulses el siguiente documento:

- [**Lista de Centros Head Start en la Ciudad de Bayamón**](https://www.municipiodebayamon.com/pdf/headstart-listadecentros.pdf)

> Para ver, guardar e imprimir el documento es necesaria la versión más reciente de [Adobe Acrobat Reader](https://get.adobe.com/reader/otherversions/).

## Dirección de la oficina central

Calle Maceo #19, Frente a la Plaza de Recreo, Bayamón, Puerto Rico 00961

**Teléfono:** (787) 798-7002

Parte de [[Programa Head Start]]. Para poder solicitar debe cumplir los [[Requisitos Head Start]].${from("/programa-head-start/lista-de-centros/")}`,
  },
  {
    key: "puedes",
    title: "Programa Puedes",
    icon: "🤝",
    content: `El **PROGRAMA PUEDES** es un componente de servicio del Departamento de Educación, Recreación y Deportes. Por esta razón se rige bajo las normas y procedimientos de esta Agencia Municipal destinada al mejoramiento de la educación, la recreación y el deporte de la comunidad de Bayamón.

El mismo fue creado con el propósito de ofrecer servicios educativos y de información a la comunidad con impedimentos de Bayamón.

## Funciones y deberes del Programa Puedes

### Visión

Lograr el acceso a servicios y crear condiciones que faciliten la inclusión de las personas con diversidad funcional.

### Misión

Servir de facilitador / enlace a las personas con diversidad funcional y sus familias, para promover una integración o inclusión, mediante los servicios disponibles gubernamentales y del tercer sector. Estarán enmarcados en los principios de sensibilidad, empatía y respeto.

### Objetivo

El Programa Puedes tiene como objetivo la sensibilización hacia la comunidad de las personas con diversidad funcional. Apoyamos educativamente a las escuelas, colegios, centros educativos, agencias de servicios y entidades de base comunitarias, entre otros.

### Servicios

- Orientar a las personas con diversidad funcional y sus familias, sobre los servicios municipales, estatales y del tercer sector disponible.
- Educar a la comunidad, sobre las mejores prácticas de inclusión.
- Brindar apoyo a las familias, en los procesos de acceder a los servicios municipales y estatales.
- Crear procesos de referidos y canalización de necesidades e inquietudes.
- Coordinar los servicios de intérprete de lenguaje de señas, para todas las dependencias municipales.
- Ser el enlace entre el Municipio y las Organizaciones sin Fines de Lucro, que ofrecen servicios a la población con diversidad funcional de Bayamón.

## Boletines informativos

- [Primer Boletín: Formas correctas de expresión hacia las personas con impedimentos](https://www.municipiodebayamon.com/primer-boletin-informativo-del-programa-puedes/)
- [Segundo Boletín: Asistencia Tecnológica](https://www.municipiodebayamon.com/segundo-boletin-informativo-del-programa-puedes/)
- [Tercer Boletín: Ayudando a una persona ciega – El guía humano](https://www.municipiodebayamon.com/tercer-boletin-informativo-del-programa-puedes/)
- [Cuarto Boletín: Me encontré una persona ciega – Recomendaciones y estrategia para el manejo de las personas con impedimentos](https://www.municipiodebayamon.com/boletin-de-junio-del-programa-puedes-me-encontre-una-persona-ciega/)
- [Quinto Boletín: ¿Quiénes son Aquellos que no Pueden Escuchar?](https://www.municipiodebayamon.com/boletin-de-julio-del-programa-puedes-quienes-son-aquellos-que-no-pueden-escuchar/)
- [Sexto Boletín: Consejos para Tratar a una Persona Sorda](https://www.municipiodebayamon.com/boletin-de-agosto-del-programa-puedes-consejos-para-tratar-a-una-persona-sorda/)
- [Séptimo Boletín: Guía para Manejar Diferentes Impedimentos y Recomendaciones para Tratar a una Persona Ciega](https://www.municipiodebayamon.com/boletin-de-septiembre-del-programa-puedes/)
- [Octavo Boletín: ¿Qué es la Espina Bífida?](https://www.municipiodebayamon.com/boletin-de-octubre-del-programa-puedes/)
- [Noveno Boletín: ¿Qué es la Epilepsia?](https://www.municipiodebayamon.com/boletin-de-noviembre-del-programa-puedes-que-es-la-epilepsia/)
- [Décimo Boletín: La Robótica y la Educación Especial](https://www.municipiodebayamon.com/boletin-de-diciembre-del-programa-puedes-la-robotica-y-la-educacion-especial/)

## Plan Estratégico para personas con Impedimentos

- [Formato PDF](https://www.municipiodebayamon.com/pdf/Plan-Estrategico-Mision-y%20Vision-2018-2022.pdf)
- [Formato Accesible](https://www.municipiodebayamon.com/pdf/Plan-Estrategico-Mision-y-Vision-2018-2022.doc)

> Para ver, guardar e imprimir algunos de los documentos es necesaria la versión más reciente de [Adobe Acrobat Reader](https://get.adobe.com/reader/otherversions/).

## Dirección

Carretera #2
Antiguo Hospital Ruiz Soler
Frente a Urb. Jardines de Caparra
Bayamón, Puerto Rico

**Teléfono:** (787) 781-6655 Ext. 3410

Programa del [[Educación Municipal]]. Comparte dirección con [[Educación Municipal]].${from("/programa-puedes/")}`,
  },
  {
    key: "contactos",
    title: "Directorio de Contactos",
    icon: "📞",
    content: `Todos los teléfonos, faxes y direcciones publicados por el Departamento de Educación Municipal, reunidos en una sola página.

## Departamento — [[Educación Municipal]]

**Carretera #2**
Antiguo Hospital Ruiz Soler
Frente a Urb. Jardines de Caparra
Bayamón, Puerto Rico

- Teléfono: (787) 781-6655
- Fax: (787) 783-4785

## Programas internos

| Programa | Teléfono | Fax |
| --- | --- | --- |
| [[Programa Dirección]] | 787-781-6655, 787-782-4685 | 787-783-4785 |
| [[Programa de Servicios al Estudiante]] | 787-781-6655 ext. 3403 | — |
| [[Programa de Mantenimiento]] | 787-781-6655 ext. 3405, 3406 | — |

## Programas y servicios

| Programa | Teléfono | Dirección |
| --- | --- | --- |
| [[Taller de Arte]] | (787) 798-5787, 269-2694, 780-5552 Ext. 2060 | Anexo al Terminal de Transportación Guadarrama, junto a la Casa Alcaldía |
| [[Proyecto Nacer]] — Van Scoy | (787) 730-2575 | Carretera 167, Km 14.8, Bo. Buena Vista, Sector Van Scoy, Antiguo CDT Bayamón |
| [[Proyecto Nacer]] — Juan Sánchez | (787) 785-2223 | Calle #2, Esquina Calle #6, Barrio Juan Sánchez, Bayamón |
| [[Biblioteca Municipal Dra. Pilar Barbosa]] | (787) 288-1100 Ext. 1366 o 1367 | Paseo del Parque, Esquina Calle Betances, Bayamón, PR 00961 |
| [[Programa Head Start]] | (787) 798-7002 | Calle Maceo #19, Frente a la Plaza de Recreo, Bayamón, PR 00961 |
| [[Programa Puedes]] | (787) 781-6655 Ext. 3410 | Carretera #2, Antiguo Hospital Ruiz Soler, Frente a Urb. Jardines de Caparra |

## Horarios

- [[Biblioteca Municipal Dra. Pilar Barbosa]]: lunes a viernes 7:00 a.m. – 8:00 p.m.; sábado 8:00 a.m. – 5:00 p.m.
- [[Taller de Arte]] (oficina): lunes a viernes 8:00 am – 6:00 pm
${from("/")}`,
  },

  // ---------------------------------------------------------------------------
  // Operations. Everything below was learned by reconciling the department's own
  // files against the live catalogue, so the figures and the gaps are real counts
  // rather than estimates. No credential ever belongs in this space.
  // ---------------------------------------------------------------------------

  {
    key: "inventario",
    title: "Inventario de materiales",
    icon: "📦",
    content: `El Departamento lleva su inventario de materiales en **Krates**, en <https://kr8s.axxes.club>. Es donde vive la lista de artículos del almacén: lo que hay, cuánto hay y qué se entregó.

## Categorías

El catálogo está agrupado en seis categorías:

| Categoría en Krates | Qué cubre |
| --- | --- |
| Cleaning Supplies | Limpieza: mopas, desinfectantes, bolsas, papel |
| Garden Supplies | Jardinería: trimming, bombas, cadenas, aceites |
| Office Supplies | Material de oficina |
| Electrical Supplies | Material eléctrico |
| Computer Electronics | Equipos de computación |
| Awards | Medallas, cintas y trofeos |

## El número de parte

Cada artículo tiene un **número de parte** propio del departamento. Es el código con el que se pide, se recibe y se cuenta; no es un código de fábrica y no se debe cambiar.

El número empieza con el prefijo de la categoría, heredado del sistema anterior:

- \`07-xxxxx\` — limpieza
- \`09-xxxxx\` — jardinería

Un artículo con \`09-00524\` es *Sierra K12 14"*, y eso es lo que dice también el archivo de jardinería. **El número de parte manda sobre el nombre**: los nombres cambian, los números no.

## Del sistema anterior a Krates

Hasta 2025 el inventario se llevaba en *App Inv2*, en <https://hub.bayamonpr.gov/app_inv2/inventario.asp>. Krates lo sustituyó, pero los números de parte se trajeron tal cual para que nada dejara de cuadrar.

Los listados impresos del sistema viejo siguen siendo la fuente de muchos datos — ver [[Fuentes de datos del inventario]].

## Fotos y cuentas

Cada artículo puede tener una foto; el procedimiento está en [[Fotos de los artículos]]. El acceso de cada persona se gestiona aparte, en [[Cuentas de acceso del personal]].`,
  },
  {
    key: "inventario-fuentes",
    title: "Fuentes de datos del inventario",
    icon: "📄",
    content: `Estos son los archivos de los que sale la información del inventario. Cuando un archivo y Krates no coincidan, **el archivo del departamento es la fuente** y Krates se corrige.

## material de jardineria.xlsx

- **Alimenta:** Garden Supplies
- **Columnas:** Part Number · Foto · Descripcion · UPC
- Trae **una foto incrustada por fila**: cada artículo viene con su imagen. Es la mejor fuente de fotos que tiene el departamento.

## INVENTARIO-limpieza.pdf

- **Alimenta:** Cleaning Supplies
- Es una impresión de *App Inv2* del 18 de septiembre de 2026.
- Cada fila trae número de parte, foto, descripción, categoría, costo, unidad y cantidad.
- Tiene **119 artículos con foto**, muchos de los cuales todavía no están en Krates.

## distribucion de cintas y trofeos 3.xlsx

- **Alimenta:** Awards
- Es un **registro de distribución**, no un catálogo: lleva escuela, orden de compra, cantidades entregadas y saldo.
- **No tiene fotos.** Para fotografiar medallas, cintas y trofeos hay que hacerlo en el almacén.

## Qué falta

No hay ninguna fuente para Material de oficina ni para Equipos de computación. Si se necesitan fotos de esas categorías, hay que tomarlas en el almacén.

## Regla práctica

> Antes de buscar en internet, abra el archivo del departamento: ya tiene la foto, el número de parte y la descripción del artículo.`,
  },
  {
    key: "inventario-fotos",
    title: "Fotos de los artículos",
    icon: "📷",
    content: `Una foto buena ahorra una llamada: el almacén y la transportación identifican el artículo por la imagen sin tener que buscar el número de parte.

## Cómo tomar una foto útil

1. **Un artículo, una foto.** No agrupe varios artículos en la misma imagen.
2. **Fondo blanco o liso**, sin objetos alrededor.
3. **El artículo completo y centrado**, con la etiqueta legible si se puede.
4. **Que se entienda en miniatura.** La lista de inventario muestra la foto muy pequeña; si a ese tamaño no se reconoce, la foto no sirve.
5. **La foto es del artículo de esa fila.** No reutilice la foto de otro artículo aunque se parezcan.

## Dónde va la foto

En Krates, al editar un artículo. La foto se guarda con el artículo y aparece en la lista de inventario y en la pantalla de verificación.

## Estado actual

A septiembre de 2026, de **130 artículos del catálogo, 109 tienen foto** y 21 no la tienen.

### Material de jardinería (3)

La hoja de jardinería trae un espacio en blanco, no una foto. Los tres tienen que fotografiarse en el almacén:

| Número de parte | Artículo |
| --- | --- |
| \`09-00514\` | Tecomet-EFCO: EW 130 Easy-Work Tap & Go 5" Trimmer Head |
| \`09-00525\` | Vari-Cut Blade 14" X 1.25 FOR K |
| \`09-00531\` | Recogedor de grama para ser instalado en tractor |

### Limpieza (3)

- Bolsa de basura, 65 galones
- Mota para escoba industrial (dos entradas iguales)
- *Paños para limpieza, microfibra ya tiene foto.*

### Premios (6)

No hay ninguna foto de origen. Hay que fotografiar las medallas, las cintas de participación y el trofeo en el almacén.

### Material de oficina (8) y Equipos de computación (1)

No hay archivo que las provea; también hay que tomarlas en el almacén.

> Cuando fotografíe un artículo, actualice esta lista para que el próximo no busque lo que ya está hecho.`,
  },
  {
    key: "cuentas-de-acceso",
    title: "Cuentas de acceso del personal",
    icon: "🔑",
    content: `Cada persona del Departamento entra a los sistemas de AXXES con su propia cuenta. **Las credenciales las maneja el Departamento y no se publican en este espacio.**

## Cómo se llama una cuenta

El patrón es \`usuario@bayamonpr.gov\`, todo en minúsculas, donde \`usuario\` es el nombre de usuario que asigna el Departamento. El dominio no lleva punto: \`bayamonpr.gov\`, no \`bayamon.pr.gov\`.

Por ejemplo, si el usuario de una persona es \`aflores4\`, su cuenta es \`aflores4@bayamonpr.gov\`.

## Qué se hizo el 29 de septiembre de 2026

Se dieron de alta las cuentas del personal del Departamento de Educación, siguiendo la lista de usuarios y contraseñas que el propio Departamento entregó:

- **26 cuentas** creadas en el espacio de Educación Municipal.
- **24** con acceso para entrar al sistema.
- **2** quedan como personas registradas pero **todavía sin acceso**, porque en la lista no venían con usuario ni contraseña.
- Todas están en el departamento **Educación**, con permisos de usuario general.

Las contraseñas se guardaron cifradas. Nadie —ni el Departamento ni AXXES— puede leerlas después; si alguien la pierde, se genera una nueva.

## Pendientes que decide el Departamento

Estas tres cosas vinieron de la lista y hay que resolverlas con la oficina:

1. **Cinco personas comparten la misma contraseña.** Cualquiera que la conozca puede entrar como cualquiera de las cinco. Conviene asignarles una contraseña individual.
2. **Dos personas tienen el mismo usuario.** Como el usuario es único, solo se pudo crear una cuenta. La segunda persona necesita un usuario propio.
3. **Dos personas no tenían usuario ni contraseña** en la lista. Cuando el Departamento las envíe, se les activa el acceso.

## Pedir una cuenta nueva

Las cuentas las da AXXES. Para solicitarla hay que tener a mano: nombre completo, usuario elegido por el Departamento, contraseña inicial y el espacio de trabajo (por ejemplo, Educación Municipal).`,
  },
]

