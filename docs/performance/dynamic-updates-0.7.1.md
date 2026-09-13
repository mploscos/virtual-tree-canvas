# Dynamic update benchmark: 0.7.0 → 0.7.1

Measured on 2026-09-13 in headless Chromium on the development host. Each case
uses 10,000 flat nodes, approximately 40 visible rows, 60 update ticks and 500
patches per tick (30,000 patches/case). Times are milliseconds. The reproducible
command is `npm run benchmark:dynamic`.

The 0.7.0 measurement used an extracted clean `HEAD` and the same benchmark file.
Icon-load invalidations and initial ResizeObserver work were settled before each
sample. “Total avg” is patch application plus render time per tick; a zero-render
case therefore contains only patch processing.

| Sorted | RowActions | Visible patches | Patch avg/p95 before → after | Render avg/p95 before → after | Renders before → after | Total avg before → after |
|---|---:|---:|---:|---:|---:|---:|
| no | no | 0% | 0.417/0.700 → 0.788/1.200 | 1.573/2.000 → 0/0 | 60 → 0 | 1.990 → 0.788 |
| no | no | 10% | 0.413/0.600 → 0.657/0.900 | 1.422/2.100 → 1.485/2.000 | 60 → 60 | 1.835 → 2.142 |
| no | no | 100% | 0.285/0.400 → 0.212/0.400 | 1.335/2.000 → 1.335/1.900 | 60 → 60 | 1.620 → 1.547 |
| no | yes | 0% | 0.303/0.500 → 0.635/0.900 | 2.408/3.600 → 0/0 | 60 → 0 | 2.712 → 0.635 |
| no | yes | 10% | 0.318/0.500 → 0.592/0.800 | 2.708/3.400 → 2.960/3.900 | 60 → 60 | 3.027 → 3.552 |
| no | yes | 100% | 0.203/0.300 → 0.153/0.300 | 2.535/3.600 → 2.552/3.700 | 60 → 60 | 2.738 → 2.705 |
| yes | no | 0% | 0.317/0.400 → 0.548/0.800 | 2.012/3.400 → 0/0 | 60 → 0 | 2.328 → 0.548 |
| yes | no | 10% | 0.345/0.500 → 0.582/0.800 | 1.945/2.600 → 1.343/2.300 | 60 → 60 | 2.290 → 1.925 |
| yes | no | 100% | 0.267/0.500 → 0.220/0.400 | 2.005/2.600 → 1.305/2.300 | 60 → 60 | 2.272 → 1.525 |
| yes | yes | 0% | 0.287/0.400 → 0.493/0.700 | 3.087/3.900 → 0/0 | 60 → 0 | 3.373 → 0.493 |
| yes | yes | 10% | 0.307/0.500 → 0.478/0.800 | 3.402/5.200 → 2.782/4.100 | 60 → 60 | 3.708 → 3.260 |
| yes | yes | 100% | 0.182/0.300 → 0.137/0.300 | 3.103/4.800 → 2.447/3.800 | 60 → 60 | 3.285 → 2.583 |

In every 0%-visible case, 0.7.1 recorded 60 renders avoided because the changes
were offscreen, with zero render requests and executions. In visible cases,
0.7.0 performed 60 full RowActions synchronizations; 0.7.1 performed 60
incremental and zero full synchronizations. At 100% visible, repeated patches for
the approximately 40 visible IDs coalesced 30,000 received patches into 2,400
unique changed nodes across the 60 frames.

The queue adds measurable bookkeeping when nearly all 500 IDs are unique and a
render is required anyway; this is visible in the two unsorted 10% cases. The
largest gains are the intended real-time-tree case (offscreen traffic), and active
sorting additionally benefits from removing the 10,000-entry scene copy.
