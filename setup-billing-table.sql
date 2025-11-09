-- ============================================
-- Create billing_customers table for Stripe integration
-- ============================================
-- Run this entire file in your Supabase SQL Editor
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste this → Run

-- Step 1: Create the billing_customers table
CREATE TABLE IF NOT EXISTS billing_customers (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create index for faster lookups by Stripe customer ID
CREATE INDEX IF NOT EXISTS idx_billing_customers_stripe_id ON billing_customers(stripe_customer_id);

-- Step 3: Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_billing_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS trigger_billing_customers_updated_at ON billing_customers;
CREATE TRIGGER trigger_billing_customers_updated_at
    BEFORE UPDATE ON billing_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_billing_customers_updated_at();

-- ============================================
-- Verification: Check if table was created
-- ============================================
-- Uncomment the line below to verify the table exists:
-- SELECT * FROM billing_customers LIMIT 1;
