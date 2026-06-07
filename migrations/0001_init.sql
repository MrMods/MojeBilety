DROP TABLE IF EXISTS reservation_seats;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS admins;

CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin'
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'classic',
  status TEXT NOT NULL DEFAULT 'active',
  rows_count INTEGER NOT NULL DEFAULT 6,
  seats_per_row INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  sector TEXT NOT NULL DEFAULT 'A',
  row_label TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  seat_type TEXT NOT NULL DEFAULT 'standard',
  price REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available',
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Jedna rezerwacja = jeden unikalny kod.
-- Jeśli klient wybiera kilka miejsc, szczegóły miejsc są w tabeli reservation_seats.
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_code TEXT NOT NULL UNIQUE,
  event_id INTEGER NOT NULL,
  seat_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (seat_id) REFERENCES seats(id)
);

CREATE TABLE reservation_seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER NOT NULL,
  seat_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
  FOREIGN KEY (seat_id) REFERENCES seats(id),
  UNIQUE (reservation_id, seat_id)
);

CREATE INDEX idx_reservations_code
ON reservations(reservation_code);

CREATE INDEX idx_reservation_seats_reservation_id
ON reservation_seats(reservation_id);

CREATE INDEX idx_reservation_seats_seat_id
ON reservation_seats(seat_id);

INSERT INTO admins (email, password, role)
VALUES ('admin@demo.pl', 'admin123', 'admin');

INSERT INTO events
(title, description, category, event_date, event_time, location, address, price, image_url, template, status, rows_count, seats_per_row)
VALUES
('Echoes Tour 2026', 'Koncertowy wieczór z efektowną sceną, światłem i możliwością wyboru konkretnego miejsca na sali.', 'Koncert', '2026-07-20', '20:00', 'Arena Rzeszów', 'ul. Podpromie 10, Rzeszów', 129.00, 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1600&q=80', 'concert', 'active', 8, 14),
('Warsztaty grafiki cyfrowej', 'Praktyczne warsztaty projektowania grafik promocyjnych i materiałów wizualnych do social mediów.', 'Warsztat', '2026-07-24', '10:00', 'Centrum Kreatywne', 'ul. 3 Maja 12, Rzeszów', 69.00, 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1600&q=80', 'classic', 'active', 5, 8),
('Future IT Conference', 'Konferencja o technologiach webowych, sztucznej inteligencji, automatyzacji i pracy w IT.', 'Konferencja', '2026-08-02', '09:00', 'WSIiZ Rzeszów', 'ul. Sucharskiego 2, Rzeszów', 0.00, 'https://images.unsplash.com/photo-1515169067865-5387ec356754?auto=format&fit=crop&w=1600&q=80', 'classic', 'active', 7, 12);

-- Miejsca dla wydarzenia 1: 8 rzędów x 14 miejsc
INSERT INTO seats (event_id, sector, row_label, seat_number, seat_type, price, status)
WITH RECURSIVE
rows(r) AS (VALUES(1) UNION ALL SELECT r+1 FROM rows WHERE r < 8),
nums(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM nums WHERE n < 14)
SELECT
  1,
  'A',
  CHAR(64 + r),
  n,
  CASE WHEN r = 1 AND n <= 4 THEN 'vip' ELSE 'standard' END,
  CASE WHEN r = 1 AND n <= 4 THEN 199 ELSE 129 END,
  CASE WHEN r = 8 AND n IN (2,3) THEN 'blocked' ELSE 'available' END
FROM rows CROSS JOIN nums;

-- Miejsca dla wydarzenia 2: 5 rzędów x 8 miejsc
INSERT INTO seats (event_id, sector, row_label, seat_number, seat_type, price, status)
WITH RECURSIVE
rows(r) AS (VALUES(1) UNION ALL SELECT r+1 FROM rows WHERE r < 5),
nums(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM nums WHERE n < 8)
SELECT
  2,
  'B',
  CHAR(64 + r),
  n,
  CASE WHEN r = 1 THEN 'vip' ELSE 'standard' END,
  CASE WHEN r = 1 THEN 99 ELSE 69 END,
  CASE WHEN r = 5 AND n = 8 THEN 'blocked' ELSE 'available' END
FROM rows CROSS JOIN nums;

-- Miejsca dla wydarzenia 3: 7 rzędów x 12 miejsc
INSERT INTO seats (event_id, sector, row_label, seat_number, seat_type, price, status)
WITH RECURSIVE
rows(r) AS (VALUES(1) UNION ALL SELECT r+1 FROM rows WHERE r < 7),
nums(n) AS (VALUES(1) UNION ALL SELECT n+1 FROM nums WHERE n < 12)
SELECT
  3,
  'C',
  CHAR(64 + r),
  n,
  'standard',
  0,
  CASE WHEN r = 7 AND n IN (1,2) THEN 'blocked' ELSE 'available' END
FROM rows CROSS JOIN nums;
