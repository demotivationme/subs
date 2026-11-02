# Catalog logos

96x96 SVG tiles for built-in catalog services, named by catalog slug. `ServiceCatalogSeeder` copies them to the public disk (`service-logos/catalog/<slug>.svg`) on every seed.

Regenerate (the PHP app never runs Node, and `simple-icons` is not a backend dependency):

    mkdir /tmp/si && cd /tmp/si && npm i simple-icons@15
    NODE_PATH=/tmp/si/node_modules node database/seeders/logos/generate.mjs

The slug table in `generate.mjs` maps catalog slugs to Simple Icons slugs. Services not listed there (Disney+, Prime, Xbox, Adobe, ...) keep the letter tile. Never draw a mark that Simple Icons does not ship.

Brand icons from Simple Icons, CC0. Brand marks remain trademarks of their owners; used to identify each service.
