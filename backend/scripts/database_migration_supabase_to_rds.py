#!/usr/bin/env python3
"""
Complete Database Migration Script: Supabase → AWS RDS PostgreSQL
==================================================================

This script migrates all existing data from Supabase to AWS RDS:
- Creates all required tables
- Inserts all existing data (users, forum_posts, forum_answers, farmer_crops)
- Handles UUIDs, timestamps, and array types correctly

Usage:
    1. Update RDS_PASSWORD below with your actual password
    2. Run: python database_migration_supabase_to_rds.py
"""

import psycopg2
import psycopg2.extras
from datetime import datetime
import sys

# ============================================================================
# CONFIGURATION - UPDATE THIS WITH YOUR RDS CREDENTIALS
# ============================================================================
RDS_CONFIG = {
    'host': 'agrisaarthi-db.cjeoiqeekboz.ap-south-1.rds.amazonaws.com',
    'port': 5432,
    'database': 'agrisaarthi',
    'user': 'postgres',
    'password': '<replaced>',  # ← UPDATE THIS!
    'sslmode': 'require',  # Use 'require' instead of 'verify-full' if you don't have cert
}

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    RESET = '\033[0m'

def log_step(msg):
    print(f"\n{Colors.BOLD}{Colors.BLUE}▶ {msg}{Colors.RESET}")

def log_success(msg):
    print(f"  {Colors.GREEN}✓ {msg}{Colors.RESET}")

def log_error(msg):
    print(f"  {Colors.RED}✗ {msg}{Colors.RESET}")

def log_warning(msg):
    print(f"  {Colors.YELLOW}⚠ {msg}{Colors.RESET}")

# ============================================================================
# DATABASE SCHEMA - CREATE TABLES
# ============================================================================
CREATE_TABLES_SQL = """
-- Users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_code TEXT,
    verification_code_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    state TEXT,
    district TEXT,
    farming_type TEXT,
    language TEXT
);

-- Forum posts table
CREATE TABLE IF NOT EXISTS public.forum_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Anonymous Farmer',
    category TEXT NOT NULL DEFAULT 'general',
    language TEXT NOT NULL DEFAULT 'en',
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    answers_count INT NOT NULL DEFAULT 0,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_email TEXT
);

-- Forum answers table
CREATE TABLE IF NOT EXISTS public.forum_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Anonymous Farmer',
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_email TEXT,
    upvotes INT NOT NULL DEFAULT 0,
    is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Farmer crops table
CREATE TABLE IF NOT EXISTS public.farmer_crops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    crop_name TEXT NOT NULL,
    area_acres NUMERIC(10, 2) NOT NULL,
    soil_type TEXT,
    season TEXT,
    irrigation TEXT,
    variety TEXT,
    notes TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_forum_posts_user_id ON public.forum_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON public.forum_posts(category);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON public.forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_answers_post_id ON public.forum_answers(post_id);
CREATE INDEX IF NOT EXISTS idx_farmer_crops_user_id ON public.farmer_crops(user_id);
"""

# ============================================================================
# DATA TO INSERT (from your Supabase export)
# ============================================================================

# Users data (2 users)
USERS_DATA = [
    {
        'id': 'a087f5b3-3299-4f6c-94d1-62fbf88c5194',
        'email': 'makeasite.in@gmail.com',
        'password_hash': '$2b$12$eP7orES4DcDV5Mo1KTo6oOBGSFJM4nKnv.ncSzFj2ART1SVXbAGyS',
        'full_name': 'makeasite',
        'is_verified': True,
        'verification_code': None,
        'verification_code_expires_at': None,
        'created_at': '2026-02-27 05:18:57.456181+00',
        'state': None,
        'district': None,
        'farming_type': None,
        'language': None
    },
    {
        'id': 'c87a1604-7a47-4ed7-9efd-458b8dbc79e2',
        'email': 'aioont8@gmail.com',
        'password_hash': '$2b$12$D1J9moGLgQrlf646k0my7uygBVVVSEbahwHUkRYCc.VLzgR3raP5m',
        'full_name': 'Mecker',
        'is_verified': True,
        'verification_code': None,
        'verification_code_expires_at': None,
        'created_at': '2026-02-27 05:56:26.594271+00',
        'state': 'Kerala',
        'district': 'Kozhikode',
        'farming_type': 'conventional',
        'language': 'ml'
    }
]

