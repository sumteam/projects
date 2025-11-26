/*
  # CSV Visualization Storage Schema

  1. New Tables
    - `csv_files`
      - `id` (uuid, primary key) - Unique identifier for each CSV file
      - `filename` (text) - Original filename of the uploaded CSV
      - `file_size` (bigint) - Size of the file in bytes
      - `row_count` (integer) - Number of data rows in the CSV
      - `datetime_format` (text) - Detected datetime format (YYYY-MM-DD, DD-MM-YYYY, or MM-DD-YYYY)
      - `start_date` (timestamptz) - Earliest datetime in the CSV data
      - `end_date` (timestamptz) - Latest datetime in the CSV data
      - `available_timeframes` (text[]) - Array of timeframe identifiers found in chain detection columns
      - `uploaded_at` (timestamptz) - When the file was uploaded
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Record update timestamp

    - `csv_data`
      - `id` (uuid, primary key) - Unique identifier for each data row
      - `file_id` (uuid, foreign key) - References csv_files table
      - `datetime` (timestamptz) - Timestamp from the CSV row
      - `open` (numeric) - Open price
      - `high` (numeric) - High price
      - `low` (numeric) - Low price
      - `close` (numeric) - Close price
      - `predictions` (jsonb) - JSON object containing chain_detected values keyed by timeframe
      - `created_at` (timestamptz) - Record creation timestamp

    - `analysis_sessions`
      - `id` (uuid, primary key) - Unique identifier for each session
      - `name` (text) - User-provided name for the session
      - `description` (text) - Optional description
      - `file_ids` (uuid[]) - Array of csv_file IDs used in this session
      - `view_config` (jsonb) - JSON containing view settings, timeframes, zoom levels, etc.
      - `created_at` (timestamptz) - Session creation timestamp
      - `updated_at` (timestamptz) - Session update timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for public read/write access (since no auth system is implemented)
    
  3. Indexes
    - Index on file_id in csv_data for fast lookups
    - Index on datetime in csv_data for time-based queries
    - Composite index on (file_id, datetime) for optimal query performance
*/

-- Create csv_files table
CREATE TABLE IF NOT EXISTS csv_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  row_count integer NOT NULL DEFAULT 0,
  datetime_format text NOT NULL,
  start_date timestamptz,
  end_date timestamptz,
  available_timeframes text[] DEFAULT '{}',
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create csv_data table
CREATE TABLE IF NOT EXISTS csv_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES csv_files(id) ON DELETE CASCADE,
  datetime timestamptz NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  predictions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create analysis_sessions table
CREATE TABLE IF NOT EXISTS analysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  file_ids uuid[] DEFAULT '{}',
  view_config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_csv_data_file_id ON csv_data(file_id);
CREATE INDEX IF NOT EXISTS idx_csv_data_datetime ON csv_data(datetime);
CREATE INDEX IF NOT EXISTS idx_csv_data_file_datetime ON csv_data(file_id, datetime);

-- Enable Row Level Security
ALTER TABLE csv_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required)
CREATE POLICY "Allow public read access to csv_files"
  ON csv_files FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to csv_files"
  ON csv_files FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to csv_files"
  ON csv_files FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from csv_files"
  ON csv_files FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to csv_data"
  ON csv_data FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to csv_data"
  ON csv_data FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public delete from csv_data"
  ON csv_data FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Allow public read access to analysis_sessions"
  ON analysis_sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow public insert to analysis_sessions"
  ON analysis_sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public update to analysis_sessions"
  ON analysis_sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from analysis_sessions"
  ON analysis_sessions FOR DELETE
  TO anon
  USING (true);
