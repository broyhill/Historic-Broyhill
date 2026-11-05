-- AUTHORIZED MERGE EXECUTION — 20 HIGH confidence pairs
-- Authorized by Ed Broyhill 2026-06-28 18:16 EDT
-- "take action authorized"
--
-- STRATEGY:
--   keep_id = whichever cluster has the HIGHER lifetime_total (more history)
--   retire_id = the lower-value duplicate
--   raw.ncboe_donations is READ ONLY — never touched
--   We update acs.donor_block_group_map to point retire_id rows to keep_id
--   We log every merge to acs.merge_log for audit trail

BEGIN;

-- Canary pre-merge
DO $$ DECLARE v_txns bigint; v_total numeric;
BEGIN
    SELECT COUNT(*), SUM(norm_amount) INTO v_txns, v_total
    FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns != 147 OR round(v_total::numeric,2) != 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAILED pre-merge: %/%', v_txns, v_total;
    END IF;
    RAISE NOTICE 'CANARY PASS pre-merge: % / $%', v_txns, v_total;
END $$;

-- Audit log table
CREATE TABLE IF NOT EXISTS acs.merge_log (
    merge_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    keep_cluster_id integer NOT NULL,
    retired_cluster_id integer NOT NULL,
    keep_name       text,
    retired_name    text,
    zip9            text,
    keep_total      numeric,
    retired_total   numeric,
    merged_total    numeric,
    edit_distance   integer,
    authorized_by   text NOT NULL DEFAULT 'Ed Broyhill',
    authorized_at   timestamptz NOT NULL DEFAULT NOW(),
    merge_method    text NOT NULL DEFAULT 'ZIP9+name_levenshtein',
    notes           text
);

-- Insert merge log entries BEFORE making changes
INSERT INTO acs.merge_log
    (keep_cluster_id, retired_cluster_id, keep_name, retired_name, zip9, keep_total, retired_total, merged_total, edit_distance, notes)
VALUES
-- Keep the higher-value cluster for HERB GREEMAN/HERB GREENMAN (swap from preview)
(1841810, 1641659, 'HERB GREENMAN', 'HERB GREEMAN', '28204-2763', 13598.58, 1000.00, 14598.58, 1, 'Higher-value record 1841810 kept as survivor'),
-- KYLE DONAHUE/DONOHUE — keep higher value
(1826185, 1826135, 'KYLE DONOHUE', 'KYLE DONAHUE', '28906-7468', 5455.18, 2050.00, 7505.18, 1, 'Higher-value record 1826185 kept as survivor'),
-- Richard Van Gorp — keep higher value
(2422493, 470433, 'Richard Vangorp', 'Richard Van Gorp', '27546-4835', 812.30, 100.00, 912.30, 2, 'Higher-value record 2422493 kept as survivor'),
-- KIMBERLEE WALAWANDER/WALAWENDER — keep higher value
(1899227, 1899224, 'KIMBERLEE WALAWENDER', 'KIMBERLEE WALAWANDER', '27527-9662', 2500.00, 1000.00, 3500.00, 1, 'Higher-value record 1899227 kept as survivor'),
-- LAMARIE — keep higher value
(1994214, 1911791, 'LAMARIE AUSTIN STRIPLING', 'LAMARIE AUSTIN-STRIPLING', '28025-0049', 385.00, 270.00, 655.00, 1, 'Higher-value record 1994214 kept as survivor'),
-- RANDALL — keep higher value
(1435584, 696651, 'RANDALL CARTWRIGHT', 'RANDALL CATWRIGHT', '27909-7615', 200.00, 100.00, 300.00, 1, 'Higher-value record 1435584 kept as survivor'),
-- KATHY HOFERT (exact match, keep higher)
(820073, 820071, 'KATHY HOFERT', 'KATHY HOFERT', '-8509', 200.00, 20.00, 220.00, 0, 'Exact name match same delivery point'),
-- Remaining — higher value was already keep_id in preview
(385799, 683534, 'STEPHEN ROSENBURGH', 'STEPHEN ROSENBURG', '28277-3029', 182377.50, 2500.00, 184877.50, 1, NULL),
(661941, 716230, 'DAVID HONEYCUTT', 'DAVID HONEYCUT', '28403-3756', 73550.00, 2500.00, 76050.00, 1, NULL),
(373717, 2004421, 'IRENE WADLEY', 'IRENE WADLE', '27613-8334', 49600.00, 500.00, 50100.00, 1, NULL),
(579551, 1717703, 'MARC CHESNUTT', 'MARCUS CHESNUT', '28562-0550', 9250.00, 1000.00, 10250.00, 3, NULL),
(615069, 2139824, 'DAWNE DEUTERMAN', 'DAWNE DEUTERMON', '27410-2166', 9000.00, 500.00, 9500.00, 1, NULL),
(411384, 510301, 'SCOTT W HADLEY', 'SCOTT HANDLEY', '27612-6612', 8200.00, 125.00, 8325.00, 3, NULL),
(456137, 1938389, 'WILLIAM DIX', 'WILLIAM FIX', '27612-2158', 3950.00, 100.00, 4050.00, 1, NULL),
(1804797, 1804841, 'CHRISTOPHER ALDREDGE', 'CHRISTOPHER ALDRIDGE', '27546-2715', 2650.00, 100.00, 2750.00, 1, NULL),
(1845759, 2122855, 'JANICE G BEATTY HENDLEY', 'JANICE BEATTY-HENDLEY', '28081-9365', 1200.00, 150.00, 1350.00, 3, NULL),
(614621, 2045664, 'RONALD GARBER', 'RONALD GERBER', '27612-4950', 1200.00, 100.00, 1300.00, 1, NULL),
(1620841, 1804899, 'DONALD D''AMBROSI', 'DONALD AMBROSI', '27523-5737', 650.00, 225.00, 875.00, 2, NULL),
(358007, 493497, 'JOY WHITLACH', 'JOY B WHITLATCH', '28607-6829', 650.00, 100.00, 750.00, 3, NULL),
(718265, 1853419, 'TIMOTHY KORAN', 'TIMOTHY J KARAN', '27522-9782', 250.00, 140.00, 390.00, 3, NULL);

-- Update acs.donor_block_group_map — point retired cluster to keep cluster
-- (does NOT delete retired cluster — that requires separate authorization)
UPDATE acs.donor_block_group_map
SET block_group_fips = k.block_group_fips,
    zcta5            = k.zcta5,
    zip4             = k.zip4,
    dpv_status       = COALESCE(k.dpv_status, acs.donor_block_group_map.dpv_status),
    mapped_at        = NOW()
FROM acs.merge_log ml
JOIN acs.donor_block_group_map k ON k.cluster_id = ml.keep_cluster_id
WHERE acs.donor_block_group_map.cluster_id = ml.retired_cluster_id;

-- Report
SELECT
    COUNT(*) AS merges_logged,
    SUM(merged_total) AS total_dollars_unified,
    SUM(retired_total) AS dollars_previously_split
FROM acs.merge_log;

-- Canary post-merge
DO $$ DECLARE v_txns bigint; v_total numeric;
BEGIN
    SELECT COUNT(*), SUM(norm_amount) INTO v_txns, v_total
    FROM raw.ncboe_donations WHERE cluster_id = 372171;
    IF v_txns != 147 OR round(v_total::numeric,2) != 332631.30 THEN
        RAISE EXCEPTION 'CANARY FAILED post-merge: %/%', v_txns, v_total;
    END IF;
    RAISE NOTICE 'CANARY PASS post-merge: % / $%', v_txns, v_total;
END $$;

COMMIT;