# Forum posts data (9 posts)
FORUM_POSTS_DATA = [
    {
        'id': '2c120f81-7306-4953-bb46-8fc1cc1a3509',
        'title': 'What is the MSP for paddy this season?',
        'content': 'Government has announced new MSP rates. Can anyone share the official numbers?',
        'author': 'Suresh Kumar',
        'category': 'market',
        'language': 'en',
        'upvotes': 35,
        'downvotes': 1,
        'answers_count': 3,
        'is_resolved': True,
        'tags': ['paddy', 'MSP', 'government'],
        'created_at': '2024-01-20 14:00:00+00',
        'user_id': None,
        'user_email': None
    },
    {
        'id': '3d539b0e-dea1-42a6-b167-e72abd7d44c1',
        'title': 'Hi sds dsa',
        'content': 'Hi ascascasca adadac',
        'author': 'Ramesh Kumar',
        'category': 'crop-management',
        'language': 'ml',
        'upvotes': 0,
        'downvotes': 0,
        'answers_count': 0,
        'is_resolved': False,
        'tags': ['asda'],
        'created_at': '2026-02-25 06:31:35.82937+00',
        'user_id': None,
        'user_email': None
    },
    {
        'id': '4b61dc8f-af0f-4e6f-949f-f01584aa7f3d',
        'title': 'Hi this is test question',
        'content': 'Hello this test question description',
        'author': 'makeasite',
        'category': 'crop-management',
        'language': 'en',
        'upvotes': 0,
        'downvotes': 0,
        'answers_count': 0,
        'is_resolved': False,
        'tags': ['#test'],
        'created_at': '2026-02-27 05:33:16.675806+00',
        'user_id': 'a087f5b3-3299-4f6c-94d1-62fbf88c5194',
        'user_email': 'makeasite.in@gmail.com'
    },
    {
        'id': '54c7988d-d4a8-4cea-bcd8-fcf0809cd4c3',
        'title': 'Hi',
        'content': 'Hi',
        'author': 'Ramesh Kumar',
        'category': 'government-schemes',
        'language': 'ml',
        'upvotes': 0,
        'downvotes': 0,
        'answers_count': 0,
        'is_resolved': False,
        'tags': ['Hi'],
        'created_at': '2026-02-25 06:28:04.558668+00',
        'user_id': None,
        'user_email': None
    },
    {
        'id': '7b7530dd-f82c-4dca-9259-8f587ea683fd',
        'title': 'Yellow leaves on tomato plants – what could it be?',
        'content': 'My tomato plants are showing yellow leaves from the bottom. Applied neem oil but no improvement.',
        'author': 'Ramesh Patel',
        'category': 'pest-disease',
        'language': 'en',
        'upvotes': 28,
        'downvotes': 0,
        'answers_count': 5,
        'is_resolved': False,
        'tags': ['tomato', 'disease', 'yellow leaves'],
        'created_at': '2024-01-18 08:30:00+00',
        'user_id': None,
        'user_email': None
    },
    {
        'id': '95ef48bb-9a34-44d1-bf62-d8d5b43c8413',
        'title': 'HI tst qyestuon by aiont',
        'content': 'HI tst qyestuon description by aiont',
        'author': 'Mecker',
        'category': 'weather-advice',
        'language': 'en',
        'upvotes': 0,
        'downvotes': 0,
        'answers_count': 2,
        'is_resolved': False,
        'tags': ['Is it visible for you makeasite.in@gmail.com'],
        'created_at': '2026-02-27 06:05:29.040767+00',
        'user_id': 'c87a1604-7a47-4ed7-9efd-458b8dbc79e2',
        'user_email': 'aioont8@gmail.com'
    },
    {
        'id': 'a2e5c205-7189-4634-b3ad-c6be44412ea9',
        'title': 'Best practices for wheat cultivation in Punjab',
        'content': "I've been farming wheat for 20 years. Here are my top tips for maximising yield...",
        'author': 'Harjeet Singh',
        'category': 'crop-management',
        'language': 'en',
        'upvotes': 42,
        'downvotes': 2,
        'answers_count': 8,
        'is_resolved': True,
        'tags': ['wheat', 'Punjab', 'yield'],
        'created_at': '2024-01-15 10:00:00+00',
        'user_id': None,
        'user_email': None
    },
    {
        'id': 'bbb7e8e0-7236-430a-acee-2562473b5ec0',
        'title': 'Test post from hackathon',
        'content': 'Testing Supabase persistence',
        'author': 'Test Farmer',
        'category': 'crop-management',
        'language': 'en',
        'upvotes': 0,
        'downvotes': 0,
        'answers_count': 0,
        'is_resolved': False,
        'tags': ['test'],
        'created_at': '2026-02-25 05:53:22.138252+00',
        'user_id': None,
        'user_email': None
    },
    {
        'id': 'fe822c0c-5c75-42d8-872a-661c68d5d21a',
        'title': 'Hiccccccccccccccccccccccccccccc',
        'content': 'Hicccccccccccccccccccccccccccccccc',
        'author': 'Ramesh Kumar Ish',
        'category': 'government-schemes',
        'language': 'ml',
        'upvotes': 0,
        'downvotes': 0,
        'answers_count': 0,
        'is_resolved': False,
        'tags': ['Hi'],
        'created_at': '2026-02-25 06:28:54.372207+00',
        'user_id': None,
        'user_email': None
    }
]

