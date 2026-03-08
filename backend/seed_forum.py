"""
Seed realistic forum posts + answers into the RDS database.
Run: python seed_forum.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv()

from app.core.config import settings
import psycopg2
import psycopg2.extras

psycopg2.extras.register_uuid()

POSTS = [
    {
        "id": "11111111-0001-0001-0001-000000000001",
        "title": "White flies destroying my cotton crop — urgent help needed",
        "content": "I'm a cotton farmer in Vidarbha, Maharashtra. My 5-acre cotton field is under severe attack from white flies (Bemisia tabaci). The leaves are turning yellow and curling downwards. I've sprayed imidacloprid once but the population is still high. Rainfall was below normal this season. What should I do? Has anyone dealt with this before?",
        "author": "Anil Deshmukh",
        "category": "pest-disease",
        "language": "en",
        "upvotes": 54,
        "downvotes": 1,
        "answers_count": 4,
        "is_resolved": False,
        "tags": ["cotton", "whitefly", "Maharashtra", "pesticide"],
    },
    {
        "id": "11111111-0002-0002-0002-000000000002",
        "title": "PM Kisan installment not received — how to check and fix?",
        "content": "I registered for PM-Kisan scheme 6 months ago but have not received any installment in my bank account. My Aadhaar is linked to the account. I contacted the local agriculture office but they said the payment is stuck due to land records mismatch. What is the correct procedure to resolve the land records issue and get my pending installments?",
        "author": "Devraj Yadav",
        "category": "government-schemes",
        "language": "en",
        "upvotes": 89,
        "downvotes": 2,
        "answers_count": 6,
        "is_resolved": True,
        "tags": ["PM-Kisan", "subsidy", "Aadhaar", "land records"],
    },
    {
        "id": "11111111-0003-0003-0003-000000000003",
        "title": "Wheat ke daane chhote kyun hain? Kya utpadan badhane ka upay hai?",
        "content": "Mera gehun Punjab ke Ludhiana mein hai. Is baar daane bahut chhote aa rahe hain jabki pichhli baar achha yield tha. December mein paani thoda kam diya tha. Mitti ki jaanch nahi karwai. Koi solution batayein — DAP aur urea ki sahi matra kya honi chahiye?",
        "author": "Gurpreet Singh",
        "category": "crop-management",
        "language": "hi",
        "upvotes": 67,
        "downvotes": 0,
        "answers_count": 5,
        "is_resolved": True,
        "tags": ["wheat", "Punjab", "fertilizer", "yield"],
    },
    {
        "id": "11111111-0004-0004-0004-000000000004",
        "title": "Drip irrigation setup cost and ROI for 2-acre sugarcane farm",
        "content": "I have 2 acres of sugarcane in Kolhapur district. Considering switching from flood irrigation to drip irrigation. What is the approximate cost of installation? Is government subsidy available under PMKSY? How many seasons does it take to recover the investment through water and fertilizer savings?",
        "author": "Santosh Patil",
        "category": "crop-management",
        "language": "en",
        "upvotes": 73,
        "downvotes": 3,
        "answers_count": 7,
        "is_resolved": True,
        "tags": ["sugarcane", "drip irrigation", "PMKSY", "subsidy", "Kolhapur"],
    },
    {
        "id": "11111111-0005-0005-0005-000000000005",
        "title": "Tomato mandi price crashed to ₹3/kg — when will prices recover?",
        "content": "I'm a tomato farmer in Kolar, Karnataka. Prices have crashed to ₹3/kg at the mandi, which is below my cost of production. I've heard that processing units buy at fixed prices. Is there a tomato processing company or FPO nearby that buys directly? Also when typically does the Kolar tomato market recover — is it better to store for 2-3 weeks?",
        "author": "Manjunath Reddy",
        "category": "market",
        "language": "en",
        "upvotes": 112,
        "downvotes": 4,
        "answers_count": 9,
        "is_resolved": False,
        "tags": ["tomato", "mandi price", "Kolar", "Karnataka", "FPO"],
    },
    {
        "id": "11111111-0006-0006-0006-000000000006",
        "title": "Soil pH too acidic (4.8) for paddy — lime treatment advice",
        "content": "Soil test report shows pH 4.8 in my 3-acre paddy field in Assam. Extension worker suggested lime (calcium carbonate) application. How much lime per acre is recommended? Should it be applied before transplanting or after? Also can I apply organic matter like compost along with lime in the same season?",
        "author": "Bipul Bora",
        "category": "crop-management",
        "language": "en",
        "upvotes": 38,
        "downvotes": 0,
        "answers_count": 3,
        "is_resolved": False,
        "tags": ["paddy", "soil pH", "lime", "Assam", "soil health"],
    },
    {
        "id": "11111111-0007-0007-0007-000000000007",
        "title": "சோளம் விவசாயத்தில் கம்பளிப்பூச்சி தாக்குதல் — தீர்வு என்ன?",
        "content": "தமிழ்நாட்டில் கோயம்புத்தூர் மாவட்டத்தில் என்னிடம் 4 ஏக்கர் சோளம் உள்ளது. கம்பளிப்பூச்சிகள் (fall armyworm) தாக்கி இலைகளை சாப்பிட்டுக் கொண்டிருக்கின்றன. என்ன பூச்சிக்கொல்லி தெளிக்க வேண்டும்? இயற்கை உரம் பயன்படுத்துகிறவர்களுக்கு என்ன மாற்று?",
        "author": "Murugesan K",
        "category": "pest-disease",
        "language": "ta",
        "upvotes": 29,
        "downvotes": 1,
        "answers_count": 4,
        "is_resolved": True,
        "tags": ["maize", "fall armyworm", "Tamil Nadu", "organic pest control"],
    },
    {
        "id": "11111111-0008-0008-0008-000000000008",
        "title": "Kisan Credit Card limit not enough — how to increase it?",
        "content": "My Kisan Credit Card (KCC) limit is ₹1.2 lakh which was set 4 years ago. My farm size has increased from 2 to 5 acres and input costs have gone up. I approached my bank to increase the limit but they asked for fresh land valuation documents. What documents exactly are needed and what is the process? Does the 4% interest subvention still apply after limit revision?",
        "author": "Ramakrishnan T",
        "category": "government-schemes",
        "language": "en",
        "upvotes": 95,
        "downvotes": 2,
        "answers_count": 8,
        "is_resolved": True,
        "tags": ["KCC", "Kisan Credit Card", "bank", "loan", "interest subvention"],
    },
    {
        "id": "11111111-0009-0009-0009-000000000009",
        "title": "Heavy rain forecast next week — should I harvest green chilli early?",
        "content": "I'm in Guntur district, Andhra Pradesh. Weather app shows 80mm+ rainfall expected over next 7 days. My green chilli crop is at 70% maturity. Should I harvest early before rains to prevent fungal damage? What postharvest storage can I do at home? Or should I wait for full maturity and risk the rain?",
        "author": "Venkata Rao",
        "category": "weather-advice",
        "language": "en",
        "upvotes": 61,
        "downvotes": 1,
        "answers_count": 5,
        "is_resolved": True,
        "tags": ["chilli", "Guntur", "Andhra Pradesh", "harvest timing", "weather"],
    },
    {
        "id": "11111111-0010-0010-0010-000000000010",
        "title": "गाय के गोबर से वर्मीकम्पोस्ट बनाने की सही विधि क्या है?",
        "content": "मैं राजस्थान के जोधपुर जिले में जैविक खेती करता हूँ। वर्मीकम्पोस्ट बनाना शुरू करना चाहता हूँ। 2 एकड़ के लिए कितना वर्मीकम्पोस्ट चाहिए? केंचुए कहाँ से खरीदें? बेड का आकार क्या हो? तैयार होने में कितना समय लगता है?",
        "author": "Hanuman Lal Jat",
        "category": "crop-management",
        "language": "hi",
        "upvotes": 48,
        "downvotes": 0,
        "answers_count": 6,
        "is_resolved": True,
        "tags": ["vermicompost", "organic farming", "Rajasthan", "cow dung", "soil health"],
    },
]

ANSWERS = [
    # Post 1 — whitefly cotton
    ("11111111-0001-0001-0001-000000000001", "Use Spiromesifen 240 SC @ 300ml/acre or Diafenthiuron 50WP @ 300g/acre — both work on whitefly resistance. Spray during early morning or evening. Remove heavily infested lower leaves and burn them. Yellow sticky traps help monitor population.", "Dr. Suresh Agri KVK", 31),
    ("11111111-0001-0001-0001-000000000001", "We faced the same problem in Yavatmal last year. Imidacloprid builds resistance fast — switch to pyriproxyfen or buprofezin. Also check if virus symptoms (leaf curl virus) are present as whitefly is a vector — that needs different management.", "Vitthal Bhosale", 24),
    ("11111111-0001-0001-0001-000000000001", "For organic option: spray neem oil 5% + garlic extract + fish amino acid mixture every 5 days. It doesn't kill adults but disrupts the life cycle. Combine with reflective mulch to confuse whiteflies.", "Organic Farmer Forum", 12),

    # Post 2 — PM Kisan
    ("11111111-0002-0002-0002-000000000002", "Go to pmkisan.gov.in → Beneficiary Status → enter Aadhaar. It will show exactly where the payment is stuck. Common issues: (1) Name mismatch between land records and Aadhaar — get name corrected at Tehsil office, (2) Invalid bank IFSC — update via village Patwari. After correction, resubmit KYC eKYC at Common Service Centre.", "Agri Extension Officer", 67),
    ("11111111-0002-0002-0002-000000000002", "I had the same issue. Visited Block Agriculture Officer with: Aadhaar copy, bank passbook, land Khatauni copy, ration card. They submitted a correction request online. Got installment credited in 45 days. Don't pay any agent — the process is free.", "Devendra Mishra", 43),

    # Post 3 — wheat grain size Hindi
    ("11111111-0003-0003-0003-000000000003", "Daane chhhote hone ke mukhya karan: (1) December-January mein irrigation ka khamiyaaza — gehun ko crown root irrigation (CRI) ke baad 3-4 pani chahiye. (2) Sulfur ki kami — soil test karwaayein. DAP ke saath single super phosphate bhi milayein agle season. Urea to-dressing 50kg/acre tillering stage aur 50kg/acre at flag leaf stage.", "Punjab Agricultural University", 52),

    # Post 4 — drip irrigation sugarcane
    ("11111111-0004-0004-0004-000000000004", "Drip irrigation cost for sugarcane in Maharashtra: ₹55,000–65,000 per acre for inline drip system. Under PMKSY, SC/ST farmers get 90% subsidy, others get 55% (Maharashtra). Apply through Mahadbt.mahait.gov.in portal. For 2 acres you should recover cost within 2 seasons through 30-40% water saving and 15-20% fertilizer saving through fertigation.", "NABARD Field Officer", 58),
    ("11111111-0004-0004-0004-000000000004", "I installed drip on my 3-acre sugarcane plot in Sangli 3 years ago. Cost was ₹1.1 lakh, subsidy ₹60k from state scheme. Sugarcane yield improved from 45 MT to 62 MT/acre. Water use dropped from 140 to 90 units per day. ROI achieved in 18 months. Best decision for sugarcane.", "Sunil Jadhav", 44),

    # Post 5 — tomato price crash
    ("11111111-0005-0005-0005-000000000005", "Safal or Mother Dairy have procurement centres — contact HOPCOMS in Karnataka for direct sale. For storage: tomato can't be stored beyond 7-10 days even in cool conditions without cold chain. Better to harvest green-ripe stage and negotiate with ripening chambers at Bangalore. Market typically recovers in 3-4 weeks after heavy flush supply.", "HOPCOMS Karnataka", 78),
    ("11111111-0005-0005-0005-000000000005", "Join the Kolar Tomato Farmers Producer Company — they aggregated 200+ farmers last season and got ₹12/kg from a processor in Bengaluru while mandi was ₹3. Contact: Kolar FPO WhatsApp group. Also APEDA has export enquiries from Middle East markets during Indian surplus season.", "FPO Coordinator", 61),

    # Post 6 — soil pH paddy
    ("11111111-0006-0006-0006-000000000006", "For pH 4.8, apply 1–1.5 tonnes agricultural lime (CaCO3) per acre 3-4 weeks before transplanting. Do NOT apply lime and compost simultaneously — lime raises pH and compost can tie up nutrients if applied together. Apply lime first, wait 2-3 weeks, then add compost. Ideal paddy pH is 5.5-6.5.", "ICAR-NRRI Cuttack", 29),

    # Post 7 — fall armyworm Tamil
    ("11111111-0007-0007-0007-000000000007", "Fall armyworm-ku Emamectin benzoate 5% SG @ 200g/acre or Spinetoram 11.7% SC @ 200ml/acre effective-aana spray. Organic option: Metarhizium anisopliae biological pesticide spray or Bacillus thuringiensis (Bt) product. Pheromone traps @ 5/acre vaiyungal to monitor.", "TNAU Coimbatore", 23),

    # Post 8 — KCC limit
    ("11111111-0008-0008-0008-000000000008", "Documents needed for KCC revision: (1) Updated land holding certificate/Patta/7-12 extract, (2) Last 2 seasons crop details, (3) Existing KCC passbook, (4) Aadhaar+PAN, (5) Bank account statement 6 months. 4% interest subvention (under Modified Interest Subvention Scheme) continues after revision IF repayment was on time. Approach branch manager with letter from village Patwari confirming land increase.", "State Level Bankers Committee", 72),

    # Post 9 — chilli harvest timing
    ("11111111-0009-0009-0009-000000000009", "Harvest 60-65% ripe chillies before the rain. Green-ripe chilli will continue ripening after harvest. For home storage: spread in shade (not sun), ensure good airflow, check daily for fungal spots. Apply 0.2% Carbendazim spray on the remaining field before the rain to prevent Anthracnose (die-back disease). Delay will cause 40-60% loss.", "ANGRAU Extension, Guntur", 49),

    # Post 10 — vermicompost Hindi
    ("11111111-0010-0010-0010-000000000010", "2 acre ke liye 4-5 tonne vermicompost per season kaafi hai. Eisenia fetida (lal kenchua) best hai — 500g se shuruat karein @ ₹300-400/kg NABARD-approved nurseries se. Bed: 3 feet x 6 feet x 1.5 feet raised bed. Cow dung 60% + sabji waste 40% mixture rakhein. 45-60 din mein taiyar. Nami banaye rakhein — sukhane nahi dena.", "Krishi Vigyan Kendra Jodhpur", 36),
]

def seed():
    conn = psycopg2.connect(settings.DATABASE_POOL_URL, connect_timeout=10)
    psycopg2.extras.register_uuid()
    inserted_posts = 0
    inserted_answers = 0

    # Ensure forum_answers table exists
    forum_answers_ddl = """
    CREATE TABLE IF NOT EXISTS public.forum_answers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        author TEXT NOT NULL DEFAULT 'Anonymous',
        user_id UUID,
        user_email TEXT,
        upvotes INT NOT NULL DEFAULT 0,
        is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(forum_answers_ddl)
        print("forum_answers table ensured")
    except Exception as e:
        print(f"Table DDL warning: {e}")

    # Insert posts (skip if already exists)
    for p in POSTS:
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO public.forum_posts
                            (id, title, content, author, category, language,
                             upvotes, downvotes, answers_count, is_resolved, tags)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (id) DO NOTHING
                    """, (
                        p["id"], p["title"], p["content"], p["author"],
                        p["category"], p["language"], p["upvotes"],
                        p["downvotes"], p["answers_count"], p["is_resolved"],
                        p["tags"],
                    ))
                    if cur.rowcount:
                        inserted_posts += 1
        except Exception as e:
            print(f"  Post error [{p['title'][:40]}]: {e}")

    print(f"Inserted {inserted_posts}/{len(POSTS)} posts")

    # Insert answers
    for post_id, content, author, upvotes in ANSWERS:
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO public.forum_answers
                            (post_id, content, author, upvotes)
                        VALUES (%s,%s,%s,%s)
                    """, (post_id, content, author, upvotes))
                    inserted_answers += 1
        except Exception as e:
            print(f"  Answer error [{author}]: {e}")

    print(f"Inserted {inserted_answers}/{len(ANSWERS)} answers")

    conn.close()
    print("\n✅ Forum seed complete!")


if __name__ == "__main__":
    seed()
