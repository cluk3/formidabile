# ADR-001: Modular, Versioned Form Management System

- **Status:** Accepted (2026-10-20)
- **Decision type:** Architecture / Domain Design
- **Scope:** Form definition, versioning, rendering, response collection, and analytics
- **Date:** 2026-10-19

This is the product baseline. Later accepted ADRs amend it, and each amended clause notes the ADR that changes it. Where a later ADR and this one disagree, the later ADR wins.

## 1. Context

Applications often need configurable forms to collect structured information from users. Common use cases include registration, surveys, feedback, applications, onboarding, assessments, and other data collection workflows.

Building a form management capability requires more than a visual editor. The system must support form creation, publication, rendering, validation, response collection, historical data access, and analytics.

Forms evolve over time. An administrator may modify a published form after users have already submitted responses. These changes must not corrupt historical responses, alter their original meaning, or prevent the analysis of previously collected data.

The system must support immutable published form versions, version-specific responses, and a clear separation between form definitions, presentation, response collection, and analytics.

The form management capability must be designed as an independent, reusable module that can be integrated into different applications and domains. It must not depend on a particular business domain, application workflow, or host application's data model.

The architecture must remain technology agnostic. Specific programming languages, frameworks, databases, and infrastructure will be selected during implementation.

## 2. Decision

Implement a modular form management system that provides the following capabilities:

1. Form creation and editing through a configurable form builder.
2. Draft management and publication of immutable form versions.
3. Rendering of a specific form version.
4. Validation and collection of responses against that version.
5. Retrieval and management of individual responses.
6. Analytics and reporting across responses and compatible form versions.
7. Integration with external applications through explicit interfaces and associations.

The system must distinguish between:

- **Form:** The stable identity of a form.
- **Form version:** An immutable snapshot of the form definition at publication time.
- **Question identity:** The stable identity of a logical question across versions when continuity is intended.
- **Question snapshot:** The complete definition of a question within a specific form version.
- **Response:** A submission against one specific published form version.
- **Answer:** A respondent's answer to a question in a response.
- **Analytics:** Aggregated or individual-response views derived from collected data.

Published form definitions must never be modified in place. Any modification to a published form must be performed in a draft and published as a new immutable version.

The form management system must own its form definitions, versioning rules, response structures, and form-specific validation. The host application must own its domain entities, business workflows, and application-specific authorization policies, while integrating with the form system through defined boundaries.

## 3. Modularity and Integration

### 3.1 Independent module

The form management system must be designed as a standalone module that can be incorporated into different applications.

The module must not require knowledge of the host application's business domain. It must not directly depend on domain-specific entities such as customers, bookings, orders, employees, or projects.

The module should expose capabilities through well-defined interfaces. Depending on the chosen architecture, these may be represented by application services, public APIs, events, or other integration mechanisms.

The implementation should distinguish between:

- The core form domain and its business rules.
- The form builder user interface.
- The form renderer.
- Response processing and persistence.
- Analytics and reporting.
- Integration adapters for host applications.

These are logical boundaries and do not necessarily require separate deployable services or packages.

### 3.2 Host application integration

The host application must be able to associate a form with one or more external entities or workflows.

For example, an application might associate a form with a particular resource, workflow instance, or business record.

The form system may retain a generic external reference consisting of an entity type or namespace and an entity identifier, or use an equivalent integration mechanism.

External references must not force the form module to understand the structure or lifecycle of the referenced entities.

The host application is responsible for determining when a form should be displayed, who may access it, and how a completed response affects its business workflows.

The form module is responsible for rendering the form, validating its answers, collecting the response, and exposing the resulting data.

### 3.3 Independent reuse

The module should be usable in different integration scenarios, including:

- Embedded within an existing application.
- Accessed through a dedicated user interface.
- Integrated through APIs.
- Used by multiple applications where the deployment and security model permit it.

The architecture should avoid assumptions that the form builder, renderer, and host application must share a particular frontend framework, runtime, or deployment environment.

## 4. Domain Model

### 4.1 Form

A form represents a stable, identifiable resource.

It should include:

- Unique identifier.
- Owner or tenant identifier, where applicable.
- Name and description (amended 2026-10-20, see ADR-005).
- Optional metadata and categorization (amended 2026-10-20, see ADR-002).
- Current published version reference.
- Lifecycle and availability state.
- Creation and update timestamps.