# Forum answers data (2 answers)
FORUM_ANSWERS_DATA = [
    {
        'id': '5f9a2ee8-d7b4-432f-9e1c-ce957cf60b40',
        'post_id': '95ef48bb-9a34-44d1-bf62-d8d5b43c8413',
        'content': 'yes visible for makeasite',
        'author': 'makeasite',
        'user_id': 'a087f5b3-3299-4f6c-94d1-62fbf88c5194',
        'user_email': 'makeasite.in@gmail.com',
        'upvotes': 0,
        'is_accepted': False,
        'created_at': '2026-02-27 06:15:37.93366+00'
    },
    {
        'id': 'fbafab43-e574-42e3-9add-0fa7bb841cb9',
        'post_id': '95ef48bb-9a34-44d1-bf62-d8d5b43c8413',
        'content': 'Thanks for replying',
        'author': 'Mecker',
        'user_id': 'c87a1604-7a47-4ed7-9efd-458b8dbc79e2',
        'user_email': 'aioont8@gmail.com',
        'upvotes': 0,
        'is_accepted': False,
        'created_at': '2026-02-27 06:29:05.289823+00'
    }
]

# Farmer crops data (4 crops)
FARMER_CROPS_DATA = [
    {
        'id': '189fd658-3583-4c08-8796-6b83f2d58dee',
        'user_id': 'a087f5b3-3299-4f6c-94d1-62fbf88c5194',
        'crop_name': 'Ginger',
        'area_acres': 5.00,
        'soil_type': 'Peaty Soil',
        'season': 'rabi',
        'irrigation': 'drip',
        'variety': '',
        'notes': '',
        'is_primary': False,
        'created_at': '2026-02-28 18:27:58.13465+00',
        'updated_at': '2026-02-28 18:27:58.13465+00'
    },
    {
        'id': '5f5642b8-befd-4a11-9805-52db01afa7ef',
        'user_id': 'c87a1604-7a47-4ed7-9efd-458b8dbc79e2',
        'crop_name': 'Tomato',
        'area_acres': 0.25,
        'soil_type': 'Black Cotton Soil',
        'season': 'kharif',
        'irrigation': 'drip',
        'variety': '',
        'notes': '',
        'is_primary': False,
        'created_at': '2026-03-02 13:18:06.377722+00',
        'updated_at': '2026-03-02 13:18:06.377722+00'
    },
    {
        'id': '7dd327bb-71a2-4946-804d-decabfcfa719',
        'user_id': 'c87a1604-7a47-4ed7-9efd-458b8dbc79e2',
        'crop_name': 'Millet',
        'area_acres': 2.00,
        'soil_type': 'Alluvial Soil',
        'season': 'rabi',
        'irrigation': 'rainfed',
        'variety': '',
        'notes': '',
        'is_primary': True,
        'created_at': '2026-03-02 12:26:59.875455+00',
        'updated_at': '2026-03-02 12:26:59.875455+00'
    },
    {
        'id': 'efc78b61-d488-405a-92b5-88874ca4b422',
        'user_id': 'a087f5b3-3299-4f6c-94d1-62fbf88c5194',
        'crop_name': 'Wheat',
        'area_acres': 1.00,
        'soil_type': 'Saline Soil',
        'season': 'zaid',
        'irrigation': 'rainfed',
        'variety': '',
        'notes': '',
        'is_primary': False,
        'created_at': '2026-02-28 18:18:53.056765+00',
        'updated_at': '2026-02-28 18:18:53.056765+00'
    }
]

