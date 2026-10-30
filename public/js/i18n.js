/**
 * ============================================================================
 * Justice Connect - Global i18n & Multi-Language State Manager
 * Supports: English ('en'), Amharic ('am'), Afaan Oromo ('om')
 * ============================================================================
 */

(function () {
    'use strict';

    // 1. Language Definitions & Script Enums
    const SUPPORTED_LANGUAGES = ['en', 'am', 'om'];
    const DEFAULT_LANGUAGE = 'en';
    const STORAGE_KEY = 'app_language';

    // Unicode Script Ranges
    // Ge'ez (Ethiopic): Ethiopic (\u1200-\u137F), Supplement (\u1380-\u139F), Extended (\u2D80-\u2DDF), Extended-A (\uAB00-\uAB2F)
    const GEEZ_REGEX = /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF\uAB00-\uAB2F]/;
    const LATIN_REGEX = /[a-zA-Z]/;

    // 2. Comprehensive Localization Dictionary
    const translations = {
        en: {
            // General / Brand
            app_title: "Justice Connect | Court Complaint Management",
            brand_name: "Justice Connect",
            brand_tagline: "Ethiopia's Premier E-Justice Platform",

            // Navigation
            nav_home: "Home",
            nav_why: "Why Choose Us",
            nav_about: "About Us",
            nav_dashboard: "Dashboard",
            nav_signin: "Sign In / Register →",
            nav_signin_short: "Sign In",
            nav_logout: "Log Out",
            nav_view_complaints: "View Complaints",
            nav_new_complaint: "New Complaint",
            nav_support_chat: "Support Chat",
            nav_all_complaints: "All Complaints",

            // Marquee Banner
            marquee_welcome: "⚖️ WELCOME TO COURT COMPLAINT MANAGEMENT SYSTEM",

            // Home / Hero Section
            hero_badge: "⚖️ Ethiopia's #1 E-Justice Platform",
            hero_title_1: "Court Complaints,",
            hero_title_gold: "Resolved Online",
            hero_subtitle: "File, track, and manage legal complaints from anywhere — 100% digital, secure, and built for every citizen.",
            hero_btn_file: "File a Complaint Now →",
            hero_btn_learn: "Learn More →",
            hero_scroll: "Scroll",

            // Hero Localized Quick-Start Card
            entry_card_title: "Select Your Preferred Language to Begin",
            entry_card_desc: "Choose the language in which you wish to interact with the court and submit your complaint.",
            entry_card_lang_en: "English",
            entry_card_lang_en_sub: "Latin Script",
            entry_card_lang_am: "አማርኛ",
            entry_card_lang_am_sub: "Ge'ez Script (ግዕዝ)",
            entry_card_lang_om: "Afaan Oromoo",
            entry_card_lang_om_sub: "Qubee Afaan Oromoo",
            entry_card_active_notice: "Active Language:",

            // Hero Stats
            stat_roles_num: "5",
            stat_roles_label: "User Roles",
            stat_hours_num: "24/7",
            stat_hours_label: "Hours Online",
            stat_paperless_num: "100%",
            stat_paperless_label: "Paperless",

            // Gallery Section
            gallery_eyebrow: "⚖️ Justice System",
            gallery_heading_1: "Where Law Meets",
            gallery_heading_2: "Technology",
            gallery_sub: "Justice Connect bridges the gap between citizens and the legal system, making court access transparent and efficient for everyone.",
            gal_item_1: "🏛️ Grand Courtrooms",
            gal_item_2: "⚖️ Expert Judiciary",
            gal_item_3: "💻 Digital Filing",
            gal_item_4: "🗽 Symbol of Justice",
            gal_item_5: "👥 Legal Professionals",

            // Why Section
            why_eyebrow: "Why Choose Us",
            why_heading: "A Modern Platform For Accessible Justice",
            why_p: "The Court Complaint Management System (CCMS) is designed to replace confusing paperwork and long waiting times with a streamlined, transparent digital workflow. We provide citizens with a clean unified interface to manage all legal claims securely.",
            why_feat_1_title: "🚀 Swift & Paperless",
            why_feat_1_desc: "Submit complaints instantly from any web browser without ever visiting a courthouse in person.",
            why_feat_2_title: "🔒 Complete Security",
            why_feat_2_desc: "Enterprise-grade authentication ensures your sensitive case files and private data are completely safe.",
            why_feat_3_title: "📱 Real-Time Updates",
            why_feat_3_desc: "Get automated text and email alerts whenever your case status changes, no guessing required.",

            // CTA Section
            cta_title: "Ready to File Your Case?",
            cta_desc: "Join thousands of citizens using Justice Connect to access the legal system online with ease and confidence.",
            cta_btn_signin: "⚖️ Sign In Now",
            cta_btn_about: "Learn About the System",

            // Footer
            footer_brand_desc: "Ethiopia's premier Court Complaint Management System — making justice accessible, transparent, and efficient for every citizen.",
            footer_nav_title: "Navigation",
            footer_portals_title: "Portals",
            footer_portal_citizen: "Citizen Portal",
            footer_portal_clerk: "Clerk Portal",
            footer_portal_judge: "Judge Portal",
            footer_portal_admin: "Admin Portal",
            footer_rights: "© 2026 Justice Connect · Court Complaint Management System · All Rights Reserved",
            footer_badge_secure: "🔒 Secure",
            footer_badge_certified: "⚖️ Certified",
            footer_badge_online: "24/7 Online",

            // Dashboard
            dash_overview: "Overview",
            dash_system_overview: "System Overview",
            dash_registry_overview: "Registry Overview",
            dash_judicial_overview: "Judicial Overview",
            dash_my_caseload: "My Caseload",
            dash_registry_intake: "Registry Intake",
            dash_all_complaints_title: "All Complaints",
            dash_notifications: "Notifications",
            dash_no_notifications: "No new notifications",
            dash_filter_all_regions: "All Regions",
            dash_filter_all_cats: "All Categories",
            dash_filter_all_status: "All Statuses",
            dash_btn_new_complaint: "➕ File New Complaint",

            // WIZARD STRUCUTRE
            wizard_title: "Court Complaint Wizard",
            wizard_step_1_name: "1. Language",
            wizard_step_2_name: "2. Type",
            wizard_step_3_name: "3. Parties",
            wizard_step_4_name: "4. Narrative",
            wizard_step_5_name: "5. Evidence",
            wizard_step_6_name: "6. Payment",

            // Wizard Step 1: Language Selection
            wz_step1_heading: "Step 1: Choose Filing Language & Script",
            wz_step1_sub: "Select the language in which you will submit this court complaint. The chosen language enforces the appropriate writing script (Ge'ez or Latin) for all text fields.",
            wz_step1_lang_en_title: "English",
            wz_step1_lang_en_desc: "File in English using standard Latin alphabet.",
            wz_step1_lang_am_title: "አማርኛ (Amharic)",
            wz_step1_lang_am_desc: "በግዕዝ ፊደላት አቤቱታዎን ያቅርቡ። (Ge'ez Script enforced)",
            wz_step1_lang_om_title: "Afaan Oromoo",
            wz_step1_lang_om_desc: "Qubee Afaan Oromootiin galchaa. (Latin Qubee enforced)",
            wz_step1_notice: "⚠️ Official Filing Notice: You must enter subsequent names, addresses, and narrative descriptions in the selected language script.",

            // Wizard Step 2: Complaint Type
            wz_step2_heading: "Step 2: Complaint Type & Court Jurisdiction",
            wz_label_category: "Select Complaint Type / Category",
            wz_cat_placeholder: "Select Category",
            wz_cat_civil: "Civil",
            wz_cat_criminal: "Criminal",
            wz_cat_family: "Family",
            wz_cat_property: "Property",
            wz_cat_admin: "Administrative",
            wz_cat_other: "Other",
            wz_label_court_name: "Court Jurisdiction",
            wz_ph_court_name: "Name of Court (e.g. Supreme Court, High Court, Woreda Court)",
            wz_label_court_address: "Court Address",
            wz_ph_court_address: "Physical address of the court",
            wz_court_fees_info: "<strong>Court Fees Notice:</strong> According to court rules, filing requires the designated court fee. Low-income citizens may submit a certificate of indigency (poverty certificate) for fee exemption.",
            wz_label_case_num: "Case Number (if known)",
            wz_ph_case_num: "e.g. CV-2026-00123",
            wz_label_hearing_date: "Hearing Date (if scheduled)",

            // Wizard Step 3: Parties
            wz_step3_heading: "Step 3: Fill Party Details (Contact & Geography)",
            wz_label_complainant: "Complainant Details (You)",
            wz_label_respondent: "Respondent Details (Opposing Party)",
            wz_ph_name: "Full Name",
            wz_ph_resp_name: "Full Name or Organization",
            wz_ph_phone: "Phone Number",
            wz_ph_resp_phone: "Respondent Phone Number (Required)",
            wz_ph_resp_email: "Respondent Email (Optional)",
            wz_ph_country: "Country",
            wz_ph_region: "Select Region",
            wz_ph_woreda: "Woreda",
            wz_ph_kebele: "Kebele",
            wz_ph_address: "Physical Address...",
            wz_label_pref_lang: "Preferred Language",

            // Wizard Step 4: Narrative
            wz_step4_heading: "Step 4: Narrative Input & Details",
            wz_label_title: "Subject of Complaint (Max 100 chars)",
            wz_ph_title: "Brief summary of the legal issue",
            wz_label_desc: "Detailed Narration",
            wz_ph_desc: "Describe the incident, timeline, parties involved, damages suffered, and requested legal relief...",
            wz_narrative_script_reminder: "Active script constraint: ",

            // Wizard Step 5: Evidence
            wz_step5_heading: "Step 5: Evidence & Document Upload",
            wz_label_nid: "National ID Attachment (Required)",
            wz_nid_drop: "Drop National ID here or click to browse",
            wz_nid_req: "Required (PDF / Image)",
            wz_label_evidence: "Supporting Evidence (Optional)",
            wz_evidence_drop: "Drop supporting documents here (PDF, Images, etc.)",

            // Wizard Step 6: Payment
            wz_step6_heading: "Step 6: Court Fees & Payment",
            wz_radio_pay: "I will pay the required court fees",
            wz_radio_waiver: "Apply for Low Income Fee Waiver",
            wz_pay_method_instruction: "Choose a payment method to generate your order code:",
            wz_upload_receipt_req: "Upload Payment Receipt (Required)",
            wz_upload_cert_opt: "Low-Income Certificate (Required for waiver)",

            // Wizard Buttons
            btn_next: "Next →",
            btn_back: "← Back",
            btn_submit: "Submit Complaint →",

            // Validation Messages
            val_amharic_no_latin: "⚠️ Ge'ez Script Required: You selected Amharic. Latin/English letters are not allowed in this field.",
            val_amharic_require_geez: "⚠️ Ge'ez Script Required: Input must contain valid Ge'ez (Amharic) characters.",
            val_english_no_geez: "⚠️ Latin Script Required: You selected English. Ge'ez characters are not allowed in this field.",
            val_english_require_latin: "⚠️ Latin Script Required: Input must contain English (Latin) letters.",
            val_oromo_no_geez: "⚠️ Qubee Script Required: You selected Afaan Oromo. Ge'ez characters are not allowed.",
            val_oromo_require_latin: "⚠️ Qubee Script Required: Input must contain Latin letters (Qubee Afaan Oromoo).",
            val_field_required: "This field is required.",
            val_step_has_errors: "Please correct the language script errors highlighted in this step before proceeding.",

            // Auth Modal
            auth_portal_title: "⚖️ Access Your Portal",
            auth_portal_sub: "Manage cases and legal matters online",
            auth_tab_signin: "Sign In",
            auth_tab_register: "Register",
            auth_lbl_username: "Username or Email",
            auth_lbl_password: "Password",
            auth_btn_signin: "Sign In to Dashboard →",
            auth_btn_register: "Create Account →",
            auth_demo_title: "Demo Accounts"
        },

        am: {
            // General / Brand
            app_title: "ጀስቲስ ኮኔክት | የፍርድ ቤት አቤቱታ አስተዳደር ሥርዓት",
            brand_name: "ጀስቲስ ኮኔክት",
            brand_tagline: "የኢትዮጵያ ቀዳሚ የኢ-ፍትሕ መድረክ",

            // Navigation
            nav_home: "መነሻ",
            nav_why: "ለምን እኛን?",
            nav_about: "ስለ እኛ",
            nav_dashboard: "ዳሽቦርድ",
            nav_signin: "ግባ / ተመዝገብ →",
            nav_signin_short: "ግባ",
            nav_logout: "ውጣ",
            nav_view_complaints: "አቤቱታዎችን ይመልከቱ",
            nav_new_complaint: "አዲስ አቤቱታ",
            nav_support_chat: "የድጋፍ ውይይት",
            nav_all_complaints: "ሁሉም አቤቱታዎች",

            // Marquee Banner
            marquee_welcome: "⚖️ እንኳን ወደ ፍርድ ቤት አቤቱታ አስተዳደር ሥርዓት በደህና መጡ",

            // Home / Hero Section
            hero_badge: "⚖️ የኢትዮጵያ ቀዳሚ የኤሌክትሮኒክ ፍትሕ ሥርዓት",
            hero_title_1: "የፍርድ ቤት አቤቱታዎች፣",
            hero_title_gold: "በቀላሉ በኦንላይን",
            hero_subtitle: "የፍርድ ቤት አቤቱታዎችን ከየትኛውም ቦታ ሆነው ያቅርቡ፣ ይከታተሉ እንዲሁም ያስተዳድሩ — 100% ዲጂታል፣ አስተማማኝ እና ለሁሉም ዜጋ የቀረበ።",
            hero_btn_file: "አቤቱታዎን አሁን ያቅርቡ →",
            hero_btn_learn: "ተጨማሪ ያንብቡ →",
            hero_scroll: "ወደ ታች ይሸብልሉ",

            // Hero Localized Quick-Start Card
            entry_card_title: "ለመጀመር የመረጡትን ቋንቋ ይምረጡ",
            entry_card_desc: "ከፍርድ ቤቱ ጋር ለመገናኘት እና አቤቱታዎን ለማስገባት የሚፈልጉትን ቋንቋ ይምረጡ።",
            entry_card_lang_en: "English",
            entry_card_lang_en_sub: "Latin Script (እንግሊዝኛ)",
            entry_card_lang_am: "አማርኛ",
            entry_card_lang_am_sub: "በግዕዝ ፊደላት",
            entry_card_lang_om: "Afaan Oromoo",
            entry_card_lang_om_sub: "Qubee Afaan Oromoo (ኦሮምኛ)",
            entry_card_active_notice: "የተመረጠ ቋንቋ፡",

            // Hero Stats
            stat_roles_num: "5",
            stat_roles_label: "የተጠቃሚ ሚናዎች",
            stat_hours_num: "24/7",
            stat_hours_label: "ሰዓታት አገልግሎት",
            stat_paperless_num: "100%",
            stat_paperless_label: "ወረቀት አልባ",

            // Gallery Section
            gallery_eyebrow: "⚖️ የፍትሕ ሥርዓት",
            gallery_heading_1: "ሕግ ከዘመናዊ",
            gallery_heading_2: "ቴክኖሎጂ ጋር ሲገናኝ",
            gallery_sub: "ጀስቲስ ኮኔክት በዜጎች እና በፍትሕ ሥርዓቱ መካከል ያለውን ግንኙነት ያቀላጥፋል፤ የፍርድ ቤት አገልግሎትን ግልጽ እና ቀልጣፋ ያደርጋል።",
            gal_item_1: "🏛️ የችሎት አዳራሾች",
            gal_item_2: "⚖️ ከፍተኛ ዳኞች",
            gal_item_3: "💻 ዲጂታል አቤቱታ አቀራረብ",
            gal_item_4: "🗽 የፍትሕ ምልክት",
            gal_item_5: "👥 የሕግ ባለሙያዎች",

            // Why Section
            why_eyebrow: "ለምን እኛን ይመርጣሉ?",
            why_heading: "ለሁሉም ተደራሽ የሆነ ዘመናዊ የፍትሕ መድረክ",
            why_p: "የፍርድ ቤት አቤቱታ አስተዳደር ሥርዓት (CCMS) አሰልቺ የወረቀት ሥራዎችንና ረጅም ወረፋዎችን በቀላል፣ ግልጽ እና ዲጂታል አሠራር ለመተካት ታስቦ የተዘጋጀ ነው።",
            why_feat_1_title: "🚀 ፈጣንና ወረቀት አልባ",
            why_feat_1_desc: "በአካል ፍርድ ቤት መሄድ ሳያስፈልግዎ ከየትኛውም የድረ-ገጽ አሳሽ አቤቱታዎን ወዲያውኑ ያስገቡ።",
            why_feat_2_title: "🔒 የተሟላ ደህንነት",
            why_feat_2_desc: "የላቀ የደህንነት ሥርዓት ሚስጥራዊ የክስ ፋይሎችዎን እና የግል መረጃዎችዎን ሙሉ በሙሉ ይጠብቃል።",
            why_feat_3_title: "📱 ቅጽበታዊ ማሳወቂያዎች",
            why_feat_3_desc: "የክስዎ ሁኔታ በተለወጠ ቁጥር በስልክ አጭር የጽሑፍ መልእክት እና በኢሜይል ፈጣን ማሳወቂያ ይደርስዎታል።",

            // CTA Section
            cta_title: "አቤቱታዎን ለማቅረብ ዝግጁ ነዎት?",
            cta_desc: "ጀስቲስ ኮኔክትን በመጠቀም የፍርድ ቤት ጉዳያቸውን በቀላሉ እና በልበ ሙሉነት የሚያከናውኑ በሺዎች የሚቆጠሩ ዜጎችን ይቀላቀሉ።",
            cta_btn_signin: "⚖️ አሁኑኑ ይግቡ",
            cta_btn_about: "ስለ ሥርዓቱ ይወቁ",

            // Footer
            footer_brand_desc: "የኢትዮጵያ ቀዳሚ የፍርድ ቤት አቤቱታ አስተዳደር ሥርዓት — ፍትሕን ለሁሉም ዜጋ ተደራሽ፣ ግልጽ እና ቀልጣፋ ያደርጋል።",
            footer_nav_title: "ገጾች",
            footer_portals_title: "ፖርታሎች",
            footer_portal_citizen: "የዜጎች ፖርታል",
            footer_portal_clerk: "የሬጅስትራር ፖርታል",
            footer_portal_judge: "የዳኞች ፖርታል",
            footer_portal_admin: "የአስተዳዳሪ ፖርታል",
            footer_rights: "© 2026 ጀስቲስ ኮኔክት · የፍርድ ቤት አቤቱታ አስተዳደር ሥርዓት · መብቱ በሕግ የተጠበቀ ነው",
            footer_badge_secure: "🔒 አስተማማኝ",
            footer_badge_certified: "⚖️ ሕጋዊ",
            footer_badge_online: "24/7 ኦንላይን",

            // Dashboard
            dash_overview: "አጠቃላይ እይታ",
            dash_system_overview: "የሥርዓት አጠቃላይ እይታ",
            dash_registry_overview: "የሬጅስትሪ እይታ",
            dash_judicial_overview: "የዳኝነት እይታ",
            dash_my_caseload: "የእኔ የክስ መዝገቦች",
            dash_registry_intake: "የአቤቱታዎች መቀበያ",
            dash_all_complaints_title: "ሁሉም አቤቱታዎች",
            dash_notifications: "ማሳወቂያዎች",
            dash_no_notifications: "ምንም አዲስ ማሳወቂያ የለም",
            dash_filter_all_regions: "ሁሉም ክልሎች",
            dash_filter_all_cats: "ሁሉም ዘርፎች",
            dash_filter_all_status: "ሁሉም ሁኔታዎች",
            dash_btn_new_complaint: "➕ አዲስ አቤቱታ አስገባ",

            // WIZARD STRUCTURE
            wizard_title: "የፍርድ ቤት አቤቱታ ማቅረቢያ ቅጽ",
            wizard_step_1_name: "1. ቋንቋ",
            wizard_step_2_name: "2. ዓይነት",
            wizard_step_3_name: "3. ተከራካሪዎች",
            wizard_step_4_name: "4. ዝርዝር",
            wizard_step_5_name: "5. ማስረጃ",
            wizard_step_6_name: "6. ክፍያ",

            // Wizard Step 1: Language Selection
            wz_step1_heading: "ደረጃ 1፡ የአቤቱታ ማቅረቢያ ቋንቋ ይምረጡ",
            wz_step1_sub: "ይህንን የፍርድ ቤት አቤቱታ የሚያቀርቡበትን ቋንቋ ይምረጡ። የመረጡት ቋንቋ በቀጣይ ደረጃዎች ለሚሞሉ የጽሑፍ መስኮች ትክክለኛውን ፊደል (ግዕዝ ወይም ላቲን) ያስገድዳል።",
            wz_step1_lang_en_title: "English (እንግሊዝኛ)",
            wz_step1_lang_en_desc: "በላቲን ፊደላት በእንግሊዝኛ ያቅርቡ።",
            wz_step1_lang_am_title: "አማርኛ (Amharic)",
            wz_step1_lang_am_desc: "በግዕዝ ፊደላት አቤቱታዎን ያቅርቡ። (የግዕዝ ፊደላት ግዴታ ናቸው)",
            wz_step1_lang_om_title: "Afaan Oromoo (ኦሮምኛ)",
            wz_step1_lang_om_desc: "በቁቤ አፋን ኦሮሞ ያቅርቡ። (የቁቤ ፊደላት ግዴታ ናቸው)",
            wz_step1_notice: "⚠️ ይፋዊ ማስታወሻ፡ በመረጡት ቋንቋ መሠረት ቀጣዮቹን ስሞች፣ አድራሻዎችና የአቤቱታውን ዝርዝር ጽሑፎች በዚያው የፊደል ገበታ መጻፍ ይኖርብዎታል።",

            // Wizard Step 2: Complaint Type
            wz_step2_heading: "ደረጃ 2፡ የአቤቱታ ዓይነት እና የፍርድ ቤት ስልጣን",
            wz_label_category: "የአቤቱታውን ዓይነት ይምረጡ",
            wz_cat_placeholder: "ዓይነት ይምረጡ",
            wz_cat_civil: "ፍትሐብሔር (Civil)",
            wz_cat_criminal: "ወንጀል (Criminal)",
            wz_cat_family: "ቤተሰብ (Family)",
            wz_cat_property: "ንብረትና ይዞታ (Property)",
            wz_cat_admin: "አስተዳደራዊ (Administrative)",
            wz_cat_other: "ሌላ (Other)",
            wz_label_court_name: "የፍርድ ቤቱ ሥልጣን / ስም",
            wz_ph_court_name: "የፍርድ ቤቱ ስም (ለምሳሌ፡ ጠቅላይ ፍ/ቤት፣ ከፍተኛ ፍ/ቤት፣ ወረዳ ፍ/ቤት)",
            wz_label_court_address: "የፍርድ ቤቱ አድራሻ",
            wz_ph_court_address: "ፍርድ ቤቱ የሚገኝበት ትክክለኛ አድራሻ",
            wz_court_fees_info: "<strong>የፍርድ ቤት ክፍያ ማስታወሻ፡</strong> በፍርድ ቤት ደንብ መሠረት አቤቱታ ለማስገባት የተወሰነውን ክፍያ መክፈል ይኖርብዎታል። ዝቅተኛ ገቢ ያላቸው ዜጎች ከክፍያ ነጻ ለመስተናገድ የድህነት ማረጋገጫ ምስክር ወረቀት ማቅረብ ይችላሉ።",
            wz_label_case_num: "የመዝገብ ቁጥር (የሚታወቅ ከሆነ)",
            wz_ph_case_num: "ምሳሌ፡ CV-2026-00123",
            wz_label_hearing_date: "የቀጠሮ ቀን (የተያዘ ከሆነ)",

            // Wizard Step 3: Parties
            wz_step3_heading: "ደረጃ 3፡ የተከራካሪ ወገኖች ዝርዝር መረጃ",
            wz_label_complainant: "የአመልካች መረጃ (የእርስዎ)",
            wz_label_respondent: "የተጠሪ / የተከሳሽ መረጃ (ተቃራኒ ወገን)",
            wz_ph_name: "ሙሉ ስም",
            wz_ph_resp_name: "የተጠሪ ሙሉ ስም ወይም ድርጅት",
            wz_ph_phone: "ስልክ ቁጥር",
            wz_ph_resp_phone: "የተጠሪ ስልክ ቁጥር (ግዴታ)",
            wz_ph_resp_email: "የተጠሪ ኢሜይል (አማራጭ)",
            wz_ph_country: "ሀገር",
            wz_ph_region: "ክልል ይምረጡ",
            wz_ph_woreda: "ወረዳ",
            wz_ph_kebele: "ቀበሌ",
            wz_ph_address: "ትክክለኛ የመኖሪያ አድራሻ...",
            wz_label_pref_lang: "ተመራጭ ቋንቋ",

            // Wizard Step 4: Narrative
            wz_step4_heading: "ደረጃ 4፡ የአቤቱታው ርዕስ እና ዝርዝር ማብራሪያ",
            wz_label_title: "የአቤቱታው አጭር ርዕስ (ቢበዛ 100 ፊደላት)",
            wz_ph_title: "የጉዳዩ አጭር ማጠቃለያ",
            wz_label_desc: "ዝርዝር ማብራሪያ",
            wz_ph_desc: "ጉዳዩ እንዴት እንደተከሰተ፣ የጊዜ ቅደም ተከተል፣ የተሳተፉ ወገኖች፣ የደረሰብዎ ጉዳት እና የሚጠይቁትን የሕግ ውሳኔ በዝርዝር ይግለጹ...",
            wz_narrative_script_reminder: "የተመረጠ የፊደል ገበታ ገደብ፡ ",

            // Wizard Step 5: Evidence
            wz_step5_heading: "ደረጃ 5፡ የሰነድና ማስረጃ ማስገቢያ",
            wz_label_nid: "ብሔራዊ መታወቂያ (ግዴታ)",
            wz_nid_drop: "ብሔራዊ መታወቂያዎን እዚህ ይጎትቱ ወይም ይጫኑ",
            wz_nid_req: "ግዴታ (PDF / ምስል)",
            wz_label_evidence: "ተጨማሪ ማስረጃዎች (አማራጭ)",
            wz_evidence_drop: "ማስረጃ ሰነዶችን እዚህ ይጎትቱ ወይም ይጫኑ",

            // Wizard Step 6: Payment
            wz_step6_heading: "ደረጃ 6፡ የፍርድ ቤት ክፍያ ማረጋገጫ",
            wz_radio_pay: "የፍርድ ቤት ክፍያ እከፍላለሁ",
            wz_radio_waiver: "የዝቅተኛ ገቢ ክፍያ ነጻ ማመልከቻ",
            wz_pay_method_instruction: "የትዕዛዝ ቁጥር ለማመንጨት የክፍያ ዘዴ ይምረጡ፡",
            wz_upload_receipt_req: "የክፍያ ደረሰኝ ያስገቡ (ግዴታ)",
            wz_upload_cert_opt: "የድህነት ማረጋገጫ ምስክር ወረቀት (ለነጻ አገልግሎት)",

            // Wizard Buttons
            btn_next: "ቀጣይ →",
            btn_back: "← ተመለስ",
            btn_submit: "አቤቱታውን አስገባ →",

            // Validation Messages
            val_amharic_no_latin: "⚠️ የግዕዝ ፊደላት ግዴታ ናቸው፡ አማርኛ ቋንቋ መርጠዋል። በዚህ መስክ የላቲን (እንግሊዝኛ) ፊደላት መጠቀም አይፈቀድም።",
            val_amharic_require_geez: "⚠️ የግዕዝ ፊደላት ግዴታ ናቸው፡ የገባው ጽሑፍ ቢያንስ አንድ የግዕዝ (አማርኛ) ፊደል ማካተት አለበት።",
            val_english_no_geez: "⚠️ የላቲን ፊደላት ግዴታ ናቸው፡ እንግሊዝኛ መርጠዋል። የግዕዝ ፊደላት በዚህ መስክ አይፈቀዱም።",
            val_english_require_latin: "⚠️ የላቲን ፊደላት ግዴታ ናቸው፡ የገባው ጽሑፍ የእንግሊዝኛ (ላቲን) ፊደላትን ማካተት አለበት።",
            val_oromo_no_geez: "⚠️ የቁቤ ፊደላት ግዴታ ናቸው፡ አፋን ኦሮሞ መርጠዋል። የግዕዝ ፊደላት መጠቀም አይፈቀድም።",
            val_oromo_require_latin: "⚠️ የቁቤ ፊደላት ግዴታ ናቸው፡ ጽሑፉ የቁቤ አፋን ኦሮሞ ፊደላትን ማካተት አለበት።",
            val_field_required: "ይህ መስክ መሞላት አለበት።",
            val_step_has_errors: "እባክዎ ከመቀጠልዎ በፊት በዚህ ደረጃ ያሉትን የቋንቋ ፊደል ስህተቶች ያስተካክሉ።",

            // Auth Modal
            auth_portal_title: "⚖️ ወደ ፖርታልዎ ይግቡ",
            auth_portal_sub: "የክስ ጉዳዮችን በኦንላይን ያስተዳድሩ",
            auth_tab_signin: "ግባ",
            auth_tab_register: "ተመዝገብ",
            auth_lbl_username: "የተጠቃሚ ስም ወይም ኢሜይል",
            auth_lbl_password: "የይለፍ ቃል",
            auth_btn_signin: "ወደ ዳሽቦርድ ግባ →",
            auth_btn_register: "አካውንት ፍጠር →",
            auth_demo_title: "የሙከራ አካውንቶች"
        },

        om: {
            // General / Brand
            app_title: "Justice Connect | Sirna Bulchiinsa Kominikeeshinii Mana Murtii",
            brand_name: "Justice Connect",
            brand_tagline: "Waltaa E-Justice Dursa Qabu Itoophiyaa",

            // Navigation
            nav_home: "Fuula Duraa",
            nav_why: "Maaliif Nu Filatu?",
            nav_about: "Waa'ee Keenya",
            nav_dashboard: "Daashboordii",
            nav_signin: "Seenaa / Galmaa'aa →",
            nav_signin_short: "Seenaa",
            nav_logout: "Ba'aa",
            nav_view_complaints: "Kominikeeshinoota Ilaali",
            nav_new_complaint: "Kominikeeshinii Haaraa",
            nav_support_chat: "Gargaarsa / Marii",
            nav_all_complaints: "Kominikeeshinoota Hunda",

            // Marquee Banner
            marquee_welcome: "⚖️ BAGA GARA SIRNA BULCHIINSA KOMINIKEESHINII MANA MURTIITTI NAGAYAN DHUFTAN",

            // Home / Hero Section
            hero_badge: "⚖️ Platformii E-Justice Lakk. 1 Itoophiyaa",
            hero_title_1: "Kominikeeshiniiwwan Mana Murtii,",
            hero_title_gold: "Online Qulqullinaan Furama",
            hero_subtitle: "Kominikeeshinii seeraa bakka kamiyyuu ta'anii galchaa, hordofaa, bulchaa — 100% dijitaala, amansiisaa fi lammilee hundaaf qophaa'e.",
            hero_btn_file: "Kominikeeshinii Galchaa →",
            hero_btn_learn: "Dabalata Dubbisaa →",
            hero_scroll: "Gadi Siqsaa",

            // Hero Localized Quick-Start Card
            entry_card_title: "Jalqabuuf Afaan Filattan Filadhaa",
            entry_card_desc: "Afaan mana murtii waliin ittiin haasa'uu fi kominikeeshinii keessan dhiyeessuu barbaaddan filadhaa.",
            entry_card_lang_en: "English",
            entry_card_lang_en_sub: "Latin Script (Ingiliffa)",
            entry_card_lang_am: "አማርኛ",
            entry_card_lang_am_sub: "Qubee Ge'ez (Amaariffa)",
            entry_card_lang_om: "Afaan Oromoo",
            entry_card_lang_om_sub: "Qubee Afaan Oromoo",
            entry_card_active_notice: "Afaan Filatame:",

            // Hero Stats
            stat_roles_num: "5",
            stat_roles_label: "Gahee Fayyadamtootaa",
            stat_hours_num: "24/7",
            stat_hours_label: "Tajaajila Sa'aatii",
            stat_paperless_num: "100%",
            stat_paperless_label: "Waraqaa Malee",

            // Gallery Section
            gallery_eyebrow: "⚖️ Sirna Haqaa",
            gallery_heading_1: "Seerri fi Teeknooloojiin",
            gallery_heading_2: "Yeroo Walqunnaman",
            gallery_sub: "Justice Connect lammilee fi sirna haqaa walqunnamsiisuun tajaajilli mana murtii ifa fi saffisaa akka ta'u taasisa.",
            gal_item_1: "🏛️ Galma Dhaddachaa",
            gal_item_2: "⚖️ Abbootii Seeraa",
            gal_item_3: "💻 Galmee Dijitaalaa",
            gal_item_4: "🗽 Mallattoo Haqaa",
            gal_item_5: "👥 Ogeessota Seeraa",

            // Why Section
            why_eyebrow: "Maaliif Nu Filattu?",
            why_heading: "Haqaa Hundumaaf Dhaqqabamaa Ta'eef Waltajjii Ammayyaa",
            why_p: "Sirni Bulchiinsa Kominikeeshinii Mana Murtii (CCMS) hojii waraqaa walxaxaa fi dhiibbaa tursiisaa hambisuudhaan hojimaata dijitaalaa qulqulluu fi ifa ta'een bakka buusuuf qophaa'e.",
            why_feat_1_title: "🚀 Saffisaa fi Waraqaa Malee",
            why_feat_1_desc: "Qaamaan mana murtii osoo hin deemin weebsaayitii kamirraayyuu battalumatti kominikeeshinii dhiyeessaa.",
            why_feat_2_title: "🔒 Nageenya Guutuu",
            why_feat_2_desc: "Sirni nageenya ammayyaa faayiloota himannaa fi ragaalee keessan eeggumsa cimaa kennuun eega.",
            why_feat_3_title: "📱 Beeksisa Battalaa",
            why_feat_3_desc: "Haalli dhimma keessanii yeroo jijjiiramu ergaa gabaabaa bilbilaa fi e-meeliin beeksisa battalaa argadhaa.",

            // CTA Section
            cta_title: "Kominikeeshinii Keessan Dhiyeessuuf Qophiidhaa?",
            cta_desc: "Lammiilee kumaatamaan lakkaa'aman Justice Connect fayyadamuun dhimma seeraa isaanii salphaatti fi of-ittoo ta'anii raawwatanitti makamaa.",
            cta_btn_signin: "⚖️ Amma Seenaa",
            cta_btn_about: "Waa'ee Sirnichaa Baraa",

            // Footer
            footer_brand_desc: "Sirna Bulchiinsa Kominikeeshinii Mana Murtii Itoophiyaa isa duraa — haqni lammiilee hundaaf dhaqqabamaa, ifa fi saffisaa akka ta'u taasisa.",
            footer_nav_title: "Kallattii",
            footer_portals_title: "Balbaloota",
            footer_portal_citizen: "Balbala Lammiilee",
            footer_portal_clerk: "Balbala Reejistiraaraa",
            footer_portal_judge: "Balbala Abbaa Seeraa",
            footer_portal_admin: "Balbala Bulchaa",
            footer_rights: "© 2026 Justice Connect · Sirna Bulchiinsa Kominikeeshinii Mana Murtii · Mirgi Hundi Seeraan Kan Eegame",
            footer_badge_secure: "🔒 Amansiisaa",
            footer_badge_certified: "⚖️ Seera Qabeessa",
            footer_badge_online: "24/7 Online",

            // Dashboard
            dash_overview: "Waliigala",
            dash_system_overview: "Waliigala Sirnichaa",
            dash_registry_overview: "Waliigala Reejistirii",
            dash_judicial_overview: "Waliigala Abbaa Seeraa",
            dash_my_caseload: "Dhimmoota Kiyya",
            dash_registry_intake: "Fudhannaa Himannaa",
            dash_all_complaints_title: "Kominikeeshinoota Hunda",
            dash_notifications: "Beeksisa",
            dash_no_notifications: "Beeksisni haaraan hin jiru",
            dash_filter_all_regions: "Naannolee Hunda",
            dash_filter_all_cats: "Gosa Hunda",
            dash_filter_all_status: "Haala Hunda",
            dash_btn_new_complaint: "➕ Kominikeeshinii Haaraa Galchaa",

            // WIZARD STRUCTURE
            wizard_title: "Adeemsa Kominikeeshinii Mana Murtii",
            wizard_step_1_name: "1. Afaan",
            wizard_step_2_name: "2. Gosa",
            wizard_step_3_name: "3. Qaamolee",
            wizard_step_4_name: "4. Ibsa",
            wizard_step_5_name: "5. Ragaa",
            wizard_step_6_name: "6. Kaffaltii",

            // Wizard Step 1: Language Selection
            wz_step1_heading: "Sadarkaa 1: Afaan Kominikeeshinii Filadhaa",
            wz_step1_sub: "Afaan kominikeeshinii mana murtii ittiin dhiyeessuu barbaaddan filadhaa. Afaan filatame kun sadarkaalee itti aananiif qubee barreeffamaa (Qubee ykn Ge'ez) dirqisiisa.",
            wz_step1_lang_en_title: "English (Ingiliffa)",
            wz_step1_lang_en_desc: "Qubee Laatiiniitiin Ingiliffaan galchaa.",
            wz_step1_lang_am_title: "አማርኛ (Amaariffa)",
            wz_step1_lang_am_desc: "Qubee Ge'eziitiin dhiyeessaa. (Qubee Ge'ez dirqisiisa)",
            wz_step1_lang_om_title: "Afaan Oromoo",
            wz_step1_lang_om_desc: "Qubee Afaan Oromootiin galchaa. (Qubee Afaan Oromoo dirqisiisa)",
            wz_step1_notice: "⚠️ Hubachiisa Seeraa: Maqaalee, teessoowwanii fi ibsa himannaa sadarkaalee itti aanan keessatti qubee afaan filatameetiin qofa barreessuu qabdu.",

            // Wizard Step 2: Complaint Type
            wz_step2_heading: "Sadarkaa 2: Gosa Himannaa & Aangoo Mana Murtii",
            wz_label_category: "Gosa Kominikeeshinii Filadhaa",
            wz_cat_placeholder: "Gosa Filadhaa",
            wz_cat_civil: "Hariiroo Hawaasaa (Civil)",
            wz_cat_criminal: "Yakka (Criminal)",
            wz_cat_family: "Maatii (Family)",
            wz_cat_property: "Qabeenya (Property)",
            wz_cat_admin: "Bulchiinsaa (Administrative)",
            wz_cat_other: "Kan Biraa (Other)",
            wz_label_court_name: "Aangoo Mana Murtii",
            wz_ph_court_name: "Maqaa Mana Murtii (Fkn. Mana Murtii Waliigalaa, Olaanaa, Aanaa)",
            wz_label_court_address: "Teessoo Mana Murtii",
            wz_ph_court_address: "Teessoo qabatamaa mana murtii",
            wz_court_fees_info: "<strong>Hubachiisa Kaffaltii Mana Murtii:</strong> Akka dambii mana murtiitti himannaa dhiyeessuuf kaffaltiin ni barbaachisa. Lammiileen galii gadi aanaa qaban waraqaa ragaa hiyyummaa dhiyeessuun kaffaltii irraa bilisa ta'uu danda'u.",
            wz_label_case_num: "Lakk. Galmee (Yoo beekame)",
            wz_ph_case_num: "Fkn: CV-2026-00123",
            wz_label_hearing_date: "Guyyaa Dhaddachaa (Yoo qabame)",

            // Wizard Step 3: Parties
            wz_step3_heading: "Sadarkaa 3: Odeeffannoo Qaamolee Himannaa",
            wz_label_complainant: "Odeeffannoo Himataa (Kan Keessan)",
            wz_label_respondent: "Odeeffannoo Himatamaa (Qaama Mormituu)",
            wz_ph_name: "Maqaa Guutuu",
            wz_ph_resp_name: "Maqaa Guutuu Himatamaa ykn Dhaabbata",
            wz_ph_phone: "Lakk. Bilbilaa",
            wz_ph_resp_phone: "Bilbila Himatamaa (Dirqama)",
            wz_ph_resp_email: "E-meelii Himatamaa (Dirqama Miti)",
            wz_ph_country: "Biyya",
            wz_ph_region: "Naannoo Filadhaa",
            wz_ph_woreda: "Aanaa",
            wz_ph_kebele: "Ganda",
            wz_ph_address: "Teessoo Qabatamaa...",
            wz_label_pref_lang: "Afaan Filatamaa",

            // Wizard Step 4: Narrative
            wz_step4_heading: "Sadarkaa 4: Mata Duree & Ibsa Himannaa",
            wz_label_title: "Mata Duree Kominikeeshinii (Hamma qubee 100)",
            wz_ph_title: "Cuunfaa gabaabaa dhimma seeraa",
            wz_label_desc: "Ibsa Guutuu Himannaa",
            wz_ph_desc: "Ta'umsi akkamitti akka raawwatame, yeroo, qaamolee hirmaatan, miidhaa qaqqabee fi murtii barbaaddan bal'inaan ibsaa...",
            wz_narrative_script_reminder: "Daangaa qubee afaanii: ",

            // Wizard Step 5: Evidence
            wz_step5_heading: "Sadarkaa 5: Waraqaa Eenyummaa fi Ragaalee",
            wz_label_nid: "Waraqaa Eenyummaa Biyyooleessaa (Dirqama)",
            wz_nid_drop: "Waraqaa eenyummaa asitti dhiisaa ykn filadhaa",
            wz_nid_req: "Dirqama (PDF / Suuraa)",
            wz_label_evidence: "Ragaalee Dabalataa (Dirqama Miti)",
            wz_evidence_drop: "Ragaalee dabalataa asitti dhiisaa (PDF, Suuraa, kkf)",

            // Wizard Step 6: Payment
            wz_step6_heading: "Sadarkaa 6: Kaffaltii Mana Murtii",
            wz_radio_pay: "Kaffaltii mana murtii barbaachisu nan kaffala",
            wz_radio_waiver: "Kaffaltii irraa bilisa ta'uuf nan iyyadha",
            wz_pay_method_instruction: "Koodii ajajaa argachuuf mala kaffaltii filadhaa:",
            wz_upload_receipt_req: "Nagahee Kaffaltii Galchaa (Dirqama)",
            wz_upload_cert_opt: "Waraqaa Ragaa Hiyyummaa (Bilisa ta'uuf)",

            // Wizard Buttons
            btn_next: "Itti Fufi →",
            btn_back: "← Duubatti",
            btn_submit: "Kominikeeshinii Galchaa →",

            // Validation Messages
            val_amharic_no_latin: "⚠️ Qubee Ge'ez Barbaachisa: Afaan Amaaraa filattaniittu. Qubee Laatiin fayyadamuun hin danda'amu.",
            val_amharic_require_geez: "⚠️ Qubee Ge'ez Barbaachisa: Barreeffamni yoo xiqqaate qubee Ge'ez tokko qabaachuu qaba.",
            val_english_no_geez: "⚠️ Qubee Laatiin Barbaachisa: Afaan Ingiliffaa filattaniittu. Qubee Ge'ez fayyadamuun hin danda'amu.",
            val_english_require_latin: "⚠️ Qubee Laatiin Barbaachisa: Barreeffamni qubee Ingiliffaa (Laatiin) qabaachuu qaba.",
            val_oromo_no_geez: "⚠️ Qubee Afaan Oromoo Barbaachisa: Afaan Oromoo filattaniittu. Qubee Ge'ez fayyadamuun hin eyyamamu.",
            val_oromo_require_latin: "⚠️ Qubee Afaan Oromoo Barbaachisa: Barreeffamni Qubee Afaan Oromoo qabaachuu qaba.",
            val_field_required: "Bakki kun guutamuu qaba.",
            val_step_has_errors: "Maaloo osoo hin darbin dura dogoggora qubee afaanii sadarkaa kana keessaa sirreessaa.",

            // Auth Modal
            auth_portal_title: "⚖️ Gara Balbala Keessaniitti Seenaa",
            auth_portal_sub: "Dhimmoota seeraa fi himannaa toora interneetiin bulchaa",
            auth_tab_signin: "Seenaa",
            auth_tab_register: "Galmaa'aa",
            auth_lbl_username: "Maqaa Fayyadamaa ykn E-meelii",
            auth_lbl_password: "Jecha Icchiitii",
            auth_btn_signin: "Gara Daashboordiitti Seenaa →",
            auth_btn_register: "Herrega Haaraa Uumaa →",
            auth_demo_title: "Herregoota Yaalii"
        }
    };

    // 3. i18n Core State Manager
    const i18n = {
        SUPPORTED_LANGUAGES,
        DEFAULT_LANGUAGE,

        // Subscribers for language changes
        _subscribers: [],

        /**
         * Subscribe to language change events
         * @param {Function} callback (language: string) => void
         */
        subscribe(callback) {
            if (typeof callback === 'function') {
                this._subscribers.push(callback);
            }
        },

        /**
         * Unsubscribe from language changes
         */
        unsubscribe(callback) {
            this._subscribers = this._subscribers.filter(fn => fn !== callback);
        },

        /**
         * Get currently active language
         * @returns {string} 'en', 'am', or 'om'
         */
        getLanguage() {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
                    return stored;
                }
            } catch (e) {
                console.warn('i18n: localStorage not accessible, using default');
            }
            return DEFAULT_LANGUAGE;
        },

        /**
         * Set language globally, update DOM, and notify all subscribers
         * @param {string} lang 'en', 'am', or 'om'
         */
        setLanguage(lang) {
            if (!SUPPORTED_LANGUAGES.includes(lang)) {
                console.warn(`i18n: Unsupported language '${lang}'. Falling back to '${DEFAULT_LANGUAGE}'`);
                lang = DEFAULT_LANGUAGE;
            }

            try {
                localStorage.setItem(STORAGE_KEY, lang);
            } catch (e) {
                console.warn('i18n: Failed to persist language to localStorage');
            }

            document.documentElement.lang = lang;
            document.documentElement.setAttribute('data-current-lang', lang);

            // Apply translations to the whole page
            this.applyTranslations(lang);

            // Synchronize all UI language selectors/dropdowns
            this.syncSelectors(lang);

            // Notify subscribers
            this._subscribers.forEach(fn => {
                try {
                    fn(lang);
                } catch (err) {
                    console.error('i18n subscriber error:', err);
                }
            });

            // Dispatch global CustomEvent
            window.dispatchEvent(new CustomEvent('languagechange', {
                detail: { language: lang }
            }));
            window.dispatchEvent(new CustomEvent('app:languagechange', {
                detail: { language: lang }
            }));
        },

        /**
         * Get translation string by key
         * @param {string} key
         * @param {string} fallback
         * @returns {string}
         */
        t(key, fallback = '') {
            const lang = this.getLanguage();
            if (translations[lang] && translations[lang][key] !== undefined) {
                return translations[lang][key];
            }
            if (translations[DEFAULT_LANGUAGE] && translations[DEFAULT_LANGUAGE][key] !== undefined) {
                return translations[DEFAULT_LANGUAGE][key];
            }
            return fallback || key;
        },

        /**
         * Scan DOM and apply translations to elements with data-i18n attributes
         * @param {string} [lang]
         */
        applyTranslations(lang) {
            lang = lang || this.getLanguage();
            const dict = translations[lang] || translations[DEFAULT_LANGUAGE];

            // 1. Text / HTML content
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (dict[key] !== undefined) {
                    if (el.hasAttribute('data-i18n-html')) {
                        el.innerHTML = dict[key];
                    } else {
                        el.textContent = dict[key];
                    }
                }
            });

            // 2. Placeholders
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (dict[key] !== undefined) {
                    el.placeholder = dict[key];
                }
            });

            // 3. Titles / tooltips
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                if (dict[key] !== undefined) {
                    el.title = dict[key];
                }
            });

            // 4. Aria labels
            document.querySelectorAll('[data-i18n-aria]').forEach(el => {
                const key = el.getAttribute('data-i18n-aria');
                if (dict[key] !== undefined) {
                    el.setAttribute('aria-label', dict[key]);
                }
            });
        },

        /**
         * Synchronize any <select class="lang-dropdown"> or custom buttons across DOM
         * @param {string} lang
         */
        syncSelectors(lang) {
            // Dropdowns
            document.querySelectorAll('.app-lang-select, select[name="app_lang"], #global-lang-selector').forEach(sel => {
                if (sel.value !== lang) {
                    sel.value = lang;
                }
            });

            // Interactive Language Cards or Pill Buttons
            document.querySelectorAll('[data-lang-btn]').forEach(btn => {
                const btnLang = btn.getAttribute('data-lang-btn');
                if (btnLang === lang) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Wizard Step 1 radio / cards
            document.querySelectorAll('input[name="wizard_filing_lang"]').forEach(radio => {
                radio.checked = (radio.value === lang);
                const card = radio.closest('.wizard-lang-card');
                if (card) {
                    if (radio.checked) {
                        card.classList.add('selected');
                    } else {
                        card.classList.remove('selected');
                    }
                }
            });
        },

        // 4. Script & Form Validation Engine
        validator: {
            GEEZ_REGEX,
            LATIN_REGEX,

            /**
             * Validate a text string against the required language script rules
             * @param {string} text The user's input string
             * @param {string} lang 'am', 'om', or 'en'
             * @returns {{ valid: boolean, error: string | null }}
             */
            validateScript(text, lang) {
                if (!text || typeof text !== 'string') {
                    return { valid: true, error: null };
                }

                const trimmed = text.trim();
                if (trimmed.length === 0) {
                    return { valid: true, error: null };
                }

                const hasGeez = GEEZ_REGEX.test(trimmed);
                const hasLatin = LATIN_REGEX.test(trimmed);

                // --- AMHARIC (am): Ge'ez script strictly enforced ---
                if (lang === 'am' || lang === 'Amharic') {
                    // Must not contain Latin alphabet
                    if (hasLatin) {
                        return {
                            valid: false,
                            error: i18n.t('val_amharic_no_latin', "⚠️ Ge'ez Script Required: Latin characters are not allowed for Amharic.")
                        };
                    }
                    // Must contain at least one Ge'ez character
                    if (!hasGeez) {
                        return {
                            valid: false,
                            error: i18n.t('val_amharic_require_geez', "⚠️ Ge'ez Script Required: Input must contain valid Ge'ez (Amharic) characters.")
                        };
                    }
                    return { valid: true, error: null };
                }

                // --- AFAAN OROMO (om): Latin Qubee strictly enforced ---
                if (lang === 'om' || lang === 'Oromic' || lang === 'Afaan Oromo') {
                    // Must not contain Ge'ez script
                    if (hasGeez) {
                        return {
                            valid: false,
                            error: i18n.t('val_oromo_no_geez', "⚠️ Qubee Script Required: Ge'ez characters are not allowed for Afaan Oromo.")
                        };
                    }
                    // Must contain at least one Latin letter
                    if (!hasLatin) {
                        return {
                            valid: false,
                            error: i18n.t('val_oromo_require_latin', "⚠️ Qubee Script Required: Input must contain Latin letters (Qubee Afaan Oromoo).")
                        };
                    }
                    return { valid: true, error: null };
                }

                // --- ENGLISH (en): Latin alphabet strictly enforced ---
                if (lang === 'en' || lang === 'English') {
                    // Must not contain Ge'ez script
                    if (hasGeez) {
                        return {
                            valid: false,
                            error: i18n.t('val_english_no_geez', "⚠️ Latin Script Required: Ge'ez characters are not allowed for English.")
                        };
                    }
                    // Must contain at least one Latin letter
                    if (!hasLatin) {
                        return {
                            valid: false,
                            error: i18n.t('val_english_require_latin', "⚠️ Latin Script Required: Input must contain English (Latin) letters.")
                        };
                    }
                    return { valid: true, error: null };
                }

                return { valid: true, error: null };
            },

            /**
             * Validate an input DOM element and display/remove inline error feedback
             * @param {HTMLInputElement|HTMLTextAreaElement} inputEl
             * @param {string} [lang]
             * @returns {boolean} isValid
             */
            validateInput(inputEl, lang) {
                if (!inputEl) return true;
                lang = lang || i18n.getLanguage();

                // If input is not marked for language validation, skip
                if (!inputEl.hasAttribute('data-lang-validate') && !inputEl.classList.contains('lang-validate')) {
                    return true;
                }

                const value = inputEl.value || '';
                const result = this.validateScript(value, lang);

                // Find or create feedback container
                let errorBadge = inputEl.parentElement.querySelector('.lang-validation-msg');
                if (!errorBadge) {
                    errorBadge = document.createElement('div');
                    errorBadge.className = 'lang-validation-msg';
                    errorBadge.style.cssText = 'color:#dc2626; font-size:0.78rem; font-weight:600; margin-top:0.35rem; display:none; align-items:center; gap:0.35rem;';
                    inputEl.parentElement.appendChild(errorBadge);
                }

                if (!result.valid) {
                    inputEl.classList.add('input-lang-error');
                    inputEl.classList.remove('input-lang-valid');
                    errorBadge.textContent = result.error;
                    errorBadge.style.display = 'flex';
                    inputEl.setCustomValidity(result.error);
                    return false;
                } else {
                    inputEl.classList.remove('input-lang-error');
                    if (value.trim().length > 0) {
                        inputEl.classList.add('input-lang-valid');
                    } else {
                        inputEl.classList.remove('input-lang-valid');
                    }
                    errorBadge.textContent = '';
                    errorBadge.style.display = 'none';
                    inputEl.setCustomValidity('');
                    return true;
                }
            },

            /**
             * Validate all marked inputs inside a container (e.g. wizard step)
             * @param {HTMLElement|string} container
             * @param {string} [lang]
             * @returns {{ isValid: boolean, firstInvalid: HTMLElement | null, error: string | null }}
             */
            validateContainer(container, lang) {
                lang = lang || i18n.getLanguage();
                const parent = typeof container === 'string' ? document.querySelector(container) : container;
                if (!parent) return { isValid: true, firstInvalid: null, error: null };

                const inputs = parent.querySelectorAll('input[data-lang-validate="true"], textarea[data-lang-validate="true"], .lang-validate');
                let isValid = true;
                let firstInvalid = null;
                let firstError = null;

                inputs.forEach(input => {
                    const valid = this.validateInput(input, lang);
                    if (!valid && isValid) {
                        isValid = false;
                        firstInvalid = input;
                        const msg = input.parentElement.querySelector('.lang-validation-msg');
                        firstError = msg ? msg.textContent : i18n.t('val_step_has_errors');
                    }
                });

                return { isValid, firstInvalid, error: firstError };
            },

            /**
             * Attach automatic real-time validation to inputs
             */
            attachRealtimeListeners() {
                const inputs = document.querySelectorAll('input[data-lang-validate="true"], textarea[data-lang-validate="true"], .lang-validate');
                inputs.forEach(input => {
                    input.addEventListener('input', () => {
                        this.validateInput(input);
                    });
                    input.addEventListener('blur', () => {
                        this.validateInput(input);
                    });
                });
            }
        },

        /**
         * Initialize i18n on DOM ready
         */
        init() {
            const currentLang = this.getLanguage();
            this.setLanguage(currentLang);

            // Re-apply on dynamic DOM ready
            document.addEventListener('DOMContentLoaded', () => {
                this.applyTranslations(this.getLanguage());
                this.syncSelectors(this.getLanguage());
                this.validator.attachRealtimeListeners();
            });

            // Re-validate fields when language changes
            this.subscribe((newLang) => {
                document.querySelectorAll('input[data-lang-validate="true"], textarea[data-lang-validate="true"], .lang-validate').forEach(input => {
                    if (input.value && input.value.trim().length > 0) {
                        this.validator.validateInput(input, newLang);
                    }
                });
            });
        }
    };

    // Expose to window global scope
    window.i18n = i18n;
    window.t = i18n.t.bind(i18n);
    window.LanguageValidator = i18n.validator;

    // Auto initialize immediately
    i18n.init();

})();
