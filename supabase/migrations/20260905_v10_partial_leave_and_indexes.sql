-- ==============================================================================
-- Migration: 20260905_v10_partial_leave_and_indexes.sql
-- Description: Partial-day leave columns + performance indexes for BriskSchedules v10
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/gcslfkujlfnznedatrsn/sql
-- ==============================================================================

-- 1. Add partial-day leave columns to brisk_leave_requests
ALTER TABLE brisk_leave_requests 
ADD COLUMN IF NOT EXISTS leave_duration_type TEXT DEFAULT 'full_day',
ADD COLUMN IF NOT EXISTS unavailable_from TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unavailable_until TIME DEFAULT NULL;

-- 2. Add performance indexes for rapid queries (10+ concurrent staff)
CREATE INDEX IF NOT EXISTS idx_brisk_shifts_date_emp 
ON brisk_shifts(date, employee_id);

CREATE INDEX IF NOT EXISTS idx_brisk_leave_dates 
ON brisk_leave_requests(start_date, end_date);

-- 3. Optional: Create brisk_shift_swaps table if not already created
CREATE TABLE IF NOT EXISTS brisk_shift_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES brisk_shifts(id) ON DELETE CASCADE,
    requester_id UUID REFERENCES brisk_employees(id) ON DELETE CASCADE,
    acceptor_id UUID REFERENCES brisk_employees(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
