insert into public.raw_material_categories (user_id, name, color)
select
    users.id,
    seed.name,
    seed.color
from auth.users as users
cross join (
    values
        ('A - ALI-FAT-IC', '#D9E2EC'),
        ('B - Berg-ICEBERG', '#D6F5FF'),
        ('C - CITRUS', '#FFD166'),
        ('D - DAIRY', '#FFF1CC'),
        ('E - EDIBLE', '#DDB892'),
        ('F - FRUIT', '#FF8FA3'),
        ('G - GREEN', '#7BC47F'),
        ('H - HERB (Cool)', '#8FBF8F'),
        ('I - IRIS', '#B8A1E3'),
        ('J - JASMIN', '#FFF4D6'),
        ('K - KONIFER', '#6B8E23'),
        ('L - LIGHT Chemical Floral', '#FDE68A'),
        ('M - MUGUET', '#CDECCF'),
        ('N - NARCOTIC', '#A16207'),
        ('O - ORCHID', '#A855F7'),
        ('P - PHENOL', '#6B7280'),
        ('Q - Queen of the ORIENT', '#F59E0B'),
        ('R - ROSE', '#F9A8D4'),
        ('S - SPICE (Hot)', '#F97316'),
        ('T - TAR SMOKE', '#1F2937'),
        ('U - Urine Faecal ANIMAL', '#8B5A3C'),
        ('V - VANILLA', '#C08457'),
        ('W - WOOD', '#8B5A3C'),
        ('X - X-rated MUSK', '#CBD5E1'),
        ('Y - EARTHY MOSSY', '#4B5563'),
        ('Z - ZOLVENTS', '#60A5FA')
) as seed(name, color)
on conflict (user_id, name) do update
set color = excluded.color;
