# Consultancy Finder AI MVP

Simple AI-assisted consultancy finder web app MVP built with plain HTML, CSS, and JavaScript.

## What it includes

- Search page with `keyword`, `city`, and `state`
- Results table for mock consultancy/company matches
- Mock "Scan Website" workflow that reveals extracted contacts
- Modular architecture for future provider integrations
- Schema/type definitions for `companies` and `contacts`

## Project structure

```text
.
├── index.html
├── styles.css
└── src
    ├── data
    │   └── mockData.js
    ├── main.js
    ├── models
    │   └── schema.js
    ├── providers
    │   └── mockSearchProvider.js
    ├── services
    │   └── mockAiExtractionService.js
    └── storage
        └── localStorageRepository.js
```

## Architecture

- `providers/`: company search provider layer
- `services/`: AI extraction layer
- `storage/`: persistence layer
- `models/`: schema/type definitions
- `data/`: mock records for MVP development

## Notes

- No live APIs are connected.
- No real scraping is implemented.
- Search and scans are mocked to keep the MVP simple and extensible.
