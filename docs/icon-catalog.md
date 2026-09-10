# Catálogo de iconos

Los 63 iconos incluidos están disponibles en `resources/icons/`.
Consulta la [galería visual](./icon-catalog.html) para verlos sobre fondos claros
u oscuros y comparar tamaños. `builtinIconNames` permite enumerar sus IDs desde JavaScript.

## Uso

Asigna un ID a la propiedad `icon` del nodo:

```js
view.setData([{ id: 'operator-1', label: 'Operador', icon: 'person' }]);
```

- `data-bus` representa un bus de datos; `bus-vehicle`, un autobús.
- `placeholder` es el icono utilizado cuando no hay uno específico.
- Acompaña los iconos con etiquetas. Para estados como advertencias o errores,
  proporciona también texto y no dependas únicamente del color.
- Para añadir un icono propio, usa `view.registerIcon('custom', svgStringOrUrl)`
  y asigna `icon: 'custom'` al nodo.
- Configura `iconsBaseUrl` al crear la vista si los recursos se sirven desde otra URL.
  Los SVG se cargan al dibujarlos o mediante `view.controller.iconRegistry.prepare()`.

## Iconos disponibles

### Personas y organización

| ID | Significado |
| --- | --- |
| `person` | Persona |
| `people` | Grupo |
| `child` | Infancia |

### Animales

| ID | Significado |
| --- | --- |
| `dog` | Perro |
| `cat` | Gato |
| `bird` | Ave |
| `fish` | Pez |
| `insect` | Insecto |

### Plantas y ecosistemas

| ID | Significado |
| --- | --- |
| `tree` | Árbol |
| `leaf` | Hoja |
| `flower` | Flor |
| `seedling` | Brote |

### Tiempo atmosférico

| ID | Significado |
| --- | --- |
| `sun` | Sol |
| `moon` | Luna |
| `cloud` | Nube |
| `rain` | Lluvia |
| `snow` | Nieve |
| `wind` | Viento |
| `storm` | Tormenta |
| `fog` | Niebla |

### Terreno y agua

| ID | Significado |
| --- | --- |
| `ground` | Dominio terrestre |
| `surface` | Dominio de superficie |
| `subsurface` | Dominio submarino |

### Transporte terrestre

| ID | Significado |
| --- | --- |
| `car` | Coche |
| `bicycle` | Bicicleta |
| `bus-vehicle` | Autobús de pasajeros |

### Aviación y espacio

| ID | Significado |
| --- | --- |
| `aircraft` | Avión |
| `helicopter` | Helicóptero |
| `drone` | Dron |
| `space` | Dominio espacial |

### Entorno marítimo

| ID | Significado |
| --- | --- |
| `ship` | Buque |

### Objetos e instalaciones

| ID | Significado |
| --- | --- |
| `box` | Caja |
| `building` | Edificio |

### Datos y redes

| ID | Significado |
| --- | --- |
| `data-bus` | Bus de datos |
| `network` | Red |
| `server` | Servidor |
| `database` | Base de datos |
| `link` | Enlace |

### Sensores y mediciones

| ID | Significado |
| --- | --- |
| `sensor` | Sensor genérico |
| `radar` | Radar |
| `thermometer` | Termómetro |

### Geografía y navegación

| ID | Significado |
| --- | --- |
| `globe` | Globo terrestre |
| `point` | Punto |
| `track` | Traza |

### Inspector y documentos

| ID | Significado |
| --- | --- |
| `folder` | Carpeta |
| `inspector-object` | Objeto de datos |
| `inspector-array` | Array |
| `inspector-value` | Valor escalar |

### Estados y alertas

| ID | Significado |
| --- | --- |
| `warning` | Advertencia |
| `error` | Error |
| `placeholder` | Tipo desconocido |
| `damage` | Daño |
| `situation` | Situación |
| `lock` | Bloqueado |

### Acciones y controles

| ID | Significado |
| --- | --- |
| `control` | Control |
| `task` | Tarea |
| `star` | Favorito |
| `pin` | Fijado |
| `heart` | Preferencia afectiva |
| `grip` | Asa de arrastre |

### Tiempo y simulación

| ID | Significado |
| --- | --- |
| `clock` | Reloj |
| `calendar` | Calendario |
| `munition` | Munición |
