"""Offline language routing. Broad language coverage is provided by the LLM."""
import re

SUMMARIES = {
    'en': "Welcome to Location Ennour. Choose a car, dates and agencies, sign in and confirm the server quote. Rental = daily rate × days. Premium insurance: 90 MAD/day; child seat: 35; extra driver: 50. The refundable deposit is separate. Find your contract and cancel a confirmed booking before pickup in My bookings. Your request needs admin approval. Only admins add cars and agencies. Pay by TEST card before submitting your request (holder, test number, expiry and CVC). No real charge or saved card data. Paid pending requests already block the car for those dates. Rejection or cancellation gives a simulated refund. Contact the agency for other conditions.",
    'ar': "مرحبا بك في Location Ennour. اختر السيارة والتواريخ والوكالات، ثم سجل الدخول وراجع عرض السعر قبل التأكيد. الثمن = السعر اليومي × عدد الأيام. التأمين الإضافي: 90 درهم/اليوم؛ كرسي الطفل: 35؛ سائق إضافي: 50. مبلغ الضمان منفصل. العقد وإلغاء الحجز المؤكد قبل الاستلام متاحان في حجوزاتي. طلبك يحتاج موافقة الإدارة. الإدارة وحدها تضيف السيارات والوكالات. الدفع ببطاقة اختبار يسبق إرسال الطلب: اسم الحامل ورقم الاختبار والصلاحية وCVC. لا خصم حقيقي ولا حفظ لبيانات البطاقة. الطلب المدفوع يحجز السيارة في التواريخ المختارة، والرفض أو الإلغاء يؤدي لاسترداد تجريبي. للشروط الأخرى تواصل مع الوكالة.",
    'ary': "مرحبا بيك فـ Location Ennour! ختار الطوموبيل والتواريخ والوكالات، دخل لحسابك وشوف الديفي قبل ما تأكد. الثمن هو ثمن النهار × عدد الأيام. التأمين بريميوم 90 درهم فالنهار، كرسي الطفل 35، والسائق الإضافي 50. الكوسيون بوحدها وما داخلاش فالثمن. العقد والإلغاء قبل ما تاخذ الطوموبيل كاينين فحجوزاتي. الطلب كيتسنى موافقة الأدمن. غير الأدمن كيضيف الطوموبيلات والوكالات. خاصك تخلص بكارت تيست قبل إرسال الطلب: الاسم ورقم التيست والصلاحية وCVC. بلا اقتطاع حقيقي وبلا تخزين معلومات الكارت. الطلب كيبلوكي الطوموبيل فالتواريخ ديالك، والرفض أو الإلغاء كيرجع المبلغ بشكل تجريبي. شي شرط آخر سول عليه الوكالة.",
    'es': "Bienvenido a Location Ennour. Elige coche, fechas y agencias, inicia sesión y confirma el presupuesto. Precio = tarifa diaria × días. Seguro premium: 90 MAD/día; silla infantil: 35; conductor adicional: 50. La fianza se indica aparte. El contrato y la cancelación antes de recoger un alquiler confirmado están en Mis reservas. Tu solicitud requiere aprobación del administrador. Solo el administrador publica coches y agencias. El pago con tarjeta de PRUEBA precede a la solicitud: titular, número de prueba, caducidad y CVC. No hay cargos reales ni datos de tarjeta guardados. La solicitud pagada bloquea las fechas; el rechazo o cancelación simula el reembolso. Consulta otras condiciones con la agencia.",
    'de': "Willkommen bei Location Ennour. Auto, Termine und Stationen wählen, anmelden und das Angebot bestätigen. Preis = Tagespreis × Tage. Premiumversicherung: 90 MAD/Tag; Kindersitz: 35; Zusatzfahrer: 50. Die Kaution ist separat. Vertrag und Stornierung einer bestätigten Buchung vor Abholung finden Sie unter Meine Buchungen. Ihre Anfrage muss vom Admin genehmigt werden. Nur Admins veröffentlichen Autos und Stationen. TEST-Kartenzahlung erfolgt vor der Anfrage: Inhaber, Testnummer, Ablaufdatum und CVC. Keine echte Abbuchung oder gespeicherten Kartendaten. Die bezahlte Anfrage sperrt die Termine; Ablehnung oder Stornierung simuliert eine Erstattung. Weitere Bedingungen bitte bei der Station erfragen.",
    'it': "Benvenuto da Location Ennour. Scegli auto, date e agenzie, accedi e conferma il preventivo. Prezzo = tariffa giornaliera × giorni. Assicurazione premium: 90 MAD/giorno; seggiolino: 35; conducente aggiuntivo: 50. La cauzione è separata. Contratto e annullamento prima del ritiro sono disponibili in Le mie prenotazioni. La richiesta richiede approvazione dell’amministratore. Solo gli amministratori pubblicano auto e agenzie. Il pagamento con carta TEST precede la richiesta: titolare, numero di prova, scadenza e CVC. Nessun addebito reale o dato carta salvato. La richiesta pagata blocca le date; rifiuto o annullamento simula il rimborso. Per altre condizioni contatta l'agenzia.",
    'pt': "Bem-vindo à Location Ennour. Escolha carro, datas e agências, entre na conta e confirme o orçamento. Preço = tarifa diária × dias. Seguro premium: 90 MAD/dia; cadeira infantil: 35; condutor adicional: 50. A caução é separada. O contrato e o cancelamento antes da retirada ficam em Minhas reservas. O pedido requer aprovação do administrador. Só administradores publicam carros e agências. O pagamento com cartão TESTE vem antes do pedido: titular, número de teste, validade e CVC. Sem cobrança real ou dados do cartão guardados. O pedido pago bloqueia as datas; recusa ou cancelamento simula o reembolso. Consulte a agência para outras condições.",
}

def detect_language(message: str, requested: str = 'auto') -> str:
    if requested and requested != 'auto':
        return requested
    text = message.lower()
    if re.search(r'\b(salam|bghit|chhal|wach|kifach|3afak|tomobil|kri|labas|bchhal)\b', text) or any(w in text for w in ('بغيت', 'شحال', 'واش', 'كيدا', 'كراء', 'سلام', 'طوموبيل')):
        return 'ary'
    if re.search('[\u0600-\u06ff]', text):
        return 'ar'
    patterns = {
        'es': r'\b(hola|precio|cuanto|cuánto|quiero|alquilar|coche|gracias|reserva)\b',
        'de': r'\b(hallo|guten|mieten|auto|preis|wie|kaution|danke)\b',
        'it': r'\b(ciao|buongiorno|quanto|noleggiare|prezzo|grazie|prenotazione)\b',
        'pt': r'\b(ola|olá|obrigado|alugar|preço|carro|reservaçao|reservaç[ãa]o)\b',
        'en': r'\b(hello|hi|how|what|can|want|rent|rental|price|deposit|insurance|book|cancel|thanks|my|remember|explain|why|please|double|favorite)\b',
    }
    for language, pattern in patterns.items():
        if re.search(pattern, text):
            return language
    return 'fr'

def offline_reply(message: str, requested: str, french_faq) -> str:
    language = detect_language(message, requested)
    if language == 'fr':
        return french_faq(message)
    return SUMMARIES.get(language, "The local assistant supports French, Arabic, Darija, English, Spanish, German, Italian and Portuguese. Other languages require the AI service. Please choose one of these languages or contact the agency.")
