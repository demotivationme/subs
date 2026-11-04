# Catalog logos

96x96 SVG tiles for built-in catalog services, named by catalog slug. `ServiceCatalogSeeder` copies them to the public disk (`service-logos/catalog/<slug>.svg`) on every seed.

Regenerate (the PHP app never runs Node, and `simple-icons` is not a backend dependency):

    mkdir /tmp/si && cd /tmp/si && npm i simple-icons@15 @lobehub/icons-static-svg@1
    NODE_PATH=/tmp/si/node_modules node database/seeders/logos/generate.mjs

The `MAP` table in `generate.mjs` maps catalog slugs to Simple Icons slugs; `LOBE` takes the few AI marks Simple Icons lacks (DeepSeek, Grok, Midjourney) from Lobe Icons. Never draw a mark yourself. Services whose owners had their marks removed from Simple Icons (Amazon, Adobe, Microsoft, Disney+, ...) get no file: `ServiceCatalogSeeder::BRAND_COLORS` gives their letter tile the brand color instead.

Brand icons from Simple Icons (CC0) and Lobe Icons (MIT). Brand marks remain trademarks of their owners; used to identify each service.
