# Identity, authorization and tenancy seam

Type: grilling
Status: open
Blocked by: 07
Map: [Form builder MVP](../map.md)

## Question

How does a host application tell the form module who the actor is, and how are permissions evaluated, without the module assuming an authentication provider (ADR 0001 §9)?

Decide:

- The shape of the actor context the host supplies (actor id, tenant or owner scope, roles or capabilities), and how it reaches the API (header, token, in-process call).
- Whether the module evaluates permissions itself, delegates to a host-supplied policy port, or both.
- The tenancy and ownership scope for forms in the MVP.
- How respondents are identified (anonymous, host-identified, or both).
- What the reference host uses as a dev stub, and which unauthorized cases the §12 tests must cover.