Any ownership or tenant model must support the authorization and isolation requirements of the integrating application.

A form may exist independently of any external business entity. Associations with external entities must be optional and explicit.

### 4.2 Form version

Each published form version represents a complete, self-contained snapshot of the form definition.

A version should include:

- Unique identifier.
- Parent form identifier.
- Version number or equivalent ordering metadata.
- Question definitions and ordering.
- Form-level configuration.
- Validation rules.
- Publication timestamp.
- Publishing actor, where available.
- Optional reference to the version from which it was derived.

Published versions must contain everything necessary to reproduce the form as it was published without depending on mutable definitions from later versions.

Published versions must be retained for as long as they are required to interpret associated responses and satisfy applicable retention policies.

### 4.3 Drafts

The form builder must support editing forms without affecting the current published version.

A draft is an editable working copy derived from a published version or an initial unpublished definition.

Drafts may be modified, previewed, saved, or discarded without affecting existing responses or the currently published version.

Publishing a draft must validate its definition and create a new immutable version.

The implementation should prevent concurrent editing from silently overwriting another administrator's changes. Revision identifiers, optimistic concurrency, or an equivalent mechanism may be used.

### 4.4 Question identity and snapshots

Questions must have a stable logical identity and a version-specific definition.

The logical identity allows the system to recognize that questions across versions are intended to represent the same conceptual question.

A question snapshot contains the complete definition used by a particular version, including:

- Question type.
- Label and description.
- Required or optional status.
- Display order.
- Validation constraints.
- Options and stable machine-readable values, where applicable.
- Conditional visibility or other supported behavior.
- Type-specific configuration.

Logical identity must not imply automatic semantic equivalence. If a question changes meaning materially, the system must allow it to receive a new logical identity.

Removing a question from a new version must not delete historical snapshots or answers.

### 4.5 Responses and answers

Every response must reference:

- The stable form identifier.
- The exact published form version used for submission.
- A respondent identifier, where applicable.
- Optional external entity references supplied through the integration boundary.
- Submission status and timestamps (amended 2026-10-20, see ADR-002).

Each answer must be associated with the response and the corresponding question snapshot from that response's form version.

Answers must retain their original meaning even if a later version changes question labels, options, validation rules, or structure.

The system must support multiple responses to the same form when permitted by its configuration or the host application's workflow.

Duplicate-submission rules must be configurable rather than universally imposed by the form module.

The implementation must define how incomplete responses, autosaved drafts, abandoned submissions, and resubmissions are handled.

### 4.6 Answer representation

The form system must support multiple question types with type-appropriate validation and answer representation.

The initial question type set should be limited to common requirements:

- Short text.
- Long text.
- Email.
- Number.
- Date.
- Single choice.
- Multiple choice.
- Dropdown.
- Checkbox or boolean.
- File upload, if supported by the chosen storage and security model.

The architecture must allow additional question types to be introduced without redesigning the entire response system.

Question configuration may use structured, type-specific data, while important domain relationships and lifecycle information remain explicitly modeled.

Choice options must have stable machine-readable values distinct from their display labels. Changing a label must not implicitly change the meaning of a previously recorded answer.

The system must validate answers against the exact form version being submitted, not against the latest version at the time of later analysis.

## 5. Versioning and Publication Rules

The following rules are mandatory:

1. Published form versions are immutable.
2. Every response references exactly one published form version.
3. Every answer is interpreted using the question snapshot from that version.
4. Publishing a new version does not modify existing responses or answers.
5. Removing a question or option in a new version does not remove historical data.
6. Draft changes must not affect published rendering until publication.
7. New submissions use the current published version by default.
8. Historical responses remain accessible after newer versions are published, subject to authorization and retention policies.
9. Publishing must be atomic: a partially published version must never become current.
10. All form operations must enforce appropriate access controls.
11. Historical versions must not be silently rewritten to accommodate newer question definitions.

Publishing a new version must update the form's current published version only after the new version has been successfully validated and persisted.

The system must define a consistency policy for participants who open a form before a new version is published and submit afterward.

At minimum, the submission must be validated against the exact version presented to the respondent. The system must either accept the response under that version or explicitly require the respondent to reload. It must never silently reinterpret answers against a different version.

