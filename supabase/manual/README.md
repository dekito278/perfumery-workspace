# supabase/manual

SQL that must never be applied by a migration run, only by hand and on purpose.

| file | what it does | when to run |
| --- | --- | --- |
| `20261007093000_fragrance_notes_accord_labels.rollback.sql` | restores ALL product text to its 2026-10-07 values | to undo everything, including Deer Musk Accord and the four rewritten descriptions |
| `20261007140000_oud_is_an_accord.rollback.sql` | puts back "Oud Malinau" and "Oud" | to undo only the oud |
| `20261007150000_sandalwood_is_an_accord.rollback.sql` | puts back "Sandalwood Kupang" and "Sandalwood" | to undo only the sandalwood |

Everything that is safe to apply unconditionally lives in `supabase/migrations/` instead.
