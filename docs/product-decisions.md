# Product decisions — Fix it

## Problem statement

UX copy frequently lives in design layers, localization tooling, and product guidelines. Reviewing many screens manually makes terminology drift and formatting errors easy to overlook.

## Intended users
- UX writers and content designers reviewing design files.
- Product designers who need to locate inconsistent UI language quickly.
- Localization specialists checking copy before translation.

## Design principles
1. **Stay in context:** 430 px sidebar keeps the Figma canvas visible.
2. **Review, don't overwrite:** proposed wording isn't applied automatically.
3. **Show evidence:** every finding retains the original layer ID and matching rule.
4. **Keep rules under user control:** optional guides and glossary files are user supplied.
5. **Separate deterministic and AI results:** explicit rules are not confused with model opinions.
6. **Local first:** basic scanning does not need an AI API or a cloud account.

## Decisions and tradeoffs
- Group identical terminology findings instead of presenting hundreds of duplicate warnings.
- Use a narrow, vertically scrolling layout instead of a large modal.
- Fixed-width 66 px **Show** buttons keep action placement consistent across long strings.
- Require a user action to submit scans to Claude; no silent AI processing.
- Cap transferred text and guide sizes to bound complexity.
- Treat semantic recommendations as suggestions; a human chooses whether to act.

## Validation status
The prototype has local automated tests and browser UI previews. Real-world usability outcomes and quantitative performance improvements have not been established. The product does not yet connect to Lokalise or a production codebase.

## Potential next steps
Key-to-layer matching, issue-level review and approval, localization validation, structured style-guide parsing, and synchronization with source systems are exploratory, not shipped capabilities.
