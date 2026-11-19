# CONTEXTO TÉCNICO — ASCI-NOM-004

Documento de referencia técnica del estado actual del frontend React (`ASCI-NOM-004`), su integración con **Supabase** (Auth, PostgreSQL en 3FN y Storage) y los webhooks de **n8n**.

---

## 1. Flujo actual en React (`ASCI-NOM-004`)

1. **Compresión en el cliente (`src/utils/imageCompressor.js`):**
   - Al seleccionar fotografías en `src/pages/Analisisdatos.jsx`, cada archivo pasa en el navegador por `browser-image-compression` antes de subirse:
     - `maxSizeMB: 0.5` (máximo **500 KB** por imagen)
     - `maxWidthOrHeight: 1280`
     - `useWebWorker: true`
     - `fileType: 'image/jpeg'`
     - `initialQuality: 0.75`
   - El resultado se empaqueta como un objeto `File` con extensión `.jpg` (`image/jpeg`).

2. **Subida a Supabase Storage (`src/services/equiposService.js`):**
   - **Bucket:** `equipos-fotos` (bucket público con políticas RLS que exigen que el primer segmento de la ruta sea el `auth.uid()` del usuario autenticado).
   - **Ruta del archivo (`file_id` / `path`):**
     ```text
     {userId}/equipos/{Date.now()}_{uuid8}.jpg
     ```
     *(Nota: Los logotipos de clientes subidos desde `Formulario.jsx` usan el mismo bucket bajo `{userId}/logos/{timestamp}_{uuid8}.{ext}`).*
   - **Obtención de URL pública:**
     Tras ejecutar `supabase.storage.from('equipos-fotos').upload(path, archivo, { contentType: 'image/jpeg', upsert: false })`, React invoca:
     ```js
     const { data } = supabase.storage.from('equipos-fotos').getPublicUrl(path);
     const url_publica = data.publicUrl;
     ```
   - **Rollback de archivos huérfanos:** Si falla la llamada posterior a n8n o alguno de los `INSERT` en PostgreSQL, React ejecuta `supabase.storage.from('equipos-fotos').remove(rutas)` para borrar del bucket los archivos recién subidos en esa operación.

---

## 2. Contrato con el Webhook de n8n

La arquitectura divide el trabajo en **3 Webhooks independientes** (además del flujo manual "Guardar borrador" que omite n8n). **Nunca se envían binarios ni Base64 a los webhooks de análisis (Fases 1 y 2)**; únicamente viajan URLs públicas o texto.

### A. Webhook 1 — Pre-análisis Visual (Fase 1: `src/services/equiposService.js`)
- **Variable de entorno:** `VITE_N8N_WEBHOOK_ANALISIS_PRE` (ej. `https://n8n.asconsultoriaintegral.com/webhook/analisis-ia-pre`)
- **Método:** `POST` (`Content-Type: application/json`)
- **JSON exacto que envía React:**
  ```json
  {
    "imagenes": [
      "https://<project>.supabase.co/storage/v1/object/public/equipos-fotos/<userId>/equipos/<archivo_1>.jpg",
      "https://<project>.supabase.co/storage/v1/object/public/equipos-fotos/<userId>/equipos/<archivo_2>.jpg"
    ],
    "datos_usuario": {
      "nombre": "Texto preliminar opcional escrito por el usuario o cadena vacía \"\"",
      "descripcion": "Descripción preliminar opcional escrita por el usuario o cadena vacía \"\""
    }
  }
  ```
- **JSON exacto que devuelve n8n** (puede devolver el objeto directo o un arreglo `[{ ... }]` cuyo primer elemento toma React):
  ```json
  {
    "nombre": "Nombre técnico y preciso del equipo",
    "descripcion": "Descripción técnica detallada enfocada en funcionamiento, partes móviles y energía"
  }
  ```
- **¿Quién guarda en PostgreSQL/Supabase?**
  - **React persiste la respuesta.** El webhook de n8n actúa de forma *stateless* (solo procesa visión con IA y responde `{ nombre, descripcion }`). Al recibir `response.ok` con `nombre` y `descripcion` no vacíos, **React** realiza los `INSERT` en las tablas `equipos` y `equipos_imagenes` de Supabase.
  - En el flujo alterno **"Guardar borrador (Sin IA)"**, React no llama a n8n: sube las fotos al bucket y guarda directamente en `equipos` y `equipos_imagenes` el `nombre` y `descripcion` escritos por el usuario.

### B. Webhook 2 — Análisis Profundo NOM-004 en Cola Secuencial 1x1 (Fase 2: `src/services/n8nService.js`)
- **Variable de entorno:** `VITE_N8N_DEEP_ANALYSIS_URL`
- **JSON exacto que envía React (1 equipo a la vez, solo texto, sin imágenes ni exposición):**
  ```json
  {
    "user_id": "<uuid_usuario>",
    "equipo_id": "<uuid_equipo>",
    "equipo": "<nombre_equipo>",
    "identificacion": "<identificacion_opcional_o_vacio>",
    "departamento": "<area_opcional_o_vacio>",
    "descripcion": "<descripcion_equipo>",
    "tipo_analisis": "profundo"
  }
  ```