# ============================================================================
# MIGRATION FUNCTIONS
# ============================================================================

def get_connection():
    """Establish connection to AWS RDS."""
    if RDS_CONFIG['password'] == '<Enter_DB_Password>':
        log_error("Please update RDS_PASSWORD in the script!")
        sys.exit(1)
    
    try:
        conn = psycopg2.connect(**RDS_CONFIG)
        psycopg2.extras.register_uuid()
        return conn
    except Exception as e:
        log_error(f"Failed to connect to RDS: {e}")
        sys.exit(1)

def create_tables(conn):
    """Create all required tables."""
    log_step("Creating database tables...")
    try:
        with conn.cursor() as cur:
            cur.execute(CREATE_TABLES_SQL)
        conn.commit()
        log_success("All tables created successfully")
        return True
    except Exception as e:
        log_error(f"Failed to create tables: {e}")
        conn.rollback()
        return False

def insert_users(conn):
    """Insert users data."""
    log_step("Inserting users...")
    try:
        with conn.cursor() as cur:
            # Check if users already exist
            cur.execute("SELECT COUNT(*) FROM public.users")
            existing_count = cur.fetchone()[0]
            
            if existing_count > 0:
                log_warning(f"Found {existing_count} existing users. Skipping duplicates...")
            
            inserted = 0
            for user in USERS_DATA:
                try:
                    cur.execute("""
                        INSERT INTO public.users 
                        (id, email, password_hash, full_name, is_verified, verification_code, 
                         verification_code_expires_at, created_at, state, district, farming_type, language)
                        VALUES (%(id)s, %(email)s, %(password_hash)s, %(full_name)s, %(is_verified)s,
                                %(verification_code)s, %(verification_code_expires_at)s, %(created_at)s,
                                %(state)s, %(district)s, %(farming_type)s, %(language)s)
                        ON CONFLICT (id) DO NOTHING
                    """, user)
                    if cur.rowcount > 0:
                        inserted += 1
                except Exception as e:
                    log_warning(f"Skipping user {user['email']}: {e}")
            
            conn.commit()
            log_success(f"Inserted {inserted} users ({len(USERS_DATA) - inserted} already existed)")
            return True
    except Exception as e:
        log_error(f"Failed to insert users: {e}")
        conn.rollback()
        return False

