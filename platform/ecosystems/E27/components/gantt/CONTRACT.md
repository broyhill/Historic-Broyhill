# E27 shared Gantt component

Display-only. Callers map their own records into this model. This file does not fetch, and it does not read E84 or E12 storage.

## Mount

`BgopGantt.mount(element, model, options)`

`options.axis` is an optional element for date ticks. `BgopGantt.layout(model)` returns the same bar geometry without touching the DOM.

## Model

| Field | Required | Meaning |
|---|---|---|
| `displayZone` | no | IANA zone for tick labels. Default `UTC`. |
| `rows[].id` | yes | Caller-defined row id. |
| `rows[].label` | yes | Left-column text. |
| `rows[].lane` | no | Group label, such as an ecosystem code or a phase name. |
| `rows[].start` | yes | ISO instant. Unparseable rows are omitted. |
| `rows[].end` | yes | ISO instant. |
| `rows[].tone` | no | `solid`, `weak`, `blocked`, `done`, or `planned`. Anything else renders as `solid`. |
| `rows[].href` | no | Click target already resolved by the caller. |
| `rows[].title` | no | Hover text already written by the caller. |

Bar position is `(start - min) / (max - min)`. A zero-length span is treated as one day. The minimum painted width is 0.15 percent.

## Isolation

E84 maps document rows, including health colors and `/library/v2/open` links, in `ECO_CANONICAL/E84/code/e84_gantt_adapter.js`. E12 maps campaign tasks in its own adapter. Neither schema is referenced here.