- **JSON que devuelve n8n:**
  ```json
  {
    "riesgos": {
      "a1": { "presente": true, "observacion": "..." },
      "a2": { "presente": false, "observacion": "..." }
    },
    "matriz": [
      {
        "riesgo": "...",
        "tipo_daño": "...",
        "gravedad": 3,
        "probabilidad": 4,
        "valor": 12,
        "nivel": "Moderado"
      }
    ]
  }
  ```
- **Persistencia:** **React** recibe `{ riesgos, matriz }` e inmediatamente inserta en la tabla `analisis_equipos` (`analysis: { riesgos, matriz }`).

### C. Webhook 3 — Generación de Reporte Word (Fase 3: `src/services/n8nService.js`)
- **Variable de entorno:** `VITE_N8N_GENERATE_DOC_URL`
- **Interacción:** React envía los datos del cliente y el arreglo de equipos completados (convirtiendo las URLs de imágenes a Base64 en el navegador únicamente en este paso final de exportación) y recibe un `Blob` binario `.doc`.

---

## 3. Esquema de Base de Datos (Supabase)

Fuente única de verdad: `src/services/sqlspb.txt` (Esquema normalizado en 3FN implementado en Supabase).

### Tablas principales

1. **`clientes`** (Datos empresariales por usuario):
   - `id` (`UUID`, PK)
   - `user_id` (`UUID`, `NOT NULL` — dueño para RLS)
   - `logo_url` (`TEXT`)
   - `razon_social` (`TEXT`, `NOT NULL`)
   - `domicilio` (`TEXT`, `NOT NULL`)
   - `rfc` (`VARCHAR(20)`, `NOT NULL`, `UNIQUE`)
   - `rama_industrial` (`TEXT`, `NOT NULL`)
   - `num_trabajadores` (`INTEGER`, `NOT NULL`)
   - `turnos_horarios` (`TEXT`, `NOT NULL`)
   - `elaborado_por` (`TEXT`)
   - `especialista_ing` (`TEXT`, `NOT NULL`)
   - `registro_stps` (`VARCHAR(50)`, `NOT NULL`)
   - `created_at`, `updated_at` (`TIMESTAMPTZ`)

2. **`evaluaciones_norma04`** (Estudios / Proyectos NOM-004 de un cliente):
   - `id` (`UUID`, PK) — se guarda en `localStorage.proyecto_activo.evaluacion_id` al seleccionar un estudio y se usa como `fk_evaluacion`.
   - `fk_cliente` (`UUID`, `NOT NULL`, FK $\rightarrow$ `clientes.id ON DELETE RESTRICT`)
   - `titulo_proyecto` (`TEXT`, `NOT NULL`)
   - `estado` (`VARCHAR(30)`, `CHECK ('En Borrador', 'Analizando', 'Completado')`, default `'En Borrador'`)
   - `estudio_json` (`JSONB`)
   - `fecha_creacion` (`TIMESTAMPTZ`)

3. **`equipos`** (Registro preliminar del equipo — `nombre` y `descripción`):
   - `id` (`UUID`, PK)
   - `fk_evaluacion` (`UUID`, `NOT NULL`, FK $\rightarrow$ `evaluaciones_norma04.id ON DELETE CASCADE`)
   - `nombre_equipo` (`TEXT`) — almacena el `nombre` devuelto por la IA o capturado en borrador manual.
   - `descripcion_equipo` (`TEXT`) — almacena la `descripcion` técnica devuelta por la IA o capturada manualmente.
   - `identificador_imagen` (`VARCHAR(255)`, `NOT NULL`) — almacena el `nombre_archivo` de la primera imagen (`imagenes[0].nombre_archivo`).
   - `fecha_insercion` (`TIMESTAMPTZ`, default `NOW()`)

4. **`equipos_imagenes`** (URLs públicas y referencia en Storage de las fotos de cada equipo):
   - `id` (`UUID`, PK)
   - `fk_equipo` (`UUID`, `NOT NULL`, FK $\rightarrow$ `equipos.id ON DELETE CASCADE`)
   - `nombre_archivo` (`TEXT`, `NOT NULL`) — nombre generado del archivo (ej. `1731948000000_a1b2c3d4.jpg`).
   - `url_publica` (`TEXT`, `NOT NULL`) — URL pública completa de Supabase Storage.
   - `file_id` (`TEXT`) — ruta interna dentro del bucket `equipos-fotos` (`{userId}/equipos/{nombre_archivo}`), usada para eliminar el archivo del bucket cuando se borra el equipo o en un rollback.
   - `created_at` (`TIMESTAMPTZ`)

