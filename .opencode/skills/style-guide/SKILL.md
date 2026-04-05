---
name: style-guide
description: |
  Standards for writing production-quality code. Load this skill when implementing, refactoring, or planning code. Covers: SOLID principles (SRP, OCP, LSP, ISP, DIP), design patterns (Factory, Strategy, Repository, Adapter, Observer, Command, Decorator, Facade), architecture layering (domain/application/infrastructure boundaries, dependency direction, module cohesion), and clean code rules (naming that reveals intent, single-level-of-abstraction functions, guard clauses over nesting, no magic literals, no primitive obsession, TypeScript strict typing). Use when writing new features, reviewing existing code, refactoring, or planning architecture decisions.
---

# Coding Standards: Design Patterns, SOLID & Clean Code

Apply these standards whenever writing or modifying code. They are not optional — they define what "correct" looks like for this project.

---

## SOLID Principles

### S — Single Responsibility
Each class, module, or function has exactly one reason to change.
- A function that validates input, transforms data, AND writes to DB violates SRP — split it
- A module named `utils.ts` or `helpers.ts` is a red flag — name by responsibility

### O — Open/Closed
Add behavior by extension (new types, new functions, composition), not by modifying existing code.
- A `switch` or `if/else if` chain that grows every time a new type is added is a violation — use a strategy map or polymorphism

### L — Liskov Substitution
Subtypes must be fully substitutable for their base types without changing program behavior.
- Never override a method to throw `NotImplementedError` or ignore its parameters
- Never narrow a base type's contract (e.g., a subclass that only accepts a subset of valid inputs)

### I — Interface Segregation
Clients must not depend on methods they don't use.
- Prefer many small, focused interfaces over one large one
- If a class implements an interface but leaves half the methods empty, split the interface

### D — Dependency Inversion
High-level modules depend on abstractions, not concrete implementations.
- Business logic must never instantiate infrastructure directly (`new Database()`, `new HttpClient()`)
- Inject dependencies via constructor parameters or factory functions
- Domain modules must not import from infrastructure layers

---

## Design Patterns

Apply patterns where they reduce coupling or clarify intent — never for their own sake.

### When to use each

| Pattern | Use when |
|---------|----------|
| **Factory / Abstract Factory** | Object creation is complex, conditional, or must be decoupled from the caller |
| **Builder** | Constructing objects with many optional parameters |
| **Strategy** | An algorithm or behavior is interchangeable at runtime |
| **Repository** | Abstracting data access from domain logic |
| **Adapter** | Wrapping a third-party API to isolate it from the domain |
| **Decorator** | Adding behavior to an object without subclassing |
| **Observer / EventEmitter** | Decoupled event handling between components |
| **Command** | Queuing, undoing, or logging operations |
| **Facade** | Simplifying a complex subsystem behind a clean interface |
| **Mediator** | Reducing direct coupling between many components |

### Anti-patterns to avoid

- **God Object**: A class or module that knows too much or does too much — split it
- **Shotgun Surgery**: One change requires modifying many unrelated files — consolidate
- **Feature Envy**: A function accesses another object's data more than its own — move it
- **Primitive Obsession**: Using raw strings/numbers instead of value objects or enums
- **Anemic Domain Model**: Domain objects are pure data bags; all logic lives in service layers

---

## Architecture

### Layer rules (enforced strictly)
```
Domain (entities, value objects, domain services)
  ↑ depends on nothing external
Application (use cases, orchestration)
  ↑ depends on domain abstractions
Infrastructure (DB, HTTP, filesystem, third-party SDKs)
  ↑ implements domain/application interfaces
```
- **Domain must never import from infrastructure** — this is a hard boundary
- **Business logic must not appear in controllers, route handlers, or CLI entry points**
- If a file imports both a domain entity and a database driver, it is in the wrong layer

### Module cohesion
- Organize by feature/domain, not by technical role
- `src/auth/` is better than scattered `src/controllers/`, `src/models/`, `src/services/`
- Code that changes together must live together

### Encapsulation
- Do not export implementation details — only export intentional public contracts
- Internal types, helpers, and state should be private to the module

---

## Clean Code

### Naming
- Names reveal intent: `getUserById` not `get`, `isEmailValid` not `check`
- Booleans are adjectives: `isLoading`, `hasErrors`, `canSubmit` — not `loading`, `error`, `submit`
- Avoid abbreviations: `usr`, `mgr`, `tmp`, `req` — write it out
- Functions are verbs: `calculateTotal()`, `sendWelcomeEmail()` — not `total()`, `email()`

### Functions
- Do one thing at one level of abstraction
- If a function needs a comment to explain what it does (not why), rename or split it
- Target ~15 lines; flag anything over 30 lines for review
- Use guard clauses and early returns instead of deep nesting:
  ```typescript
  // bad
  if (user) {
    if (user.isActive) {
      if (user.hasPermission) { ... }
    }
  }

  // good
  if (!user) return
  if (!user.isActive) return
  if (!user.hasPermission) return
  // ...
  ```

### Comments
- Comments explain **why**, not what: `// Retry because the upstream API has a 500ms cold start` ✓
- If the comment explains what the code does, the code needs better naming
- Never leave TODO comments without a linked issue

### Constants and magic values
- No unexplained literals: `3`, `"pending"`, `"/api/v1"` — name them
- Use enums for finite sets of string/number values

### Symmetry
- Handle similar cases the same way throughout the codebase
- Inconsistency in how similar patterns are written is a maintenance hazard

---

## TypeScript-specific

- Never use `any` — use `unknown` for genuinely unknown inputs and narrow with type guards
- Prefer `type` for unions and intersections; `interface` for object shapes that may be extended
- Use discriminated unions for state modeling: `{ status: "loading" } | { status: "error"; error: Error } | { status: "success"; data: T }`
- Make illegal states unrepresentable through the type system
- Return types on all public functions must be explicit
