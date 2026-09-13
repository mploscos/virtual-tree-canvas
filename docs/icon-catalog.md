# Icon catalog

The 65 bundled icons are available in `resources/icons/`. Open the
[rendered visual catalog](https://htmlpreview.github.io/?https://github.com/mploscos/virtual-tree-canvas/blob/main/docs/icon-catalog.html)
to compare them at different sizes on light and dark backgrounds. The
[HTML source](./icon-catalog.html) is also available. `builtinIconNames` lists
their IDs from JavaScript.

## Usage

Assign an ID to the node's `icon` property:

```js
view.setData([{ id: 'operator-1', label: 'Operator', icon: 'person' }]);
```

- `data-bus` represents a data bus; `bus-vehicle` represents a passenger bus.
- `placeholder` is used when no specific icon is available.
- Pair icons with labels. For states such as warnings or errors, also provide
  text instead of relying on color alone.
- To add a custom icon, call `view.registerIcon('custom', svgStringOrUrl)` and
  assign `icon: 'custom'` to the node.
- Set `iconsBaseUrl` when creating the view if assets are served from another URL.
  SVGs are loaded when drawn or through `view.controller.iconRegistry.prepare()`.

## Available icons

### People and organization

| ID | Meaning |
| --- | --- |
| `person` | Person |
| `people` | Group |
| `child` | Child |

### Animals

| ID | Meaning |
| --- | --- |
| `dog` | Dog |
| `cat` | Cat |
| `bird` | Bird |
| `fish` | Fish |
| `insect` | Insect |

### Plants and ecosystems

| ID | Meaning |
| --- | --- |
| `tree` | Tree |
| `leaf` | Leaf |
| `flower` | Flower |
| `seedling` | Seedling |

### Weather

| ID | Meaning |
| --- | --- |
| `sun` | Sun |
| `moon` | Moon |
| `cloud` | Cloud |
| `rain` | Rain |
| `snow` | Snow |
| `wind` | Wind |
| `storm` | Storm |
| `fog` | Fog |

### Terrain and water

| ID | Meaning |
| --- | --- |
| `ground` | Ground domain |
| `surface` | Surface domain |
| `subsurface` | Subsurface domain |

### Ground transportation

| ID | Meaning |
| --- | --- |
| `car` | Car |
| `bicycle` | Bicycle |
| `bus-vehicle` | Passenger bus |

### Aviation and space

| ID | Meaning |
| --- | --- |
| `aircraft` | Aircraft |
| `helicopter` | Helicopter |
| `drone` | Drone |
| `space` | Space domain |

### Maritime environment

| ID | Meaning |
| --- | --- |
| `ship` | Ship |

### Objects and facilities

| ID | Meaning |
| --- | --- |
| `box` | Box |
| `building` | Building |

### Data and networks

| ID | Meaning |
| --- | --- |
| `data-bus` | Data bus |
| `network` | Network |
| `server` | Server |
| `database` | Database |
| `link` | Link |

### Sensors and measurements

| ID | Meaning |
| --- | --- |
| `sensor` | Generic sensor |
| `radar` | Radar |
| `thermometer` | Thermometer |

### Geography and navigation

| ID | Meaning |
| --- | --- |
| `globe` | Globe |
| `point` | Point |
| `track` | Track |

### Inspector and documents

| ID | Meaning |
| --- | --- |
| `folder` | Folder |
| `inspector-object` | Data object |
| `inspector-array` | Array |
| `inspector-value` | Scalar value |

### States and alerts

| ID | Meaning |
| --- | --- |
| `warning` | Warning |
| `error` | Error |
| `placeholder` | Unknown type |
| `damage` | Damage |
| `situation` | Situation |
| `lock` | Locked |

### Actions and controls

| ID | Meaning |
| --- | --- |
| `control` | Control |
| `task` | Task |
| `star` | Favorite |
| `star-filled` | Active favorite |
| `pin` | Pinned |
| `heart` | Favorite |
| `grip` | Drag handle |
| `trash` | Delete or remove |

### Time and simulation

| ID | Meaning |
| --- | --- |
| `clock` | Clock |
| `calendar` | Calendar |
| `munition` | Munition |
