Feature: Mobile trace capture with element snapshots

  As a tester using the devtools trace recorder on mobile,
  I want element snapshots captured alongside each command,
  So that the trace output contains structured, AI-readable screen state.

  Scenario: Navigate ApiDemos and capture element snapshots

    Given the ApiDemos app is open
    When I tap on "App"
    And I tap on "Alert Dialogs"
    Then the trace should capture element snapshots for each action