5. **`analisis_equipos`** (Resultado del análisis profundo NOM-004 — Fase 2):
   - `id` (`UUID`, PK)
   - `fk_equipo` (`UUID`, `NOT NULL`, FK $\rightarrow$ `equipos.id ON DELETE CASCADE`)
   - `analysis` (`JSONB`, `NOT NULL`) — guarda `{ "riesgos": { ... }, "matriz": [ ... ] }`.
   - `created_at` (`TIMESTAMPTZ`)
   - *Regla de estado en UI:* Un equipo se considera en estado **`borrador`** si no tiene filas en `analisis_equipos`, y **`completado`** si tiene al menos una fila en `analisis_equipos`.

6. **`historial_sincronizaciones` y `archivos_sincronizacion`** (Control de lotes/Drive en n8n):
   - `historial_sincronizaciones`: `id`, `fk_evaluacion`, `nombre_lote`, `estado` (`'iniciado' | 'procesando' | 'completado' | 'error'`), `total_archivos`, `archivos_procesados`, `detalles_error`, timestamps.
   - `archivos_sincronizacion`: `id`, `fk_sincronizacion`, `nombre_archivo`, `estado` (`'pendiente' | 'procesando' | 'completado' | 'error'`), `fk_imagen` (FK $\rightarrow$ `equipos_imagenes.id`), `detalles_error`, timestamps.

### Almacenamiento de las partes de referencia opcionales (`Identificación` y `Área`)
- Se descartó por completo la sección "Condiciones de Operación / Exposición" (`operadores`, `dias`, `horas`).
- Como la tabla `equipos` en `sqlspb.txt` no incluye columnas dedicadas para `identificacion` (Tag / No. de inventario) ni `departamento` (Área), actualmente `equiposService.js` y `dbService.js` persisten ambos campos opcionales en `localStorage` bajo la llave `asci_equipos_meta_v1` indexada por `equipo.id` (`{ [equipoId]: { identificacion, departamento } }`), inyectándolos al adaptar los equipos en `MisEquipos.jsx` y enviándolos en los payloads de los Webhooks 2 y 3.

---

## 4. Reglas de negocio de las imágenes

1. **Cantidad de fotos por equipo:**
   - **Mínimo:** `1` fotografía (`MIN_IMAGENES = 1`).
   - **Máximo:** `2` fotografías por equipo (`MAX_IMAGENES = 2`).
   - En la captura manual 1x1 (`Analisisdatos.jsx`), la primera ranura corresponde a **"Vista general"** (requerida) y la segunda a **"Detalle"** (opcional, típicamente detalle o placa de datos). Si el usuario selecciona más archivos de los permitidos, React recorta el arreglo al espacio disponible (`MAX_IMAGENES - imagenesCargadas.length`).

2. **Agrupación por nombre e identificación de la foto de placa / detalle (Importación masiva por Drive con Regex):**
   - Las imágenes de un lote de Google Drive vienen nombradas con el nombre del equipo más sufijos de secuencia, vista o placa (ej. `Torno CNC Haas (1).jpg`, `Torno CNC Haas_placa.jpg`, `Prensa_Hidraulica_20T - vista lateral.png`).
   - **Limpieza y agrupación por Regex:**
     - Se elimina la extensión (`/\.[a-z0-9]{3,4}$/i`).
     - Se limpian los sufijos de numeración, copia o tipo de toma al final del nombre mediante la expresión regular:
       ```js
       const SUFFIX_CLEANER_REGEX = /(?:[\s_-]*(?:\(\d+\)|\[\d+\]|copia|copy|(?:foto|img|imagen|vista|lado|parte|frontal|lateral|trasera|placa)[\s_-]*\d*|[\s_-]+\d{1,3}))+$/i;
       ```
     - La foto de la **placa de datos** se identifica por el sufijo `_placa` (o `placa` precedido de espacio, guion o guion bajo al final del nombre antes de la extensión, ej. `/[\s_-]+placa[\s_-]*\d*$/i`) y se agrupa junto con la foto de vista general bajo la misma clave canónica del equipo (capping estricto de **1 a 2 fotos por equipo**, priorizando la vista general como imagen principal y la de `_placa`/detalle como segunda imagen).

3. **Manejo de fotos sin grupo (individuales) y partes de referencia:**
   - **Foto sin par / sin grupo:** Si tras normalizar los nombres una imagen no tiene segunda foto coincidente (grupo de 1 sola imagen), es completamente válida porque cumple `MIN_IMAGENES = 1`; se crea su borrador de equipo con esa única imagen y su `identificador_imagen` apunta a ese archivo.
   - **Excedentes (> 2 fotos con el mismo nombre base):** Se toman únicamente hasta `MAX_IMAGENES = 2` fotos por equipo para proteger la cuota de Supabase Storage y los tokens de visión.
   - **Degradación elegante y campos de referencia:** Si en un lote el webhook de IA falla para un equipo o aún no se completa la descripción, el nombre limpio extraído por Regex sirve como `nombre_equipo` preliminar. Los campos de referencia (**Identificación** y **Área**) son 100% opcionales tanto en la captura 1x1 como en la revisión de `Mis Equipos` y nunca bloquean ni el pre-análisis con IA, ni el guardado de borrador, ni el análisis profundo NOM-004.
