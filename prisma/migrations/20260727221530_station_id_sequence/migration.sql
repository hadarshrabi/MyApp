SELECT setval(
  pg_get_serial_sequence('"Station"', 'id'),
  COALESCE((SELECT MAX("id") FROM "Station"), 1),
  (SELECT COUNT(*) > 0 FROM "Station")
);
