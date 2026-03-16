
-- Initial seed data

INSERT INTO areas (name, region) VALUES
('箱根', '関東'),
('宮ヶ瀬', '関東'),
('大黒', '関東');

INSERT INTO spots (name, area_id, lat, lng) VALUES
('大黒PA', 3, 35.46130, 139.68009),
('アネスト岩田スカイラウンジ', 1, 35.18424, 139.04902),
('宮ヶ瀬 鳥居原園地', 2, 35.53890, 139.22234);

INSERT INTO events (name, spot_id, event_date, start_time, description, source) VALUES
('大黒ナイトミーティング', 1, '2026-03-22', '20:00', '週末ナイトミーティング', 'X'),
('箱根朝会', 2, '2026-03-23', '07:00', '朝ツーリング集合', 'Instagram'),
('宮ヶ瀬ナイトオフ', 3, '2026-03-29', '19:00', '宮ヶ瀬オフ会', 'X');
