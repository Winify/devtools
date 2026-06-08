Feature: @wdio/elements package showcase

  As a developer integrating AI-readable snapshots,
  I want to extract interactable elements and accessibility trees from a live page,
  So that I can feed structured page data to LLMs or locator strategies.

  Scenario: Scan worldofbooks.com for interactable elements and a11y snapshot

    Given I navigate to "https://www.worldofbooks.com"
    When I scan the page for interactable elements
    Then at least 5 interactable elements should be found
    When I capture the accessibility tree
    Then a web snapshot should be generated with at least 10 lines
    And the snapshot should contain the header "[Page: " and a link to the home page
    When I take a screenshot and cross-reference with the snapshot
