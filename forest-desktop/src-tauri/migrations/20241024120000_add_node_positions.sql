-- Add position columns to nodes table for graph visualization
-- These columns store x,y coordinates for persistent graph layout

ALTER TABLE nodes ADD COLUMN position_x REAL;
ALTER TABLE nodes ADD COLUMN position_y REAL;

-- Index for efficient position queries
CREATE INDEX IF NOT EXISTS idx_nodes_positions ON nodes(position_x, position_y) WHERE position_x IS NOT NULL;
