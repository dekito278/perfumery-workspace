// Two search paths build PostgREST `or=(...)` groups by hand. Both must neutralise the ilike wildcards
// (% _) AND the structural characters of the or() grammar ( , ( ) . \ * ), or an ordinary material name
// breaks the query — "Ambrox (DL)" parses as a broken group, and "Iso E Super 10%" matches by wildcard.
// rawMaterialsService escaped only three of them, so it mangled names the reference search handled fine
// (audit round 8).
export const sanitizeOrFilterSearch = (value) => String(value || '').replace(/[%_,()\\.*]/g, ' ').trim();
