# supabase/manual

SQL that must never be applied by a migration run, only by hand and on purpose.

| file | what it does | when to run |
| --- | --- | --- |
| `20261007093100_oud_and_sandalwood_are_accords.sql` | writes oud and sandalwood as "Oud Accord" / "Sandalwood Accord" | ONLY if those materials are reconstructions, not distilled oil |
| `20261007093000_fragrance_notes_accord_labels.rollback.sql` | restores all product text to its 2026-10-07 values | to undo the migration of the same name |

Everything that is safe to apply unconditionally lives in `supabase/migrations/` instead.
