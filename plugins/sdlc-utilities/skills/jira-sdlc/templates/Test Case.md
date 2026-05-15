## Preconditions

- [System state or data that must exist before executing this test]
- [User role, permissions, or account type required]
- [Environment: staging / local / other]

## Steps

[Test steps written in Gherkin format. Use Scenario Outline with Examples table for
parametric cases where the same flow is repeated with different inputs.]

```gherkin
Feature: <Feature Name>

  Scenario: <Scenario name>
    Given <precondition — the starting state>
    When <action — what the user does>
    Then <expected outcome — what the user observes>
```

## Expected Results

- [Primary observable outcome — what the user or system should show]
- [Secondary outcomes, if any]
- [Negative assertion — what must NOT happen as a result of this action]

## Test Data

- [Specific data, accounts, configuration, or values required to execute this test]
- [For Scenario Outline: describe the significance of each example row]

## Notes

[Edge cases to watch for, known limitations, dependencies on other test cases, or links
to related bugs or requirements.]
