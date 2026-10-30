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
        // --- Reusable Language Step & Actor Flow Keys ---
        lang_step_title: "Step 1: Select Language & Legal Jurisdiction",
        lang_step_desc: "Choose the primary language for this legal submission. Subsequent statements, arguments, and pleadings must strictly adhere to the chosen script.",
        lang_step_btn_next: "Proceed with Selected Language →",
        lang_rule_amharic: "Ge'ez script (ሀ–ፐ) required for Amharic inputs",
        lang_rule_latin: "Latin script (A–Z) required for English & Afaan Oromo inputs",
        lang_badge_actor: "Mandatory Step",
        val_script_error_title: "Language Script Mismatch",
        val_step_has_errors: "Please correct language script errors before proceeding.",

        // --- Respondent Portal Keys ---
        resp_portal_title: "Respondent Portal — CCMS",
        resp_nav_overview: "Overview",
        resp_nav_cases: "My Cases",
        resp_nav_notifications: "Notifications",
        resp_welcome: "Welcome back",
        resp_summary: "Here is a summary of your active legal proceedings",
        resp_stat_total: "Total Cases",
        resp_stat_pending: "Pending Response",
        resp_stat_progress: "In Progress",
        resp_stat_resolved: "Resolved",
        resp_recent_cases: "Recent Cases",
        resp_case_details: "Case Details",
        resp_quick_msg: "💬 Quick Message",
        resp_formal_tab: "⚖️ Formal Response Wizard",
        resp_court_rule: "⚖️ Court Rule: Your formal response will be recorded as an official legal document. Be factual, concise, and respectful.",
        resp_step1_prog: "1. Language",
        resp_step2_prog: "2. Position",
        resp_step3_prog: "3. Defense",
        resp_step4_prog: "4. Relief",
        resp_step5_prog: "5. Court Fee",
        resp_step6_prog: "6. Review",
        resp_btn_next: "Next →",
        resp_btn_back: "← Back",
        resp_btn_submit: "⚖️ Submit Formal Response",
        resp_counter_claim_btn: "Submit Counter-Claim",
        resp_opening_label: "Opening Statement",
        resp_opening_placeholder: "Briefly state your position on this complaint (e.g. nature of relationship, dispute background)…",
        resp_defense_label: "Defense / Rebuttal Arguments",
        resp_defense_placeholder: "State your specific defense. Address each allegation point by point. Include dates, facts, and supporting reasons…",
        resp_evidence_label: "Witnesses or Evidence You Intend to Present (optional)",
        resp_evidence_placeholder: "e.g. Bank receipts dated Jan 10 2026, Witness: John Doe…",
        resp_relief_label: "Relief You Are Requesting from the Court",
        resp_relief_placeholder: "e.g. Dismiss the complaint, award costs, issue injunction against complainant…",
        resp_closing_label: "Closing Statement (optional)",
        resp_closing_placeholder: "Any final statement for the court's consideration…",
        resp_banner_geez: "⚠️ Ge'ez Script Enforced: You are filing in Amharic. All response arguments and relief statements must be written in Ge'ez letters (ሀ-ፐ).",
        resp_banner_latin: "⚠️ Latin Script Enforced: You are filing in English / Afaan Oromo. All response arguments must be written in Latin letters (A-Z).",
        resp_pos_deny: "Deny All Allegations",
        resp_pos_partial: "Partial Admission",
        resp_pos_context: "Admit with Context",

        // --- Judge & Clerk Keys ---
        judge_portal_title: "Judge Judicial Chambers",
        judge_order_title: "Court Order / Judgment Details",
        judge_order_desc: "Enter the judicial order or judgment in the court's designated language.",
        clerk_portal_title: "Clerk Registry Office",
        clerk_status_title: "Registry Case Verification",

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
        // --- Reusable Language Step & Actor Flow Keys ---
        lang_step_title: "ደረጃ 1፡ የቋንቋ እና የህግ ስልጣን ምርጫ",
        lang_step_desc: "ለዚህ የህግ ማመልከቻ ወይም ምላሽ ዋና ቋንቋ ይምረጡ። በቀጣይ ደረጃዎች የሚቀርቡ የጽሑፍ ማብራሪያዎች፣ ክርክሮች እና ዳኝነቶች በዚህ ፊደል መፃፍ አለባቸው።",
        lang_step_btn_next: "በተመረጠው ቋንቋ ይቀጥሉ →",
        lang_rule_amharic: "ለአማርኛ ጽሑፎች የግዕዝ ፊደላት (ሀ–ፐ) ግዴታ ናቸው",
        lang_rule_latin: "ለእንግሊዝኛ እና አፋን ኦሮሞ የላቲን ፊደላት (A–Z) ግዴታ ናቸው",
        lang_badge_actor: "የግዴታ የመጀመሪያ ደረጃ",
        val_script_error_title: "የፊደል አጠቃቀም ስህተት",
        val_step_has_errors: "እባክዎ ከመቀጠልዎ በፊት የፊደል አጠቃቀም ስህተቶችን ያስተካክሉ።",

        // --- Respondent Portal Keys ---
        resp_portal_title: "የተከሳሽ (መልስ ሰጪ) ፖርታል — CCMS",
        resp_nav_overview: "አጠቃላይ እይታ",
        resp_nav_cases: "የእኔ መዝገቦች",
        resp_nav_notifications: "ማሳወቂያዎች",
        resp_welcome: "እንኳን ደህና መጡ",
        resp_summary: "የእርስዎ ንቁ የህግ መዝገቦች ማጠቃለያ",
        resp_stat_total: "ጠቅላላ መዝገቦች",
        resp_stat_pending: "ምላሽ የሚጠብቁ",
        resp_stat_progress: "በሂደት ላይ ያሉ",
        resp_stat_resolved: "የተጠናቀቁ",
        resp_recent_cases: "የቅርብ ጊዜ መዝገቦች",
        resp_case_details: "የመዝገብ ዝርዝር",
        resp_quick_msg: "💬 ፈጣን መልዕክት",
        resp_formal_tab: "⚖️ መደበኛ የፍርድ ቤት መልስ መስጫ",
        resp_court_rule: "⚖️ የፍርድ ቤት ደንብ፡ መደበኛ ምላሽዎ እንደ ህጋዊ ሰነድ ይመዘገባል። እባክዎ እውነተኛ፣ አጭር እና የተሟላ መረጃ ያቅርቡ።",
        resp_step1_prog: "1. ቋንቋ",
        resp_step2_prog: "2. አቋም",
        resp_step3_prog: "3. የመከላከያ ነጥብ",
        resp_step4_prog: "4. ዳኝነት",
        resp_step5_prog: "5. የፍርድ ቤት ክፍያ",
        resp_step6_prog: "6. ማጠቃለያ",
        resp_btn_next: "ቀጣይ →",
        resp_btn_back: "← ተመለስ",
        resp_btn_submit: "⚖️ መደበኛ መልስ አስገባ",
        resp_counter_claim_btn: "የማስተባበያ / የተቃውሞ ክስ አስገባ",
        resp_opening_label: "የመክፈቻ አቋም መግለጫ",
        resp_opening_placeholder: "በዚህ ክስ ላይ ያለዎትን አቋም በአጭሩ ይግለጹ (የግንኙነት አይነት፣ አለመግባባት መንስኤ)…",
        resp_defense_label: "የመከላከያ / የመቃወሚያ ነጥቦች",
        resp_defense_placeholder: "እያንዳንዱን የክስ ነጥብ በዝርዝር ያስተባብሉ። ቀናትን፣ እውነታዎችን እና አስረጅ ምክንያቶችን ያካትቱ…",
        resp_evidence_label: "የሚያቀርቡት ማስረጃ ወይም ምስክሮች (አማራጭ)",
        resp_evidence_placeholder: "ምሳሌ፡ የባንክ ደረሰኝ፣ ምስክሮች ሙሉ ስም እና አድራሻ…",
        resp_relief_label: "ከፍርድ ቤቱ የሚጠይቁት ዳኝነት ወይም ውሳኔ",
        resp_relief_placeholder: "ምሳሌ፡ ክሱ ውድቅ እንዲደረግ፣ ኪሳራ እንዲሸፈን፣ የእግድ ትዕዛዝ እንዲሰጥ…",
        resp_closing_label: "የማጠቃለያ ቃል (አማራጭ)",
        resp_closing_placeholder: "ለፍርድ ቤቱ ሊያቀርቡት የሚፈልጉት የመጨረሻ አስተያየት…",
        resp_banner_geez: "⚠️ የግዕዝ ፊደላት ግዴታ ናቸው፡ አማርኛ ቋንቋ መርጠዋል። የመከላከያ መልስ እና ዳኝነት ማብራሪያዎች በሙሉ በግዕዝ ፊደላት (ሀ-ፐ) መፃፍ አለባቸው።",
        resp_banner_latin: "⚠️ የላቲን ፊደላት ግዴታ ናቸው፡ እንግሊዝኛ / አፋን ኦሮሞ መርጠዋል። ጽሑፎች በላቲን ፊደላት (A-Z) መፃፍ አለባቸው።",
        resp_pos_deny: "ክሱን ሙሉ በሙሉ እክዳለሁ",
        resp_pos_partial: "በከፊል አምናለሁ",
        resp_pos_context: "አምናለሁ ግን ምክንያቴን አቀርባለሁ",

        // --- Judge & Clerk Keys ---
        judge_portal_title: "የዳኞች ችሎት ጽ/ቤት",
        judge_order_title: "የፍርድ ቤት ትዕዛዝ / ፍርድ ዝርዝር",
        judge_order_desc: "የዳኝነት ትዕዛዝ ወይም ፍርድ በፍርድ ቤቱ ቋንቋ ያስገቡ።",
        clerk_portal_title: "የሬጅስትራር መዝገብ ቤት",
        clerk_status_title: "የመዝገብ ምርመራ እና ውሳኔ",

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
        // --- Reusable Language Step & Actor Flow Keys ---
        lang_step_title: "Tarkaanfii 1: Afaan fi Daangaa Seeraa Filadhu",
        lang_step_desc: "Galmee seeraa ykn deebii keessaniif afaan filadhaa. Barreeffamoonni, falmiileen fi gaaffileen seeraa itti aanan hundi qubee kanaan barreeffamuu qabu.",
        lang_step_btn_next: "Afaan Filatameen Itti Fufi →",
        lang_rule_amharic: "Afaan Amaaraaf qubeen Gi'iizii (ሀ–ፐ) barbaachisaadha",
        lang_rule_latin: "Afaan Ingilizii fi Oromoof qubeen Laatiin (A–Z) barbaachisaadha",
        lang_badge_actor: "Tarkaanfii Dirqamaa",
        val_script_error_title: "Dogoggora Qubee Afaanii",
        val_step_has_errors: "Mee osoo hin darbin dura dogoggora qubee sirreessaa.",

        // --- Respondent Portal Keys ---
        resp_portal_title: "Poortaalii Deebii Kennaa — CCMS",
        resp_nav_overview: "Ibsa Waliigalaa",
        resp_nav_cases: "Dhimmoota Koo",
        resp_nav_notifications: "Beeksisa",
        resp_welcome: "Baga nagaan dhuftan",
        resp_summary: "Cuunfaa adeemsa murtii seeraa keessanii kan yeroo ammaa",
        resp_stat_total: "Dhimmoota Waliigalaa",
        resp_stat_pending: "Deebii Eegaa Jiran",
        resp_stat_progress: "Adeemsa Irra Jiran",
        resp_stat_resolved: "Kan Xumuraman",
        resp_recent_cases: "Dhimmoota Dhiyoo",
        resp_case_details: "Bal'ina Dhimmaa",
        resp_quick_msg: "💬 Ergaa Saffisaa",
        resp_formal_tab: "⚖️ Deebii Seeraa Mana Murtii",
        resp_court_rule: "⚖️ Seera Mana Murtii: Deebiin seeraa keessan akka galmee mootummaatti qabama. Dhugaa, gabaabaa fi kabajaan dhiyeessaa.",
        resp_step1_prog: "1. Afaan",
        resp_step2_prog: "2. Ejjennoo",
        resp_step3_prog: "3. Falmii",
        resp_step4_prog: "4. Ajaja",
        resp_step5_prog: "5. Kaffaltii",
        resp_step6_prog: "6. Sakatta'iinsa",
        resp_btn_next: "Itti Aani →",
        resp_btn_back: "← Duubatti",
        resp_btn_submit: "⚖️ Deebii Seeraa Galchi",
        resp_counter_claim_btn: "Himannaa Falmii Dhiyeessi",
        resp_opening_label: "Ibsa Ejjennoo Jalqabaa",
        resp_opening_placeholder: "Ejjennoo keessan himannaa kana irratti gabaabsanii ibsaa…",
        resp_defense_label: "Qabxii Falmii fi Madaallii",
        resp_defense_placeholder: "Qabxii falmii keessanii tokko tokkoon dhiyeessaa. Guyyoota, ragaalee fi sababoota dabaladhaa…",
        resp_evidence_label: "Ragaalee ykn Ragaa Baatoota (filannoo)",
        resp_evidence_placeholder: "fkn. Nagahee baankii, maqaa ragaa baatootaa…",
        resp_relief_label: "Murtii Mana Murtii Irraa Barbaadan",
        resp_relief_placeholder: "fkn. Himannaan akka kuffifamu, baasiin akka kafalamu…",
        resp_closing_label: "Ibsa Xumuraa (filannoo)",
        resp_closing_placeholder: "Yaada xumuraa mana murtiif dhiyeessuu barbaaddan…",
        resp_banner_geez: "⚠️ Qubeen Gi'iizii Dirqamaadha: Afaan Amaaraa filattaniittu. Barreeffamoonni deebii hundi qubee Gi'iiziin (ሀ-ፐ) barreeffamuu qabu.",
        resp_banner_latin: "⚠️ Qubeen Laatiin Dirqamaadha: Afaan Ingilizii / Oromoo filattaniittu. Barreeffamoonni hundi qubee Laatiiniin (A-Z) barreeffamuu qabu.",
        resp_pos_deny: "Himannaa guutummaatti nan waakkadha",
        resp_pos_partial: "Gartokkee nan amana",
        resp_pos_context: "Nan amana garuu sababa qaba",

        // --- Judge & Clerk Keys ---
        judge_portal_title: "Waajjira Abbootii Seeraa",
        judge_order_title: "Bal'ina Ajaja / Murtii Abbaa Seeraa",
        judge_order_desc: "Ajaja murtii afaan mana murtii filatameen galchaa.",
        clerk_portal_title: "Waajjira Galmee Reejistiraaraa",
        clerk_status_title: "Sakatta'iinsa Galmee Reejistiraaraa",

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
        
        // ── Actor Persistent State ──
        currentActor: 'CITIZEN',

        /**
         * Get the persisted language for a specific actor (or current actor)
         * @param {string} [actor] 'RESPONDENT' | 'CITIZEN' | 'JUDGE' | 'CLERK' | 'ADMIN'
         * @returns {string} 'en', 'am', or 'om'
         */
        getActorLanguage(actor) {
            const role = (actor || this.currentActor || 'CITIZEN').toUpperCase();
            try {
                const actorKey = 'app_language_' + role.toLowerCase();
                const saved = localStorage.getItem(actorKey);
                if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
                    return saved;
                }
            } catch (e) {
                console.warn('i18n: localStorage error in getActorLanguage');
            }
            return this.getLanguage();
        },

        /**
         * Persist language specifically for an actor, update application context immediately,
         * and dispatch actor-specific languagechange event
         * @param {string} actor 'RESPONDENT' | 'CITIZEN' | 'JUDGE' | 'CLERK' | 'ADMIN'
         * @param {string} lang 'en' | 'am' | 'om'
         */
        setActorLanguage(actor, lang) {
            const role = (actor || this.currentActor || 'CITIZEN').toUpperCase();
            if (!SUPPORTED_LANGUAGES.includes(lang)) {
                lang = DEFAULT_LANGUAGE;
            }

            try {
                const actorKey = 'app_language_' + role.toLowerCase();
                localStorage.setItem(actorKey, lang);
            } catch (e) {
                console.warn('i18n: Failed to persist actor language');
            }

            // Immediately set globally so active UI localizes
            this.setLanguage(lang);

            window.dispatchEvent(new CustomEvent('actor:languagechange', {
                detail: { actor: role, language: lang }
            }));
        },

        /**
         * Set the current active actor role, loading their persisted language preference immediately
         * @param {string} role 'RESPONDENT' | 'CITIZEN' | 'JUDGE' | 'CLERK' | 'ADMIN'
         */
        setActor(role) {
            if (!role) return;
            this.currentActor = role.toUpperCase();
            const preferredLang = this.getActorLanguage(this.currentActor);
            if (preferredLang && preferredLang !== this.getLanguage()) {
                this.setLanguage(preferredLang);
            }
        },

        // ── Reusable Language First-Step Component ──
        /**
         * Abstracted Language First-Step Component
         * Renders the mandatory first step into any actor's wizard, modal, or form.
         *
         * @param {HTMLElement|string} container Target element or selector
         * @param {Object} options Configuration options
         * @param {string} options.wizardKey Unique identifier (e.g. 'resp-formal', 'citizen-complaint')
         * @param {string} [options.actor='RESPONDENT'] Actor role
         * @param {number} [options.stepNumber=1] Step number
         * @param {string} [options.title] Optional title override
         * @param {string} [options.description] Optional description override
         * @param {string} [options.nextButtonText] Next button text
         * @param {Function} [options.onSelect] Callback when language card is clicked: fn(lang)
         * @param {Function} [options.onNext] Callback when Proceed button is clicked: fn(lang)
         * @returns {HTMLElement} The mounted component element
         */
        renderLanguageStep(container, options = {}) {
            const parent = typeof container === 'string' ? document.querySelector(container) : container;
            if (!parent) return null;

            const wizardKey = options.wizardKey || 'wizard';
            const actor = (options.actor || this.currentActor || 'RESPONDENT').toUpperCase();
            const stepNum = options.stepNumber || 1;
            const currentLang = this.getActorLanguage(actor);

            const title = options.title || this.t('lang_step_title', 'Step ' + stepNum + ': Select Language & Legal Jurisdiction');
            const desc = options.description || this.t('lang_step_desc', 'Choose the primary language for this legal submission. Subsequent statements, arguments, and pleadings must strictly adhere to the chosen script.');
            const nextBtnText = options.nextButtonText || this.t('lang_step_btn_next', 'Proceed with Selected Language →');

            parent.innerHTML = [
                '<div class="reusable-lang-step-container" data-reusable-wizard="' + wizardKey + '" data-actor="' + actor + '">',
                '    <div class="wizard-step-header" style="margin-bottom: 1.25rem;">',
                '        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem; flex-wrap:wrap; gap:0.5rem;">',
                '            <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--text, #0f172a);">' + title + '</h3>',
                '            <span class="badge" style="background:#e0e7ff; color:#4338ca; font-size:0.75rem; font-weight:700; padding:0.3rem 0.75rem; border-radius:50px; text-transform:uppercase;">',
                '                ' + actor + ' ' + this.t('lang_badge_actor', 'Mandatory Step'),
                '            </span>',
                '        </div>',
                '        <p class="text-muted" style="margin:0; font-size:0.875rem; line-height:1.6; color:#64748b;">' + desc + '</p>',
                '    </div>',
                '    <div class="wizard-lang-grid" id="lang-grid-' + wizardKey + '">',
                '        <div class="wizard-lang-card ' + (currentLang === 'en' ? 'selected' : '') + '" data-wizard-lang="en">',
                '            <input type="radio" name="wizard_filing_lang_' + wizardKey + '" value="en" ' + (currentLang === 'en' ? 'checked' : '') + '>',
                '            <div class="wizard-lang-header">',
                '                <span class="wlang-flag">🌐</span>',
                '                <span class="wlang-badge">Commercial &amp; Federal</span>',
                '            </div>',
                '            <div class="wlang-name">English</div>',
                '            <div class="wlang-script">Latin Script (A–Z)</div>',
                '            <div class="wlang-desc">English court filings, pleadings, and official correspondence.</div>',
                '        </div>',
                '        <div class="wizard-lang-card ' + (currentLang === 'am' ? 'selected' : '') + '" data-wizard-lang="am">',
                '            <input type="radio" name="wizard_filing_lang_' + wizardKey + '" value="am" ' + (currentLang === 'am' ? 'checked' : '') + '>',
                '            <div class="wizard-lang-header">',
                '                <span class="wlang-flag">🇪🇹</span>',
                '                <span class="wlang-badge">ብሔራዊ የስራ ቋንቋ</span>',
                '            </div>',
                '            <div class="wlang-name">አማርኛ</div>',
                '            <div class="wlang-script">የግዕዝ ፊደላት (ሀ–ፐ)</div>',
                '            <div class="wlang-desc">የፌዴራል እና የክልል ፍርድ ቤቶች መደበኛ የክስ እና መልስ ማመልከቻ።</div>',
                '        </div>',
                '        <div class="wizard-lang-card ' + (currentLang === 'om' ? 'selected' : '') + '" data-wizard-lang="om">',
                '            <input type="radio" name="wizard_filing_lang_' + wizardKey + '" value="om" ' + (currentLang === 'om' ? 'checked' : '') + '>',
                '            <div class="wizard-lang-header">',
                '                <span class="wlang-flag">🌳</span>',
                '                <span class="wlang-badge">Mana Murtii Naannoo</span>',
                '            </div>',
                '            <div class="wlang-name">Afaan Oromoo</div>',
                '            <div class="wlang-script">Qubee Afaan Oromoo (A–Z, &#39;)</div>',
                '            <div class="wlang-desc">Murtiiwwan seeraa fi deebii dhaddachaa naannootti dhiyaatan.</div>',
                '        </div>',
                '    </div>',
                '    <div class="script-enforcement-banner" id="banner-' + wizardKey + '" style="margin: 1.25rem 0; padding:0.85rem 1.1rem; border-radius:10px; font-size:0.85rem; font-weight:600; display:flex; align-items:center; gap:0.65rem;"></div>',
                '    <div class="wizard-btn-row" style="display:flex; justify-content:flex-end; margin-top:1.5rem;">',
                '        <button type="button" class="btn btn-primary reusable-step-next-btn" style="min-width: 200px; padding:0.75rem 1.5rem; font-size:0.95rem; font-weight:600; border-radius:8px; cursor:pointer;">',
                '            ' + nextBtnText,
                '        </button>',
                '    </div>',
                '</div>'
            ].join('\n');

            const updateBanner = (lang) => {
                const banner = parent.querySelector('#banner-' + wizardKey);
                if (!banner) return;
                if (lang === 'am') {
                    banner.style.background = '#fef3c7';
                    banner.style.border = '1px solid #f59e0b';
                    banner.style.color = '#92400e';
                    banner.innerHTML = '<span>⚠️</span><span><strong>' + this.t('lang_rule_amharic', 'የግዕዝ ፊደላት ግዴታ ናቸው:') + '</strong> ' + this.t('resp_banner_geez', 'አማርኛ ቋንቋ መርጠዋል። በቀጣይ ደረጃዎች የሚቀርቡ ክርክሮች፣ መግለጫዎች እና ዳኝነቶች በሙሉ በግዕዝ ፊደላት (ሀ-ፐ) መፃፍ አለባቸው።') + '</span>';
                } else if (lang === 'om') {
                    banner.style.background = '#ecfdf5';
                    banner.style.border = '1px solid #10b981';
                    banner.style.color = '#065f46';
                    banner.innerHTML = '<span>⚠️</span><span><strong>' + this.t('lang_rule_latin', 'Qubee Laatiin Dirqamaadha:') + '</strong> ' + this.t('resp_banner_latin', 'Afaan Oromoo filattaniittu. Barreeffamoonni hundi qubee Laatiiniin (A-Z) barreeffamuu qabu.') + '</span>';
                } else {
                    banner.style.background = '#eff6ff';
                    banner.style.border = '1px solid #3b82f6';
                    banner.style.color = '#1e40af';
                    banner.innerHTML = '<span>⚠️</span><span><strong>' + this.t('lang_rule_latin', 'Latin Script Enforced:') + '</strong> ' + this.t('resp_banner_latin', 'You selected English. All statements and pleadings must be written in Latin script (A-Z).') + '</span>';
                }
            };

            updateBanner(currentLang);

            const cards = parent.querySelectorAll('#lang-grid-' + wizardKey + ' .wizard-lang-card');
            cards.forEach(card => {
                card.addEventListener('click', () => {
                    const chosenLang = card.getAttribute('data-wizard-lang');
                    cards.forEach(c => {
                        const isMatch = c.getAttribute('data-wizard-lang') === chosenLang;
                        c.classList.toggle('selected', isMatch);
                        const radio = c.querySelector('input[type="radio"]');
                        if (radio) radio.checked = isMatch;
                    });

                    updateBanner(chosenLang);
                    this.setActorLanguage(actor, chosenLang);

                    const enclosingForm = parent.closest('form') || parent.closest('[data-actor-form]') || parent;
                    if (enclosingForm) enclosingForm.setAttribute('data-form-lang', chosenLang);

                    if (typeof options.onSelect === 'function') {
                        options.onSelect(chosenLang);
                    }
                });
            });

            const nextBtn = parent.querySelector('.reusable-step-next-btn');
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const selectedRadio = parent.querySelector('#lang-grid-' + wizardKey + ' input[type="radio"]:checked');
                    const chosenLang = selectedRadio ? selectedRadio.value : this.getActorLanguage(actor);

                    const enclosingForm = parent.closest('form') || parent.closest('[data-actor-form]') || parent;
                    if (enclosingForm) enclosingForm.setAttribute('data-form-lang', chosenLang);

                    if (typeof options.onNext === 'function') {
                        options.onNext(chosenLang);
                    }
                });
            }

            return parent;
        },

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
            
            /**
             * Global Form Validation Wrapper
             * Automatically attaches language script constraints and validation to all text inputs
             * inside any actor form or wizard.
             * 
             * @param {HTMLElement|string} formOrSelector 
             * @param {Object} options
             * @returns {Object} Wrapper controller with validateAll() and setLanguage()
             */
            wrapForm(formOrSelector, options = {}) {
                const form = typeof formOrSelector === 'string' ? document.querySelector(formOrSelector) : formOrSelector;
                if (!form) return null;

                const actor = options.actor || i18n.currentActor || 'CITIZEN';

                const getActiveLanguage = () => {
                    return form.getAttribute('data-form-lang') || 
                           (options.getLanguage ? options.getLanguage() : null) || 
                           i18n.getActorLanguage(actor) || 
                           i18n.getLanguage();
                };

                const selector = options.selector || 'input[data-lang-validate="true"], textarea[data-lang-validate="true"], .lang-validate, input[type="text"]:not([data-lang-ignore]), textarea:not([data-lang-ignore])';

                const attachToField = (field) => {
                    if (field._langValidated) return;
                    field._langValidated = true;

                    const type = (field.getAttribute('type') || '').toLowerCase();
                    if (['password', 'email', 'number', 'date', 'file', 'checkbox', 'radio', 'hidden'].includes(type)) {
                        return;
                    }

                    field.setAttribute('data-lang-validate', 'true');

                    const runValidation = () => {
                        const lang = getActiveLanguage();
                        return i18n.validator.validateInput(field, lang);
                    };

                    field.addEventListener('input', runValidation);
                    field.addEventListener('blur', runValidation);
                };

                form.querySelectorAll(selector).forEach(attachToField);

                if (typeof window !== 'undefined' && window.MutationObserver) {
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach(m => {
                            m.addedNodes.forEach(node => {
                                if (node.nodeType === 1) {
                                    if (node.matches && node.matches(selector)) {
                                        attachToField(node);
                                    }
                                    if (node.querySelectorAll) {
                                        node.querySelectorAll(selector).forEach(attachToField);
                                    }
                                }
                            });
                        });
                    });
                    observer.observe(form, { childList: true, subtree: true });
                }

                const validateAll = () => {
                    const lang = getActiveLanguage();
                    const fields = form.querySelectorAll('input[data-lang-validate="true"], textarea[data-lang-validate="true"], .lang-validate');
                    let isValid = true;
                    let firstInvalid = null;
                    let firstError = null;

                    fields.forEach(field => {
                        const type = (field.getAttribute('type') || '').toLowerCase();
                        if (['password', 'email', 'number', 'date', 'file', 'checkbox', 'radio', 'hidden'].includes(type)) {
                            return;
                        }
                        const valid = i18n.validator.validateInput(field, lang);
                        if (!valid && isValid) {
                            isValid = false;
                            firstInvalid = field;
                            const msg = field.parentElement ? field.parentElement.querySelector('.lang-validation-msg') : null;
                            firstError = msg ? msg.textContent : i18n.t('val_step_has_errors', 'Please correct language script errors.');
                        }
                    });

                    if (!isValid && firstInvalid) {
                        firstInvalid.focus();
                        if (options.showToast !== false) {
                            if (typeof window.showToast === 'function') {
                                window.showToast(firstError || 'Script mismatch in fields.', true);
                            } else if (typeof window.Swal !== 'undefined') {
                                window.Swal.fire({
                                    icon: 'warning',
                                    title: i18n.t('val_script_error_title', 'Language Script Error'),
                                    text: firstError
                                });
                            }
                        }
                    }
                    return isValid;
                };

                if (form.tagName === 'FORM') {
                    form.addEventListener('submit', function(e) {
                        if (!validateAll()) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }, true);
                }

                return {
                    form,
                    validateAll,
                    getLanguage: getActiveLanguage,
                    setLanguage: (lang) => {
                        form.setAttribute('data-form-lang', lang);
                        form.querySelectorAll('input[data-lang-validate="true"], textarea[data-lang-validate="true"]').forEach(field => {
                            if (field.value && field.value.trim().length > 0) {
                                i18n.validator.validateInput(field, lang);
                            }
                        });
                    }
                };
            },

            /**
             * Automatically wraps all known actor forms across the document
             */
            autoWrapAllForms() {
                const formsToWrap = [
                    { selector: '#complaint-form', actor: 'CITIZEN' },
                    { selector: '#resp-tab-formal', actor: 'RESPONDENT' },
                    { selector: '#counter-claim-form', actor: 'RESPONDENT' },
                    { selector: '#remark-form', actor: 'CITIZEN' }
                ];

                formsToWrap.forEach(cfg => {
                    const el = document.querySelector(cfg.selector);
                    if (el) {
                        this.wrapForm(el, { actor: cfg.actor });
                    }
                });
            },

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
                this.validator.autoWrapAllForms();
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
