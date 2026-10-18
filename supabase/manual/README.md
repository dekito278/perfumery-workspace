# supabase/manual

SQL that must never be applied by a migration run, only by hand and on purpose.

| file | what it does | when to run |
| --- | --- | --- |
| `20261007093000_fragrance_notes_accord_labels.rollback.sql` | restores ALL product text to its 2026-10-07 values | to undo everything, including Deer Musk Accord and the four rewritten descriptions |
| `20261007140000_oud_is_an_accord.rollback.sql` | puts back "Oud Malinau" and "Oud" | to undo only the oud |
| `20261007150000_sandalwood_is_an_accord.rollback.sql` | puts back "Sandalwood Kupang" and "Sandalwood" | to undo only the sandalwood |
| `20261007160000_prose_matches_the_notes.rollback.sql` | puts back the three descriptions, "oud Malinau" included | to undo only the prose |
| `20261007170000_notes_without_the_label.rollback.sql` | puts the "Fragrance Notes:" heading back into the field | to undo only the label removal |
| `20261016090000_who_can_write_check.sql` | **hanya membaca**: tiga SELECT yang menjawab siapa boleh MENULIS ke setiap tabel, tabel mana yang RLS-nya mati, dan daftar lengkapnya | kapan saja, dan setelah setiap perubahan kebijakan — ini satu-satunya pertanyaan yang tidak bisa dijawab dari luar database |
| `20261018090000_ifra_zero_means_not_recorded.sql` | turns the 76 `ifra_limit_percent = 0` profiles into NULL, which is what they mean — 94 others already hold NULL | once, by hand; re-running matches nothing |
| `20261018090100_pyramid_placement_56_used_materials.sql` | BLOCK 1 fills `pyramid_placement` for the 29 formula-used materials that have a reference profile behind the suggestion (measured 78% accurate, so ~6 will be wrong); BLOCK 2 lists the 27 with no evidence as comments for Dekito to place himself | block 1 whenever you want; block 2 is a worksheet, not a script |

Everything that is safe to apply unconditionally lives in `supabase/migrations/` instead.
