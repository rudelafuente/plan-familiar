# CLAUDE.md

Plan familiar es una PWA en español con el plan de emergencia de la familia. Se instala en los móviles desde Safari y funciona sin conexión. No tiene cuentas, servidor, analítica ni dependencias.

## Comandos

- Tests (Node 22+): `npm test`.
- Probar en local: `python3 -m http.server` en la raíz. Con `file://` no funcionan los módulos, el service worker ni Web Crypto.
- Despliegue: GitHub Pages publica la raíz de `main`. No hay compilación.

## Arquitectura

Módulos ES nativos cargados desde `index.html`:

- `core.js`: lógica pura, sin DOM. `FIELDS` describe cada registro y alimenta tanto `validate()` como los formularios. Incluye `pending`, `readiness`, `addStarter` y las copias cifradas.
- `guide.js`: pautas oficiales, cada sección con su fuente.
- `views.js`: vistas puras, `(state) → HTML`. Cualquier valor del usuario pasa por `esc()`.
- `report.js`: ficha imprimible, autónoma y sin cifrar.
- `app.js`: estado, DOM y eventos por delegación con atributos `data-*`. Todo guardado pasa por `save()`, y por tanto por `validate()`.
- `storage.js`: IndexedDB `plan-familiar-v1`, registro `current` = `{revision, data}`. `write()` aborta si otra ventana ha escrito antes.
- `sw.js`: caché del shell. `actualizar.html` es la página de rescate: borra el worker y las cachés sin tocar IndexedDB.

## Convenciones y límites

- **Datos reales:** nunca van al repositorio. El código arranca vacío; no añadas nombres, teléfonos ni direcciones de la familia, ni como ejemplo.
- **Documentos:** se guarda solo la fecha de vencimiento, nunca el número del DNI o del pasaporte.
- **Red:** ninguna llamada con datos del usuario. La CSP de `index.html` solo permite recursos `self`.
- **Pautas:** mantén el texto de `guide.js` fiel a la fuente oficial. Si lo cambias, vuelve a comprobar la fuente y actualiza `REVIEWED`. No añadas consejos propios como si fueran oficiales.
- **Kit:** `addStarter` nunca marca nada como disponible. No se inventa lo que hay en casa.
- **Esquema:** los campos nuevos deben ser opcionales, para que las copias antiguas sigan abriéndose. Cualquier otro cambio necesita una migración.
- **Archivos publicados:** al añadir o renombrar uno, actualiza `ASSETS` en `sw.js`.
- **Versión:** sube `VERSION` en `core.js` y `sw.js`, y `version` en `package.json`. El test comprueba que coinciden.
- **Estilo:** código compacto, casi sin comentarios y textos de interfaz en español.

## Pendiente

- Validación manual en iPhone: instalación, uso sin conexión, compartir archivos y abrir una copia.
- Compartir entre móviles sustituye el plan completo. No hay fusión de cambios.
