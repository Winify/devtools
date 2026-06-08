Feature: Trace capture with element snapshots

  As a tester using the devtools trace recorder,
  I want element snapshots captured alongside each command,
  So that the trace output contains structured, AI-readable page state.

  Scenario: Navigate and interact — trace captures element data

    Given I open the page "https://the-internet.herokuapp.com/login"
    When I type "tomsmith" into the username field
    And I type "SuperSecretPassword!" into the password field
    And I click the login button
    Then I should see the login success message
