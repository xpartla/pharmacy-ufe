# pharmacy-ufe

Stencil JS Web Components micro-frontend for managing a pharmacy product inventory. Part of the three-repo `pharmacy-*` project (see `~/school/wac/CLAUDE.md`).

## Components

- `<xpartla-pharmacy-product-app>` — top-level router (list ↔ editor)
- `<xpartla-pharmacy-product-list>` — list view with client-side name search and category filter
- `<xpartla-pharmacy-product-editor>` — create/edit form, soft-delete via "Deaktivovať"

Props on the app component:

| Attribute     | Example                       | Purpose                                |
|---------------|-------------------------------|----------------------------------------|
| `base-path`   | `./xpartla-pharmacy-product/` | Sub-path owned by this micro-frontend  |
| `api-base`    | `/xpartla-api`                | Backend API prefix                     |
| `pharmacy-id` | `lekaren-centrum`             | MongoDB id of the pharmacy document    |

## Develop

```bash
npm install
npm run openapi        # regenerate src/api/pharmacy-product/ from api/pharmacy-product.openapi.yaml
npm start              # dev server + mock backend on :5001
npm test
npm run build
```

## Docker

```bash
docker build -t xpartla/pharmacy-ufe:local -f build/docker/Dockerfile .
docker run --rm -p 8080:8080 xpartla/pharmacy-ufe:local
```

