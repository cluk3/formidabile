# Frontend framework and renderer embedding strategy

Type: grilling
Status: open
Map: [Form builder MVP](../map.md)

## Question

Which frontend framework do the builder and the reference host use, and how is the renderer packaged so that host applications on other frameworks can embed it (ADR 0001 §3.3, §7)?

Options to weigh: a framework-specific component package (e.g. React), a web component, or a headless renderer core (state, validation, visibility) with a thin framework adapter. Also decide whether the builder's preview reuses the renderer as-is.
