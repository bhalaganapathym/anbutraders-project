import { useState, useEffect } from 'react';

export type Language = 'en' | 'ta';

export const translations = {
  en: {
    // Common Branding & Navigation
    company_name: 'Anbu Traders',
    company_tagline: 'Iron, Steel & Building Materials',
    dashboard: 'Dashboard',
    customers: 'Customers',
    customers_ledger: 'Customers & Ledger',
    products: 'Products',
    price_list: 'Price List',
    estimate: 'Estimate',
    orders: 'Orders / Estimates',
    dispatches: 'Dispatches',
    delivery: 'Delivery / POD',
    delivery_pod: 'Delivery / POD',
    billing: 'Billing',
    reconciliation: 'Daily Settlement',
    daily_reconciliation: 'Daily Cash Settlement',
    customer_ledger: 'Customer Ledger & Dues',
    drivers: 'Drivers',
    notifications: 'Notifications',
    settings: 'Settings',
    home: 'Home',

    // Roles
    role_admin: 'Admin Panel',
    role_billing: 'Billing Panel',
    role_dispatch: 'Dispatch Panel',
    role_driver: 'Driver Portal',

    // General Actions & Controls
    search: 'Search...',
    all: 'All',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    print: 'Print',
    export_csv: 'Export CSV',
    status: 'Status',
    date: 'Date',
    actions: 'Actions',
    loading: 'Loading...',
    refresh: 'Refresh',
    logout: 'Logout',
    submit: 'Submit',
    close: 'Close',
    back: 'Back',
    confirm: 'Confirm',
    online: 'Online',
    offline: 'Offline',

    // Dashboard
    todays_sales: "Today's Sales",
    pending_dispatches: 'Pending Dispatches',
    active_drivers: 'Active Drivers',
    total_market_dues: 'Total Market Dues',
    recent_orders: 'Recent Orders',
    recent_dispatches: 'Recent Dispatches',
    quick_actions: 'Quick Actions',
    create_new_order: 'Create New Order',
    create_dispatch_action: 'New Dispatch',
    view_price_list: 'View Price List',

    // Customers & Ledger
    add_customer: '+ Add Customer',
    customer_name: 'Customer Name',
    customer_phone: 'Phone Number',
    customer_address: 'Address / Site Location',
    with_dues: 'With Dues',
    settled_filter: 'Settled',
    total_billed: 'Total Billed',
    total_paid: 'Total Paid',
    total_dues: 'Total Outstanding Dues',
    send_payment_reminder: 'WhatsApp Payment Reminder',
    view_statement: 'Statement',
    credit_status: 'Credit Status',
    settled: 'Fully Settled',
    dues_pending: 'Dues Pending',
    last_payment: 'Last Transaction',
    no_customers_found: 'No customers found',

    // Products & Price List
    add_product: '+ Add Product',
    edit_brand_prices: 'Edit Brand Prices',
    bulk_adjust_prices: 'Bulk Adjust (%)',
    product_name: 'Product Name',
    brand: 'Brand',
    category: 'Category',
    size: 'Size / Dimension',
    price: 'Price (₹)',
    unit: 'Unit',
    hsn_code: 'HSN Code',
    all_brands: 'All Brands',
    all_categories: 'All Categories',

    // Orders & Estimates
    new_estimate_btn: '+ New Estimate',
    order_no: 'Order No.',
    order_items: 'Order Items',
    customer_info: 'Customer Information',
    delivery_address: 'Delivery Address',
    search_customer_placeholder: 'Type customer name or phone...',
    search_product_placeholder: 'Type product name...',
    quantity: 'Quantity',
    qty: 'Qty',
    subtotal: 'Subtotal',
    estimated_gst: 'Estimated GST (18%)',
    grand_total: 'Grand Total',
    order_total: 'Order Total',
    save_order: 'Save Order',
    send_whatsapp: 'WhatsApp',
    quick_add_voice: 'Quick-Add / Voice:',
    quick_add_placeholder: 'e.g. "10 12mm sumangala" or "20 ramco cement" & press Enter...',
    add: 'Add',

    // Dispatches & Transport
    new_dispatch: '+ New Dispatch',
    dispatch_no: 'Dispatch Ref',
    vehicle_number: 'Vehicle Number',
    driver_name: 'Driver Name',
    driver_mobile: 'Driver Mobile',
    tare_weight: 'Tare Weight (kg)',
    gross_weight: 'Gross Weight (kg)',
    net_weight: 'Net Weight (kg)',
    weighbridge: 'Weighbridge Weights',
    send_to_billing: 'Send to Billing',
    dispatch_status_pending: 'Pending Loading',
    dispatch_status_ready: 'Ready for Loading',
    dispatch_status_dispatched: 'Out for Delivery',
    dispatch_status_completed: 'Delivered',

    // Delivery & Driver Portal
    driver_portal_title: 'Driver Deliveries & Proof of Delivery (POD)',
    pending_deliveries: 'Active Deliveries',
    completed_deliveries: 'Completed Today',
    upload_pod_btn: 'Upload Delivery Proof (POD)',
    collect_cash_on_site: 'Cash Collected on Site (₹)',
    take_pod_photo: 'Take Delivery Photo',
    mark_as_delivered: 'Confirm Delivery',

    // Billing & Settlement
    billing_title: 'Invoices & Payment Collection',
    bill_no: 'Bill No.',
    total_amount: 'Total Amount',
    paid_amount: 'Paid Amount',
    pending_amount: 'Pending Balance',
    payment_method: 'Payment Mode',
    payment_cash: 'Cash',
    payment_upi: 'UPI / GPay / PhonePe',
    payment_credit: 'Credit (Account)',
    payment_cheque: 'Cheque',
    record_payment: 'Record Payment',
    partial_payment: 'Partial / Advance Payment',
    amount_paid_now: 'Amount Received Now (₹)',
    balance_to_collect_lbl: 'Remaining Balance (₹)',

    // Daily Settlement
    daily_collection_title: 'Daily Cash & Driver Collection Settlement',
    total_collected_today: 'Total Collected Today',
    driver_cash_collected: 'Driver Site Cash (In Hand)',
    upi_collected: 'UPI / Online Paid',
    credit_extended: 'Credit Billed Today',
    driver_settlement_table: 'Driver Cash Handover Summary',
    trips_completed: 'Trips Completed',
    cash_collected: 'Cash Collected',
    handover_status: 'Handover Status',
    verified_by_office: 'Handed Over to Office',
    pending_handover: 'Pending Driver Handover',
    print_day_sheet: 'Print Day Sheet',
    today: 'Today',
    yesterday: 'Yesterday',

    // Notifications
    notifications_title: 'System Notifications & Alerts',
    clear_all_notifs: 'Clear All',
    mark_all_read: 'Mark All Read',
    no_notifications: 'No new notifications. All caught up!',

    // Settings
    settings_title: 'System & Company Settings',
    whatsapp_template_title: 'WhatsApp Customer Dispatch Template',
    company_name_lbl: 'Company Display Name',
    company_phone_lbl: 'Company Support Phone',
    company_logo_lbl: 'Company Logo / Image URL',
    message_content_lbl: 'Message Content',
    save_all_settings: 'Save All Settings',
    db_safeguard_title: 'Database Storage Safeguard & Data Backup',
    download_backup_btn: 'Download System Backup',
    optimize_db_btn: 'Optimize & Free Database Storage',

    // Public Live Tracking
    live_tracking_title: 'Live Order & Delivery Status',
    order_details: 'Order Details',
    vehicle_info: 'Assigned Vehicle',
    driver_info: 'Delivery Driver',
    call_driver: 'Call Driver',
    delivery_location: 'Site Delivery Address',
    items_loaded: 'Loaded Materials & Specifications',
    financial_breakdown: 'Payment & Invoice Summary',
    total_bill: 'Total Bill Amount',
    advance_paid: 'Amount Paid (Advance/Office)',
    balance_to_collect: 'Balance to Pay on Site',
    download_bill: 'Download Official Tax Invoice (PDF)',
    contact_office: 'Contact Anbu Traders Office',

    // Login
    sign_in_title: 'Sign in to Anbu Traders',
    sign_in_subtitle: 'Internal inventory, dispatch and billing operations',
    username_lbl: 'Username',
    password_lbl: 'Password',
    sign_in_btn: 'Sign In',
  },
  ta: {
    // Common Branding & Navigation
    company_name: 'அன்பு டிரேடர்ஸ்',
    company_tagline: 'இரும்பு, ஸ்டீல் மற்றும் கட்டுமானப் பொருட்கள்',
    dashboard: 'டாஷ்போர்டு',
    customers: 'வாடிக்கையாளர்கள்',
    customers_ledger: 'வாடிக்கையாளர் & பாக்கி',
    products: 'பொருட்கள்',
    price_list: 'விலைப்பட்டியல்',
    estimate: 'மதிப்பீடு',
    orders: 'ஆர்டர்கள் / மதிப்பீடு',
    dispatches: 'டெலிவரி விநியோகம்',
    delivery: 'டெலிவரி / POD',
    delivery_pod: 'டெலிவரி ஆதாரம் (POD)',
    billing: 'பில்லிங்',
    reconciliation: 'தினசரி வசூல்',
    daily_reconciliation: 'தினசரி வசூல் கணக்கு',
    customer_ledger: 'வாடிக்கையாளர் பாக்கி கணக்கு',
    drivers: 'ஓட்டுநர்கள்',
    notifications: 'அறிவிப்புகள்',
    settings: 'அமைப்புகள்',
    home: 'முகப்பு',

    // Roles
    role_admin: 'நிர்வாகக் குழு (Admin)',
    role_billing: 'பில்லிங் பிரிவு',
    role_dispatch: 'டெலிவரி விநியோகப் பிரிவு',
    role_driver: 'ஓட்டுநர் தளம்',

    // General Actions & Controls
    search: 'தேடுக...',
    all: 'அனைத்தும்',
    save: 'சேமிக்க',
    cancel: 'ரத்து',
    delete: 'நீக்கு',
    edit: 'திருத்து',
    print: 'அச்சிடுக (Print)',
    export_csv: 'CSV பதிவிறக்கம்',
    status: 'நிலை',
    date: 'தேதி',
    actions: 'செயல்கள்',
    loading: 'ஏற்றப்படுகிறது...',
    refresh: 'புதுப்பி',
    logout: 'வெளியேறு (Logout)',
    submit: 'சமர்ப்பி',
    close: 'மூடு',
    back: 'பின்செல்க',
    confirm: 'உறுதி செய்',
    online: 'ஆன்லைன்',
    offline: 'ஆஃப்லைன்',

    // Dashboard
    todays_sales: 'இன்றைய விற்பனை',
    pending_dispatches: 'நிலுவையில் உள்ள டெலிவரி',
    active_drivers: 'செயலில் உள்ள ஓட்டுநர்கள்',
    total_market_dues: 'மொத்த வாடிக்கையாளர் பாக்கி',
    recent_orders: 'சமீபத்திய ஆர்டர்கள்',
    recent_dispatches: 'சமீபத்திய டெலிவரிகள்',
    quick_actions: 'விரைவுச் செயல்கள்',
    create_new_order: 'புதிய ஆர்டர் உருவாக்குக',
    create_dispatch_action: 'புதிய டெலிவரி',
    view_price_list: 'விலைப்பட்டியல் பார்க்க',

    // Customers & Ledger
    add_customer: '+ புதிய வாடிக்கையாளர்',
    customer_name: 'வாடிக்கையாளர் பெயர்',
    customer_phone: 'கைபேசி எண்',
    customer_address: 'முகவரி / தள முகவரி',
    with_dues: 'பாக்கி உள்ளவர்கள்',
    settled_filter: 'பாக்கி இல்லாதவர்கள்',
    total_billed: 'மொத்த விற்பனை',
    total_paid: 'செலுத்தப்பட்ட தொகை',
    total_dues: 'மொத்த பாக்கி தொகை (Dues)',
    send_payment_reminder: 'WhatsApp பாக்கி நினைவூட்டல்',
    view_statement: 'கணக்கு அறிக்கை',
    credit_status: 'கடன் நிலை',
    settled: 'முழுவதும் செலுத்தப்பட்டது',
    dues_pending: 'பாக்கி உள்ளது',
    last_payment: 'கடைசி பரிவர்த்தனை',
    no_customers_found: 'வாடிக்கையாளர்கள் இல்லை',

    // Products & Price List
    add_product: '+ புதிய பொருள்',
    edit_brand_prices: 'பிராண்ட் விலை திருத்துக',
    bulk_adjust_prices: 'மொத்த விலை மாற்றம் (%)',
    product_name: 'பொருளின் பெயர்',
    brand: 'பிராண்ட் (Brand)',
    category: 'வகை (Category)',
    size: 'அளவு / தடிமன் (Size)',
    price: 'விலை (₹)',
    unit: 'அலகு (Unit)',
    hsn_code: 'HSN குறியீடு',
    all_brands: 'அனைத்து பிராண்டுகள்',
    all_categories: 'அனைத்து வகைகள்',

    // Orders & Estimates
    new_estimate_btn: '+ புதிய மதிப்பீடு',
    order_no: 'ஆர்டர் எண்',
    order_items: 'ஆர்டர் பொருட்கள்',
    customer_info: 'வாடிக்கையாளர் விவரம்',
    delivery_address: 'டெலிவரி முகவரி',
    search_customer_placeholder: 'வாடிக்கையாளர் பெயர் அல்லது எண்...',
    search_product_placeholder: 'பொருளின் பெயர் உள்ளிடவும்...',
    quantity: 'எண்ணிக்கை / அளவு',
    qty: 'அளவு',
    subtotal: 'கூடுதல் தொகை',
    estimated_gst: 'ஜிஎஸ்டி வரி (18%)',
    grand_total: 'மொத்த தொகை (₹)',
    order_total: 'ஆர்டர் மொத்தம்',
    save_order: 'ஆர்டர் சேமிக்க',
    send_whatsapp: 'வாட்ஸ்அப்',
    quick_add_voice: 'குரல் / விரைவு உள்ளீடு:',
    quick_add_placeholder: 'உதா: "10 12mm sumangala" அல்லது "20 ramco cement" உள்ளிட்டு Enter அழுத்தவும்...',
    add: 'சேர்',

    // Dispatches & Transport
    new_dispatch: '+ புதிய டெலிவரி',
    dispatch_no: 'டெலிவரி எண்',
    vehicle_number: 'வாகன எண்',
    driver_name: 'ஓட்டுநர் பெயர்',
    driver_mobile: 'ஓட்டுநர் கைபேசி',
    tare_weight: 'வாகன எடை (Tare kg)',
    gross_weight: 'மொத்த எடை (Gross kg)',
    net_weight: 'பொருட்கள் எடை (Net kg)',
    weighbridge: 'வேபிரிட்ஜ் எடை விவரம்',
    send_to_billing: 'பில்லிங்கிற்கு அனுப்புக',
    dispatch_status_pending: 'ஏற்றப்பட வேண்டும்',
    dispatch_status_ready: 'ஏற்ற தயாராக உள்ளது',
    dispatch_status_dispatched: 'வாகனம் புறப்பட்டது',
    dispatch_status_completed: 'டெலிவரி செய்யப்பட்டது',

    // Delivery & Driver Portal
    driver_portal_title: 'ஓட்டுநர் டெலிவரிகள் மற்றும் புகைப்பட ஆதாரம் (POD)',
    pending_deliveries: 'செயலில் உள்ள டெலிவரிகள்',
    completed_deliveries: 'இன்று முடிக்கப்பட்டவை',
    upload_pod_btn: 'டெலிவரி ஆதாரம் பதிவேற்றுக (POD)',
    collect_cash_on_site: 'தளத்தில் வசூலித்த ரொக்கம் (₹)',
    take_pod_photo: 'டெலிவரி புகைப்படம் எடுக்கவும்',
    mark_as_delivered: 'டெலிவரி உறுதி செய்',

    // Billing & Settlement
    billing_title: 'பில் மற்றும் கட்டண வசூல்',
    bill_no: 'பில் எண்',
    total_amount: 'மொத்த தொகை',
    paid_amount: 'செலுத்தப்பட்ட தொகை',
    pending_amount: 'நிலுவை பாக்கி',
    payment_method: 'பணம் செலுத்தும் முறை',
    payment_cash: 'ரொக்கம் (Cash)',
    payment_upi: 'யுபிஐ (GPay / PhonePe)',
    payment_credit: 'கடன் (Account)',
    payment_cheque: 'காசோலை (Cheque)',
    record_payment: 'கட்டணம் பதிவு செய்',
    partial_payment: 'முன்பணம் / பகுதி கட்டணம்',
    amount_paid_now: 'இப்போது பெற்ற தொகை (₹)',
    balance_to_collect_lbl: 'மீதமுள்ள பாக்கி (₹)',

    // Daily Settlement
    daily_collection_title: 'தினசரி வசூல் மற்றும் ஓட்டுநர் கணக்கு ஒப்படைப்பு',
    total_collected_today: 'இன்றைய மொத்த வசூல்',
    driver_cash_collected: 'ஓட்டுநர் வசூலித்த ரொக்கம்',
    upi_collected: 'UPI / ஆன்லைன் பணம்',
    credit_extended: 'இன்றைய கடன் விற்பனை',
    driver_settlement_table: 'ஓட்டுநர்கள் பணம் ஒப்படைப்பு விவரம்',
    trips_completed: 'முடிக்கப்பட்ட ட்ரிப்கள்',
    cash_collected: 'வசூலித்த ரொக்கம்',
    handover_status: 'ஒப்படைப்பு நிலை',
    verified_by_office: 'அலுவலகத்தில் ஒப்படைக்கப்பட்டது',
    pending_handover: 'ஓட்டுநரிடம் நிலுவையில் உள்ளது',
    print_day_sheet: 'நாள் கணக்கு அச்சிடுக',
    today: 'இன்று',
    yesterday: 'நேற்று',

    // Notifications
    notifications_title: 'அறிவிப்புகள் மற்றும் எச்சரிக்கைகள்',
    clear_all_notifs: 'அனைத்தையும் நீக்குக',
    mark_all_read: 'படித்ததாகக் குறிக்கவும்',
    no_notifications: 'புதிய அறிவிப்புகள் எதுவும் இல்லை!',

    // Settings
    settings_title: 'அமைப்புகள் மற்றும் நிறுவன விவரங்கள்',
    whatsapp_template_title: 'வாட்ஸ்அப் செய்தி வார்ப்புரு (Template)',
    company_name_lbl: 'நிறுவனத்தின் பெயர்',
    company_phone_lbl: 'அலுவலக தொலைபேசி எண்கள்',
    company_logo_lbl: 'நிறுவன லோகோ / பட இணைப்பு',
    message_content_lbl: 'செய்தி உள்ளடக்கம்',
    save_all_settings: 'அனைத்து அமைப்புகளையும் சேமிக்க',
    db_safeguard_title: 'தரவுத்தள சேமிப்பக பாதுகாப்பு மற்றும் காப்புப்பிரதி',
    download_backup_btn: 'முழு காப்புப்பிரதி பதிவிறக்கம் (Backup)',
    optimize_db_btn: 'சேமிப்பகத்தை மேம்படுத்தி காலி செய்யவும்',

    // Public Live Tracking
    live_tracking_title: 'நேரடி டெலிவரி நிலை',
    order_details: 'ஆர்டர் விவரங்கள்',
    vehicle_info: 'வாகனம்',
    driver_info: 'ஓட்டுநர் பெயர்',
    call_driver: 'ஓட்டுநரை அழைக்க',
    delivery_location: 'டெலிவரி முகவரி',
    items_loaded: 'ஏற்றப்பட்ட பொருட்கள்',
    financial_breakdown: 'பில் மற்றும் கட்டண விவரம்',
    total_bill: 'மொத்த பில் தொகை',
    advance_paid: 'செலுத்தப்பட்ட முன்பணம்',
    balance_to_collect: 'டெலிவரியில் செலுத்த வேண்டிய தொகை',
    download_bill: 'அதிகாரப்பூர்வ பில் பதிவிறக்கம் (PDF)',
    contact_office: 'அன்பு டிரேடர்ஸ் அலுவலகத்தை தொடர்பு கொள்ள',

    // Login
    sign_in_title: 'அன்பு டிரேடர்ஸ் உள்நுழைவு',
    sign_in_subtitle: 'சரக்கு இருப்பு, டெலிவரி மற்றும் பில்லிங் மேலாண்மை',
    username_lbl: 'பயனர் பெயர் (Username)',
    password_lbl: 'கடவுச்சொல் (Password)',
    sign_in_btn: 'உள்நுழைக (Sign In)',
  },
};

export function getLanguage(): Language {
  const saved = localStorage.getItem('anbu_app_lang');
  return (saved === 'ta' || saved === 'en') ? saved : 'en';
}

export function setLanguage(lang: Language): void {
  localStorage.setItem('anbu_app_lang', lang);
  window.dispatchEvent(new Event('languagechange'));
}

export function useTranslation() {
  const [lang, setLangState] = useState<Language>(getLanguage());

  useEffect(() => {
    const handleLangChange = () => {
      setLangState(getLanguage());
    };
    window.addEventListener('languagechange', handleLangChange);
    return () => window.removeEventListener('languagechange', handleLangChange);
  }, []);

  const changeLang = (newLang: Language) => {
    setLanguage(newLang);
    setLangState(newLang);
  };

  const t = (key: keyof typeof translations['en']): string => {
    return translations[lang]?.[key] || translations['en'][key] || key;
  };

  return { t, lang, changeLanguage: changeLang };
}