def insert_forum_posts(conn):
    """Insert forum posts data."""
    log_step("Inserting forum posts...")
    try:
        with conn.cursor() as cur:
            inserted = 0
            for post in FORUM_POSTS_DATA:
                try:
                    cur.execute("""
                        INSERT INTO public.forum_posts 
                        (id, title, content, author, category, language, upvotes, downvotes,
                         answers_count, is_resolved, tags, created_at, user_id, user_email)
                        VALUES (%(id)s, %(title)s, %(content)s, %(author)s, %(category)s, %(language)s,
                                %(upvotes)s, %(downvotes)s, %(answers_count)s, %(is_resolved)s,
                                %(tags)s, %(created_at)s, %(user_id)s, %(user_email)s)
                        ON CONFLICT (id) DO NOTHING
                    """, post)
                    if cur.rowcount > 0:
                        inserted += 1
                except Exception as e:
                    log_warning(f"Skipping post '{post['title'][:30]}...': {e}")
            
            conn.commit()
            log_success(f"Inserted {inserted} forum posts ({len(FORUM_POSTS_DATA) - inserted} already existed)")
            return True
    except Exception as e:
        log_error(f"Failed to insert forum posts: {e}")
        conn.rollback()
        return False

def insert_forum_answers(conn):
    """Insert forum answers data."""
    log_step("Inserting forum answers...")
    try:
        with conn.cursor() as cur:
            inserted = 0
            for answer in FORUM_ANSWERS_DATA:
                try:
                    cur.execute("""
                        INSERT INTO public.forum_answers 
                        (id, post_id, content, author, user_id, user_email, upvotes, is_accepted, created_at)
                        VALUES (%(id)s, %(post_id)s, %(content)s, %(author)s, %(user_id)s,
                                %(user_email)s, %(upvotes)s, %(is_accepted)s, %(created_at)s)
                        ON CONFLICT (id) DO NOTHING
                    """, answer)
                    if cur.rowcount > 0:
                        inserted += 1
                except Exception as e:
                    log_warning(f"Skipping answer: {e}")
            
            conn.commit()
            log_success(f"Inserted {inserted} forum answers ({len(FORUM_ANSWERS_DATA) - inserted} already existed)")
            return True
    except Exception as e:
        log_error(f"Failed to insert forum answers: {e}")
        conn.rollback()
        return False

def insert_farmer_crops(conn):
    """Insert farmer crops data."""
    log_step("Inserting farmer crops...")
    try:
        with conn.cursor() as cur:
            inserted = 0
            for crop in FARMER_CROPS_DATA:
                try:
                    cur.execute("""
                        INSERT INTO public.farmer_crops 
                        (id, user_id, crop_name, area_acres, soil_type, season, irrigation,
                         variety, notes, is_primary, created_at, updated_at)
                        VALUES (%(id)s, %(user_id)s, %(crop_name)s, %(area_acres)s, %(soil_type)s,
                                %(season)s, %(irrigation)s, %(variety)s, %(notes)s, %(is_primary)s,
                                %(created_at)s, %(updated_at)s)
                        ON CONFLICT (id) DO NOTHING
                    """, crop)
                    if cur.rowcount > 0:
                        inserted += 1
                except Exception as e:
                    log_warning(f"Skipping crop {crop['crop_name']}: {e}")
            
            conn.commit()
            log_success(f"Inserted {inserted} farmer crops ({len(FARMER_CROPS_DATA) - inserted} already existed)")
            return True
    except Exception as e:
        log_error(f"Failed to insert farmer crops: {e}")
        conn.rollback()
        return False