Publication history must be distinct from current availability. Disabling a form must not require deleting its published versions or responses.

## 6. Form Builder

The form builder is the administrative interface for creating and managing forms.

It must allow authorized users to:

- Create forms.
- Edit unpublished drafts.
- Add, remove, reorder, and configure questions.
- Configure required fields, options, and validation rules.
- Preview forms before publication.
- Save changes without publishing.
- Publish new versions.
- View publication history.
- Identify the current published version and outstanding draft changes.
- Access responses and analytics, subject to permissions.

The builder must operate on the canonical form definition model. It must not maintain an independent definition format that can drift from the form renderer or response validation logic.

The builder should be replaceable independently of the core domain logic. The module should not require the builder's frontend implementation to be embedded in the same runtime as the renderer or persistence layer.

The initial implementation should favor a clear, maintainable builder over advanced features such as arbitrary scripting, complex branching, or highly customized layouts.

## 7. Form Renderer and Submission

The renderer must render a specific form version.

It must:

- Display questions according to the version's stored definitions and ordering.
- Render labels, descriptions, options, and validation requirements from that version.
- Support the question types implemented by the form system.
- Validate responses during interaction and at the authoritative submission boundary.
- Handle errors and provide actionable feedback.
- Associate accepted submissions with the exact version rendered to the respondent.
- Distinguish incomplete responses from successfully submitted responses.
- Respect the form's publication state and submission availability.

The renderer must not depend on the mutable current form definition after a version has been selected for a submission session.

Draft previews must not be confused with real participant responses. Preview mode must not create production submissions unless explicitly supported by a separate, clearly defined workflow.

The renderer must be usable by different host applications without requiring domain-specific changes to the core form logic.

## 8. Response Management and Analytics

### 8.1 Individual responses

Authorized users must be able to inspect individual responses and see:

- Submission status and timestamp (amended 2026-10-20, see ADR-002).
- The associated respondent, where available and authorized.
- External entity references, where applicable.
- The form version used for submission.
- Each question and answer as defined in that version.

Historical response views must reconstruct the form as it existed when the response was submitted, rather than using the latest definition.

### 8.2 Aggregated analytics

The analytics capability should support:

- Total response counts.
- Response counts grouped by form version.
- Answer distributions for choice-based questions.
- Summaries for supported numeric questions.
- Filtering and segmentation where appropriate (amended 2026-10-20, see ADR-009).
- Export of response data, subject to authorization and privacy requirements (amended 2026-10-20, see ADR-002).

Analytics must distinguish responses collected under different versions.

Questions that retain the same logical identity across versions may be included in combined analytics when their types, answer representations, and semantic meanings are sufficiently compatible.

Questions must not be considered equivalent solely because they share a label or position.

When questions or options are incompatible across versions, analytics must keep them separate or explicitly describe the normalization applied.

Missing questions must not be treated as unanswered instances of a question that did not exist in a particular version.

Analytics should distinguish among:

- Responses submitted.
- Questions present in a version.
- Answers provided.
- Optional questions skipped by respondents.
- Questions absent from a version.

The analytics module must not require knowledge of the host application's domain model. Host-specific filtering and reporting may be added through integration interfaces.

## 9. Security, Authorization, and Privacy

The form module must support integration with the host application's identity and authorization model without assuming a particular authentication provider.

The integration boundary must define how the identity of an actor or respondent is established and how permissions are evaluated.

The implementation must ensure:

- Published versions cannot be modified through normal application operations.
- Responses and answers reference valid forms, versions, and question snapshots.
- Organizers or administrators can access only resources within their authorized scope.
- Respondent data is protected from unauthorized access.
- File uploads, if supported, have appropriate validation and access controls.
- Personal data is collected only when necessary.
- Data export, retention, deletion, and anonymization policies are defined (amended 2026-10-20, see ADR-013).
- Tenant or organization isolation is enforced where applicable.

Immutability applies to published form definitions, not necessarily to personal data. Privacy obligations and lawful deletion requirements must be respected even when historical form versions are retained.

The module should retain sufficient structural information to interpret historical responses without unnecessarily retaining personal data beyond the applicable retention period.

## 10. Architectural Boundaries

The implementation should separate the following logical responsibilities:

