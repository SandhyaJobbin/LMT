/* =====================================================================
   LMT PLACES SIMULATOR — BUILT-IN CASE BANK (50 cases, Day 1–5)
   ---------------------------------------------------------------------
   • 30 "Approve" cases are REAL homestays registered with Kerala Tourism
     (keralatourism.org → Where to Stay → Homestays). Answers were taken
     from those listings in October 2026. Agents find them with Google,
     Google Maps, the Kerala Tourism page and the property's own site.
     Spot-check on tripadvisor.com before each wave — if one has since
     been listed, switch it Off or change it to an Alias case.
   • 5 "Alias" cases are well-known hotels already on Tripadvisor.
   • 5 "Not an accommodation" cases are real non-lodging places.
   • 10 cases (Unverifiable / Tier 2) use INVENTED names on purpose —
     nothing exists online, and all evidence is inside LMT. No real
     business is named in any fraud or safety scenario.
   Edit or replace any case from Admin → Questions (Export → edit → Upload).
   ===================================================================== */

const BRANDS = ['CGH Earth', 'Taj Hotels', 'ITC Hotels', 'The Leela', 'Marriott', 'Hilton', 'Accor', 'OYO', 'Treebo', 'FabHotels', 'Zostel', 'Sterling Holidays'];

const ACCOM_TYPES = ['Hotel', 'Resort', 'Motel', 'B&B / Inn', 'Guest House', 'Hostel', 'Specialty Lodging', 'Apartment Hotel', 'Campground / Glamping'];

const DECISIONS = {
  approve: { label: 'Approve – Create New', short: 'Approve', color: '#1f7a3a', icon: '✔' },
  alias:   { label: 'Add Name as Alias (Match Exists)', short: 'Alias', color: '#0b5d3b', icon: '＋' },
  reject:  { label: 'Reject / Close Request', short: 'Reject', color: '#d6322b', icon: '✖' },
  t1:      { label: 'Escalate to Tier 1', short: 'Tier 1', color: '#7b4fd6', icon: '⬆' },
  t2:      { label: 'Escalate to Tier 2', short: 'Tier 2', color: '#5a2ca0', icon: '⏫' },
  defer:   { label: 'Defer – Keep In Progress', short: 'Defer', color: '#2a9fd6', icon: '⏱' }
};

const REASONS = {
  new_verified:        { d: 'approve', label: 'New property – verified across sources' },
  duplicate:           { d: 'alias',   label: 'Existing Tripadvisor listing – add feed name as alias' },
  closed:              { d: 'reject',  label: 'Permanently closed' },
  not_accommodation:   { d: 'reject',  label: 'Not an accommodation' },
  unverifiable:        { d: 'reject',  label: 'Unverifiable – no evidence the property exists' },
  conflict:            { d: 't1',      label: 'Conflicting data between sources' },
  location_unconfirmed:{ d: 't1',      label: 'Exact location cannot be confirmed' },
  fraud:               { d: 't2',      label: 'Suspected fraud / scam indicators' },
  brand_dispute:       { d: 't2',      label: 'Brand or ownership dispute' },
  safety_legal:        { d: 't2',      label: 'Safety or legal concern' },
  preopening:          { d: 'defer',   label: 'Not open yet (pre-opening / under construction)' },
  awaiting_info:       { d: 'defer',   label: 'Awaiting more information from provider' }
};

/* ---------- Parent geos (real places; IDs are simulator IDs) ---------- */
const GEOS = [
  { id: 'g2001', name: 'Munnar', path: 'Idukki District, Kerala, India', cc: 'IN' },
  { id: 'g2002', name: 'Devikulam', path: 'Idukki District, Kerala, India', cc: 'IN' },
  { id: 'g2003', name: 'Adimali', path: 'Idukki District, Kerala, India', cc: 'IN' },
  { id: 'g2004', name: 'Kumily (Thekkady)', path: 'Idukki District, Kerala, India', cc: 'IN' },
  { id: 'g2005', name: 'Vagamon', path: 'Idukki District, Kerala, India', cc: 'IN' },
  { id: 'g2006', name: 'Kochi (Cochin)', path: 'Ernakulam District, Kerala, India', cc: 'IN' },
  { id: 'g2007', name: 'Kochi', path: 'Kochi Prefecture, Shikoku, Japan', cc: 'JP' },
  { id: 'g2008', name: 'Ambalavayal', path: 'Wayanad District, Kerala, India', cc: 'IN' },
  { id: 'g2009', name: 'Kalpetta', path: 'Wayanad District, Kerala, India', cc: 'IN' },
  { id: 'g2010', name: 'Vythiri', path: 'Wayanad District, Kerala, India', cc: 'IN' },
  { id: 'g2011', name: 'Alappuzha (Alleppey)', path: 'Alappuzha District, Kerala, India', cc: 'IN' },
  { id: 'g2012', name: 'Mararikulam', path: 'Alappuzha District, Kerala, India', cc: 'IN' },
  { id: 'g2013', name: 'Kumarakom', path: 'Kottayam District, Kerala, India', cc: 'IN' },
  { id: 'g2014', name: 'Varkala', path: 'Thiruvananthapuram District, Kerala, India', cc: 'IN' },
  { id: 'g2015', name: 'Kovalam', path: 'Thiruvananthapuram District, Kerala, India', cc: 'IN' },
  { id: 'g2016', name: 'Kovalam (Covelong)', path: 'Chengalpattu District, Tamil Nadu, India', cc: 'IN' },
  { id: 'g2017', name: 'Thiruvananthapuram (Trivandrum)', path: 'Thiruvananthapuram District, Kerala, India', cc: 'IN' },
  { id: 'g2018', name: 'Ponmudi', path: 'Thiruvananthapuram District, Kerala, India', cc: 'IN' },
  { id: 'g2019', name: 'Kannur', path: 'Kannur District, Kerala, India', cc: 'IN' },
  { id: 'g2020', name: 'Taliparamba', path: 'Kannur District, Kerala, India', cc: 'IN' },
  { id: 'g2021', name: 'Kozhikode (Calicut)', path: 'Kozhikode District, Kerala, India', cc: 'IN' },
  { id: 'g2022', name: 'Payyoli', path: 'Kozhikode District, Kerala, India', cc: 'IN' },
  { id: 'g2023', name: 'Munroe Island', path: 'Kollam District, Kerala, India', cc: 'IN' },
  { id: 'g2024', name: 'Kollam', path: 'Kollam District, Kerala, India', cc: 'IN' },
  { id: 'g2025', name: 'Thrissur', path: 'Thrissur District, Kerala, India', cc: 'IN' },
  { id: 'g2026', name: 'Tiruchirappalli (Trichy)', path: 'Tiruchirappalli District, Tamil Nadu, India', cc: 'IN' },
  { id: 'g2027', name: 'Chalakudy', path: 'Thrissur District, Kerala, India', cc: 'IN' },
  { id: 'g2028', name: 'Athirappilly', path: 'Thrissur District, Kerala, India', cc: 'IN' },
  { id: 'g2029', name: 'Muthalamada', path: 'Palakkad District, Kerala, India', cc: 'IN' },
  { id: 'g2030', name: 'Palakkad', path: 'Palakkad District, Kerala, India', cc: 'IN' },
  { id: 'g2031', name: 'Bekal', path: 'Kasaragod District, Kerala, India', cc: 'IN' },
  { id: 'g2032', name: 'Cherai', path: 'Vypin Island, Ernakulam District, Kerala, India', cc: 'IN' },
  { id: 'g2033', name: 'Mumbai (Bombay)', path: 'Maharashtra, India', cc: 'IN' },
  { id: 'g2034', name: 'Singapore', path: 'Singapore', cc: 'SG' },
  { id: 'g2035', name: 'Chithirapuram', path: 'Munnar, Idukki District, Kerala, India (neighbourhood – not a parent geo)', cc: 'IN', noParent: true },
  { id: 'g2036', name: 'Fort Kochi', path: 'Kochi, Ernakulam District, Kerala, India (neighbourhood – not a parent geo)', cc: 'IN', noParent: true }
];

