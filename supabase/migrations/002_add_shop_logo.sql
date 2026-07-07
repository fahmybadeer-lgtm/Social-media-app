-- ============================================================
-- Migration: 002_add_shop_logo
-- Description: Adds a nullable logo_url column to profiles so
--              each shop can upload and display a custom logo
--              in the app sidebar (replacing the icon fallback).
--              Additive only — no existing data is touched.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
