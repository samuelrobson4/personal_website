---
title: knowledge graph expertise search — connecting people, skills, and projects with AI
subtitle: 2024
images:
technologies: ["React", "TypeScript", "FastAPI", "Python", "Claude API", "Neo4j", "Vite", "Cypher"]
video: https://youtu.be/TRhvyYHXyfk
pitchDeck: /assets/docs/pitchdeck.pdf 
---
## inspiration
In growing teams, I kept seeing people struggle to find the right expertise or documents—knowledge about "who knows what" was scattered across Slack, Google Docs, and Notion. This led to **duplicated work, slower progress, and missed collaboration opportunities**. I wanted to build a **centralized system** that connects people, skills, and projects, letting anyone ask "Who can help with data visualization?" and get instant, relevant answers.

## what i built
I built a **knowledge graph expertise search engine** that indexes people, skills, and projects from unstructured documents (status updates, meeting notes). The system uses **Claude API** for entity extraction and query parsing, **Neo4j** as the graph database, and a **React + TypeScript** frontend with a **FastAPI** backend. Users upload documents to seed the graph, then search using natural language queries that return ranked results showing people and their relevant work.

## challenges & solutions
- **Extracting structured data from messy documents**: designed prompts for Claude API to reliably identify people, skills, projects, and relationships with >70% accuracy across diverse document types.  
- **Building an effective graph data model**: used Neo4j's property graph (Person, Skill, Project nodes; HAS_SKILL, WORKS_ON relationships) with constraints to ensure data integrity without complex semantic web overhead.  
- **Making search feel intuitive**: implemented two-stage NLP where Claude parses query intent (find person vs. find project), then executes targeted Cypher queries with relevance ranking.  
- **Balancing MVP scope with extensibility**: phased approach—validated extraction and queries early (Days 1-2), then built backend core, query system, and minimal UI incrementally.

This project demonstrates how to combine **modern AI (LLMs for NLP), graph databases, and clean UX** to solve real organizational problems. It reinforced my approach to product work: **validate assumptions early, build iteratively, and design systems that are both powerful and practical**—skills I bring to building intelligent products with real user value.