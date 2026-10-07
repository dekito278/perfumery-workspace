# supabase/manual

SQL that must never be applied by a migration run, only by hand and on purpose.

| file | what it does | when to run |
| --- | --- | --- |
| `20261007093100_sandalwood_is_an_accord.sql` | writes sandalwood as "Sandalwood Accord" (the oud is already done) | ONLY if the sandalwood is a reconstruction |
| `20261007093000_fragrance_notes_accord_labels.rollback.sql` | restores all product text to its 2026-10-07 values | to undo the migration of the same name |

Everything that is safe to apply unconditionally lives in `supabase/migrations/` instead.
