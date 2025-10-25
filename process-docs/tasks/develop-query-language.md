# Task: Develop Hybrid Query Language Support

## Objective
Create a lightweight query language that combines tag filters and semantic search with weighted operators (e.g., `tag:ml AND "vector db"`).

## Key Deliverables
- Query language specification detailing syntax, operators, precedence, and weighting model.
- Parser and evaluator integrated with search infrastructure.
- CLI support for accepting query strings and returning ranked results.
- Documentation with examples, best practices, and migration guidance.
- Tests covering parsing, execution, and ranking outcomes.

## Implementation Plan
1. **Design**
   - Research similar query syntaxes and define MVP grammar.
   - Determine how to blend lexical and semantic scores and expose weighting options.
2. **Implementation**
   - Build parser (likely using PEG or combinator approach) and integrate with search backend.
   - Update search command to detect and process advanced queries.
3. **Optimization**
   - Tune scoring and caching strategies to maintain performance.
4. **Testing**
   - Create extensive unit tests for parser edge cases and integration tests for real queries.
5. **Documentation**
   - Update docs and CLI help with query language reference and tutorials.

## Dependencies & Risks
- Requires close coordination with search vs explore clarity work to avoid user confusion.
- Advanced queries may necessitate index changes or performance tuning.
