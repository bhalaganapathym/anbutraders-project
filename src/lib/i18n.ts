import { useState, useEffect } from 'react';

export type Language = 'en' | 'ta';

export const translations = {
  en: {
    // Common
    company_name: 'Anbu Traders',
    company_tagline: 'Iron, Steel & Building Materials',
    dashboard: 'Dashboard',
    customers: 'Customers',
    products: 'Products',
    price_list: 'Price List',
    estimate: 'Estimate / Orders',
    dispatches: 'Dispatches',
    delivery_pod: 'Delivery / POD',
    billing: 'Billing & Invoices',
    daily_reconciliation: 'Daily Cash Settlement',
    customer_ledger: 'Customer Ledger & Dues',
    drivers: 'Drivers & Fleet',
    notifications: 'Notifications',
    settings: 'Settings',
    search: 'Search...',
    all: 'All',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    print: 'Print',
    export_csv: 'Export CSV',
    status: 'Status',
    date: 'Date',
    actions: 'Actions',
    
    // Tracking & Public Receipt
    live_tracking_title: 'Live Order & Delivery Status',
    order_details: 'Order Details',
    dispatch_ref: 'Dispatch Ref',
    vehicle_info: 'Assigned Vehicle',
    driver_info: 'Delivery Driver',
    call_driver: 'Call Driver',
    delivery_location: 'Site Delivery Address',
    items_loaded: 'Loaded Materials & Specifications',
    verified_weight: 'Verified Scale Weight',
    gross_wt: 'Gross Weight',
    tare_wt: 'Tare Weight',
    net_wt: 'Net Weight',
    financial_breakdown: 'Payment & Invoice Summary',
    total_bill: 'Total Bill Amount',
    advance_paid: 'Amount Paid (Advance/Office)',
    balance_to_collect: 'Balance to Pay on Site',
    payment_status: 'Payment Status',
    status_pending: 'Order Confirmed - Preparing Dispatch',
    status_out_for_delivery: 'Out for Delivery 🚚',
    status_delivered: 'Delivered on Site ✅',
    pod_photo: 'Proof of Delivery (POD) Photo',
    download_bill: 'Download Official Tax Invoice (PDF)',
    need_help: 'Need Help with your Order?',
    contact_office: 'Contact Anbu Traders Office',

    // Customer Ledger
    total_billed: 'Total Billed',
    total_paid: 'Total Paid',
    total_dues: 'Total Outstanding Dues',
    send_payment_reminder: 'WhatsApp Payment Reminder',
    view_statement: 'View Full Statement',
    credit_status: 'Credit Status',
    settled: 'Fully Settled',
    dues_pending: 'Dues Pending',
    last_payment: 'Last Transaction',

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
  },
  ta: {
    // Common
    company_name: 'அன்பு டிரேடர்ஸ்',
    company_tagline: 'இரும்பு, ஸ்டீல் மற்றும் கட்டுமானப் பொருட்கள்',
    dashboard: 'டாஷ்போர்டு',
    customers: 'வாடிக்கையாளர்கள்',
    products: 'பொருட்கள்',
    price_list: 'விலைப்பட்டியல்',
    estimate: 'மதிப்பீடு / ஆர்டர்கள்',
    dispatches: 'டெலிவரி விநியோகம்',
    delivery_pod: 'டெலிவரி ஆதாரம் (POD)',
    billing: 'பில் & இன்வாய்ஸ்',
    daily_reconciliation: 'தினசரி வசூல் கணக்கு',
    customer_ledger: 'வாடிக்கையாளர் பாக்கி கணக்கு',
    drivers: 'ஓட்டுநர்கள் & வாகனங்கள்',
    notifications: 'அறிவிப்புகள்',
    settings: 'அமைப்புகள்',
    search: 'தேடுக...',
    all: 'அனைத்தும்',
    save: 'சேமிக்க',
    cancel: 'ரத்து',
    delete: 'நீக்கு',
    print: 'அச்சிடுக (Print)',
    export_csv: 'CSV பதிவிறக்கம்',
    status: 'நிலை',
    date: 'தேதி',
    actions: 'செயல்கள்',

    // Tracking & Public Receipt
    live_tracking_title: 'நேரடி டெலிவரி நிலை',
    order_details: 'ஆர்டர் விவரங்கள்',
    dispatch_ref: 'டெலிவரி எண் (Ref)',
    vehicle_info: 'வாகனம்',
    driver_info: 'ஓட்டுநர் பெயர்',
    call_driver: 'ஓட்டுநரை அழைக்க',
    delivery_location: 'டெலிவரி முகவரி',
    items_loaded: 'ஏற்றப்பட்ட பொருட்கள்',
    verified_weight: 'எடை விவரம் (Scale Weight)',
    gross_wt: 'மொத்த எடை (Gross)',
    tare_wt: 'வாகன எடை (Tare)',
    net_wt: 'பொருட்களின் எடை (Net)',
    financial_breakdown: 'பில் மற்றும் கட்டண விவரம்',
    total_bill: 'மொத்த பில் தொகை',
    advance_paid: 'செலுத்தப்பட்ட முன்பணம்',
    balance_to_collect: 'டெலிவரியில் செலுத்த வேண்டிய தொகை',
    payment_status: 'பணம் செலுத்திய நிலை',
    status_pending: 'ஆர்டர் தயாராகிறது',
    status_out_for_delivery: 'வாகனம் புறப்பட்டது 🚚',
    status_delivered: 'டெலிவரி செய்யப்பட்டது ✅',
    pod_photo: 'டெலிவரி புகைப்பட ஆதாரம் (POD)',
    download_bill: 'அதிகாரப்பூர்வ பில் பதிவிறக்கம் (PDF)',
    need_help: 'உதவி தேவையா?',
    contact_office: 'அன்பு டிரேடர்ஸ் அலுவலகத்தை தொடர்பு கொள்ள',

    // Customer Ledger
    total_billed: 'மொத்த விற்பனை',
    total_paid: 'செலுத்தப்பட்ட தொகை',
    total_dues: 'மொத்த பாக்கி தொகை (Dues)',
    send_payment_reminder: 'WhatsApp பாக்கி நினைவூட்டல்',
    view_statement: 'முழு கணக்கு பார்க்க',
    credit_status: 'கடன் நிலை',
    settled: 'முழுவதும் செலுத்தப்பட்டது',
    dues_pending: 'பாக்கி உள்ளது',
    last_payment: 'கடைசி பரிவர்த்தனை',

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