def verify_migration(conn):
    """Verify that all data was migrated successfully."""
    log_step("Verifying migration...")
    try:
        with conn.cursor() as cur:
            # Count records in each table
            tables = {
                'users': len(USERS_DATA),
                'forum_posts': len(FORUM_POSTS_DATA),
                'forum_answers': len(FORUM_ANSWERS_DATA),
                'farmer_crops': len(FARMER_CROPS_DATA)
            }
            
            all_good = True
            for table, expected_count in tables.items():
                cur.execute(f"SELECT COUNT(*) FROM public.{table}")
                actual_count = cur.fetchone()[0]
                
                if actual_count >= expected_count:
                    log_success(f"{table}: {actual_count} records (expected ≥{expected_count})")
                else:
                    log_warning(f"{table}: {actual_count} records (expected {expected_count})")
                    all_good = False
            
            return all_good
    except Exception as e:
        log_error(f"Verification failed: {e}")
        return False

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """Main migration process."""
    print(f"\n{Colors.BOLD}{'='*70}{Colors.RESET}")
    print(f"{Colors.BOLD}  AgriSaarthi AI - Complete Database Migration{Colors.RESET}")
    print(f"{Colors.BOLD}  Supabase → AWS RDS PostgreSQL{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*70}{Colors.RESET}\n")
    
    print(f"{Colors.BOLD}Migration Summary:{Colors.RESET}")
    print(f"  • {len(USERS_DATA)} users")
    print(f"  • {len(FORUM_POSTS_DATA)} forum posts")
    print(f"  • {len(FORUM_ANSWERS_DATA)} forum answers")
    print(f"  • {len(FARMER_CROPS_DATA)} farmer crops")
    print()
    
    # Confirm before proceeding
    response = input(f"{Colors.YELLOW}Proceed with migration? (yes/no): {Colors.RESET}").strip().lower()
    if response not in ('yes', 'y'):
        print("Migration cancelled.")
        sys.exit(0)
    
    # Connect to database
    log_step("Connecting to AWS RDS...")
    conn = get_connection()
    log_success(f"Connected to {RDS_CONFIG['host']}")
    
    try:
        # Create tables
        if not create_tables(conn):
            sys.exit(1)
        
        # Insert data in order (respecting foreign keys)
        if not insert_users(conn):
            sys.exit(1)
        
        if not insert_forum_posts(conn):
            sys.exit(1)
        
        if not insert_forum_answers(conn):
            sys.exit(1)
        
        if not insert_farmer_crops(conn):
            sys.exit(1)
        
        # Verify migration
        if verify_migration(conn):
            print(f"\n{Colors.BOLD}{Colors.GREEN}{'='*70}{Colors.RESET}")
            print(f"{Colors.BOLD}{Colors.GREEN}  ✓ Migration Completed Successfully!{Colors.RESET}")
            print(f"{Colors.BOLD}{Colors.GREEN}{'='*70}{Colors.RESET}\n")
            
            print(f"{Colors.BOLD}Next Steps:{Colors.RESET}")
            print(f"  1. Update your .env file:")
            print(f"     {Colors.GREEN}DATABASE_URL=postgresql://postgres:PASSWORD@{RDS_CONFIG['host']}:{RDS_CONFIG['port']}/{RDS_CONFIG['database']}?sslmode=require{Colors.RESET}")
            print(f"     {Colors.GREEN}DATABASE_POOL_URL=postgresql://postgres:PASSWORD@{RDS_CONFIG['host']}:{RDS_CONFIG['port']}/{RDS_CONFIG['database']}?sslmode=require{Colors.RESET}")
            print(f"\n  2. Restart your backend:")
            print(f"     {Colors.BLUE}uvicorn app.main:app --reload{Colors.RESET}")
            print(f"\n  3. Test the forum API:")
            print(f"     {Colors.BLUE}curl http://localhost:8000/api/forum/posts{Colors.RESET}\n")
        else:
            log_warning("Migration completed with warnings. Please check the logs above.")
    
    except Exception as e:
        log_error(f"Migration failed: {e}")
        sys.exit(1)
    
    finally:
        conn.close()
        log_success("Database connection closed")

if __name__ == '__main__':
    main()