import sys
import re

with open('src/views/Dispatches.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove saveVehicle
content = re.sub(r'  const saveVehicle = async \(\) => \{.*?\n  \};\n\n', '', content, flags=re.DOTALL)

# 2. Remove Whatsapp logic from completeDispatch
whatsapp_logic = r'''
    // Open WhatsApp prompt pre-filled with customer's contact number
    const customerName = detail\.customer\?\.name \?\? 'Unknown';
    const itemsList = detailItems
      \.map\(\(it\) => `• \$\{it\.product_name\}: \$\{it\.quantity\} \$\{it\.unit\} @ ₹\$\{\(it\.price \?\? 0\)\.toFixed\(2\)\}`\)
      \.join\('\\n'\);
    const msg = \[
      `Hello \$\{customerName\},`,
      ``,
      `Your dispatch \*\$\{detail\.dispatch_no\}\* has been completed\.`,
      ``,
      `Items:`,
      itemsList,
      ``,
      `Grand Total: \*₹\$\{grandTotal\.toFixed\(2\)\}\*`,
      detail\.vehicle_number \? `Vehicle: \$\{detail\.vehicle_number\}` : '',
      detail\.delivery_address \? `Delivery Address: \$\{detail\.delivery_address\}` : '',
      ``,
      `Thank you for your business!`,
    \]\.filter\(Boolean\)\.join\('\\n'\);
    setWhatsappNumber\(detail\.customer\?\.phone \?\? ''\);
    setWhatsappMessage\(msg\);
    setWhatsappOpen\(true\);
'''
content = re.sub(whatsapp_logic, '', content, flags=re.DOTALL)

# 3. Remove sendWhatsapp function
content = re.sub(r'  const sendWhatsapp = \(\) => \{.*?\n  \};\n\n', '', content, flags=re.DOTALL)

# 4. Remove Vehicle section
vehicle_section = r'''                <section>\n                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">\n                    <Truck size=\{16\} className="text-amber-600" /> Vehicle & Dispatch Team.*?</section>'''
content = re.sub(vehicle_section, '', content, flags=re.DOTALL)

# 5. Remove Whatsapp Modal
whatsapp_modal = r'''      <Modal open=\{whatsappOpen\} onClose=\{\(\) => setWhatsappOpen\(false\)\} title="Send WhatsApp Message" size="md">.*?</Modal>'''
content = re.sub(whatsapp_modal, '', content, flags=re.DOTALL)

with open('src/views/Dispatches.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