const CASES = [

/* =========================== DAY 1 — FUNDAMENTALS =========================== */
{ id: 'D1-01', source: 'https://www.keralatourism.org/homestays/snow-moon-homestay/4038', day: 1, q: 1, req: 121553365,
  feed: { name: 'SNOW MOON HOMESTAY', street: 'Pattamthanath House', postal: '685565', parentText: 'IN, Munnar', phone: '8848019141', type: 'Hotel', lat: 10.0402, lng: 77.0571 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Snow Moon Homestay', street: ['Pattamthanath House, Chithirapuram', 'Pattamthanath House'], postal: '685565', parent: 'g2001',
    phone: '+91 88480 19141', email: ['snowmoonhomestay@gmail.com', 'info@snowmoonhomestay.com'], url: ['http://www.snowmoonhomestay.com', ''], type: 'Guest House', lat: 10.028392, lng: 77.045577 },
  geoTol: 300,
  tip: 'Feed was in ALL CAPS, the phone had no +91 and the pin was 1.7 km off. It is a homestay, so Guest House, not Hotel. Chithirapuram is a neighbourhood — the parent is Munnar. Source: the Kerala Tourism listing, the official site and Google Maps.' },

{ id: 'D1-02', source: 'https://www.keralatourism.org/homestays/green-horizon-homestay/8482', day: 1, q: 2, req: 121553402,
  feed: { name: 'Green Horizon Home Stay', street: 'Fort Nagar', postal: '682001', parentText: 'Kochi', phone: '8891077232', lat: 33.5597, lng: 133.5311 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Green Horizon Homestay', street: ['Fort Nagar, Fort Kochi', 'Fort Nagar'], postal: '682001', parent: 'g2006',
    phone: '+91 88910 77232', email: 'greenhorizonstay@gmail.com', url: ['http://www.greenhorizonstay.com', ''], type: 'Guest House', lat: 9.966791, lng: 76.244514 },
  geoTol: 250,
  tip: 'The feed pin landed in Kochi, JAPAN. Always check the country when you pick a parent. Fort Kochi is a neighbourhood of Kochi (Cochin), Kerala.' },

{ id: 'D1-03', source: 'https://www.keralatourism.org/homestays/kerala-spices-homestay/8592', day: 1, q: 3, req: 121553418,
  feed: { name: 'Kerala Spices Homestay Thekkady', street: 'Kollaparambil House', postal: '685509', parentText: 'IN, Thekkady', phone: '9947330134', lat: 9.6040, lng: 77.1680 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Kerala Spices Homestay', street: ['Kollaparambil House, Valiyakandam', 'Kollaparambil House'], street2: ['Valiyakandam', ''], postal: '685509', parent: 'g2004',
    phone: '+91 99473 30134', email: 'keralaspiceshomestay@gmail.com', url: ['http://www.keralaspiceshomestay.com', ''], type: 'Guest House', lat: 9.610758, lng: 77.161763 },
  geoTol: 300,
  tip: 'Don\'t keep a city the feed added to the name ("…Thekkady") unless the property uses it. Thekkady sits inside Kumily — pick "Kumily (Thekkady)".' },

{ id: 'D1-04', source: 'https://www.keralatourism.org/homestays/bougainvillea-homestay/7044', day: 1, q: 4, req: 121553431,
  feed: { name: 'BOUGAINVILLEA HOMESTAY', street: 'K N VIHAR, NORTH CLIFF HELIPAD ROAD', postal: '695141', parentText: 'IN, Varkala', phone: '8590794534', lat: 8.7379, lng: 76.7163 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Bougainvillea Homestay', street: ['K N Vihar, North Cliff Helipad Road', 'KN Vihar, North Cliff Helipad Road'], postal: '695141', parent: 'g2014',
    phone: ['+91 85907 94534', '+91 90740 58901'], email: 'bougainvilleahomestays@gmail.com', url: ['http://bougainvilleahomestays.in', ''], type: 'Guest House', lat: 8.737694, lng: 76.706133 },
  geoTol: 250,
  tip: 'ALL CAPS name and street must be converted to proper case. Two phone numbers exist — either one in +91 format is fine.' },

{ id: 'D1-05', source: 'https://www.keralatourism.org/homestays/ananda-homestay/6508', day: 1, q: 5, req: 121553447,
  feed: { name: 'Ananda Home Stay Wayanad', street: 'Nellarachal', postal: '673593', parentText: 'IN, Kalpetta', phone: '9744445288', rooms: '6', lat: 11.6103, lng: 76.0830 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Ananda Homestay', street: ['Nellarachal, Ambalavayal', 'Nellarachal'], postal: '673593', parent: 'g2008',
    phone: ['+91 97444 45288', '+91 98959 90948'], email: ['anandawayanad@gmail.com', 'drlijikrishnan@gmail.com'], url: 'https://www.anandawayanad.com', type: 'Guest House', rooms: 4, lat: 11.5952849, lng: 76.1847973 },
  geoTol: 300,
  tip: 'The feed said Kalpetta and 6 rooms. The homestay\'s own description says four guest rooms, and it is in Ambalavayal, about 11 km away. The property\'s own words beat the feed.' },

{ id: 'D1-06', source: 'https://www.keralatourism.org/homestays/royal-mist/3831', day: 1, q: 6, req: 121553460,
  feed: { name: 'Royal Mist Homestay', postal: '685565', parentText: 'IN, Munnar', phone: '9495444123', lat: 10.0889, lng: 77.0595 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Royal Mist', 'Royal Mist Homestay'], street: ['Chithirapuram', 'Chithirapuram, Munnar'], postal: '685565', parent: 'g2001',
    phone: ['+91 94954 44123', '+91 94470 31814'], email: 'royalmistmunnar@gmail.com', url: ['http://www.royalmist.in', ''], type: 'Guest House', lat: 10.030762, lng: 77.037892 },
  geoTol: 300,
  tip: 'The feed pin sat in Munnar town centre, about 6.5 km from the property in Chithirapuram. Re-pin from Google Maps or the Kerala Tourism map.' },

{ id: 'D1-07', source: 'https://www.keralatourism.org/homestays/thayil-kadaloram-homestay/6232', day: 1, q: 7, req: 121553476,
  feed: { name: 'Thayil Kadaloram Homestay', street: 'Beach Road', postal: '695527', parentText: 'Kovalam', phone: '0471 2481934', lat: 12.7900, lng: 80.2540 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Thayil Kadaloram Homestay', street: ['Beach Road', 'Beach Road, Kovalam'], postal: '695527', parent: 'g2015',
    phone: ['+91 471 248 1934', '+91 73066 63669'], email: 'thayilkadaloram@gmail.com', url: '', type: 'Guest House', lat: 8.390082, lng: 76.976099 },
  geoTol: 250,
  tip: 'There are two Kovalams: the beach town in Kerala and Kovalam (Covelong) near Chennai — the feed pin was in Tamil Nadu. Landline 0471… becomes +91 471…. No website exists, so URL stays blank.' },

{ id: 'D1-08', day: 1, q: 8, req: 121553489,
  feed: { name: 'Kumarakom Lake Resort & Ayurveda Spa', street: 'Kumarakom North', postal: '686563', parentText: 'IN, Kumarakom', type: 'Resort', lat: 9.6176, lng: 76.4278 },
  ans: { decision: 'alias', reason: 'duplicate', name: 'Kumarakom Lake Resort', parent: 'g2013', type: 'Resort', lat: 9.6176, lng: 76.4278 },
  tip: 'A famous resort that has been on Tripadvisor for years. The feed just added words to the name. Search tripadvisor.com, open the existing listing, paste its link and add the feed name as an alias — never create a duplicate.' },

{ id: 'D1-09', day: 1, q: 9, req: 121553502,
  feed: { name: 'Mattancherry Palace Heritage Stay', street: 'Palace Road, Mattancherry', postal: '682002', parentText: 'IN, Kochi', type: 'Hotel', lat: 9.9583, lng: 76.2593 },
  ans: { decision: 'reject', reason: 'not_accommodation', name: 'Mattancherry Palace', parent: 'g2006', type: '', lat: 9.9583, lng: 76.2593 },
  tip: 'Mattancherry Palace (the Dutch Palace) is a museum. Nobody can book a room there — a monument is not an accommodation. Reject.' },

{ id: 'D1-10', day: 1, q: 10, req: 121553517,
  feed: { name: 'Amberleaf Spice Court', street: 'Rosappookandam Road', postal: '685509', parentText: 'IN, Thekkady', type: 'Hotel', rooms: '22', lat: 9.6080, lng: 77.1660, desc: 'Luxury spice-garden hotel with pool. Best rates guaranteed.' },
  ans: { decision: 'reject', reason: 'unverifiable', name: 'Amberleaf Spice Court', parent: 'g2004', lat: 9.6080, lng: 77.1660 },
  src: { audit: [{ date: '2026-09-30 03:12', who: 'Hopper bulk import', what: 'Request created – 1 of 4,812 records in batch HB-0930' }] },
  tip: 'Google, Google Maps, Facebook, Instagram and Kerala Tourism show nothing for this name, and the feed gives no phone or website. With zero evidence the property exists, Reject as Unverifiable.' },

/* =========================== DAY 2 — FEED CLEAN-UP =========================== */
{ id: 'D2-01', source: 'https://www.keralatourism.org/homestays/the-haven-munnar/4071', day: 2, q: 1, req: 121560044,
  feed: { name: 'The Haven', street: '10/40 THOKKUPARA JN', postal: '685565', parentText: 'IN, Munnar', phone: '04865 263617', lat: 10.0251, lng: 77.0263 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'The Haven Munnar', street: ['10/40, Thokkupara Junction', '10/40 Thokkupara Junction'], postal: '685565', parent: 'g2001',
    phone: ['+91 4865 263617', '+91 94000 37623', '+91 83018 83617'], email: ['thehavenmunnar@gmail.com', 'agilehomestay@gmail.com'], url: ['http://www.thehavenmunnar.com', ''], type: 'Guest House', lat: 10.025238, lng: 77.026144 },
  geoTol: 250,
  tip: 'Here the city IS part of the official name: "The Haven Munnar". Expand "JN" to Junction, and convert 04865… to +91 4865….' },

{ id: 'D2-02', source: 'https://www.keralatourism.org/homestays/linn-view-home-stay-munnar/6228', day: 2, q: 2, req: 121560061,
  feed: { name: 'LINN VIEW HOMESTAY', street: 'Mathalipara House', postal: '685612', parentText: 'IN, Munnar', phone: '9446743768', lat: 10.0066, lng: 77.0067 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Linn View Home Stay Munnar', 'Linn View Home Stay', 'Linn View Homestay'], street: ['Mathalipara House, Anaviratty', 'Mathalipara House'], postal: '685561', parent: 'g2001',
    phone: ['+91 94467 43768', '+91 95447 43767'], email: 'linviewhomestay@gmail.com', url: '', type: 'Guest House', lat: 10.006629, lng: 77.006671 },
  geoTol: 300,
  tip: 'The feed sent Munnar town\'s PIN (685612). The property is in Anaviratty — PIN 685561. Reject wrong feed values with ✖ instead of copying them.' },

{ id: 'D2-03', source: 'https://www.keralatourism.org/homestays/hill-mist/6835', day: 2, q: 3, req: 121560078,
  feed: { name: 'Hill Mist Homestay Kumily', street: '1st Mile, Kumily Munnar Rd', postal: '685509', parentText: 'IN, Kumily', phone: '+91-9846579205', lat: 9.6195, lng: 77.1620 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Hill Mist', 'Hill Mist Homestay'], street: ['1st Mile, Kumily Munnar Road', '1st Mile Kumily To Munnar Road', 'First Mile, Kumily Munnar Road'], postal: '685509', parent: 'g2004',
    phone: '+91 98465 79205', email: 'hillmist.booking@gmail.com', url: '', type: 'Guest House', lat: 9.619458, lng: 77.162006 },
  geoTol: 200,
  tip: 'Remove the city the feed appended to the name and expand "Rd" to Road. No website exists — leave URL blank.' },

{ id: 'D2-04', source: 'https://www.keralatourism.org/homestays/angel-homestay/6758', day: 2, q: 4, req: 121560093,
  feed: { name: 'Angel Homestay', street: 'THEKKUMMURIYIL', postal: '688001', parentText: 'IN, Alleppey', phone: '8606606451', lat: 9.4981, lng: 76.3388 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Angel Homestay', street: ['Thekkummuriyil, Punnapra', 'Thekkummuriyil'], street2: ['Punnapra', ''], postal: '688004', parent: 'g2011',
    phone: '+91 86066 06451', email: ['angelhomestayalpy4@gmail.com', 'bozkojone@gmail.com'], url: '', type: 'Guest House', lat: 9.45074, lng: 76.34122 },
  geoTol: 300,
  tip: 'Wrong PIN in the feed (688001 is Alappuzha town). The homestay is in Punnapra, PIN 688004, about 5 km south.' },

{ id: 'D2-05', source: 'https://www.keralatourism.org/homestays/paddy-n-canal-homestay/6764', day: 2, q: 5, req: 121560110,
  feed: { name: 'PADDY & CANAL HOMESTAY', brand: 'OYO', street: 'Near KSRTC Bus Stand', postal: '688011', parentText: 'IN, Alappuzha', phone: '06282644098', lat: 9.4982, lng: 76.3497 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Paddy N Canal Homestay', "Paddy 'N' Canal Homestay"], brand: '', street: ['Near KSRTC Bus Stand', 'Near Alleppey KSRTC Bus Stand'], street2: ['East of Alappuzha Fire Station', ''], postal: '688011', parent: 'g2011',
    phone: ['+91 62826 44098', '+91 96459 63812'], email: ['paddyncanal@gmail.com', 'robinpsunil2002@gmail.com'], url: '', type: 'Guest House', lat: 9.4982, lng: 76.349674 },
  geoTol: 200,
  tip: 'The feed claimed an OYO brand — no OYO page lists this homestay, so Brand must stay blank. Write the name the way the property does ("Paddy N Canal"), and drop the 0 before the mobile number.' },

{ id: 'D2-06', source: 'https://www.keralatourism.org/homestays/illusion-homestay/7271', day: 2, q: 6, req: 121560127,
  feed: { name: 'Illusion Homestay', street: 'West of Janardhana Swamy Temple', postal: '695141', parentText: 'IN, Varkala', phone: '9446237733/9446089494', lat: 8.7320, lng: 76.7076 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Illusion Homestay', street: ['Near Devaswom Campshed, Janardhanapuram', 'Near Devaswom Campshed, West of Janardhana Swamy Temple', 'West of Janardhana Swamy Temple, Janardhanapuram'], postal: '695141', parent: 'g2014',
    phone: ['+91 94462 37733', '+91 94460 89494'], email: ['illusion.varkala@gmail.com', 'vijayakumarg1963@gmail.com'], url: '', type: 'Guest House', lat: 8.73197, lng: 76.70764 },
  geoTol: 200,
  tip: 'The feed crammed two phone numbers into one field. Enter ONE number in +91 format.' },

{ id: 'D2-07', source: 'https://www.keralatourism.org/homestays/blue-lagoon-mundro-homestay/8967', day: 2, q: 7, req: 121560143,
  feed: { name: 'Blue Lagoon Munroe Homestay', street: 'Muttom', postal: '691502', parentText: 'IN, Kollam', phone: '9846326475', lat: 8.8932, lng: 76.6141 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Blue Lagoon Mundro Homestay', 'Blue Lagoon Munroe Homestay', 'Blue Lagoon Munroe'], street: ['Muttom, East Kallada', 'Muttom'], postal: '691502', parent: 'g2023',
    phone: '+91 98463 26475', email: 'info@bluelagoonmunroe.com', url: 'https://bluelagoonmunroe.com', type: 'Guest House', lat: 8.992646, lng: 76.643463 },
  geoTol: 300,
  tip: 'The feed pin was in Kollam city, 11 km away. Munroe Island is its own parent geo.' },

{ id: 'D2-08', day: 2, q: 8, req: 121560158,
  feed: { name: 'CGH Earth Brunton Boatyard Hotel Fort Kochi', street: 'Calvetty Road', postal: '682001', parentText: 'IN, Kochi', type: 'Hotel', lat: 9.9666, lng: 76.2427 },
  ans: { decision: 'alias', reason: 'duplicate', name: 'Brunton Boatyard', parent: 'g2006', type: 'Hotel', lat: 9.9666, lng: 76.2427 },
  tip: 'Brunton Boatyard is a long-established Fort Kochi hotel already on Tripadvisor. "CGH Earth … Hotel Fort Kochi" is just brand + city padding. Paste the existing listing link and add the alias.' },

{ id: 'D2-09', day: 2, q: 9, req: 121560176,
  feed: { name: 'Kathakali Centre Guest Rooms', street: 'K.B. Jacob Road', postal: '682001', parentText: 'IN, Fort Kochi', type: 'Guest House', lat: 9.9658, lng: 76.2421 },
  ans: { decision: 'reject', reason: 'not_accommodation', name: 'Kerala Kathakali Centre', parent: 'g2006', type: '', lat: 9.9658, lng: 76.2421 },
  tip: 'The Kerala Kathakali Centre is a performance and cultural venue (shows, classes). It has no rooms for guests — Reject as not an accommodation.' },

{ id: 'D2-10', day: 2, q: 10, req: 121560190,
  feed: { name: 'Goldcoast Sapphire Villas', street: 'Cherai Beach Road', postal: '683514', parentText: 'IN, Cherai', type: 'Resort', email: 'goldcoast.sapphire.booking@gmail.com', url: 'https://cheraigoldcoast-villas.example', lat: 10.1418, lng: 76.1780,
    desc: 'FLAT 50% OFF this week only! Pay 100% advance by UPI to the owner\'s personal ID to confirm. No refunds. Contact on WhatsApp only.' },
  ans: { decision: 't2', reason: 'fraud', name: 'Goldcoast Sapphire Villas', parent: 'g2032', type: 'Resort', lat: 10.1418, lng: 76.1780 },
  src: { votes: [
    { type: 'Scam', comment: 'Paid ₹18,000 advance by UPI, no villa at this address. Number switched off.', user: 'traveller_anu', email: 'an***@mail.com', owner: 'No', date: '2026-09-28' },
    { type: 'Scam', comment: 'Same photos are used by a resort in Goa. Fake listing.', user: 'kochi_explorer', email: 'ko***@mail.com', owner: 'No', date: '2026-10-02' } ] },
  tip: 'Nothing exists online, AND the request itself carries scam signals: 100% advance to a personal UPI ID, WhatsApp-only contact, scam votes. That is fraud → Tier 2, never a simple Reject.' },

/* =========================== DAY 3 — PARENTS & GEO TRAPS =========================== */
{ id: 'D3-01', source: 'https://www.keralatourism.org/homestays/signature-homestay/6378', day: 3, q: 1, req: 121571203,
  feed: { name: 'Signature Homestay', street: 'Vayanasaala Rd', postal: '685565', parentText: 'IN, Kunchithanny', phone: '9447821288', lat: 10.0889, lng: 77.0595 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Signature Homestay', street: ['Vayanasaala Road, Kunchithanny', 'Vayanasaala Road'], postal: '685565', parent: ['g2001', 'g2003'],
    phone: '+91 94478 21288', email: 'suryashibu75@gmail.com', url: '', type: 'Guest House', lat: 10.0190964, lng: 77.0628583 },
  geoTol: 300,
  tip: 'Kunchithanny isn\'t a parent geo — use the nearest real one (Munnar). The feed pin was in Munnar town, 7.7 km north of the property.' },

{ id: 'D3-02', source: 'https://www.keralatourism.org/homestays/greenshore/7757', day: 3, q: 2, req: 121571219,
  feed: { name: 'GREENSHORE VILLA VAGAMON', street: '52A Kalathil', postal: '685505', parentText: 'IN, Vagamon', phone: '9447487194', url: 'www.greenshorevilla.com', lat: 9.6862, lng: 76.9058 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Greenshore', 'Greenshore Villa'], street: ['52A Kalathil, Valacode', '52A Kalathil'], street2: ['Opposite St George Malankara Church, Valacode', 'Valacode', ''], postal: '685505', parent: 'g2005',
    phone: '+91 94474 87194', email: ['vagamon@greenshorevilla.com', 'shiju@greenshorevilla.com'], url: 'http://www.greenshorevilla.com', type: 'Guest House', lat: 9.72082, lng: 76.97348 },
  geoTol: 300,
  tip: 'The feed URL had no http:// — fix it. The pin sat 8 km away in Vagamon town; the property is in Valacode.' },

{ id: 'D3-03', source: 'https://www.keralatourism.org/homestays/mangal-caverns-homestay/6752', day: 3, q: 3, req: 121571234,
  feed: { name: 'Mangal Caverns Homestay', street: 'Valacode', postal: '685505', parentText: 'IN, Vagamon', phone: '9496428060', lat: 9.6862, lng: 76.9058 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Mangal Caverns Homestay', street: ['Valacode', 'Valacode, Vagamon'], postal: '685505', parent: 'g2005',
    phone: ['+91 94964 28060', '+91 90744 87880'], email: 'varghesemangalathil@gmail.com', url: '', type: 'Guest House', lat: 9.73092, lng: 76.98665 },
  geoTol: 300,
  tip: 'Same feed pin as the last case — feeds often drop every property on the town centre. Always move the pin to the property.' },

{ id: 'D3-04', source: 'https://www.keralatourism.org/homestays/kalariyullathil-homestay/6659', day: 3, q: 4, req: 121571250,
  feed: { name: 'Kalariyullathil Homestay', street: 'Behind BJP Maraar Office, Payyoli-Perambra Road', postal: '673522', parentText: 'IN, Calicut', phone: '9727931861', url: 'http://airbnb.com/h/kalariyullathil', lat: 11.2588, lng: 75.7804 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Kalariyullathil Homestay', street: ['Payyoli-Perambra Road, Kizhur', 'Behind BJP Maraar Office, Payyoli-Perambra Road', 'Payyoli Perambra Road'], postal: '673522', parent: ['g2022', 'g2021'],
    phone: '+91 97279 31861', email: ['jeejabai_kp@yahoo.com', 'annajk3@gmail.com'], url: '', type: 'Guest House', lat: 11.523667, lng: 75.638058 },
  geoTol: 300,
  tip: 'An Airbnb link is NOT an official website — the URL must stay blank. The feed pin was in Kozhikode city, 33 km from Payyoli.' },

{ id: 'D3-05', source: 'https://www.keralatourism.org/homestays/dakshin-ayodhya-homestay/7229', day: 3, q: 5, req: 121571268,
  feed: { name: 'Dakshin Ayodhya Homestay', street: '16/491, Chethikattil', postal: '680571', parentText: 'IN, Trichur', phone: '9495973070', lat: 10.7905, lng: 78.7047 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Dakshin Ayodhya Homestay', street: ['16/491, Chethikattil, Velu Amman Padi Junction', '16/491, Chethikattil'], street2: ['Near SNMHS School, Chazhur', 'Chazhur', ''], postal: '680571', parent: 'g2025',
    phone: ['+91 94959 73070', '+91 94463 72070'], email: ['dakshinayodhya@gmail.com', 'dika.23@gmail.com'], url: '', type: 'Guest House', lat: 10.43693, lng: 76.14976 },
  geoTol: 300,
  tip: '"Trichur" is the old name of Thrissur (Kerala). The feed pin went to Trichy (Tiruchirappalli) in Tamil Nadu — 280 km away.' },

{ id: 'D3-06', source: 'https://www.keralatourism.org/homestays/pannadikadu-homestay/7301', day: 3, q: 6, req: 121571281,
  feed: { name: 'Pannadikadu Homestay', street: 'T.House Thumbassery, Chemmanampathy', postal: '678507', parentText: 'IN, Palakkad', phone: '9539284669', lat: 10.7867, lng: 76.6548 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Pannadikadu Homestay', street: ['9/312, Thumbassery House, Chemmanampathy', '9/312, T.House Thumbassery, Chemmanampathy', 'Thumbassery, Chemmanampathy'], postal: '678507', parent: ['g2029', 'g2030'],
    phone: ['+91 95392 84669', '+91 4923 294049'], email: ['pannadikadu@gmail.com', 'geothumpassery@gmail.com'], url: 'https://pannadikaduhomestay.com', type: 'Guest House', rooms: 2, lat: 10.560042, lng: 76.829929 },
  geoTol: 300,
  tip: 'The feed pin was in Palakkad town, 30 km away. The homestay is two cottages near Muthalamada — rooms = 2.' },

{ id: 'D3-07', day: 3, q: 7, req: 121571297,
  feed: { name: 'Spice Village CGH Earth Kumily', street: 'Thekkady-Kumily Road', postal: '685536', parentText: 'IN, Thekkady', type: 'Resort', lat: 9.6036, lng: 77.1633 },
  ans: { decision: 'alias', reason: 'duplicate', name: 'Spice Village', parent: 'g2004', type: 'Resort', lat: 9.6036, lng: 77.1633 },
  tip: 'Spice Village is a well-known Thekkady resort already on Tripadvisor. Brand and town were padded into the feed name. Alias it.' },

{ id: 'D3-08', day: 3, q: 8, req: 121571310,
  feed: { name: 'Napier Museum', street: 'Museum Road', postal: '695033', parentText: 'IN, Trivandrum', type: 'Hotel', lat: 8.5089, lng: 76.9554 },
  ans: { decision: 'reject', reason: 'not_accommodation', name: 'Napier Museum', parent: 'g2017', type: '', lat: 8.5089, lng: 76.9554 },
  tip: 'The feed typed a famous museum as a Hotel. A museum is an attraction, not an accommodation — Reject.' },

{ id: 'D3-09', day: 3, q: 9, req: 121571326,
  feed: { name: 'Saltwind Heritage Inn', street: 'Fort Road', postal: '670001', parentText: 'IN, Kannur', type: 'Hotel', rooms: '14', lat: 11.8697, lng: 75.3632 },
  ans: { decision: 'reject', reason: 'unverifiable', name: 'Saltwind Heritage Inn', parent: 'g2019', lat: 11.8697, lng: 75.3632 },
  src: { audit: [{ date: '2026-10-01 02:40', who: 'Hopper bulk import', what: 'Request created – no phone, email or website supplied' }] },
  tip: 'No website, no Maps pin, no social pages, no Kerala Tourism entry — and the feed has no contact details. Unverifiable → Reject.' },

{ id: 'D3-10', day: 3, q: 10, req: 121571342,
  feed: { name: 'Royal Raft Houseboats', street: 'Kavanattinkara Jetty', postal: '686563', parentText: 'IN, Kumarakom', type: 'Specialty Lodging', lat: 9.6094, lng: 76.4350,
    desc: 'Luxury houseboats. Book ONLY on WhatsApp. Pay the full amount by GPay before travel — boarding point shared after payment.' },
  ans: { decision: 't2', reason: 'fraud', name: 'Royal Raft Houseboats', parent: 'g2013', type: 'Specialty Lodging', lat: 9.6094, lng: 76.4350 },
  src: { votes: [{ type: 'Scam', comment: 'Paid in full, never got a boarding point. Blocked on WhatsApp.', user: 'backwater_fan', email: 'ba***@mail.com', owner: 'No', date: '2026-09-21' }],
    owners: [{ name: 'Unknown', status: 'No owner verified', date: '', note: 'Request submitted from a free email address; no business registration supplied.' }] },
  tip: 'Pay-first with the location revealed only after payment, plus a scam report — classic booking-fraud pattern. Tier 2.' },

/* =========================== DAY 4 — INVESTIGATION =========================== */
{ id: 'D4-01', source: 'https://www.keralatourism.org/homestays/kachiprath-homestay/8427', day: 4, q: 1, req: 121584007,
  feed: { name: 'KACHIPRATH HOMESTAY', street: 'Makreri', parentText: 'IN, Kannur', phone: '9562445116', lat: 11.8745, lng: 75.3704 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Kachiprath Homestay', street: ['Makreri', 'Makreri, Kannur'], parent: 'g2019',
    phone: '+91 95624 45116', email: 'leenakachiprath@gmail.com', url: '', type: 'Guest House', lat: 11.850457, lng: 75.493033 },
  geoTol: 400,
  tip: 'A small rural homestay with very little online — the Kerala Tourism listing and Maps are your main sources. Pin it where the map shows it, 13 km inland from Kannur town.' },

{ id: 'D4-02', source: 'https://www.keralatourism.org/homestays/happy-valley-home-stay/8789', day: 4, q: 2, req: 121584023,
  feed: { name: 'Happy Valley Homestay', street: 'Poomangalam', parentText: 'IN, Kannur', phone: '8921007335', type: 'Resort', lat: 11.8745, lng: 75.3704 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Happy Valley Home Stay', 'Happy Valley Homestay'], street: ['Poomangalam', 'Poomangalam, Kannur'], parent: ['g2020', 'g2019'],
    phone: '+91 89210 07335', email: 'varunthekkumbad@gmail.com', url: '', type: 'Guest House', lat: 12.058251, lng: 75.400833 },
  geoTol: 400,
  tip: 'The feed called it a Resort; it is a registered homestay → Guest House. Poomangalam is near Taliparamba, 20 km north of Kannur town.' },

{ id: 'D4-03', source: 'https://www.keralatourism.org/homestays/meadows-kannurs-serene-retreat-homestay/6952', day: 4, q: 3, req: 121584040,
  feed: { name: "Meadows: Kannurs Serene Retreat", street: 'Kannothumchal', postal: '670006', parentText: 'IN, Kannur', phone: '8075389103', lat: 11.8745, lng: 75.3704 },
  ans: { decision: 'approve', reason: 'new_verified', name: ["Meadows: Kannur's Serene Retreat Homestay", 'Meadows: Kannurs Serene Retreat Homestay', 'Meadows Homestay', 'Meadows'], street: ['Opposite Income Tax Office, Kannothumchal', 'Kannothumchal'], street2: ['Chovva', ''], postal: '670006', parent: 'g2019',
    phone: '+91 80753 89103', email: 'akmalyasheen@gmail.com', url: '', type: ['Guest House', 'Apartment Hotel'], rooms: 2, lat: 11.873109, lng: 75.391356 },
  geoTol: 250,
  tip: 'A two-bedroom home in Kannothumchal (Chovva) — rooms = 2. Landmarks such as "opposite Income Tax Office" go with the street.' },

{ id: 'D4-04', source: 'https://www.keralatourism.org/homestays/spice-garden-residency/6363', day: 4, q: 4, req: 121584056,
  feed: { name: 'Spice Garden Residency', street: 'Vettilappara', postal: '680721', parentText: 'IN, Athirappilly', type: 'Hotel', phone: '9495163602', lat: 10.2850, lng: 76.5694 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Spice Garden Residency', street: ['Vettilappara 15, Pariyaram', 'Vettilappara 15', 'Vettilappara'], postal: '680721', parent: 'g2028',
    phone: '+91 94951 63602', email: 'spicegardenresidency@gmail.com', url: '', type: 'Guest House', lat: 10.291252, lng: 76.506007 },
  geoTol: 300,
  tip: '"Residency" sounds like a hotel, but it is registered as a homestay → Guest House. The feed pin sat at the waterfall, 7 km away.' },

{ id: 'D4-05', source: 'https://www.keralatourism.org/homestays/aathira-agri-homes/7136', day: 4, q: 5, req: 121584071,
  feed: { name: 'Aathira Agri Homes', parentText: 'IN, Athirappilly', phone: '9446404151', lat: 10.2850, lng: 76.5694 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Aathira Agri-Homes', 'Aathira Agri Homes'], parent: ['g2027', 'g2028'],
    phone: '+91 94464 04151', email: 'babyranibsnl@gmail.com', url: '', type: ['Guest House', 'Specialty Lodging'], lat: 10.323819, lng: 76.394271 },
  geoTol: 500,
  tip: 'The listing mentions Athirappilly, but the map shows the farm-stay near Chalakudy, 20 km west. When text and map disagree, trust where the property physically is.' },

{ id: 'D4-06', day: 4, q: 6, req: 121584088,
  feed: { name: 'Taj Palace & Tower Colaba', street: 'Apollo Bunder', postal: '400001', parentText: 'IN, Mumbai', type: 'Hotel', lat: 18.9217, lng: 72.8332 },
  ans: { decision: 'alias', reason: 'duplicate', name: 'The Taj Mahal Palace', parent: 'g2033', type: 'Hotel', lat: 18.9217, lng: 72.8332 },
  tip: 'One of the most famous hotels in India — it is obviously on Tripadvisor. Match it to the existing listing.' },

{ id: 'D4-07', day: 4, q: 7, req: 121584103,
  feed: { name: 'Leopold Cafe & Stay', street: 'Colaba Causeway', postal: '400005', parentText: 'IN, Mumbai', type: 'Hotel', lat: 18.9227, lng: 72.8317 },
  ans: { decision: 'reject', reason: 'not_accommodation', name: 'Leopold Cafe', parent: 'g2033', type: '', lat: 18.9227, lng: 72.8317 },
  tip: 'Leopold Cafe is a famous restaurant and bar. "& Stay" in the feed doesn\'t make it lodging — there are no guest rooms. Reject.' },

{ id: 'D4-08', day: 4, q: 8, req: 121584119,
  feed: { name: 'Cliffnova Suites', street: 'North Cliff', postal: '695141', parentText: 'IN, Varkala', type: 'Hotel', rooms: '18', lat: 8.7379, lng: 76.7163 },
  ans: { decision: 'reject', reason: 'unverifiable', name: 'Cliffnova Suites', parent: 'g2014', lat: 8.7379, lng: 76.7163 },
  tip: 'Varkala North Cliff is full of real guesthouses, but none with this name — no site, no Maps listing, no socials, no registration. Unverifiable → Reject.' },

{ id: 'D4-09', day: 4, q: 9, req: 121584134,
  feed: { name: 'Cloudcrest Resort Ponmudi', street: 'Ponmudi Ghat Road, 22nd Hairpin', parentText: 'IN, Ponmudi', type: 'Resort', lat: 8.7600, lng: 77.1160 },
  ans: { decision: 't2', reason: 'safety_legal', name: 'Cloudcrest Resort Ponmudi', parent: 'g2018', type: 'Resort', lat: 8.7600, lng: 77.1160 },
  src: {
    votes: [{ type: 'Unsafe', comment: 'Retaining wall behind the cottages collapsed in the July rains. Guests were still being booked.', user: 'hillstation_hiker', email: 'hi***@mail.com', owner: 'No', date: '2026-08-02' }],
    owners: [{ name: 'Local resident', status: 'Report', date: '2026-08-10', note: 'Uploaded a panchayat stop-memo: the building has no safety clearance and sits in a notified landslide-risk zone.' }],
    audit: [{ date: '2026-09-18 11:05', who: 'Hopper feed', what: 'Request created' }, { date: '2026-09-20 09:30', who: 'Community', what: 'Safety report attached to request' }] },
  tip: 'A collapse report and a stop-memo about safety clearance are a safety/legal concern. You never decide those yourself — Tier 2.' },

{ id: 'D4-10', day: 4, q: 10, req: 121584150,
  feed: { name: 'Whispering Canopy Treehouse', street: 'Pookode Lake Road', postal: '673576', parentText: 'IN, Vythiri', type: 'Specialty Lodging', lat: 11.5420, lng: 76.0270 },
  ans: { decision: 't2', reason: 'brand_dispute', name: 'Whispering Canopy Treehouse', parent: 'g2010', type: 'Specialty Lodging', lat: 11.5420, lng: 76.0270 },
  src: { owners: [
    { name: 'A. Thomas', status: 'Verified owner', date: '2025-11-04', note: 'Disputes this request: "It was submitted by our former manager, who no longer has any authority over the property."' },
    { name: 'K. Manoj', status: 'Owner claim pending', date: '2026-09-26', note: 'Claims to be the new operator; no documents uploaded.' } ] },
  tip: 'Two people claim to control the property and one formally disputes the request. Ownership disputes go to Tier 2.' },

/* =========================== DAY 5 — FINAL MIXED MISSION =========================== */
{ id: 'D5-01', source: 'https://www.keralatourism.org/homestays/maliyeckal-homestay/5960', day: 5, q: 1, req: 121597011,
  feed: { name: 'MALIYECKAL HOME STAY', street: 'Anaviratty', postal: '685612', parentText: 'IN, Munnar', phone: '9895352958', lat: 10.0889, lng: 77.0595 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Maliyeckal Homestay', 'Maliyeckal Home Stay'], street: ['Anaviratty', 'Anaviratty, Munnar'], postal: '685561', parent: 'g2001',
    phone: '+91 98953 52958', email: 'lejumichael001@gmail.com', url: '', type: 'Guest House', lat: 10.0132323, lng: 77.0004625 },
  geoTol: 400,
  tip: 'Three feed errors at once: ALL CAPS, Munnar town\'s PIN, and a pin 10 km from Anaviratty.' },

{ id: 'D5-02', source: 'https://www.keralatourism.org/homestays/evara-residency-homestay/7555', day: 5, q: 2, req: 121597027,
  feed: { name: 'Evara Residency', street: 'Mararikulam South', postal: '688001', parentText: 'IN, Alappuzha', phone: '7907282603', type: 'Hotel', lat: 9.4981, lng: 76.3388 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Evara Residency Homestay', 'Evara Residency'], street: ['Mararikulam South', 'Mararikulam South, Alappuzha'], parent: ['g2012', 'g2011'],
    phone: '+91 79072 82603', email: 'evara2322@gmail.com', url: '', type: 'Guest House', lat: 9.583868, lng: 76.321064 },
  geoTol: 400,
  tip: 'Mararikulam is a beach village 10 km north of Alappuzha town — pick Mararikulam as parent and move the pin. The Kerala Tourism listing shows no PIN, so it isn\'t scored here.' },

{ id: 'D5-03', source: 'https://www.keralatourism.org/homestays/nickies-nest-homestay/8246', day: 5, q: 3, req: 121597044,
  feed: { name: 'Nickies Nest', parentText: 'IN, Kollam', phone: '9995682897', lat: 8.8932, lng: 76.6141 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['Nickies Nest Homestay', "Nickie's Nest Homestay", 'Nickies Nest'], parent: 'g2023',
    phone: '+91 99956 82897', email: 'nicksmunroe@gmail.com', url: '', type: 'Guest House', lat: 8.998114, lng: 76.619579 },
  geoTol: 400,
  tip: 'Very little data in the feed. Searching the name + "Munroe" finds the Kerala Tourism listing — parent is Munroe Island, not Kollam city.' },

{ id: 'D5-04', source: 'https://www.keralatourism.org/homestays/the-nest-homestay/7020', day: 5, q: 4, req: 121597060,
  feed: { name: 'The Nest Kovalam', street: 'GV Raja Road', postal: '695527', parentText: 'Kovalam', phone: '6282044427', url: 'https://www.airbnb.com/rooms/1280402564039089747', lat: 12.7900, lng: 80.2540 },
  ans: { decision: 'approve', reason: 'new_verified', name: ['The Nest Homestay', 'The Nest'], street: ['TC 64/2248 (3), GV Raja Road', 'GV Raja Road'], street2: ['Vellar', ''], postal: '695527', parent: 'g2015',
    phone: '+91 62820 44427', email: 'bookthenestkovalam1@gmail.com', url: '', type: ['Guest House', 'Apartment Hotel'], lat: 8.403506, lng: 76.975703 },
  geoTol: 250,
  tip: 'Kovalam trap again (the pin was in Tamil Nadu), and the feed URL is an Airbnb link — URL must stay blank.' },

{ id: 'D5-05', source: 'https://www.keralatourism.org/homestays/brick-house/7103', day: 5, q: 5, req: 121597077,
  feed: { name: 'Brick House', parentText: 'IN, Calicut', phone: '7012867804', type: 'Hotel', lat: 11.2588, lng: 75.7804 },
  ans: { decision: 'approve', reason: 'new_verified', name: 'Brick House', parent: 'g2021',
    phone: '+91 70128 67804', email: 'symphony.brickhouse@gmail.com', url: '', type: 'Guest House', lat: 11.2289491, lng: 75.7943301 },
  geoTol: 400,
  tip: 'A very generic name — search it with the city and phone number to find the right property (a registered homestay → Guest House).' },

{ id: 'D5-06', day: 5, q: 6, req: 121597093,
  feed: { name: 'MBS Hotel Tower 1 Singapore', street: '10 Bayfront Avenue', postal: '018956', parentText: 'SG, Singapore', type: 'Hotel', lat: 1.2834, lng: 103.8607 },
  ans: { decision: 'alias', reason: 'duplicate', name: 'Marina Bay Sands', parent: 'g2034', type: 'Hotel', lat: 1.2834, lng: 103.8607 },
  tip: '"MBS Hotel Tower 1" is Marina Bay Sands — one of the best-known hotels in the world. Alias, never create.' },

{ id: 'D5-07', day: 5, q: 7, req: 121597110,
  feed: { name: 'Wonderla Kochi Resort', street: 'Pallikkara', postal: '683565', parentText: 'IN, Kochi', type: 'Resort', lat: 10.0225, lng: 76.4055 },
  ans: { decision: 'reject', reason: 'not_accommodation', name: 'Wonderla Kochi', parent: 'g2006', type: '', lat: 10.0225, lng: 76.4055 },
  tip: 'Wonderla Kochi is an amusement park. (There is a Wonderla resort — but it\'s in Bengaluru, not Kochi.) Check the city before you decide. Reject.' },

{ id: 'D5-08', day: 5, q: 8, req: 121597126,
  feed: { name: 'Lanternhouse Grande', street: 'Princess Street', postal: '682001', parentText: 'IN, Fort Kochi', type: 'Hotel', rooms: '26', lat: 9.9660, lng: 76.2425 },
  ans: { decision: 'reject', reason: 'unverifiable', name: 'Lanternhouse Grande', parent: 'g2006', lat: 9.9660, lng: 76.2425 },
  tip: 'Princess Street is real and busy, but nothing online matches this name. With no evidence, Reject as Unverifiable.' },

{ id: 'D5-09', day: 5, q: 9, req: 121597141,
  feed: { name: 'Tamarindbay Residency', street: 'Beach Road', postal: '673032', parentText: 'IN, Kozhikode', type: 'Hotel', lat: 11.2560, lng: 75.7700 },
  ans: { decision: 'reject', reason: 'unverifiable', name: 'Tamarindbay Residency', parent: 'g2021', lat: 11.2560, lng: 75.7700 },
  tip: 'No trace anywhere and no contact details in the feed. Unverifiable → Reject. (No scam signs, so not Tier 2.)' },

{ id: 'D5-10', day: 5, q: 10, req: 121597158,
  feed: { name: 'Azure Pearl Villas', street: 'Lighthouse Beach', postal: '695527', parentText: 'IN, Kovalam', type: 'Resort', email: 'reservations.azurepearl@gmail.com', url: 'https://securepay-kovalamvillas.example', lat: 8.3832, lng: 76.9790,
    desc: 'Booking confirmed only after payment at securepay-kovalamvillas.example within 2 hours, otherwise cancelled. Card details required.' },
  ans: { decision: 't2', reason: 'fraud', name: 'Azure Pearl Villas', parent: 'g2015', type: 'Resort', lat: 8.3832, lng: 76.9790 },
  src: { votes: [{ type: 'Scam', comment: 'Payment page stole my card details — two unknown charges the same night.', user: 'sunset_seeker', email: 'su***@mail.com', owner: 'No', date: '2026-10-03' }] },
  tip: 'A payment link with a 2-hour deadline and a report of stolen card details = phishing. Fraud → Tier 2.' }
];

/* Export for Node tooling (answer-key builder). Ignored in the browser. */
if (typeof module !== 'undefined') module.exports = { BRANDS, ACCOM_TYPES, DECISIONS, REASONS, GEOS, CASES };