1. **Form definition management:** Creation, drafts, question configuration, and editing.
2. **Version and publication management:** Validation, immutable snapshots, publication history, and current-version selection.
3. **Rendering:** Conversion of a specific form version into a respondent-facing interface.
4. **Submission processing:** Answer validation, response persistence, and submission lifecycle.
5. **Response querying:** Individual response retrieval and filtering.
6. **Analytics:** Aggregation, cross-version compatibility, and reporting.
7. **Integration interfaces:** Association with external entities, identity providers, and host application workflows.
8. **Authorization and privacy:** Access control, retention, and data protection.

These are logical boundaries, not a requirement to create separate deployable services.

The implementation should choose the simplest architecture that maintains these boundaries, preserves the domain invariants, and allows the form module to be integrated into different applications.

The form system should avoid direct dependencies on host-specific business entities, UI frameworks, storage vendors, or deployment infrastructure wherever practical.

## 11. Consequences

### Positive consequences

- The form system can be reused across applications and business domains.
- Historical responses remain interpretable after forms change.
- Administrators can safely evolve published forms.
- Historical form definitions can be reproduced.
- Analytics can distinguish between versions and support compatible cross-version comparisons.
- The form builder and renderer can evolve independently of the core domain logic.
- Host applications retain control over their own workflows and business entities.
- Publication and submission rules become explicit and testable.
- Future question types and integrations can be added without redesigning the entire system.

### Negative consequences

- Versioning introduces additional domain entities and lifecycle rules.
- Published definitions and question snapshots require additional storage.
- The builder must manage draft state separately from published state.
- Cross-version analytics require explicit compatibility rules.
- Integration interfaces require careful design and maintenance.
- Identity, authorization, and external entity associations require clear contracts.
- Schema evolution and new question types require backward-compatibility considerations.
- Historical data retention and personal-data deletion require careful handling.

These costs are accepted because portability, historical correctness, and safe evolution are core requirements.

## 12. Implementation Guidance for the Coding Agent

Treat this ADR as the authoritative domain and architectural specification for the initial implementation.

Before choosing implementation details:

1. Inspect the existing project structure and constraints, if any exist.
2. Identify the core domain entities, relationships, lifecycle states, and invariants.
3. Propose a technology-appropriate implementation that preserves the decisions in this ADR.
4. Identify unresolved product decisions and state reasonable assumptions rather than silently inventing complex behavior.
5. Keep the form domain independent of host-specific business logic.
6. Define the persistence model, validation boundaries, publication workflow, integration contracts, and submission consistency policy.
7. Establish automated tests for mandatory versioning and data-integrity rules.
8. Explain how the module could be integrated into another application without modifying its core domain logic.

The implementation must demonstrate, at minimum, that:

- A form can be created, drafted, previewed, and published.
- Publishing produces an immutable version.
- Subsequent edits and publication create a new version.
- Existing responses remain associated with their original versions.
- Historical questions and answers remain interpretable after questions or options change.
- New submissions use the intended published version.
- Failed publication does not partially update the current version.
- Unauthorized users cannot modify forms or access protected responses.
- Analytics can report response counts by version and correctly handle questions that differ between versions.
- External entity associations do not introduce dependencies on a specific host application's domain model.

The agent may choose appropriate technologies, libraries, database structures, APIs, and deployment strategies, but must not weaken these invariants to fit a particular technology.

## 13. Open Questions

The following decisions may be deferred until requirements justify them:

- Whether a form can have multiple concurrent drafts or only one active draft.
- Whether publication requires approval or can be performed by any authorized editor.
- Whether respondents can resume incomplete submissions.
- Whether respondents can edit or resubmit responses after submission.
- Whether historical versions can be reopened for new submissions.
- Whether administrators can normalize historical answers manually.
- Which question types and conditional logic capabilities belong in the first release.
- Whether analytics should combine compatible versions by default or only on request.
- How long responses and associated personal data should be retained.
- Whether a published version can be scheduled to become active in the future.
- Whether forms can be shared across multiple applications or tenants.
- How the module should integrate with different identity and authorization systems.
- Whether external entity references should be stored directly on forms, responses, or through a separate association model.
- Whether analytics should be implemented within the module or exposed as data and interfaces for host applications to consume.
- How integrations should handle form publication events, response submission events, retries, and duplicate notifications.

These questions must be resolved according to product requirements without compromising the core versioning, historical-data, and modularity invariants.
