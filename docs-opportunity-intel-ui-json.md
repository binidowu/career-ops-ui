# Opportunity Intel UI JSON Contract

The website should consume product-shaped job intelligence, not terminal-oriented markdown.
For each markdown report, the long-term backend contract is an adjacent JSON sidecar:

```txt
reports/005-polyai-2026-03-16.md
reports/005-polyai-2026-03-16.ui.json
```

The UI reads the sidecar first. If it is missing, it falls back to normalizing the markdown report.

## Shape

```json
{
  "schemaVersion": 1,
  "roleSnapshot": {
    "company": "PolyAI",
    "role": "Agent Designer (Canada based)",
    "level": "Entry-level",
    "location": "Canada",
    "workMode": "Remote within Canada",
    "compensation": "$70,000-$80,000 CAD",
    "archetype": "Conversation/Dialogue Design + light Agentic/Automation",
    "sourceUrl": "https://example.com/job"
  },
  "recommendation": {
    "verdict": "conditional",
    "summary": "Apply only if the role is intentionally being used to lean into conversation design.",
    "nextActions": [
      "Tailor resume before applying",
      "Use matched evidence in outreach",
      "Resolve location or compensation mismatch"
    ]
  },
  "scoreBreakdown": [
    {
      "label": "Technical alignment",
      "score": 62,
      "rationale": "Python, SQL, and data-pipeline evidence is strong, but dialogue design proof is thin.",
      "evidence": ["Python", "SQL", "LangChain tool-calling"]
    }
  ],
  "cvEvidence": [
    {
      "requirement": "Python",
      "strength": "strong",
      "evidence": "Used across Bike Theft Agent, RAG System, FootIQ, and ML project.",
      "source": "CV match table"
    }
  ],
  "risks": [
    {
      "title": "Conversation design proof is thin",
      "severity": "critical",
      "reason": "The CV shows engineering projects but little dialogue-flow or persona-writing work.",
      "mitigation": "Lead with any prompt-writing, support-flow, or UX-copy examples before applying."
    }
  ],
  "backgroundFraming": [
    {
      "concern": "Your formal proof is more engineering-heavy than conversation-design-heavy.",
      "likelyQuestion": "How would you design an assistant conversation from scratch?",
      "recommendedAnswer": "Frame engineering projects as systems for reliable user-facing AI behavior."
    }
  ],
  "interviewPrep": {
    "rounds": [],
    "likelyQuestions": [],
    "stories": [],
    "checklist": [],
    "vocabulary": ["conversation design", "tool-calling", "RAG"]
  }
}
```

## Rules

- Do not put markdown formatting or emoji in the JSON.
- Use `null` for unknown scalar fields.
- Prefer concise UI-ready strings over report prose.
- `score` values are 0-100.
- `strength` is one of `strong`, `partial`, `missing`, or `unknown`.
- `severity` is one of `critical`, `moderate`, or `minor`.
